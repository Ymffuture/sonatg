import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Forward } from "lucide-react";
import {
  CloseOutlined,
  SearchOutlined,
  CheckOutlined,
  RobotOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import {
  Avatar,
  Button,
  Input,
  Empty,
  Spin,
  Tooltip,
  message as toast,
} from "antd";
import { supabase } from "@/integrations/supabase/client";
import type { MessageRow } from "@/lib/db";
import { type ChatWithMeta, chatTitle, chatAvatarUrl, isAIChat } from "@/utils/utils";
import { useBackToClose } from "@/hooks/useBackStack";

export function ForwardModal({
  message, chats, meId, onClose, onForwarded,
}: {
  message: MessageRow;
  chats: ChatWithMeta[];
  meId: string;
  onClose: () => void;
  onForwarded: () => void;
}) {
  useBackToClose(onClose);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  const filtered = useMemo(
    () => chats.filter((c) => chatTitle(c, meId).toLowerCase().includes(query.toLowerCase())),
    [chats, query, meId]
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const forward = async () => {
    if (selected.size === 0) return;
    setSending(true);
    try {
      const inserts = Array.from(selected).map((chatId) => ({
        chat_id: chatId,
        sender_id: meId,
        kind: message.kind,
        body: message.is_encrypted ? null : message.body,
        media_url: message.media_url,
        file_name: message.file_name,
        file_size: message.file_size,
        duration_ms: message.duration_ms,
        is_forwarded: true,
      }));
      const { error } = await supabase.from("messages").insert(inserts);
      if (error) throw error;
      toast.success(`Forwarded to ${selected.size} chat${selected.size === 1 ? "" : "s"}`);
      setSelected(new Set());
      onForwarded();
      onClose();
    } catch (e) {
      toast.error((e as Error).message || "Couldn't forward message");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex flex-col justify-end bg-black/60 backdrop-blur-md" onClick={onClose}>
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="relative flex max-h-[85vh] w-full flex-col rounded-t-3xl md:rounded-3xl border-t md:border border-white/20 dark:border-white/10 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-2xl shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.1)_inset] md:shadow-2xl md:mx-auto md:mb-8 md:max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle ambient background glow */}
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-rose-500/5 dark:bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />
        
        {/* Top highlight edge */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-white/20 pointer-events-none" />

        {/* Sending overlay */}
        <AnimatePresence>
          {sending && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/60 dark:bg-zinc-950/60 backdrop-blur-sm"
            >
              <div className="flex flex-col items-center gap-3">
                <Spin indicator={<LoadingOutlined style={{ fontSize: 32, color: "#E07A5F" }} spin />} />
                <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Forwarding...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <div className="relative flex items-center justify-between px-5 py-4 border-b border-zinc-200/50 dark:border-zinc-800/50">
          <h3 className="flex items-center gap-2.5 text-base font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-500/10 text-[#E07A5F]">
              <Forward className="h-4 w-4" />
            </div>
            Forward to…
          </h3>
          <Tooltip title="Close" placement="bottom">
            <button
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              aria-label="Close"
            >
              <CloseOutlined className="text-sm text-zinc-500 dark:text-zinc-400" />
            </button>
          </Tooltip>
        </div>

        {/* Search */}
        <div className="px-5 py-4">
          <Input
            prefix={<SearchOutlined className="text-zinc-400" />}
            placeholder="Search chats..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            allowClear
            className="!rounded-full !bg-zinc-50 dark:!bg-zinc-900 !border-zinc-200 dark:!border-zinc-800 hover:!border-rose-500/50 focus:!border-rose-500 focus:!ring-2 focus:!ring-rose-500/20 !transition-all !h-11 !text-zinc-900 dark:!text-zinc-100 placeholder:!text-zinc-400"
          />
        </div>

        {/* Selected count chip */}
        <AnimatePresence>
          {selected.size > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: "auto", marginBottom: 12 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="px-5 overflow-hidden"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-50 dark:bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-white text-[10px] font-bold shadow-sm">
                  {selected.size}
                </span>
                {selected.size === 1 ? "chat selected" : "chats selected"}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 scrollbar-thin">
          {filtered.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <span className="text-sm text-zinc-400">No chats found.</span>
              }
              className="py-12"
            />
          ) : (
            <motion.div
              layout
              className="grid grid-cols-3 sm:grid-cols-4 gap-3"
            >
              <AnimatePresence>
                {filtered.map((c) => {
                  const title = chatTitle(c, meId);
                  const isSel = selected.has(c.id);
                  const avatarUrl = chatAvatarUrl(c, meId);

                  return (
                    <motion.button
                      key={c.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      whileHover={{ scale: 1.03, y: -2 }}
                      whileTap={{ scale: 0.97 }}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                      onClick={() => toggle(c.id)}
                      className={`group relative flex flex-col items-center gap-2.5 p-3 rounded-2xl border transition-all duration-300 outline-none ${
                        isSel
                          ? "bg-rose-50 dark:bg-rose-500/10 border-rose-500/50 ring-1 ring-rose-500/20"
                          : "bg-white dark:bg-zinc-900 border-zinc-200/50 dark:border-zinc-800/50 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-md hover:shadow-zinc-200/50 dark:hover:shadow-black/20"
                      }`}
                    >
                      <div className="relative">
                        <Avatar
                          src={avatarUrl || undefined}
                          size={56}
                          className="shadow-sm transition-all duration-300 group-hover:scale-105"
                          style={{
                            border: isSel ? "2px solid #E07A5F" : "2px solid transparent",
                            backgroundColor: !avatarUrl ? "#E07A5F" : undefined,
                          }}
                        >
                          <span className="text-base font-bold text-white">
                            {title.charAt(0).toUpperCase()}
                          </span>
                        </Avatar>

                        {/* Selection checkmark */}
                        <AnimatePresence>
                          {isSel && (
                            <motion.div
                              initial={{ scale: 0, rotate: -45 }}
                              animate={{ scale: 1, rotate: 0 }}
                              exit={{ scale: 0, rotate: 45 }}
                              transition={{ type: "spring", stiffness: 500, damping: 20 }}
                              className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#E07A5F] text-white shadow-md border-2 border-white dark:border-zinc-950 z-10"
                            >
                              <CheckOutlined className="text-[10px]" />
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* AI indicator */}
                        {isAIChat(c) && (
                          <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 dark:bg-zinc-100 border-2 border-white dark:border-zinc-950 shadow-sm z-10">
                            <RobotOutlined className="text-[10px] text-[#E07A5F]" />
                          </div>
                        )}
                      </div>

                      <span className="w-full text-center text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 line-clamp-2 leading-tight">
                        {title}
                      </span>
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          )}
        </div>

        {/* Action bar */}
        <div className="relative border-t border-zinc-200/50 dark:border-zinc-800/50 p-4 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl">
          <Button
            type="primary"
            block
            size="large"
            loading={sending}
            disabled={selected.size === 0}
            onClick={forward}
            icon={<Forward className="h-4 w-4" />}
            style={{
              background: selected.size > 0 ? "linear-gradient(135deg, #E07A5F 0%, #d4694f 100%)" : undefined,
              borderColor: "transparent",
              borderRadius: 999,
              height: 48,
              fontWeight: 600,
              boxShadow: selected.size > 0 ? "0 4px 14px 0 rgba(224, 122, 95, 0.39)" : "none",
            }}
            className="!text-white hover:!opacity-95 !transition-all active:scale-[0.98] disabled:!bg-zinc-100 dark:disabled:!bg-zinc-900 disabled:!text-zinc-400 disabled:!shadow-none disabled:!cursor-not-allowed"
          >
            {selected.size > 0
              ? `Forward to ${selected.size} chat${selected.size === 1 ? "" : "s"}`
              : "Select a chat"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
