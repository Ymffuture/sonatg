// Tiny WebAudio helpers — WhatsApp-style send/receive tones without any assets.

let ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      ctx = new AC();
    } catch { return null; }
  }
  return ctx;
}

function beep(freq: number, durMs: number, vol = 0.15, type: OscillatorType = "sine", startDelay = 0) {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime + startDelay;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(vol, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durMs / 1000);
  osc.connect(gain).connect(c.destination);
  osc.start(now);
  osc.stop(now + durMs / 1000 + 0.02);
}

// Two rising notes — outgoing
export function playSendSound() {
  beep(660, 90, 0.14, "sine", 0);
  beep(990, 110, 0.12, "sine", 0.06);
}

// Two-tone soft ding — incoming
export function playReceiveSound() {
  beep(880, 110, 0.14, "sine", 0);
  beep(660, 140, 0.12, "sine", 0.09);
}
