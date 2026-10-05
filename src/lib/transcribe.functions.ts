import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Speech-to-text via Fish Audio's dedicated ASR endpoint (fish.audio).
// POST https://api.fish.audio/v1/asr with the audio as a multipart form
// field named "audio"; returns JSON with a `text` field.
// Server-side env var: FISH_API_KEY (from fish.audio/app).
const ASR_ENDPOINT = "https://api.fish.audio/v1/asr";
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

    const apiKey = process.env.FISH_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Transcription isn't configured on the server. Missing FISH_API_KEY — add it in the server environment, then redeploy."
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

    const ext = contentType.includes("mp3")
      ? "mp3"
      : contentType.includes("wav")
      ? "wav"
      : contentType.includes("ogg")
      ? "ogg"
      : "webm";

    const form = new FormData();
    form.append("audio", new Blob([new Uint8Array(audioBuffer)], { type: contentType }), `voice.${ext}`);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TRANSCRIBE_TIMEOUT_MS);
    let transcript: string;
    try {
      const res = await fetch(ASR_ENDPOINT, {
        method: "POST",
        signal: controller.signal,
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        if (res.status === 429) throw new Error("Transcription is busy right now, try again in a moment.");
        if (res.status === 402 || res.status === 401 || res.status === 403)
          throw new Error("Fish Audio rejected the request — check the FISH_API_KEY and account balance.");
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
