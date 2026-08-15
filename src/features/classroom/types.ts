// src/features/classroom/types.ts

export interface ClassRow {
  id: string;
  chat_id: string;
  name: string;
  join_code: string;
  created_by: string;
  is_active: boolean;
  created_at: string;
}

export interface PollOption {
  id: string;
  poll_id: string;
  label: string;
  position: number;
}

export interface PollRow {
  id: string;
  chat_id: string;
  message_id: string | null;
  created_by: string;
  question: string;
  is_quiz: boolean;
  correct_option_index: number | null;
  allow_multiple: boolean;
  closes_at: string | null;
  created_at: string;
}

export interface PollWithOptions extends PollRow {
  options: PollOption[];
  /** option_id -> vote count, plus whether the current user voted for it */
  voteCounts: Record<string, number>;
  myVotes: string[];
}
