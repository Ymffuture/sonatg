import { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize2, Minimize2, Download } from "lucide-react";
import { formatBytes } from "@/utils/utils";

function fmtDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * A compact, Telegram-style inline video player: a poster with a big
 * center play button and duration badge before playback starts, then a
 * minimal floating control bar (scrubber, time, mute, fullscreen) that
 * auto-hides a couple seconds into playback and reappears on tap/hover —
 * built on the plain <video> element with `controls` turned off, rather
 * than the browser's native chrome.
 */
export function VideoPlayer({
  src,
  fileSize,
  onDownload,
  className = "",
}: {
  src: string;
  fileSize?: number | null;
  onDownload?: () => void;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Auto-hide the control bar a couple seconds into playback; any tap,
  // mouse move, or pause brings it back immediately.
  const scheduleHide = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), 2200);
  };
  const wakeControls = () => {
    setControlsVisible(true);
    if (playing) scheduleHide();
  };

  useEffect(() => () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  useEffect(() => {
    if (!scrubbing) return;
    const onMove = (e: PointerEvent) => handleScrub(e.clientX);
    const onUp = () => setScrubbing(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrubbing, duration]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); } else { v.pause(); }
  };

  const handleScrub = (clientX: number) => {
    const v = videoRef.current;
    const bar = containerRef.current?.querySelector<HTMLDivElement>("[data-scrub-track]");
    if (!v || !bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    v.currentTime = ratio * duration;
    setCurrentTime(v.currentTime);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else containerRef.current.requestFullscreen?.();
  };

  const progressPct = duration ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration ? (buffered / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className={`group/player relative overflow-hidden rounded-lg bg-black select-none ${className}`}
      onMouseMove={wakeControls}
      onMouseLeave={() => playing && setControlsVisible(false)}
    >
      <video
        ref={videoRef}
        src={src}
        preload="metadata"
        playsInline
        muted={muted}
        className="max-h-72 w-full cursor-pointer bg-black"
        onClick={togglePlay}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => !scrubbing && setCurrentTime(e.currentTarget.currentTime)}
        onProgress={(e) => {
          const v = e.currentTarget;
          if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1));
        }}
        onPlay={() => { setPlaying(true); setStarted(true); scheduleHide(); }}
        onPause={() => { setPlaying(false); setControlsVisible(true); }}
        onWaiting={() => setLoading(true)}
        onPlaying={() => setLoading(false)}
        onEnded={() => { setPlaying(false); setControlsVisible(true); }}
      />

      {/* Buffering spinner */}
      {loading && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        </div>
      )}

      {/* Big center play button — the primary "Telegram" affordance before/while paused */}
      {(!playing || controlsVisible) && !loading && (
        <button
          onClick={(e) => { e.stopPropagation(); togglePlay(); }}
          aria-label={playing ? "Pause" : "Play"}
          className="absolute inset-0 m-auto grid h-14 w-14 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-transform hover:scale-105 active:scale-95"
        >
          {playing ? <Pause className="h-6 w-6 fill-current" /> : <Play className="ml-0.5 h-6 w-6 fill-current" />}
        </button>
      )}

      {/* Duration / file-size badge — only before the first play, Telegram-style */}
      {!started && (
        <div className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white/90 backdrop-blur-sm">
          {duration > 0 && <span>{fmtDuration(duration)}</span>}
          {fileSize ? <span className="opacity-70">· {formatBytes(fileSize)}</span> : null}
        </div>
      )}

      {onDownload && (
        <button
          onClick={(e) => { e.stopPropagation(); onDownload(); }}
          aria-label="Download video"
          className={`absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-opacity hover:bg-black/70 active:scale-95 ${
            controlsVisible || !started ? "opacity-100" : "opacity-0 group-hover/player:opacity-100"
          }`}
        >
          <Download className="h-4 w-4" />
        </button>
      )}

      {/* Bottom control bar */}
      {started && (
        <div
          className={`absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/75 to-transparent px-2.5 pb-1.5 pt-4 transition-opacity duration-200 ${
            controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} aria-label={playing ? "Pause" : "Play"} className="grid h-6 w-6 shrink-0 place-items-center text-white">
            {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
          </button>

          <span className="shrink-0 text-[10px] tabular-nums text-white/90">
            {fmtDuration(currentTime)} / {fmtDuration(duration)}
          </span>

          <div
            data-scrub-track
            onPointerDown={(e) => { e.stopPropagation(); setScrubbing(true); handleScrub(e.clientX); }}
            onPointerMove={(e) => { if (scrubbing) handleScrub(e.clientX); }}
            onPointerUp={(e) => { e.stopPropagation(); setScrubbing(false); }}
            className="relative h-3 flex-1 cursor-pointer"
          >
            <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-white/25">
              <div className="absolute h-full rounded-full bg-white/40" style={{ width: `${bufferedPct}%` }} />
              <div className="absolute h-full rounded-full bg-white" style={{ width: `${progressPct}%` }} />
            </div>
            <div
              className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 -translate-x-1/2 rounded-full bg-white shadow"
              style={{ left: `${progressPct}%` }}
            />
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); setMuted((m) => !m); }}
            aria-label={muted ? "Unmute" : "Mute"}
            className="grid h-6 w-6 shrink-0 place-items-center text-white"
          >
            {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            className="grid h-6 w-6 shrink-0 place-items-center text-white"
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}
    </div>
  );
}
