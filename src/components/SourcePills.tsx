// src/components/SourcePills.tsx
//
// One compact pill under an AI reply showing where the live info came from: a
// HeroUI AvatarGroup of the sources' site icons + "3 sources". Tapping it opens
// a bottom sheet (vaul drawer) with the full details of every source.

import { useState } from "react";
import { Avatar, AvatarGroup } from "@heroui/react";
import { ChevronRight, CloudSun, ExternalLink } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { hostOf, type Source } from "@/lib/sources";

const MAX_STACKED = 3;

// Google News links are redirects, so their favicon would just be Google's logo;
// the publisher's initials say far more.
const isRedirectHost = (url: string) => hostOf(url) === "news.google.com";

function initials(text: string): string {
  const words = text.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  const letters = words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0];
  return letters.toUpperCase();
}

/**
 * A source's icon as a HeroUI Avatar. If the favicon is missing or fails to load,
 * Avatar.Fallback takes over automatically (initials, or a sun for weather).
 * `className` sets the size, e.g. "size-6 [--avatar-size:1.5rem]" (the group's
 * overlap mask reads --avatar-size, so both must be set together).
 */
function SourceAvatar({ source, className = "" }: { source: Source; className?: string }) {
  return (
    <Avatar size="sm" className={`bg-white ${className}`}>
      {!isRedirectHost(source.url) && (
        <Avatar.Image
          alt=""
          src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostOf(source.url))}&sz=64`}
          referrerPolicy="no-referrer"
        />
      )}
      <Avatar.Fallback className="text-[10px] font-semibold">
        {source.kind === "weather" ? <CloudSun className="size-3.5" aria-hidden /> : initials(label(source))}
      </Avatar.Fallback>
    </Avatar>
  );
}

function label(s: Source): string {
  const host = hostOf(s.url);
  return s.site && (host === "news.google.com" || s.kind === "news") ? s.site : s.site ?? host;
}

function formatDate(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso + "T12:00:00Z");
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function SourcePills({ sources, mine = false }: { sources: Source[]; mine?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!sources.length) return null;

  const stacked = sources.slice(0, MAX_STACKED);
  const extra = sources.length - stacked.length;
  const text = sources.length === 1 ? label(sources[0]) : `${sources.length} sources`;

  // Prevent drawer events from bubbling into the message bubble
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  const pill =
    "group inline-flex max-w-full cursor-pointer select-none items-center gap-2.5 rounded-full border py-1 pr-3 pl-1 " +
    "shadow-sm ring-1 transition-all duration-200 hover:shadow-md active:scale-[0.97] " +
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sona-accent,#E07A5F)] " +
    (mine
      ? "border-black/10 bg-surface/90 ring-black/[0.04] dark:border-white/15 dark:ring-white/10"
      : "border-[var(--sona-accent,#E07A5F)]/25 bg-surface/95 ring-black/[0.04] hover:border-[var(--sona-accent,#E07A5F)]/50 dark:ring-white/10");

  return (
    <div
      onClick={stop}
      onPointerDown={stop}
      onTouchStart={stop}
      onContextMenu={stop}
      className="pr-12 pb-2"
    >
      {/* A div (not a <button>) because the avatar group renders divs inside it */}
      <div
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-label={`${sources.length} ${sources.length === 1 ? "source" : "sources"} used for this answer. Tap to view.`}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={pill}
      >
        <AvatarGroup
          aria-hidden
          overlap="clip"
          size="sm"
          className="[--avatar-group-overlap:0.5rem] [--avatar-group-seam:2px]"
        >
          {stacked.map((s) => (
            <SourceAvatar key={s.url} source={s} className="size-6 [--avatar-size:1.5rem]" />
          ))}
          {extra > 0 && (
            <AvatarGroup.Count className="size-6 [--avatar-size:1.5rem] text-[10px]">+{extra}</AvatarGroup.Count>
          )}
        </AvatarGroup>
        <span className="truncate text-[13px] font-medium text-foreground">{text}</span>
        <ChevronRight
          className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </div>

      {/* Premium Drawer */}
      <Drawer open={open} onOpenChange={setOpen} shouldScaleBackground={false}>
        <DrawerContent className="h-[min(90dvh,760px)] max-h-[90dvh] min-h-0 outline-none flex flex-col">
          {/* Sticky Frosted Header */}
          <DrawerHeader className="shrink-0 border-b bg-background pb-3 text-left">
            <DrawerTitle className="text-base font-semibold">Sources</DrawerTitle>
            <DrawerDescription className="text-sm">
              {sources.length} {sources.length === 1 ? "link" : "links"} Sona AI used for this answer. Tap to verify.
            </DrawerDescription>
          </DrawerHeader>

          {/* Scrollable List Container */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y [scrollbar-width:thin]" data-vaul-no-drag>
            <ul
              className="space-y-3 px-4 py-4 pb-[max(2rem,env(safe-area-inset-bottom))]"
            >
              {sources.map((s) => {
                const date = formatDate(s.publishedAt);

                return (
                  <li key={s.url}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="group flex items-start gap-3 rounded-2xl border border-border bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--sona-accent,#E07A5F)]/30 hover:bg-muted/40 hover:shadow-md"
                    >
                      <SourceAvatar source={s} className="mt-0.5 shrink-0 ring-1 ring-black/5 dark:ring-white/10" />
                      <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="truncate font-semibold text-foreground/80">{label(s)}</span>
                        <span aria-hidden className="opacity-50">·</span>
                        <span className="truncate">{hostOf(s.url)}</span>
                        {date && (
                          <>
                            <span aria-hidden className="opacity-50">·</span>
                            <span className="shrink-0">{date}</span>
                          </>
                        )}
                      </div>
                      
                      <p className="mt-2 text-[15px] font-semibold leading-snug text-foreground group-hover:text-[var(--sona-accent-dark,#C2634A)] transition-colors">
                        {s.title}
                      </p>
                      <p className="mt-1 break-all text-xs text-muted-foreground">{s.url}</p>
                      
                      {s.snippet && (
                        <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                          {s.snippet}
                        </p>
                      )}
                      
                      <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--sona-accent-dark,#C2634A)] opacity-80 group-hover:opacity-100 transition-opacity">
                        Open source <ExternalLink className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
                      </span>
                      </div>
                    </a>
                  </li>
                );
              })}
            </ul>

          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
