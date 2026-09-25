import { useEffect, useState } from "react";
import {
  Shield, PhoneMissed, Video, Briefcase, Gamepad2, GraduationCap, Heart,
  Music, Plane, Newspaper, HelpCircle, Users, X, Send, Loader2, MessageSquareText
} from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { FaLock } from "react-icons/fa6";
import { MdInsertPhoto } from "react-icons/md";
import { IoMdMic } from "react-icons/io";
import { FaFileLines } from "react-icons/fa6";
import { Spinner } from '@heroui/react';
import { fmtTime, type MessageRow, type Profile } from "@/lib/db";
import { Avatar } from "./Avatar";
import { parseCallBody, fmtDuration } from "./sonaChatShared";

/* ─── Admin Link ─── */
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
      className="group flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-zinc-600 transition-all duration-200 hover:bg-[#E07A5F]/10 hover:text-[#E07A5F] dark:text-zinc-300 dark:hover:bg-[#E07A5F]/15"
    >
      <Shield className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
      Admin console
    </Link>
  );
}

/* ─── Message Preview ─── */
export function MessagePreview({ msg, decrypted }: { msg?: MessageRow | null; decrypted?: Record<string, string> }) {
  if (!msg) return null;

  if (msg.is_encrypted) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600 dark:bg-red-500/20 dark:text-red-400">
        <FaLock className="h-3 w-3 shrink-0" /> Locked
      </span>
    );
  }
  if (msg.body) return <span className="truncate text-zinc-600 dark:text-zinc-300">{msg.body}</span>;

  switch (msg.kind) {
    case "image":
      return (
        <span className="inline-flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
          <MdInsertPhoto className="h-4 w-4 shrink-0" /> Photo
        </span>
      );
    case "voice":
      return (
        <span className="inline-flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
          <IoMdMic className="h-4 w-4 shrink-0 text-[#E07A5F]" /> Voice message ({fmtDuration(msg.duration_ms)})
        </span>
      );
    case "video":
      return (
        <span className="inline-flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
          <Video className="h-4 w-4 shrink-0" /> Video
        </span>
      );
    case "file":
      return (
        <span className="inline-flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
          <FaFileLines className="h-4 w-4 shrink-0" /> {msg.file_name || "File"}
        </span>
      );
    case "call": {
      const call = parseCallBody(msg.file_name ?? null);
      const isMissed = call.outcome === "missed" || call.outcome === "declined";
      return (
        <span className={`inline-flex items-center gap-1.5 ${isMissed ? "text-red-500" : "text-zinc-500 dark:text-zinc-400"}`}>
          {call.kind === "video" ? <Video className="h-4 w-4 shrink-0" /> : <PhoneMissed className="h-4 w-4 shrink-0" />}
          {isMissed
            ? `${call.outcome === "missed" ? "Missed" : "Declined"} ${call.kind === "video" ? "video call" : "call"}`
            : `${call.kind === "video" ? "Video call" : "Voice call"} · ${fmtDuration(call.durationMs)}`}
        </span>
      );
    }
    default:
      return <span className="text-zinc-400">…</span>;
  }
}

/* ─── Category Icons ─── */
export function CategoryIcon({ category, className = "h-4 w-4" }: { category?: string; className?: string }) {
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

/* ─── Thread Panel ─── */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 350, damping: 25 } },
};

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
  const nameOf = (senderId: string) => (senderId === me.id ? "You" : profiles[senderId]?.display_name ?? "Unknown");

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
      transition={{ duration: 0.2 }}
      className="absolute inset-0 z-40 flex justify-end bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 35 }}
        className="flex h-full w-full max-w-md flex-col border-l border-white/20 bg-[#FFFDF9]/95 shadow-[-20px_0_60px_-15px_rgba(0,0,0,0.1)] backdrop-blur-xl dark:border-zinc-800/50 dark:bg-zinc-900/95 dark:shadow-[-20px_0_60px_-15px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200/60 bg-white/50 px-5 py-4 dark:border-zinc-800/60 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#E07A5F]/10 text-[#E07A5F]">
              <MessageSquareText className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Thread</h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{replies.length} {replies.length === 1 ? "reply" : "replies"}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="grid h-8 w-8 place-items-center rounded-full text-zinc-500 transition-all hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200" 
            aria-label="Close thread"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-700">
          {root && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative mb-6 overflow-hidden rounded-2xl border border-zinc-200/60 bg-zinc-50/80 p-4 dark:border-zinc-700/50 dark:bg-zinc-800/40"
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#E07A5F]" />
              <div className="flex items-center gap-2.5">
                <Avatar url={profiles[root.sender_id]?.avatar_url} name={nameOf(root.sender_id)} size={28} />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{nameOf(root.sender_id)}</span>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400">{fmtTime(root.created_at)}</span>
                </div>
              </div>
              <p className="mt-2.5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                {bodyOf(root) || (root.kind === "image" ? "Photo" : root.kind === "voice" ? "Voice message" : root.kind === "file" ? root.file_name || "File" : "…")}
              </p>
            </motion.div>
          )}

          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-4"
          >
            {replies.map((r) => (
              <motion.div 
                key={r.id} 
                variants={itemVariants}
                className="group flex items-start gap-3 rounded-xl p-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              >
                <Avatar url={profiles[r.sender_id]?.avatar_url} name={nameOf(r.sender_id)} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{nameOf(r.sender_id)}</span>
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{fmtTime(r.created_at)}</span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                    {bodyOf(r) || (r.kind === "image" ? "Photo" : r.kind === "voice" ? "Voice message" : r.kind === "file" ? r.file_name || "File" : "…")}
                  </p>
                </div>
              </motion.div>
            ))}
            {replies.length === 0 && (
              <motion.div variants={itemVariants} className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <MessageSquareText className="h-5 w-5 text-zinc-400" />
                </div>
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">No replies yet</p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500">Start the conversation below.</p>
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* Input Area */}
        <div className="border-t border-zinc-200/60 bg-white/50 p-4 dark:border-zinc-800/60 dark:bg-zinc-900/50 backdrop-blur-md">
          <div className="relative flex items-end gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2 shadow-sm transition-all focus-within:border-[#E07A5F]/50 focus-within:ring-4 focus-within:ring-[#E07A5F]/10 dark:border-zinc-700 dark:bg-zinc-800 dark:focus-within:border-[#E07A5F]/50 dark:focus-within:ring-[#E07A5F]/10">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Reply in thread…"
              className="flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
            <button
              onClick={send}
              disabled={!text.trim() || sending}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#E07A5F] text-white shadow-md shadow-[#E07A5F]/20 transition-all hover:bg-[#d4694f] hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:active:scale-100"
              aria-label="Send reply"
            >
              {sending ? <Spinner className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
