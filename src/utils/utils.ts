import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  GraduationCap, Users, Briefcase, LifeBuoy, PartyPopper, Tag,
  Gamepad2, Heart, Music, Plane, Newspaper,
} from "lucide-react";
import {
  SONA_AI_ID,
  type ChatRow, type MessageRow, type Profile, type MessageReadRow,
  type ChatCategory, type ChatMemberRole,
} from "@/lib/db";

// ─── Shared types ────────────────────────────────────────────────
export type ChatWithMeta = ChatRow & {
  memberIds: string[];
  members: Profile[];
  memberRoles: Record<string, ChatMemberRole>;
  lastMessage?: MessageRow;
  unread: number;
  isPinned?: boolean;
};

export type ReadStatus = "sent" | "delivered" | "read";

// ─── Theme ───────────────────────────────────────────────────────
export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("sona-theme") : null;
    const t = stored === "dark" || stored === "light"
      ? stored
      : window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    setTheme(t as "light" | "dark");
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("sona-theme", theme);
  }, [theme]);
  return { theme, toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")) };
}

// ─── Emoji sets ──────────────────────────────────────────────────
export const EMOJIS = ["😀","😂","🥲","😍","😎","🤔","🙌","👍","🔥","🎉","❤️","✨","🥂","📷","🙏","😴"];
export const REACT_EMOJIS = ["❤️","😂","👍","🔥","😮","🙏", "😴"];

// ─── Chat display helpers ────────────────────────────────────────
export function chatTitle(c: ChatWithMeta, meId: string) {
  if (c.title && c.is_group) return c.title;
  const other = c.members.find((m) => m.id !== meId);
  if (other?.is_ai) return "Sona AI";
  return other?.display_name || c.title || "Account Deleted";
}

export function chatAvatarUrl(c: ChatWithMeta, meId: string) {
  if (c.is_group) return c.avatar_url ?? null;
  const other = c.members.find((m) => m.id !== meId);
  return other?.avatar_url ?? null;
}

export function isAIChat(c: ChatWithMeta) {
  return c.memberIds.includes(SONA_AI_ID);
}

// ─── Upload limits & file helpers ────────────────────────────────
export const MAX_IMAGES = 3;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB
export const MAX_DOCS = 2;
export const MAX_DOC_BYTES = 5 * 1024 * 1024; // 5MB
export const DOC_EXTENSIONS = [".pdf", ".docx", ".json", ".js", ".jsx", ".ts", ".tsx", ".java", ".py", ".c", ".cpp", ".go", ".rb", ".php", ".txt", ".md", ".css", ".html", ".sql", ".yaml", ".yml"];

/**
 * Downscales and re-compresses an image client-side before upload. A
 * photo straight from a phone camera is routinely 3000×4000px / 4-8MB —
 * nothing in the chat UI ever displays it larger than a few hundred
 * pixels, so uploading (and every recipient re-downloading) the original
 * is pure wasted time on both ends. Caps the longest edge at `maxDim` and
 * re-encodes as JPEG at `quality`. Falls back to the original file if
 * canvas encoding fails or the image is already smaller than the target
 * (no point re-compressing an already-small image).
 */
export async function compressImageForUpload(
  file: File,
  maxDim = 1600,
  quality = 0.82,
): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file; // don't touch GIFs (animation would break)

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    if (scale >= 1 && file.size <= MAX_IMAGE_BYTES) {
      bitmap.close();
      return file; // already small enough on both dimensions and size
    }

    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) { bitmap.close(); return file; }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) return file;

    // Only use the compressed version if it's actually smaller — a tiny
    // or already-compressed source image can occasionally re-encode
    // larger, in which case the original wins.
    if (blob.size >= file.size) return file;

    const newName = file.name.replace(/\.\w+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file; // any failure (unsupported format, etc.) — just send the original
  }
}

export function docExtOf(name: string) {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// Derives a display-friendly "username" handle from an email address,
// so raw addresses never need to be shown in the UI (e.g. "j.doe@x.com"
// becomes "@j.doe").
// Short, deterministic 6-character uppercase alphanumeric suffix derived
// from an email address — same email always produces the same suffix, so
// two people with the same display name still get distinct handles.
function emailSuffix(email: string): string {
  let h = 0;
  for (let i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) >>> 0;
  return h.toString(36).toUpperCase().padStart(6, "0").slice(-6);
}

// Derives a display-friendly "username" handle combining a person's display
// name with a short suffix from their email, so the raw email address never
// needs to be shown in the UI (e.g. "Jane Doe" + "jane@x.com" -> "JaneDoe_UD35H5").
export function usernameFromEmail(displayName?: string | null, email?: string | null): string {
  const namePart = (displayName || "user").replace(/\s+/g, "");
  if (!email) return namePart;
  return `${namePart.slice(-3)}_${emailSuffix(email)}`;
}

// "Sona" is reserved for the admin account and the built-in Sona AI system
// profile — everyone else who tries to set it gets a username derived from
// their email instead. Mirrors the server-side trigger in
// enforce_reserved_display_name() so the UI never shows a value the
// database is about to silently overwrite.
export function isReservedSonaName(name?: string | null): boolean {
  return !!name && name.trim().toLowerCase() === "sona";
}

export function fallbackNameFromEmail(email?: string | null): string {
  const local = (email ?? "").split("@")[0]?.trim();
  return local || "Friend";
}

// Downloads a file to the user's device, WhatsApp-style. Fetching as a blob
// (rather than a plain <a href download>) is necessary because the URL is a
// cross-origin Supabase Storage signed URL — browsers ignore the `download`
// attribute on cross-origin links, so a direct anchor click would just open
// the file in a new tab instead of saving it.
export async function downloadFile(url: string, filename: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  } catch (e) {
    toast.error("Couldn't download file");
    console.error("downloadFile failed", e);
  }
}

