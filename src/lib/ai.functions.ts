import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { askGeminiWithAttachment, urlToGeminiAttachment } from "@/lib/gemini.functions";

const SONA_AI_ID = "00000000-0000-0000-0000-00000000a1a1";
const GATEWAY = "https://openrouter.ai/api/v1/chat/completions";

type AskInput = {
  chatId: string;
  prompt: string;
  imageUrl?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
};
type SummarizeInput = { chatId: string };

async function callGateway(messages: unknown[], key: string): Promise<string> {
  // const model = process.env.AI_MODEL || "inclusionai/ling-3.0-flash:free";
const model = "nvidia/nemotron-3.5-lightning:free" || "nvidia/nemotron-3-ultra-550b-a55b:free" 
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "HTTP-Referer": process.env.APP_URL || "https://your-app.vercel.app",
      "X-Title": "Sona AI",
    },
    body: JSON.stringify({
      model,
      messages,
      // Optional: route to specific provider or enable fallbacks
      // provider: { order: ["OpenAI", "Anthropic"] },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("Sona AI is busy right now, try again in a moment.");
    if (res.status === 402) throw new Error("OpenRouter credits exhausted. Please check your account balance.");
    throw new Error(`AI request failed [${res.status}]: ${body}`);
  }

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content?.trim() || "…";
}

// Describes a message row for the AI's chat-history context. Every kind the (dots-studio/dots-3-note-preview:free) 
// `messages` table actually supports gets a real label here — previously
// anything that wasn't "text" or "image" (i.e. "voice", "file", and "call"
// log entries) all silently fell through to being mislabeled "[voice note]".
function describeForHistory(m: { kind: string; body?: string | null; file_name?: string | null }): string {
  switch (m.kind) {
    case "text":
      return m.body ?? "";
    case "image":
      return "[shared an image]";
    case "voice":
      return "[voice note]";
    case "file":
      return m.file_name ? `[shared a file: ${m.file_name}]` : "[shared a file]";
    case "call":
      return "[voice/video call]";
    default:
      return "[attachment]";
  }
}

// Attachments (images/files) are now read via Gemini directly — see
// urlToGeminiAttachment in gemini.functions.ts. This gateway is only
// used for plain-text turns.

