export const SONA_AI_ID = "00000000-0000-0000-0000-00000000a1a1";

export type Profile = {
  id: string;
  email: string | null;
  display_name: string;
  avatar_url: string | null;
  is_ai: boolean;
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
};

export type ChatRow = {
  id: string;
  is_group: boolean;
  title: string | null;
  created_by: string | null;
  last_message_at: string;
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

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
