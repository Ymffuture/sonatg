import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Search, MoreVertical, Paperclip, Smile, Send, Mic, ArrowLeft, Moon, Sun,
  Image as ImageIcon, Plus, X, LogOut, Play, Pause, Trash2, SmilePlus,
  Check, CheckCheck, MessageSquarePlus, Settings, Shield, Sparkles, Lock, Unlock,
  Ban, Reply, Pencil, Crown, Users, Bell,
} from "lucide-react";

import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { askSonaAI, summarizeChat } from "@/lib/ai.functions";
import {
  SONA_AI_ID, fmtTime,
  type ChatRow, type MessageRow, type Profile, type ReactionRow, type MessageReadRow,
  type BlockRow,
} from "@/lib/db";
import { encryptBody, decryptBody, unlockChat, isUnlocked, lockChat } from "@/lib/crypto";
import { toast } from "sonner";
import sonaLogo from "@/assets/sona-logo.png";
import sonaAi from "@/assets/sona-ai.png";

type ChatWithMeta = ChatRow & {
  memberIds: string[];
  members: Profile[];
  lastMessage?: MessageRow;
  unread: number;
};

function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("sona-theme") : null;
    const t = stored === "dark" || stored === "light"
      ? stored
      : window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    setTheme(t as "light" | "dark");
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("sona-theme", theme);
  }, [theme]);
  return { theme, toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")) };
}

const EMOJIS = ["😀","😂","🥲","😍","😎","🤔","🙌","👍","🔥","🎉","❤️","✨","🥂","📷","🙏","😴"];
const REACT_EMOJIS = ["❤️","😂","👍","🔥","😮","🙏"];

function Avatar({ url, name, size = 40, ai = false }: { url?: string | null; name: string; size?: number; ai?: boolean }) {
  if (ai) return <img src={sonaAi} alt="Sona AI" width={size} height={size} loading="lazy" style={{ width: size, height: size }} className="rounded-full object-cover shrink-0 bg-white" />;
  const src = url || `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=AEE4FF&textColor=1F2937`;
  return <img src={src} alt={name} loading="lazy" style={{ width: size, height: size }} className="rounded-full object-cover shrink-0" />;
}

function chatTitle(c: ChatWithMeta, meId: string) {
  if (c.title && c.is_group) return c.title;
  const other = c.members.find((m) => m.id !== meId);
  if (other?.is_ai) return "Sona AI";
  return other?.display_name || c.title || "Chat";
}
function chatAvatarUrl(c: ChatWithMeta, meId: string) {
  const other = c.members.find((m) => m.id !== meId);
  return other?.avatar_url ?? null;
}
function isAIChat(c: ChatWithMeta) {
  return c.memberIds.includes(SONA_AI_ID);
}

