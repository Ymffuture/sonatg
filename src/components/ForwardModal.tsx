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
  Badge,
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
    <div className="fixed inset-0 z-[110] flex flex-col justify-end bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
        className="relative flex max-h-[85vh] w-full flex-col rounded-t-3xl border-t border-white/20 dark:border-white/10 bg-white/90 dark:bg-[#1a1a1a]/90 backdrop-blur-xl shadow-2xl md:mx-auto md:mb-8 md:max-w-md md:rounded-3xl md:border overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sending overlay */}
        <AnimatePresence>
          {sending && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
            >
              <Spin indicator={<LoadingOutlined style={{ fontSize: 28, color: "#E07A5F" }} spin />} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E07A5F]/10">
          <h3 className="flex items-center gap-2 text-base font-semibold text-[#2D3436] dark:text-[#E8E8E8]">
            <Forward className="h-4 w-4 text-[#E07A5F]" /> Forward to…
          </h3>
          <Tooltip title="Close" placement="bottom">
            <button
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-full hover:bg-[#F4A261]/20 transition"
              aria-label="Close"
            >
              <CloseOutlined className="text-sm text-[#2D3436] dark:text-[#E8E8E8]" />
            </button>
          </Tooltip>
        </div>

        {/* Search */}
        <div className="px-5 py-3">
          <Input
            prefix={<SearchOutlined className="text-[#8C8C8C] mr-1" />}
            placeholder="Search chats"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            allowClear
            className="rounded-full bg-[#F5F0E8] dark:bg-[#2A2A2A] border-[#E07A5F]/10 hover:border-[#E07A5F]/30 focus:border-[#E07A5F] text-[#2D3436] dark:text-[#E8E8E8] placeholder:text-[#8C8C8C]"
          />
        </div>

        {/* Selected count chip */}
        <AnimatePresence>
          {selected.size > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="px-5 overflow-hidden"
            >
              <div className="flex items-center gap-2 mb-2">
                <Badge
                  count={selected.size}
                  style={{ backgroundColor: "#E07A5F", fontWeight: 700 }}
                />
                <span className="text-xs font-medium text-[#8C8C8C]">
                  {selected.size === 1 ? "chat selected" : "chats selected"}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
          {filtered.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <span className="text-sm text-[#8C8C8C]">No chats found.</span>
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
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      whileHover={{ scale: 1.06, y: -2 }}
                      whileTap={{ scale: 0.94 }}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                      onClick={() => toggle(c.id)}
                      className={`flex flex-col items-center gap-2.5 p-3 rounded-2xl transition-colors outline-none ${
                        isSel
                          ? "bg-[#E07A5F]/10 ring-1 ring-[#E07A5F]/40"
                          : "hover:bg-white/60 dark:hover:bg-white/5"
                      }`}
                    >
                      <div className="relative">
                        <Avatar
                          src={avatarUrl || undefined}
                          size={64}
                          className="shadow-md transition-all"
                          style={{
                            border: isSel ? "2.5px solid #E07A5F" : "2.5px solid transparent",
                            backgroundColor: !avatarUrl ? "#E07A5F" : undefined,
                          }}
                        >
                          <span className="text-lg font-bold text-white">
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
                              className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#E07A5F] border-2 border-white dark:border-[#1a1a1a] shadow-sm"
                            >
                              <CheckOutlined className="text-[10px] text-white font-bold" />
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* AI indicator */}
                        {!isSel && isAIChat(c) && (
                          <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#2A2A2A] border border-[#E07A5F]/30 shadow-sm">
                            <RobotOutlined className="text-[10px] text-[#E07A5F]" />
                          </div>
                        )}
                      </div>

                      <span className="w-full text-center text-[11px] font-semibold text-[#2D3436] dark:text-[#E8E8E8] line-clamp-2 leading-tight">
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
        <div className="border-t border-[#E07A5F]/10 p-4 bg-white/50 dark:bg-[#1a1a1a]/50 backdrop-blur-xl">
          <Button
            type="primary"
            block
            size="large"
            loading={sending}
            disabled={selected.size === 0}
            onClick={forward}
            icon={<Forward className="h-4 w-4" />}
            style={{
              backgroundColor: "#E07A5F",
              borderColor: "#E07A5F",
              borderRadius: 12,
              fontWeight: 600,
            }}
            className="hover:opacity-90 transition-opacity"
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
