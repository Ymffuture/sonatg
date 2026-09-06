import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Plus, Type, Image as ImageIcon, Video, Send, Eye, Trash2, RotateCw,
  ChevronLeft, ChevronRight, Users, Clock,
} from "lucide-react";
import { Skeleton, Badge, notification, Spin, Alert, Progress, Tooltip } from "antd";
import { LoadingOutlined } from "@ant-design/icons";
import { supabase } from "@/integrations/supabase/client";
import {
  type Profile, type StatusRow,
  STATUS_MAX_DURATION_MS, STATUS_MAX_BYTES_SUPABASE,
  STATUS_TEXT_BACKGROUNDS, STATUS_PRIVACY_OPTIONS, type StatusPrivacy,
} from "@/lib/db";
import { readVideoDurationMs } from "@/utils/cloudinary";
import { explainSupabaseError } from "@/utils/utils";
import { Avatar } from "./Avatar";
import { useConfirm } from "@/hooks/useConfirmDialog";

const TEXT_STATUS_MS = 5000;

/* ─── Premium Theme Tokens ───────────────────────────────────── */
const THEME = {
  accent: "#E07A5F",
  accentHover: "#d4694f",
  bg: "#09090b", // zinc-950
  surface: "rgba(24, 24, 27, 0.7)", // zinc-900/70
  elevated: "rgba(39, 39, 42, 0.8)", // zinc-800/80
  text: "#fafafa", // zinc-50
  textMuted: "#a1a1aa", // zinc-400
  ringSeen: "#52525b", // zinc-600
  ringUnseen: "linear-gradient(135deg, #34d399, #f43f5e, #8b5cf6)", // emerald -> rose -> violet
};

/* ─── Relative time ──────────────────────────────────────────── */
function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

type GroupedStatuses = { user: Profile; statuses: StatusRow[]; unseenCount: number; allSeen: boolean };

/* ─── Media URLs ─────────────────────────────────────────────── */
const signedCache = new Map<string, string>();

export function useStatusMediaUrl(status: StatusRow | undefined): string | null {
  const [url, setUrl] = useState<string | null>(status?.media_url ?? null);
  useEffect(() => {
    let alive = true;
    if (!status || status.kind === "text") { setUrl(null); return; }
    const path = status.media_path;
    if (!path) { setUrl(status.media_url ?? null); return; }
    const cached = signedCache.get(path);
    if (cached) { setUrl(cached); return; }
    (async () => {
      const { data } = await supabase.storage.from("statuses").createSignedUrl(path, 60 * 60);
      if (!alive) return;
      if (data?.signedUrl) { signedCache.set(path, data.signedUrl); setUrl(data.signedUrl); }
      else setUrl(status.media_url ?? null);
    })();
    return () => { alive = false; };
  }, [status]);
  return url;
}

