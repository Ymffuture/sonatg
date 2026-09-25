import { useEffect, useState } from "react";
import {
  Shield, PhoneMissed, Video, Briefcase, Gamepad2, GraduationCap, Heart,
  Music, Plane, Newspaper, HelpCircle, Users, X, Send, Loader2,
} from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { FaSquareThreads } from "react-icons/fa6";
import { FaLock } from "react-icons/fa6";
import { MdInsertPhoto } from "react-icons/md";
import { IoMdMic } from "react-icons/io";
import { FaFileLines } from "react-icons/fa6";

import { fmtTime, type MessageRow, type Profile } from "@/lib/db";
import { Avatar } from "./Avatar";
import { parseCallBody, fmtDuration } from "./sonaChatShared";

/* Shows an "Admin console" entry only for accounts with the admin role. */
export function AdminLink({ onNavigate }: { onNavigate: () => void }) {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data } = await supabase
        .from("user_roles").select("role")
        .eq("user_id", auth.user.id).eq("role", "admin").maybeSingle();
      if (alive) setIsAdmin(!!data);
    })();
    return () => { alive = false; };
  }, []);
  if (!isAdmin) return null;
  return (
    <Link
      to="/admin"
      onClick={onNavigate}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#2D3436] dark:text-[#E8E8E8] hover:bg-[#F4A261]/10 transition-colors"
    >
      <Shield className="h-4 w-4 shrink-0" />
      Admin console
    </Link>
  );
}

export function MessagePreview({ msg, decrypted }: { msg?: MessageRow | null; decrypted?: Record<string, string> }) {
  if (!msg) return null; // ← add this guard

  if (msg.is_encrypted) {
    return (
      <span className="inline-flex items-center gap-1 opacity-70">
        <FaLock className="h-4 w-4 shrink-0 text-red-500 " /> Locked
      </span>
    );
  }
  if (msg.body) return <span className="truncate">{msg.body}</span>;

  switch (msg.kind) {
    case "image":
      return (
        <span className="inline-flex items-center gap-1">
          <MdInsertPhoto className="h-4 w-4 shrink-0" /> Photo
        </span>
      );
    case "voice":
      return (
        <span className="inline-flex items-center gap-1">
          <IoMdMic className="h-4 w-4 shrink-0 text-blue-500" /> Voice message ({fmtDuration(msg.duration_ms)})
        </span>
      );
    case "video":
      return (
        <span className="inline-flex items-center gap-1">
          <Video className="h-4 w-4 shrink-0" /> Video
        </span>
      );
    case "file":
      return (
        <span className="inline-flex items-center gap-1">
          <FaFileLines className="h-4 w-4 shrink-0" /> {msg.file_name || "File"}
        </span>
      );
    case "call": {
      const call = parseCallBody(msg.file_name ?? null);
      return (
        <span className="inline-flex items-center gap-1">
          {call.kind === "video" ? <Video className="h-4 w-4 shrink-0" /> : <PhoneMissed className="h-4 text-red-600 w-4 shrink-0" />}
          {call.outcome === "missed" || call.outcome === "declined"
            ? `${call.outcome === "missed" ? "Missed" : "Declined"} ${call.kind === "video" ? "video call" : "call"}`
            : `${call.kind === "video" ? "Video call" : "Voice call"} · ${fmtDuration(call.durationMs)}`}
        </span>
      );
    }
    default:
      return <span>…</span>;
  }
}

/* ─── Category Icons (no emojis) ─── */
export function CategoryIcon({ category, className = "h-3.5 w-3.5" }: { category?: string; className?: string }) {
  switch (category) {
    case "business": return <Briefcase className={className} />;
    case "gaming": return <Gamepad2 className={className} />;
    case "education": return <GraduationCap className={className} />;
    case "lifestyle": return <Heart className={className} />;
    case "entertainment": return <Music className={className} />;
    case "travel": return <Plane className={className} />;
    case "news": return <Newspaper className={className} />;
    case "support": return <HelpCircle className={className} />;
    default: return <Users className={className} />;
  }
}

