import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Search, MoreVertical, Paperclip, Smile, Send, Mic, ArrowLeft, Moon, Sun,
  Image as ImageIcon, Plus, X, LogOut, Play, Pause, Trash2, SmilePlus,
  Check, CheckCheck, MessageSquarePlus, Settings, Shield, Sparkles, Lock, Unlock,
  Ban, Reply, Pencil, Crown, Users, Bell, Phone, Video, CheckSquare, Square, BookOpen,
  Download, Share2, GraduationCap, Briefcase, LifeBuoy, PartyPopper, Tag,
  BadgeCheck, FileText, File as FileIcon, Camera, UserPlus, DoorOpen, ShieldOff,
} from "lucide-react";

import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { askSonaAI, summarizeChat } from "@/lib/ai.functions";
import { startPaystackCheckout } from "@/lib/paystack.functions";
import {
  SONA_AI_ID, fmtTime, CHAT_CATEGORIES,
  type ChatRow, type MessageRow, type Profile, type ReactionRow, type MessageReadRow,
  type BlockRow, type ChatCategory, type ChatMemberRole,
} from "@/lib/db";
import { encryptBody, decryptBody, unlockChat, isUnlocked, lockChat } from "@/lib/crypto";
import { playSendSound, playReceiveSound } from "@/lib/sounds";
import { toast } from "sonner";
import sonaLogo from "@/assets/sona-logo.png";
import sonaAi from "@/assets/sona-ai.png";


