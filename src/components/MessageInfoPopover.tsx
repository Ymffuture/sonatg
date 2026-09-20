// src/components/MessageInfoPopover.tsx
//
// "Message info" — a full-screen page reachable from a message's own action
// menu (own messages only) showing its real delivery lifecycle:
// Sending → Sent → Delivered → Read, each with the actual timestamp of the
// backing event. No stage is ever inferred from a timer — every checkmark
// here corresponds to a real row (the message's own created_at, or the
// earliest matching message_deliveries / message_reads row from another
// member). A failed send shows a Retry action instead, wired to the same
// retry path used elsewhere.
//
// In a group chat this also breaks the aggregate timeline down per member —
// exactly who has read the message and when, who it's only reached but not
// opened, and who it hasn't reached yet — since "Read" on a group message
// otherwise hides real information (WhatsApp calls this the same screen).

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Info, Check, CheckCheck, Clock, AlertTriangle, RotateCcw,
} from "lucide-react";
import { fmtTime, type MessageRow, type MessageReadRow, type MessageDeliveryRow, type Profile } from "@/lib/db";
import { messageLifecycleFor, type MessageLifecycleStage } from "@/utils/utils";
import { useBackToClose } from "@/hooks/useBackStack";
import { Avatar } from "./Avatar";
import { MessagePreview } from "./SonaChatParts";

const STAGE_META: Record<
  Exclude<MessageLifecycleStage, "sending" | "failed">,
  { label: string; icon: React.ReactNode; explain: string }
> = {
  sent: {
    label: "Sent",
    icon: <Check className="h-4 w-4" />,
    explain: "Left your device and reached our server.",
  },
  delivered: {
    label: "Delivered",
    icon: <CheckCheck className="h-4 w-4" />,
    explain: "Reached the recipient's device — they may not have opened the chat yet.",
  },
  read: {
    label: "Read",
    icon: <CheckCheck className="h-4 w-4 text-sky-500" />,
    explain: "Opened this chat and saw the message.",
  },
};

// Order matters: a completed later stage implies every earlier stage also
// completed, so "Read" renders Sent + Delivered + Read all with timestamps.
const STAGE_ORDER: Exclude<MessageLifecycleStage, "sending" | "failed">[] = [
  "sent",
  "delivered",
  "read",
];

