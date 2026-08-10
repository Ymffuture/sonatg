import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CloseOutlined,
  FileTextOutlined,
  LinkOutlined,
  PictureOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import { Skeleton, Empty, Tooltip } from "antd";
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

  const tabs = [
    { key: "media" as Tab, label: "Media", count: media.length, icon: PictureOutlined },
    { key: "docs" as Tab, label: "Docs", count: docs.length, icon: FileTextOutlined },
    { key: "links" as Tab, label: "Links", count: links.length, icon: LinkOutlined },
  ];

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="flex h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-white/20 dark:border-white/10 bg-white/95 dark:bg-[#1a1a1a]/95 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E07A5F]/10">
          <h3 className="text-base font-semibold text-[#2D3436] dark:text-[#E8E8E8]">Media, links, and docs</h3>
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

        {/* Tabs */}
        <div className="flex border-b border-[#E07A5F]/10 px-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-3 text-xs font-medium border-b-2 transition ${
                tab === t.key
                  ? "border-[#E07A5F] text-[#E07A5F]"
                  : "border-transparent text-[#8C8C8C] hover:text-[#2D3436] dark:hover:text-[#E8E8E8]"
              }`}
            >
              <t.icon className="text-sm" />
              <span>{t.label}</span>
              <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                tab === t.key ? "bg-[#E07A5F]/15 text-[#E07A5F]" : "bg-[#F5F0E8] dark:bg-[#2A2A2A] text-[#8C8C8C]"
              }`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab + (loading ? "-loading" : "-loaded")}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.15 }}
            className="flex-1 overflow-y-auto p-4 scrollbar-thin"
          >
            {loading ? (
              <TabSkeleton tab={tab} />
            ) : tab === "media" ? (
              <MediaTab media={media} onOpenViewer={onOpenViewer} />
            ) : tab === "docs" ? (
              <DocsTab docs={docs} onOpenViewer={onOpenViewer} />
            ) : (
              <LinksTab links={links} />
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

/* ─── Skeleton loaders per tab ─── */
function TabSkeleton({ tab }: { tab: Tab }) {
  if (tab === "media") {
    return (
      <div className="grid grid-cols-3 gap-1.5">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-lg overflow-hidden">
            <Skeleton.Image active className="!w-full !h-full" />
          </div>
        ))}
      </div>
    );
  }
  if (tab === "docs") {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-[#E07A5F]/10 dark:border-white/5">
            <Skeleton.Avatar active size="large" shape="square" />
            <div className="flex-1">
              <Skeleton active paragraph={{ rows: 1 }} title={{ width: "80%" }} />
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton active paragraph={{ rows: 1 }} key={i} className="p-3 rounded-xl" />
      ))}
    </div>
  );
}

/* ─── Media tab ─── */
function MediaTab({
  media,
  onOpenViewer,
}: {
  media: MessageRow[];
  onOpenViewer: (kind: "image" | "video" | "pdf", url: string, name?: string | null) => void;
}) {
  if (media.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <span className="text-sm text-[#8C8C8C]">No photos or videos shared yet.</span>
        }
        className="py-12"
      />
    );
  }
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {media.map((m) => (
        <motion.button
          key={m.id}
          whileHover={{ scale: 0.97 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onOpenViewer(m.kind === "video" ? "video" : "image", m.media_url!, `sona-${m.kind}-${m.id}`)}
          className="relative aspect-square overflow-hidden rounded-lg bg-black/5 group"
        >
          {m.kind === "video" ? (
            <video src={m.media_url!} muted className="h-full w-full object-cover" />
          ) : (
            <img src={m.media_url!} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:brightness-110" />
          )}
          {m.kind === "video" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-8 w-8 rounded-full bg-black/40 flex items-center justify-center backdrop-blur-sm">
                <div className="w-0 h-0 border-t-[5px] border-t-transparent border-l-[8px] border-l-white border-b-[5px] border-b-transparent ml-0.5" />
              </div>
            </div>
          )}
        </motion.button>
      ))}
    </div>
  );
}

/* ─── Docs tab ─── */
function DocsTab({
  docs,
  onOpenViewer,
}: {
  docs: MessageRow[];
  onOpenViewer: (kind: "image" | "video" | "pdf", url: string, name?: string | null) => void;
}) {
  if (docs.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <span className="text-sm text-[#8C8C8C]">No files shared yet.</span>
        }
        className="py-12"
      />
    );
  }
  return (
    <div className="space-y-2">
      {docs.map((m) => (
        <motion.button
          key={m.id}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => {
            if ((m.file_name || "").toLowerCase().endsWith(".pdf")) onOpenViewer("pdf", m.media_url!, m.file_name);
            else downloadFile(m.media_url!, m.file_name || "file");
          }}
          className="flex w-full items-center gap-3 rounded-xl border border-[#E07A5F]/10 bg-white/60 dark:bg-white/5 p-3 text-left hover:bg-[#F4A261]/10 transition"
        >
          <div className="h-10 w-10 rounded-lg bg-[#E07A5F]/10 flex items-center justify-center shrink-0">
            <FileTextOutlined className="text-lg text-[#E07A5F]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-[#2D3436] dark:text-[#E8E8E8]">{m.file_name || "File"}</p>
            <p className="text-xs text-[#8C8C8C]">{m.file_size ? formatBytes(m.file_size) : ""}</p>
          </div>
          <Tooltip title="Download">
            <DownloadOutlined className="text-sm shrink-0 text-[#8C8C8C]" />
          </Tooltip>
        </motion.button>
      ))}
    </div>
  );
}

/* ─── Links tab ─── */
function LinksTab({
  links,
}: {
  links: { url: string; msg: MessageRow }[];
}) {
  if (links.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <span className="text-sm text-[#8C8C8C]">No links shared yet.</span>
        }
        className="py-12"
      />
    );
  }
  return (
    <div className="space-y-2">
      {links.map(({ url }, i) => (
        <motion.a
          key={i}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className="flex items-center gap-2 rounded-xl border border-[#E07A5F]/10 bg-white/60 dark:bg-white/5 p-3 text-sm text-[#E07A5F] hover:underline break-all transition"
        >
          <LinkOutlined className="text-sm shrink-0" />
          <span className="line-clamp-2">{url}</span>
        </motion.a>
      ))}
    </div>
  );
}
