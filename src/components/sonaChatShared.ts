import type { TourStep } from "@/components/OnboardingTour";

// Call-log messages store their metadata as JSON in the file_name column
// (body stays null so MessagePreview's switch renders it, rather than the
// raw JSON, when there's no body text).
export type CallLogMeta = { kind: "voice" | "video"; outcome: "answered" | "missed" | "declined"; durationMs: number };

export function parseCallBody(raw: string | null): CallLogMeta {
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && (parsed.kind === "voice" || parsed.kind === "video")) {
      return {
        kind: parsed.kind,
        outcome: parsed.outcome === "missed" || parsed.outcome === "declined" ? parsed.outcome : "answered",
        durationMs: typeof parsed.durationMs === "number" ? parsed.durationMs : 0,
      };
    }
  } catch { /* fall through to default */ }
  return { kind: "voice", outcome: "answered", durationMs: 0 };
}

export const ONBOARDING_STEPS: TourStep[] = [
  {
    targetSelector: '[data-tour="new-chat-fab"]',
    title: "Start a conversation",
    description: "Tap here to message someone new or create a group.",
    placement: "top",
  },
  {
    targetSelector: '[data-tour="search-chats"]',
    title: "Find anything fast",
    description: "Search your chats here, or search inside any open chat from its menu.",
    placement: "bottom",
  },
  {
    targetSelector: '[data-tour="folder-tabs"]',
    title: "Stay organized",
    description: "Filter your chat list by Unread, Groups, or Pinned to cut through the noise.",
    placement: "bottom",
  },
  {
    targetSelector: '[data-tour="status-bar"]',
    title: "Share a status",
    description: "Post a photo, video, or text update that disappears after 24 hours — just like a story.",
    placement: "bottom",
  },
  {
    targetSelector: '[data-tour="settings-btn"]',
    title: "Make it yours",
    description: "Open this menu to set your profile photo and bio, manage subscriptions, switch themes, and more.",
    placement: "left",
  },
];

export const DISAPPEARING_OPTIONS: { label: string; seconds: number | null }[] = [
  { label: "Off", seconds: null },
  { label: "24 hours", seconds: 24 * 60 * 60 },
  { label: "7 days", seconds: 7 * 24 * 60 * 60 },
  { label: "90 days", seconds: 90 * 24 * 60 * 60 },
];

export function disappearingLabel(seconds?: number | null) {
  return DISAPPEARING_OPTIONS.find((o) => o.seconds === (seconds ?? null))?.label ?? "Off";
}

export function fmtDuration(ms?: number | null) {
  const totalSec = Math.max(0, Math.round((ms ?? 0) / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function fmtChatTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t = d.getTime();
  if (t >= startOfToday) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  if (t >= startOfToday - 86_400_000) return "Yesterday";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd}`;
}
