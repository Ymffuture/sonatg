// src/features/invites/index.ts
// Thin wrappers around public.chat_invites + the generate_chat_invite_token /
// preview_chat_invite / join_chat_by_invite SQL functions.

import { supabase } from "@/integrations/supabase/client";

export type ChatInviteRow = {
  id: string;
  chat_id: string;
  token: string;
  allowed_email: string | null;
  created_by: string;
  expires_at: string | null;
  max_uses: number;
  uses: number;
  is_active: boolean;
  created_at: string;
};

export type InvitePreview = {
  chat_id: string;
  title: string | null;
  avatar_url: string | null;
  is_group: boolean;
  allowed_email: string | null;
  is_valid: boolean;
  reason: string | null;
  already_member: boolean;
};

export function inviteUrl(token: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/invite/${token}`;
}

export async function listChatInvites(chatId: string): Promise<ChatInviteRow[]> {
  const { data, error } = await supabase
    .from("chat_invites")
    .select("*")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ChatInviteRow[];
}

export async function createChatInvite(opts: {
  chatId: string;
  allowedEmail?: string | null;
  expiresInDays?: number | null;
  maxUses?: number;
}): Promise<ChatInviteRow> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not signed in");

  const { data: tokenData, error: tokenErr } = await supabase.rpc("generate_chat_invite_token");
  if (tokenErr) throw tokenErr;

  const expires_at = opts.expiresInDays
    ? new Date(Date.now() + opts.expiresInDays * 86_400_000).toISOString()
    : null;

  const { data, error } = await supabase
    .from("chat_invites")
    .insert({
      chat_id: opts.chatId,
      token: tokenData as string,
      allowed_email: opts.allowedEmail?.trim().toLowerCase() || null,
      created_by: auth.user.id,
      expires_at,
      max_uses: opts.maxUses ?? 100,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ChatInviteRow;
}

export async function revokeChatInvite(inviteId: string): Promise<void> {
  const { error } = await supabase.from("chat_invites").update({ is_active: false }).eq("id", inviteId);
  if (error) throw error;
}

export async function previewChatInvite(token: string): Promise<InvitePreview | null> {
  const { data, error } = await supabase.rpc("preview_chat_invite", { _token: token });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as InvitePreview) ?? null;
}

export async function joinChatByInvite(token: string): Promise<string> {
  const { data, error } = await supabase.rpc("join_chat_by_invite", { _token: token });
  if (error) throw error;
  return data as string; // chat_id
}