/* ─── Status bar (horizontal row of avatars) ─────────────────── */
export function StatusBar({
  meId, profilesById, onOpenComposer, onOpenViewer,
}: {
  meId: string;
  profilesById: Record<string, Profile>;
  onOpenComposer: () => void;
  onOpenViewer: (userId: string) => void;
}) {
  const [statuses, setStatuses] = useState<StatusRow[]>([]);
  const [myViews, setMyViews] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: rows }, { data: views }] = await Promise.all([
      supabase.from("statuses").select("*").order("created_at", { ascending: false }),
      supabase.from("status_views").select("status_id").eq("viewer_id", meId),
    ]);
    setStatuses((rows ?? []) as StatusRow[]);
    setMyViews(new Set((views ?? []).map((v: { status_id: string }) => v.status_id)));
    setLoading(false);
  }, [meId]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("statuses-bar")
      .on("postgres_changes", { event: "*", schema: "public", table: "statuses" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "status_views" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const grouped: GroupedStatuses[] = useMemo(() => {
    const byUser = new Map<string, StatusRow[]>();
    for (const s of statuses) {
      if (!byUser.has(s.user_id)) byUser.set(s.user_id, []);
      byUser.get(s.user_id)!.push(s);
    }
    return Array.from(byUser.entries())
      .map(([userId, list]) => {
        const unseen = list.filter((s) => !myViews.has(s.id)).length;
        return {
          user: profilesById[userId] ?? { id: userId, display_name: "Someone", avatar_url: null, email: null, is_ai: false },
          statuses: list,
          unseenCount: unseen,
          allSeen: unseen === 0,
        };
      })
      .filter((g) => g.user.id !== meId)
      .sort((a, b) => (a.allSeen === b.allSeen ? 0 : a.allSeen ? 1 : -1));
  }, [statuses, profilesById, myViews, meId]);

  const myStatuses = statuses.filter((s) => s.user_id === meId);
  const me = profilesById[meId];
  const latestOf = (list: StatusRow[]) => list[0];

  return (
    <div className="flex gap-4 overflow-x-auto px-4 py-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-700"
      style={{ backgroundColor: THEME.bg, borderBottom: `1px solid rgba(255,255,255,0.06)` }}
    >
      {/* My status */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => (myStatuses.length ? onOpenViewer(meId) : onOpenComposer())}
        className="relative shrink-0 select-none overflow-hidden rounded-2xl transition-all"
        style={{ width: 108, height: 176, backgroundColor: THEME.elevated }}
      >
        {loading ? (
          <Skeleton.Image active className="!h-full !w-full !rounded-2xl" />
        ) : (
          <>
            {myStatuses.length > 0 && <StatusCardBackground status={latestOf(myStatuses)} />}
            <div className="absolute inset-0 flex flex-col justify-between p-3 bg-black/20">
              <div className="flex justify-start">
                <div className="rounded-full p-[2.5px]" style={{ background: myStatuses.length ? THEME.ringUnseen : "transparent" }}>
                  <Avatar url={me?.avatar_url} name={me?.display_name ?? "Me"} size={40} />
                </div>
              </div>
              <div className="flex items-end justify-between gap-1">
                <span className="text-[11px] font-bold truncate drop-shadow-md" style={{ color: THEME.text }}>
                  {myStatuses.length ? "My status" : "Add status"}
                </span>
                {myStatuses.length === 0 && (
                  <motion.div 
                    animate={{ scale: [1, 1.1, 1] }} 
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-black shadow-lg"
                    style={{ backgroundColor: THEME.accent }}
                  >
                    <Plus className="h-4 w-4" />
                  </motion.div>
                )}
              </div>
            </div>
          </>
        )}
      </motion.button>

      {/* Others */}
      {loading
        ? Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="shrink-0 overflow-hidden rounded-2xl" style={{ width: 108, height: 176 }}>
              <Skeleton.Image active className="!h-full !w-full !rounded-2xl" />
            </div>
          ))
        : grouped.map((g) => {
            const latest = latestOf(g.statuses);
            return (
              <motion.button
                key={g.user.id}
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onOpenViewer(g.user.id)}
                className="relative shrink-0 select-none overflow-hidden rounded-2xl transition-all shadow-lg"
                style={{ width: 108, height: 176, backgroundColor: THEME.elevated }}
              >
                <StatusCardBackground status={latest} />
                <div className="absolute inset-0 flex flex-col justify-between p-3 bg-gradient-to-b from-black/40 via-transparent to-black/60">
                  <div className="flex justify-start">
                    <Badge count={g.unseenCount} overflowCount={9} size="small" offset={[-4, 4]}
                      style={{ backgroundColor: THEME.accent, color: "#000", fontWeight: 800, fontSize: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>
                      <div className="rounded-full p-[2.5px]" style={{ background: g.allSeen ? THEME.ringSeen : THEME.ringUnseen }}>
                        <Avatar url={g.user.avatar_url} name={g.user.display_name} size={40} ai={g.user.is_ai} />
                      </div>
                    </Badge>
                  </div>
                  <span className="text-[11px] font-bold leading-tight line-clamp-2 drop-shadow-md" style={{ color: THEME.text }}>
                    {g.user.display_name}
                  </span>
                </div>
              </motion.button>
            );
          })}
    </div>
  );
}

