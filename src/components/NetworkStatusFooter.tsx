import { MdWifiOff, MdSignalWifiStatusbarConnectedNoInternet4 } from "react-icons/md";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

const COPY = {
  unstable: { label: "Network unstable", description: "Your connection is weak — messages may be delayed." },
  offline: { label: "Not connected", description: "Check your internet connection. Messages will send once you're back online." },
} as const;

/**
 * A slim footer banner that appears only when there's actually something
 * wrong with the connection — amber for "technically connected but bad",
 * red for "no connection at all" — and disappears the instant the
 * connection recovers. Deliberately renders nothing while online so it
 * never sits on top of the composer during normal use.
 */
export function NetworkStatusFooter() {
  const status = useNetworkStatus();
  if (status === "online") return null;

  const { label, description } = COPY[status];
  const Icon = status === "offline" ? MdWifiOff : MdSignalWifiStatusbarConnectedNoInternet4;
  const tone =
    status === "offline"
      ? "bg-red-500 text-white"
      : "bg-amber-500 text-white";

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-[70] flex items-center gap-2 px-3 py-2 text-xs shadow-[0_-2px_8px_rgba(0,0,0,0.15)] transition-colors duration-300 ${tone}`}
      role="status"
      aria-live="polite"
    >
      <Icon className="h-4 w-4 shrink-0 animate-pulse" />
      <span className="font-semibold">{label}</span>
      <span className="truncate opacity-90">— {description}</span>
    </div>
  );
}

