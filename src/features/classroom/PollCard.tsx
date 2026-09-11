// src/features/classroom/PollCard.tsx
import { useEffect, useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  HelpCircle,
  Users,
  Clock,
  Lock,
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
  X,
  UserCheck,
  UserX,
} from "lucide-react";
import {
  loadPollWithResults, votePoll, retractVote, closePoll, reopenPoll, revealPollResults, hidePollResults, deletePoll,
  getPollParticipation, type PollParticipation,
} from "./polls";
import type { PollWithOptions } from "./types";
import { PollComposerModal } from "./PollComposerModal";
import { useConfirm } from "@/hooks/useConfirmDialog";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";

/* ─── Chart Colors ─── */
const CHART_COLORS = ["#10b981", "#06b6d4", "#8b5cf6", "#f59e0b", "#f43f5e", "#14b8a6"];

/* ─── Animation Variants ─── */
const containerVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 400, damping: 30, mass: 0.8 } },
  exit: { opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.2, ease: "easeInOut" } }
};

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } }
};

const modalVariants = {
  hidden: { opacity: 0, y: "100%", scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 400, damping: 35, mass: 0.8 } },
  exit: { opacity: 0, y: "100%", scale: 0.98, transition: { duration: 0.2, ease: "easeInOut" } }
};

/* ─── Mini Donut Chart (SVG) ─── */
function PollDonut({
  options,
  counts,
  total,
  size = 88,
}: {
  options: PollWithOptions["options"];
  counts: Record<string, number>;
  total: number;
  size?: number;
}) {
  const radius = size / 2 - 8;
  const circumference = 2 * Math.PI * radius;
  let accumulated = 0;

  if (total === 0) {
    return (
      <div className="grid h-[88px] w-[88px] place-items-center rounded-full bg-zinc-50 dark:bg-zinc-800/50">
        <BarChart3 className="h-5 w-5 text-zinc-300 dark:text-zinc-600" />
      </div>
    );
  }

  return (
    <div className="relative grid h-[88px] w-[88px] place-items-center">
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
              strokeWidth={6}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${gap}`}
              initial={{ strokeDashoffset: circumference, opacity: 0 }}
              animate={{ strokeDashoffset: offset, opacity: 1 }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 + i * 0.05 }}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100"
        >
          {total}
        </motion.span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">votes</span>
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

/* ─── Premium Option Row ─── */
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
      type="button"
      disabled={busy || closed}
      onClick={onToggle}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.04, type: "spring", stiffness: 400, damping: 25 }}
      whileTap={{ scale: 0.98 }}
      className={`group relative w-full overflow-hidden rounded-xl border text-left transition-all disabled:cursor-not-allowed ${
        mine
          ? "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10"
          : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
      } ${isCorrect && closed ? "border-green-500/40 bg-green-500/5 dark:bg-green-500/10" : ""}`}
    >
      {/* Background progress bar */}
      {!resultsHiddenFromMe && totalVotes > 0 && (
        <motion.div
          className={`absolute inset-y-0 left-0 rounded-l-xl ${
            isCorrect ? "bg-green-500/10" : "bg-zinc-900/[0.03] dark:bg-white/[0.03]"
          }`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
        />
      )}

      <div className="relative flex items-center gap-3 px-3.5 py-3">
        {/* Selection indicator */}
        <motion.div
          className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-all ${
            mine
              ? "border-emerald-500 bg-emerald-500 text-white shadow-sm shadow-emerald-500/20"
              : "border-zinc-300 dark:border-zinc-600 group-hover:border-zinc-400 dark:group-hover:border-zinc-500"
          } ${isCorrect && closed ? "border-green-500 bg-green-500 text-white" : ""}`}
          animate={mine || (isCorrect && closed) ? { scale: [1, 1.1, 1] } : {}}
          transition={{ duration: 0.2 }}
        >
          {(mine || (isCorrect && closed)) && <Check className="h-3 w-3" strokeWidth={3} />}
        </motion.div>

        {/* Label + stats */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
              {opt.label}
            </span>
            {isCorrect && closed && (
              <span className="shrink-0 rounded-md bg-green-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-green-600 dark:text-green-400">
                Correct
              </span>
            )}
            {isLeader && !closed && !resultsHiddenFromMe && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 25 }}>
                <Crown className="h-3.5 w-3.5 shrink-0 text-amber-500" />
              </motion.div>
            )}
          </div>

          {/* Progress bar + count */}
          {!resultsHiddenFromMe && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <motion.div
                  className="h-full rounded-full bg-zinc-900 dark:bg-zinc-100"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, ease: "easeOut", delay: 0.12 }}
                />
              </div>
              <span className="shrink-0 text-[11px] tabular-nums font-semibold text-zinc-500 dark:text-zinc-400">
                {count} <span className="text-zinc-300 dark:text-zinc-600">·</span> {pct}%
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.button>
  );
}

