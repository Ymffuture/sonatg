import { useEffect, useRef } from "react";
import { toast } from "@heroui/react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

const COPY = {
  unstable: "Network unstable — your connection is weak.",
  offline: "Not connected — check your internet connection.",
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

    if (toastIdRef.current) {
      // HeroUI's toast has no `.update` — close the old one and recreate it
      // when switching offline ↔ unstable.
      toast.close(toastIdRef.current);
      toastIdRef.current = null;
    }

    const id =
      status === "offline" ? toast.danger(COPY.offline) : toast.warning(COPY.unstable);

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
