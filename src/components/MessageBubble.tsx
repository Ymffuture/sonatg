import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Download, Reply, Pencil, SmilePlus, Trash2, Copy, Check,
  Play, Pause, Mic, Smile, Paperclip, Send, Image as ImageIcon,
  File as FileIcon, X, CornerUpLeft, MoreVertical, Lock, Phone, Video, Loader2, Clock,
} from "lucide-react";
import { VscVerifiedFilled } from "react-icons/vsc";
import { Skeleton, Tooltip, notification } from "antd";
import { useServerFn } from "@tanstack/react-start";
import { transcribeVoiceMessage } from "@/lib/transcribe.functions";
import { fetchLinkPreview, type LinkPreview } from "@/lib/linkpreview.functions";
import { SONA_AI_ID, fmtTime, type MessageRow, type Profile, type ReactionRow, type MessageReadRow } from "@/lib/db";
import {
  type ChatWithMeta, type ReadStatus, readStatusFor, waveformBars, formatBytes, downloadFile,
  URL_REGEX, URL_REGEX_TEST, EMOJIS, REACT_EMOJIS, DOC_EXTENSIONS,
} from "@/utils/utils";
import { Avatar, TickIcon } from "./Avatar";

type CallLogMeta = { kind: "voice" | "video"; outcome: "answered" | "missed" | "declined"; durationMs: number };
function parseCallLogMeta(raw: string | null): CallLogMeta {
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && (parsed.kind === "voice" || parsed.kind === "video")) {
      return {
        kind: parsed.kind,
        outcome: parsed.outcome === "missed" || parsed.outcome === "declined" ? parsed.outcome : "answered",
        durationMs: typeof parsed.durationMs === "number" ? parsed.durationMs : 0,
      };
    }
  } catch { /* fall through to default */ }
  return { kind: "voice", outcome: "answered", durationMs: 0 };
}
function fmtCallDuration(ms: number) {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}


/* ─── Themed Notification Helper ─── */
const notify = {
  success: ({ message, description }: { message: string; description?: string }) =>
    notification.success({
      message,
      description,
      placement: "bottom",
      className:
        "!bg-[#E07A5F] dark:!bg-white !rounded-xl !border-white/10 !shadow-xl " +
        "[&_.ant-notification-notice-message]:!text-white dark:[&_.ant-notification-notice-message]:!text-[#2D3436] " +
        "[&_.ant-notification-notice-description]:!text-white/80 dark:[&_.ant-notification-notice-description]:!text-[#2D3436]/80 " +
        "[&_.ant-notification-notice-icon]:!text-[#Effffff]",
    }),
  error: ({ message, description }: { message: string; description?: string }) =>
    notification.error({
      message,
      description,
      placement: "bottom",
      className:
        "!bg-[#E07A5F] dark:!bg-white !rounded-xl !border-white/10 !shadow-xl " +
        "[&_.ant-notification-notice-message]:!text-white dark:[&_.ant-notification-notice-message]:!text-[#2D3436] " +
        "[&_.ant-notification-notice-description]:!text-white/80 dark:[&_.ant-notification-notice-description]:!text-[#2D3436]/80 " +
        "[&_.ant-notification-notice-icon]:!text-red-400 dark:[&_.ant-notification-notice-icon]:!text-red-500",
    }),
  info: ({ message, description }: { message: string; description?: string }) =>
    notification.info({
      message,
      description,
      placement: "bottom",
      className:
        "!bg-[#E07A5F] dark:!bg-white !rounded-xl !border-white/10 !shadow-xl " +
        "[&_.ant-notification-notice-message]:!text-white dark:[&_.ant-notification-notice-message]:!text-[#2D3436] " +
        "[&_.ant-notification-notice-description]:!text-white/80 dark:[&_.ant-notification-notice-description]:!text-[#2D3436]/80 " +
        "[&_.ant-notification-notice-icon]:!text-[#4FA6E0]",
    }),
};

/* ─── Block Types ─── */
type Block =
  | { type: "paragraph"; tokens: InlineToken[] }
  | { type: "codeblock"; content: string; lang?: string }
  | { type: "table"; headers: string[]; rows: string[][] };

type InlineToken =
  | { type: "text"; content: string }
  | { type: "bold"; content: string }
  | { type: "italic"; content: string }
  | { type: "code"; content: string }
  | { type: "strike"; content: string }
  | { type: "link"; content: string; href: string }
  | { type: "br" };

