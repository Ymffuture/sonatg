import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Loader2, MessageSquareQuote, Sparkles, CornerDownRight } from "lucide-react";
import { FaSquareThreads } from "react-icons/fa6";
import { fmtTime, type MessageRow, type Profile } from "@/lib/db";
import { Avatar } from "@/components/Avatar";

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
  const scrollRef = useRef<HTMLDivElement>(null);

  const bodyOf = (m: MessageRow) => (m.is_encrypted ? decrypted[m.id] ?? "🔒 Locked message" : m.body ?? "");
  const nameOf = (senderId: string) => (senderId === me.id ? "You" : profiles[senderId]?.display_name ?? "…");
  const isMe = (senderId: string) => senderId === me.id;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [replies.length]);

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

  const renderBody = (m: MessageRow) => {
    const body = bodyOf(m);
    if (body) return body;
    if (m.kind === "image") return "📷 Photo";
    if (m.kind === "voice") return "🎙 Voice message";
    if (m.kind === "file") return `📎 ${m.file_name || "File"}`;
    return "…";
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="absolute inset-0 z-40 flex justify-end w-full"
      onClick={onClose}
    >
      {/* Premium backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-gradient-to-l from-black/40 via-black/20 to-transparent backdrop-blur-sm"
      />

      <motion.div
        initial={{ x: "100%", opacity: 0.8 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: "100%", opacity: 0.8 }}
        transition={{ type: "spring", stiffness: 340, damping: 34 }}
        className="relative flex h-full w-full max-w-md flex-col bg-gradient-to-b from-white via-[#FFFDF9] to-[#FBF6EE] dark:from-[#1a1a1a] dark:via-[#242424] dark:to-[#1a1a1a] shadow-2xl border-l border-[var(--sona-accent,#E07A5F)]/10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative gradient accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#E07A5F] via-[#F4A261] to-[#E07A5F] opacity-80" />

        {/* ─── Premium Header ─── */}
        <div className="relative px-5 pt-5 pb-4 border-b border-[var(--sona-accent,#E07A5F)]/10 bg-white/60 dark:bg-zinc-900/40 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 text-white shadow-lg shadow-purple-500/30">
                <FaSquareThreads className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#2D3436] dark:text-[#E8E8E8] flex items-center gap-1.5">
                  Thread
                  <Sparkles className="h-3 w-3 text-[#E07A5F]" />
                </h3>
                <p className="text-[10px] text-[#8C8C8C] font-medium">
                  {replies.length} {replies.length === 1 ? "reply" : "replies"}
                </p>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.05, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              aria-label="Close thread"
            >
              <X className="h-4 w-4 text-[#2D3436] dark:text-[#E8E8E8]" />
            </motion.button>
          </div>
        </div>

        {/* ─── Messages Area ─── */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-5 scrollbar-thin"
        >
          {/* Root message - Original */}
          {root && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mb-5"
            >
              <div className="flex items-center gap-1.5 mb-2 px-1">
                <MessageSquareQuote className="h-3 w-3 text-[#E07A5F]" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#E07A5F]">
                  Original message
                </span>
              </div>
              <div className="relative rounded-2xl rounded-tl-sm border border-[var(--sona-accent,#E07A5F)]/20 bg-gradient-to-br from-[#F5F0E8] to-[#FBF6EE] dark:from-[#2A2A2A] dark:to-[#252525] p-4 shadow-md">
                <div className="flex items-center gap-2.5 mb-2">
                  <Avatar
                    url={profiles[root.sender_id]?.avatar_url}
                    name={nameOf(root.sender_id)}
                    size={28}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs font-bold text-[#2D3436] dark:text-[#E8E8E8]">
                        {nameOf(root.sender_id)}
                      </span>
                      <span className="text-[10px] text-[#8C8C8C] font-medium">
                        {fmtTime(root.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-[#2D3436] dark:text-[#E8E8E8] leading-relaxed">
                  {renderBody(root)}
                </p>
              </div>
            </motion.div>
          )}

          {/* Replies section */}
          {replies.length > 0 && (
            <div className="mb-3 flex items-center gap-2 px-1">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-300 dark:via-zinc-700 to-transparent" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C8C8C]">
                Replies
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-300 dark:via-zinc-700 to-transparent" />
            </div>
          )}

          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {replies.map((r, i) => {
                const mine = isMe(r.sender_id);
                return (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{
                      delay: i * 0.04,
                      type: "spring",
                      stiffness: 300,
                      damping: 25,
                    }}
                    className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}
                  >
                    <Avatar
                      url={profiles[r.sender_id]?.avatar_url}
                      name={nameOf(r.sender_id)}
                      size={30}
                    />
                    <div className={`max-w-[75%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                      {!mine && (
                        <span className="text-[10px] font-semibold text-[#8C8C8C] mb-1 px-1">
                          {nameOf(r.sender_id)}
                        </span>
                      )}
                      <div
                        className={`relative rounded-2xl px-3.5 py-2.5 shadow-sm ${
                          mine
                            ? "rounded-br-sm bg-gradient-to-br from-[#E07A5F] to-[#d4694f] text-white"
                            : "rounded-bl-sm bg-white dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 text-[#2D3436] dark:text-[#E8E8E8]"
                        }`}
                      >
                        <p className="text-sm leading-relaxed break-words">
                          {renderBody(r)}
                        </p>
                        <div className={`flex items-center gap-1 mt-1 ${mine ? "justify-end" : "justify-start"}`}>
                          <span className={`text-[9px] font-medium ${
                            mine ? "text-white/70" : "text-[#8C8C8C]"
                          }`}>
                            {fmtTime(r.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {replies.length === 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="flex flex-col items-center justify-center py-12 text-center"
              >
                <div className="relative mb-4">
                  <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-[#E07A5F]/20 to-[#F4A261]/10 dark:from-[#E07A5F]/30 dark:to-[#F4A261]/20">
                    <CornerDownRight className="h-7 w-7 text-[#E07A5F]" />
                  </div>
                  <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-[#E07A5F]"
                  />
                </div>
                <p className="text-sm font-semibold text-[#2D3436] dark:text-[#E8E8E8] mb-1">
                  No replies yet
                </p>
                <p className="text-xs text-[#8C8C8C] max-w-[200px]">
                  Be the first to join this conversation
                </p>
              </motion.div>
            )}
          </div>
        </div>

        {/* ─── Premium Composer ─── */}
        <div className="border-t border-[var(--sona-accent,#E07A5F)]/10 bg-white/80 dark:bg-zinc-900/60 backdrop-blur-xl p-4">
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Reply in thread…"
                className="w-full bg-zinc-100 dark:bg-zinc-800 text-sm outline-none text-[#2D3436] dark:text-[#E8E8E8] placeholder:text-[#8C8C8C] rounded-2xl px-4 py-3 pr-12 border border-transparent focus:border-[#E07A5F]/40 focus:bg-white dark:focus:bg-zinc-900 transition-all shadow-sm"
                maxLength={1000}
              />
              {text.length > 0 && (
                <span className={`absolute right-3 bottom-3 text-[10px] font-medium ${
                  text.length > 900 ? "text-red-500" : "text-[#8C8C8C]"
                }`}>
                  {text.length}/1000
                </span>
              )}
            </div>
            <motion.button
              whileHover={{ scale: text.trim() ? 1.05 : 1 }}
              whileTap={{ scale: 0.9 }}
              onClick={send}
              disabled={!text.trim() || sending}
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-full shadow-lg transition-all ${
                text.trim()
                  ? "bg-gradient-to-br from-[#E07A5F] to-[#d4694f] text-white shadow-[#E07A5F]/40 hover:shadow-xl hover:shadow-[#E07A5F]/50"
                  : "bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 shadow-none"
              }`}
              aria-label="Send reply"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
