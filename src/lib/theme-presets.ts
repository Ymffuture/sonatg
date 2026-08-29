// Chat theme presets. Each preset drives a handful of CSS custom
// properties (see useSonaTheme.ts) that SonaChat.tsx and MessageBubble.tsx
// read instead of hardcoding an accent/background color, so switching
// themes re-skins pins, selection highlights, and the sent-message
// bubble without touching component code.
//
// Free plan can only pick the two "classic" presets plus A and B.
// Everything else (C–F) is pro-only.

export type ThemeId =
  | "classic-orange"
  | "classic-purple"
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F";

export interface ThemePreset {
  id: ThemeId;
  name: string;
  /** Primary accent — pins, selection rings, links, sent-bubble tint source */
  accent: string;
  /** Soft background paired with the accent (used for bubbles/highlights) */
  bg: string;
  pro: boolean;
}

export const THEME_PRESETS: ThemePreset[] = [
  // Defaults — what a fresh free/pro account starts on.
  { id: "classic-orange", name: "Warm Orange", accent: "#E07A5F", bg: "#FFFDF9", pro: false },
  { id: "classic-purple", name: "Royal Purple", accent: "#8B5CF6", bg: "#FFFCF4", pro: true },

  // Selectable combos — A & B free, C–F pro.
  { id: "A", name: "Sunset", accent: "#FF6115", bg: "#FFFCF4", pro: false },
  { id: "B", name: "Moss", accent: "#B7FF72", bg: "#18251D", pro: false },
  { id: "C", name: "Violet", accent: "#7A35FF", bg: "#F0F2F5", pro: true },
  { id: "D", name: "Aurora", accent: "#39FF88", bg: "#0B132B", pro: true },
  { id: "E", name: "Nebula", accent: "#FFB7A5", bg: "#1A0B2E", pro: true },
  { id: "F", name: "Amber", accent: "#FFF1A6", bg: "#6B352A", pro: true },
];

export function getThemePreset(id: ThemeId): ThemePreset {
  return THEME_PRESETS.find((t) => t.id === id) ?? THEME_PRESETS[0];
}

export function defaultThemeIdForPlan(isPro: boolean): ThemeId {
  return isPro ? "classic-purple" : "classic-orange";
}

/** Lighten/darken isn't needed — callers just use accent + bg + derived alpha via CSS color-mix. */
