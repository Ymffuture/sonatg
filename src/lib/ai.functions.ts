import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { askGeminiWithAttachment, urlToGeminiAttachment } from "@/lib/gemini.functions";
import { resolveModel, fallbackChain } from "@/lib/aiModels";

const SONA_AI_ID = "00000000-0000-0000-0000-00000000a1a1";
const GATEWAY = "https://openrouter.ai/api/v1/chat/completions";

// Requests hang instead of failing outright when a free-tier model is
// overloaded — an AbortController timeout turns that into a fast, clear
// error instead of the composer spinning forever.
const GATEWAY_TIMEOUT_MS = 20_000;

type AskInput = {
  chatId: string;
  prompt: string;
  imageUrl?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
};
type SummarizeInput = { chatId: string };

function friendlyGatewayError(status: number, body: string): Error {
  if (status === 429) return new Error("Sona AI is busy right now, try again in a moment.");
  if (status === 402) return new Error("OpenRouter credits exhausted. Please check your account balance.");
  if (status === 404) return new Error("That AI model isn't available right now — try a different one in Settings.");
  if (status >= 500) return new Error("Sona AI's provider is having issues right now. Try again shortly.");
  return new Error(`AI request failed [${status}]: ${body.slice(0, 300)}`);
}

async function callModelOnce(messages: unknown[], key: string, model: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GATEWAY_TIMEOUT_MS);
  try {
    const res = await fetch(GATEWAY, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": process.env.APP_URL || "https://your-app.vercel.app",
        "X-Title": "Sona AI",
      },
      body: JSON.stringify({ model, messages }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw friendlyGatewayError(res.status, body);
    }

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("Sona AI's model returned an empty reply — try again.");
    return content;
  } catch (e) {
    if ((e as { name?: string })?.name === "AbortError") {
      throw new Error("Sona AI took too long to respond. Try again, or switch models in Settings.");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// Tries the caller's preferred model first; on any failure (timeout, 5xx,
// a 404 for a delisted model, or a plain network error) it falls through
// to the next model in the chain instead of surfacing the failure right
// away. The chain always ends with the shared free-tier default, so a
// Purple pick going down never fully breaks replies.
async function callGateway(messages: unknown[], key: string, preferredModel: string): Promise<string> {
  const chain = fallbackChain(preferredModel);
  let lastError: Error | null = null;
  for (const model of chain) {
    try {
      return await callModelOnce(messages, key, model);
    } catch (e) {
      lastError = e as Error;
      // A 429 (rate limited) or 402 (out of credits) will fail identically
      // on every model behind the same key — don't burn the rest of the
      // chain's latency budget repeating a request that'll just repeat it.
      if (/busy right now|credits exhausted/i.test(lastError.message)) break;
    }
  }
  throw lastError ?? new Error("Sona AI is unavailable right now.");
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
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error("Missing OPENROUTER_API_KEY");

    // These three reads don't depend on each other — running them in
    // parallel instead of one-after-another is the single biggest lever
    // on time-to-first-reply for a plain @sona/chat message (saves two
    // full round trips to Supabase before the model call even starts).
    const [{ data: memberRow }, { data: myProfile }, { data: recent }] = await Promise.all([
      context.supabase
        .from("chat_members").select("chat_id")
        .eq("chat_id", data.chatId).eq("user_id", context.userId).maybeSingle(),
      context.supabase
        .from("profiles").select("display_name, is_pro, ai_model").eq("id", context.userId).maybeSingle(),
      context.supabase
        .from("messages")
        .select("sender_id, kind, body, media_url, file_name")
        .eq("chat_id", data.chatId)
        .order("created_at", { ascending: false })
        .limit(12),
    ]);
    if (!memberRow) throw new Error("Forbidden: not a member of chat");

    const userName = (myProfile?.display_name as string | undefined) || "friend";
    const model = resolveModel(!!myProfile?.is_pro, myProfile?.ai_model as string | null | undefined);

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
      let reply: string;
      try {
        const attachment = await urlToGeminiAttachment(attachmentUrl, data.fileName);
        reply = await askGeminiWithAttachment({
          prompt: data.prompt || "What's in this?",
          attachment,
          history: history.map((h) => ({ role: h.role === "assistant" ? "model" : "user", text: String(h.content) })),
          systemInstruction:
            `You are Sona AI, a warm, witty chat companion inside the Sona messaging app. ` +
            `The person you're chatting with is called ${userName} — greet them by name when it feels natural, but don't overdo it. ` +
            `Keep replies short, friendly, and conversational — like a good friend texting back. Use emoji sparingly.`,
        });
      } catch (e) {
        throw new Error(`Sona AI couldn't read that attachment: ${(e as Error).message || "unknown error"}`);
      }

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: insErr } = await supabaseAdmin.from("messages").insert({
        chat_id: data.chatId, sender_id: SONA_AI_ID, kind: "text", body: reply,
      });
      if (insErr) throw new Error(`Sona AI replied, but saving the message failed: ${insErr.message}`);
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

    const reply = await callGateway(messages, key, model);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: insErr } = await supabaseAdmin.from("messages").insert({
      chat_id: data.chatId, sender_id: SONA_AI_ID, kind: "text", body: reply,
    });
    if (insErr) throw new Error(`Sona AI replied, but saving the message failed: ${insErr.message}`);
    return { ok: true };
  });

export const summarizeChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: SummarizeInput) => {
    if (!data?.chatId) throw new Error("chatId required");
    return { chatId: String(data.chatId) };
  })
  .handler(async ({ data, context }) => {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error("Missing OPENROUTER_API_KEY");

    const [{ data: memberRow }, { data: myProfile }, { data: recent }] = await Promise.all([
      context.supabase
        .from("chat_members").select("chat_id")
        .eq("chat_id", data.chatId).eq("user_id", context.userId).maybeSingle(),
      context.supabase
        .from("profiles").select("is_pro, ai_model").eq("id", context.userId).maybeSingle(),
      context.supabase
        .from("messages")
        .select("sender_id, kind, body, file_name, created_at")
        .eq("chat_id", data.chatId)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    if (!memberRow) throw new Error("Forbidden: not a member of chat");
    const model = resolveModel(!!myProfile?.is_pro, myProfile?.ai_model as string | null | undefined);

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
    ], key, model);

    return { summary };
  });
