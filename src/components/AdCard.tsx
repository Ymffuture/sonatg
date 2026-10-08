// src/components/AdCard.tsx
//
// The card shown for a business "ad" message, built from HeroUI's Card, Button
// styles and CloseButton. It is image-left / text-right when the chat column is
// wide enough and stacks (image on top) on phones — decided by CONTAINER width,
// not the screen, because the card lives inside a chat bubble column.

import { useEffect, useState } from "react";
import { Card, CloseButton } from "@heroui/react";
import { buttonVariants } from "@heroui/styles";
import { ExternalLink } from "lucide-react";
import { VscVerifiedFilled } from "react-icons/vsc";
import type { MessageRow, Profile } from "@/lib/db";
import { hostOf, isSafeHttpUrl } from "@/lib/sources";

/** The fields the card needs, whether the ad came from a chat message or the `ads` table. */
export type AdCardData = {
  id: string;
  media_url: string | null;
  title: string | null;
  cta_label: string | null;
  cta_url: string | null;
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
  sender?: Pick<Profile, "display_name" | "is_business">;
  /** Called when the CTA link is opened (used to count clicks). */
  onCtaClick?: () => void;
};

export function AdCard({ msg: message, ad, mine = false, sender, onCtaClick }: AdCardProps) {
  // Normalise both sources into one shape so the markup below is written once.
  const msg = message
    ? { id: message.id, media_url: message.media_url, ad_title: message.ad_title, ad_cta_label: message.ad_cta_label, ad_cta_url: message.ad_cta_url }
    : { id: ad!.id, media_url: ad!.media_url, ad_title: ad!.title, ad_cta_label: ad!.cta_label, ad_cta_url: ad!.cta_url };
  const [hidden, setHidden] = useState(false);

  // Read after mount (not in the initializer) so server and client render the same first frame.
  useEffect(() => { setHidden(readHidden().includes(msg.id)); }, [msg.id]);

  const hide = () => {
    setHidden(true);
    writeHidden([...readHidden().filter((id) => id !== msg.id), msg.id]);
  };
  const unhide = () => {
    setHidden(false);
    writeHidden(readHidden().filter((id) => id !== msg.id));
  };

  // The CTA link is user-supplied, so only ever render http(s) links (never javascript:/data:).
  const ctaUrl = msg.ad_cta_url && isSafeHttpUrl(msg.ad_cta_url) ? msg.ad_cta_url : null;
  const hasCta = !!ctaUrl && !!msg.ad_cta_label;
  const sponsor = sender?.display_name?.trim();

  if (hidden) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted">
        <span>Ad hidden</span>
        <button type="button" onClick={unhide} className="font-semibold text-foreground underline underline-offset-2">
          Undo
        </button>
      </div>
    );
  }

  return (
    <aside aria-label="Advertisement" className="@container w-full max-w-[430px]">
      <Card className="group relative w-full overflow-hidden border border-foreground/10 bg-background/95 shadow-[0_12px_40px_-20px_hsl(var(--foreground)/0.35)] ring-1 ring-black/5 backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_45px_-22px_hsl(var(--foreground)/0.45)] dark:ring-white/5 @[340px]:flex-row">
        {msg.media_url && (
          <div className="relative h-[155px] w-full shrink-0 overflow-hidden @[340px]:h-[132px] @[340px]:w-[132px] @[340px]:self-stretch">
            <img
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full object-cover select-none transition-transform duration-500 group-hover:scale-[1.04]"
              loading="lazy"
              src={msg.media_url}
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/0 to-black/10" />
            <span className="absolute start-3 top-3 rounded-full border border-white/20 bg-black/55 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-white shadow-sm backdrop-blur-md">
              Sponsored
            </span>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-0 @[340px]:min-h-[132px]">
          <Card.Header className="relative gap-1.5 px-4 pb-2 pt-4 @[340px]:px-4 @[340px]:pt-4">
            {!msg.media_url && (
              <span className="mb-0.5 w-fit rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-300">
                Sponsored
              </span>
            )}
            <Card.Title className={mine ? "text-[15px] leading-5 tracking-[-0.01em]" : "pe-8 text-[15px] leading-5 tracking-[-0.01em]"}>{msg.ad_title || "Sponsored message"}</Card.Title>
            <Card.Description className="flex min-w-0 items-center gap-1.5 text-[11px]">
              {sender?.is_business && <VscVerifiedFilled className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-label="Verified business" />}
              <span className="truncate">{sponsor ? sponsor : "Sponsored"}</span>
            </Card.Description>
            {!mine && (
              <CloseButton aria-label="Hide this ad" className="absolute end-2 top-2 opacity-60 transition-opacity hover:opacity-100" onPress={hide} />
            )}
          </Card.Header>

          {hasCta && (
            <Card.Footer className="mt-auto flex w-full flex-col items-stretch gap-2.5 px-4 pb-4 pt-2">
              <span className="flex max-w-full items-center gap-1 text-xs text-muted">
                <span className="flex min-w-0 items-center gap-1.5 rounded-md bg-foreground/5 px-2 py-1">
                  <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                  <span className="truncate">{hostOf(ctaUrl!)}</span>
                </span>
              </span>
              {/* An <a> carrying HeroUI's button classes: same look as <Button>, but a real link. */}
              <a
                href={ctaUrl!}
                target="_blank"
                rel="noopener noreferrer nofollow sponsored"
                onClick={onCtaClick}
                className={`${buttonVariants({ fullWidth: true })} h-9 rounded-xl text-[12px] font-semibold shadow-sm transition-transform active:scale-[0.98]`}
              >
                {msg.ad_cta_label}
              </a>
            </Card.Footer>
          )}
        </div>
      </Card>
    </aside>
  );
}
