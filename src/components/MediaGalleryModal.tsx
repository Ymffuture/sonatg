import { useEffect, useState } from "react";
import { X, FileText, Link2, Image as ImageIcon, Loader2, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { MessageRow } from "@/lib/db";
import { URL_REGEX, formatBytes, downloadFile } from "@/utils/utils";
import { useBackToClose } from "@/hooks/useBackStack";

type Tab = "media" | "docs" | "links";

export function MediaGalleryModal({
  chatId, onClose, onOpenViewer,
}: {
  chatId: string;
  onClose: () => void;
  onOpenViewer: (kind: "image" | "video" | "pdf", url: string, name?: string | null) => void;
}) {
  useBackToClose(onClose);
  const [tab, setTab] = useState<Tab>("media");
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<MessageRow[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("visible_messages")
        .select("*")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: false });
      setMessages((data ?? []) as MessageRow[]);
      setLoading(false);
    })();
  }, [chatId]);

  const media = messages.filter((m) => (m.kind === "image" || m.kind === "video") && m.media_url);
  const docs = messages.filter((m) => m.kind === "file" && m.media_url);
  const links = messages
    .filter((m) => m.kind === "text" && m.body && URL_REGEX.test(m.body))
    .flatMap((m) => (m.body!.match(new RegExp(URL_REGEX.source, "g")) ?? []).map((url) => ({ url, msg: m })));

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="flex h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-white/20 dark:border-white/10 bg-white/95 dark:bg-[#1a1a1a]/95 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E07A5F]/10">
          <h3 className="text-base font-semibold text-[#2D3436] dark:text-[#E8E8E8]">Media, links, and docs</h3>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-[#F4A261]/20" aria-label="Close">
            <X className="h-4 w-4 text-[#2D3436] dark:text-[#E8E8E8]" />
          </button>
        </div>

        <div className="flex border-b border-[#E07A5F]/10 px-2">
          {([
            { key: "media", label: `Media (${media.length})`, icon: ImageIcon },
            { key: "docs", label: `Docs (${docs.length})`, icon: FileText },
            { key: "links", label: `Links (${links.length})`, icon: Link2 },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-3 text-xs font-medium border-b-2 transition ${
                tab === t.key ? "border-[#E07A5F] text-[#E07A5F]" : "border-transparent text-[#8C8C8C] hover:text-[#2D3436] dark:hover:text-[#E8E8E8]"
              }`}
            >
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
          {loading ? (
            <div className="grid h-full place-items-center">
              <Loader2 className="h-5 w-5 animate-spin text-[#E07A5F]" />
            </div>
          ) : tab === "media" ? (
            media.length === 0 ? (
              <p className="py-10 text-center text-sm text-[#8C8C8C]">No photos or videos shared yet.</p>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {media.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => onOpenViewer(m.kind === "video" ? "video" : "image", m.media_url!, `sona-${m.kind}-${m.id}`)}
                    className="relative aspect-square overflow-hidden rounded-lg bg-black/5"
                  >
                    {m.kind === "video" ? (
                      <video src={m.media_url!} muted className="h-full w-full object-cover" />
                    ) : (
                      <img src={m.media_url!} alt="" loading="lazy" className="h-full w-full object-cover" />
                    )}
                  </button>
                ))}
              </div>
            )
          ) : tab === "docs" ? (
            docs.length === 0 ? (
              <p className="py-10 text-center text-sm text-[#8C8C8C]">No files shared yet.</p>
            ) : (
              <div className="space-y-2">
                {docs.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      if ((m.file_name || "").toLowerCase().endsWith(".pdf")) onOpenViewer("pdf", m.media_url!, m.file_name);
                      else downloadFile(m.media_url!, m.file_name || "file");
                    }}
                    className="flex w-full items-center gap-3 rounded-xl border border-[#E07A5F]/10 bg-white/60 dark:bg-white/5 p-3 text-left hover:bg-[#F4A261]/10 transition"
                  >
                    <FileText className="h-6 w-6 shrink-0 text-[#E07A5F]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-[#2D3436] dark:text-[#E8E8E8]">{m.file_name || "File"}</p>
                      <p className="text-xs text-[#8C8C8C]">{m.file_size ? formatBytes(m.file_size) : ""}</p>
                    </div>
                    <Download className="h-4 w-4 shrink-0 text-[#8C8C8C]" />
                  </button>
                ))}
              </div>
            )
          ) : links.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#8C8C8C]">No links shared yet.</p>
          ) : (
            <div className="space-y-2">
              {links.map(({ url }, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-xl border border-[#E07A5F]/10 bg-white/60 dark:bg-white/5 p-3 text-sm text-[#E07A5F] hover:underline break-all"
                >
                  <Link2 className="h-4 w-4 shrink-0" /> {url}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
