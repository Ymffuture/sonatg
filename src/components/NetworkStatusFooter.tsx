import { MdWifiOff, MdSignalWifiStatusbarConnectedNoInternet4 } from "react-icons/md";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

const STATUS_CONFIG = {
  unstable: {
    icon: MdSignalWifiStatusbarConnectedNoInternet4,
    label: "Connection unstable",
    message: "Messages may be delayed",
    className: "bg-amber-500/95",
  },
  offline: {
    icon: MdWifiOff,
    label: "Offline",
    message: "Reconnecting...",
    className: "bg-red-500/95",
  },
} as const;

export function NetworkStatusFooter() {
  const status = useNetworkStatus();
  if (status === "online") return null;

  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <div
      className={`fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition-all duration-300 ${config.className}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2.5">
        <Icon className="h-4 w-4 animate-pulse" />
        <span>{config.label}</span>
        <span className="opacity-80">·</span>
        <span className="opacity-80">{config.message}</span>
      </div>
    </div>
  );
}
