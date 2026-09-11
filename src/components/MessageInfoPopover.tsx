// src/components/MessageInfoPopover.tsx
//
// "Message info" — a small, focused popover reachable from a message's own
// action menu (own messages only) showing its real delivery lifecycle:
// Sending → Sent → Delivered → Read, each with the actual timestamp of the
// backing event. No stage is ever inferred from a timer — every checkmark
// here corresponds to a real row (the message's own created_at, or the
// earliest matching message_deliveries / message_reads row from another
// member). A failed send shows a Retry action instead, wired to the same
// retry path used elsewhere.

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Info, X, Check, CheckCheck, Clock, AlertTriangle, RotateCcw } from "lucide-react";
import { fmtTime, type MessageRow, type MessageReadRow, type MessageDeliveryRow } from "@/lib/db";
import { messageLifecycleFor, type MessageLifecycleStage } from "@/utils/utils";
import { useBackToClose } from "@/hooks/useBackStack";

const STAGE_META: Record<
  Exclude<MessageLifecycleStage, "sending" | "failed">,
  { label: string; icon: React.ReactNode }
> = {
  sent: { label: "Sent", icon: <Check className="h-4 w-4" /> },
  delivered: { label: "Delivered", icon: <CheckCheck className="h-4 w-4" /> },
  read: { label: "Read", icon: <CheckCheck className="h-4 w-4 text-sky-500" /> },
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
  onClose,
  onRetry,
}: {
  message: MessageRow;
  reads: MessageReadRow[];
  deliveries: MessageDeliveryRow[];
  memberIds: string[];
  meId: string;
  onClose: () => void;
  /** Re-attempts sending this exact message. Only rendered when the send failed. */
  onRetry: () => void;
}) {
  useBackToClose(onClose);
  const panelRef = useRef<HTMLDivElement>(null);

  const lifecycle = messageLifecycleFor(message, reads, deliveries, memberIds, meId);

  // Focus the panel on mount, close on Escape, and keep Tab focus trapped
  // inside the panel while it's open.
  useEffect(() => {
    panelRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
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

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/50 backdrop-blur-sm md:items-center"
      onClick={onClose}
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="message-info-title"
        tabIndex={-1}
        initial={{ y: 24, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 24, opacity: 0, scale: 0.98 }}
        transition={{ type: "spring", damping: 30, stiffness: 340 }}
        className="w-full max-w-[300px] overflow-hidden rounded-3xl border border-zinc-200/60 dark:border-zinc-800/60 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-2xl shadow-2xl mb-[env(safe-area-inset-bottom)] md:mb-0 outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200/50 dark:border-zinc-800/50 px-4 py-3">
          <h3
            id="message-info-title"
            className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-50"
          >
            <Info className="h-4 w-4 text-[var(--sona-accent,#E07A5F)]" />
            Message info
          </h3>
          <button
            onClick={onClose}
            aria-label="Close message info"
            className="grid h-7 w-7 place-items-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
          </button>
        </div>

        <div className="px-4 py-4">
          {lifecycle.stage === "sending" && (
            <div
              className="flex items-center gap-2.5 text-sm text-zinc-500 dark:text-zinc-400"
              aria-live="polite"
            >
              <Clock className="h-4 w-4 animate-pulse" />
              Sending…
            </div>
          )}

          {lifecycle.stage === "failed" && (
            <div className="flex flex-col gap-3" aria-live="polite">
              <div className="flex items-center gap-2.5 text-sm font-medium text-red-500">
                <AlertTriangle className="h-4 w-4" />
                Failed to send
              </div>
              <button
                onClick={onRetry}
                className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[var(--sona-accent,#E07A5F)] px-3.5 py-1.5 text-xs font-semibold text-white"
              >
                <RotateCcw className="h-3 w-3" /> Retry
              </button>
            </div>
          )}

          {(lifecycle.stage === "sent" ||
            lifecycle.stage === "delivered" ||
            lifecycle.stage === "read") && (
            <ol className="flex flex-col gap-3" aria-label="Message delivery timeline">
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
                  <li
                    key={stage}
                    className="flex items-center gap-3"
                    aria-current={i === reachedStageIndex ? "step" : undefined}
                  >
                    <span
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                        done
                          ? "bg-[var(--sona-accent,#E07A5F)]/10 text-[var(--sona-accent,#E07A5F)]"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-300 dark:text-zinc-700"
                      }`}
                    >
                      {meta.icon}
                    </span>
                    <div className="flex-1">
                      <div
                        className={`text-sm font-medium ${done ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-400 dark:text-zinc-600"}`}
                      >
                        {meta.label}
                      </div>
                      {done && ts && (
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          {fmtTime(ts)}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </motion.div>
    </div>
  );
}
