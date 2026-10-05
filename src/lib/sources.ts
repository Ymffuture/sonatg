// src/lib/sources.ts
//
// Isomorphic helpers (no fetch, no env vars) for the "sources" Sona AI used.
//
// The server (ai.functions.ts) appends a compact machine-readable marker to the
// END of an AI reply's `body`:
//
//   ...reply text...
//
//   [[sona-sources:%5B%7B%22title%22...%5D]]
//
// The browser strips the marker before rendering and shows the sources as pills
// that open a bottom sheet. No DB migration needed, and older clients simply
// see plain text (apart from the marker, which the patched previews strip too).

export type SourceKind = "weather" | "news" | "web";

export type Source = {
  title: string;
  url: string;
  /** Publication / site name, e.g. "BBC News". */
  site?: string;
  /** Short excerpt that backed the answer. */
  snippet?: string;
  /** ISO date (YYYY-MM-DD) when known. */
  publishedAt?: string;
  kind: SourceKind;
};

const MARKER_RE = /\n*\[\[sona-sources:([^\]]+)\]\]\s*$/;
// Optional study-set pointer: "[[sona-study:<uuid>]]" (a quiz / flashcards the user asked Sona to make).
const STUDY_MARKER_RE = /\n*\[\[sona-study:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]\]\s*$/i;
// Optional confirm-card pointer: "[[sona-action:<uuid>]]" sits just before the sources marker.
const ACTION_MARKER_RE = /\n*\[\[sona-action:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]\]\s*$/i;
const MAX_SOURCES = 6;

/** Only http(s) links are ever rendered/opened — blocks javascript: and data: URLs. */
export function isSafeHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function clean(s: unknown, max: number): string | undefined {
  if (typeof s !== "string") return undefined;
  const t = s.replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : undefined;
}

/** Validates untrusted JSON (it came out of a chat message row). */
function sanitize(input: unknown): Source[] {
  if (!Array.isArray(input)) return [];
  const out: Source[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const url = typeof r.url === "string" ? r.url.trim() : "";
    if (!url || !isSafeHttpUrl(url) || seen.has(url)) continue;
    seen.add(url);
    const kind: SourceKind = r.kind === "weather" || r.kind === "news" ? r.kind : "web";
    out.push({
      url,
      kind,
      title: clean(r.title, 140) ?? hostOf(url),
      site: clean(r.site, 60),
      snippet: clean(r.snippet, 280),
      publishedAt: clean(r.publishedAt, 10),
    });
    if (out.length >= MAX_SOURCES) break;
  }
  return out;
}

/** Splits a stored message body into display text, structured sources and an optional action id. */
export function splitSources(
  body: string | null | undefined,
): { text: string; sources: Source[]; actionId: string | null; studyId: string | null } {
  let text = body ?? "";
  let sources: Source[] = [];
  let actionId: string | null = null;
  let studyId: string | null = null;

  const m = text.match(MARKER_RE);
  if (m) {
    try {
      sources = sanitize(JSON.parse(decodeURIComponent(m[1])));
    } catch {
      /* malformed marker: just hide it */
    }
    text = text.slice(0, m.index).trimEnd();
  }
  // Peeled in the reverse of the order withSources() appends them: sources, study, action.
  const st = text.match(STUDY_MARKER_RE);
  if (st) {
    studyId = st[1].toLowerCase();
    text = text.slice(0, st.index).trimEnd();
  }
  const a = text.match(ACTION_MARKER_RE);
  if (a) {
    actionId = a[1].toLowerCase();
    text = text.slice(0, a.index).trimEnd();
  }
  return { text, sources, actionId, studyId };
}

/** Display text only — use anywhere a raw `msg.body` is shown (previews, search, export). */
export function stripSources(body: string | null | undefined): string {
  return splitSources(body).text;
}

// "Sources:" list the model was asked to write at the end of its reply.
const MODEL_LIST_RE = /\n+(?:\*\*|#+\s*)?Sources?:?(?:\*\*)?[ \t]*\n[\s\S]*$/i;

/**
 * Server-side: replaces the model's plain-text "Sources:" list with the
 * structured sources we actually fetched, filtered to the ones the model cited.
 * - Model cited some of them  -> keep only those (by URL, host or site name).
 * - Model wrote no list at all -> keep the first few (live data was fetched
 *   because the question asked for it; weaker free models often skip the list).
 * - Model wrote a list but cited none of ours -> attach nothing.
 */
export function withSources(
  reply: string,
  fetched: Source[],
  actionId?: string | null,
  studyId?: string | null,
): string {
  const action = (actionId ? `\n\n[[sona-action:${actionId}]]` : "") + (studyId ? `\n\n[[sona-study:${studyId}]]` : "");
  if (!fetched.length) return `${reply.trimEnd()}${action}`;
  const listMatch = reply.match(MODEL_LIST_RE);
  const text = (listMatch ? reply.slice(0, listMatch.index) : reply).trimEnd();
  const tail = (listMatch?.[0] ?? "").toLowerCase();

  let chosen: Source[];
  if (listMatch) {
    chosen = fetched.filter(
      (s) =>
        tail.includes(s.url.toLowerCase()) ||
        tail.includes(hostOf(s.url).toLowerCase()) ||
        (!!s.site && tail.includes(s.site.toLowerCase())),
    );
  } else {
    chosen = fetched.slice(0, 4);
  }
  chosen = chosen.slice(0, MAX_SOURCES);
  if (!chosen.length) return `${text}${action}`;
  return `${text}${action}\n\n[[sona-sources:${encodeURIComponent(JSON.stringify(chosen))}]]`;
}
