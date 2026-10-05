// src/lib/groqTranscribe.ts
//
// Speech-to-text through Groq's Whisper API, using plain fetch (no SDK, so
// nothing extra to install and no lockfile surprises). Pure logic only — no env
// vars, no Supabase — so it can be unit-tested against a fake server.
//
//   POST https://api.groq.com/openai/v1/audio/transcriptions   (OpenAI-compatible)
//   Free tier: 25 MB per file; limits are tracked PER MODEL, which is why we fall
//   back from whisper-large-v3 to whisper-large-v3-turbo when one is rate-limited.

export const GROQ_TRANSCRIBE_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
export const GROQ_MAX_BYTES = 25 * 1024 * 1024;
export const DEFAULT_STT_MODELS = ["whisper-large-v3", "whisper-large-v3-turbo"] as const;

export type TranscribeErrorCode = "auth" | "rate_limit" | "too_large" | "bad_audio" | "timeout" | "upstream";

/** `message` is safe to show to the user; `detail` is for server logs only. */
export class TranscribeError extends Error {
  code: TranscribeErrorCode;
  detail?: string;
  constructor(code: TranscribeErrorCode, message: string, detail?: string) {
    super(message);
    this.name = "TranscribeError";
    this.code = code;
    this.detail = detail;
  }
}

// ── audio format detection ───────────────────────────────────────────────────
// Browsers disagree: Chrome/Android record WebM/Opus, Safari/iOS record MP4/AAC,
// and the stored Content-Type (or the ".webm" the app puts on every file name)
// can be wrong. Groq decides how to decode from the file name, so we trust the
// BYTES first.

export type AudioFormat = { ext: "webm" | "ogg" | "wav" | "flac" | "mp3" | "m4a"; mime: string };

const FORMATS: Record<AudioFormat["ext"], AudioFormat> = {
  webm: { ext: "webm", mime: "audio/webm" },
  ogg: { ext: "ogg", mime: "audio/ogg" },
  wav: { ext: "wav", mime: "audio/wav" },
  flac: { ext: "flac", mime: "audio/flac" },
  mp3: { ext: "mp3", mime: "audio/mpeg" },
  m4a: { ext: "m4a", mime: "audio/mp4" },
};

function ascii(b: Uint8Array, from: number, to: number): string {
  let s = "";
  for (let i = from; i < Math.min(to, b.length); i++) s += String.fromCharCode(b[i]);
  return s;
}

function sniff(b: Uint8Array): AudioFormat | null {
  if (b.length < 12) return null;
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return FORMATS.webm; // EBML (WebM/Matroska)
  if (ascii(b, 0, 4) === "OggS") return FORMATS.ogg;
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WAVE") return FORMATS.wav;
  if (ascii(b, 0, 4) === "fLaC") return FORMATS.flac;
  if (ascii(b, 4, 8) === "ftyp") return FORMATS.m4a; // MP4 / M4A (iOS Safari)
  if (ascii(b, 0, 3) === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return FORMATS.mp3;
  return null;
}

export function detectAudioFormat(bytes: Uint8Array, contentType?: string | null, url?: string | null): AudioFormat {
  const sniffed = sniff(bytes);
  if (sniffed) return sniffed;

  const ct = (contentType ?? "").toLowerCase();
  if (ct.includes("webm")) return FORMATS.webm;
  if (ct.includes("ogg") || ct.includes("opus")) return FORMATS.ogg;
  if (ct.includes("wav")) return FORMATS.wav;
  if (ct.includes("flac")) return FORMATS.flac;
  if (ct.includes("mpeg") || ct.includes("mp3")) return FORMATS.mp3;
  if (ct.includes("mp4") || ct.includes("m4a") || ct.includes("aac")) return FORMATS.m4a;

  const path = (() => { try { return new URL(url ?? "").pathname.toLowerCase(); } catch { return ""; } })();
  for (const ext of Object.keys(FORMATS) as Array<AudioFormat["ext"]>) {
    if (path.endsWith(`.${ext}`)) return FORMATS[ext];
  }
  return FORMATS.webm;
}

/** True when the first bytes look like text (an HTML/JSON error page) rather than audio. */
export function looksLikeText(bytes: Uint8Array): boolean {
  const head = ascii(bytes, 0, 1).trim();
  return head === "<" || head === "{" || head === "[";
}

// ── SSRF guard ───────────────────────────────────────────────────────────────
// `media_url` is a column a chat member can write, and the server downloads it.
// Only ever fetch our own Supabase Storage objects.

export function isAllowedMediaUrl(raw: string, supabaseUrl?: string | null): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.username || u.password) return false;
  if (!u.pathname.startsWith("/storage/v1/object/")) return false;

  let ours: URL | null = null;
  try { ours = supabaseUrl ? new URL(supabaseUrl) : null; } catch { /* ignore */ }
  if (ours && u.origin === ours.origin) return true; // also covers local `supabase start` over http
  return u.protocol === "https:" && u.hostname.endsWith(".supabase.co");
}

