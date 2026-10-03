// Structured weather (JSON) for the in-chat weather card.
// OpenWeather first (OPENWEATHER_API_KEY), Open-Meteo as a free fallback.
// Results are cached per location for 1 hour, so the card shows data that
// refreshes every hour without spending API calls on every view.
// Server-only: call from createServerFn handlers.

export type WeatherDay = { date: string; min: number; max: number; pop: number; desc: string; icon: string };
export type WeatherCardData = {
  place: string;
  provider: "OpenWeather" | "Open-Meteo";
  providerUrl: string;
  updatedAt: string;
  current: { temp: number; feels: number; humidity: number; wind: number; desc: string; icon: string };
  hourly: Array<{ time: string; temp: number; icon: string; pop: number }>;
  daily: WeatherDay[];
};
export type WeatherQuery = { city?: string; lat?: number; lon?: number };

const TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { at: number; data: WeatherCardData }>();
const r1 = (n: number) => Math.round(n);

async function j<T>(url: string): Promise<T> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 5000);
  try {
    const res = await fetch(url, { signal: c.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

// Emoji icons keep the card dependency-free and readable in any theme.
function owIcon(code?: string): string {
  const k = (code ?? "").slice(0, 2);
  const night = code?.endsWith("n");
  return ({ "01": night ? "🌙" : "☀️", "02": "⛅", "03": "☁️", "04": "☁️", "09": "🌧️", "10": "🌦️", "11": "⛈️", "13": "❄️", "50": "🌫️" } as Record<string, string>)[k] ?? "🌡️";
}
function wmoInfo(code: number): [string, string] {
  if (code === 0) return ["Clear sky", "☀️"];
  if (code <= 2) return ["Partly cloudy", "⛅"];
  if (code === 3) return ["Overcast", "☁️"];
  if (code <= 48) return ["Fog", "🌫️"];
  if (code <= 57) return ["Drizzle", "🌦️"];
  if (code <= 67) return ["Rain", "🌧️"];
  if (code <= 77) return ["Snow", "❄️"];
  if (code <= 82) return ["Rain showers", "🌦️"];
  if (code <= 86) return ["Snow showers", "❄️"];
  return ["Thunderstorms", "⛈️"];
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

async function fromOpenWeather(lat: number, lon: number, place: string, key: string): Promise<WeatherCardData> {
  const q = `lat=${lat}&lon=${lon}&units=metric&appid=${encodeURIComponent(key)}`;
  type Cur = { name?: string; sys?: { country?: string }; weather: Array<{ description: string; icon: string }>; main: { temp: number; feels_like: number; humidity: number }; wind: { speed: number } };
  type Fc = { list: Array<{ dt: number; dt_txt: string; main: { temp: number; temp_min: number; temp_max: number }; pop?: number; weather: Array<{ description: string; icon: string }> }>; city?: { timezone?: number } };
  const [cur, fc] = await Promise.all([j<Cur>(`https://api.openweathermap.org/data/2.5/weather?${q}`), j<Fc>(`https://api.openweathermap.org/data/2.5/forecast?${q}`)]);
  const days = new Map<string, WeatherDay>();
  for (const e of fc.list) {
    const date = e.dt_txt.slice(0, 10);
    const d = days.get(date) ?? { date, min: Infinity, max: -Infinity, pop: 0, desc: cap(e.weather[0]?.description ?? ""), icon: owIcon(e.weather[0]?.icon) };
    d.min = Math.min(d.min, r1(e.main.temp_min));
    d.max = Math.max(d.max, r1(e.main.temp_max));
    d.pop = Math.max(d.pop, Math.round((e.pop ?? 0) * 100));
    if (e.dt_txt.includes("12:00")) { d.desc = cap(e.weather[0]?.description ?? d.desc); d.icon = owIcon(e.weather[0]?.icon); }
    days.set(date, d);
  }
  return {
    place: place || [cur.name, cur.sys?.country].filter(Boolean).join(", ") || "Your location",
    provider: "OpenWeather",
    providerUrl: "https://openweathermap.org",
    updatedAt: new Date().toISOString(),
    current: { temp: r1(cur.main.temp), feels: r1(cur.main.feels_like), humidity: cur.main.humidity, wind: r1(cur.wind.speed * 3.6), desc: cap(cur.weather[0]?.description ?? ""), icon: owIcon(cur.weather[0]?.icon) },
    hourly: fc.list.slice(0, 8).map((e) => ({ time: new Date(e.dt * 1000).toISOString(), temp: r1(e.main.temp), icon: owIcon(e.weather[0]?.icon), pop: Math.round((e.pop ?? 0) * 100) })),
    daily: [...days.values()].slice(0, 7),
  };
}

async function fromOpenMeteo(lat: number, lon: number, place: string): Promise<WeatherCardData> {
  type F = {
    current: { temperature_2m: number; apparent_temperature: number; relative_humidity_2m: number; wind_speed_10m: number; weather_code: number };
    hourly: { time: string[]; temperature_2m: number[]; weather_code: number[]; precipitation_probability: number[] };
    daily: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max: number[] };
  };
  const f = await j<F>(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code` +
      `&hourly=temperature_2m,weather_code,precipitation_probability&forecast_hours=24` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=7&timezone=GMT`,
  );
  const [desc, icon] = wmoInfo(f.current.weather_code);
  return {
    place: place || "Your location",
    provider: "Open-Meteo",
    providerUrl: "https://open-meteo.com",
    updatedAt: new Date().toISOString(),
    current: { temp: r1(f.current.temperature_2m), feels: r1(f.current.apparent_temperature), humidity: f.current.relative_humidity_2m, wind: r1(f.current.wind_speed_10m), desc, icon },
    hourly: f.hourly.time.filter((_, i) => i % 3 === 0).slice(0, 8).map((t) => {
      const i = f.hourly.time.indexOf(t);
      return { time: t + ":00Z", temp: r1(f.hourly.temperature_2m[i]), icon: wmoInfo(f.hourly.weather_code[i])[1], pop: f.hourly.precipitation_probability[i] ?? 0 };
    }),
    daily: f.daily.time.map((date, i) => {
      const [d, ic] = wmoInfo(f.daily.weather_code[i]);
      return { date, min: r1(f.daily.temperature_2m_min[i]), max: r1(f.daily.temperature_2m_max[i]), pop: f.daily.precipitation_probability_max[i] ?? 0, desc: d, icon: ic };
    }),
  };
}

async function geocode(city: string, key?: string): Promise<{ lat: number; lon: number; place: string } | null> {
  if (key) {
    try {
      const g = await j<Array<{ name: string; state?: string; country?: string; lat: number; lon: number }>>(
        `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${encodeURIComponent(key)}`,
      );
      if (g[0]) return { lat: g[0].lat, lon: g[0].lon, place: [g[0].name, g[0].state, g[0].country].filter(Boolean).join(", ") };
    } catch { /* fall back */ }
  }
  const g = await j<{ results?: Array<{ name: string; admin1?: string; country?: string; latitude: number; longitude: number }> }>(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`,
  );
  const p = g.results?.[0];
  return p ? { lat: p.latitude, lon: p.longitude, place: [p.name, p.admin1, p.country].filter(Boolean).join(", ") } : null;
}

export async function getWeatherCardData(q: WeatherQuery): Promise<WeatherCardData | null> {
  const key = process.env.OPENWEATHER_API_KEY?.trim() || undefined;
  const cacheKey = q.city ? `c:${q.city.toLowerCase().trim()}` : `p:${q.lat?.toFixed(2)},${q.lon?.toFixed(2)}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;

  let loc: { lat: number; lon: number; place: string } | null;
  if (q.city) loc = await geocode(q.city, key);
  else if (typeof q.lat === "number" && typeof q.lon === "number") loc = { lat: q.lat, lon: q.lon, place: "" };
  else return null;
  if (!loc) return null;

  let data: WeatherCardData;
  try {
    if (!key) throw new Error("no key");
    data = await fromOpenWeather(loc.lat, loc.lon, loc.place, key);
  } catch {
    data = await fromOpenMeteo(loc.lat, loc.lon, loc.place);
  }
  cache.set(cacheKey, { at: Date.now(), data });
  if (cache.size > 200) cache.delete(cache.keys().next().value!);
  return data;
}
