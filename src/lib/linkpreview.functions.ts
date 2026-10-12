import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type LinkPreviewInput = { url: string };
export type LinkPreview = { url: string; title: string | null; description: string | null; image: string | null; siteName: string | null };

// Fetching a user-supplied URL server-side is a classic SSRF vector (pointing the server at
// internal services or cloud metadata). Defences here:
//  1. only http/https on ports 80/443
//  2. the hostname is RESOLVED and every address must be public (blocks 127.x, 10.x, 169.254.x,
//     IPv6 loopback/private/mapped addresses, and tricks like decimal/hex IPs or DNS names that
//     point at private IPs)
//  3. redirects are followed by hand (max 3) and every hop is re-checked — before, "redirect:
//     follow" let a public URL bounce the server to http://169.254.169.254/
// Remaining gap: DNS rebinding between our lookup and fetch's own lookup. If you ever need to
// close that too, fetch through a dedicated egress proxy.
// (node:dns / node:net are imported inside assertPublicUrl so they never reach the browser bundle)

function isPrivateIPv4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||      // carrier-grade NAT
    (a === 169 && b === 254) ||                // link-local / cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224                                   // multicast / reserved
  );
}

function isPrivateIPv6(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v === "::" || v === "::1") return true;
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  return v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9") ||
         v.startsWith("fea") || v.startsWith("feb") || v.startsWith("ff");
}

function isPrivateAddress(ip: string, isIP: (s: string) => number): boolean {
  const kind = isIP(ip);
  if (kind === 4) return isPrivateIPv4(ip);
  if (kind === 6) return isPrivateIPv6(ip);
  return true; // not an IP at all → refuse
}

async function assertPublicUrl(u: URL): Promise<void> {
  const [{ lookup }, { isIP }] = await Promise.all([import("node:dns/promises"), import("node:net")]);
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("Unsupported URL scheme");
  if (u.username || u.password) throw new Error("This URL can't be previewed");
  const port = u.port || (u.protocol === "https:" ? "443" : "80");
  if (port !== "80" && port !== "443") throw new Error("This URL can't be previewed");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (/^localhost$/i.test(host) || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("This URL can't be previewed");
  }
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address, isIP))) {
    throw new Error("This URL can't be previewed");
  }
}

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
    await assertPublicUrl(parsed);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      let res: Response | null = null;
      let current = parsed;
      for (let hop = 0; hop <= 3; hop++) {
        res = await fetch(current.toString(), {
          signal: controller.signal,
          redirect: "manual",
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SonaLinkPreview/1.0)" },
        });
        if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
          if (hop === 3) throw new Error("Too many redirects");
          current = new URL(res.headers.get("location")!, current);
          await assertPublicUrl(current); // re-check every hop
          continue;
        }
        break;
      }
      if (!res) throw new Error("Couldn't fetch link");
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
      if (image) {
        try {
          const abs = new URL(image, parsed.origin);
          image = abs.protocol === "http:" || abs.protocol === "https:" ? abs.toString() : null;
        } catch { image = null; }
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
