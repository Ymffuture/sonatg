// src/lib/messageIntelligence.functions.ts
//
// Backend for the "Ask Sona" message-intelligence feature. Given a single
// message the user selected in a chat, this runs one focused AI action
// against it (explain / suggest a reply / rewrite / translate / summarize /
// extract info / a free-form question) and returns the result to the panel
// that triggered it — it never writes anything back into the chat, so this
// is a pure read-side feature with zero risk of polluting the conversation.
//
// Reuses the same OpenRouter gateway, model-resolution, and auth middleware
// as ai.functions.ts so behavior (timeouts, fallback chain, error copy)
// stays identical across every Sona AI surface.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callGateway, describeForHistory } from "@/lib/ai.functions";
import { resolveModel } from "@/lib/aiModels";
import { SONA_AI_ID } from "@/lib/db";

export type MessageIntelAction =
  "explain" | "suggest_reply" | "rewrite" | "translate" | "summarize" | "extract" | "ask";

export type RewriteTone = "professional" | "casual" | "clear" | "concise";

type MessageIntelInput = {
  chatId: string;
  messageId: string;
  action: MessageIntelAction;
  /** Only used for action === "rewrite". */
  tone?: RewriteTone;
  /** Only used for action === "translate". */
  language?: string;
  /** Only used for action === "ask" — the user's custom question. */
  question?: string;
  /** Whether to pull a few nearby messages in for extra context. Off by default. */
  useContext?: boolean;
};

const MAX_CONTEXT_MESSAGES = 6; // 3 before + 3 after — deliberately small and bounded
const REWRITE_TONES: RewriteTone[] = ["professional", "casual", "clear", "concise"];

function contentOf(m: {
  kind: string;
  body: string | null;
  transcript?: string | null;
  file_name?: string | null;
}): string | null {
  if (m.kind === "text" && m.body) return m.body;
  if (m.kind === "voice" && m.transcript) return m.transcript;
  return null;
}

function instructionFor(input: {
  action: MessageIntelAction;
  tone?: RewriteTone;
  language?: string;
  question?: string;
}): string {
  switch (input.action) {
    case "explain":
      return "Explain what this message means, plainly and briefly (1-3 sentences). Surface any implied ask, tone, or subtext a reader might miss.";
    case "suggest_reply":
      return "Suggest exactly 3 short, natural reply options for the recipient to send back. Vary them (e.g. accept / decline-or-alternative / clarify), keep each under 20 words, and return them as a plain numbered list with nothing else before or after.";
    case "rewrite": {
      const tone = input.tone && REWRITE_TONES.includes(input.tone) ? input.tone : "clear";
      const toneCopy: Record<RewriteTone, string> = {
        professional: "Rewrite it in a professional, polished tone suitable for work.",
        casual: "Rewrite it in a relaxed, casual, friendly tone.",
        clear: "Rewrite it so the meaning is as clear and unambiguous as possible.",
        concise: "Rewrite it to be as short and concise as possible while keeping the meaning.",
      };
      return `${toneCopy[tone]} Return only the rewritten message, nothing else.`;
    }
    case "translate": {
      const lang = (input.language || "English").trim().slice(0, 60);
      return `Translate this message into ${lang}. Return only the translation, nothing else.`;
    }
    case "summarize":
      return "Summarize this message in 1-2 short sentences, keeping only the essential point.";
    case "extract":
      return "Extract any concrete details from this message: dates, times, names, tasks/action items, locations, links, and other important specifics. Return a short bulleted list grouped by category. If nothing concrete is present, say so in one line.";
    case "ask":
      return (
        (input.question || "").trim().slice(0, 500) ||
        "Answer the user's question about this message as best you can."
      );
    default:
      return "Help the user understand this message.";
  }
}

