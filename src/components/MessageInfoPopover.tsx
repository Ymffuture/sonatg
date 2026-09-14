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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/40 backdrop-blur-md md:bg-black/30 md:items-center"
      onClick={onClose}
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="message-info-title"
        tabIndex={-1}
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[320px] overflow-hidden rounded-t-3xl md:rounded-3xl border border-zinc-200/60 dark:border-zinc-800/60 bg-gradient-to-b from-white/95 to-white/90 dark:from-zinc-950/95 dark:to-zinc-950/90 backdrop-blur-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.6)] ring-1 ring-black/5 dark:ring-white/10 mb-[env(safe-area-inset-bottom)] md:mb-0 outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200/50 dark:border-zinc-800/50 px-5 py-4">
          <h3
            id="message-info-title"
            className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50"
          >
            <Info className="h-4 w-4 text-[var(--sona-accent,#E07A5F)]" />
            Message info
          </h3>
          <button
            onClick={onClose}
            aria-label="Close message info"
            className="grid h-8 w-8 place-items-center rounded-full bg-zinc-100/50 hover:bg-zinc-200/80 dark:bg-zinc-800/50 dark:hover:bg-zinc-700/80 transition-colors"
          >
            <X className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
          </button>
        </div>

        <div className="px-5 py-5">
          {lifecycle.stage === "sending" && (
            <div
              className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400"
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
                className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[var(--sona-accent,#E07A5F)] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-transform active:scale-95"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Retry
              </button>
            </div>
          )}

          {(lifecycle.stage === "sent" ||
            lifecycle.stage === "delivered" ||
            lifecycle.stage === "read") && (
            <ol className="flex flex-col gap-4" aria-label="Message delivery timeline">
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
                    className="flex items-center gap-4"
                    aria-current={i === reachedStageIndex ? "step" : undefined}
                  >
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors duration-300 ${
                        done
                          ? "bg-[var(--sona-accent,#E07A5F)]/10 text-[var(--sona-accent,#E07A5F)]"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-300 dark:text-zinc-600"
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
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
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
    </motion.div>
  );
}
