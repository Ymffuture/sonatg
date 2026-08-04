import { createServerFn } from "@tanstack/react-start";

export type NewsItem = {
  title: string;
  url: string;
  source: string;
  image: string | null;
  publishedAt: string | null;
};

// Key-free RSS feeds. GDELT rate-limits almost immediately and Reddit blocks
// datacenter IPs with 403, so both were returning nothing — these public RSS
// endpoints answer reliably without credentials.
const FEEDS: { url: string; source: string }[] = [
  { url: "https://feeds.bbci.co.uk/news/world/rss.xml", source: "BBC News" },
  { url: "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en", source: "Google News" },
  { url: "https://moxie.foxnews.com/google-publisher/world.xml", source: "Fox News" },
];

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function tag(item: string, name: string): string | null {
  const m = item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m?.[1] ? decodeEntities(m[1]) : null;
}

function imageFrom(item: string): string | null {
  const m =
    item.match(/<media:(?:thumbnail|content)[^>]*url="([^"]+)"/i) ||
    item.match(/<enclosure[^>]*url="([^"]+)"[^>]*type="image/i) ||
    item.match(/<img[^>]*src="([^"]+)"/i);
  return m?.[1] ?? null;
}

function parseRss(xml: string, fallbackSource: string): NewsItem[] {
  const items = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  return items
    .map((raw) => {
      const title = tag(raw, "title");
      const link = tag(raw, "link") || raw.match(/<link[^>]*href="([^"]+)"/i)?.[1] || null;
      if (!title || !link) return null;
      const pub = tag(raw, "pubDate");
      const d = pub ? new Date(pub) : null;
      let source = tag(raw, "source") ?? fallbackSource;
      try { source = source || new URL(link).hostname.replace(/^www\./, ""); } catch { /* keep */ }
      return {
        title,
        url: link,
        source,
        image: imageFrom(raw),
        publishedAt: d && !Number.isNaN(d.getTime()) ? d.toISOString() : null,
      } satisfies NewsItem;
    })
    .filter((x): x is NewsItem => x !== null);
}

export const fetchNews = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ items: NewsItem[]; error: string | null }> => {
    const results = await Promise.all(
      FEEDS.map(async (f) => {
        try {
          const res = await fetch(f.url, {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; SonaTalkGold/1.0)" },
          });
          if (!res.ok) return [] as NewsItem[];
          return parseRss(await res.text(), f.source);
        } catch {
          return [] as NewsItem[];
        }
      })
    );

    const seen = new Set<string>();
    const items = results
      .flat()
      .filter((n) => (seen.has(n.url) ? false : (seen.add(n.url), true)))
      .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
      .slice(0, 40);

    return { items, error: items.length ? null : "Couldn't load news right now" };
  }
);
