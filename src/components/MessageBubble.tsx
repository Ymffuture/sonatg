import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Download, Reply,Globe, ExternalLink, Pencil, SmilePlus, Trash2, Copy, Check,
  Play, Pause, Mic, Smile, Paperclip, Send, Image as ImageIcon,
  File as FileIcon, X, CornerUpLeft, MoreVertical, Lock, Phone, Video, Loader2, Clock,ZoomIn, ZoomOut, RotateCcw, Share2,
  Link2, ChevronLeft, ChevronRight, Maximize2, Minimize2, Forward,
  FileText, Plus, ListChecks, CircleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { PollCard } from "@/features/classroom";
import { motion, AnimatePresence } from "framer-motion";
import EmojiPicker, { Theme as EmojiTheme, EmojiStyle, type EmojiClickData } from "emoji-picker-react";
import { FaRegThumbsUp } from "react-icons/fa6";
import { RiEmojiStickerLine } from "react-icons/ri";
import { VscVerifiedFilled } from "react-icons/vsc";
import { Skeleton, Tooltip, notification } from "antd";
import { useServerFn } from "@tanstack/react-start";
import { transcribeVoiceMessage } from "@/lib/transcribe.functions";
import { fetchLinkPreview, type LinkPreview } from "@/lib/linkpreview.functions";
import { SONA_AI_ID, fmtTime, type MessageRow, type Profile, type ReactionRow, type MessageReadRow } from "@/lib/db";
import {
  type ChatWithMeta, type ReadStatus, readStatusFor, waveformBars, formatBytes, downloadFile,
  URL_REGEX, URL_REGEX_TEST, DOC_EXTENSIONS, docExtOf,
} from "@/utils/utils";
import { IoSend } from "react-icons/io5";
import { Avatar, TickIcon } from "./Avatar";
import { LuCalendarClock } from "react-icons/lu";
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
      placement: "top",
      className:
        "!bg-[#fff] dark:!bg-white !rounded !border-white/10 !shadow-xl " +
        "[&_.ant-notification-notice-message]:!text-white dark:[&_.ant-notification-notice-message]:!text-[#2D3436] " +
        "[&_.ant-notification-notice-description]:!text-white/80 dark:[&_.ant-notification-notice-description]:!text-[#2D3436]/80 " +
        "[&_.ant-notification-notice-icon]:!text-[#1E1E1E]",
    }),
  error: ({ message, description }: { message: string; description?: string }) =>
    notification.error({
      message,
      description,
      placement: "top",
      className:
        "!bg-[#fff] dark:!bg-white !rounded !border-white/10 !shadow-xl " +
        "[&_.ant-notification-notice-message]:!text-white dark:[&_.ant-notification-notice-message]:!text-[#2D3436] " +
        "[&_.ant-notification-notice-description]:!text-white/80 dark:[&_.ant-notification-notice-description]:!text-[#2D3436]/80 " +
        "[&_.ant-notification-notice-icon]:!text-red-400 dark:[&_.ant-notification-notice-icon]:!text-red-500",
    }),
  info: ({ message, description }: { message: string; description?: string }) =>
    notification.info({
      message,
      description,
      placement: "top",
      className:
        "!bg-[#fff] dark:!bg-white !rounded !border-white/10 !shadow-xl " +
        "[&_.ant-notification-notice-message]:!text-white dark:[&_.ant-notification-notice-message]:!text-[#2D3436] " +
        "[&_.ant-notification-notice-description]:!text-white/80 dark:[&_.ant-notification-notice-description]:!text-[#2D3436]/80 " +
        "[&_.ant-notification-notice-icon]:!text-[#4FA6E0]",
    }),
};

/* ─── Block Types ─── */

type Block =
  | { type: "paragraph"; children: InlineToken[] }
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; children: InlineToken[] }
  | { type: "blockquote"; children: Block[] }
  | { type: "list"; ordered: boolean; items: ListItem[] }
  | { type: "thematicBreak" }
  | { type: "codeblock"; content: string; lang?: string }
  | { type: "table"; header: InlineToken[][]; rows: InlineToken[][][] };

type ListItem = {
  checked?: boolean;
  children: Block[];
};

type InlineToken =
  | { type: "text"; content: string }
  | { type: "bold"; children: InlineToken[] }
  | { type: "italic"; children: InlineToken[] }
  | { type: "strike"; children: InlineToken[] }
  | { type: "code"; content: string }
  | { type: "link"; children: InlineToken[]; href: string }
  | { type: "image"; alt: string; src: string; title?: string }
  | { type: "autolink"; href: string; kind: "url" | "email" }
  | { type: "br" };

const URL_REGEX = /\bhttps?:\/\/[^\s<>()]+[^\s<>().,;:!?]/i;
const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

function normalizeText(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function isBlank(line: string) {
  return line.trim().length === 0;
}

function isThematicBreak(line: string) {
  return /^\s*(\*\s*){3,}|^\s*(-\s*){3,}|^\s*(_\s*){3,}\s*$/.test(line);
}

function isHeading(line: string) {
  const m = /^(#{1,6})\s+(.*)$/.exec(line);
  return m ? { level: m[1].length as 1 | 2 | 3 | 4 | 5 | 6, text: m[2] } : null;
}

function isFence(line: string) {
  const m = /^(\s*)(```|~~~)\s*([^\s`]*)\s*$/.exec(line);
  return m ? { fence: m[2], lang: m[3] || undefined } : null;
}

function isBlockquote(line: string) {
  const m = /^\s*>\s?(.*)$/.exec(line);
  return m ? m[1] : null;
}

function isUnorderedListItem(line: string) {
  const m = /^(\s*)([-+*])\s+(.*)$/.exec(line);
  return m ? { indent: m[1].length, text: m[3] } : null;
}

function isOrderedListItem(line: string) {
  const m = /^(\s*)(\d+)[.)]\s+(.*)$/.exec(line);
  return m ? { indent: m[1].length, text: m[3] } : null;
}

function splitTableRow(line: string) {
  const trimmed = line.trim();
  const inner = trimmed.startsWith("|") ? trimmed.slice(1) : trimmed;
  const cleaned = inner.endsWith("|") ? inner.slice(0, -1) : inner;
  return cleaned.split("|").map((s) => s.trim());
}

function isTableSeparator(line: string) {
  return /^\s*\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?\s*$/.test(line);
}

