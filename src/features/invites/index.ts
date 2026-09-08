// src/features/invites/index.ts
// Thin wrappers around public.chat_invites + the generate_chat_invite_token /
// preview_chat_invite / join_chat_by_invite SQL functions.

import { supabase } from "@/integrations/supabase/client";

export type ChatInviteRow = {
  id: string;
  chat_id: string;
  token: string;
  allowed_emails: string[] | null;
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
  allowed_emails: string[] | null;
  is_valid: boolean;
  reason: string | null;
  already_member: boolean;
};

export function inviteUrl(token: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/invite/${token}`;
}

// The table stores a single optional restricted address (`allowed_email`);
// the app surface works with a list, so we map between the two here.
type RawInvite = Omit<ChatInviteRow, "allowed_emails"> & { allowed_email: string | null };

const toInvite = (row: RawInvite): ChatInviteRow => {
  const { allowed_email, ...rest } = row;
  return { ...rest, allowed_emails: allowed_email ? [allowed_email] : null };
};

export async function listChatInvites(chatId: string): Promise<ChatInviteRow[]> {
  const { data, error } = await supabase
    .from("chat_invites")
    .select("*")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as RawInvite[]).map(toInvite);
}

// Normalizes free-form input (comma/newline/space separated, mixed case,
// stray whitespace, duplicates) into a clean, validated array of lowercase
// emails. Throws with a message naming the exact bad entry so the UI can
// surface something more useful than a generic "invalid input".
export function parseAllowedEmails(raw: string): string[] {
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const piece of raw.split(/[,\n;]+/)) {
    const email = piece.trim().toLowerCase();
    if (!email) continue;
    if (!EMAIL_RE.test(email)) throw new Error(`"${piece.trim()}" doesn't look like a valid email address.`);
    if (!seen.has(email)) { seen.add(email); out.push(email); }
  }
  return out;
}

export async function createChatInvite(opts: {
  chatId: string;
  allowedEmails?: string[] | null;
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

  const emails = opts.allowedEmails?.length ? opts.allowedEmails : null;

  const { data, error } = await supabase
    .from("chat_invites")
    .insert({
      chat_id: opts.chatId,
      token: tokenData as string,
      allowed_email: emails?.[0] ?? null,
      created_by: auth.user.id,
      expires_at,
      max_uses: opts.maxUses ?? 100,
    })
    .select("*")
    .single();
  if (error) throw error;
  return toInvite(data as RawInvite);
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
