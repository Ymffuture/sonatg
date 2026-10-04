import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { askGeminiWithAttachment, urlToGeminiAttachment } from "@/lib/gemini.functions";
import { resolveModel, fallbackChain } from "@/lib/aiModels";
import { buildLiveContext, buildLiveContextWithSources } from "@/lib/liveContext";
import { stripSources, withSources } from "@/lib/sources";
import { sanitizeCoords, type Coords } from "@/lib/liveIntents";
import { consumeAiQuota, quotaExceededError } from "@/lib/aiLimits";
import { actionInstructions, detectActionIntents, extractAction, streamPreview } from "@/lib/aiActions";

const SONA_AI_ID = "00000000-0000-0000-0000-00000000a1a1";
const GATEWAY = "https://openrouter.ai/api/v1/chat/completions";

// Requests hang instead of failing outright when a free-tier model is
// overloaded — an AbortController timeout turns that into a fast, clear
// error instead of the composer spinning forever.
const GATEWAY_TIMEOUT_MS = 20_000;

type AskInput = {
  chatId: string;
  prompt: string;
  imageUrl?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  /** IANA timezone from the browser, e.g. "Africa/Johannesburg". Falls back to UTC. */
  timeZone?: string | null;
  /** Device location (from the browser) for weather questions that name no city. */
  coords?: Coords | null;
};
type SummarizeInput = { chatId: string; timeZone?: string | null };

function friendlyGatewayError(status: number, body: string): Error {
  if (status === 429) return new Error("Sona AI is busy right now, try again in a moment.");
  if (status === 402) return new Error("OpenRouter credits exhausted. Please check your account balance.");
  if (status === 404) return new Error("That AI model isn't available right now — try a different one in Settings.");
  if (status >= 500) return new Error("Sona AI's provider is having issues right now. Try again shortly.");
  return new Error(`AI request failed [${status}]: ${body.slice(0, 300)}`);
}

async function callModelOnce(messages: unknown[], key: string, model: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GATEWAY_TIMEOUT_MS);
  try {
    const res = await fetch(GATEWAY, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": process.env.APP_URL || "https://your-app.vercel.app",
        "X-Title": "Sona AI",
      },
      body: JSON.stringify({ model, messages }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw friendlyGatewayError(res.status, body);
    }

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("Sona AI's model returned an empty reply — try again.");
    return content;
  } catch (e) {
    if ((e as { name?: string })?.name === "AbortError") {
      throw new Error("Sona AI took too long to respond. Try again, or switch models in Settings.");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// Tries the caller's preferred model first; on any failure (timeout, 5xx,
// a 404 for a delisted model, or a plain network error) it falls through
// to the next model in the chain instead of surfacing the failure right
// away. The chain always ends with the shared free-tier default, so a
// Purple pick going down never fully breaks replies.
export async function callGateway(messages: unknown[], key: string, preferredModel: string): Promise<string> {
  const chain = fallbackChain(preferredModel);
  let lastError: Error | null = null;
  for (const model of chain) {
    try {
      return await callModelOnce(messages, key, model);
    } catch (e) {
      lastError = e as Error;
      // A 429 (rate limited) or 402 (out of credits) will fail identically
      // on every model behind the same key — don't burn the rest of the
      // chain's latency budget repeating a request that'll just repeat it.
      if (/busy right now|credits exhausted/i.test(lastError.message)) break;
    }
  }
  throw lastError ?? new Error("Sona AI is unavailable right now.");
}

// ─────────────────────────────────────────────────────────────────────────────
// Streaming
//
// Instead of waiting for the whole reply, we read OpenRouter's SSE stream and
// write the growing text into ONE messages row (insert on the first token,
// then throttled UPDATEs). Every client already listens to messages
// INSERT/UPDATE over Supabase Realtime, so the reply "types itself" for every
// chat member with no new transport and no change to the server-function call.
// ─────────────────────────────────────────────────────────────────────────────
const STREAM_FIRST_TOKEN_MS = 20_000; // nothing at all from the model by then -> try the next one
const STREAM_IDLE_MS = 15_000; // a stalled stream is cut and the partial reply kept
const STREAM_TOTAL_MS = 55_000; // hard cap per model attempt
const STREAM_UPDATE_MS = 700; // min gap between DB writes (Realtime + loadChats cost)

type StreamResult = { text: string; truncated: boolean };

async function callModelStreamOnce(
  messages: unknown[],
  key: string,
  model: string,
  onDelta: (full: string) => void,
): Promise<StreamResult> {
  const controller = new AbortController();
  let timer = setTimeout(() => controller.abort(), STREAM_FIRST_TOKEN_MS);
  const hardStop = setTimeout(() => controller.abort(), STREAM_TOTAL_MS);
  let full = "";
  let midError: Error | null = null;
  try {
    const res = await fetch(GATEWAY, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": process.env.APP_URL || "https://your-app.vercel.app",
        "X-Title": "Sona AI",
      },
      body: JSON.stringify({ model, messages, stream: true }),
    });
    if (!res.ok) throw friendlyGatewayError(res.status, await res.text().catch(() => ""));
    if (!res.body) throw new Error("Sona AI's provider didn't return a stream.");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        clearTimeout(timer);
        timer = setTimeout(() => controller.abort(), STREAM_IDLE_MS);
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          // Lines starting with ":" are SSE keep-alives (": OPENROUTER PROCESSING") — ignored.
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          let json: { error?: { message?: string }; choices?: Array<{ delta?: { content?: string } }> };
          try { json = JSON.parse(payload); } catch { continue; }
          if (json.error) throw new Error(json.error.message || "The model reported an error mid-reply.");
          const delta = json.choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta) {
            full += delta;
            onDelta(full);
          }
        }
      }
    } catch (e) {
      midError = e as Error; // keep whatever already streamed
    }
  } catch (e) {
    if ((e as { name?: string })?.name === "AbortError") {
      throw new Error("Sona AI took too long to respond. Try again, or switch models in Settings.");
    }
    throw e;
  } finally {
    clearTimeout(timer);
    clearTimeout(hardStop);
  }

  const text = full.trim();
  if (!text) {
    if ((midError as { name?: string } | null)?.name === "AbortError") {
      throw new Error("Sona AI took too long to respond. Try again, or switch models in Settings.");
    }
    throw midError ?? new Error("Sona AI's model returned an empty reply — try again.");
  }
  return { text, truncated: !!midError };
}