type ChatWithMeta = ChatRow & {
  memberIds: string[];
  members: Profile[];
  memberRoles: Record<string, ChatMemberRole>;
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

const REACT_EMOJIS = ["❤️","😂","👍","🔥","😮","🙏", "😴"];

function Avatar({ url, name, size = 40, ai = false }: { url?: string | null; name: string; size?: number; ai?: boolean }) {
  if (ai) return <img src={sonaAi} alt="Sona AI" width={size} height={size} loading="lazy" style={{ width: size, height: size }} className="rounded-full object-cover shrink-0 bg-white" />;
  const src = url || `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=F4A261&textColor=2D3436`;
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

async function downloadFile(url: string, filename: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  } catch (e) {
    toast.error("Couldn't download image");
    console.error("downloadFile failed", e);
  }
}

const URL_REGEX = /(https?:\/\/[^\s]+)/g;
const URL_REGEX_TEST = /^https?:\/\/[^\s]+$/;

function linkify(text: string) {
  const parts = text.split(URL_REGEX);
  return parts.map((part, i) =>
    URL_REGEX_TEST.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="underline underline-offset-2 opacity-90 hover:opacity-100 break-all"
      >
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

const categoryMeta: Record<ChatCategory, { emoji: string; label: string; icon: typeof GraduationCap }> = {
  general: { emoji: "💬", label: "General", icon: Users },
  education: { emoji: "📚", label: "Education", icon: GraduationCap },
  business: { emoji: "💼", label: "Business", icon: Briefcase },
  support: { emoji: "🛟", label: "Support", icon: LifeBuoy },
  social: { emoji: "🎉", label: "Social", icon: PartyPopper },
  other: { emoji: "📌", label: "Other", icon: Tag },
};

function explainSupabaseError(err: unknown): { title: string; explanation: string; raw: string } {
  const raw = (err as { message?: string })?.message || String(err);
  const lower = raw.toLowerCase();

  if (lower.includes("column") && lower.includes("does not exist")) {
    return {
      title: "Database is missing a column",
      explanation:
        "The app expects a database column that isn't there yet. This usually means a migration file exists in the repo but hasn't actually been run against your Supabase project. Run `supabase db push`, or paste the migration's SQL into the Supabase SQL Editor and run it manually.",
      raw,
    };
  }
  if (lower.includes("row-level security") || lower.includes("row level security") || lower.includes("policy")) {
    return {
      title: "Blocked by a database permission rule",
      explanation:
        "Supabase's Row-Level Security rejected this action — the database doesn't think you're allowed to do this yet (for example, adding people to a chat before you're a confirmed member of it yourself). If you didn't just change any RLS policies, this is likely a bug in the app's request order rather than something wrong on your end.",
      raw,
    };
  }
  if (lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("network request failed")) {
    return {
      title: "Couldn't reach the database",
      explanation:
        "This looks like a network problem — check your internet connection, and make sure your Supabase project isn't paused (free-tier projects pause after inactivity and need a manual resume from the Supabase dashboard).",
      raw,
    };
  }
  if (lower.includes("jwt") || lower.includes("unauthorized") || lower.includes("401")) {
    return {
      title: "Your session may have expired",
      explanation: "Try signing out and back in — your login session may no longer be valid.",
      raw,
    };
  }
  return {
    title: "Something went wrong",
    explanation: "Here's the exact error from the database, which should help pinpoint the cause:",
    raw,
  };
}

export default function SonaChat() {
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const askAI = useServerFn(askSonaAI);
  const askSummary = useServerFn(summarizeChat);

  const [me, setMe] = useState<Profile | null>(null);
  const [chats, setChats] = useState<ChatWithMeta[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [reactions, setReactions] = useState<ReactionRow[]>([]);
  const [reads, setReads] = useState<MessageReadRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const pendingImageUrl = useMemo(
    () => (pendingImage ? URL.createObjectURL(pendingImage) : null),
    [pendingImage]
  );
  useEffect(() => {
    return () => { if (pendingImageUrl) URL.revokeObjectURL(pendingImageUrl); };
  }, [pendingImageUrl]);
  const [showSidebarMobile, setShowSidebarMobile] = useState(true);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showMemberList, setShowMemberList] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
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

  // Chat selection for bulk delete
  const [selectMode, setSelectMode] = useState(false);
  const [selectedChatIds, setSelectedChatIds] = useState<Set<string>>(new Set());

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
    setLoadingChats(true);
    const { data: memberships } = await supabase
      .from("chat_members").select("chat_id").eq("user_id", me.id);
    const chatIds = (memberships ?? []).map((m: { chat_id: string }) => m.chat_id);
    if (chatIds.length === 0) { setChats([]); setLoadingChats(false); return; }

    const { data: chatRows } = await supabase
      .from("chats").select("*").in("id", chatIds).order("last_message_at", { ascending: false });
    const { data: allMembers } = await supabase
      .from("chat_members").select("chat_id, user_id, role").in("chat_id", chatIds);
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
    const rolesByChat: Record<string, Record<string, ChatMemberRole>> = {};
    (allMembers ?? []).forEach((m: { chat_id: string; user_id: string; role?: ChatMemberRole }) => {
      (memsByChat[m.chat_id] ||= []).push(m.user_id);
      (rolesByChat[m.chat_id] ||= {})[m.user_id] = m.role ?? "member";
    });

    const result: ChatWithMeta[] = (chatRows ?? []).map((c) => {
      const chat = c as ChatRow;
      const ids = memsByChat[chat.id] ?? [];
      return {
        ...chat,
        memberIds: ids,
        members: ids.map((id) => profMap[id]).filter(Boolean),
        memberRoles: rolesByChat[chat.id] ?? {},
        lastMessage: lastByChat[chat.id],
        unread: unreadByChat[chat.id] ?? 0,
      };
    });
    setChats(result);
    setLoadingChats(false);
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
        if (m.chat_id === activeId) {
          setMessages((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, m]);
          if (m.sender_id !== me.id) playReceiveSound();
        }
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

  // Typing indicator
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

  // Global presence
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

  // Auto-mark unread messages as read
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

  // Selection handlers
  const toggleChatSelection = (chatId: string) => {
    setSelectedChatIds((prev) => {
      const next = new Set(prev);
      if (next.has(chatId)) next.delete(chatId);
      else next.add(chatId);
      return next;
    });
  };

  const leaveGroup = async (chatId: string) => {
    if (!me) return;
    if (!confirm("Leave this group? You'll need to be re-added to rejoin.")) return;
    const { error } = await supabase.from("chat_members").delete().eq("chat_id", chatId).eq("user_id", me.id);
    if (error) { toast.error(explainSupabaseError(error).title); return; }
    toast.success("You left the group");
    setShowMemberList(false);
    if (activeId === chatId) setActiveId(null);
    loadChats();
  };

  const deleteGroup = async (chatId: string) => {
    if (!confirm("Delete this group for everyone? This can't be undone.")) return;
    const { error } = await supabase.from("chats").delete().eq("id", chatId);
    if (error) { toast.error(explainSupabaseError(error).title); return; }
    toast.success("Group deleted");
    setShowGroupSettings(false);
    setShowMemberList(false);
    if (activeId === chatId) setActiveId(null);
    loadChats();
  };

  const deleteSelectedChats = async () => {
    if (!me || selectedChatIds.size === 0) return;
    const count = selectedChatIds.size;
    if (!confirm(`Delete ${count} chat${count === 1 ? "" : "s"}? This will remove you from ${count === 1 ? "this chat" : "these chats"}.`)) return;

    let failed = 0;
    for (const cid of selectedChatIds) {
      const { error } = await supabase.from("chat_members").delete().eq("chat_id", cid).eq("user_id", me.id);
      if (error) {
        failed++;
        console.error("Failed to delete chat", cid, error);
      }
    }

    setSelectedChatIds(new Set());
    setSelectMode(false);
    loadChats();

    if (failed === 0) {
      toast.success(count === 1 ? "Chat deleted" : `${count} chats deleted`);
    } else if (failed === count) {
      toast.error(count === 1 ? "Couldn't delete chat" : "Couldn't delete any of the selected chats");
    } else {
      toast.warning(`Deleted ${count - failed} of ${count} chats — ${failed} failed`);
    }
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedChatIds(new Set());
  };

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
    playSendSound();

    const prompt = plaintext;
    const attachedImageUrl = media_url;
    setDraft(""); setPendingImage(null); setShowEmoji(false); setReplyTo(null);

    if (active && !active.is_hidden) {
      const isAI = isAIChat(active);
      const mentionsSona = /(^|\s)@sona\b/i.test(prompt);
       // Only reply when explicitly @mentioned. We deliberately do NOT add
      // Sona as a permanent chat_members row here — doing so used to make
      // isAIChat() return true forever afterwards, which made Sona reply to
      // every future message in the chat and relabeled the whole
      // conversation as "Chat with Sona AI".
      if ((isAI || mentionsSona) && (prompt || attachedImageUrl)) {
        toast.loading("Sona is thinking…", { id: "sona-ai" });
        askAI({ data: { chatId: activeId, prompt: prompt || "What's in this image?", imageUrl: attachedImageUrl } })
          .then(() => toast.dismiss("sona-ai"))
          .catch((e) => toast.error(e.message, { id: "sona-ai" }));
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

  const requirePro = (feature: string): boolean => {
    if (me?.is_pro) return true;
    toast.error(`${feature} is a Sona Pro feature — upgrade in Settings → Subscription.`);
    setShowHeaderMenu(false);
    setShowSettings(true);
    return false;
  };

  const toggleHideChat = async () => {
    if (!active) return;
    if (!active.is_hidden && !requirePro("Hide & encrypt")) return;
    const next = !active.is_hidden;
    const { error } = await supabase.from("chats").update({ is_hidden: next }).eq("id", active.id);
    if (error) { toast.error(error.message); return; }
    toast.success(next ? "Chat hidden — set a passcode to unlock" : "Chat is no longer hidden");
    setShowHeaderMenu(false);
    loadChats();
  };

  const runSummary = async () => {
    if (!activeId) return;
    if (!requirePro("AI chat summary")) return;
    setShowHeaderMenu(false);
    toast.loading("Summarizing…", { id: "sum" });
    try {
      const r = await askSummary({ data: { chatId: activeId } }) as { summary: string };
      setSummary(r.summary);
      toast.success("Summary ready", { id: "sum" });
    } catch (e) { toast.error((e as Error).message, { id: "sum" }); }
  };

  const startCall = (kind: "voice" | "video") => {
    if (!requirePro(kind === "voice" ? "Voice calls" : "Video calls")) return;
    toast.success(`${kind === "voice" ? "Voice" : "Video"} call starting…`);
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
    return <div className="grid min-h-dvh place-items-center text-[#8C8C8C]">Loading Sona…</div>;
  }

  const typingNames = typingOthers
    .map((id) => profiles[id]?.display_name)
    .filter(Boolean) as string[];

  return (
    <div className="h-dvh w-full bg-[#F0EBE3] text-[#2D3436] dark:bg-[#1A1A1A] dark:text-[#E8E8E8]">
      <div className="mx-auto flex h-full max-w-[1400px] overflow-hidden md:p-4">
        <div className="flex h-full w-full overflow-hidden rounded-none bg-white shadow-2xl md:rounded-3xl md:border border-[#E07A5F]/20 dark:bg-[#242424] dark:border-[#E07A5F]/10">
          {/* Sidebar */}
          <aside className={`${showSidebarMobile ? "flex" : "hidden"} relative h-full w-full flex-col border-r border-[#E07A5F]/10 bg-[#FFFDF9] dark:bg-[#1E1E1E] dark:text-[#E8E8E8] md:flex md:w-[32%] md:min-w-[300px] md:max-w-[420px]`}>
            {/* Header */}
            <div className="flex items-center justify-between gap-2 px-4 py-3 bg-[#E07A5F]">
              <div className="flex items-center gap-2 min-w-0">
                <img src={sonaLogo} alt="Sona" width={36} height={36} className="h-9 w-9 rounded-2xl shadow-md bg-white/90" />
                <div className="leading-tight min-w-0">
                  <div className="text-base font-bold truncate text-white">Sona</div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-white/70">talk gold</div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => {
                    const shareUrl = window.location.origin;
                    if (navigator.share) {
                      navigator.share({ title: "Sona", text: "Chat with me on Sona!", url: shareUrl }).catch(() => {});
                    } else {
                      navigator.clipboard.writeText(shareUrl);
                      toast.success("App link copied to clipboard!");
                    }
                  }}
                  className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/20 text-white"
                  aria-label="Share app"
                >
                  <Share2 className="h-4 w-4" />
                </button>
                <button onClick={toggle} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/20 text-white" aria-label="Toggle theme">
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
                <Link to="/learn" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/20 text-white" aria-label="Learn">
                  <BookOpen className="h-4 w-4" />
                </Link>
                <button onClick={() => setShowSettings(true)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/20 text-white" aria-label="Settings">
                  <Settings className="h-4 w-4" />
                </button>

                <button onClick={signOut} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/20 text-white" aria-label="Sign out">
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Selection mode bar */}
            {selectMode && (
              <div className="flex items-center justify-between gap-2 px-4 py-2 bg-[#F4A261]/20 border-b border-[#E07A5F]/10">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#E07A5F]">
                  <CheckSquare className="h-4 w-4" />
                  {selectedChatIds.size} selected
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={deleteSelectedChats} disabled={selectedChatIds.size === 0}
                    className="flex items-center gap-1 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 hover:bg-red-600 transition">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                  <button onClick={exitSelectMode}
                    className="rounded-lg bg-[#2D3436] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#3D4446] transition">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="px-3 pb-2 pt-2">
              <div className="flex items-center gap-2 rounded-full bg-[#F5F0E8] dark:bg-[#2A2A2A] px-3 py-2 border border-[#E07A5F]/10">
                <Search className="h-4 w-4 text-[#8C8C8C]" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search chats" 
                  className="w-full bg-transparent text-sm outline-none placeholder:text-[#8C8C8C] text-[#2D3436] dark:text-[#E8E8E8]" />
              </div>
            </div>

            <div className="scrollbar-thin flex-1 overflow-y-auto pb-24">
              {loadingChats ? (
                <div className="space-y-1 px-2 pt-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
                      <div className="h-12 w-12 shrink-0 rounded-full bg-black/10 dark:bg-white/10" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-2/5 rounded bg-black/10 dark:bg-white/10" />
                        <div className="h-2.5 w-4/5 rounded bg-black/10 dark:bg-white/10" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
              filtered.map((c) => {
                const title = chatTitle(c, c.memberIds.includes(me.id) ? me.id : "");
                const last = c.lastMessage;
                const mine = last?.sender_id === me.id;
                const previewText = last?.kind === "image" ? "📷 Photo" : last?.kind === "voice" ? "🎤 Voice note" : (last?.body ?? "");
                const isActive = c.id === activeId;
                const ai = isAIChat(c);
                const isSelected = selectedChatIds.has(c.id);
                return (
                  <div key={c.id} 
                    onClick={() => {
                      if (selectMode) {
                        toggleChatSelection(c.id);
                      } else {
                        setActiveId(c.id); 
                        setShowSidebarMobile(false);
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (!selectMode) {
                        setSelectMode(true);
                        setSelectedChatIds(new Set([c.id]));
                      }
                    }}
                    className={`flex w-full items-center gap-3 px-3 py-3 text-left transition-colors cursor-pointer hover:bg-[#F4A261]/10 ${isActive ? "bg-[#F4A261]/15" : ""} ${isSelected ? "bg-[#E07A5F]/20" : ""} border-b border-[#E07A5F]/5`}>
                    {selectMode && (
                      <div className="shrink-0" onClick={(e) => { e.stopPropagation(); toggleChatSelection(c.id); }}>
                        {isSelected ? 
                          <CheckSquare className="h-5 w-5 text-[#E07A5F]" /> : 
                          <Square className="h-5 w-5 text-[#8C8C8C]" />
                        }
                      </div>
                    )}
                    <div className="relative shrink-0">
                      <Avatar url={chatAvatarUrl(c, me.id)} name={title} size={50} ai={ai} />
                      {!ai && c.unread > 0 && !selectMode && (
                        <span className="absolute -top-1 -right-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-[#E07A5F] text-white text-[10px] font-bold px-1">
                          {c.unread > 99 ? "99+" : c.unread}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span className="truncate font-semibold text-[#2D3436] dark:text-[#E8E8E8]">{title}</span>
                          {c.is_group && c.category && c.category !== "general" && (
                            <span className="shrink-0 text-[13px]" title={categoryMeta[c.category].label}>
                              {categoryMeta[c.category].emoji}
                            </span>
                          )}
                        </span>
                        <span className={`text-[11px] shrink-0 ${c.unread > 0 ? "text-[#E07A5F] font-semibold" : "text-[#8C8C8C]"}`}>
                          {last ? fmtTime(last.created_at) : ""}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <div className="min-w-0 flex-1 flex items-center gap-1 text-sm text-[#8C8C8C]">
                          {mine && last && <TickIcon status={readStatusFor(last, reads, c.memberIds, me.id)} className="h-3.5 w-3.5 shrink-0" />}
                          <span className="truncate">{previewText}</span>
                        </div>
                        {c.is_hidden && <Lock className="h-3 w-3 text-[#E07A5F] shrink-0" />}
                      </div>
                    </div>
                  </div>
                );
              })
              )}
              {!loadingChats && filtered.length === 0 && <div className="p-6 text-center text-sm text-[#8C8C8C]">No chats yet. Tap + to start one.</div>}
            </div>

            {/* Floating New-Chat FAB */}
            <button
              onClick={() => setShowNewChat(true)}
              aria-label="New chat"
              className="absolute bottom-5 right-5 grid h-14 w-14 place-items-center rounded-full bg-[#E07A5F] text-white shadow-2xl transition hover:scale-105 active:scale-95"
            >
              <MessageSquarePlus className="h-6 w-6" />
            </button>
          </aside>

          {/* Chat panel */}
          <section className={`${showSidebarMobile ? "hidden" : "flex"} h-full min-w-0 flex-1 flex-col md:flex bg-[#F0EBE3] dark:bg-[#1A1A1A]`}>
            {active ? (
              <>
                <header className="relative flex items-center gap-3 border-b border-[#E07A5F]/10 bg-[#FFFDF9] dark:bg-[#242424] px-3 py-2.5 md:px-4">
                  <button onClick={() => setShowSidebarMobile(true)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-[#F4A261]/20 md:hidden" aria-label="Back">
                    <ArrowLeft className="h-4 w-4 text-[#2D3436] dark:text-[#E8E8E8]" />
                  </button>
                  <button
                    onClick={() => active.is_group && setShowMemberList(true)}
                    disabled={!active.is_group}
                    className="shrink-0"
                  >
                    <Avatar url={chatAvatarUrl(active, me.id)} name={chatTitle(active, me.id)} ai={isAIChat(active)} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <button
                      onClick={() => active.is_group && setShowMemberList(true)}
                      className="truncate font-semibold flex items-center gap-1.5 text-[#2D3436] dark:text-[#E8E8E8] text-left"
                    >
                      {chatTitle(active, me.id)}
                      {active.is_hidden && <Lock className="h-3.5 w-3.5 text-[#E07A5F]" />}
                      {active.memberRoles[me.id] === "admin" && active.is_group && (
                        <BadgeCheck className="h-3.5 w-3.5 text-[#4FA6E0]" />
                      )}
                      {active.is_group && active.category && active.category !== "general" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#E07A5F]/10 px-2 py-0.5 text-[10px] font-medium text-[#E07A5F]">
                          {categoryMeta[active.category].emoji} {categoryMeta[active.category].label}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => active.is_group && setShowMemberList(true)}
                      className="truncate text-xs text-[#8C8C8C] text-left w-full"
                    >
                      {typingNames.length > 0 ? (
                        <span className="text-[#E07A5F]">{typingNames.join(", ")} typing…</span>
                      ) : isAIChat(active) ? (
                        "AI companion · always on"
                      ) : active.is_group ? (
                        active.members.map((m) => m.display_name).join(", ")
                      ) : (() => {
                        const otherId = active.memberIds.find((id) => id !== me.id);
                        const online = otherId ? onlineIds.has(otherId) : false;
                        return online ? (
                          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> online</span>
                        ) : (
                          <span>offline · last seen recently</span>
                        );
                      })()}
                    </button>
                  </div>

                  {/* Call / Video buttons */}
                  {!isAIChat(active) && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => startCall("voice")} className="grid h-9 w-9 place-items-center rounded-full hover:bg-[#F4A261]/20 text-[#E07A5F]" aria-label="Voice call">
                        <Phone className="h-6 w-6" />
                      </button>
                      <button onClick={() => startCall("video")} className="grid h-9 w-9 place-items-center rounded-full hover:bg-[#F4A261]/20 text-[#E07A5F]" aria-label="Video call">
                        <Video className="h-6 w-6" />
                      </button>

                    </div>
                  )}

                  <button onClick={() => setShowHeaderMenu((s) => !s)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-[#F4A261]/20" aria-label="Menu">
                    <MoreVertical className="h-8 w-8 text-[#2D3436] dark:text-[#E8E8E8]" />
                  </button>
                  {showHeaderMenu && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setShowHeaderMenu(false)} />
                      <div className="absolute right-3 top-14 z-40 w-56 rounded-xl border border-[#E07A5F]/10 bg-[#FFFDF9] dark:bg-[#2A2A2A] p-1 shadow-xl">
                        <button onClick={runSummary} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-[#F4A261]/10 text-[#2D3436] dark:text-[#E8E8E8]">
                          <Sparkles className="h-4 w-4 text-[#E07A5F]" /> Summarize chat
                          {!me.is_pro && <Crown className="h-3 w-3 ml-auto text-[#E07A5F]" />}
                        </button>
                        <button onClick={toggleHideChat} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-[#F4A261]/10 text-[#2D3436] dark:text-[#E8E8E8]">
                          {active.is_hidden ? <><Unlock className="h-4 w-4 text-[#8C8C8C]" /> Unhide chat</> : <><Shield className="h-4 w-4 text-[#8C8C8C]" /> Hide & encrypt</>}
                          {!me.is_pro && !active.is_hidden && <Crown className="h-3 w-3 ml-auto text-[#E07A5F]" />}
                        </button>

                        {active.is_hidden && isUnlocked(active.id) && (
                          <button onClick={relock} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-[#F4A261]/10 text-[#2D3436] dark:text-[#E8E8E8]">
                            <Lock className="h-4 w-4 text-[#8C8C8C]" /> Lock now
                          </button>
                        )}
                        {!isAIChat(active) && !active.is_group && (
                          <button onClick={blockOther} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
                            <Ban className="h-4 w-4" /> Block user
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </header>

                <div ref={scrollRef} className="scrollbar-thin flex-1 overflow-y-auto px-3 py-4 md:px-8 chat-pattern">
                  <div className="mx-auto flex max-w-3xl flex-col gap-0.5">
                    <div className="mx-auto rounded-full bg-[#F4A261]/20 px-4 py-1.5 text-[11px] text-[#8C8C8C] backdrop-blur mb-3 border border-[#E07A5F]/10">
                      {isAIChat(active) ? "Chat with Sona AI ✨" : "Type @sona to summon the AI"}
                    </div>
                    {messages.map((m, idx) => {
                      const prev = messages[idx - 1];
                      const groupWithPrev = prev && prev.sender_id === m.sender_id
                        && new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 60_000;
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
                          isGroup={!!active.is_group}
                          reactions={reactions.filter((r) => r.message_id === m.id)}
                          reads={reads}
                          otherMemberIds={active.memberIds.filter((id) => id !== me.id)}
                          onReact={(emoji) => toggleReaction(m.id, emoji)}
                          opening={reactingOn === m.id}
                          onOpenPicker={() => setReactingOn(reactingOn === m.id ? null : m.id)}
                          grouped={!!groupWithPrev}
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
                        <div className="rounded-2xl rounded-bl-md bg-white dark:bg-[#2A2A2A] text-[#2D3436] dark:text-[#E8E8E8] shadow-sm px-3 py-2.5 flex items-center gap-1 border border-[#E07A5F]/10">
                          <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[#E07A5F] inline-block animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[#E07A5F] inline-block animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[#E07A5F] inline-block animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {(replyTo || editing) && (
                  <div className="border-t border-[#E07A5F]/10 bg-[#FFFDF9] dark:bg-[#242424] px-3 py-2 md:px-6">
                    <div className="mx-auto flex max-w-3xl items-center gap-3">
                      <div className="flex-1 rounded-lg border-l-2 border-[#E07A5F] bg-[#F5F0E8] dark:bg-[#2A2A2A] px-3 py-1.5 text-xs">
                        <div className="font-semibold text-[#E07A5F] flex items-center gap-1">
                          {editing ? (<><Pencil className="h-3 w-3" /> Editing message</>) : (<><Reply className="h-3 w-3" /> Replying to {replyTo && (replyTo.sender_id === me?.id ? "yourself" : profiles[replyTo.sender_id]?.display_name ?? "…")}</>)}
                        </div>
                        <div className="truncate opacity-80 text-[#2D3436] dark:text-[#E8E8E8]">
                          {editing ? (editing.body ?? "") : (replyTo?.body ?? (replyTo?.kind === "image" ? "📷 Photo" : replyTo?.kind === "voice" ? "🎤 Voice note" : ""))}
                        </div>
                      </div>
                      <button onClick={() => { setReplyTo(null); setEditing(null); if (editing) setDraft(""); }} className="grid h-8 w-8 place-items-center rounded-full hover:bg-[#F4A261]/20" aria-label="Cancel">
                        <X className="h-4 w-4 text-[#2D3436] dark:text-[#E8E8E8]" />
                      </button>
                    </div>
                  </div>
                )}

                {pendingImage && pendingImageUrl && (
                  <div className="border-t border-[#E07A5F]/10 bg-[#FFFDF9] dark:bg-[#242424] px-3 py-3 md:px-6">
                    <div className="mx-auto flex max-w-3xl flex-col items-center gap-2">
                      <div className="relative flex w-full justify-center">
                        <img
                          src={pendingImageUrl}
                          alt=""
                          className="max-h-[25vh] max-w-[25vw] w-auto h-auto rounded-lg object-contain border border-[#E07A5F]/20 bg-black/5"
                        />
                        <button
                          onClick={() => setPendingImage(null)}
                          aria-label="Remove image"
                          className="absolute -top-2 -right-2 grid h-8 w-8 place-items-center rounded-full bg-[#2D3436] shadow-md hover:bg-black"
                        >
                          <X className="h-4 w-4 text-white" />
                        </button>
                      </div>
                      <span className="text-sm text-[#8C8C8C] truncate max-w-full">{pendingImage.name}</span>
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
              <div className="grid flex-1 place-items-center p-6 text-center text-[#8C8C8C] chat-pattern">
                <div>
                  <img src={sonaLogo} alt="" className="mx-auto h-24 w-24 opacity-60" />
                  <p className="mt-4 text-[#8C8C8C]">Pick a chat or tap + to start a new one.</p>
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
          <div className="w-full max-w-md rounded-2xl border border-[#E07A5F]/10 bg-[#FFFDF9] dark:bg-[#2A2A2A] p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-[#E07A5F]" />
              <h3 className="text-base font-semibold text-[#2D3436] dark:text-[#E8E8E8]">Chat summary</h3>
            </div>
            <p className="whitespace-pre-wrap text-sm text-[#8C8C8C]">{summary}</p>
            <div className="mt-4 flex justify-end">
              <button onClick={() => setSummary(null)} className="rounded-xl bg-[#F5F0E8] dark:bg-[#3A3A3A] px-3 py-2 text-sm text-[#2D3436] dark:text-[#E8E8E8] hover:bg-[#F4A261]/20 transition">Close</button>
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
  if (status === "read") return <CheckCheck className={`${className ?? ""} text-[#E07A5F]`} />;
  if (status === "delivered") return <CheckCheck className={className} />;
  return <Check className={className} />;
}

function Bubble({
  msg, me, sender, reactions, reads, otherMemberIds, onReact, opening, onOpenPicker, grouped, isGroup,
  overrideBody, onDelete, onReply, onEdit, parentName, parentBody, actionsOpen, onToggleActions,
}: {
  msg: MessageRow; me: Profile; sender?: Profile; reactions: ReactionRow[];
  reads: MessageReadRow[]; otherMemberIds: string[];
  onReact: (emoji: string) => void; opening: boolean; onOpenPicker: () => void; grouped: boolean; isGroup: boolean;
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
    <div className={`group flex items-end gap-2 ${mine ? "justify-end" : "justify-start"} ${grouped ? "mt-0.5" : "mt-2"}`}>
      {!mine && isGroup && !grouped && (
        <Avatar url={sender?.avatar_url} name={sender?.display_name ?? "?"} size={28} ai={isAI} />
      )}
      {!mine && isGroup && grouped && <div className="w-7 shrink-0" />}
      <div className="relative max-w-[78%]">
        <div onClick={onToggleActions} className={`relative cursor-pointer px-3 py-2 text-sm shadow-sm ${
          mine
            ? `bg-[#E07A5F] text-white rounded-2xl ${grouped ? "rounded-br-2xl" : "rounded-br-sm"}`
            : `bg-white dark:bg-[#2A2A2A] text-[#2D3436] dark:text-[#E8E8E8] rounded-2xl ${grouped ? "rounded-bl-2xl" : "rounded-bl-sm"} border border-[#E07A5F]/10`
        }`}>

          {!mine && !grouped && (isAI || isGroup) && (
  <div className="mb-0.5 text-[11px] text-[#E07A5F] flex items-center gap-1">
    {isAI ? (
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 font-semibold text-emerald-400 text-sm">
          <Sparkles className="h-3.5 w-3.5" />
          Sona AI
        </span>

        <span className="text-[11px] text-gray-400 hover:text-emerald-400 transition-colors cursor-pointer">
          Learn more
        </span>
      </div>
    ) : (
      <span className="text-xs font-medium text-gray-400">
        ~{sender?.display_name ?? "Sonatg"}
      </span>
    )}
  </div>
)}
          {parentBody !== undefined && (
            <div className={`mb-1.5 rounded-lg border-l-2 border-[#E07A5F] px-2 py-1 text-[11px] ${mine ? "bg-black/10" : "bg-[#F5F0E8] dark:bg-white/5"}`}>
              <div className="font-semibold text-[#E07A5F]">{parentName}</div>
              <div className="truncate opacity-80 max-w-[240px]">{parentBody}</div>
            </div>
          )}
          {msg.kind === "image" && msg.media_url && (
            <div className="relative mb-1 group/image">
              <img src={msg.media_url} alt="" loading="lazy" className="max-h-72 w-full rounded-xl object-cover" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  downloadFile(msg.media_url!, `sona-photo-${msg.id}.jpg`);
                }}
                aria-label="Download image"
                className="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-black/50 text-white backdrop-blur-sm opacity-80 hover:opacity-100 active:scale-95 transition"
              >
                <Download className="h-4 w-4" />
              </button>
            </div>
          )}
          {msg.kind === "voice" && msg.media_url && (
            <VoicePlayer
              url={msg.media_url}
              durationMs={msg.duration_ms ?? 0}
              mine={mine}
              avatarUrl={sender?.avatar_url}
              avatarName={sender?.display_name ?? "?"}
            />
          )}
          {(overrideBody ?? msg.body) && <p className="whitespace-pre-wrap break-words leading-relaxed pr-12">{linkify(overrideBody ?? msg.body ?? "")}</p>}
          <div className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${mine ? "text-white/80" : "text-[#8C8C8C]"}`}>
            {msg.edited_at && <span className="italic">edited</span>}
            <span>{fmtTime(msg.created_at)}</span>
            {mine && <TickIcon status={status} className="h-3.5 w-3.5" />}
          </div>
          {/* Action rail */}
          <div className={`absolute ${mine ? "-left-2 -translate-x-full" : "-right-2 translate-x-full"} top-1/2 -translate-y-1/2 flex items-center gap-1 transition ${actionsOpen ? "opacity-100" : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto"}`}
            onClick={(e) => e.stopPropagation()}>
            <button onClick={onReply} className="grid h-7 w-7 place-items-center rounded-full bg-[#FFFDF9] dark:bg-[#3A3A3A] border border-[#E07A5F]/20 shadow-sm" aria-label="Reply">
              <Reply className="h-3.5 w-3.5 text-[#E07A5F]" />
            </button>
            <button onClick={onOpenPicker} className="grid h-7 w-7 place-items-center rounded-full bg-[#FFFDF9] dark:bg-[#3A3A3A] border border-[#E07A5F]/20 shadow-sm" aria-label="React">
              <SmilePlus className="h-3.5 w-3.5 text-[#E07A5F]" />
            </button>
            {mine && msg.kind === "text" && (
              <button onClick={onEdit} className="grid h-7 w-7 place-items-center rounded-full bg-[#FFFDF9] dark:bg-[#3A3A3A] border border-[#E07A5F]/20 shadow-sm" aria-label="Edit">
                <Pencil className="h-3.5 w-3.5 text-[#E07A5F]" />
              </button>
            )}
            {mine && (
              <button onClick={onDelete} className="grid h-7 w-7 place-items-center rounded-full bg-[#FFFDF9] dark:bg-[#3A3A3A] border border-[#E07A5F]/20 shadow-sm text-red-500" aria-label="Delete">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {opening && (
            <div className={`absolute -top-10 ${mine ? "right-0" : "left-0"} z-10 flex gap-1 rounded-full border border-[#E07A5F]/10 bg-[#FFFDF9] dark:bg-[#2A2A2A] px-2 py-1 shadow-lg`}>
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
                  className={`flex items-center gap-1 rounded-full border border-[#E07A5F]/20 px-2 py-0.5 text-xs bg-[#FFFDF9] dark:bg-[#2A2A2A] ${mineReacted ? "ring-1 ring-[#E07A5F]" : ""}`}>
                  <span>{e}</span><span className="text-[10px] text-[#8C8C8C]">{n}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function waveformBars(seed: string, count = 32): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    bars.push(0.25 + (h % 1000) / 1000 * 0.75); // 0.25–1.0 range, never fully flat
  }
  return bars;
}

function VoicePlayer({ url, durationMs, mine, avatarUrl, avatarName }: { url: string; durationMs: number; mine: boolean; avatarUrl?: string | null; avatarName?: string }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hasPlayed, setHasPlayed] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bars = useMemo(() => waveformBars(url), [url]);

  useEffect(() => {
    const a = new Audio(url);
    audioRef.current = a;
    a.addEventListener("timeupdate", () => setProgress(a.duration ? a.currentTime / a.duration : 0));
    a.addEventListener("ended", () => { setPlaying(false); setProgress(0); });
    return () => { a.pause(); audioRef.current = null; };
  }, [url]);

  const toggle = () => {
    const a = audioRef.current; if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play(); setPlaying(true); setHasPlayed(true); }
  };

  const secs = Math.round(durationMs / 1000);
  const filledColor = mine ? "bg-white" : "bg-[#E07A5F]";
  const mutedColor = mine ? "bg-white/35" : "bg-[#E07A5F]/30";

  return (
    <div className="min-w-[240px] py-1">
      <div className="flex items-center gap-2">
        <button onClick={toggle} className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${mine ? "bg-white/25 text-white" : "bg-[#E07A5F]/15 text-[#E07A5F]"}`}>
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
        </button>

        {/* Unplayed indicator dot, WhatsApp-style — disappears once played */}
        {!hasPlayed && (
          <span className={`h-2 w-2 shrink-0 rounded-full ${mine ? "bg-white" : "bg-[#4FA6E0]"}`} />
        )}

        {/* Waveform */}
        <button onClick={toggle} className="flex flex-1 items-center gap-[2px] h-8" aria-label={playing ? "Pause" : "Play"}>
          {bars.map((h, i) => {
            const barProgress = i / bars.length;
            const isFilled = barProgress <= progress;
            return (
              <span
                key={i}
                className={`w-[3px] rounded-full transition-colors ${isFilled ? filledColor : mutedColor}`}
                style={{ height: `${Math.round(h * 100)}%` }}
              />
            );
          })}
        </button>

        {/* Sender avatar with a mic badge, WhatsApp-style */}
        <div className="relative shrink-0">
          <Avatar url={avatarUrl} name={avatarName ?? "?"} size={38} />
          <span className={`absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full ring-2 ${mine ? "bg-white text-[#E07A5F] ring-[#E07A5F]" : "bg-[#E07A5F] text-white ring-white dark:ring-[#2A2A2A]"}`}>
            <Mic className="h-2.5 w-2.8" />
          </span>
        </div>
      </div>

      <div className="mt-1 flex items-center justify-between pl-11">
        <button
          onClick={(e) => { e.stopPropagation(); toast.info("Transcription is coming soon"); }}
          className={`text-[11px] font-medium ${mine ? "text-white/90" : "text-[#E07A5F]"} hover:underline`}
        >
          Transcribe
        </button>
        <span className={`text-[10px] tabular-nums ${mine ? "text-white/70" : "text-[#8C8C8C]"}`}>
          {String(Math.floor(secs / 60)).padStart(1, "0")}:{String(secs % 60).padStart(2, "0")}
        </span>
      </div>
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
    <div className="relative border-t border-[#E07A5F]/10 bg-[#FFFDF9] dark:bg-[#242424] px-2 py-2 md:px-6 md:py-3">
      {showEmoji && (
        <div className="absolute bottom-full left-2 mb-2 grid max-h-56 max-w-xs grid-cols-8 gap-1 overflow-y-auto rounded-2xl border border-[#E07A5F]/10 bg-[#FFFDF9] dark:bg-[#2A2A2A] p-2 shadow-xl md:left-6">
          {EMOJIS.map((e) => (
            <button key={e} onClick={() => setDraft(draft + e)} className="grid h-8 w-8 place-items-center rounded-lg text-lg hover:bg-[#F4A261]/20">{e}</button>
          ))}
        </div>
      )}
      {recording ? (
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <button onClick={() => stopRec(true)} className="grid h-11 w-11 place-items-center rounded-full bg-[#F5F0E8] dark:bg-[#3A3A3A] text-red-500"><Trash2 className="h-5 w-5" /></button>
          <div className="flex flex-1 items-center gap-2 rounded-3xl bg-[#F5F0E8] dark:bg-[#2A2A2A] px-4 py-3 border border-[#E07A5F]/10">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
            <span className="text-sm text-[#2D3436] dark:text-[#E8E8E8]">Recording… {String(Math.floor(elapsed / 60)).padStart(1, "0")}:{String(elapsed % 60).padStart(2, "0")}</span>
          </div>
          <button onClick={() => stopRec(false)} className="grid h-11 w-11 place-items-center rounded-full bg-[#E07A5F] text-white shadow-md hover:bg-[#D4694F] transition"><Send className="h-5 w-5" /></button>
        </div>
      ) : (
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <div className="flex flex-1 items-center gap-1.5 rounded-3xl bg-[#F5F0E8] dark:bg-[#2A2A2A] px-2 py-1.5 border border-[#E07A5F]/10">
            <button onClick={() => setShowEmoji((s) => !s)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#8C8C8C] hover:bg-[#F4A261]/20"><Smile className="h-5 w-5" /></button>
            <textarea
              value={draft} onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
              rows={1} placeholder="Type a message · @sona for AI"
              className="max-h-32 min-h-6 flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-[#8C8C8C] text-[#2D3436] dark:text-[#E8E8E8] py-1.5"
            />
            <button onClick={() => fileRef.current?.click()} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#8C8C8C] hover:bg-[#F4A261]/20" aria-label="Attach"><Paperclip className="h-5 w-5" /></button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPickFile(e.target.files?.[0])} />
            <button onClick={() => fileRef.current?.click()} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#8C8C8C] hover:bg-[#F4A261]/20" aria-label="Image"><ImageIcon className="h-5 w-5" /></button>
          </div>
          {draft.trim() ? (
            <button onClick={onSend} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#E07A5F] text-white shadow-md hover:bg-[#D4694F] transition"><Send className="h-5 w-5" /></button>
          ) : (
            <button onClick={startRec} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#E07A5F] text-white shadow-md hover:bg-[#D4694F] transition"><Mic className="h-5 w-5" /></button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Member list modal: view all participants, admin badges, leave group ───
function MemberListModal({
  chat, meId, isAdmin, onClose, onOpenSettings, onLeave,
}: {
  chat: ChatWithMeta; meId: string; isAdmin: boolean;
  onClose: () => void; onOpenSettings: () => void; onLeave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50" onClick={onClose}>
      <div
        className="w-full max-h-[80vh] flex flex-col rounded-t-3xl border-t border-[#E07A5F]/10 bg-[#FFFDF9] dark:bg-[#2A2A2A] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pt-2.5 pb-1 flex justify-center">
          <div className="h-1.5 w-10 rounded-full bg-[#E07A5F]/30" />
        </div>
        <div className="px-5 pt-2 pb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-[#2D3436] dark:text-[#E8E8E8]">
            {chat.title || "Group"} · {chat.members.length} {chat.members.length === 1 ? "member" : "members"}
          </h3>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-[#F4A261]/20" aria-label="Close">
            <X className="h-4 w-4 text-[#2D3436] dark:text-[#E8E8E8]" />
          </button>
        </div>

        <div className="scrollbar-thin flex-1 overflow-y-auto px-2 pb-2">
          {chat.members.map((m) => {
            const role = chat.memberRoles[m.id] ?? "member";
            return (
              <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg">
                <Avatar url={m.avatar_url} name={m.display_name} size={40} ai={m.is_ai} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-[#2D3436] dark:text-[#E8E8E8]">
                      {m.display_name}{m.id === meId ? " (you)" : ""}
                    </span>
                    {role === "admin" && <BadgeCheck className="h-3.5 w-3.5 text-[#4FA6E0] shrink-0" titleAccess="Admin" />}
                  </div>
                  <span className="text-xs text-[#8C8C8C]">{role === "admin" ? "Admin" : "Member"}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-5 pb-6 pt-2 border-t border-[#E07A5F]/10 space-y-2">
          {isAdmin && (
            <button
              onClick={onOpenSettings}
              className="w-full flex items-center justify-center gap-2 rounded-full bg-[#E07A5F] py-2.5 text-sm font-semibold text-white hover:opacity-90 transition"
            >
              <Settings className="h-4 w-4" /> Group settings
            </button>
          )}
          <button
            onClick={onLeave}
            className="w-full flex items-center justify-center gap-2 rounded-full border border-red-300 dark:border-red-500/30 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
          >
            <DoorOpen className="h-4 w-4" /> Leave group
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Group settings modal (admin-only entry point): rename, re-photo, add members, delete ───
function GroupSettingsModal({
  chat, meId, onClose, onUpdated, onDelete,
}: {
  chat: ChatWithMeta; meId: string; onClose: () => void;
  onUpdated: () => void; onDelete: () => void;
}) {
  const [title, setTitle] = useState(chat.title ?? "");
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const avatarPreview = useMemo(() => (avatarFile ? URL.createObjectURL(avatarFile) : null), [avatarFile]);
  useEffect(() => () => { if (avatarPreview) URL.revokeObjectURL(avatarPreview); }, [avatarPreview]);

  const [addOpen, setAddOpen] = useState(false);
  const [candidates, setCandidates] = useState<Profile[]>([]);
  const [addSelected, setAddSelected] = useState<Set<string>>(new Set());
  const [addBusy, setAddBusy] = useState(false);

  useEffect(() => {
    if (!addOpen) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("*").not("id", "in", `(${chat.memberIds.join(",")})`).limit(200);
      setCandidates((data ?? []) as Profile[]);
    })();
  }, [addOpen, chat.memberIds]);

  const save = async () => {
    setSaving(true);
    try {
      let avatar_url = chat.avatar_url;
      if (avatarFile) {
        const path = `${chat.id}/${meId}/group-avatar-${crypto.randomUUID()}-${avatarFile.name}`;
        const { error: upErr } = await supabase.storage.from("chat-media").upload(path, avatarFile);
        if (upErr) throw upErr;
        const { data: signed } = await supabase.storage.from("chat-media").createSignedUrl(path, 60 * 60 * 24 * 365);
        avatar_url = signed?.signedUrl ?? avatar_url;
      }
      const { error } = await supabase.from("chats").update({ title: title.trim() || chat.title, avatar_url }).eq("id", chat.id);
      if (error) throw error;
      toast.success("Group updated");
      onUpdated();
      onClose();
    } catch (e) {
      const explained = explainSupabaseError(e);
      toast.error(explained.title);
    } finally {
      setSaving(false);
    }
  };

  const addMembers = async () => {
    if (addSelected.size === 0) return;
    setAddBusy(true);
    try {
      const rows = Array.from(addSelected).map((user_id) => ({ chat_id: chat.id, user_id }));
      const { error } = await supabase.from("chat_members").insert(rows);
      if (error) throw error;
      toast.success(`Added ${addSelected.size} ${addSelected.size === 1 ? "person" : "people"}`);
      setAddOpen(false);
      setAddSelected(new Set());
      onUpdated();
    } catch (e) {
      toast.error(explainSupabaseError(e).title);
    } finally {
      setAddBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[55] flex flex-col justify-end bg-black/50" onClick={onClose}>
      <div
        className="w-full max-h-[85vh] flex flex-col rounded-t-3xl border-t border-[#E07A5F]/10 bg-[#FFFDF9] dark:bg-[#2A2A2A] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pt-2.5 pb-1 flex justify-center">
          <div className="h-1.5 w-10 rounded-full bg-[#E07A5F]/30" />
        </div>
        <div className="px-5 pt-2 pb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-[#2D3436] dark:text-[#E8E8E8]">Group settings</h3>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-[#F4A261]/20" aria-label="Close">
            <X className="h-4 w-4 text-[#2D3436] dark:text-[#E8E8E8]" />
          </button>
        </div>

        <div className="scrollbar-thin flex-1 overflow-y-auto px-5 pb-4 space-y-4">
          {/* Avatar */}
          <div className="flex justify-center">
            <label className="relative cursor-pointer">
              <Avatar url={avatarPreview ?? chat.avatar_url} name={chat.title ?? "Group"} size={84} />
              <span className="absolute bottom-0 right-0 grid h-7 w-7 place-items-center rounded-full bg-[#E07A5F] text-white ring-2 ring-[#FFFDF9] dark:ring-[#2A2A2A]">
                <Camera className="h-3.5 w-3.5" />
              </span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>

          {/* Name */}
          <div>
            <label className="text-xs font-medium text-[#8C8C8C]">Group name</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-xl bg-[#F5F0E8] dark:bg-[#3A3A3A] px-3 py-2.5 text-sm outline-none text-[#2D3436] dark:text-[#E8E8E8] border border-[#E07A5F]/10"
            />
          </div>

          {/* Add members */}
          <div>
            <button
              onClick={() => setAddOpen((v) => !v)}
              className="w-full flex items-center gap-2 rounded-xl bg-[#F5F0E8] dark:bg-[#3A3A3A] px-3 py-2.5 text-sm font-medium text-[#2D3436] dark:text-[#E8E8E8]"
            >
              <UserPlus className="h-4 w-4 text-[#E07A5F]" /> Add members
              {addSelected.size > 0 && <span className="ml-auto text-xs text-[#E07A5F]">{addSelected.size} selected</span>}
            </button>
            {addOpen && (
              <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-[#E07A5F]/10">
                {candidates.length === 0 ? (
                  <p className="p-3 text-center text-xs text-[#8C8C8C]">Everyone's already in this group.</p>
                ) : candidates.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setAddSelected((prev) => {
                      const next = new Set(prev);
                      if (next.has(u.id)) next.delete(u.id); else next.add(u.id);
                      return next;
                    })}
                    className="flex w-full items-center gap-3 border-b border-[#E07A5F]/5 p-2.5 last:border-0 hover:bg-[#F4A261]/10"
                  >
                    <Avatar url={u.avatar_url} name={u.display_name} size={32} />
                    <span className="flex-1 truncate text-sm text-left text-[#2D3436] dark:text-[#E8E8E8]">{u.display_name}</span>
                    {addSelected.has(u.id) ? <CheckSquare className="h-4 w-4 text-[#E07A5F]" /> : <Square className="h-4 w-4 text-[#8C8C8C]" />}
                  </button>
                ))}
                {candidates.length > 0 && (
                  <button
                    onClick={addMembers}
                    disabled={addBusy || addSelected.size === 0}
                    className="w-full py-2 text-sm font-semibold text-white bg-[#E07A5F] disabled:opacity-50"
                  >
                    {addBusy ? "Adding…" : "Add selected"}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Danger zone */}
          <div className="pt-2 border-t border-[#E07A5F]/10">
            <button
              onClick={onDelete}
              className="w-full flex items-center justify-center gap-2 rounded-full border border-red-300 dark:border-red-500/30 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
            >
              <Trash2 className="h-4 w-4" /> Delete group
            </button>
          </div>
        </div>

        <div className="px-5 pb-6 pt-2 border-t border-[#E07A5F]/10">
          <button
            onClick={save}
            disabled={saving}
            className="w-full rounded-full bg-[#E07A5F] py-3 text-sm font-semibold text-white shadow-md hover:opacity-90 disabled:opacity-60 transition"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function NewChatModal({ meId, onClose, onCreated }: { meId: string; onClose: () => void; onCreated: (id: string) => void }) {
  const [mode, setMode] = useState<"direct" | "group">("direct");
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Group-mode state
  const [groupTitle, setGroupTitle] = useState("");
  const [category, setCategory] = useState<ChatCategory>("general");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupError, setGroupError] = useState<{ title: string; explanation: string; raw: string } | null>(null);

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
      const explained = explainSupabaseError(e);
      toast.error(explained.title);
      setGroupError(explained);
    }
    finally { setBusyId(null); }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const createGroup = async () => {
    if (!groupTitle.trim()) return toast.error("Give your group a name");
    if (selectedIds.size === 0) return toast.error("Pick at least one person to add");
    setCreatingGroup(true);
    try {
      const { data: chat, error: cErr } = await supabase
        .from("chats")
        .insert({ is_group: true, title: groupTitle.trim(), category, created_by: meId })
        .select()
        .single();
      if (cErr) throw cErr;
    
      const { error: selfErr } = await supabase.from("chat_members").insert({ chat_id: chat.id, user_id: meId });
      if (selfErr) throw selfErr;

      const otherRows = Array.from(selectedIds).map((user_id) => ({ chat_id: chat.id, user_id }));
      if (otherRows.length) {
        const { error: mErr } = await supabase.from("chat_members").insert(otherRows);
        if (mErr) throw mErr;
      }

      toast.success(`"${groupTitle.trim()}" group created`);
      onCreated(chat.id);
    } catch (e) {
      console.error("createGroup failed", e);
      const explained = explainSupabaseError(e);
      toast.error(explained.title);
      setGroupError(explained);
    } finally {
      setCreatingGroup(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="w-full rounded-t-3xl border-t border-[#E07A5F]/10 bg-[#FFFDF9] dark:bg-[#2A2A2A] shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grabber */}
        <div className="pt-2.5 pb-1 flex justify-center">
          <div className="h-1.5 w-10 rounded-full bg-[#E07A5F]/30" />
        </div>
        <div className="px-5 pt-2 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[#E07A5F]" />
            <h3 className="text-base font-semibold text-[#2D3436] dark:text-[#E8E8E8]">
              {mode === "direct" ? "Choose a friend" : "New group"}
            </h3>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-[#F4A261]/20" aria-label="Close">
            <X className="h-4 w-4 text-[#2D3436] dark:text-[#E8E8E8]" />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="px-5 pb-3 flex gap-2">
          <button
            onClick={() => setMode("direct")}
            className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition ${mode === "direct" ? "bg-[#E07A5F] text-white" : "bg-[#F5F0E8] dark:bg-[#3A3A3A] text-[#8C8C8C]"}`}
          >
            Direct message
          </button>
          <button
            onClick={() => setMode("group")}
            className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition ${mode === "group" ? "bg-[#E07A5F] text-white" : "bg-[#F5F0E8] dark:bg-[#3A3A3A] text-[#8C8C8C]"}`}
          >
            New group
          </button>
        </div>

        {mode === "group" && (
          <div className="px-5 pb-3 space-y-3">
            <input
              value={groupTitle}
              onChange={(e) => setGroupTitle(e.target.value)}
              placeholder="Group name (e.g. Grade 11 Study Group)"
              className="w-full rounded-xl bg-[#F5F0E8] dark:bg-[#3A3A3A] px-3 py-2.5 text-sm outline-none text-[#2D3436] dark:text-[#E8E8E8] placeholder:text-[#8C8C8C] border border-[#E07A5F]/10"
            />
            <div className="flex flex-wrap gap-1.5">
              {CHAT_CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setCategory(cat.value)}
                  className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    category === cat.value
                      ? "bg-[#E07A5F] text-white"
                      : "bg-[#F5F0E8] dark:bg-[#3A3A3A] text-[#8C8C8C]"
                  }`}
                >
                  <span>{cat.icon}</span>
                  {cat.label}
                </button>
              ))}
            </div>
            {selectedIds.size > 0 && (
              <p className="text-xs text-[#8C8C8C]">{selectedIds.size} {selectedIds.size === 1 ? "person" : "people"} selected</p>
            )}
          </div>
        )}

        <div className="px-5 pb-3">
          <p className="text-xs text-[#8C8C8C]">
            {mode === "direct" ? "Pick from Sona users or search by name / email." : "Select the people to add to your group."}
          </p>
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#F5F0E8] dark:bg-[#3A3A3A] px-3 py-2 border border-[#E07A5F]/10">
            <Search className="h-4 w-4 text-[#8C8C8C]" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people…" className="flex-1 bg-transparent text-sm outline-none text-[#2D3436] dark:text-[#E8E8E8] placeholder:text-[#8C8C8C]" />
          </div>
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto px-2 pb-3">
          {loading ? (
            <div className="p-4 text-center text-sm text-[#8C8C8C]">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#8C8C8C]">No users found</div>
          ) : filtered.map((u) => (
            <button
              key={u.id}
              disabled={mode === "direct" && busyId === u.id}
              onClick={() => (mode === "direct" ? startWith(u) : toggleSelected(u.id))}
              className="flex w-full items-center gap-3 border-b border-[#E07A5F]/5 p-3 text-left last:border-0 hover:bg-[#F4A261]/10 disabled:opacity-60 rounded-lg"
            >
              <Avatar url={u.avatar_url} name={u.display_name} size={42} ai={u.is_ai} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <div className="truncate text-sm font-semibold text-[#2D3436] dark:text-[#E8E8E8]">{u.display_name}</div>
                  {u.is_ai && <Sparkles className="h-3 w-3 text-[#E07A5F]" />}
                  {u.is_pro && <Crown className="h-3 w-3 text-[#E07A5F]" />}
                </div>
                <div className="truncate text-xs text-[#8C8C8C]">{u.email}</div>
              </div>
              {mode === "direct" ? (
                busyId === u.id ? <span className="text-xs text-[#8C8C8C]">…</span> : <Plus className="h-4 w-4 text-[#E07A5F]" />
              ) : selectedIds.has(u.id) ? (
                <CheckSquare className="h-5 w-5 text-[#E07A5F]" />
              ) : (
                <Square className="h-5 w-5 text-[#8C8C8C]" />
              )}
            </button>
          ))}
        </div>

        {mode === "group" && (
          <div className="px-5 pb-6 pt-2 border-t border-[#E07A5F]/10">
            <button
              onClick={createGroup}
              disabled={creatingGroup}
              className="w-full rounded-full bg-[#E07A5F] py-3 text-sm font-semibold text-white shadow-md transition hover:opacity-90 disabled:opacity-60"
            >
              {creatingGroup ? "Creating…" : "Create group"}
            </button>
          </div>
        )}
      </div>

      {groupError && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4" onClick={(e) => e.stopPropagation()}>
          <div className="w-full max-w-sm rounded-2xl bg-[#FFFDF9] dark:bg-[#2A2A2A] p-5 shadow-2xl">
            <div className="mb-3 flex items-center gap-2 text-red-500">
              <Ban className="h-5 w-5" />
              <h4 className="text-base font-semibold text-[#2D3436] dark:text-[#E8E8E8]">{groupError.title}</h4>
            </div>
            <p className="mb-3 text-sm leading-relaxed text-[#5C5C5C] dark:text-[#B8B8B8]">{groupError.explanation}</p>
            <details className="mb-4 rounded-lg bg-[#F5F0E8] dark:bg-[#3A3A3A] p-2.5 text-xs text-[#8C8C8C]">
              <summary className="cursor-pointer select-none font-medium">Technical details</summary>
              <p className="mt-1.5 break-words font-mono">{groupError.raw}</p>
            </details>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(groupError.raw);
                  toast.success("Error copied to clipboard");
                }}
                className="flex-1 rounded-full border border-[#E07A5F]/30 py-2 text-sm font-medium text-[#E07A5F]"
              >
                Copy error
              </button>
              <button
                onClick={() => setGroupError(null)}
                className="flex-1 rounded-full bg-[#E07A5F] py-2 text-sm font-semibold text-white"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function SettingsModal({ me, onClose, onSaved }: { me: Profile; onClose: () => void; onSaved: (p: Profile) => void }) {
  const [tab, setTab] = useState<"profile" | "advanced" | "subscription">("profile");
  const [name, setName] = useState(me.display_name ?? "");
  const [busy, setBusy] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(me.avatar_url ?? "");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [notif, setNotif] = useState<NotificationPermission>(typeof Notification !== "undefined" ? Notification.permission : "default");

  const pickAvatar = () => avatarInputRef.current?.click();

  const uploadAvatar = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image file");
    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      // Fixed filename per user (not a random uuid) so re-uploading replaces
      // the old picture instead of accumulating unused files in storage.
      const path = `${me.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      // Cache-bust so the new picture shows immediately instead of the
      // browser reusing a cached copy of the old file at the same URL.
      const freshUrl = `${pub.publicUrl}?v=${Date.now()}`;
      const { data, error } = await supabase.from("profiles").update({ avatar_url: freshUrl }).eq("id", me.id).select().single();
      if (error) throw error;
      setAvatarUrl(freshUrl);
      onSaved(data as Profile);
      toast.success("Profile picture updated");
    } catch (e) {
      toast.error((e as Error).message || "Couldn't upload picture");
    } finally {
      setUploadingAvatar(false);
    }
  };

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

  const paystackCheckout = useServerFn(startPaystackCheckout);
  const upgrade = async () => {
    setBusy(true);
    try {
      const r = await paystackCheckout() as { url: string };
      toast.success("Redirecting to Paystack…");
      window.location.href = r.url;
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };


  const askNotif = async () => {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setNotif(p);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-[#E07A5F]/10 bg-[#FFFDF9] dark:bg-[#2A2A2A] p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4">
          <Settings className="h-4 w-4 text-[#E07A5F]" />
          <h3 className="text-base font-semibold text-[#2D3436] dark:text-[#E8E8E8]">Settings</h3>
          {me.is_pro && <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#E07A5F]/20 px-2 py-0.5 text-[10px] font-semibold text-[#E07A5F]"><Crown className="h-3 w-3" /> Pro</span>}
        </div>
        <div className="mb-4 flex gap-1 rounded-xl bg-[#F5F0E8] dark:bg-[#3A3A3A] p-1 text-xs border border-[#E07A5F]/10">
          {(["profile", "advanced", "subscription"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 rounded-lg px-2 py-1.5 capitalize ${tab === t ? "bg-[#FFFDF9] dark:bg-[#2A2A2A] font-semibold shadow text-[#2D3436] dark:text-[#E8E8E8]" : "text-[#8C8C8C]"}`}>
              {t}
            </button>
          ))}
        </div>

        {tab === "profile" && (
          <div className="space-y-3">
            <div className="flex flex-col items-center gap-2 pb-1">
              <div className="relative">
                <Avatar url={avatarUrl} name={name || "?"} size={72} />
                <button
                  onClick={pickAvatar}
                  disabled={uploadingAvatar}
                  aria-label="Change profile picture"
                  className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-[#E07A5F] text-white shadow-md hover:bg-[#D4694F] disabled:opacity-60"
                >
                  {uploadingAvatar ? <span className="text-[10px]">…</span> : <Pencil className="h-3.5 w-3.5" />}
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); e.target.value = ""; }}
                />
              </div>
              <button onClick={pickAvatar} disabled={uploadingAvatar} className="text-xs font-medium text-[#E07A5F] hover:underline disabled:opacity-60">
                {uploadingAvatar ? "Uploading…" : "Change photo"}
              </button>
            </div>
            <div>
              <label className="text-xs text-[#8C8C8C]">Display name</label>
              <input value={name} onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-xl bg-[#F5F0E8] dark:bg-[#3A3A3A] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#E07A5F]/50 text-[#2D3436] dark:text-[#E8E8E8] border border-[#E07A5F]/10" />
            </div>
            <p className="text-xs text-[#8C8C8C]">Signed in as {me.email}</p>
          </div>
        )}

        {tab === "advanced" && (
          <div className="space-y-3 text-sm">
            <div className="rounded-xl border border-[#E07A5F]/10 p-3">
              <div className="flex items-center gap-2 font-semibold text-[#2D3436] dark:text-[#E8E8E8]"><Bell className="h-4 w-4 text-[#E07A5F]" /> Push notifications</div>
              <p className="mt-1 text-xs text-[#8C8C8C]">Status: {notif}</p>
              {notif !== "granted" && (
                <button onClick={askNotif} className="mt-2 rounded-lg bg-[#F5F0E8] dark:bg-[#3A3A3A] px-3 py-1.5 text-xs hover:bg-[#F4A261]/20 text-[#2D3436] dark:text-[#E8E8E8]">Enable</button>
              )}
            </div>
            <div className="rounded-xl border border-[#E07A5F]/10 p-3">
              <div className="flex items-center gap-2 font-semibold text-[#2D3436] dark:text-[#E8E8E8]"><Shield className="h-4 w-4 text-[#E07A5F]" /> Security</div>
              <ul className="mt-1 space-y-1 text-xs text-[#8C8C8C]">
                <li>• End-to-end AES-GCM encryption for hidden chats</li>
                <li>• Passcodes never leave your device</li>
                <li>• Row-level security on every message</li>
              </ul>
            </div>
            <div className="rounded-xl border border-[#E07A5F]/10 p-3">
              <div className="flex items-center gap-2 font-semibold text-[#2D3436] dark:text-[#E8E8E8]"><Lock className="h-4 w-4 text-[#E07A5F]" /> Hidden chats</div>
              <p className="mt-1 text-xs text-[#8C8C8C]">Toggle "Hide & encrypt" from the chat menu to store messages encrypted at rest.</p>
            </div>
          </div>
        )}

        {tab === "subscription" && (
          <div className="space-y-3 text-sm">
            <div className="rounded-2xl border border-[#E07A5F]/20 bg-gradient-to-br from-[#E07A5F]/20 to-[#F4A261]/10 p-4">
              <div className="flex items-center gap-2 font-semibold text-[#2D3436] dark:text-[#E8E8E8]"><Crown className="h-4 w-4 text-[#E07A5F]" /> Sona Pro</div>
              <ul className="mt-2 space-y-1 text-xs text-[#2D3436] dark:text-[#E8E8E8]">
                <li>✨ Unlimited AI chat summaries</li>
                <li>🖼️ Vision — Sona reads your images</li>
                <li>🔒 Unlimited hidden encrypted chats</li>
                <li>🎨 Premium themes</li>
              </ul>
              {me.is_pro ? (
                <div className="mt-3 text-xs text-[#E07A5F] font-semibold">You're a Pro member 💛</div>
              ) : (
                <button disabled={busy} onClick={upgrade} className="mt-3 w-full rounded-xl bg-[#E07A5F] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 hover:bg-[#D4694F] transition">
                  Upgrade to Pro
                </button>
              )}
            </div>
          </div>
        )}

        <div className="mt-5 flex items-center justify-between gap-2 border-t border-[#E07A5F]/10 pt-4">
          <button onClick={signOut} className="rounded-xl px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-1"><LogOut className="h-3.5 w-3.5" /> Sign out</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-xl px-3 py-2 text-sm hover:bg-[#F4A261]/20 text-[#2D3436] dark:text-[#E8E8E8]">Close</button>
            {tab === "profile" && (
              <button disabled={busy} onClick={save} className="rounded-xl bg-[#E07A5F] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 hover:bg-[#D4694F] transition">
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl border border-[#E07A5F]/10 bg-[#FFFDF9] dark:bg-[#2A2A2A] p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-3">
          <Lock className="h-4 w-4 text-[#E07A5F]" />
          <h3 className="text-base font-semibold text-[#2D3436] dark:text-[#E8E8E8]">Unlock hidden chat</h3>
        </div>
        <p className="text-xs text-[#8C8C8C] mb-3">Enter your passcode to decrypt messages. It never leaves your device.</p>
        <input type="password" value={pass} onChange={(e) => setPass(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder="Passcode"
          className="w-full rounded-xl bg-[#F5F0E8] dark:bg-[#3A3A3A] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#E07A5F]/50 text-[#2D3436] dark:text-[#E8E8E8] border border-[#E07A5F]/10" />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-xl px-3 py-2 text-sm hover:bg-[#F4A261]/20 text-[#2D3436] dark:text-[#E8E8E8]">Cancel</button>
          <button onClick={submit} className="rounded-xl bg-[#E07A5F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#D4694F] transition">Unlock</button>
        </div>
      </div>
    </div>
  );
}
