// src/features/moderation/aiModeration.functions.ts
// Server-side AI classifier that supplements the local word-list +
// pattern-signal engine (detectionEngine.ts) with nuance the word list
// can't catch: sarcasm, coded/leetspeak insults, exclusionary language
// ("nobody invited you"), coordinated pile-ons phrased politely, etc.
//
// This is a NEW server function file — it reuses the same gateway/auth
// pattern as src/lib/ai.functions.ts but is not added to that file, per
// the "new files, not edits" constraint.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ModerationCategory, ModerationSeverity } from "./types";

const GATEWAY = "https://openrouter.ai/api/v1/chat/completions";

export interface AIModerationInput {
  chatId: string;
  body: string;
  /** Last few messages for context, oldest first — improves accuracy for coded/ escalating bullying */
  recentContext?: string[];
}

export interface AIModerationVerdict {
  flagged: boolean;
  severity: ModerationSeverity;
  categories: ModerationCategory[];
  reason: string;
  confidence: number; // 0-1
}

const SYSTEM_PROMPT = `You are a content-safety classifier for a school-safe chat app.
Given a message (and optional recent context from the same conversation), decide whether
it shows signs of bullying, harassment, threats, hate speech, or self-harm risk — including
subtle forms: sarcasm, exclusion ("nobody wants you here"), coded insults, leetspeak, or a
polite-sounding message that is part of a pile-on pattern.

Respond with ONLY a JSON object, no prose, no markdown fences, matching exactly:
{"flagged": boolean, "severity": "low"|"medium"|"high", "categories": string[], "reason": string, "confidence": number}

Valid categories: "profanity","harassment","threat","hate","self-harm","custom".
"reason" must be one short sentence (<20 words) a moderator can read at a glance.
If the message is benign, return {"flagged": false, "severity": "low", "categories": [], "reason": "", "confidence": <=0.2}.`;

function safeParseVerdict(raw: string): AIModerationVerdict {
  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      flagged: Boolean(parsed.flagged),
      severity: (["low", "medium", "high"].includes(parsed.severity) ? parsed.severity : "low") as ModerationSeverity,
      categories: Array.isArray(parsed.categories) ? parsed.categories : [],
      reason: typeof parsed.reason === "string" ? parsed.reason.slice(0, 200) : "",
      confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0,
    };
  } catch {
    // Fail closed to "not flagged" rather than blocking messages on a parse error —
    // the local word-list/pattern engine is still running as a safety net regardless.
    return { flagged: false, severity: "low", categories: [], reason: "", confidence: 0 };
  }
}

/**
 * Classifies a single message via the AI gateway. Intended to run
 * alongside (not instead of) the local rule-based engine — call both and
 * merge with `mergeVerdicts` in detectionEngine usage.
 */
export const classifyMessageForModeration = createServerFn({ method: "POST" })
  .inputValidator((input: AIModerationInput) => input)
  .handler(async ({ data, context }): Promise<AIModerationVerdict> => {
    await requireSupabaseAuth(context);

    const key = process.env.OPENROUTER_API_KEY;
    if (!key) {
      // No key configured — degrade gracefully, local engine still applies.
      return { flagged: false, severity: "low", categories: [], reason: "", confidence: 0 };
    }
    if (!data.body || !data.body.trim()) {
      return { flagged: false, severity: "low", categories: [], reason: "", confidence: 0 };
    }

    const contextBlock = data.recentContext?.length
      ? `Recent context (oldest first):\n${data.recentContext.slice(-5).join("\n")}\n\n`
      : "";

    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": process.env.APP_URL || "https://your-app.vercel.app",
        "X-Title": "Sona Moderation",
      },
      body: JSON.stringify({
        model: process.env.MODERATION_AI_MODEL || "inclusionai/ling-3.0-flash:free",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `${contextBlock}Message to classify:\n"""${data.body}"""` },
        ],
        temperature: 0,
      }),
    });

    if (!res.ok) {
      // Fail open on transport errors — don't block sending because the AI call failed;
      // the local engine (detectionEngine.ts) still runs synchronously client-side.
      return { flagged: false, severity: "low", categories: [], reason: "", confidence: 0 };
    }

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = json.choices?.[0]?.message?.content?.trim() || "{}";
    return safeParseVerdict(raw);
  });
