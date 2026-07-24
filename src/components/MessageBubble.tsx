import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download, Reply, Pencil, SmilePlus, Trash2,
  Play, Pause, Mic, Smile, Paperclip, Send, Image as ImageIcon,
  File as FileIcon,
} from "lucide-react";
import { VscVerifiedFilled } from "react-icons/vsc";
import { toast } from "sonner";
import { SONA_AI_ID, fmtTime, type MessageRow, type Profile, type ReactionRow, type MessageReadRow } from "@/lib/db";
import {
  type ChatWithMeta, type ReadStatus, readStatusFor, waveformBars, formatBytes, downloadFile,
  URL_REGEX, URL_REGEX_TEST, EMOJIS, REACT_EMOJIS, DOC_EXTENSIONS,
} from "@/utils";
import { Avatar, TickIcon } from "./Avatar";

// Renders message text with any URLs turned into clickable links, so shared
// support links / app links etc. aren't just inert plain text.
export function linkify(text: string) {
  const parts = text.split(URL_REGEX);
  return parts.map((part, i) =>
    URL_REGEX_TEST.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="underline underline-offset-2 opacity-90 hover:opacity-100 break-all"
      >
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export function Bubble({
  msg, me, sender, reactions, reads, otherMemberIds, onReact, opening, onOpenPicker, grouped, isGroup,
  overrideBody, onDelete, onReply, onEdit, parentName, parentBody, actionsOpen, onToggleActions,
}: {
  msg: MessageRow; me: Profile; sender?: Profile; reactions: ReactionRow[];
  reads: MessageReadRow[]; otherMemberIds: string[];
  onReact: (emoji: string) => void; opening: boolean; onOpenPicker: () => void; grouped: boolean; isGroup: boolean;
  overrideBody?: string; onDelete: () => void;
  onReply: () => void; onEdit: () => void;
  parentName?: string; parentBody?: string;
  actionsOpen: boolean; onToggleActions: () => void;
}) {
  const mine = msg.sender_id === me.id;
  const isAI = msg.sender_id === SONA_AI_ID;
  const counts: Record<string, number> = {};
  reactions.forEach((r) => { counts[r.emoji] = (counts[r.emoji] ?? 0) + 1; });
  const status: ReadStatus = readStatusFor(msg, reads, [me.id, ...otherMemberIds], me.id);

  return (
    <div className={`group flex items-end gap-2 ${mine ? "justify-end" : "justify-start"} ${grouped ? "mt-0.5" : "mt-2"}`}>
      {!mine && isGroup && !grouped && (
        <Avatar url={sender?.avatar_url} name={sender?.display_name ?? "?"} size={28} ai={isAI} />
      )}
      {!mine && isGroup && grouped && <div className="w-7 shrink-0" />}
      <div className="relative max-w-[78%]">
        <div onClick={onToggleActions} className={`relative cursor-pointer px-3 py-2 text-sm shadow-sm ${
          mine
            ? `bg-[#E07A5F] text-white rounded-2xl ${grouped ? "rounded-br-2xl" : "rounded-br-sm"}`
            : `bg-white dark:bg-[#2A2A2A] text-[#2D3436] dark:text-[#E8E8E8] rounded-2xl ${grouped ? "rounded-bl-2xl" : "rounded-bl-sm"} border border-[#E07A5F]/10`
        }`}>

          {!mine && !grouped && (isAI || isGroup) && (
            <div className="mb-0.5 text-[11px] text-[#E07A5F] flex items-center gap-1">
              {isAI ? (
  <div className="flex items-center gap-2">
    <span className="flex items-center gap-1.5 font-semibold text-emerald-400 text-sm">
      Sona
      <VscVerifiedFilled className="h-3.5 w-3.5 text-blue-600" />
      
    </span>
    <span className="text-[11px] text-gray-400 hover:text-emerald-400 transition-colors cursor-pointer">
      Learn more
    </span>
  </div>
) : (
  <span className="text-xs font-medium text-gray-400">
    ~{sender?.display_name ?? "Sonatg"}
  </span>
)}
            </div>
          )}
          {parentBody !== undefined && (
            <div className={`mb-1.5 rounded-lg border-l-2 border-[#E07A5F] px-2 py-1 text-[11px] ${mine ? "bg-black/10" : "bg-[#F5F0E8] dark:bg-white/5"}`}>
              <div className="font-semibold text-[#E07A5F]">{parentName}</div>
              <div className="truncate opacity-80 max-w-[240px]">{parentBody}</div>
            </div>
          )}
          {msg.kind === "image" && msg.media_url && (
            <div className="relative mb-1 group/image">
              <img src={msg.media_url} alt="" loading="lazy" className="max-h-72 w-full rounded-xl object-cover" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  downloadFile(msg.media_url!, `sona-photo-${msg.id}.jpg`);
                }}
                aria-label="Download image"
                className="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-black/50 text-white backdrop-blur-sm opacity-80 hover:opacity-100 active:scale-95 transition"
              >
                <Download className="h-4 w-4" />
              </button>
            </div>
          )}
          {msg.kind === "file" && msg.media_url && (
            <button
              onClick={(e) => { e.stopPropagation(); downloadFile(msg.media_url!, msg.file_name || "file"); }}
              className={`mb-1 flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                mine ? "border-white/25 bg-white/10 hover:bg-white/15" : "border-[#E07A5F]/20 bg-[#F5F0E8] dark:bg-[#3A3A3A] hover:bg-[#EFE6D8] dark:hover:bg-[#454545]"
              }`}
            >
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${mine ? "bg-white/20 text-white" : "bg-[#E07A5F]/15 text-[#E07A5F]"}`}>
                <FileIcon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-sm font-medium ${mine ? "text-white" : "text-[#2D3436] dark:text-[#E8E8E8]"}`}>
                  {msg.file_name || "File"}
                </span>
                <span className={`block text-xs ${mine ? "text-white/70" : "text-[#8C8C8C]"}`}>
                  {msg.file_size ? formatBytes(msg.file_size) : ""}
                </span>
              </span>
              <Download className={`h-4 w-4 shrink-0 ${mine ? "text-white/80" : "text-[#8C8C8C]"}`} />
            </button>
          )}
          {msg.kind === "voice" && msg.media_url && (
            <VoicePlayer
              url={msg.media_url}
              durationMs={msg.duration_ms ?? 0}
              mine={mine}
              avatarUrl={sender?.avatar_url}
              avatarName={sender?.display_name ?? "?"}
            />
          )}
          {(overrideBody ?? msg.body) && <p className="whitespace-pre-wrap break-words leading-relaxed pr-12">{linkify(overrideBody ?? msg.body ?? "")}</p>}
          <div className={`mt-0.5 flex items-center justify-end gap-1.5 text-[10px] ${mine ? "text-white/80" : "text-[#8C8C8C]"}`}>
            {/* Reactions come before the timestamp, in the same row */}
            {Object.keys(counts).length > 0 && (
              <div className="flex flex-wrap items-center gap-1 mr-auto">
                {Object.entries(counts).map(([e, n]) => {
                  const mineReacted = reactions.some((r) => r.emoji === e && r.user_id === me.id);
                  return (
                    <button
                      key={e}
                      onClick={(ev) => { ev.stopPropagation(); onReact(e); }}
                      className={`flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[11px] ${
                        mine ? "border-white/25 bg-white/10" : "border-[#E07A5F]/20 bg-[#FFFDF9] dark:bg-[#2A2A2A]"
                      } ${mineReacted ? "ring-1 ring-[#E07A5F]" : ""}`}
                    >
                      <span>{e}</span><span className="text-[9px] opacity-80">{n}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {msg.edited_at && <span className="italic">edited</span>}
            <span>{fmtTime(msg.created_at)}</span>
            {mine && <TickIcon status={status} className="h-3.5 w-3.5" />}
          </div>
          {/* Action rail */}
          <div className={`absolute ${mine ? "-left-2 -translate-x-full" : "-right-2 translate-x-full"} top-1/2 -translate-y-1/2 flex items-center gap-1 transition ${actionsOpen ? "opacity-100" : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto"}`}
            onClick={(e) => e.stopPropagation()}>
            <button onClick={onReply} className="grid h-7 w-7 place-items-center rounded-full bg-[#FFFDF9] dark:bg-[#3A3A3A] border border-[#E07A5F]/20 shadow-sm" aria-label="Reply">
              <Reply className="h-3.5 w-3.5 text-[#E07A5F]" />
            </button>
            <button onClick={onOpenPicker} className="grid h-7 w-7 place-items-center rounded-full bg-[#FFFDF9] dark:bg-[#3A3A3A] border border-[#E07A5F]/20 shadow-sm" aria-label="React">
              <SmilePlus className="h-3.5 w-3.5 text-[#E07A5F]" />
            </button>
            {mine && msg.kind === "text" && (
              <button onClick={onEdit} className="grid h-7 w-7 place-items-center rounded-full bg-[#FFFDF9] dark:bg-[#3A3A3A] border border-[#E07A5F]/20 shadow-sm" aria-label="Edit">
                <Pencil className="h-3.5 w-3.5 text-[#E07A5F]" />
              </button>
            )}
            {mine && (
              <button onClick={onDelete} className="grid h-7 w-7 place-items-center rounded-full bg-[#FFFDF9] dark:bg-[#3A3A3A] border border-[#E07A5F]/20 shadow-sm text-red-500" aria-label="Delete">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {opening && (
            <div className={`absolute -top-10 ${mine ? "right-0" : "left-0"} z-10 flex gap-1 rounded-full border border-[#E07A5F]/10 bg-[#FFFDF9] dark:bg-[#2A2A2A] px-2 py-1 shadow-lg`}>
              {REACT_EMOJIS.map((e) => (
                <button key={e} onClick={() => onReact(e)} className="text-lg hover:scale-125 transition">{e}</button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


export function VoicePlayer({ url, durationMs, mine, avatarUrl, avatarName }: { url: string; durationMs: number; mine: boolean; avatarUrl?: string | null; avatarName?: string }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hasPlayed, setHasPlayed] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bars = useMemo(() => waveformBars(url), [url]);

  useEffect(() => {
    const a = new Audio(url);
    audioRef.current = a;
    a.addEventListener("timeupdate", () => setProgress(a.duration ? a.currentTime / a.duration : 0));
    a.addEventListener("ended", () => { setPlaying(false); setProgress(0); });
    return () => { a.pause(); audioRef.current = null; };
  }, [url]);

  const toggle = () => {
    const a = audioRef.current; if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play(); setPlaying(true); setHasPlayed(true); }
  };

  const secs = Math.round(durationMs / 1000);
  const filledColor = mine ? "bg-white" : "bg-[#E07A5F]";
  const mutedColor = mine ? "bg-white/35" : "bg-[#E07A5F]/30";

  return (
    <div className="min-w-[240px] py-1">
      <div className="flex items-center gap-2">
        <button onClick={toggle} className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${mine ? "bg-white/25 text-white" : "bg-[#E07A5F]/15 text-[#E07A5F]"}`}>
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
        </button>

        {/* Unplayed indicator dot, WhatsApp-style — disappears once played */}
        {!hasPlayed && (
          <span className={`h-2 w-2 shrink-0 rounded-full ${mine ? "bg-white" : "bg-[#4FA6E0]"}`} />
        )}

        {/* Waveform */}
        <button onClick={toggle} className="flex flex-1 items-center gap-[2px] h-8" aria-label={playing ? "Pause" : "Play"}>
          {bars.map((h, i) => {
            const barProgress = i / bars.length;
            const isFilled = barProgress <= progress;
            return (
              <span
                key={i}
                className={`w-[3px] rounded-full transition-colors ${isFilled ? filledColor : mutedColor}`}
                style={{ height: `${Math.round(h * 100)}%` }}
              />
            );
          })}
        </button>

        {/* Sender avatar with a mic badge, WhatsApp-style */}
        <div className="relative shrink-0">
          <Avatar url={avatarUrl} name={avatarName ?? "?"} size={38} />
          <span className={`absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full ring-2 ${mine ? "bg-white text-[#E07A5F] ring-[#E07A5F]" : "bg-[#E07A5F] text-white ring-white dark:ring-[#2A2A2A]"}`}>
            <Mic className="h-2.5 w-2.8" />
          </span>
        </div>
      </div>

      <div className="mt-1 flex items-center justify-between pl-11">
        <button
          onClick={(e) => { e.stopPropagation(); toast.info("Transcription is coming soon"); }}
          className={`text-[11px] font-medium ${mine ? "text-white/90" : "text-[#E07A5F]"} hover:underline`}
        >
          Transcribe
        </button>
        <span className={`text-[10px] tabular-nums ${mine ? "text-white/70" : "text-[#8C8C8C]"}`}>
          {String(Math.floor(secs / 60)).padStart(1, "0")}:{String(secs % 60).padStart(2, "0")}
        </span>
      </div>
    </div>
  );
}


export function Composer({
  draft, setDraft, showEmoji, setShowEmoji, onPickImages, fileRef, onPickDocs, docRef, onSend, onVoiceUploaded,
}: {
  draft: string; setDraft: (v: string) => void;
  showEmoji: boolean; setShowEmoji: (v: boolean | ((s: boolean) => boolean)) => void;
  onPickImages: (files?: FileList | null) => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onPickDocs: (files?: FileList | null) => void;
  docRef: React.RefObject<HTMLInputElement | null>;
  onSend: () => void;
  onVoiceUploaded: (blob: Blob, durationMs: number) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm"
        : "audio/mp4";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const dur = Date.now() - startedRef.current;
        const blob = new Blob(chunksRef.current, { type: mime });
        stream.getTracks().forEach((t) => t.stop());
        if (blob.size > 1000) onVoiceUploaded(blob, dur);
      };
      startedRef.current = Date.now();
      rec.start();
      mediaRef.current = rec;
      setRecording(true); setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } catch { toast.error("Microphone permission denied"); }
  };
  const stopRec = (cancel = false) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const rec = mediaRef.current;
    if (!rec) return;
    if (cancel) chunksRef.current = [];
    rec.stop();
    mediaRef.current = null;
    setRecording(false); setElapsed(0);
  };

  return (
    <div className="relative border-t border-[#E07A5F]/10 bg-[#FFFDF9] dark:bg-[#242424] px-2 py-2 md:px-6 md:py-3">
      {showEmoji && (
        <div className="absolute bottom-full left-2 mb-2 grid max-h-56 max-w-xs grid-cols-8 gap-1 overflow-y-auto rounded-2xl border border-[#E07A5F]/10 bg-[#FFFDF9] dark:bg-[#2A2A2A] p-2 shadow-xl md:left-6">
          {EMOJIS.map((e) => (
            <button key={e} onClick={() => setDraft(draft + e)} className="grid h-8 w-8 place-items-center rounded-lg text-lg hover:bg-[#F4A261]/20">{e}</button>
          ))}
        </div>
      )}
      {recording ? (
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <button onClick={() => stopRec(true)} className="grid h-11 w-11 place-items-center rounded-full bg-[#F5F0E8] dark:bg-[#3A3A3A] text-red-500"><Trash2 className="h-5 w-5" /></button>
          <div className="flex flex-1 items-center gap-2 rounded-3xl bg-[#F5F0E8] dark:bg-[#2A2A2A] px-4 py-3 border border-[#E07A5F]/10">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
            <span className="text-sm text-[#2D3436] dark:text-[#E8E8E8]">Recording… {String(Math.floor(elapsed / 60)).padStart(1, "0")}:{String(elapsed % 60).padStart(2, "0")}</span>
          </div>
          <button onClick={() => stopRec(false)} className="grid h-11 w-11 place-items-center rounded-full bg-[#E07A5F] text-white shadow-md hover:bg-[#D4694F] transition"><Send className="h-5 w-5" /></button>
        </div>
      ) : (
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <div className="flex flex-1 items-center gap-1.5 rounded-3xl bg-[#F5F0E8] dark:bg-[#2A2A2A] px-2 py-1.5 border border-[#E07A5F]/10">
            <button onClick={() => setShowEmoji((s) => !s)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#8C8C8C] hover:bg-[#F4A261]/20"><Smile className="h-5 w-5" /></button>
            <textarea
              value={draft} onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
              rows={1} placeholder="Type a message · @sona for AI"
              className="max-h-32 min-h-6 flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-[#8C8C8C] text-[#2D3436] dark:text-[#E8E8E8] py-1.5"
            />
            <button onClick={() => docRef.current?.click()} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#8C8C8C] hover:bg-[#F4A261]/20" aria-label="Attach file">
              <Paperclip className="h-5 w-5" />
            </button>
            <input
              ref={docRef} type="file" multiple accept={DOC_EXTENSIONS.join(",")}
              className="hidden" onChange={(e) => { onPickDocs(e.target.files); e.target.value = ""; }}
            />
            <button onClick={() => fileRef.current?.click()} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#8C8C8C] hover:bg-[#F4A261]/20" aria-label="Image">
              <ImageIcon className="h-5 w-5" />
            </button>
            <input
              ref={fileRef} type="file" multiple accept="image/*"
              className="hidden" onChange={(e) => { onPickImages(e.target.files); e.target.value = ""; }}
            />
          </div>
          {draft.trim() ? (
            <button onClick={onSend} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#E07A5F] text-white shadow-md hover:bg-[#D4694F] transition"><Send className="h-5 w-5" /></button>
          ) : (
            <button onClick={startRec} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#E07A5F] text-white shadow-md hover:bg-[#D4694F] transition"><Mic className="h-5 w-5" /></button>
          )}
        </div>
      )}
    </div>
  );
}
