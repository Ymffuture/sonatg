import { useEffect, useRef, useState, useCallback } from "react";
import { 
  Play, Pause, Volume2, VolumeX, Maximize2, Minimize2, Download, 
  SkipForward, SkipBack, Settings, X, PictureInPicture,
  Rewind, FastForward
} from "lucide-react";
import { formatBytes } from "@/utils/utils";

function fmtDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface VideoPlayerProps {
  src: string;
  fileSize?: number | null;
  onDownload?: () => void;
  className?: string;
  poster?: string;
  title?: string;
  subtitle?: string;
  playbackRates?: number[];
  onTimeUpdate?: (time: number) => void;
  onEnded?: () => void;
}

export function VideoPlayer({
  src,
  fileSize,
  onDownload,
  className = "",
  poster,
  title,
  subtitle,
  playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 2],
  onTimeUpdate,
  onEnded,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isPiP, setIsPiP] = useState(false);
  const [previewTime, setPreviewTime] = useState<number | null>(null);
  const [previewPosition, setPreviewPosition] = useState(0);

  // Auto-hide controls
  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (playing && !scrubbing && !showSettings) {
      hideTimerRef.current = setTimeout(() => setControlsVisible(false), 2500);
    }
  }, [playing, scrubbing, showSettings]);

  const wakeControls = useCallback(() => {
    setControlsVisible(true);
    if (playing && !scrubbing) scheduleHide();
  }, [playing, scrubbing, scheduleHide]);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
    };
  }, []);

  // Fullscreen events
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Picture-in-Picture events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPiPChange = () => setIsPiP(document.pictureInPictureElement === video);
    video.addEventListener("enterpictureinpicture", onPiPChange);
    video.addEventListener("leavepictureinpicture", onPiPChange);
    return () => {
      video.removeEventListener("enterpictureinpicture", onPiPChange);
      video.removeEventListener("leavepictureinpicture", onPiPChange);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT") return;
      
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "f":
          toggleFullscreen();
          break;
        case "m":
          toggleMute();
          break;
        case "ArrowRight":
          skipForward();
          break;
        case "ArrowLeft":
          skipBackward();
          break;
        case "p":
          togglePiP();
          break;
        case "0":
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6":
        case "7":
        case "8":
        case "9":
          if (videoRef.current) {
            const num = parseInt(e.key);
            videoRef.current.currentTime = (num / 10) * duration;
          }
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [duration]);

  // Scrub handling
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
  }, [scrubbing, duration]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.muted) {
      v.muted = false;
      v.volume = volume || 0.5;
      setMuted(false);
    } else {
      v.muted = true;
      setMuted(true);
    }
  };

  const handleVolumeChange = (value: number) => {
    const v = videoRef.current;
    if (!v) return;
    const vol = Math.min(1, Math.max(0, value));
    v.volume = vol;
    setVolume(vol);
    if (vol === 0) {
      v.muted = true;
      setMuted(true);
    } else {
      v.muted = false;
      setMuted(false);
    }
  };

  const handleScrub = (clientX: number) => {
    const v = videoRef.current;
    const bar = containerRef.current?.querySelector<HTMLDivElement>("[data-scrub-track]");
    if (!v || !bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    v.currentTime = ratio * duration;
    setCurrentTime(v.currentTime);
    setPreviewTime(v.currentTime);
    setPreviewPosition(ratio * 100);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen?.();
    }
  };

  const togglePiP = () => {
    const v = videoRef.current;
    if (!v) return;
    if (document.pictureInPictureElement === v) {
      document.exitPictureInPicture();
    } else if (document.pictureInPictureEnabled) {
      v.requestPictureInPicture();
    }
  };

  const skipForward = () => {
    const v = videoRef.current;
    if (v) v.currentTime = Math.min(v.currentTime + 10, duration);
  };

  const skipBackward = () => {
    const v = videoRef.current;
    if (v) v.currentTime = Math.max(v.currentTime - 10, 0);
  };

  const changePlaybackRate = (rate: number) => {
    const v = videoRef.current;
    if (v) {
      v.playbackRate = rate;
      setPlaybackRate(rate);
      setShowSettings(false);
    }
  };

  const progressPct = duration ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration ? (buffered / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className={`group/player relative overflow-hidden bg-black ${className}`}
      style={{ aspectRatio: "16/9" }}
      onMouseMove={wakeControls}
      onMouseLeave={() => playing && !scrubbing && setControlsVisible(false)}
    >
      {/* Video Element
          The outer container is pinned to 16:9 (see style above) so every
          video takes up a consistent, predictable slot in the chat column —
          same idea as the 1:1 image crop. object-contain here (instead of
          cover) means the video's *own* orientation is respected inside that
          box: a landscape clip fills the full 16:9 frame edge-to-edge, while
          a portrait clip letterboxes with pillars left/right — nothing gets
          cropped or stretched. Tapping fullscreen (see toggleFullscreen)
          then plays it edge-to-edge in its native orientation. */}
      <video
        ref={videoRef}
        src={src}
        preload="metadata"
        playsInline
        muted={muted}
        poster={poster}
        className="h-full w-full cursor-pointer object-contain"
        onClick={togglePlay}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => {
          if (!scrubbing) {
            setCurrentTime(e.currentTarget.currentTime);
            onTimeUpdate?.(e.currentTarget.currentTime);
          }
        }}
        onProgress={(e) => {
          const v = e.currentTarget;
          if (v.buffered.length) {
            setBuffered(v.buffered.end(v.buffered.length - 1));
          }
        }}
        onPlay={() => { 
          setPlaying(true); 
          setStarted(true); 
          scheduleHide();
          setLoading(false);
        }}
        onPause={() => { 
          setPlaying(false); 
          setControlsVisible(true);
        }}
        onWaiting={() => setLoading(true)}
        onPlaying={() => setLoading(false)}
        onEnded={() => { 
          setPlaying(false); 
          setControlsVisible(true);
          onEnded?.();
        }}
        onVolumeChange={(e) => {
          const v = e.currentTarget;
          setVolume(v.volume);
          setMuted(v.muted);
        }}
      />

      {/* Loading Spinner */}
      {loading && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/30">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/30 border-t-white" />
        </div>
      )}

      {/* Title Overlay */}
      {(title || subtitle) && started && (
        <div className={`pointer-events-none absolute left-4 top-4 transition-opacity duration-300 ${controlsVisible ? "opacity-100" : "opacity-0"}`}>
          {title && <h2 className="text-lg font-semibold text-white drop-shadow-lg">{title}</h2>}
          {subtitle && <p className="text-sm text-white/80 drop-shadow-lg">{subtitle}</p>}
        </div>
      )}

      {/* Center Play/Pause Button */}
      {(!playing || controlsVisible) && !loading && (
        <button
          onClick={(e) => { e.stopPropagation(); togglePlay(); }}
          aria-label={playing ? "Pause" : "Play"}
          className="absolute inset-0 m-auto grid h-16 w-16 place-items-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-all hover:scale-110 hover:bg-black/60 active:scale-95"
        >
          {playing ? (
            <Pause className="h-8 w-8 fill-current" />
          ) : (
            <Play className="ml-1 h-8 w-8 fill-current" />
          )}
        </button>
      )}

      {/* Skip Buttons */}
      {controlsVisible && !loading && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); skipBackward(); }}
            aria-label="Skip backward 10 seconds"
            className="absolute left-[calc(50%-4rem)] top-1/2 -translate-y-1/2 grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-all hover:bg-black/60 hover:scale-110 active:scale-95"
          >
            <Rewind className="h-5 w-5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); skipForward(); }}
            aria-label="Skip forward 10 seconds"
            className="absolute right-[calc(50%-4rem)] top-1/2 -translate-y-1/2 grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-all hover:bg-black/60 hover:scale-110 active:scale-95"
          >
            <FastForward className="h-5 w-5" />
          </button>
        </>
      )}

      {/* Duration Badge */}
      {!started && (
        <div className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1.5 rounded bg-black/60 px-2 py-1 text-xs text-white/90 backdrop-blur-sm">
          {duration > 0 && <span>{fmtDuration(duration)}</span>}
          {fileSize && <span className="opacity-70">· {formatBytes(fileSize)}</span>}
        </div>
      )}

      {/* Download Button */}
      {onDownload && (
        <button
          onClick={(e) => { e.stopPropagation(); onDownload(); }}
          aria-label="Download video"
          className={`absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-all hover:bg-black/70 hover:scale-110 active:scale-95 ${
            controlsVisible || !started ? "opacity-100" : "opacity-0 group-hover/player:opacity-100"
          }`}
        >
          <Download className="h-4 w-4" />
        </button>
      )}

      {/* Controls Bar */}
      {started && (
        <div
          ref={controlsRef}
          className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pb-2 pt-8 transition-all duration-300 ${
            controlsVisible ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 translate-y-2"
          }`}
          onMouseEnter={() => setControlsVisible(true)}
        >
          {/* Scrubber Bar */}
          <div className="mb-2 flex items-center gap-3">
            <span className="shrink-0 text-xs tabular-nums text-white/90">
              {fmtDuration(currentTime)}
            </span>
            
            <div
              data-scrub-track
              onPointerDown={(e) => { e.stopPropagation(); setScrubbing(true); handleScrub(e.clientX); }}
              onPointerMove={(e) => { if (scrubbing) handleScrub(e.clientX); }}
              onPointerUp={() => setScrubbing(false)}
              className="relative h-4 flex-1 cursor-pointer group/scrub"
            >
              {/* Background */}
              <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-white/20 group-hover/scrub:h-1.5 transition-all">
                {/* Buffered */}
                <div 
                  className="absolute h-full rounded-full bg-white/30 transition-all" 
                  style={{ width: `${bufferedPct}%` }} 
                />
                {/* Progress */}
                <div 
                  className="absolute h-full rounded-full bg-blue-500 transition-all" 
                  style={{ width: `${progressPct}%` }} 
                />
              </div>
              
              {/* Thumb */}
              <div
                className="absolute top-1/2 h-3 w-3 -translate-y-1/2 -translate-x-1/2 rounded-full bg-white shadow-lg opacity-0 transition-opacity group-hover/scrub:opacity-100"
                style={{ left: `${progressPct}%` }}
              />
              
              {/* Preview Tooltip */}
              {scrubbing && previewTime !== null && (
                <div
                  className="absolute -top-10 -translate-x-1/2 rounded bg-black/80 px-2 py-1 text-xs text-white"
                  style={{ left: `${previewPosition}%` }}
                >
                  {fmtDuration(previewTime)}
                </div>
              )}
            </div>

            <span className="shrink-0 text-xs tabular-nums text-white/60">
              {fmtDuration(duration)}
            </span>
          </div>

          {/* Controls Row */}
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1">
              {/* Play/Pause */}
              <button
                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                aria-label={playing ? "Pause" : "Play"}
                className="grid h-8 w-8 place-items-center rounded text-white transition-colors hover:bg-white/10"
              >
                {playing ? (
                  <Pause className="h-4 w-4 fill-current" />
                ) : (
                  <Play className="h-4 w-4 fill-current" />
                )}
              </button>

              {/* Volume */}
              <div 
                className="relative"
                onMouseEnter={() => setShowVolumeSlider(true)}
                onMouseLeave={() => setShowVolumeSlider(false)}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                  aria-label={muted ? "Unmute" : "Mute"}
                  className="grid h-8 w-8 place-items-center rounded text-white transition-colors hover:bg-white/10"
                >
                  {muted || volume === 0 ? (
                    <VolumeX className="h-4 w-4" />
                  ) : volume < 0.5 ? (
                    <Volume2 className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </button>
                
                {showVolumeSlider && (
                  <div className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 rounded-lg bg-black/90 p-2 backdrop-blur-sm">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={muted ? 0 : volume}
                      onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                      className="h-1 w-20 cursor-pointer appearance-none bg-white/30 rounded-full accent-white"
                      style={{
                        background: `linear-gradient(to right, white ${(muted ? 0 : volume) * 100}%, rgba(255,255,255,0.3) ${(muted ? 0 : volume) * 100}%)`
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Time */}
              <span className="ml-1 text-xs tabular-nums text-white/90">
                {fmtDuration(currentTime)} / {fmtDuration(duration)}
              </span>
            </div>

            <div className="flex items-center gap-1">
              {/* Playback Rate */}
              <button
                onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); }}
                aria-label="Playback settings"
                className="grid h-8 w-8 place-items-center rounded text-xs font-medium text-white transition-colors hover:bg-white/10"
              >
                {playbackRate}x
              </button>

              {/* Settings Dropdown */}
              {showSettings && (
                <div className="absolute bottom-full right-0 mb-2 min-w-[140px] rounded-lg bg-black/90 p-2 backdrop-blur-sm">
                  <div className="mb-1 px-2 text-xs font-medium text-white/50">Playback Speed</div>
                  {playbackRates.map((rate) => (
                    <button
                      key={rate}
                      onClick={() => changePlaybackRate(rate)}
                      className={`w-full rounded px-3 py-1.5 text-left text-sm transition-colors ${
                        rate === playbackRate
                          ? "bg-blue-500/20 text-blue-400"
                          : "text-white/80 hover:bg-white/10"
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              )}

              {/* Picture in Picture */}
              {document.pictureInPictureEnabled && (
                <button
                  onClick={(e) => { e.stopPropagation(); togglePiP(); }}
                  aria-label="Picture in Picture"
                  className="grid h-8 w-8 place-items-center rounded text-white transition-colors hover:bg-white/10"
                >
                  <PictureInPicture className={`h-4 w-4 ${isPiP ? "text-blue-400" : ""}`} />
                </button>
              )}

              {/* Fullscreen */}
              <button
                onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                className="grid h-8 w-8 place-items-center rounded text-white transition-colors hover:bg-white/10"
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End Screen */}
      {!playing && currentTime >= duration && duration > 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
          <button
            onClick={togglePlay}
            className="mb-4 grid h-16 w-16 place-items-center rounded-full bg-white/10 text-white transition-all hover:scale-110 hover:bg-white/20"
          >
            <Play className="ml-1 h-8 w-8 fill-current" />
          </button>
          <p className="text-sm text-white/60">Replay Video</p>
        </div>
      )}
    </div>
  );
}
