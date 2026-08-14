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
  selectSoundPreset,
} from "@/lib/sounds";
import { DEFAULT_PRESET_IDS, type SoundKey } from "@/lib/soundPresets";

type SoundsContextType = {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  volume: number;
  setVolume: (v: number) => void;
  testSend: () => void;
  testReceive: () => void;
  startRingtone: () => void;
  stopRingtone: () => void;
  selected: Record<SoundKey, string>;
  selectPreset: (key: SoundKey, presetId: string) => void;
};

const KEY_ENABLED = "sona.sounds.enabled";
const KEY_VOLUME = "sona.sounds.volume";
const KEY_PRESETS = "sona.sounds.presets";

const SoundsContext = createContext<SoundsContextType | null>(null);

export function SoundsProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledState] = useState<boolean>(() => {
    try { const v = localStorage.getItem(KEY_ENABLED); return v === null ? true : v === "1"; } catch { return true; }
  });

  const [volume, setVolumeState] = useState<number>(() => {
    try { const v = localStorage.getItem(KEY_VOLUME); return v ? Number(v) : getSoundVolume() ?? 0.8; } catch { return getSoundVolume() ?? 0.8; }
  });

  const [selected, setSelected] = useState<Record<SoundKey, string>>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY_PRESETS) || "{}");
      return { ...DEFAULT_PRESET_IDS, ...raw };
    } catch {
      return { ...DEFAULT_PRESET_IDS };
    }
  });

  useEffect(() => { setSoundEnabled(enabled); try { localStorage.setItem(KEY_ENABLED, enabled ? "1" : "0"); } catch {} }, [enabled]);
  useEffect(() => { setSoundVolume(volume); try { localStorage.setItem(KEY_VOLUME, String(volume)); } catch {} }, [volume]);
  useEffect(() => { preloadSounds(); }, []);
  useEffect(() => {
    (Object.keys(selected) as SoundKey[]).forEach((k) => selectSoundPreset(k, selected[k]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      selected,
      selectPreset: (key: SoundKey, presetId: string) => {
        selectSoundPreset(key, presetId);
        setSelected((prev) => {
          const next = { ...prev, [key]: presetId };
          try { localStorage.setItem(KEY_PRESETS, JSON.stringify(next)); } catch {}
          return next;
        });
      },
    }),
    [enabled, volume, selected],
  );

  return <SoundsContext.Provider value={api}>{children}</SoundsContext.Provider>;
}

export function useSounds() {
  const ctx = useContext(SoundsContext);
  if (!ctx) throw new Error("useSounds must be used inside SoundsProvider");
  return ctx;
}
