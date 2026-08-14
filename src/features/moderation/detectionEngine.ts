// src/features/moderation/detectionEngine.ts
// Pure, framework-free detection logic so it's easy to unit test and reuse
// both client-side (pre-send warning) and server-side (Supabase edge
// function / trigger, for a belt-and-suspenders check).

import { getAllBlockedWordEntries } from "./blockedWords";
import type {
  BlockedWordMatch,
  BullyingPatternSignal,
  ModerationConfig,
  ModerationResult,
  ModerationSeverity,
  RecentMessageForAnalysis,
} from "./types";

const SEVERITY_ORDER: ModerationSeverity[] = ["low", "medium", "high"];

function severityAtLeast(a: ModerationSeverity, b: ModerationSeverity) {
  return SEVERITY_ORDER.indexOf(a) >= SEVERITY_ORDER.indexOf(b);
}

function scoreToSeverity(score: number): ModerationSeverity {
  if (score >= 0.7) return "high";
  if (score >= 0.35) return "medium";
  return "low";
}

/** Escapes a word for safe use inside a RegExp. */
function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function findBlockedWords(
  body: string,
  customBlockedWords: string[] = [],
): BlockedWordMatch[] {
  if (!body) return [];
  const lower = body.toLowerCase();
  const matches: BlockedWordMatch[] = [];

  for (const { word, category } of getAllBlockedWordEntries(customBlockedWords)) {
    if (!word) continue;
    const isPhrase = word.includes(" ");
    const pattern = isPhrase
      ? new RegExp(escapeRegExp(word), "i")
      : new RegExp(`\\b${escapeRegExp(word)}\\b`, "i");
    const match = pattern.exec(lower);
    if (match) matches.push({ word, category, index: match.index });
  }
  return matches;
}

/**
 * Looks for bullying-pattern signals across a short window of recent
 * messages, e.g. repeated hostile messages aimed at the same person, or
 * a burst of short aggressive messages ("pile-on" behavior).
 */
export function detectBullyingPatterns(
  currentBody: string,
  recentFromSameSender: RecentMessageForAnalysis[],
  windowMs: number,
): BullyingPatternSignal[] {
  const signals: BullyingPatternSignal[] = [];
  const now = Date.now();
  const withinWindow = recentFromSameSender.filter((m) => now - m.createdAtMs <= windowMs);

  // Signal 1: repeated messages at the same target in a short window.
  const target = withinWindow[0]?.targetUserId;
  if (target) {
    const sameTargetCount = withinWindow.filter((m) => m.targetUserId === target).length;
    if (sameTargetCount >= 3) {
      signals.push({
        id: "repeated_targeting",
        description: `${sameTargetCount} messages sent to the same person in a short window`,
        weight: Math.min(0.6, 0.15 * sameTargetCount),
      });
    }
  }

  // Signal 2: burst of short messages (common in pile-on / spam harassment).
  const shortBurst = withinWindow.filter((m) => m.body.trim().length > 0 && m.body.trim().length <= 12);
  if (shortBurst.length >= 4) {
    signals.push({
      id: "short_message_burst",
      description: `${shortBurst.length} short messages sent in quick succession`,
      weight: 0.25,
    });
  }

  // Signal 3: ALL CAPS shouting combined with a blocked word in current message.
  const letters = currentBody.replace(/[^a-zA-Z]/g, "");
  const isShouting = letters.length >= 6 && letters === letters.toUpperCase();
  if (isShouting) {
    signals.push({
      id: "shouting",
      description: "Message is written in all caps",
      weight: 0.15,
    });
  }

  // Signal 4: repeated exclamation/question marks (aggressive tone marker).
  if (/[!?]{3,}/.test(currentBody)) {
    signals.push({
      id: "aggressive_punctuation",
      description: "Excessive exclamation/question marks",
      weight: 0.1,
    });
  }

  return signals;
}

export function evaluateMessage(
  body: string,
  recentFromSameSender: RecentMessageForAnalysis[],
  config: ModerationConfig,
): ModerationResult {
  const wordMatches = findBlockedWords(body, config.customBlockedWords);
  const patternSignals = detectBullyingPatterns(body, recentFromSameSender, config.patternWindowMs);

  const wordScore = wordMatches.reduce((acc, m) => {
    const perCategory: Record<string, number> = {
      threat: 0.9,
      hate: 0.9,
      "self-harm": 0.85,
      harassment: 0.5,
      profanity: 0.25,
      custom: 0.4,
    };
    return Math.max(acc, perCategory[m.category] ?? 0.3);
  }, 0);

  const patternScore = patternSignals.reduce((acc, s) => acc + s.weight, 0);
  const score = Math.min(1, wordScore + patternScore);
  const severity = scoreToSeverity(score);

  return {
    allowed: !severityAtLeast(severity, config.blockThreshold),
    severity,
    score,
    wordMatches,
    patternSignals,
    shouldLog: wordMatches.length > 0 || patternSignals.length > 0,
  };
}

export const DEFAULT_MODERATION_CONFIG: ModerationConfig = {
  customBlockedWords: [],
  blockThreshold: "high",
  patternWindowMs: 2 * 60 * 1000, // 2 minutes
};
