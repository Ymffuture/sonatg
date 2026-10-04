// src/lib/aiLimits.ts  (SERVER ONLY — imports the service-role client lazily)
//
// Per-user daily cap on Sona AI calls, so SerpApi / OpenRouter / Gemini costs
// stay predictable. Counted atomically in Postgres (public.consume_ai_quota),
// so concurrent requests and multiple serverless instances can't overshoot.
//
// Tune without a code change via env vars:
//   AI_DAILY_LIMIT_FREE   (default 25)
//   AI_DAILY_LIMIT_PRO    (default 300)

const DEFAULT_FREE = 25;
const DEFAULT_PRO = 300;

function envInt(name: string, fallback: number): number {
  const n = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function dailyAiLimit(isPro: boolean): number {
  return isPro ? envInt("AI_DAILY_LIMIT_PRO", DEFAULT_PRO) : envInt("AI_DAILY_LIMIT_FREE", DEFAULT_FREE);
}

export type QuotaResult = { allowed: boolean; used: number; limit: number };

/**
 * Atomically consumes one AI call for today (UTC). Fails OPEN if the database
 * function isn't reachable (e.g. the migration hasn't been applied yet), so a
 * missing migration never takes Sona AI down — it just logs.
 */
export async function consumeAiQuota(userId: string, isPro: boolean): Promise<QuotaResult> {
  const limit = dailyAiLimit(isPro);
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{
        data: Array<{ allowed: boolean; used: number }> | null;
        error: { message: string } | null;
      }>;
    }).rpc("consume_ai_quota", { _user: userId, _limit: limit });
    if (error) throw new Error(error.message);
    const row = data?.[0];
    if (!row) throw new Error("empty response");
    return { allowed: row.allowed, used: row.used, limit };
  } catch (e) {
    console.warn("[aiLimits] quota check failed, allowing request:", (e as Error).message);
    return { allowed: true, used: 0, limit };
  }
}

export function quotaExceededError(q: QuotaResult, isPro: boolean): Error {
  const tail = isPro
    ? "It resets at midnight UTC."
    : "It resets at midnight UTC — or upgrade to Sona Purple for a much higher limit.";
  return new Error(`You've used all ${q.limit} Sona AI replies for today. ${tail}`);
}
