// src/features/moderation/types.ts
// Shared types for blocked-word alerts + bullying-pattern detection.
// New file — does not touch any existing chat code.

export type ModerationCategory =
  | "profanity"
  | "harassment"
  | "threat"
  | "hate"
  | "self-harm"
  | "custom";

export type ModerationSeverity = "low" | "medium" | "high";

export interface BlockedWordMatch {
  word: string;
  category: ModerationCategory;
  index: number; // position in the message body
}

export interface BullyingPatternSignal {
  /** Machine-readable id for the pattern that fired, e.g. "repeated_targeting" */
  id: string;
  /** Human-readable explanation shown to moderators */
  description: string;
  weight: number; // 0-1 contribution to the overall severity score
}

export interface ModerationResult {
  allowed: boolean;
  severity: ModerationSeverity;
  score: number; // 0-1 aggregate risk score
  wordMatches: BlockedWordMatch[];
  patternSignals: BullyingPatternSignal[];
  /** True when this message should be silently logged for the admin queue but still sent */
  shouldLog: boolean;
}

export interface RecentMessageForAnalysis {
  senderId: string;
  chatId: string;
  body: string;
  createdAtMs: number;
  /** Optional: the id of the user this message appears to be directed at (reply target, @mention target) */
  targetUserId?: string | null;
}

export interface ModerationConfig {
  /** Additional words/phrases an org/school admin wants blocked, beyond the built-in list */
  customBlockedWords?: string[];
  /** Severity at/above which a message is blocked outright instead of just flagged */
  blockThreshold: ModerationSeverity;
  /** Window used to evaluate bullying patterns (repeated messages at one target, etc.) */
  patternWindowMs: number;
}
