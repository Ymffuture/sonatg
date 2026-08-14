// src/features/classroom/polls.ts
// Inline polls/quick quizzes: create, vote, and load results with tallies.

import { supabase } from "@/integrations/supabase/client";
import type { PollOption, PollRow, PollWithOptions } from "./types";

export interface CreatePollInput {
  chatId: string;
  messageId?: string | null;
  question: string;
  options: string[];
  isQuiz?: boolean;
  correctOptionIndex?: number | null;
  allowMultiple?: boolean;
  closesAt?: string | null;
}

export async function createPoll(input: CreatePollInput): Promise<PollWithOptions> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not signed in");
  if (input.options.length < 2) throw new Error("A poll needs at least 2 options");

  const { data: poll, error: pollErr } = await supabase
    .from("polls")
    .insert({
      chat_id: input.chatId,
      message_id: input.messageId ?? null,
      created_by: auth.user.id,
      question: input.question,
      is_quiz: input.isQuiz ?? false,
      correct_option_index: input.correctOptionIndex ?? null,
      allow_multiple: input.allowMultiple ?? false,
      closes_at: input.closesAt ?? null,
    })
    .select("*")
    .single();
  if (pollErr) throw pollErr;

  const optionRows = input.options.map((label, position) => ({ poll_id: poll.id, label, position }));
  const { data: options, error: optErr } = await supabase.from("poll_options").insert(optionRows).select("*");
  if (optErr) throw optErr;

  return { ...(poll as PollRow), options: (options ?? []) as PollOption[], voteCounts: {}, myVotes: [] };
}

export async function votePoll(pollId: string, optionId: string, allowMultiple: boolean): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not signed in");

  if (!allowMultiple) {
    // Single-choice: clear any prior vote from this user on this poll first.
    await supabase.from("poll_votes").delete().eq("poll_id", pollId).eq("user_id", auth.user.id);
  }
  const { error } = await supabase.from("poll_votes").insert({ poll_id: pollId, option_id: optionId, user_id: auth.user.id });
  if (error) throw error;
}

export async function retractVote(pollId: string, optionId: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not signed in");
  const { error } = await supabase
    .from("poll_votes")
    .delete()
    .eq("poll_id", pollId)
    .eq("option_id", optionId)
    .eq("user_id", auth.user.id);
  if (error) throw error;
}

export async function loadPollWithResults(pollId: string): Promise<PollWithOptions> {
  const { data: auth } = await supabase.auth.getUser();
  const [{ data: poll, error: pollErr }, { data: options, error: optErr }, { data: votes, error: voteErr }] =
    await Promise.all([
      supabase.from("polls").select("*").eq("id", pollId).single(),
      supabase.from("poll_options").select("*").eq("poll_id", pollId).order("position"),
      supabase.from("poll_votes").select("option_id,user_id").eq("poll_id", pollId),
    ]);
  if (pollErr) throw pollErr;
  if (optErr) throw optErr;
  if (voteErr) throw voteErr;

  const voteCounts: Record<string, number> = {};
  const myVotes: string[] = [];
  for (const v of votes ?? []) {
    voteCounts[v.option_id] = (voteCounts[v.option_id] ?? 0) + 1;
    if (v.user_id === auth.user?.id) myVotes.push(v.option_id);
  }

  return { ...(poll as PollRow), options: (options ?? []) as PollOption[], voteCounts, myVotes };
}
