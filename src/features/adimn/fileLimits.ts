// src/features/admin/fileLimits.ts
// Reads org_settings for the current document/image size caps so an
// admin can raise/lower them (e.g. a school wants a bigger cap for slide
// decks) without a redeploy. Falls back to the app's existing hardcoded
// defaults (MAX_DOC_BYTES/MAX_IMAGE_BYTES in SonaChat's shared utils) if
// the settings row can't be read, so this is a pure enhancement — nothing
// breaks if it's never wired in.

import { supabase } from "@/integrations/supabase/client";

export interface OrgFileLimits {
  maxDocBytes: number;
  maxImageBytes: number;
}

const FALLBACK: OrgFileLimits = {
  maxDocBytes: 15 * 1024 * 1024, // 15MB
  maxImageBytes: 2 * 1024 * 1024, // 2MB, matches existing client default
};

export async function getOrgFileLimits(): Promise<OrgFileLimits> {
  const { data, error } = await supabase
    .from("org_settings")
    .select("max_doc_bytes,max_image_bytes")
    .eq("id", "default")
    .maybeSingle();
  if (error || !data) return FALLBACK;
  return {
    maxDocBytes: Number(data.max_doc_bytes) || FALLBACK.maxDocBytes,
    maxImageBytes: Number(data.max_image_bytes) || FALLBACK.maxImageBytes,
  };
}

export async function updateOrgFileLimits(limits: Partial<OrgFileLimits>): Promise<void> {
  const patch: { max_doc_bytes?: number; max_image_bytes?: number; updated_at: string } = { updated_at: new Date().toISOString() };
  if (limits.maxDocBytes != null) patch.max_doc_bytes = limits.maxDocBytes;
  if (limits.maxImageBytes != null) patch.max_image_bytes = limits.maxImageBytes;
  const { error } = await supabase.from("org_settings").update(patch).eq("id", "default");
  if (error) throw error;
}