// ── silence / hallucination guard ────────────────────────────────────────────
// Whisper invents text ("Thank you.") for silence. verbose_json reports how
// likely each segment is to be non-speech; if EVERY segment is, call it silence.

type Segment = { no_speech_prob?: number; avg_logprob?: number };

export function looksLikeSilence(text: string, segments?: Segment[]): boolean {
  if (!text.trim()) return true;
  if (!segments?.length) return false;
  return segments.every((s) => {
    const nsp = s.no_speech_prob ?? 0;
    const lp = s.avg_logprob ?? 0;
    return nsp > 0.8 || (nsp > 0.6 && lp < -1);
  });
}

// ── the API call ─────────────────────────────────────────────────────────────

export type TranscribeOptions = {
  apiKey: string;
  audio: Uint8Array;
  format: AudioFormat;
  /** Tried in order; a model is skipped when it is rate-limited, down, or retired. */
  models?: readonly string[];
  /** ISO-639-1 code (e.g. "en"). Omit to auto-detect. */
  language?: string | null;
  /** Per-attempt timeout. */
  timeoutMs?: number;
  /** Stop starting new attempts after this long overall. */
  deadlineMs?: number;
  endpoint?: string;
  fetchImpl?: typeof fetch;
};

export type TranscribeResult = { text: string; model: string; noSpeech: boolean; language?: string };

function upstreamMessage(body: string): string {
  try {
    const j = JSON.parse(body) as { error?: { message?: string } };
    return j.error?.message ?? body.slice(0, 300);
  } catch {
    return body.slice(0, 300);
  }
}

export async function transcribeWithGroq(opts: TranscribeOptions): Promise<TranscribeResult> {
  const {
    apiKey,
    audio,
    format,
    language,
    timeoutMs = 25_000,
    deadlineMs = 40_000,
    endpoint = GROQ_TRANSCRIBE_URL,
    fetchImpl = fetch,
  } = opts;
  const models = [...new Set((opts.models?.length ? opts.models : DEFAULT_STT_MODELS).filter(Boolean))];

  if (audio.byteLength > GROQ_MAX_BYTES) {
    throw new TranscribeError("too_large", "That voice note is too large to transcribe (the limit is 25 MB).");
  }
  if (audio.byteLength < 200) {
    throw new TranscribeError("bad_audio", "That voice note is empty or too short to transcribe.");
  }

  const started = Date.now();
  let last: TranscribeError | null = null;

  for (const model of models) {
    if (last && Date.now() - started > deadlineMs - 5_000) break; // not enough time for another try

    const form = new FormData();
    form.append("file", new Blob([audio as BlobPart], { type: format.mime }), `voice.${format.ext}`);
    form.append("model", model);
    form.append("response_format", "verbose_json"); // gives per-segment confidence for the silence check
    form.append("temperature", "0");
    if (language) form.append("language", language);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        signal: controller.signal,
      });

      if (!res.ok) {
        const detail = upstreamMessage(await res.text().catch(() => ""));
        if (res.status === 401 || res.status === 403) {
          throw new TranscribeError("auth", "Voice transcription isn't set up correctly on the server (Groq rejected the API key).", detail);
        }
        if (res.status === 413) {
          throw new TranscribeError("too_large", "That voice note is too large to transcribe (the limit is 25 MB).", detail);
        }
        if (res.status === 429) {
          last = new TranscribeError("rate_limit", "Transcription is busy right now — try again in a moment.", detail);
          continue; // another model has its own limit bucket
        }
        if (res.status === 404 || (res.status === 400 && /model/i.test(detail) && /(not found|decommission|does not exist|not supported|deprecat)/i.test(detail))) {
          last = new TranscribeError("upstream", "Transcription is temporarily unavailable.", `model ${model}: ${detail}`);
          continue;
        }
        if (res.status === 400 || res.status === 415 || res.status === 422) {
          throw new TranscribeError("bad_audio", "Couldn't read that voice note's audio.", detail);
        }
        last = new TranscribeError("upstream", "Transcription is temporarily unavailable. Try again in a moment.", `HTTP ${res.status}: ${detail}`);
        continue;
      }

      const json = (await res.json()) as { text?: string; language?: string; segments?: Segment[] };
      const text = (json.text ?? "").trim();
      return { text, model, noSpeech: looksLikeSilence(text, json.segments), language: json.language };
    } catch (e) {
      if (e instanceof TranscribeError) {
        if (e.code === "auth" || e.code === "too_large" || e.code === "bad_audio") throw e;
        last = e;
      } else if ((e as { name?: string })?.name === "AbortError") {
        last = new TranscribeError("timeout", "Transcription took too long — the voice note may be too long. Try a shorter clip.", `model ${model}: timeout`);
      } else {
        last = new TranscribeError("upstream", "Couldn't reach the transcription service. Try again in a moment.", (e as Error)?.message);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw last ?? new TranscribeError("upstream", "Transcription is unavailable right now.");
}
