import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Requires an env var (server-side only — no VITE_ prefix, set in Vercel ->
// Project Settings -> Environment Variables):
//   OPENROUTER_API_KEY — same key already used by ai.functions.ts for Sona AI.
//
// Unlike a dedicated speech-to-text endpoint (e.g. OpenAI's Whisper API),
// this routes through OpenRouter's chat-completions endpoint using an
// audio-capable ("omni") model, passing the voice note as an inline
// `input_audio` content block alongside a transcription instruction —
// the same multimodal content shape OpenAI-compatible chat APIs use for
// audio input. Because this depends on a specific free-tier model rather
// than a purpose-built transcription API, accuracy/availability may be
// less consistent than Whisper — swap the model below if you hit issues.

const GATEWAY = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free";

type TranscribeInput = { messageId: string };

export const transcribeVoiceMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: TranscribeInput) => {
    if (!data?.messageId) throw new Error("messageId required");
    return { messageId: String(data.messageId) };
  })
  .handler(async ({ data, context }) => {
    const { data: message, error: msgErr } = await context.supabase
      .from("messages")
      .select("id, chat_id, kind, media_url, transcript")
      .eq("id", data.messageId)
      .maybeSingle();
    if (msgErr || !message) throw new Error("Voice message not found");
    if (message.kind !== "voice" || !message.media_url) throw new Error("Not a voice message");

    // Already transcribed — return the cached result instead of re-calling
    // the API for something we already have.
    if (message.transcript) return { transcript: message.transcript as string };

    const { data: memberRow } = await context.supabase
      .from("chat_members")
      .select("chat_id")
      .eq("chat_id", message.chat_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!memberRow) throw new Error("Forbidden: not a member of this chat");

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Transcription isn't configured on the server. Missing OPENROUTER_API_KEY — add it in Vercel's Environment Variables, then redeploy."
      );
    }

    const audioRes = await fetch(message.media_url as string);
    if (!audioRes.ok) throw new Error("Couldn't download the voice note to transcribe it.");
    const contentType = audioRes.headers.get("content-type") ?? "audio/webm";
    const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
    const base64Audio = audioBuffer.toString("base64");
    const format = contentType.includes("mp3")
      ? "mp3"
      : contentType.includes("wav")
      ? "wav"
      : contentType.includes("ogg")
      ? "ogg"
      : "webm";

    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.APP_URL || "https://your-app.vercel.app",
        "X-Title": "Sona AI",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Transcribe this audio verbatim. Reply with only the spoken words as plain text — no commentary, no quotation marks, no timestamps.",
              },
              {
                type: "input_audio",
                input_audio: { data: base64Audio, format },
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Transcription is busy right now, try again in a moment.");
      throw new Error(`Transcription failed [${res.status}]: ${body}`);
    }

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const transcript = json.choices?.[0]?.message?.content?.trim() || "(No speech detected)";

    await context.supabase.from("messages").update({ transcript }).eq("id", data.messageId);

    return { transcript };
  });
