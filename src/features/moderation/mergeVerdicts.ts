// src/features/moderation/mergeVerdicts.ts
// Combines the synchronous local engine (detectionEngine.ts) with the
// async AI classifier (aiModeration.functions.ts) into one final result.
// Kept as its own file so either detector can be swapped/tested alone.

import type { AIModerationVerdict } from "./aiModeration.functions";
import type { ModerationResult, ModerationSeverity } from "./types";

const SEVERITY_ORDER: ModerationSeverity[] = ["low", "medium", "high"];
const higherSeverity = (a: ModerationSeverity, b: ModerationSeverity) =>
  SEVERITY_ORDER.indexOf(a) >= SEVERITY_ORDER.indexOf(b) ? a : b;

export function mergeVerdicts(
  local: ModerationResult,
  ai: AIModerationVerdict,
  blockThreshold: ModerationSeverity,
): ModerationResult {
  if (!ai.flagged || ai.confidence < 0.5) return local;

  const severity = higherSeverity(local.severity, ai.severity);
  const score = Math.max(local.score, ai.confidence);
  const blocked = SEVERITY_ORDER.indexOf(severity) >= SEVERITY_ORDER.indexOf(blockThreshold);

  return {
    ...local,
    severity,
    score,
    allowed: !blocked,
    shouldLog: true,
    patternSignals: [
      ...local.patternSignals,
      {
        id: "ai_classifier",
        description: ai.reason || "AI classifier flagged this message",
        weight: ai.confidence,
      },
    ],
  };
}