function StatusCardBackground({ status }: { status: StatusRow }) {
  const mediaUrl = useStatusMediaUrl(status);
  if (status.kind === "image") {
    return <img src={mediaUrl ?? ""} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ filter: "brightness(0.75)" }} />;
  }
  if (status.kind === "video") {
    return <video src={mediaUrl ?? ""} muted playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" style={{ filter: "brightness(0.75)" }} />;
  }
  return (
    <div className="absolute inset-0 flex items-center justify-center p-3" style={{ backgroundColor: status.background_color || THEME.accent }}>
      <p className="text-center text-[11px] font-bold text-white line-clamp-4 opacity-90 drop-shadow-sm">{status.body}</p>
    </div>
  );
}

/* ─── Upload with progress ──────────────────────────────────── */
async function uploadWithProgress(path: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  const { data, error } = await supabase.storage.from("statuses").createSignedUploadUrl(path);
  if (error || !data?.signedUrl) throw error ?? new Error("Couldn't start the upload");

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", data.signedUrl, true);
    if (file.type) xhr.setRequestHeader("content-type", file.type);
    xhr.setRequestHeader("x-upsert", "true");
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Network error while uploading"));
    xhr.onabort = () => reject(new Error("Upload cancelled"));
    xhr.send(file);
  });
}

