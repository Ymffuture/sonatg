// src/features/moderation/ModerationAlert.tsx
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ShieldAlert, X } from "lucide-react";
import type { ModerationResult } from "./types";

interface ModerationAlertProps {
  result: ModerationResult;
  onDismiss?: () => void;
  autoDismissMs?: number;
}

export function ModerationAlert({ result, onDismiss, autoDismissMs }: ModerationAlertProps) {
  if (!result.shouldLog && result.allowed) return null;

  const blocked = !result.allowed;
  const topSignal = result.patternSignals[0]?.description;
  const topWord = result.wordMatches[0]?.category;

  // Optional auto-dismiss
  useEffect(() => {
    if (!autoDismissMs || !onDismiss) return;
    const t = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(t);
  }, [autoDismissMs, onDismiss]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={blocked ? "blocked" : "flagged"}
        role="alert"
        initial={{ opacity: 0, y: -12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        className={`relative overflow-hidden rounded-2xl border backdrop-blur-xl ${
          blocked
            ? "border-red-400/20 bg-red-500/[0.06] dark:bg-red-500/[0.08]"
            : "border-[#E07A5F]/20 bg-[#E07A5F]/[0.05] dark:bg-[#E07A5F]/[0.06]"
        }`}
      >
        {/* Subtle gradient glow */}
        <div
          className={`absolute inset-0 opacity-30 pointer-events-none ${
            blocked
              ? "bg-gradient-to-r from-red-500/10 via-transparent to-transparent"
              : "bg-gradient-to-r from-[#E07A5F]/10 via-transparent to-transparent"
          }`}
        />

        <div className="relative flex items-start gap-3 px-4 py-3">
          {/* Icon */}
          <motion.div
            initial={{ scale: 0.5, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.08, type: "spring", stiffness: 400, damping: 20 }}
            className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl ${
              blocked
                ? "bg-red-500/10 text-red-500 dark:text-red-400"
                : "bg-[#E07A5F]/10 text-[#E07A5F]"
            }`}
          >
            {blocked ? <ShieldAlert className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          </motion.div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-0.5">
            <motion.p
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className={`text-sm font-semibold ${
                blocked
                  ? "text-red-600 dark:text-red-400"
                  : "text-[#2D3436] dark:text-[#E8E8E8]"
              }`}
            >
              {blocked ? "This message can't be sent" : "Community guideline notice"}
            </motion.p>

            <motion.p
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.14 }}
              className="text-xs leading-relaxed text-[#8C8C8C] dark:text-[#8C8C8C]"
            >
              {blocked
                ? "It contains language that isn't allowed in this space."
                : "Sent successfully, but flagged for moderator review."}
              {topSignal ? (
                <span className="ml-1 opacity-70">· {topSignal}</span>
              ) : topWord ? (
                <span className="ml-1 opacity-70">· {topWord}</span>
              ) : null}
            </motion.p>
          </div>

          {/* Dismiss */}
          {onDismiss && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.18 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              type="button"
              onClick={onDismiss}
              className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full transition-colors ${
                blocked
                  ? "text-red-400 hover:bg-red-500/10"
                  : "text-[#8C8C8C] hover:bg-[#E07A5F]/10 hover:text-[#E07A5F]"
              }`}
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </motion.button>
          )}
        </div>

        {/* Bottom accent line */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.2, duration: 0.4, ease: "easeOut" }}
          className={`h-[2px] origin-left ${
            blocked ? "bg-red-400/40" : "bg-[#E07A5F]/40"
          }`}
        />
      </motion.div>
    </AnimatePresence>
  );
}
