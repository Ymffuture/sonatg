import { useEffect, useMemo, useState } from "react";
import { THEME_PRESETS, getThemePreset, defaultThemeIdForPlan, type ThemeId } from "@/lib/theme-presets";

const STORAGE_KEY = "sona-chat-theme";

/**
 * Resolves the active chat accent theme for the current plan and exposes
 * it both as a preset object and as a ready-to-spread CSS custom
 * property style object, so any component can do:
 *
 *   const { style } = useSonaTheme(me.is_pro);
 *   <div style={style}> ... var(--sona-accent) ... </div>
 *
 * Free accounts are silently clamped to a free preset even if a pro
 * theme id is sitting in localStorage (e.g. after a downgrade).
 */
export function useSonaTheme(isPro: boolean) {
  const [themeId, setThemeIdState] = useState<ThemeId>(() => {
    if (typeof window === "undefined") return defaultThemeIdForPlan(isPro);
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
    return saved ?? defaultThemeIdForPlan(isPro);
  });

  const preset = useMemo(() => {
    const p = getThemePreset(themeId);
    // Downgraded / never-was-pro accounts can't stay on a pro preset.
    if (p.pro && !isPro) return getThemePreset(defaultThemeIdForPlan(false));
    return p;
  }, [themeId, isPro]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, preset.id);
  }, [preset.id]);

  const setThemeId = (id: ThemeId) => {
    const target = getThemePreset(id);
    if (target.pro && !isPro) return; // ignore attempts to select a locked theme
    setThemeIdState(id);
  };

  const style = {
    "--sona-accent": preset.accent,
    "--sona-accent-soft": `color-mix(in srgb, ${preset.accent} 14%, transparent)`,
    "--sona-accent-soft-strong": `color-mix(in srgb, ${preset.accent} 24%, transparent)`,
    "--sona-bubble-mine": preset.bg,
  } as React.CSSProperties;

  return { theme: preset, themeId: preset.id, setThemeId, style, presets: THEME_PRESETS };
}
