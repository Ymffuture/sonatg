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
    if (!res.ok) return { items: [], error: "News service unavailable" };
    const json = (await res.json()) as {
      articles?: { title?: string; url?: string; domain?: string; socialimage?: string; seendate?: string }[];
    };
    const items: NewsItem[] = (json.articles ?? [])
      .filter((a) => a.title && a.url)
      .map((a) => ({
        title: a.title!,
        url: a.url!,
        source: a.domain ?? "news",
        image: a.socialimage || null,
        publishedAt: parseSeenDate(a.seendate),
      }));
    return { items, error: null };
  } catch {
    return { items: [], error: "Couldn't load news right now" };
  }
});
