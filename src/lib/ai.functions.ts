import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SONA_AI_ID = "00000000-0000-0000-0000-00000000a1a1";

type AskInput = { chatId: string; prompt: string };

export const askSonaAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: AskInput) => {
    if (!data?.chatId || !data?.prompt) throw new Error("chatId and prompt required");
    return { chatId: String(data.chatId), prompt: String(data.prompt).slice(0, 4000) };
  })
  .handler(async ({ data, context }) => {
    // Verify caller is a member of the chat
    const { data: memberRow, error: memberErr } = await context.supabase
      .from("chat_members")
      .select("chat_id")
      .eq("chat_id", data.chatId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (memberErr) throw memberErr;
    if (!memberRow) throw new Error("Forbidden: not a member of chat");

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    // Pull recent context (last 12 messages)
    const { data: recent } = await context.supabase
      .from("messages")
      .select("sender_id, kind, body")
      .eq("chat_id", data.chatId)
      .order("created_at", { ascending: false })
      .limit(12);

    const history = (recent ?? []).reverse().map((m) => ({
      role: m.sender_id === SONA_AI_ID ? "assistant" : "user",
      content: m.kind === "text" ? (m.body ?? "") : m.kind === "image" ? "[image]" : "[voice note]",
    }));

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "You are Sona AI, a warm, witty chat companion inside the Sona messaging app. Keep replies short, friendly, and conversational — like a good friend texting back. Use emoji sparingly.",
          },
          ...history,
          { role: "user", content: data.prompt },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Sona AI is busy right now, try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted for this workspace.");
      throw new Error(`AI request failed [${res.status}]: ${body}`);
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const reply = json.choices?.[0]?.message?.content?.trim() || "…";

    // Insert as AI (bypass RLS with admin)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: insErr } = await supabaseAdmin.from("messages").insert({
      chat_id: data.chatId,
      sender_id: SONA_AI_ID,
      kind: "text",
      body: reply,
    });
    if (insErr) throw insErr;

    return { ok: true };
  });
