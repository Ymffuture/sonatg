// src/features/ads/MyAdsModal.tsx
// "My ads": the owner's chat-list ads with time left, views/clicks and a Delete button.

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X, Trash2, Loader2, Megaphone } from "lucide-react";
import { deleteMyAd, fetchMyAds, timeLeftLabel, type MyAd } from "./myAds";

export function MyAdsModal({ meId, onClose }: { meId: string; onClose: () => void }) {
  const [ads, setAds] = useState<MyAd[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setAds(await fetchMyAds(meId));
    } catch (e) {
      setError((e as { message?: string })?.message ?? "Couldn't load your ads.");
      setAds([]);
    }
  }, [meId]);

  useEffect(() => { void load(); }, [load]);

  const remove = async (ad: MyAd) => {
    setBusyId(ad.id);
    try {
      await deleteMyAd(ad, meId);
      setAds((prev) => (prev ?? []).filter((a) => a.id !== ad.id));
      setConfirmId(null);
    } catch (e) {
      setError((e as { message?: string })?.message ?? "Couldn't delete this ad.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4 backdrop-blur-md" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-3xl bg-white text-zinc-900 shadow-2xl ring-1 ring-amber-500/30 dark:bg-[#1a1a1a] dark:text-zinc-50"
      >
        <div className="flex items-center justify-between border-b border-black/5 px-5 py-4 dark:border-white/10">
          <h3 className="flex items-center gap-2 text-base font-extrabold">
            <Megaphone className="h-5 w-5 text-amber-500" /> My ads
          </h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full text-zinc-500 transition hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[65vh] space-y-3 overflow-y-auto p-4">
          {ads === null && (
            <div className="flex justify-center py-10 text-zinc-500"><Loader2 className="h-6 w-6 animate-spin" /></div>
          )}

          {ads?.length === 0 && !error && (
            <p className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
              You haven't posted any chat-list ads yet.
            </p>
          )}

          {error && (
            <p className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          )}

          {ads?.map((ad) => {
            const left = timeLeftLabel(ad);
            const live = left.endsWith("left");
            return (
              <div key={ad.id} className="flex gap-3 rounded-2xl border border-zinc-200 p-2.5 dark:border-zinc-800">
                <img src={ad.media_url} alt="" className="h-16 w-16 shrink-0 rounded-xl bg-zinc-100 object-cover dark:bg-zinc-800" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">{ad.title}</p>
                  <p className="mt-0.5 flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${live ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"}`}>
                      {left}
                    </span>
                    <span>{ad.impressions} views · {ad.clicks} clicks</span>
                  </p>

                  {confirmId === ad.id ? (
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={() => void remove(ad)}
                        disabled={busyId === ad.id}
                        className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-60"
                      >
                        {busyId === ad.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        Yes, delete
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/10"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmId(ad.id)}
                      className="mt-2 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
