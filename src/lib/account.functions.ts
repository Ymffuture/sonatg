import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Full account deletion needs a SERVICE-ROLE client, not the anon/publishable
// key `requireSupabaseAuth` gives us — RLS would block deleting rows other
// users can see (e.g. this user's chat_members rows in a shared chat), and
// only the service role can call auth.admin.deleteUser at all.
//
// Required env var (server-side only, set in Vercel -> Project Settings ->
// Environment Variables — NOT prefixed with VITE_, this must never reach
// the browser):
//   SUPABASE_SECRET_KEY   — the "secret" key (sb_secret_...) from
//                            Supabase's dashboard -> Settings -> API, i.e.
//                            what used to be called the service_role key.
//
// This is intentionally destructive and irreversible: it deletes the
// user's messages, reactions, read receipts, statuses, blocks, chat
// memberships, profile row, avatar/status storage files, and finally the
// auth user itself.

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId as string;
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SECRET_KEY) {
      throw new Error(
        "Account deletion isn't configured on the server. Missing SUPABASE_SECRET_KEY — add it in Vercel's Environment Variables (Supabase dashboard -> Settings -> API -> secret key), then redeploy."
      );
    }

    const admin = createClient(SUPABASE_URL, SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Order matters where cascades don't already cover it. messages ->
    // reactions is already `on delete cascade` in the schema, so deleting
    // this user's own messages also removes reactions *on* those messages;
    // it does NOT remove reactions or read receipts this user left on
    // other people's messages, so those need their own explicit deletes.
    const steps: Array<() => Promise<{ error: { message: string } | null }>> = [
      () => admin.from("reactions").delete().eq("user_id", userId),
      () => admin.from("message_reads").delete().eq("user_id", userId),
      () => admin.from("messages").delete().eq("sender_id", userId),
      () => admin.from("blocks").delete().eq("blocker_id", userId),
      () => admin.from("blocks").delete().eq("blocked_id", userId),
      () => admin.from("status_views").delete().eq("viewer_id", userId),
      () => admin.from("statuses").delete().eq("user_id", userId),
      () => admin.from("chat_members").delete().eq("user_id", userId),
    ];

    for (const step of steps) {
      const { error } = await step();
      if (error) throw new Error(`Account deletion failed: ${error.message}`);
    }

    // Chats this user created that are now empty (everyone left/was
    // removed) can be cleaned up too. Chats they created where other
    // members remain are left intact for those members, same as WhatsApp
    // leaving old message history behind for a deleted account.
    const { data: ownedChats } = await admin.from("chats").select("id").eq("created_by", userId);
    if (ownedChats?.length) {
      for (const chat of ownedChats) {
        const { count } = await admin
          .from("chat_members")
          .select("*", { count: "exact", head: true })
          .eq("chat_id", chat.id);
        if (!count) await admin.from("chats").delete().eq("id", chat.id);
      }
    }

    // Best-effort storage cleanup — don't fail the whole deletion over it.
    try {
      const { data: avatarFiles } = await admin.storage.from("avatars").list(userId);
      if (avatarFiles?.length) {
        await admin.storage.from("avatars").remove(avatarFiles.map((f) => `${userId}/${f.name}`));
      }
    } catch { /* non-fatal */ }
    try {
      const { data: statusFiles } = await admin.storage.from("statuses").list(userId);
      if (statusFiles?.length) {
        await admin.storage.from("statuses").remove(statusFiles.map((f) => `${userId}/${f.name}`));
      }
    } catch { /* non-fatal */ }

    const { error: profileErr } = await admin.from("profiles").delete().eq("id", userId);
    if (profileErr) throw new Error(`Account deletion failed: ${profileErr.message}`);

    const { error: authErr } = await admin.auth.admin.deleteUser(userId);
    if (authErr) throw new Error(`Account deletion failed: ${authErr.message}`);

    return { success: true };
  });
