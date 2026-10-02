// src/lib/liveIntents.ts
//
// Pure, isomorphic helpers (no fetch, no env vars) that decide what a chat
// message is asking for. Shared by the server (liveContext.ts) and the browser
// (geo.ts), so both sides agree on when a weather question needs a location.

const WEATHER_RE =
  /\b(weather|forecast|temperature|rain(ing)?|raining|humid(ity)?|how (hot|cold)|will it (rain|snow))\b/i;
const CALENDAR_RE =
  /\b(calendar|what day|which day|day of the week|this month|next month|schedule|how many days)\b/i;
const WEB_RE =
  /\b(latest|news|headlines?|current(ly)?|right now|recent(ly)?|breaking|who won|score|price of|update on|what is|who is|define)\b/i;
const CITY_RE =
  /\b(?:weather|forecast|temperature|rain(?:ing)?)\b[^.?!]*?\b(?:in|for|at|of)\s+([A-Za-z][A-Za-z .'-]{1,40}?)(?=\s+(?:today|tomorrow|tonight|now|right|this|please)\b|[?.!,]|$)/i;

export function detectIntents(prompt: string) {
  return {
    weather: WEATHER_RE.test(prompt),
    calendar: CALENDAR_RE.test(prompt),
    web: WEB_RE.test(prompt),
    city: prompt.match(CITY_RE)?.[1]?.trim() ?? null,
  };
}

/** True when the message asks about weather but names no place. */
export function needsLocationForWeather(prompt: string): boolean {
  const i = detectIntents(prompt);
  return i.weather && !i.city;
}

export type Coords = { lat: number; lon: number };

/**
 * Validates untrusted coordinates and rounds them to 2 decimals (~1 km), which
 * is plenty for weather and avoids sending or storing a precise position.
 */
export function sanitizeCoords(input: unknown): Coords | null {
  if (!input || typeof input !== "object") return null;
  const { lat, lon } = input as { lat?: unknown; lon?: unknown };
  const la = typeof lat === "number" ? lat : NaN;
  const lo = typeof lon === "number" ? lon : NaN;
  if (!Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180)
    return null;
  return { lat: Math.round(la * 100) / 100, lon: Math.round(lo * 100) / 100 };
}
