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
  
  if (failed) return <Fallback style={{ width: size, height: size }} className="shrink-0 opacity-60" aria-hidden />;
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostOf(source.url))}&sz=64`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="shrink-0 rounded-md"
    />
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
  const [active, setActive] = useState<number | null>(null);
  if (!sources.length) return null;

  const visible = sources.slice(0, MAX_VISIBLE_PILLS);
  const extra = sources.length - visible.length;

  const openAt = (i: number | null) => {
    setActive(i);
    setOpen(true);
  };

  // Prevent drawer events from bubbling into the message bubble
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  const pill =
    "inline-flex max-w-[11rem] items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium " +
    "transition-all duration-200 active:scale-95 hover:shadow-sm " +
    (mine
      ? "border-black/10 bg-black/5 text-gray-700 hover:bg-black/10 hover:border-black/20 dark:border-white/15 dark:bg-white/10 dark:text-gray-200 dark:hover:bg-white/15"
      : "border-[var(--sona-accent,#E07A5F)]/30 bg-[var(--sona-accent,#E07A5F)]/10 text-[var(--sona-accent-dark,#C2634A)] hover:bg-[var(--sona-accent,#E07A5F)]/15 hover:border-[var(--sona-accent,#E07A5F)]/50");

  return (
    <div
      onClick={stop}
      onPointerDown={stop}
      onTouchStart={stop}
      onContextMenu={stop}
      className="pr-12 pb-2"
    >
      {/* Pill Container */}
      <div className="flex flex-wrap items-center gap-2" role="list" aria-label="Sources">
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
              {sources.map((s, i) => {
                const date = formatDate(s.publishedAt);
                const isActive = active === i;
                
                return (
                  <li key={s.url}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className={`
                        group block rounded-2xl border p-4 transition-all duration-200 
                        hover:-translate-y-0.5 hover:shadow-md
                        ${isActive 
                          ? "border-[var(--sona-accent,#E07A5F)] bg-[var(--sona-accent,#E07A5F)]/5 shadow-sm" 
                          : "border-border bg-card hover:border-[var(--sona-accent,#E07A5F)]/30 hover:bg-muted/40"
                        }
                      `}
                    >
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Favicon source={s} size={16} />
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