// Same fallback chain as callGateway(), but streaming. A model is only skipped
// if it fails BEFORE producing any text; once tokens have flowed we keep them.
export async function callGatewayStream(
  messages: unknown[],
  key: string,
  preferredModel: string,
  onDelta: (full: string) => void,
): Promise<StreamResult> {
  let lastError: Error | null = null;
  for (const model of fallbackChain(preferredModel)) {
    try {
      return await callModelStreamOnce(messages, key, model, onDelta);
    } catch (e) {
      lastError = e as Error;
      if (/busy right now|credits exhausted/i.test(lastError.message)) break;
    }
  }
  throw lastError ?? new Error("Sona AI is unavailable right now.");
}

// Owns the single Sona AI message row for one reply: created on the first
// visible token, throttled-updated while streaming, finalised by finish().
function createReplyStreamer(chatId: string, toBody: (raw: string) => string) {
  let messageId: string | null = null;
  let latest = "";
  let dirty = false;
  let finished = false;
  let running: Promise<void> | null = null;
  let wake: (() => void) | null = null;

  const write = async (body: string) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!messageId) {
      const { data: row, error } = await supabaseAdmin
        .from("messages")
        .insert({ chat_id: chatId, sender_id: SONA_AI_ID, kind: "text", body })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      messageId = row.id as string;
    } else {
      const { error } = await supabaseAdmin.from("messages").update({ body }).eq("id", messageId);
      if (error) throw new Error(error.message);
    }
  };

  const pump = () => {
    if (running || finished) return;
    running = (async () => {
      while (dirty && !finished) {
        dirty = false;
        const body = toBody(latest);
        if (body.trim()) {
          try { await write(body); } catch (e) { console.warn("[askSonaAI] stream update failed:", (e as Error).message); }
        }
        // Coalesce deltas for STREAM_UPDATE_MS; finish() wakes this early.
        await new Promise<void>((resolve) => { wake = resolve; setTimeout(resolve, STREAM_UPDATE_MS); });
        wake = null;
      }
    })().finally(() => { running = null; });
  };

  return {
    onDelta(full: string) { latest = full; dirty = true; pump(); },
    get messageId() { return messageId; },
    async finish(finalBody: string) {
      finished = true;
      dirty = false;
      wake?.();
      if (running) await running;
      try {
        await write(finalBody);
      } catch (e) {
        throw new Error(`Sona AI replied, but saving the message failed: ${(e as Error).message}`);
      }
    },
  };
}

// Describes a message row for the AI's chat-history context. Every kind the (dots-studio/dots-3-note-preview:free) 
// `messages` table actually supports gets a real label here — previously
// anything that wasn't "text" or "image" (i.e. "voice", "file", and "call"
// log entries) all silently fell through to being mislabeled "[voice note]".
export function describeForHistory(m: { kind: string; body?: string | null; file_name?: string | null }): string {
  switch (m.kind) {
    case "text":
      // Past AI replies carry a [[sona-sources:...]] marker — keep it out of the model's history.
      return stripSources(m.body);
    case "image":
      return "[shared an image]";
    case "voice":
      return "[voice note]";
    case "file":
      return m.file_name ? `[shared a file: ${m.file_name}]` : "[shared a file]";
    case "call":
      return "[voice/video call]";
    default:
      return "[attachment]";
  }
}

