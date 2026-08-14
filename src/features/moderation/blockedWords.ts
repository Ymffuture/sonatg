// src/features/moderation/blockedWords.ts
// Built-in blocked-word lists. Kept intentionally mild/placeholder here —
// swap in your real word lists (or load them from the DB / an admin-managed
// table) before shipping to a school deployment. Words are lower-cased and
// matched on token boundaries, so plurals/punctuation don't slip through.

import type { ModerationCategory } from "./types";

export const BUILT_IN_BLOCKED_WORDS: Record<ModerationCategory, string[]> = {
  profanity: [
    // Add your full profanity list here (kept short/placeholder intentionally).
    "damn", "hell", "crap",
  ],
  harassment: [
    "shutup", "shut up", "loser", "nobody likes you", "kill yourself",
    "ugly", "stupid idiot", "worthless",
  ],
  threat: [
    "i'll hurt you", "i will hurt you", "watch your back", "you're dead",
    "meet me after school",
  ],
  hate: [
    // Slurs deliberately omitted from this placeholder list — plug in a
    // vetted hate-speech lexicon (e.g. via an admin-managed table) here.
  ],
  "self-harm": [
    "kill myself", "want to die", "end it all", "self harm", "self-harm",
  ],
  custom: [],
};

/** Flattened list with category attached, used by the detection engine. */
export function getAllBlockedWordEntries(customWords: string[] = []) {
  const entries: { word: string; category: ModerationCategory }[] = [];
  for (const [category, words] of Object.entries(BUILT_IN_BLOCKED_WORDS) as [
    ModerationCategory,
    string[],
  ][]) {
    for (const word of words) entries.push({ word: word.toLowerCase(), category });
  }
  for (const word of customWords) {
    entries.push({ word: word.toLowerCase(), category: "custom" });
  }
  return entries;
}
