import { useEffect, useRef } from "react";
import { toast } from "@heroui/react";
import { MdWifiOff, MdSignalWifiStatusbarConnectedNoInternet4 } from "react-icons/md";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

const COPY = {
  unstable: {
    label: "Network unstable",
    description: "Your connection is weak — messages may be delayed.",
  },
  offline: {
    label: "Not connected",
    description:
      "Check your internet connection. Messages will send once you're back online.",
  },
} as const;

export function NetworkStatusFooter() {
  const status = useNetworkStatus();
  const toastIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (status === "online") {
      if (toastIdRef.current) {
        toast.close(toastIdRef.current);
        toastIdRef.current = null;
      }
      return;
    }

    const { label, description } = COPY[status];
    const Icon =
      status === "offline"
        ? MdWifiOff
        : MdSignalWifiStatusbarConnectedNoInternet4;

    if (toastIdRef.current) {
      // Update in place when switching offline ↔ unstable
      toast.update(toastIdRef.current, label, {
        description,
        variant: status === "offline" ? "danger" : "warning",
        timeout: 0, // persistent
        indicator: <Icon className="h-5 w-5 animate-pulse" />,
      });
      return;
    }

    const id =
      status === "offline"
        ? toast.danger(label, {
            description,
            timeout: 0,
            indicator: <Icon className="h-5 w-5 animate-pulse" />,
          })
        : toast.warning(label, {
            description,
            timeout: 0,
            indicator: <Icon className="h-5 w-5 animate-pulse" />,
          });

    toastIdRef.current = id ?? null;

    return () => {
      if (toastIdRef.current) {
        toast.close(toastIdRef.current);
        toastIdRef.current = null;
      }
    };
  }, [status]);

  return null;
}
