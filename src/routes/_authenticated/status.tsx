import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import {
  ArrowLeft, Search, MoreVertical, RefreshCw, ExternalLink,
  Shield, FileText, Newspaper, X, Camera, Edit, Clock
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

  const filteredNews = news.filter((n) =>
    n.title.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
    n.source.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  return (
    <div className="min-h-dvh bg-stone-50 dark:bg-zinc-950 transition-colors duration-300">
      {/* ─── Sticky Premium Header ─── */}
      <header className="sticky top-0 z-30 border-b border-zinc-200/50 dark:border-zinc-800/50 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-2xl">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate({ to: "/" })}
              className="grid h-9 w-9 place-items-center rounded-full text-zinc-600 dark:text-zinc-400 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900 shrink-0"
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
                  className="flex items-center gap-2 rounded-full bg-zinc-100 dark:bg-zinc-900 px-3 py-2 border border-zinc-200 dark:border-zinc-800"
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
                    className="grid h-6 w-6 place-items-center rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <X className="h-3.5 w-3.5 text-zinc-500" />
                  </motion.button>
                </motion.div>
              ) : (
                <motion.h1
                  key="title"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="text-lg font-bold text-zinc-900 dark:text-zinc-100 truncate"
                >
                  Status & News
                </motion.h1>
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
                className="flex items-center gap-1 shrink-0"
              >
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowSearch(true)}
                  className="grid h-9 w-9 place-items-center rounded-full text-zinc-600 dark:text-zinc-400 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900"
                  aria-label="Search"
                >
                  <Search className="h-5 w-5" />
                </motion.button>

                <div className="relative" ref={menuRef}>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowMenu((v) => !v)}
                    className={`grid h-9 w-9 place-items-center rounded-full transition-colors ${showMenu ? "bg-[#E07A5F]/10 text-[#E07A5F]" : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900"}`}
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
                        className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-2xl shadow-2xl z-50 overflow-hidden"
                      >
                        <div className="py-1.5 p-1.5">
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
      <section className="bg-white dark:bg-zinc-950 border-b border-zinc-200/50 dark:border-zinc-800/50">
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
      <section className="px-4 py-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-2.5 mb-5 px-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E07A5F]/10 text-[#E07A5F]">
            <Newspaper className="h-4 w-4" />
          </div>
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Channels</h2>
          <span className="ml-auto text-xs font-semibold text-zinc-500 bg-zinc-100 dark:bg-zinc-900 px-2.5 py-1 rounded-full">
            {filteredNews.length} update{filteredNews.length !== 1 ? "s" : ""}
          </span>
        </div>

        {newsError && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 p-4 text-center mb-4"
          >
            <p className="text-sm font-medium text-red-600 dark:text-red-400">{newsError}</p>
            <button onClick={loadNews} className="mt-2 text-xs font-semibold text-red-600 dark:text-red-400 underline">Try again</button>
          </motion.div>
        )}

        {newsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-4 p-3 rounded-2xl bg-white dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800/50">
                <div className="h-[72px] w-[72px] shrink-0 rounded-xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
                <div className="flex-1 space-y-3 py-1">
                  <div className="h-3 w-1/4 rounded-full bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
                  <div className="h-4 w-3/4 rounded-full bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
                  <div className="h-3 w-1/2 rounded-full bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredNews.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            className="text-center py-16"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-900 mb-4">
              <Newspaper className="h-8 w-8 text-zinc-400" />
            </div>
            <p className="text-sm font-medium text-zinc-500">
              {searchQuery ? "No matching news found." : "All caught up! No news available right now."}
            </p>
          </motion.div>
        ) : (
          <motion.div layout className="space-y-3">
            <AnimatePresence>
              {filteredNews.map((n, i) => (
                <motion.a
                  key={n.url}
                  layout
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ delay: i * 0.05, type: "spring", stiffness: 300, damping: 25 }}
                  href={n.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative flex gap-4 overflow-hidden rounded-2xl bg-white dark:bg-zinc-900/60 p-3 border border-zinc-200/50 dark:border-zinc-800/50 hover:border-[#E07A5F]/30 hover:shadow-lg hover:shadow-[#E07A5F]/5 hover:-translate-y-0.5 transition-all duration-300"
                >
                  <div className="shrink-0 overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800">
                    {n.image ? (
                      <img
                        src={n.image}
                        alt=""
                        loading="lazy"
                        className="h-[72px] w-[72px] object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    ) : (
                      <div className="grid h-[72px] w-[72px] place-items-center bg-gradient-to-br from-[#E07A5F]/10 to-[#F4A261]/5 dark:from-[#E07A5F]/20 dark:to-[#F4A261]/10">
                        <Newspaper className="h-6 w-6 text-[#E07A5F]/60" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 flex flex-col justify-center">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#E07A5F]">
                        {n.source}
                      </span>
                      <span className="text-[10px] text-zinc-400">•</span>
                      <span className="text-[10px] font-medium text-zinc-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatNewsTime(n.publishedAt)}
                      </span>
                    </div>

                    <p className="text-[14px] font-semibold leading-snug text-zinc-900 dark:text-zinc-100 line-clamp-2 group-hover:text-[#E07A5F] transition-colors">
                      {n.title}
                    </p>

                    <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-zinc-500">
                      <ExternalLink className="h-3 w-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                      <span className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">Read full article</span>
                    </div>
                  </div>
                </motion.a>
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
              className="flex items-center gap-3 px-4 py-3 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-xl border border-zinc-700/50 dark:border-zinc-300/50 backdrop-blur-md"
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
              className="flex items-center gap-3 px-5 py-4 rounded-full bg-[#E07A5F] text-white shadow-lg shadow-[#E07A5F]/30 hover:bg-[#d4694f] transition-colors"
            >
              <span className="text-sm font-bold">New Status</span>
              <Edit className="h-5 w-5" />
            </motion.button>
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
