import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { cached } from "@/lib/ttlCache";
import {
  DEFAULT_STT_MODELS,
  GROQ_MAX_BYTES,
  TranscribeError,
  detectAudioFormat,
  isAllowedMediaUrl,
  looksLikeText,
  transcribeWithGroq,
} from "@/lib/groqTranscribe";

// Voice-note transcription via Groq Whisper (see src/lib/groqTranscribe.ts).
//
// Server-side env vars (Vercel -> Project Settings -> Environment Variables):
//   GROQ_API_KEY   required. Free key: https://console.groq.com/keys
//   STT_MODEL      optional. Tried first; default "whisper-large-v3". If it is rate-limited or
//                  unavailable we automatically fall back to "whisper-large-v3-turbo".
//   STT_LANGUAGE   optional ISO-639-1 code (e.g. "en", "af"). Default: auto-detect.

const DOWNLOAD_TIMEOUT_MS = 15_000;
const NO_SPEECH_TEXT = "(No speech detected)";

// Groq's free quota is shared by the whole app, so one user can't burn it all:
// at most this many transcriptions per user per window, per server instance.
const USER_LIMIT = 20;
const USER_WINDOW_MS = 10 * 60_000;
const recent = new Map<string, number[]>();

function takeUserSlot(userId: string): boolean {
  const now = Date.now();
  const list = (recent.get(userId) ?? []).filter((t) => now - t < USER_WINDOW_MS);
  if (list.length >= USER_LIMIT) {
    recent.set(userId, list);
    return false;
  }
  list.push(now);
  recent.set(userId, list);
  if (recent.size > 5000) for (const [k, v] of recent) if (!v.some((t) => now - t < USER_WINDOW_MS)) recent.delete(k);
  return true;
}

async function download(url: string): Promise<{ bytes: Uint8Array; contentType: string | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    // redirect:"error" — our storage URLs never redirect, and a redirect could point anywhere.
    const res = await fetch(url, { signal: controller.signal, redirect: "error" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > GROQ_MAX_BYTES) {
      throw new TranscribeError("too_large", "That voice note is too large to transcribe (the limit is 25 MB).");
    }
    return { bytes: new Uint8Array(await res.arrayBuffer()), contentType: res.headers.get("content-type") };
  } catch (e) {
    if (e instanceof TranscribeError) throw e;
    throw new Error(`Couldn't download the voice note to transcribe it: ${(e as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}

type TranscribeInput = { messageId: string };

export const transcribeVoiceMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: TranscribeInput) => {
    if (!data?.messageId) throw new Error("messageId required");
    return { messageId: String(data.messageId) };
  })
  .handler(async ({ data, context }) => {
    // RLS: only messages in chats the caller belongs to are visible here.
    const { data: message, error: msgErr } = await context.supabase
      .from("messages")
      .select("id, chat_id, kind, media_url, transcript")
      .eq("id", data.messageId)
      .maybeSingle();
    if (msgErr || !message) throw new Error("Voice message not found");
    if (message.kind !== "voice" || !message.media_url) throw new Error("Not a voice message");

    // Already transcribed — return the cached result instead of calling the API again.
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
      console.error("[transcribe] GROQ_API_KEY is not set");
      throw new Error("Voice transcription isn't set up on the server yet (missing GROQ_API_KEY).");
    }

    const mediaUrl = message.media_url as string;
    if (!isAllowedMediaUrl(mediaUrl, process.env.SUPABASE_URL)) {
      throw new Error("This voice note can't be transcribed (its file isn't stored in Sona's media storage).");
    }

    // Two people tapping "Transcribe" on the same note share ONE Groq call.
    const transcript = await cached(`stt:${message.id}`, 0, async () => {
      if (!takeUserSlot(context.userId as string)) {
        throw new Error("You're transcribing a lot of voice notes — please wait a few minutes and try again.");
      }

      const { bytes, contentType } = await download(mediaUrl);
      if (looksLikeText(bytes)) {
        throw new Error("The voice note's file link is no longer valid, so it can't be transcribed.");
      }
      const format = detectAudioFormat(bytes, contentType, mediaUrl);

      const language = /^[a-z]{2,3}$/i.test(process.env.STT_LANGUAGE ?? "") ? process.env.STT_LANGUAGE!.toLowerCase() : null;
      const models = [process.env.STT_MODEL, ...DEFAULT_STT_MODELS].filter((m): m is string => !!m);

      try {
        const result = await transcribeWithGroq({ apiKey, audio: bytes, format, models, language });
        return result.noSpeech ? NO_SPEECH_TEXT : result.text;
      } catch (e) {
        if (e instanceof TranscribeError) {
          if (e.detail) console.error(`[transcribe] ${e.code}: ${e.detail}`);
          throw new Error(e.message);
        }
        throw e;
      }
    });

    // Save with the service role: the messages UPDATE policy only lets the SENDER edit a message,
    // so with the caller's own client a recipient's transcript would silently never be stored
    // (and every tap would spend more of the free quota). Membership was verified above, and this
    // only ever writes the transcript column of a message that has none.
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: updateErr } = await supabaseAdmin
        .from("messages")
        .update({ transcript })
        .eq("id", message.id)
        .is("transcript", null);
      if (updateErr) console.error("[transcribe] couldn't save transcript:", updateErr.message);
    } catch (e) {
      console.error("[transcribe] couldn't save transcript:", (e as Error).message);
    }

    return { transcript };
  });
