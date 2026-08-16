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
  /** false = hide the tally from voters until the creator reveals it or the poll closes (quiz-style). Default true. */
  resultsVisible?: boolean;
}

export interface UpdatePollInput {
  question?: string;
  /** Replacing options only works cleanly before anyone has voted — see replacePollOptions(). */
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
      results_visible: input.resultsVisible ?? true,
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

/** Closes voting immediately (sets closes_at to now). Creator/admin only — enforced by RLS. */
export async function closePoll(pollId: string): Promise<void> {
  const { error } = await supabase.from("polls").update({ closes_at: new Date().toISOString() }).eq("id", pollId);
  if (error) throw error;
}

/** Reopens a closed poll, either indefinitely or until a new deadline. Creator/admin only. */
export async function reopenPoll(pollId: string, closesAt: string | null = null): Promise<void> {
  const { error } = await supabase.from("polls").update({ closes_at: closesAt }).eq("id", pollId);
  if (error) throw error;
}

/** Reveals results to voters when the poll was created with resultsVisible: false. Creator/admin only. */
export async function revealPollResults(pollId: string): Promise<void> {
  const { error } = await supabase.from("polls").update({ results_visible: true }).eq("id", pollId);
  if (error) throw error;
}

/** Re-hides results (e.g. creator wants to walk through a quiz one question at a time). Creator/admin only. */
export async function hidePollResults(pollId: string): Promise<void> {
  const { error } = await supabase.from("polls").update({ results_visible: false }).eq("id", pollId);
  if (error) throw error;
}

/** Edits the question/settings of a poll. Doesn't touch options — see replacePollOptions(). Creator/admin only. */
export async function updatePoll(pollId: string, patch: UpdatePollInput): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.question !== undefined) update.question = patch.question;
  if (patch.correctOptionIndex !== undefined) update.correct_option_index = patch.correctOptionIndex;
  if (patch.allowMultiple !== undefined) update.allow_multiple = patch.allowMultiple;
  if (patch.closesAt !== undefined) update.closes_at = patch.closesAt;
  if (Object.keys(update).length === 0) return;
  const { error } = await supabase.from("polls").update(update).eq("id", pollId);
  if (error) throw error;
}

/**
 * Replaces a poll's option list. Only safe to call when the poll has no
 * votes yet (the UI should disable editing options once voting starts) —
 * deleting an option a user already voted for would silently drop their
 * vote via the options table's cascade.
 */
export async function replacePollOptions(pollId: string, labels: string[]): Promise<PollOption[]> {
  if (labels.length < 2) throw new Error("A poll needs at least 2 options");
  const { error: delErr } = await supabase.from("poll_options").delete().eq("poll_id", pollId);
  if (delErr) throw delErr;
  const rows = labels.map((label, position) => ({ poll_id: pollId, label, position }));
  const { data, error } = await supabase.from("poll_options").insert(rows).select("*");
  if (error) throw error;
  return (data ?? []) as PollOption[];
}

/** Deletes a poll entirely (options/votes cascade). Creator/admin only. */
export async function deletePoll(pollId: string): Promise<void> {
  const { error } = await supabase.from("polls").delete().eq("id", pollId);
  if (error) throw error;
}

export interface PollParticipant {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface PollParticipation {
  totalMembers: number;
  answered: PollParticipant[];
  notAnswered: PollParticipant[];
}

/**
 * Compares a poll's distinct voters against the chat's member list, so
 * the creator can see who in the group has/hasn't answered — not just a
 * raw vote count. AI members and the poll's own creator are excluded
 * from "not answered" (a bot won't vote, and the creator isn't expected
 * to answer their own poll).
 */
export async function getPollParticipation(pollId: string, chatId: string): Promise<PollParticipation> {
  const [{ data: votes, error: voteErr }, { data: memberRows, error: memErr }, { data: pollRow, error: pollErr }] =
    await Promise.all([
      supabase.from("poll_votes").select("user_id").eq("poll_id", pollId),
      supabase.from("chat_members").select("user_id").eq("chat_id", chatId),
      supabase.from("polls").select("created_by").eq("id", pollId).single(),
    ]);
  if (voteErr) throw voteErr;
  if (memErr) throw memErr;
  if (pollErr) throw pollErr;

  const votedIds = new Set((votes ?? []).map((v) => v.user_id as string));
  const memberIds = (memberRows ?? []).map((m) => m.user_id as string);
  const creatorId = pollRow?.created_by as string | undefined;

  const eligibleIds = memberIds.filter((id) => id !== creatorId);
  if (eligibleIds.length === 0) {
    return { totalMembers: 0, answered: [], notAnswered: [] };
  }

  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("id,display_name,avatar_url,is_ai")
    .in("id", eligibleIds);
  if (profErr) throw profErr;

  const answered: PollParticipant[] = [];
  const notAnswered: PollParticipant[] = [];
  for (const p of profiles ?? []) {
    if (p.is_ai) continue; // bots don't vote — don't count them as "haven't answered"
    const entry: PollParticipant = { userId: p.id, displayName: p.display_name ?? "Someone", avatarUrl: p.avatar_url ?? null };
    if (votedIds.has(p.id)) answered.push(entry);
    else notAnswered.push(entry);
  }

  return { totalMembers: answered.length + notAnswered.length, answered, notAnswered };
}
