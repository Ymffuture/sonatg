import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@heroui/react";
import { MdWifiOff, MdSignalWifiStatusbarConnectedNoInternet4, MdClose } from "react-icons/md";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

const COPY = {
  unstable: {
    label: "Network unstable",
    description: "Your connection is weak — messages may be delayed.",
  },
  offline: {
    label: "Not connected",
    description: "Check your internet connection. Messages will send once you're back online.",
  },
} as const;

export function NetworkStatusFooter() {
  const status = useNetworkStatus();
  const [dismissed, setDismissed] = useState(false);

  /**
   * Pending resolver for the reconnect toast.promise. Created when the
   * connection drops, resolved when we're back online — the single toast
   * morphs loading → success without stacking duplicates.
   */
  const reconnectResolverRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setDismissed(false);
  }, [status]);

  // Fire a HeroUI toast.promise when the connection drops: "Reconnecting…"
  // with a loading spinner until we're back online, then it flips to success.
  useEffect(() => {
    if (status === "online") {
      // Resolve any pending reconnect promise → success toast
      reconnectResolverRef.current?.();
      reconnectResolverRef.current = null;
      return;
    }

    // Only start one pending toast across unstable → offline flaps
    if (reconnectResolverRef.current) return;

    const reconnectPromise = new Promise<void>((resolve) => {
      reconnectResolverRef.current = resolve;
    });

    toast.promise(reconnectPromise, {
      loading: "Reconnecting…",
      success: "Back online — you're connected again",
      error: "Connection failed",
    });
  }, [status]);

  if (status === "online" || dismissed) return null;

  const { label, description } = COPY[status];
  const Icon = status === "offline" ? MdWifiOff : MdSignalWifiStatusbarConnectedNoInternet4;

  const isOffline = status === "offline";
  const gradient = isOffline
    ? "from-red-500/90 via-red-500/85 to-rose-500/90"
    : "from-amber-500/90 via-orange-500/85 to-amber-500/90";
  const glow = isOffline ? "shadow-red-500/30" : "shadow-amber-500/30";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 100, opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
        className="fixed inset-x-0 bottom-4 z-[70] flex justify-center px-4"
        role="status"
        aria-live="polite"
      >
        <div className="relative w-full max-w-md">
          {/* Ambient glow */}
          <div className={`absolute inset-0 rounded-2xl bg-gradient-to-r ${gradient} blur-xl opacity-60 ${glow}`} />

          {/* Main container */}
          <motion.div
            initial={{ scale: 0.98 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.05, duration: 0.2 }}
            className={`relative overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-r ${gradient} shadow-2xl ${glow} backdrop-blur-xl`}
          >
            {/* Noise texture overlay */}
            <div
              className="pointer-events-none absolute inset-0 opacity-20 mix-blend-overlay"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.06 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
              }}
            />

            {/* Shine effect */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/5" />

            {/* Content */}
            <div className="relative flex items-center gap-3 px-4 py-3">
              {/* Animated icon */}
              <motion.div
                animate={{
                  scale: [1, 1.1, 1],
                  opacity: [1, 0.7, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/20 backdrop-blur-sm ring-1 ring-white/30"
              >
                <Icon className="h-5 w-5 text-white" />
              </motion.div>

              {/* Text content with text-rotate */}
              <div className="min-w-0 flex-1">
                <span className="text-rotate">
                  <span>
                    <span className="text-[13px] font-semibold tracking-tight text-white">
                      {label}
                    </span>
                    <span className="truncate text-[11px] leading-relaxed text-white/85">
                      — <marquee >{description}</marquee>
                    </span>
                    {isOffline && (
                      <motion.span
                        animate={{ opacity: [1, 0.5, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="ml-1 text-[11px] font-medium text-white"
                      >
                        Connecting...
                      </motion.span>
                    )}
                  </span>
                </span>
              </div>

              {/* Dismiss button */}
              <motion.button
                type="button"
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                onClick={() => setDismissed(true)}
                aria-label="Dismiss"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-white/90 backdrop-blur-sm ring-1 ring-white/20 transition hover:bg-white/20"
              >
                <MdClose className="h-3.5 w-3.5" />
              </motion.button>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
