import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Requires an env var (server-side only — no VITE_ prefix, set in Vercel ->
// Project Settings -> Environment Variables):
//   OPENROUTER_API_KEY — same key already used by ai.functions.ts for Sona AI.
//
// Uses OpenRouter's dedicated /api/v1/audio/transcriptions endpoint (not
// the /chat/completions input_audio hack this used to route through) —
// purpose-built for STT, returns structured JSON with a real `usage`
// object, and lets OpenRouter pick from actual transcription-capable
// models instead of overloading a general chat model to do it.
// https://openrouter.ai/docs/guides/overview/multimodal/stt
//
// NOTE: fish-audio/s2.1-pro-free:free is a *text-to-speech* model (see
// tts.functions.ts) — it has no transcription capability and doesn't
// appear under OpenRouter's `output_modalities=transcription` filter, so
// it can't be used here. Whisper Large V3 Turbo is the closest free-tier
// equivalent: cheap, fast, and accurate. Override via STT_MODEL if you'd
// rather use a different transcription model.

const TRANSCRIBE_ENDPOINT = "https://openrouter.ai/api/v1/audio/transcriptions";
const MODEL = process.env.STT_MODEL || "openai/whisper-large-v3-turbo";
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

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Transcription isn't configured on the server. Missing OPENROUTER_API_KEY — add it in Vercel's Environment Variables, then redeploy."
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

    const base64Audio = audioBuffer.toString("base64");
    const format = contentType.includes("mp3")
      ? "mp3"
      : contentType.includes("wav")
      ? "wav"
      : contentType.includes("ogg")
      ? "ogg"
      : "webm";

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TRANSCRIBE_TIMEOUT_MS);
    let transcript: string;
    try {
      const res = await fetch(TRANSCRIBE_ENDPOINT, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": process.env.APP_URL || "https://your-app.vercel.app",
          "X-Title": "Sona AI",
        },
        body: JSON.stringify({
          model: MODEL,
          input_audio: { data: base64Audio, format },
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        if (res.status === 429) throw new Error("Transcription is busy right now, try again in a moment.");
        if (res.status === 402) throw new Error("OpenRouter credits exhausted. Please check your account balance.");
        throw new Error(`Transcription failed [${res.status}]: ${body.slice(0, 300)}`);
      }

      const json = (await res.json()) as { text?: string };
      transcript = json.text?.trim() || "(No speech detected)";
    } catch (e) {
      if ((e as { name?: string })?.name === "AbortError") {
        throw new Error("Transcription took too long — the voice note may be too long. Try a shorter clip.");
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }

    const { error: updateErr } = await context.supabase
      .from("messages").update({ transcript }).eq("id", data.messageId);
    if (updateErr) throw new Error(`Transcribed, but saving the result failed: ${updateErr.message}`);

    return { transcript };
  });

