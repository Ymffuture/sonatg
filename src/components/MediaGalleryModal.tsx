import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CloseOutlined,
  FileTextOutlined,
  LinkOutlined,
  PictureOutlined,
  DownloadOutlined,
  PlayCircleFilled,
  GlobalOutlined,
  InboxOutlined,
} from "@ant-design/icons";
import { Skeleton, Empty, Tooltip } from "antd";
import { supabase } from "@/integrations/supabase/client";
import type { MessageRow } from "@/lib/db";
import { URL_REGEX, formatBytes, downloadFile } from "@/utils/utils";
import { useBackToClose } from "@/hooks/useBackStack";

type Tab = "media" | "docs" | "links";

/* ─── Premium noise texture (inline SVG) ─── */
const NOISE_BG =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.06 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

export function MediaGalleryModal({
  chatId,
  onClose,
  onOpenViewer,
}: {
  chatId: string;
  onClose: () => void;
  onOpenViewer: (
    kind: "image" | "video" | "pdf",
    url: string,
    name?: string | null
  ) => void;
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

  const media = messages.filter(
    (m) => (m.kind === "image" || m.kind === "video") && m.media_url
  );
  const docs = messages.filter((m) => m.kind === "file" && m.media_url);
  const links = messages
    .filter((m) => m.kind === "text" && m.body && URL_REGEX.test(m.body))
    .flatMap((m) =>
      (m.body!.match(new RegExp(URL_REGEX.source, "g")) ?? []).map((url) => ({
        url,
        msg: m,
      }))
    );

  const tabs: { key: Tab; label: string; count: number; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "media", label: "Media", count: media.length, icon: PictureOutlined },
    { key: "docs", label: "Docs", count: docs.length, icon: FileTextOutlined },
    { key: "links", label: "Links", count: links.length, icon: LinkOutlined },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[110] flex flex-col bg-black/40 backdrop-blur-xl"
    >
      {/* Ambient glow blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-[#E07A5F]/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-[#F4A261]/15 blur-3xl" />
      </div>

      {/* Modal container with gradient border */}
      <div className="relative m-3 flex flex-1 flex-col overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-b from-white/95 to-white/85 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.35)] backdrop-blur-2xl dark:from-[#1a1a1d]/90 dark:to-[#141416]/85 dark:border-white/[0.08] sm:m-6 md:m-10 lg:mx-auto lg:mt-16 lg:max-w-3xl lg:w-full lg:rounded-[32px]">
        {/* Noise overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35] mix-blend-overlay dark:opacity-[0.25]"
          style={{ backgroundImage: NOISE_BG }}
        />

        {/* Header */}
        <div className="relative flex items-center justify-between px-5 pt-5 pb-4 sm:px-7 sm:pt-6">
          <div className="flex items-center gap-3">
            <div className="relative grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-[#E07A5F] to-[#F4A261] shadow-lg shadow-[#E07A5F]/30">
              <PictureOutlined className="text-base text-white" />
              <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/30" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight text-[#1a1a1a] dark:text-[#f5f5f5]">
                Shared content
              </h3>
              <p className="text-[11px] font-medium tracking-wide text-[#8C8C8C] uppercase">
                Media, docs & links
              </p>
            </div>
          </div>

          <Tooltip title="Close" placement="bottom">
            <motion.button
              whileHover={{ scale: 1.05, rotate: 90 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-full bg-black/5 text-[#2D3436] ring-1 ring-black/5 transition hover:bg-black/10 dark:bg-white/5 dark:text-[#E8E8E8] dark:ring-white/10 dark:hover:bg-white/10"
              aria-label="Close"
            >
              <CloseOutlined className="text-sm" />
            </motion.button>
          </Tooltip>
        </div>

        {/* Tabs */}
        <div className="relative mx-5 mb-1 flex rounded-2xl bg-black/[0.04] p-1 dark:bg-white/[0.04] sm:mx-7">
          {tabs.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`relative flex-1 flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold tracking-wide transition ${
                  active
                    ? "text-white"
                    : "text-[#6b6b6b] hover:text-[#2D3436] dark:text-[#a0a0a0] dark:hover:text-white"
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="tab-pill"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#E07A5F] to-[#d9684d] shadow-lg shadow-[#E07A5F]/25"
                  />
                )}
                <span className="relative flex items-center gap-1.5">
                  <t.icon className="text-sm" />
                  <span>{t.label}</span>
                  <span
                    className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                      active
                        ? "bg-white/25 text-white"
                        : "bg-black/5 text-[#8C8C8C] dark:bg-white/10 dark:text-[#a0a0a0]"
                    }`}
                  >
                    {t.count}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="relative mx-5 h-px bg-gradient-to-r from-transparent via-black/10 to-transparent dark:via-white/10 sm:mx-7" />

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab + (loading ? "-loading" : "-loaded")}
            initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex-1 overflow-y-auto px-5 py-5 scrollbar-thin sm:px-7 sm:py-6"
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
      </div>
    </motion.div>
  );
}

/* ─── Skeleton loaders per tab ─── */
function TabSkeleton({ tab }: { tab: Tab }) {
  if (tab === "media") {
    return (
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square overflow-hidden rounded-2xl bg-gradient-to-br from-black/[0.04] to-black/[0.08] dark:from-white/[0.04] dark:to-white/[0.08]"
          >
            <Skeleton.Image
              active
              className="!w-full !h-full [&>.ant-skeleton-image]:!w-full [&>.ant-skeleton-image]:!h-full [&>.ant-skeleton-image]:!rounded-2xl"
            />
          </div>
        ))}
      </div>
    );
  }
  if (tab === "docs") {
    return (
      <div className="space-y-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-2xl border border-black/[0.05] bg-white/60 p-3.5 dark:border-white/[0.06] dark:bg-white/[0.03]"
          >
            <Skeleton.Avatar active size="large" shape="square" />
            <div className="flex-1">
              <Skeleton
                active
                paragraph={{ rows: 1 }}
                title={{ width: "70%" }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-2.5">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton
          active
          paragraph={{ rows: 1 }}
          key={i}
          className="!rounded-2xl p-4"
        />
      ))}
    </div>
  );
}

