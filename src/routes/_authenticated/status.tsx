import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import {
  ArrowLeft, Search, MoreVertical, RefreshCw, ExternalLink,
  Shield, FileText, Newspaper, X, Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/lib/db";
import { StatusBar, StatusComposer, StatusViewer } from "@/components/Status";
import { fetchNews, type NewsItem } from "@/lib/news.functions";

export const Route = createFileRoute("/_authenticated/status")({
  component: StatusPage,
  validateSearch: (search: Record<string, unknown>) => ({
    user: typeof search["user"] === "string" ? (search["user"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Status & News — Sona" },
      { name: "description", content: "Share 24-hour status updates with friends and catch up on the latest world headlines inside Sona." },
      { property: "og:title", content: "Status & News — Sona" },
      { property: "og:description", content: "Share 24-hour status updates and read live headlines in Sona." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function StatusPage() {
  const navigate = useNavigate();
  const { user } = Route.useSearch();
  const [me, setMe] = useState<Profile | null>(null);
  const [profilesById, setProfilesById] = useState<Record<string, Profile>>({});
  const [showComposer, setShowComposer] = useState(false);
  const [viewingUserId, setViewingUserId] = useState<string | null>(user ?? null);

  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setViewingUserId(user ?? null); }, [user]);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      const { data } = await supabase.from("profiles").select("*");
      const map: Record<string, Profile> = {};
      for (const p of (data ?? []) as Profile[]) map[p.id] = p;
      setProfilesById(map);
      if (uid) setMe(map[uid] ?? null);
    })();
  }, []);

  const loadNews = useCallback(async () => {
    setNewsLoading(true);
    const res = await fetchNews();
    setNews(res.items);
    setNewsError(res.error);
    setNewsLoading(false);
    setShowMenu(false);
  }, []);

  useEffect(() => { loadNews(); }, [loadNews]);

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [showMenu]);

  const filteredNews = news.filter((n) =>
    n.title.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
    n.source.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  return (
    <div className="min-h-dvh bg-[#F0EBE3] dark:bg-[#121212]">
      {/* ─── Sticky Header ─── */}
      <header className="sticky top-0 z-30 border-b border-[#E07A5F]/10 bg-[#FFFDF9]/90 dark:bg-[#1A1A1A]/90 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate({ to: "/" })}
              className="grid h-9 w-9 place-items-center rounded-full text-[#2D3436] transition hover:bg-[#E07A5F]/10 dark:text-[#E8E8E8] shrink-0"
              aria-label="Back to chats"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            {showSearch ? (
              <div className="flex flex-1 items-center gap-2 rounded-full bg-[#F5F0E8] dark:bg-[#2A2A2A] px-3 py-2 border border-[#E07A5F]/10 animate-in fade-in slide-in-from-left-2 duration-200">
                <Search className="h-4 w-4 text-[#8C8C8C] shrink-0" />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search news..."
                  className="flex-1 bg-transparent text-sm outline-none text-[#2D3436] dark:text-[#E8E8E8] placeholder:text-[#8C8C8C]"
                />
                <button
                  onClick={() => { setShowSearch(false); setSearchQuery(""); }}
                  className="grid h-6 w-6 place-items-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <X className="h-3.5 w-3.5 text-[#8C8C8C]" />
                </button>
              </div>
            ) : (
              <h1 className="text-lg font-bold text-[#2D3436] dark:text-[#E8E8E8] truncate">
                Status & News
              </h1>
            )}
          </div>

          {!showSearch && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setShowSearch(true)}
                className="grid h-9 w-9 place-items-center rounded-full text-[#2D3436] transition hover:bg-[#E07A5F]/10 dark:text-[#E8E8E8]"
                aria-label="Search"
              >
                <Search className="h-5 w-5" />
              </button>

              {/* Vertical dots menu */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setShowMenu((v) => !v)}
                  className={`grid h-9 w-9 place-items-center rounded-full transition ${showMenu ? "bg-[#E07A5F]/10" : "hover:bg-[#E07A5F]/10"} text-[#2D3436] dark:text-[#E8E8E8]`}
                  aria-label="Menu"
                  aria-expanded={showMenu}
                >
                  <MoreVertical className="h-5 w-5" />
                </button>

                {showMenu && (
                  <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-[#E07A5F]/10 bg-white dark:bg-[#242424] shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                    <div className="py-1">
                      <button
                        onClick={loadNews}
                        disabled={newsLoading}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#2D3436] dark:text-[#E8E8E8] hover:bg-[#F4A261]/10 transition-colors disabled:opacity-50"
                      >
                        <RefreshCw className={`h-4 w-4 shrink-0 ${newsLoading ? "animate-spin" : ""}`} />
                        Refresh
                      </button>

                      <Link
                        to="/privacy"
                        onClick={() => setShowMenu(false)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#2D3436] dark:text-[#E8E8E8] hover:bg-[#F4A261]/10 transition-colors"
                      >
                        <Shield className="h-4 w-4 shrink-0" />
                        Privacy
                      </Link>

                      <Link
                        to="/terms"
                        onClick={() => setShowMenu(false)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#2D3436] dark:text-[#E8E8E8] hover:bg-[#F4A261]/10 transition-colors"
                      >
                        <FileText className="h-4 w-4 shrink-0" />
                        Terms
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ─── Status Stories Row ─── */}
      <section className="bg-[#FFFDF9] dark:bg-[#1A1A1A] border-b border-[#E07A5F]/10">
        {me && (
          <StatusBar
            meId={me.id}
            profilesById={profilesById}
            onOpenComposer={() => setShowComposer(true)}
            onOpenViewer={(id) => setViewingUserId(id)}
          />
        )}
      </section>

      {/* ─── News / Channels Section ─── */}
      <section className="px-4 py-4 max-w-2xl mx-auto">
        {/* Section header */}
        <div className="flex items-center gap-2 mb-4 px-1">
          <Newspaper className="h-5 w-5 text-[#E07A5F]" />
          <h2 className="text-base font-bold text-[#2D3436] dark:text-[#E8E8E8]">Channels</h2>
          <span className="ml-auto text-xs font-medium text-[#8C8C8C]">
            {filteredNews.length} update{filteredNews.length !== 1 ? "s" : ""}
          </span>
        </div>

        {newsError && (
          <div className="rounded-2xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 p-4 text-center">
            <p className="text-sm text-red-600 dark:text-red-400">{newsError}</p>
          </div>
        )}

        {newsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-3 p-3 rounded-2xl bg-white dark:bg-[#1E1E1E] border border-[#E07A5F]/5">
                <div className="h-16 w-16 shrink-0 rounded-xl bg-[#E07A5F]/10 animate-pulse" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-3 w-3/4 rounded bg-[#E07A5F]/10 animate-pulse" />
                  <div className="h-2.5 w-1/2 rounded bg-[#E07A5F]/10 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredNews.length === 0 ? (
          <div className="text-center py-12">
            <Newspaper className="h-10 w-10 mx-auto text-[#E07A5F]/30 mb-3" />
            <p className="text-sm text-[#8C8C8C]">
              {searchQuery ? "No results found." : "No news available right now."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredNews.map((n) => (
              <a
                key={n.url}
                href={n.url}
                target="sona-news"
                rel="noopener noreferrer"
                className="group flex gap-3.5 overflow-hidden rounded-2xl bg-white dark:bg-[#1E1E1E] p-3 transition-all duration-200 hover:shadow-md border border-transparent hover:border-[#E07A5F]/10"
              >
                {/* Channel avatar placeholder or image */}
                <div className="shrink-0">
                  {n.image ? (
                    <img
                      src={n.image}
                      alt=""
                      loading="lazy"
                      className="h-[72px] w-[72px] rounded-2xl object-cover bg-[#F5F0E8] dark:bg-[#2A2A2A]"
                    />
                  ) : (
                    <div className="grid h-[72px] w-[72px] place-items-center rounded-2xl bg-gradient-to-br from-[#E07A5F]/20 to-[#F4A261]/10">
                      <Newspaper className="h-6 w-6 text-[#E07A5F]/60" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 flex flex-col justify-center">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs font-bold uppercase tracking-wide text-[#E07A5F]">
                      {n.source}
                    </span>
                    <span className="text-[10px] text-[#8C8C8C]">•</span>
                    <span className="text-[11px] text-[#8C8C8C]">
                      {n.publishedAt
                        ? new Date(n.publishedAt).toLocaleDateString([], { month: "short", day: "numeric" })
                        : "Recently"}
                    </span>
                  </div>

                  <p className="text-[14px] font-semibold leading-snug text-[#2D3436] dark:text-[#E8E8E8] line-clamp-2 group-hover:text-[#E07A5F] transition-colors">
                    {n.title}
                  </p>

                  <div className="mt-1.5 flex items-center gap-1 text-[11px] text-[#8C8C8C]">
                    <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity">Read more</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>

      {/* ─── Modals ─── */}
      {showComposer && me && (
        <StatusComposer meId={me.id} onClose={() => setShowComposer(false)} onPosted={() => {}} />
      )}

      {viewingUserId && me && (
        <StatusViewer
          userId={viewingUserId}
          meId={me.id}
          profilesById={profilesById}
          onClose={() => { setViewingUserId(null); navigate({ to: "/status", search: { user: undefined } }); }}
        />
      )}
    </div>
  );
}
