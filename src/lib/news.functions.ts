import { createServerFn } from "@tanstack/react-start";

export type NewsItem = {
  title: string;
  url: string;
  source: string;
  image: string | null;
  publishedAt: string | null;
};

// GDELT's public document API is free and needs no API key, which keeps the
// news feed working without asking anyone for credentials.
const GDELT =
  "https://api.gdeltproject.org/api/v2/doc/doc?query=sourcelang:english&mode=artlist&maxrecords=24&sort=datedesc&format=json";

// GDELT timestamps look like "20260802T081500Z" — turn that into ISO.
function parseSeenDate(seen: string | undefined): string | null {
  if (!seen || seen.length < 15) return null;
  const iso = `${seen.slice(0, 4)}-${seen.slice(4, 6)}-${seen.slice(6, 8)}T${seen.slice(9, 11)}:${seen.slice(11, 13)}:${seen.slice(13, 15)}Z`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export const fetchNews = createServerFn({ method: "GET" }).handler(async (): Promise<{ items: NewsItem[]; error: string | null }> => {
  try {
    const res = await fetch(GDELT, { headers: { "User-Agent": "SonaTalkGold/1.0" } });
    const text = await res.text();
    let json: { articles?: { title?: string; url?: string; domain?: string; socialimage?: string; seendate?: string }[] } | null = null;
    try { json = JSON.parse(text); } catch { json = null; }

    // GDELT rate-limits aggressively and answers with plain text when it does,
    // so fall back to Reddit's public world-news feed (also key-free).
    if (!res.ok || !json) return await fetchFallback();

    const items: NewsItem[] = (json.articles ?? [])
      .filter((a) => a.title && a.url)
      .map((a) => ({
        title: a.title!,
        url: a.url!,
        source: a.domain ?? "news",
        image: a.socialimage || null,
        publishedAt: parseSeenDate(a.seendate),
      }));
    if (items.length === 0) return await fetchFallback();
    return { items, error: null };
  } catch {
    return await fetchFallback();
  }
});

async function fetchFallback(): Promise<{ items: NewsItem[]; error: string | null }> {
  try {
    const res = await fetch("https://www.reddit.com/r/worldnews/hot.json?limit=24", {
      headers: { "User-Agent": "SonaTalkGold/1.0" },
    });
    if (!res.ok) return { items: [], error: "Couldn't load news right now" };
    const json = (await res.json()) as {
      data?: { children?: { data?: { title?: string; url?: string; domain?: string; thumbnail?: string; created_utc?: number; permalink?: string } }[] };
    };
    const items: NewsItem[] = (json.data?.children ?? [])
      .map((c) => c.data)
      .filter((d): d is NonNullable<typeof d> => !!d?.title)
      .map((d) => ({
        title: d.title!,
        url: d.url?.startsWith("http") ? d.url : `https://reddit.com${d.permalink ?? ""}`,
        source: d.domain ?? "reddit.com",
        image: d.thumbnail?.startsWith("http") ? d.thumbnail : null,
        publishedAt: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : null,
      }));
    return { items, error: items.length ? null : "Couldn't load news right now" };
  } catch {
    return { items: [], error: "Couldn't load news right now" };
  }
}
