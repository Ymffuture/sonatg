// src/lib/planLimits.ts
//
// Free-tier ("not Purple") usage caps. Mirrors the DB triggers in
// supabase/migrations/20260908120000_free_tier_usage_limits.sql — the
// SQL is the source of truth (it can't be bypassed), this file is just
// so the UI can pre-emptively disable buttons and show a friendly
// upsell instead of waiting for a Postgres error to come back.
import { supabase } from "@/integrations/supabase/client";

export const FREE_CHAT_LIMIT = 10;
export const FREE_DAILY_MESSAGE_LIMIT = 3;
/** Free accounts can keep at most this many chats pinned to the top. */
export const FREE_PIN_LIMIT = 2;

/** Postgres error code raised by both `enforce_free_*_limit` triggers. */
const FREE_TIER_SQLSTATE = "P0001";

export function isFreeTierLimitError(error: unknown): boolean {
  const err = error as { code?: string; message?: string } | null;
  if (!err) return false;
  return err.code === FREE_TIER_SQLSTATE || !!err.message?.includes("FREE_TIER_");
}

/** Start of "today" in UTC, as an ISO string — matches the trigger's `date_trunc('day', now() at time zone 'utc')`. */
export function startOfUtcTodayISO(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

/** How many messages this user has sent since UTC midnight. */
export async function countMessagesSentToday(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("sender_id", userId)
    .gte("created_at", startOfUtcTodayISO());
  if (error) { console.error("countMessagesSentToday failed", error); return 0; }
  return count ?? 0;
}

/** How many chats (direct + group) this user currently belongs to. */
export async function countMyChats(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("chat_members")
    .select("chat_id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) { console.error("countMyChats failed", error); return 0; }
  return count ?? 0;
}

export type PlanUsage = {
  isPro: boolean;
  chatsUsed: number;
  chatLimit: number;
  canCreateChat: boolean;
  messagesToday: number;
  messageLimit: number;
  canSendMessage: boolean;
};

/**
 * Combined snapshot used to gate the "New chat" button and the composer.
 * `chatsUsed` is passed in (the caller already has the chat list loaded
 * client-side) so this doesn't need its own round trip for that half.
 */
export function getPlanUsage(opts: { isPro: boolean; chatsUsed: number; messagesToday: number }): PlanUsage {
  const { isPro, chatsUsed, messagesToday } = opts;
  return {
    isPro,
    chatsUsed,
    chatLimit: FREE_CHAT_LIMIT,
    canCreateChat: isPro || chatsUsed < FREE_CHAT_LIMIT,
    messagesToday,
    messageLimit: FREE_DAILY_MESSAGE_LIMIT,
    canSendMessage: isPro || messagesToday < FREE_DAILY_MESSAGE_LIMIT,
  };
}

export const FREE_CHAT_LIMIT_MESSAGE =
  `You've reached the Sona Purple free-plan limit of ${FREE_CHAT_LIMIT} chats. Upgrade to Sona Purple for unlimited chats.`;

export const FREE_MESSAGE_LIMIT_MESSAGE =
  `You've hit today's free-plan limit of ${FREE_DAILY_MESSAGE_LIMIT} messages. Upgrade to Sona Purple to keep messaging, or come back tomorrow.`;
