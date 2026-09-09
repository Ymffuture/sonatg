import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Sona Purple text-to-speech, via OpenRouter's dedicated speech endpoint
// (NOT /chat/completions — /audio/speech is purpose-built for TTS, returns
// raw audio bytes directly instead of a base64 blob wrapped in JSON).
// https://openrouter.ai/docs/guides/overview/multimodal/tts
const SPEECH_ENDPOINT = "https://openrouter.ai/api/v1/audio/speech";
const MODEL = "fish-audio/s2.1-pro-free:free";

// fish-audio requires an explicit voice id (no provider-side default) —
// pick one from https://fish.audio/app/discovery, open it, and use
// "Copy Model Id" in its "…" menu. Override via FISH_AUDIO_VOICE_ID so
// this doesn't need a code change to swap voices.
const DEFAULT_VOICE_ID = process.env.FISH_AUDIO_VOICE_ID || "";

const TTS_TIMEOUT_MS = 20_000;
const MAX_CHARS = 2000; // fish-audio bills per input character — keep a single request bounded

type SpeakInput = { chatId: string; text: string };

export const synthesizeSpeech = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: SpeakInput) => {
    if (!data?.chatId || !data?.text) throw new Error("chatId and text required");
    return { chatId: String(data.chatId), text: String(data.text).slice(0, MAX_CHARS) };
  })
  .handler(async ({ data, context }) => {
    // Purple-only: gate right at the top, before spending a Supabase round trip.
    const { data: myProfile } = await context.supabase
      .from("profiles").select("is_pro").eq("id", context.userId).maybeSingle();
    if (!myProfile?.is_pro) {
      throw new Error("Text-to-speech is a Sona Purple feature — upgrade in Settings → Subscription.");
    }

    const { data: memberRow } = await context.supabase
      .from("chat_members").select("chat_id")
      .eq("chat_id", data.chatId).eq("user_id", context.userId).maybeSingle();
    if (!memberRow) throw new Error("Forbidden: not a member of chat");

    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error("Missing OPENROUTER_API_KEY");
    if (!DEFAULT_VOICE_ID) {
      throw new Error(
        "Text-to-speech isn't configured on the server. Missing FISH_AUDIO_VOICE_ID — pick a voice at fish.audio/app/discovery, add its id in Vercel's Environment Variables, then redeploy."
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS);
    try {
      const res = await fetch(SPEECH_ENDPOINT, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
          "HTTP-Referer": process.env.APP_URL || "https://your-app.vercel.app",
          "X-Title": "Sona AI",
        },
        body: JSON.stringify({
          model: MODEL,
          input: data.text,
          voice: DEFAULT_VOICE_ID,
          response_format: "mp3",
        }),
      });

      if (!res.ok) {
        // Non-200 responses on /audio/speech are JSON, not audio.
        const body = await res.text().catch(() => "");
        if (res.status === 429) throw new Error("Sona voice is busy right now, try again in a moment.");
        if (res.status === 402) throw new Error("OpenRouter credits exhausted. Please check your account balance.");
        throw new Error(`Text-to-speech failed [${res.status}]: ${body.slice(0, 300)}`);
      }

      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length === 0) throw new Error("Text-to-speech returned an empty audio clip — try again.");
      return { audioBase64: buffer.toString("base64"), mimeType: "audio/mpeg" };
    } catch (e) {
      if ((e as { name?: string })?.name === "AbortError") {
        throw new Error("Text-to-speech took too long to respond. Try again in a moment.");
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  });
