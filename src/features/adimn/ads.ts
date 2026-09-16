// src/features/admin/ads.ts
// Thin client wrapper for the admin "Ads" tab. Reads rely on the
// "admins can read ad messages" RLS policy (kind = 'ad' only — this
// intentionally can't see any other message content); the delete goes
// through the admin_delete_ad_message RPC rather than a raw update, so the
// admin-role check lives in the database, not just in the UI.
// See supabase/migrations/20260915120000_admin_ad_moderation.sql.

import { supabase } from "@/integrations/supabase/client";

export type AdMessageRow = {
  id: string;
  chat_id: string;
  sender_id: string;
  media_url: string | null;
  ad_title: string | null;
  ad_cta_label: string | null;
  ad_cta_url: string | null;
  created_at: string;
  deleted_at: string | null;
};

export async function fetchAdMessages(): Promise<AdMessageRow[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, chat_id, sender_id, media_url, ad_title, ad_cta_label, ad_cta_url, created_at, deleted_at")
    .eq("kind", "ad")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as AdMessageRow[];
}

export async function adminDeleteAdMessage(id: string): Promise<void> {
  const { error } = await supabase.rpc("admin_delete_ad_message", { _id: id });
  if (error) throw error;
}
