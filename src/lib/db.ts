export const SONA_AI_ID = "00000000-0000-0000-0000-00000000a1a1";

export type ChatCategory =
  | "general" | "education" | "business" | "support" | "social"
  | "gaming" | "lifestyle" | "entertainment" | "travel" | "news" | "other";

export const CHAT_CATEGORIES: { value: ChatCategory; label: string; emoji: string }[] = [
  { value: "general", label: "General", emoji: "💬" },
  { value: "education", label: "Education", emoji: "📚" },
  { value: "business", label: "Business", emoji: "💼" },
  { value: "support", label: "Support", emoji: "🛟" },
  { value: "social", label: "Social", emoji: "🎉" },
  { value: "gaming", label: "Gaming", emoji: "🎮" },
  { value: "lifestyle", label: "Lifestyle", emoji: "🌿" },
  { value: "entertainment", label: "Entertainment", emoji: "🎵" },
  { value: "travel", label: "Travel", emoji: "✈️" },
  { value: "news", label: "News", emoji: "📰" },
  { value: "other", label: "Other", emoji: "📌" },
];

export type Profile = {
  id: string;
  email: string | null;
  display_name: string;
  avatar_url: string | null;
  is_ai: boolean;
  is_pro?: boolean;
  bio?: string | null;
  last_seen?: string | null;
  created_at?: string;
};

export type MessageRow = {
  id: string;
  chat_id: string;
  sender_id: string;
  kind: "text" | "image" | "voice" | "file" | "call";
  body: string | null;
  media_url: string | null;
  duration_ms: number | null;
  transcript?: string | null;
  created_at: string;
  is_encrypted?: boolean;
  reply_to_id?: string | null;
  edited_at?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  expires_at?: string | null;
  scheduled_at?: string | null;
};


export type ChatRow = {
  id: string;
  is_group: boolean;
  title: string | null;
  created_by: string | null;
  last_message_at: string;
  is_hidden?: boolean;
  category?: ChatCategory | null;
  avatar_url?: string | null;
  disappearing_seconds?: number | null;
};

export type ChatMemberRole = "admin" | "member";

export type ReactionRow = {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
};

export type MessageReadRow = {
  message_id: string;
  user_id: string;
  read_at: string;
};

export type BlockRow = {
  blocker_id: string;
  blocked_id: string;
  created_at: string;
};

export type SubscriptionRow = {
  user_id: string;
  tier: "free" | "pro";
  current_period_end: string | null;
};

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// "today", "yesterday", or "on Jan 5" (a plain fragment, not a full sentence
// — callers prefix it, e.g. `Last seen ${fmtRelativeDay(iso)} at ${fmtTime(iso)}`).
export function fmtRelativeDay(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (isSameDay(d, now)) return "today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(d, yesterday)) return "yesterday";
  const sameYear = d.getFullYear() === now.getFullYear();
  return `on ${d.toLocaleDateString([], sameYear ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" })}`;
}

// "Last seen today at 17:34" / "Last seen yesterday at 17:34" / "Last seen on Jan 5 at 17:34"
export function fmtLastSeen(iso: string): string {
  return `Last seen ${fmtRelativeDay(iso)} at ${fmtTime(iso)}`;
}

// Floating date-pill label for grouping messages by day: "Today" / "Yesterday" / "January 5, 2026"
export function fmtDateLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (isSameDay(d, now)) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(d, yesterday)) return "Yesterday";
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString([], sameYear ? { month: "long", day: "numeric" } : { month: "long", day: "numeric", year: "numeric" });
}

// ─── Status updates (WhatsApp-style) ────────────────────────────
export type StatusPrivacy = "public" | "contacts" | "only_me";

export const STATUS_PRIVACY_OPTIONS: { value: StatusPrivacy; label: string; hint: string }[] = [
  { value: "public", label: "Public", hint: "Anyone on Sona can view" },
  { value: "contacts", label: "Contacts", hint: "Only people you chat with" },
  { value: "only_me", label: "Only me", hint: "Private to you" },
];

export type StatusRow = {
  id: string;
  user_id: string;
  kind: "text" | "image" | "video";
  body: string | null;
  media_url: string | null;
  media_path: string | null;
  media_provider: "supabase" | "cloudinary";
  media_public_id: string | null;
  duration_ms: number | null;
  background_color: string | null;
  privacy?: StatusPrivacy;
  created_at: string;
  expires_at: string;
};

export type StatusViewRow = {
  status_id: string;
  viewer_id: string;
  viewed_at: string;
};

export const STATUS_MAX_DURATION_MS = 60_000; // 60s max clip length
export const STATUS_MAX_BYTES_SUPABASE = 10 * 1024 * 1024; // 10MB via Supabase Storage
export const STATUS_MAX_BYTES_CLOUDINARY = 30 * 1024 * 1024; // 30MB via Cloudinary
export const STATUS_TEXT_BACKGROUNDS = ["#E07A5F", "#4FA6E0", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444"];
