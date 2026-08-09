import { useState, useMemo } from "react";
import { Search, X, Check, Forward } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { MessageRow, Profile } from "@/lib/db";
import { type ChatWithMeta, chatTitle, chatAvatarUrl, isAIChat } from "@/utils/utils";
import { Avatar } from "./Avatar";
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
      <div
        className="flex max-h-[80vh] w-full flex-col rounded-t-3xl border-t border-white/20 dark:border-white/10 bg-white/90 dark:bg-[#1a1a1a]/90 backdrop-blur-xl shadow-2xl md:mx-auto md:mb-8 md:max-w-md md:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4">
          <h3 className="flex items-center gap-2 text-base font-semibold text-[#2D3436] dark:text-[#E8E8E8]">
            <Forward className="h-4 w-4 text-[#E07A5F]" /> Forward to…
          </h3>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-[#F4A261]/20" aria-label="Close">
            <X className="h-4 w-4 text-[#2D3436] dark:text-[#E8E8E8]" />
          </button>
        </div>

        <div className="px-5 pb-3">
          <div className="flex items-center gap-2 rounded-full bg-[#F5F0E8] dark:bg-[#2A2A2A] px-3 py-2 border border-[#E07A5F]/10">
            <Search className="h-4 w-4 text-[#8C8C8C]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chats"
              className="w-full bg-transparent text-sm outline-none placeholder:text-[#8C8C8C] text-[#2D3436] dark:text-[#E8E8E8]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2 scrollbar-thin">
          {filtered.map((c) => {
            const title = chatTitle(c, meId);
            const isSel = selected.has(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-[#F4A261]/10 transition"
              >
                <Avatar url={chatAvatarUrl(c, meId)} name={title} size={42} ai={isAIChat(c)} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#2D3436] dark:text-[#E8E8E8]">{title}</span>
                <div
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
                    isSel ? "border-[#E07A5F] bg-[#E07A5F]" : "border-[#8C8C8C]/40"
                  }`}
                >
                  {isSel && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && <p className="p-6 text-center text-sm text-[#8C8C8C]">No chats found.</p>}
        </div>

        <div className="border-t border-[#E07A5F]/10 p-4">
          <button
            onClick={forward}
            disabled={selected.size === 0 || sending}
            className="w-full rounded-xl bg-[#E07A5F] py-3 text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition"
          >
            {sending ? "Forwarding…" : selected.size > 0 ? `Forward to ${selected.size}` : "Select a chat"}
          </button>
        </div>
      </div>
    </div>
  );
}
