import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import {
  ArrowLeft, Search, MoreVertical, RefreshCw, ExternalLink,
  Shield, FileText, Newspaper, X, Camera, Edit, Clock,
  LayoutGrid, List, Bookmark, Share2, Eye, Maximize2
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

function formatNewsTime(dateString: string | null): string {
  if (!dateString) return "Recently";
  const diffMs = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateString).toLocaleDateString([], { month: "short", day: "numeric" });
}

function StatusPage() {
  const navigate = useNavigate();
  const { user } = Route.useSearch();
  const [me, setMe] = useState<Profile | null>(null);
  const [profilesById, setProfilesById] = useState<Record<string, Profile>>({});
  const [showComposer, setShowComposer] = useState(false);
  const [composerMode, setComposerMode] = useState<"text" | "image" | "video">("text");
  const [viewingUserId, setViewingUserId] = useState<string | null>(user ?? null);

  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [viewMode, setViewMode] = useState<"preview" | "full">("preview");
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [bookmarkedNews, setBookmarkedNews] = useState<Set<string>>(new Set());
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

  useEffect(() => {
    if (!showMenu) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [showMenu]);

  const toggleBookmark = (url: string) => {
    setBookmarkedNews((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const filteredNews = news.filter((n) =>
    n.title.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
    n.source.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  return (
    <div className="min-h-dvh bg-gradient-to-br from-stone-50 via-white to-stone-100 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 transition-colors duration-300">
      {/* ─── Sticky Premium Header ─── */}
      <header className="sticky top-0 z-30 border-b border-zinc-200/60 dark:border-zinc-800/60 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-2xl shadow-sm">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate({ to: "/" })}
              className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 text-zinc-700 dark:text-zinc-300 shadow-md hover:shadow-lg transition-all"
              aria-label="Back to chats"
            >
              <ArrowLeft className="h-5 w-5" />
            </motion.button>

            <AnimatePresence mode="wait">
              {showSearch ? (
                <motion.div
                  key="search"
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "100%" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  className="flex items-center gap-2 rounded-full bg-gradient-to-r from-zinc-100 to-zinc-50 dark:from-zinc-900 dark:to-zinc-800 px-4 py-2.5 border border-zinc-300/50 dark:border-zinc-700/50 shadow-inner"
                >
                  <Search className="h-4 w-4 text-zinc-500 shrink-0" />
                  <input
                    autoFocus
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search news or sources..."
                    className="flex-1 bg-transparent text-sm outline-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500"
                  />
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => { setShowSearch(false); setSearchQuery(""); }}
                    className="grid h-7 w-7 place-items-center rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                  >
                    <X className="h-4 w-4 text-zinc-500" />
                  </motion.button>
                </motion.div>
              ) : (
                <motion.div
                  key="title"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex flex-col"
                >
                  <h1 className="text-lg font-bold bg-gradient-to-r from-zinc-900 to-zinc-700 dark:from-zinc-100 dark:to-zinc-300 bg-clip-text text-transparent">
                    Status & News
                  </h1>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">Stay updated</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {!showSearch && (
              <motion.div 
                key="actions"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="flex items-center gap-2 shrink-0"
              >
                {/* View Mode Toggle */}
                <div className="flex items-center gap-1 p-1 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50">
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setViewMode("preview")}
                    className={`grid h-8 w-8 place-items-center rounded-full transition-all ${
                      viewMode === "preview"
                        ? "bg-white dark:bg-zinc-800 text-[#E07A5F] shadow-md"
                        : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                    }`}
                    aria-label="Preview view"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setViewMode("full")}
                    className={`grid h-8 w-8 place-items-center rounded-full transition-all ${
                      viewMode === "full"
                        ? "bg-white dark:bg-zinc-800 text-[#E07A5F] shadow-md"
                        : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                    }`}
                    aria-label="Full view"
                  >
                    <List className="h-4 w-4" />
                  </motion.button>
                </div>

                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowSearch(true)}
                  className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 text-zinc-700 dark:text-zinc-300 shadow-md hover:shadow-lg transition-all"
                  aria-label="Search"
                >
                  <Search className="h-5 w-5" />
                </motion.button>

                <div className="relative" ref={menuRef}>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowMenu((v) => !v)}
                    className={`grid h-10 w-10 place-items-center rounded-full transition-all ${
                      showMenu 
                        ? "bg-gradient-to-br from-[#E07A5F]/20 to-[#F4A261]/10 text-[#E07A5F] shadow-md" 
                        : "bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 text-zinc-700 dark:text-zinc-300 shadow-md hover:shadow-lg"
                    }`}
                    aria-label="Menu"
                    aria-expanded={showMenu}
                  >
                    <MoreVertical className="h-5 w-5" />
                  </motion.button>

                  <AnimatePresence>
                    {showMenu && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        className="absolute right-0 top-full mt-2 w-60 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-2xl shadow-2xl z-50 overflow-hidden"
                      >
                        <div className="py-2 p-2 space-y-1">
                          <motion.button
                            whileHover={{ backgroundColor: "rgba(224, 122, 95, 0.1)" }}
                            whileTap={{ scale: 0.98 }}
                            onClick={loadNews}
                            disabled={newsLoading}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 rounded-xl transition-colors disabled:opacity-50"
                          >
                            <RefreshCw className={`h-4 w-4 shrink-0 ${newsLoading ? "animate-spin" : ""}`} />
                            Refresh News
                          </motion.button>

                          <Link
                            to="/privacy"
                            onClick={() => setShowMenu(false)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl transition-colors"
                          >
                            <Shield className="h-4 w-4 shrink-0" />
                            Privacy Policy
                          </Link>

                          <Link
                            to="/terms"
                            onClick={() => setShowMenu(false)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl transition-colors"
                          >
                            <FileText className="h-4 w-4 shrink-0" />
                            Terms of Service
                          </Link>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* ─── Status Stories Row ─── */}
      <section className="bg-white/50 dark:bg-zinc-950/50 backdrop-blur-sm border-b border-zinc-200/50 dark:border-zinc-800/50">
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
      <section className="px-4 py-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-2.5 mb-5 px-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#E07A5F] to-[#F4A261] text-white shadow-lg shadow-[#E07A5F]/20">
            <Newspaper className="h-4.5 w-4.5" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold bg-gradient-to-r from-zinc-900 to-zinc-700 dark:from-zinc-100 dark:to-zinc-300 bg-clip-text text-transparent">
              Channels
            </h2>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {viewMode === "preview" ? "Quick preview" : "Full articles"}
            </p>
          </div>
          <span className="text-xs font-bold text-white bg-gradient-to-r from-[#E07A5F] to-[#F4A261] px-3 py-1.5 rounded-full shadow-md">
            {filteredNews.length}
          </span>
        </div>

        {newsError && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="rounded-2xl bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/30 dark:to-red-900/20 border border-red-200 dark:border-red-900/50 p-4 text-center mb-4 shadow-lg"
          >
            <p className="text-sm font-medium text-red-600 dark:text-red-400">{newsError}</p>
            <button onClick={loadNews} className="mt-2 text-xs font-semibold text-red-600 dark:text-red-400 underline">Try again</button>
          </motion.div>
        )}

        {newsLoading ? (
          <div className={viewMode === "preview" ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "space-y-3"}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={`rounded-2xl bg-white dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800/50 overflow-hidden ${
                viewMode === "preview" ? "" : "flex gap-4 p-3"
              }`}>
                <div className={`${viewMode === "preview" ? "h-40" : "h-[72px] w-[72px]"} bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 animate-pulse`} />
                {viewMode === "full" && (
                  <div className="flex-1 space-y-3 py-1">
                    <div className="h-3 w-1/4 rounded-full bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
                    <div className="h-4 w-3/4 rounded-full bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
                    <div className="h-3 w-1/2 rounded-full bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : filteredNews.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            className="text-center py-16"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-900 dark:to-zinc-800 mb-4 shadow-lg">
              <Newspaper className="h-10 w-10 text-zinc-400" />
            </div>
            <p className="text-sm font-medium text-zinc-500">
              {searchQuery ? "No matching news found." : "All caught up! No news available right now."}
            </p>
          </motion.div>
        ) : viewMode === "preview" ? (
          <motion.div layout className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence>
              {filteredNews.map((n, i) => (
                <motion.article
                  key={n.url}
                  layout
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.05, type: "spring", stiffness: 300, damping: 25 }}
                  className="group relative overflow-hidden rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800/60 hover:border-[#E07A5F]/40 hover:shadow-2xl hover:shadow-[#E07A5F]/10 hover:-translate-y-1 transition-all duration-300 cursor-pointer"
                  onClick={() => setSelectedNews(n)}
                >
                  <div className="relative h-40 overflow-hidden bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900">
                    {n.image ? (
                      <img
                        src={n.image}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    ) : (
                      <div className="grid place-items-center h-full bg-gradient-to-br from-[#E07A5F]/10 to-[#F4A261]/5 dark:from-[#E07A5F]/20 dark:to-[#F4A261]/10">
                        <Newspaper className="h-12 w-12 text-[#E07A5F]/40" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                    
                    {/* Bookmark Button */}
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleBookmark(n.url);
                      }}
                      className={`absolute top-3 right-3 grid h-9 w-9 place-items-center rounded-full backdrop-blur-md transition-all ${
                        bookmarkedNews.has(n.url)
                          ? "bg-[#E07A5F] text-white"
                          : "bg-white/20 text-white hover:bg-white/30"
                      }`}
                    >
                      <Bookmark className={`h-4 w-4 ${bookmarkedNews.has(n.url) ? "fill-current" : ""}`} />
                    </motion.button>

                    <div className="absolute bottom-3 left-3 right-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-white bg-[#E07A5F]/90 px-2 py-1 rounded-full backdrop-blur-sm">
                          {n.source}
                        </span>
                        <span className="text-[10px] font-medium text-white/90 flex items-center gap-1 bg-black/30 px-2 py-1 rounded-full backdrop-blur-sm">
                          <Clock className="h-3 w-3" />
                          {formatNewsTime(n.publishedAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4">
                    <h3 className="text-[15px] font-bold leading-snug text-zinc-900 dark:text-zinc-100 line-clamp-2 group-hover:text-[#E07A5F] transition-colors mb-2">
                      {n.title}
                    </h3>
                    {n.description && (
                      <p className="text-[13px] text-zinc-600 dark:text-zinc-400 line-clamp-2 mb-3">
                        {n.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-[#E07A5F] flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Eye className="h-3 w-3" />
                        View article
                      </span>
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(n.url, "_blank", "noopener,noreferrer");
                        }}
                        className="grid h-8 w-8 place-items-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-[#E07A5F] hover:text-white transition-all"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </motion.button>
                    </div>
                  </div>
                </motion.article>
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div layout className="space-y-3">
            <AnimatePresence>
              {filteredNews.map((n, i) => (
                <motion.article
                  key={n.url}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: i * 0.05, type: "spring", stiffness: 300, damping: 25 }}
                  className="group relative flex gap-4 overflow-hidden rounded-2xl bg-white dark:bg-zinc-900/60 p-3 border border-zinc-200/60 dark:border-zinc-800/60 hover:border-[#E07A5F]/40 hover:shadow-xl hover:shadow-[#E07A5F]/10 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
                  onClick={() => setSelectedNews(n)}
                >
                  <div className="shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900">
                    {n.image ? (
                      <img
                        src={n.image}
                        alt=""
                        loading="lazy"
                        className="h-[80px] w-[80px] object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    ) : (
                      <div className="grid h-[80px] w-[80px] place-items-center bg-gradient-to-br from-[#E07A5F]/10 to-[#F4A261]/5 dark:from-[#E07A5F]/20 dark:to-[#F4A261]/10">
                        <Newspaper className="h-7 w-7 text-[#E07A5F]/60" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 flex flex-col justify-center">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#E07A5F]">
                        {n.source}
                      </span>
                      <span className="text-[10px] text-zinc-400">•</span>
                      <span className="text-[10px] font-medium text-zinc-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatNewsTime(n.publishedAt)}
                      </span>
                      {bookmarkedNews.has(n.url) && (
                        <Bookmark className="h-3 w-3 text-[#E07A5F] fill-current ml-auto" />
                      )}
                    </div>

                    <p className="text-[14px] font-semibold leading-snug text-zinc-900 dark:text-zinc-100 line-clamp-2 group-hover:text-[#E07A5F] transition-colors">
                      {n.title}
                    </p>

                    {n.description && (
                      <p className="text-[12px] text-zinc-600 dark:text-zinc-400 line-clamp-2 mt-1">
                        {n.description}
                      </p>
                    )}

                    <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-zinc-500">
                      <Eye className="h-3 w-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                      <span className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">View full article</span>
                    </div>
                  </div>
                </motion.article>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </section>

      {/* ─── Premium Floating Action Buttons ─── */}
      <AnimatePresence>
        {me && !showComposer && !viewingUserId && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed bottom-6 right-6 flex flex-col items-end gap-3 z-40"
          >
            <motion.button
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: 0.1 }}
              whileHover={{ scale: 1.05, x: -4 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => { setComposerMode("image"); setShowComposer(true); }}
              className="flex items-center gap-3 px-4 py-3 rounded-full bg-gradient-to-br from-zinc-900 to-zinc-800 dark:from-zinc-100 dark:to-zinc-200 text-white dark:text-zinc-900 shadow-xl border border-zinc-700/50 dark:border-zinc-300/50 backdrop-blur-md"
            >
              <span className="text-sm font-semibold">Media Status</span>
              <Camera className="h-4 w-4" />
            </motion.button>
            
            <motion.button
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: 0.05 }}
              whileHover={{ scale: 1.05, x: -4 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => { setComposerMode("text"); setShowComposer(true); }}
              className="flex items-center gap-3 px-5 py-4 rounded-full bg-gradient-to-br from-[#E07A5F] to-[#F4A261] text-white shadow-lg shadow-[#E07A5F]/40 hover:shadow-xl hover:shadow-[#E07A5F]/50 transition-all"
            >
              <span className="text-sm font-bold">New Status</span>
              <Edit className="h-5 w-5" />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Full View Modal ─── */}
      <AnimatePresence>
        {selectedNews && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedNews(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-3xl bg-white dark:bg-zinc-900 shadow-2xl border border-zinc-200/60 dark:border-zinc-800/60"
            >
              {/* Header Image */}
              <div className="relative h-64 md:h-80 overflow-hidden bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900">
                {selectedNews.image ? (
                  <img
                    src={selectedNews.image}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="grid place-items-center h-full bg-gradient-to-br from-[#E07A5F]/20 to-[#F4A261]/10">
                    <Newspaper className="h-20 w-20 text-[#E07A5F]/40" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                
                {/* Close Button */}
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setSelectedNews(null)}
                  className="absolute top-4 right-4 grid h-10 w-10 place-items-center rounded-full bg-white/20 backdrop-blur-md text-white hover:bg-white/30 transition-colors"
                >
                  <X className="h-5 w-5" />
                </motion.button>

                {/* Source & Time */}
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-white bg-[#E07A5F]/90 px-3 py-1.5 rounded-full backdrop-blur-sm">
                      {selectedNews.source}
                    </span>
                    <span className="text-xs font-medium text-white/90 flex items-center gap-1 bg-black/30 px-3 py-1.5 rounded-full backdrop-blur-sm">
                      <Clock className="h-3.5 w-3.5" />
                      {formatNewsTime(selectedNews.publishedAt)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 md:p-8 overflow-y-auto max-h-[calc(90vh-16rem)]">
                <h2 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-zinc-100 leading-tight mb-4">
                  {selectedNews.title}
                </h2>
                
                {selectedNews.description && (
                  <p className="text-base text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6">
                    {selectedNews.description}
                  </p>
                )}

                <div className="flex items-center gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => toggleBookmark(selectedNews.url)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-full font-medium text-sm transition-all ${
                      bookmarkedNews.has(selectedNews.url)
                        ? "bg-[#E07A5F] text-white"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    }`}
                  >
                    <Bookmark className={`h-4 w-4 ${bookmarkedNews.has(selectedNews.url) ? "fill-current" : ""}`} />
                    {bookmarkedNews.has(selectedNews.url) ? "Bookmarked" : "Bookmark"}
                  </motion.button>

                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      navigator.share?.({
                        title: selectedNews.title,
                        url: selectedNews.url,
                      }).catch(() => {
                        window.open(selectedNews.url, "_blank", "noopener,noreferrer");
                      });
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-medium text-sm transition-all"
                  >
                    <Share2 className="h-4 w-4" />
                    Share
                  </motion.button>

                  <motion.a
                    whileTap={{ scale: 0.95 }}
                    href={selectedNews.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-br from-[#E07A5F] to-[#F4A261] text-white font-semibold text-sm shadow-lg shadow-[#E07A5F]/30 hover:shadow-xl hover:shadow-[#E07A5F]/40 transition-all"
                  >
                    Read Full Article
                    <ExternalLink className="h-4 w-4" />
                  </motion.a>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Modals ─── */}
      <AnimatePresence>
        {showComposer && me && (
          <StatusComposer
            meId={me.id}
            initialMode={composerMode}
            onClose={() => setShowComposer(false)}
            onPosted={() => {}}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewingUserId && me && (
          <StatusViewer
            userId={viewingUserId}
            meId={me.id}
            profilesById={profilesById}
            onClose={() => { setViewingUserId(null); navigate({ to: "/status", search: { user: undefined } }); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
