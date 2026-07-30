import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Requires an env var (server-side only — no VITE_ prefix, set in Vercel ->
// Project Settings -> Environment Variables):
//   OPENAI_API_KEY — from https://platform.openai.com/api-keys
//
// Voice-note transcription needs actual speech-to-text, which the chat
// gateway used elsewhere in this app (OpenRouter, in ai.functions.ts) only
// exposes for text/chat completions, not audio. OpenAI's Whisper endpoint
// is used directly here instead.

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

    // Already transcribed — return the cached result instead of re-billing
    // the API for something we already have.
    if (message.transcript) return { transcript: message.transcript as string };

    const { data: memberRow } = await context.supabase
      .from("chat_members")
      .select("chat_id")
      .eq("chat_id", message.chat_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!memberRow) throw new Error("Forbidden: not a member of this chat");

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Transcription isn't configured on the server. Missing OPENAI_API_KEY — add it in Vercel's Environment Variables, then redeploy."
      );
    }

    const audioRes = await fetch(message.media_url as string);
    if (!audioRes.ok) throw new Error("Couldn't download the voice note to transcribe it.");
    const audioBlob = await audioRes.blob();

    const form = new FormData();
    form.append("file", audioBlob, "voice-note.webm");
    form.append("model", "whisper-1");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Transcription failed [${res.status}]: ${body}`);
    }

    const json = (await res.json()) as { text?: string };
    const transcript = (json.text ?? "").trim() || "(No speech detected)";

    await context.supabase.from("messages").update({ transcript }).eq("id", data.messageId);

    return { transcript };
  });