function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let i = 0;

  const pushText = (content: string) => {
    if (content) tokens.push({ type: "text", content });
  };

  while (i < text.length) {
    if (text[i] === "\\" && i + 1 < text.length) {
      pushText(text[i + 1]);
      i += 2;
      continue;
    }

    if (text.startsWith("![", i)) {
      const close = findMatchingBracket(text, i + 1);
      if (close !== -1 && text[close + 1] === "(") {
        const endParen = findMatchingParen(text, close + 1);
        if (endParen !== -1) {
          const alt = text.slice(i + 2, close);
          const inside = text.slice(close + 2, endParen).trim();
          const { href, title } = parseLinkTarget(inside);
          tokens.push({ type: "image", alt, src: href, title });
          i = endParen + 1;
          continue;
        }
      }
    }

    if (text[i] === "[") {
      const close = findMatchingBracket(text, i);
      if (close !== -1 && text[close + 1] === "(") {
        const endParen = findMatchingParen(text, close + 1);
        if (endParen !== -1) {
          const label = text.slice(i + 1, close);
          const inside = text.slice(close + 2, endParen).trim();
          const { href } = parseLinkTarget(inside);
          tokens.push({ type: "link", children: parseInline(label), href });
          i = endParen + 1;
          continue;
        }
      }
    }

    const codeMatch = matchDelimited(text, i, "`");
    if (codeMatch) {
      tokens.push({ type: "code", content: codeMatch.content });
      i = codeMatch.end;
      continue;
    }

    if (text.startsWith("**", i) || text.startsWith("__", i)) {
      const delim = text.substr(i, 2);
      const close = findClosingDelimiter(text, i + 2, delim);
      if (close !== -1) {
        tokens.push({ type: "bold", children: parseInline(text.slice(i + 2, close)) });
        i = close + 2;
        continue;
      }
    }

    if (text.startsWith("*", i) || text.startsWith("_", i)) {
      const delim = text[i];
      const close = findClosingDelimiter(text, i + 1, delim);
      if (close !== -1) {
        tokens.push({ type: "italic", children: parseInline(text.slice(i + 1, close)) });
        i = close + 1;
        continue;
      }
    }

    if (text.startsWith("~~", i)) {
      const close = findClosingDelimiter(text, i + 2, "~~");
      if (close !== -1) {
        tokens.push({ type: "strike", children: parseInline(text.slice(i + 2, close)) });
        i = close + 2;
        continue;
      }
    }

    const remaining = text.slice(i);
const url = remaining.match(URL_REGEX)?.[0];
const email = remaining.match(EMAIL_REGEX)?.[0];
if (url && (!email || url.length <= email.length)) {
  tokens.push({ type: "autolink", href: url, kind: "url" });
  i += url.length;
  continue;
}
if (email) {
  tokens.push({ type: "autolink", href: `mailto:${email}`, kind: "email" });
  i += email.length;
  continue;
}

    if (text[i] === "\n") {
      tokens.push({ type: "br" });
      i++;
      continue;
    }

    let j = i;
    while (
      j < text.length &&
      !["\\", "!", "[", "`", "*", "_", "~", "\n"].includes(text[j]) &&
      !text.slice(j).match(/^https?:\/\//) &&
      !text.slice(j).match(/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
    ) {
      j++;
    }
    if (j === i) j++;
    pushText(text.slice(i, j));
    i = j;
  }

  return mergeTextTokens(tokens);
}

function mergeTextTokens(tokens: InlineToken[]): InlineToken[] {
  const out: InlineToken[] = [];
  for (const t of tokens) {
    const last = out[out.length - 1];
    if (t.type === "text" && last?.type === "text") last.content += t.content;
    else out.push(t);
  }
  return out;
}

function findMatchingBracket(text: string, openIndex: number) {
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    if (text[i] === "\\" && i + 1 < text.length) {
      i++;
      continue;
    }
    if (text[i] === "[") depth++;
    else if (text[i] === "]") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function findMatchingParen(text: string, openParenIndex: number) {
  let depth = 0;
  for (let i = openParenIndex; i < text.length; i++) {
    if (text[i] === "\\" && i + 1 < text.length) {
      i++;
      continue;
    }
    if (text[i] === "(") depth++;
    else if (text[i] === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function parseLinkTarget(input: string) {
  const m = /^(.*?)(?:\s+"([^"]+)")?$/.exec(input);
  const href = (m?.[1] || "").trim();
  const title = m?.[2];
  return { href, title };
}

function matchDelimited(text: string, start: number, delimiter: string) {
  if (!text.startsWith(delimiter, start)) return null;
  const end = text.indexOf(delimiter, start + delimiter.length);
  if (end === -1) return null;
  const content = text.slice(start + delimiter.length, end);
  return { content, end };
}

function findClosingDelimiter(text: string, start: number, delimiter: string) {
  let i = start;
  while (i < text.length) {
    const idx = text.indexOf(delimiter, i);
    if (idx === -1) return -1;
    if (text[idx - 1] !== "\\") return idx;
    i = idx + delimiter.length;
  }
  return -1;
}

function parseBlocks(text: string): Block[] {
  const lines = normalizeText(text).split("\n");
  const blocks: Block[] = [];
  let i = 0;

  const parseParagraph = () => {
    const buffer: string[] = [];
    while (i < lines.length && !isBlank(lines[i])) {
      if (isFence(lines[i]) || isHeading(lines[i]) || isThematicBreak(lines[i]) || isBlockquote(lines[i]) !== null || isListItem(lines[i]) || isTableStart(lines, i)) break;
      buffer.push(lines[i]);
      i++;
    }
    if (buffer.length) blocks.push({ type: "paragraph", children: parseInline(buffer.join("\n")) });
  };

  const isListItem = (line: string) => isUnorderedListItem(line) || isOrderedListItem(line);

  while (i < lines.length) {
    if (isBlank(lines[i])) {
      i++;
      continue;
    }

    const fence = isFence(lines[i]);
    if (fence) {
      i++;
      const content: string[] = [];
      while (i < lines.length && !isFence(lines[i])) {
        content.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      blocks.push({ type: "codeblock", content: content.join("\n"), lang: fence.lang });
      continue;
    }

    const heading = isHeading(lines[i]);
    if (heading) {
      blocks.push({ type: "heading", level: heading.level, children: parseInline(heading.text.trim()) });
      i++;
      continue;
    }

    if (isThematicBreak(lines[i])) {
      blocks.push({ type: "thematicBreak" });
      i++;
      continue;
    }

    const quote = isBlockquote(lines[i]);
    if (quote !== null) {
      const quoteLines: string[] = [];
      while (i < lines.length) {
        const q = isBlockquote(lines[i]);
        if (q === null && !isBlank(lines[i])) break;
        quoteLines.push(q ?? "");
        i++;
      }
      blocks.push({ type: "blockquote", children: parseBlocks(quoteLines.join("\n")) });
      continue;
    }

    const list = parseList(lines, i);
    if (list) {
      blocks.push(list.block);
      i = list.nextIndex;
      continue;
    }

    if (isTableStart(lines, i)) {
      const { block, nextIndex } = parseTable(lines, i);
      blocks.push(block);
      i = nextIndex;
      continue;
    }

    parseParagraph();
  }

  return blocks;
}

function isTableStart(lines: string[], i: number) {
  return i + 1 < lines.length && lines[i].includes("|") && isTableSeparator(lines[i + 1]);
}

function parseTable(lines: string[], i: number) {
  const header = splitTableRow(lines[i]).map(parseInline);
  const rows: InlineToken[][][] = [];
  i += 2;
  while (i < lines.length && lines[i].includes("|") && !isBlank(lines[i])) {
    rows.push(splitTableRow(lines[i]).map(parseInline));
    i++;
  }
  return { block: { type: "table" as const, header, rows }, nextIndex: i };
}

function parseList(lines: string[], startIndex: number): { block: Block; nextIndex: number } | null {
  const firstUnordered = isUnorderedListItem(lines[startIndex]);
  const firstOrdered = isOrderedListItem(lines[startIndex]);
  const ordered = !!firstOrdered;
  const items: ListItem[] = [];
  let i = startIndex;

  while (i < lines.length) {
    const current = ordered ? isOrderedListItem(lines[i]) : isUnorderedListItem(lines[i]);
    if (!current) break;

    const itemLines: string[] = [];
    const firstLine = current.text;

    const task = /^\[( |x|X)\]\s+(.*)$/.exec(firstLine);
    let checked: boolean | undefined;
    if (task) {
      checked = task[1].toLowerCase() === "x";
      itemLines.push(task[2]);
    } else {
      itemLines.push(firstLine);
    }

    i++;
    while (i < lines.length && (lines[i].startsWith("  ") || isBlank(lines[i]))) {
      if (isBlank(lines[i])) {
        itemLines.push("");
        i++;
        continue;
      }
      itemLines.push(lines[i].replace(/^\s{2,3}/, ""));
      i++;
    }

    items.push({ checked, children: parseBlocks(itemLines.join("\n")) });
  }

  if (!items.length) return null;
  return { block: { type: "list", ordered, items }, nextIndex: i };
}

export function renderMarkdown(text: string, mine: boolean) {
  return parseBlocks(text).map((block, i) => {
    const key = `block-${i}`;
    switch (block.type) {
      case "paragraph":
        return (
          <p key={key} className="whitespace-pre-wrap break-words leading-snug">
            {renderInlineTokens(block.children, key)}
          </p>
        );
      case "heading":
        return React.createElement(
          `h${block.level}`,
          { key, className: "font-semibold tracking-tight" },
          renderInlineTokens(block.children, key)
        );
      case "blockquote":
        return (
          <blockquote key={key} className="border-l-4 pl-3 opacity-90">
            {block.children.map((child, idx) => (
              <React.Fragment key={idx}>{renderBlock(child, `${key}-${idx}`)}</React.Fragment>
            ))}
          </blockquote>
        );
      case "list":
        return block.ordered ? (
          <ol key={key} className="ml-5 list-decimal space-y-1">
            {block.items.map((item, idx) => (
              <li key={idx}>
                {item.checked !== undefined && (
                  <input type="checkbox" readOnly checked={item.checked} className="mr-2 align-middle" />
                )}
                {item.children.map((child, cidx) => (
                  <React.Fragment key={cidx}>{renderBlock(child, `${key}-${idx}-${cidx}`)}</React.Fragment>
                ))}
              </li>
            ))}
          </ol>
        ) : (
          <ul key={key} className="ml-5 list-disc space-y-1">
            {block.items.map((item, idx) => (
              <li key={idx}>
                {item.checked !== undefined && (
                  <input type="checkbox" readOnly checked={item.checked} className="mr-2 align-middle" />
                )}
                {item.children.map((child, cidx) => (
                  <React.Fragment key={cidx}>{renderBlock(child, `${key}-${idx}-${cidx}`)}</React.Fragment>
                ))}
              </li>
            ))}
          </ul>
        );
      case "thematicBreak":
        return <hr key={key} className="my-3 border-t opacity-30" />;
      case "codeblock":
        return (
          <pre key={key} className="my-2 overflow-x-auto rounded-lg bg-black/5 dark:bg-white/10 p-3 text-xs font-mono border border-[#E07A5F]/10">
            {block.lang && <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#E07A5F] opacity-70">{block.lang}</div>}
            <code>{block.content}</code>
          </pre>
        );
      case "table":
        return (
          <TableRenderer
            key={key}
            header={block.header.map((h) => flattenInlineToText(h))}
            rows={block.rows.map((r) => r.map((c) => flattenInlineToText(c)))}
            mine={mine}
          />
        );
    }
  });
}

function renderBlock(block: Block, keyPrefix: string): React.ReactNode {
  switch (block.type) {
    case "paragraph":
      return <p className="whitespace-pre-wrap break-words leading-snug">{renderInlineTokens(block.children, keyPrefix)}</p>;
    case "heading":
      return React.createElement(`h${block.level}`, { className: "font-semibold tracking-tight" }, renderInlineTokens(block.children, keyPrefix));
    case "blockquote":
      return <blockquote className="border-l-4 pl-3 opacity-90">{block.children.map((child, i) => <React.Fragment key={i}>{renderBlock(child, `${keyPrefix}-${i}`)}</React.Fragment>)}</blockquote>;
    case "list":
      return block.ordered ? (
        <ol className="ml-5 list-decimal space-y-1">
          {block.items.map((item, i) => (
            <li key={i}>
              {item.checked !== undefined && <input type="checkbox" readOnly checked={item.checked} className="mr-2 align-middle" />}
              {item.children.map((child, j) => <React.Fragment key={j}>{renderBlock(child, `${keyPrefix}-${i}-${j}`)}</React.Fragment>)}
            </li>
          ))}
        </ol>
      ) : (
        <ul className="ml-5 list-disc space-y-1">
          {block.items.map((item, i) => (
            <li key={i}>
              {item.checked !== undefined && <input type="checkbox" readOnly checked={item.checked} className="mr-2 align-middle" />}
              {item.children.map((child, j) => <React.Fragment key={j}>{renderBlock(child, `${keyPrefix}-${i}-${j}`)}</React.Fragment>)}
            </li>
          ))}
        </ul>
      );
    case "thematicBreak":
      return <hr className="my-3 border-t opacity-30" />;
    case "codeblock":
      return <pre className="overflow-x-auto rounded bg-black/5 p-3 font-mono text-xs"><code>{block.content}</code></pre>;
    case "table":
      return (
        <TableRenderer
          header={block.header.map((h) => flattenInlineToText(h))}
          rows={block.rows.map((r) => r.map((c) => flattenInlineToText(c)))}
          mine={false}
        />
      );
  }
}

// Flattens a run of inline tokens (bold/italic/link/etc.) down to plain
// text. Table cells render through TableRenderer's plain <td>/<th>, which
// expects strings — passing raw token objects there triggers React error
// #31 ("object with keys {type, children}"), since a {type, children}
// shape is exactly what a bold/italic/paragraph token looks like.
function flattenInlineToText(tokens: InlineToken[]): string {
  return tokens
    .map((t) => {
      switch (t.type) {
        case "text":
          return t.content;
        case "code":
          return t.content;
        case "autolink":
          return t.href;
        case "image":
          return t.alt ?? "";
        case "br":
          return "\n";
        case "bold":
        case "italic":
        case "strike":
        case "link":
          return flattenInlineToText(t.children);
        default:
          return "";
      }
    })
    .join("");
}

function renderInlineTokens(tokens: InlineToken[], keyPrefix: string): React.ReactNode[] {
  return tokens.map((token, i) => {
    const key = `${keyPrefix}-${i}`;
    switch (token.type) {
      case "text":
        return <span key={key}>{token.content}</span>;
      case "bold":
        return <strong key={key} className="font-semibold">{renderInlineTokens(token.children, key)}</strong>;
      case "italic":
        return <em key={key} className="italic">{renderInlineTokens(token.children, key)}</em>;
      case "strike":
        return <s key={key} className="line-through opacity-70">{renderInlineTokens(token.children, key)}</s>;
      case "code":
        return <code key={key} className="rounded bg-black/10 px-1 py-0.5 font-mono text-[0.9em] dark:bg-white/15">{token.content}</code>;
      case "link":
        return <a key={key} href={token.href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="underline underline-offset-2 break-all">{renderInlineTokens(token.children, key)}</a>;
      case "image":
        return <img key={key} src={token.src} alt={token.alt} title={token.title} className="inline-block max-h-48 rounded" />;
      case "autolink":
  if (token.kind === "email") {
    return (
      
        key={key}
        href={token.href}
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1.5 rounded-full bg-[#8B5CF6]/10 px-3 py-1.5 text-sm font-medium text-[#8B5CF6] transition hover:bg-[#8B5CF6] hover:text-white"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
          <path
            d="M3 6.5C3 5.67 3.67 5 4.5 5h15c.83 0 1.5.67 1.5 1.5v11c0 .83-.67 1.5-1.5 1.5h-15C3.67 19 3 18.33 3 17.5v-11Z"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.8" />
        </svg>
        Email
      </a>
    );
  }
  return (
    
      key={key}
      href={token.href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-2 break-all"
    >
      {token.href}
    </a>
  );
      case "br":
        return <br key={key} />;
    }
  });
}

function TableRenderer({
  header,
  rows,
  mine,
}: {
  header: string[];
  rows: string[][];
  mine: boolean;
}) {
  return (
    <div className="my-2 overflow-x-auto rounded-lg border border-[#E07A5F]/20 dark:border-[#E07A5F]/15">
      <table className="w-[130%] border-collapse text-left text-[13px]">
        <thead>
          <tr className={mine ? "bg-black/15" : "bg-[#E07A5F]/8 dark:bg-[#E07A5F]/15"}>
            {header.map((h, i) => (
              <th key={i} className="border-b px-3 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rIdx) => (
            <tr key={rIdx}>
              {row.map((cell, cIdx) => (
                <td key={cIdx} className="border-b px-3 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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
  open, x, y, mine, isText, onReply, onReact, onEdit, onDelete, onCopy, onForward, onClose,
}: {
  open: boolean; x: number; y: number; mine: boolean; isText: boolean;
  onReply: () => void; onReact: (emoji: string) => void;
  onEdit: () => void; onDelete: () => void; onCopy: () => void; onForward: () => void; onClose: () => void;
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
      className="w-52 rounded-2xl p-2 bg-[#FFFDF9] dark:bg-[#2A2A2A] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
    >
      <div className="flex items-center justify-around border-b border-[#1E1E1E]/10 px-2 py-2">
        {["❤️", "👎 ", "😂", "😮", "😢", "🙏" ].map((emoji) => (
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
        <MenuItem icon={<Forward className="h-4 w-4" />} label="Forward" onClick={() => { onForward(); onClose(); }} />
        {isText && <MenuItem icon={<Copy className="h-4 w-4" />} label="Copy text" onClick={() => { onCopy(); onClose(); }} />}
        <MenuItem icon={<FaRegThumbsUp className="h-4 w-4" />} label="React" onClick={() => { onReact("👍"); onClose(); }} />
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

// Full-screen in-app viewer for images and PDFs shared in chat — click to
// view, rather than every tap immediately triggering a download.

type MediaItem = {
  kind: "image" | "pdf";
  url: string;
  name?: string | null;
  size?: number;
  date?: string;
};

export function MediaViewer({
  items,
  initialIndex = 0,
  onClose,
}: {
  items: MediaItem[];
  initialIndex?: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showInfo, setShowInfo] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [entering, setEntering] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const current = items[index];
  const isFirst = index === 0;
  const isLast = index === items.length - 1;
  const isZoomed = scale > 1;

  // Entry animation
  useEffect(() => {
    const t = setTimeout(() => setEntering(false), 50);
    return () => clearTimeout(t);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
      if (e.key === "ArrowLeft" && !isZoomed) prev();
      if (e.key === "ArrowRight" && !isZoomed) next();
      if (e.key === "+" || e.key === "=") zoomIn();
      if (e.key === "-") zoomOut();
      if (e.key === "0") resetZoom();
      if (e.key === "i") setShowInfo((v) => !v);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isZoomed, index, items.length]);

  const handleClose = useCallback(() => {
    setEntering(true);
    setTimeout(onClose, 200);
  }, [onClose]);

  const prev = () => !isFirst && setIndex((i) => i - 1);
  const next = () => !isLast && setIndex((i) => i + 1);

  const zoomIn = () => setScale((s) => Math.min(s * 1.25, 5));
  const zoomOut = () => setScale((s) => Math.max(s / 1.25, 0.5));
  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Wheel zoom
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) zoomIn();
    else zoomOut();
  }, []);

  // Drag to pan
  const onMouseDown = (e: React.MouseEvent) => {
    if (!isZoomed) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !isZoomed) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };
  const onMouseUp = () => setIsDragging(false);

  // Touch swipe + pinch
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && touchStartRef.current && !isZoomed) {
      const dx = e.touches[0].clientX - touchStartRef.current.x;
      if (Math.abs(dx) > 60) {
        touchStartRef.current = null;
        dx > 0 ? prev() : next();
      }
    }
  };
  const onTouchEnd = () => {
    touchStartRef.current = null;
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(current.url);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy");
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({
        title: current.name || "Shared from Sona",
        url: current.url,
      });
    } catch {
      copyLink();
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-[150] flex flex-col transition-all duration-300 ${
        entering ? "opacity-0 scale-[1.02]" : "opacity-100 scale-100"
      }`}
      style={{ background: "rgba(10,10,14,0.92)", backdropFilter: "blur(24px) saturate(1.2)" }}
      onClick={handleClose}
    >
      {/* ─── Glass Header ─── */}
      <div
        className="relative z-10 mx-3 mt-3 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* File icon */}
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10">
            {current.kind === "image" ? (
              <ImageIcon className="h-4 w-4 text-[#E07A5F]" />
            ) : (
              <FileText className="h-4 w-4 text-[#4FA6E0]" />
            )}
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white/90">
              {current.name || (current.kind === "pdf" ? "Document" : "Photo")}
            </p>
            <p suppressHydrationWarning className="text-[11px] text-white/40">
              {index + 1} of {items.length}
              {current.size && ` · ${formatBytes(current.size)}`}
              {current.date && ` · ${fmtTime(current.date)}`}
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-0.5 shrink-0">
          {current.kind === "image" && (
            <>
              <button onClick={zoomOut} disabled={scale <= 0.5} className="tool-btn" aria-label="Zoom out">
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="min-w-[3ch] text-center text-[11px] font-mono text-white/50">
                {Math.round(scale * 100)}%
              </span>
              <button onClick={zoomIn} disabled={scale >= 5} className="tool-btn" aria-label="Zoom in">
                <ZoomIn className="h-4 w-4" />
              </button>
              <button onClick={resetZoom} disabled={scale === 1} className="tool-btn" aria-label="Reset">
                <RotateCcw className="h-4 w-4" />
              </button>
              <div className="mx-1 h-4 w-px bg-white/10" />
            </>
          )}

          <button onClick={nativeShare} className="tool-btn" aria-label="Share">
            <Share2 className="h-4 w-4" />
          </button>
          <button onClick={copyLink} className="tool-btn" aria-label="Copy link">
            <Link2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => downloadFile(current.url, current.name || (current.kind === "pdf" ? "document.pdf" : "photo.jpg"))}
            className="tool-btn"
            aria-label="Download"
          >
            <Download className="h-4 w-4" />
          </button>
          <button onClick={toggleFullscreen} className="tool-btn" aria-label="Fullscreen">
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <div className="mx-1 h-4 w-px bg-white/10" />
          <button onClick={handleClose} className="tool-btn hover:bg-red-500/20 hover:text-red-400" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ─── Main Content ─── */}
      <div
        className="relative flex-1 overflow-hidden cursor-grab active:cursor-grabbing"
        onClick={(e) => {
          if (e.target === e.currentTarget && !isZoomed) handleClose();
        }}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Loading */}
        {loading && (
          <div className="absolute inset-0 grid place-items-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-white/30" />
              <span className="text-xs text-white/30">Loading…</span>
            </div>
          </div>
        )}

        {/* Image */}
        {current.kind === "image" ? (
          <img
            ref={imageRef}
            src={current.url}
            alt=""
            draggable={false}
            className={`absolute inset-0 m-auto max-h-full max-w-full object-contain transition-transform duration-100 ease-out select-none ${
              isDragging ? "" : "transition-transform"
            } ${loading ? "opacity-0" : "opacity-100"}`}
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            }}
            onLoad={() => setLoading(false)}
          />
        ) : (
          /* PDF */
          <div className="absolute inset-4 rounded-xl overflow-hidden border border-white/10 bg-white shadow-2xl">
            <iframe
              src={current.url}
              title={current.name || "Document"}
              className="h-full w-full"
              onLoad={() => setLoading(false)}
            />
          </div>
        )}

        {/* Navigation arrows */}
        {!isZoomed && items.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); prev(); }}
              disabled={isFirst}
              className={`absolute left-4 top-1/2 -translate-y-1/2 grid h-12 w-12 place-items-center rounded-full border border-white/10 bg-white/5 backdrop-blur-xl text-white transition-all hover:bg-white/10 hover:scale-110 disabled:opacity-0 disabled:pointer-events-none ${entering ? "" : "animate-in fade-in slide-in-from-left-4"}`}
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); next(); }}
              disabled={isLast}
              className={`absolute right-4 top-1/2 -translate-y-1/2 grid h-12 w-12 place-items-center rounded-full border border-white/10 bg-white/5 backdrop-blur-xl text-white transition-all hover:bg-white/10 hover:scale-110 disabled:opacity-0 disabled:pointer-events-none ${entering ? "" : "animate-in fade-in slide-in-from-right-4"}`}
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}

        {/* Info panel */}
        {showInfo && (
          <div className="absolute right-4 top-20 w-64 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl shadow-2xl animate-in fade-in zoom-in-95">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-3">Details</h4>
            <div className="space-y-2 text-sm text-white/70">
              <div className="flex justify-between"><span className="text-white/40">Name</span><span className="truncate max-w-[120px]">{current.name || "—"}</span></div>
              <div className="flex justify-between"><span className="text-white/40">Type</span><span className="capitalize">{current.kind}</span></div>
              {current.size && <div className="flex justify-between"><span className="text-white/40">Size</span><span>{formatBytes(current.size)}</span></div>}
              {current.date && <div className="flex justify-between"><span className="text-white/40">Date</span><span suppressHydrationWarning>{fmtTime(current.date)}</span></div>}
              <div className="flex justify-between"><span className="text-white/40">URL</span><button onClick={copyLink} className="text-[#E07A5F] hover:underline">Copy</button></div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Bottom Thumbnail Strip ─── */}
      {items.length > 1 && (
        <div
          className="relative z-10 mx-auto mb-4 flex max-w-[90%] gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-white/5 p-2 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] scrollbar-hide"
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((item, i) => (
            <button
              key={i}
              onClick={() => { setIndex(i); resetZoom(); setLoading(true); }}
              className={`relative shrink-0 overflow-hidden rounded-xl transition-all ${
                i === index
                  ? "ring-2 ring-[#E07A5F] ring-offset-2 ring-offset-black/50 scale-105"
                  : "opacity-50 hover:opacity-80"
              }`}
            >
              {item.kind === "image" ? (
                <img src={item.url} alt="" className="h-14 w-14 object-cover" />
              ) : (
                <div className="grid h-14 w-14 place-items-center bg-white/10">
                  <FileText className="h-5 w-5 text-white/50" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


// Or inline the class if you prefer:
const toolBtnClass = "grid h-8 w-8 place-items-center rounded-lg text-white/60 transition-all hover:bg-white/10 hover:text-white active:scale-95 disabled:opacity-30 disabled:pointer-events-none";

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
    className={`
      group mb-4 p-2 block max-w-[340px] overflow-hidden rounded-2xl border
      transition-all duration-200 ease-out
      hover:-translate-y-0.5 hover:shadow-lg
      active:scale-[0.99] active:shadow-md
      ${
        mine
          ? "border-white/15 bg-slate-950 dark:bg-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-white/[0.12]"
          : "border-[#E07A5F]/10 bg-white dark:bg-[#242424] shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-[#E07A5F]/20 dark:shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
      }
    `}
  >
    {/* Image with gradient overlay */}
    {preview.image && (
      <div className="relative h-36 w-full overflow-hidden">
        <img
          src={preview.image}
          alt=""
          className="h-full w-full object-cover rounded-xl transition-transform duration-500 ease-out group-hover:scale-105"
          loading="lazy"
        />
        <div
          className={`absolute inset-0 bg-gradient-to-t ${
            mine ? "from-black" : "from-black/10 dark:from-black/20"
          } to-transparent`}
        />
        {/* External link badge */}
        <div className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/30 backdrop-blur-md opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <ExternalLink className="h-3.5 w-3.5 text-white" />
        </div>
      </div>
    )}

    {/* Content */}
    <div className="px-3.5 py-2.5">
      {/* Site name with favicon placeholder */}
      {preview.siteName && (
        <div className={`mb-1 flex items-center gap-1.5 ${mine ? "dark:text-white/50 text-[#8C8C8C] " : "text-[#8C8C8C]"}`}>
          <Globe className="h-3 w-3 shrink-0 opacity-60" />
          <p className="truncate text-[11px] font-medium uppercase tracking-wider">
            {preview.siteName}
          </p>
        </div>
      )}

      {/* Title */}
      {preview.title && (
        <p
          className={`
            text-[13px] font-semibold leading-snug line-clamp-2
            transition-colors duration-200
            ${mine ? "text-[#8C8C8C] dark:text-white " : "text-[#1a1a1a] dark:text-[#F0EBE3] group-hover:text-[#E07A5F]"}
          `}
        >
          {preview.title}
        </p>
      )}

      {/* Description */}
      {preview.description && (
        <p className={`mt-1 text-[12px] leading-relaxed line-clamp-2 ${mine ? "dark:text-white/60 text-[#1E1E1E] " : "text-[#8C8C8C]"}`}>
          {preview.description}
        </p>
      )}

      {/* URL pill */}
      <div className={`mt-2 inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
        mine
          ? " dark:bg-white/10 dark:text-white/40 bg-slate-950 text-[#8C8C8C] "
          : "bg-[#F5F0E8] text-[#8C8C8C] dark:bg-white/5"
      }`}>
        <span className="truncate">{new URL(preview.url).hostname.replace(/^www\./, "")}</span>
        <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-50" />
      </div>
    </div>
  </a>
);
} 
export function Bubble({
  msg, me, sender, reactions, reads, otherMemberIds, onReact, opening, onOpenPicker, grouped, isGroup,
  overrideBody, onDelete, onRemove, onReply, onEdit, parentName, parentBody, onJumpToParent, actionsOpen, onToggleActions, onTranscribed,
  replyCount, onOpenThread,allImages, onForward, isHighlighted,
}: {
  msg: MessageRow; me: Profile; sender?: Profile; reactions: ReactionRow[];
  reads: MessageReadRow[]; otherMemberIds: string[];
  onReact: (emoji: string) => void; opening: boolean; onOpenPicker: () => void; grouped: boolean; isGroup: boolean;
  overrideBody?: string; onDelete: () => void;
  /** Permanently removes an already-deleted message's row (no more placeholder). */
  onRemove?: () => void;
  onReply: () => void; onEdit: () => void;
  parentName?: string; parentBody?: React.ReactNode;
  /** Called when the user taps the quoted reply preview — scrolls to and highlights the original message. */
  onJumpToParent?: () => void;
  /** True briefly after this message is jumped to (via reply-tap or search), to flash its border. */
  isHighlighted?: boolean;
  actionsOpen: boolean; onToggleActions: () => void;
  onTranscribed?: (messageId: string, transcript: string) => void;
  replyCount?: number;
  onOpenThread?: () => void;
  allImages?: MediaItem[];
  onForward?: () => void;
}) {
  const mine = msg.sender_id === me.id;
  const isAI = msg.sender_id === SONA_AI_ID;
  const counts: Record<string, number> = {};
  reactions.forEach((r) => { counts[r.emoji] = (counts[r.emoji] ?? 0) + 1; });
  const status: ReadStatus = readStatusFor(msg, reads, [me.id, ...otherMemberIds], me.id);

  const [contextMenu, setContextMenu] = useState<{ open: boolean; x: number; y: number }>({ open: false, x: 0, y: 0 });
  const [imgLoaded, setImgLoaded] = useState(false);
  const [viewer, setViewer] = useState<{ kind: "image" | "pdf"; url: string; name?: string | null } | null>(null);
  const [justCopied, setJustCopied] = useState(false);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const bodyText = overrideBody ?? msg.body ?? "";

  const longPress = useLongPress(() => {
    if (bubbleRef.current) {
      const rect = bubbleRef.current.getBoundingClientRect();
      setContextMenu({ open: true, x: rect.left + rect.width / 2, y: rect.top });
    }
  }, 600);

  const handleCopy = () => {
    navigator.clipboard.writeText(bodyText).then(() => {
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 1500);
    });
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

  // Tailwind classes for the bubble wrapper
const bubbleBase = mine ? "bg-[var(--sona-bubble-mine,#eeffde)] text-[#151c1c] " : "bg-white";

const bubbleRadius = mine
  ? grouped
    ? "rounded-[16px] rounded-tr-[2px] rounded-br-[2px]"
    : "rounded-[16px] rounded-tr-[2px]"
  : grouped
    ? "rounded-[16px] rounded-tl-[2px] rounded-bl-[2px]"
    : "rounded-[16px] rounded-tl-[2px]";

// Only show tail on non-grouped bubbles
const tailClass = !grouped && mine
  ? `after:content-[''] after:absolute after:top-0 after:-right-[8px] 
     after:w-[16px] after:h-[20px] after:bg-inherit after:rounded-bl-full`
  : !grouped && !mine
  ? `after:content-[''] after:absolute after:top-0 after:-left-[8px] 
     after:w-[16px] after:h-[20px] after:bg-inherit after:rounded-br-full`
  : "";

  
  // Deleted messages render as a muted placeholder — content is already
  // cleared server-side (soft delete). Sender can still long-press to
  // permanently remove the row (hard delete), since there's no content
  // left to edit, copy, or react to.
  if (msg.deleted_at) {
    return (
      <div className={`flex ${mine ? "justify-end" : "justify-start"} mb-1`}>
        <div
          ref={bubbleRef}
          {...(mine ? longPress : {})}
          className={`relative flex items-center gap-1.5 rounded-2xl px-3.5 py-2 text-[13px] italic text-[#8C8C8C] select-none ${
            mine ? "bg-[#eeffde]/50 dark:bg-white/5 cursor-pointer" : "bg-white/60 dark:bg-white/5"
          }`}
        >
          <CircleAlert className="h-3.5 w-3.5 shrink-0 opacity-70" />
          This message was deleted
        </div>
        {mine && contextMenu.open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setContextMenu({ open: false, x: 0, y: 0 })} />
            <div
              className="fixed z-50 -translate-x-1/2 -translate-y-full rounded-xl border border-[#E07A5F]/15 bg-white dark:bg-[#242424] shadow-xl overflow-hidden"
              style={{ left: contextMenu.x, top: contextMenu.y - 8 }}
            >
              <button
                onClick={() => { setContextMenu({ open: false, x: 0, y: 0 }); onRemove?.(); }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10 transition whitespace-nowrap"
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

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
          <span suppressHydrationWarning className="opacity-60 select-none">· {fmtTime(msg.created_at)}</span>
        </div>
      </div>
    );
  }

  // Poll/quiz messages render as a self-contained PollCard instead of the
  // normal text/media bubble. body stores JSON: {"pollId": "..."}.
  if (msg.kind === "poll") {
    let pollId: string | null = null;
    try { pollId = (JSON.parse(msg.body ?? "{}") as { pollId?: string }).pollId ?? null; } catch { /* ignore malformed body */ }
    if (!pollId) return null;
    return (
      <div className={`my-2 flex ${mine ? "justify-end" : "justify-start"}`}>
        <PollCard pollId={pollId} meId={me.id} />
      </div>
    );
  }

  return (
    <>
      <div className={`group select-none flex items-end gap-1.5 ${mine ? "justify-end" : "justify-start"} ${grouped ? "mt-0.5" : "mt-1.5"}`}>
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
            className={`relative cursor-pointer select-none px-3 py-1.5 mb-3 shadow-xl transition-[opacity,box-shadow,border-color] duration-300 ${bubbleBase} ${bubbleRadius} ${tailClass} ${
              msg._pending ? "opacity-60" : "opacity-100"
            } ${
              mine
                ? "bg-[#1E1E1E] dark:bg-[#1E1E1E] dark:text-[#fff]"
                : "bg-white dark:bg-[#2A2A2A] text-[#151c1c] dark:text-[#E8E8E8] border border-[#E07A5F]/10"
            } ${
              isHighlighted
                ? "!border-2 !border-[#E8E8E8] animate-pulse ring-2 ring-[#1E1E1E]"
                : ""
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
                    
                  </div>
                ) : (
                  <span className="text-xs font-medium italic mb-2 text-[#8c8c8c]">
                    ~ {sender?.display_name ?? "Unknown"}
                  </span>
                )}
              </div>
            )}

            {msg.is_forwarded && (
              <div className={`mb-1 flex items-center gap-1 text-[11px] italic ${mine ? "text-gray-600 dark:text-white" : "text-[#8C8C8C]"}`}>
                <Forward className="h-3 w-3" /> Forwarded
              </div>
            )}

            {parentBody !== undefined && (
              <div
                role={onJumpToParent ? "button" : undefined}
                tabIndex={onJumpToParent ? 0 : undefined}
                onClick={(e) => { if (onJumpToParent) { e.stopPropagation(); onJumpToParent(); } }}
                onKeyDown={(e) => { if (onJumpToParent && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onJumpToParent(); } }}
                title={onJumpToParent ? "Jump to original message" : undefined}
                className={`mb-1.5 rounded-lg border-l-[1px] border-[#E07A5F] px-2 py-1.5 text-[11px] ${
                  mine ? "bg-black/10" : "bg-[#2D3436]/10 dark:bg-white/5"
                } ${onJumpToParent ? "cursor-pointer hover:brightness-95 active:brightness-90 transition" : ""}`}
              >
                <div className="font-semibold italic text-[#E07A5F] text-[11px]">{parentName}</div>
                {/* Fade-out on the right edge instead of a hard "…" cutoff —
                    reads more naturally for a preview snippet, and doesn't
                    clip a clickable link mid-URL. */}
                <div
                  className="overflow-hidden whitespace-nowrap max-w-[240px] leading-tight opacity-80 [mask-image:linear-gradient(to_right,black_85%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_right,black_85%,transparent_100%)]"
                >
                  {parentBody}
                </div>
              </div>
            )}

            {msg.kind === "image" && msg.media_url && (
              <div className="relative mb-1 group/image -mx-1 -mt-1 min-h-[160px]">
                {!imgLoaded && (
                  <div className="absolute inset-0 z-10 rounded-lg overflow-hidden bg-[#F5F0E8] dark:bg-[#2A2A2A] flex items-center justify-center">
                    <Skeleton.Node active className="!w-full !h-full !rounded-lg">
                      <ImageIcon className="h-16 w-16 text-[#8C8C8C]" />
                    </Skeleton.Node>
                  </div>
                )}
                <img
                  src={msg.media_url}
                  alt=""
                  loading="lazy"
                  onLoad={() => setImgLoaded(true)}
                  onClick={(e) => { e.stopPropagation(); setViewer({ kind: "image", url: msg.media_url!, name: `sona-photo-${msg.id}.jpg` }); }}
                  className={`max-h-72 w-full cursor-pointer rounded-lg object-cover transition-opacity duration-300 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadFile(msg.media_url!, `SonaTG-photo-${msg.id}.jpg`);
                  }}
                  aria-label="Download image"
                  className="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-black/50 text-white backdrop-blur-sm opacity-0 group-hover/image:opacity-100 hover:bg-black/70 active:scale-95 transition-all"
                >
                  <Download className="h-4 text-purple w-4" />
                </button>
                <div className="absolute bottom-1 -right-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white/90 backdrop-blur-sm">
                  Photo
                </div>
              </div>
            )}

            {msg.kind === "video" && msg.media_url && (
              <div className="relative mb-1 -mx-1 -mt-1 group/video">
                <video
                  src={msg.media_url}
                  controls
                  preload="metadata"
                  className="max-h-72 w-full rounded-lg bg-black"
                />
                <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
                  {msg.file_size ? (
                    <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white/90 backdrop-blur-sm">
                      {formatBytes(msg.file_size)}
                    </span>
                  ) : null}
                  <button
                    onClick={(e) => { e.stopPropagation(); downloadFile(msg.media_url!, `SonaTG-video-${msg.id}.mp4`); }}
                    aria-label="Download video"
                    className="grid h-8 w-8 place-items-center rounded-full bg-black/50 text-white backdrop-blur-sm opacity-0 group-hover/video:opacity-100 hover:bg-black/70 active:scale-95 transition-all"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {msg.kind === "file" && msg.media_url && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (docExtOf(msg.file_name || "") === ".pdf") {
                    setViewer({ kind: "pdf", url: msg.media_url!, name: msg.file_name });
                  } else {
                    downloadFile(msg.media_url!, msg.file_name || "file");
                  }
                }}
                className={`mb-1 flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                  mine
                    ? "border-white/20 dark:bg-white/5 text-[#8C8C8C] dark:text-[#2D3436] hover:bg-white/15"
                    : "border-[#E07A5F]/15 bg-[#F5F0E8] dark:bg-[#3A3A3A] hover:bg-[#EFE6D8] dark:hover:bg-[#454545]"
                }`}
              >
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${
                    mine ? "bg-white/20 dark:text-white !text-gray-600" : "bg-[#E07A5F]/10 text-[#E07A5F]"
                  }`}
                >
                  <FileIcon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm font-medium ${mine ? "dark:text-white text-gray-600" : "text-[#2D3436] dark:text-[#E8E8E8]"}`}>
                    {msg.file_name || "File"}
                  </span>
                  <span className={`block text-xs ${mine ? "text-[#1E90FF]" : "text-[#8C8C8C]"}`}>
                    {msg.file_size ? formatBytes(msg.file_size) : ""}
                  </span>
                </span>
                <Download className={`h-4 w-4 shrink-0 ${mine ? "text-[#F4A261] " : "text-[#8C8C8C]"}`} />
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
                  mine ? "text-zinc-400" : "text-[#2D3436]"
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
  <div className={`absolute z-10 ${mine ? "left-1.5" : "left-1.5"} -bottom-4.5`}>
    <Tooltip
      title={
        <div className="flex flex-col gap-2 py-0.5">
          {Object.entries(counts).map(([emoji, count]) => (
            <div key={emoji} className="flex items-center gap-2 text-xs">
              <span className="text-sm">{emoji}</span>
              <span className="opacity-90">{getReactorNames(emoji).join(", ")}</span>
            </div>
          ))}
        </div>
      }
      placement="top"
    >
      <button
        onClick={(ev) => { ev.stopPropagation(); /* open reactions detail sheet */ }}
        className="flex items-center gap-[3px] rounded-full border bg-[#1E1E1E] dark:bg-[#2A2A2A] border-black/5 dark:border-black shadow-[0_1px_4px_rgba(0,0,0,0.12)] px-[6px] py-[6px] transition-transform active:scale-95"
      >
        {/* Overlapping emojis */}
        <div className="flex gap-2 items-center">
          {Object.keys(counts).map((emoji, i) => (
            <span
              key={emoji}
              className="text-[13px] leading-none"
              style={{ marginLeft: i > 0 ? "-3px" : undefined }}
            >
              {emoji}
            </span>
          ))}
        </div>

        {/* Total count */}
        <span className="text-[11px] font-semibold text-[#666] dark:text-[#aaa] leading-none ml-0.5">
          {Object.values(counts).reduce((sum, c) => sum + c, 0)}
        </span>
      </button>
    </Tooltip>
  </div>
)}

              <div className="flex items-center gap-1 translate-y-0.5">
                <AnimatePresence>
                  {justCopied && (
                    <motion.span
                      initial={{ opacity: 0, x: 4 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 4 }}
                      transition={{ duration: 0.15 }}
                      className={`text-[10px] font-medium ${mine ? "text-[#151c1c]/70 dark:text-white" : "text-[#8C8C8C]"}`}
                    >
                      Copied
                    </motion.span>
                  )}
                </AnimatePresence>
                {msg.edited_at && <span className="text-[10px] !text-[#8C8C8C] italic opacity-70">edited</span>}
                <span suppressHydrationWarning className="text-[10.5px] !text-[#8C8C8C] tabular-nums">{fmtTime(msg.created_at)}</span>
                {mine && (msg._pending ? <Clock className="h-3 w-3 text-[#8C8C8C] " /> : <TickIcon status={status} className="h-3.5 w-3.5" />)}
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
        onForward={() => onForward?.()}
        onClose={() => setContextMenu({ ...contextMenu, open: false })}
      />
      
      {viewer && (
        <MediaViewer
          items={[
            {
              kind: viewer.kind,
              url: viewer.url,
              name: viewer.name,
              size: msg.file_size ?? undefined,
              date: msg.created_at,
            },
          ]}
          initialIndex={0}
          onClose={() => setViewer(null)}
        />
      )}
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
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
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
    setTranscribeError(null);
    try {
      const result = (await transcribeFn({ data: { messageId } })) as { transcript: string };
      onTranscribed?.(messageId, result.transcript);
      setShowTranscript(true);
    } catch (err) {
      console.error(err);
      setTranscribeError("Transcription failed");
    } finally {
      setTranscribing(false);
    }
  };

  const secs = Math.round(durationMs / 1000);
  const filledColor = mine ? "bg-white" : "bg-[#E07A5F]";
  const mutedColor = mine ? "bg-white/30" : "bg-[#E07A5F]/25";

  return (
    <div className="min-w-[260px] py-0.5">
      <div className="flex items-center !text-[#8C8C8C] gap-2.5">
        <button
          onClick={toggle}
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition active:scale-95 ${
            mine ? "dark:text-white hover:bg-white/25 !text-[#8C8C8C]" : "bg-[#E07A5F]/10 text-[#E07A5F] hover:bg-[#E07A5F]/15"
          }`}
        >
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
        </button>

        {!hasPlayed && (
          <span className={`h-2 w-2 shrink-0 rounded-full ${mine ? "bg-[#1E90FF] " : "bg-[#4FA6E0]"}`} />
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
            className={`absolute -bottom-0.5 -right-0.3 grid h-4 w-4 place-items-center rounded-full ring-2 ${
              mine ? "bg-[#1E1E1E] text-blue-400 ring-[#1E1E1E]" : "bg-white text-[#151c1c] ring-white dark:ring-[#2A2A2A]"
            }`}
          >
            <Mic className="h-2.5 w-2.5" />
          </span>
        </div>
      </div>

      <div className="mt-1 !text-[#8C8C8C] flex items-center justify-between pl-12 pr-1">
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleTranscribeClick}
            disabled={transcribing}
            className={`inline-flex items-center gap-1 text-[11px] font-medium ${mine ? "text-white/80" : "text-[#151c1c]"} hover:underline disabled:no-underline disabled:opacity-70`}
          >
            {transcribing && <Loader2 className="h-3 w-3 animate-spin" />}
            {transcribing ? "Transcribing…" : transcript ? (showTranscript ? "Hide transcript" : "Show transcript") : "Transcribe"}
          </button>
          {transcribeError && (
            <Tooltip title="Transcription failed">
              <CircleAlert className={`h-3.5 w-3.5 shrink-0 ${mine ? "text-[#151c1c] " : "text-[#8C8C8C ]"}`} />
            </Tooltip>
          )}
        </div>
        <span className={`text-[10px] tabular-nums ${mine ? "text-[#151c1c] " : "text-[#151c1c]"}`}>
          {String(Math.floor(secs / 60)).padStart(1, "0")}:{String(secs % 60).padStart(2, "0")}
        </span>
      </div>
      {showTranscript && transcript && (
        <p className={`mt-1.5 pl-12 pr-1 text-[12.5px] leading-snug italic ${mine ? "text-[#8C8C8C] " : "text-[#151c1c] dark:text-[#E8E8E8]"}`}>
          "{transcript}"
        </p>
      )}
    </div>
  );
}

/* ─── Composer ─── */
export function Composer({
  draft, setDraft, showEmoji, setShowEmoji, onPickImages, fileRef, onPickDocs, docRef, onSend, onVoiceUploaded, onRecordingChange,
  hasAttachments, sending, onSchedule, onPickVideo, videoRef, videoUploadPct, onCreatePoll, hideFileAttachments,
}: {
  draft: string; setDraft: (v: string) => void;
  showEmoji: boolean; setShowEmoji: (v: boolean | ((s: boolean) => boolean)) => void;
  onPickImages?: (files?: FileList | null) => void;
  fileRef?: React.RefObject<HTMLInputElement | null>;
  onPickDocs?: (files?: FileList | null) => void;
  docRef?: React.RefObject<HTMLInputElement | null>;
  onSend: () => void;
  onVoiceUploaded: (blob: Blob, durationMs: number) => void;
  onRecordingChange?: (recording: boolean) => void;
  hasAttachments?: boolean;
  sending?: boolean;
  onSchedule?: (date: Date) => void;
  onPickVideo?: (file?: File | null) => void;
  videoRef?: React.RefObject<HTMLInputElement | null>;
  videoUploadPct?: number | null;
  onCreatePoll?: () => void;
  /** When true, hides File/Image/Poll from the attach menu — used for the Sona AI chat, which reads uploads inline via Gemini instead of storing them as regular chat attachments. */
  hideFileAttachments?: boolean;
}) {
  const [showScheduler, setShowScheduler] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [scheduleValue, setScheduleValue] = useState("");
  const [isDark, setIsDark] = useState(() => typeof document !== "undefined" && document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() => setIsDark(el.classList.contains("dark")));
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  const [recording, setRecording] = useState(false);
  const [locked, setLocked] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [slideX, setSlideX] = useState(0);
  const [slideY, setSlideY] = useState(0);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cancelledRef = useRef(false);
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
    cancelledRef.current = true;
    const rec = mediaRef.current;
    if (rec) rec.stop();
    // cleanup + discarding chunks happens in onstop, once we know for sure
    // no more ondataavailable events are coming
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
        if (!cancelledRef.current && blob.size > 1000 && chunksRef.current.length > 0) {
          onVoiceUploaded(blob, dur);
        }
        chunksRef.current = [];
        cancelledRef.current = false;
        cleanupRecording();
      };
      startedRef.current = Date.now();
      rec.start();
      mediaRef.current = rec;
      startPosRef.current = { x: clientX, y: clientY };
      cancelledRef.current = false;
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
    <div className="relative chat-pattern px-4 py-6 md:px-4 md:py-3 select-none">
      {showEmoji && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setShowEmoji(false)} />
          <div
            className="relative z-40 mx-auto mb-2 max-w-3xl overflow-hidden rounded-2xl border border-[#E07A5F]/10 bg-[#FFFDF9] dark:bg-[#1E1E1E] shadow-2xl"
            style={{
              // Re-theme emoji-picker-react's own CSS variables to match
              // the app's warm accent color instead of its default blue.
              ["--epr-highlight-color" as string]: "#E07A5F",
              ["--epr-category-icon-active-color" as string]: "#E07A5F",
              ["--epr-picker-border-color" as string]: "transparent",
            } as React.CSSProperties}
          >
            <div className="flex items-center justify-between border-b border-[#E07A5F]/10 px-3 py-1.5">
              <span className="text-xs font-semibold text-[#8C8C8C]">Emoji</span>
              <button
                onClick={() => setShowEmoji(false)}
                aria-label="Close emoji picker"
                className="grid h-7 w-7 place-items-center rounded-full text-[#8C8C8C] hover:bg-[#E07A5F]/10 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <EmojiPicker
              onEmojiClick={(data: EmojiClickData) => setDraft(draft + data.emoji)}
              theme={isDark ? EmojiTheme.DARK : EmojiTheme.LIGHT}
              emojiStyle={EmojiStyle.NATIVE}
              lazyLoadEmojis
              previewConfig={{ showPreview: false }}
              width="100%"
              height={320}
              searchPlaceHolder="Search emoji"
            />
          </div>
        </>
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
                  className="w-[2px] rounded-full bg-[#1E1E1E] animate-pulse"
                  style={{
                    height: `${Math.random() * 20 + 4}px`,
                    animationDelay: `${i * 0.02}s`,
                  }}
                />
              ))}
            </div>

            <div
              className={`flex flex-col items-center gap-0.5 transition-all duration-200 shrink-0 ${
                slideY > 10 ? "opacity-100 -translate-y-1" : "opacity-50 translate-y-0"
              }`}
            >
              <Lock className="h-4 w-4 text-red-400" />
              <span className="text-[8px] text-[#E07A5F] font-medium">Slide Up</span>
            </div>
          </div>
        </div>
      )}

      {recording && locked && (
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <button
            onClick={cancelRecording}
            className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[#1E1E1E] dark:bg-zinc-800 text-white shadow-md hover:bg-[#D4694F] transition active:scale-95"
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
            className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[#1E1E1E] dark:bg-zinc-800 text-white shadow-md hover:bg-[#D4694F] transition active:scale-95"
            >
            <Check className="h-5 w-5" />
          </button>
        </div>
      )}

      {!recording && (
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <div className="flex flex-1 items-end gap-1.5 rounded-3xl bg-[#F5F0E8] dark:bg-[#2A2A2A] px-2 py-1.5 border border-[#E07A5F]/10">
            <div className="relative shrink-0 mb-0.5">
              <motion.button
                onClick={() => setShowAttachMenu((s) => !s)}
                animate={{ rotate: showAttachMenu ? 45 : 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 24 }}
                className={`grid h-10 w-10 place-items-center rounded-full transition-colors ${
                  showAttachMenu ? "bg-[#E07A5F]/15 text-[#E07A5F]" : "text-[#8C8C8C] hover:bg-[#E07A5F]/10"
                }`}
                aria-label={showAttachMenu ? "Close attachment menu" : "Add attachment"}
                aria-expanded={showAttachMenu}
              >
                <Plus className="h-5 w-5" />
              </motion.button>

              <AnimatePresence>
                {showAttachMenu && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowAttachMenu(false)} />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, y: 8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 8 }}
                      transition={{ type: "spring", stiffness: 380, damping: 28 }}
                      className="absolute bottom-full left-0 z-40 mb-3 flex items-center gap-1 rounded-2xl border border-[#E07A5F]/10 bg-white dark:bg-[#2A2A2A] p-1.5 shadow-xl origin-bottom-left"
                    >
                      {[
                        { key: "emoji", label: "Emoji", icon: <RiEmojiStickerLine className="h-5 w-5" />, onClick: () => { setShowEmoji((s) => !s); setShowAttachMenu(false); } },
                        ...(!hideFileAttachments && onPickDocs && docRef
                          ? [{ key: "doc", label: "File", icon: <Paperclip className="h-5 w-5" />, onClick: () => { docRef.current?.click(); setShowAttachMenu(false); } }]
                          : []),
                        ...(!hideFileAttachments && onPickImages && fileRef
                          ? [{ key: "image", label: "Image", icon: <ImageIcon className="h-5 w-5" />, onClick: () => { fileRef.current?.click(); setShowAttachMenu(false); } }]
                          : []),
                        ...(onPickVideo && videoRef
                          ? [{
                              key: "video",
                              label: "Video",
                              icon: videoUploadPct != null ? <Loader2 className="h-5 w-5 animate-spin" /> : <Video className="h-5 w-5" />,
                              onClick: () => { if (videoUploadPct == null) { videoRef.current?.click(); setShowAttachMenu(false); } },
                            }]
                          : []),
                        ...(!hideFileAttachments && onCreatePoll
                          ? [{
                              key: "poll",
                              label: "Poll",
                              icon: <ListChecks className="h-5 w-5" />,
                              onClick: () => { onCreatePoll(); setShowAttachMenu(false); },
                            }]
                          : []),
                      ].map((item, i) => (
                        <motion.button
                          key={item.key}
                          initial={{ opacity: 0, scale: 0.6, y: 6 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          transition={{ delay: i * 0.035, type: "spring", stiffness: 420, damping: 22 }}
                          onClick={item.onClick}
                          disabled={item.key === "video" && videoUploadPct != null}
                          aria-label={item.label}
                          title={item.label}
                          className="grid h-11 w-11 place-items-center rounded-xl text-[#8C8C8C] hover:bg-[#E07A5F]/10 hover:text-[#E07A5F] transition disabled:opacity-50"
                        >
                          {item.icon}
                        </motion.button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (!sending) onSend(); } }}
              rows={1}
              placeholder="Message"
              className="max-h-36 min-h-[40px] flex-1 resize bg-transparent text-[15px] outline-none placeholder:text-[#8C8C8C] text-[#2D3436] dark:text-[#E8E8E8] py-2 select-text"
            />

            {videoUploadPct != null && (
              <span className="mb-1 shrink-0 rounded-full bg-[#E07A5F]/10 px-2 py-1 text-[10px] font-semibold text-[#E07A5F]">
                {videoUploadPct}%
              </span>
            )}

            <input
              ref={docRef}
              type="file"
              multiple
              accept={DOC_EXTENSIONS.join(",")}
              className="hidden"
              onChange={(e) => { onPickDocs?.(e.target.files); e.target.value = ""; }}
            />
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => { onPickImages?.(e.target.files); e.target.value = ""; }}
            />
            {onPickVideo && videoRef && (
              <input
                ref={videoRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => { onPickVideo(e.target.files?.[0] ?? null); e.target.value = ""; }}
              />
            )}

            {(draft.trim() || hasAttachments) && onSchedule && (
              <div className="relative shrink-0 mb-0.5">
                <button
                  onClick={() => setShowScheduler((s) => !s)}
                  disabled={sending}
                  aria-label="Schedule message"
                  title="Schedule for later"
                  className={`grid h-10 w-10 place-items-center rounded-full transition disabled:opacity-40 ${
                    showScheduler ? "bg-[#E07A5F]/15 text-[#E07A5F]" : "text-[#8C8C8C] hover:bg-[#E07A5F]/10"
                  }`}
                >
                  <LuCalendarClock className="h-5 w-5" />
                </button>
                {showScheduler && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowScheduler(false)} />
                    <div className="absolute bottom-full right-0 z-40 mb-3 w-64 rounded-xl border border-[#E07A5F]/10 bg-white dark:bg-[#2A2A2A] p-3 shadow-xl">
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
          </div>


          {draft.trim() || hasAttachments ? (
            <button
              onClick={() => onSend()}
              disabled={sending}
              className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[#1E1E1E] dark:bg-zinc-800 text-white shadow-md hover:bg-[#D4694F] transition active:scale-95 disabled:opacity-60 disabled:active:scale-100"
            >
             <IoSend className={`h-6 w-6 ${sending? "animate-pulse" :"" } `} />
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
              className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[#1E1E1E] dark:bg-zinc-800 text-white shadow-md hover:bg-[#D4694F] transition active:scale-95"
            >
              <Mic className="h-6 w-6" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
