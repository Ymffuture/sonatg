import { Video, Link2, PhoneMissed, Ban } from "lucide-react";
import { MdInsertPhoto } from "react-icons/md";
import { IoMdMic } from "react-icons/io";
import { FaFileLines, FaLock } from "react-icons/fa6";
import { FaPoll } from "react-icons/fa";
import type { MessageRow } from "@/lib/db";

// Call-log messages store their metadata as JSON in the file_name column
// (body stays null so MessagePreview's switch renders it, rather than the
// raw JSON, when there's no body text).
export type CallLogMeta = { kind: "voice" | "video"; outcome: "answered" | "missed" | "declined"; durationMs: number };

export function parseCallBody(raw: string | null): CallLogMeta {
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

export function fmtDuration(ms?: number | null) {
  const totalSec = Math.max(0, Math.round((ms ?? 0) / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function MessagePreview({ msg, decrypted }: { msg?: MessageRow | null; decrypted?: Record<string, string> }) {
  if (!msg) return null; // ← add this guard

  if (msg.deleted_at) {
    return <span className="italic opacity-70">Message was deleted</span>;
  }

  if (msg.is_encrypted) {
    return (
      <span className="inline-flex items-center gap-1 opacity-70">
        <FaLock className="h-4 w-4 shrink-0 text-red-500 " /> Locked
      </span>
    );
  }

  // Poll bodies store raw JSON ({"pollId": "..."}), so this must be
  // checked before the generic `msg.body` fallback below — otherwise a
  // reply/quote preview would show the JSON blob instead of "Poll".
  if (msg.kind === "poll") {
    return (
      <span className="inline-flex items-center gap-1">
        <FaPoll className="h-4 w-4 shrink-0" /> Poll
      </span>
    );
  }

  if (msg.body) {
    // A plain text message whose body is (or starts with) a link gets a
    // link-style preview, same treatment photos/videos already get. The
    // URL itself is a real clickable link — tapping it opens the page
    // directly from the preview instead of only being able to jump to
    // the original message first.
    const linkMatch = msg.body.match(/https?:\/\/\S+/i);
    if (linkMatch) {
      const url = linkMatch[0];
      return (
        <span className="inline-flex min-w-0 items-center gap-1">
          <Link2 className="h-4 w-4 shrink-0 text-[#4FA6E0]" />
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="truncate text-[#4FA6E0] underline decoration-[#4FA6E0]/40 underline-offset-2 hover:decoration-[#4FA6E0]"
          >
            {msg.body}
          </a>
        </span>
      );
    }
    return <span className="truncate">{msg.body}</span>;
  }

  switch (msg.kind) {
    case "image":
      return (
        <span className="inline-flex items-center gap-1">
          <MdInsertPhoto className="h-4 w-4 shrink-0" /> Photo
        </span>
      );
    case "voice":
      return (
        <span className="inline-flex items-center gap-1">
          <IoMdMic className="h-4 w-4 shrink-0 text-blue-500" /> Voice message ({fmtDuration(msg.duration_ms)})
        </span>
      );
    case "video":
      return (
        <span className="inline-flex items-center gap-1">
          <Video className="h-4 w-4 shrink-0" /> Video
        </span>
      );
    case "file":
      return (
        <span className="inline-flex items-center gap-1">
          <FaFileLines className="h-4 w-4 shrink-0" /> {msg.file_name || "File"}
        </span>
      );
    case "call": {
      const call = parseCallBody(msg.file_name ?? null);
      return (
        <span className="inline-flex items-center gap-1">
          {call.kind === "video" ? <Video className="h-4 w-4 shrink-0" /> : <PhoneMissed className="h-4 text-red-600 w-4 shrink-0" />}
          {call.outcome === "missed" || call.outcome === "declined"
            ? `${call.outcome === "missed" ? "Missed" : "Declined"} ${call.kind === "video" ? "video call" : "call"}`
            : `${call.kind === "video" ? "Video call" : "Voice call"} · ${fmtDuration(call.durationMs)}`}
        </span>
      );
    }
    default:
      return (<span className="flex gap-2 items-center "> <Ban className="h-4 text-red-600/10 w-4 shrink-0"/>This message was deleted</span>) ;
  }
}
