// src/features/moderation/ModerationAlert.tsx
// Small, self-contained alert banner shown above the composer when a
// message is blocked or flagged. New component — not wired into any
// existing file automatically.

import { AlertTriangle, ShieldAlert } from "lucide-react";
import type { ModerationResult } from "./types";

interface ModerationAlertProps {
  result: ModerationResult;
  onDismiss?: () => void;
}

export function ModerationAlert({ result, onDismiss }: ModerationAlertProps) {
  if (!result.shouldLog && result.allowed) return null;

  const blocked = !result.allowed;
  const topSignal = result.patternSignals[0]?.description;
  const topWord = result.wordMatches[0]?.category;

  return (
    <div
      role="alert"
      className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
        blocked
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-yellow-400/40 bg-yellow-400/10 text-yellow-700 dark:text-yellow-400"
      }`}
    >
      {blocked ? <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
      <div className="flex-1">
        <p className="font-medium">
          {blocked ? "This message can't be sent" : "This message may violate community guidelines"}
        </p>
        <p className="text-xs opacity-80">
          {blocked
            ? "It looks like it contains language that isn't allowed here."
            : "It's been sent and also logged for a moderator to review."}
          {topSignal ? ` (${topSignal})` : topWord ? ` (${topWord})` : ""}
        </p>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs underline opacity-70 hover:opacity-100"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}
