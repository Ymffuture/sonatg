// src/features/classroom/PollCard.tsx
import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Tag, Badge, Tooltip, Dropdown } from "antd";
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
const CHART_COLORS = ["#34B7F1", "#00A884", "#F5B041", "#A29BFE", "#FD79A8", "#55E6C1"];

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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="min-w-[600px]"
    >
      {/* WhatsApp-style message bubble */}
      <div className="relative overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-[#1E1E1E]">
        {/* Subtle left accent strip */}
        <div className="absolute left-0 top-0 h-full w-1 bg-[#00A884]" />

        {/* ─── Header ─── */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div className="flex items-center gap-2.5">
            <div className="grid h-7 w-7 place-items-center rounded-full bg-[#00A884]/10">
              {poll.is_quiz ? (
                <HelpCircle className="h-4 w-4 text-[#00A884]" />
              ) : (
                <BarChart3 className="h-4 w-4 text-[#00A884]" />
              )}
            </div>
            <div>
              <p className="text-[13px] font-semibold text-[#111B21] dark:text-[#E9EDEF]">
                {poll.is_quiz ? "Quiz" : "Poll"}
              </p>
              <p className="text-[11px] text-[#8C8C8C]">
                {poll.allow_multiple ? "Multiple choice" : "Single choice"}
                {isCreator && <span className="ml-1 text-[#00A884]">· You</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {poll.is_quiz && (
              <Tag color="warning" className="m-0 border-0 text-xs font-medium">
                <Trophy className="mr-1 inline h-3 w-3" />
                Quiz
              </Tag>
            )}
            {closed ? (
              <span className="flex items-center gap-1 rounded-full bg-[#8C8C8C]/10 px-2.5 py-1 text-[11px] font-medium text-[#8C8C8C]">
                <Lock className="h-3 w-3" />
                Closed
              </span>
            ) : (
              <Badge
                status="processing"
                text={<span className="text-xs font-medium text-green-400">Live</span>}
              />
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
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[#8C8C8C] hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50"
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
        <div className="px-5 pb-3">
          <h3 className="text-[15px] font-semibold leading-snug text-[#111B21] dark:text-[#E9EDEF]">
            {poll.question}
          </h3>
        </div>

        {/* ─── Options ─── */}
        <div className="space-y-1.5 px-5 pb-3">
          <AnimatePresence>
            {poll.options.map((opt, idx) => {
              const count = poll.voteCounts[opt.id] ?? 0;
              const pct = resultsHiddenFromMe ? 0 : (totalVotes ? Math.round((count / totalVotes) * 100) : 0);
              const mine = poll.myVotes.includes(opt.id);
              const isCorrect = poll.is_quiz && poll.correct_option_index === idx;
              const isLeader = !resultsHiddenFromMe && count === maxCount && count > 0;
              const color = CHART_COLORS[idx % CHART_COLORS.length];

              return (
                <motion.button
                  key={opt.id}
                  type="button"
                  disabled={busy || closed}
                  onClick={() => onToggle(opt.id)}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.04, type: "spring", stiffness: 400, damping: 25 }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className={`group relative w-full overflow-hidden rounded-xl border text-left transition-all disabled:cursor-not-allowed ${
                    mine
                      ? "border-[#00A884]/40 bg-[#00A884]/[0.06]"
                      : "border-[#E9EDEF]/60 bg-[#F0F2F5]/60 hover:bg-[#F0F2F5] dark:border-[#2A3942] dark:bg-[#2A3942]/40 dark:hover:bg-[#2A3942]/60"
                  } ${isCorrect && closed ? "border-green-400/50 bg-green-400/[0.06]" : ""}`}
                >
                  {/* Background progress bar */}
                  {!resultsHiddenFromMe && (
                    <motion.div
                      className={`absolute inset-y-0 left-0 rounded-r-lg ${
                        isCorrect ? "bg-green-400/10" : "bg-[#00A884]/8"
                      }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
                    />
                  )}

                  <div className="relative flex items-center gap-3 px-3.5 py-2.5">
                    {/* Selection indicator */}
                    <div
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-colors ${
                        mine
                          ? "border-[#00A884] bg-[#00A884] text-white"
                          : "border-[#8696A0] dark:border-[#8696A0]"
                      }`}
                    >
                      {mine && <Check className="h-3 w-3" strokeWidth={3} />}
                    </div>

                    {/* Label + stats */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[13px] font-medium text-[#111B21] dark:text-[#E9EDEF]">
                          {opt.label}
                        </span>
                        {isCorrect && closed && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-green-400/15 px-2 py-0.5 text-[10px] font-semibold text-green-400">
                            <CheckCircle2 className="h-3 w-3" />
                            Correct
                          </span>
                        )}
                        {isLeader && !closed && !resultsHiddenFromMe && (
                          <Tooltip title="Leading">
                            <Crown className="h-3.5 w-3.5 shrink-0 text-[#F5B041]" />
                          </Tooltip>
                        )}
                      </div>

                      {/* Progress bar + percentage */}
                      {!resultsHiddenFromMe && (
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                            <motion.div
                              className={`h-full rounded-full ${isCorrect ? "bg-green-400" : "bg-[#00A884]"}`}
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.6, ease: "easeOut", delay: 0.12 }}
                            />
                          </div>
                          <span className="shrink-0 text-[11px] tabular-nums font-semibold text-[#8C8C8C]">
                            {count} · {pct}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>

        {/* ─── Results hidden notice ─── */}
        {resultsHiddenFromMe && (
          <div className="mx-5 mb-3 flex items-center gap-2 rounded-lg bg-[#F0F2F5] px-3 py-2.5 text-xs text-[#8C8C8C] dark:bg-[#2A3942]/40">
            <EyeOff className="h-4 w-4 shrink-0" />
            Results are hidden until the creator reveals them{poll.is_quiz ? " or the quiz ends" : ""}. Your vote is saved.
          </div>
        )}

        {/* ─── Footer ─── */}
        <div className="flex items-center justify-between border-t border-[#E9EDEF]/60 px-5 py-2.5 dark:border-[#2A3942]">
          <div className="flex items-center gap-1.5 text-xs text-[#8C8C8C]">
            <Users className="h-3.5 w-3.5" />
            <span className="font-medium">
              {totalVotes} vote{totalVotes === 1 ? "" : "s"}
            </span>
            {!resultsHiddenFromMe && totalVotes > 0 && (
              <span className="text-[#8C8C8C]/60">· {sortedOptions.length} options</span>
            )}
          </div>

          {poll.closes_at ? (
            <div className="flex items-center gap-1.5 text-xs text-[#8C8C8C]">
              <Clock className="h-3.5 w-3.5" />
              <span>{fmtRemaining(poll.closes_at)}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-[#8C8C8C]">
              <Clock className="h-3.5 w-3.5" />
              <span>No deadline</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