export function ThreadPanel({
  root, replies, me, profiles, decrypted, onClose, onSendReply,
}: {
  root: MessageRow | null;
  replies: MessageRow[];
  me: Profile;
  profiles: Record<string, Profile>;
  decrypted: Record<string, string>;
  onClose: () => void;
  onSendReply: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const bodyOf = (m: MessageRow) => (m.is_encrypted ? decrypted[m.id] ?? "Locked message" : m.body ?? "");
  const nameOf = (senderId: string) => (senderId === me.id ? "You" : profiles[senderId]?.display_name ?? "…");

  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    try {
      await onSendReply(t);
      setText("");
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="absolute inset-0 z-40 flex justify-end bg-black/20 w-full"
      onClick={onClose}
    >
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 38 }}
        className="flex h-full w-full max-w-sm flex-col border-l border-[#E07A5F]/10 bg-[#FFFDF9] dark:bg-[#242424] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#E07A5F]/10 px-4 py-3">
          <h3 className="text-sm flex gap-2 font-semibold text-[#2D3436] dark:text-[#E8E8E8]"><FaSquareThreads className="text-[purple]" /> Threads</h3>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-[#F4A261]/20" aria-label="Close thread">
            <X className="h-4 w-4 text-[#2D3436] dark:text-[#E8E8E8]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 scrollbar-thin">
          {root && (
            <div className="mb-3 rounded-xl border border-[#E07A5F]/15 bg-[#F5F0E8] dark:bg-[#2A2A2A] p-3">
              <div className="flex items-center gap-2">
                <Avatar url={profiles[root.sender_id]?.avatar_url} name={nameOf(root.sender_id)} size={24} />
                <span className="text-xs font-semibold text-[#2D3436] dark:text-[#E8E8E8]">{nameOf(root.sender_id)}</span>
                <span className="text-[10px] text-[#8C8C8C]">{fmtTime(root.created_at)}</span>
              </div>
              <p className="mt-1.5 text-sm text-[#2D3436] dark:text-[#E8E8E8]">
                {bodyOf(root) || (root.kind === "image" ? "Photo" : root.kind === "voice" ? "Voice message" : root.kind === "file" ? root.file_name || "File" : "…")}
              </p>
            </div>
          )}

          <div className="mb-2 text-xs font-medium text-[#8C8C8C]">
            {replies.length} {replies.length === 1 ? "reply" : "replies"}
          </div>

          <div className="space-y-3">
            {replies.map((r) => (
              <div key={r.id} className="flex items-start gap-3 m-2">
                <Avatar url={profiles[r.sender_id]?.avatar_url} name={nameOf(r.sender_id)} size={28} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs font-semibold text-[#2D3436] dark:text-[#E8E8E8]">{nameOf(r.sender_id)}</span>
                    <span className="text-[10px] text-[#8C8C8C]">{fmtTime(r.created_at)}</span>
                  </div>
                  <p className="text-sm text-[#2D3436] dark:text-[#E8E8E8]">
                    {bodyOf(r) || (r.kind === "image" ? "Photo" : r.kind === "voice" ? "Voice message" : r.kind === "file" ? r.file_name || "File" : "…")}
                  </p>
                </div>
              </div>
            ))}
            {replies.length === 0 && (
              <p className="text-sm text-[#8C8C8C]">No replies yet — start the thread below.</p>
            )}
          </div>
        </div>

        <div className="border-t border-[#E07A5F]/10 p-3">
          <div className="flex items-center gap-2 rounded-full bg-[#F5F0E8] dark:bg-[#2A2A2A] px-3 py-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
              placeholder="Reply in thread…"
              className="flex-1 bg-transparent text-sm outline-none text-[#2D3436] dark:text-[#E8E8E8] placeholder:text-[#8C8C8C]"
            />
            <button
              onClick={send}
              disabled={!text.trim() || sending}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#E07A5F] text-white disabled:opacity-40 transition"
              aria-label="Send reply"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
