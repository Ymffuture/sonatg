// src/lib/aiActions.functions.ts
//
// Server functions behind the Sona AI confirm card.
//   getSonaAction    – read one of MY pending/finished actions (RLS: owner only)
//   runSonaAction    – the user tapped Confirm: claim it atomically, run it AS
//                      THE USER (their RLS-scoped client, so chat-membership
//                      rules still apply), mark it done
//   dismissSonaAction – the user tapped "Not now"
//
// public.ai_actions has no insert/update policies, so status changes go
// through the service-role client here; the actual poll/message writes use
// context.supabase so the database enforces the same permissions as if the
// user had done it by hand.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ACTION_LIMITS,
  validateAction,
  type ActionType,
  type CreatePollPayload,
  type ScheduleMessagePayload,
} from "@/lib/aiActions";

const ACTION_TTL_MS = 24 * 3600_000; // an unconfirmed proposal expires after a day

export type SonaActionView = {
  id: string;
  type: ActionType;
  payload: CreatePollPayload | ScheduleMessagePayload;
  status: "pending" | "running" | "done" | "dismissed";
  lastError: string | null;
  expired: boolean;
};

type Row = {
  id: string;
  user_id: string;
  chat_id: string;
  type: ActionType;
  payload: unknown;
  status: SonaActionView["status"];
  last_error: string | null;
  created_at: string;
};

// ai_actions isn't in the generated Supabase types yet; this is the one place
// that talks to it untyped. (Regenerate types after running the migration and
// these casts can go.)
/* eslint-disable @typescript-eslint/no-explicit-any */
const table = (client: unknown): any => (client as { from: (t: string) => any }).from("ai_actions");
/* eslint-enable @typescript-eslint/no-explicit-any */

function toView(r: Row): SonaActionView {
  return {
    id: r.id,
    type: r.type,
    payload: r.payload as SonaActionView["payload"],
    status: r.status,
    lastError: r.last_error,
    expired: r.status === "pending" && Date.now() - new Date(r.created_at).getTime() > ACTION_TTL_MS,
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validateId(data: { actionId?: unknown }): { actionId: string } {
  const id = String(data?.actionId ?? "");
  if (!UUID_RE.test(id)) throw new Error("Invalid action id");
  return { actionId: id.toLowerCase() };
}

export const getSonaAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateId)
  .handler(async ({ data, context }): Promise<SonaActionView | null> => {
    const { data: row } = await table(context.supabase)
      .select("id, user_id, chat_id, type, payload, status, last_error, created_at")
      .eq("id", data.actionId)
      .eq("user_id", context.userId)
      .maybeSingle();
    return row ? toView(row as Row) : null;
  });

export const dismissSonaAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateId)
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await table(supabaseAdmin)
      .update({ status: "dismissed", resolved_at: new Date().toISOString() })
      .eq("id", data.actionId)
      .eq("user_id", context.userId)
      .eq("status", "pending");
    return { ok: true };
  });

export const runSonaAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { actionId?: unknown; timeZone?: unknown }) => ({
    ...validateId(d),
    timeZone: d?.timeZone ? String(d.timeZone).slice(0, 64) : "UTC",
  }))
  .handler(async ({ data, context }): Promise<{ ok: true; summary: string }> => {
    const userId = context.userId as string;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Claim: pending -> running, atomically. A double-tap (or two tabs) can
    //    only win this once, so an action can never execute twice.
    const { data: claimed } = await table(supabaseAdmin)
      .update({ status: "running", last_error: null })
      .eq("id", data.actionId)
      .eq("user_id", userId)
      .eq("status", "pending")
      .gt("created_at", new Date(Date.now() - ACTION_TTL_MS).toISOString())
      .select("id, user_id, chat_id, type, payload, status, last_error, created_at")
      .maybeSingle();
    if (!claimed) {
      throw new Error("This suggestion has already been used or has expired — ask Sona again.");
    }
    const row = claimed as Row;

    const release = async (message: string) => {
      // Put it back so the user can retry after fixing whatever failed.
      await table(supabaseAdmin).update({ status: "pending", last_error: message.slice(0, 300) }).eq("id", row.id);
    };

    try {
      // 2. Re-validate the stored payload — never trust what was saved earlier.
      const action = validateAction(
        { type: row.type, ...(row.payload as Record<string, unknown>) },
        { allow: ["create_poll", "schedule_message"], timeZone: data.timeZone },
      );
      if (!action) throw new Error("That suggestion is no longer valid (for example, its time has passed). Ask Sona again.");

      let summary: string;
      if (action.type === "create_poll") {
        summary = await runCreatePoll(context.supabase, userId, row.chat_id, action.payload);
      } else {
        summary = await runScheduleMessage(context.supabase, userId, row.chat_id, action.payload);
      }

      // 3. Done.
      await table(supabaseAdmin)
        .update({ status: "done", resolved_at: new Date().toISOString(), last_error: null })
        .eq("id", row.id);
      return { ok: true, summary };
    } catch (e) {
      const msg = (e as { message?: string })?.message || "Something went wrong.";
      await release(msg);
      throw new Error(msg);
    }
  });

// ── executors (all run with the USER's client, so RLS decides what's allowed) ──

type UserClient = {
  from: (t: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
};

async function runCreatePoll(
  supabase: unknown,
  userId: string,
  chatId: string,
  p: CreatePollPayload,
): Promise<string> {
  const db = supabase as UserClient;
  const { data: poll, error: pollErr } = await db
    .from("polls")
    .insert({
      chat_id: chatId,
      created_by: userId,
      question: p.question,
      is_quiz: false,
      correct_option_index: null,
      allow_multiple: p.allowMultiple,
      closes_at: null,
      results_visible: true,
    })
    .select("id")
    .single();
  if (pollErr) throw new Error(`Couldn't create the poll: ${pollErr.message}`);

  const cleanup = async () => { await db.from("polls").delete().eq("id", poll.id); };

  const { error: optErr } = await db
    .from("poll_options")
    .insert(p.options.map((label, position) => ({ poll_id: poll.id, label, position })));
  if (optErr) { await cleanup(); throw new Error(`Couldn't add the poll options: ${optErr.message}`); }

  // Same shape the in-app poll composer posts: a "poll" message pointing at the poll.
  const { error: msgErr } = await db
    .from("messages")
    .insert({ chat_id: chatId, sender_id: userId, kind: "poll", body: JSON.stringify({ pollId: poll.id }) });
  if (msgErr) { await cleanup(); throw new Error(`Couldn't post the poll to the chat: ${msgErr.message}`); }

  return "Poll posted to the chat.";
}

async function runScheduleMessage(
  supabase: unknown,
  userId: string,
  chatId: string,
  p: ScheduleMessagePayload,
): Promise<string> {
  const when = new Date(p.sendAt);
  if (when.getTime() - Date.now() < ACTION_LIMITS.minLeadMs) {
    throw new Error("That time has already passed (or is too close). Ask Sona to pick a later time.");
  }
  const db = supabase as UserClient;
  const { error } = await db
    .from("messages")
    .insert({ chat_id: chatId, sender_id: userId, kind: "text", body: p.text, scheduled_at: when.toISOString() });
  if (error) throw new Error(`Couldn't schedule the message: ${error.message}`);
  return "Message scheduled.";
}
