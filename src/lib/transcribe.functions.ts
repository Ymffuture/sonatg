import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import Groq from "groq-sdk";

// Requires an env var (server-side only — no VITE_ prefix, set in Vercel ->
// Project Settings -> Environment Variables):
//   GROQ_API_KEY — get a free key at https://console.groq.com
//
// Uses Groq's Whisper Large V3 for free-tier transcription.
// Fast, accurate, and has an ongoing free rate-limited tier.
// Override via STT_MODEL if you'd rather use a different model
// (e.g. "whisper-large-v3-turbo").

const MODEL = process.env.STT_MODEL || "whisper-large-v3";
const TRANSCRIBE_TIMEOUT_MS = 30_000;

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

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Transcription isn't configured on the server. Missing GROQ_API_KEY — add it in Vercel's Environment Variables, then redeploy."
      );
    }

    let audioBuffer: Buffer;
    let contentType: string;
    try {
      const audioRes = await fetch(message.media_url as string);
      if (!audioRes.ok) throw new Error(`HTTP ${audioRes.status}`);
      contentType = audioRes.headers.get("content-type") ?? "audio/webm";
      audioBuffer = Buffer.from(await audioRes.arrayBuffer());
    } catch (e) {
      throw new Error(`Couldn't download the voice note to transcribe it: ${(e as Error).message}`);
    }

    // Determine a sensible filename + mime for Groq
    const ext = contentType.includes("mp3")
      ? "mp3"
      : contentType.includes("wav")
        ? "wav"
        : contentType.includes("ogg")
          ? "ogg"
          : contentType.includes("m4a")
            ? "m4a"
            : "webm";
    const mime = contentType.split(";")[0].trim() || `audio/${ext}`;

    const groq = new Groq({ apiKey });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TRANSCRIBE_TIMEOUT_MS);

    let transcript: string;
    try {
      const file = new File([audioBuffer], `voice.${ext}`, { type: mime });

      const result = await groq.audio.transcriptions.create(
        {
          file,
          model: MODEL,
          response_format: "text",
          temperature: 0,
        },
        { signal: controller.signal as any },
      );

      // Groq returns a string when response_format is "text"
      transcript =
        (typeof result === "string" ? result : (result as any)?.text)?.trim() ||
        "(No speech detected)";
    } catch (e: any) {
      if (e?.name === "AbortError" || controller.signal.aborted) {
        throw new Error(
          "Transcription took too long — the voice note may be too long. Try a shorter clip.",
        );
      }
      if (e?.status === 429 || /rate limit/i.test(e?.message || "")) {
        throw new Error("Transcription is busy right now, try again in a moment.");
      }
      throw new Error(`Transcription failed: ${e?.message || "Unknown error"}`);
    } finally {
      clearTimeout(timer);
    }

    const { error: updateErr } = await context.supabase
      .from("messages")
      .update({ transcript })
      .eq("id", data.messageId);
    if (updateErr) throw new Error(`Transcribed, but saving the result failed: ${updateErr.message}`);

    return { transcript };
  });
