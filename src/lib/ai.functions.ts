import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SONA_AI_ID = "00000000-0000-0000-0000-00000000a1a1";
const GATEWAY = "https://openrouter.ai/api/v1/chat/completions";

type AskInput = { chatId: string; prompt: string; imageUrl?: string | null };
type SummarizeInput = { chatId: string };

async function callGateway(messages: unknown[], key: string): Promise<string> {
  const model = process.env.AI_MODEL || "openai/gpt-4o-mini";
  
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

export const askSonaAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: AskInput) => {
    if (!data?.chatId || !data?.prompt) throw new Error("chatId and prompt required");
    return {
      chatId: String(data.chatId),
      prompt: String(data.prompt).slice(0, 4000),
      imageUrl: data.imageUrl ? String(data.imageUrl).slice(0, 2000) : null,
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
      .select("sender_id, kind, body, media_url")
      .eq("chat_id", data.chatId)
      .order("created_at", { ascending: false })
      .limit(12);

    const history = (recent ?? []).reverse().map((m) => ({
      role: m.sender_id === SONA_AI_ID ? "assistant" : "user",
      content: m.kind === "text" ? (m.body ?? "") : m.kind === "image" ? "[shared an image]" : "[voice note]",
    }));

    // Build the current turn — multimodal if an image is attached
    const userContent: unknown = data.imageUrl
      ? [
          { type: "text", text: data.prompt || "What's in this image?" },
          { type: "image_url", image_url: { url: data.imageUrl } },
        ]
      : data.prompt;

    const messages = [
      {
        role: "system",
        content:
          `You are Sona AI, a warm, witty chat companion inside the Sona messaging app. ` +
          `The person you're chatting with is called ${userName} — greet them by name when it feels natural, but don't overdo it. ` +
          `Keep replies short, friendly, and conversational — like a good friend texting back. ` +
          `You can look at images the user shares and describe or discuss them. Use emoji sparingly.`,
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
      .select("sender_id, kind, body, created_at")
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
      const body = r.kind === "text" ? (r.body ?? "") : r.kind === "image" ? "[image]" : "[voice note]";
      return `${who}: ${body}`;
    }).join("\n");

    const summary = await callGateway([
      { role: "system", content: "You summarize chat transcripts. Return a concise TL;DR (2–4 bullet points) covering the main topics, decisions, and any open questions. Use plain text, no markdown headers." },
      { role: "user", content: `Summarize this chat:\n\n${transcript}` },
    ], key);

    return { summary };
  });
