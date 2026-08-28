import type { MessageRow, Profile } from "@/lib/db";
import { fmtDateLabel } from "@/lib/db";
import type { ChatWithMeta } from "@/utils/utils";

export type TranscriptEntry = {
  sender: string;
  timestamp: string; // ISO
  kind: MessageRow["kind"];
  text: string; // human-readable content, or a bracketed label for media
  deleted: boolean;
  edited: boolean;
};

function contentLabel(m: MessageRow, decrypted?: Record<string, string>): string {
  if (m.deleted_at) return "This message was deleted";
  if (m.is_encrypted) return decrypted?.[m.id] ?? "[Locked message — open the chat to decrypt before exporting]";
  switch (m.kind) {
    case "image": return m.body ? `[Photo] ${m.body}` : "[Photo]";
    case "video": return m.body ? `[Video] ${m.body}` : "[Video]";
    case "voice": return `[Voice message${m.duration_ms ? `, ${Math.round(m.duration_ms / 1000)}s` : ""}]`;
    case "file": return `[File: ${m.file_name ?? "attachment"}]`;
    case "call": return "[Call]";
    default: return m.body ?? "";
  }
}

export function buildTranscript(
  messages: MessageRow[],
  profilesById: Record<string, Profile>,
  meId: string,
  decrypted?: Record<string, string>,
): TranscriptEntry[] {
  return messages.map((m) => ({
    sender: m.sender_id === meId ? "You" : profilesById[m.sender_id]?.display_name ?? "Unknown",
    timestamp: m.created_at,
    kind: m.kind,
    text: contentLabel(m, decrypted),
    deleted: !!m.deleted_at,
    edited: !!m.edited_at,
  }));
}

function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportChatAsJSON(chat: ChatWithMeta, entries: TranscriptEntry[]) {
  const payload = {
    chat: chat.title || "Direct message",
    exported_at: new Date().toISOString(),
    message_count: entries.length,
    messages: entries,
  };
  const safeName = (chat.title || "chat").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  triggerDownload(JSON.stringify(payload, null, 2), `sona-${safeName}-${Date.now()}.json`, "application/json");
}

// PDF export uses the browser's native print-to-PDF flow (a hidden
// print-formatted window + window.print()) rather than bundling a PDF
// library — no new dependency, works in every modern browser, and lets
// the person choose "Save as PDF" from the OS print dialog.
export function exportChatAsPDF(chat: ChatWithMeta, entries: TranscriptEntry[]) {
  const title = chat.title || "Sona chat";
  const rows = entries.map((e) => {
    const time = new Date(e.timestamp).toLocaleString();
    const style = e.deleted ? 'style="color:#8C8C8C;font-style:italic;"' : "";
    const escaped = e.text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return `
      <div class="msg">
        <div class="meta"><span class="sender">${e.sender}</span> · <span class="time">${time}</span>${e.edited ? ' <span class="tag">(edited)</span>' : ""}</div>
        <div class="text" ${style}>${escaped}</div>
      </div>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${title} — Sona chat export</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #2D3436; padding: 24px; max-width: 720px; margin: 0 auto; }
  h1 { font-size: 18px; margin-bottom: 4px; }
  .subtitle { color: #8C8C8C; font-size: 12px; margin-bottom: 24px; }
  .msg { padding: 10px 0; border-bottom: 1px solid #eee; }
  .meta { font-size: 11px; color: #8C8C8C; margin-bottom: 3px; }
  .sender { font-weight: 600; color: #E07A5F; }
  .tag { font-style: italic; }
  .text { font-size: 13.5px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <h1>${title}</h1>
  <div class="subtitle">Exported from Sona on ${new Date().toLocaleString()} · ${entries.length} messages</div>
  ${rows}
</body>
</html>`;

  const printWindow = window.open("", "_blank", "width=800,height=900");
  if (!printWindow) {
    throw new Error("Pop-up blocked — allow pop-ups for this site to export as PDF");
  }
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
  };
}