// Attachments (images/files) are now read via Gemini directly — see
// urlToGeminiAttachment in gemini.functions.ts. This gateway is only
// used for plain-text turns.

export const askSonaAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: AskInput) => {
    if (!data?.chatId || !data?.prompt) throw new Error("chatId and prompt required");
    return {
      chatId: String(data.chatId),
      prompt: String(data.prompt).slice(0, 4000),
      imageUrl: data.imageUrl ? String(data.imageUrl).slice(0, 2000) : null,
      fileUrl: data.fileUrl ? String(data.fileUrl).slice(0, 2000) : null,
      fileName: data.fileName ? String(data.fileName).slice(0, 200) : null,
      timeZone: data.timeZone ? String(data.timeZone).slice(0, 64) : null,
      coords: sanitizeCoords(data.coords),
    };
  })
  .handler(async ({ data, context }) => {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error("Missing OPENROUTER_API_KEY");

    // These three reads don't depend on each other — running them in
    // parallel instead of one-after-another is the single biggest lever
    // on time-to-first-reply for a plain @sona/chat message (saves two
    // full round trips to Supabase before the model call even starts).
    // The live-context fetch (time/date/calendar/weather/headlines) rides in
    // the same Promise.all, so it adds no extra latency on top of the reads.
    const [{ data: memberRow }, { data: myProfile }, { data: recent }, live] = await Promise.all([
      context.supabase
        .from("chat_members").select("chat_id")
        .eq("chat_id", data.chatId).eq("user_id", context.userId).maybeSingle(),
      context.supabase
        .from("profiles").select("display_name, is_pro, ai_model").eq("id", context.userId).maybeSingle(),
      context.supabase
        .from("messages")
        .select("sender_id, kind, body, media_url, file_name")
        .eq("chat_id", data.chatId)
        .order("created_at", { ascending: false })
        .limit(12),
      buildLiveContextWithSources(data.prompt, data.timeZone, data.coords),
    ]);
    if (!memberRow) throw new Error("Forbidden: not a member of chat");
    const isPro = !!myProfile?.is_pro;
    const quota = await consumeAiQuota(context.userId as string, isPro);
    if (!quota.allowed) throw quotaExceededError(quota, isPro);
    const liveContext = live.context;

    const userName = (myProfile?.display_name as string | undefined) || "friend";
    const model = resolveModel(!!myProfile?.is_pro, myProfile?.ai_model as string | null | undefined);

    const history = (recent ?? []).reverse().map((m) => ({
      role: m.sender_id === SONA_AI_ID ? "assistant" : "user",
      content: describeForHistory(m as { kind: string; body?: string | null; file_name?: string | null }),
    }));

    // Build the current turn. When there's an image or file attached, hand
    // it to Gemini directly — it reads documents/images (OCR, layout,
    // charts) more reliably than the lightweight free-tier chat model this
    // app otherwise uses for plain text. Plain text turns keep using the
    // existing OpenRouter gateway below.
    if (data.imageUrl || data.fileUrl) {
      const attachmentUrl = data.imageUrl || data.fileUrl!;
      let reply: string;
      try {
        const attachment = await urlToGeminiAttachment(attachmentUrl, data.fileName);
        reply = await askGeminiWithAttachment({
          prompt: data.prompt || "What's in this?",
          attachment,
          history: history.map((h) => ({ role: h.role === "assistant" ? "model" : "user", text: String(h.content) })),
          systemInstruction:
            `You are Sona AI, True mode, a warm, witty chat companion inside the Sona messaging app. ` +
            `The person you're chatting with is called ${userName} — greet them by name when it feels natural, but don't overdo it. ` +
            `Keep replies short, friendly, and conversational — like a good friend texting back. Use emoji sparingly.` +
            liveContext,
        });
      } catch (e) {
        throw new Error(`Sona AI couldn't read that attachment: ${(e as Error).message || "unknown error"}`);
      }

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: insErr } = await supabaseAdmin.from("messages").insert({
        chat_id: data.chatId, sender_id: SONA_AI_ID, kind: "text", body: withSources(reply, live.sources),
      });
      if (insErr) throw new Error(`Sona AI replied, but saving the message failed: ${insErr.message}`);
      return { ok: true };
    }

    const userContent: unknown = data.prompt;

    // Actions (polls, scheduled messages) are only offered to the model when the
    // user's own words asked for one — see src/lib/aiActions.ts.
    const timeZone = data.timeZone || "UTC";
    const intents = detectActionIntents(data.prompt);

    const messages = [
      {
        role: "system",
        content:
          `True mode :You are Sona AI, a warm, witty chat companion inside the Sona messaging app. ` +
          `The person you're chatting with is called ${userName} — greet them by name when it feels natural, but don't overdo it. ` +
          `Keep replies short, friendly, and conversational — like a good friend texting back. ` +
          `You can look at images and read files (PDFs, documents) the user shares, and discuss them. Use emoji sparingly.
          About Sonatg Developed and maintained by SumStack formal named Swiftmeta, the founder of this app is Kgomotso Nkosi (known as Future Ymf) ` +
          liveContext +
          actionInstructions(intents, timeZone),
      },
      ...history,
      { role: "user", content: userContent },
    ];

    const streamer = createReplyStreamer(data.chatId, streamPreview);
    const result = await callGatewayStream(messages, key, model, streamer.onDelta);

    // Pull out (and validate) any action the model proposed, then park it as
    // 'pending' — the user must tap Confirm in the chat before anything runs.
    const extracted = extractAction(result.text, { allow: intents, timeZone });
    let replyText = extracted.text;
    let actionId: string | null = null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (extracted.action) {
      const id = crypto.randomUUID();
      const { error: actErr } = await (supabaseAdmin as unknown as {
        from: (t: string) => { insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }> };
      }).from("ai_actions").insert({
        id,
        user_id: context.userId,
        chat_id: data.chatId,
        type: extracted.action.type,
        payload: extracted.action.payload,
      });
      if (actErr) {
        console.warn("[askSonaAI] couldn't store action:", actErr.message);
        replyText += "\n\n(I couldn't set that up just now — please try again.)";
      } else {
        actionId = id;
        if (!replyText.trim()) replyText = "Here's what I'd do — tap Confirm below to go ahead.";
      }
    } else if (extracted.rejected && intents.length) {
      replyText += "\n\n(I couldn't set that up — try again with the exact options, date and time.)";
    }
    if (result.truncated) replyText += " …";

    await streamer.finish(withSources(replyText, live.sources, actionId));

    if (actionId && streamer.messageId) {
      // Best effort: link the action to its message (used for tidy-up / debugging only).
      void (supabaseAdmin as unknown as {
        from: (t: string) => { update: (row: Record<string, unknown>) => { eq: (c: string, v: string) => PromiseLike<unknown> } };
      }).from("ai_actions").update({ message_id: streamer.messageId }).eq("id", actionId);
    }
    return { ok: true };
  });