export const askSonaAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: AskInput) => {
    if (!data?.chatId || !data?.prompt) throw new Error("chatId and prompt required");
    return {
      chatId: String(data.chatId),
      prompt: String(data.prompt).slice(0, 4000),
      imageUrl: data.imageUrl ? String(data.imageUrl).slice(0, 2000) : null,
      fileUrl: data.fileUrl ? String(data.fileUrl).slice(0, 2000) : null,
      fileName: data.fileName ? String(data.fileName).slice(0, 200) : null,
    };
  })
  .handler(async ({ data, context }) => {
    const { data: memberRow } = await context.supabase
      .from("chat_members").select("chat_id")
      .eq("chat_id", data.chatId).eq("user_id", context.userId).maybeSingle();
    if (!memberRow) throw new Error("Forbidden: not a member of chat");

    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error("Missing OPENROUTER_API_KEY");

    // Personalize with the user's display name
    const { data: myProfile } = await context.supabase
      .from("profiles").select("display_name").eq("id", context.userId).maybeSingle();
    const userName = (myProfile?.display_name as string | undefined) || "friend";

    const { data: recent } = await context.supabase
      .from("messages")
      .select("sender_id, kind, body, media_url, file_name")
      .eq("chat_id", data.chatId)
      .order("created_at", { ascending: false })
      .limit(12);

    const history = (recent ?? []).reverse().map((m) => ({
      role: m.sender_id === SONA_AI_ID ? "assistant" : "user",
      content: describeForHistory(m as { kind: string; body?: string | null; file_name?: string | null }),
    }));

    // Build the current turn. When there's an image or file attached, hand
    // it to Gemini directly — it reads documents/images (OCR, layout,
    // charts) more reliably than the lightweight free-tier chat model this
    // app otherwise uses for plain text. Plain text turns keep using the
    // existing OpenRouter gateway below.
    if (data.imageUrl || data.fileUrl) {
      const attachmentUrl = data.imageUrl || data.fileUrl!;
      const attachment = await urlToGeminiAttachment(attachmentUrl, data.fileName);
      const reply = await askGeminiWithAttachment({
        prompt: data.prompt || "What's in this?",
        attachment,
        history: history.map((h) => ({ role: h.role === "assistant" ? "model" : "user", text: String(h.content) })),
        systemInstruction:
          `You are Sona AI, a warm, witty chat companion inside the Sona messaging app. ` +
          `The person you're chatting with is called ${userName} — greet them by name when it feels natural, but don't overdo it. ` +
          `Keep replies short, friendly, and conversational — like a good friend texting back. Use emoji sparingly.`,
      });

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: insErr } = await supabaseAdmin.from("messages").insert({
        chat_id: data.chatId, sender_id: SONA_AI_ID, kind: "text", body: reply,
      });
      if (insErr) throw insErr;
      return { ok: true };
    }

    const userContent: unknown = data.prompt;

    const messages = [
      {
        role: "system",
        content:
          `You are Sona AI, a warm, witty chat companion inside the Sona messaging app. ` +
          `The person you're chatting with is called ${userName} — greet them by name when it feels natural, but don't overdo it. ` +
          `Keep replies short, friendly, and conversational — like a good friend texting back. ` +
          `You can look at images and read files (PDFs, documents) the user shares, and discuss them. Use emoji sparingly.
          About Sonatg Developed and maintained by Swiftmeta, the founder of this app is Kgomotso Nkosi (known as Future Ymf) `,
      },
      ...history,
      { role: "user", content: userContent },
    ];

    const reply = await callGateway(messages, key);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: insErr } = await supabaseAdmin.from("messages").insert({
      chat_id: data.chatId, sender_id: SONA_AI_ID, kind: "text", body: reply,
    });
    if (insErr) throw insErr;
    return { ok: true };
  });

export const summarizeChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: SummarizeInput) => {
    if (!data?.chatId) throw new Error("chatId required");
    return { chatId: String(data.chatId) };
  })
  .handler(async ({ data, context }) => {
    const { data: memberRow } = await context.supabase
      .from("chat_members").select("chat_id")
      .eq("chat_id", data.chatId).eq("user_id", context.userId).maybeSingle();
    if (!memberRow) throw new Error("Forbidden: not a member of chat");

    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error("Missing OPENROUTER_API_KEY");

    const { data: recent } = await context.supabase
      .from("messages")
      .select("sender_id, kind, body, file_name, created_at")
      .eq("chat_id", data.chatId)
      .order("created_at", { ascending: false })
      .limit(100);

    const rows = (recent ?? []).reverse();
    if (rows.length === 0) return { summary: "No messages yet to summarize." };

    const memberIds = Array.from(new Set(rows.map((r) => r.sender_id as string)));
    const { data: profs } = await context.supabase
      .from("profiles").select("id, display_name").in("id", memberIds);
    const nameById: Record<string, string> = {};
    (profs ?? []).forEach((p) => { nameById[(p as { id: string }).id] = (p as { display_name: string }).display_name; });

    const transcript = rows.map((r) => {
      const who = r.sender_id === SONA_AI_ID ? "Sona AI" : (nameById[r.sender_id as string] ?? "Someone");
      const body = describeForHistory(r as { kind: string; body?: string | null; file_name?: string | null });
      return `${who}: ${body}`;
    }).join("\n");

    const summary = await callGateway([
      { role: "system", content: "You summarize chat transcripts. Return a concise TL;DR (2–4 bullet points) covering the main topics, decisions, and any open questions. Use plain text, no markdown headers." },
      { role: "user", content: `Summarize this chat:\n\n${transcript}` },
    ], key);

    return { summary };
  });