/* ─── Composer ────────────────────────────────────────────────── */
export function StatusComposer({
  meId, onClose, onPosted, initialMode = "text",
}: {
  meId: string; onClose: () => void; onPosted: () => void; initialMode?: "text" | "image" | "video";
}) {
  const [mode, setMode] = useState<"text" | "image" | "video">(initialMode);
  const [text, setText] = useState("");
  const [bgColor, setBgColor] = useState(STATUS_TEXT_BACKGROUNDS[0]);
  const [file, setFile] = useState<File | null>(null);
  const [posting, setPosting] = useState(false);
  const [privacy, setPrivacy] = useState<StatusPrivacy>("contacts");
  const [mediaLoading, setMediaLoading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => {
    const saved = localStorage.getItem("sona-status-privacy");
    if (saved === "public" || saved === "contacts" || saved === "only_me") setPrivacy(saved);
  }, []);

  const maxBytes = STATUS_MAX_BYTES_SUPABASE;

  const pickFile = async (f: File | null, kind: "image" | "video") => {
    if (!f) return;
    if (f.size > maxBytes) {
      notification.error({ message: "File too large", description: `Max ${Math.round(maxBytes / (1024 * 1024))}MB`, placement: "top" });
      return;
    }
    if (kind === "video") {
      try {
        const durationMs = await readVideoDurationMs(f);
        if (durationMs > STATUS_MAX_DURATION_MS) {
          notification.error({ message: "Video too long", description: "Video clips must be 60 seconds or shorter", placement: "top" });
          return;
        }
      } catch {
        notification.error({ message: "Invalid video", description: "Couldn't read video metadata", placement: "top" });
        return;
      }
    }
    setFile(f);
    setMode(kind);
    setMediaLoading(true);
  };

  const post = async () => {
    if (mode === "text" && !text.trim()) return notification.warning({ message: "Empty status", description: "Write something first", placement: "top" });
    if (mode !== "text" && !file) return notification.warning({ message: "No file", description: "Choose a file first", placement: "top" });
    
    setPosting(true);
    setFailed(null);

    try {
      let media_url: string | null = null;
      let media_path: string | null = null;
      let duration_ms: number | null = null;

      if (file) {
        if (mode === "video") duration_ms = Math.round(await readVideoDurationMs(file));
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
        const path = `${meId}/${crypto.randomUUID()}-${safeName}`;

        setProgress(0);
        await uploadWithProgress(path, file, setProgress);
        setProgress(100);

        const { data: signed } = await supabase.storage.from("statuses").createSignedUrl(path, 60 * 60 * 25);
        media_url = signed?.signedUrl ?? null;
        media_path = path;
      }

      const { error } = await supabase.from("statuses").insert({
        user_id: meId,
        kind: mode,
        body: mode === "text" ? text.trim() : (text.trim() || null),
        media_url, media_path, media_provider: "supabase", media_public_id: null, duration_ms,
        background_color: mode === "text" ? bgColor : null,
        privacy,
      });
      if (error) throw error;

      localStorage.setItem("sona-status-privacy", privacy);
      notification.success({ message: "Status posted", description: "Visible for 24 hours", placement: "top" });
      onPosted();
      onClose();
    } catch (e) {
      const explained = explainSupabaseError(e);
      setFailed(explained.explanation || explained.title);
      notification.error({ message: explained.title, description: `${explained.explanation} — tap Retry to try again.`, placement: "top", duration: 6 });
    } finally {
      setProgress(null);
      setPosting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex flex-col"
      style={{ backgroundColor: THEME.bg }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <motion.button whileTap={{ scale: 0.9 }} onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-white/10" style={{ color: THEME.text }}>
          <X className="h-5 w-5" />
        </motion.button>

        <div className="flex gap-1.5 rounded-full p-1" style={{ backgroundColor: THEME.elevated }}>
          {(["text", "image", "video"] as const).map((m) => (
            <motion.button
              key={m}
              whileTap={{ scale: 0.95 }}
              onClick={() => { setMode(m); if (m !== "text") fileRef.current?.click(); }}
              className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-all"
              style={mode === m ? { backgroundColor: THEME.accent, color: "#000" } : { backgroundColor: "transparent", color: THEME.textMuted }}
            >
              {m === "text" && <Type className="h-3.5 w-3.5" />}
              {m === "image" && <ImageIcon className="h-3.5 w-3.5" />}
              {m === "video" && <Video className="h-3.5 w-3.5" />}
              <span className="capitalize hidden sm:inline">{m}</span>
            </motion.button>
          ))}
        </div>

        <div className="w-10" />
      </div>

      <input ref={fileRef} type="file" accept={mode === "video" ? "video/*" : "image/*,video/*"} className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f, f.type.startsWith("video/") ? "video" : "image"); e.target.value = ""; }} />

      {/* Canvas */}
      <div className="flex-1 flex items-center justify-center p-6">
        <AnimatePresence mode="wait">
          {mode === "text" ? (
            <motion.div key="text" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-sm">
              <motion.div layout className="w-full aspect-[9/16] max-h-[60vh] rounded-3xl flex items-center justify-center p-8 shadow-2xl border border-white/10" style={{ backgroundColor: bgColor }}>
                <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a status…" maxLength={280}
                  className="w-full h-full bg-transparent text-white text-center text-3xl font-bold leading-tight outline-none resize-none placeholder:text-white/40" />
              </motion.div>
              <div className="mt-6 flex justify-center gap-3 flex-wrap">
                {STATUS_TEXT_BACKGROUNDS.map((c) => (
                  <motion.button key={c} whileTap={{ scale: 0.9 }} onClick={() => setBgColor(c)}
                    className="h-9 w-9 rounded-full transition-all shadow-md"
                    style={{ backgroundColor: c, outline: bgColor === c ? `3px solid ${THEME.accent}` : "none", outlineOffset: 2 }} />
                ))}
              </div>
            </motion.div>
          ) : preview ? (
            <motion.div key="media" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
              {mediaLoading && (
                <div className="w-full aspect-[9/16] max-h-[60vh] rounded-3xl overflow-hidden mb-4 flex items-center justify-center border border-white/10" style={{ backgroundColor: THEME.elevated }}>
                  <Spin indicator={<LoadingOutlined style={{ fontSize: 28, color: THEME.accent }} spin />} />
                </div>
              )}
              <motion.div layout className="relative w-full max-h-[60vh] rounded-3xl overflow-hidden border border-white/10 shadow-2xl" style={{ backgroundColor: THEME.elevated }}>
                {mode === "image" ? (
                  <img src={preview} alt="" className="w-full h-full object-contain" onLoad={() => setMediaLoading(false)} onError={() => setMediaLoading(false)} />
                ) : (
                  <video src={preview} controls className="w-full h-full object-contain" onLoadedData={() => setMediaLoading(false)} onError={() => setMediaLoading(false)} />
                )}
              </motion.div>
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a caption…" maxLength={200}
                className="mt-4 w-full rounded-2xl px-4 py-3.5 text-sm outline-none border border-white/10 focus:border-white/20 transition-colors placeholder:text-white/30"
                style={{ backgroundColor: THEME.elevated, color: THEME.text }} />
            </motion.div>
          ) : (
            <motion.button key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center gap-4 p-8 rounded-3xl border-2 border-dashed border-white/10 hover:border-white/20 hover:bg-white/5 transition-all"
              style={{ color: THEME.textMuted }}
            >
              {mode === "image" ? <ImageIcon className="h-14 w-14 opacity-50" /> : <Video className="h-14 w-14 opacity-50" />}
              <span className="text-base font-semibold">Tap to choose a {mode}</span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="p-5 border-t border-white/5" style={{ backgroundColor: THEME.surface }}>
        <div className="mb-4">
          <p className="mb-2.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: THEME.textMuted }}>Who can see this</p>
          <div className="flex gap-2">
            {STATUS_PRIVACY_OPTIONS.map((o) => (
              <motion.button key={o.value} whileTap={{ scale: 0.95 }} onClick={() => setPrivacy(o.value)}
                className="flex-1 rounded-xl px-3 py-3 text-xs font-bold transition-all border"
                style={privacy === o.value ? { backgroundColor: THEME.accent, color: "#000", borderColor: THEME.accent } : { backgroundColor: "transparent", color: THEME.textMuted, borderColor: "rgba(255,255,255,0.1)" }}
              >
                {o.label}
              </motion.button>
            ))}
          </div>
        </div>

        {progress !== null && (
          <div className="mb-4">
            <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold" style={{ color: THEME.textMuted }}>
              <span>{progress < 100 ? "Uploading…" : "Finishing up…"}</span>
              <span>{progress}%</span>
            </div>
            <Progress percent={progress} size="small" strokeColor={THEME.accent} trailColor="rgba(255,255,255,0.1)" showInfo={false} status={progress < 100 ? "active" : "success"} className="!m-0" />
          </div>
        )}

        {failed && !posting && (
          <div className="mb-4">
            <Alert message={
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] leading-snug font-medium">{failed}</span>
                <motion.button whileTap={{ scale: 0.95 }} onClick={post} className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold" style={{ backgroundColor: THEME.accent, color: "#000" }}>
                  <RotateCw className="h-3 w-3" /> Retry
                </motion.button>
              </div>
            } type="error" showIcon closable onClose={() => setFailed(null)} className="rounded-xl border-red-500/20 bg-red-500/10 text-red-400" />
          </div>
        )}

        <motion.button whileTap={{ scale: 0.98 }} onClick={post} disabled={posting}
          className="w-full flex items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold transition-all disabled:opacity-60 shadow-lg"
          style={{ backgroundColor: THEME.accent, color: "#000", boxShadow: `0 4px 20px -5px ${THEME.accent}60` }}
        >
          {posting ? <LoadingOutlined style={{ fontSize: 16, color: "#000" }} /> : <Send className="h-4 w-4" />}
          {posting ? (progress !== null ? `Uploading ${progress}%` : "Posting…") : failed ? "Try again" : "Post status"}
        </motion.button>
      </div>
    </motion.div>
  );
}

