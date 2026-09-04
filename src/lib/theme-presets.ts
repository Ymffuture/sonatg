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
  { 
    id: "classic-orange", 
    name: "Warm Orange", 
    accent: "#E07A5F", 
    bg: "#FFFDF9", 
    pro: false,
    // Added accessibility & UI tokens
    textPrimary: "#2D3748",
    textSecondary: "#718096",
    border: "#E2E8F0",
    userBubble: "#E07A5F",
    userBubbleText: "#FFFFFF",
    aiBubble: "#F7FAFC",
    aiBubbleText: "#2D3748",
    inputBg: "#FFFFFF",
    hover: "#F0F4F8",
    sidebar: "#FFFDF9",
    sidebarText: "#4A5568",
    sidebarHover: "#F7FAFC",
    sidebarActive: "#F0F4F8"
  },
  { 
    id: "classic-purple", 
    name: "Royal Purple", 
    accent: "#8B5CF6", 
    bg: "#FFFCF4", 
    pro: true,
    textPrimary: "#1A202C",
    textSecondary: "#4A5568",
    border: "#E2E8F0",
    userBubble: "#8B5CF6",
    userBubbleText: "#FFFFFF",
    aiBubble: "#F7F7F5",
    aiBubbleText: "#1A202C",
    inputBg: "#FFFFFF",
    hover: "#F3F0FF",
    sidebar: "#FFFCF4",
    sidebarText: "#553C9A",
    sidebarHover: "#F3F0FF",
    sidebarActive: "#EBE4FF"
  },

  // Selectable combos — A & B free, C–F pro.
  { 
    id: "A", 
    name: "Sunset", 
    accent: "#FF6115", 
    bg: "#FFFCF4", 
    pro: false,
    textPrimary: "#2D1B0E",
    textSecondary: "#7B6B5D",
    border: "#F3E5D8",
    userBubble: "#FF6115",
    userBubbleText: "#FFFFFF",
    aiBubble: "#FFF5EB",
    aiBubbleText: "#2D1B0E",
    inputBg: "#FFFFFF",
    hover: "#FFF0E6",
    sidebar: "#FFF8F0",
    sidebarText: "#9A4B1A",
    sidebarHover: "#FFE8D6",
    sidebarActive: "#FFD9BC"
  },
  { 
    id: "B", 
    name: "Moss", 
    accent: "#B7FF72", 
    bg: "#18251D", 
    pro: false,
    textPrimary: "#E8F5E9",
    textSecondary: "#A5B8A8",
    border: "#2E3D33",
    userBubble: "#B7FF72",
    userBubbleText: "#1A2E1A",
    aiBubble: "#243429",
    aiBubbleText: "#E8F5E9",
    inputBg: "#1E2F24",
    hover: "#2A3D30",
    sidebar: "#152118",
    sidebarText: "#B7FF72",
    sidebarHover: "#1E2F24",
    sidebarActive: "#243429"
  },
  { 
    id: "C", 
    name: "Violet", 
    accent: "#7A35FF", 
    bg: "#F0F2F5", 
    pro: true,
    textPrimary: "#1A1A2E",
    textSecondary: "#5A5A7A",
    border: "#D1D5DB",
    userBubble: "#7A35FF",
    userBubbleText: "#FFFFFF",
    aiBubble: "#FFFFFF",
    aiBubbleText: "#1A1A2E",
    inputBg: "#FFFFFF",
    hover: "#EDE9FE",
    sidebar: "#F8F7FF",
    sidebarText: "#6B21A8",
    sidebarHover: "#EDE9FE",
    sidebarActive: "#DDD6FE"
  },
  { 
    id: "D", 
    name: "Aurora", 
    accent: "#39FF88", 
    bg: "#0B132B", 
    pro: true,
    textPrimary: "#E6FFF0",
    textSecondary: "#A0B8AA",
    border: "#1F2A3D",
    userBubble: "#39FF88",
    userBubbleText: "#0B1F14",
    aiBubble: "#1A2333",
    aiBubbleText: "#E6FFF0",
    inputBg: "#111C35",
    hover: "#1A2B45",
    sidebar: "#080F1F",
    sidebarText: "#39FF88",
    sidebarHover: "#111C35",
    sidebarActive: "#1A2333"
  },
  { 
    id: "E", 
    name: "Nebula", 
    accent: "#FFB7A5", 
    bg: "#1A0B2E", 
    pro: true,
    textPrimary: "#F5E6FF",
    textSecondary: "#C4A8D4",
    border: "#2D1B42",
    userBubble: "#FFB7A5",
    userBubbleText: "#3D1B2E",
    aiBubble: "#261638",
    aiBubbleText: "#F5E6FF",
    inputBg: "#201238",
    hover: "#2A1B42",
    sidebar: "#150826",
    sidebarText: "#FFB7A5",
    sidebarHover: "#201238",
    sidebarActive: "#261638"
  },
  { 
    id: "F", 
    name: "Amber", 
    accent: "#FFF1A6", 
    bg: "#6B352A", 
    pro: true,
    textPrimary: "#FFF9E6",
    textSecondary: "#D4B8A0",
    border: "#8B4A3A",
    userBubble: "#FFF1A6",
    userBubbleText: "#4A2A1A",
    aiBubble: "#7B4535",
    aiBubbleText: "#FFF9E6",
    inputBg: "#5E2D24",
    hover: "#7B4535",
    sidebar: "#5E2820",
    sidebarText: "#FFF1A6",
    sidebarHover: "#6B352A",
    sidebarActive: "#7B4535"
  },
];

export function getThemePreset(id: ThemeId): ThemePreset {
  return THEME_PRESETS.find((t) => t.id === id) ?? THEME_PRESETS[0];
}

export function defaultThemeIdForPlan(isPro: boolean): ThemeId {
  return isPro ? "classic-purple" : "classic-orange";
}

/**
 * Picks a readable foreground (near-black or near-white) for an arbitrary
 * hex background using relative luminance, so themed surfaces such as the
 * sent-message bubble stay legible whichever preset is active.
 */
export function readableOn(hex: string): "light" | "dark" {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.45 ? "dark" : "light"; // "dark" = use dark text on this bg
}
