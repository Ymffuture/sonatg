// src/lib/notifications.functions.ts
// Two server functions, both fire-and-forget from the client's point of
// view (the caller doesn't need to wait on email delivery):
//   - notifyOfflineMessage: called right after a message insert succeeds.
//     Figures out which chat members are offline and opted in, then
//     emails them via EmailJS.
//   - notifyAppUpdateSubscribers: called by an admin after posting an
//     announcement with "notify subscribers" checked.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendOfflineMessageEmail, sendAppUpdateEmail } from "@/lib/emailjs.functions";

const SONA_AI_ID = "00000000-0000-0000-0000-00000000a1a1";

interface NotifyOfflineMessageInput {
  chatId: string;
  senderName: string;
  messageBody: string;
}

export const notifyOfflineMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: NotifyOfflineMessageInput) => {
    if (!data?.chatId) throw new Error("chatId required");
    return {
      chatId: String(data.chatId),
      senderName: String(data.senderName ?? "Someone").slice(0, 100),
      messageBody: String(data.messageBody ?? "").slice(0, 500),
    };
  })
  .handler(async ({ data, context }) => {
    if (!data.messageBody.trim()) return { notified: 0 };

    // Confirm the caller is actually a member of this chat before we go
    // looking up other members' emails/offline status for it.
    const { data: memberRow } = await context.supabase
      .from("chat_members").select("chat_id")
      .eq("chat_id", data.chatId).eq("user_id", context.userId).maybeSingle();
    if (!memberRow) throw new Error("Forbidden: not a member of chat");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: members } = await supabaseAdmin
      .from("chat_members")
      .select("user_id")
      .eq("chat_id", data.chatId)
      .neq("user_id", context.userId);

    const recipientIds = (members ?? []).map((m) => m.user_id as string).filter((id) => id !== SONA_AI_ID);
    if (recipientIds.length === 0) return { notified: 0 };

    const [{ data: profiles, error: profilesErr }, { data: prefs, error: prefsErr }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id,email,display_name").in("id", recipientIds),
      supabaseAdmin.from("notification_preferences").select("user_id,notify_offline_messages").in("user_id", recipientIds),
    ]);
    if (profilesErr) throw new Error(`Failed to load profiles: ${profilesErr.message}`);
    if (prefsErr) throw new Error(`Failed to load notification preferences: ${prefsErr.message}`);

    const optedOut = new Set(
      (prefs ?? []).filter((p) => p.notify_offline_messages === false).map((p) => p.user_id as string),
    );

    let notified = 0;
    for (const recipientId of recipientIds) {
      if (optedOut.has(recipientId)) continue;
      const { data: offline } = await supabaseAdmin.rpc("is_user_offline", { _user_id: recipientId });
      if (!offline) continue;

      const profile = (profiles ?? []).find((p) => p.id === recipientId);
      if (!profile?.email) continue;

      try {
        await sendOfflineMessageEmail({
          toEmail: profile.email,
          toName: profile.display_name ?? "there",
          senderName: data.senderName,
          messagePreview: data.messageBody,
          chatUrl: `${process.env.APP_URL || "https://your-app.vercel.app"}/?chat=${data.chatId}`,
        });
        notified++;
      } catch (e) {
        console.error("[notifyOfflineMessage] send failed for", recipientId, e);
      }
    }
    return { notified };
  });

interface NotifyAppUpdateInput {
  announcementId: string;
}

export const notifyAppUpdateSubscribers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: NotifyAppUpdateInput) => {
    if (!data?.announcementId) throw new Error("announcementId required");
    return { announcementId: String(data.announcementId) };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Admin only");

    const { data: announcement, error: annErr } = await supabaseAdmin
      .from("app_announcements").select("*").eq("id", data.announcementId).single();
    if (annErr || !announcement) throw new Error("Announcement not found");

    const [{ data: allProfiles, error: profilesErr }, { data: prefs, error: prefsErr }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id,email,display_name").eq("is_ai", false),
      supabaseAdmin.from("notification_preferences").select("user_id,notify_app_updates"),
    ]);
    if (profilesErr) throw new Error(`Failed to load profiles: ${profilesErr.message}`);
    if (prefsErr) throw new Error(`Failed to load notification preferences: ${prefsErr.message}`);
    console.log(`[notifyAppUpdateSubscribers] candidates=${allProfiles?.length ?? 0}`);

    const optedOut = new Set(
      (prefs ?? []).filter((p) => p.notify_app_updates === false).map((p) => p.user_id as string),
    );

    let notified = 0;
    const failures: string[] = [];
    for (const profile of allProfiles ?? []) {
      if (optedOut.has(profile.id) || !profile.email) continue;
      try {
        await sendAppUpdateEmail({
          toEmail: profile.email,
          toName: profile.display_name ?? "there",
          announcementMessage: announcement.message,
        });
        notified++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[notifyAppUpdateSubscribers] send failed for", profile.id, msg);
        failures.push(msg);
      }
    }
    // Surface the first underlying error to the caller instead of only logging it,
    // so "0 notified" always comes with a reason instead of a silent dead end.
    if (notified === 0 && failures.length > 0) {
      throw new Error(`All ${failures.length} send(s) failed. First error: ${failures[0]}`);
    }
    return { notified, failed: failures.length };
  });
