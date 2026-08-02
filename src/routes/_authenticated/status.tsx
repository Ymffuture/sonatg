import { useCallback, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Newspaper, RefreshCw, ExternalLink } from "lucide-react";
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
  }, []);

  useEffect(() => { loadNews(); }, [loadNews]);

  return (
    <div className="min-h-dvh bg-[#F0EBE3] dark:bg-[#121212]">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-[#E07A5F]/15 bg-[#F0EBE3]/95 px-4 py-3 backdrop-blur dark:bg-[#1A1A1A]/95">
        <button
          onClick={() => navigate({ to: "/" })}
          className="grid h-9 w-9 place-items-center rounded-full text-[#2D3436] transition hover:bg-[#E07A5F]/10 dark:text-[#E8E8E8]"
          aria-label="Back to chats"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold text-[#2D3436] dark:text-[#E8E8E8]">Status</h1>
      </header>

      <section className="rounded-b-3xl bg-[#1E1E1E]">
        {me && (
          <StatusBar
            meId={me.id}
            profilesById={profilesById}
            onOpenComposer={() => setShowComposer(true)}
            onOpenViewer={(id) => setViewingUserId(id)}
          />
        )}
      </section>

      <section className="px-4 py-5">
        <div className="mb-3 flex items-center gap-2">
          <Newspaper className="h-5 w-5 text-[#E07A5F]" />
          <h2 className="text-base font-bold text-[#2D3436] dark:text-[#E8E8E8]">Latest news</h2>
          <button
            onClick={loadNews}
            className="ml-auto grid h-8 w-8 place-items-center rounded-full text-[#8C8C8C] transition hover:bg-[#E07A5F]/10"
            aria-label="Refresh news"
          >
            <RefreshCw className={`h-4 w-4 ${newsLoading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {newsError && <p className="text-sm text-[#8C8C8C]">{newsError}</p>}

        {newsLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-[#E07A5F]/10" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {news.map((n) => (
              <a
                key={n.url}
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex gap-3 overflow-hidden rounded-2xl bg-white p-3 transition hover:shadow-md dark:bg-[#1E1E1E]"
              >
                {n.image && (
                  <img src={n.image} alt="" loading="lazy" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
                )}
                <div className="min-w-0">
                  <p className="line-clamp-3 text-sm font-semibold text-[#2D3436] dark:text-[#E8E8E8]">{n.title}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-[#8C8C8C]">
                    {n.source}
                    {n.publishedAt && <> · {new Date(n.publishedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</>}
                    <ExternalLink className="h-3 w-3" />
                  </p>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>

      {showComposer && me && (
        <StatusComposer meId={me.id} onClose={() => setShowComposer(false)} onPosted={() => {}} />
      )}

      {viewingUserId && me && (
        <StatusViewer
          userId={viewingUserId}
          meId={me.id}
          profilesById={profilesById}
          onClose={() => { setViewingUserId(null); navigate({ to: "/status", search: {} }); }}
        />
      )}
    </div>
  );
}
