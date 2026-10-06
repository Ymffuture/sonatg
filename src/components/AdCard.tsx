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

export function AdCard({ msg, mine, sender }: { msg: MessageRow; mine: boolean; sender?: Profile }) {
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
    <aside aria-label="Advertisement" className="@container w-full max-w-[400px]">
      <Card className="w-full items-stretch @[340px]:flex-row">
        {msg.media_url && (
          <div className="relative h-[140px] w-full shrink-0 overflow-hidden rounded-2xl @[340px]:h-[120px] @[340px]:w-[120px]">
            <img
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full object-cover select-none"
              loading="lazy"
              src={msg.media_url}
            />
            <span className="absolute top-2 left-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
              Ad
            </span>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <Card.Header className="gap-1">
            {!msg.media_url && (
              <span className="mb-0.5 w-fit rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                Ad
              </span>
            )}
            <Card.Title className={mine ? "" : "pe-8"}>{msg.ad_title || "Sponsored message"}</Card.Title>
            <Card.Description className="flex items-center gap-1">
              {sender?.is_business && <VscVerifiedFilled className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-label="Verified business" />}
              <span className="truncate">{sponsor ? `Sponsored by ${sponsor}` : "Sponsored"}</span>
            </Card.Description>
            {!mine && (
              <CloseButton aria-label="Hide this ad" className="absolute end-3 top-3" onPress={hide} />
            )}
          </Card.Header>

          {hasCta && (
            <Card.Footer className="mt-auto flex w-full flex-col items-start gap-3">
              <span className="flex max-w-full items-center gap-1 text-xs text-muted">
                <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                <span className="truncate">{hostOf(ctaUrl!)}</span>
              </span>
              {/* An <a> carrying HeroUI's button classes: same look as <Button>, but a real link. */}
              <a
                href={ctaUrl!}
                target="_blank"
                rel="noopener noreferrer nofollow sponsored"
                className={buttonVariants({ fullWidth: true })}
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
