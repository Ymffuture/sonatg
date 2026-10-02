// src/lib/geo.ts
//
// Browser-only. Asks for the device location, but ONLY when a chat message is a
// weather question with no place named, so people aren't prompted for location
// on every message. Resolves to null (never rejects) if the browser has no
// geolocation, the user denies permission, or it takes too long.

import { needsLocationForWeather, sanitizeCoords, type Coords } from "@/lib/liveIntents";

export function getCoordsForPrompt(prompt: string, timeoutMs = 5000): Promise<Coords | null> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator))
    return Promise.resolve(null);
  if (!needsLocationForWeather(prompt)) return Promise.resolve(null);

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(sanitizeCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude })),
      () => resolve(null),
      // Low accuracy is fine for weather; reuse a position up to 10 minutes old.
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 10 * 60_000 },
    );
  });
}
