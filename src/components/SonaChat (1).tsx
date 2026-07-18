import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Search, MoreVertical, Paperclip, Smile, Send, Mic, ArrowLeft, Moon, Sun,
  Image as ImageIcon, Plus, X, LogOut, Play, Pause, Trash2, SmilePlus,
  Check, CheckCheck, MessageSquarePlus, Settings, Shield, Sparkles, Lock, Unlock,
  Ban, Reply, Pencil, Crown, Users, Bell, Phone, Video, Camera,
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
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [openBubbleId, setOpenBubbleId] = useState<string | null>(null);

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

    const { data: latest } = await supabase
      .from("messages").select("*").in("chat_id", chatIds).order("created_at", { ascending: false }).limit(500);
    const rows = (latest ?? []) as MessageRow[];
    const lastByChat: Record<string, MessageRow> = {};
    rows.forEach((m) => { if (!lastByChat[m.chat_id]) lastByChat[m.chat_id] = m; });

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

  // Global presence: who's online right now
  useEffect(() => {
    if (!me) return;
    const chan = supabase.channel("sona-presence", { config: { presence: { key: me.id } } });
    chan.on("presence", { event: "sync" }, () => {
      const state = chan.presenceState() as Record<string, unknown[]>;
      setOnlineIds(new Set(Object.keys(state)));
    }).subscribe(async (status) => {
      if (status === "SUBSCRIBED") await chan.track({ online_at: new Date().toISOString() });
    });
    return () => { supabase.removeChannel(chan); };
  }, [me]);

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
    if (!c.is_group) {
      const other = c.memberIds.find((id) => id !== me.id);
      if (other && blockedIds.has(other)) return false;
    }
    return chatTitle(c, me.id).toLowerCase().includes(query.toLowerCase());
  }), [chats, query, me, blockedIds]);

  // Send
  const send = async () => {
    if (!me || !activeId) return;

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

  const deleteMessage = async (messageId: string) => {
    if (!me) return;
    if (!confirm("Delete this message for everyone?")) return;
    const { error } = await supabase.from("messages").delete().eq("id", messageId).eq("sender_id", me.id);
    if (error) { toast.error(error.message); return; }
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  };

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

  const toggleHideChat = async () => {
    if (!active) return;
    const next = !active.is_hidden;
    const { error } = await supabase.from("chats").update({ is_hidden: next }).eq("id", active.id);
    if (error) { toast.error(error.message); return; }
    toast.success(next ? "Chat hidden — set a passcode to unlock" : "Chat is no longer hidden");
    setShowHeaderMenu(false);
    loadChats();
  };

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
    return <div className="grid min-h-dvh place-items-center text-muted-foreground bg-[#f0f2f5] dark:bg-[#0b141a]">Loading Sona…</div>;
  }

  const typingNames = typingOthers
    .map((id) => profiles[id]?.display_name)
    .filter(Boolean) as string[];

  return (
    <div className="h-dvh w-full bg-[#f0f2f5] dark:bg-[#0b141a] text-foreground">
      {/* WhatsApp Web top bar */}
      <div className="h-[127px] w-full bg-skyblue-deep absolute top-0 left-0 z-0" />

      <div className="relative z-10 mx-auto flex h-full max-w-[1600px] overflow-hidden p-0 md:p-4">
        <div className="flex h-full w-full overflow-hidden rounded-none bg-white dark:bg-[#111b21] shadow-2xl md:rounded-none md:border border-[#d1d7db] dark:border-[#2a3942]">
          {/* Sidebar */}
          <aside className={`${showSidebarMobile ? "flex" : "hidden"} relative h-full w-full flex-col border-r border-[#d1d7db] dark:border-[#2a3942] bg-[#f0f2f5] dark:bg-[#111b21] md:flex md:w-[380px] lg:w-[420px]`}>
            {/* WhatsApp-style header */}
            <div className="flex items-center justify-between gap-2 bg-[#f0f2f5] dark:bg-[#1f2c34] px-4 py-3 border-b border-[#d1d7db] dark:border-[#2a3942]">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar url={me.avatar_url} name={me.display_name || "Me"} size={40} />
                <span className="font-semibold text-[17px] truncate">{me.display_name || "Sona"}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={toggle} className="grid h-10 w-10 place-items-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-[#54656f] dark:text-[#aebac1]" aria-label="Toggle theme">
                  {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </button>
                <button onClick={() => setShowSettings(true)} className="grid h-10 w-10 place-items-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-[#54656f] dark:text-[#aebac1]" aria-label="Settings">
                  <Settings className="h-5 w-5" />
                </button>
                <button onClick={signOut} className="grid h-10 w-10 place-items-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-[#54656f] dark:text-[#aebac1]" aria-label="Sign out">
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Search bar - WhatsApp style */}
            <div className="px-3 py-2 bg-white dark:bg-[#111b21] border-b border-[#d1d7db] dark:border-[#2a3942]">
              <div className="flex items-center gap-2 rounded-lg bg-[#f0f2f5] dark:bg-[#1f2c34] px-3 py-1.5">
                <Search className="h-4 w-4 text-[#54656f] dark:text-[#8696a0]" />
                <input 
                  value={query} 
                  onChange={(e) => setQuery(e.target.value)} 
                  placeholder="Search or start new chat" 
                  className="w-full bg-transparent text-sm outline-none placeholder:text-[#54656f] dark:placeholder:text-[#8696a0] text-[#3b4a54] dark:text-[#d1d7db]" 
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-white dark:bg-[#111b21]">
              {filtered.map((c) => {
                const title = chatTitle(c, c.memberIds.includes(me.id) ? me.id : "");
                const last = c.lastMessage;
                const mine = last?.sender_id === me.id;
                const previewText = last?.kind === "image" ? "📷 Photo" : last?.kind === "voice" ? "🎤 Voice note" : (last?.body ?? "");
                const isActive = c.id === activeId;
                const ai = isAIChat(c);
                const unread = c.unread;

                return (
                  <button 
                    key={c.id} 
                    onClick={() => { setActiveId(c.id); setShowSidebarMobile(false); }}
                    className={`flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-[#f5f6f6] dark:hover:bg-[#202c33] ${isActive ? "bg-[#f5f6f6] dark:bg-[#2a3942]" : ""}`}
                  >
                    <div className="relative shrink-0">
                      <Avatar url={chatAvatarUrl(c, me.id)} name={title} size={49} ai={ai} />
                      {(() => {
                        const otherId = c.memberIds.find((id) => id !== me.id);
                        const online = otherId ? onlineIds.has(otherId) : false;
                        return online ? (
                          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-[#00a884] border-2 border-white dark:border-[#111b21]" />
                        ) : null;
                      })()}
                    </div>
                    <div className="min-w-0 flex-1 border-b border-[#e9edef] dark:border-[#222e35] pb-3 -mb-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium text-[17px] text-[#111b21] dark:text-[#e9edef]">{title}</span>
                        <span className={`text-xs shrink-0 ${unread > 0 ? "text-[#00a884] font-semibold" : "text-[#667781] dark:text-[#8696a0]"}`}>
                          {last ? fmtTime(last.created_at) : ""}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <div className="min-w-0 flex-1 flex items-center gap-1 text-sm text-[#667781] dark:text-[#8696a0]">
                          {mine && last && <TickIcon status={readStatusFor(last, reads, c.memberIds, me.id)} className="h-4 w-4 shrink-0" />}
                          <span className="truncate text-[14px]">{previewText}</span>
                        </div>
                        {unread > 0 && (
                          <span className="grid min-w-[20px] h-5 px-1.5 place-items-center rounded-full bg-[#00a884] text-white text-xs font-semibold shrink-0">
                            {unread > 99 ? "99+" : unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="p-6 text-center text-sm text-[#667781] dark:text-[#8696a0]">
                  No chats yet. Tap + to start one.
                </div>
              )}
            </div>

            {/* Floating New-Chat FAB */}
            <button
              onClick={() => setShowNewChat(true)}
              aria-label="New chat"
              className="absolute bottom-5 right-5 grid h-14 w-14 place-items-center rounded-full bg-[#00a884] text-white shadow-lg transition hover:scale-105 active:scale-95"
            >
              <MessageSquarePlus className="h-6 w-6" />
            </button>
          </aside>

          {/* Chat panel */}
          <section className={`${showSidebarMobile ? "hidden" : "flex"} h-full min-w-0 flex-1 flex-col bg-[#efeae2] dark:bg-[#0b141a] md:flex relative`}>
            {active ? (
              <>
                {/* Chat background pattern */}
                <div 
                  className="absolute inset-0 opacity-40 dark:opacity-20 pointer-events-none"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='600' height='600' viewBox='0 0 600 600' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                    backgroundRepeat: "repeat"
                  }}
                />

                {/* Header */}
                <header className="relative z-10 flex items-center gap-3 bg-[#f0f2f5] dark:bg-[#1f2c34] px-3 py-2 md:px-4 border-b border-[#d1d7db] dark:border-[#2a3942]">
                  <button onClick={() => setShowSidebarMobile(true)} className="grid h-10 w-10 place-items-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 md:hidden text-[#54656f] dark:text-[#aebac1]" aria-label="Back">
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <div className="relative">
                    <Avatar url={chatAvatarUrl(active, me.id)} name={chatTitle(active, me.id)} ai={isAIChat(active)} size={40} />
                    {(() => {
                      const otherId = active.memberIds.find((id) => id !== me.id);
                      const online = otherId ? onlineIds.has(otherId) : false;
                      return online && !active.is_group && !isAIChat(active) ? (
                        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-[#00a884] border-2 border-[#f0f2f5] dark:border-[#1f2c34]" />
                      ) : null;
                    })()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-[16px] text-[#111b21] dark:text-[#e9edef]">
                      {chatTitle(active, me.id)}
                    </div>
                    <div className="truncate text-[13px] text-[#667781] dark:text-[#8696a0]">
                      {typingNames.length > 0 ? (
                        <span className="text-[#00a884]">{typingNames.join(", ")} typing…</span>
                      ) : isAIChat(active) ? (
                        "AI companion · always on"
                      ) : active.is_group ? (
                        `${active.members.length} members`
                      ) : (() => {
                        const otherId = active.memberIds.find((id) => id !== me.id);
                        const online = otherId ? onlineIds.has(otherId) : false;
                        return online ? "online" : "last seen recently";
                      })()}
                    </div>
                  </div>

                  <button className="grid h-10 w-10 place-items-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-[#54656f] dark:text-[#aebac1] hidden md:grid">
                    <Video className="h-5 w-5" />
                  </button>
                  <button className="grid h-10 w-10 place-items-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-[#54656f] dark:text-[#aebac1] hidden md:grid">
                    <Phone className="h-5 w-5" />
                  </button>
                  <button onClick={() => setShowHeaderMenu((s) => !s)} className="grid h-10 w-10 place-items-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-[#54656f] dark:text-[#aebac1]" aria-label="Menu">
                    <MoreVertical className="h-5 w-5" />
                  </button>

                  {showHeaderMenu && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setShowHeaderMenu(false)} />
                      <div className="absolute right-3 top-14 z-40 w-56 rounded-lg border border-[#d1d7db] dark:border-[#2a3942] bg-white dark:bg-[#233138] py-2 shadow-xl">
                        <button onClick={runSummary} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[#3b4a54] dark:text-[#d1d7db] hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]">
                          <Sparkles className="h-4 w-4 text-skyblue-deep" /> Summarize chat
                        </button>
                        <button onClick={toggleHideChat} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[#3b4a54] dark:text-[#d1d7db] hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]">
                          {active.is_hidden ? <><Unlock className="h-4 w-4" /> Unhide chat</> : <><Shield className="h-4 w-4" /> Hide & encrypt</>}
                        </button>
                        {active.is_hidden && isUnlocked(active.id) && (
                          <button onClick={relock} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[#3b4a54] dark:text-[#d1d7db] hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]">
                            <Lock className="h-4 w-4" /> Lock now
                          </button>
                        )}
                        {!isAIChat(active) && !active.is_group && (
                          <button onClick={blockOther} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[#ea0038] hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]">
                            <Ban className="h-4 w-4" /> Block user
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </header>

                <div ref={scrollRef} className="relative z-10 flex-1 overflow-y-auto px-4 py-4 md:px-10">
                  <div className="mx-auto flex max-w-[800px] flex-col gap-[2px]">
                    {/* Encryption notice */}
                    {active.is_hidden && (
                      <div className="mx-auto mb-4 rounded-lg bg-[#ffeecd] dark:bg-[#2a2117] px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1.5 text-[12px] text-[#54656f] dark:text-[#8696a0]">
                          <Lock className="h-3 w-3" />
                          <span>Messages are end-to-end encrypted. No one outside of this chat can read them.</span>
                        </div>
                      </div>
                    )}

                    {messages.map((m, idx) => {
                      const prev = messages[idx - 1];
                      const next = messages[idx + 1];
                      const groupWithPrev = prev && prev.sender_id === m.sender_id
                        && new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 120_000;
                      const groupWithNext = next && next.sender_id === m.sender_id
                        && new Date(next.created_at).getTime() - new Date(m.created_at).getTime() < 120_000;
                      const overrideBody = m.is_encrypted
                        ? (decrypted[m.id] ?? "🔒 Locked message — unlock this chat to read")
                        : undefined;
                      const parentMsg = m.reply_to_id ? messages.find((x) => x.id === m.reply_to_id) : undefined;
                      const parentBody = parentMsg
                        ? (parentMsg.is_encrypted ? (decrypted[parentMsg.id] ?? "🔒 Locked") : (parentMsg.body ?? (parentMsg.kind === "image" ? "📷 Photo" : parentMsg.kind === "voice" ? "🎤 Voice note" : "")))
                        : undefined;
                      const parentName = parentMsg ? (parentMsg.sender_id === me.id ? "You" : (profiles[parentMsg.sender_id]?.display_name ?? "…")) : undefined;

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
                          groupNext={!!groupWithNext}
                          overrideBody={overrideBody}
                          onDelete={() => deleteMessage(m.id)}
                          onReply={() => startReply(m)}
                          onEdit={() => startEdit(m)}
                          parentName={parentName}
                          parentBody={parentBody}
                          actionsOpen={openBubbleId === m.id}
                          onToggleActions={() => setOpenBubbleId(openBubbleId === m.id ? null : m.id)}
                        />
                      );
                    })}

                    {typingNames.length > 0 && (
                      <div className="flex items-end gap-2 mt-1">
                        <div className="rounded-lg rounded-bl-none bg-white dark:bg-[#202c33] px-3 py-2.5 flex items-center gap-1 shadow-sm">
                          <span className="typing-dot h-2 w-2 rounded-full bg-[#8696a0] inline-block" />
                          <span className="typing-dot h-2 w-2 rounded-full bg-[#8696a0] inline-block" />
                          <span className="typing-dot h-2 w-2 rounded-full bg-[#8696a0] inline-block" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {(replyTo || editing) && (
                  <div className="relative z-10 border-t border-[#d1d7db] dark:border-[#2a3942] bg-[#f0f2f5] dark:bg-[#1f2c34] px-4 py-2 md:px-8">
                    <div className="mx-auto flex max-w-[800px] items-center gap-3">
                      <div className="flex-1 rounded-lg border-l-4 border-[#00a884] bg-white dark:bg-[#2a3942] px-3 py-2 text-sm">
                        <div className="font-medium text-[#00a884] text-[13px] flex items-center gap-1">
                          {editing ? (<><Pencil className="h-3 w-3" /> Editing</>) : (<><Reply className="h-3 w-3" /> {replyTo && (replyTo.sender_id === me?.id ? "yourself" : profiles[replyTo.sender_id]?.display_name ?? "…")}</>)}
                        </div>
                        <div className="truncate text-[#667781] dark:text-[#8696a0] text-[13px]">
                          {editing ? (editing.body ?? "") : (replyTo?.body ?? (replyTo?.kind === "image" ? "📷 Photo" : replyTo?.kind === "voice" ? "🎤 Voice note" : ""))}
                        </div>
                      </div>
                      <button onClick={() => { setReplyTo(null); setEditing(null); if (editing) setDraft(""); }} className="grid h-8 w-8 place-items-center rounded-full hover:bg-black/5 dark:hover:bg-white/5" aria-label="Cancel">
                        <X className="h-4 w-4 text-[#54656f] dark:text-[#aebac1]" />
                      </button>
                    </div>
                  </div>
                )}

                {pendingImage && (
                  <div className="relative z-10 border-t border-[#d1d7db] dark:border-[#2a3942] bg-[#f0f2f5] dark:bg-[#1f2c34] px-4 py-2 md:px-8">
                    <div className="mx-auto flex max-w-[800px] items-center gap-3">
                      <img src={URL.createObjectURL(pendingImage)} alt="" className="h-14 w-14 rounded-lg object-cover" />
                      <span className="flex-1 text-sm text-[#667781] dark:text-[#8696a0] truncate">{pendingImage.name}</span>
                      <button onClick={() => setPendingImage(null)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-black/5 dark:hover:bg-white/5">
                        <X className="h-4 w-4 text-[#54656f] dark:text-[#aebac1]" />
                      </button>
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
              <div className="relative z-10 grid flex-1 place-items-center p-6 text-center">
                <div>
                  <img src={sonaLogo} alt="" className="mx-auto h-32 w-32 opacity-20" />
                  <p className="mt-4 text-[#667781] dark:text-[#8696a0] text-[14px]">Pick a chat or tap + to start a new one.</p>
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
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setSummary(null)}>
          <div className="w-full max-w-md rounded-lg border border-[#d1d7db] dark:border-[#2a3942] bg-white dark:bg-[#111b21] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-skyblue-deep" />
              <h3 className="text-base font-semibold text-[#111b21] dark:text-[#e9edef]">Chat summary</h3>
            </div>
            <p className="whitespace-pre-wrap text-sm text-[#667781] dark:text-[#8696a0]">{summary}</p>
            <div className="mt-4 flex justify-end">
              <button onClick={() => setSummary(null)} className="rounded-lg bg-[#00a884] px-4 py-2 text-sm font-medium text-white hover:bg-[#008f6f]">Close</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
        .typing-dot {
          animation: typingBounce 1.4s infinite ease-in-out both;
        }
        .typing-dot:nth-child(1) { animation-delay: -0.32s; }
        .typing-dot:nth-child(2) { animation-delay: -0.16s; }
      `}</style>
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
  if (status === "read") return <CheckCheck className={`${className ?? ""} text-[#53bdeb]`} />;
  if (status === "delivered") return <CheckCheck className={`${className ?? ""} text-[#8696a0]`} />;
  return <Check className={`${className ?? ""} text-[#8696a0]`} />;
}

function Bubble({
  msg, me, sender, reactions, reads, otherMemberIds, onReact, opening, onOpenPicker, grouped, groupNext,
  overrideBody, onDelete, onReply, onEdit, parentName, parentBody, actionsOpen, onToggleActions,
}: {
  msg: MessageRow; me: Profile; sender?: Profile; reactions: ReactionRow[];
  reads: MessageReadRow[]; otherMemberIds: string[];
  onReact: (emoji: string) => void; opening: boolean; onOpenPicker: () => void; grouped: boolean; groupNext: boolean;
  overrideBody?: string; onDelete: () => void;
  onReply: () => void; onEdit: () => void;
  parentName?: string; parentBody?: string;
  actionsOpen: boolean; onToggleActions: () => void;
}) {
  const mine = msg.sender_id === me.id;
  const isAI = msg.sender_id === SONA_AI_ID;
  const counts: Record<string, number> = {};
  reactions.forEach((r) => { counts[r.emoji] = (counts[r.emoji] ?? 0) + 1; });
  const status: ReadStatus = readStatusFor(msg, reads, [me.id, ...otherMemberIds], me.id);

  return (
    <div className={`group flex items-end gap-1 ${mine ? "justify-end" : "justify-start"} ${grouped ? "mt-[2px]" : "mt-2"}`}>
      {!mine && !grouped && <Avatar url={sender?.avatar_url} name={sender?.display_name ?? "?"} size={28} ai={isAI} />}
      {!mine && grouped && <div className="w-7 shrink-0" />}
      <div className="relative max-w-[65%] md:max-w-[55%]">
        <div 
          onClick={onToggleActions}
          className={`relative cursor-pointer px-2 py-1.5 text-[14.2px] leading-[19px] shadow-sm ${
            mine
              ? `bg-[#d9fdd3] dark:bg-[#005c4b] text-[#111b21] dark:text-[#e9edef] rounded-lg ${grouped ? "rounded-tr-lg" : "rounded-tr-none"} ${groupNext ? "rounded-br-lg" : "rounded-br-none"}`
              : `bg-white dark:bg-[#202c33] text-[#111b21] dark:text-[#e9edef] rounded-lg ${grouped ? "rounded-tl-lg" : "rounded-tl-none"} ${groupNext ? "rounded-bl-lg" : "rounded-bl-none"}`
          }`}
        >
          {/* Tail for first message in group */}
          {!grouped && (
            <div className={`absolute bottom-0 ${mine ? "-right-2" : "-left-2"} w-4 h-4 overflow-hidden`}>
              <div className={`absolute ${mine ? "-left-2" : "-right-2"} bottom-0 w-4 h-4 ${mine ? "bg-[#d9fdd3] dark:bg-[#005c4b]" : "bg-white dark:bg-[#202c33]"} rounded-full`} />
            </div>
          )}

          {!mine && !grouped && (
            <div className="mb-0.5 text-[12.5px] font-medium text-skyblue-deep">
              {isAI ? "Sona AI ✨" : sender?.display_name ?? "…"}
            </div>
          )}
          {parentBody !== undefined && (
            <div className={`mb-1 rounded-md border-l-4 border-[#00a884] px-2 py-1 text-[12px] ${mine ? "bg-black/5" : "bg-black/5 dark:bg-white/5"}`}>
              <div className="font-medium text-[#00a884]">{parentName}</div>
              <div className="truncate opacity-70 max-w-[240px]">{parentBody}</div>
            </div>
          )}
          {msg.kind === "image" && msg.media_url && (
            <img src={msg.media_url} alt="" loading="lazy" className="mb-1 max-h-72 w-full rounded-md object-cover" />
          )}
          {msg.kind === "voice" && msg.media_url && (
            <VoicePlayer url={msg.media_url} durationMs={msg.duration_ms ?? 0} mine={mine} />
          )}
          {(overrideBody ?? msg.body) && (
            <p className="whitespace-pre-wrap break-words pr-16">{overrideBody ?? msg.body}</p>
          )}
          <div className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-[#667781] dark:text-[#8696a0]">
            {msg.edited_at && <span className="italic">edited</span>}
            <span className="tabular-nums">{fmtTime(msg.created_at)}</span>
            {mine && <TickIcon status={status} className="h-3.5 w-3.5" />}
          </div>

          {/* Action rail */}
          <div 
            className={`absolute ${mine ? "-left-1 -translate-x-full" : "-right-1 translate-x-full"} top-1/2 -translate-y-1/2 flex items-center gap-0.5 transition-opacity ${actionsOpen ? "opacity-100" : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={onReply} className="grid h-7 w-7 place-items-center rounded-full bg-white dark:bg-[#233138] border border-[#d1d7db] dark:border-[#2a3942] shadow-sm" aria-label="Reply">
              <Reply className="h-3.5 w-3.5 text-[#54656f] dark:text-[#aebac1]" />
            </button>
            <button onClick={onOpenPicker} className="grid h-7 w-7 place-items-center rounded-full bg-white dark:bg-[#233138] border border-[#d1d7db] dark:border-[#2a3942] shadow-sm" aria-label="React">
              <SmilePlus className="h-3.5 w-3.5 text-[#54656f] dark:text-[#aebac1]" />
            </button>
            {mine && msg.kind === "text" && (
              <button onClick={onEdit} className="grid h-7 w-7 place-items-center rounded-full bg-white dark:bg-[#233138] border border-[#d1d7db] dark:border-[#2a3942] shadow-sm" aria-label="Edit">
                <Pencil className="h-3.5 w-3.5 text-[#54656f] dark:text-[#aebac1]" />
              </button>
            )}
            {mine && (
              <button onClick={onDelete} className="grid h-7 w-7 place-items-center rounded-full bg-white dark:bg-[#233138] border border-[#d1d7db] dark:border-[#2a3942] shadow-sm text-[#ea0038]" aria-label="Delete">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {opening && (
            <div className={`absolute -top-10 ${mine ? "right-0" : "left-0"} z-10 flex gap-1 rounded-full border border-[#d1d7db] dark:border-[#2a3942] bg-white dark:bg-[#233138] px-2 py-1 shadow-lg`}>
              {REACT_EMOJIS.map((e) => (
                <button key={e} onClick={() => onReact(e)} className="text-lg hover:scale-125 transition">{e}</button>
              ))}
            </div>
          )}
        </div>

        {Object.keys(counts).length > 0 && (
          <div className={`mt-0.5 flex flex-wrap gap-1 ${mine ? "justify-end" : "justify-start"}`}>
            {Object.entries(counts).map(([e, n]) => {
              const mineReacted = reactions.some((r) => r.emoji === e && r.user_id === me.id);
              return (
                <button key={e} onClick={() => onReact(e)}
                  className={`flex items-center gap-1 rounded-full border border-[#d1d7db] dark:border-[#2a3942] px-2 py-0.5 text-xs bg-white dark:bg-[#233138] ${mineReacted ? "ring-1 ring-[#00a884]" : ""}`}>
                  <span>{e}</span><span className="text-[10px] text-[#667781] dark:text-[#8696a0]">{n}</span>
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
      <button onClick={toggle} className={`grid h-8 w-8 place-items-center rounded-full ${mine ? "bg-[#00a884]/20" : "bg-[#00a884]/20"}`}>
        {playing ? <Pause className="h-4 w-4 text-[#00a884]" /> : <Play className="h-4 w-4 text-[#00a884]" />}
      </button>
      <div className="flex-1 h-1 rounded-full bg-[#d1d7db] dark:bg-[#2a3942] overflow-hidden">
        <div className="h-full bg-[#00a884]" style={{ width: `${progress * 100}%` }} />
      </div>
      <span className="text-[11px] text-[#667781] dark:text-[#8696a0] tabular-nums">
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
    <div className="relative z-10 border-t border-[#d1d7db] dark:border-[#2a3942] bg-[#f0f2f5] dark:bg-[#1f2c34] px-2 py-2 md:px-4 md:py-3">
      {showEmoji && (
        <div className="absolute bottom-full left-2 mb-2 grid max-w-xs grid-cols-8 gap-1 rounded-2xl border border-[#d1d7db] dark:border-[#2a3942] bg-white dark:bg-[#233138] p-2 shadow-xl md:left-6">
          {EMOJIS.map((e) => (
            <button key={e} onClick={() => setDraft(draft + e)} className="grid h-8 w-8 place-items-center rounded-lg text-lg hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]">{e}</button>
          ))}
        </div>
      )}
      {recording ? (
        <div className="mx-auto flex max-w-[800px] items-center gap-3">
          <button onClick={() => stopRec(true)} className="grid h-11 w-11 place-items-center rounded-full bg-[#f5f6f6] dark:bg-[#202c33] text-[#ea0038]">
            <Trash2 className="h-5 w-5" />
          </button>
          <div className="flex flex-1 items-center gap-2 rounded-full bg-white dark:bg-[#2a3942] px-4 py-3">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#ea0038]" />
            <span className="text-sm text-[#111b21] dark:text-[#e9edef]">Recording… {String(Math.floor(elapsed / 60)).padStart(1, "0")}:{String(elapsed % 60).padStart(2, "0")}</span>
          </div>
          <button onClick={() => stopRec(false)} className="grid h-11 w-11 place-items-center rounded-full bg-[#00a884] text-white shadow-md">
            <Send className="h-5 w-5" />
          </button>
        </div>
      ) : (
        <div className="mx-auto flex max-w-[800px] items-end gap-2">
          <button onClick={() => setShowEmoji((s) => !s)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[#54656f] dark:text-[#aebac1] hover:bg-black/5 dark:hover:bg-white/5">
            <Smile className="h-6 w-6" />
          </button>
          <button onClick={() => fileRef.current?.click()} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[#54656f] dark:text-[#aebac1] hover:bg-black/5 dark:hover:bg-white/5" aria-label="Attach">
            <Paperclip className="h-6 w-6" />
          </button>
          <div className="flex flex-1 items-center rounded-lg bg-white dark:bg-[#2a3942] px-3 py-2">
            <textarea
              value={draft} 
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
              rows={1} 
              placeholder="Type a message"
              className="max-h-32 min-h-5 flex-1 resize-none bg-transparent text-[15px] outline-none placeholder:text-[#667781] dark:placeholder:text-[#8696a0] text-[#111b21] dark:text-[#d1d7db] py-0.5"
            />
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPickFile(e.target.files?.[0])} />
          {draft.trim() ? (
            <button onClick={onSend} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#00a884] text-white shadow-sm hover:bg-[#008f6f]">
              <Send className="h-5 w-5" />
            </button>
          ) : (
            <button onClick={startRec} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[#54656f] dark:text-[#aebac1] hover:bg-black/5 dark:hover:bg-white/5">
              <Mic className="h-6 w-6" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function NewChatModal({ meId, onClose, onCreated }: { meId: string; onClose: () => void; onCreated: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("profiles").select("*").neq("id", meId).order("display_name", { ascending: true }).limit(200);
      if (error) toast.error(error.message);
      setUsers((data ?? []) as Profile[]);
      setLoading(false);
    })();
  }, [meId]);

  const filtered = users.filter((u) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return (u.display_name ?? "").toLowerCase().includes(s) || (u.email ?? "").toLowerCase().includes(s);
  });

  const startWith = async (prof: Profile) => {
    setBusyId(prof.id);
    try {
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
      const { error: m1 } = await supabase.from("chat_members").insert({ chat_id: chat.id, user_id: meId });
      if (m1) throw m1;
      const { error: m2 } = await supabase.from("chat_members").insert({ chat_id: chat.id, user_id: prof.id });
      if (m2) throw m2;
      toast.success(`Chat with ${prof.display_name} created`);
      onCreated(chat.id);
    } catch (e) {
      console.error("startWith failed", e);
      toast.error(`Couldn't start chat: ${(e as Error).message || "unknown error"}`);
    }
    finally { setBusyId(null); }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg border border-[#d1d7db] dark:border-[#2a3942] bg-white dark:bg-[#111b21] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 p-5 pb-3">
          <Users className="h-5 w-5 text-skyblue-deep" />
          <h3 className="text-lg font-semibold text-[#111b21] dark:text-[#e9edef]">New chat</h3>
        </div>
        <div className="px-5 pb-3">
          <div className="flex items-center gap-2 rounded-lg bg-[#f0f2f5] dark:bg-[#1f2c34] px-3 py-2">
            <Search className="h-4 w-4 text-[#54656f] dark:text-[#8696a0]" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people…" className="flex-1 bg-transparent text-sm outline-none text-[#111b21] dark:text-[#e9edef] placeholder:text-[#667781] dark:placeholder:text-[#8696a0]" />
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto px-2 pb-2">
          {loading ? (
            <div className="p-4 text-center text-sm text-[#667781] dark:text-[#8696a0]">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#667781] dark:text-[#8696a0]">No users found</div>
          ) : filtered.map((u) => (
            <button key={u.id} disabled={busyId === u.id} onClick={() => startWith(u)}
              className="flex w-full items-center gap-3 rounded-lg p-3 text-left hover:bg-[#f5f6f6] dark:hover:bg-[#202c33] disabled:opacity-60">
              <Avatar url={u.avatar_url} name={u.display_name} size={40} ai={u.is_ai} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <div className="truncate text-[15px] font-medium text-[#111b21] dark:text-[#e9edef]">{u.display_name}</div>
                  {u.is_ai && <Sparkles className="h-3.5 w-3.5 text-skyblue-deep" />}
                  {u.is_pro && <Crown className="h-3.5 w-3.5 text-skyblue-deep" />}
                </div>
                <div className="truncate text-[13px] text-[#667781] dark:text-[#8696a0]">{u.email}</div>
              </div>
              {busyId === u.id ? <span className="text-xs text-[#667781]">…</span> : <Plus className="h-5 w-5 text-skyblue-deep" />}
            </button>
          ))}
        </div>
        <div className="p-4 pt-2 flex justify-end border-t border-[#e9edef] dark:border-[#222e35]">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-[#111b21] dark:text-[#e9edef] hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]">Close</button>
        </div>
      </div>
    </div>
  );
}

function SettingsModal({ me, onClose, onSaved }: { me: Profile; onClose: () => void; onSaved: (p: Profile) => void }) {
  const [tab, setTab] = useState<"profile" | "advanced" | "subscription">("profile");
  const [name, setName] = useState(me.display_name ?? "");
  const [busy, setBusy] = useState(false);
  const [notif, setNotif] = useState<NotificationPermission>(typeof Notification !== "undefined" ? Notification.permission : "default");

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

  const upgrade = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.from("profiles").update({ is_pro: true }).eq("id", me.id);
      if (error) throw error;
      onSaved({ ...me, is_pro: true });
      toast.success("Welcome to Sona Pro ✨");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  const askNotif = async () => {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setNotif(p);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg border border-[#d1d7db] dark:border-[#2a3942] bg-white dark:bg-[#111b21] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 p-5 pb-3">
          <Settings className="h-5 w-5 text-skyblue-deep" />
          <h3 className="text-lg font-semibold text-[#111b21] dark:text-[#e9edef]">Settings</h3>
          {me.is_pro && <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-skyblue/30 px-2 py-0.5 text-[10px] font-semibold text-skyblue-deep"><Crown className="h-3 w-3" /> Pro</span>}
        </div>
        <div className="px-5 pb-3">
          <div className="flex gap-1 rounded-lg bg-[#f0f2f5] dark:bg-[#1f2c34] p-1 text-sm">
            {(["profile", "advanced", "subscription"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 rounded-md px-2 py-1.5 capitalize text-[13px] ${tab === t ? "bg-white dark:bg-[#2a3942] font-medium shadow-sm text-[#111b21] dark:text-[#e9edef]" : "text-[#667781] dark:text-[#8696a0]"}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 pb-4 max-h-[60vh] overflow-y-auto">
          {tab === "profile" && (
            <div className="space-y-3">
              <div>
                <label className="text-[13px] text-[#667781] dark:text-[#8696a0]">Display name</label>
                <input value={name} onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-[#f0f2f5] dark:bg-[#1f2c34] px-3 py-2.5 text-[15px] outline-none focus:ring-2 focus:ring-skyblue text-[#111b21] dark:text-[#e9edef]" />
              </div>
              <p className="text-[13px] text-[#667781] dark:text-[#8696a0]">Signed in as {me.email}</p>
            </div>
          )}

          {tab === "advanced" && (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg border border-[#e9edef] dark:border-[#222e35] p-3">
                <div className="flex items-center gap-2 font-medium text-[#111b21] dark:text-[#e9edef]"><Bell className="h-4 w-4 text-skyblue-deep" /> Push notifications</div>
                <p className="mt-1 text-[13px] text-[#667781] dark:text-[#8696a0]">Status: {notif}</p>
                {notif !== "granted" && (
                  <button onClick={askNotif} className="mt-2 rounded-lg bg-[#00a884] px-4 py-1.5 text-[13px] text-white hover:bg-[#008f6f]">Enable</button>
                )}
              </div>
              <div className="rounded-lg border border-[#e9edef] dark:border-[#222e35] p-3">
                <div className="flex items-center gap-2 font-medium text-[#111b21] dark:text-[#e9edef]"><Shield className="h-4 w-4 text-skyblue-deep" /> Security</div>
                <ul className="mt-1 space-y-1 text-[13px] text-[#667781] dark:text-[#8696a0]">
                  <li>• End-to-end AES-GCM encryption for hidden chats</li>
                  <li>• Passcodes never leave your device</li>
                  <li>• Row-level security on every message</li>
                </ul>
              </div>
              <div className="rounded-lg border border-[#e9edef] dark:border-[#222e35] p-3">
                <div className="flex items-center gap-2 font-medium text-[#111b21] dark:text-[#e9edef]"><Lock className="h-4 w-4 text-skyblue-deep" /> Hidden chats</div>
                <p className="mt-1 text-[13px] text-[#667781] dark:text-[#8696a0]">Toggle "Hide & encrypt" from the chat menu to store messages encrypted at rest.</p>
              </div>
            </div>
          )}

          {tab === "subscription" && (
            <div className="space-y-3 text-sm">
              <div className="rounded-2xl border border-[#e9edef] dark:border-[#222e35] bg-gradient-to-br from-skyblue/40 to-skyblue-deep/20 p-4">
                <div className="flex items-center gap-2 font-semibold text-[#111b21] dark:text-[#e9edef]"><Crown className="h-4 w-4 text-skyblue-deep" /> Sona Pro</div>
                <ul className="mt-2 space-y-1 text-[13px]">
                  <li>✨ Unlimited AI chat summaries</li>
                  <li>🖼️ Vision — Sona reads your images</li>
                  <li>🔒 Unlimited hidden encrypted chats</li>
                  <li>🎨 Premium themes</li>
                </ul>
                {me.is_pro ? (
                  <div className="mt-3 text-[13px] text-skyblue-deep font-semibold">You're a Pro member 💛</div>
                ) : (
                  <button disabled={busy} onClick={upgrade} className="mt-3 w-full rounded-xl bg-[#00a884] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#008f6f] disabled:opacity-60">
                    Upgrade to Pro
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[#e9edef] dark:border-[#222e35] p-4">
          <button onClick={signOut} className="rounded-lg px-3 py-2 text-sm text-[#ea0038] hover:bg-[#f5f6f6] dark:hover:bg-[#202c33] flex items-center gap-1">
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-[#111b21] dark:text-[#e9edef] hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]">Close</button>
            {tab === "profile" && (
              <button disabled={busy} onClick={save} className="rounded-lg bg-[#00a884] px-4 py-2 text-sm font-medium text-white hover:bg-[#008f6f] disabled:opacity-60">
                {busy ? "…" : "Save"}
              </button>
            )}
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-lg border border-[#d1d7db] dark:border-[#2a3942] bg-white dark:bg-[#111b21] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-3">
          <Lock className="h-5 w-5 text-skyblue-deep" />
          <h3 className="text-lg font-semibold text-[#111b21] dark:text-[#e9edef]">Unlock hidden chat</h3>
        </div>
        <p className="text-[13px] text-[#667781] dark:text-[#8696a0] mb-3">Enter your passcode to decrypt messages. It never leaves your device.</p>
        <input type="password" value={pass} onChange={(e) => setPass(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder="Passcode"
          className="w-full rounded-lg bg-[#f0f2f5] dark:bg-[#1f2c34] px-3 py-2.5 text-[15px] outline-none focus:ring-2 focus:ring-skyblue text-[#111b21] dark:text-[#e9edef]" />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-lg px-4 py-2 text-sm text-[#111b21] dark:text-[#e9edef] hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]">Cancel</button>
          <button onClick={submit} className="rounded-lg bg-[#00a884] px-4 py-2 text-sm font-medium text-white hover:bg-[#008f6f]">Unlock</button>
        </div>
      </div>
    </div>
  );
}
