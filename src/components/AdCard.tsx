// src/components/AdCard.tsx
//
// Sponsored card in an Instagram-style layout: sponsor header, big image,
// full-width call-to-action bar, then the headline. Plain Tailwind (no HeroUI)
// with explicit light/dark colours on every piece of text, so it stays readable
// in both themes. Works for in-chat ad messages (`msg`) and chat-list ads (`ad`).

import { useEffect, useState } from "react";
import { ChevronRight, X } from "lucide-react";
import { VscVerifiedFilled } from "react-icons/vsc";
import type { MessageRow } from "@/lib/db";
import { hostOf, isSafeHttpUrl } from "@/lib/sources";
import { AdFullscreen } from "@/components/AdFullscreen";

/** The fields the card needs, whether the ad came from a chat message or the `ads` table. */
export type AdCardData = {
  id: string;
  media_url: string | null;
  title: string | null;
  cta_label: string | null;
  cta_url: string | null;
};

type Sponsor = {
  display_name?: string | null;
  avatar_url?: string | null;
  is_business?: boolean;
};

// "Hide this ad" is local to this device: it never deletes the message for anyone else.
const HIDDEN_KEY = "sona:hidden-ads";
const MAX_REMEMBERED = 200;

function readHidden(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeHidden(ids: string[]) {
  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(ids.slice(-MAX_REMEMBERED)));
  } catch { /* private mode / storage full — hiding just won't persist */ }
}

type AdCardProps = {
  /** In-chat ad (a `kind = 'ad'` message). */
  msg?: MessageRow;
  /** Chat-list ad (a row from the `ads` table). */
  ad?: AdCardData;
  mine?: boolean;
  sender?: Sponsor;
  /** Called when the CTA link is opened (used to count clicks). */
  onCtaClick?: () => void;
};

export function AdCard({ msg: message, ad, mine = false, sender, onCtaClick }: AdCardProps) {
  // Normalise both sources into one shape so the markup below is written once.
  const data: AdCardData = message
    ? { id: message.id, media_url: message.media_url, title: message.ad_title, cta_label: message.ad_cta_label, cta_url: message.ad_cta_url }
    : { id: ad!.id, media_url: ad!.media_url, title: ad!.title, cta_label: ad!.cta_label, cta_url: ad!.cta_url };

  const [hidden, setHidden] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [open, setOpen] = useState(false); // full-screen view

  // Read after mount (not in the initializer) so server and client render the same first frame.
  useEffect(() => { setHidden(readHidden().includes(data.id)); }, [data.id]);

  const hide = () => {
    setHidden(true);
    writeHidden([...readHidden().filter((id) => id !== data.id), data.id]);
  };
  const unhide = () => {
    setHidden(false);
    writeHidden(readHidden().filter((id) => id !== data.id));
  };

  // The CTA link is user-supplied, so only ever render http(s) links (never javascript:/data:).
  const ctaUrl = data.cta_url && isSafeHttpUrl(data.cta_url) ? data.cta_url : null;
  const hasCta = !!ctaUrl && !!data.cta_label;
  const sponsor = sender?.display_name?.trim() || "Sponsored";
  const initial = sponsor.charAt(0).toUpperCase();
  const showImage = !!data.media_url && !imgFailed;

  if (hidden) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
        <span>Ad hidden</span>
        <button
          type="button"
          onClick={unhide}
          className="font-semibold text-zinc-900 underline underline-offset-2 dark:text-white"
        >
          Undo
        </button>
      </div>
    );
  }

  return (
    <aside
      aria-label="Advertisement"
      className="w-full max-w-[430px] overflow-hidden rounded-2xl border border-zinc-200 bg-white text-zinc-900 shadow-sm dark:border-zinc-800 dark:bg-[#1c1c1e] dark:text-zinc-50"
    >
      {/* Header: sponsor avatar, name + verified, "Sponsored", hide button */}
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-amber-400 via-orange-500 to-pink-500 p-[2px]">
          <div className="grid h-full w-full place-items-center overflow-hidden rounded-full bg-white text-sm font-bold text-zinc-900 dark:bg-[#1c1c1e] dark:text-zinc-50">
            {sender?.avatar_url ? (
              <img src={sender.avatar_url} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : (
              initial
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex min-w-0 items-center gap-1">
            <span className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">{sponsor}</span>
            {sender?.is_business && (
              <VscVerifiedFilled className="h-3.5 w-3.5 shrink-0 text-sky-500" aria-label="Verified business" />
            )}
          </div>
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Sponsored</span>
        </div>

        {!mine && (
          <button
            type="button"
            onClick={hide}
            aria-label="Hide this ad"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Media */}
      <button type="button" onClick={() => setOpen(true)} aria-label="Open ad full screen" className="block w-full text-left">
        {showImage ? (
          <img
            alt=""
            src={data.media_url!}
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="pointer-events-none aspect-[1.91/1] w-full select-none bg-zinc-100 object-cover dark:bg-zinc-800"
          />
        ) : (
          <div className="grid aspect-[1.91/1] w-full place-items-center bg-gradient-to-br from-amber-100 to-orange-200 px-6 text-center dark:from-amber-950 dark:to-orange-900">
            <span className="text-lg font-bold leading-snug text-zinc-900 dark:text-zinc-50">
              {data.title || "Sponsored message"}
            </span>
          </div>
        )}
      </button>

      {/* Call-to-action bar (a real link, full width like Instagram's) */}
      {hasCta && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-between gap-2 bg-sky-500 px-3.5 py-2.5 text-left text-sm font-semibold text-white transition hover:bg-sky-600 active:bg-sky-700"
        >
          <span className="truncate">{data.cta_label}</span>
          <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
        </button>
      )}

      {/* Caption */}
      <button type="button" onClick={() => setOpen(true)} className="block w-full px-3.5 pb-3.5 pt-2.5 text-left">
        <p className="text-sm leading-snug text-zinc-900 dark:text-zinc-100">
          <span className="font-semibold">{sponsor}</span>{" "}
          <span className="text-zinc-700 dark:text-zinc-200">{data.title || "Sponsored message"}</span>
        </p>
        {hasCta && (
          <p className="mt-1 truncate text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {hostOf(ctaUrl!)}
          </p>
        )}
      </button>

      {open && (
        <AdFullscreen
          mediaUrl={data.media_url}
          title={data.title}
          ctaLabel={data.cta_label}
          ctaUrl={ctaUrl}
          sponsorName={sponsor}
          sponsorAvatar={sender?.avatar_url}
          verified={sender?.is_business}
          onClose={() => setOpen(false)}
          onCtaClick={onCtaClick}
        />
      )}
    </aside>
  );
}
