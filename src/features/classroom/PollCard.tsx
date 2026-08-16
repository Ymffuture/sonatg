// src/features/classroom/PollCard.tsx
import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Tooltip } from "antd";
import {
  CheckCircle2,
  HelpCircle,
  BarChart3,
  Lock,
  Users,
  Check,
  X,
  Clock,
} from "lucide-react";
import { loadPollWithResults, votePoll, retractVote } from "./polls";
import type { PollWithOptions } from "./types";

interface PollCardProps {
  pollId: string;
  meId: string;
}

export function PollCard({ pollId, meId }: PollCardProps) {
  const [poll, setPoll] = useState<PollWithOptions | null>(null);
  const [busy, setBusy] = useState(false);
  const [justVoted, setJustVoted] = useState<string | null>(null);

  const reload = async () => {
    try {
      const p = await loadPollWithResults(pollId);
      setPoll(p);
    } catch {
      // Missing/deleted poll renders nothing
    }
  };

  useEffect(() => {
    reload();
  }, [pollId]);

  useEffect(() => {
    if (!justVoted) return;
    const t = setTimeout(() => setJustVoted(null), 1200);
    return () => clearTimeout(t);
  }, [justVoted]);

  if (!poll) return null;

  const totalVotes = Object.values(poll.voteCounts).reduce((a, b) => a + b, 0);
  const closed = poll.closes_at ? new Date(poll.closes_at) <= new Date() : false;
  const hasVoted = poll.myVotes.length > 0;

  const onToggle = async (optionId: string) => {
    if (busy || closed) return;
    setBusy(true);
    try {
      if (poll.myVotes.includes(optionId)) {
        await retractVote(poll.id, optionId);
      } else {
        await votePoll(poll.id, optionId, poll.allow_multiple);
        setJustVoted(optionId);
      }
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const maxCount = Math.max(...Object.values(poll.voteCounts), 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="w-full max-w-[600px] overflow-hidden rounded-2xl border border-[#E07A5F]/15 bg-white/80 shadow-lg backdrop-blur-md dark:border-[#E07A5F]/10 dark:bg-[#1E1E1E]/90"
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-[#1E1E1E]/10 px-4 py-3 dark:border-white/5">
        <div
          className={`grid h-8 w-8 place-items-center rounded-full ${
            poll.is_quiz
              ? "bg-[#E07A5F]/10 dark:text-[#1E1E1E] text-gray-600"
              : "bg-emerald-500/10 text-emerald-500"
          }`}
        >
          {poll.is_quiz ? (
            <HelpCircle className="h-4 w-4" />
          ) : (
            <BarChart3 className="h-4 w-4" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold leading-tight text-[#2D3436] dark:text-[#E8E8E8]">
            {poll.question}
          </p>
          <p className="mt-0.5 text-[11px] text-[#8C8C8C]">
            {poll.is_quiz ? "Quiz" : "Poll"}
            {poll.allow_multiple ? " · Multiple choice" : " · Single choice"}
          </p>
        </div>
        {closed && (
          <Tooltip title="This poll is closed">
            <Lock className="h-3.5 w-3.5 text-[#8C8C8C]" />
          </Tooltip>
        )}
      </div>

      {/* Options */}
      <div className="space-y-1.5 p-3">
        <AnimatePresence>
          {poll.options.map((opt, idx) => {
            const count = poll.voteCounts[opt.id] ?? 0;
            const pct = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
            const mine = poll.myVotes.includes(opt.id);
            const isCorrect = poll.is_quiz && poll.correct_option_index === idx;
            const isWrong = poll.is_quiz && closed && mine && !isCorrect;
            const leading = count === maxCount && count > 0;

            return (
              <motion.button
                key={opt.id}
                layout
                type="button"
                disabled={busy || closed}
                onClick={() => onToggle(opt.id)}
                whileHover={!closed ? { scale: 1.01 } : {}}
                whileTap={!closed ? { scale: 0.98 } : {}}
                className={`group relative w-full overflow-hidden rounded-xl border text-left transition-all ${
                  mine
                    ? isWrong
                      ? "border-red-400/30 bg-red-500/[0.06]"
                      : "border-[#E07A5F]/30 bg-[#2D3436]/[0.06]"
                    : "border-transparent bg-[#F5F0E8]/60 hover:bg-[#F5F0E8] dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
                } disabled:cursor-not-allowed`}
              >
                {/* Progress bar background */}
                <motion.div
                  initial={false}
                  animate={{ width: `${pct}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 20 }}
                  className={`absolute inset-y-0 left-0 rounded-l-xl ${
                    isCorrect && closed
                      ? "bg-emerald-500/10"
                      : isWrong
                      ? "bg-red-500/10"
                      : mine
                      ? "bg-[#E07A5F]/10"
                      : "bg-[#E07A5F]/5"
                  }`}
                />

                {/* Content */}
                <div className="relative flex items-center gap-3 px-3 py-2.5">
                  {/* Selection indicator */}
                  <div
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-colors ${
                      mine
                        ? isWrong
                          ? "border-red-400 bg-red-400 text-white"
                          : "border-[#1E1E1E] bg-[#8c8c8c] text-white"
                        : "border-[#8C8C8C]/30 dark:border-white/20"
                    }`}
                  >
                    {mine &&
                      (poll.allow_multiple ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <div className="h-1.5 w-1.5 rounded-full bg-white" />
                      ))}
                  </div>

                  {/* Label */}
                  <div className="flex-1 min-w-0">
                    <span
                      className={`block text-[13px] font-medium leading-tight ${
                        isCorrect && closed
                          ? "text-emerald-600 dark:text-emerald-400"
                          : isWrong
                          ? "text-red-500"
                          : "text-[#2D3436] dark:text-[#E8E8E8]"
                      }`}
                    >
                      {opt.label}
                    </span>

                    {/* Vote bar for visual density */}
                    {totalVotes > 0 && (
                      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/5">
                        <motion.div
                          initial={false}
                          animate={{ width: `${pct}%` }}
                          transition={{ type: "spring", stiffness: 120, damping: 20 }}
                          className={`h-full rounded-full ${
                            isCorrect && closed
                              ? "bg-emerald-500"
                              : isWrong
                              ? "bg-red-400"
                              : mine
                              ? "bg-[#E07A5F]"
                              : "bg-[#8C8C8C]/40"
                          }`}
                        />
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <Tooltip
                    title={`${count} vote${count === 1 ? "" : "s"} (${pct}%)`}
                    placement="top"
                  >
                    <div
                      className={`shrink-0 text-right ${
                        leading && !closed ? "text-[#E07A5F]" : "text-[#8C8C8C]"
                      }`}
                    >
                      <span className="block text-[12px] font-semibold tabular-nums">
                        {pct}%
                      </span>
                      <span className="block text-[10px] opacity-70">
                        {count}
                      </span>
                    </div>
                  </Tooltip>

                  {/* Correct / Wrong badge */}
                  {poll.is_quiz && closed && (
                    <div className="shrink-0">
                      {isCorrect ? (
                        <div className="grid h-6 w-6 place-items-center rounded-full bg-emerald-500/10">
                          <Check className="h-3.5 w-3.5 text-emerald-500" />
                        </div>
                      ) : mine ? (
                        <div className="grid h-6 w-6 place-items-center rounded-full bg-red-500/10">
                          <X className="h-3.5 w-3.5 text-red-400" />
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>

                {/* Just voted flash */}
                <AnimatePresence>
                  {justVoted === opt.id && (
                    <motion.div
                      initial={{ opacity: 0.6 }}
                      animate={{ opacity: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.8 }}
                      className="absolute inset-0 bg-[#E07A5F]/20 pointer-events-none"
                    />
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-[#E07A5F]/10 px-4 py-2.5 dark:border-white/5">
        <div className="flex items-center gap-1.5 text-[11px] text-[#8C8C8C]">
          <Users className="h-3 w-3" />
          <span className="tabular-nums">
            {totalVotes.toLocaleString()} vote{totalVotes === 1 ? "" : "s"}
          </span>
          {hasVoted && (
            <span className="ml-1 rounded-full bg-green-400 px-1.5 py-0.5 text-[10px] font-medium text-[green]">
              You voted
            </span>
          )}
        </div>

        {poll.closes_at && !closed && (
          <Tooltip title={`Closes at ${new Date(poll.closes_at).toLocaleString()}`}>
            <div className="flex items-center gap-1 text-[11px] text-[#8C8C8C]">
              <Clock className="h-3 w-3" />
              <span>{getTimeRemaining(poll.closes_at)}</span>
            </div>
          </Tooltip>
        )}

        {closed && (
          <span className="text-[11px] font-medium text-[#8C8C8C]">Closed</span>
        )}
      </div>
    </motion.div>
  );
}

/* ─── Helpers ─── */
function getTimeRemaining(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "Closed";
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `${days}d left`;
  if (hrs > 0) return `${hrs}h left`;
  return `${mins}m left`;
}
