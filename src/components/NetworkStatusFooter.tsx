// hooks/useNetworkStatus.ts
import { useState, useEffect, useRef } from "react";
import { toast } from "@heroui/react";

export type NetworkStatus = "online" | "offline" | "unstable";

export function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkStatus>(
    typeof window !== "undefined" && navigator.onLine ? "online" : "offline"
  );
  
  // Ref to track previous status to avoid duplicate toasts
  const prevStatusRef = useRef<NetworkStatus>(status);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let isMounted = true;
    let heartbeatInterval: NodeJS.Timeout;

    // The "Real-time Scanner" Promise
    const checkConnection = async (): Promise<NetworkStatus> => {
      // 1. Check basic browser API first
      if (!navigator.onLine) return "offline";

      try {
        // 2. Perform a real network request with a short timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

        await fetch("https://www.google.com/generate_204", {
          method: "HEAD",
          mode: "no-cors",
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        return "online";
      } catch (error) {
        // If it fails but navigator says online, it's likely "unstable" or captive portal
        return "unstable"; 
      }
    };

    // Initial check
    checkConnection().then((newStatus) => {
      if (isMounted) handleStatusChange(newStatus);
    });

    // Heartbeat: Scan every 10 seconds
    heartbeatInterval = setInterval(async () => {
      const newStatus = await checkConnection();
      if (isMounted) handleStatusChange(newStatus);
    }, 10000);

    // Native listeners for immediate reaction (e.g. pulling ethernet cable)
    const handleNativeOnline = () => handleStatusChange("online");
    const handleNativeOffline = () => handleStatusChange("offline");

    window.addEventListener("online", handleNativeOnline);
    window.addEventListener("offline", handleNativeOffline);

    return () => {
      isMounted = false;
      clearInterval(heartbeatInterval);
      window.removeEventListener("online", handleNativeOnline);
      window.removeEventListener("offline", handleNativeOffline);
    };
  }, []);

  const handleStatusChange = (newStatus: NetworkStatus) => {
    const oldStatus = prevStatusRef.current;
    
    // Only update state and toast if status actually changed
    if (oldStatus !== newStatus) {
      setStatus(newStatus);
      prevStatusRef.current = newStatus;

      // Trigger HeroUI Toast based on transition
      if (newStatus === "offline") {
        toast.error("Connection Lost", {
          description: "You are offline. Messages will send when you reconnect.",
        });
      } else if (newStatus === "unstable") {
        toast.warning("Network Unstable", {
          description: "Your connection is weak. Actions may be delayed.",
        });
      } else if (newStatus === "online" && oldStatus !== "online") {
        toast.success("Connected", {
          description: "You are back online.",
        });
      }
    }
  };

  return status;
}
