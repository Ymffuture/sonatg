import { useEffect, useState } from "react";
import { MdWifiOff, MdSignalWifiStatusbarConnectedNoInternet4, MdClose } from "react-icons/md";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

const COPY = {
  unstable: { label: "Network unstable", description: "Your connection is weak — messages may be delayed." },
  offline: { label: "Not connected", description: "Check your internet connection. Messages will send once you're back online." },
} as const;

export function NetworkStatusFooter() {
  const status = useNetworkStatus();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [status]);

  if (status === "online" || dismissed) return null;

  const { label, description } = COPY[status];
  const Icon = status === "offline" ? MdWifiOff : MdSignalWifiStatusbarConnectedNoInternet4;
  const tone =
    status === "offline"
      ? "bg-red-500 text-white"
      : "bg-amber-500 text-white";

  return (
    <div
      className={`fixed inset-x-0 mt-4 bottom-0 z-[70] flex items-center gap-2 px-3 py-2 text-[7px] shadow-[0_-2px_8px_rgba(0,0,0,0.10)] transition-colors duration-300 ${tone}`}
      role="status"
      aria-live="polite"
    >
      <Icon className="h-4 w-4 shrink-0 animate-pulse" />
      <span className="text-rotate">
  <span>
    <span className="font-semibold">{label}</span>
      <span className="truncate opacity-90">— {description}</span>
      
    <span className="text-gray-600 animate-pulse" >Connecting... </span>
  </span>
</span>
      
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="ml-auto shrink-0 rounded-full p-1 transition-colors hover:bg-black/10"
      >
        <MdClose className="h-4 w-4" />
      </button>
    </div>
  );
}
