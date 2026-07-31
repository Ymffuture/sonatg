import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type LinkPreviewInput = { url: string };
export type LinkPreview = { url: string; title: string | null; description: string | null; image: string | null; siteName: string | null };

// Fetching an arbitrary user-supplied URL server-side is a classic SSRF
// vector (someone could point it at an internal service, cloud metadata
// endpoint, etc). This does best-effort hardening: only http(s), only GET,
// a short timeout, a capped response size, and blocking obviously-private
// hostnames. It is NOT a complete SSRF defense (e.g. it doesn't resolve
// DNS to check the actual IP a hostname points to) — for a public-facing
// app handling untrusted links at scale, route this through a dedicated
// proxy/allowlist service instead.
const BLOCKED_HOSTS = /^(localhost|127\.|0\.0\.0\.0|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|\[::1\]|::1$)/i;

function extractMeta(html: string, prop: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${prop}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${prop}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${prop}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

export const fetchLinkPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: LinkPreviewInput) => {
    if (!data?.url) throw new Error("url required");
    return { url: String(data.url).slice(0, 2000) };
  })
  .handler(async ({ data }): Promise<LinkPreview> => {
    let parsed: URL;
    try {
      parsed = new URL(data.url);
    } catch {
      throw new Error("Invalid URL");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("Unsupported URL scheme");
    if (BLOCKED_HOSTS.test(parsed.hostname)) throw new Error("This URL can't be previewed");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(parsed.toString(), {
        signal: controller.signal,
        redirect: "follow",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; SonaLinkPreview/1.0)" },
      });
      if (!res.ok) throw new Error(`Couldn't fetch link [${res.status}]`);

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("text/html")) {
        return { url: parsed.toString(), title: parsed.hostname, description: null, image: null, siteName: parsed.hostname };
      }

      // Cap how much we read — OG tags are always in <head>, no need to
      // download an entire multi-MB page.
      const reader = res.body?.getReader();
      let html = "";
      if (reader) {
        const decoder = new TextDecoder();
        let bytes = 0;
        while (bytes < 200_000) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.length;
          html += decoder.decode(value, { stream: true });
          if (html.includes("</head>")) break;
        }
        reader.cancel().catch(() => {});
      } else {
        html = await res.text();
      }

      const title = extractMeta(html, "og:title") || html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || null;
      const description = extractMeta(html, "og:description") || extractMeta(html, "description");
      let image = extractMeta(html, "og:image");
      if (image && !image.startsWith("http")) {
        image = new URL(image, parsed.origin).toString();
      }
      const siteName = extractMeta(html, "og:site_name") || parsed.hostname;

      return { url: parsed.toString(), title: title?.trim() ?? null, description: description?.trim() ?? null, image, siteName };
    } catch (err) {
      if ((err as Error).name === "AbortError") throw new Error("Link preview timed out");
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  });
