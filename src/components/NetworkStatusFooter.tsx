import { useEffect, useState } from "react";
import { MdWifiOff, MdSignalWifiStatusbarConnectedNoInternet4 } from "react-icons/md";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

const COPY = {
  unstable: {
    label: "Network unstable",
    description: "Messages may be delayed until your connection improves.",
  },
  offline: {
    label: "Not connected",
    description: "Messages will send automatically when you're back online.",
  },
} as const;

export function NetworkStatusFooter() {
  const status = useNetworkStatus();
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Stagger visibility so it slides in/out instead of popping
  useEffect(() => {
    if (status !== "online") {
      setVisible(true);
      const t = setTimeout(() => setMounted(true), 10);
      return () => clearTimeout(t);
    } else {
      setMounted(false);
      const t = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(t);
    }
  }, [status]);

  if (!visible) return null;

  const { label, description } = COPY[status];
  const isOffline = status === "offline";

  return (
    <div
      className={`
        fixed inset-x-4 bottom-4 z-[70] 
        flex items-center gap-3 
        rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur-md
        transition-all duration-300 ease-out
        ${mounted ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}
        ${
          isOffline
            ? "border-red-200/60 bg-red-500/90 text-white shadow-red-900/20"
            : "border-amber-200/60 bg-amber-500/90 text-white shadow-amber-900/20"
        }
      `}
      role="status"
      aria-live="polite"
    >
      {/* Icon with a subtle badge treatment */}
      <span
        className={`
          flex h-8 w-8 shrink-0 items-center justify-center rounded-full 
          bg-white/20 ring-1 ring-white/30
        `}
      >
        {isOffline ? (
          <MdWifiOff className="h-4 w-4" />
        ) : (
          <MdSignalWifiStatusbarConnectedNoInternet4 className="h-4 w-4 animate-pulse" />
        )}
      </span>

      {/* Text lockup: label gets weight, description stays calm */}
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="font-semibold tracking-tight">{label}</span>
        <span className="text-xs opacity-85">{description}</span>
      </div>

      {/* Optional: a tiny retrying indicator for unstable */}
      {!isOffline && (
        <span className="ml-auto flex h-1.5 w-1.5 rounded-full bg-white/80 animate-ping" />
      )}
    </div>
  );
}
