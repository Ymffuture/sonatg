import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Search, MoreVertical, ArrowLeft, Moon, Sun,
  Plus, X, LogOut, Trash2,
  MessageSquarePlus, Settings, Shield, Sparkles, Lock, Unlock,
  Ban, Reply, Pencil, Crown, Users, Phone, Video, CheckSquare, Square, BookOpen,
  Share2, BadgeCheck, FileText, DoorOpen,
  Tag, Briefcase, Gamepad2, GraduationCap, Heart, Music, Plane, Newspaper, HelpCircle, Loader2,
} from "lucide-react";

import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { askSonaAI, summarizeChat } from "@/lib/ai.functions";
import {
  SONA_AI_ID, fmtTime, CHAT_CATEGORIES,
  type ChatRow, type MessageRow, type Profile, type ReactionRow, type MessageReadRow,
  type BlockRow, type ChatCategory, type ChatMemberRole,
} from "@/lib/db";
import { encryptBody, decryptBody, unlockChat, isUnlocked, lockChat } from "@/lib/crypto";
import { playSendSound, playReceiveSound } from "@/lib/sounds";
import { toast } from "sonner";
import sonaLogo from "@/assets/sona-logo.png";
import sonaAi from "@/assets/sona01.png";
import { VscVerifiedFilled } from "react-icons/vsc";
import { MdInsertPhoto } from "react-icons/md";
import { IoMdMic } from "react-icons/io";

import {
  type ChatWithMeta, type ReadStatus, useTheme, chatTitle, chatAvatarUrl, isAIChat,
  explainSupabaseError, categoryMeta, readStatusFor,
  MAX_IMAGES, MAX_IMAGE_BYTES, MAX_DOCS, MAX_DOC_BYTES, DOC_EXTENSIONS, docExtOf, formatBytes,
} from "@/utils/utils";
import { Avatar, TickIcon } from "./Avatar";
import { Bubble, Composer } from "./MessageBubble";
import { MemberListModal, GroupSettingsModal, NewChatModal, SettingsModal, UnlockModal } from "./ChatModals";

