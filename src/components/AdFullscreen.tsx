// src/components/AdFullscreen.tsx
// Full-screen ad shown when someone taps an ad card.
//  - stays up for at most AD_MAX_SECONDS (30s), then closes by itself
//  - can't be dismissed until AD_CLOSE_DELAY_SECONDS (15s) have passed; a countdown shows how long is left
//  - the "Learn more" button is a real link and counts as a click
// Always dark, so text stays readable in both light and dark app themes.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, X } from "lucide-react";
import { VscVerifiedFilled } from "react-icons/vsc";
import { hostOf } from "@/lib/sources";

export const AD_MAX_SECONDS = 30;
export const AD_CLOSE_DELAY_SECONDS = 15;

type Props = {
  mediaUrl: string | null;
  title: string | null;
  ctaLabel: string | null;
  /** Already validated http(s) URL, or null when the ad has no button. */
  ctaUrl: string | null;
  sponsorName: string;
  sponsorAvatar?: string | null;
  verified?: boolean;
  onClose: () => void;
  onCtaClick?: () => void;
};

export function AdFullscreen({
  mediaUrl, title, ctaLabel, ctaUrl, sponsorName, sponsorAvatar, verified, onClose, onCtaClick,
}: Props) {
  const [elapsed, setElapsed] = useState(0); // seconds, fractional
  const [imgFailed, setImgFailed] = useState(false);

  // One timer drives both the countdown and the auto-close.
  useEffect(() => {
    const start = Date.now();
    const id = window.setInterval(() => {
      const s = (Date.now() - start) / 1000;
      setElapsed(s);
      if (s >= AD_MAX_SECONDS) {
        window.clearInterval(id);
        onClose();
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [onClose]);

  // Lock page scroll while the ad is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const canClose = elapsed >= AD_CLOSE_DELAY_SECONDS;
  const closeIn = Math.max(0, Math.ceil(AD_CLOSE_DELAY_SECONDS - elapsed));
  const progress = Math.min(1, elapsed / AD_MAX_SECONDS);

  // Esc / Android back only work once closing is allowed.
  useEffect(() => {
    if (!canClose) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canClose, onClose]);

  const showImage = !!mediaUrl && !imgFailed;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Advertisement"
      className="fixed inset-0 z-[200] flex flex-col bg-black text-white"
    >
      {/* Blurred copy of the image as backdrop */}
      {showImage && (
        <img
          src={mediaUrl!}
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-30 blur-2xl"
        />
      )}

      {/* Time-remaining bar (fills over 30s) */}
      <div className="relative z-10 h-1 w-full bg-white/20">
        <div className="h-full bg-amber-400" style={{ width: `${progress * 100}%`, transition: "width 200ms linear" }} />
      </div>

      {/* Top bar: sponsor + close / countdown */}
      <div className="relative z-10 flex items-center gap-3 px-4 pb-2 pt-3" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
        <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-white/15 text-sm font-bold">
          {sponsorAvatar ? <img src={sponsorAvatar} alt="" className="h-full w-full object-cover" /> : sponsorName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex items-center gap-1">
            <span className="truncate text-sm font-semibold">{sponsorName}</span>
            {verified && <VscVerifiedFilled className="h-3.5 w-3.5 shrink-0 text-sky-400" />}
          </div>
          <span className="text-[11px] text-white/70">Sponsored</span>
        </div>

        {canClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close ad"
            className="grid h-10 w-10 place-items-center rounded-full bg-white/15 transition hover:bg-white/25 active:scale-95"
          >
            <X className="h-5 w-5" />
          </button>
        ) : (
          <span
            aria-live="polite"
            className="rounded-full bg-white/15 px-3.5 py-2 text-xs font-semibold tabular-nums"
          >
            Close in {closeIn}s
          </span>
        )}
      </div>

      {/* Creative */}
      <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-4">
        {showImage ? (
          <img
            src={mediaUrl!}
            alt={title ?? ""}
            onError={() => setImgFailed(true)}
            className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl"
          />
        ) : (
          <div className="max-w-md rounded-3xl bg-gradient-to-br from-amber-500 to-orange-600 p-8 text-center text-2xl font-extrabold leading-snug shadow-2xl">
            {title || "Sponsored message"}
          </div>
        )}
      </div>

      {/* Bottom: headline + CTA */}
      <div
        className="relative z-10 space-y-3 px-5 pt-4"
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
      >
        {title && showImage && <p className="text-center text-base font-semibold leading-snug">{title}</p>}
        {ctaUrl && ctaLabel && (
          <a
            href={ctaUrl}
            target="_blank"
            rel="noopener noreferrer nofollow sponsored"
            onClick={onCtaClick}
            className="mx-auto flex w-full max-w-md items-center justify-center gap-2 rounded-xl bg-sky-500 px-5 py-3.5 text-base font-bold text-white transition hover:bg-sky-600 active:scale-[0.99]"
          >
            {ctaLabel}
            <ExternalLink className="h-4 w-4" aria-hidden />
          </a>
        )}
        {ctaUrl && <p className="text-center text-[11px] uppercase tracking-wide text-white/60">{hostOf(ctaUrl)}</p>}
      </div>
    </div>,
    document.body,
  );
}