/* ─── Custom Dropdown for Creator Actions ─── */
function CreatorDropdown({
  closed,
  resultsVisible,
  onAction,
  actionBusy,
}: {
  closed: boolean;
  resultsVisible: boolean;
  onAction: (key: string) => void;
  actionBusy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const items = [
    { key: closed ? "reopen" : "close", label: closed ? "Reopen poll" : "Close poll", icon: closed ? <RotateCcw className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" /> },
    { key: "edit", label: "Edit poll", icon: <Pencil className="h-3.5 w-3.5" /> },
    { key: resultsVisible ? "hide-results" : "show-results", label: resultsVisible ? "Hide results" : "Show results", icon: resultsVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" /> },
    { type: "divider" },
    { key: "delete", label: "Delete poll", icon: <Trash2 className="h-3.5 w-3.5" />, danger: true },
  ];

  return (
    <div className="relative" ref={ref}>
      <motion.button
        disabled={actionBusy}
        onClick={() => setOpen(!open)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 disabled:opacity-50 transition-colors"
        aria-label="Poll options"
      >
        <MoreVertical className="h-4 w-4" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-xl shadow-black/5 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/20"
          >
            {items.map((item, i) =>
              item.type === "divider" ? (
                <div key={i} className="my-1 h-px bg-zinc-100 dark:bg-zinc-800" />
              ) : (
                <button
                  key={item.key}
                  onClick={() => {
                    onAction(item.key);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-xs font-medium transition-colors ${
                    (item as any).danger
                      ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                      : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              )
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Main Component ─── */
export function PollCard({ pollId, meId }: { pollId: string; meId: string }) {
  const confirm = useConfirm();
  const [poll, setPoll] = useState<PollWithOptions | null>(null);
  const [busy, setBusy] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [showParticipation, setShowParticipation] = useState(false);
  const [participation, setParticipation] = useState<PollParticipation | null>(null);
  const [participationLoading, setParticipationLoading] = useState(false);

  const reload = async () => {
    try {
      const p = await loadPollWithResults(pollId);
      setPoll(p);
    } catch {
      // Missing/deleted poll renders nothing
    }
  };

  useEffect(() => { reload(); }, [pollId]);

  useEffect(() => {
    const channel = supabase
      .channel(`poll-${pollId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "poll_votes", filter: `poll_id=eq.${pollId}` }, reload)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "polls", filter: `id=eq.${pollId}` }, reload)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "polls", filter: `id=eq.${pollId}` }, () => setPoll(null))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [pollId]);

  const openParticipation = async () => {
    if (!poll) return;
    setShowParticipation(true);
    setParticipationLoading(true);
    try {
      const data = await getPollParticipation(poll.id, poll.chat_id);
      setParticipation(data);
    } finally {
      setParticipationLoading(false);
    }
  };

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
    <>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="max-w-[540px]"
      >
        <div className="relative overflow-hidden rounded-2xl rounded-tl-sm border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className={`grid h-8 w-8 place-items-center rounded-xl ${poll.is_quiz ? "bg-violet-500/10 text-violet-600 dark:text-violet-400" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"}`}>
                {poll.is_quiz ? <HelpCircle className="h-4 w-4" /> : <BarChart3 className="h-4 w-4" />}
              </div>
              <div>
                <p className="text-[13px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                  {poll.is_quiz ? "Quiz" : "Poll"}
                </p>
                <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                  {poll.allow_multiple ? "Multiple choice" : "Single choice"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {closed ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  <Lock className="h-3 w-3" />
                  Closed
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                  </span>
                  Live
                </span>
              )}

              {isCreator && (
                <CreatorDropdown
                  closed={closed}
                  resultsVisible={poll.results_visible}
                  onAction={(key) => {
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
                  }}
                  actionBusy={actionBusy}
                />
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

          {/* Question */}
          <div className="px-4 pb-4">
            <h3 className="text-[15px] font-semibold leading-snug tracking-tight text-zinc-900 dark:text-zinc-100">
              {poll.question}
            </h3>
          </div>

          {/* Chart + Legend */}
          {resultsHiddenFromMe ? (
            <div className="mx-4 mb-4 flex items-center gap-3 rounded-xl bg-zinc-50 px-4 py-3 text-xs font-medium text-zinc-500 dark:bg-zinc-800/50 dark:text-zinc-400">
              <EyeOff className="h-4 w-4 shrink-0 text-zinc-400" />
              <span>Results are hidden until the creator reveals them{poll.is_quiz ? " or the quiz ends" : ""}. Your vote is saved.</span>
            </div>
          ) : (
            <div className="mx-4 mb-4 flex items-center gap-4 rounded-xl bg-zinc-50/50 px-4 py-3 dark:bg-zinc-800/30">
              <PollDonut options={poll.options} counts={poll.voteCounts} total={totalVotes} />
              <div className="flex-1 space-y-2">
                {sortedOptions.slice(0, 4).map((opt) => {
                  const count = poll.voteCounts[opt.id] ?? 0;
                  const pct = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
                  const isLeader = count === maxCount && count > 0;
                  const originalIndex = poll.options.findIndex(o => o.id === opt.id);
                  const color = CHART_COLORS[originalIndex % CHART_COLORS.length];
                  
                  return (
                    <div key={opt.id} className="flex items-center gap-2">
                      <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                      <span className="flex-1 truncate text-[11px] font-medium text-zinc-600 dark:text-zinc-400">{opt.label}</span>
                      <div className="flex items-center gap-1.5">
                        {isLeader && <Crown className="h-3 w-3 text-amber-500" />}
                        <span className="text-[11px] font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Options */}
          <div className="space-y-2 px-4 pb-4">
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

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-zinc-100 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/50">
            {isCreator ? (
              <button
                type="button"
                onClick={openParticipation}
                className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 transition-colors hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400"
              >
                <Users className="h-3.5 w-3.5" />
                <span className="underline decoration-dotted underline-offset-2">
                  {totalVotes} vote{totalVotes === 1 ? "" : "s"} · who answered?
                </span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                <Users className="h-3.5 w-3.5" />
                <span>{totalVotes} vote{totalVotes === 1 ? "" : "s"}</span>
              </div>
            )}

            {poll.closes_at && (
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                <Clock className="h-3.5 w-3.5" />
                <span className="tabular-nums">{fmtRemaining(poll.closes_at)}</span>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Participation Modal */}
      <AnimatePresence>
        {showParticipation && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-md"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={() => setShowParticipation(false)}
          >
            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-white p-6 max-h-[75vh] overflow-y-auto ring-1 ring-black/5 shadow-2xl dark:bg-zinc-900 dark:ring-white/10"
            >
              <div className="flex items-center justify-between mb-5">
                <p className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Who's answered</p>
                <motion.button 
                  onClick={() => setShowParticipation(false)} 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  aria-label="Close" 
                  className="grid h-8 w-8 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
                >
                  <X className="h-4 w-4" />
                </motion.button>
              </div>

              {participationLoading ? (
                <div className="grid h-32 place-items-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
                </div>
              ) : participation ? (
                <>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    {participation.answered.length} of {participation.totalMembers} group member{participation.totalMembers === 1 ? "" : "s"} answered
                  </p>

                  <div className="mt-5 space-y-6">
                    <div>
                      <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                        <UserCheck className="h-3.5 w-3.5" /> Answered ({participation.answered.length})
                      </p>
                      {participation.answered.length === 0 ? (
                        <p className="text-xs text-zinc-400 italic">No one yet.</p>
                      ) : (
                        <div className="space-y-2.5">
                          {participation.answered.map((p) => (
                            <div key={p.userId} className="flex items-center gap-3 rounded-lg p-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                              <Avatar url={p.avatarUrl} name={p.displayName} size={32} />
                              <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{p.displayName}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        <UserX className="h-3.5 w-3.5" /> Haven't answered ({participation.notAnswered.length})
                      </p>
                      {participation.notAnswered.length === 0 ? (
                        <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Everyone's answered! 🎉</p>
                      ) : (
                        <div className="space-y-2.5">
                          {participation.notAnswered.map((p) => (
                            <div key={p.userId} className="flex items-center gap-3 rounded-lg p-1.5 opacity-60 hover:opacity-100 transition-opacity">
                              <Avatar url={p.avatarUrl} name={p.displayName} size={32} />
                              <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{p.displayName}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <p className="mt-4 text-xs text-red-500">Couldn't load participation.</p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