/* ─── Category Icons (no emojis) ─── */
function CategoryIcon({ category, className = "h-3.5 w-3.5" }: { category?: string; className?: string }) {
  switch (category) {
    case "business": return <Briefcase className={className} />;
    case "gaming": return <Gamepad2 className={className} />;
    case "education": return <GraduationCap className={className} />;
    case "lifestyle": return <Heart className={className} />;
    case "entertainment": return <Music className={className} />;
    case "travel": return <Plane className={className} />;
    case "news": return <Newspaper className={className} />;
    case "support": return <HelpCircle className={className} />;
    default: return <Users className={className} />;
  }
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
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const pendingImageUrls = useMemo(
    () => pendingImages.map((f) => URL.createObjectURL(f)),
    [pendingImages]
  );
  useEffect(() => {
    return () => { pendingImageUrls.forEach((u) => URL.revokeObjectURL(u)); };
  }, [pendingImageUrls]);
  const [pendingDocs, setPendingDocs] = useState<File[]>([]);
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
  const docRef = useRef<HTMLInputElement>(null);
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

    if (!draft.trim() && pendingImages.length === 0 && pendingDocs.length === 0) return;

    const plaintext = draft.trim();
    let is_encrypted = false;
    let firstBody: string | null = plaintext || null;
    if (active?.is_hidden && firstBody && isUnlocked(activeId)) {
      const enc = await encryptBody(activeId, firstBody);
      if (enc) { firstBody = enc; is_encrypted = true; }
    }

    type Outgoing = { kind: "text" | "image" | "file"; media_url?: string | null; file_name?: string; file_size?: number };
    const outgoing: Outgoing[] = [];

    for (const img of pendingImages) {
      const path = `${activeId}/${me.id}/${crypto.randomUUID()}-${img.name}`;
      const { error: upErr } = await supabase.storage.from("chat-media").upload(path, img);
      if (upErr) { toast.error(`Couldn't upload ${img.name}: ${explainSupabaseError(upErr).title}`); continue; }
      const { data: signed } = await supabase.storage.from("chat-media").createSignedUrl(path, 60 * 60 * 24 * 365);
      outgoing.push({ kind: "image", media_url: signed?.signedUrl ?? null });
    }
    for (const doc of pendingDocs) {
      const path = `${activeId}/${me.id}/${crypto.randomUUID()}-${doc.name}`;
      const { error: upErr } = await supabase.storage.from("chat-media").upload(path, doc, { contentType: doc.type || "application/octet-stream" });
      if (upErr) { toast.error(`Couldn't upload ${doc.name}: ${explainSupabaseError(upErr).title}`); continue; }
      const { data: signed } = await supabase.storage.from("chat-media").createSignedUrl(path, 60 * 60 * 24 * 365);
      outgoing.push({ kind: "file", media_url: signed?.signedUrl ?? null, file_name: doc.name, file_size: doc.size });
    }
    if (outgoing.length === 0 && plaintext) outgoing.push({ kind: "text" });

    let firstAttachedImageUrl: string | null = null;
    for (let i = 0; i < outgoing.length; i++) {
      const item = outgoing[i];
      if (item.kind === "image" && !firstAttachedImageUrl) firstAttachedImageUrl = item.media_url ?? null;
      const { error } = await supabase.from("messages").insert({
        chat_id: activeId, sender_id: me.id, kind: item.kind,
        body: i === 0 ? firstBody : null,
        media_url: item.media_url ?? null,
        file_name: item.file_name ?? null,
        file_size: item.file_size ?? null,
        is_encrypted: i === 0 ? is_encrypted : false,
        reply_to_id: i === 0 ? (replyTo?.id ?? null) : null,
      });
      if (error) { toast.error(error.message); continue; }
    }
    playSendSound();

    const prompt = plaintext;
    const attachedImageUrl = firstAttachedImageUrl;
    setDraft(""); setPendingImages([]); setPendingDocs([]); setShowEmoji(false); setReplyTo(null);

    if (active && !active.is_hidden) {
      const isAI = isAIChat(active);
      const mentionsSona = /(^|\s)@sona\b/i.test(prompt);
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

  const onPickImages = (files?: FileList | null) => {
    if (!files || files.length === 0) return;
    const incoming = Array.from(files);
    const oversized = incoming.filter((f) => f.size > MAX_IMAGE_BYTES);
    const valid = incoming.filter((f) => f.size <= MAX_IMAGE_BYTES);
    if (oversized.length) toast.error(`${oversized.length} image${oversized.length === 1 ? "" : "s"} skipped — over 2MB`);

    setPendingImages((prev) => {
      const combined = [...prev, ...valid];
      if (combined.length > MAX_IMAGES) {
        toast.error(`Max ${MAX_IMAGES} images at once — extra ones skipped`);
        return combined.slice(0, MAX_IMAGES);
      }
      return combined;
    });
  };

  const onPickDocs = (files?: FileList | null) => {
    if (!files || files.length === 0) return;
    const incoming = Array.from(files);
    const wrongType = incoming.filter((f) => !DOC_EXTENSIONS.includes(docExtOf(f.name)));
    const oversized = incoming.filter((f) => DOC_EXTENSIONS.includes(docExtOf(f.name)) && f.size > MAX_DOC_BYTES);
    const valid = incoming.filter((f) => DOC_EXTENSIONS.includes(docExtOf(f.name)) && f.size <= MAX_DOC_BYTES);
    if (wrongType.length) toast.error(`Unsupported file type: ${wrongType.map((f) => f.name).join(", ")}`);
    if (oversized.length) toast.error(`${oversized.length} file${oversized.length === 1 ? "" : "s"} skipped — over 5MB`);

    setPendingDocs((prev) => {
      const combined = [...prev, ...valid];
      if (combined.length > MAX_DOCS) {
        toast.error(`Max ${MAX_DOCS} files at once — extra ones skipped`);
        return combined.slice(0, MAX_DOCS);
      }
      return combined;
    });
  };

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

  /* ─── Main Page Loader + Nav Skeleton ─── */
  if (!me) {
    return (
      <div className="h-dvh w-full bg-[#F0EBE3] text-[#2D3436] dark:bg-[#1A1A1A] dark:text-[#E8E8E8]">
        <div className="mx-auto flex h-full max-w-[1400px] overflow-hidden md:p-4">
          <div className="flex h-full w-full overflow-hidden rounded-none bg-white shadow-2xl md:rounded-3xl md:border border-[#E07A5F]/20 dark:bg-[#242424] dark:border-[#E07A5F]/10">
            {/* Sidebar with nav bar skeleton */}
            <aside className="relative h-full w-full flex-col border-r border-[#E07A5F]/10 bg-[#FFFDF9] dark:bg-[#1E1E1E] md:flex md:w-[32%] md:min-w-[300px] md:max-w-[420px]">
              {/* Nav bar skeleton */}
              <div className="flex items-center justify-between gap-2 px-4 py-3">
                <div className="h-8 w-28 rounded-lg bg-[#E07A5F]/10 animate-pulse" />
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-9 w-9 rounded-full bg-[#E07A5F]/10 animate-pulse" />
                  ))}
                </div>
              </div>
              <div className="px-3 pb-2 pt-2">
                <div className="h-10 rounded-full bg-[#E07A5F]/10 animate-pulse" />
              </div>
              <div className="flex-1 space-y-1 px-2 pt-1">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="flex items-center gap-3 p-3">
                    <div className="h-12 w-12 shrink-0 rounded-full bg-[#E07A5F]/10 animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-2/5 rounded bg-[#E07A5F]/10 animate-pulse" />
                      <div className="h-2.5 w-4/5 rounded bg-[#E07A5F]/10 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </aside>
            {/* Main page loader */}
            <section className="hidden md:flex h-full flex-1 flex-col bg-[#F0EBE3] dark:bg-[#1A1A1A] items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <div className="h-16 w-16 rounded-2xl bg-[#E07A5F]/20 animate-pulse" />
                  <img src={sonaLogo} alt="" className="absolute inset-0 h-16 w-16 rounded-2xl object-contain p-2 opacity-80" />
                </div>
                <div className="flex items-center gap-2 text-[#8C8C8C]">
                  <Loader2 className="h-4 w-4 animate-spin text-[#E07A5F]" />
                  <span className="text-sm font-medium">Loading Sona…</span>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    );
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
            <div className="flex items-center justify-between gap-2 px-4 py-3 bg-transparent dark:text-white text-gray-600">
              <div className="flex items-center gap-2 min-w-0">
                <div className="leading-tight min-w-0">
                  <div className="truncate text-[24px] font-bold tracking-[-0.6px] dark:text-white text-gray-600 font-sans">
                    Sona<span className="font-semibold text-[#E07A5F]">TG</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 dark:text-white text-gray-600 shrink-0 border border-slate-800 dark:border-slate-700 rounded-md">
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
                  className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/20 text-gray-600 dark:text-white"
                  aria-label="Share app"
                >
                  <Share2 className="h-4 w-4" />
                </button>
                <button onClick={toggle} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/20 dark:text-white text-gray-600" aria-label="Toggle theme">
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
                <Link to="/learn" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/20 dark:text-white text-gray-600" aria-label="Learn">
                  <BookOpen className="h-4 w-4" />
                </Link>
                <button onClick={() => setShowSettings(true)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/20 dark:text-white text-gray-600" aria-label="Settings">
                  <Settings className="h-4 w-4" />
                </button>
                <button onClick={signOut} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/20 dark:text-white text-[#2D3436]" aria-label="Sign out">
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
                <div className="flex items-center gap-3">
                  {  loadingChats ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-[#E07A5F]" />
                  <span className="text-sm text-[#8C8C8C]">upcoming chats…</span>
                </div>) :(
                  <button onClick={deleteSelectedChats} disabled={selectedChatIds.size === 0}
                    className="flex items-center gap-1 rounded bg-red-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 hover:bg-red-600 transition">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>)} 
                  <button onClick={exitSelectMode}
                    className="rounded border border-[#2D3436] px-3 py-1.5 text-xs font-semibold dark:text-white text-[#2D3436] hover:bg-[#3D4446] transition">
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
              { (
                filtered.map((c) => {
                  const title = chatTitle(c, c.memberIds.includes(me.id) ? me.id : "");
                  const last = c.lastMessage;
                  const mine = last?.sender_id === me.id;
                  const previewText = last?.kind === "image" ? "Photo" : last?.kind === "voice" ? "Voice note" : (last?.body ?? "");
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
                            {c.unread > 9 ? "9+" : c.unread}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 min-w-0">
                            <span className="flex min-w-0 items-center gap-1.5">
                              <span className="truncate font-semibold text-[#2D3436] dark:text-[#E8E8E8]">
                                {title}
                              </span>
                              {ai && (
                                <VscVerifiedFilled
                                  className="h-[15px] w-[15px] shrink-0 text-blue-500"
                                  aria-label="Verified Sona AI"
                                  title="Verified Sona AI"
                                />
                              )}
                            </span>
                            {c.is_group && c.category && c.category !== "general" && (
                              <span className="shrink-0 text-[#E07A5F]" title={categoryMeta[c.category].label}>
                                <CategoryIcon category={c.category} />
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
          <section className={`${showSidebarMobile ? "hidden" : "flex"} relative h-full min-w-0 flex-1 flex-col md:flex bg-[#F0EBE3] dark:bg-[#1A1A1A]`}>
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
                      <div className="flex items-center gap-1.5">
                        <span>{chatTitle(active, me.id)}</span>
                        {isAIChat(active) && (
                          <VscVerifiedFilled
                            className="h-4 w-4 text-blue-500"
                            aria-label="Verified Sona AI"
                            title="Verified"
                          />
                        )}
                      </div>
                      {active.is_hidden && <Lock className="h-3.5 w-3.5 text-[#E07A5F]" />}
                      {active.memberRoles[me.id] === "admin" && active.is_group && (
                        <BadgeCheck className="h-3.5 w-3.5 text-[#4FA6E0]" />
                      )}
                      {active.is_group && active.category && active.category !== "general" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#E07A5F]/10 px-2 py-0.5 text-[10px] font-medium text-[#E07A5F]">
                          <CategoryIcon category={active.category} className="h-3 w-3" /> {categoryMeta[active.category].label}
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
                        ""
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
                        <Phone className="h-5 w-5" />
                      </button>
                      <button onClick={() => startCall("video")} className="grid h-9 w-9 place-items-center rounded-full hover:bg-[#F4A261]/20 text-[#E07A5F]" aria-label="Video call">
                        <Video className="h-5 w-5" />
                      </button>
                    </div>
                  )}

                  <div className="relative">
                    <button onClick={() => setShowHeaderMenu((s) => !s)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-[#F4A261]/20" aria-label="Menu">
                      <MoreVertical className="h-5 w-5 text-[#2D3436] dark:text-[#E8E8E8]" />
                    </button>
                    {showHeaderMenu && (
                      <>
                        <div className="fixed inset-0 z-30" onClick={() => setShowHeaderMenu(false)} />
                        {/* Expands to the left of the trigger */}
                        <div className="absolute right-full mr-2 top-0 z-40 w-56 rounded-xl border border-[#E07A5F]/10 bg-[#FFFDF9] dark:bg-[#2A2A2A] p-1 shadow-xl">
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
                  </div>
                </header>

                <div ref={scrollRef} className="scrollbar-thin flex-1 overflow-y-auto px-3 py-4 md:px-8 chat-pattern">
                  <div className="mx-auto flex max-w-3xl flex-col gap-0.5">
                    <div className="mx-auto rounded-full bg-[#F4A261]/20 px-4 py-1.5 text-[11px] text-[#8C8C8C] backdrop-blur mb-3 border border-[#E07A5F]/10">
                      {isAIChat(active) ? "Chat with Sona" : "Type @sona to summon the Sona AI"}
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
                        ? (parentMsg.is_encrypted ? (decrypted[parentMsg.id] ?? "🔒 Locked") : (parentMsg.body ?? (parentMsg.kind === "image" ? "Photo" : parentMsg.kind === "voice" ? "Voice note" : "")))
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

                {/* Floating Sona AI */}
                {active && !isAIChat(active) && (
                  <button
                    onClick={() => {
                      setDraft((d) => {
                        const prefix = d && !d.endsWith(' ') ? ' ' : '';
                        return d + prefix + '@sona ';
                      });
                    }}
                    className="absolute bottom-24 right-6 z-30 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-[#E07A5F] to-[#F4A261] text-white shadow-xl hover:scale-110 transition-all duration-200 border-2 border-white dark:border-[#2A2A2A]"
                    title="Ask Sona AI"
                  >
                    <Sparkles className="h-6 w-6" />
                  </button>
                )}

                {(replyTo || editing) && (
                  <div className="border-t border-[#E07A5F]/10 bg-[#FFFDF9] dark:bg-[#242424] px-3 py-2 md:px-6">
                    <div className="mx-auto flex max-w-3xl items-center gap-3">
                      <div className="flex-1 rounded-lg border-l-2 border-[#E07A5F] bg-[#F5F0E8] dark:bg-[#2A2A2A] px-3 py-1.5 text-xs">
                        <div className="font-semibold text-[#E07A5F] flex items-center gap-1">
                          {editing ? (<><Pencil className="h-3 w-3" /> Editing message</>) : (<><Reply className="h-3 w-3" /> Replying to {replyTo && (replyTo.sender_id === me?.id ? "yourself" : profiles[replyTo.sender_id]?.display_name ?? "…")}</>)}
                        </div>
                        <div className="truncate opacity-80 text-[#2D3436] dark:text-[#E8E8E8]">
                          {editing ? (editing.body ?? "") : (replyTo?.body ?? (replyTo?.kind === "image" ? "Photo" : replyTo?.kind === "voice" ? "Voice note" : ""))}
                        </div>
                      </div>
                      <button onClick={() => { setReplyTo(null); setEditing(null); if (editing) setDraft(""); }} className="grid h-8 w-8 place-items-center rounded-full hover:bg-[#F4A261]/20" aria-label="Cancel">
                        <X className="h-4 w-4 text-[#2D3436] dark:text-[#E8E8E8]" />
                      </button>
                    </div>
                  </div>
                )}

                {(pendingImages.length > 0 || pendingDocs.length > 0) && (
                  <div className="border-t border-[#E07A5F]/10 bg-[#FFFDF9] dark:bg-[#242424] px-3 py-3 md:px-6">
                    <div className="mx-auto max-w-3xl space-y-2">
                      {pendingImages.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {pendingImages.map((f, i) => (
                            <div key={i} className="relative shrink-0">
                              <img
                                src={pendingImageUrls[i]}
                                alt=""
                                className="h-20 w-20 rounded-lg object-cover border border-[#E07A5F]/20 bg-black/5"
                              />
                              <button
                                onClick={() => setPendingImages((prev) => prev.filter((_, idx) => idx !== i))}
                                aria-label="Remove image"
                                className="absolute -top-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-full bg-[#2D3436] shadow-md hover:bg-black"
                              >
                                <X className="h-3 w-3 text-white" />
                              </button>
                            </div>
                          ))}
                          <div className="flex items-center px-1 text-xs text-[#8C8C8C] shrink-0">
                            {pendingImages.length}/{MAX_IMAGES}
                          </div>
                        </div>
                      )}
                      {pendingDocs.length > 0 && (
                        <div className="space-y-1.5">
                          {pendingDocs.map((f, i) => (
                            <div key={i} className="flex items-center gap-2 rounded-lg border border-[#E07A5F]/20 bg-white dark:bg-[#2A2A2A] px-3 py-2">
                              <FileText className="h-5 w-5 text-[#E07A5F] shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm text-[#2D3436] dark:text-[#E8E8E8]">{f.name}</p>
                                <p className="text-xs text-[#8C8C8C]">{formatBytes(f.size)}</p>
                              </div>
                              <button
                                onClick={() => setPendingDocs((prev) => prev.filter((_, idx) => idx !== i))}
                                aria-label="Remove file"
                                className="grid h-7 w-7 shrink-0 place-items-center rounded-full hover:bg-[#F4A261]/20"
                              >
                                <X className="h-4 w-4 text-[#2D3436] dark:text-[#E8E8E8]" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <Composer
                  draft={draft}
                  setDraft={(v) => { setDraft(v); if (v) sendTyping(); }}
                  showEmoji={showEmoji} setShowEmoji={setShowEmoji}
                  onPickImages={onPickImages} fileRef={fileRef} onPickDocs={onPickDocs} docRef={docRef}
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

      {showMemberList && me && active && active.is_group && (
        <MemberListModal
          chat={active}
          meId={me.id}
          isAdmin={active.memberRoles[me.id] === "admin"}
          onClose={() => setShowMemberList(false)}
          onOpenSettings={() => { setShowMemberList(false); setShowGroupSettings(true); }}
          onLeave={() => leaveGroup(active.id)}
        />
      )}

      {showGroupSettings && me && active && active.is_group && (
        <GroupSettingsModal
          chat={active}
          meId={me.id}
          onClose={() => setShowGroupSettings(false)}
          onUpdated={loadChats}
          onDelete={() => deleteGroup(active.id)}
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
