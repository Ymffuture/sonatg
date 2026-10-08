// src/features/ads/myAds.ts
// An owner's own chat-list ads: list them, delete them, and describe time left.

import { supabase } from "@/integrations/supabase/client";

export type MyAd = {
  id: string;
  media_url: string;
  title: string;
  cta_label: string;
  cta_url: string;
  status: "active" | "paused" | "removed";
  starts_at: string;
  ends_at: string | null;
  impressions: number;
  clicks: number;
  created_at: string;
};

export const DURATION_OPTIONS = [3, 7, 30] as const;
export type AdDurationDays = (typeof DURATION_OPTIONS)[number];

// Generated types don't include `ads` until you regenerate them.
const adsTable = () => (supabase as unknown as { from: (t: string) => any }).from("ads");

export function endsAtFromNow(days: AdDurationDays): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export async function fetchMyAds(ownerId: string): Promise<MyAd[]> {
  const { data, error } = await adsTable()
    .select("id, media_url, title, cta_label, cta_url, status, starts_at, ends_at, impressions, clicks, created_at")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as MyAd[];
}

// Signed URLs look like .../object/sign/chat-media/<path>?token=... — recover <path>.
function storagePathOf(signedUrl: string): string | null {
  try {
    const m = new URL(signedUrl).pathname.match(/\/chat-media\/(.+)$/);
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

/** Deletes the ad row (RLS only lets the owner do this) and, best effort, its image. */
export async function deleteMyAd(ad: Pick<MyAd, "id" | "media_url">, ownerId: string): Promise<void> {
  const { error } = await adsTable().delete().eq("id", ad.id).eq("owner_id", ownerId);
  if (error) throw error;
  const path = storagePathOf(ad.media_url);
  if (path && path.startsWith(`${ownerId}/`)) {
    await supabase.storage.from("chat-media").remove([path]).catch(() => {});
  }
}

export function timeLeftLabel(ad: Pick<MyAd, "status" | "ends_at">, now = Date.now()): string {
  if (ad.status !== "active") return ad.status === "paused" ? "Paused" : "Removed";
  if (!ad.ends_at) return "No end date";
  const ms = new Date(ad.ends_at).getTime() - now;
  if (ms <= 0) return "Expired";
  const mins = Math.floor(ms / 60000);
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${mins % 60}m left`;
  return `${Math.max(mins, 1)}m left`;
}