/* ─── Full-screen viewer ──────────────────────────────────────── */
export function StatusViewer({
  userId, meId, profilesById, onClose,
}: {
  userId: string; meId: string; profilesById: Record<string, Profile>; onClose: () => void;
}) {
  const confirm = useConfirm();
  const [statuses, setStatuses] = useState<StatusRow[]>([]);
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [viewers, setViewers] = useState<(Profile & { viewed_at: string })[]>([]);
  const [showViewers, setShowViewers] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const pausedRef = useRef(false);
  const isSelf = userId === meId;

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("statuses").select("*").eq("user_id", userId).order("created_at", { ascending: true });
      setStatuses((data ?? []) as StatusRow[]);
    })();
  }, [userId]);

  const current = statuses[index];
  const currentMediaUrl = useStatusMediaUrl(current);

  useEffect(() => {
    if (!current) return;
    setImageLoading(current.kind !== "text");
    if (!isSelf) {
      supabase.from("status_views").insert({ status_id: current.id, viewer_id: meId }).then(() => {});
    } else {
      (async () => {
        const { data } = await supabase.from("status_views").select("viewer_id, viewed_at").eq("status_id", current.id);
        const list = (data ?? []).map((v: { viewer_id: string; viewed_at: string }) => ({
          ...(profilesById[v.viewer_id] ?? { id: v.viewer_id, display_name: "Someone", avatar_url: null, email: null, is_ai: false }),
          viewed_at: v.viewed_at,
        }));
        setViewers(list);
      })();
    }
  }, [current, isSelf, meId, profilesById]);

  useEffect(() => {
    if (!current) return;
    setProgress(0);
    startRef.current = performance.now();
    pausedRef.current = false;
    const durationMs = current.kind === "video" && current.duration_ms ? current.duration_ms : TEXT_STATUS_MS;

    const tick = (now: number) => {
      if (!pausedRef.current) {
        const elapsed = now - startRef.current;
        const pct = Math.min(1, elapsed / durationMs);
        setProgress(pct);
        if (pct >= 1) {
          if (index < statuses.length - 1) setIndex((i) => i + 1);
          else onClose();
          return;
        }
      } else {
        startRef.current = now - progress * durationMs;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [current?.id, index, statuses.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        if (index < statuses.length - 1) setIndex((i) => i + 1); else onClose();
      } else if (e.key === "ArrowLeft") {
        if (index > 0) setIndex((i) => i - 1); else onClose();
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [index, statuses.length, onClose]);

  const deleteCurrent = async () => {
    if (!current || !(await confirm({ title: "Delete this status?", description: "This cannot be undone.", confirmText: "Delete", danger: true }))) return;
    const { error } = await supabase.from("statuses").delete().eq("id", current.id);
    if (error) {
      const explained = explainSupabaseError(error);
      notification.error({ message: explained.title, description: explained.explanation, placement: "top" });
      return;
    }
    notification.success({ message: "Deleted", description: "Status removed", placement: "top" });
    if (statuses.length <= 1) onClose();
    else setStatuses((prev) => prev.filter((s) => s.id !== current.id));
  };

  if (!current) return null;
  const user = profilesById[userId] ?? { id: userId, display_name: "Someone", avatar_url: null, email: null, is_ai: false };
  const agoLabel = formatRelativeTime(current.created_at);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] flex flex-col select-none" style={{ backgroundColor: THEME.bg }}>
      {/* Progress segments */}
      <div className="flex gap-1.5 p-4 pt-5">
        {statuses.map((s, i) => (
          <div key={s.id} className="h-1.5 flex-1 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.2)" }}>
            <motion.div className="h-full rounded-full" style={{ backgroundColor: "#fff" }}
              animate={{ width: `${i < index ? 100 : i === index ? progress * 100 : 0}%` }}
              transition={{ type: "tween", ease: "linear", duration: 0.1 }} />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pb-3">
        <Avatar url={user.avatar_url} name={user.display_name} size={36} ai={user.is_ai} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate" style={{ color: THEME.text }}>{user.display_name}</p>
          <p className="text-xs font-medium flex items-center gap-1" style={{ color: THEME.textMuted }}>
            <Clock className="h-3 w-3" /> {agoLabel}
          </p>
        </div>
        {isSelf && (
          <motion.button whileTap={{ scale: 0.9 }} onClick={deleteCurrent} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10 transition-colors" style={{ color: THEME.textMuted }} aria-label="Delete">
            <Trash2 className="h-4 w-4" />
          </motion.button>
        )}
        <motion.button whileTap={{ scale: 0.9 }} onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10 transition-colors" style={{ color: THEME.text }} aria-label="Close">
          <X className="h-5 w-5" />
        </motion.button>
      </div>

      {/* Content */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden">
        {/* Tap zones with visual feedback */}
        <motion.button className="absolute left-0 top-0 h-full w-1/3 z-10 flex items-center justify-start pl-4 opacity-0 hover:opacity-100 transition-opacity"
          whileTap={{ backgroundColor: "rgba(255,255,255,0.1)" }}
          aria-label="Previous" onClick={() => (index > 0 ? setIndex((i) => i - 1) : onClose())}>
          <ChevronLeft className="h-8 w-8 text-white/70 drop-shadow-md" />
        </motion.button>
        <motion.button className="absolute right-0 top-0 h-full w-1/3 z-10 flex items-center justify-end pr-4 opacity-0 hover:opacity-100 transition-opacity"
          whileTap={{ backgroundColor: "rgba(255,255,255,0.1)" }}
          aria-label="Next" onClick={() => (index < statuses.length - 1 ? setIndex((i) => i + 1) : onClose())}>
          <ChevronRight className="h-8 w-8 text-white/70 drop-shadow-md" />
        </motion.button>

        {/* Media */}
        <div className="relative w-full h-full flex items-center justify-center"
          onPointerDown={() => { pausedRef.current = true; }} onPointerUp={() => { pausedRef.current = false; }} onPointerLeave={() => { pausedRef.current = false; }}>
          
          {current.kind === "text" ? (
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} key={current.id}
              className="w-full max-w-sm aspect-[9/16] max-h-[70vh] mx-4 rounded-3xl flex items-center justify-center p-8 shadow-2xl border border-white/10"
              style={{ backgroundColor: current.background_color || THEME.accent }}>
              <p className="text-white text-center text-3xl font-bold leading-relaxed drop-shadow-sm">{current.body}</p>
            </motion.div>
          ) : current.kind === "image" ? (
            <>
              {imageLoading && <div className="absolute inset-0 flex items-center justify-center z-0"><Spin size="large" indicator={<LoadingOutlined style={{ fontSize: 32, color: THEME.accent }} spin />} /></div>}
              <motion.img initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
                src={currentMediaUrl ?? ""} alt="" className="max-h-[75vh] max-w-full object-contain z-[1] drop-shadow-2xl"
                onLoad={() => setImageLoading(false)} onError={() => setImageLoading(false)} />
            </>
          ) : (
            <motion.video initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
              src={currentMediaUrl ?? ""} autoPlay playsInline controls className="max-h-[75vh] max-w-full object-contain z-[1] drop-shadow-2xl"
              onLoadedData={() => setImageLoading(false)} onError={() => setImageLoading(false)} />
          )}

          {/* Caption */}
          {current.body && current.kind !== "text" && (
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              className="absolute bottom-8 left-4 right-4 text-center text-sm font-medium rounded-2xl px-4 py-3 backdrop-blur-xl border border-white/10 shadow-xl"
              style={{ backgroundColor: "rgba(0,0,0,0.6)", color: THEME.text }}>
              {current.body}
            </motion.div>
          )}
        </div>
      </div>

      {/* Views footer */}
      {isSelf && (
        <div className="relative border-t border-white/5" style={{ backgroundColor: THEME.surface }}>
          <motion.button whileTap={{ scale: 0.98 }} onClick={() => setShowViewers((v) => !v)}
            className="flex items-center gap-2.5 px-5 py-4 text-sm w-full hover:bg-white/5 transition-colors" style={{ color: THEME.textMuted }}>
            <Eye className="h-4 w-4" />
            <span className="font-bold">{viewers.length} {viewers.length === 1 ? "view" : "views"}</span>
            <ChevronRight className={`h-4 w-4 ml-auto transition-transform ${showViewers ? "rotate-90" : ""}`} />
          </motion.button>
          
          <AnimatePresence>
            {showViewers && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="max-h-52 overflow-y-auto px-5 pb-6 space-y-3 scrollbar-thin">
                  {viewers.length === 0 ? (
                    <p className="text-xs text-center py-4" style={{ color: THEME.textMuted }}>No one has seen this yet.</p>
                  ) : viewers.map((v) => (
                    <motion.div key={v.id} initial={{ x: -10, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors">
                      <Avatar url={v.avatar_url} name={v.display_name} size={32} ai={v.is_ai} />
                      <span className="text-sm font-semibold flex-1" style={{ color: THEME.text }}>{v.display_name}</span>
                      <span className="text-xs font-medium" style={{ color: THEME.textMuted }}>
                        {new Date(v.viewed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
