// src/features/classroom/PollCard.tsx
import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, Tag, Badge, Tooltip, Empty } from "antd";
import {
  CheckCircle2,
  HelpCircle,
  Users,
  Clock,
  Lock,
  Trophy,
  Check,
  BarChart3,
  Crown,
} from "lucide-react";
import { loadPollWithResults, votePoll, retractVote } from "./polls";
import type { PollWithOptions } from "./types";

/* ─── Chart Colors ─── */
const CHART_COLORS = ["#E07A5F", "#F5B041", "#82CCDD", "#A29BFE", "#FD79A8", "#55E6C1"];

/* ─── Mini Donut Chart (SVG) ─── */
function PollDonut({
  options,
  counts,
  total,
  size = 120,
}: {
  options: PollWithOptions["options"];
  counts: Record<string, number>;
  total: number;
  size?: number;
}) {
  const radius = size / 2 - 14;
  const circumference = 2 * Math.PI * radius;
  let accumulated = 0;

  if (total === 0) {
    return (
      <div className="grid h-[120px] w-[120px] place-items-center">
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span className="text-[10px] text-[#8C8C8C]">No votes</span>} />
      </div>
    );
  }

  return (
    <div className="relative grid h-[120px] w-[120px] place-items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        {options.map((opt, i) => {
          const count = counts[opt.id] ?? 0;
          const pct = total > 0 ? count / total : 0;
          const dash = pct * circumference;
          const gap = circumference - dash;
          const offset = circumference - accumulated * circumference;
          accumulated += pct;
          const color = CHART_COLORS[i % CHART_COLORS.length];

          return (
            <motion.circle
              key={opt.id}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${gap}`}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1, ease: "easeOut", delay: 0.2 + i * 0.1 }}
            />
          );
        })}
        {/* Inner track */}
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={10} className="text-[#E07A5F]/5" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-xl font-bold text-[#2D3436] dark:text-[#E8E8E8]"
        >
          {total}
        </motion.span>
        <span className="text-[10px] uppercase tracking-wider text-[#8C8C8C]">votes</span>
      </div>
    </div>
  );
}

/* ─── Time Formatter ─── */
function fmtRemaining(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "Closed";
  const h = Math.floor(diff / 36e5);
  const m = Math.floor((diff % 36e5) / 6e4);
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

/* ─── Main Component ─── */
export function PollCard({ pollId, meId }: { pollId: string; meId: string }) {
  const [poll, setPoll] = useState<PollWithOptions | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    try {
      const p = await loadPollWithResults(pollId);
      setPoll(p);
    } catch {
      // Missing/deleted poll renders nothing
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

  const maxCount = Math.max(...Object.values(poll.voteCounts), 0);
  const sortedOptions = useMemo(() => {
    return [...poll.options].sort((a, b) => (poll.voteCounts[b.id] ?? 0) - (poll.voteCounts[a.id] ?? 0));
  }, [poll]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 350, damping: 28 }}
      className="max-w-[360px]"
    >
      <Card
        bordered
        className="overflow-hidden rounded-2xl border-[#E07A5F]/15 bg-white/90 shadow-xl backdrop-blur-md dark:border-[#E07A5F]/10 dark:bg-[#1E1E1E]/95"
        bodyStyle={{ padding: 0 }}
      >
        {/* ─── Header ─── */}
        <div className="flex items-center justify-between border-b border-[#E07A5F]/10 bg-gradient-to-r from-[#E07A5F]/[0.03] to-transparent px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#E07A5F]/10">
              {poll.is_quiz ? (
                <HelpCircle className="h-4 w-4 text-[#E07A5F]" />
              ) : (
                <BarChart3 className="h-4 w-4 text-[#E07A5F]" />
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-[#2D3436] dark:text-[#E8E8E8]">
                {poll.is_quiz ? "Quiz" : "Poll"}
              </p>
              <p className="text-[10px] text-[#8C8C8C]">
                {poll.allow_multiple ? "Multiple choice" : "Single choice"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {poll.is_quiz && (
              <Tag color="warning" className="text-xs font-medium border-0">
                <Trophy className="mr-1 inline h-3 w-3" />
                Quiz
              </Tag>
            )}
            {closed ? (
              <Tag color="default" className="text-xs font-medium border-0">
                <Lock className="mr-1 inline h-3 w-3" />
                Closed
              </Tag>
            ) : (
              <Badge
                status="processing"
                text={<span className="text-xs font-medium text-green-500">Live</span>}
              />
            )}
          </div>
        </div>

        {/* ─── Question ─── */}
        <div className="px-4 pt-4">
          <h3 className="text-[15px] font-semibold leading-snug text-[#2D3436] dark:text-[#E8E8E8]">
            {poll.question}
          </h3>
        </div>

        {/* ─── Chart + Legend ─── */}
        <div className="flex items-center gap-4 px-4 py-4">
          <PollDonut options={poll.options} counts={poll.voteCounts} total={totalVotes} />

          <div className="flex-1 space-y-2">
            {sortedOptions.slice(0, 4).map((opt, i) => {
              const count = poll.voteCounts[opt.id] ?? 0;
              const pct = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
              const isLeader = count === maxCount && count > 0;
              return (
                <div key={opt.id} className="flex items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: CHART_COLORS[poll.options.indexOf(opt) % CHART_COLORS.length] }}
                  />
                  <span className="flex-1 truncate text-xs text-[#8C8C8C]">{opt.label}</span>
                  <div className="flex items-center gap-1">
                    {isLeader && <Crown className="h-3 w-3 text-[#F5B041]" />}
                    <span className="text-xs font-bold text-[#2D3436] dark:text-[#E8E8E8]">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── Options ─── */}
        <div className="space-y-2 px-4 pb-4">
          <AnimatePresence>
            {poll.options.map((opt, idx) => {
              const count = poll.voteCounts[opt.id] ?? 0;
              const pct = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
              const mine = poll.myVotes.includes(opt.id);
              const isCorrect = poll.is_quiz && poll.correct_option_index === idx;
              const isLeader = count === maxCount && count > 0;

              return (
                <motion.button
                  key={opt.id}
                  type="button"
                  disabled={busy || closed}
                  onClick={() => onToggle(opt.id)}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05, type: "spring", stiffness: 400, damping: 25 }}
                  whileHover={{ scale: 1.015 }}
                  whileTap={{ scale: 0.985 }}
                  className={`group relative w-full overflow-hidden rounded-xl border-2 text-left transition-all disabled:cursor-not-allowed ${
                    mine
                      ? "border-[#E07A5F] bg-[#E07A5F]/[0.08] shadow-sm"
                      : "border-transparent bg-black/[0.02] hover:bg-black/[0.04] dark:bg-white/[0.03] dark:hover:bg-white/[0.05]"
                  } ${isCorrect && closed ? "border-green-500/40 bg-green-500/[0.06]" : ""}`}
                >
                  {/* Background progress bar */}
                  <motion.div
                    className={`absolute inset-y-0 left-0 rounded-r-lg ${
                      isCorrect ? "bg-green-500/10" : "bg-[#E07A5F]/10"
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
                  />

                  <div className="relative flex items-center gap-3 px-3.5 py-2.5">
                    {/* Selection indicator */}
                    <div
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-colors ${
                        mine
                          ? "border-[#E07A5F] bg-[#E07A5F] text-white"
                          : "border-[#d9d9d9] dark:border-[#555]"
                      }`}
                    >
                      {mine && <Check className="h-3 w-3" strokeWidth={3} />}
                    </div>

                    {/* Label */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-[#2D3436] dark:text-[#E8E8E8]">
                          {opt.label}
                        </span>
                        {isCorrect && closed && (
                          <Tag color="success" className="m-0 text-[10px] leading-none">
                            Correct
                          </Tag>
                        )}
                        {isLeader && !closed && (
                          <Tooltip title="Leading">
                            <Crown className="h-3.5 w-3.5 shrink-0 text-[#F5B041]" />
                          </Tooltip>
                        )}
                      </div>

                      {/* Mini bar + stats */}
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                          <motion.div
                            className={`h-full rounded-full ${isCorrect ? "bg-green-500" : "bg-[#E07A5F]"}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 }}
                          />
                        </div>
                        <span className="shrink-0 text-[11px] tabular-nums font-semibold text-[#8C8C8C]">
                          {count} · {pct}%
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>

        {/* ─── Footer ─── */}
        <div className="flex items-center justify-between border-t border-[#E07A5F]/10 bg-[#F5F0E8]/40 px-4 py-2.5 dark:bg-white/[0.02]">
          <div className="flex items-center gap-1.5 text-xs text-[#8C8C8C]">
            <Users className="h-3.5 w-3.5" />
            <span className="font-medium">
              {totalVotes} vote{totalVotes === 1 ? "" : "s"}
            </span>
          </div>

          {poll.closes_at && (
            <div className="flex items-center gap-1.5 text-xs text-[#8C8C8C]">
              <Clock className="h-3.5 w-3.5" />
              <span>{fmtRemaining(poll.closes_at)}</span>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
