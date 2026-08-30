import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Search, MoreVertical, ArrowLeft,
  Plus, X, Trash2,
  MessageSquarePlus, Settings, PhoneMissed, Shield, Sparkles, Lock,
  Ban, Reply, Pencil, Crown, Users, Phone, Video, CheckSquare, Square, BookOpen, Check, ChevronUp, ChevronDown, Clock, Pin, Send,
  Share2, BadgeCheck, FileText, DoorOpen, Download,
  Tag, Briefcase, Gamepad2, GraduationCap, Heart, Music, Plane, Newspaper, HelpCircle, Loader2,
  AlertTriangle, FolderPlus, FolderCog, Flag, ListChecks, Link2, Megaphone, Radio,
} from "lucide-react";
import { LuCircleFadingPlus } from "react-icons/lu";
import { IoCameraOutline } from "react-icons/io5";
import { CiTimer } from "react-icons/ci";
import { fetchActiveAnnouncement, type AppAnnouncement } from "@/lib/announcements";
import { notifyOfflineMessage } from "@/lib/notifications.functions";
import { buildTranscript, exportChatAsJSON, exportChatAsPDF } from "@/lib/export-chat";
import { Watermark, Modal, Input, message as antMessage } from "antd";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { useSonaTheme } from "@/hooks/useSonaTheme";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { askSonaAI, summarizeChat } from "@/lib/ai.functions";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { CallManager, type CallManagerHandle } from "./CallManager";
import { ConfirmProvider, useConfirm } from "@/hooks/useConfirmDialog";
import { pushBackLayer } from "@/hooks/useBackStack";
import { FaSquareThreads } from "react-icons/fa6";
import Lottie from "lottie-react";
import {EmptyChatState} from "./EmptyChatState";
import { PurpleBadge } from "./PurpleBadge";
import {MdDiamond} from "react-icons/md";

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
import sonaAi from "@/assets/sona02.png";
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
  MAX_IMAGES, MAX_IMAGE_BYTES, MAX_DOCS, MAX_DOC_BYTES, DOC_EXTENSIONS, docExtOf, formatBytes, compressImageForUpload,
} from "@/utils/utils";
import { Avatar, TickIcon } from "./Avatar";
import { Bubble, Composer, MediaViewer } from "./MessageBubble";
import { MessageErrorBoundary } from "./MessageErrorBoundary";
import { MemberListModal, GroupSettingsModal, NewChatModal, SettingsModal, UnlockModal } from "./ChatModals";
import { ProfileViewModal } from "./ProfileView";
import { ForwardModal } from "./ForwardModal";
import { MediaGalleryModal } from "./MediaGalleryModal";
import { uploadToCloudinary, readVideoDurationMs } from "@/utils/cloudinary";
import { useMessageModeration, ModerationAlert, type ModerationResult } from "@/features/moderation";
import { getOrgFileLimits } from "@/features/admin";
import { PollComposerModal, canPostInChat } from "@/features/classroom";
import { getCloudinaryUploadSignature } from "@/lib/cloudinary.functions";
import { FaPoll } from "react-icons/fa";

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

function fmtChatTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t = d.getTime();
  if (t >= startOfToday) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  if (t >= startOfToday - 86_400_000) return "Yesterday";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd}`;
}

// ─── Per-chat draft persistence ────────────────────────────────
// Keeps an unsent message from being lost if you switch chats, close the
// tab, or the send fails (e.g. no network) — same idea as WhatsApp/Slack
// remembering what you were mid-typing. Scoped per chat id in
// localStorage; failures (private browsing, storage disabled, quota) are
// swallowed since a draft is a nice-to-have, never worth crashing over.


const draftKey = (chatId: string) => `sona:draft:${chatId}`;

function saveDraftToStorage(chatId: string, text: string) {
  try {
    if (text) localStorage.setItem(draftKey(chatId), text);
    else localStorage.removeItem(draftKey(chatId));
  } catch { /* storage unavailable — draft just won't persist, not fatal */ }
}

function loadDraftFromStorage(chatId: string): string {
  try {
    return localStorage.getItem(draftKey(chatId)) ?? "";
  } catch {
    return "";
  }
}

function clearDraftFromStorage(chatId: string) {
  try { localStorage.removeItem(draftKey(chatId)); } catch { /* no-op */ }
}

function MessagePreview({ msg, decrypted }: { msg?: MessageRow | null; decrypted?: Record<string, string> }) {
  if (!msg) return null; // ← add this guard

  if (msg.deleted_at) {
    return <span className="italic opacity-70">Message was deleted</span>;
  }

  if (msg.is_encrypted) {
    return (
      <span className="inline-flex items-center gap-1 opacity-70">
        <FaLock className="h-4 w-4 shrink-0 text-red-500 " /> Locked
      </span>
    );
  }

  // Poll bodies store raw JSON ({"pollId": "..."}), so this must be
  // checked before the generic `msg.body` fallback below — otherwise a
  // reply/quote preview would show the JSON blob instead of "Poll".
  if (msg.kind === "poll") {
    return (
      <span className="inline-flex items-center gap-1">
        <FaPoll className="h-4 w-4 shrink-0" /> Poll
      </span>
    );
  }

  if (msg.body) {
    // A plain text message whose body is (or starts with) a link gets a
    // link-style preview, same treatment photos/videos already get. The
    // URL itself is a real clickable link — tapping it opens the page
    // directly from the preview instead of only being able to jump to
    // the original message first.
    const linkMatch = msg.body.match(/https?:\/\/\S+/i);
    if (linkMatch) {
      const url = linkMatch[0];
      return (
        <span className="inline-flex min-w-0 items-center gap-1">
          <Link2 className="h-4 w-4 shrink-0 text-[#4FA6E0]" />
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="truncate text-[#4FA6E0] underline decoration-[#4FA6E0]/40 underline-offset-2 hover:decoration-[#4FA6E0]"
          >
            {msg.body}
          </a>
        </span>
      );
    }
    return <span className="truncate">{msg.body}</span>;
  }

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
    case "video":
      return (
        <span className="inline-flex items-center gap-1">
          <Video className="h-4 w-4 shrink-0" /> Video
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
      return (<span className="flex gap-2 items-center "> <Ban className="h-4 text-red-600/10 w-4 shrink-0"/>This message was deleted</span>) ;
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
  const [isSummarized, setIsSummarized] =useState(false) ;
  const [me, setMe] = useState<Profile | null>(null);
  const sonaTheme = useSonaTheme(!!me?.is_pro, me?.theme_id, (id) => {
    if (!me) return;
    setMe((prev) => (prev ? { ...prev, theme_id: id } : prev));
    supabase.from("profiles").update({ theme_id: id }).eq("id", me.id).then(({ error }) => {
      if (error) toast.error("Couldn't sync theme to your account");
    });
  });
  const [chats, setChats] = useState<ChatWithMeta[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [unreadSnapshot, setUnreadSnapshot] = useState(0);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [reactions, setReactions] = useState<ReactionRow[]>([]);
  const [reads, setReads] = useState<MessageReadRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [query, setQuery] = useState("");
  const [announcement, setAnnouncement] = useState<AppAnnouncement | null>(null);
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);

  useEffect(() => {
    fetchActiveAnnouncement().then(setAnnouncement).catch(() => {});
    const channel = supabase
      .channel("app-announcements")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_announcements" }, () => {
        fetchActiveAnnouncement().then((a) => {
          setAnnouncement(a);
          setAnnouncementDismissed(false); // a new/changed announcement should be seen again even if a prior one was dismissed
        }).catch(() => {});
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const [draft, setDraft] = useState("");

  // Restore a saved draft (from a prior visit, or one preserved after a
  // failed send) whenever you switch into a chat — mirrors how WhatsApp
  // remembers what you were mid-typing per conversation.
  useEffect(() => {
    if (!activeId) return;
    setDraft(loadDraftFromStorage(activeId));
  }, [activeId]);

  // Persist as you type (debounced) so the draft survives a chat switch,
  // tab close, or crash — not just an explicit send failure.
  useEffect(() => {
    if (!activeId) return;
    const t = setTimeout(() => saveDraftToStorage(activeId, draft), 400);
    return () => clearTimeout(t);
  }, [activeId, draft]);

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
  const { checkMessage, lastResult: moderationResult } = useMessageModeration();

  // Writes a row into moderation_flags so it shows up in the admin queue.
  // The RLS policy only lets a sender insert their own flag (sender_id =
  // auth.uid()), which is exactly what this does — the client logs its own
  // moderation result at send time. Never blocks/throws into the send flow;
  // a failure here shouldn't stop the message from having already sent.
  const logModerationFlag = useCallback(
    async (
      verdict: ModerationResult,
      chatId: string,
      senderId: string,
      body: string,
      messageId: string | null,
    ) => {
      const categories = Array.from(new Set(verdict.wordMatches.map((w) => w.category)));
      const { error } = await supabase.from("moderation_flags").insert({
        chat_id: chatId,
        sender_id: senderId,
        message_id: messageId,
        body_snapshot: body,
        severity: verdict.severity,
        score: verdict.score,
        blocked: !verdict.allowed,
        categories,
        pattern_signals: verdict.patternSignals,
      });
      if (error) console.error("[moderation] failed to log flag:", error.message);
    },
    [],
  );
  const [showPollComposer, setShowPollComposer] = useState(false);
  const [broadcastLocked, setBroadcastLocked] = useState(false);
  const [orgFileLimits, setOrgFileLimits] = useState({ maxDocBytes: MAX_DOC_BYTES, maxImageBytes: MAX_IMAGE_BYTES });
  useEffect(() => { getOrgFileLimits().then(setOrgFileLimits).catch(() => {}); }, []);

  const onPollCreated = async (pollId: string) => {
    setShowPollComposer(false);
    if (!me || !activeId) return;
    try {
      const { error } = await supabase.from("messages").insert({
        chat_id: activeId,
        sender_id: me.id,
        kind: "poll",
        body: JSON.stringify({ pollId }),
      });
      if (error) throw error;
    } catch (e) {
      toast.error(`Poll created but couldn't post it to the chat: ${explainSupabaseError(e).title}`);
    }
  };
  const [showMsgSearch, setShowMsgSearch] = useState(false);
  const [descOpen, setDescOpen] = useState(false);
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
  const [forwardingMessage, setForwardingMessage] = useState<MessageRow | null>(null);
  const [showMediaGallery, setShowMediaGallery] = useState(false);
  const [galleryViewer, setGalleryViewer] = useState<{ kind: "image" | "video" | "pdf"; url: string; name?: string | null } | null>(null);
  const [videoUploadPct, setVideoUploadPct] = useState<number | null>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const signCloudinaryUpload = useServerFn(getCloudinaryUploadSignature);
  const [reactingOn, setReactingOn] = useState<string | null>(null);
  const [typingOthers, setTypingOthers] = useState<string[]>([]);
  const [recordingOthers, setRecordingOthers] = useState<string[]>([]);
  const [listActivity, setListActivity] = useState<Record<string, { typing: string[]; recording: string[] }>>({});
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [blockedByIds, setBlockedByIds] = useState<Set<string>>(new Set());
  const [myModeration, setMyModeration] = useState<{ action: string; reason: string | null; expires_at: string | null } | null>(null);
  const [reportTarget, setReportTarget] = useState<Profile | null>(null);
  const [reportReason, setReportReason] = useState("Harassment or bullying");
  const [reportDetails, setReportDetails] = useState("");
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
  const [chatLongPressMenu, setChatLongPressMenu] = useState<{ chatId: string; x: number; y: number } | null>(null);

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
  // In-memory cache of {messages, reactions, reads} per chat. Switching to
  // a chat already loaded this session renders synchronously from here —
  // zero network wait — while a background fetch quietly reconciles with
  // anything new. Cleared naturally on full page reload; doesn't need
  // eviction logic since it's just references to already-fetched rows.
  const chatCacheRef = useRef<Record<string, { messages: MessageRow[]; reactions: ReactionRow[]; reads: MessageReadRow[] }>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
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

    // These two only depend on chatIds (not on each other) — firing them
    // together instead of one-after-another cuts a full round trip off
    // every chat-list load. Same for the pair below.
    const [{ data: chatRows }, { data: allMembers }] = await Promise.all([
      supabase.from("chats").select("*").in("id", chatIds).order("last_message_at", { ascending: false }),
      supabase.from("chat_members").select("chat_id, user_id, role, is_pinned, pinned_at").in("chat_id", chatIds),
    ]);
    const memberIds = Array.from(new Set((allMembers ?? []).map((m: { user_id: string }) => m.user_id)));

    const [{ data: profs }, { data: latest }] = await Promise.all([
      supabase.from("profiles").select("*").in("id", memberIds),
      supabase.from("visible_messages").select("*").in("chat_id", chatIds).order("created_at", { ascending: false }).limit(500),
    ]);

    const profMap: Record<string, Profile> = {};
    (profs ?? []).forEach((p) => { profMap[(p as Profile).id] = p as Profile; });
    setProfiles((prev) => ({ ...prev, ...profMap }));

    const rows = (latest ?? []) as MessageRow[];
    const lastByChat: Record<string, MessageRow> = {};
    const primingByChat: Record<string, MessageRow[]> = {};
    // rows is newest-first across all chats — walk it and bucket per chat,
    // then flip each bucket back to chronological order for priming.
    rows.forEach((m) => {
      if (!lastByChat[m.chat_id]) lastByChat[m.chat_id] = m;
      (primingByChat[m.chat_id] ||= []).push(m);
    });
    for (const [chatId, msgs] of Object.entries(primingByChat)) {
      // Never overwrite a fuller cache from having actually opened the
      // chat — this is just a head start for chats not yet opened.
      if (!chatCacheRef.current[chatId]) {
        chatCacheRef.current[chatId] = { messages: msgs.slice().reverse(), reactions: [], reads: [] };
      }
    }

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

    // One small batched query so every chat's row can show a reaction
    // badge on its last message, not just whichever chat happens to be
    // open (the `reactions` state is scoped to the active chat only).
    const lastMsgIds = Object.values(lastByChat).map((m) => m.id);
    const lastReactionByChat: Record<string, string> = {};
    if (lastMsgIds.length) {
      const { data: lastRx } = await supabase
        .from("reactions")
        .select("message_id, emoji")
        .in("message_id", lastMsgIds);
      const byMsgId: Record<string, string> = {};
      (lastRx ?? []).forEach((r: { message_id: string; emoji: string }) => {
        if (!byMsgId[r.message_id]) byMsgId[r.message_id] = r.emoji;
      });
      Object.entries(lastByChat).forEach(([chatId, m]) => {
        if (byMsgId[m.id]) lastReactionByChat[chatId] = byMsgId[m.id];
      });
    }

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
        lastMessageReaction: lastReactionByChat[chat.id],
        unread: unreadByChat[chat.id] ?? 0,
      };
    });
    result.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
    setChats(result);
    setLoadingChats(false);
  }, [me, activeId]);

  useEffect(() => { loadChats(); }, [loadChats]);

  // Load my blocks (both directions) and my moderation state
  useEffect(() => {
    if (!me) return;
    (async () => {
      const [mine, theirs, mod] = await Promise.all([
        supabase.from("blocks").select("*").eq("blocker_id", me.id),
        supabase.from("blocks").select("*").eq("blocked_id", me.id),
        supabase.from("user_moderation").select("action, reason, expires_at, is_active")
          .eq("user_id", me.id).eq("is_active", true).order("created_at", { ascending: false }).limit(1),
      ]);
      setBlockedIds(new Set(((mine.data ?? []) as BlockRow[]).map((b) => b.blocked_id)));
      setBlockedByIds(new Set(((theirs.data ?? []) as BlockRow[]).map((b) => b.blocker_id)));
      const m = (mod.data ?? [])[0] as { action: string; reason: string | null; expires_at: string | null } | undefined;
      setMyModeration(m && m.action !== "clear" ? m : null);
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

  // Belt-and-suspenders: hide a message from the currently-open chat the
  // instant its own expires_at passes, rather than waiting on the next
  // pg_cron cleanup tick + realtime DELETE round trip. Purely cosmetic —
  // cleanup_expired_messages() (scheduled every minute) still does the
  // real deletion so it disappears for the other side too.
  useEffect(() => {
    if (!messages.some((m) => m.expires_at)) return;
    const id = setInterval(() => {
      const now = Date.now();
      setMessages((prev) => prev.filter((m) => !m.expires_at || new Date(m.expires_at).getTime() > now));
    }, 1000);
    return () => clearInterval(id);
  }, [messages]);

  // Load messages + reactions + read receipts for active chat
  useEffect(() => {
    if (!activeId) return;
    const activeChat = chats.find((c) => c.id === activeId);
    if (activeChat?.disappearing_seconds) {
      supabase.rpc("cleanup_expired_messages").then(() => {});
    }

    // Instant path: render whatever we already have for this chat —
    // either from a prior visit this session, or the head-start batch
    // primed in loadChats() — synchronously, before any network call.
    const cached = chatCacheRef.current[activeId];
    if (cached) {
      setMessages(cached.messages);
      setReactions(cached.reactions);
      setReads(cached.reads);
    }

    (async () => {
      const { data: msgs } = await supabase
        .from("visible_messages")
        .select("*")
        .eq("chat_id", activeId)
        .order("created_at", { ascending: false })
        .limit(100);
      const rows = ((msgs ?? []) as MessageRow[]).reverse(); // fetched newest-first for the LIMIT, flip back to chronological
      setMessages(rows);
      const ids = rows.map((m) => m.id);
      let rx: ReactionRow[] = [];
      let rd: MessageReadRow[] = [];
      if (ids.length) {
        const [{ data: rxData }, { data: rdData }] = await Promise.all([
          supabase.from("reactions").select("*").in("message_id", ids),
          supabase.from("message_reads").select("*").in("message_id", ids),
        ]);
        rx = (rxData ?? []) as ReactionRow[];
        rd = (rdData ?? []) as MessageReadRow[];
        setReactions(rx);
        setReads(rd);
      } else { setReactions([]); setReads([]); }
      chatCacheRef.current[activeId] = { messages: rows, reactions: rx, reads: rd };
    })();
  }, [activeId]);

  // Keep the cache in sync as messages/reactions/reads change for the
  // currently-open chat (new sends, edits, realtime updates, etc.), so
  // switching away and back still shows the latest state instantly
  // rather than a stale snapshot from when you first opened it.
  useEffect(() => {
    if (!activeId) return;
    chatCacheRef.current[activeId] = { messages, reactions, reads };
  }, [activeId, messages, reactions, reads]);

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
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (p) => {
        const m = p.new as MessageRow;
        if (m.chat_id === activeId) {
          setMessages((prev) => prev.map((x) => x.id === m.id ? { ...x, ...m } : x));
        }
        // Keep the chat-list preview in sync too — this fires for every
        // participant, not just the person who made the edit/delete.
        loadChats();
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, (p) => {
        // Fires for both sides when cleanup_expired_messages() (or a
        // manual delete) removes a row — without this, a chat that's
        // already open just keeps showing the message until the next
        // full reload, even though it's gone server-side.
        const m = p.old as MessageRow;
        setMessages((prev) => prev.filter((x) => x.id !== m.id));
        loadChats();
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
        loadChats();
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

  // Keep last_seen fresh while active, so it means something more useful than
  // "whenever I last clicked Sign out" — was previously only written on
  // explicit sign-out, so the "Last seen ..." label was almost always stale.
  useEffect(() => {
    if (!me) return;
    const bumpLastSeen = () => {
      supabase.from("profiles").update({ last_seen: new Date().toISOString() }).eq("id", me.id).then();
    };
    bumpLastSeen(); // on mount / session start
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") bumpLastSeen();
    }, 45_000);
    const onVisibility = () => { if (document.visibilityState === "hidden") bumpLastSeen(); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", bumpLastSeen);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", bumpLastSeen);
    };
  }, [me]);

  // Live-sync other users' profile changes (last_seen, avatar, bio, etc.) —
  // profiles were previously only fetched once per loadChats() call, so
  // "Last seen" never updated in an open chat until something unrelated
  // (a new message, membership change) happened to trigger a refetch.
  useEffect(() => {
    if (!me) return;
    const chan = supabase
      .channel("sona-profiles-live")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        (payload) => {
          const row = payload.new as Profile;
          setProfiles((prev) => (prev[row.id] ? { ...prev, [row.id]: { ...prev[row.id], ...row } } : prev));
        }
      )
      .subscribe();
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

  // Snapshot the unread count the instant a chat is opened — must run
  // before the auto-mark-as-read effect below flips it back to 0, so the
  // in-thread "N unread messages" divider has something to show.
  useEffect(() => {
    if (!activeId) { setUnreadSnapshot(0); return; }
    const c = chats.find((x) => x.id === activeId);
    setUnreadSnapshot(c?.unread ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

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

  // The message id the "N unread messages" divider renders before —
  // the Nth-from-last message authored by someone else, where N is the
  // snapshot captured when this chat was opened.
  const unreadDividerId = useMemo(() => {
    if (unreadSnapshot <= 0 || !me) return null;
    const fromOthers = messages.filter((m) => m.sender_id !== me.id);
    if (fromOthers.length < unreadSnapshot) return null;
    return fromOthers[fromOthers.length - unreadSnapshot].id;
  }, [messages, unreadSnapshot, me]);

  useEffect(() => {
    if (!me || !activeId || !active?.is_group) { setBroadcastLocked(false); return; }
    let cancelled = false;
    canPostInChat(activeId, me.id)
      .then((can) => { if (!cancelled) setBroadcastLocked(!can); })
      .catch(() => { if (!cancelled) setBroadcastLocked(false); });
    return () => { cancelled = true; };
  }, [activeId, active?.is_group, me]);

  const activeOtherId = active && !active.is_group && me
    ? active.memberIds.find((id) => id !== me.id && id !== SONA_AI_ID) ?? null
    : null;
  const iBlockedThem = !!activeOtherId && blockedIds.has(activeOtherId);
  const theyBlockedMe = !!activeOtherId && blockedByIds.has(activeOtherId);
  const accountRestricted = myModeration?.action === "ban" || myModeration?.action === "suspend";
  const composerNotice = accountRestricted
    ? (myModeration?.action === "ban"
        ? "Your account is banned — you can't send messages."
        : `Your account is suspended${myModeration?.expires_at ? ` until ${new Date(myModeration.expires_at).toLocaleDateString()}` : ""} — you can't send messages.`)
    : iBlockedThem
      ? "You blocked this person. Messages won't go through in either direction until you unblock them."
      : theyBlockedMe
        ? "You can't message this person right now."
        : broadcastLocked
          ? "Only admins can send messages to this group."
          : null;

  const profilesById = useMemo(() => {
    const map: Record<string, Profile> = {};
    if (me) map[me.id] = me;
    for (const c of chats) for (const m of c.members) map[m.id] = m;
    return map;
  }, [chats, me]);
  // "all" | "unread" | "groups" | "pinned" | a custom folder id (e.g. "custom:1699999999")
  const [activeFolder, setActiveFolder] = useState<string>("all");

  // Custom folders (e.g. "Work", "Family", "Close friends") the user can create,
  // rename, and delete to group chats however they like. Purely client-side,
  // persisted per-account in localStorage — no server/schema changes needed.
  type CustomFolder = { id: string; name: string };
  const [customFolders, setCustomFolders] = useState<CustomFolder[]>([]);
  const [chatFolderMap, setChatFolderMap] = useState<Record<string, string[]>>({}); // chatId -> folderId[]
  const [assigningFolders, setAssigningFolders] = useState(false); // shows the "add selected chats to folder" panel

  useEffect(() => {
    if (!me) return;
    try {
      const foldersRaw = localStorage.getItem(`sona:folders:${me.id}`);
      setCustomFolders(foldersRaw ? JSON.parse(foldersRaw) : []);
      const mapRaw = localStorage.getItem(`sona:folder-map:${me.id}`);
      setChatFolderMap(mapRaw ? JSON.parse(mapRaw) : {});
    } catch {
      setCustomFolders([]);
      setChatFolderMap({});
    }
  }, [me?.id]);

  // Drives the "New folder" / "Rename folder" modal (replaces window.prompt).
  const [folderModal, setFolderModal] = useState<{ mode: "create" | "rename"; id?: string; value: string } | null>(null);

  const persistFolders = (next: CustomFolder[]) => {
    setCustomFolders(next);
    if (me) localStorage.setItem(`sona:folders:${me.id}`, JSON.stringify(next));
  };
  const persistFolderMap = (next: Record<string, string[]>) => {
    setChatFolderMap(next);
    if (me) localStorage.setItem(`sona:folder-map:${me.id}`, JSON.stringify(next));
  };

  const openCreateFolderModal = () => setFolderModal({ mode: "create", value: "" });
  const openRenameFolderModal = (id: string, current: string) => setFolderModal({ mode: "rename", id, value: current });

  const submitFolderModal = () => {
    if (!folderModal) return;
    const name = folderModal.value.trim().slice(0, 30);
    if (!name) return;
    if (folderModal.mode === "create") {
      const id = `custom:${Date.now()}`;
      persistFolders([...customFolders, { id, name }]);
      setActiveFolder(id);
      antMessage.success(`Folder "${name}" created`);
    } else if (folderModal.id) {
      persistFolders(customFolders.map((f) => (f.id === folderModal.id ? { ...f, name } : f)));
      antMessage.success("Folder renamed");
    }
    setFolderModal(null);
  };

  const deleteCustomFolder = async (id: string, name: string) => {
    const ok = await confirm({
      title: `Delete "${name}" folder?`,
      description: "Chats inside it won't be deleted, only removed from the folder.",
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    persistFolders(customFolders.filter((f) => f.id !== id));
    const nextMap: Record<string, string[]> = {};
    for (const [chatId, ids] of Object.entries(chatFolderMap)) {
      const remaining = ids.filter((f) => f !== id);
      if (remaining.length) nextMap[chatId] = remaining;
    }
    persistFolderMap(nextMap);
    if (activeFolder === id) setActiveFolder("all");
    setFolderModal(null);
    antMessage.success(`Folder "${name}" deleted`);
  };

  const toggleChatInFolder = (chatId: string, folderId: string) => {
    const current = chatFolderMap[chatId] ?? [];
    const next = current.includes(folderId) ? current.filter((f) => f !== folderId) : [...current, folderId];
    persistFolderMap({ ...chatFolderMap, [chatId]: next });
  };

  const filtered = useMemo(() => chats.filter((c) => {
    if (!me) return true;

    if (activeFolder === "unread" && c.unread === 0) return false;
    if (activeFolder === "groups" && !c.is_group) return false;
    if (activeFolder === "pinned" && !c.isPinned) return false;
    if (activeFolder.startsWith("custom:") && !(chatFolderMap[c.id] ?? []).includes(activeFolder)) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    // WhatsApp-style search: match the chat title as well as the last message's
    // decrypted preview text, so results surface even when the query only
    // appears inside a message rather than the chat/contact name.
    if (chatTitle(c, me.id).toLowerCase().includes(q)) return true;
    // Only plain (unencrypted) last messages can be matched client-side —
    // encrypted previews stay "Locked" until opened, same as elsewhere in the app.
    const last = c.lastMessage;
    if (last && !last.is_encrypted && last.kind !== "poll" && last.body) {
      return last.body.toLowerCase().includes(q);
    }
    return false;
  }), [chats, query, me, blockedIds, activeFolder, chatFolderMap]);

  // "Ask Sona AI" entry shown above results, WhatsApp/Meta-AI style, whenever
  // there's a non-empty search query. Opens (or starts) the Sona AI chat and
  // hands the typed query over as the draft so the user can review before sending.
  const askSonaAIFromSearch = () => {
    const q = query.trim();
    if (!q) return;
    const aiChat = chats.find((c) => isAIChat(c));
    if (aiChat) {
      setActiveId(aiChat.id);
    }
    setDraft(q);
    setQuery("");
    setShowSidebarMobile(false);
  };

  const unreadFolderCount = chats.filter((c) => c.unread > 0).length;
  const groupsFolderCount = chats.filter((c) => c.is_group).length;
  const favoritesFolderCount = chats.filter((c) => c.isPinned).length;

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
    antMessage.success("Scheduled message canceled");
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

  const removeMember = async (chatId: string, member: Profile) => {
    const { error } = await supabase.from("chat_members").delete().eq("chat_id", chatId).eq("user_id", member.id);
    if (error) { toast.error(explainSupabaseError(error).title); return; }
    toast.success(`Removed ${member.display_name}`);
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
      antMessage.success(count === 1 ? "Chat deleted" : `${count} chats deleted`);
    } else if (failed === count) {
      antMessage.error(count === 1 ? "Couldn't delete chat" : "Couldn't delete any of the selected chats");
    } else {
      antMessage.warning(`Deleted ${count - failed} of ${count} chats — ${failed} failed`);
    }
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedChatIds(new Set());
  };

  // Send
  const send = async (scheduledFor?: Date) => {
    if (!me || !activeId) return;
    if (composerNotice) { toast.error(composerNotice); return; }


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

    let sentMessageVerdict: ModerationResult | null = null;
    if (plaintext && me) {
      const verdict = await checkMessage(plaintext, activeId, me.id, null);
      if (!verdict.allowed) {
        toast.error("This message can't be sent — it looks like it violates community guidelines.");
        void logModerationFlag(verdict, activeId, me.id, plaintext, null);
        return;
      }
      sentMessageVerdict = verdict;
    }

    setSending(true);
    try {
      type Outgoing = { kind: "text" | "image" | "file"; media_url?: string | null; file_name?: string; file_size?: number };
      const outgoing: Outgoing[] = [];

      for (const img of pendingImages) {
        const compressed = await compressImageForUpload(img);
        const path = `${activeId}/${me.id}/${crypto.randomUUID()}-${compressed.name}`;
        const { error: upErr } = await supabase.storage.from("chat-media").upload(path, compressed);
        if (upErr) { toast.error(`Couldn't upload ${img.name}: ${explainSupabaseError(upErr).title}`); continue; }
        const { data: signed } = await supabase.storage.from("chat-media").createSignedUrl(path, 60 * 60 * 24 * 365);
        outgoing.push({ kind: "image", media_url: signed?.signedUrl ?? null });
      }
      for (const doc of pendingDocs) {
        const path = `${activeId}/${me.id}/${crypto.randomUUID()}-${doc.name}`;
        const { error: upErr } = await supabase.storage.from("chat-media").upload(path, doc, { contentType: doc.type || "application/octet-stream" });
        if (upErr) { antMessage.error(`Couldn't upload ${doc.name}: ${explainSupabaseError(upErr).title}`); continue; }
        const { data: signed } = await supabase.storage.from("chat-media").createSignedUrl(path, 60 * 60 * 24 * 365);
        outgoing.push({ kind: "file", media_url: signed?.signedUrl ?? null, file_name: doc.name, file_size: doc.size });
      }
      if (outgoing.length === 0 && plaintext) outgoing.push({ kind: "text" });

      const hadAttachmentsPicked = pendingImages.length > 0 || pendingDocs.length > 0;
      if (outgoing.length === 0 && hadAttachmentsPicked) {
        // Every upload failed (most commonly: no network) and there was
        // no text to fall back to sending on its own. Keep the picked
        // files in place so the user can just hit send again — don't
        // silently drop what they attached.
        toast.error("Couldn't upload — check your connection and try again.");
        return;
      }

      let firstAttachedImageUrl: string | null = null;
      let firstAttachedFileUrl: string | null = null;
      let firstAttachedFileName: string | null = null;
      const expiresAt = active?.disappearing_seconds
        ? new Date(Date.now() + active.disappearing_seconds * 1000).toISOString()
        : null;
      const scheduledAt = scheduledFor ? scheduledFor.toISOString() : null;
      let anySucceeded = false;
      let firstInsertedMessageId: string | null = null;
      for (let i = 0; i < outgoing.length; i++) {
        const item = outgoing[i];
        if (item.kind === "image" && !firstAttachedImageUrl) firstAttachedImageUrl = item.media_url ?? null;
        if (item.kind === "file" && !firstAttachedFileUrl) { firstAttachedFileUrl = item.media_url ?? null; firstAttachedFileName = item.file_name ?? null; }

        const payload = {
          chat_id: activeId, sender_id: me.id, kind: item.kind,
          body: i === 0 ? firstBody : null,
          media_url: item.media_url ?? null,
          file_name: item.file_name ?? null,
          file_size: item.file_size ?? null,
          is_encrypted: i === 0 ? is_encrypted : false,
          reply_to_id: i === 0 ? (replyTo?.id ?? null) : null,
          expires_at: expiresAt,
          scheduled_at: scheduledAt,
        };

        // Scheduled messages shouldn't show up in the feed now — they're
        // not due yet — so only optimistically render immediate sends.
        const tempId = `optimistic:${crypto.randomUUID()}`;
        if (!scheduledFor) {
          setMessages((prev) => [
            ...prev,
            { id: tempId, created_at: new Date().toISOString(), ...payload, _pending: true } as MessageRow,
          ]);
        }

        const { data: inserted, error } = await supabase.from("messages").insert(payload).select().single();
        if (error) {
          toast.error(error.message);
          if (!scheduledFor) setMessages((prev) => prev.filter((m) => m.id !== tempId));
          continue;
        }
        anySucceeded = true;
        if (i === 0 && inserted) firstInsertedMessageId = (inserted as MessageRow).id;
        if (!scheduledFor && inserted) {
          setMessages((prev) => {
            // If the realtime echo of this same insert already arrived
            // (rare, but possible under high latency), drop that copy
            // before swapping the temp bubble for the real row, so we
            // don't end up with the same message twice.
            const withoutRealtimeDupe = prev.filter((m) => m.id !== (inserted as MessageRow).id);
            return withoutRealtimeDupe.map((m) => (m.id === tempId ? (inserted as MessageRow) : m));
          });
        }
      }
      if (scheduledFor) {
        antMessage.success(`Message scheduled for ${scheduledFor.toLocaleString()}`);
      } else if (anySucceeded) {
        playSendSound();
      }

      // Message was allowed to send but still flagged (e.g. profanity that
      // isn't severe enough to block) — log it now that we have a real
      // message id, so it actually shows up in the admin moderation queue
      // instead of only flashing a local alert to the sender.
      if (anySucceeded && !scheduledFor && plaintext && me && sentMessageVerdict?.shouldLog) {
        void logModerationFlag(sentMessageVerdict, activeId, me.id, plaintext, firstInsertedMessageId);
      }

      if (outgoing.length > 0 && !anySucceeded && !scheduledFor) {
        // Every attempt failed (most commonly: no network). Keep the
        // draft text and any picked images/docs exactly as they were, so
        // the user can just hit send again once they're back online —
        // the debounced localStorage effect already has this text saved.
        toast.error("Couldn't send — your message is saved as a draft, try again when you're back online.");
        return;
      }

      const prompt = plaintext;
      const attachedImageUrl = firstAttachedImageUrl;
      const attachedFileUrl = firstAttachedFileUrl;
      const attachedFileName = firstAttachedFileName;
      setDraft(""); setPendingImages([]); setPendingDocs([]); setShowEmoji(false); setReplyTo(null);
      if (activeId) clearDraftFromStorage(activeId);

      // Let any offline recipient know by email — fire-and-forget, never
      // blocks the send UI. The server figures out who's actually
      // offline and opted in before sending anything.
      if (anySucceeded && !scheduledFor && active && !isAIChat(active)) {
        notifyOfflineMessage({
          data: {
            chatId: activeId,
            senderName: me.display_name || "Someone",
            messageBody: prompt || (attachedImageUrl ? "Sent a photo" : attachedFileUrl ? "Sent a file" : "Sent a message"),
          },
        }).catch(() => {}); // best-effort — a failed notification shouldn't surface as a send error
      }

      if (!scheduledFor && active && !active.is_hidden) {
        const isAI = isAIChat(active);
        const mentionsSona = /(^|\s)@sona\b/i.test(prompt);
        if ((isAI || mentionsSona) && (prompt || attachedImageUrl || attachedFileUrl)) {
          toast.loading("Sona is thinking…", { id: "sona-ai" });
          askAI({
            data: {
              chatId: activeId,
              prompt: prompt || (attachedFileUrl ? "What's in this file?" : "What's in this image?"),
              imageUrl: attachedImageUrl,
              fileUrl: attachedFileUrl,
              fileName: attachedFileName,
            },
          })
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
    const oversized = incoming.filter((f) => f.size > orgFileLimits.maxImageBytes);
    const valid = incoming.filter((f) => f.size <= orgFileLimits.maxImageBytes);
    if (oversized.length) toast.error(`${oversized.length} image${oversized.length === 1 ? "" : "s"} skipped — over ${formatBytes(orgFileLimits.maxImageBytes)}`);

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
    const oversized = incoming.filter((f) => DOC_EXTENSIONS.includes(docExtOf(f.name)) && f.size > orgFileLimits.maxDocBytes);
    const valid = incoming.filter((f) => DOC_EXTENSIONS.includes(docExtOf(f.name)) && f.size <= orgFileLimits.maxDocBytes);
    if (wrongType.length) toast.error(`Unsupported file type: ${wrongType.map((f) => f.name).join(", ")}`);
    if (oversized.length) toast.error(`${oversized.length} file${oversized.length === 1 ? "" : "s"} skipped — over ${formatBytes(orgFileLimits.maxDocBytes)}`);

    setPendingDocs((prev) => {
      const combined = [...prev, ...valid];
      if (combined.length > MAX_DOCS) {
        toast.error(`Max ${MAX_DOCS} files at once — extra ones skipped`);
        return combined.slice(0, MAX_DOCS);
      }
      return combined;
    });
  };

  const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // Cloudinary free tier cap — comfortably covers 50MB+ videos
  const onPickVideo = async (file?: File | null) => {
    if (!file || !me || !activeId) return;
    if (!file.type.startsWith("video/")) { toast.error("Please choose a video file"); return; }
    if (file.size > MAX_VIDEO_BYTES) { toast.error(`Video is too large — max ${formatBytes(MAX_VIDEO_BYTES)}`); return; }

    setVideoUploadPct(0);
    try {
      const [durationMs, uploaded] = await Promise.all([
        readVideoDurationMs(file).catch(() => 0),
        uploadToCloudinary(file, "video", signCloudinaryUpload, (pct) => setVideoUploadPct(pct)),
      ]);
      const { error } = await supabase.from("messages").insert({
        chat_id: activeId,
        sender_id: me.id,
        kind: "video",
        media_url: uploaded.secure_url,
        file_name: file.name,
        file_size: uploaded.bytes ?? file.size,
        duration_ms: Math.round(uploaded.duration ? uploaded.duration * 1000 : durationMs),
      });
      if (error) throw error;
      playSendSound();
    } catch (e) {
      toast.error((e as Error).message || "Couldn't upload video");
    } finally {
      setVideoUploadPct(null);
    }
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!me) return;
    const existing = reactions.find((r) => r.message_id === messageId && r.user_id === me.id && r.emoji === emoji);
    if (existing) await supabase.from("reactions").delete().eq("id", existing.id);
    else await supabase.from("reactions").insert({ message_id: messageId, user_id: me.id, emoji });
    setReactingOn(null);
    loadChats();
  };

  const deleteMessage = async (messageId: string) => {
    if (!me) return;
    if (!(await confirm({ title: "Delete this message for everyone?", confirmText: "Delete", danger: true }))) return;
    const { error } = await supabase
      .from("messages")
      .update({ deleted_at: new Date().toISOString(), body: null, media_url: null, file_name: null, file_size: null, duration_ms: null })
      .eq("id", messageId)
      .eq("sender_id", me.id);
    if (error) { toast.error(error.message); return; }
    setMessages((prev) => prev.map((m) => m.id === messageId
      ? { ...m, deleted_at: new Date().toISOString(), body: null, media_url: null, file_name: null, file_size: null, duration_ms: null }
      : m));
    // The chat list's last-message preview is a separate query result
    // (loadChats), not derived from `messages` — without this it kept
    // showing the pre-deletion content until the next full reload.
    loadChats();
  };

  // Permanently removes an already-soft-deleted message's row — separate
  // from deleteMessage() above, which only clears content and leaves the
  // "This message was deleted" placeholder in place for everyone.
  const hardDeleteMessage = async (messageId: string) => {
    if (!me) return;
    const { error } = await supabase.from("messages").delete().eq("id", messageId).eq("sender_id", me.id);
    if (error) { toast.error(error.message); return; }
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    loadChats();
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
  };

  const unblockOther = async () => {
    if (!me || !active) return;
    const other = active.memberIds.find((id) => id !== me.id && id !== SONA_AI_ID);
    if (!other) return;
    const { error } = await supabase.from("blocks").delete().eq("blocker_id", me.id).eq("blocked_id", other);
    if (error) { toast.error(error.message); return; }
    setBlockedIds((prev) => { const n = new Set(prev); n.delete(other); return n; });
    toast.success("User unblocked");
  };

  const submitReport = async () => {
    if (!me || !reportTarget) return;
    const { error } = await supabase.from("reports").insert({
      reporter_id: me.id,
      reported_id: reportTarget.id,
      chat_id: activeId,
      reason: reportReason,
      details: reportDetails.trim() || null,
    });
    if (error) {
      // Postgrest error codes: 42P01 = relation (table) doesn't exist —
      // almost always means the "reports" table migration was never
      // applied to this Supabase project. 42501 = RLS/permission denied.
      if (error.code === "42P01") {
        antMessage.error("Reporting isn't set up yet — the reports table is missing from the database. Ask an admin to run the pending Supabase migrations.");
      } else if (error.code === "42501") {
        antMessage.error("You don't have permission to submit a report — check the reports table's row-level security policies.");
      } else {
        antMessage.error(error.message);
      }
      return;
    }
    antMessage.success("Report sent to the Sona team");
    setReportTarget(null);
    setReportDetails("");
  };


  const requirePro = (feature: string): boolean => {
    if (me?.is_pro) return true;
    antMessage.error(`${feature} is a Sona Pro feature — upgrade in Settings → Subscription.`);
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

  const exportChat = (format: "json" | "pdf") => {
    if (!active || !me) return;
    if (!requirePro("Export chat")) return;
    setShowHeaderMenu(false);
    try {
      const entries = buildTranscript(messages, profilesById, me.id, decrypted);
      if (format === "json") exportChatAsJSON(active, entries);
      else exportChatAsPDF(active, entries);
      antMessage.success(format === "json" ? "Chat exported as JSON" : "Opening print dialog — choose \"Save as PDF\"");
    } catch (e) {
      antMessage.error((e as Error).message || "Couldn't export chat");
    }
  };

  const clearChat = async () => {
    if (!active || !me) return;
    setShowHeaderMenu(false);
    const ok = await confirm({
      title: "Clear this chat?",
      description: "Removes all messages from your view only — the other person or group members will still see them. This can't be undone.",
      confirmText: "Clear chat",
      danger: true,
    });
    if (!ok) return;
    const clearedBefore = new Date().toISOString();
    const { error } = await supabase
      .from("chat_clears")
      .upsert({ chat_id: active.id, user_id: me.id, cleared_before: clearedBefore }, { onConflict: "chat_id,user_id" });
    if (error) { toast.error(explainSupabaseError(error).title); return; }
    // Instant local feedback — don't wait on a refetch to reflect the clear.
    setMessages([]);
    setReactions([]);
    setReads([]);
    chatCacheRef.current[active.id] = { messages: [], reactions: [], reads: [] };
    toast.success("Chat cleared");
    loadChats();
  };

  const runSummary = async () => {
    if (!activeId) return;
    if (!requirePro("AI chat summary")) return;
    setShowHeaderMenu(false);
    setIsSummarized(true) ;
    toast.loading("Summarizing…", { id: "sum" });
    try {
      const r = await askSummary({ data: { chatId: activeId } }) as { summary: string };
      setSummary(r.summary);
      toast.success("Summary ready", { id: "sum" });
      setIsSummarized(false) ;
    } catch (e) { antMessage.error((e as Error).message, { id: "sum" }); }
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
  useEffect(() => { setShowMsgSearch(false); setMsgSearchQuery(""); setShowDisappearingMenu(false); setDescOpen(false); }, [activeId]);
  useEffect(() => {
    if (!showMsgSearch || msgSearchMatches.length === 0) return;
    const target = msgSearchMatches[Math.min(msgSearchIndex, msgSearchMatches.length - 1)];
    const el = target && msgRefs.current.get(target.id);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [msgSearchIndex, msgSearchMatches, showMsgSearch]);

  // Tapping a reply's quoted preview scrolls to the original message it
  // replied to, WhatsApp-style, and briefly highlights it so it's easy to spot.
  const [jumpHighlightId, setJumpHighlightId] = useState<string | null>(null);
  const jumpTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jumpToMessage = (messageId: string) => {
    const el = msgRefs.current.get(messageId);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setJumpHighlightId(messageId);
    if (jumpTimeoutRef.current) clearTimeout(jumpTimeoutRef.current);
    jumpTimeoutRef.current = setTimeout(() => setJumpHighlightId(null), 1600);
  };
  useEffect(() => () => { if (jumpTimeoutRef.current) clearTimeout(jumpTimeoutRef.current); }, []);
  
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
    return(
    <div className="h-dvh w-full bg-[#F0EBE3] text-[#2D3436] dark:bg-[#1A1A1A] dark:text-[#E8E8E8]">
      <div className="mx-auto flex h-full max-w-[1400px] overflow-hidden md:p-4">
        <div className="flex h-full w-full overflow-hidden rounded-none bg-white shadow-2xl md:rounded-3xl md:border border-[#E07A5F]/20 dark:bg-[#242424] dark:border-[#E07A5F]/10">
          
          {/* ─── Sidebar ─── */}
          <aside className="relative h-full w-full flex-col border-r border-[#E07A5F]/10 bg-[#FFFDF9] dark:bg-[#1E1E1E] md:flex md:w-[32%] md:min-w-[300px] md:max-w-[420px]">
            
            {/* Nav bar */}
            <div className="flex items-center justify-between gap-2 px-4 py-3">
              <div className="h-7 w-24 rounded-lg bg-[#E07A5F]/15 animate-pulse" />
              <div className="flex items-center gap-1.5 rounded-full border border-[#E07A5F]/10 bg-[#F5F0E8] dark:bg-[#2A2A2A] px-2 py-1.5">
                {[...Array(3).keys()].map((i) => (
                  <div
                    key={i}
                    style={{ animationDelay: `${i * 0.61}s` }}
                    className="h-8 w-8 rounded-full bg-[silver]/10 animate-pulse"
                  />
                ))}
              </div>
            </div>

            {/* Search */}
            <div className="px-3 pb-2 pt-1">
              <div className="h-11 w-full rounded-full bg-[#E07A5F]/10 animate-pulse" />
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-2 px-3 pb-3 pt-1 overflow-x-auto scrollbar-hiding ">
              {[...Array(6).keys()].map((i) => (
                <div
                  key={i}
                  style={{ animationDelay: `${i * 0.8}s` }}
                  className={`h-8 rounded-full bg-[#E07A5F]/10 animate-pulse shrink-0 ${
                    i === 0 ? "w-11" : i === 1 ? "w-20" : i === 4 ? "w-24" : "w-[72px]"
                  }`}
                />
              ))}
            </div>

            {/* Status banner */}
            <div className="mx-3 mb-2">
              <div className="flex items-center gap-3 h-12 w-full rounded-2xl bg-[#E07A5F]/8 animate-pulse px-4">
                <div className="h-5 w-5 rounded-full bg-[#E07A5F]/15 animate-pulse" />
                <div className="h-3.5 w-36 rounded bg-[#E07A5F]/15 animate-pulse" />
              </div>
            </div>

            {/* Chat rows */}
            <div className="flex-1 space-y-0.5 px-2 pt-1 overflow-y-auto">
              {[...Array(10).keys()].map((i) => (
                <div
                  key={i}
                  style={{ animationDelay: `${i * 0.5}s` }}
                  className="flex items-center gap-3 p-3 rounded-xl"
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div className="h-12 w-12 rounded-full bg-[silver]/10 animate-pulse" />
                    {i % 3 === 1 && (
                      <div className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-[#FFFDF9] dark:border-[#1E1E1E] bg-[silver]/10 animate-pulse" />
                    )}
                  </div>

                  {/* Text content */}
                  <div className="flex-1 min-w-0 space-y-2.5">
                    {/* Name + time */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="h-3.5 w-32 rounded bg-[#E07A5F]/20 animate-pulse" />
                      <div className="h-3 w-9 rounded bg-[#E07A5F]/10 animate-pulse shrink-0" />
                    </div>
                    {/* Preview + badge */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="h-2.5 w-[70%] rounded bg-[#E07A5F]/10 animate-pulse" />
                      {i % 2 === 0 && (
                        <div className="h-5 w-5 rounded-full bg-[#E07A5F]/25 animate-pulse shrink-0" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* FAB */}
            <div className="absolute bottom-6 right-4">
              <div className="h-14 w-14 rounded-2xl bg-[#E07A5F]/20 animate-pulse shadow-xl" />
            </div>
          </aside>

          {/* ─── Main area (empty) ─── */}
          <section className="hidden md:flex h-full flex-1 flex-col bg-[#F0EBE3] dark:bg-[#1A1A1A] items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-[#E07A5F]/20 animate-pulse" />
              <div className="h-3 w-28 rounded bg-[#E07A5F]/10 animate-pulse" />
            </div>
          </section>
        </div>
      </div>
    </div>
  
    );
  }

  
  return (
    <div
      className="h-dvh w-full bg-[#F0EBE3] text-[#2D3436] dark:bg-[#1A1A1A] hide-scrollbar dark:text-[#E8E8E8]"
      style={sonaTheme.style}
    >
      <Watermark
          content="" 
          font={{ color: "#e1f6fc" , fontSize: 8}}
          gap={[72, 72]}
          rotate={-22}
          className="h-full"
        >
      {me && <CallManager ref={callManagerRef} meId={me.id} meName={me.display_name ?? "Someone"} meAvatar={me.avatar_url ?? null} />}
      {myModeration && (
        <div
          className="flex items-center justify-center gap-2 px-4 py-2 text-center text-xs font-semibold"
          style={{
            backgroundColor: myModeration.action === "ban" ? "#EF444422" : myModeration.action === "suspend" ? "#E07A5F22" : "#F59E0B22",
            color: myModeration.action === "ban" ? "#EF4444" : myModeration.action === "suspend" ? "#E07A5F" : "#B45309",
          }}
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {myModeration.action === "warn"
            ? `Warning from the Sona team${myModeration.reason ? `: ${myModeration.reason}` : ""}`
            : composerNotice}
        </div>
      )}
      <div className="mx-auto flex h-full max-w-[1400px] overflow-hidden md:p-4">
        
        <div className="flex h-full w-full overflow-hidden rounded-none bg-white shadow-2xl md:rounded-3xl md:border border-[#E07A5F]/20 dark:bg-[#242424] dark:border-[#E07A5F]/10">
          {/* Sidebar */}
          <aside className={`${showSidebarMobile ? "flex" : "hidden"} relative h-full w-full flex-col border-r border-[#E07A5F]/10 bg-[#FFFDF9] dark:bg-[#1E1E1E] dark:text-[#E8E8E8] md:flex md:w-[32%] md:min-w-[300px] md:max-w-[420px]`}>
            {/* Header */}
            <div className="flex items-center justify-between gap-2 px-2 py-3 bg-transparent dark:text-white text-gray-600">
              <div className="flex items-center gap-2 min-w-0 select-none cursor-default">
  <div className="leading-none min-w-0 flex items-baseline gap-0">
    <span className={`text-[26px] font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-[#2D3436] ${me.is_pro ? "to-[#8B5CF6]" :"to-[#5a5a5a]" } dark:from-white dark:to-[#b0b0b0]`}>
      Sona
    </span>
    <span className="text-[12px] tracking-tighter">
      {me.is_pro && <PurpleBadge />} 
    </span>
  </div>
</div>
              {/* Header toolbar: Share + More dropdown */}
<div className="flex items-center gap-1 dark:text-white text-gray-600 shrink-0 rounded-md px-1 py-1">
  {/* Share — always visible */}
  <button
    onClick={() => {
      const shareUrl = window.location.origin;
      if (navigator.share) {
        navigator.share({ title: "Sona", text: "Chat with me on Sona!", url: shareUrl }).catch(() => {});
      } else {
        navigator.clipboard.writeText(shareUrl);
        antMessage.success("App link copied to clipboard!");
      }
    }}
    className="grid h-9 w-9 place-items-center rounded-full text-gray-600 dark:text-white transition-colors"
    aria-label="Share app"
    title="Share app"
  >
    <Share2 className="h-6 w-6" />
  </button>
<button
  onClick={() => cameraRef.current?.click()}
  className="grid h-9 w-9 place-items-center rounded-full text-gray-600 dark:text-white transition-colors"
    aria-label="Take photo"
    title="Camera">
<IoCameraOutline className="h-6 w-6"/>
</button>
<input
  ref={cameraRef}
  type="file"
  accept="image/*"
  capture="environment"
  className="hidden"
  onChange={(e) => { onPickImages(e.target.files); e.target.value = ""; }}
/>
  {/* Divider */}
  <div className="w-px h-6 bg-slate-300 dark:bg-slate-600" />

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
      <MoreVertical className="h-5 w-5" />
    </button>

    <AnimatePresence>
    {showHeaderMenu && (
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -6 }}
        transition={{ duration: 0.14, ease: "easeOut" }}
        className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-[#E07A5F]/10 bg-white !dark:text-[#fff] dark:bg-[#242424] shadow-xl z-50 overflow-hidden origin-top-right"
      >
        <div className="py-1">
          {canInstall && (
            <button
              onClick={() => { promptInstall(); setShowHeaderMenu(false); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#2D3436] dark:text-[#E8E8E8] hover:bg-[#F4A261]/10 transition-colors"
            >
              Install app
            </button>
          )}

          <button
            onClick={() => { toggle(); setShowHeaderMenu(false); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#2D3436] dark:text-[#E8E8E8] hover:bg-[#F4A261]/10 transition-colors"
          >
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>

          <Link
            to="/learn"
            onClick={() => setShowHeaderMenu(false)}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm !text-[#2D3436] dark:!text-[#fff] hover:bg-[#F4A261]/10 transition-colors"
          >
            Manual for Sona
          </Link>

          <Link
            to="/blog"
            onClick={() => setShowHeaderMenu(false)}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm !text-[#2D3436] dark:!text-[#fff] hover:bg-[#F4A261]/10 transition-colors"
          >
            Blog
          </Link>

          <Link
            to="/help"
            onClick={() => setShowHeaderMenu(false)}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm !text-[#2D3436] dark:!text-[#fff] hover:bg-[#F4A261]/10 transition-colors"
          >
            Help Center
          </Link>

          <AdminLink onNavigate={() => setShowHeaderMenu(false)} />

          <button
            onClick={() => { setShowTour(true); setShowHeaderMenu(false); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#2D3436] dark:text-[#E8E8E8] hover:bg-[#F4A261]/10 transition-colors"
          >
            Replay tour
          </button>

          <button
            onClick={() => { setShowSettings(true); setShowHeaderMenu(false); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#2D3436] dark:text-[#E8E8E8] hover:bg-[#F4A261]/10 transition-colors"
          >
            Settings
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
                  
                </div>) :(<>
                  <button onClick={() => setAssigningFolders(true)} disabled={selectedChatIds.size === 0}
                    className="flex items-center gap-1 rounded bg-[#E07A5F] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 hover:bg-[#c96548] transition">
                    <FolderCog className="h-3.5 w-3.5" /> Folder
                  </button>
                  <button onClick={deleteSelectedChats} disabled={selectedChatIds.size === 0}
                    className="flex items-center gap-1 rounded bg-red-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 hover:bg-red-600 transition">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button></>)} 
                  <button onClick={exitSelectMode}
                    className="rounded border border-[#2D3436] px-3 py-1.5 text-xs font-semibold dark:text-white text-[#2D3436] hover:bg-[#3D4446] transition">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="px-3 py-2 pb-3 pt-3">
              <div className="flex items-center gap-2 rounded-full bg-[#F5F0E8] dark:bg-[#2A2A2A] px-4 py-3 border border-[#E07A5F]/10">
                <Search className="h-8 w-8 text-[#8C8C8C]" />
                <input data-tour="search-chats" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ask Sona AI or Search"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-[#8C8C8C] text-[#2D3436] dark:text-[#E8E8E8]" />
              </div>
            </div>

            {announcement && !announcementDismissed && (
              <div className="mx-3 mb-3 flex items-start gap-2 rounded-2xl bg-[#E07A5F]/10 border border-[#E07A5F]/20 px-3.5 py-2.5">
                <Megaphone className="h-4 w-4 shrink-0 mt-0.5 text-[#E07A5F]" />
                <p className="flex-1 text-xs leading-snug text-[#2D3436] dark:text-[#E8E8E8]">{announcement.message}</p>
                <button
                  onClick={() => setAnnouncementDismissed(true)}
                  aria-label="Dismiss announcement"
                  className="shrink-0 grid h-5 w-5 place-items-center rounded-full hover:bg-[#E07A5F]/15 text-[#8C8C8C]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <div data-tour="folder-tabs" className="flex items-center gap-2 overflow-x-auto px-4 pb-6 scrollbar-thin scrollbar-hiding">
              {([
                { key: "all", label: `All` },
                { key: "unread", label: `Unread ${unreadFolderCount ? ` ${unreadFolderCount}` : ""}` },
                { key: "groups", label: `Groups${groupsFolderCount ? ` ${groupsFolderCount}` : ""}` },
                { key: "pinned", label: `Favorites${favoritesFolderCount ? ` ${favoritesFolderCount}` : ""}` },
              ] as const).map((f) => (
                <button
                  key={f.key}
                  onClick={() => setActiveFolder(f.key)}
                  className={`shrink-0 ${!me.is_pro ? " bg-[#E07A5F] ":"bg-[#8B5CF6] " } rounded-full shadow-md px-3 py-1.5 text-xs font-medium transition ${
                    activeFolder === f.key
                      ? "dark:bg-[#1E1E1E] border border-[#F5F0E8]/10 text-white"
                      : "bg-[#F5F0E8] dark:bg-[#2A2A2A] text-[#8C8C8C] border border-[#F5F0E8]/10 hover:bg-[#F4A261]/20"
                  }`}
                >
                  {f.label}
                </button>
              ))}

              {customFolders.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setActiveFolder(f.id)}
                  onDoubleClick={() => openRenameFolderModal(f.id, f.name)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    openRenameFolderModal(f.id, f.name);
                  }}
                  title="Tap to filter · double-tap or right-click to rename"
                  className={`shrink-0 rounded-full ${!me.is_pro ? " bg-[#E07A5F] ":"bg-[#8B5CF6] " } px-3 py-1.5 text-xs font-medium transition ${
                    activeFolder === f.id
                      ? "dark:bg-[#1E1E1E] text-white"
                      : "bg-[#F5F0E8] dark:bg-[#2A2A2A] text-[#8C8C8C] hover:bg-[#F4A261]/20"
                  }`}
                >
                  {f.name}
                </button>
              ))}

              <button
                onClick={openCreateFolderModal}
                title="Create a custom folder"
                aria-label="Create a custom folder"
                className="shrink-0 rounded-full bg-[#F5F0E8] px-2 py-2 text-xs font-medium text-[#8C8C8C] transition hover:bg-[#F4A261]/20 dark:bg-[#2A2A2A]"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {me && (
              <div data-tour="status-bar" className="px-3 pb-3">
                <button
                  title="Status &amp; Update news " 
                  onClick={() => navigate({ to: "/status", search: { user: undefined } })}
                  className="group absolute bottom-[12%] right-5 z-30 grid h-[60px] w-[60px] place-items-center rounded-2xl
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
                  <LuCircleFadingPlus className={`h-10 text-[#1E1E1E] dark:text-[#E07A5F] opacity-80 w-10 `} />
                </button>
              </div>
            )}


            <div className="scrollbar-hiding flex-1 overflow-y-auto pb-24">
             {query.trim() && (
               <button
                 onClick={askSonaAIFromSearch}
                 className="mx-3 mb-2 flex w-[calc(100%-1.5rem)] items-center gap-3 rounded-2xl bg-gradient-to-r from-[#E07A5F]/10 to-[#F4A261]/10 border border-[#E07A5F]/20 px-4 py-3 text-left transition hover:from-[#E07A5F]/15 hover:to-[#F4A261]/15"
               >
                 <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#E07A5F] to-[#F4A261] text-white">
                   <Sparkles className="h-4.5 w-4.5" />
                 </div>
                 <div className="min-w-0 flex-1">
                   <div className="text-sm font-semibold text-[#2D3436] dark:text-[#E8E8E8]">Ask Sona AI</div>
                   <div className="truncate text-xs text-[#8C8C8C]">“{query.trim()}”</div>
                 </div>
               </button>
             )}
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
            // Long-press (and desktop right-click) opens a small WhatsApp-style
            // popup with Pin/Unpin instead of immediately dropping into
            // multi-select — matching what a long-press on a chat does in
            // WhatsApp, rather than Gmail-style bulk selection.
            e.preventDefault();
            if (selectMode) return;
            setChatLongPressMenu({ chatId: c.id, x: e.clientX, y: e.clientY });
          }}
          className={`group relative flex w-full items-center gap-3 px-3 py-3 mx-1 my-0.5 text-left transition-colors cursor-pointer rounded-xl ${
            isSelected ? "" : "hover:bg-[#F4A261]/10"
          }`}
          style={isSelected ? { backgroundColor: "var(--sona-accent-soft, rgba(217, 119, 87, 0.10))" } : undefined}>
          {isSelected && (
            <motion.div
              layoutId={`chat-select-bar-${c.id}`}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full"
              style={{ backgroundColor: "var(--sona-accent, #E07A5F)" }}
            />
          )}
          <div className="relative shrink-0">
            {(() => {
              const otherId = c.memberIds.find((id) => id !== me.id);
              const hasStatus = !ai && otherId && usersWithStatus.has(otherId);
              return (
                <div
                  className={`rounded-full ${hasStatus?  `ring-2 ${!me.is_pro ? "ring-[#25D366]" :"ring-purple "} ` :""} `} 
                  style={hasStatus ? { padding: 3, background: "transparent", cursor: "pointer" } : undefined}
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
                className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full dark:bg-[#1E1E1E] bg-[#FAF8F5] ring-2 ring-[#FAF8F5] dark:ring-[#1E1E1E]"
                title={`Disappearing messages: ${disappearingLabel(c.disappearing_seconds)}`}
              >
                <CiTimer className="h-4 w-4 dark:text-white text-[#8c8c8c]" />
              </div>
            )}
            {selectMode && (
              <div
                onClick={(e) => { e.stopPropagation(); toggleChatSelection(c.id); }}
                className="absolute -bottom-0.5 -right-0.5 grid h-[18px] w-[18px] place-items-center rounded-full ring-2 ring-white dark:ring-[#1E1E1E] transition-transform duration-150"
                style={{
                  backgroundColor: isSelected ? "var(--sona-accent, #8B5CF6)" : "transparent",
                  border: isSelected ? "none" : "2px solid #8C8C8C",
                  transform: isSelected ? "scale(1.05)" : "scale(1)",
                }}
              >
                {isSelected && <Check className="h-3 w-3 text-white" strokeWidth={4} />}
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
                  <div className="flex items-center gap-1">
                    {!ai && !c.is_group && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const otherId = c.memberIds.find((id) => id !== me.id);
                          const p = otherId ? profilesById[otherId] : undefined;
                          if (p) setReportTarget(p);
                          else antMessage.error("Couldn't find that user's profile to report.");
                        }}
                        className="grid h-6 w-6 md:h-5 md:w-5 place-items-center rounded-full opacity-40 hover:opacity-100 hover:bg-[#F4A261]/20 md:opacity-0 md:group-hover:opacity-100 transition"
                        aria-label="Report user"
                        title="Report user"
                      >
                        <Flag className="h-3 w-3 text-[#8C8C8C] hover:text-[#E07A5F]" />
                      </button>
                    )}
                    <button
                      onClick={(e) => togglePin(e, c)}
                      className={`grid h-6 w-6 md:h-5 md:w-5 place-items-center rounded-full hover:bg-[#F4A261]/20 ${
                        c.isPinned ? "" : "opacity-40 md:opacity-0 md:group-hover:opacity-100"
                      }`}
                      aria-label={c.isPinned ? "Unpin chat" : "Pin chat"}
                      title={c.isPinned ? "Unpin chat" : "Pin chat"}
                    >
                      <Pin className="h-3 w-3" style={c.isPinned ? { fill: "var(--sona-accent, #E07A5F)", color: "var(--sona-accent, #E07A5F)" } : undefined} />
                    </button>
                  </div>
                )}
                <span className={`text-[11px] ${c.unread > 0 ? "font-semibold" : "text-[#8C8C8C]"}`} style={c.unread > 0 ? { color: "var(--sona-accent, #D97757)" } : undefined}>
                  {last ? fmtChatTimestamp(last.created_at) : ""}
                </span>
                {!ai && c.unread > 0 && !selectMode && (
                  <span
                    className={`grid h-5 min-w-[20px] place-items-center rounded-full text-white text-[10px] font-bold px-1`} 
                    style={{ backgroundColor: "var(--sona-accent, #D97757)" }}
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
                      {last && !last.deleted_at && c.lastMessageReaction && (
                        <span className="shrink-0 text-xs" title="Reacted">{c.lastMessageReaction}</span>
                      )}
                    </>
                  );
                })()}
              </div>
              {c.is_hidden && <Lock className="h-3 w-3 text-[#E07A5F]/5 shrink-0" />}
            </div>
          </div>
        </motion.div>
      );
    })
  )}
  {!loadingChats && filtered.length === 0 && ( <div className="-mb-2">
        <EmptyChatState/>
      </div>)} 
               </AnimatePresence>
</div>

            {/* Long-press popup — WhatsApp-style Pin/Unpin */}
            <AnimatePresence>
              {chatLongPressMenu && (() => {
                const chat = chats.find((c) => c.id === chatLongPressMenu.chatId);
                if (!chat) return null;
                const menuWidth = 200;
                const menuHeight = 96;
                const x = Math.min(Math.max(chatLongPressMenu.x - menuWidth / 2, 12), window.innerWidth - menuWidth - 12);
                const y = Math.min(chatLongPressMenu.y + 8, window.innerHeight - menuHeight - 12);
                return (
                  <>
                    <motion.div
                      key="long-press-backdrop"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-40"
                      onClick={() => setChatLongPressMenu(null)}
                    />
                    <motion.div
                      key="long-press-menu"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.12 }}
                      style={{ left: x, top: y, width: menuWidth }}
                      className="fixed z-50 overflow-hidden rounded-xl border border-[#E07A5F]/10 bg-white dark:bg-[#2A2A2A] py-1.5 shadow-2xl"
                    >
                      <button
                        onClick={(e) => {
                          togglePin(e, chat);
                          setChatLongPressMenu(null);
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[#2D3436] dark:text-[#E8E8E8] hover:bg-[#F4A261]/10 transition-colors"
                      >
                        <Pin
                          className="h-4 w-4 shrink-0"
                          style={chat.isPinned ? { fill: "var(--sona-accent, #E07A5F)", color: "var(--sona-accent, #E07A5F)" } : undefined}
                        />
                        {chat.isPinned ? "Unpin chat" : "Pin chat"}
                      </button>
                      <button
                        onClick={() => {
                          setSelectMode(true);
                          setSelectedChatIds(new Set([chat.id]));
                          setChatLongPressMenu(null);
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[#2D3436] dark:text-[#E8E8E8] hover:bg-[#F4A261]/10 transition-colors"
                      >
                        <CheckSquare className="h-4 w-4 shrink-0" />
                        Select
                      </button>
                    </motion.div>
                  </>
                );
              })()}
            </AnimatePresence>
            {/* Floating New-Chat FAB */}
            <button
  data-tour="new-chat-fab"
  onClick={() => {
    if (accountRestricted) { toast.error(composerNotice ?? "Your account is restricted."); return; }
    setShowNewChat(true);
  }}
  aria-label="New chat"
  className="group absolute bottom-8 right-5 z-30 grid h-[60px] w-[60px] place-items-center rounded-2xl
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
                        className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full dark:bg-[#1E1E1E] bg-[#FAF8F5] ring-2 ring-[#FAF8F5] dark:ring-[#1A1A1A]"
                        title={`Disappearing messages: ${disappearingLabel(active.disappearing_seconds)}`}
                      >
                        <CiTimer className="h-4 w-4 text-[#8C8C8C] " />
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
        <Lock className="h-3 w-3 text-[#8c8c8c] shrink-0" />
      )}

      
    </div>
  );
})()}
                      {active.is_hidden && <Lock className="h-3.5 w-3.5 text-[#E07A5F]" />}
                      {active.memberRoles[me.id] === "admin" && active.is_group && (
                        <span title="Admin" className="inline-flex"><BadgeCheck className="h-3.5 w-3.5 text-[#4FA6E0] drop-shadow-[0_1px_2px_rgba(59,130,246,0.3)]" /></span>
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
      By Sona AI
    </span>
  ) : active.is_group ? (() => {
      const onlineCount = active.members.filter((m) => onlineIds.has(m.id)).length;
      return (
        <div className="flex flex-col overflow-hidden w-full">
          {onlineCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 mb-0.5">
              {onlineCount} Online
            </span>
          )}
          <div className="relative flex overflow-hidden w-full">
            <div className="whitespace-nowrap animate-marquee flex items-center gap-1">
              <span className="mx-4">{active.members.map((m) => m.display_name).join(", ")}</span>
              <span className="opacity-50">•</span>
              <span className="mx-4">{active.members.map((m) => m.display_name).join(", ")}</span>
            </div>
          </div>
        </div>
      );
    })() : (() => {
      const otherId = active.memberIds.find((id) => id !== me.id);
      const other = otherId ? profilesById[otherId] : undefined;
      const online = otherId ? onlineIds.has(otherId) : false;

      if (online) {
        return (
          <span className="inline-flex items-center gap-1.5">
          
            <span className="text-[#8c8c8c] font-medium">Online</span>
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
                      <button onClick={() => startCall("voice")} className="grid h-9 w-9 place-items-center rounded-full hover:bg-[#F4A261]/20 dark:text-[#fff] text-[#1E1E1E] " aria-label="Voice call">
                        <Phone className="h-5 w-5" />
                      </button>
                      <button onClick={() => startCall("video")} className="grid h-9 w-9 place-items-center rounded-full hover:bg-[#F4A261]/20 dark:text-[#fff] text-[#1E1E1E] " aria-label="Video call">
                        <Video className="h-5 w-5" />
                      </button>
                    </div>
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="grid h-9 w-9 place-items-center rounded-full hover:bg-[#F4A261]/20" aria-label="Menu">
                        <MoreVertical className="h-5 w-5 text-[#2D3436] dark:text-[#fff]" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                      <DropdownMenuItem onClick={() => setShowMsgSearch((s) => !s)}>
                        Search
                      </DropdownMenuItem>

                      {!isAIChat(active) && (
                        <DropdownMenuItem disabled={isSummarized} onClick={runSummary}>
                          <span className={`flex w-full items-center ${isSummarized ? "animate-pulse" : ""}`}>
                            {isSummarized ? "Summarizing..." : "Summarize"}
                            {!me.is_pro && <MdDiamond className="ml-auto h-3 w-3 text-[#8B5CF6]" />}
                          </span>
                        </DropdownMenuItem>
                      )}

                      {!isAIChat(active) && (
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>Disappearing messages</DropdownMenuSubTrigger>
                          <DropdownMenuPortal>
                            <DropdownMenuSubContent>
                              {DISAPPEARING_OPTIONS.map((opt) => (
                                <DropdownMenuItem key={opt.label} onClick={() => setDisappearing(opt.seconds)}>
                                  <span className="flex w-full items-center justify-between">
                                    {opt.label}
                                    {(active.disappearing_seconds ?? null) === opt.seconds && (
                                      <Check className="h-3.5 w-3.5 text-[#E07A5F]" />
                                    )}
                                  </span>
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuSubContent>
                          </DropdownMenuPortal>
                        </DropdownMenuSub>
                      )}

                      {!isAIChat(active) && (
                        <DropdownMenuItem onClick={openScheduledList}>
                          Scheduled messages
                        </DropdownMenuItem>
                      )}

                      <DropdownMenuItem onClick={() => setShowMediaGallery(true)}>
                        Media, links, and docs
                      </DropdownMenuItem>

                      {!isAIChat(active) && (
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <span className="flex w-full items-center">
                              Export chat
                              {!me.is_pro && <MdDiamond className="ml-auto h-3 w-3 text-[#8B5CF6]" />}
                            </span>
                          </DropdownMenuSubTrigger>
                          <DropdownMenuPortal>
                            <DropdownMenuSubContent>
                              <DropdownMenuItem onClick={() => exportChat("json")}>Export as JSON</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => exportChat("pdf")}>Export as PDF</DropdownMenuItem>
                            </DropdownMenuSubContent>
                          </DropdownMenuPortal>
                        </DropdownMenuSub>
                      )}

                      <DropdownMenuItem onClick={clearChat}>
                        Clear chat
                      </DropdownMenuItem>

                      {!isAIChat(active) && (
                        <DropdownMenuItem onClick={toggleHideChat}>
                          <span className="flex w-full items-center">
                            {active.is_hidden ? "Unhide chat" : "Hide & encrypt"}
                            {!me.is_pro && !active.is_hidden && <MdDiamond className="ml-auto h-3 w-3 text-[#8B5CF6]" />}
                          </span>
                        </DropdownMenuItem>
                      )}

                      {active.is_hidden && isUnlocked(active.id) && (
                        <DropdownMenuItem onClick={relock}>Lock now</DropdownMenuItem>
                      )}

                      {!isAIChat(active) && !active.is_group && (
                        <>
                          <DropdownMenuItem
                            onClick={() => {
                              const p = activeOtherId ? profilesById[activeOtherId] : undefined;
                              if (p) setReportTarget(p);
                            }}
                          >
                            Report
                          </DropdownMenuItem>
                          {iBlockedThem ? (
                            <DropdownMenuItem onClick={unblockOther}>Unblock</DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={blockOther} className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400">
                              Block
                            </DropdownMenuItem>
                          )}
                        </>
                      )}

                      {/* Groups don't have one "other user" — surface the member list so
                          the person can pick exactly who they want to report or block. */}
                      {!isAIChat(active) && active.is_group && (
                        <DropdownMenuItem onClick={() => setShowMemberList(true)}>
                          Report a member
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </header>

                {active.is_group && active.description && (
                  <div className="border-b border-[#E07A5F]/10 bg-[#FFFDF9] dark:bg-[#1E1E1E]">
                    <button
                      onClick={() => setDescOpen((v) => !v)}
                      className="flex w-full items-center gap-1.5 px-4 py-2 text-xs font-medium text-[#8C8C8C] hover:text-[#E07A5F] transition"
                    >
                      Description
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${descOpen ? "rotate-180" : "-rotate-90"}`} />
                    </button>
                    <AnimatePresence initial={false}>
                      {descOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                          className="overflow-hidden"
                        >
                          <p className="whitespace-pre-wrap break-words px-4 pb-3 text-sm leading-6 text-[#2D3436] dark:text-[#E8E8E8]">
                            {active.description}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

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
  const isJumpHighlighted = jumpHighlightId === m.id;

  return (
    <div key={m.id} className="contents">
    {showDateSeparator && (
      <div className="my-3 flex justify-center">
        <span className="rounded bg-[#F4A261]/20 px-3 py-1 text-[11px] font-medium text-[#8C8C8C] backdrop-blur border border-[#E07A5F]/20">
          {fmtDateLabel(m.created_at)}
        </span>
      </div>
    )}
    {m.id === unreadDividerId && (
      <div className="my-3 flex items-center gap-2">
        <div className="h-px flex-1 bg-[#E07A5F]/30" />
        <span className="shrink-0 rounded-full bg-[#E07A5F] px-3 py-1 text-[11px] font-semibold text-white shadow-sm">
          {unreadSnapshot} unread {unreadSnapshot === 1 ? "message" : "messages"}
        </span>
        <div className="h-px flex-1 bg-[#E07A5F]/30" />
      </div>
    )}
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 500, damping: 40, mass: 0.6 }}
      ref={(el) => { if (el) msgRefs.current.set(m.id, el); else msgRefs.current.delete(m.id); }}
      className={
        isCurrentMatch
          ? "rounded-2xl ring-2 ring-[#E07A5F] ring-offset-2 ring-offset-transparent transition-all"
          : ""
      }
    >
    <MessageErrorBoundary messageId={m.id}>
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
      onRemove={() => hardDeleteMessage(m.id)}
      onReply={() => startReply(m)}
      onEdit={() => startEdit(m)}
      parentName={parentName}
      parentBody={parentBody}
      onJumpToParent={parentMsg ? () => jumpToMessage(parentMsg.id) : undefined}
      isHighlighted={isJumpHighlighted}
      actionsOpen={openBubbleId === m.id}
      onToggleActions={() => setOpenBubbleId(openBubbleId === m.id ? null : m.id)}
      onTranscribed={(messageId, transcript) =>
        setMessages((prev) => prev.map((row) => (row.id === messageId ? { ...row, transcript } : row)))
      }
      replyCount={repliesByParent[m.id]?.length ?? 0}
      onOpenThread={() => setThreadRootId(m.id)}
      onForward={() => setForwardingMessage(m)}
    />
    </MessageErrorBoundary>
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
  <div className="border-t border-[#E07A5F]/10 chat-pattern dark:bg-[#242424] px-3 py-2 md:px-6">
    <div className="mx-auto flex max-w-3xl items-center gap-2">
      <div className="flex-1 min-w-0 rounded-lg border-l-[3px] border-[#E07A5F] bg-[#F5F0E8]/60 dark:bg-[#2A2A2A]/60 px-3 py-1.5">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#E07A5F]">
          {editing ? (
            <>
              <Pencil className="h-3 w-3" />
              <span>Editing</span>
            </>
          ) : (
            <>
              <Reply className="h-3 w-3" />
              <span>
                {replyTo?.sender_id === me?.id ? "You" : profiles[replyTo?.sender_id]?.display_name ?? "…"}
              </span>
            </>
          )}
        </div>
        <div className="mt-0.5 overflow-hidden text-xs text-[#2D3436]/60 dark:text-[#E8E8E8]/60 whitespace-nowrap [mask-image:linear-gradient(to_right,black_80%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_right,black_80%,transparent_100%)]">
          {editing ? (editing.body ?? "") : <MessagePreview msg={replyTo} decrypted={decrypted} />}
        </div>
      </div>
      <button
        onClick={() => { setReplyTo(null); setEditing(null); if (editing) setDraft(""); }}
        className="shrink-0 grid h-7 w-7 place-items-center rounded-full hover:bg-[#F4A261]/20 transition-colors"
        aria-label="Cancel"
      >
        <X className="h-4 w-4 text-[#2D3436] dark:text-[#E8E8E8]" />
      </button>
    </div>
  </div>
)}

                {(pendingImages.length > 0 || pendingDocs.length > 0) && (
                  <div className="chat-pattern px-3 py-3 md:px-6">
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

                {composerNotice ? (
                  <div className="border-t border-[#E07A5F]/10 bg-[#FFFDF9] px-4 py-5 text-center dark:bg-[#242424]">
                    <p className="mx-auto flex max-w-md items-center justify-center gap-2 rounded-2xl bg-[#F5F0E8] px-4 py-3 text-sm font-medium text-[#8C8C8C] dark:bg-[#2A2A2A]">
                      {broadcastLocked && !accountRestricted && !iBlockedThem && !theyBlockedMe ? (
                        <Radio className="h-4 w-4 shrink-0 text-[#E07A5F]" />
                      ) : (
                        <Ban className="h-4 w-4 shrink-0 text-[#E07A5F]" />
                      )}
                      {composerNotice}
                    </p>
                    {iBlockedThem && !accountRestricted && (
                      <button onClick={unblockOther} className="mt-3 rounded-full bg-[#E07A5F] px-5 py-2 text-xs font-semibold text-white">
                        Unblock
                      </button>
                    )}
                  </div>
                ) : (
                <>
                {moderationResult && (moderationResult.shouldLog || !moderationResult.allowed) && (
                  <div className="px-4 pt-3 chat-pattern absolute">
                    <ModerationAlert result={moderationResult} />
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
                  onSchedule={isAIChat(active) ? undefined : (date) => send(date)}
                  onPickVideo={onPickVideo}
                  videoRef={videoRef}
                  videoUploadPct={videoUploadPct}
                  onCreatePoll={isAIChat(active) ? undefined : () => setShowPollComposer(true)}
                />
                </>
                )}
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
          onRemoveMember={(m) => removeMember(active.id, m)}
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

      {showPollComposer && activeId && (
        <PollComposerModal
          chatId={activeId}
          onClose={() => setShowPollComposer(false)}
          onCreated={onPollCreated}
        />
      )}

      {assigningFolders && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4" onClick={() => setAssigningFolders(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-[#FFFDF9] p-5 shadow-xl dark:bg-[#242424]" onClick={(e) => e.stopPropagation()}>
            <h3 className="flex items-center gap-2 text-base font-semibold text-[#2D3436] dark:text-[#E8E8E8]">
              <FolderCog className="h-4 w-4 text-[#E07A5F]" /> Add to folder
            </h3>
            <p className="mt-1 text-xs text-[#8C8C8C]">{selectedChatIds.size} chat{selectedChatIds.size === 1 ? "" : "s"} selected</p>

            <div className="mt-3 max-h-64 space-y-1 overflow-y-auto">
              {customFolders.length === 0 && (
                <p className="py-4 text-center text-xs text-[#8C8C8C]">No folders yet. Create one first with the + button on the chat list.</p>
              )}
              {customFolders.map((f) => {
                const chatIds = [...selectedChatIds];
                const allIn = chatIds.length > 0 && chatIds.every((id) => (chatFolderMap[id] ?? []).includes(f.id));
                return (
                  <button
                    key={f.id}
                    onClick={() => {
                      const next = { ...chatFolderMap };
                      for (const id of chatIds) {
                        const cur = next[id] ?? [];
                        next[id] = allIn ? cur.filter((x) => x !== f.id) : [...new Set([...cur, f.id])];
                      }
                      persistFolderMap(next);
                    }}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm hover:bg-[#F5F0E8] dark:hover:bg-[#2A2A2A] dark:text-[#E8E8E8]"
                  >
                    {f.name}
                    {allIn && <Check className="h-4 w-4 text-[#E07A5F]" />}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={openCreateFolderModal} className="flex items-center gap-1 rounded-xl bg-[#F5F0E8] px-3 py-2 text-sm dark:bg-[#3A3A3A] dark:text-[#E8E8E8]">
                <FolderPlus className="h-3.5 w-3.5" /> New folder
              </button>
              <button onClick={() => { setAssigningFolders(false); exitSelectMode(); }} className="rounded-xl bg-[#E07A5F] px-4 py-2 text-sm font-semibold text-white">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <Modal
        open={!!folderModal}
        title={folderModal?.mode === "create" ? "New folder" : "Rename folder"}
        onCancel={() => setFolderModal(null)}
        footer={[
          ...(folderModal?.mode === "rename" && folderModal.id
            ? [
                <button
                  key="delete"
                  onClick={() => {
                    const folder = customFolders.find((cf) => cf.id === folderModal.id);
                    if (folder) deleteCustomFolder(folder.id, folder.name);
                  }}
                  className="mr-auto rounded-xl bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-500 hover:bg-red-500/20 transition"
                >
                  Delete folder
                </button>,
              ]
            : []),
          <button key="cancel" onClick={() => setFolderModal(null)} className="rounded-xl bg-[#F5F0E8] px-3 py-2 text-sm dark:bg-[#3A3A3A] dark:text-[#E8E8E8]">
            Cancel
          </button>,
          <button key="save" onClick={submitFolderModal} className="rounded-xl bg-[#E07A5F] px-4 py-2 text-sm font-semibold text-white">
            {folderModal?.mode === "create" ? "Create" : "Save"}
          </button>,
        ]}
      >
        <Input
          autoFocus
          maxLength={30}
          placeholder="e.g. Work, Family, Close friends"
          value={folderModal?.value ?? ""}
          onChange={(e) => setFolderModal((s) => (s ? { ...s, value: e.target.value } : s))}
          onPressEnter={submitFolderModal}
        />
      </Modal>

      {reportTarget && me && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4" onClick={() => setReportTarget(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-[#FFFDF9] p-5 shadow-xl dark:bg-[#242424]" onClick={(e) => e.stopPropagation()}>
            <h3 className="flex items-center gap-2 text-base font-semibold text-[#2D3436] dark:text-[#E8E8E8]">
              <AlertTriangle className="h-4 w-4 text-[#E07A5F]" /> Report {reportTarget.display_name}
            </h3>
            <p className="mt-1 text-xs text-[#8C8C8C]">Reports are reviewed by Sona administrators.</p>
            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="mt-4 w-full rounded-xl bg-[#F5F0E8] px-3 py-2 text-sm text-[#2D3436] outline-none dark:bg-[#2A2A2A] dark:text-[#E8E8E8]"
            >
              {["Harassment or bullying", "Spam or scam", "Hate speech", "Inappropriate content", "Impersonation", "Other"].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <textarea
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              rows={3}
              placeholder="Add details (optional)"
              className="mt-2 w-full resize-none rounded-xl bg-[#F5F0E8] px-3 py-2 text-sm text-[#2D3436] outline-none dark:bg-[#2A2A2A] dark:text-[#E8E8E8]"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setReportTarget(null)} className="rounded-xl bg-[#F5F0E8] px-3 py-2 text-sm dark:bg-[#3A3A3A] dark:text-[#E8E8E8]">Cancel</button>
              <button onClick={submitReport} className="rounded-xl bg-[#E07A5F] px-4 py-2 text-sm font-semibold text-white">Send report</button>
            </div>
          </div>
        </div>
      )}

      {viewingProfile && me && (
        <ProfileViewModal
          profile={viewingProfile}
          isSelf={viewingProfile.id === me.id}
          onClose={() => setViewingProfile(null)}
          onMessage={() => messageProfile(viewingProfile)}
          onEdit={() => { setViewingProfile(null); setShowSettings(true); }}
          moderation={viewingProfile.id === me.id ? myModeration : null}
          onReport={viewingProfile.id !== me.id && !viewingProfile.is_ai ? () => { setViewingProfile(null); setReportTarget(viewingProfile); } : undefined}
          online={onlineIds.has(viewingProfile.id)}
          lastSeen={viewingProfile.last_seen ?? null}
          onOpenMedia={
            viewingProfile.id !== me.id && activeId
              ? () => { setViewingProfile(null); setShowMediaGallery(true); }
              : undefined
          }
          isBlocked={viewingProfile.id === activeOtherId ? iBlockedThem : undefined}
          onToggleBlock={
            viewingProfile.id === activeOtherId
              ? () => { const fn = iBlockedThem ? unblockOther : blockOther; setViewingProfile(null); fn(); }
              : undefined
          }
          hasStatus={!viewingProfile.is_ai && usersWithStatus.has(viewingProfile.id)}
          socials={{
            facebook: viewingProfile.facebook_url ?? undefined,
            x: viewingProfile.x_url ?? undefined,
            instagram: viewingProfile.instagram_url ?? undefined,
            threads: viewingProfile.threads_url ?? undefined,
          }}
          onShareContact={async () => {
            const shareUrl = `${window.location.origin}/u/${viewingProfile.id}`;
            const shareData = {
              title: viewingProfile.display_name,
              text: `Chat with ${viewingProfile.display_name} on Sona`,
              url: shareUrl,
            };
            try {
              if (navigator.share) {
                await navigator.share(shareData);
              } else {
                await navigator.clipboard.writeText(shareUrl);
                antMessage.success("Contact link copied");
              }
            } catch {
              // user dismissed the native share sheet — nothing to do
            }
          }}
        />
      )}


      {forwardingMessage && me && (
        <ForwardModal
          message={forwardingMessage}
          chats={chats}
          meId={me.id}
          onClose={() => setForwardingMessage(null)}
          onForwarded={() => {}}
        />
      )}

      {showMediaGallery && activeId && (
        <MediaGalleryModal
          chatId={activeId}
          onClose={() => setShowMediaGallery(false)}
          onOpenViewer={(kind, url, name) => setGalleryViewer({ kind, url, name })}
        />
      )}

      {galleryViewer && (galleryViewer.kind === "image" || galleryViewer.kind === "pdf") && (
        <MediaViewer
          items={[{ kind: galleryViewer.kind, url: galleryViewer.url, name: galleryViewer.name }]}
          initialIndex={0}
          onClose={() => setGalleryViewer(null)}
        />
      )}

      {galleryViewer && galleryViewer.kind === "video" && (
        <div
          className="fixed inset-0 z-[120] grid place-items-center bg-black/90 p-4"
          onClick={() => setGalleryViewer(null)}
        >
          <button
            onClick={() => setGalleryViewer(null)}
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="Close video"
          >
            <X className="h-5 w-5" />
          </button>
          <video
            src={galleryViewer.url}
            controls
            autoPlay
            className="max-h-[85vh] max-w-full rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
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
      </Watermark>
    </div>
  );
}

