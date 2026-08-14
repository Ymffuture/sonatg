// src/hooks/useSounds.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  playSendSound,
  playReceiveSound,
  playRingtone,
  stopRingtone,
  preloadSounds,
  setSoundVolume,
  getSoundVolume,
  setSoundEnabled,
  updateSoundSource,
} from "@/lib/sounds";

type SoundsContextType = {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  volume: number;
  setVolume: (v: number) => void;
  testSend: () => void;
  testReceive: () => void;
  startRingtone: () => void;
  stopRingtone: () => void;
  setSource: (key: "send" | "receive" | "ringtone", url: string | null) => void;
};

const KEY_ENABLED = "sona.sounds.enabled";
const KEY_VOLUME = "sona.sounds.volume";
const KEY_SOURCES = "sona.sounds.sources";

const SoundsContext = createContext<SoundsContextType | null>(null);

export function SoundsProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledState] = useState<boolean>(() => {
    try { const v = localStorage.getItem(KEY_ENABLED); return v === null ? true : v === "1"; } catch { return true; }
  });

  const [volume, setVolumeState] = useState<number>(() => {
    try { const v = localStorage.getItem(KEY_VOLUME); return v ? Number(v) : getSoundVolume() ?? 0.8; } catch { return getSoundVolume() ?? 0.8; }
  });

  useEffect(() => { setSoundEnabled(enabled); try { localStorage.setItem(KEY_ENABLED, enabled ? "1" : "0"); } catch {} }, [enabled]);
  useEffect(() => { setSoundVolume(volume); try { localStorage.setItem(KEY_VOLUME, String(volume)); } catch {} }, [volume]);
  useEffect(() => { preloadSounds(); }, []);

  const api = useMemo(
    () => ({
      enabled,
      setEnabled: setEnabledState,
      volume,
      setVolume: setVolumeState,
      testSend: () => playSendSound(),
      testReceive: () => playReceiveSound(),
      startRingtone: () => playRingtone(true),
      stopRingtone: () => stopRingtone(),
      setSource: (k: "send" | "receive" | "ringtone", url: string | null) => {
        updateSoundSource(k, url);
        try {
          const raw = JSON.parse(localStorage.getItem(KEY_SOURCES) || "{}");
          raw[k] = url;
          localStorage.setItem(KEY_SOURCES, JSON.stringify(raw));
        } catch {}
      },
    }),
    [enabled, volume],
  );

  return <SoundsContext.Provider value={api}>{children}</SoundsContext.Provider>;
}

export function useSounds() {
  const ctx = useContext(SoundsContext);
  if (!ctx) throw new Error("useSounds must be used inside SoundsProvider");
  return ctx;
}
