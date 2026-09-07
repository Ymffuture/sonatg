// Small centered notices inside a chat: "Alex joined the group", "Sam left the group".
// Stored as ordinary messages with kind = "system"; body is the plain-text notice.
import { supabase } from "@/integrations/supabase/client";

export async function postSystemMessage(chatId: string, body: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  // Best-effort: a missing notice should never block the join/leave itself.
  const { error } = await supabase.from("messages").insert({
    chat_id: chatId,
    sender_id: auth.user.id,
    kind: "system",
    body,
  });
  if (error) console.warn("Couldn't post system notice", error);
}
