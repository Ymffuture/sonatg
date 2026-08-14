import { Howl, Howler } from "howler";

/**
 * SoundManager provides:
 * - playSendSound / playReceiveSound / playRingtone / stopRingtone
 * - preload, setVolume, getVolume, mute/unmute
 * - updateSoundSource(type, url) to change the audio file used for a sound
 *
 * Uses Howler for asset playback, falls back to simple WebAudio beeps when no asset is provided.
 */

type SoundKey = "send" | "receive" | "ringtone";

const DEFAULT_SOURCES: Record<SoundKey, string | null> = {
  send: null,
  receive: null,
  ringtone: "/ringtone.mp3",
};

class SoundManager {
  private howls: Partial<Record<SoundKey, Howl>> = {};
  private sources: Record<SoundKey, string | null>;
  private ringtoneId: number | null = null;
  private enabled = true;
  private volume = 0.8;

  constructor(initialSources?: Partial<Record<SoundKey, string | null>>) {
    this.sources = { ...DEFAULT_SOURCES, ...(initialSources ?? {}) };
    Howler.volume(this.volume);
    this.initHowls();
  }

  private initHowls() {
    (Object.keys(this.sources) as SoundKey[]).forEach((k) => {
      const src = this.sources[k];
      if (src) {
        this.howls[k] = new Howl({ src: [src], html5: true, volume: this.volume });
      } else {
        this.howls[k] = undefined;
      }
    });
  }

  private playBeep(freq: number, durMs: number, vol = 0.15, type: OscillatorType = "sine", startDelay = 0) {
    if (typeof window === "undefined") return;
    const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    if (!AC) return;
    try {
      const ctx = new AC();
      const now = ctx.currentTime + startDelay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(vol, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + durMs / 1000);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + durMs / 1000 + 0.02);
    } catch {
      // ignore
    }
  }

  preload() {
    Object.values(this.howls).forEach((h) => h?.load());
  }

  setEnabled(enabled: boolean) {
    this.enabled = !!enabled;
  }
  isEnabled() {
    return this.enabled;
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    Howler.volume(this.volume);
    Object.values(this.howls).forEach((h) => {
      if (h) h.volume(this.volume);
    });
  }
  getVolume() {
    return this.volume;
  }

  updateSoundSource(key: SoundKey, url: string | null) {
    this.sources[key] = url;
    if (this.howls[key]) {
      try { this.howls[key]!.unload(); } catch {}
      this.howls[key] = undefined;
    }
    if (url) {
      this.howls[key] = new Howl({ src: [url], html5: true, volume: this.volume });
    }
  }

  playSendSound() {
    if (!this.enabled) return;
    const h = this.howls.send;
    if (h) { h.play(); return; }
    this.playBeep(660, 90, 0.14, "sine", 0);
    this.playBeep(990, 110, 0.12, "sine", 0.06);
  }

  playReceiveSound() {
    if (!this.enabled) return;
    const h = this.howls.receive;
    if (h) { h.play(); return; }
    this.playBeep(880, 110, 0.14, "sine", 0);
    this.playBeep(660, 140, 0.12, "sine", 0.09);
  }

  playRingtone(loop = true) {
    if (!this.enabled) return;
    const h = this.howls.ringtone;
    if (h) {
      this.ringtoneId = h.play();
      if (loop) h.loop(true, this.ringtoneId);
      return;
    }
    // no asset => do nothing
  }

  stopRingtone() {
    const h = this.howls.ringtone;
    if (h && this.ringtoneId !== null) {
      try { h.stop(this.ringtoneId); } catch {}
      this.ringtoneId = null;
    }
  }

  mute() { Howler.mute(true); }
  unmute() { Howler.mute(false); }
  isMuted() { return (Howler as any)._muted || false; }
}

export const soundManager = new SoundManager();

export const playSendSound = () => soundManager.playSendSound();
export const playReceiveSound = () => soundManager.playReceiveSound();
export const playRingtone = (loop = true) => soundManager.playRingtone(loop);
export const stopRingtone = () => soundManager.stopRingtone();
export const preloadSounds = () => soundManager.preload();
export const setSoundVolume = (v: number) => soundManager.setVolume(v);
export const getSoundVolume = () => soundManager.getVolume();
export const setSoundEnabled = (e: boolean) => soundManager.setEnabled(e);
export const updateSoundSource = (k: SoundKey, url: string | null) => soundManager.updateSoundSource(k, url);
