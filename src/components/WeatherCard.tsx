// Meta-AI-style weather card shown under Sona's weather replies.
// Pulls live JSON (OpenWeather, fallback Open-Meteo) and refreshes every hour.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Droplets, Wind, RefreshCw, ExternalLink } from "lucide-react";
import { fetchWeatherCard } from "@/lib/weather.functions";
import type { WeatherQuery } from "@/lib/weatherData";

const HOUR = 60 * 60 * 1000;

export function WeatherCard({ query }: { query: WeatherQuery }) {
  const fetchFn = useServerFn(fetchWeatherCard);
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["weather-card", query.city ?? `${query.lat},${query.lon}`],
    queryFn: () => fetchFn({ data: query }),
    staleTime: HOUR,
    refetchInterval: HOUR,
    refetchOnWindowFocus: false,
  });

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  if (isLoading) return <div className="mt-2 mb-2 mr-12 h-40 animate-pulse rounded-2xl bg-muted" />;
  if (isError || !data) return null;

  const updated = new Date(data.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div
      onClick={stop}
      onPointerDown={stop}
      onTouchStart={stop}
      onContextMenu={stop}
      className="mt-2 mb-2 mr-2 overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm"
    >
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{data.place}</p>
          <p className="text-xs text-muted-foreground">{data.current.desc}</p>
          <p className="mt-1 text-4xl font-bold leading-none">{data.current.temp}°</p>
          <p className="mt-1 text-xs text-muted-foreground">Feels like {data.current.feels}°</p>
        </div>
        <div className="text-right">
          <div className="text-5xl leading-none" aria-hidden>{data.current.icon}</div>
          <div className="mt-2 flex items-center justify-end gap-1 text-xs text-muted-foreground"><Droplets className="h-3.5 w-3.5" />{data.current.humidity}%</div>
          <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground"><Wind className="h-3.5 w-3.5" />{data.current.wind} km/h</div>
        </div>
      </div>

      {data.hourly.length > 0 && (
        <div className="flex gap-3 overflow-x-auto border-t border-border px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" data-vaul-no-drag>
          {data.hourly.map((h) => (
            <div key={h.time} className="flex min-w-[3rem] flex-col items-center gap-0.5 text-xs">
              <span className="text-muted-foreground">{new Date(h.time).toLocaleTimeString([], { hour: "2-digit" })}</span>
              <span className="text-lg" aria-hidden>{h.icon}</span>
              <span className="font-semibold">{h.temp}°</span>
            </div>
          ))}
        </div>
      )}

      <ul className="divide-y divide-border border-t border-border">
        {data.daily.map((d, i) => (
          <li key={d.date} className="flex items-center gap-3 px-4 py-2 text-sm">
            <span className="w-12 shrink-0 font-medium">
              {i === 0 ? "Today" : new Date(d.date + "T12:00:00Z").toLocaleDateString([], { weekday: "short", timeZone: "UTC" })}
            </span>
            <span className="text-lg" aria-hidden>{d.icon}</span>
            <span className="flex-1 truncate text-xs text-muted-foreground">{d.desc}{d.pop > 0 ? ` · ${d.pop}%` : ""}</span>
            <span className="shrink-0 tabular-nums"><span className="font-semibold">{d.max}°</span> <span className="text-muted-foreground">{d.min}°</span></span>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
        <a href={data.providerUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
          {data.provider} <ExternalLink className="h-3 w-3" />
        </a>
        <button type="button" onClick={() => refetch()} className="inline-flex items-center gap-1 hover:text-foreground" aria-label="Refresh weather">
          Updated {updated} · refreshes hourly <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>
    </div>
  );
}
