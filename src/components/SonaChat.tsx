import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Search, MoreVertical, ArrowLeft, Moon, Sun,
  Plus, X, LogOut, Trash2,
  MessageSquarePlus, Settings,PhoneMissed, Shield, Sparkles, Lock, Unlock,
  Ban, Reply, Pencil, Crown, Users, Phone, Video, CheckSquare, Square, BookOpen, Check, ChevronUp, ChevronDown, Clock, Pin, Send,
  Share2, BadgeCheck, FileText, DoorOpen, Download,
  Tag, Briefcase, Gamepad2, GraduationCap, Heart, Music, Plane, Newspaper, HelpCircle, Loader2,
} from "lucide-react";

import { Dropdown } from "antd";
import { motion, AnimatePresence } from "framer-motion";
import { IoMdTimer } from "react-icons/io";
import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { askSonaAI, summarizeChat } from "@/lib/ai.functions";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { CallManager, type CallManagerHandle } from "./CallManager";
import { ConfirmProvider, useConfirm } from "@/hooks/useConfirmDialog";
import { pushBackLayer } from "@/hooks/useBackStack";
import { FaSquareThreads } from "react-icons/fa6";
import { IoFootstepsOutline } from "react-icons/io5" ;
/* Shows an "Admin console" entry only for accounts with the admin role. */
function AdminLink({ onNavigate }: { onNavigate: () => void }) {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data } = await supabase
        .from("user_roles").select("role")
        .eq("user_id", auth.user.id).eq("role", "admin").maybeSingle();
      if (alive) setIsAdmin(!!data);
    })();
    return () => { alive = false; };
  }, []);
  if (!isAdmin) return null;
  return (
    <Link
      to="/admin"
      onClick={onNavigate}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#2D3436] dark:text-[#E8E8E8] hover:bg-[#F4A261]/10 transition-colors"
    >
      <Shield className="h-4 w-4 shrink-0" />
      Admin console
    </Link>
  );
}
import { OnboardingTour, hasSeenOnboarding, type TourStep } from "./OnboardingTour";
import {
  SONA_AI_ID, fmtTime, fmtLastSeen, fmtDateLabel, CHAT_CATEGORIES,
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
import { FaFileLines } from "react-icons/fa6";
import { FaLock } from "react-icons/fa6"; 
import { MdSearch } from "react-icons/md";
import { BiSolidMessageSquareAdd } from "react-icons/bi";
import { RiArrowLeftWideFill } from "react-icons/ri";

import {
  type ChatWithMeta, type ReadStatus, useTheme, chatTitle, chatAvatarUrl, isAIChat,
  explainSupabaseError, categoryMeta, readStatusFor,
  MAX_IMAGES, MAX_IMAGE_BYTES, MAX_DOCS, MAX_DOC_BYTES, DOC_EXTENSIONS, docExtOf, formatBytes,
} from "@/utils/utils";
import { Avatar, TickIcon } from "./Avatar";
import { Bubble, Composer } from "./MessageBubble";
import { MemberListModal, GroupSettingsModal, NewChatModal, SettingsModal, UnlockModal } from "./ChatModals";
import { ProfileViewModal } from "./ProfileView";


// Call-log messages store their metadata as JSON in the file_name column
// (body stays null so MessagePreview's switch renders it, rather than the
// raw JSON, when there's no body text).
type CallLogMeta = { kind: "voice" | "video"; outcome: "answered" | "missed" | "declined"; durationMs: number };
function parseCallBody(raw: string | null): CallLogMeta {
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && (parsed.kind === "voice" || parsed.kind === "video")) {
      return {
        kind: parsed.kind,
        outcome: parsed.outcome === "missed" || parsed.outcome === "declined" ? parsed.outcome : "answered",
        durationMs: typeof parsed.durationMs === "number" ? parsed.durationMs : 0,
      };
    }
  } catch { /* fall through to default */ }
  return { kind: "voice", outcome: "answered", durationMs: 0 };
}

const ONBOARDING_STEPS: TourStep[] = [
  {
    targetSelector: '[data-tour="new-chat-fab"]',
    title: "Start a conversation",
    description: "Tap here to message someone new or create a group.",
    placement: "top",
  },
  {
    targetSelector: '[data-tour="search-chats"]',
    title: "Find anything fast",
    description: "Search your chats here, or search inside any open chat from its menu.",
    placement: "bottom",
  },
  {
    targetSelector: '[data-tour="folder-tabs"]',
    title: "Stay organized",
    description: "Filter your chat list by Unread, Groups, or Pinned to cut through the noise.",
    placement: "bottom",
  },
  {
    targetSelector: '[data-tour="status-bar"]',
    title: "Share a status",
    description: "Post a photo, video, or text update that disappears after 24 hours — just like a story.",
    placement: "bottom",
  },
  {
    targetSelector: '[data-tour="settings-btn"]',
    title: "Make it yours",
    description: "Open this menu to set your profile photo and bio, manage subscriptions, switch themes, and more.",
    placement: "left",
  },
];

const DISAPPEARING_OPTIONS: { label: string; seconds: number | null }[] = [
  { label: "Off", seconds: null },
  { label: "24 hours", seconds: 24 * 60 * 60 },
  { label: "7 days", seconds: 7 * 24 * 60 * 60 },
  { label: "90 days", seconds: 90 * 24 * 60 * 60 },
];
function disappearingLabel(seconds?: number | null) {
  return DISAPPEARING_OPTIONS.find((o) => o.seconds === (seconds ?? null))?.label ?? "Off";
}

