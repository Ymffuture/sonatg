// ─── Per-chat draft persistence ────────────────────────────────
// Keeps an unsent message from being lost if you switch chats, close the
// tab, or the send fails (e.g. no network) — same idea as WhatsApp/Slack
// remembering what you were mid-typing. Scoped per chat id in
// localStorage; failures (private browsing, storage disabled, quota) are
// swallowed since a draft is a nice-to-have, never worth crashing over.

const draftKey = (chatId: string) => `sona:draft:${chatId}`;

export function saveDraftToStorage(chatId: string, text: string) {
  try {
    if (text) localStorage.setItem(draftKey(chatId), text);
    else localStorage.removeItem(draftKey(chatId));
  } catch { /* storage unavailable — draft just won't persist, not fatal */ }
}

export function loadDraftFromStorage(chatId: string): string {
  try {
    return localStorage.getItem(draftKey(chatId)) ?? "";
  } catch {
    return "";
  }
}

export function clearDraftFromStorage(chatId: string) {
  try { localStorage.removeItem(draftKey(chatId)); } catch { /* no-op */ }
}
