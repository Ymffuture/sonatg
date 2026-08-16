// src/features/classroom/PollCard.tsx
import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Tag, Badge, Tooltip, Empty, Dropdown } from "antd";
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
  MoreVertical,
  Pencil,
  Ban,
  RotateCcw,
  Trash2,
  Eye,
  EyeOff,
} from "lucide-react";
import { loadPollWithResults, votePoll, retractVote, closePoll, reopenPoll, revealPollResults, hidePollResults, deletePoll } from "./polls";
import type { PollWithOptions } from "./types";
import { PollComposerModal } from "./PollComposerModal";
import { useConfirm } from "@/hooks/useConfirmDialog";

/* ─── Chart Colors ─── */
const CHART_COLORS = ["#4ade80", "#22d3ee", "#a78bfa", "#fbbf24", "#fb7185", "#34d399"];

/* ─── Mini Donut Chart (SVG) ─── */
function PollDonut({
  options,
  counts,
  total,
  size = 96,
}: {
  options: PollWithOptions["options"];
  counts: Record<string, number>;
  total: number;
  size?: number;
}) {
  const radius = size / 2 - 12;
  const circumference = 2 * Math.PI * radius;
  let accumulated = 0;

  if (total === 0) {
    return (
      <div className="grid h-[96px] w-[96px] place-items-center">
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span className="text-[10px] text-[#8C8C8C]">No votes</span>} />
      </div>
    );
  }

  return (
    <div className="relative grid h-[96px] w-[96px] place-items-center">
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
              strokeWidth={8}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${gap}`}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1, ease: "easeOut", delay: 0.2 + i * 0.1 }}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-lg font-bold text-[#111827] dark:text-[#E8E8E8]"
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

/* ─── WhatsApp-style Option Row ─── */
function OptionRow({
  opt,
  idx,
  count,
  pct,
  mine,
  isCorrect,
  isLeader,
  closed,
  busy,
  resultsHiddenFromMe,
  totalVotes,
  onToggle,
  colorIndex,
}: {
  opt: PollWithOptions["options"][number];
  idx: number;
  count: number;
  pct: number;
  mine: boolean;
  isCorrect: boolean;
  isLeader: boolean;
  closed: boolean;
  busy: boolean;
  resultsHiddenFromMe: boolean;
  totalVotes: number;
  onToggle: () => void;
  colorIndex: number;
}) {
  return (
    <motion.button
      key={opt.id}
      type="button"
      disabled={busy || closed}
      onClick={onToggle}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.04, type: "spring", stiffness: 400, damping: 25 }}
      whileTap={{ scale: 0.98 }}
      className={`group relative w-full overflow-hidden rounded-lg text-left transition-all disabled:cursor-not-allowed ${
        mine
          ? "bg-green-400/10 ring-1 ring-green-400/30"
          : "bg-[#F0F2F5] hover:bg-[#E4E6EB] dark:bg-[#2A2F32] dark:hover:bg-[#3B4042]"
      } ${isCorrect && closed ? "ring-1 ring-green-400/40 bg-green-400/[0.08]" : ""}`}
    >
      {/* Background progress bar */}
      {!resultsHiddenFromMe && totalVotes > 0 && (
        <motion.div
          className={`absolute inset-y-0 left-0 rounded-r-lg ${
            isCorrect ? "bg-green-400/15" : "bg-green-400/8"
          }`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
        />
      )}

      <div className="relative flex items-center gap-3 px-3 py-2.5">
        {/* Selection indicator — WhatsApp style circle */}
        <div
          className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-all ${
            mine
              ? "border-green-400 bg-green-400 text-white shadow-sm"
              : "border-[#8C8C8C]/40 dark:border-[#8C8C8C]/30"
          }`}
        >
          {mine && <Check className="h-3 w-3" strokeWidth={3} />}
        </div>

        {/* Label + stats */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-medium text-[#111827] dark:text-[#E8E8E8]">
              {opt.label}
            </span>
            {isCorrect && closed && (
              <span className="shrink-0 rounded-full bg-green-400/15 px-1.5 py-0.5 text-[10px] font-semibold text-green-500">
                Correct
              </span>
            )}
            {isLeader && !closed && !resultsHiddenFromMe && (
              <Tooltip title="Leading">
                <Crown className="h-3 w-3 shrink-0 text-amber-400" />
              </Tooltip>
            )}
          </div>

          {/* Progress bar + count */}
          {!resultsHiddenFromMe && (
            <div className="mt-1 flex items-center gap-2">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                <motion.div
                  className={`h-full rounded-full ${isCorrect ? "bg-green-400" : "bg-green-400/70"}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, ease: "easeOut", delay: 0.12 }}
                />
              </div>
              <span className="shrink-0 text-[11px] tabular-nums font-medium text-[#8C8C8C]">
                {count} · {pct}%
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.button>
  );
}

/* ─── Main Component ─── */
export function PollCard({ pollId, meId }: { pollId: string; meId: string }) {
  const confirm = useConfirm();
  const [poll, setPoll] = useState<PollWithOptions | null>(null);
  const [busy, setBusy] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  const reload = async () => {
    try {
      const p = await loadPollWithResults(pollId);
      setPoll(p);
    } catch {
      // Missing/deleted poll renders nothing
    }
  };

  useEffect(() => { reload(); }, [pollId]);

  const sortedOptions = useMemo(() => {
    if (!poll) return [];
    return [...poll.options].sort((a, b) => (poll.voteCounts[b.id] ?? 0) - (poll.voteCounts[a.id] ?? 0));
  }, [poll]);

  if (!poll) return null;

  const isCreator = poll.created_by === meId;
  const totalVotes = Object.values(poll.voteCounts).reduce((a, b) => a + b, 0);
  const closed = poll.closes_at ? new Date(poll.closes_at) <= new Date() : false;
  const resultsHiddenFromMe = !isCreator && !poll.results_visible && !closed;

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

  const runCreatorAction = async (action: () => Promise<void>) => {
    setActionBusy(true);
    try {
      await action();
      await reload();
    } finally {
      setActionBusy(false);
    }
  };

  const maxCount = Math.max(...Object.values(poll.voteCounts), 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="max-w-[340px]"
    >
      {/* WhatsApp-style message bubble */}
      <div className="relative overflow-hidden rounded-2xl rounded-tl-md bg-white shadow-sm dark:bg-[#1E1E1E] ring-1 ring-black/5 dark:ring-white/5">

        {/* ─── Header ─── */}
        <div className="flex items-center justify-between px-3.5 pt-3 pb-2">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-full bg-green-400/15">
              {poll.is_quiz ? (
                <HelpCircle className="h-3.5 w-3.5 text-green-400" />
              ) : (
                <BarChart3 className="h-3.5 w-3.5 text-green-400" />
              )}
            </div>
            <div>
              <p className="text-[13px] font-semibold text-[#111827] dark:text-[#E8E8E8]">
                {poll.is_quiz ? "Quiz" : "Poll"}
              </p>
              <p className="text-[10px] text-[#8C8C8C]">
                {poll.allow_multiple ? "Multiple choice" : "Single choice"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {closed ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#8C8C8C]/10 px-2 py-0.5 text-[10px] font-medium text-[#8C8C8C]">
                <Lock className="h-2.5 w-2.5" />
                Closed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-400/10 px-2 py-0.5 text-[10px] font-medium text-green-500">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                Live
              </span>
            )}

            {isCreator && (
              <Dropdown
                trigger={["click"]}
                menu={{
                  items: [
                    closed
                      ? { key: "reopen", label: "Reopen poll", icon: <RotateCcw className="h-3.5 w-3.5" /> }
                      : { key: "close", label: "Close poll", icon: <Ban className="h-3.5 w-3.5" /> },
                    { key: "edit", label: "Edit poll", icon: <Pencil className="h-3.5 w-3.5" /> },
                    poll.results_visible
                      ? { key: "hide-results", label: "Hide results", icon: <EyeOff className="h-3.5 w-3.5" /> }
                      : { key: "show-results", label: "Show results", icon: <Eye className="h-3.5 w-3.5" /> },
                    { type: "divider" as const },
                    { key: "delete", label: <span className="text-red-500">Delete poll</span>, icon: <Trash2 className="h-3.5 w-3.5 text-red-500" /> },
                  ],
                  onClick: ({ key }) => {
                    if (key === "close") runCreatorAction(() => closePoll(poll.id));
                    else if (key === "reopen") runCreatorAction(() => reopenPoll(poll.id));
                    else if (key === "show-results") runCreatorAction(() => revealPollResults(poll.id));
                    else if (key === "hide-results") runCreatorAction(() => hidePollResults(poll.id));
                    else if (key === "edit") setShowEdit(true);
                    else if (key === "delete") {
                      confirm({
                        title: "Delete this poll?",
                        description: "This removes it for everyone in the chat. This can't be undone.",
                        confirmText: "Delete",
                        danger: true,
                      }).then((ok) => {
                        if (!ok) return;
                        setActionBusy(true);
                        deletePoll(poll.id).then(() => setPoll(null)).finally(() => setActionBusy(false));
                      });
                    }
                  },
                }}
              >
                <button
                  disabled={actionBusy}
                  aria-label="Poll options"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[#8C8C8C] hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50 transition-colors"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </Dropdown>
            )}
          </div>
        </div>

        {showEdit && (
          <PollComposerModal
            chatId={poll.chat_id}
            editing={poll}
            onClose={() => setShowEdit(false)}
            onCreated={() => setShowEdit(false)}
            onUpdated={() => { setShowEdit(false); reload(); }}
          />
        )}

        {/* ─── Question ─── */}
        <div className="px-3.5 pb-2">
          <h3 className="text-[14px] font-semibold leading-snug text-[#111827] dark:text-[#E8E8E8]">
            {poll.question}
          </h3>
        </div>

        {/* ─── Chart + Legend ─── */}
        {resultsHiddenFromMe ? (
          <div className="mx-3.5 my-2 flex items-center gap-2 rounded-xl bg-black/[0.02] px-3 py-2.5 text-xs text-[#8C8C8C] dark:bg-white/[0.03]">
            <EyeOff className="h-4 w-4 shrink-0" />
            Results are hidden until the creator reveals them{poll.is_quiz ? " or the quiz ends" : ""}. Your vote is saved.
          </div>
        ) : (
          <div className="flex items-center gap-3 px-3.5 py-2">
            <PollDonut options={poll.options} counts={poll.voteCounts} total={totalVotes} />

            <div className="flex-1 space-y-1.5">
              {sortedOptions.slice(0, 4).map((opt, i) => {
                const count = poll.voteCounts[opt.id] ?? 0;
                const pct = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
                const isLeader = count === maxCount && count > 0;
                return (
                  <div key={opt.id} className="flex items-center gap-2">
                    <div
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: CHART_COLORS[poll.options.indexOf(opt) % CHART_COLORS.length] }}
                    />
                    <span className="flex-1 truncate text-[11px] text-[#8C8C8C]">{opt.label}</span>
                    <div className="flex items-center gap-1">
                      {isLeader && <Crown className="h-3 w-3 text-amber-400" />}
                      <span className="text-[11px] font-bold text-[#111827] dark:text-[#E8E8E8]">{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Options ─── */}
        <div className="space-y-1.5 px-3.5 pb-3">
          <AnimatePresence>
            {poll.options.map((opt, idx) => {
              const count = poll.voteCounts[opt.id] ?? 0;
              const pct = resultsHiddenFromMe ? 0 : (totalVotes ? Math.round((count / totalVotes) * 100) : 0);
              const mine = poll.myVotes.includes(opt.id);
              const isCorrect = poll.is_quiz && poll.correct_option_index === idx;
              const isLeader = !resultsHiddenFromMe && count === maxCount && count > 0;

              return (
                <OptionRow
                  key={opt.id}
                  opt={opt}
                  idx={idx}
                  count={count}
                  pct={pct}
                  mine={mine}
                  isCorrect={isCorrect}
                  isLeader={isLeader}
                  closed={closed}
                  busy={busy}
                  resultsHiddenFromMe={resultsHiddenFromMe}
                  totalVotes={totalVotes}
                  onToggle={() => onToggle(opt.id)}
                  colorIndex={idx}
                />
              );
            })}
          </AnimatePresence>
        </div>

        {/* ─── Footer ─── */}
        <div className="flex items-center justify-between border-t border-black/5 dark:border-white/5 bg-[#F0F2F5]/50 dark:bg-white/[0.02] px-3.5 py-2">
          <div className="flex items-center gap-1.5 text-[11px] text-[#8C8C8C]">
            <Users className="h-3 w-3" />
            <span className="font-medium">
              {totalVotes} vote{totalVotes === 1 ? "" : "s"}
            </span>
          </div>

          {poll.closes_at && (
            <div className="flex items-center gap-1.5 text-[11px] text-[#8C8C8C]">
              <Clock className="h-3 w-3" />
              <span>{fmtRemaining(poll.closes_at)}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