function fmtDuration(ms?: number | null) {
  const totalSec = Math.max(0, Math.round((ms ?? 0) / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function MessagePreview({ msg, decrypted }: { msg?: MessageRow | null; decrypted?: Record<string, string> }) {
  if (!msg) return null; // ← add this guard

  if (msg.is_encrypted) {
    return (
      <span className="inline-flex items-center gap-1 opacity-70">
        <FaLock className="h-4 w-4 shrink-0 text-red-500 " /> Locked
      </span>
    );
  }
  if (msg.body) return <span className="truncate">{msg.body}</span>;

  switch (msg.kind) {
    case "image":
      return (
        <span className="inline-flex items-center gap-1">
          <MdInsertPhoto className="h-4 w-4 shrink-0" /> Photo
        </span>
      );
    case "voice":
      return (
        <span className="inline-flex items-center gap-1">
          <IoMdMic className="h-4 w-4 shrink-0 text-blue-500" /> Voice message ({fmtDuration(msg.duration_ms)})
        </span>
      );
    case "file":
      return (
        <span className="inline-flex items-center gap-1">
          <FaFileLines className="h-4 w-4 shrink-0" /> {msg.file_name || "File"}
        </span>
      );
    case "call": {
      const call = parseCallBody(msg.file_name ?? null);
      return (
        <span className="inline-flex items-center gap-1">
          {call.kind === "video" ? <Video className="h-4 w-4 shrink-0" /> : <PhoneMissed className="h-4 text-red-600 w-4 shrink-0" />}
          {call.outcome === "missed" || call.outcome === "declined"
            ? `${call.outcome === "missed" ? "Missed" : "Declined"} ${call.kind === "video" ? "video call" : "call"}`
            : `${call.kind === "video" ? "Video call" : "Voice call"} · ${fmtDuration(call.durationMs)}`}
        </span>
      );
    }
    default:
      return <span>…</span>;
  }
}

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

function ThreadPanel({
  root, replies, me, profiles, decrypted, onClose, onSendReply,
}: {
  root: MessageRow | null;
  replies: MessageRow[];
  me: Profile;
  profiles: Record<string, Profile>;
  decrypted: Record<string, string>;
  onClose: () => void;
  onSendReply: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const bodyOf = (m: MessageRow) => (m.is_encrypted ? decrypted[m.id] ?? "Locked message" : m.body ?? "");
  const nameOf = (senderId: string) => (senderId === me.id ? "You" : profiles[senderId]?.display_name ?? "…");

  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    try {
      await onSendReply(t);
      setText("");
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="absolute inset-0 z-40 flex justify-end bg-black/20 w-full"
      onClick={onClose}
    >
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 38 }}
        className="flex h-full w-full max-w-sm flex-col border-l border-[#E07A5F]/10 bg-[#FFFDF9] dark:bg-[#242424] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#E07A5F]/10 px-4 py-3">
          <h3 className="text-sm flex gap-2 font-semibold text-[#2D3436] dark:text-[#E8E8E8]"><FaSquareThreads className="text-[purple]" /> Threads</h3>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-[#F4A261]/20" aria-label="Close thread">
            <X className="h-4 w-4 text-[#2D3436] dark:text-[#E8E8E8]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 scrollbar-thin">
          {root && (
            <div className="mb-3 rounded-xl border border-[#E07A5F]/15 bg-[#F5F0E8] dark:bg-[#2A2A2A] p-3">
              <div className="flex items-center gap-2">
                <Avatar url={profiles[root.sender_id]?.avatar_url} name={nameOf(root.sender_id)} size={24} />
                <span className="text-xs font-semibold text-[#2D3436] dark:text-[#E8E8E8]">{nameOf(root.sender_id)}</span>
                <span className="text-[10px] text-[#8C8C8C]">{fmtTime(root.created_at)}</span>
              </div>
              <p className="mt-1.5 text-sm text-[#2D3436] dark:text-[#E8E8E8]">
                {bodyOf(root) || (root.kind === "image" ? "Photo" : root.kind === "voice" ? "Voice message" : root.kind === "file" ? root.file_name || "File" : "…")}
              </p>
            </div>
          )}

          <div className="mb-2 text-xs font-medium text-[#8C8C8C]">
            {replies.length} {replies.length === 1 ? "reply" : "replies"}
          </div>

          <div className="space-y-3">
            {replies.map((r) => (
              <div key={r.id} className="flex items-start gap-3 m-2">
                <Avatar url={profiles[r.sender_id]?.avatar_url} name={nameOf(r.sender_id)} size={28} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs font-semibold text-[#2D3436] dark:text-[#E8E8E8]">{nameOf(r.sender_id)}</span>
                    <span className="text-[10px] text-[#8C8C8C]">{fmtTime(r.created_at)}</span>
                  </div>
                  <p className="text-sm text-[#2D3436] dark:text-[#E8E8E8]">
                    {bodyOf(r) || (r.kind === "image" ? "Photo" : r.kind === "voice" ? "Voice message" : r.kind === "file" ? r.file_name || "File" : "…")}
                  </p>
                </div>
              </div>
            ))}
            {replies.length === 0 && (
              <p className="text-sm text-[#8C8C8C]">No replies yet — start the thread below.</p>
            )}
          </div>
        </div>

        <div className="border-t border-[#E07A5F]/10 p-3">
          <div className="flex items-center gap-2 rounded-full bg-[#F5F0E8] dark:bg-[#2A2A2A] px-3 py-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
              placeholder="Reply in thread…"
              className="flex-1 bg-transparent text-sm outline-none text-[#2D3436] dark:text-[#E8E8E8] placeholder:text-[#8C8C8C]"
            />
            <button
              onClick={send}
              disabled={!text.trim() || sending}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#E07A5F] text-white disabled:opacity-40 transition"
              aria-label="Send reply"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function SonaChat() {
  return (
    <ConfirmProvider>
      <SonaChatInner />
    </ConfirmProvider>
  );
}

function SonaChatInner() {
  const confirm = useConfirm();
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
  const [sending, setSending] = useState(false);
  const [showMsgSearch, setShowMsgSearch] = useState(false);
  const [showDisappearingMenu, setShowDisappearingMenu] = useState(false);
  const [scheduledMessages, setScheduledMessages] = useState<MessageRow[]>([]);
  const [showScheduledList, setShowScheduledList] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [threadRootId, setThreadRootId] = useState<string | null>(null);
  useEffect(() => {
    if (me && !loadingChats && !hasSeenOnboarding()) {
      const t = setTimeout(() => setShowTour(true), 500);
      return () => clearTimeout(t);
    }
  }, [me, loadingChats]);
  const [msgSearchQuery, setMsgSearchQuery] = useState("");
  const [msgSearchIndex, setMsgSearchIndex] = useState(0);
  const msgRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [showSidebarMobile, setShowSidebarMobile] = useState(true);

  // Let the device/browser "back" gesture close an open chat (return to the
  // chat list) instead of leaving the app entirely. Uses the shared
  // back-navigation stack (src/hooks/useBackStack.ts) — critically, the
  // SAME stack modals use, so closing a modal opened on top of a chat only
  // ever pops the modal's own layer, never this one underneath it.
  const popChatLayerRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!showSidebarMobile) {
      popChatLayerRef.current = pushBackLayer(() => setShowSidebarMobile(true));
      return () => { popChatLayerRef.current?.(); popChatLayerRef.current = null; };
    }
  }, [showSidebarMobile]);
  // Close a chat the same way a device back-press would — just flips the
  // state; the effect's cleanup above consumes the shared history layer
  // automatically, whether closed this way or via a real back press.
  const closeActiveChat = useCallback(() => {
    setShowSidebarMobile(true);
  }, []);

  const [showNewChat, setShowNewChat] = useState(false);
  const [showMemberList, setShowMemberList] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [viewingProfile, setViewingProfile] = useState<Profile | null>(null);
  const [reactingOn, setReactingOn] = useState<string | null>(null);
  const [typingOthers, setTypingOthers] = useState<string[]>([]);
  const [recordingOthers, setRecordingOthers] = useState<string[]>([]);
  const [listActivity, setListActivity] = useState<Record<string, { typing: string[]; recording: string[] }>>({});
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

  const { canInstall, promptInstall } = useInstallPrompt();
  const callManagerRef = useRef<CallManagerHandle>(null);

  // Chat selection for bulk delete
  const [selectMode, setSelectMode] = useState(false);
  const [selectedChatIds, setSelectedChatIds] = useState<Set<string>>(new Set());

  // Which user IDs currently have an active (non-expired) status — drives
  // the status ring shown around chat-list avatars.
  const [usersWithStatus, setUsersWithStatus] = useState<Set<string>>(new Set());
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("statuses").select("user_id").gt("expires_at", new Date().toISOString());
      setUsersWithStatus(new Set((data ?? []).map((r: { user_id: string }) => r.user_id)));
    };
    load();
    const channel = supabase
      .channel("sidebar-status-indicators")
      .on("postgres_changes", { event: "*", schema: "public", table: "statuses" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const typingChanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const headerMenuRef = useRef<HTMLDivElement>(null);
    

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
      .from("chat_members").select("chat_id, user_id, role, is_pinned, pinned_at").in("chat_id", chatIds);
    const memberIds = Array.from(new Set((allMembers ?? []).map((m: { user_id: string }) => m.user_id)));
    const { data: profs } = await supabase.from("profiles").select("*").in("id", memberIds);

    const profMap: Record<string, Profile> = {};
    (profs ?? []).forEach((p) => { profMap[(p as Profile).id] = p as Profile; });
    setProfiles((prev) => ({ ...prev, ...profMap }));

    const { data: latest } = await supabase
      .from("visible_messages").select("*").in("chat_id", chatIds).order("created_at", { ascending: false }).limit(500);
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
    const pinnedByChat: Record<string, { isPinned: boolean; pinnedAt: string | null }> = {};
    (allMembers ?? []).forEach((m: { chat_id: string; user_id: string; role?: ChatMemberRole; is_pinned?: boolean; pinned_at?: string | null }) => {
      (memsByChat[m.chat_id] ||= []).push(m.user_id);
      (rolesByChat[m.chat_id] ||= {})[m.user_id] = m.role ?? "member";
      if (m.user_id === me.id) pinnedByChat[m.chat_id] = { isPinned: !!m.is_pinned, pinnedAt: m.pinned_at ?? null };
    });

    const result: ChatWithMeta[] = (chatRows ?? []).map((c) => {
      const chat = c as ChatRow;
      const ids = memsByChat[chat.id] ?? [];
      return {
        ...chat,
        memberIds: ids,
        members: ids.map((id) => profMap[id]).filter(Boolean),
        memberRoles: rolesByChat[chat.id] ?? {},
        isPinned: pinnedByChat[chat.id]?.isPinned ?? false,
        lastMessage: lastByChat[chat.id],
        unread: unreadByChat[chat.id] ?? 0,
      };
    });
    result.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
    setChats(result);
    setLoadingChats(false);
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
    const activeChat = chats.find((c) => c.id === activeId);
    if (activeChat?.disappearing_seconds) {
      supabase.rpc("cleanup_expired_messages").then(() => {});
    }
    (async () => {
      const { data: msgs } = await supabase.from("visible_messages").select("*").eq("chat_id", activeId).order("created_at");
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

  const notifyReaction = useCallback(async (r: ReactionRow) => {
    // Only notify when it's a reaction to MY message, not just any
    // reaction I happen to be subscribed to.
    const { data: msg } = await supabase
      .from("messages")
      .select("sender_id, kind, body")
      .eq("id", r.message_id)
      .maybeSingle();
    if (!msg || msg.sender_id !== me!.id) return;

    let reactor = profiles[r.user_id];
    if (!reactor) {
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", r.user_id).maybeSingle();
      if (prof) reactor = prof as Profile;
    }
    if (!reactor) return;

    const snippet =
      msg.kind === "image" ? "your photo" :
      msg.kind === "voice" ? "your voice message" :
      msg.kind === "file" ? "your file" :
      msg.kind === "call" ? "your call" :
      msg.body ? `"${msg.body.length > 40 ? msg.body.slice(0, 40) + "…" : msg.body}"` : "your message";

    toast.custom(() => (
      <div className="flex items-center gap-3 rounded-2xl border border-[#E07A5F]/20 bg-white/90 dark:bg-[#242424]/90 backdrop-blur-xl px-3.5 py-3 shadow-xl w-[320px]">
        <Avatar url={reactor!.avatar_url} name={reactor!.display_name} size={38} />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-[#2D3436] dark:text-[#E8E8E8]">
            <span className="font-semibold">{reactor!.display_name}</span> reacted{" "}
            <span className="text-base">{r.emoji}</span>
          </p>
          <p className="truncate text-xs text-[#8C8C8C]">to {snippet}</p>
        </div>
      </div>
    ), { duration: 4000 });
  }, [me, profiles]);

  // Realtime: messages, reactions, reads, member changes
  useEffect(() => {
    if (!me) return;
    const channel = supabase
      .channel("sona-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (p) => {
        const m = p.new as MessageRow;
        const notYetDue = m.scheduled_at && new Date(m.scheduled_at).getTime() > Date.now();
        if (m.chat_id === activeId && !notYetDue) {
          setMessages((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, m]);
          if (m.sender_id !== me.id) playReceiveSound();
        }
        if (!notYetDue) loadChats();
      })

      .on("postgres_changes", { event: "*", schema: "public", table: "reactions" }, (p) => {
        if (p.eventType === "INSERT") {
          const r = p.new as ReactionRow;
          setReactions((prev) => prev.some((x) => x.id === r.id) ? prev : [...prev, r]);
          if (r.user_id !== me.id) notifyReaction(r);
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
    });
    chan.on("broadcast", { event: "recording" }, (payload) => {
      const { user_id: uid, recording } = (payload.payload as { user_id?: string; recording?: boolean }) ?? {};
      if (!uid || uid === me.id) return;
      setRecordingOthers((prev) => {
        if (recording) return prev.includes(uid) ? prev : [...prev, uid];
        return prev.filter((x) => x !== uid);
      });
    });
    chan.subscribe();
    typingChanRef.current = chan;
    return () => {
      Object.values(timers).forEach(clearTimeout);
      supabase.removeChannel(chan);
      typingChanRef.current = null;
      setTypingOthers([]);
      setRecordingOthers([]);
    };
  }, [me, activeId]);

  // Typing/recording indicators for chats OTHER than the currently-open
  // one, so the chat list ("outside") can show "typing…" / "recording
  // audio…" the same way WhatsApp does, not just inside an open chat.
  useEffect(() => {
    if (!me) return;
    const otherChatIds = chats.map((c) => c.id).filter((id) => id !== activeId);
    if (otherChatIds.length === 0) { setListActivity({}); return; }
    const channels = otherChatIds.map((chatId) => {
      const chan = supabase.channel(`typing:${chatId}`, { config: { broadcast: { self: false } } });
      const clear = (kind: "typing" | "recording", uid: string) => {
        setListActivity((prev) => {
          const cur = prev[chatId];
          if (!cur) return prev;
          const next = { ...cur, [kind]: cur[kind].filter((x) => x !== uid) };
          return { ...prev, [chatId]: next };
        });
      };
      const mark = (kind: "typing" | "recording", uid: string) => {
        setListActivity((prev) => {
          const cur = prev[chatId] ?? { typing: [], recording: [] };
          if (cur[kind].includes(uid)) return prev;
          return { ...prev, [chatId]: { ...cur, [kind]: [...cur[kind], uid] } };
        });
      };
      chan.on("broadcast", { event: "typing" }, (payload) => {
        const uid = (payload.payload as { user_id?: string })?.user_id;
        if (!uid || uid === me.id) return;
        mark("typing", uid);
        setTimeout(() => clear("typing", uid), 3500);
      });
      chan.on("broadcast", { event: "recording" }, (payload) => {
        const { user_id: uid, recording } = (payload.payload as { user_id?: string; recording?: boolean }) ?? {};
        if (!uid || uid === me.id) return;
        recording ? mark("recording", uid) : clear("recording", uid);
      });
      chan.subscribe();
      return chan;
    });
    return () => {
      channels.forEach((c) => supabase.removeChannel(c));
      setListActivity({});
    };
  }, [me, activeId, chats.map((c) => c.id).join(",")]);

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

  const sendRecording = useCallback((recording: boolean) => {
    const chan = typingChanRef.current;
    if (!chan || !me) return;
    chan.send({ type: "broadcast", event: "recording", payload: { user_id: me.id, recording } });
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

  const profilesById = useMemo(() => {
    const map: Record<string, Profile> = {};
    if (me) map[me.id] = me;
    for (const c of chats) for (const m of c.members) map[m.id] = m;
    return map;
  }, [chats, me]);
  const [activeFolder, setActiveFolder] = useState<"all" | "unread" | "groups" | "pinned" | "customized">("all");
  const filtered = useMemo(() => chats.filter((c) => {
    if (!me) return true;
    if (!c.is_group) {
      const other = c.memberIds.find((id) => id !== me.id);
      if (other && blockedIds.has(other)) return false;
    }
    if (activeFolder === "unread" && c.unread === 0) return false;
    if (activeFolder === "groups" && !c.is_group) return false;
    if (activeFolder === "pinned" && !c.isPinned) return false;
    return chatTitle(c, me.id).toLowerCase().includes(query.toLowerCase());
  }), [chats, query, me, blockedIds, activeFolder]);

  const unreadFolderCount = chats.filter((c) => c.unread > 0).length;

  // Selection handlers
  const openScheduledList = async () => {
    if (!me || !activeId) return;
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_id", activeId)
      .eq("sender_id", me.id)
      .not("scheduled_at", "is", null)
      .gt("scheduled_at", new Date().toISOString())
      .order("scheduled_at");
    setScheduledMessages((data ?? []) as MessageRow[]);
    setShowScheduledList(true);
  };

  const cancelScheduled = async (messageId: string) => {
    const { error } = await supabase.from("messages").delete().eq("id", messageId).eq("sender_id", me?.id ?? "");
    if (error) { toast.error(error.message); return; }
    setScheduledMessages((prev) => prev.filter((m) => m.id !== messageId));
    toast.success("Scheduled message canceled");
  };

  const togglePin = async (e: React.MouseEvent, chat: ChatWithMeta) => {
    e.stopPropagation();
    if (!me) return;
    const next = !chat.isPinned;
    setChats((prev) => {
      const updated = prev.map((c) => (c.id === chat.id ? { ...c, isPinned: next } : c));
      updated.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
      return updated;
    });
    const { error } = await supabase
      .from("chat_members")
      .update({ is_pinned: next, pinned_at: next ? new Date().toISOString() : null })
      .eq("chat_id", chat.id)
      .eq("user_id", me.id);
    if (error) { toast.error(error.message); loadChats(); return; }
  };

  const toggleChatSelection = (chatId: string) => {
    setSelectedChatIds((prev) => {
      const next = new Set(prev);
      if (next.has(chatId)) next.delete(chatId);
      else next.add(chatId);
      return next;
    });
  };

  const messageProfile = async (profile: Profile) => {
    if (!me) return;
    // Reuse an existing 1:1 chat if one's already loaded
    const existing = chats.find((c) => !c.is_group && c.memberIds.includes(profile.id));
    if (existing) { setActiveId(existing.id); setViewingProfile(null); return; }

    try {
      const { data: chat, error: cErr } = await supabase.from("chats").insert({ is_group: false, created_by: me.id }).select().single();
      if (cErr) throw cErr;
      const { error: m1 } = await supabase.from("chat_members").insert({ chat_id: chat.id, user_id: me.id });
      if (m1) throw m1;
      const { error: m2 } = await supabase.from("chat_members").insert({ chat_id: chat.id, user_id: profile.id });
      if (m2) throw m2;
      setActiveId(chat.id);
      setViewingProfile(null);
      loadChats();
    } catch (e) {
      toast.error(explainSupabaseError(e).title);
    }
  };

  const leaveGroup = async (chatId: string) => {
    if (!me) return;
    if (!(await confirm({ title: "Leave this group?", description: "You'll need to be re-added to rejoin.", confirmText: "Leave", danger: true }))) return;
    const { error } = await supabase.from("chat_members").delete().eq("chat_id", chatId).eq("user_id", me.id);
    if (error) { toast.error(explainSupabaseError(error).title); return; }
    toast.success("You left the group");
    setShowMemberList(false);
    if (activeId === chatId) setActiveId(null);
    loadChats();
  };

  const deleteGroup = async (chatId: string) => {
    if (!(await confirm({ title: "Delete this group for everyone?", description: "This can't be undone.", confirmText: "Delete", danger: true }))) return;
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
    if (
      !(await confirm({
        title: `Delete ${count} chat${count === 1 ? "" : "s"}?`,
        description: `This will remove you from ${count === 1 ? "this chat" : "these chats"}.`,
        confirmText: "Delete",
        danger: true,
      }))
    )
      return;

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
  const send = async (scheduledFor?: Date) => {
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
    if (sending) return;

    const plaintext = draft.trim();
    let is_encrypted = false;
    let firstBody: string | null = plaintext || null;
    if (active?.is_hidden && firstBody && isUnlocked(activeId)) {
      const enc = await encryptBody(activeId, firstBody);
      if (enc) { firstBody = enc; is_encrypted = true; }
    }

    setSending(true);
    try {
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
      const expiresAt = active?.disappearing_seconds
        ? new Date(Date.now() + active.disappearing_seconds * 1000).toISOString()
        : null;
      const scheduledAt = scheduledFor ? scheduledFor.toISOString() : null;
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
          expires_at: expiresAt,
          scheduled_at: scheduledAt,
        });
        if (error) { toast.error(error.message); continue; }
      }
      if (scheduledFor) {
        toast.success(`Message scheduled for ${scheduledFor.toLocaleString()}`);
      } else {
        playSendSound();
      }

      const prompt = plaintext;
      const attachedImageUrl = firstAttachedImageUrl;
      setDraft(""); setPendingImages([]); setPendingDocs([]); setShowEmoji(false); setReplyTo(null);

      if (!scheduledFor && active && !active.is_hidden) {
        const isAI = isAIChat(active);
        const mentionsSona = /(^|\s)@sona\b/i.test(prompt);
        if ((isAI || mentionsSona) && (prompt || attachedImageUrl)) {
          toast.loading("Sona is thinking…", { id: "sona-ai" });
          askAI({ data: { chatId: activeId, prompt: prompt || "What's in this image?", imageUrl: attachedImageUrl } })
            .then(() => toast.dismiss("sona-ai"))
            .catch((e) => toast.error(e.message, { id: "sona-ai" }));
        }
      }
    } finally {
      setSending(false);
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
    if (!(await confirm({ title: "Delete this message for everyone?", confirmText: "Delete", danger: true }))) return;
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

  const setDisappearing = async (seconds: number | null) => {
    if (!active) return;
    const { error } = await supabase.from("chats").update({ disappearing_seconds: seconds }).eq("id", active.id);
    if (error) { toast.error(error.message); return; }
    toast.success(seconds ? `Disappearing messages: ${disappearingLabel(seconds)}` : "Disappearing messages turned off");
    setShowDisappearingMenu(false);
    setShowHeaderMenu(false);
    loadChats();
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
    if (!active || !me) return;
    const otherMemberIds = active.memberIds.filter((id) => id !== me.id);
    if (otherMemberIds.length === 0) return;
    callManagerRef.current?.startCall(
      active.id,
      otherMemberIds,
      kind,
      active.is_group,
      chatTitle(active, me.id),
      chatAvatarUrl(active, me.id)
    );
  };

  const relock = () => {
    if (!activeId) return;
    lockChat(activeId);
    setDecrypted({});
    setNeedsUnlock(true);
    setShowHeaderMenu(false);
  };

  const signOut = async () => {
    if (me) {
    await supabase
      .from("profiles")
      .update({
        last_seen: new Date().toISOString(),
      })
      .eq("id", me.id);
    }
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

    const typingNames = typingOthers
    .map((id) => profiles[id]?.display_name)
    .filter(Boolean) as string[];
  const recordingNames = recordingOthers
    .map((id) => profiles[id]?.display_name)
    .filter(Boolean) as string[];

  const repliesByParent = useMemo(() => {
    const map: Record<string, MessageRow[]> = {};
    for (const m of messages) {
      if (m.reply_to_id) (map[m.reply_to_id] ??= []).push(m);
    }
    return map;
  }, [messages]);
  useEffect(() => { setThreadRootId(null); }, [activeId]);

  const msgSearchMatches = useMemo(() => {
    const q = msgSearchQuery.trim().toLowerCase();
    if (!q) return [];
    return messages.filter((m) => {
      if (m.is_encrypted) {
        const pt = decrypted[m.id];
        return pt ? pt.toLowerCase().includes(q) : false;
      }
      return (m.body ?? "").toLowerCase().includes(q);
    });
  }, [messages, msgSearchQuery, decrypted]);

  useEffect(() => { setMsgSearchIndex(0); }, [msgSearchQuery]);
  useEffect(() => { setShowMsgSearch(false); setMsgSearchQuery(""); setShowDisappearingMenu(false); }, [activeId]);
  useEffect(() => {
    if (!showMsgSearch || msgSearchMatches.length === 0) return;
    const target = msgSearchMatches[Math.min(msgSearchIndex, msgSearchMatches.length - 1)];
    const el = target && msgRefs.current.get(target.id);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [msgSearchIndex, msgSearchMatches, showMsgSearch]);
  
useEffect(() => {
  if (!showHeaderMenu) return;
  const onClick = (e: MouseEvent) => {
    if (!headerMenuRef.current?.contains(e.target as Node)) {
      setShowHeaderMenu(false);
    }
  };
  document.addEventListener("click", onClick);
  return () => document.removeEventListener("click", onClick);
}, [showHeaderMenu]);
    
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
                  {[1, 2].map((i) => (
                    <div key={i} className="h-9 w-9 rounded-full bg-[#1E1E1E]/10 animate-pulse" />
                  ))}
                </div>
              </div>
              <div className="px-3 pb-2 pt-2">
                <div className="h-10 rounded-full bg-[#E07A5F]/10 animate-pulse" />
              </div>
              <div className="flex-1 space-y-1 px-2 pt-1">
                {[1, 2, 3, 4, 5, 6, 7,8,9,10,11,12,13].map((i) => (
                  <div key={i} className="flex items-center gap-3 p-3">
                    <div className="h-12 w-12 shrink-0 rounded-full bg-[#1E1E1E]/20 animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-2/5 rounded bg-[#E07A5F]/20 animate-pulse" />
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

  
  return (
    <div className="h-dvh w-full bg-[#F0EBE3] text-[#2D3436] dark:bg-[#1A1A1A] dark:text-[#E8E8E8]">
      {me && <CallManager ref={callManagerRef} meId={me.id} meName={me.display_name ?? "Someone"} meAvatar={me.avatar_url ?? null} />}
      <div className="mx-auto flex h-full max-w-[1400px] overflow-hidden md:p-4">
        <div className="flex h-full w-full overflow-hidden rounded-none bg-white shadow-2xl md:rounded-3xl md:border border-[#E07A5F]/20 dark:bg-[#242424] dark:border-[#E07A5F]/10">
          {/* Sidebar */}
          <aside className={`${showSidebarMobile ? "flex" : "hidden"} relative h-full w-full flex-col border-r border-[#E07A5F]/10 bg-[#FFFDF9] dark:bg-[#1E1E1E] dark:text-[#E8E8E8] md:flex md:w-[32%] md:min-w-[300px] md:max-w-[420px]`}>
            {/* Header */}
            <div className="flex items-center justify-between gap-2 px-2 py-3 bg-transparent dark:text-white text-gray-600">
              <div className="flex items-center gap-2 min-w-0 select-none cursor-default">
  <div className="leading-none min-w-0 flex items-baseline gap-[2px]">
    <span className="text-[26px] font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-[#2D3436] to-[#5a5a5a] dark:from-white dark:to-[#b0b0b0]">
      Sona
    </span>
    <span className="text-[26px] font-black tracking-tighter text-[#E07A5F]">
      TG
    </span>
  </div>
</div>
              {/* Header toolbar: Share + More dropdown */}
<div className="flex items-center gap-1 dark:text-white text-gray-600 shrink-0 border border-slate-800 dark:border-slate-700 rounded-md px-1 py-1">
  {/* Share — always visible */}
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
    className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/20 text-gray-600 dark:text-white transition-colors"
    aria-label="Share app"
    title="Share app"
  >
    <Share2 className="h-4 w-4" />
  </button>

  {/* Divider */}
  <div className="w-px h-5 bg-slate-300 dark:bg-slate-600" />

  {/* More options dropdown */}
<div className="relative" ref={headerMenuRef}>
    <button
      data-tour="settings-btn"
      onClick={() => setShowHeaderMenu((v) => !v)}
      className={`grid h-9 w-9 place-items-center rounded-full transition-colors ${
        showHeaderMenu ? "bg-white/20" : "hover:bg-white/20"
      } text-gray-600 dark:text-white`}
      aria-label="More options"
      aria-expanded={showHeaderMenu}
    >
      <MoreVertical className="h-4 w-4" />
    </button>

    <AnimatePresence>
    {showHeaderMenu && (
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -6 }}
        transition={{ duration: 0.14, ease: "easeOut" }}
        className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-[#E07A5F]/10 bg-white dark:bg-[#242424] shadow-xl z-50 overflow-hidden origin-top-right"
      >
        <div className="py-1">
          {canInstall && (
            <button
              onClick={() => { promptInstall(); setShowHeaderMenu(false); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#2D3436] dark:text-[#E8E8E8] hover:bg-[#F4A261]/10 transition-colors"
            >
              <Download className="h-4 w-4 shrink-0" />
              Install app
            </button>
          )}

          <button
            onClick={() => { toggle(); setShowHeaderMenu(false); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#2D3436] dark:text-[#E8E8E8] hover:bg-[#F4A261]/10 transition-colors"
          >
            {theme === "dark" ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>

          <Link
            to="/learn"
            onClick={() => setShowHeaderMenu(false)}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#2D3436] dark:text-[#E8E8E8] hover:bg-[#F4A261]/10 transition-colors"
          >
            <IoFootstepsOutline className="h-4 w-4 shrink-0" />
            How to use SonaTG
          </Link>

          <AdminLink onNavigate={() => setShowHeaderMenu(false)} />

          <button
            onClick={() => { setShowTour(true); setShowHeaderMenu(false); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#2D3436] dark:text-[#E8E8E8] hover:bg-[#F4A261]/10 transition-colors"
          >
            <HelpCircle className="h-4 w-4 shrink-0" />
            Replay tour
          </button>

          <button
            onClick={() => { setShowSettings(true); setShowHeaderMenu(false); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#2D3436] dark:text-[#E8E8E8] hover:bg-[#F4A261]/10 transition-colors"
          >
            <Settings className="h-4 w-4 shrink-0" />
            Settings
          </button>

          <div className="my-1 border-t border-slate-200 dark:border-slate-700" />

          <button
            onClick={() => { signOut(); setShowHeaderMenu(false); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign out
          </button>
        </div>
      </motion.div>
    )}
    </AnimatePresence>
  </div>
</div>
            </div>

            {/* Selection mode bar */}
            {selectMode && (
              <div className="flex items-center justify-between gap-2 px-4 py-2 bg-[transparent] border-b border-[#E07A5F]/10">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#E07A5F]">
                  <CheckSquare className="h-4 w-4" />
                  {selectedChatIds.size} selected
                </div>
                <div className="flex items-center gap-3">
                  {  loadingChats ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 py-2">
                  <Loader2 className="h-3 w-3 animate-spin text-[#E07A5F]" />
                  
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

            <div className="px-3 pb-3 pt-3">
              <div className="flex items-center gap-2 rounded-full bg-[#F5F0E8] dark:bg-[#2A2A2A] px-4 py-3 border border-[#E07A5F]/10">
                <Search className="h-8 w-8 text-[#8C8C8C]" />
                <input data-tour="search-chats" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search chats"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-[#8C8C8C] text-[#2D3436] dark:text-[#E8E8E8]" />
              </div>
            </div>

            <div data-tour="folder-tabs" className="flex items-center gap-2 overflow-x-auto px-3 pb-4 scrollbar-thin">
              {([
                { key: "all", label: "All" },
                { key: "unread", label: `Unread ${unreadFolderCount ? ` ${unreadFolderCount}` : ""}` },
                { key: "groups", label: "Groups" },
                { key: "pinned", label: "Favorites" },
                { key: "customized", label: "+" },
              ] as const).map((f) => (
                <button
                  key={f.key}
                  onClick={() => setActiveFolder(f.key)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    activeFolder === f.key
                      ? "bg-[#E07A5F] text-white"
                      : "bg-[#F5F0E8] dark:bg-[#2A2A2A] text-[#8C8C8C] hover:bg-[#F4A261]/20"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {me && (
              <div data-tour="status-bar" className="px-3 pb-3">
                <button
                  onClick={() => navigate({ to: "/status" })}
                  className="flex w-full items-center gap-2 rounded-full bg-[#1E1E1E]/10 px-4 py-4 text-sm font-semibold text-[#E07A5F] transition hover:bg-[#E07A5F]/20"
                >
                  <Plus className="h-4 w-4" /> Status &amp; news
                </button>
              </div>
            )}


            <div className="scrollbar-thin flex-1 overflow-y-auto pb-24">
             <AnimatePresence initial={false}>
             {(filtered.map((c) => {
      const title = chatTitle(c, c.memberIds.includes(me.id) ? me.id : "");
      const last = c.lastMessage;
      const mine = last?.sender_id === me.id;
      const isActive = c.id === activeId;
      const ai = isAIChat(c);
      const isSelected = selectedChatIds.has(c.id);
      return (
        <motion.div key={c.id}
          layout
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 500, damping: 40, mass: 0.6 }}
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
          className={`group flex w-full items-center gap-3 px-3 py-3 text-left transition-colors cursor-pointer hover:bg-[#F4A261]/10 ${isActive ? "border-slate-800" : ""} border-b border-[#1E1E1E]/10`}
          style={isSelected ? { backgroundColor: "rgba(217, 119, 87, 0.10)" } : undefined}>
          <div className="relative shrink-0">
            {(() => {
              const otherId = c.memberIds.find((id) => id !== me.id);
              const hasStatus = !ai && otherId && usersWithStatus.has(otherId);
              return (
                <div
                  className="rounded-full"
                  style={hasStatus ? { padding: 4, background: "linear-gradient(117deg, #128C7E, #075E54 )", cursor: "pointer" } : undefined}
                  onClick={hasStatus ? (e) => {
                    e.stopPropagation();
                    navigate({ to: "/status", search: { user: otherId! } });
                  } : undefined}
                  title={hasStatus ? "View status" : undefined}
                >
                  <Avatar url={chatAvatarUrl(c, me.id)} name={title} size={hasStatus ? 46 : 50} ai={ai} />
                </div>
              );
            })()}
            {!!c.disappearing_seconds && !selectMode && (
              <div
                className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full dark:bg-[#1E1E1E] bg-[#fff] ring-2 ring-[#fff] dark:ring-[#1E1E1E]"
                title={`Disappearing messages: ${disappearingLabel(c.disappearing_seconds)}`}
              >
                <IoMdTimer className="h-5 w-5 dark:text-white text-[#1E1E1E]" />
              </div>
            )}
            {selectMode && (
              <div
                onClick={(e) => { e.stopPropagation(); toggleChatSelection(c.id); }}
                className="absolute -bottom-0.5 -right-0.5 grid h-6 w-6 place-items-center rounded-full ring-2 ring-white dark:ring-[#1E1E1E]"
                style={{ backgroundColor: isSelected ? "#D97757" : "#8C8C8C" }}
              >
                {isSelected && <Check className="h-3.8 w-3.8 text-white" strokeWidth={3} />}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-sm text-[#2D3436] dark:text-[#E8E8E8]">
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
                {c.isPinned && (
                  <Pin className="h-3 w-3 shrink-0 fill-[#8C8C8C] text-[#8C8C8C]" />
                )}
              </span>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {!selectMode && (
                  <button
                    onClick={(e) => togglePin(e, c)}
                    className={`grid h-6 w-6 md:h-5 md:w-5 place-items-center rounded-full hover:bg-[#F4A261]/20 ${
                      c.isPinned ? "" : "opacity-40 md:opacity-0 md:group-hover:opacity-100"
                    }`}
                    aria-label={c.isPinned ? "Unpin chat" : "Pin chat"}
                    title={c.isPinned ? "Unpin chat" : "Pin chat"}
                  >
                    <Pin className={`h-3 w-3 ${c.isPinned ? "fill-[#E07A5F] text-[#E07A5F]" : "text-[#8C8C8C]"}`} />
                  </button>
                )}
                <span className={`text-[11px] ${c.unread > 0 ? "font-semibold" : "text-[#8C8C8C]"}`} style={c.unread > 0 ? { color: "#D97757" } : undefined}>
                  {last ? fmtTime(last.created_at) : ""}
                </span>
                {!ai && c.unread > 0 && !selectMode && (
                  <span
                    className="grid h-5 min-w-[20px] place-items-center rounded-full text-white text-[10px] font-bold px-1"
                    style={{ backgroundColor: "#D97757" }}
                  >
                    {c.unread > 99 ? "99+" : c.unread}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <div className="min-w-0 flex-1 flex items-center gap-1 text-sm text-[#8C8C8C]">
                {(() => {
                  const act = listActivity[c.id];
                  if (act?.recording.length) {
                    return (
                      <span className="inline-flex items-center gap-1 truncate text-[#E07A5F]">
                        <IoMdMic className="h-3.5 w-3.5 shrink-0 animate-pulse" /> recording audio…
                      </span>
                    );
                  }
                  if (act?.typing.length) {
                    return <span className="truncate animate-pulse text-[#E07A5F]">typing…</span>;
                  }
                  return (
                    <>
                      {mine && last && <TickIcon status={readStatusFor(last, reads, c.memberIds, me.id)} className="h-3.5 w-3.5 shrink-0" />}
                      <span className="truncate">
                        <MessagePreview msg={last} />
                      </span>
                    </>
                  );
                })()}
              </div>
              {c.is_hidden && <Lock className="h-3 w-3 text-[#E07A5F] shrink-0" />}
            </div>
          </div>
        </motion.div>
      );
    })
  )}
  {!loadingChats && filtered.length === 0 && <div className="p-6 text-center text-sm text-[#8C8C8C]">No chats yet. Tap + to start one.</div>}
</AnimatePresence>
</div>
            {/* Floating New-Chat FAB */}
            <button
  data-tour="new-chat-fab"
  onClick={() => setShowNewChat(true)}
  aria-label="New chat"
  className="group absolute bottom-8 right-5 z-30 grid h-[72px] w-[72px] place-items-center rounded-2xl
    /* Glass base */
    bg-white/20 dark:bg-white/10
    backdrop-blur-xl
    border border-white/30 dark:border-white/15
    /* 3D depth shadow stack */
    shadow-[0_1px_2px_rgba(0,0,0,0.05),0_4px_8px_rgba(224,122,95,0.15),0_12px_24px_rgba(224,122,95,0.25),inset_0_1px_0_rgba(255,255,255,0.4)]
    dark:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_4px_12px_rgba(224,122,95,0.2),0_16px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)]
    /* Inner glow */
    before:absolute before:inset-0 before:rounded-2xl before:bg-gradient-to-br before:from-[#E07A5F]/30 before:to-[#F4A261]/10 before:opacity-100
    dark:before:from-[#E07A5F]/20 dark:before:to-transparent
    /* Top highlight rim */
    after:absolute after:inset-0 after:rounded-2xl after:border after:border-t-white/50 after:border-b-transparent after:border-x-transparent
    dark:after:border-t-white/20
    /* 3D push interaction */
    transition-all duration-200 ease-out
    hover:-translate-y-1 hover:shadow-[0_2px_4px_rgba(0,0,0,0.05),0_8px_16px_rgba(224,122,95,0.2),0_20px_40px_rgba(224,122,95,0.3),inset_0_1px_0_rgba(255,255,255,0.5)]
    dark:hover:shadow-[0_2px_4px_rgba(0,0,0,0.4),0_8px_20px_rgba(224,122,95,0.25),0_24px_48px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.15)]
    active:translate-y-0.5 active:scale-[0.96] active:shadow-[0_1px_2px_rgba(0,0,0,0.1),0_2px_6px_rgba(224,122,95,0.15),inset_0_2px_4px_rgba(0,0,0,0.1)]
    dark:active:shadow-[0_1px_2px_rgba(0,0,0,0.5),inset_0_2px_4px_rgba(0,0,0,0.3)]"
>
  {/* Icon with subtle 3D lift */}
  <BiSolidMessageSquareAdd className="relative z-10 h-10 w-10 text-[#2D3436] dark:text-white rotate-90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.1)] transition-transform duration-200 group-hover:scale-110 group-active:scale-95" />
</button>
          </aside>

          {/* Chat panel */}
          <section className={`${showSidebarMobile ? "hidden" : "flex"} relative h-full min-w-0 flex-1 flex-col md:flex bg-[#F0EBE3] dark:bg-[#1A1A1A]`}>
            {active ? (
              <>
                <header className="relative flex items-center gap-1.5 border-transparent bg-[#FFFDF9] dark:bg-[#242424] px-1.5 py-2.5 md:px-4">
                  <button onClick={closeActiveChat} className="grid h-9 w-9 place-items-center rounded-full hover:bg-[#F4A261]/20 md:hidden" aria-label="Back">
                    <RiArrowLeftWideFill className="h-5 w-5 text-[#2D3436] dark:text-[#E8E8E8]" />
                  </button>
                  <button
                    onClick={() => {
                      if (active.is_group) { setShowMemberList(true); return; }
                      const otherId = active.memberIds.find((id) => id !== me.id);
                      const other = otherId ? profilesById[otherId] : undefined;
                      if (other) setViewingProfile(other);
                    }}
                    className="relative shrink-0"
                  >
                    <Avatar url={chatAvatarUrl(active, me.id)} name={chatTitle(active, me.id)} ai={isAIChat(active)} />
                    {!!active.disappearing_seconds && (
                      <div
                        className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-[#FFFDF9] ring-2 ring-[#FFFDF9] dark:ring-[#1A1A1A]"
                        title={`Disappearing messages: ${disappearingLabel(active.disappearing_seconds)}`}
                      >
                        <IoMdTimer className="h-4 w-4 text-white" />
                      </div>
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <button
                      onClick={() => active.is_group && setShowMemberList(true)}
                      className="truncate font-semibold flex items-center gap-1.5 text-[#2D3436] dark:text-[#E8E8E8] text-left"
                    >
                      {(() => {
  const title = chatTitle(active, me.id);
  const isLong = title.length > 24;
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span
        className={`
          truncate text-sm tracking-tight
          ${isLong 
            ? "text-[10px]" 
            : "text-[15px]"
          }
          ${isAIChat(active)
            ? ""
            : "text-[#2D3436] dark:text-[#F5F0E8]"
          }
        `}
        title={title}
      >
        {title}
      </span>

      {isAIChat(active) && (
        <VscVerifiedFilled
          className="h-4 w-4 text-blue-500 shrink-0 drop-shadow-[0_1px_2px_rgba(59,130,246,0.3)]"
          aria-label="Verified Sona AI"
          title="Verified"
        />
      )}

      {active.is_hidden && (
        <Lock className="h-3 w-3 text-[#E07A5F] shrink-0" />
      )}

      
    </div>
  );
})()}
                      {active.is_hidden && <Lock className="h-3.5 w-3.5 text-[#E07A5F]" />}
                      {active.memberRoles[me.id] === "admin" && active.is_group && (
                        <BadgeCheck className="h-3.5 w-3.5 text-[#4FA6E0] drop-shadow-[0_1px_2px_rgba(59,130,246,0.3)]" title="Admin" />
                      )}
                      {active.is_group && active.category && active.category !== "general" && (
                        <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium text-[#E07A5F] text-transparent bg-clip-text bg-gradient-to-r from-[#E07A5F]/10 to-[#E07A5F]" >
                           {categoryMeta[active.category].label}
                        </span>
                      )}
                    </button>
                    <button
  onClick={() => active.is_group && setShowMemberList(true)}
  className="truncate text-xs text-[#8C8C8C] text-left w-full overflow-hidden"
>
  {recordingNames.length > 0 ? (
    <span className="inline-flex items-center gap-1 text-[#E07A5F]">
      <IoMdMic className="h-3.5 w-3.5 animate-pulse text-green-600" />
      {recordingNames.join(", ")} recording audio…
    </span>
  ) : typingNames.length > 0 ? (
    <span className="text-[#E07A5F]">{typingNames.join(", ")} typing…</span>
  ) : isAIChat(active) ? (
    <span className="inline-flex items-center gap-1.5">   
      Sona AI Ask Anything
    </span>
  ) : active.is_group ? (
    <div className="relative flex overflow-hidden w-full">
      <div className="whitespace-nowrap animate-marquee flex items-center gap-1">
        
        
        <span className="mx-4">{active.members.map((m) => m.display_name).join(", ")}</span>
        <span className="opacity-50">•</span>
        <span className="mx-4">{active.members.map((m) => m.display_name).join(", ")}</span>
      </div>
    </div>
  ) : (() => {
      const otherId = active.memberIds.find((id) => id !== me.id);
      const other = otherId ? profilesById[otherId] : undefined;
      const online = otherId ? onlineIds.has(otherId) : false;

      if (online) {
        return (
          <span className="inline-flex items-center gap-1.5">
          
            <span className="text-[#4ade80] font-medium">Online</span>
          </span>
        );
      }

      if (other?.last_seen) {
        const lastSeenDate = new Date(other.last_seen);
        const minsAgo = Math.floor((Date.now() - lastSeenDate.getTime()) / 60000);
        const isRecent = minsAgo < 5;

        return (
          <span className="inline-flex items-center gap-1.5">
          <span>{fmtLastSeen(other.last_seen)}</span>
          </span>
        );
      }

      return (
        <span className="inline-flex items-center gap-1.5">
          <span>Offline</span>
        </span>
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

                  <Dropdown
                    trigger={["click"]}
                    placement="bottomRight"
                    menu={{
                      items: [
                        {
                          key: "search",
                          label: "Search in chat",
                          icon: <Search className="h-4 w-4" />,
                        },
                        {
                          key: "summarize",
                          label: (
                            <span className="flex w-full items-center">
                              Summarize chat
                              {!me.is_pro && <Crown className="ml-auto h-3 w-3 text-[#E07A5F]" />}
                            </span>
                          ),
                          icon: <Sparkles className="h-4 w-4 text-[#E07A5F]" />,
                        },
                        ...(!isAIChat(active)
                          ? [
                              {
                                key: "disappearing",
                                label: "Disappearing messages",
                                icon: <IoMdTimer className="h-4 w-4" />,
                                children: DISAPPEARING_OPTIONS.map((opt) => ({
                                  key: `disappearing-${opt.label}`,
                                  label: (
                                    <span className="flex w-full items-center justify-between">
                                      {opt.label}
                                      {(active.disappearing_seconds ?? null) === opt.seconds && (
                                        <Check className="h-3.5 w-3.5 text-[#E07A5F]" />
                                      )}
                                    </span>
                                  ),
                                  onClick: () => setDisappearing(opt.seconds),
                                })),
                              },
                            ]
                          : []),
                        {
                          key: "scheduled",
                          label: "Scheduled messages",
                          icon: <Clock className="h-4 w-4" />,
                        },
                        {
                          key: "hide",
                          label: (
                            <span className="flex w-full items-center">
                              {active.is_hidden ? "Unhide chat" : "Hide & encrypt"}
                              {!me.is_pro && !active.is_hidden && <Crown className="ml-auto h-3 w-3 text-[#E07A5F]" />}
                            </span>
                          ),
                          icon: active.is_hidden ? <Unlock className="h-4 w-4" /> : <Shield className="h-4 w-4" />,
                          onClick: toggleHideChat,
                        },
                        ...(active.is_hidden && isUnlocked(active.id)
                          ? [{ key: "lock", label: "Lock now", icon: <Lock className="h-4 w-4" />, onClick: relock }]
                          : []),
                        ...(!isAIChat(active) && !active.is_group
                          ? [{ key: "block", label: "Block user", icon: <Ban className="h-4 w-4" />, danger: true, onClick: blockOther }]
                          : []),
                      ],
                      onClick: ({ key }) => {
                        if (key === "search") setShowMsgSearch((s) => !s);
                        if (key === "summarize") runSummary();
                        if (key === "scheduled") openScheduledList();
                      },
                    }}
                  >
                    <button className="grid h-9 w-9 place-items-center rounded-full hover:bg-[#F4A261]/20" aria-label="Menu">
                      <MoreVertical className="h-5 w-5 text-[#2D3436] dark:text-[#E8E8E8]" />
                    </button>
                  </Dropdown>
                </header>

                {showMsgSearch && (
                  <div className="flex items-center gap-2 border-b border-[#E07A5F]/10 bg-[#FFFDF9] dark:bg-[#1E1E1E] px-4 py-2">
                    <Search className="h-4 w-4 shrink-0 text-[#8C8C8C]" />
                    <input
                      autoFocus
                      value={msgSearchQuery}
                      onChange={(e) => setMsgSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && msgSearchMatches.length) {
                          setMsgSearchIndex((i) => (e.shiftKey ? (i - 1 + msgSearchMatches.length) : (i + 1)) % msgSearchMatches.length);
                        }
                        if (e.key === "Escape") setShowMsgSearch(false);
                      }}
                      placeholder="Search in this chat…"
                      className="flex-1 bg-transparent text-sm outline-none text-[#2D3436] dark:text-[#E8E8E8] placeholder:text-[#8C8C8C]"
                    />
                    {msgSearchQuery && (
                      <span className="shrink-0 text-xs text-[#8C8C8C]">
                        {msgSearchMatches.length ? `${msgSearchIndex + 1}/${msgSearchMatches.length}` : "No results"}
                      </span>
                    )}
                    <button
                      disabled={!msgSearchMatches.length}
                      onClick={() => setMsgSearchIndex((i) => (i - 1 + msgSearchMatches.length) % msgSearchMatches.length)}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full hover:bg-[#F4A261]/20 disabled:opacity-30"
                      aria-label="Previous match"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      disabled={!msgSearchMatches.length}
                      onClick={() => setMsgSearchIndex((i) => (i + 1) % msgSearchMatches.length)}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full hover:bg-[#F4A261]/20 disabled:opacity-30"
                      aria-label="Next match"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => { setShowMsgSearch(false); setMsgSearchQuery(""); }}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full hover:bg-[#F4A261]/20"
                      aria-label="Close search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}

                <div ref={scrollRef} className="scrollbar-thin flex-1 overflow-y-auto px-3 py-4 md:px-8 chat-pattern">
                  <div className="mx-auto flex max-w-3xl flex-col gap-0.5">
                    <div className="mx-auto rounded-full bg-[#F4A261]/20 px-4 py-1.5 text-[11px] text-[#8C8C8C] backdrop-blur mb-3 border border-[#E07A5F]/10">
                      {isAIChat(active) ? "Chat with Sona" : "Type @sona to summon the Sona AI"}
                    </div>
                    <AnimatePresence initial={false}>
                     {messages.map((m, idx) => {
  const prev = messages[idx - 1];
  const groupWithPrev = prev && prev.sender_id === m.sender_id
    && new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 60_000;

  const showDateSeparator = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();

  const overrideBody = m.is_encrypted
    ? (decrypted[m.id] ?? "Locked message — unlock this chat to read")
    : undefined;

  const parentMsg = m.reply_to_id ? messages.find((x) => x.id === m.reply_to_id) : undefined;
  const parentBody = parentMsg ? <MessagePreview msg={parentMsg} decrypted={decrypted} /> : undefined;
  const parentName = parentMsg
    ? (parentMsg.sender_id === me.id ? "You" : (profiles[parentMsg.sender_id]?.display_name ?? "…"))
    : undefined;

  const isCurrentMatch = showMsgSearch && msgSearchMatches[msgSearchIndex]?.id === m.id;

  return (
    <div key={m.id} className="contents">
    {showDateSeparator && (
      <div className="my-3 flex justify-center">
        <span className="rounded-full bg-[#F4A261]/20 px-3 py-1 text-[11px] font-medium text-[#8C8C8C] backdrop-blur border border-[#E07A5F]/10">
          {fmtDateLabel(m.created_at)}
        </span>
      </div>
    )}
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 500, damping: 40, mass: 0.6 }}
      ref={(el) => { if (el) msgRefs.current.set(m.id, el); else msgRefs.current.delete(m.id); }}
      className={isCurrentMatch ? "rounded-2xl ring-2 ring-[#E07A5F] ring-offset-2 ring-offset-transparent transition-all" : ""}
    >
    <Bubble
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
      onTranscribed={(messageId, transcript) =>
        setMessages((prev) => prev.map((row) => (row.id === messageId ? { ...row, transcript } : row)))
      }
      replyCount={repliesByParent[m.id]?.length ?? 0}
      onOpenThread={() => setThreadRootId(m.id)}
    />
    </motion.div>
    </div>
  );
})}
                    </AnimatePresence>

                    {typingNames.length > 0 && (
                      <div className="flex items-end gap-2 mt-3">
                        <div className="rounded-2xl rounded-bl-md bg-white dark:bg-[#2A2A2A] text-[#2D3436] dark:text-[#E8E8E8] shadow-sm px-3 py-2.5 flex items-center gap-1 border border-[#E07A5F]/10">
                          <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[#E07A5F] inline-block animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[#E07A5F] inline-block animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[#E07A5F] inline-block animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Floating Sona AI 
                
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
*/} 
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
                                className={`h-20 w-20 rounded-lg object-cover border border-[#E07A5F]/20 bg-black/5 transition-opacity ${sending ? "opacity-50" : ""}`}
                              />
                              {sending && (
                                <div className="absolute inset-0 grid place-items-center rounded-lg bg-black/20">
                                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                                </div>
                              )}
                              <button
                                onClick={() => setPendingImages((prev) => prev.filter((_, idx) => idx !== i))}
                                aria-label="Remove image"
                                disabled={sending}
                                className="absolute -top-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-full bg-[#2D3436] shadow-md hover:bg-black disabled:opacity-40"
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
                            <div key={i} className={`flex items-center gap-2 rounded-lg border border-[#E07A5F]/20 bg-white dark:bg-[#2A2A2A] px-3 py-2 transition-opacity ${sending ? "opacity-60" : ""}`}>
                              {sending ? (
                                <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[#E07A5F]" />
                              ) : (
                                <FileText className="h-5 w-5 text-[#E07A5F] shrink-0" />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm text-[#2D3436] dark:text-[#E8E8E8]">{f.name}</p>
                                <p className="text-xs text-[#8C8C8C]">{sending ? "Uploading…" : formatBytes(f.size)}</p>
                              </div>
                              <button
                                onClick={() => setPendingDocs((prev) => prev.filter((_, idx) => idx !== i))}
                                aria-label="Remove file"
                                disabled={sending}
                                className="grid h-7 w-7 shrink-0 place-items-center rounded-full hover:bg-[#F4A261]/20 disabled:opacity-40"
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
                  hasAttachments={pendingImages.length > 0 || pendingDocs.length > 0}
                  sending={sending}
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
                  onRecordingChange={sendRecording}
                  onSchedule={(date) => send(date)}
                />
              </>
            ) : (
              <div className="grid flex-1 place-items-center p-6 text-center text-[#8C8C8C] chat-pattern">
                <div>
                  <img src={sonaLogo} alt="" className="mx-auto h-24 w-24 opacity-60 invert-1" />
                  <p className="mt-5 text-[#8C8C8C] flex gap-2 ">Pick a chat or tap <BiSolidMessageSquareAdd className ="text-white" /> to start a new one.</p>
                </div>
              </div>
            )}
            <AnimatePresence>
            {threadRootId && me && active && (
              <ThreadPanel
                key="thread-panel"
                root={messages.find((m) => m.id === threadRootId) ?? null}
                replies={(repliesByParent[threadRootId] ?? []).slice().sort((a, b) => a.created_at.localeCompare(b.created_at))}
                me={me}
                profiles={profiles}
                decrypted={decrypted}
                onClose={() => setThreadRootId(null)}
                onSendReply={async (text) => {
                  const { error } = await supabase.from("messages").insert({
                    chat_id: activeId!, sender_id: me.id, kind: "text", body: text, reply_to_id: threadRootId!,
                  });
                  if (error) toast.error(error.message);
                }}
              />
            )}
            </AnimatePresence>
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
          onViewProfile={(m) => { setShowMemberList(false); setViewingProfile(m); }}
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

      {viewingProfile && me && (
        <ProfileViewModal
          profile={viewingProfile}
          isSelf={viewingProfile.id === me.id}
          onClose={() => setViewingProfile(null)}
          onMessage={() => messageProfile(viewingProfile)}
          onEdit={() => { setViewingProfile(null); setShowSettings(true); }}
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

      <AnimatePresence>
      {summary !== null && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setSummary(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 10 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className="w-full max-w-md rounded-2xl border border-[#E07A5F]/10 bg-[#FFFDF9] dark:bg-[#2A2A2A] p-5 shadow-xl" onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-[#E07A5F]" />
              <h3 className="text-base font-semibold text-[#2D3436] dark:text-[#E8E8E8]">Chat summary</h3>
            </div>
            <p className="whitespace-pre-wrap text-sm text-[#8C8C8C]">{summary}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  const blob = new Blob([summary], { type: "text/plain;charset=utf-8" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${(active ? chatTitle(active, me.id) : "chat").replace(/[^\w\- ]/g, "")} summary.txt`;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  URL.revokeObjectURL(url);
                }}
                className="flex items-center gap-1.5 rounded-xl bg-[#E07A5F] px-3 py-2 text-sm font-medium text-white hover:opacity-90 transition"
              >
                <Download className="h-4 w-4" /> Download
              </button>
              <button onClick={() => setSummary(null)} className="rounded-xl bg-[#F5F0E8] dark:bg-[#3A3A3A] px-3 py-2 text-sm text-[#2D3436] dark:text-[#E8E8E8] hover:bg-[#F4A261]/20 transition">Close</button>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      <AnimatePresence>
      {showScheduledList && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setShowScheduledList(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 10 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className="w-full max-w-md rounded-2xl border border-[#E07A5F]/10 bg-[#FFFDF9] dark:bg-[#2A2A2A] p-5 shadow-xl" onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-[#E07A5F]" />
              <h3 className="text-base font-semibold text-[#2D3436] dark:text-[#E8E8E8]">Scheduled messages</h3>
            </div>
            {scheduledMessages.length === 0 ? (
              <p className="text-sm text-[#8C8C8C]">No messages scheduled in this chat.</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {scheduledMessages.map((m) => (
                  <div key={m.id} className="flex items-start gap-2 rounded-xl border border-[#E07A5F]/10 bg-white/60 dark:bg-white/5 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-[#2D3436] dark:text-[#E8E8E8]">{m.body || "(attachment)"}</p>
                      <p className="text-xs text-[#8C8C8C]">{m.scheduled_at && new Date(m.scheduled_at).toLocaleString()}</p>
                    </div>
                    <button
                      onClick={() => cancelScheduled(m.id)}
                      className="shrink-0 rounded-full p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
                      aria-label="Cancel scheduled message"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <button onClick={() => setShowScheduledList(false)} className="rounded-xl bg-[#F5F0E8] dark:bg-[#3A3A3A] px-3 py-2 text-sm text-[#2D3436] dark:text-[#E8E8E8] hover:bg-[#F4A261]/20 transition">Close</button>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {showTour && <OnboardingTour steps={ONBOARDING_STEPS} onFinish={() => setShowTour(false)} />}
    </div>
  );
}

