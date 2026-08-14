import { Howl, Howler } from "howler";
import { SOUND_PRESETS, DEFAULT_PRESET_IDS, getPreset, type SoundKey } from "./soundPresets";

/**
 * SoundManager provides:
 * - playSendSound / playReceiveSound / playRingtone / stopRingtone
 * - preload, setVolume, getVolume, mute/unmute
 * - selectPreset(key, presetId) to switch between built-in sounds
 *
 * Built-in presets are synthesized via WebAudio (see soundPresets.ts), except the
 * default ringtone which plays the bundled /ringtone.mp3 through Howler.
 */

export type { SoundKey };

class SoundManager {
  private howl: Howl | null = null; // only used for file-backed presets (default ringtone)
  private ringtoneHowlId: number | null = null;
  private ringtoneLoopTimer: ReturnType<typeof setInterval> | null = null;
  private enabled = true;
  private volume = 0.8;
  private selected: Record<SoundKey, string>;

  constructor(initialSelected?: Partial<Record<SoundKey, string>>) {
    this.selected = { ...DEFAULT_PRESET_IDS, ...(initialSelected ?? {}) };
    Howler.volume(this.volume);
  }

  preload() {
    // Nothing to preload — presets are synthesized on demand. Kept for API compatibility.
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
    if (this.howl) this.howl.volume(this.volume);
  }
  getVolume() {
    return this.volume;
  }

  getSelected(key: SoundKey) {
    return this.selected[key];
  }

  selectPreset(key: SoundKey, presetId: string) {
    this.selected[key] = presetId;
    if (key === "ringtone") {
      // if a ringtone is currently playing, restart it with the new preset
      const wasPlaying = this.ringtoneHowlId !== null || this.ringtoneLoopTimer !== null;
      if (wasPlaying) {
        this.stopRingtone();
        this.playRingtone(true);
      }
    }
  }

  playSendSound() {
    if (!this.enabled) return;
    getPreset("send", this.selected.send).play();
  }

  playReceiveSound() {
    if (!this.enabled) return;
    getPreset("receive", this.selected.receive).play();
  }

  playRingtone(loop = true) {
    if (!this.enabled) return;
    const preset = getPreset("ringtone", this.selected.ringtone);

    if (preset.fileUrl) {
      if (!this.howl) {
        this.howl = new Howl({ src: [preset.fileUrl], html5: true, volume: this.volume });
      }
      this.ringtoneHowlId = this.howl.play();
      if (loop) this.howl.loop(true, this.ringtoneHowlId);
      return;
    }

    // Generated loop preset: play immediately, then repeat on an interval.
    preset.play();
    if (loop && preset.loop) {
      this.ringtoneLoopTimer = setInterval(() => preset.play(), preset.loopIntervalMs ?? 1200);
    }
  }

  stopRingtone() {
    if (this.howl && this.ringtoneHowlId !== null) {
      try { this.howl.stop(this.ringtoneHowlId); } catch {}
      this.ringtoneHowlId = null;
    }
    if (this.ringtoneLoopTimer) {
      clearInterval(this.ringtoneLoopTimer);
      this.ringtoneLoopTimer = null;
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
export const selectSoundPreset = (k: SoundKey, id: string) => soundManager.selectPreset(k, id);
export const getSelectedPreset = (k: SoundKey) => soundManager.getSelected(k);
export { SOUND_PRESETS };
