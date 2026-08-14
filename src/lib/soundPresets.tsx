// src/lib/soundPresets.tsx
import type { LucideIcon } from "lucide-react";
import {
  Volume2,
  MousePointerClick,
  Wind,
  Music,
  Zap,
  Bell,
  BellRing,
  Droplets,
  Music2,
  AudioLines,
  Phone,
  Piano,
  Radio,
  Smartphone,
} from "lucide-react";

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
  const master = ctx.createGain();
  master.gain.value = 0.6; // global softness like WhatsApp
  master.connect(ctx.destination);

  steps.forEach((s) => {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = s.type ?? "sine";
      osc.frequency.setValueAtTime(s.freq, now + s.delay);

      // Lowpass filter for smoother, less harsh tones
      filter.type = "lowpass";
      filter.frequency.value = s.type === "square" || s.type === "sawtooth" ? 2800 : 6000;
      filter.Q.value = 0.5;

      const vol = s.vol ?? 0.12;
      gain.gain.setValueAtTime(0, now + s.delay);
      gain.gain.linearRampToValueAtTime(vol, now + s.delay + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + s.delay + s.dur / 1000);

      osc.connect(filter).connect(gain).connect(master);
      osc.start(now + s.delay);
      osc.stop(now + s.delay + s.dur / 1000 + 0.03);
    } catch {
      // AudioContext may be blocked until user gesture
    }
  });
}

export interface SoundPreset {
  id: string;
  name: string;
  icon: LucideIcon;
  play: () => void;
  loop?: boolean;
  loopIntervalMs?: number;
  fileUrl?: string;
}

/* ─── SEND (very short, subtle, airy) ─── */
const send: SoundPreset[] = [
  {
    id: "pop",
    name: "Pop",
    icon: Volume2,
    play: () =>
      playSteps([
        { freq: 800, dur: 55, delay: 0, vol: 0.1 },
        { freq: 1200, dur: 45, delay: 0.04, vol: 0.08 },
      ]),
  },
  {
    id: "click",
    name: "Click",
    icon: MousePointerClick,
    play: () => playSteps([{ freq: 2000, dur: 25, delay: 0, vol: 0.06 }]),
  },
  {
    id: "swoosh",
    name: "Swoosh",
    icon: Wind,
    play: () =>
      playSteps([
        { freq: 600, dur: 100, delay: 0, type: "sine", vol: 0.06 },
        { freq: 300, dur: 80, delay: 0.06, type: "sine", vol: 0.05 },
      ]),
  },
  {
    id: "marimba",
    name: "Marimba",
    icon: Music,
    play: () =>
      playSteps([
        { freq: 523, dur: 90, delay: 0, type: "triangle", vol: 0.1 },
        { freq: 659, dur: 100, delay: 0.06, type: "triangle", vol: 0.09 },
      ]),
  },
  {
    id: "blip",
    name: "Blip",
    icon: Zap,
    play: () => playSteps([{ freq: 1200, dur: 40, delay: 0, type: "sine", vol: 0.07 }]),
  },
];

/* ─── RECEIVE (soft, pleasant chimes) ─── */
const receive: SoundPreset[] = [
  {
    id: "chime",
    name: "Chime",
    icon: Bell,
    play: () =>
      playSteps([
        { freq: 880, dur: 90, delay: 0, type: "sine", vol: 0.11 },
        { freq: 1100, dur: 120, delay: 0.08, type: "sine", vol: 0.09 },
      ]),
  },
  {
    id: "ding",
    name: "Ding",
    icon: BellRing,
    play: () => playSteps([{ freq: 1046, dur: 180, delay: 0, type: "triangle", vol: 0.1 }]),
  },
  {
    id: "bubble",
    name: "Bubble",
    icon: Droplets,
    play: () =>
      playSteps([
        { freq: 500, dur: 50, delay: 0, vol: 0.08 },
        { freq: 750, dur: 50, delay: 0.05, vol: 0.08 },
        { freq: 1000, dur: 60, delay: 0.1, vol: 0.08 },
      ]),
  },
  {
    id: "note",
    name: "Note",
    icon: Music2,
    play: () =>
      playSteps([
        { freq: 587, dur: 80, delay: 0, type: "triangle", vol: 0.1 },
        { freq: 784, dur: 110, delay: 0.07, type: "triangle", vol: 0.1 },
      ]),
  },
  {
    id: "drop",
    name: "Drop",
    icon: AudioLines,
    play: () =>
      playSteps([
        { freq: 1400, dur: 40, delay: 0, vol: 0.08 },
        { freq: 600, dur: 100, delay: 0.04, vol: 0.07 },
      ]),
  },
];

/* ─── RINGTONE (pleasant, loopable) ─── */
const ringtone: SoundPreset[] = [
  {
    id: "default",
    name: "Classic",
    icon: Phone,
    fileUrl: "/ringtone.mp3",
    play: () => {},
  },
  {
    id: "marimba-loop",
    name: "Marimba",
    icon: Piano,
    loop: true,
    loopIntervalMs: 1400,
    play: () =>
      playSteps([
        { freq: 523, dur: 140, delay: 0, type: "triangle", vol: 0.14 },
        { freq: 659, dur: 140, delay: 0.13, type: "triangle", vol: 0.14 },
        { freq: 784, dur: 180, delay: 0.26, type: "triangle", vol: 0.14 },
      ]),
  },
  {
    id: "xylophone-loop",
    name: "Xylophone",
    icon: Music,
    loop: true,
    loopIntervalMs: 1200,
    play: () =>
      playSteps([
        { freq: 1046, dur: 90, delay: 0, type: "sine", vol: 0.13 },
        { freq: 880, dur: 90, delay: 0.11, type: "sine", vol: 0.13 },
        { freq: 784, dur: 120, delay: 0.22, type: "sine", vol: 0.13 },
      ]),
  },
  {
    id: "pulse-loop",
    name: "Pulse",
    icon: Radio,
    loop: true,
    loopIntervalMs: 900,
    play: () =>
      playSteps([
        { freq: 440, dur: 160, delay: 0, type: "sine", vol: 0.1 },
        { freq: 440, dur: 160, delay: 0.2, type: "sine", vol: 0.1 },
      ]),
  },
  {
    id: "digital-loop",
    name: "Digital",
    icon: Smartphone,
    loop: true,
    loopIntervalMs: 1100,
    play: () =>
      playSteps([
        { freq: 1600, dur: 50, delay: 0, type: "sine", vol: 0.09 },
        { freq: 1200, dur: 50, delay: 0.08, type: "sine", vol: 0.09 },
        { freq: 800, dur: 80, delay: 0.16, type: "sine", vol: 0.09 },
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
