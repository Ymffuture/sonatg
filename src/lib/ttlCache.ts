// src/lib/ttlCache.ts
//
// Tiny in-memory TTL cache with in-flight de-duplication, used to stop Sona AI
// from hitting OpenWeather / SerpApi / news on every single message.
//
// Scope: per server instance (module state). On Vercel that means a warm
// function instance shares hits across users, and a cold start simply starts
// empty — so it only ever saves calls, it can never serve wrong data for long.
// For a cache shared across all instances, swap `store` for Upstash/Vercel KV.

type Entry = { value: unknown; expires: number };

const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
const MAX_ENTRIES = 500;

function evict(now: number) {
  if (store.size < MAX_ENTRIES) return;
  for (const [k, e] of store) if (e.expires <= now) store.delete(k);
  // Still full: drop the oldest insertions (Map keeps insertion order).
  while (store.size >= MAX_ENTRIES) {
    const first = store.keys().next().value;
    if (first === undefined) break;
    store.delete(first);
  }
}

/**
 * Returns the cached value for `key`, or runs `load` once (concurrent callers
 * share the same promise). `ttlMs` may be a function of the result so that
 * failures (null) are only cached briefly.
 */
export async function cached<T>(
  key: string,
  ttlMs: number | ((value: T) => number),
  load: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expires > now) return hit.value as T;

  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const p = (async () => {
    try {
      const value = await load();
      const ttl = typeof ttlMs === "function" ? ttlMs(value) : ttlMs;
      if (ttl > 0) {
        evict(Date.now());
        store.set(key, { value, expires: Date.now() + ttl });
      }
      return value;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}
