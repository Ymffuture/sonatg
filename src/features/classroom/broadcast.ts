// src/features/classroom/broadcast.ts
// Broadcast-only channel helpers: mark a chat as broadcast, manage
// posters, and check posting rights client-side (the real enforcement is
// server-side via can_post_in_chat() in the migration — this mirrors it
// so the UI can disable the composer instead of round-tripping an error).

import { supabase } from "@/integrations/supabase/client";

export async function setChatBroadcastMode(chatId: string, isBroadcast: boolean): Promise<void> {
  const { error } = await supabase.from("chats").update({ is_broadcast: isBroadcast }).eq("id", chatId);
  if (error) throw error;
}

export async function addBroadcastPoster(chatId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("broadcast_posters").insert({ chat_id: chatId, user_id: userId });
  if (error) throw error;
}

export async function removeBroadcastPoster(chatId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("broadcast_posters").delete().eq("chat_id", chatId).eq("user_id", userId);
  if (error) throw error;
}

export async function listBroadcastPosters(chatId: string): Promise<string[]> {
  const { data, error } = await supabase.from("broadcast_posters").select("user_id").eq("chat_id", chatId);
  if (error) throw error;
  return (data ?? []).map((r) => r.user_id as string);
}

/**
 * Client-side mirror of the server-side can_post_in_chat() check, for
 * disabling the composer instantly instead of waiting on a failed insert.
 * The database policy is still the actual enforcement boundary.
 */
export async function canPostInChat(chatId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("can_post_in_chat", { _chat_id: chatId, _user_id: userId });
  if (error) throw error;
  return Boolean(data);
}