export const summarizeChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: SummarizeInput) => {
    if (!data?.chatId) throw new Error("chatId required");
    return { chatId: String(data.chatId), timeZone: data.timeZone ? String(data.timeZone).slice(0, 64) : null };
  })
  .handler(async ({ data, context }) => {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error("Missing OPENROUTER_API_KEY");

    const [{ data: memberRow }, { data: myProfile }, { data: recent }] = await Promise.all([
      context.supabase
        .from("chat_members").select("chat_id")
        .eq("chat_id", data.chatId).eq("user_id", context.userId).maybeSingle(),
      context.supabase
        .from("profiles").select("is_pro, ai_model").eq("id", context.userId).maybeSingle(),
      context.supabase
        .from("messages")
        .select("sender_id, kind, body, file_name, created_at")
        .eq("chat_id", data.chatId)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    if (!memberRow) throw new Error("Forbidden: not a member of chat");
    const quota = await consumeAiQuota(context.userId as string, !!myProfile?.is_pro);
    if (!quota.allowed) throw quotaExceededError(quota, !!myProfile?.is_pro);
    const model = resolveModel(!!myProfile?.is_pro, myProfile?.ai_model as string | null | undefined);
    // Empty prompt = date/time line only (no network), so "tomorrow"/"Friday"
    // in the transcript can be resolved against the real current date.
    const liveContext = await buildLiveContext("", data.timeZone);

    const rows = (recent ?? []).reverse();
    if (rows.length === 0) return { summary: "No messages yet to summarize." };

    const memberIds = Array.from(new Set(rows.map((r) => r.sender_id as string)));
    const { data: profs } = await context.supabase
      .from("profiles").select("id, display_name").in("id", memberIds);
    const nameById: Record<string, string> = {};
    (profs ?? []).forEach((p) => { nameById[(p as { id: string }).id] = (p as { display_name: string }).display_name; });

    const transcript = rows.map((r) => {
      const who = r.sender_id === SONA_AI_ID ? "Sona AI" : (nameById[r.sender_id as string] ?? "Someone");
      const body = describeForHistory(r as { kind: string; body?: string | null; file_name?: string | null });
      return `${who}: ${body}`;
    }).join("\n");

    const summary = await callGateway([
      { role: "system", content: "You summarize chat transcripts. Return a concise TL;DR (2–4 bullet points) covering the main topics, decisions, and any open questions. Use plain text, no markdown headers." + liveContext },
      { role: "user", content: `Summarize this chat:\n\n${transcript}` },
    ], key, model);

    return { summary };
  });
