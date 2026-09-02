import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type NetworkStatus = "online" | "offline" | "unstable";

/**
 * Tracks whether the app can actually reach the server, not just whether
 * the OS thinks there's a link. Combines three signals:
 *
 *  1. `navigator.onLine` / the `online`/`offline` window events — the
 *     baseline "is there a link at all" check, universally supported.
 *  2. The Network Information API (`navigator.connection`) where the
 *     browser supports it (Chrome/Android; not Safari/Firefox) — catches
 *     a technically-up but very poor connection (2G, save-data, etc).
 *  3. A lightweight Supabase Realtime channel subscription used purely as
 *     a heartbeat — this is the most reliable signal, since it proves the
 *     app can actually round-trip to the backend rather than just having
 *     *a* network interface up.
 *
 * "unstable" wins over "online" whenever any signal is bad; "offline"
 * only comes from the hard browser-level signal, since that's the one
 * case we can be fully certain about.
 */
export function useNetworkStatus(): NetworkStatus {
  const [browserOnline, setBrowserOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const [connectionPoor, setConnectionPoor] = useState(false);
  const [heartbeatOk, setHeartbeatOk] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const goOffline = () => setBrowserOnline(false);
    const goOnline = () => setBrowserOnline(true);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  useEffect(() => {
    // Not supported in every browser — this signal simply stays "false"
    // (not poor) where it's unavailable, deferring to the heartbeat below.
    const nav = navigator as Navigator & {
      connection?: { effectiveType?: string; saveData?: boolean; downlink?: number; addEventListener?: (e: string, cb: () => void) => void; removeEventListener?: (e: string, cb: () => void) => void };
    };
    const conn = nav.connection;
    if (!conn) return;
    const check = () => {
      const slow = conn.effectiveType === "slow-2g" || conn.effectiveType === "2g";
      const thin = typeof conn.downlink === "number" && conn.downlink > 0 && conn.downlink < 0.5;
      setConnectionPoor(slow || thin);
    };
    check();
    conn.addEventListener?.("change", check);
    return () => conn.removeEventListener?.("change", check);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const channel = supabase.channel("network-heartbeat");
    channel.subscribe((status) => {
      if (cancelled) return;
      if (status === "SUBSCRIBED") setHeartbeatOk(true);
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setHeartbeatOk(false);
      // "CLOSED" is a normal part of unmount/reconnect churn, not itself a
      // failure signal — leave heartbeatOk as-is when that happens.
    });
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, []);

  if (!browserOnline) return "offline";
  if (connectionPoor || !heartbeatOk) return "unstable";
  return "online";
}
