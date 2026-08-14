// src/features/moderation/useMessageModeration.ts
// Single hook the chat UI calls before sending a message. Runs the local
// engine instantly (no network) and, if that's inconclusive, fires the AI
// classifier for a second opinion. New file — wire it into SonaChat.tsx
// with a single `await checkMessage(...)` call at the top of your existing
// send handler; no other existing code needs to change.

import { useCallback, useRef, useState } from "react";
import { DEFAULT_MODERATION_CONFIG, evaluateMessage } from "./detectionEngine";
import { classifyMessageForModeration } from "./aiModeration.functions";
import { mergeVerdicts } from "./mergeVerdicts";
import type { ModerationConfig, ModerationResult, RecentMessageForAnalysis } from "./types";

interface UseMessageModerationOptions {
  config?: Partial<ModerationConfig>;
  /** Skip the AI call entirely (e.g. offline, or org disabled AI moderation) */
  aiEnabled?: boolean;
}

export function useMessageModeration(options: UseMessageModerationOptions = {}) {
  const config: ModerationConfig = { ...DEFAULT_MODERATION_CONFIG, ...options.config };
  const aiEnabled = options.aiEnabled ?? true;

  const [lastResult, setLastResult] = useState<ModerationResult | null>(null);
  // Rolling per-sender history used for bullying-pattern detection (repeated
  // targeting, message bursts). Keep this in memory client-side; nothing
  // here needs to be persisted for the detection itself.
  const historyRef = useRef<RecentMessageForAnalysis[]>([]);

  const recordSentMessage = useCallback((msg: RecentMessageForAnalysis) => {
    historyRef.current = [...historyRef.current.slice(-19), msg];
  }, []);

  /**
   * Call this before inserting a message. Returns the merged verdict.
   * `allowed === false` means block the send and show ModerationAlert.
   * `allowed === true && shouldLog === true` means send it, but also log
   * to the moderation_queue table for admin review (silent flag).
   */
  const checkMessage = useCallback(
    async (
      body: string,
      chatId: string,
      senderId: string,
      targetUserId?: string | null,
    ): Promise<ModerationResult> => {
      const recentFromSameSender = historyRef.current.filter((m) => m.senderId === senderId);
      const local = evaluateMessage(body, recentFromSameSender, config);

      let result = local;

      // Only spend an AI call when the local engine found *something* worth a
      // second opinion. Keeps latency near-zero for the common clean-message case.
      const worthAiCheck = aiEnabled && (local.wordMatches.length > 0 || local.patternSignals.length > 0);
      if (worthAiCheck) {
        try {
          const recentContext = recentFromSameSender.slice(-4).map((m) => m.body);
          const verdict = await classifyMessageForModeration({
            data: { chatId, body, recentContext },
          });
          result = mergeVerdicts(local, verdict, config.blockThreshold);
        } catch {
          // AI call failed — fall back to the local-only verdict rather than blocking.
          result = local;
        }
      }

      recordSentMessage({ senderId, chatId, body, createdAtMs: Date.now(), targetUserId });
      setLastResult(result);
      return result;
    },
    [aiEnabled, config, recordSentMessage],
  );

  return { checkMessage, lastResult };
}