export const askSonaAboutMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: MessageIntelInput) => {
    if (!data?.chatId || !data?.messageId || !data?.action) {
      throw new Error("chatId, messageId, and action are required");
    }
    return {
      chatId: String(data.chatId),
      messageId: String(data.messageId),
      action: data.action,
      tone: data.tone,
      language: data.language ? String(data.language).slice(0, 60) : undefined,
      question: data.question ? String(data.question).slice(0, 500) : undefined,
      useContext: !!data.useContext,
    };
  })
  .handler(async ({ data, context }) => {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error("Missing OPENROUTER_API_KEY");

    // Membership + target message + my profile can all be fetched in parallel —
    // none of them depend on each other.
    const [{ data: memberRow }, { data: myProfile }, { data: target }] = await Promise.all([
      context.supabase
        .from("chat_members")
        .select("chat_id")
        .eq("chat_id", data.chatId)
        .eq("user_id", context.userId)
        .maybeSingle(),
      context.supabase
        .from("profiles")
        .select("is_pro, ai_model")
        .eq("id", context.userId)
        .maybeSingle(),
      context.supabase
        .from("messages")
        .select("id, chat_id, sender_id, kind, body, transcript, file_name, deleted_at, created_at")
        .eq("id", data.messageId)
        .maybeSingle(),
    ]);

    // Chat-membership boundary: never analyze a message from a chat the caller isn't in.
    if (!memberRow) throw new Error("Forbidden: not a member of chat");
    if (!target || target.chat_id !== data.chatId)
      throw new Error("That message couldn't be found in this chat.");
    if (target.deleted_at) throw new Error("This message was deleted and can't be analyzed.");

    // Respect block boundaries in both directions — Sona shouldn't be a
    // backdoor for reading a blocked contact's messages either.
    if (target.sender_id !== context.userId && target.sender_id !== SONA_AI_ID) {
      const { data: blockRow } = await context.supabase
        .from("blocks")
        .select("blocker_id")
        .or(
          `and(blocker_id.eq.${context.userId},blocked_id.eq.${target.sender_id}),and(blocker_id.eq.${target.sender_id},blocked_id.eq.${context.userId})`,
        )
        .maybeSingle();
      if (blockRow) throw new Error("Sona can't analyze messages between blocked contacts.");
    }

    const content = contentOf(
      target as { kind: string; body: string | null; transcript?: string | null },
    );
    if (!content) {
      throw new Error(
        "Sona can only work with text messages (or voice notes that have been transcribed) right now.",
      );
    }

    // Optional, intentionally small window of surrounding context — never
    // the whole conversation. Only pulled when the action explicitly asks
    // for it (e.g. "who is this person talking about?").
    let contextBlock = "";
    if (data.useContext) {
      const [{ data: before }, { data: after }] = await Promise.all([
        context.supabase
          .from("messages")
          .select("sender_id, kind, body, transcript, file_name, created_at")
          .eq("chat_id", data.chatId)
          .lt("created_at", target.created_at)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(MAX_CONTEXT_MESSAGES / 2),
        context.supabase
          .from("messages")
          .select("sender_id, kind, body, transcript, file_name, created_at")
          .eq("chat_id", data.chatId)
          .gt("created_at", target.created_at)
          .is("deleted_at", null)
          .order("created_at", { ascending: true })
          .limit(MAX_CONTEXT_MESSAGES / 2),
      ]);
      const surrounding = [...(before ?? []).reverse(), ...(after ?? [])];
      if (surrounding.length) {
        const senderIds = Array.from(new Set(surrounding.map((r) => r.sender_id as string)));
        const { data: profs } = await context.supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", senderIds);
        const nameById: Record<string, string> = {};
        (profs ?? []).forEach((p) => {
          nameById[(p as { id: string }).id] = (p as { display_name: string }).display_name;
        });
        contextBlock = surrounding
          .map(
            (r) =>
              `${r.sender_id === SONA_AI_ID ? "Sona AI" : (nameById[r.sender_id as string] ?? "Someone")}: ${describeForHistory(r as { kind: string; body?: string | null; file_name?: string | null })}`,
          )
          .join("\n");
      }
    }

    const model = resolveModel(
      !!myProfile?.is_pro,
      myProfile?.ai_model as string | null | undefined,
    );
    const instruction = instructionFor({
      action: data.action,
      tone: data.tone,
      language: data.language,
      question: data.question,
    });

    const userTurn = contextBlock
      ? `Nearby conversation for context (do not analyze this directly, only use it to understand the selected message):\n${contextBlock}\n\nSelected message: "${content}"\n\n${instruction}`
      : `Selected message: "${content}"\n\n${instruction}`;

    const messages = [
      {
        role: "system",
        content:
          "You are Sona AI's message-intelligence assistant, embedded inline in a single chat message inside the Sona messaging app. " +
          "You are given exactly one selected message (and optionally a little surrounding context) and one instruction. " +
          "Follow the instruction precisely and concisely — output only what was asked for, no preamble, no meta-commentary, no 're-stating the task'.",
      },
      { role: "user", content: userTurn },
    ];

    const reply = await callGateway(messages, key, model);
    return { result: reply, action: data.action };
  });
