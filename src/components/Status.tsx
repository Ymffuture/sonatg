import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  X, Plus, Type, Image as ImageIcon, Video, Send, Eye, Trash2, Loader2,
} from "lucide-react";
import { Skeleton, Badge, notification } from "antd";
import { supabase } from "@/integrations/supabase/client";
import {
  type Profile, type StatusRow,
  STATUS_MAX_DURATION_MS, STATUS_MAX_BYTES_SUPABASE, STATUS_MAX_BYTES_CLOUDINARY,
  STATUS_TEXT_BACKGROUNDS,
} from "@/lib/db";
import { isCloudinaryConfigured, uploadToCloudinary, readVideoDurationMs } from "@/utils/cloudinary";
import { explainSupabaseError } from "@/utils/utils";
import { Avatar } from "./Avatar";

const TEXT_STATUS_MS = 5000;

type GroupedStatuses = { user: Profile; statuses: StatusRow[]; unseenCount: number; allSeen: boolean };

/* ─── WhatsApp color tokens ───────────────────────────────────── */
const WA = {
  green: "#E07A5F",
  greenDark: "#128C7E",
  darkBg: "transparent",
  darkSurface: "transparent",
  darkElevated: "#1F2C34",
  gray: "#8696A0",
  grayLight: "#AEBAC1",
  text: "#E9EDEF",
  textMuted: "#8696A0",
  ringSeen: "#8696A0",
  ringUnseenFrom: "#25D366",
  ringUnseenTo: "#E07A5F",
};

/* ─── Status bar (horizontal row of avatars, WhatsApp-style) ─── */
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

  return (
    <div
      className="flex gap-4 overflow-x-auto px-4 py-3 scrollbar-thin"
      style={{ backgroundColor: WA.darkSurface, borderBottom: `1px solid ${WA.darkElevated}` }}
    >
      {/* My status */}
      <button
        onClick={() => (myStatuses.length ? onOpenViewer(meId) : onOpenComposer())}
        className="flex flex-col items-center gap-1.5 shrink-0 select-none"
      >
        <div className="relative">
          {loading ? (
            <Skeleton.Avatar active size={64} shape="circle" />
          ) : (
            <>
              <div
                className="rounded-full p-[3px]"
                style={{
                  background: myStatuses.length
                    ? `conic-gradient(${WA.green} 0deg, ${WA.greenDark} 360deg)`
                    : "transparent",
                }}
              >
                <Avatar url={me?.avatar_url} name={me?.display_name ?? "Me"} size={58} />
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onOpenComposer(); }}
                className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full text-white"
                style={{ backgroundColor: WA.green, border: `2px solid ${WA.darkSurface}` }}
                aria-label="Add status"
              >
                <Plus className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
        <span className="text-[11px] font-medium max-w-[64px] truncate" style={{ color: WA.grayLight }}>
          My status
        </span>
      </button>

      {/* Divider */}
      <div className="w-px shrink-0 self-stretch my-2 opacity-20" style={{ backgroundColor: WA.gray }} />

      {/* Others */}
      {loading
        ? Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5 shrink-0">
              <Skeleton.Avatar active size={64} shape="circle" />
              <Skeleton.Button active size="small" style={{ width: 56, height: 14 }} />
            </div>
          ))
        : grouped.map((g) => (
            <button
              key={g.user.id}
              onClick={() => onOpenViewer(g.user.id)}
              className="flex flex-col items-center gap-1.5 shrink-0 select-none"
            >
              <Badge
                count={g.unseenCount}
                overflowCount={9}
                style={{ backgroundColor: WA.green, color: "#000", fontWeight: 700, fontSize: 10 }}
                offset={[-4, 4]}
              >
                <div
                  className="rounded-full p-[3px]"
                  style={{
                    background: g.allSeen
                      ? WA.ringSeen
                      : `linear-gradient(135deg, ${WA.ringUnseenFrom}, ${WA.ringUnseenTo})`,
                  }}
                >
                  <Avatar url={g.user.avatar_url} name={g.user.display_name} size={58} ai={g.user.is_ai} />
                </div>
              </Badge>
              <span className="text-[11px] font-medium max-w-[64px] truncate" style={{ color: WA.grayLight }}>
                {g.user.display_name}
              </span>
            </button>
          ))}
    </div>
  );
}

