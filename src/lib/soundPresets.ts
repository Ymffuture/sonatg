// src/lib/soundPresets.ts
// Built-in, dependency-free sound presets generated via WebAudio.
// No external audio files needed — everything here is synthesized on the fly,
// so previews and playback both use the exact same function.

export type SoundKey = "send" | "receive" | "ringtone";

type ToneStep = {
  freq: number;
  dur: number; // ms
  delay: number; // seconds from start
  type?: OscillatorType;
  vol?: number;
};

let sharedCtx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
  if (!AC) return null;
  if (!sharedCtx || sharedCtx.state === "closed") sharedCtx = new AC();
  if (sharedCtx.state === "suspended") sharedCtx.resume().catch(() => {});
  return sharedCtx;
}

function playSteps(steps: ToneStep[]) {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  steps.forEach((s) => {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = s.type ?? "sine";
      osc.frequency.setValueAtTime(s.freq, now + s.delay);
      gain.gain.setValueAtTime(0, now + s.delay);
      gain.gain.linearRampToValueAtTime(s.vol ?? 0.15, now + s.delay + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + s.delay + s.dur / 1000);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + s.delay);
      osc.stop(now + s.delay + s.dur / 1000 + 0.03);
    } catch {
      // ignore — audio context may be blocked until user gesture
    }
  });
}

export interface SoundPreset {
  id: string;
  name: string;
  emoji: string;
  /** Plays one instance of the sound (used for preview + actual send/receive). */
  play: () => void;
  /** True for presets meant to loop as a ringtone. */
  loop?: boolean;
  /** Approx spacing (ms) between loop repeats — ringtone presets only. */
  loopIntervalMs?: number;
  /** File-backed presets (e.g. the bundled mp3) set this instead of relying purely on play(). */
  fileUrl?: string;
}

const send: SoundPreset[] = [
  { id: "pop", name: "Pop", emoji: "🔵", play: () => playSteps([{ freq: 660, dur: 70, delay: 0, vol: 0.14 }, { freq: 880, dur: 90, delay: 0.05, vol: 0.12 }]) },
  { id: "click", name: "Click", emoji: "⚪", play: () => playSteps([{ freq: 1100, dur: 40, delay: 0, vol: 0.12 }]) },
  { id: "swoosh", name: "Swoosh", emoji: "💨", play: () => playSteps([{ freq: 1400, dur: 130, delay: 0, type: "sawtooth", vol: 0.05 }, { freq: 500, dur: 90, delay: 0.05, vol: 0.08 }]) },
  { id: "marimba", name: "Marimba", emoji: "🎵", play: () => playSteps([{ freq: 523, dur: 110, delay: 0, type: "triangle", vol: 0.14 }, { freq: 659, dur: 120, delay: 0.07, type: "triangle", vol: 0.12 }]) },
  { id: "blip", name: "Blip", emoji: "🟣", play: () => playSteps([{ freq: 990, dur: 60, delay: 0, type: "square", vol: 0.08 }]) },
];

const receive: SoundPreset[] = [
  { id: "chime", name: "Chime", emoji: "🔔", play: () => playSteps([{ freq: 880, dur: 110, delay: 0, vol: 0.14 }, { freq: 660, dur: 140, delay: 0.09, vol: 0.12 }]) },
  { id: "ding", name: "Ding", emoji: "🎐", play: () => playSteps([{ freq: 1046, dur: 220, delay: 0, type: "triangle", vol: 0.13 }]) },
  { id: "bubble", name: "Bubble", emoji: "🫧", play: () => playSteps([{ freq: 400, dur: 60, delay: 0, vol: 0.1 }, { freq: 700, dur: 60, delay: 0.06, vol: 0.1 }, { freq: 1000, dur: 80, delay: 0.12, vol: 0.1 }]) },
  { id: "note", name: "Note", emoji: "🎶", play: () => playSteps([{ freq: 587, dur: 90, delay: 0, type: "triangle", vol: 0.12 }, { freq: 784, dur: 130, delay: 0.08, type: "triangle", vol: 0.12 }]) },
  { id: "drop", name: "Drop", emoji: "💧", play: () => playSteps([{ freq: 1200, dur: 50, delay: 0, vol: 0.1 }, { freq: 500, dur: 120, delay: 0.04, vol: 0.09 }]) },
];

const ringtone: SoundPreset[] = [
  { id: "default", name: "Classic", emoji: "📞", fileUrl: "/ringtone.mp3", play: () => {} },
  {
    id: "marimba-loop", name: "Marimba", emoji: "🎹", loop: true, loopIntervalMs: 1400,
    play: () => playSteps([
      { freq: 523, dur: 160, delay: 0, type: "triangle", vol: 0.16 },
      { freq: 659, dur: 160, delay: 0.15, type: "triangle", vol: 0.16 },
      { freq: 784, dur: 220, delay: 0.3, type: "triangle", vol: 0.16 },
    ]),
  },
  {
    id: "xylophone-loop", name: "Xylophone", emoji: "🎼", loop: true, loopIntervalMs: 1200,
    play: () => playSteps([
      { freq: 1046, dur: 100, delay: 0, type: "sine", vol: 0.15 },
      { freq: 880, dur: 100, delay: 0.12, type: "sine", vol: 0.15 },
      { freq: 784, dur: 140, delay: 0.24, type: "sine", vol: 0.15 },
    ]),
  },
  {
    id: "pulse-loop", name: "Pulse", emoji: "📳", loop: true, loopIntervalMs: 900,
    play: () => playSteps([
      { freq: 440, dur: 180, delay: 0, type: "square", vol: 0.08 },
      { freq: 440, dur: 180, delay: 0.22, type: "square", vol: 0.08 },
    ]),
  },
];

export const SOUND_PRESETS: Record<SoundKey, SoundPreset[]> = { send, receive, ringtone };

export const DEFAULT_PRESET_IDS: Record<SoundKey, string> = {
  send: "pop",
  receive: "chime",
  ringtone: "default",
};

export function getPreset(key: SoundKey, id: string): SoundPreset {
  return SOUND_PRESETS[key].find((p) => p.id === id) ?? SOUND_PRESETS[key][0];
}