/* ─── Inline Parser ─── */
const INLINE_PATTERNS = [
  { regex: /\*\*([^*]+)\*\*/g, type: "bold" as const },
  { regex: /__([^_]+)__/g, type: "bold" as const },
  { regex: /\*([^*]+)\*/g, type: "italic" as const },
  { regex: /_([^_]+)_/g, type: "italic" as const },
  { regex: /~~([^~]+)~~/g, type: "strike" as const },
  { regex: /`([^`]+)`/g, type: "code" as const },
];

function parseInline(text: string): InlineToken[] {
  if (!text) return [];
  const tokens: InlineToken[] = [];
  let pos = 0;

  type Match = { start: number; end: number; type: InlineToken["type"]; content: string };
  const matches: Match[] = [];

  INLINE_PATTERNS.forEach(({ regex, type }) => {
    let m: RegExpExecArray | null;
    const localRegex = new RegExp(regex.source, regex.flags);
    while ((m = localRegex.exec(text)) !== null) {
      matches.push({ start: m.index, end: m.index + m[0].length, type, content: m[1] });
    }
  });

  let lm: RegExpExecArray | null;
  const linkRegex = new RegExp(URL_REGEX.source, URL_REGEX.flags);
  while ((lm = linkRegex.exec(text)) !== null) {
    matches.push({ start: lm.index, end: lm.index + lm[0].length, type: "link", content: lm[0] });
  }

  matches.sort((a, b) => a.start - b.start);

  const filtered: Match[] = [];
  let lastEnd = -1;
  for (const m of matches) {
    if (m.start >= lastEnd) {
      filtered.push(m);
      lastEnd = m.end;
    }
  }

  for (const m of filtered) {
    if (m.start > pos) tokens.push({ type: "text", content: text.slice(pos, m.start) });
    if (m.type === "link") tokens.push({ type: "link", content: m.content, href: m.content });
    else tokens.push({ type: m.type, content: m.content });
    pos = m.end;
  }
  if (pos < text.length) tokens.push({ type: "text", content: text.slice(pos) });
  return tokens;
}

/* ─── Block Parser (Tables + Code + Paragraphs) ─── */
function parseBlocks(text: string): Block[] {
  if (!text) return [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim().startsWith("```")) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      blocks.push({ type: "codeblock", content: codeLines.join("\n"), lang: lang || undefined });
      continue;
    }

    if (line.includes("|")) {
      const nextLine = lines[i + 1];
      if (nextLine && /^\s*\|?[\s\-:|]+\|?\s*$/.test(nextLine) && nextLine.includes("|")) {
        const rawHeaders = line.split("|").map((s) => s.trim()).filter(Boolean);
        i += 2;

        const rows: string[][] = [];
        while (i < lines.length && lines[i].includes("|")) {
          const cells = lines[i].split("|").map((s) => s.trim()).filter(Boolean);
          if (cells.length > 0) rows.push(cells);
          i++;
        }

        if (rawHeaders.length > 0) {
          blocks.push({ type: "table", headers: rawHeaders, rows });
          continue;
        }
      }
    }

    if (line.trim()) {
      const paraLines: string[] = [line];
      i++;
      while (i < lines.length && lines[i].trim() && !lines[i].includes("|") && !lines[i].trim().startsWith("```")) {
        paraLines.push(lines[i]);
        i++;
      }
      const paraText = paraLines.join("\n");
      const parts = paraText.split("\n");
      const tokens: InlineToken[] = [];
      parts.forEach((part, idx) => {
        if (idx > 0) tokens.push({ type: "br", content: "" });
        tokens.push(...parseInline(part));
      });
      blocks.push({ type: "paragraph", tokens });
      continue;
    }

    i++;
  }

  return blocks;
}