/* ─── Composer ────────────────────────────────────────────────── */
export function StatusComposer({
  meId, onClose, onPosted,
}: {
  meId: string; onClose: () => void; onPosted: () => void;
}) {
  const [mode, setMode] = useState<"text" | "image" | "video">("text");
  const [text, setText] = useState("");
  const [bgColor, setBgColor] = useState(STATUS_TEXT_BACKGROUNDS[0]);
  const [file, setFile] = useState<File | null>(null);
  const [posting, setPosting] = useState(false);
  const [mediaLoading, setMediaLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const useCloudinary = isCloudinaryConfigured();
  const maxBytes = useCloudinary ? STATUS_MAX_BYTES_CLOUDINARY : STATUS_MAX_BYTES_SUPABASE;

  const pickFile = async (f: File | null, kind: "image" | "video") => {
    if (!f) return;
    if (f.size > maxBytes) {
      notification.error({
        message: "File too large",
        description: `Max ${Math.round(maxBytes / (1024 * 1024))}MB${useCloudinary ? "" : " (connect Cloudinary for up to 30MB)"}`,
        placement: "top",
      });
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
        notification.error({ message: "Invalid video", description: "Couldn't read video — try a different file", placement: "top" });
        return;
      }
    }
    setFile(f);
    setMode(kind);
  };

  const post = async () => {
    if (mode === "text" && !text.trim()) {
      notification.warning({ message: "Empty status", description: "Write something first", placement: "top" });
      return;
    }
    if (mode !== "text" && !file) {
      notification.warning({ message: "No file", description: "Choose a file first", placement: "top" });
      return;
    }
    setPosting(true);

    try {
      let media_url: string | null = null;
      let media_path: string | null = null;
      let media_provider: "supabase" | "cloudinary" = "supabase";
      let media_public_id: string | null = null;
      let duration_ms: number | null = null;

      if (file) {
        if (mode === "video") duration_ms = Math.round(await readVideoDurationMs(file));

        if (useCloudinary) {
          const result = await uploadToCloudinary(file, mode === "video" ? "video" : "image");
          media_url = result.secure_url;
          media_public_id = result.public_id;
          media_provider = "cloudinary";
          if (result.duration) duration_ms = Math.round(result.duration * 1000);
        } else {
          const path = `${meId}/${crypto.randomUUID()}-${file.name}`;
          const { error: upErr } = await supabase.storage.from("statuses").upload(path, file);
          if (upErr) throw upErr;
          const { data: signed } = await supabase.storage.from("statuses").createSignedUrl(path, 60 * 60 * 25);
          media_url = signed?.signedUrl ?? null;
          media_path = path;
        }
      }

      const { error } = await supabase.from("statuses").insert({
        user_id: meId,
        kind: mode,
        body: mode === "text" ? text.trim() : (text.trim() || null),
        media_url, media_path, media_provider, media_public_id, duration_ms,
        background_color: mode === "text" ? bgColor : null,
      });
      if (error) throw error;

      notification.success({
        message: "Status posted",
        description: "Visible for 24 hours",
        placement: "top",
      });
      onPosted();
      onClose();
    } catch (e) {
      const explained = explainSupabaseError(e);
      notification.error({ message: explained.title, description: explained.description, placement: "top" });
    } finally {
      setPosting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col"
      style={{ backgroundColor: WA.darkBg }}
      onClick={onClose}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="grid h-10 w-10 place-items-center rounded-full transition"
          style={{ backgroundColor: WA.darkElevated, color: WA.text }}
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex gap-2">
          {(["text", "image", "video"] as const).map((m) => (
            <button
              key={m}
              onClick={() => (m === "text" ? setMode("text") : fileRef.current?.click())}
              className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition"
              style={
                mode === m
                  ? { backgroundColor: WA.green, color: "#000" }
                  : { backgroundColor: WA.darkElevated, color: WA.grayLight }
              }
            >
              {m === "text" && <Type className="h-3.5 w-3.5" />}
              {m === "image" && <ImageIcon className="h-3.5 w-3.5" />}
              {m === "video" && <Video className="h-3.5 w-3.5" />}
              {m[0].toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>

        <div className="w-10" />
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={mode === "video" ? "video/*" : "image/*,video/*"}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          pickFile(f, f.type.startsWith("video/") ? "video" : "image");
          e.target.value = "";
        }}
      />

      {/* Canvas */}
      <div className="flex-1 flex items-center justify-center p-6" onClick={(e) => e.stopPropagation()}>
        {mode === "text" ? (
          <div className="w-full max-w-sm">
            <div
              className="w-full aspect-[9/16] max-h-[60vh] rounded-2xl flex items-center justify-center p-6 transition-colors shadow-2xl"
              style={{ backgroundColor: bgColor }}
            >
              <textarea
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type a status…"
                maxLength={280}
                className="w-full h-full bg-transparent text-white text-center text-2xl font-semibold outline-none resize-none placeholder:text-white/50"
              />
            </div>
            <div className="mt-5 flex justify-center gap-3">
              {STATUS_TEXT_BACKGROUNDS.map((c) => (
                <button
                  key={c}
                  onClick={() => setBgColor(c)}
                  className="h-8 w-8 rounded-full transition shadow"
                  style={{
                    backgroundColor: c,
                    outline: bgColor === c ? `3px solid ${WA.green}` : "none",
                    outlineOffset: 2,
                  }}
                  aria-label={`Background ${c}`}
                />
              ))}
            </div>
          </div>
        ) : preview ? (
          <div className="w-full max-w-sm">
            {mediaLoading && (
              <div className="w-full aspect-[9/16] max-h-[60vh] rounded-2xl overflow-hidden mb-3">
                <Skeleton.Image active className="!w-full !h-full" />
              </div>
            )}
            {mode === "image" ? (
              <img
                src={preview}
                alt=""
                className="w-full max-h-[60vh] rounded-2xl object-contain"
                style={{ backgroundColor: WA.darkElevated }}
                onLoad={() => setMediaLoading(false)}
              />
            ) : (
              <video
                src={preview}
                controls
                className="w-full max-h-[60vh] rounded-2xl"
                style={{ backgroundColor: WA.darkElevated }}
                onLoadedData={() => setMediaLoading(false)}
              />
            )}
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Add a caption…"
              maxLength={200}
              className="mt-3 w-full rounded-xl px-4 py-3 text-sm outline-none placeholder:text-white/40"
              style={{ backgroundColor: WA.darkElevated, color: WA.text }}
            />
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center gap-3"
            style={{ color: WA.gray }}
          >
            {mode === "image" ? <ImageIcon className="h-12 w-12" /> : <Video className="h-12 w-12" />}
            <span className="text-sm font-medium">Tap to choose a {mode}</span>
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="p-4" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={post}
          disabled={posting}
          className="w-full flex items-center justify-center gap-2 rounded-full py-3.5 text-sm font-bold transition disabled:opacity-60"
          style={{ backgroundColor: WA.green, color: "#000" }}
        >
          {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {posting ? "Posting…" : "Post status"}
        </button>
      </div>
    </div>
  );
}

/* ─── Full-screen viewer ──────────────────────────────────────── */
export function StatusViewer({
  userId, meId, profilesById, onClose,
}: {
  userId: string; meId: string; profilesById: Record<string, Profile>; onClose: () => void;
}) {
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
      const { data } = await supabase
        .from("statuses").select("*").eq("user_id", userId).order("created_at", { ascending: true });
      setStatuses((data ?? []) as StatusRow[]);
    })();
  }, [userId]);

  const current = statuses[index];

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, index, statuses.length]);

  const deleteCurrent = async () => {
    if (!current || !confirm("Delete this status?")) return;
    const { error } = await supabase.from("statuses").delete().eq("id", current.id);
    if (error) {
      const explained = explainSupabaseError(error);
      notification.error({ message: explained.title, description: explained.description, placement: "top" });
      return;
    }
    notification.success({ message: "Deleted", description: "Status removed", placement: "top" });
    if (statuses.length <= 1) onClose();
    else setStatuses((prev) => prev.filter((s) => s.id !== current.id));
  };

  if (!current) return null;
  const user = profilesById[userId] ?? { id: userId, display_name: "Someone", avatar_url: null, email: null, is_ai: false };
  const ago = Math.max(0, Math.round((Date.now() - new Date(current.created_at).getTime()) / 60000));

  return (
    <div className="fixed inset-0 z-[70] flex flex-col select-none" style={{ backgroundColor: WA.darkBg }}>
      {/* Progress segments */}
      <div className="flex gap-1.5 p-3 pt-4">
        {statuses.map((s, i) => (
          <div key={s.id} className="h-1 flex-1 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.25)" }}>
            <div
              className="h-full transition-none"
              style={{
                width: `${i < index ? 100 : i === index ? progress * 100 : 0}%`,
                backgroundColor: "#fff",
              }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 px-3 pb-2">
        {user.avatar_url ? (
          <img src={user.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <div className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: WA.darkElevated, color: WA.text }}>
            {user.display_name?.charAt(0).toUpperCase() ?? "?"}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: WA.text }}>{user.display_name}</p>
          <p className="text-xs" style={{ color: WA.gray }}>
            {ago === 0 ? "Just now" : `${ago}m ago`}
          </p>
        </div>
        {isSelf && (
          <button
            onClick={deleteCurrent}
            className="grid h-9 w-9 place-items-center rounded-full transition"
            style={{ color: WA.grayLight }}
            aria-label="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={onClose}
          className="grid h-9 w-9 place-items-center rounded-full transition"
          style={{ color: WA.text }}
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div
        className="relative flex-1 flex items-center justify-center overflow-hidden"
        onPointerDown={() => { pausedRef.current = true; }}
        onPointerUp={() => { pausedRef.current = false; }}
      >
        {/* Tap zones */}
        <button
          className="absolute left-0 top-0 h-full w-1/3 z-10"
          aria-label="Previous"
          onClick={() => (index > 0 ? setIndex((i) => i - 1) : onClose())}
        />
        <button
          className="absolute right-0 top-0 h-full w-1/3 z-10"
          aria-label="Next"
          onClick={() => (index < statuses.length - 1 ? setIndex((i) => i + 1) : onClose())}
        />

        {/* Media */}
        {current.kind === "text" ? (
          <div
            className="w-full max-w-sm aspect-[9/16] max-h-[70vh] mx-4 rounded-2xl flex items-center justify-center p-8 shadow-2xl"
            style={{ backgroundColor: current.background_color || WA.green }}
          >
            <p className="text-white text-center text-2xl font-semibold leading-relaxed">{current.body}</p>
          </div>
        ) : current.kind === "image" ? (
          <>
            {imageLoading && (
              <div className="absolute inset-0 flex items-center justify-center z-0">
                <Skeleton.Image active className="!w-64 !h-96 rounded-2xl" />
              </div>
            )}
            <img
              src={current.media_url ?? ""}
              alt=""
              className="max-h-[75vh] max-w-full object-contain z-[1]"
              onLoad={() => setImageLoading(false)}
              onError={() => setImageLoading(false)}
            />
          </>
        ) : (
          <video
            src={current.media_url ?? ""}
            autoPlay
            className="max-h-[75vh] max-w-full object-contain"
            onLoadedData={() => setImageLoading(false)}
          />
        )}

        {/* Caption */}
        {current.body && current.kind !== "text" && (
          <div
            className="absolute bottom-6 left-4 right-4 text-center text-sm rounded-xl px-4 py-2.5 backdrop-blur-md"
            style={{ backgroundColor: "rgba(0,0,0,0.45)", color: WA.text }}
          >
            {current.body}
          </div>
        )}
      </div>

      {/* Views footer */}
      {isSelf && (
        <div style={{ backgroundColor: WA.darkSurface }}>
          <button
            onClick={() => setShowViewers((v) => !v)}
            className="flex items-center gap-2 px-4 py-3 text-sm w-full"
            style={{ color: WA.grayLight }}
          >
            <Eye className="h-4 w-4" />
            <span className="font-medium">
              {viewers.length} {viewers.length === 1 ? "view" : "views"}
            </span>
          </button>
          {showViewers && (
            <div className="max-h-44 overflow-y-auto px-4 pb-4 space-y-3">
              {viewers.length === 0 ? (
                <p className="text-xs" style={{ color: WA.gray }}>No one has seen this yet.</p>
              ) : viewers.map((v) => (
                <div key={v.id} className="flex items-center gap-3">
                  {v.avatar_url ? (
                    <img src={v.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <div className="h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: WA.darkElevated, color: WA.text }}>
                      {v.display_name?.charAt(0).toUpperCase() ?? "?"}
                    </div>
                  )}
                  <span className="text-sm font-medium" style={{ color: WA.text }}>{v.display_name}</span>
                  <span className="text-xs ml-auto" style={{ color: WA.gray }}>
                    {new Date(v.viewed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
