// src/features/classroom/PollCard.tsx
// Renders one poll/quiz inline in the chat feed. Self-contained: fetches
// its own results and re-fetches after a vote. Wire it into MessageBubble
// wherever a message references a poll_id (e.g. a "poll" message kind).

import { useEffect, useState } from "react";
import { CheckCircle2, HelpCircle } from "lucide-react";
import { loadPollWithResults, votePoll, retractVote } from "./polls";
import type { PollWithOptions } from "./types";

interface PollCardProps {
  pollId: string;
  meId: string;
}

export function PollCard({ pollId, meId }: PollCardProps) {
  const [poll, setPoll] = useState<PollWithOptions | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    try {
      const p = await loadPollWithResults(pollId);
      setPoll(p);
    } catch {
      // Swallow — a missing/deleted poll just renders nothing below.
    }
  };

  useEffect(() => { reload(); }, [pollId]);

  if (!poll) return null;

  const totalVotes = Object.values(poll.voteCounts).reduce((a, b) => a + b, 0);
  const closed = poll.closes_at ? new Date(poll.closes_at) <= new Date() : false;

  const onToggle = async (optionId: string) => {
    if (busy || closed) return;
    setBusy(true);
    try {
      if (poll.myVotes.includes(optionId)) await retractVote(poll.id, optionId);
      else await votePoll(poll.id, optionId, poll.allow_multiple);
      await reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-sm rounded-2xl border border-[#E07A5F]/20 bg-white p-3 dark:bg-[#1E1E1E]">
      <div className="flex items-start gap-2">
        {poll.is_quiz ? (
          <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#E07A5F]" />
        ) : (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#E07A5F]" />
        )}
        <p className="text-sm font-semibold text-[#2D3436] dark:text-[#E8E8E8]">{poll.question}</p>
      </div>

      <div className="mt-2 space-y-1.5">
        {poll.options.map((opt, idx) => {
          const count = poll.voteCounts[opt.id] ?? 0;
          const pct = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
          const mine = poll.myVotes.includes(opt.id);
          const isCorrect = poll.is_quiz && poll.correct_option_index === idx;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={busy || closed}
              onClick={() => onToggle(opt.id)}
              className={`relative w-full overflow-hidden rounded-xl border px-3 py-2 text-left text-xs transition ${
                mine ? "border-[#E07A5F] bg-[#E07A5F]/10" : "border-[#8C8C8C]/20"
              } disabled:opacity-70`}
            >
              <div
                className="absolute inset-y-0 left-0 bg-[#E07A5F]/10"
                style={{ width: `${pct}%` }}
                aria-hidden
              />
              <div className="relative flex items-center justify-between gap-2">
                <span className="font-medium text-[#2D3436] dark:text-[#E8E8E8]">
                  {opt.label}
                  {poll.is_quiz && closed && isCorrect && " ✓"}
                </span>
                <span className="text-[#8C8C8C]">{count} · {pct}%</span>
              </div>
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-[11px] text-[#8C8C8C]">
        {totalVotes} vote{totalVotes === 1 ? "" : "s"}
        {closed ? " · Closed" : poll.closes_at ? ` · Closes ${new Date(poll.closes_at).toLocaleString()}` : ""}
      </p>
    </div>
  );
}
