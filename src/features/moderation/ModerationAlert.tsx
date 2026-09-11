// src/features/moderation/ModerationAlert.tsx
import { useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ShieldAlert, X } from "lucide-react";
import type { ModerationResult } from "./types";

interface ModerationAlertProps {
  result: ModerationResult;
  onDismiss?: () => void;
  autoDismissMs?: number;
}

// Extracted variants for cleaner, staggered animations
const containerVariants = {
  hidden: { opacity: 0, y: -12, scale: 0.96 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { type: "spring", stiffness: 400, damping: 30, mass: 0.8 }
  },
  exit: { 
    opacity: 0, 
    y: -8, 
    scale: 0.98,
    transition: { duration: 0.2, ease: "easeInOut" }
  }
};

const iconVariants = {
  hidden: { scale: 0.5, rotate: -10 },
  visible: { 
    scale: 1, 
    rotate: 0,
    transition: { delay: 0.05, type: "spring", stiffness: 400, damping: 20 }
  }
};

const contentVariants = {
  hidden: { opacity: 0, x: -6 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: 0.05 * i, duration: 0.3, ease: "easeOut" }
  })
};

export function ModerationAlert({ result, onDismiss, autoDismissMs }: ModerationAlertProps) {
  if (!result.shouldLog && result.allowed) return null;

  const blocked = !result.allowed;
  const topSignal = result.patternSignals[0]?.description;
  const topWord = result.wordMatches[0]?.category;

  useEffect(() => {
    if (!autoDismissMs || !onDismiss) return;
    const t = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(t);
  }, [autoDismissMs, onDismiss]);

  // Memoized theme classes for optimal performance and readability
  const theme = useMemo(() => blocked
    ? {
        border: "border-red-500/20 dark:border-red-500/30",
        bg: "bg-red-500/[0.04] dark:bg-red-500/[0.08]",
        ring: "ring-red-500/10 dark:ring-red-500/20",
        iconBg: "bg-red-500/10 dark:bg-red-500/20",
        iconText: "text-red-600 dark:text-red-400",
        title: "text-red-700 dark:text-red-400",
        glow: "from-red-500/5 via-transparent to-transparent",
        accent: "bg-red-500/40",
        dismissHover: "hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400",
      }
    : {
        border: "border-[#E07A5F]/20 dark:border-[#E07A5F]/30",
        bg: "bg-[#E07A5F]/[0.04] dark:bg-[#E07A5F]/[0.08]",
        ring: "ring-[#E07A5F]/10 dark:ring-[#E07A5F]/20",
        iconBg: "bg-[#E07A5F]/10 dark:bg-[#E07A5F]/20",
        iconText: "text-[#E07A5F] dark:text-[#E89B84]", // Slightly lighter for dark mode contrast
        title: "text-zinc-900 dark:text-zinc-100",
        glow: "from-[#E07A5F]/5 via-transparent to-transparent",
        accent: "bg-[#E07A5F]/40",
        dismissHover: "hover:bg-[#E07A5F]/10 hover:text-[#E07A5F] dark:hover:text-[#E89B84]",
      }, [blocked]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={blocked ? "blocked" : "flagged"}
        role="alert"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className={`relative overflow-hidden rounded-2xl border backdrop-blur-xl shadow-sm ring-1 ${theme.border} ${theme.bg} ${theme.ring}`}
      >
        {/* Subtle gradient glow */}
        <div className={`absolute inset-0 bg-gradient-to-r ${theme.glow} opacity-60 pointer-events-none`} />

        <div className="relative flex items-start gap-3.5 px-4 py-3.5">
          {/* Icon */}
          <motion.div
            variants={iconVariants}
            initial="hidden"
            animate="visible"
            className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl ${theme.iconBg} ${theme.iconText}`}
          >
            {blocked ? <ShieldAlert className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          </motion.div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-1">
            <motion.p
              custom={1}
              variants={contentVariants}
              initial="hidden"
              animate="visible"
              className={`text-sm font-semibold tracking-tight ${theme.title}`}
            >
              {blocked ? "Message restricted" : "Community guideline notice"}
            </motion.p>

            <motion.p
              custom={2}
              variants={contentVariants}
              initial="hidden"
              animate="visible"
              className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400"
            >
              {blocked
                ? "This message contains language that isn't allowed in this space."
                : "Sent successfully, but flagged for moderator review."}
              
              {(topSignal || topWord) && (
                <span className="ml-1.5 inline-flex items-center">
                  <span className="mx-1.5 text-zinc-300 dark:text-zinc-600">·</span>
                  <span className="font-medium text-zinc-600 dark:text-zinc-300">
                    {topSignal || topWord}
                  </span>
                </span>
              )}
            </motion.p>
          </div>

          {/* Dismiss */}
          {onDismiss && (
            <motion.button
              custom={3}
              variants={contentVariants}
              initial="hidden"
              animate="visible"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={onDismiss}
              className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-zinc-400 dark:text-zinc-500 transition-colors ${theme.dismissHover}`}
              aria-label="Dismiss alert"
            >
              <X className="h-3.5 w-3.5" />
            </motion.button>
          )}
        </div>

        {/* Bottom accent line */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.25, duration: 0.4, ease: "easeOut" }}
          className={`absolute bottom-0 left-0 right-0 h-[2px] origin-left ${theme.accent}`}
        />
      </motion.div>
    </AnimatePresence>
  );
}
