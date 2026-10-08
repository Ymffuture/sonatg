// src/features/ads/useListAds.ts
// Loads the live ads for the chat list, plus the sponsor profile for each, and
// exposes helpers to count impressions/clicks and to decide where ads go.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/lib/db";

export type ListAd = {
  id: string;
  owner_id: string;
  media_url: string;
  title: string;
  cta_label: string;
  cta_url: string;
  sponsor?: Pick<Profile, "id" | "display_name" | "avatar_url" | "is_business">;
};

// The generated Supabase types don't know the new `ads` table until you
// regenerate them, so go through an untyped handle for just this feature.
const db = supabase as unknown as {
  from: (t: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: unknown }>;
};

const MAX_ADS = 20;

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function useListAds(enabled: boolean): ListAd[] {
  const [ads, setAds] = useState<ListAd[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await db
        .from("ads")
        .select("id, owner_id, media_url, title, cta_label, cta_url")
        .eq("status", "active")
        .lte("starts_at", nowIso)
        .or(`ends_at.is.null,ends_at.gt.${nowIso}`)
        .order("created_at", { ascending: false })
        .limit(MAX_ADS);
      if (error || !data?.length || cancelled) return;

      const rows = data as ListAd[];
      const ownerIds = [...new Set(rows.map((r) => r.owner_id))];
      const { data: owners } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, is_business")
        .in("id", ownerIds);
      const byId = new Map((owners ?? []).map((o) => [o.id, o]));
      if (cancelled) return;
      // Shuffle so one business doesn't own the top slot forever.
      setAds(shuffle(rows.map((r) => ({ ...r, sponsor: byId.get(r.owner_id) as ListAd["sponsor"] }))));
    })();
    return () => { cancelled = true; };
  }, [enabled]);

  return ads;
}

// Count each ad's impression once per page session, never block the UI on it.
const seen = new Set<string>();
export function recordAdEvent(adId: string, kind: "impression" | "click") {
  if (kind === "impression") {
    if (seen.has(adId)) return;
    seen.add(adId);
  }
  void db.rpc("record_ad_event", { _ad_id: adId, _kind: kind }).catch(() => {});
}

/**
 * Which ad slot (if any) follows the chat at `index`.
 *  - after the 2nd chat (the pink line in the design),
 *  - then after every 6th chat,
 *  - and always one at the very end of the list.
 * Returns the slot number (0, 1, 2…) used to rotate through the ads, or null.
 */
export function adSlotAfter(index: number, total: number): number | null {
  if (total === 0) return null;
  const isLast = index === total - 1;
  const inRhythm = index === 1 || (index > 1 && (index - 1) % 6 === 0);
  if (!inRhythm && !isLast) return null;
  // Slot number = how many rhythm slots came before this one.
  return index <= 1 ? 0 : Math.floor((index - 1) / 6) + 1;
}
