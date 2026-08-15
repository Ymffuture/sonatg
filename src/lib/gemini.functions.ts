// src/lib/gemini.functions.ts
// Reads images and documents (PDFs, slides, etc.) shared with Sona AI
// using Google's Gemini API directly, instead of routing attachments
// through the general OpenRouter chat model. Gemini is meaningfully
// stronger at document/image understanding (OCR, layout, charts) than
// the lightweight free-tier chat model used for plain text turns, so
// this is called only when the current turn actually has an attachment
// — plain text conversation still goes through the existing OpenRouter
// gateway in ai.functions.ts.
//
// Not exposed as its own createServerFn — it's a plain server-side
// helper imported by askSonaAI's handler, which already carries the
// auth/membership checks for the request.

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export interface GeminiAttachment {
  base64: string; // raw base64, no "data:...;base64," prefix
  mimeType: string;
  /** Original filename, used only to give Gemini a hint for non-image files. */
  fileName?: string | null;
}

export interface GeminiChatTurn {
  role: "user" | "model";
  text: string;
}

/**
 * Downloads a URL and returns it split into base64 + content-type, ready
 * for Gemini's inline_data part (which wants raw base64, unlike OpenRouter's
 * data: URI convention).
 */
export async function urlToGeminiAttachment(url: string, fileName?: string | null): Promise<GeminiAttachment> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Couldn't download attachment [${res.status}]`);
  const mimeType = res.headers.get("content-type") ?? "application/octet-stream";
  const buffer = Buffer.from(await res.arrayBuffer());
  return { base64: buffer.toString("base64"), mimeType, fileName };
}

/**
 * Sends a prompt plus one image/file attachment to Gemini and returns its
 * text reply. Kept model-agnostic via env var so the deployment can swap
 * gemini-2.0-flash for a different Gemini model without a code change.
 */
export async function askGeminiWithAttachment(params: {
  prompt: string;
  attachment: GeminiAttachment;
  history?: GeminiChatTurn[];
  systemInstruction?: string;
}): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Missing GEMINI_API_KEY");

  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";

  const contents = [
    ...(params.history ?? []).map((turn) => ({
      role: turn.role,
      parts: [{ text: turn.text }],
    })),
    {
      role: "user",
      parts: [
        { text: params.prompt || "What's in this?" },
        { inline_data: { mime_type: params.attachment.mimeType, data: params.attachment.base64 } },
      ],
    },
  ];

  const res = await fetch(`${GEMINI_ENDPOINT}/${model}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      ...(params.systemInstruction
        ? { system_instruction: { parts: [{ text: params.systemInstruction }] } }
        : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("Gemini is busy right now, try again in a moment.");
    throw new Error(`Gemini request failed [${res.status}]: ${body}`);
  }

  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
  return text || "I looked at that, but couldn't come up with a reply — try asking again?";
}
