// src/features/admin/moderationSummary.ts
// Turns a raw public.moderation_queue row into a short, readable sentence
// an admin can scan in a report list without parsing JSON or raw category
// arrays themselves. Pure function — easy to unit test, no DB/network calls.

export interface ModerationQueueRow {
  id: string;
  chat_id: string;
  sender_id: string;
  sender_display_name: string | null;
  body_snapshot: string;
  severity: "low" | "medium" | "high";
  score: number;
  blocked: boolean;
  categories: string[];
  pattern_signals: Array<{ id: string; description: string; weight: number }>;
  reviewed: boolean;
  created_at: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  profanity: "profanity",
  harassment: "harassing language",
  threat: "a possible threat",
  hate: "hate speech",
  "self-harm": "self-harm risk language",
  custom: "a blocked term",
};

const SEVERITY_LABELS: Record<ModerationQueueRow["severity"], string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

/** Trims a message body for display without showing the whole thing verbatim in a list row. */
export function snippet(body: string, max = 80): string {
  const clean = body.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

/**
 * Builds a one-line, human-readable summary for the admin moderation
 * report, e.g.:
 *   "High severity — harassing language + repeated targeting (3 msgs).
 *    Blocked before sending. Jane D., 2:14 PM."
 */
export function summarizeModerationRow(row: ModerationQueueRow): string {
  const reasons: string[] = [];

  const catLabels = row.categories
    .map((c) => CATEGORY_LABELS[c] ?? c)
    .filter((v, i, arr) => arr.indexOf(v) === i); // de-dupe
  if (catLabels.length) reasons.push(catLabels.join(" + "));

  for (const signal of row.pattern_signals) {
    // AI classifier signals already carry a full sentence — use as-is,
    // shortened; rule-based pattern signals get their raw description.
    reasons.push(signal.description);
  }

  const reasonText = reasons.length ? reasons.join("; ") : "flagged content";
  const outcome = row.blocked ? "Blocked before sending" : "Sent, flagged for review";
  const who = row.sender_display_name ?? "Unknown sender";
  const when = new Date(row.created_at).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return `${SEVERITY_LABELS[row.severity]} severity — ${reasonText}. ${outcome}. ${who}, ${when}.`;
}

/** Groups queue rows by severity for a report that leads with the worst first. */
export function groupBySeverity(rows: ModerationQueueRow[]) {
  return {
    high: rows.filter((r) => r.severity === "high"),
    medium: rows.filter((r) => r.severity === "medium"),
    low: rows.filter((r) => r.severity === "low"),
  };
}
