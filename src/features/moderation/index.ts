// src/features/moderation/index.ts
// Public surface of the moderation feature. Import from "@/features/moderation".

export * from "./types";
export * from "./blockedWords";
export * from "./detectionEngine";
export * from "./mergeVerdicts";
export { classifyMessageForModeration } from "./aiModeration.functions";
export type { AIModerationInput, AIModerationVerdict } from "./aiModeration.functions";
export { useMessageModeration } from "./useMessageModeration";
export { ModerationAlert } from "./ModerationAlert";