/* ─── Render Inline Tokens ─── */
function renderInline(tokens: InlineToken[], keyPrefix: string) {
  return tokens.map((token, i) => {
    const key = `${keyPrefix}-${i}`;
    switch (token.type) {
      case "bold":
        return <strong key={key} className="font-semibold">{token.content}</strong>;
      case "italic":
        return <em key={key} className="italic">{token.content}</em>;
      case "strike":
        return <s key={key} className="line-through opacity-70">{token.content}</s>;
      case "code":
        return (
          <code key={key} className="rounded bg-black/10 px-1 py-0.5 text-[0.9em] font-mono dark:bg-white/15">
            {token.content}
          </code>
        );
      case "link":
        return (
          <a
            key={key}
            href={token.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="underline underline-offset-2 opacity-90 hover:opacity-100 break-all"
          >
            {token.content}
          </a>
        );
      case "br":
        return <br key={key} />;
      default:
        return <span key={key}>{token.content}</span>;
    }
  });
}

/* ─── Table Renderer ─── */
function TableRenderer({
  headers,
  rows,
  mine,
}: {
  headers: string[];
  rows: string[][];
  mine: boolean;
}) {
  return (
    <div className="my-2 overflow-x-auto rounded-lg border border-[#E07A5F]/20 dark:border-[#E07A5F]/15">
      <table className="w-full text-left text-[13px] border-collapse">
        <thead>
          <tr className={`${mine ? "bg-black/15" : "bg-[#E07A5F]/8 dark:bg-[#E07A5F]/15"}`}>
            {headers.map((h, i) => (
              <th
                key={i}
                className={`px-3 py-2 font-semibold border-b ${
                  mine
                    ? "border-white/20 text-white/95"
                    : "border-[#E07A5F]/20 text-[#2D3436] dark:text-[#E8E8E8]"
                } ${i < headers.length - 1 ? (mine ? "border-r border-white/10" : "border-r border-[#E07A5F]/10") : ""}`}
              >
                {renderInline(parseInline(h), `th-${i}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rIdx) => (
            <tr
              key={rIdx}
              className={`${
                mine
                  ? rIdx % 2 === 0 ? "bg-black/5" : "bg-black/10"
                  : rIdx % 2 === 0 ? "bg-transparent" : "bg-[#F5F0E8]/50 dark:bg-white/5"
              } transition-colors hover:${mine ? "bg-black/15" : "bg-[#E07A5F]/5"}`}
            >
              {row.map((cell, cIdx) => (
                <td
                  key={cIdx}
                  className={`px-3 py-2 border-b ${
                    mine
                      ? "border-white/10 text-white/90"
                      : "border-[#E07A5F]/10 text-[#2D3436] dark:text-[#E8E8E8]"
                  } ${cIdx < row.length - 1 ? (mine ? "border-r border-white/10" : "border-r border-[#E07A5F]/10") : ""}`}
                >
                  {renderInline(parseInline(cell), `td-${rIdx}-${cIdx}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Full Markdown Renderer ─── */
function renderMarkdown(text: string, mine: boolean) {
  const blocks = parseBlocks(text);
  return blocks.map((block, i) => {
    const key = `block-${i}`;
    switch (block.type) {
      case "codeblock":
        return (
          <pre
            key={key}
            className="my-2 overflow-x-auto rounded-lg bg-black/5 dark:bg-white/10 p-3 text-xs font-mono border border-[#E07A5F]/10"
          >
            {block.lang && (
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#E07A5F] opacity-70">
                {block.lang}
              </div>
            )}
            <code className={mine ? "text-white/90" : "text-[#2D3436] dark:text-[#E8E8E8]"}>
              {block.content}
            </code>
          </pre>
        );
      case "table":
        return <TableRenderer key={key} headers={block.headers} rows={block.rows} mine={mine} />;
      case "paragraph":
        return (
          <p key={key} className="whitespace-pre-wrap break-words leading-snug">
            {renderInline(block.tokens, key)}
          </p>
        );
    }
  });
}

/* ─── Long Press Hook ─── */
function useLongPress(callback: () => void, ms = 500) {
  const [longPressTriggered, setLongPressTriggered] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startY = useRef(0);

  const start = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      setLongPressTriggered(false);
      if ("touches" in e) startY.current = e.touches[0].clientY;
      timerRef.current = setTimeout(() => {
        setLongPressTriggered(true);
        callback();
      }, ms);
    },
    [callback, ms]
  );

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const move = useCallback(
    (e: React.TouchEvent) => {
      const y = e.touches[0].clientY;
      if (Math.abs(y - startY.current) > 10) cancel();
    },
    [cancel]
  );

  return {
    onMouseDown: start,
    onMouseUp: cancel,
    onMouseLeave: cancel,
    onTouchStart: start,
    onTouchEnd: cancel,
    onTouchMove: move,
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      callback();
    },
    longPressTriggered,
  };
}

/* ─── WhatsApp-style Context Menu ─── */
function MessageContextMenu({
  open, x, y, mine, isText, onReply, onReact, onEdit, onDelete, onCopy, onClose,
}: {
  open: boolean; x: number; y: number; mine: boolean; isText: boolean;
  onReply: () => void; onReact: (emoji: string) => void;
  onEdit: () => void; onDelete: () => void; onCopy: () => void; onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onClose]);

  if (!open) return null;

  const style: React.CSSProperties = {
    position: "fixed",
    left: Math.min(x, window.innerWidth - 220),
    top: Math.min(y, window.innerHeight - 280),
    zIndex: 100,
  };

  return (
    <div
      ref={menuRef}
      style={style}
      className="w-52 rounded-xl border border-[#E07A5F]/10 bg-[#FFFDF9] dark:bg-[#2A2A2A] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
    >
      <div className="flex items-center justify-around border-b border-[#E07A5F]/10 px-2 py-2">
        {["❤️", "👍", "😂", "😮", "😢", "🙏"].map((emoji) => (
          <button
            key={emoji}
            onClick={() => { onReact(emoji); onClose(); }}
            className="text-lg hover:scale-125 transition-transform duration-150"
          >
            {emoji}
          </button>
        ))}
      </div>

      <div className="py-1">
        <MenuItem icon={<CornerUpLeft className="h-4 w-4" />} label="Reply" onClick={() => { onReply(); onClose(); }} />
        {isText && <MenuItem icon={<Copy className="h-4 w-4" />} label="Copy text" onClick={() => { onCopy(); onClose(); }} />}
        <MenuItem icon={<SmilePlus className="h-4 w-4" />} label="React" onClick={() => { onReact("👍"); onClose(); }} />
        {mine && isText && <MenuItem icon={<Pencil className="h-4 w-4" />} label="Edit" onClick={() => { onEdit(); onClose(); }} />}
        <div className="my-1 border-t border-[#E07A5F]/10" />
        {mine && <MenuItem icon={<Trash2 className="h-4 w-4 text-red-500" />} label="Delete" danger onClick={() => { onDelete(); onClose(); }} />}
      </div>
    </div>
  );
}

function MenuItem({ icon, label, danger, onClick }: { icon: React.ReactNode; label: string; danger?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-[#E07A5F]/5 ${
        danger ? "text-red-500" : "text-[#2D3436] dark:text-[#E8E8E8]"
      }`}
    >
      <span className="opacity-70">{icon}</span>
      {label}
    </button>
  );
}

/* ─── Enhanced Bubble ─── */
const linkPreviewCache = new Map<string, LinkPreview | null>();

function LinkPreviewCard({ text, mine }: { text: string; mine: boolean }) {
  const url = useMemo(() => {
    const re = new RegExp(URL_REGEX.source, URL_REGEX.flags);
    const match = re.exec(text);
    return match?.[0] ?? null;
  }, [text]);

  const [preview, setPreview] = useState<LinkPreview | null>(url ? linkPreviewCache.get(url) ?? null : null);
  const [loading, setLoading] = useState(false);
  const fetchPreview = useServerFn(fetchLinkPreview);

  useEffect(() => {
    if (!url) return;
    if (linkPreviewCache.has(url)) { setPreview(linkPreviewCache.get(url) ?? null); return; }
    let cancelled = false;
    setLoading(true);
    fetchPreview({ data: { url: url.startsWith("http") ? url : `https://${url}` } })
      .then((result) => {
        if (cancelled) return;
        const lp = result as LinkPreview;
        linkPreviewCache.set(url, lp);
        setPreview(lp);
      })
      .catch(() => {
        if (!cancelled) linkPreviewCache.set(url, null);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [url, fetchPreview]);

  if (!url) return null;
  if (loading) {
    return <Skeleton.Input active size="small" className="!w-full !max-w-[280px] !mb-1" />;
  }
  // Nothing worth showing (blocked host, non-HTML resource with no title, fetch failed, etc).
  if (!preview || (!preview.title && !preview.description && !preview.image)) return null;

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`mb-1.5 block max-w-[280px] overflow-hidden rounded-xl border transition hover:opacity-90 ${
        mine ? "border-white/20 bg-white/10" : "border-[#E07A5F]/15 bg-black/[0.02] dark:bg-white/5"
      }`}
    >
      {preview.image && (
        <img src={preview.image} alt="" className="h-32 w-full object-cover" loading="lazy" />
      )}
      <div className="px-3 py-2">
        {preview.siteName && (
          <p className={`text-[10px] uppercase tracking-wide ${mine ? "text-white/60" : "text-[#8C8C8C]"}`}>
            {preview.siteName}
          </p>
        )}
        {preview.title && (
          <p className={`text-[13px] font-semibold leading-snug line-clamp-2 ${mine ? "text-white" : "text-[#2D3436] dark:text-[#E8E8E8]"}`}>
            {preview.title}
          </p>
        )}
        {preview.description && (
          <p className={`mt-0.5 text-xs leading-snug line-clamp-2 ${mine ? "text-white/75" : "text-[#8C8C8C]"}`}>
            {preview.description}
          </p>
        )}
      </div>
    </a>
  );
}

export function Bubble({
  msg, me, sender, reactions, reads, otherMemberIds, onReact, opening, onOpenPicker, grouped, isGroup,
  overrideBody, onDelete, onReply, onEdit, parentName, parentBody, actionsOpen, onToggleActions, onTranscribed,
  replyCount, onOpenThread,
}: {
  msg: MessageRow; me: Profile; sender?: Profile; reactions: ReactionRow[];
  reads: MessageReadRow[]; otherMemberIds: string[];
  onReact: (emoji: string) => void; opening: boolean; onOpenPicker: () => void; grouped: boolean; isGroup: boolean;
  overrideBody?: string; onDelete: () => void;
  onReply: () => void; onEdit: () => void;
  parentName?: string; parentBody?: string;
  actionsOpen: boolean; onToggleActions: () => void;
  onTranscribed?: (messageId: string, transcript: string) => void;
  replyCount?: number;
  onOpenThread?: () => void;
}) {
  const mine = msg.sender_id === me.id;
  const isAI = msg.sender_id === SONA_AI_ID;
  const counts: Record<string, number> = {};
  reactions.forEach((r) => { counts[r.emoji] = (counts[r.emoji] ?? 0) + 1; });
  const status: ReadStatus = readStatusFor(msg, reads, [me.id, ...otherMemberIds], me.id);

  const [contextMenu, setContextMenu] = useState<{ open: boolean; x: number; y: number }>({ open: false, x: 0, y: 0 });
  const [imgLoaded, setImgLoaded] = useState(false);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const bodyText = overrideBody ?? msg.body ?? "";

  const longPress = useLongPress(() => {
    if (bubbleRef.current) {
      const rect = bubbleRef.current.getBoundingClientRect();
      setContextMenu({ open: true, x: rect.left + rect.width / 2, y: rect.top });
    }
  }, 600);

  const handleCopy = () => {
    navigator.clipboard.writeText(bodyText).then(() => notify.success({ message: "Copied to clipboard" }));
  };

  const getReactorNames = (emoji: string) => {
    return reactions
      .filter((r) => r.emoji === emoji)
      .map((r) => {
        if (r.user_id === me.id) return me.display_name || "You";
        if (r.user_id === sender?.id) return sender.display_name || "Unknown";
        return "User";
      });
  };

  const bubbleRadius = mine
    ? grouped ? "rounded-2xl rounded-tr-sm" : "rounded-2xl rounded-tr-sm"
    : grouped ? "rounded-2xl rounded-tl-sm" : "rounded-2xl rounded-tl-sm";

  // Call-ended log entries render as a centered pill, WhatsApp-style,
  // instead of the normal left/right chat bubble.
  if (msg.kind === "call") {
    const call = parseCallLogMeta(msg.file_name ?? null);
    const missed = call.outcome === "missed" || call.outcome === "declined";
    const Icon = call.kind === "video" ? Video : Phone;
    const label = missed
      ? `${call.outcome === "missed" ? "Missed" : "Declined"} ${call.kind === "video" ? "video call" : "voice call"}`
      : `${call.kind === "video" ? "Video call" : "Voice call"} · ${fmtCallDuration(call.durationMs)}`;
    return (
      <div className="my-2 flex justify-center">
        <div
          className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium ${
            missed
              ? "border-red-500/25 bg-red-500/10 text-red-500"
              : "border-[#E07A5F]/20 bg-[#F5F0E8] dark:bg-[#2A2A2A] text-[#2D3436] dark:text-[#E8E8E8]"
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
          <span>{label}</span>
          <span className="opacity-60">· {fmtTime(msg.created_at)}</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`group flex items-end gap-1.5 ${mine ? "justify-end" : "justify-start"} ${grouped ? "mt-0.5" : "mt-1.5"}`}>
        {!mine && isGroup && !grouped && (
          <div className="mb-1">
            <Avatar url={sender?.avatar_url} name={sender?.display_name ?? "?"} size={28} ai={isAI} />
          </div>
        )}
        {!mine && isGroup && grouped && <div className="w-8 shrink-0" />}

        <div className="relative max-w-[82%] sm:max-w-[75%]">
          <div
            className={`absolute top-1/2 -translate-y-1/2 flex items-center gap-0.5 transition-all duration-200 ${
              mine ? "-left-8" : "-right-8"
            } opacity-0 group-hover:opacity-100 ${actionsOpen ? "opacity-100" : ""}`}
          >
            <button
              onClick={(e) => { e.stopPropagation(); onReply(); }}
              className="grid h-7 w-7 place-items-center rounded-full text-[#8C8C8C] hover:bg-[#E07A5F]/10 transition"
              aria-label="Reply"
            >
              <Reply className="h-3.5 w-3.5" />
            </button>
            {!mine && (
              <button
                onClick={(e) => { e.stopPropagation(); onOpenPicker(); }}
                className="grid h-7 w-7 place-items-center rounded-full text-[#8C8C8C] hover:bg-[#E07A5F]/10 transition"
                aria-label="React"
              >
                <SmilePlus className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (bubbleRef.current) {
                  const rect = bubbleRef.current.getBoundingClientRect();
                  setContextMenu({ open: true, x: rect.left + rect.width / 2, y: rect.top });
                }
              }}
              className="grid h-7 w-7 place-items-center rounded-full text-[#8C8C8C] hover:bg-[#E07A5F]/10 transition"
              aria-label="More"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
          </div>

          <div
            ref={bubbleRef}
            {...longPress}
            onClick={onToggleActions}
            className={`relative cursor-pointer select-text px-3 py-1.5 shadow-sm ${bubbleRadius} ${
              mine
                ? "bg-[#E07A5F] text-white"
                : "bg-white dark:bg-[#2A2A2A] text-[#2D3436] dark:text-[#E8E8E8] border border-[#E07A5F]/10"
            }`}
          >
            {!mine && !grouped && (isAI || isGroup) && (
              <div className="mb-0.5 text-[11px] flex items-center gap-1">
                {isAI ? (
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 font-semibold text-emerald-400 text-xs">
                      Sona
                      <VscVerifiedFilled className="h-3 w-3 text-blue-500" />
                    </span>
                    <span className="text-[10px] text-gray-400 hover:text-emerald-400 transition-colors cursor-pointer">
                      Learn more
                    </span>
                  </div>
                ) : (
                  <span className="text-xs font-medium italic text-[#E07A5F]">
                    {sender?.display_name ?? "Unknown"}
                  </span>
                )}
              </div>
            )}

            {parentBody !== undefined && (
              <div
                className={`mb-1.5 rounded-lg border-l-[3px] border-[#E07A5F] px-2 py-1.5 text-[11px] ${
                  mine ? "bg-black/10" : "bg-[#F5F0E8] dark:bg-white/5"
                }`}
              >
                <div className="font-semibold text-[#E07A5F] text-[11px]">{parentName}</div>
                <div className="truncate opacity-80 max-w-[240px] leading-tight">{parentBody}</div>
              </div>
            )}

            {msg.kind === "image" && msg.media_url && (
              <div className="relative mb-1 group/image -mx-1 -mt-1 min-h-[160px]">
                {!imgLoaded && (
                  <div className="absolute inset-0 z-10 rounded-lg overflow-hidden bg-[#F5F0E8] dark:bg-[#2A2A2A] flex items-center justify-center">
                    <Skeleton.Node active className="!w-full !h-full !rounded-lg">
                      <ImageIcon className="h-8 w-8 text-[#8C8C8C]" />
                    </Skeleton.Node>
                  </div>
                )}
                <img
                  src={msg.media_url}
                  alt=""
                  loading="lazy"
                  onLoad={() => setImgLoaded(true)}
                  className={`max-h-72 w-full rounded-lg object-cover transition-opacity duration-300 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadFile(msg.media_url!, `sona-photo-${msg.id}.jpg`);
                  }}
                  aria-label="Download image"
                  className="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-black/50 text-white backdrop-blur-sm opacity-0 group-hover/image:opacity-100 hover:bg-black/70 active:scale-95 transition-all"
                >
                  <Download className="h-4 w-4" />
                </button>
                <div className="absolute bottom-1 right-1 rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-white/90 backdrop-blur-sm">
                  {fmtTime(msg.created_at)}
                </div>
              </div>
            )}

            {msg.kind === "file" && msg.media_url && (
              <button
                onClick={(e) => { e.stopPropagation(); downloadFile(msg.media_url!, msg.file_name || "file"); }}
                className={`mb-1 flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                  mine
                    ? "border-white/20 bg-white/10 hover:bg-white/15"
                    : "border-[#E07A5F]/15 bg-[#F5F0E8] dark:bg-[#3A3A3A] hover:bg-[#EFE6D8] dark:hover:bg-[#454545]"
                }`}
              >
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${
                    mine ? "bg-white/20 text-white" : "bg-[#E07A5F]/10 text-[#E07A5F]"
                  }`}
                >
                  <FileIcon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm font-medium ${mine ? "text-white" : "text-[#2D3436] dark:text-[#E8E8E8]"}`}>
                    {msg.file_name || "File"}
                  </span>
                  <span className={`block text-xs ${mine ? "text-white/70" : "text-[#8C8C8C]"}`}>
                    {msg.file_size ? formatBytes(msg.file_size) : ""}
                  </span>
                </span>
                <Download className={`h-4 w-4 shrink-0 ${mine ? "text-white/80" : "text-[#8C8C8C]"}`} />
              </button>
            )}

            {msg.kind === "voice" && msg.media_url && (
              <VoicePlayer
                url={msg.media_url}
                durationMs={msg.duration_ms ?? 0}
                mine={mine}
                avatarUrl={sender?.avatar_url}
                avatarName={sender?.display_name ?? "?"}
                messageId={msg.id}
                transcript={msg.transcript}
                onTranscribed={onTranscribed}
              />
            )}

            {(overrideBody ?? msg.body) && (
              <div className="text-[14.5px] leading-snug pr-14 pb-1">
                {renderMarkdown(overrideBody ?? msg.body ?? "", mine)}
              </div>
            )}

            {!msg.is_encrypted && (overrideBody ?? msg.body) && (
              <LinkPreviewCard text={overrideBody ?? msg.body ?? ""} mine={mine} />
            )}

            {(replyCount ?? 0) > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); onOpenThread?.(); }}
                className={`mb-1 flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium transition hover:opacity-80 ${
                  mine ? "text-white/90" : "text-[#E07A5F]"
                }`}
              >
                <CornerUpLeft className="h-3.5 w-3.5" />
                {replyCount} {replyCount === 1 ? "reply" : "replies"}
              </button>
            )}

            <div
              className={`flex items-end justify-end gap-1.5 -mt-1 ${
                mine ? "text-white/85" : "text-[#8C8C8C]"
              }`}
            >
              {Object.keys(counts).length > 0 && (
                <div className="flex flex-wrap items-center gap-1 mr-auto mb-0.5">
                  {Object.entries(counts).map(([e, n]) => {
                    const mineReacted = reactions.some((r) => r.emoji === e && r.user_id === me.id);
                    const reactorNames = getReactorNames(e);
                    return (
                      <Tooltip key={e} title={reactorNames.join(", ")} placement="top">
                        <button
                          onClick={(ev) => { ev.stopPropagation(); onReact(e); }}
                          className={`flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[11px] shadow-sm transition active:scale-95 ${
                            mine
                              ? "border-white/20 bg-white/15"
                              : "border-[#E07A5F]/15 bg-[#FFFDF9] dark:bg-[#2A2A2A]"
                          } ${mineReacted ? "ring-1 ring-[#E07A5F]" : ""}`}
                        >
                          <span>{e}</span>
                          <span className="text-[9px] opacity-80 font-medium">{n}</span>
                        </button>
                      </Tooltip>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center gap-1 translate-y-0.5">
                {msg.edited_at && <span className="text-[10px] italic opacity-70">edited</span>}
                <span className="text-[10.5px] tabular-nums">{fmtTime(msg.created_at)}</span>
                {mine && <TickIcon status={status} className="h-3.5 w-3.5" />}
              </div>
            </div>
          </div>
        </div>
      </div>

      <MessageContextMenu
        open={contextMenu.open}
        x={contextMenu.x}
        y={contextMenu.y}
        mine={mine}
        isText={msg.kind === "text"}
        onReply={() => onReply()}
        onReact={(emoji) => onReact(emoji)}
        onEdit={() => onEdit()}
        onDelete={() => onDelete()}
        onCopy={handleCopy}
        onClose={() => setContextMenu({ ...contextMenu, open: false })}
      />
    </>
  );
}

/* ─── Voice Player ─── */
export function VoicePlayer({
  url, durationMs, mine, avatarUrl, avatarName, messageId, transcript, onTranscribed,
}: {
  url: string; durationMs: number; mine: boolean; avatarUrl?: string | null; avatarName?: string;
  messageId?: string; transcript?: string | null; onTranscribed?: (messageId: string, transcript: string) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const transcribeFn = useServerFn(transcribeVoiceMessage);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bars = useMemo(() => {
    const raw = waveformBars(url);
    const dense: number[] = [];
    for (let i = 0; i < raw.length; i++) {
      dense.push(raw[i]);
      if (i < raw.length - 1) dense.push((raw[i] + raw[i + 1]) / 2);
    }
    return dense;
  }, [url]);

  useEffect(() => {
    const a = new Audio(url);
    audioRef.current = a;
    a.addEventListener("timeupdate", () => setProgress(a.duration ? a.currentTime / a.duration : 0));
    a.addEventListener("ended", () => { setPlaying(false); setProgress(0); });
    return () => { a.pause(); audioRef.current = null; };
  }, [url]);

  const toggle = () => {
    const a = audioRef.current; if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play(); setPlaying(true); setHasPlayed(true); }
  };

  const handleTranscribeClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (transcript) { setShowTranscript((v) => !v); return; }
    if (!messageId || transcribing) return;
    setTranscribing(true);
    try {
      const result = (await transcribeFn({ data: { messageId } })) as { transcript: string };
      onTranscribed?.(messageId, result.transcript);
      setShowTranscript(true);
    } catch (err) {
      notify.error({ message: "Couldn't transcribe", description: (err as Error).message });
    } finally {
      setTranscribing(false);
    }
  };

  const secs = Math.round(durationMs / 1000);
  const filledColor = mine ? "bg-white" : "bg-[#E07A5F]";
  const mutedColor = mine ? "bg-white/30" : "bg-[#E07A5F]/25";

  return (
    <div className="min-w-[260px] py-0.5">
      <div className="flex items-center gap-2.5">
        <button
          onClick={toggle}
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition active:scale-95 ${
            mine ? "bg-white/20 text-white hover:bg-white/25" : "bg-[#E07A5F]/10 text-[#E07A5F] hover:bg-[#E07A5F]/15"
          }`}
        >
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
        </button>

        {!hasPlayed && (
          <span className={`h-2 w-2 shrink-0 rounded-full ${mine ? "bg-white" : "bg-[#4FA6E0]"}`} />
        )}

        <button
          onClick={toggle}
          className="flex flex-1 items-center gap-[1px] h-9"
          aria-label={playing ? "Pause" : "Play"}
        >
          {bars.map((h, i) => {
            const barProgress = i / bars.length;
            const isFilled = barProgress <= progress;
            return (
              <span
                key={i}
                className={`w-[2px] rounded-full transition-all duration-150 ${isFilled ? filledColor : mutedColor}`}
                style={{ height: `${Math.max(12, Math.round(h * 100))}%` }}
              />
            );
          })}
        </button>

        <div className="relative shrink-0">
          <Avatar url={avatarUrl} name={avatarName ?? "?"} size={36} />
          <span
            className={`absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full ring-2 ${
              mine ? "bg-white text-[#E07A5F] ring-[#E07A5F]" : "bg-[#E07A5F] text-white ring-white dark:ring-[#2A2A2A]"
            }`}
          >
            <Mic className="h-2.5 w-2.5" />
          </span>
        </div>
      </div>

      <div className="mt-1 flex items-center justify-between pl-12 pr-1">
        <button
          onClick={handleTranscribeClick}
          disabled={transcribing}
          className={`inline-flex items-center gap-1 text-[11px] font-medium ${mine ? "text-white/80" : "text-[#E07A5F]"} hover:underline disabled:no-underline disabled:opacity-70`}
        >
          {transcribing && <Loader2 className="h-3 w-3 animate-spin" />}
          {transcribing ? "Transcribing…" : transcript ? (showTranscript ? "Hide transcript" : "Show transcript") : "Transcribe"}
        </button>
        <span className={`text-[10px] tabular-nums ${mine ? "text-white/70" : "text-[#8C8C8C]"}`}>
          {String(Math.floor(secs / 60)).padStart(1, "0")}:{String(secs % 60).padStart(2, "0")}
        </span>
      </div>
      {showTranscript && transcript && (
        <p className={`mt-1.5 pl-12 pr-1 text-[12.5px] leading-snug italic ${mine ? "text-white/90" : "text-[#2D3436] dark:text-[#E8E8E8]"}`}>
          "{transcript}"
        </p>
      )}
    </div>
  );
}

/* ─── Composer ─── */
export function Composer({
  draft, setDraft, showEmoji, setShowEmoji, onPickImages, fileRef, onPickDocs, docRef, onSend, onVoiceUploaded, onRecordingChange,
  hasAttachments, sending, onSchedule,
}: {
  draft: string; setDraft: (v: string) => void;
  showEmoji: boolean; setShowEmoji: (v: boolean | ((s: boolean) => boolean)) => void;
  onPickImages: (files?: FileList | null) => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onPickDocs: (files?: FileList | null) => void;
  docRef: React.RefObject<HTMLInputElement | null>;
  onSend: () => void;
  onVoiceUploaded: (blob: Blob, durationMs: number) => void;
  onRecordingChange?: (recording: boolean) => void;
  hasAttachments?: boolean;
  sending?: boolean;
  onSchedule?: (date: Date) => void;
}) {
  const [showScheduler, setShowScheduler] = useState(false);
  const [scheduleValue, setScheduleValue] = useState("");
  const [recording, setRecording] = useState(false);
  const [locked, setLocked] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [slideX, setSlideX] = useState(0);
  const [slideY, setSlideY] = useState(0);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const lockedRef = useRef(locked);

  useEffect(() => { lockedRef.current = locked; }, [locked]);
  useEffect(() => { onRecordingChange?.(recording); }, [recording, onRecordingChange]);

  const cleanupRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    mediaRef.current = null;
    startPosRef.current = null;
    setRecording(false);
    setLocked(false);
    setSlideX(0);
    setSlideY(0);
    setElapsed(0);
  }, []);

  const cancelRecording = useCallback(() => {
    chunksRef.current = [];
    const rec = mediaRef.current;
    if (rec) rec.stop();
    // cleanup happens in onstop
  }, []);

  const lockRecording = useCallback(() => {
    setLocked(true);
  }, []);

  const finalizeRecording = useCallback(() => {
    const rec = mediaRef.current;
    if (rec) rec.stop();
    // cleanup happens in onstop
  }, []);

  const handleStartRec = useCallback(async (clientX: number, clientY: number) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const dur = Date.now() - startedRef.current;
        const blob = new Blob(chunksRef.current, { type: mime });
        stream.getTracks().forEach((t) => t.stop());
        if (blob.size > 1000 && chunksRef.current.length > 0) {
          onVoiceUploaded(blob, dur);
        }
        chunksRef.current = [];
        cleanupRecording();
      };
      startedRef.current = Date.now();
      rec.start();
      mediaRef.current = rec;
      startPosRef.current = { x: clientX, y: clientY };
      setRecording(true);
      setLocked(false);
      setSlideX(0);
      setSlideY(0);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } catch {
      notify.error({ message: "Microphone permission denied" });
    }
  }, [onVoiceUploaded, cleanupRecording]);

  useEffect(() => {
    if (!recording) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (lockedRef.current) return;
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const start = startPosRef.current;
      if (!start) return;
      const dx = clientX - start.x;
      const dy = start.y - clientY;
      setSlideX(dx);
      setSlideY(dy);
      if (dx < -100) { cancelRecording(); }
      else if (dy > 100) { lockRecording(); }
    };

    const handleUp = () => {
      if (lockedRef.current) return;
      finalizeRecording();
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
    document.addEventListener("touchmove", handleMove, { passive: false });
    document.addEventListener("touchend", handleUp);

    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
      document.removeEventListener("touchmove", handleMove);
      document.removeEventListener("touchend", handleUp);
    };
  }, [recording, cancelRecording, lockRecording, finalizeRecording]);

  return (
    <div className="relative border-t border-[#E07A5F]/10 bg-[#FFFDF9] dark:bg-[#242424] px-2 py-2 md:px-4 md:py-3 select-none">
      {showEmoji && (
        <div className="absolute bottom-full left-2 mb-2 grid max-h-56 max-w-xs grid-cols-8 gap-1 overflow-y-auto rounded-2xl border border-[#E07A5F]/10 bg-[#FFFDF9] dark:bg-[#2A2A2A] p-2 shadow-xl md:left-6">
          {EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => setDraft(draft + e)}
              className="grid h-9 w-9 place-items-center rounded-lg text-lg hover:bg-[#E07A5F]/10 transition"
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {recording && !locked && (
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div
            className={`flex items-center gap-1 transition-all duration-200 shrink-0 ${
              slideX < -30 ? "opacity-100 translate-x-0" : "opacity-50 -translate-x-2"
            }`}
          >
            <CornerUpLeft className="h-5 w-5 text-red-500" />
            <span className="text-xs text-red-500 font-medium">Slide to cancel</span>
          </div>

          <div className="flex flex-1 items-center gap-3 rounded-3xl bg-[#F5F0E8] dark:bg-[#2A2A2A] px-5 py-3.5 border border-[#E07A5F]/10 relative overflow-hidden">
            <span className="h-3 w-3 animate-pulse rounded-full bg-red-500 shrink-0" />
            <span className="text-sm text-[#2D3436] dark:text-[#E8E8E8] font-medium shrink-0">
              {String(Math.floor(elapsed / 60)).padStart(1, "0")}:{String(elapsed % 60).padStart(2, "0")}
            </span>

            <div className="flex-1 flex items-center gap-[1px] justify-end h-8">
              {Array.from({ length: 40 }).map((_, i) => (
                <span
                  key={i}
                  className="w-[2px] rounded-full bg-red-400/60 animate-pulse"
                  style={{
                    height: `${Math.random() * 20 + 4}px`,
                    animationDelay: `${i * 0.03}s`,
                  }}
                />
              ))}
            </div>

            <div
              className={`flex flex-col items-center gap-0.5 transition-all duration-200 shrink-0 ${
                slideY > 30 ? "opacity-100 -translate-y-1" : "opacity-50 translate-y-0"
              }`}
            >
              <Lock className="h-4 w-4 text-[#E07A5F]" />
              <span className="text-[10px] text-[#E07A5F] font-medium">Slide up</span>
            </div>
          </div>
        </div>
      )}

      {recording && locked && (
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <button
            onClick={cancelRecording}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#F5F0E8] dark:bg-[#3A3A3A] text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex flex-1 items-center gap-3 rounded-3xl bg-[#F5F0E8] dark:bg-[#2A2A2A] px-5 py-3.5 border border-[#E07A5F]/10">
            <span className="h-3 w-3 rounded-full bg-red-500 shrink-0" />
            <span className="text-sm text-[#2D3436] dark:text-[#E8E8E8] font-medium">
              {String(Math.floor(elapsed / 60)).padStart(1, "0")}:{String(elapsed % 60).padStart(2, "0")}
            </span>

            <div className="flex-1 flex items-center gap-[1px] justify-end h-8">
              {Array.from({ length: 40 }).map((_, i) => (
                <span
                  key={i}
                  className="w-[2px] rounded-full bg-red-400/60 animate-pulse"
                  style={{
                    height: `${Math.random() * 20 + 4}px`,
                    animationDelay: `${i * 0.03}s`,
                  }}
                />
              ))}
            </div>
          </div>

          <button
            onClick={finalizeRecording}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#E07A5F] text-white shadow-md hover:bg-[#D4694F] transition active:scale-95"
          >
            <Check className="h-5 w-5" />
          </button>
        </div>
      )}

      {!recording && (
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <div className="flex flex-1 items-end gap-1.5 rounded-3xl bg-[#F5F0E8] dark:bg-[#2A2A2A] px-2 py-1.5 border border-[#E07A5F]/10">
            <button
              onClick={() => setShowEmoji((s) => !s)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[#8C8C8C] hover:bg-[#E07A5F]/10 transition mb-0.5"
            >
              <Smile className="h-5 w-5" />
            </button>

            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (!sending) onSend(); } }}
              rows={1}
              placeholder="Type a message · @sona for AI"
              className="max-h-32 min-h-[38px] flex-1 resize-none bg-transparent text-[15px] outline-none placeholder:text-[#8C8C8C] text-[#2D3436] dark:text-[#E8E8E8] py-2"
            />

            <button
              onClick={() => docRef.current?.click()}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[#8C8C8C] hover:bg-[#E07A5F]/10 transition mb-0.5"
              aria-label="Attach file"
            >
              <Paperclip className="h-5 w-5" />
            </button>
            <input
              ref={docRef}
              type="file"
              multiple
              accept={DOC_EXTENSIONS.join(",")}
              className="hidden"
              onChange={(e) => { onPickDocs(e.target.files); e.target.value = ""; }}
            />

            <button
              onClick={() => fileRef.current?.click()}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[#8C8C8C] hover:bg-[#E07A5F]/10 transition mb-0.5"
              aria-label="Image"
            >
              <ImageIcon className="h-5 w-5" />
            </button>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => { onPickImages(e.target.files); e.target.value = ""; }}
            />
          </div>

          {(draft.trim() || hasAttachments) && onSchedule && (
            <div className="relative">
              <button
                onClick={() => setShowScheduler((s) => !s)}
                disabled={sending}
                aria-label="Schedule message"
                title="Schedule for later"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#8C8C8C] hover:bg-[#F4A261]/20 disabled:opacity-40"
              >
                <Clock className="h-4 w-4" />
              </button>
              {showScheduler && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowScheduler(false)} />
                  <div className="absolute bottom-full right-0 z-40 mb-2 w-64 rounded-xl border border-[#E07A5F]/10 bg-white dark:bg-[#2A2A2A] p-3 shadow-xl">
                    <p className="mb-2 text-xs font-semibold text-[#2D3436] dark:text-[#E8E8E8]">Send later</p>
                    <input
                      type="datetime-local"
                      value={scheduleValue}
                      min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                      onChange={(e) => setScheduleValue(e.target.value)}
                      className="w-full rounded-lg border border-[#E07A5F]/20 bg-transparent px-2 py-1.5 text-sm text-[#2D3436] dark:text-[#E8E8E8] outline-none"
                    />
                    <button
                      onClick={() => {
                        if (!scheduleValue) return;
                        const date = new Date(scheduleValue);
                        if (date.getTime() <= Date.now()) return;
                        onSchedule(date);
                        setShowScheduler(false);
                        setScheduleValue("");
                      }}
                      disabled={!scheduleValue}
                      className="mt-2 w-full rounded-lg bg-[#E07A5F] py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40 transition"
                    >
                      Schedule
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {draft.trim() || hasAttachments ? (
            <button
              onClick={onSend}
              disabled={sending}
              className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#E07A5F] text-white shadow-md hover:bg-[#D4694F] transition active:scale-95 disabled:opacity-60 disabled:active:scale-100"
            >
              {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </button>
          ) : (
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                handleStartRec(e.clientX, e.clientY);
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                const touch = e.touches[0];
                handleStartRec(touch.clientX, touch.clientY);
              }}
              className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#E07A5F] text-white shadow-md hover:bg-[#D4694F] transition active:scale-95"
            >
              <Mic className="h-5 w-5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