export function MessageInfoPopover({
  message,
  reads,
  deliveries,
  memberIds,
  meId,
  members,
  isGroup,
  decrypted,
  onClose,
  onRetry,
}: {
  message: MessageRow;
  reads: MessageReadRow[];
  deliveries: MessageDeliveryRow[];
  memberIds: string[];
  meId: string;
  /** Full member profiles, used to render avatars + names in the per-person
   *  breakdown. Falls back to the aggregate timeline only if omitted. */
  members?: Profile[];
  /** Renders the per-member "Read by / Delivered to / Sent to" breakdown. */
  isGroup?: boolean;
  decrypted?: Record<string, string>;
  onClose: () => void;
  /** Re-attempts sending this exact message. Only rendered when the send failed. */
  onRetry: () => void;
}) {
  useBackToClose(onClose);
  const panelRef = useRef<HTMLDivElement>(null);

  const lifecycle = messageLifecycleFor(message, reads, deliveries, memberIds, meId);

  // Focus the page on mount and close on Escape.
  useEffect(() => {
    panelRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const reachedStageIndex =
    lifecycle.stage === "read"
      ? 2
      : lifecycle.stage === "delivered"
        ? 1
        : lifecycle.stage === "sent"
          ? 0
          : -1;

  // ─── Per-member breakdown (group chats only) ───────────────────────
  // A member falls into exactly one bucket, in priority order: read →
  // delivered → sent-only. Every bucket is sourced from a real row (or its
  // absence) — nothing here is inferred from a timer either.
  const others = memberIds.filter((id) => id !== meId);
  const membersById = new Map((members ?? []).map((m) => [m.id, m]));
  const readByMember = new Map(
    reads.filter((r) => r.message_id === message.id).map((r) => [r.user_id, r.read_at]),
  );
  const deliveredByMember = new Map(
    deliveries.filter((d) => d.message_id === message.id).map((d) => [d.user_id, d.delivered_at]),
  );

  const readBy = others.filter((id) => readByMember.has(id));
  const deliveredOnly = others.filter((id) => !readByMember.has(id) && deliveredByMember.has(id));
  const notYetDelivered = others.filter((id) => !readByMember.has(id) && !deliveredByMember.has(id));

  const showPerMemberBreakdown =
    isGroup && others.length > 1 && (lifecycle.stage === "sent" || lifecycle.stage === "delivered" || lifecycle.stage === "read");

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="message-info-title"
      tabIndex={-1}
      ref={panelRef}
      initial={{ y: "100%", opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: "100%", opacity: 0 }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      className="fixed inset-0 z-[110] flex flex-col bg-white dark:bg-zinc-950 outline-none"
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-zinc-200/50 dark:border-zinc-800/50 px-4 py-4 shrink-0">
        <button
          onClick={onClose}
          aria-label="Back"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-zinc-700 dark:text-zinc-300" />
        </button>
        <h3
          id="message-info-title"
          className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-50"
        >
          <Info className="h-4 w-4 text-[var(--sona-accent,#E07A5F)]" />
          Message info
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="mx-auto w-full max-w-lg px-4 py-5">
          {/* ─── Message preview: what this info page is actually about ─── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.3 }}
            className="mb-6 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-900/50 p-4"
          >
            <div className="text-sm text-zinc-800 dark:text-zinc-200 break-words">
              <MessagePreview msg={message} decrypted={decrypted} />
            </div>
            <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
              Sent {fmtTime(message.created_at)}
            </div>
          </motion.div>

          {/* ─── Aggregate lifecycle timeline ─── */}
          {lifecycle.stage === "sending" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400"
              aria-live="polite"
            >
              <Clock className="h-4 w-4 animate-pulse" />
              Sending…
            </motion.div>
          )}

          {lifecycle.stage === "failed" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col gap-3"
              aria-live="polite"
            >
              <div className="flex items-center gap-2.5 text-sm font-medium text-red-500">
                <AlertTriangle className="h-4 w-4" />
                Failed to send
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                This message never left your device. Retry to send it again.
              </p>
              <button
                onClick={onRetry}
                className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[var(--sona-accent,#E07A5F)] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-transform active:scale-95"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Retry
              </button>
            </motion.div>
          )}

          {(lifecycle.stage === "sent" ||
            lifecycle.stage === "delivered" ||
            lifecycle.stage === "read") && (
            <ol className="flex flex-col gap-5" aria-label="Message delivery timeline">
              {STAGE_ORDER.map((stage, i) => {
                const done = i <= reachedStageIndex;
                const ts =
                  stage === "sent"
                    ? lifecycle.sentAt
                    : stage === "delivered"
                      ? lifecycle.deliveredAt
                      : lifecycle.readAt;
                const meta = STAGE_META[stage];
                return (
                  <motion.li
                    key={stage}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.08, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="flex items-start gap-4"
                    aria-current={i === reachedStageIndex ? "step" : undefined}
                  >
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors duration-300 ${
                        done
                          ? "bg-[var(--sona-accent,#E07A5F)]/10 text-[var(--sona-accent,#E07A5F)]"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-300 dark:text-zinc-600"
                      }`}
                    >
                      {meta.icon}
                    </span>
                    <div className="flex-1 pt-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-medium ${done ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-400 dark:text-zinc-600"}`}
                        >
                          {meta.label}
                        </span>
                        {done && ts && (
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">
                            {fmtTime(ts)}
                          </span>
                        )}
                      </div>
                      <p className={`mt-0.5 text-xs ${done ? "text-zinc-500 dark:text-zinc-400" : "text-zinc-300 dark:text-zinc-700"}`}>
                        {meta.explain}
                      </p>
                    </div>
                  </motion.li>
                );
              })}
            </ol>
          )}

          {/* ─── Per-member breakdown (groups only) ─── */}
          {showPerMemberBreakdown && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35, duration: 0.3 }}
              className="mt-8 space-y-6"
            >
              <MemberGroup
                label="Read by"
                icon={<CheckCheck className="h-3.5 w-3.5 text-sky-500" />}
                count={readBy.length}
                total={others.length}
                ids={readBy}
                membersById={membersById}
                timeByMember={readByMember}
              />
              <MemberGroup
                label="Delivered to"
                icon={<CheckCheck className="h-3.5 w-3.5 text-zinc-400" />}
                count={deliveredOnly.length}
                total={others.length}
                ids={deliveredOnly}
                membersById={membersById}
                timeByMember={deliveredByMember}
              />
              <MemberGroup
                label="Not yet delivered"
                icon={<Clock className="h-3.5 w-3.5 text-zinc-400" />}
                count={notYetDelivered.length}
                total={others.length}
                ids={notYetDelivered}
                membersById={membersById}
              />
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/** One collapsible-by-emptiness section of the group breakdown: a header
 *  ("Read by 3 of 5") plus a row per member with their avatar, name, and —
 *  where one exists — the exact timestamp for that bucket. */
function MemberGroup({
  label,
  icon,
  count,
  total,
  ids,
  membersById,
  timeByMember,
}: {
  label: string;
  icon: React.ReactNode;
  count: number;
  total: number;
  ids: string[];
  membersById: Map<string, Profile>;
  timeByMember?: Map<string, string>;
}) {
  if (ids.length === 0) return null;
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
        {icon}
        {label} · {count}/{total}
      </div>
      <div className="space-y-1">
        {ids.map((id) => {
          const p = membersById.get(id);
          const ts = timeByMember?.get(id);
          return (
            <div
              key={id}
              className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
            >
              <Avatar url={p?.avatar_url} name={p?.display_name ?? "Member"} size={36} ai={p?.is_ai} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {p?.display_name ?? "Unknown member"}
                </div>
              </div>
              {ts && (
                <div className="shrink-0 text-xs text-zinc-500 dark:text-zinc-500">{fmtTime(ts)}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
