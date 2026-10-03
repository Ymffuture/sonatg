// src/components/SourcePills.tsx
//
// Pills under an AI reply showing where the live info came from. Tapping a pill
// opens a bottom sheet (vaul drawer) with the full details of every source.

import { useState } from "react";
import { ExternalLink, Globe, CloudSun, Newspaper } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { hostOf, type Source } from "@/lib/sources";

const MAX_VISIBLE_PILLS = 3;

function Favicon({ source, size = 16 }: { source: Source; size?: number }) {
  const [failed, setFailed] = useState(false);
  const Fallback = source.kind === "weather" ? CloudSun : source.kind === "news" ? Newspaper : Globe;
  // Google News links are redirects, so their favicon would just be Google's.
  // The publisher name is the useful bit there; fall back to an icon.
  if (failed) return <Fallback style={{ width: size, height: size }} className="shrink-0 opacity-70" aria-hidden />;
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostOf(source.url))}&sz=64`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="shrink-0 rounded-[4px]"
    />
  );
}

function label(s: Source): string {
  const host = hostOf(s.url);
  // news.google.com says nothing about the publisher — prefer the site name.
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
  const [active, setActive] = useState<number | null>(null);
  if (!sources.length) return null;

  const visible = sources.slice(0, MAX_VISIBLE_PILLS);
  const extra = sources.length - visible.length;

  const openAt = (i: number | null) => {
    setActive(i);
    setOpen(true);
  };

  // The drawer is portalled, but React events still bubble through the React
  // tree into the message bubble (long-press menu, tap-to-select, etc.).
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  const pill =
    "inline-flex max-w-[11rem] items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium " +
    "transition active:scale-95 " +
    (mine
      ? "border-black/10 bg-black/5 text-gray-700 hover:bg-black/10 dark:border-white/15 dark:bg-white/10 dark:text-gray-200"
      : "border-[var(--sona-accent,#E07A5F)]/25 bg-[var(--sona-accent,#E07A5F)]/10 text-[var(--sona-accent-dark,#C2634A)] hover:bg-[var(--sona-accent,#E07A5F)]/20");

  return (
    <div
      onClick={stop}
      onPointerDown={stop}
      onTouchStart={stop}
      onContextMenu={stop}
      className="pr-12 pb-2"
    >
      <div className="flex flex-wrap items-center gap-1.5" role="list" aria-label="Sources">
        {visible.map((s, i) => (
          <button
            key={s.url}
            type="button"
            role="listitem"
            onClick={() => openAt(i)}
            className={pill}
            title={s.title}
          >
            <Favicon source={s} />
            <span className="truncate">{label(s)}</span>
          </button>
        ))}
        {extra > 0 && (
          <button type="button" role="listitem" onClick={() => openAt(null)} className={pill}>
            +{extra} more
          </button>
        )}
      </div>

      <Drawer open={open} onOpenChange={setOpen} shouldScaleBackground={false}>
        <DrawerContent className="max-h-[85dvh] outline-none">
          <DrawerHeader className="pb-2 text-left">
            <DrawerTitle>Sources</DrawerTitle>
            <DrawerDescription>
              {sources.length} {sources.length === 1 ? "link" : "links"} Sona AI used for this answer. Open one to verify it.
            </DrawerDescription>
          </DrawerHeader>

          <ul
            className="space-y-2.5 overflow-y-auto overscroll-contain px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
            data-vaul-no-drag
          >
            {sources.map((s, i) => {
              const date = formatDate(s.publishedAt);
              return (
                <li key={s.url}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className={
                      "block rounded-2xl border p-3.5 transition hover:bg-muted/60 " +
                      (active === i ? "border-[var(--sona-accent,#E07A5F)] bg-[var(--sona-accent,#E07A5F)]/5" : "border-border")
                    }
                  >
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Favicon source={s} size={16} />
                      <span className="truncate font-medium">{label(s)}</span>
                      <span aria-hidden>·</span>
                      <span className="truncate">{hostOf(s.url)}</span>
                      {date && (
                        <>
                          <span aria-hidden>·</span>
                          <span className="shrink-0">{date}</span>
                        </>
                      )}
                    </div>
                    <p className="mt-1.5 text-[15px] font-semibold leading-snug text-foreground">{s.title}</p>
                    {s.snippet && (
                      <p className="mt-1 line-clamp-4 text-sm leading-relaxed text-muted-foreground">{s.snippet}</p>
                    )}
                    <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[var(--sona-accent-dark,#C2634A)]">
                      Open source <ExternalLink className="h-3 w-3" aria-hidden />
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
