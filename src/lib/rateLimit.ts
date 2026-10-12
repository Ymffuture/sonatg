// src/lib/rateLimit.ts
// Per-user rate limit backed by the check_rate_limit() Postgres function.
// Call it at the top of a server function handler:
//   await enforceRateLimit(context.supabase, "ai", 20, 60);   // 20 calls / 60 s per user
// Fails CLOSED on an explicit "over the limit", but OPEN if the limiter itself errors
// (e.g. migration not applied yet) so a limiter problem never takes the app down.

type RpcClient = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message?: string } | null }> };

export async function enforceRateLimit(
  supabase: unknown,
  action: string,
  max: number,
  windowSeconds: number,
  message = "You're going a bit fast — please wait a moment and try again.",
): Promise<void> {
  const { data, error } = await (supabase as RpcClient).rpc("check_rate_limit", {
    _action: action,
    _max: max,
    _window_seconds: windowSeconds,
  });
  if (error) {
    console.error(`[rate-limit] ${action} check failed:`, error.message);
    return;
  }
  if (data === false) throw new Error(message);
}