// URL-matching regexes for linkify() — kept here since they're pure data,
// even though linkify() itself (which returns JSX) lives in MessageBubble.tsx.
export const URL_REGEX = /(https?:\/\/[^\s]+)/g;
export const URL_REGEX_TEST = /^https?:\/\/[^\s]+$/;

// ─── Group categories ─────────────────────────────────────────────
export const categoryMeta: Record<ChatCategory, { emoji: string; label: string; icon: typeof GraduationCap }> = {
  general: { emoji: "💬", label: "General", icon: Users },
  education: { emoji: "📚", label: "Education", icon: GraduationCap },
  business: { emoji: "💼", label: "Business", icon: Briefcase },
  support: { emoji: "🛟", label: "Support", icon: LifeBuoy },
  social: { emoji: "🎉", label: "Social", icon: PartyPopper },
  gaming: { emoji: "🎮", label: "Gaming", icon: Gamepad2 },
  lifestyle: { emoji: "🌿", label: "Lifestyle", icon: Heart },
  entertainment: { emoji: "🎵", label: "Entertainment", icon: Music },
  travel: { emoji: "✈️", label: "Travel", icon: Plane },
  news: { emoji: "📰", label: "News", icon: Newspaper },
  other: { emoji: "📌", label: "Other", icon: Tag },
};

// ─── Error explanations ───────────────────────────────────────────
// Turns cryptic Postgres/PostgREST/Supabase error text into a plain-language
// explanation, so a failed action shows something actually actionable
// instead of a raw error string most people can't parse.
export function explainSupabaseError(err: unknown): { title: string; explanation: string; raw: string } {
  const raw = (err as { message?: string })?.message || String(err);
  const lower = raw.toLowerCase();

  if (lower.includes("column") && lower.includes("does not exist")) {
    return {
      title: "Database is missing a column",
      explanation:
        "The app expects a database column that isn't there yet. This usually means a migration file exists in the repo but hasn't actually been run against your Supabase project. Run `supabase db push`, or paste the migration's SQL into the Supabase SQL Editor and run it manually.",
      raw,
    };
  }
  if (lower.includes("row-level security") || lower.includes("row level security") || lower.includes("policy")) {
    return {
      title: "Blocked by a database permission rule",
      explanation:
        "Supabase's Row-Level Security rejected this action — the database doesn't think you're allowed to do this yet (for example, adding people to a chat before you're a confirmed member of it yourself). If you didn't just change any RLS policies, this is likely a bug in the app's request order rather than something wrong on your end.",
      raw,
    };
  }
  if (lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("network request failed")) {
    return {
      title: "Couldn't reach the database",
      explanation:
        "This looks like a network problem — check your internet connection, and make sure your Supabase project isn't paused (free-tier projects pause after inactivity and need a manual resume from the Supabase dashboard).",
      raw,
    };
  }
  if (lower.includes("jwt") || lower.includes("unauthorized") || lower.includes("401")) {
    return {
      title: "Your session may have expired",
      explanation: "Try signing out and back in — your login session may no longer be valid.",
      raw,
    };
  }
  return {
    title: "Something went wrong",
    explanation: "Here's the exact error from the database, which should help pinpoint the cause:",
    raw,
  };
}

// ─── Read receipts ─────────────────────────────────────────────────
export function readStatusFor(msg: MessageRow, reads: MessageReadRow[], memberIds: string[], meId: string): ReadStatus {
  if (msg.sender_id !== meId) return "sent";
  const others = memberIds.filter((id) => id !== meId);
  if (others.length === 0) return "sent";
  const readers = reads.filter((r) => r.message_id === msg.id && r.user_id !== meId);
  if (readers.length >= others.length) return "read";
  if (readers.length > 0) return "read";
  return "delivered";
}

// ─── Voice note waveform ─────────────────────────────────────────
// Deterministic pseudo-random bar heights seeded by the audio URL, so each
// voice note gets a distinct-but-stable waveform shape on every render
// (there's no real amplitude data to draw from without decoding the audio
// file — this is a visual approximation, same trick many chat-UI clones use).
export function waveformBars(seed: string, count = 32): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    bars.push(0.25 + (h % 1000) / 1000 * 0.75); // 0.25–1.0 range, never fully flat
  }
  return bars;
}


// (fmtLastSeen lives in @/lib/db — it's the one actually used app-wide,
// producing "Last seen today at 17:33" style labels.)
