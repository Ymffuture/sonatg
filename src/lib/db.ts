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
};

export type MessageRow = {
  id: string;
  chat_id: string;
  sender_id: string;
  kind: "text" | "image" | "voice";
  body: string | null;
  media_url: string | null;
  duration_ms: number | null;
  created_at: string;
  is_encrypted?: boolean;
  reply_to_id?: string | null;
  edited_at?: string | null;
};


export type ChatRow = {
  id: string;
  is_group: boolean;
  title: string | null;
  created_by: string | null;
  last_message_at: string;
  is_hidden?: boolean;
  category?: ChatCategory | null;
};

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
