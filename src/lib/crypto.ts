// Client-side AES-GCM encryption for hidden chats.
// Passcode never leaves the device; key derived via PBKDF2.

const enc = new TextEncoder();
const dec = new TextDecoder();

async function deriveKey(passcode: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    "raw",
    enc.encode(passcode),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 120_000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function b64(bytes: Uint8Array): string {
  let s = ""; bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
}
function b64d(str: string): Uint8Array {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Cached keys per chat (in memory only) so we don't re-derive on every message.
const keyCache = new Map<string, CryptoKey>();

export async function unlockChat(chatId: string, passcode: string): Promise<void> {
  const salt = enc.encode(`sona:${chatId}`);
  const key = await deriveKey(passcode, salt);
  keyCache.set(chatId, key);
}
export function lockChat(chatId: string): void { keyCache.delete(chatId); }
export function isUnlocked(chatId: string): boolean { return keyCache.has(chatId); }

export async function encryptBody(chatId: string, plaintext: string): Promise<string | null> {
  const key = keyCache.get(chatId);
  if (!key) return null;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plaintext)));
  return `v1:${b64(iv)}:${b64(ct)}`;
}
export async function decryptBody(chatId: string, payload: string): Promise<string | null> {
  const key = keyCache.get(chatId);
  if (!key) return null;
  const parts = payload.split(":");
  if (parts.length !== 3 || parts[0] !== "v1") return null;
  try {
    const iv = b64d(parts[1]);
    const ct = b64d(parts[2]);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
    return dec.decode(pt);
  } catch { return null; }
}
