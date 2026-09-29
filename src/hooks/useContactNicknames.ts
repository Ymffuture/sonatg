import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Loads the caller's private contact nicknames as a `{ contactId: nickname }`
 * map, and exposes setters to add/change/clear one. This is purely a
 * per-owner display override (see the contact_nicknames migration and its
 * RLS policies) — it never writes to `profiles`, so it can't change anyone's
 * real registered display name, and no one else can ever read it back.
 */
export function useContactNicknames(ownerId: string | undefined) {
  const [nicknames, setNicknames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ownerId) { setNicknames({}); setLoading(false); return; }
    let alive = true;
    setLoading(true);
    supabase
      .from("contact_nicknames")
      .select("contact_id, nickname")
      .eq("owner_id", ownerId)
      .then(({ data }) => {
        if (!alive) return;
        const map: Record<string, string> = {};
        (data ?? []).forEach((row) => { map[row.contact_id as string] = row.nickname as string; });
        setNicknames(map);
        setLoading(false);
      });
    return () => { alive = false; };
  }, [ownerId]);

  const setNickname = useCallback(
    async (contactId: string, nickname: string) => {
      const trimmed = nickname.trim();
      if (!ownerId || !trimmed) return;
      // Optimistic — the rest of the app (chat list, headers, message
      // sender labels) reads straight off this state, so the rename should
      // feel instant rather than waiting on a round trip.
      setNicknames((prev) => ({ ...prev, [contactId]: trimmed }));
      const { error } = await supabase
        .from("contact_nicknames")
        .upsert({ owner_id: ownerId, contact_id: contactId, nickname: trimmed, updated_at: new Date().toISOString() }, { onConflict: "owner_id,contact_id" });
      if (error) throw error;
    },
    [ownerId],
  );

  const clearNickname = useCallback(
    async (contactId: string) => {
      if (!ownerId) return;
      setNicknames((prev) => {
        const next = { ...prev };
        delete next[contactId];
        return next;
      });
      const { error } = await supabase
        .from("contact_nicknames")
        .delete()
        .eq("owner_id", ownerId)
        .eq("contact_id", contactId);
      if (error) throw error;
    },
    [ownerId],
  );

  return { nicknames, loading, setNickname, clearNickname };
}
