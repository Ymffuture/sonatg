// src/lib/gemini.functions.ts
// Reads images and documents (PDFs, slides, etc.) shared with Sona AI
// using Google's Gemini API directly, instead of routing attachments
// through the general OpenRouter chat model. Gemini is meaningfully
// stronger at document/image understanding (OCR, layout, charts) than
// the lightweight free-tier chat model used for plain text turns, so
// this is called only when the current turn actually has an attachment
// — plain text conversation still goes through the existing OpenRouter
// gateway in ai.functions.ts.
//
// Not exposed as its own createServerFn — it's a plain server-side
// helper imported by askSonaAI's handler, which already carries the
// auth/membership checks for the request.

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export interface GeminiAttachment {
  base64: string; // raw base64, no "data:...;base64," prefix
  mimeType: string;
  /** Original filename, used only to give Gemini a hint for non-image files. */
  fileName?: string | null;
}

export interface GeminiChatTurn {
  role: "user" | "model";
  text: string;
}

/**
 * Downloads a URL and returns it split into base64 + content-type, ready
 * for Gemini's inline_data part (which wants raw base64, unlike OpenRouter's
 * data: URI convention).
 */
export async function urlToGeminiAttachment(url: string, fileName?: string | null): Promise<GeminiAttachment> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Couldn't download attachment [${res.status}]`);
  const mimeType = res.headers.get("content-type") ?? "application/octet-stream";
  const buffer = Buffer.from(await res.arrayBuffer());
  return { base64: buffer.toString("base64"), mimeType, fileName };
}


export type GeminiResearchSource = {
  title: string;
  url: string;
  site?: string;
  snippet?: string;
  publishedAt?: string;
  kind?: string;
};

export type GeminiResearchResult = {
  text: string;
  sources: GeminiResearchSource[];
  queries: string[];
};

/**
 * Gemini's native live-research layer.
 *
 * For web intents, Gemini itself decides whether a Google Search is needed,
 * generates the search query/queries, searches the live web, synthesizes the
 * evidence, and returns citation annotations. The selected Sona model remains
 * responsible for the final user-facing answer.
 *
 * Google documents this flow through the Gemini Interactions API and the
 * `google_search` built-in tool.
 */
export async function researchWithGoogleSearch(params: {
  prompt: string;
  context?: string;
  systemInstruction?: string;
}): Promise<GeminiResearchResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Missing GEMINI_API_KEY");

  const model =
    process.env.GEMINI_SEARCH_MODEL ||
    process.env.GEMINI_MODEL ||
    "gemini-3.8-flash";

  const input = [
    params.systemInstruction ||
      "You are SonaTG's live web research layer. Research the user's request using Google Search.",
    "",
    "USER REQUEST:",
    params.prompt.slice(0, 6000),
    params.context ? "\nADDITIONAL LIVE CONTEXT:\n" + params.context.slice(0, 8000) : "",
    "",
    "Research the request using Google Search when current or web information is useful.",
    "Return concise research findings for another AI model, not a polished final answer.",
    "Prefer primary, official, recent, and authoritative sources.",
    "Never invent URLs, facts, quotes, prices, scores, dates, or citations.",
  ].join("\n");

  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key,
    },
    body: JSON.stringify({
      model,
      input,
      tools: [{ type: "google_search" }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("Gemini is busy right now, try again in a moment.");
    throw new Error(`Gemini Google Search failed [${res.status}]: ${body.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    output_text?: string;
    steps?: Array<{
      type?: string;
      arguments?: { queries?: string[] };
      content?: Array<{
        type?: string;
        text?: string;
        annotations?: Array<{
          type?: string;
          url?: string;
          title?: string;
          start_index?: number;
          end_index?: number;
          startIndex?: number;
          endIndex?: number;
        }>;
      }>;
    }>;
  };

  const sources: GeminiResearchSource[] = [];
  const queries: string[] = [];
  const seen = new Set<string>();
  let output = typeof json.output_text === "string" ? json.output_text.trim() : "";

  for (const step of json.steps ?? []) {
    if (step.type === "google_search_call") {
      for (const query of step.arguments?.queries ?? []) {
        if (typeof query === "string" && query.trim() && !queries.includes(query.trim())) {
          queries.push(query.trim());
        }
      }
    }

    if (step.type !== "model_output") continue;
    for (const block of step.content ?? []) {
      if (block.type !== "text") continue;
      if (!output && typeof block.text === "string") output = block.text.trim();

      for (const annotation of block.annotations ?? []) {
        if (annotation.type !== "url_citation") continue;
        const url = annotation.url?.trim();
        if (!url || !/^https?:\\/\\//i.test(url) || seen.has(url)) continue;
        seen.add(url);

        const startIndex = annotation.startIndex ?? annotation.start_index;
        const endIndex = annotation.endIndex ?? annotation.end_index;
        const citedText =
          typeof block.text === "string" &&
          Number.isInteger(startIndex) &&
          Number.isInteger(endIndex) &&
          (endIndex as number) > (startIndex as number)
            ? block.text.slice(startIndex as number, endIndex as number)
            : undefined;

        let site: string | undefined;
        try {
          site = new URL(url).hostname.replace(/^www\\./, "");
        } catch {
          site = undefined;
        }

        sources.push({
          title: annotation.title?.trim() || site || url,
          url,
          site,
          snippet: citedText?.replace(/\\s+/g, " ").trim().slice(0, 280),
          kind: "web",
        });
      }
    }
  }

  if (!output) throw new Error("Gemini returned no research context.");

  return { text: output, sources: sources.slice(0, 8), queries: queries.slice(0, 8) };
}

/**
 * Sends a prompt plus one image/file attachment to Gemini and returns its
 * text reply. Kept model-agnostic via env var so the deployment can swap
 * gemini-2.0-flash for a different Gemini model without a code change.
 */
export async function askGeminiWithAttachment(params: {
  prompt: string;
  attachment: GeminiAttachment;
  history?: GeminiChatTurn[];
  systemInstruction?: string;
}): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Missing GEMINI_API_KEY");

  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";

  const contents = [
    ...(params.history ?? []).map((turn) => ({
      role: turn.role,
      parts: [{ text: turn.text }],
    })),
    {
      role: "user",
      parts: [
        { text: params.prompt || "What's in this?" },
        { inline_data: { mime_type: params.attachment.mimeType, data: params.attachment.base64 } },
      ],
    },
  ];

  const res = await fetch(`${GEMINI_ENDPOINT}/${model}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      ...(params.systemInstruction
        ? { system_instruction: { parts: [{ text: params.systemInstruction }] } }
        : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("Gemini is busy right now, try again in a moment.");
    throw new Error(`Gemini request failed [${res.status}]: ${body}`);
  }

  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
  return text || "I looked at that, but couldn't come up with a reply — try asking again?";
}