/* ─── Premium empty state ─── */
function PremiumEmpty({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="relative mb-5 grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-[#E07A5F]/15 to-[#F4A261]/10 ring-1 ring-[#E07A5F]/20">
        <div className="text-3xl text-[#E07A5F]">{icon}</div>
        <div className="absolute -inset-1 rounded-3xl bg-gradient-to-br from-[#E07A5F]/10 to-transparent blur-xl" />
      </div>
      <h4 className="text-sm font-semibold tracking-tight text-[#2D3436] dark:text-[#E8E8E8]">
        {title}
      </h4>
      <p className="mt-1 max-w-[240px] text-xs leading-relaxed text-[#8C8C8C]">
        {subtitle}
      </p>
    </motion.div>
  );
}

/* ─── Media tab ─── */
function MediaTab({
  media,
  onOpenViewer,
}: {
  media: MessageRow[];
  onOpenViewer: (
    kind: "image" | "video" | "pdf",
    url: string,
    name?: string | null
  ) => void;
}) {
  if (media.length === 0) {
    return (
      <PremiumEmpty
        icon={<PictureOutlined />}
        title="No media yet"
        subtitle="Photos and videos shared in this chat will appear here."
      />
    );
  }
  return (
    <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
      {media.map((m, idx) => (
        <motion.button
          key={m.id}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: Math.min(idx * 0.02, 0.3), duration: 0.3 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() =>
            onOpenViewer(
              m.kind === "video" ? "video" : "image",
              m.media_url!,
              `sona-${m.kind}-${m.id}`
            )
          }
          className="group relative aspect-square overflow-hidden rounded-2xl bg-black/5 ring-1 ring-black/5 transition dark:ring-white/5"
        >
          {m.kind === "video" ? (
            <video
              src={m.media_url!}
              muted
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            <img
              src={m.media_url!}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
          )}

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/0 to-black/0 opacity-0 transition duration-300 group-hover:opacity-100" />

          {m.kind === "video" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                initial={{ scale: 0.9 }}
                whileHover={{ scale: 1.1 }}
                className="grid h-10 w-10 place-items-center rounded-full bg-black/50 backdrop-blur-md ring-1 ring-white/20"
              >
                <PlayCircleFilled className="text-lg text-white" />
              </motion.div>
            </div>
          )}

          {/* Corner shine */}
          <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10 opacity-0 transition group-hover:opacity-100" />
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
  onOpenViewer: (
    kind: "image" | "video" | "pdf",
    url: string,
    name?: string | null
  ) => void;
}) {
  if (docs.length === 0) {
    return (
      <PremiumEmpty
        icon={<InboxOutlined />}
        title="No documents yet"
        subtitle="Files shared in this chat will appear here."
      />
    );
  }
  return (
    <div className="space-y-2">
      {docs.map((m, idx) => {
        const isPdf = (m.file_name || "").toLowerCase().endsWith(".pdf");
        return (
          <motion.button
            key={m.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(idx * 0.03, 0.3), duration: 0.3 }}
            whileHover={{ scale: 1.005, y: -1 }}
            whileTap={{ scale: 0.995 }}
            onClick={() => {
              if (isPdf) onOpenViewer("pdf", m.media_url!, m.file_name);
              else downloadFile(m.media_url!, m.file_name || "file");
            }}
            className="group relative flex w-full items-center gap-3.5 overflow-hidden rounded-2xl border border-black/[0.06] bg-white/70 p-3.5 text-left transition hover:border-[#E07A5F]/30 hover:shadow-lg hover:shadow-[#E07A5F]/5 dark:border-white/[0.06] dark:bg-white/[0.03] dark:hover:border-[#E07A5F]/30"
          >
            {/* Hover gradient */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#E07A5F]/0 via-[#E07A5F]/5 to-[#F4A261]/0 opacity-0 transition group-hover:opacity-100" />

            <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#E07A5F]/15 to-[#F4A261]/10 ring-1 ring-[#E07A5F]/20 transition group-hover:from-[#E07A5F]/25 group-hover:to-[#F4A261]/20">
              <FileTextOutlined className="text-lg text-[#E07A5F]" />
            </div>

            <div className="relative min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold tracking-tight text-[#2D3436] dark:text-[#E8E8E8]">
                {m.file_name || "File"}
              </p>
              <div className="mt-1 flex items-center gap-2 text-[11px] font-medium text-[#8C8C8C]">
                {m.file_size && (
                  <span className="rounded-md bg-black/5 px-1.5 py-0.5 dark:bg-white/10">
                    {formatBytes(m.file_size)}
                  </span>
                )}
                {isPdf && (
                  <span className="rounded-md bg-[#E07A5F]/10 px-1.5 py-0.5 text-[#E07A5F]">
                    PDF
                  </span>
                )}
              </div>
            </div>

            <motion.div
              whileHover={{ x: 2 }}
              className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-black/5 text-[#8C8C8C] transition group-hover:bg-[#E07A5F] group-hover:text-white dark:bg-white/5"
            >
              <DownloadOutlined className="text-sm" />
            </motion.div>
          </motion.button>
        );
      })}
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
      <PremiumEmpty
        icon={<GlobalOutlined />}
        title="No links yet"
        subtitle="Links shared in this chat will appear here."
      />
    );
  }

  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  };

  return (
    <div className="space-y-2">
      {links.map(({ url }, i) => (
        <motion.a
          key={i}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.3 }}
          whileHover={{ scale: 1.005, y: -1 }}
          whileTap={{ scale: 0.995 }}
          className="group relative flex items-center gap-3.5 overflow-hidden rounded-2xl border border-black/[0.06] bg-white/70 p-3.5 transition hover:border-[#E07A5F]/30 hover:shadow-lg hover:shadow-[#E07A5F]/5 dark:border-white/[0.06] dark:bg-white/[0.03] dark:hover:border-[#E07A5F]/30"
        >
          {/* Hover gradient */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#E07A5F]/0 via-[#E07A5F]/5 to-[#F4A261]/0 opacity-0 transition group-hover:opacity-100" />

          <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#E07A5F]/15 to-[#F4A261]/10 ring-1 ring-[#E07A5F]/20">
            <LinkOutlined className="text-lg text-[#E07A5F]" />
          </div>

          <div className="relative min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold tracking-tight text-[#2D3436] group-hover:text-[#E07A5F] dark:text-[#E8E8E8]">
              {getDomain(url)}
            </p>
            <p className="mt-0.5 line-clamp-1 text-[11px] text-[#8C8C8C]">
              {url}
            </p>
          </div>

          <div className="relative text-[#8C8C8C] transition group-hover:text-[#E07A5F]">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            >
              <path d="M7 17L17 7M17 7H8M17 7V16" />
            </svg>
          </div>
        </motion.a>
      ))}
    </div>
  );
}
