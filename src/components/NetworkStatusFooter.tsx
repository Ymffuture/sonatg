import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MdWifiOff, MdSignalWifiStatusbarConnectedNoInternet4, MdClose } from "react-icons/md";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

const COPY = {
  unstable: { 
    label: "Unstable connection", 
    description: "Your network is weak. Messages may be delayed." 
  },
  offline: { 
    label: "No internet connection", 
    description: "Check your settings. Messages will send when you're back online." 
  },
} as const;

/**
 * A premium, full-width network status banner. 
 * Pinned to the bottom edge (bottom-0) to avoid overlap with content.
 * Includes a dismiss button with smooth exit animations.
 */
export function NetworkStatusFooter() {
  const status = useNetworkStatus();
  const [isDismissed, setIsDismissed] = useState(false);

  // Reset dismissed state if the network status changes (e.g., goes from unstable to offline)
  useEffect(() => {
    setIsDismissed(false);
  }, [status]);

  const isOffline = status === "offline";
  const { label, description } = COPY[status];
  const Icon = isOffline ? MdWifiOff : MdSignalWifiStatusbarConnectedNoInternet4;

  return (
    // AnimatePresence must wrap the conditionally rendered motion.div for exit animations to work
    <AnimatePresence>
      {status !== "online" && !isDismissed && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className={`fixed bottom-0 inset-x-0 z-[70] w-full border-t shadow-2xl backdrop-blur-2xl transition-all duration-300 ${
            isOffline 
              ? "bg-red-500/10 dark:bg-red-500/10 border-red-500/20 dark:border-red-500/20" 
              : "bg-amber-500/10 dark:bg-amber-500/10 border-amber-500/20 dark:border-amber-500/20"
          }`}
          role="status"
          aria-live="polite"
        >
          {/* Inner container to constrain content width on large screens */}
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-3">
            <div className="flex items-center gap-3">
              {/* Icon with subtle pulsing ring */}
              <div className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/60 dark:bg-black/40 ${
                isOffline ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"
              }`}>
                <Icon className="h-5 w-5" />
                <span className={`absolute inset-0 rounded-full animate-ping opacity-20 ${isOffline ? "bg-red-500" : "bg-amber-500"}`} />
              </div>
              
              {/* Text content */}
              <div className="flex flex-col">
                <span className={`text-sm font-bold leading-tight ${
                  isOffline ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"
                }`}>
                  {label}
                </span>
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 leading-snug mt-0.5">
                  {description}
                </span>
              </div>
            </div>

            {/* Dismiss Button */}
            <button
              type="button"
              onClick={() => setIsDismissed(true)}
              className={`shrink-0 rounded-full p-1.5 transition-colors hover:bg-black/5 dark:hover:bg-white/10 ${
                isOffline ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"
              }`}
              aria-label="Dismiss network status"
            >
              <MdClose className="h-5 w-5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
