import { motion, AnimatePresence } from "framer-motion";
import { MdWifiOff, MdSignalWifiStatusbarConnectedNoInternet4 } from "react-icons/md";
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
 * A premium, floating network status banner. 
 * Appears as a glassmorphic pill at the bottom center, using smooth 
 * spring animations and subtle translucent colors to avoid visual clutter.
 */
export function NetworkStatusFooter() {
  const status = useNetworkStatus();
  if (status === "online") return null;

  const { label, description } = COPY[status];
  const Icon = status === "offline" ? MdWifiOff : MdSignalWifiStatusbarConnectedNoInternet4;
  const isOffline = status === "offline";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 100, opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className={`fixed bottom-6 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-2xl transition-all duration-300 ${
          isOffline 
            ? "bg-red-500/10 dark:bg-red-500/10 border-red-500/20 dark:border-red-500/20" 
            : "bg-amber-500/10 dark:bg-amber-500/10 border-amber-500/20 dark:border-amber-500/20"
        }`}
        role="status"
        aria-live="polite"
      >
        {/* Icon with subtle pulsing ring */}
        <div className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/60 dark:bg-black/40 ${
          isOffline ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"
        }`}>
          <Icon className="h-5 w-5" />
          <span className={`absolute inset-0 rounded-full animate-ping opacity-20 ${isOffline ? "bg-red-500" : "bg-amber-500"}`} />
        </div>
        
        {/* Text content */}
        <div className="flex flex-col pr-2">
          <span className={`text-sm font-bold leading-tight ${
            isOffline ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"
          }`}>
            {label}
          </span>
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 leading-snug mt-0.5">
            {description}
          </span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
