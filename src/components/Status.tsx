import { useEffect, useMemo, useRef, useState } from "react";
import {
  X, Plus, Type, Image as ImageIcon, Video, Send, Eye, Trash2, Loader2,
} from "lucide-react";
import { toast } from "sonner";
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

type GroupedStatuses = { user: Profile; statuses: StatusRow[]; allSeen: boolean };

// ─── Status bar (horizontal row of avatars, WhatsApp-style) ───────
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

  const load = async () => {
    const { data } = await supabase.from("statuses").select("*").order("created_at", { ascending: false });
    setStatuses((data ?? []) as StatusRow[]);

    const { data: views } = await supabase.from("status_views").select("status_id").eq("viewer_id", meId);
    setMyViews(new Set((views ?? []).map((v: { status_id: string }) => v.status_id)));
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("statuses-bar")
      .on("postgres_changes", { event: "*", schema: "public", table: "statuses" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "status_views" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meId]);

  const grouped: GroupedStatuses[] = useMemo(() => {
    const byUser = new Map<string, StatusRow[]>();
    for (const s of statuses) {
      if (!byUser.has(s.user_id)) byUser.set(s.user_id, []);
      byUser.get(s.user_id)!.push(s);
    }
    return Array.from(byUser.entries())
      .map(([userId, list]) => ({
        user: profilesById[userId] ?? { id: userId, display_name: "Someone", avatar_url: null, email: null, is_ai: false },
        statuses: list,
        allSeen: list.every((s) => myViews.has(s.id)),
      }))
      .filter((g) => g.user.id !== meId)
      .sort((a, b) => (a.allSeen === b.allSeen ? 0 : a.allSeen ? 1 : -1));
  }, [statuses, profilesById, myViews, meId]);

  const myStatuses = statuses.filter((s) => s.user_id === meId);
  const me = profilesById[meId];

  return (
    <div className="flex gap-3 overflow-x-auto px-4 py-3 border-b border-white/10 dark:border-white/5 scrollbar-thin">
      {/* My status */}
      <button onClick={() => (myStatuses.length ? onOpenViewer(meId) : onOpenComposer())} className="flex flex-col items-center gap-1 shrink-0">
        <div className="relative">
          <div className={`rounded-full p-[2px] ${myStatuses.length ? "bg-gradient-to-tr from-[#E07A5F] to-[#F4A261]" : ""}`}>
            <Avatar url={me?.avatar_url} name={me?.display_name ?? "Me"} size={56} />
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onOpenComposer(); }}
            className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full bg-[#E07A5F] text-white ring-2 ring-white dark:ring-[#1a1a1a]"
            aria-label="Add status"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
        <span className="text-[11px] text-[#8C8C8C] max-w-[60px] truncate">My status</span>
      </button>

      {grouped.map((g) => (
        <button key={g.user.id} onClick={() => onOpenViewer(g.user.id)} className="flex flex-col items-center gap-1 shrink-0">
          <div className={`rounded-full p-[2px] ${g.allSeen ? "bg-[#8C8C8C]/30" : "bg-gradient-to-tr from-[#E07A5F] to-[#F4A261]"}`}>
            <Avatar url={g.user.avatar_url} name={g.user.display_name} size={56} ai={g.user.is_ai} />
          </div>
          <span className="text-[11px] text-[#8C8C8C] max-w-[60px] truncate">{g.user.display_name}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Composer ──────────────────────────────────────────────────
export function StatusComposer({ meId, onClose, onPosted }: { meId: string; onClose: () => void; onPosted: () => void }) {
  const [mode, setMode] = useState<"text" | "image" | "video">("text");
  const [text, setText] = useState("");
  const [bgColor, setBgColor] = useState(STATUS_TEXT_BACKGROUNDS[0]);
  const [file, setFile] = useState<File | null>(null);
  const [posting, setPosting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const useCloudinary = isCloudinaryConfigured();
  const maxBytes = useCloudinary ? STATUS_MAX_BYTES_CLOUDINARY : STATUS_MAX_BYTES_SUPABASE;

  const pickFile = async (f: File | null, kind: "image" | "video") => {
    if (!f) return;
    if (f.size > maxBytes) {
      toast.error(`File too large — max ${Math.round(maxBytes / (1024 * 1024))}MB${useCloudinary ? "" : " (connect Cloudinary for up to 30MB)"}`);
      return;
    }
    if (kind === "video") {
      try {
        const durationMs = await readVideoDurationMs(f);
        if (durationMs > STATUS_MAX_DURATION_MS) {
          toast.error("Video clips must be 60 seconds or shorter");
          return;
        }
      } catch {
        toast.error("Couldn't read video — try a different file");
        return;
      }
    }
    setFile(f);
    setMode(kind);
  };

  const post = async () => {
    if (mode === "text" && !text.trim()) return toast.error("Write something first");
    if (mode !== "text" && !file) return toast.error("Choose a file first");
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

      toast.success("Status posted — visible for 24 hours");
      onPosted();
      onClose();
    } catch (e) {
      toast.error(explainSupabaseError(e).title);
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black/90" onClick={onClose}>
      <div className="flex items-center justify-between p-4" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white" aria-label="Close">
          <X className="h-5 w-5" />
        </button>
        <div className="flex gap-2">
          {(["text", "image", "video"] as const).map((m) => (
            <button
              key={m}
              onClick={() => (m === "text" ? setMode("text") : fileRef.current?.click())}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${mode === m ? "bg-[#E07A5F] text-white" : "bg-white/10 text-white/70"}`}
            >
              {m === "text" && <Type className="h-3.5 w-3.5" />}
              {m === "image" && <ImageIcon className="h-3.5 w-3.5" />}
              {m === "video" && <Video className="h-3.5 w-3.5" />}
              {m[0].toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
        <div className="w-9" />
      </div>
      <input
        ref={fileRef} type="file" accept={mode === "video" ? "video/*" : "image/*,video/*"} className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          pickFile(f, f.type.startsWith("video/") ? "video" : "image");
          e.target.value = "";
        }}
      />

      <div className="flex-1 flex items-center justify-center p-6" onClick={(e) => e.stopPropagation()}>
        {mode === "text" ? (
          <div className="w-full max-w-sm">
            <div
              className="w-full aspect-[9/16] max-h-[60vh] rounded-2xl flex items-center justify-center p-6 transition-colors"
              style={{ backgroundColor: bgColor }}
            >
              <textarea
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type a status…"
                maxLength={280}
                className="w-full h-full bg-transparent text-white text-center text-xl font-medium outline-none resize-none placeholder:text-white/60"
              />
            </div>
            <div className="mt-4 flex justify-center gap-2">
              {STATUS_TEXT_BACKGROUNDS.map((c) => (
                <button
                  key={c}
                  onClick={() => setBgColor(c)}
                  className={`h-7 w-7 rounded-full transition ${bgColor === c ? "ring-2 ring-white ring-offset-2 ring-offset-black" : ""}`}
                  style={{ backgroundColor: c }}
                  aria-label={`Background ${c}`}
                />
              ))}
            </div>
          </div>
        ) : preview ? (
          <div className="w-full max-w-sm">
            {mode === "image" ? (
              <img src={preview} alt="" className="w-full max-h-[60vh] rounded-2xl object-contain bg-black" />
            ) : (
              <video src={preview} controls className="w-full max-h-[60vh] rounded-2xl bg-black" />
            )}
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Add a caption…"
              maxLength={200}
              className="mt-3 w-full rounded-xl bg-white/10 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/50"
            />
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()} className="flex flex-col items-center gap-2 text-white/70">
            {mode === "image" ? <ImageIcon className="h-10 w-10" /> : <Video className="h-10 w-10" />}
            <span className="text-sm">Tap to choose a {mode}</span>
          </button>
        )}
      </div>

      <div className="p-4" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={post}
          disabled={posting}
          className="w-full flex items-center justify-center gap-2 rounded-full bg-[#E07A5F] py-3 text-sm font-semibold text-white disabled:opacity-60 transition"
        >
          {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {posting ? "Posting…" : "Post status"}
        </button>
      </div>
    </div>
  );
}

// ─── Full-screen viewer ────────────────────────────────────────
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
    if (error) return toast.error(explainSupabaseError(error).title);
    toast.success("Status deleted");
    if (statuses.length <= 1) onClose();
    else setStatuses((prev) => prev.filter((s) => s.id !== current.id));
  };

  if (!current) return null;
  const user = profilesById[userId] ?? { id: userId, display_name: "Someone", avatar_url: null, email: null, is_ai: false };
  const ago = Math.max(0, Math.round((Date.now() - new Date(current.created_at).getTime()) / 60000));

  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col select-none">
      <div className="flex gap-1 p-2 pt-3">
        {statuses.map((s, i) => (
          <div key={s.id} className="h-1 flex-1 rounded-full bg-white/25 overflow-hidden">
            <div
              className="h-full bg-white transition-none"
              style={{ width: `${i < index ? 100 : i === index ? progress * 100 : 0}%` }}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 px-3 pb-2">
        <Avatar url={user.avatar_url} name={user.display_name} size={36} ai={user.is_ai} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{user.display_name}</p>
          <p className="text-xs text-white/60">{ago === 0 ? "Just now" : `${ago}m ago`}</p>
        </div>
        {isSelf && (
          <button onClick={deleteCurrent} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/10 text-white/80" aria-label="Delete">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
        <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/10 text-white" aria-label="Close">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div
        className="relative flex-1 flex items-center justify-center"
        onPointerDown={() => { pausedRef.current = true; }}
        onPointerUp={() => { pausedRef.current = false; }}
      >
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

        {current.kind === "text" ? (
          <div
            className="w-full max-w-sm aspect-[9/16] max-h-[70vh] mx-4 rounded-2xl flex items-center justify-center p-6"
            style={{ backgroundColor: current.background_color || "#E07A5F" }}
          >
            <p className="text-white text-center text-xl font-medium">{current.body}</p>
          </div>
        ) : current.kind === "image" ? (
          <img src={current.media_url ?? ""} alt="" className="max-h-[75vh] max-w-full object-contain" />
        ) : (
          <video src={current.media_url ?? ""} autoPlay className="max-h-[75vh] max-w-full object-contain" />
        )}

        {current.body && current.kind !== "text" && (
          <div className="absolute bottom-4 left-4 right-4 text-center text-sm text-white bg-black/40 rounded-xl px-3 py-2">
            {current.body}
          </div>
        )}
      </div>

      {isSelf && (
        <button
          onClick={() => setShowViewers((v) => !v)}
          className="flex items-center gap-2 px-4 py-3 text-white/80 text-sm"
        >
          <Eye className="h-4 w-4" /> {viewers.length} {viewers.length === 1 ? "view" : "views"}
        </button>
      )}
      {isSelf && showViewers && (
        <div className="max-h-40 overflow-y-auto px-4 pb-4 space-y-2">
          {viewers.length === 0 ? (
            <p className="text-xs text-white/50">No one has seen this yet.</p>
          ) : viewers.map((v) => (
            <div key={v.id} className="flex items-center gap-2">
              <Avatar url={v.avatar_url} name={v.display_name} size={28} ai={v.is_ai} />
              <span className="text-sm text-white">{v.display_name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