export default function SonaChat() {
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const askAI = useServerFn(askSonaAI);
  const askSummary = useServerFn(summarizeChat);

  const [me, setMe] = useState<Profile | null>(null);
  const [chats, setChats] = useState<ChatWithMeta[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [reactions, setReactions] = useState<ReactionRow[]>([]);
  const [reads, setReads] = useState<MessageReadRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [showSidebarMobile, setShowSidebarMobile] = useState(true);
  const [showNewChat, setShowNewChat] = useState(false);
  const [reactingOn, setReactingOn] = useState<string | null>(null);
  const [typingOthers, setTypingOthers] = useState<string[]>([]);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [summary, setSummary] = useState<string | null>(null);
  const [needsUnlock, setNeedsUnlock] = useState(false);
  const [decrypted, setDecrypted] = useState<Record<string, string>>({});
  const [replyTo, setReplyTo] = useState<MessageRow | null>(null);
  const [editing, setEditing] = useState<MessageRow | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingChanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Bootstrap: current user + profile
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { navigate({ to: "/auth" }); return; }
      const { data: p } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
      if (p) setMe(p as Profile);
    })();
  }, [navigate]);

  // Load chats + members + latest messages + unread counts
  const loadChats = useCallback(async () => {
    if (!me) return;
    const { data: memberships } = await supabase
      .from("chat_members").select("chat_id").eq("user_id", me.id);
    const chatIds = (memberships ?? []).map((m: { chat_id: string }) => m.chat_id);
    if (chatIds.length === 0) { setChats([]); return; }

    const { data: chatRows } = await supabase
      .from("chats").select("*").in("id", chatIds).order("last_message_at", { ascending: false });
    const { data: allMembers } = await supabase
      .from("chat_members").select("chat_id, user_id").in("chat_id", chatIds);
    const memberIds = Array.from(new Set((allMembers ?? []).map((m: { user_id: string }) => m.user_id)));
    const { data: profs } = await supabase.from("profiles").select("*").in("id", memberIds);

    const profMap: Record<string, Profile> = {};
    (profs ?? []).forEach((p) => { profMap[(p as Profile).id] = p as Profile; });
    setProfiles((prev) => ({ ...prev, ...profMap }));

    // recent messages across my chats (for previews + unread)
    const { data: latest } = await supabase
      .from("messages").select("*").in("chat_id", chatIds).order("created_at", { ascending: false }).limit(500);
    const rows = (latest ?? []) as MessageRow[];
    const lastByChat: Record<string, MessageRow> = {};
    rows.forEach((m) => { if (!lastByChat[m.chat_id]) lastByChat[m.chat_id] = m; });

    // my reads for those messages
    const msgIds = rows.map((m) => m.id);
    let myReadSet = new Set<string>();
    if (msgIds.length) {
      const { data: myReads } = await supabase.from("message_reads")
        .select("message_id").eq("user_id", me.id).in("message_id", msgIds);
      myReadSet = new Set((myReads ?? []).map((r: { message_id: string }) => r.message_id));
    }
    const unreadByChat: Record<string, number> = {};
    rows.forEach((m) => {
      if (m.sender_id !== me.id && !myReadSet.has(m.id)) {
        unreadByChat[m.chat_id] = (unreadByChat[m.chat_id] ?? 0) + 1;
      }
    });

    const memsByChat: Record<string, string[]> = {};
    (allMembers ?? []).forEach((m: { chat_id: string; user_id: string }) => {
      (memsByChat[m.chat_id] ||= []).push(m.user_id);
    });

    const result: ChatWithMeta[] = (chatRows ?? []).map((c) => {
      const chat = c as ChatRow;
      const ids = memsByChat[chat.id] ?? [];
      return {
        ...chat,
        memberIds: ids,
        members: ids.map((id) => profMap[id]).filter(Boolean),
        lastMessage: lastByChat[chat.id],
        unread: unreadByChat[chat.id] ?? 0,
      };
    });
    setChats(result);
    if (!activeId && result.length > 0) setActiveId(result[0].id);
  }, [me, activeId]);

  useEffect(() => { loadChats(); }, [loadChats]);

  // Load my blocks
  useEffect(() => {
    if (!me) return;
    (async () => {
      const { data } = await supabase.from("blocks").select("*").eq("blocker_id", me.id);
      setBlockedIds(new Set(((data ?? []) as BlockRow[]).map((b) => b.blocked_id)));
    })();
  }, [me]);

  // Prompt to unlock when opening a hidden chat
  useEffect(() => {
    if (!activeId) return;
    const c = chats.find((x) => x.id === activeId);
    if (c?.is_hidden && !isUnlocked(activeId)) setNeedsUnlock(true);
    else setNeedsUnlock(false);
  }, [activeId, chats]);

  // Decrypt encrypted messages we have keys for
  useEffect(() => {
    if (!activeId || !isUnlocked(activeId)) return;
    (async () => {
      const next: Record<string, string> = {};
      for (const m of messages) {
        if (m.is_encrypted && m.body && !decrypted[m.id]) {
          const pt = await decryptBody(activeId, m.body);
          if (pt !== null) next[m.id] = pt;
        }
      }
      if (Object.keys(next).length) setDecrypted((prev) => ({ ...prev, ...next }));
    })();
  }, [activeId, messages, decrypted, needsUnlock]);

  // Load messages + reactions + read receipts for active chat
  useEffect(() => {
    if (!activeId) return;
    (async () => {
      const { data: msgs } = await supabase.from("messages").select("*").eq("chat_id", activeId).order("created_at");
      const rows = (msgs ?? []) as MessageRow[];
      setMessages(rows);
      const ids = rows.map((m) => m.id);
      if (ids.length) {
        const [{ data: rx }, { data: rd }] = await Promise.all([
          supabase.from("reactions").select("*").in("message_id", ids),
          supabase.from("message_reads").select("*").in("message_id", ids),
        ]);
        setReactions((rx ?? []) as ReactionRow[]);
        setReads((rd ?? []) as MessageReadRow[]);
      } else { setReactions([]); setReads([]); }
    })();
  }, [activeId]);

  // Realtime: messages, reactions, reads, member changes
  useEffect(() => {
    if (!me) return;
    const channel = supabase
      .channel("sona-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (p) => {
        const m = p.new as MessageRow;
        if (m.chat_id === activeId) setMessages((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, m]);
        loadChats();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "reactions" }, (p) => {
        if (p.eventType === "INSERT") {
          const r = p.new as ReactionRow;
          setReactions((prev) => prev.some((x) => x.id === r.id) ? prev : [...prev, r]);
        } else if (p.eventType === "DELETE") {
          const r = p.old as ReactionRow;
          setReactions((prev) => prev.filter((x) => x.id !== r.id));
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "message_reads" }, (p) => {
        const r = p.new as MessageReadRow;
        setReads((prev) => prev.some((x) => x.message_id === r.message_id && x.user_id === r.user_id) ? prev : [...prev, r]);
        if (r.user_id === me.id) loadChats();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_members" }, () => { loadChats(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [me, activeId, loadChats]);

  // Typing indicator: subscribe to broadcast per active chat
  useEffect(() => {
    if (!me || !activeId) return;
    const chan = supabase.channel(`typing:${activeId}`, { config: { broadcast: { self: false } } });
    const timers: Record<string, ReturnType<typeof setTimeout>> = {};
    chan.on("broadcast", { event: "typing" }, (payload) => {
      const uid = (payload.payload as { user_id?: string })?.user_id;
      if (!uid || uid === me.id) return;
      setTypingOthers((prev) => (prev.includes(uid) ? prev : [...prev, uid]));
      if (timers[uid]) clearTimeout(timers[uid]);
      timers[uid] = setTimeout(() => setTypingOthers((prev) => prev.filter((x) => x !== uid)), 3500);
    }).subscribe();
    typingChanRef.current = chan;
    return () => {
      Object.values(timers).forEach(clearTimeout);
      supabase.removeChannel(chan);
      typingChanRef.current = null;
      setTypingOthers([]);
    };
  }, [me, activeId]);

  const sendTyping = useCallback(() => {
    const chan = typingChanRef.current;
    if (!chan || !me) return;
    chan.send({ type: "broadcast", event: "typing", payload: { user_id: me.id } });
  }, [me]);

  // Auto-mark unread messages as read when active chat is open
  useEffect(() => {
    if (!me || !activeId || messages.length === 0) return;
    const toMark = messages.filter((m) => m.sender_id !== me.id).map((m) => m.id);
    if (!toMark.length) return;
    (async () => {
      const { data: existing } = await supabase.from("message_reads")
        .select("message_id").eq("user_id", me.id).in("message_id", toMark);
      const have = new Set((existing ?? []).map((r: { message_id: string }) => r.message_id));
      const missing = toMark.filter((id) => !have.has(id));
      if (missing.length) {
        await supabase.from("message_reads").insert(missing.map((id) => ({ message_id: id, user_id: me.id })));
        loadChats();
      }
    })();
  }, [me, activeId, messages, loadChats]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [activeId, messages.length]);

  const active = chats.find((c) => c.id === activeId);
  const filtered = useMemo(() => chats.filter((c) => {
    if (!me) return true;
    // hide 1:1 chats with a blocked user
    if (!c.is_group) {
      const other = c.memberIds.find((id) => id !== me.id);
      if (other && blockedIds.has(other)) return false;
    }
    return chatTitle(c, me.id).toLowerCase().includes(query.toLowerCase());
  }), [chats, query, me, blockedIds]);

  // Send
  const send = async () => {
    if (!me || !activeId) return;

    // Editing existing text message
    if (editing) {
      const newText = draft.trim();
      if (!newText) return;
      let body: string | null = newText;
      if (active?.is_hidden && isUnlocked(activeId)) {
        const enc = await encryptBody(activeId, newText);
        if (enc) body = enc;
      }
      const { error } = await supabase
        .from("messages")
        .update({ body, edited_at: new Date().toISOString() })
        .eq("id", editing.id).eq("sender_id", me.id);
      if (error) { toast.error(error.message); return; }
      setMessages((prev) => prev.map((m) => m.id === editing.id ? { ...m, body, edited_at: new Date().toISOString() } : m));
      setEditing(null); setDraft(""); setShowEmoji(false);
      return;
    }

    if (!draft.trim() && !pendingImage) return;
    let media_url: string | null = null;
    let kind: "text" | "image" = "text";

    if (pendingImage) {
      const path = `${activeId}/${me.id}/${crypto.randomUUID()}-${pendingImage.name}`;
      const { error: upErr } = await supabase.storage.from("chat-media").upload(path, pendingImage);
      if (upErr) { toast.error(upErr.message); return; }
      const { data: signed } = await supabase.storage.from("chat-media").createSignedUrl(path, 60 * 60 * 24 * 365);
      media_url = signed?.signedUrl ?? null;
      kind = "image";
    }
    const plaintext = draft.trim();
    let body: string | null = plaintext || null;
    let is_encrypted = false;

    if (active?.is_hidden && body && isUnlocked(activeId)) {
      const enc = await encryptBody(activeId, body);
      if (enc) { body = enc; is_encrypted = true; }
    }

    const { error } = await supabase.from("messages").insert({
      chat_id: activeId, sender_id: me.id, kind, body, media_url, is_encrypted,
      reply_to_id: replyTo?.id ?? null,
    });
    if (error) { toast.error(error.message); return; }

    const prompt = plaintext;
    const attachedImageUrl = media_url;
    setDraft(""); setPendingImage(null); setShowEmoji(false); setReplyTo(null);

    if (active && !active.is_hidden) {
      const isAI = isAIChat(active);
      const mentionsSona = /(^|\s)@sona\b/i.test(prompt);
      if ((isAI || mentionsSona) && (prompt || attachedImageUrl)) {
        askAI({ data: { chatId: activeId, prompt: prompt || "What's in this image?", imageUrl: attachedImageUrl } })
          .catch((e) => toast.error(e.message));
      }
    }
  };

  const startEdit = (m: MessageRow) => {
    if (m.sender_id !== me?.id || m.kind !== "text") return;
    const text = m.is_encrypted ? (decrypted[m.id] ?? "") : (m.body ?? "");
    setEditing(m); setDraft(text); setReplyTo(null);
  };
  const startReply = (m: MessageRow) => { setReplyTo(m); setEditing(null); };

  const onPickFile = (f?: File | null) => { if (f) setPendingImage(f); };


  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!me) return;
    const existing = reactions.find((r) => r.message_id === messageId && r.user_id === me.id && r.emoji === emoji);
    if (existing) await supabase.from("reactions").delete().eq("id", existing.id);
    else await supabase.from("reactions").insert({ message_id: messageId, user_id: me.id, emoji });
    setReactingOn(null);
  };

  // Delete a message for everyone (RLS allows sender delete)
  const deleteMessage = async (messageId: string) => {
    if (!me) return;
    if (!confirm("Delete this message for everyone?")) return;
    const { error } = await supabase.from("messages").delete().eq("id", messageId).eq("sender_id", me.id);
    if (error) { toast.error(error.message); return; }
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  };

  // Block the other user in a 1:1 chat
  const blockOther = async () => {
    if (!me || !active) return;
    const other = active.memberIds.find((id) => id !== me.id && id !== SONA_AI_ID);
    if (!other) { toast.error("Can't block in this chat."); return; }
    const { error } = await supabase.from("blocks").insert({ blocker_id: me.id, blocked_id: other });
    if (error) { toast.error(error.message); return; }
    setBlockedIds((prev) => new Set(prev).add(other));
    toast.success("User blocked");
    setShowHeaderMenu(false);
    setActiveId(null);
  };

  // Toggle hide/lock a chat (encrypts new messages once unlocked)
  const toggleHideChat = async () => {
    if (!active) return;
    const next = !active.is_hidden;
    const { error } = await supabase.from("chats").update({ is_hidden: next }).eq("id", active.id);
    if (error) { toast.error(error.message); return; }
    toast.success(next ? "Chat hidden — set a passcode to unlock" : "Chat is no longer hidden");
    setShowHeaderMenu(false);
    loadChats();
  };

  // AI chat summary on demand
  const runSummary = async () => {
    if (!activeId) return;
    setShowHeaderMenu(false);
    toast.loading("Summarizing…", { id: "sum" });
    try {
      const r = await askSummary({ data: { chatId: activeId } }) as { summary: string };
      setSummary(r.summary);
      toast.success("Summary ready", { id: "sum" });
    } catch (e) { toast.error((e as Error).message, { id: "sum" }); }
  };

  // Lock chat (forget key in-memory)
  const relock = () => {
    if (!activeId) return;
    lockChat(activeId);
    setDecrypted({});
    setNeedsUnlock(true);
    setShowHeaderMenu(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  if (!me) {
    return <div className="grid min-h-dvh place-items-center text-muted-foreground">Loading Sona…</div>;
  }

  const typingNames = typingOthers
    .map((id) => profiles[id]?.display_name)
    .filter(Boolean) as string[];

  return (
    <div className="h-dvh w-full bg-background text-foreground">
      <div className="mx-auto flex h-full max-w-[1400px] overflow-hidden md:p-4">
        <div className="flex h-full w-full overflow-hidden rounded-none bg-card shadow-xl md:rounded-3xl md:border">
          {/* Sidebar */}
          <aside className={`${showSidebarMobile ? "flex" : "hidden"} relative h-full w-full flex-col border-r bg-sidebar text-sidebar-foreground md:flex md:w-[340px] lg:w-[380px]`}>
            <div className="flex items-center justify-between gap-2 px-4 py-3">
              <div className="flex items-center gap-2 min-w-0">
                <img src={sonaLogo} alt="Sona" width={36} height={36} className="h-9 w-9 rounded-2xl shadow-md" />
                <div className="leading-tight min-w-0">
                  <div className="text-base font-bold truncate">Sona</div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">talk gold</div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={toggle} className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary" aria-label="Toggle theme">
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
                <button onClick={() => setShowSettings(true)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary" aria-label="Settings">
                  <Settings className="h-4 w-4" />
                </button>
                <button onClick={signOut} className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary" aria-label="Sign out">
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="px-3 pb-2 flex items-center gap-2">
              <Avatar url={me.avatar_url} name={me.display_name} size={36} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{me.display_name}</div>
                <div className="truncate text-[11px] text-muted-foreground">{me.email}</div>
              </div>
            </div>

            <div className="px-3 pb-2">
              <div className="flex items-center gap-2 rounded-full bg-secondary px-3 py-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search chats" className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
              </div>
            </div>

            <div className="scrollbar-thin flex-1 overflow-y-auto pb-24">
              {filtered.map((c) => {
                const title = chatTitle(c, c.memberIds.includes(me.id) ? me.id : "");
                const last = c.lastMessage;
                const mine = last?.sender_id === me.id;
                const previewText = last?.kind === "image" ? "📷 Photo" : last?.kind === "voice" ? "🎤 Voice note" : (last?.body ?? "");
                const active = c.id === activeId;
                const ai = isAIChat(c);
                return (
                  <button key={c.id} onClick={() => { setActiveId(c.id); setShowSidebarMobile(false); }}
                    className={`flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-secondary ${active ? "bg-secondary" : ""}`}>
                    <div className="relative shrink-0">
                      <Avatar url={chatAvatarUrl(c, me.id)} name={title} size={50} ai={ai} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold">{title}</span>
                        <span className={`text-[11px] shrink-0 ${c.unread > 0 ? "text-skyblue-deep font-semibold" : "text-muted-foreground"}`}>
                          {last ? fmtTime(last.created_at) : ""}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <div className="min-w-0 flex-1 flex items-center gap-1 text-sm text-muted-foreground">
                          {mine && last && <TickIcon status={readStatusFor(last, reads, c.memberIds, me.id)} className="h-3.5 w-3.5 shrink-0" />}
                          <span className="truncate">{previewText}</span>
                        </div>
                        {c.unread > 0 && (
                          <span className="grid min-w-[20px] h-5 px-1.5 place-items-center rounded-full bg-skyblue-deep text-primary-foreground text-[11px] font-bold shrink-0">
                            {c.unread > 99 ? "99+" : c.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
              {filtered.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No chats yet. Tap + to start one.</div>}
            </div>

            {/* Floating New-Chat FAB */}
            <button
              onClick={() => setShowNewChat(true)}
              aria-label="New chat"
              className="absolute bottom-5 right-5 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-skyblue to-skyblue-deep text-primary-foreground shadow-2xl transition hover:scale-105 active:scale-95"
            >
              <MessageSquarePlus className="h-6 w-6" />
            </button>
          </aside>

          {/* Chat panel */}
          <section className={`${showSidebarMobile ? "hidden" : "flex"} h-full min-w-0 flex-1 flex-col md:flex`}>
            {active ? (
              <>
                <header className="relative flex items-center gap-3 border-b bg-card px-3 py-2.5 md:px-4">
                  <button onClick={() => setShowSidebarMobile(true)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary md:hidden" aria-label="Back">
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <Avatar url={chatAvatarUrl(active, me.id)} name={chatTitle(active, me.id)} ai={isAIChat(active)} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold flex items-center gap-1.5">
                      {chatTitle(active, me.id)}
                      {active.is_hidden && <Lock className="h-3.5 w-3.5 text-skyblue-deep" />}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {typingNames.length > 0
                        ? <span className="text-skyblue-deep">{typingNames.join(", ")} typing…</span>
                        : isAIChat(active) ? "AI companion · always on" : `${active.members.length} members`}
                    </div>
                  </div>
                  <button onClick={() => setShowHeaderMenu((s) => !s)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary" aria-label="Menu">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {showHeaderMenu && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setShowHeaderMenu(false)} />
                      <div className="absolute right-3 top-14 z-40 w-56 rounded-xl border bg-popover p-1 shadow-xl">
                        <button onClick={runSummary} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-secondary">
                          <Sparkles className="h-4 w-4 text-skyblue-deep" /> Summarize chat
                        </button>
                        <button onClick={toggleHideChat} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-secondary">
                          {active.is_hidden ? <><Unlock className="h-4 w-4" /> Unhide chat</> : <><Shield className="h-4 w-4" /> Hide & encrypt</>}
                        </button>
                        {active.is_hidden && isUnlocked(active.id) && (
                          <button onClick={relock} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-secondary">
                            <Lock className="h-4 w-4" /> Lock now
                          </button>
                        )}
                        {!isAIChat(active) && !active.is_group && (
                          <button onClick={blockOther} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-secondary">
                            <Ban className="h-4 w-4" /> Block user
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </header>

                <div ref={scrollRef} className="scrollbar-thin chat-pattern flex-1 overflow-y-auto px-3 py-4 md:px-8">
                  <div className="mx-auto flex max-w-3xl flex-col gap-1.5">
                    <div className="mx-auto rounded-full bg-card/80 px-3 py-1 text-[11px] text-muted-foreground backdrop-blur">
                      {isAIChat(active) ? "Chat with Sona AI ✨" : "Type @sona to summon the AI"}
                    </div>
                    {messages.map((m, idx) => {
                      const prev = messages[idx - 1];
                      const groupWithPrev = prev && prev.sender_id === m.sender_id
                        && new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 60_000;
                      const overrideBody = m.is_encrypted
                        ? (decrypted[m.id] ?? "🔒 Locked message — unlock this chat to read")
                        : undefined;
                      return (
                        <Bubble
                          key={m.id}
                          msg={m}
                          me={me}
                          sender={profiles[m.sender_id]}
                          reactions={reactions.filter((r) => r.message_id === m.id)}
                          reads={reads}
                          otherMemberIds={active.memberIds.filter((id) => id !== me.id)}
                          onReact={(emoji) => toggleReaction(m.id, emoji)}
                          opening={reactingOn === m.id}
                          onOpenPicker={() => setReactingOn(reactingOn === m.id ? null : m.id)}
                          grouped={!!groupWithPrev}
                          overrideBody={overrideBody}
                          onDelete={() => deleteMessage(m.id)}
                        />
                      );
                    })}
                    {typingNames.length > 0 && (
                      <div className="flex items-end gap-2 mt-1">
                        <div className="rounded-2xl rounded-bl-md bg-bubble-them text-bubble-them-foreground shadow-bubble px-3 py-2.5 flex items-center gap-1">
                          <span className="typing-dot h-1.5 w-1.5 rounded-full bg-current inline-block" />
                          <span className="typing-dot h-1.5 w-1.5 rounded-full bg-current inline-block" />
                          <span className="typing-dot h-1.5 w-1.5 rounded-full bg-current inline-block" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {pendingImage && (
                  <div className="border-t bg-card px-3 py-2 md:px-6">
                    <div className="mx-auto flex max-w-3xl items-center gap-3">
                      <img src={URL.createObjectURL(pendingImage)} alt="" className="h-14 w-14 rounded-lg object-cover" />
                      <span className="flex-1 text-sm text-muted-foreground truncate">{pendingImage.name}</span>
                      <button onClick={() => setPendingImage(null)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-secondary"><X className="h-4 w-4" /></button>
                    </div>
                  </div>
                )}

                <Composer
                  draft={draft}
                  setDraft={(v) => { setDraft(v); if (v) sendTyping(); }}
                  showEmoji={showEmoji} setShowEmoji={setShowEmoji}
                  onPickFile={onPickFile} fileRef={fileRef}
                  onSend={send}
                  onVoiceUploaded={async (blob, durationMs) => {
                    if (!me || !activeId) return;
                    const path = `${activeId}/${me.id}/${crypto.randomUUID()}.webm`;
                    const { error: upErr } = await supabase.storage.from("chat-media").upload(path, blob, { contentType: blob.type });
                    if (upErr) { toast.error(upErr.message); return; }
                    const { data: signed } = await supabase.storage.from("chat-media").createSignedUrl(path, 60 * 60 * 24 * 365);
                    await supabase.from("messages").insert({
                      chat_id: activeId, sender_id: me.id, kind: "voice",
                      media_url: signed?.signedUrl ?? null, duration_ms: durationMs,
                    });
                  }}
                />
              </>
            ) : (
              <div className="grid flex-1 place-items-center p-6 text-center text-muted-foreground chat-pattern">
                <div>
                  <img src={sonaLogo} alt="" className="mx-auto h-24 w-24 opacity-80" />
                  <p className="mt-4">Pick a chat or tap + to start a new one.</p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {showNewChat && me && (
        <NewChatModal
          meId={me.id}
          onClose={() => setShowNewChat(false)}
          onCreated={(id) => { setActiveId(id); setShowSidebarMobile(false); setShowNewChat(false); loadChats(); }}
        />
      )}

      {showSettings && me && (
        <SettingsModal
          me={me}
          onClose={() => setShowSettings(false)}
          onSaved={(p) => { setMe(p); setProfiles((prev) => ({ ...prev, [p.id]: p })); }}
        />
      )}

      {needsUnlock && activeId && active?.is_hidden && (
        <UnlockModal
          chatId={activeId}
          onUnlocked={() => setNeedsUnlock(false)}
          onCancel={() => { setNeedsUnlock(false); setActiveId(null); }}
        />
      )}

      {summary !== null && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setSummary(null)}>
          <div className="w-full max-w-md rounded-2xl border bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-skyblue-deep" />
              <h3 className="text-base font-semibold">Chat summary</h3>
            </div>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{summary}</p>
            <div className="mt-4 flex justify-end">
              <button onClick={() => setSummary(null)} className="rounded-xl bg-secondary px-3 py-2 text-sm">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type ReadStatus = "sent" | "delivered" | "read";
function readStatusFor(msg: MessageRow, reads: MessageReadRow[], memberIds: string[], meId: string): ReadStatus {
  if (msg.sender_id !== meId) return "sent";
  const others = memberIds.filter((id) => id !== meId);
  if (others.length === 0) return "sent";
  const readers = reads.filter((r) => r.message_id === msg.id && r.user_id !== meId);
  if (readers.length >= others.length) return "read";
  if (readers.length > 0) return "read";
  return "delivered";
}

function TickIcon({ status, className }: { status: ReadStatus; className?: string }) {
  if (status === "read") return <CheckCheck className={`${className ?? ""} text-tick-read`} />;
  if (status === "delivered") return <CheckCheck className={className} />;
  return <Check className={className} />;
}

function Bubble({
  msg, me, sender, reactions, reads, otherMemberIds, onReact, opening, onOpenPicker, grouped,
  overrideBody, onDelete,
}: {
  msg: MessageRow; me: Profile; sender?: Profile; reactions: ReactionRow[];
  reads: MessageReadRow[]; otherMemberIds: string[];
  onReact: (emoji: string) => void; opening: boolean; onOpenPicker: () => void; grouped: boolean;
  overrideBody?: string; onDelete: () => void;
}) {
  const mine = msg.sender_id === me.id;
  const isAI = msg.sender_id === SONA_AI_ID;
  const counts: Record<string, number> = {};
  reactions.forEach((r) => { counts[r.emoji] = (counts[r.emoji] ?? 0) + 1; });
  const status: ReadStatus = readStatusFor(msg, reads, [me.id, ...otherMemberIds], me.id);

  return (
    <div className={`group flex items-end gap-2 ${mine ? "justify-end" : "justify-start"} ${grouped ? "mt-0.5" : "mt-2"}`}>
      {!mine && !grouped && <Avatar url={sender?.avatar_url} name={sender?.display_name ?? "?"} size={28} ai={isAI} />}
      {!mine && grouped && <div className="w-7 shrink-0" />}
      <div className="relative max-w-[78%]">
        <div className={`relative px-3 py-2 text-sm shadow-bubble ${
          mine
            ? `bg-bubble-me text-bubble-me-foreground rounded-2xl ${grouped ? "rounded-br-2xl" : "rounded-br-sm"}`
            : `bg-bubble-them text-bubble-them-foreground rounded-2xl ${grouped ? "rounded-bl-2xl" : "rounded-bl-sm"}`
        }`}>
          {!mine && !grouped && (
            <div className="mb-0.5 text-[11px] font-semibold text-skyblue-deep flex items-center gap-1">
              {isAI ? "Sona AI ✨" : sender?.display_name ?? "…"}
            </div>
          )}
          {msg.kind === "image" && msg.media_url && (
            <img src={msg.media_url} alt="" loading="lazy" className="mb-1 max-h-72 w-full rounded-xl object-cover" />
          )}
          {msg.kind === "voice" && msg.media_url && (
            <VoicePlayer url={msg.media_url} durationMs={msg.duration_ms ?? 0} mine={mine} />
          )}
          {(overrideBody ?? msg.body) && <p className="whitespace-pre-wrap break-words leading-relaxed pr-12">{overrideBody ?? msg.body}</p>}
          <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] opacity-70">
            <span>{fmtTime(msg.created_at)}</span>
            {mine && <TickIcon status={status} className="h-3.5 w-3.5" />}
          </div>
          {mine && (
            <button
              onClick={onDelete}
              className={`absolute -left-8 top-1/2 -translate-y-1/2 grid h-7 w-7 place-items-center rounded-full bg-card border shadow opacity-0 transition group-hover:opacity-100 text-destructive`}
              aria-label="Delete for everyone"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={onOpenPicker}
            className={`absolute ${mine ? "-left-8" : "-right-8"} top-1/2 -translate-y-1/2 grid h-7 w-7 place-items-center rounded-full bg-card border shadow opacity-0 transition group-hover:opacity-100`}
            aria-label="React"
          >
            <SmilePlus className="h-3.5 w-3.5" />
          </button>
          {opening && (
            <div className={`absolute -top-10 ${mine ? "right-0" : "left-0"} z-10 flex gap-1 rounded-full border bg-popover px-2 py-1 shadow-lg`}>
              {REACT_EMOJIS.map((e) => (
                <button key={e} onClick={() => onReact(e)} className="text-lg hover:scale-125 transition">{e}</button>
              ))}
            </div>
          )}
        </div>
        {Object.keys(counts).length > 0 && (
          <div className={`mt-1 flex flex-wrap gap-1 ${mine ? "justify-end" : "justify-start"}`}>
            {Object.entries(counts).map(([e, n]) => {
              const mineReacted = reactions.some((r) => r.emoji === e && r.user_id === me.id);
              return (
                <button key={e} onClick={() => onReact(e)}
                  className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs bg-card ${mineReacted ? "ring-1 ring-skyblue-deep" : ""}`}>
                  <span>{e}</span><span className="text-[10px] text-muted-foreground">{n}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function VoicePlayer({ url, durationMs, mine }: { url: string; durationMs: number; mine: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const a = new Audio(url);
    audioRef.current = a;
    a.addEventListener("timeupdate", () => setProgress(a.duration ? a.currentTime / a.duration : 0));
    a.addEventListener("ended", () => { setPlaying(false); setProgress(0); });
    return () => { a.pause(); audioRef.current = null; };
  }, [url]);
  const toggle = () => {
    const a = audioRef.current; if (!a) return;
    if (playing) { a.pause(); setPlaying(false); } else { a.play(); setPlaying(true); }
  };
  const secs = Math.round(durationMs / 1000);
  return (
    <div className="flex items-center gap-2 min-w-[180px] py-1">
      <button onClick={toggle} className={`grid h-8 w-8 place-items-center rounded-full ${mine ? "bg-card/40" : "bg-skyblue/40"}`}>
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <div className="flex-1 h-1.5 rounded-full bg-card/40 overflow-hidden">
        <div className="h-full bg-current opacity-80" style={{ width: `${progress * 100}%` }} />
      </div>
      <span className="text-[10px] opacity-70 tabular-nums">
        {String(Math.floor(secs / 60)).padStart(1, "0")}:{String(secs % 60).padStart(2, "0")}
      </span>
    </div>
  );
}

function Composer({
  draft, setDraft, showEmoji, setShowEmoji, onPickFile, fileRef, onSend, onVoiceUploaded,
}: {
  draft: string; setDraft: (v: string) => void;
  showEmoji: boolean; setShowEmoji: (v: boolean | ((s: boolean) => boolean)) => void;
  onPickFile: (f?: File | null) => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onSend: () => void;
  onVoiceUploaded: (blob: Blob, durationMs: number) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm"
        : "audio/mp4";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const dur = Date.now() - startedRef.current;
        const blob = new Blob(chunksRef.current, { type: mime });
        stream.getTracks().forEach((t) => t.stop());
        if (blob.size > 1000) onVoiceUploaded(blob, dur);
      };
      startedRef.current = Date.now();
      rec.start();
      mediaRef.current = rec;
      setRecording(true); setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } catch { toast.error("Microphone permission denied"); }
  };
  const stopRec = (cancel = false) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const rec = mediaRef.current;
    if (!rec) return;
    if (cancel) chunksRef.current = [];
    rec.stop();
    mediaRef.current = null;
    setRecording(false); setElapsed(0);
  };

  return (
    <div className="relative border-t bg-card px-2 py-2 md:px-6 md:py-3">
      {showEmoji && (
        <div className="absolute bottom-full left-2 mb-2 grid max-w-xs grid-cols-8 gap-1 rounded-2xl border bg-popover p-2 shadow-xl md:left-6">
          {EMOJIS.map((e) => (
            <button key={e} onClick={() => setDraft(draft + e)} className="grid h-8 w-8 place-items-center rounded-lg text-lg hover:bg-secondary">{e}</button>
          ))}
        </div>
      )}
      {recording ? (
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <button onClick={() => stopRec(true)} className="grid h-11 w-11 place-items-center rounded-full bg-secondary text-destructive"><Trash2 className="h-5 w-5" /></button>
          <div className="flex flex-1 items-center gap-2 rounded-3xl bg-secondary px-4 py-3">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-destructive" />
            <span className="text-sm">Recording… {String(Math.floor(elapsed / 60)).padStart(1, "0")}:{String(elapsed % 60).padStart(2, "0")}</span>
          </div>
          <button onClick={() => stopRec(false)} className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-skyblue to-skyblue-deep text-primary-foreground shadow-md"><Send className="h-5 w-5" /></button>
        </div>
      ) : (
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <div className="flex flex-1 items-center gap-1.5 rounded-3xl bg-secondary px-2 py-1.5">
            <button onClick={() => setShowEmoji((s) => !s)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-background/60"><Smile className="h-5 w-5" /></button>
            <textarea
              value={draft} onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
              rows={1} placeholder="Type a message · @sona for AI"
              className="max-h-32 min-h-6 flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground py-1.5"
            />
            <button onClick={() => fileRef.current?.click()} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-background/60" aria-label="Attach"><Paperclip className="h-5 w-5" /></button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPickFile(e.target.files?.[0])} />
            <button onClick={() => fileRef.current?.click()} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-background/60" aria-label="Image"><ImageIcon className="h-5 w-5" /></button>
          </div>
          {draft.trim() ? (
            <button onClick={onSend} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-skyblue to-skyblue-deep text-primary-foreground shadow-md"><Send className="h-5 w-5" /></button>
          ) : (
            <button onClick={startRec} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-skyblue to-skyblue-deep text-primary-foreground shadow-md"><Mic className="h-5 w-5" /></button>
          )}
        </div>
      )}
    </div>
  );
}

function NewChatModal({ meId, onClose, onCreated }: { meId: string; onClose: () => void; onCreated: (id: string) => void }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    const target = email.trim().toLowerCase();
    if (!target) return;
    setBusy(true);
    try {
      const { data: prof, error: pErr } = await supabase.from("profiles").select("*").eq("email", target).maybeSingle();
      if (pErr) throw pErr;
      if (!prof) {
        const subject = encodeURIComponent("Join me on Sona — talk gold");
        const body = encodeURIComponent(`Hey! I'm on Sona. Sign up with this email (${target}) at ${window.location.origin}/auth and we'll be connected automatically.`);
        window.location.href = `mailto:${target}?subject=${subject}&body=${body}`;
        toast.info("No Sona user yet — we opened an invite email for you.");
        return;
      }
      if (prof.id === meId) { toast.error("That's you 🙂"); return; }

      const { data: myChats } = await supabase.from("chat_members").select("chat_id").eq("user_id", meId);
      const ids = (myChats ?? []).map((r: { chat_id: string }) => r.chat_id);
      if (ids.length) {
        const { data: theirs } = await supabase.from("chat_members").select("chat_id").in("chat_id", ids).eq("user_id", prof.id);
        const shared = (theirs ?? []).map((r: { chat_id: string }) => r.chat_id);
        for (const cid of shared) {
          const { count } = await supabase.from("chat_members").select("*", { count: "exact", head: true }).eq("chat_id", cid);
          if (count === 2) { onCreated(cid); return; }
        }
      }

      const { data: chat, error: cErr } = await supabase.from("chats").insert({ is_group: false, created_by: meId }).select().single();
      if (cErr) throw cErr;
      const { error: mErr } = await supabase.from("chat_members").insert([
        { chat_id: chat.id, user_id: meId },
        { chat_id: chat.id, user_id: prof.id },
      ]);
      if (mErr) throw mErr;
      onCreated(chat.id);
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-skyblue-deep" />
          <h3 className="text-base font-semibold">Start a new chat</h3>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Enter a Sona user's email to connect.</p>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="friend@example.com"
          className="mt-4 w-full rounded-xl bg-secondary px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl px-3 py-2 text-sm hover:bg-secondary">Cancel</button>
          <button disabled={busy} onClick={create} className="rounded-xl bg-gradient-to-br from-skyblue to-skyblue-deep px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {busy ? "…" : "Start"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsModal({ me, onClose, onSaved }: { me: Profile; onClose: () => void; onSaved: (p: Profile) => void }) {
  const [name, setName] = useState(me.display_name ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.from("profiles").update({ display_name: name.trim() || "Friend" }).eq("id", me.id).select().single();
      if (error) throw error;
      onSaved(data as Profile);
      toast.success("Saved");
      onClose();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  const signOut = async () => { await supabase.auth.signOut(); window.location.href = "/auth"; };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-3">
          <Settings className="h-4 w-4 text-skyblue-deep" />
          <h3 className="text-base font-semibold">Settings</h3>
        </div>
        <label className="text-xs text-muted-foreground">Display name</label>
        <input value={name} onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-xl bg-secondary px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
        <p className="mt-3 text-xs text-muted-foreground">Signed in as {me.email}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button onClick={signOut} className="rounded-xl px-3 py-2 text-sm text-destructive hover:bg-secondary">Sign out</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-xl px-3 py-2 text-sm hover:bg-secondary">Cancel</button>
            <button disabled={busy} onClick={save} className="rounded-xl bg-gradient-to-br from-skyblue to-skyblue-deep px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
              {busy ? "…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function UnlockModal({ chatId, onUnlocked, onCancel }: { chatId: string; onUnlocked: () => void; onCancel: () => void }) {
  const [pass, setPass] = useState("");
  const submit = () => {
    if (!pass) return;
    unlockChat(chatId, pass);
    onUnlocked();
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl border bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-3">
          <Lock className="h-4 w-4 text-skyblue-deep" />
          <h3 className="text-base font-semibold">Unlock hidden chat</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Enter your passcode to decrypt messages. It never leaves your device.</p>
        <input type="password" value={pass} onChange={(e) => setPass(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder="Passcode"
          className="w-full rounded-xl bg-secondary px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-xl px-3 py-2 text-sm hover:bg-secondary">Cancel</button>
          <button onClick={submit} className="rounded-xl bg-gradient-to-br from-skyblue to-skyblue-deep px-4 py-2 text-sm font-semibold text-primary-foreground">Unlock</button>
        </div>
      </div>
    </div>
  );
}
