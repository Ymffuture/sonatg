import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { WeatherQuery } from "@/lib/weatherData";

/** Live weather JSON for the in-chat weather card (cached server-side for 1 hour). */
export const fetchWeatherCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: WeatherQuery): WeatherQuery => {
    const city = typeof d?.city === "string" ? d.city.trim().slice(0, 80) : undefined;
    const lat = typeof d?.lat === "number" && Math.abs(d.lat) <= 90 ? Math.round(d.lat * 100) / 100 : undefined;
    const lon = typeof d?.lon === "number" && Math.abs(d.lon) <= 180 ? Math.round(d.lon * 100) / 100 : undefined;
    if (!city && (lat === undefined || lon === undefined)) throw new Error("city or coordinates required");
    return city ? { city } : { lat, lon };
  })
  .handler(async ({ data }) => {
    const { getWeatherCardData } = await import("@/lib/weatherData");
    return getWeatherCardData(data);
  });
