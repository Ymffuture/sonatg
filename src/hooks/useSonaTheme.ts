import { useEffect, useMemo, useState } from "react";
import { THEME_PRESETS, getThemePreset, defaultThemeIdForPlan, readableOn, type ThemeId } from "@/lib/theme-presets";

const STORAGE_KEY = "sona-chat-theme";

function isThemeId(v: string | null | undefined): v is ThemeId {
  return !!v && THEME_PRESETS.some((t) => t.id === v);
}

/**
 * Resolves the active chat accent theme for the current plan and exposes
 * it both as a preset object and as a ready-to-spread CSS custom
 * property style object, so any component can do:
 *
 *   const { style } = useSonaTheme(me.is_pro, me.theme_id, saveThemeId);
 *   <div style={style}> ... var(--sona-accent) ... </div>
 *
 * `profileThemeId` (from profiles.theme_id) is the source of truth once
 * it loads — localStorage is only used for the instant first paint
 * before that arrives, and as an offline fallback. `onPersist` is called
 * whenever the person picks a new theme, so callers can write it back to
 * Supabase and have it follow them across devices.
 *
 * Free accounts are silently clamped to a free preset even if a pro
 * theme id is stored (e.g. after a downgrade).
 */
export function useSonaTheme(
  isPro: boolean,
  profileThemeId?: string | null,
  onPersist?: (id: ThemeId) => void
) {
  const [themeId, setThemeIdState] = useState<ThemeId>(() => {
    if (typeof window === "undefined") return defaultThemeIdForPlan(isPro);
    const saved = localStorage.getItem(STORAGE_KEY);
    return isThemeId(saved) ? saved : defaultThemeIdForPlan(isPro);
  });

  // Once the profile's saved theme arrives from Supabase, it wins over
  // whatever was cached locally (e.g. this is a new device/browser).
  useEffect(() => {
    if (isThemeId(profileThemeId)) setThemeIdState(profileThemeId);
  }, [profileThemeId]);

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
    onPersist?.(id);
  };

  // Contrast-aware foregrounds so text stays readable on whichever
  // accent/bubble color the active preset uses.
  const bubbleDarkText = readableOn(preset.bg) === "dark";
  const accentDarkText = readableOn(preset.accent) === "dark";

  const style = {
    "--sona-accent": preset.accent,
    "--sona-accent-soft": `color-mix(in srgb, ${preset.accent} 14%, transparent)`,
    "--sona-accent-soft-strong": `color-mix(in srgb, ${preset.accent} 24%, transparent)`,
    "--sona-bubble-mine": preset.bg,
    "--sona-bubble-mine-fg": bubbleDarkText ? "#1A1A1A" : "#FFFCF4",
    "--sona-bubble-mine-muted": bubbleDarkText
      ? "color-mix(in srgb, #1A1A1A 62%, transparent)"
      : "color-mix(in srgb, #FFFCF4 70%, transparent)",
    "--sona-on-accent": accentDarkText ? "#1A1A1A" : "#FFFCF4",
  } as React.CSSProperties;

  return { theme: preset, themeId: preset.id, setThemeId, style, presets: THEME_PRESETS };
}
