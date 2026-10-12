// src/lib/zego.functions.ts
// Issues short-lived Zego call tokens from the SERVER. The Zego server secret never
// leaves the server (previously it was shipped to every browser as VITE_ZEGO_SERVER_SECRET).
//
// Vercel env vars (server-only, NO VITE_ prefix):
//   ZEGO_APP_ID          your Zego AppID (a number)
//   ZEGO_SERVER_SECRET   your Zego ServerSecret (32 chars)  ← rotate the old leaked one first!
//
// What a token allows: joining ONE room, as the signed-in user, for 1 hour, and only if that
// room is a live call_sessions row in a chat the user belongs to.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { enforceRateLimit } from "@/lib/rateLimit";

const TOKEN_LIFETIME_SECONDS = 60 * 60;
const ROOM_ID_RE = /^[A-Za-z0-9_\-]{1,128}$/;

// Zego "token04": "04" + base64(expire | ivLen | iv | cipherLen | AES-CBC(json)).
async function generateToken04(appId: number, userId: string, secret: string, roomId: string): Promise<string> {
  const { createCipheriv, randomBytes, randomInt } = await import("node:crypto");
  const algorithm =
    secret.length === 16 ? "aes-128-cbc" : secret.length === 24 ? "aes-192-cbc" : secret.length === 32 ? "aes-256-cbc" : null;
  if (!algorithm) throw new Error("ZEGO_SERVER_SECRET must be 16, 24 or 32 characters.");

  const now = Math.floor(Date.now() / 1000);
  const expire = now + TOKEN_LIFETIME_SECONDS;
  const info = {
    app_id: appId,
    user_id: userId,
    nonce: randomInt(1, 2 ** 31 - 1),
    ctime: now,
    expire,
    // Lock the token to this room; privilege 1 = login, 2 = publish stream.
    payload: JSON.stringify({ room_id: roomId, privilege: { 1: 1, 2: 1 }, stream_id_list: null }),
  };

  const iv = randomBytes(8).toString("hex"); // 16 characters
  const cipher = createCipheriv(algorithm, secret, iv);
  const encrypted = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(info))), cipher.final()]);

  const head = Buffer.alloc(8);
  head.writeBigInt64BE(BigInt(expire), 0);
  const ivLen = Buffer.alloc(2);
  ivLen.writeUInt16BE(iv.length, 0);
  const cipherLen = Buffer.alloc(2);
  cipherLen.writeUInt16BE(encrypted.length, 0);

  return "04" + Buffer.concat([head, ivLen, Buffer.from(iv), cipherLen, encrypted]).toString("base64");
}

type TokenInput = { chatId: string; roomId: string };

export const getZegoCallToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: TokenInput) => {
    const chatId = String(data?.chatId ?? "");
    const roomId = String(data?.roomId ?? "");
    if (!chatId) throw new Error("chatId required");
    if (!ROOM_ID_RE.test(roomId)) throw new Error("Invalid call room");
    return { chatId, roomId };
  })
  .handler(async ({ data, context }) => {
    await enforceRateLimit(context.supabase, "call-token", 30, 60);

    // Only members of the chat may get a token for a call in it.
    const { data: member } = await context.supabase
      .from("chat_members")
      .select("chat_id")
      .eq("chat_id", data.chatId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!member) throw new Error("Forbidden: not a member of this chat");

    // The room must be a real, un-ended call in THIS chat that started in the last 4 hours.
    // (RLS also limits this lookup to calls in chats the caller belongs to.)
    const since = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    const { data: session } = await (context.supabase as unknown as { from: (t: string) => any })
      .from("call_sessions")
      .select("id")
      .eq("id", data.roomId)
      .eq("chat_id", data.chatId)
      .is("ended_at", null)
      .gte("created_at", since)
      .maybeSingle();
    if (!session) throw new Error("Forbidden: this call isn't available");

    const appId = Number(process.env.ZEGO_APP_ID);
    const secret = process.env.ZEGO_SERVER_SECRET;
    if (!appId || !secret) throw new Error("Call service not configured.");

    // The Zego user id is always the signed-in user — the client can't pick someone else's.
    const token = await generateToken04(appId, context.userId, secret, data.roomId);
    return { appId, token, userId: context.userId };
  });
