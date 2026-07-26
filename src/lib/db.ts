export const SONA_AI_ID = "00000000-0000-0000-0000-00000000a1a1";

export type ChatCategory = "general" | "education" | "business" | "support" | "social" | "other";

export const CHAT_CATEGORIES: { value: ChatCategory; label: string; emoji: string }[] = [
  { value: "general", label: "General", emoji: "💬" },
  { value: "education", label: "Education", emoji: "📚" },
  { value: "business", label: "Business", emoji: "💼" },
  { value: "support", label: "Support", emoji: "🛟" },
  { value: "social", label: "Social", emoji: "🎉" },
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
  created_at?: string;
};

export type MessageRow = {
  id: string;
  chat_id: string;
  sender_id: string;
  kind: "text" | "image" | "voice" | "file";
  body: string | null;
  media_url: string | null;
  duration_ms: number | null;
  created_at: string;
  is_encrypted?: boolean;
  reply_to_id?: string | null;
  edited_at?: string | null;
  file_name?: string | null;
  file_size?: number | null;
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

// ─── Status updates (WhatsApp-style) ────────────────────────────
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
