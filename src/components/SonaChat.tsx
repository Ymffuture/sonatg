import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Search, MoreVertical, ArrowLeft,
  Plus, X, Trash2,
  MessageSquarePlus, Settings, PhoneMissed, Shield, Sparkles, Lock,
  Ban, Reply, Pencil, Crown, Users, Phone, Video, CheckSquare, Square, BookOpen, Check, ChevronUp, ChevronDown, Clock, Pin, Send,
  Share2, BadgeCheck, FileText, DoorOpen, Download,
  Tag, Loader2,
  AlertTriangle, FolderPlus, FolderCog, Flag, ListChecks, Megaphone, Radio,
  Bookmark, Forward,
} from "lucide-react";
import { LuCircleFadingPlus } from "react-icons/lu";
import { IoCameraOutline } from "react-icons/io5";
import { CiTimer } from "react-icons/ci";
import { fetchActiveAnnouncement, type AppAnnouncement } from "@/lib/announcements";
import { notifyOfflineMessage } from "@/lib/notifications.functions";
import { buildTranscript, exportChatAsJSON, exportChatAsPDF } from "@/lib/export-chat";
import { Watermark, Tooltip } from "antd";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { useSonaTheme } from "@/hooks/useSonaTheme";
import {StatusPageLoader} from "./StatusPageLoader"
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { askSonaAI, summarizeChat } from "@/lib/ai.functions";
import { getCoordsForPrompt } from "@/lib/geo";
import { AskSonaPanel } from "@/components/AskSonaPanel";
import { MessageInfoPopover } from "@/components/MessageInfoPopover";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { CallManager, type CallManagerHandle } from "./CallManager";
import { ConfirmProvider, useConfirm } from "@/hooks/useConfirmDialog";
import { pushBackLayer } from "@/hooks/useBackStack";
import { useContactNicknames } from "@/hooks/useContactNicknames";
import Lottie from "lottie-react";
import {EmptyChatState} from "./EmptyChatState";
import {SonaAIGreeting} from "./SonaAIGreeting";
import {SonaTypingIndicator} from "./SonaTypingIndicator";
import { PurpleBadge } from "./PurpleBadge";
import {MdDiamond} from "react-icons/md";
import { IoMdArrowDropleft } from "react-icons/io";
import { IoMdArrowDropright } from "react-icons/io";
import { toast , Toast } from "@heroui/react";
import { MdVerified } from "react-icons/md";

import { AdminLink } from "@/components/chat/AdminLink";
import { CategoryIcon } from "@/components/chat/CategoryIcon";
import { MessagePreview } from "@/components/chat/MessagePreview";
import { ThreadPanel } from "@/components/chat/ThreadPanel";
import { saveDraftToStorage, loadDraftFromStorage, clearDraftFromStorage } from "@/utils/chatDrafts";
import { DISAPPEARING_OPTIONS, disappearingLabel, fmtChatTimestamp } from "@/utils/chatFormatting";

import { OnboardingTour, hasSeenOnboarding, type TourStep } from "./OnboardingTour";
import {
  SONA_AI_ID, fmtTime, fmtLastSeen, fmtDateLabel, CHAT_CATEGORIES,
  type ChatRow, type MessageRow, type Profile, type ReactionRow, type MessageReadRow, type MessageDeliveryRow,
  type BlockRow, type ChatCategory, type ChatMemberRole,
} from "@/lib/db";
import { encryptBody, decryptBody, unlockChat, isUnlocked, lockChat } from "@/lib/crypto";
import { playSendSound, playReceiveSound } from "@/lib/sounds";
import { SonaLogo } from "./SonaLogo";
import sonaAi from "@/assets/sona01.jpg";
import { VscVerifiedFilled } from "react-icons/vsc";
import { MdInsertPhoto } from "react-icons/md";
import { IoMdMic } from "react-icons/io";
import { FaFileLines } from "react-icons/fa6";
import { FaLock } from "react-icons/fa6"; 
import { MdSearch } from "react-icons/md";
import { BiSolidMessageSquareAdd } from "react-icons/bi";
import { RiArrowLeftWideFill } from "react-icons/ri";
import { NetworkStatusFooter } from "./NetworkStatusFooter";
import {
  type ChatWithMeta, type ReadStatus, useTheme, chatTitle, chatAvatarUrl, isAIChat,
  explainSupabaseError, categoryMeta, readStatusFor,
  MAX_IMAGES, MAX_IMAGE_BYTES, MAX_DOCS, MAX_DOC_BYTES, DOC_EXTENSIONS, docExtOf, formatBytes, compressImageForUpload,
  URL_REGEX,
} from "@/utils/utils";
import { Avatar, TickIcon } from "./Avatar";
import { Bubble, Composer, MediaViewer } from "./MessageBubble";
import { MessageErrorBoundary } from "./MessageErrorBoundary";
import { MemberListModal, GroupSettingsModal, NewChatModal, SettingsModal, UnlockModal, SavedMessagesModal } from "./ChatModals";
import { ProfileViewModal } from "./ProfileView";
import { ForwardModal } from "./ForwardModal";
import { MediaGalleryModal } from "./MediaGalleryModal";
import { uploadToCloudinary, readVideoDurationMs } from "@/utils/cloudinary";
import { useMessageModeration, ModerationAlert, type ModerationResult } from "@/features/moderation";
import { getOrgFileLimits } from "@/features/admin";
import {
  FREE_CHAT_LIMIT,
  FREE_PIN_LIMIT,
  FREE_DAILY_MESSAGE_LIMIT,
  FREE_CHAT_LIMIT_MESSAGE,
  FREE_MESSAGE_LIMIT_MESSAGE,
  countMessagesSentToday,
  isFreeTierLimitError,
} from "@/lib/planLimits";
import { PollComposerModal, canPostInChat } from "@/features/classroom";
import { AdComposerModal, type CreatedAd } from "@/features/ads/AdComposerModal";
import { useListAds, adSlotAfter } from "@/features/ads/useListAds";
import { ChatListAd } from "@/components/ChatListAd";
import { getCloudinaryUploadSignature } from "@/lib/cloudinary.functions";
import { postSystemMessage } from "@/lib/systemMessages";
import { FaPoll } from "react-icons/fa";

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
    placement: "top",
  },
  {
    targetSelector: '[data-tour="settings-btn"]',
    title: "Make it yours",
    description: "Open this menu to set your profile photo and bio, manage subscriptions, switch themes, and more.",
    placement: "left",
  },
];

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
  const aiListRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const askSummary = useServerFn(summarizeChat);
  const [isSummarized, setIsSummarized] =useState(false) ;
  const [me, setMe] = useState<Profile | null>(null);

  // Private per-contact renames (see useContactNicknames + the
  // contact_nicknames migration). Applied as a display-only overlay on top
  // of `profilesRaw`/`chatsRaw` below — never written back to `profiles`,
  // so a contact's real registered name is untouched and nobody else can
  // ever see the nickname.
  const { nicknames, setNickname: setContactNickname, clearNickname: clearContactNickname } = useContactNicknames(me?.id);

  const sonaTheme = useSonaTheme(!!me?.is_pro, me?.theme_id, (id) => {
    if (!me) return;
    setMe((prev) => (prev ? { ...prev, theme_id: id } : prev));
    supabase.from("profiles").update({ theme_id: id }).eq("id", me.id).then(({ error }) => {
      if (error) toast.danger("Couldn't sync theme to your account");
    });
  });
  const [chatsRaw, setChatsRaw] = useState<ChatWithMeta[]>([]);
  const chats = useMemo(() => {
    if (!Object.keys(nicknames).length) return chatsRaw;
    return chatsRaw.map((c) => ({
      ...c,
      members: c.members.map((m) => (nicknames[m.id] ? { ...m, display_name: nicknames[m.id] } : m)),
    }));
  }, [chatsRaw, nicknames]);

  const [loadingChats, setLoadingChats] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [unreadSnapshot, setUnreadSnapshot] = useState(0);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [reactions, setReactions] = useState<ReactionRow[]>([]);
  const [reads, setReads] = useState<MessageReadRow[]>([]);
  const [deliveries, setDeliveries] = useState<MessageDeliveryRow[]>([]);
  const [profilesRaw, setProfilesRaw] = useState<Record<string, Profile>>({});
  const profiles = useMemo(() => {
    if (!Object.keys(nicknames).length) return profilesRaw;
    const merged: Record<string, Profile> = {};
    for (const [id, p] of Object.entries(profilesRaw)) {
      merged[id] = nicknames[id] ? { ...p, display_name: nicknames[id] } : p;
    }
    return merged;
  }, [profilesRaw, nicknames]);

  const [query, setQuery] = useState("");
  const [announcement, setAnnouncement] = useState<AppAnnouncement | null>(null);
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);
const [menuOpen, setMenuOpen] = useState(false);
const [menuView, setMenuView] = useState<"root" | "more" | "disappearing" | "export">("root");

const handleMenuOpenChange = (open: boolean) => {
  setMenuOpen(open);
  if (!open) setMenuView("root");
};

  
  useEffect(() => {
    fetchActiveAnnouncement().then(setAnnouncement).catch(() => {});
    const channel = supabase
      .channel("app-announcements")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_announcements" }, () => {
        fetchActiveAnnouncement().then((a) => {
          setAnnouncement(a);
          setAnnouncementDismissed(false);
        }).catch(() => {});
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!activeId) return;
    setDraft(loadDraftFromStorage(activeId));
  }, [activeId]);

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
  const [sonaTyping, setSonaTyping] = useState(false);
  const sonaTypingRef = useRef(false);
  sonaTypingRef.current = sonaTyping;
  // Pin/save confirmations stay quiet while Sona is replying.
  const quietToast = (msg: string) => { if (!sonaTypingRef.current) toast.success(msg); };
  const composerInputRef = useRef<HTMLTextAreaElement | null>(null);
  const { checkMessage, lastResult: moderationResult } = useMessageModeration();

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
        pattern_signals: JSON.parse(JSON.stringify(verdict.patternSignals)),
      });
      if (error) console.error("[moderation] failed to log flag:", error.message);
    },
    [],
  );
  const [showPollComposer, setShowPollComposer] = useState(false);
  const [showAdComposer, setShowAdComposer] = useState(false);
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
      toast.danger(`Poll created but couldn't post it to the chat: ${explainSupabaseError(e).title}`);
    }
  };

  const onAdCreated = async (ad: CreatedAd) => {
    if (!me) throw new Error("You need to be signed in to post an ad.");

    // "Chat list" ads go to the `ads` table and show between chats for everyone.
    if (ad.placement === "list") {
      const { error } = await (supabase as unknown as { from: (t: string) => any }).from("ads").insert({
        owner_id: me.id,
        media_url: ad.mediaUrl,
        title: ad.title,
        cta_label: ad.ctaLabel,
        cta_url: ad.ctaUrl,
      });
      if (error) {
        const explained = explainSupabaseError(error);
        throw new Error(`${explained.title}: ${explained.raw}`);
      }
      toast.success("Your ad is live in the chat list.");
      setShowAdComposer(false);
      return;
    }

    // "This chat" keeps the original behaviour: an ad message inside the open chat.
    if (!activeId) {
      throw new Error("No active chat to post this ad to. Open a chat and try again.");
    }
    const { error } = await supabase.from("messages").insert({
      chat_id: activeId,
      sender_id: me.id,
      kind: "ad",
      media_url: ad.mediaUrl,
      ad_title: ad.title,
      ad_cta_label: ad.ctaLabel,
      ad_cta_url: ad.ctaUrl,
    });
    if (error) {
      const explained = explainSupabaseError(error);
      throw new Error(`${explained.title}: ${explained.raw}`);
    }
    setShowAdComposer(false);
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

  const popChatLayerRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!showSidebarMobile) {
      popChatLayerRef.current = pushBackLayer(() => setShowSidebarMobile(true));
      return () => { popChatLayerRef.current?.(); popChatLayerRef.current = null; };
    }
  }, [showSidebarMobile]);
  const closeActiveChat = useCallback(() => {
    setShowSidebarMobile(true);
  }, []);

  const [showNewChat, setShowNewChat] = useState(false);

  const [messagesSentToday, setMessagesSentToday] = useState(0);
  const refreshMessagesSentToday = useCallback(() => {
    if (!me || me.is_pro) return;
    countMessagesSentToday(me.id).then(setMessagesSentToday).catch(() => {});
  }, [me]);
  useEffect(() => { refreshMessagesSentToday(); }, [refreshMessagesSentToday]);
  const myChatCount = chats.length;
  const canCreateChat = !!me?.is_pro || myChatCount < FREE_CHAT_LIMIT;
  const canSendMessageToday = !!me?.is_pro || messagesSentToday < FREE_DAILY_MESSAGE_LIMIT;
  const [showMemberList, setShowMemberList] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [viewingProfile, setViewingProfile] = useState<Profile | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<MessageRow | null>(null);
  const [askSonaMessage, setAskSonaMessage] = useState<MessageRow | null>(null);
  const [messageInfoTarget, setMessageInfoTarget] = useState<MessageRow | null>(null);
  const [showMediaGallery, setShowMediaGallery] = useState(false);
  const [galleryViewer, setGalleryViewer] = useState<{ kind: "image" | "video" | "pdf"; url: string; name?: string | null } | null>(null);
  const [videoUploadPct, setVideoUploadPct] = useState<number | null>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const signCloudinaryUpload = useServerFn(getCloudinaryUploadSignature);
  const [reactingOn, setReactingOn] = useState<string | null>(null);
  const [typingOthers, setTypingOthers] = useState<string[]>([]);
  // Keep the browser tab title in sync with who is currently typing.
  useEffect(() => {
    const names = typingOthers
      .map((id) => profiles[id]?.display_name?.trim())
      .filter((name): name is string => Boolean(name));
    window.dispatchEvent(new CustomEvent("sona:typing-title", { detail: { names } }));
    return () => {
      window.dispatchEvent(new CustomEvent("sona:typing-title", { detail: { names: [] } }));
    };
  }, [typingOthers, profiles]);
  const [recordingOthers, setRecordingOthers] = useState<string[]>([]);
  const [listActivity, setListActivity] = useState<Record<string, { typing: string[]; recording: string[] }>>({});
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
const [headerMenuView, setHeaderMenuView] = useState<"root" | "more">("root");

  const [showSettings, setShowSettings] = useState(false);
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [blockedByIds, setBlockedByIds] = useState<Set<string>>(new Set());
  const [myModeration, setMyModeration] = useState<{ action: string; reason: string | null; expires_at: string | null } | null>(null);
  const [otherModeration, setOtherModeration] = useState<{ action: string; reason: string | null; expires_at: string | null } | null>(null);
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

  const [openMessageMenu, setOpenMessageMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const closeMessageMenu = useCallback(() => setOpenMessageMenu(null), []);
  const openMessageMenuFor = useCallback((id: string, x: number, y: number) => {
    setShowHeaderMenu(false);
    setShowDisappearingMenu(false);
    setChatLongPressMenu(null);
    setOpenMessageMenu({ id, x, y });
  }, []);

  const handleHeaderMenuOpenChange = (open: boolean) => {
  setShowHeaderMenu(open);
  if (!open) setHeaderMenuView("root");
};

  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [showSavedMessages, setShowSavedMessages] = useState(false);
  const [savedMessages, setSavedMessages] = useState<(MessageRow & { chat_id: string })[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);

  const [msgSelectMode, setMsgSelectMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());
  const [forwardingMessages, setForwardingMessages] = useState<MessageRow[] | null>(null);
  const [pinnedBannerIndex, setPinnedBannerIndex] = useState(0);
  const [pendingJumpId, setPendingJumpId] = useState<string | null>(null);

  const { canInstall, promptInstall } = useInstallPrompt();
  const callManagerRef = useRef<CallManagerHandle>(null);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedChatIds, setSelectedChatIds] = useState<Set<string>>(new Set());
  const [chatLongPressMenu, setChatLongPressMenu] = useState<{ chatId: string; x: number; y: number } | null>(null);

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
  const contentRef = useRef<HTMLDivElement>(null);
  // True while the user is at/near the end of the thread (see auto-scroll below).
  const stickToBottomRef = useRef(true);
  
  const chatCacheRef = useRef<Record<string, { messages: MessageRow[]; reactions: ReactionRow[]; reads: MessageReadRow[]; deliveries: MessageDeliveryRow[] }>>({});
  const failedPayloadsRef = useRef<Record<string, Record<string, unknown>>>({});
  
  const chatClearsRef = useRef<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const typingChanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  
  
    

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { navigate({ to: "/auth" }); return; }
      const { data: p } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
      if (p) setMe(p as Profile);
    })();
  }, [navigate]);

  const loadChats = useCallback(async () => {
    if (!me) return;
    setLoadingChats(true);
    const { data: memberships } = await supabase
      .from("chat_members").select("chat_id").eq("user_id", me.id);
    const chatIds = (memberships ?? []).map((m: { chat_id: string }) => m.chat_id);
    if (chatIds.length === 0) { setChatsRaw([]); setLoadingChats(false); return; }

    const [{ data: chatRows }, { data: allMembers }] = await Promise.all([
      supabase.from("chats").select("*").in("id", chatIds).order("last_message_at", { ascending: false }),
      supabase.from("chat_members").select("chat_id, user_id, role, is_pinned, pinned_at").in("chat_id", chatIds),
    ]);
    const memberIds = Array.from(new Set((allMembers ?? []).map((m: { user_id: string }) => m.user_id)));

    const [{ data: profs }, { data: latest }, { data: clears }] = await Promise.all([
      supabase.from("profiles").select("*").in("id", memberIds),
      supabase.from("visible_messages").select("*").in("chat_id", chatIds).order("created_at", { ascending: false }).limit(500),
      supabase.from("chat_clears").select("chat_id, cleared_before").eq("user_id", me.id),
    ]);

    const clearsMap: Record<string, string> = {};
    (clears ?? []).forEach((c) => { clearsMap[(c as { chat_id: string }).chat_id] = (c as { cleared_before: string }).cleared_before; });
    chatClearsRef.current = clearsMap;

    const profMap: Record<string, Profile> = {};
    (profs ?? []).forEach((p) => { profMap[(p as Profile).id] = p as Profile; });
    setProfilesRaw((prev) => ({ ...prev, ...profMap }));

  
    const rows = ((latest ?? []) as MessageRow[]).filter((m) => {
      const cutoff = clearsMap[m.chat_id];
      return !cutoff || new Date(m.created_at).getTime() > new Date(cutoff).getTime();
    });
    const lastByChat: Record<string, MessageRow> = {};
    const primingByChat: Record<string, MessageRow[]> = {};
    rows.forEach((m) => {
      if (!lastByChat[m.chat_id]) lastByChat[m.chat_id] = m;
      (primingByChat[m.chat_id] ||= []).push(m);
    });
    for (const [chatId, msgs] of Object.entries(primingByChat)) {
      if (!chatCacheRef.current[chatId]) {
        chatCacheRef.current[chatId] = { messages: msgs.slice().reverse(), reactions: [], reads: [], deliveries: [] };
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
    setChatsRaw(result);
    setLoadingChats(false);
  }, [me, activeId]);

  useEffect(() => { loadChats(); }, [loadChats]);

  useEffect(() => {
    if (chats.length === 0) return;
    let pending: string | null = null;
    try { pending = localStorage.getItem("sona:openChat"); } catch { /* no-op */ }
    if (!pending) return;
    if (chats.some((c) => c.id === pending)) {
      setActiveId(pending);
      try { localStorage.removeItem("sona:openChat"); } catch { /* no-op */ }
    }
  }, [chats]);

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

  useEffect(() => {
    if (!viewingProfile || !me || viewingProfile.id === me.id) { setOtherModeration(null); return; }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from("user_moderation").select("action, reason, expires_at, is_active")
        .eq("user_id", viewingProfile.id).eq("is_active", true).order("created_at", { ascending: false }).limit(1);
      if (cancelled) return;
      if (error) { console.error("[moderation] failed to load profile status:", error.message); setOtherModeration(null); return; }
      const m = (data ?? [])[0] as { action: string; reason: string | null; expires_at: string | null } | undefined;
      setOtherModeration(m && m.action !== "clear" ? m : null);
    })();
    return () => { cancelled = true; };
  }, [viewingProfile, me]);

  useEffect(() => {
    if (!activeId) return;
    const c = chats.find((x) => x.id === activeId);
    if (c?.is_hidden && !isUnlocked(activeId)) setNeedsUnlock(true);
    else setNeedsUnlock(false);
  }, [activeId, chats]);

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

  useEffect(() => {
    if (!messages.some((m) => m.expires_at)) return;
    const id = setInterval(() => {
      const now = Date.now();
      setMessages((prev) => prev.filter((m) => !m.expires_at || new Date(m.expires_at).getTime() > now));
    }, 1000);
    return () => clearInterval(id);
  }, [messages]);

  useEffect(() => {
    if (!activeId) return;
    const activeChat = chats.find((c) => c.id === activeId);
    if (activeChat?.disappearing_seconds) {
      supabase.rpc("cleanup_expired_messages").then(() => {});
    }

    const cached = chatCacheRef.current[activeId];
    if (cached) {
      setMessages(cached.messages);
      setReactions(cached.reactions);
      setReads(cached.reads);
      setDeliveries(cached.deliveries);
    }

    (async () => {
      const clearedBefore = chatClearsRef.current[activeId];
      let query = supabase
        .from("visible_messages")
        .select("*")
        .eq("chat_id", activeId);
      
      if (clearedBefore) query = query.gt("created_at", clearedBefore);
      const { data: msgs } = await query
        .order("created_at", { ascending: false })
        .limit(100);
      const rows = ((msgs ?? []) as MessageRow[]).reverse();
      setMessages(rows);
      const ids = rows.map((m) => m.id);
      if (ids.length && me) {
        supabase.from("message_bookmarks").select("message_id").eq("user_id", me.id).in("message_id", ids)
          .then(({ data }) => setBookmarkedIds(new Set((data ?? []).map((b) => b.message_id as string))));
      } else {
        setBookmarkedIds(new Set());
      }
      let rx: ReactionRow[] = [];
      let rd: MessageReadRow[] = [];
      let dl: MessageDeliveryRow[] = [];
      if (ids.length) {
        const [{ data: rxData }, { data: rdData }, { data: dlData }] = await Promise.all([
          supabase.from("reactions").select("*").in("message_id", ids),
          supabase.from("message_reads").select("*").in("message_id", ids),
          supabase.from("message_deliveries").select("*").in("message_id", ids),
        ]);
        rx = (rxData ?? []) as ReactionRow[];
        rd = (rdData ?? []) as MessageReadRow[];
        dl = (dlData ?? []) as MessageDeliveryRow[];
        setReactions(rx);
        setReads(rd);
        setDeliveries(dl);

        if (me) {
          const haveDelivery = new Set(dl.filter((d) => d.user_id === me.id).map((d) => d.message_id));
          const toMark = rows.filter((m) => m.sender_id !== me.id && !m._pending && !haveDelivery.has(m.id)).map((m) => m.id);
          if (toMark.length) {
            supabase.from("message_deliveries")
              .upsert(toMark.map((id) => ({ message_id: id, user_id: me.id })), { onConflict: "message_id,user_id", ignoreDuplicates: true })
              .then(() => {});
          }
        }
      } else { setReactions([]); setReads([]); setDeliveries([]); }
      chatCacheRef.current[activeId] = { messages: rows, reactions: rx, reads: rd, deliveries: dl };
    })();
  }, [activeId]);

  useEffect(() => {
    if (!activeId) return;
    chatCacheRef.current[activeId] = { messages, reactions, reads, deliveries };
  }, [activeId, messages, reactions, reads, deliveries]);

  const notifyReaction = useCallback(async (r: ReactionRow) => {
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

    toast(
      <>
        <span className="font-semibold">{reactor!.display_name}</span> reacted{" "}
        <span className="text-base">{r.emoji}</span>
      </>,
      {
        indicator: <Avatar url={reactor!.avatar_url} name={reactor!.display_name} size={38} />,
        description: `to ${snippet}`,
        timeout: 4000,
      }
    );
  }, [me, profiles]);

  useEffect(() => {
    if (!me) return;
    const channel = supabase
      .channel("sona-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (p) => {
        const m = p.new as MessageRow;
        const notYetDue = m.scheduled_at && new Date(m.scheduled_at).getTime() > Date.now();
        // Sona's reply is streamed into this row: once its first words land, the typing dots are redundant.
        if (m.sender_id === SONA_AI_ID && m.chat_id === activeId) setSonaTyping(false);
        if (m.chat_id === activeId && !notYetDue) {
          setMessages((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, m]);
          if (m.sender_id !== me.id) playReceiveSound();
        }
        if (!notYetDue) loadChats();
        if (!notYetDue && m.sender_id !== me.id) {
          supabase.from("message_deliveries")
            .upsert({ message_id: m.id, user_id: me.id }, { onConflict: "message_id,user_id", ignoreDuplicates: true })
            .then(() => {});
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (p) => {
        const m = p.new as MessageRow;
        if (m.chat_id === activeId) {
          setMessages((prev) => prev.map((x) => x.id === m.id ? { ...x, ...m } : x));
        }
        // A streaming Sona reply updates its row every ~0.7s; refreshing the whole
        // chat list on each one is wasteful, so those are coalesced into one trailing refresh.
        if (m.sender_id === SONA_AI_ID) {
          if (aiListRefreshTimer.current) clearTimeout(aiListRefreshTimer.current);
          aiListRefreshTimer.current = setTimeout(() => { aiListRefreshTimer.current = null; loadChats(); }, 1200);
        } else {
          loadChats();
        }
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, (p) => {
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
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "message_deliveries" }, (p) => {
        const d = p.new as MessageDeliveryRow;
        setDeliveries((prev) => prev.some((x) => x.message_id === d.message_id && x.user_id === d.user_id) ? prev : [...prev, d]);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_members" }, () => { loadChats(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [me, activeId, loadChats]);

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

  useEffect(() => {
    if (!me) return;
    const bumpLastSeen = () => {
      supabase.from("profiles").update({ last_seen: new Date().toISOString() }).eq("id", me.id).then();
    };
    bumpLastSeen();
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

  useEffect(() => {
    if (!me) return;
    const chan = supabase
      .channel("sona-profiles-live")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        (payload) => {
          const row = payload.new as Profile;
          setProfilesRaw((prev) => (prev[row.id] ? { ...prev, [row.id]: { ...prev[row.id], ...row } } : prev));
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

  useEffect(() => {
    if (!activeId) { setUnreadSnapshot(0); return; }
    const c = chats.find((x) => x.id === activeId);
    setUnreadSnapshot(c?.unread ?? 0);
  }, [activeId]);

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

  const active = chats.find((c) => c.id === activeId);

  // ── Auto-scroll: keep the newest message (and the Sona typing loader) in view ──
  // "Stuck to bottom" means the user is at/near the end of the thread. While
  // stuck, ANY growth of the list (new message, the loader mounting, images or
  // link previews finishing loading, framer-motion entry animations, the mobile
  // keyboard resizing the pane) re-pins the view to the bottom. Scrolling up to
  // read history un-sticks it, so we never yank them back down mid-read.
  // Scrolling is instant on purpose: a smooth scroll aims at a stale
  // scrollHeight and falls short when the content keeps growing.
  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const handleListScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Within 160px of the end counts as "at the bottom".
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
  }, []);

  // Opening or switching a chat always starts pinned to the newest message.
  useEffect(() => {
    stickToBottomRef.current = true;
    scrollToBottom();
  }, [activeId, scrollToBottom]);

  // New message, or the Sona loader showing/hiding. Your own message and asking
  // Sona always scroll (even if you'd scrolled up); incoming messages follow
  // only when you're already at the bottom.
  const messageCount = messages.length;
  const lastSenderId = messages[messages.length - 1]?.sender_id;
  const myId = me?.id;
  useEffect(() => {
    if (sonaTyping || (myId && lastSenderId === myId)) stickToBottomRef.current = true;
    if (stickToBottomRef.current) scrollToBottom();
  }, [messageCount, lastSenderId, sonaTyping, myId, scrollToBottom]);

  // Re-pin whenever the list or the pane changes size while stuck to the bottom.
  useEffect(() => {
    const scroller = scrollRef.current;
    const content = contentRef.current;
    if (!scroller || !content || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (stickToBottomRef.current) scrollToBottom();
    });
    ro.observe(content);
    ro.observe(scroller);
    return () => ro.disconnect();
  }, [active?.id, scrollToBottom]);

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
      ? "You can't send messages to this person. You blocked them — unblock to resume the conversation."
      : theyBlockedMe
        ? "You can't send messages to this person."
        : broadcastLocked
          ? "Only admins can send messages to this group."
          : !canSendMessageToday
            ? FREE_MESSAGE_LIMIT_MESSAGE
            : null;

  const openNewChat = useCallback(() => {
    if (accountRestricted) { toast.danger(composerNotice ?? "Your account is restricted."); return; }
    if (!canCreateChat) {
      toast.danger(FREE_CHAT_LIMIT_MESSAGE);
      setShowSettings(true);
      return;
    }
    setShowNewChat(true);
  }, [accountRestricted, composerNotice, canCreateChat]);

  const profilesById = useMemo(() => {
    const map: Record<string, Profile> = {};
    if (me) map[me.id] = me;
    for (const c of chats) for (const m of c.members) map[m.id] = m;
    return map;
  }, [chats, me]);
  const [activeFolder, setActiveFolder] = useState<string>("all");
  const [joinLinkOpen, setJoinLinkOpen] = useState(false);
  const [joinLink, setJoinLink] = useState("");

  const openInviteLink = () => {
    const raw = joinLink.trim();
    if (!raw) return;
    const token = raw.split("?")[0].split("#")[0].replace(/\/+$/, "").split("/").pop() || "";
    if (!token) return;
    setJoinLinkOpen(false);
    setJoinLink("");
    navigate({ to: "/invite/$token", params: { token } });
  };


  type CustomFolder = { id: string; name: string };
  const [customFolders, setCustomFolders] = useState<CustomFolder[]>([]);
  const [chatFolderMap, setChatFolderMap] = useState<Record<string, string[]>>({});
  const [assigningFolders, setAssigningFolders] = useState(false);

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
      toast.success(`Folder "${name}" created`);
    } else if (folderModal.id) {
      persistFolders(customFolders.map((f) => (f.id === folderModal.id ? { ...f, name } : f)));
      toast.success("Folder renamed");
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
    toast.success(`Folder "${name}" deleted`);
  };

  const toggleChatInFolder = (chatId: string, folderId: string) => {
    const current = chatFolderMap[chatId] ?? [];
    const next = current.includes(folderId) ? current.filter((f) => f !== folderId) : [...current, folderId];
    persistFolderMap({ ...chatFolderMap, [chatId]: next });
  };

  // Sponsored cards shown between chats. Hidden while searching so results stay clean.
  const listAds = useListAds(!!me);

  const filtered = useMemo(() => chats.filter((c) => {
    if (!me) return true;

    if (activeFolder === "unread" && c.unread === 0) return false;
    if (activeFolder === "groups" && !c.is_group) return false;
    if (activeFolder === "pinned" && !c.isPinned) return false;
    if (activeFolder.startsWith("custom:") && !(chatFolderMap[c.id] ?? []).includes(activeFolder)) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    if (chatTitle(c, me.id).toLowerCase().includes(q)) return true;
    const last = c.lastMessage;
    if (last && !last.is_encrypted && last.kind !== "poll" && last.body) {
      return last.body.toLowerCase().includes(q);
    }
    return false;
  }), [chats, query, me, blockedIds, activeFolder, chatFolderMap]);

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
    if (error) { toast.danger(error.message); return; }
    setScheduledMessages((prev) => prev.filter((m) => m.id !== messageId));
    toast.success("Scheduled message canceled");
  };

  const togglePin = async (e: React.MouseEvent, chat: ChatWithMeta) => {
    e.stopPropagation();
    if (!me) return;
    const next = !chat.isPinned;
    if (next && !me.is_pro) {
      const pinnedCount = chats.filter((c) => c.isPinned).length;
      if (pinnedCount >= FREE_PIN_LIMIT) {
        toast.danger(`Free plan lets you pin ${FREE_PIN_LIMIT} chats. Unpin one, or upgrade to Sona Purple for unlimited pins.`);
        return;
      }
    }
    setChatsRaw((prev) => {
      const updated = prev.map((c) => (c.id === chat.id ? { ...c, isPinned: next } : c));
      updated.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
      return updated;
    });
    const { data, error } = await supabase
      .from("chat_members")
      .update({ is_pinned: next, pinned_at: next ? new Date().toISOString() : null })
      .eq("chat_id", chat.id)
      .eq("user_id", me.id)
      .select("chat_id");
    if (error || !data?.length) {
      toast.danger(error?.message ?? "Couldn't update the pin. Please try again.");
      loadChats();
      return;
    }
    quietToast(next ? "Chat pinned" : "Chat unpinned");
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
      toast.danger(explainSupabaseError(e).title);
    }
  };

  const leaveGroup = async (chatId: string) => {
    if (!me) return;
    if (!(await confirm({ title: "Leave this group?", description: "You'll need to be re-added to rejoin.", confirmText: "Leave", danger: true }))) return;
    await postSystemMessage(chatId, `${me.display_name} left the group`);
    const { error } = await supabase.from("chat_members").delete().eq("chat_id", chatId).eq("user_id", me.id);
    if (error) { toast.danger(explainSupabaseError(error).title); return; }
    toast.success("You left the group");
    setShowMemberList(false);
    if (activeId === chatId) setActiveId(null);
    loadChats();
  };

  const removeMember = async (chatId: string, member: Profile) => {
    const { error } = await supabase.from("chat_members").delete().eq("chat_id", chatId).eq("user_id", member.id);
    if (error) { toast.danger(explainSupabaseError(error).title); return; }
    await postSystemMessage(chatId, `${member.display_name} was removed from the group`);
    toast.success(`Removed ${member.display_name}`);
    loadChats();
  };

  const deleteGroup = async (chatId: string) => {
    if (!(await confirm({ title: "Delete this group for everyone?", description: "This can't be undone.", confirmText: "Delete", danger: true }))) return;
    const { error } = await supabase.from("chats").delete().eq("id", chatId);
    if (error) { toast.danger(explainSupabaseError(error).title); return; }
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
      toast.danger(count === 1 ? "Couldn't delete chat" : "Couldn't delete any of the selected chats");
    } else {
      toast.warning(`Deleted ${count - failed} of ${count} chats — ${failed} failed`);
    }
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedChatIds(new Set());
  };

  const send = async (scheduledFor?: Date) => {
    if (!me || !activeId) return;
    if (composerNotice) { toast.danger(composerNotice); return; }


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
      if (error) { toast.danger(error.message); return; }
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
        toast.danger("This message can't be sent — it looks like it violates community guidelines.");
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
        if (upErr) { toast.danger(`Couldn't upload ${img.name}: ${explainSupabaseError(upErr).title}`); continue; }
        const { data: signed } = await supabase.storage.from("chat-media").createSignedUrl(path, 60 * 60 * 24 * 365);
        outgoing.push({ kind: "image", media_url: signed?.signedUrl ?? null });
      }
      for (const doc of pendingDocs) {
        const path = `${activeId}/${me.id}/${crypto.randomUUID()}-${doc.name}`;
        const { error: upErr } = await supabase.storage.from("chat-media").upload(path, doc, { contentType: doc.type || "application/octet-stream" });
        if (upErr) { toast.danger(`Couldn't upload ${doc.name}: ${explainSupabaseError(upErr).title}`); continue; }
        const { data: signed } = await supabase.storage.from("chat-media").createSignedUrl(path, 60 * 60 * 24 * 365);
        outgoing.push({ kind: "file", media_url: signed?.signedUrl ?? null, file_name: doc.name, file_size: doc.size });
      }
      if (outgoing.length === 0 && plaintext) outgoing.push({ kind: "text" });

      const hadAttachmentsPicked = pendingImages.length > 0 || pendingDocs.length > 0;
      if (outgoing.length === 0 && hadAttachmentsPicked) {
        toast.danger("Couldn't upload — check your connection and try again.");
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

        const tempId = `optimistic:${crypto.randomUUID()}`;
        if (!scheduledFor) {
          setMessages((prev) => [
            ...prev,
            { id: tempId, created_at: new Date().toISOString(), ...payload, _pending: true } as MessageRow,
          ]);
        }

        const { data: inserted, error } = await supabase.from("messages").insert(payload).select().single();
        if (error) {
          toast.danger(isFreeTierLimitError(error) ? FREE_MESSAGE_LIMIT_MESSAGE : error.message);
          if (!scheduledFor) {
            failedPayloadsRef.current[tempId] = payload;
            setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, _pending: false, _failed: true } : m)));
          }
          if (isFreeTierLimitError(error)) { refreshMessagesSentToday(); break; }
          continue;
        }
        anySucceeded = true;
        if (i === 0 && inserted) firstInsertedMessageId = (inserted as MessageRow).id;
        if (!scheduledFor && inserted) {
          setMessages((prev) => {
            const withoutRealtimeDupe = prev.filter((m) => m.id !== (inserted as MessageRow).id);
            return withoutRealtimeDupe.map((m) => (m.id === tempId ? (inserted as MessageRow) : m));
          });
        }
      }
      if (scheduledFor) {
        toast.success(`Message scheduled for ${scheduledFor.toLocaleString()}`);
      } else if (anySucceeded) {
        playSendSound();
        refreshMessagesSentToday();
      }

      if (anySucceeded && !scheduledFor && plaintext && me && sentMessageVerdict?.shouldLog) {
        void logModerationFlag(sentMessageVerdict, activeId, me.id, plaintext, firstInsertedMessageId);
      }

      if (outgoing.length > 0 && !anySucceeded && !scheduledFor) {
        toast.danger("Couldn't send — your message is saved as a draft, try again when you're back online.");
        return;
      }

      const prompt = plaintext;
      const attachedImageUrl = firstAttachedImageUrl;
      const attachedFileUrl = firstAttachedFileUrl;
      const attachedFileName = firstAttachedFileName;
      setDraft(""); setPendingImages([]); setPendingDocs([]); setShowEmoji(false); setReplyTo(null);
      if (activeId) clearDraftFromStorage(activeId);

      if (anySucceeded && !scheduledFor && active && !isAIChat(active)) {
        notifyOfflineMessage({
          data: {
            chatId: activeId,
            senderName: me.display_name || "Someone",
            messageBody: prompt || (attachedImageUrl ? "Sent a photo" : attachedFileUrl ? "Sent a file" : "Sent a message"),
          },
        }).catch(() => {});
      }

      if (!scheduledFor && active && !active.is_hidden) {
        const isAI = isAIChat(active);
        const mentionsSona = /(^|\s)@sona\b/i.test(prompt);
        if ((isAI || mentionsSona) && (prompt || attachedImageUrl || attachedFileUrl)) {
          setSonaTyping(true);
          const sonaPrompt = prompt || (attachedFileUrl ? "What's in this file?" : "What's in this image?");
          // Only weather questions that name no city ask the browser for its
          // location (resolves to null instantly for everything else).
          getCoordsForPrompt(sonaPrompt)
            .then((coords) =>
              askAI({
                data: {
                  chatId: activeId,
                  prompt: sonaPrompt,
                  imageUrl: attachedImageUrl,
                  fileUrl: attachedFileUrl,
                  fileName: attachedFileName,
                  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                  coords,
                },
              }),
            )
            .catch((e) => { toast.danger(e.message); })
            .finally(() => setSonaTyping(false));
        }
      }
    } finally {
      setSending(false);
    }
  };

  const retryMessage = useCallback(async (tempId: string) => {
    const payload = failedPayloadsRef.current[tempId];
    if (!payload) return;
    setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, _failed: false, _pending: true } : m)));
    const { data: inserted, error } = await supabase.from("messages").insert(payload as never).select().single();
    if (error) {
      toast.danger(isFreeTierLimitError(error) ? FREE_MESSAGE_LIMIT_MESSAGE : error.message);
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, _pending: false, _failed: true } : m)));
      return;
    }
    delete failedPayloadsRef.current[tempId];
    setMessages((prev) => {
      const withoutRealtimeDupe = prev.filter((m) => m.id !== (inserted as MessageRow).id);
      return withoutRealtimeDupe.map((m) => (m.id === tempId ? (inserted as MessageRow) : m));
    });
    playSendSound();
    refreshMessagesSentToday();
  }, [refreshMessagesSentToday]);

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
    if (oversized.length) toast.danger(`${oversized.length} image${oversized.length === 1 ? "" : "s"} skipped — over ${formatBytes(orgFileLimits.maxImageBytes)}`);

    setPendingImages((prev) => {
      const combined = [...prev, ...valid];
      if (combined.length > MAX_IMAGES) {
        toast.danger(`Max ${MAX_IMAGES} images at once — extra ones skipped`);
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
    if (wrongType.length) toast.danger(`Unsupported file type: ${wrongType.map((f) => f.name).join(", ")}`);
    if (oversized.length) toast.danger(`${oversized.length} file${oversized.length === 1 ? "" : "s"} skipped — over ${formatBytes(orgFileLimits.maxDocBytes)}`);

    setPendingDocs((prev) => {
      const combined = [...prev, ...valid];
      if (combined.length > MAX_DOCS) {
        toast.danger(`Max ${MAX_DOCS} files at once — extra ones skipped`);
        return combined.slice(0, MAX_DOCS);
      }
      return combined;
    });
  };

  const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
  const onPickVideo = async (file?: File | null) => {
    if (!file || !me || !activeId) return;
    if (!file.type.startsWith("video/")) { toast.danger("Please choose a video file"); return; }
    if (file.size > MAX_VIDEO_BYTES) { toast.danger(`Video is too large — max ${formatBytes(MAX_VIDEO_BYTES)}`); return; }

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
      toast.danger((e as Error).message || "Couldn't upload video");
    } finally {
      setVideoUploadPct(null);
    }
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!me) return;
    const existing = reactions.find((r) => r.message_id === messageId && r.user_id === me.id);
    if (existing && existing.emoji === emoji) {
      await supabase.from("reactions").delete().eq("id", existing.id);
    } else if (existing) {
      await supabase.from("reactions").update({ emoji }).eq("id", existing.id);
    } else {
      await supabase.from("reactions").insert({ message_id: messageId, user_id: me.id, emoji });
    }
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
    if (error) { toast.danger(error.message); return; }
    setMessages((prev) => prev.map((m) => m.id === messageId
      ? { ...m, deleted_at: new Date().toISOString(), body: null, media_url: null, file_name: null, file_size: null, duration_ms: null }
      : m));
    loadChats();
  };

  const hardDeleteMessage = async (messageId: string) => {
    if (!me) return;
    const { error } = await supabase.from("messages").delete().eq("id", messageId).eq("sender_id", me.id);
    if (error) { toast.danger(error.message); return; }
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    loadChats();
  };

  const togglePinMessage = async (m: MessageRow) => {
    if (!me || !active) return;
    const pinning = !m.pinned_by;
    const { error } = await supabase.from("messages")
      .update({ pinned_by: pinning ? me.id : null, pinned_at: pinning ? new Date().toISOString() : null })
      .eq("id", m.id);
    if (error) { toast.danger(error.message); return; }
    setMessages((prev) => prev.map((row) => row.id === m.id
      ? { ...row, pinned_by: pinning ? me.id : null, pinned_at: pinning ? new Date().toISOString() : null }
      : row));
    quietToast(pinning ? "Message pinned" : "Message unpinned");
  };

  const toggleBookmark = async (m: MessageRow) => {
    if (!me) return;
    const bookmarked = bookmarkedIds.has(m.id);
    if (bookmarked) {
      const { error } = await supabase.from("message_bookmarks").delete().eq("user_id", me.id).eq("message_id", m.id);
      if (error) { toast.danger(error.message); return; }
      setBookmarkedIds((prev) => { const next = new Set(prev); next.delete(m.id); return next; });
      setSavedMessages((prev) => prev.filter((row) => row.id !== m.id));
      quietToast("Removed from Saved Messages");
    } else {
      const { error } = await supabase.from("message_bookmarks").insert({ user_id: me.id, message_id: m.id, chat_id: m.chat_id });
      if (error) { toast.danger(error.message); return; }
      setBookmarkedIds((prev) => new Set(prev).add(m.id));
      quietToast("Saved");
    }
  };

  const loadSavedMessages = async () => {
    if (!me) return;
    setLoadingSaved(true);
    const { data, error } = await supabase
      .from("message_bookmarks")
      .select("chat_id, messages:message_id(*)")
      .eq("user_id", me.id)
      .order("created_at", { ascending: false });
    setLoadingSaved(false);
    if (error) { toast.danger(error.message); return; }
    const rows = (data ?? [])
      .map((row) => row.messages ? { ...(row.messages as unknown as MessageRow), chat_id: row.chat_id as string } : null)
      .filter((row): row is MessageRow & { chat_id: string } => !!row);
    setSavedMessages(rows);
  };

  const profileMediaStats = useMemo(() => {
    if (!activeId) return undefined;
    const photos = messages.filter((m) => m.kind === "image" && m.media_url).length;
    const videos = messages.filter((m) => m.kind === "video" && m.media_url).length;
    const files = messages.filter((m) => m.kind === "file" && m.media_url).length;
    const links = messages
      .filter((m) => m.kind === "text" && m.body && URL_REGEX.test(m.body))
      .flatMap((m) => m.body!.match(new RegExp(URL_REGEX.source, "g")) ?? []).length;
    return { photos, videos, files, links };
  }, [messages, activeId]);

  const [selfBookmarksCount, setSelfBookmarksCount] = useState<number | null>(null);
  useEffect(() => {
    if (!me || !viewingProfile || viewingProfile.id !== me.id) return;
    (async () => {
      const { count } = await supabase
        .from("message_bookmarks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", me.id);
      setSelfBookmarksCount(count ?? 0);
    })();
  }, [me, viewingProfile]);

  const toggleSelectMessage = (id: string) => {
    setMsgSelectMode(true);
    setSelectedMsgIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const exitMsgSelectMode = () => { setMsgSelectMode(false); setSelectedMsgIds(new Set()); };

  const selectedMsgs = messages.filter((m) => selectedMsgIds.has(m.id));

  const bulkPin = async () => {
    if (!me || selectedMsgs.length === 0) return;
    const now = new Date().toISOString();
    const { error } = await supabase.from("messages").update({ pinned_by: me.id, pinned_at: now })
      .in("id", Array.from(selectedMsgIds));
    if (error) { toast.danger(error.message); return; }
    setMessages((prev) => prev.map((m) => selectedMsgIds.has(m.id) ? { ...m, pinned_by: me.id, pinned_at: now } : m));
    quietToast(`Pinned ${selectedMsgs.length} message${selectedMsgs.length === 1 ? "" : "s"}`);
    exitMsgSelectMode();
  };

  const bulkBookmark = async () => {
    if (!me || selectedMsgs.length === 0) return;
    const inserts = selectedMsgs.map((m) => ({ user_id: me.id, message_id: m.id, chat_id: m.chat_id }));
    const { error } = await supabase.from("message_bookmarks").upsert(inserts, { onConflict: "user_id,message_id" });
    if (error) { toast.danger(error.message); return; }
    setBookmarkedIds((prev) => { const next = new Set(prev); selectedMsgs.forEach((m) => next.add(m.id)); return next; });
    quietToast(`Saved ${selectedMsgs.length} message${selectedMsgs.length === 1 ? "" : "s"}`);
    exitMsgSelectMode();
  };

  const bulkDelete = async () => {
    if (!me || selectedMsgs.length === 0) return;
    const mine = selectedMsgs.filter((m) => m.sender_id === me.id);
    if (mine.length === 0) { toast.danger("You can only delete your own messages"); return; }
    if (!(await confirm({
      title: `Delete ${mine.length} message${mine.length === 1 ? "" : "s"} for everyone?`,
      confirmText: "Delete", danger: true,
    }))) return;
    const now = new Date().toISOString();
    const { error } = await supabase.from("messages")
      .update({ deleted_at: now, body: null, media_url: null, file_name: null, file_size: null, duration_ms: null })
      .in("id", mine.map((m) => m.id)).eq("sender_id", me.id);
    if (error) { toast.danger(error.message); return; }
    const ids = new Set(mine.map((m) => m.id));
    setMessages((prev) => prev.map((m) => ids.has(m.id)
      ? { ...m, deleted_at: now, body: null, media_url: null, file_name: null, file_size: null, duration_ms: null }
      : m));
    loadChats();
    exitMsgSelectMode();
  };

  const bulkForward = () => {
    if (selectedMsgs.length === 0) return;
    setForwardingMessages(selectedMsgs);
  };

  const blockOther = async () => {
    if (!me || !active) return;
    const other = active.memberIds.find((id) => id !== me.id && id !== SONA_AI_ID);
    if (!other) { toast.danger("Can't block in this chat."); return; }
    const { error } = await supabase.from("blocks").insert({ blocker_id: me.id, blocked_id: other });
    if (error) { toast.danger(error.message); return; }
    setBlockedIds((prev) => new Set(prev).add(other));
    toast.success("User blocked");
    setShowHeaderMenu(false);
  };

  const unblockOther = async () => {
    if (!me || !active) return;
    const other = active.memberIds.find((id) => id !== me.id && id !== SONA_AI_ID);
    if (!other) return;
    const { error } = await supabase.from("blocks").delete().eq("blocker_id", me.id).eq("blocked_id", other);
    if (error) { toast.danger(error.message); return; }
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
      if (error.code === "42P01") {
        toast.danger("Reporting isn't set up yet — the reports table is missing from the database. Ask an admin to run the pending Supabase migrations.");
      } else if (error.code === "42501") {
        toast.danger("You don't have permission to submit a report — check the reports table's row-level security policies.");
      } else {
        toast.danger(error.message);
      }
      return;
    }
    toast.success("Report sent to the Sona team");
    setReportTarget(null);
    setReportDetails("");
  };


  const requirePro = (feature: string): boolean => {
    if (me?.is_pro) return true;
    toast.danger(`${feature} is a Sona Pro feature — upgrade in Settings → Subscription.`);
    setShowHeaderMenu(false);
    setShowSettings(true);
    return false;
  };

  const setDisappearing = async (seconds: number | null) => {
    if (!active) return;
    const { error } = await supabase.from("chats").update({ disappearing_seconds: seconds }).eq("id", active.id);
    if (error) { toast.danger(error.message); return; }
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
    if (error) { toast.danger(error.message); return; }
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
      toast.success(format === "json" ? "Chat exported as JSON" : "Opening print dialog — choose \"Save as PDF\"");
    } catch (e) {
      toast.danger((e as Error).message || "Couldn't export chat");
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
    if (error) { toast.danger(explainSupabaseError(error).title); return; }
    chatClearsRef.current[active.id] = clearedBefore;
    setMessages([]);
    setReactions([]);
    setReads([]);
    setDeliveries([]);
    chatCacheRef.current[active.id] = { messages: [], reactions: [], reads: [], deliveries: [] };
    toast.success("Chat cleared");
    loadChats();
  };

  const runSummary = async () => {
    if (!activeId) return;
    if (!requirePro("AI chat summary")) return;
    setShowHeaderMenu(false);
    setIsSummarized(true) ;
    const summaryPromise = askSummary({ data: { chatId: activeId, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone } }) as Promise<{ summary: string }>;
    toast.promise(summaryPromise, {
      loading: "Summarizing…",
      success: "Summary ready",
      error: (e) => e.message,
    });
    try {
      const r = await summaryPromise;
      setSummary(r.summary);
      setIsSummarized(false) ;
    } catch {
    }
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
  useEffect(() => { setShowMsgSearch(false); setMsgSearchQuery(""); setShowDisappearingMenu(false); setDescOpen(false); setPinnedBannerIndex(0); setMsgSelectMode(false); setSelectedMsgIds(new Set()); closeMessageMenu(); setShowHeaderMenu(false); setChatLongPressMenu(null); setReactingOn(null); setSonaTyping(false); }, [activeId]);


  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      closeMessageMenu();
      setShowHeaderMenu(false);
      setShowDisappearingMenu(false);
      setChatLongPressMenu(null);
      setReactingOn(null);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [closeMessageMenu]);

  
  useEffect(() => {
    const handleSlash = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key !== "/" && e.code !== "Slash") return;
      const el = document.activeElement as HTMLElement | null;
      const alreadyTyping = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (alreadyTyping) return;
      const composer = composerInputRef.current;
      if (!composer) return;
      e.preventDefault();
      setDraft("/");
      composer.focus();
    };
    window.addEventListener("keydown", handleSlash, true);
    return () => window.removeEventListener("keydown", handleSlash, true);
  }, [setDraft]);

  useEffect(() => {
    if (!showMsgSearch || msgSearchMatches.length === 0) return;
    const target = msgSearchMatches[Math.min(msgSearchIndex, msgSearchMatches.length - 1)];
    const el = target && msgRefs.current.get(target.id);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [msgSearchIndex, msgSearchMatches, showMsgSearch]);

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

  
  const openMessageInChat = (chatId: string, messageId: string) => {
    setActiveId(chatId);
    setPendingJumpId(messageId);
    setShowSavedMessages(false);
    setShowSidebarMobile(false);
  };
  useEffect(() => {
    if (!pendingJumpId) return;
    if (!messages.some((m) => m.id === pendingJumpId)) return;
    const id = pendingJumpId;
    setPendingJumpId(null);
    requestAnimationFrame(() => jumpToMessage(id));
  }, [messages, pendingJumpId]);

    
  if (!me) {
    return(
    
            <StatusPageLoader/>
    );
  }

  
  return (
    <div
      className="h-dvh w-full bg-[#F0EBE3] text-[#2D3436] dark:bg-[#1A1A1A] hide-scrollbar dark:text-[#E8E8E8]"
      style={sonaTheme.style}
    >
<NetworkStatusFooter />
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
        
        <div className="flex h-full w-full overflow-hidden rounded-none bg-white shadow-2xl md:rounded-3xl md:border border-[var(--sona-accent,#E07A5F)]/20 dark:bg-[#242424] dark:border-[var(--sona-accent,#E07A5F)]/10">
          <aside className={`${showSidebarMobile ? "flex" : "hidden"} relative h-full w-full flex-col border-r border-[var(--sona-accent,#E07A5F)]/10 bg-[#FFFDF9] dark:bg-[#1E1E1E] dark:text-[#E8E8E8] md:flex md:w-[32%] md:min-w-[300px] md:max-w-[420px]`}>
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
<div className="flex items-center gap-1 dark:text-white text-gray-600 shrink-0 rounded-md px-1 py-1">
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
  <div className="w-px h-6 bg-slate-300 dark:bg-slate-600" />


<DropdownMenu open={showHeaderMenu} onOpenChange={handleHeaderMenuOpenChange}>
  <DropdownMenuTrigger asChild>
    <button
      data-tour="settings-btn"
      onClick={() => { if (!showHeaderMenu) closeMessageMenu(); }}
      className={`grid h-9 w-9 place-items-center rounded-full transition-colors ${
        showHeaderMenu ? "bg-white/20" : "hover:bg-white/20"
      } text-gray-600 dark:text-white`}
      aria-label="More options"
      aria-expanded={showHeaderMenu}
    >
      <MoreVertical className="h-5 w-5" />
    </button>
  </DropdownMenuTrigger>
  
  <DropdownMenuContent align="end" className="w-56">
    {headerMenuView === "root" && (
      <>
        <DropdownMenuItem onClick={() => { setShowSavedMessages(true); setShowHeaderMenu(false); loadSavedMessages(); }}>
          Saved Messages
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => { setShowSettings(true); setShowHeaderMenu(false); }}>
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            setHeaderMenuView("more");
          }}
          className="flex items-center justify-between"
        >
          More
          <IoMdArrowDropright />
        </DropdownMenuItem>
      </>
    )}

    {headerMenuView === "more" && (
      <>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            setHeaderMenuView("root");
          }}
          className="flex items-center gap-2 text-[#8C8C8C]"
        >
          <IoMdArrowDropleft />
          Back
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        
        {canInstall && (
          <DropdownMenuItem onClick={() => { promptInstall(); setShowHeaderMenu(false); }}>
            Install app
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => { toggle(); setShowHeaderMenu(false); }}>
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </DropdownMenuItem>
        
        <DropdownMenuItem asChild>
          <Link to="/learn" onClick={() => setShowHeaderMenu(false)}>
            Manual for Sona
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/blog" onClick={() => setShowHeaderMenu(false)}>
            Blog
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/help" onClick={() => setShowHeaderMenu(false)}>
            Help Center
          </Link>
        </DropdownMenuItem>
        
        <AdminLink onNavigate={() => setShowHeaderMenu(false)} />
        
        <DropdownMenuItem onClick={() => { setShowTour(true); setShowHeaderMenu(false); }}>
          Replay tour
        </DropdownMenuItem>
      </>
    )}
  </DropdownMenuContent>
</DropdownMenu>
</div>
            </div>

            {selectMode && (
              <div className="flex items-center justify-between gap-2 px-4 py-2 bg-[transparent] border-b border-[var(--sona-accent,#E07A5F)]/10">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--sona-accent,#E07A5F)]">
                  <CheckSquare className="h-4 w-4" />
                  {selectedChatIds.size} selected
                </div>
                <div className="flex items-center gap-3">
                  {  loadingChats ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 py-2">
                  <Loader2 className="h-3 w-3 animate-spin text-[var(--sona-accent,#E07A5F)]" />
                  
                </div>) :(<>
                  <button onClick={() => setAssigningFolders(true)} disabled={selectedChatIds.size === 0}
                    className="flex items-center gap-1 rounded bg-[var(--sona-accent,#E07A5F)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 hover:bg-[#c96548] transition">
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
              <div className="flex items-center gap-2 rounded-full bg-[transparent] dark:bg-[#2A2A2A]/5 px-4 py-3 border border-[var(--sona-accent,#E07A5F)]/5">
                <Search className="h-8 w-8 text-[#8C8C8C]" />
                <input data-tour="search-chats" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ask Sona AI or Search"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-[#8C8C8C] text-[#2D3436] dark:text-[#E8E8E8]" />
              </div>
            </div>

            {announcement && !announcementDismissed && (
              <div className="mx-3 mb-3 flex items-start gap-2 rounded-2xl bg-[var(--sona-accent,#E07A5F)]/10 border border-[var(--sona-accent,#E07A5F)]/20 px-3.5 py-2.5">
                <Megaphone className="h-4 w-4 shrink-0 mt-0.5 text-[var(--sona-accent,#E07A5F)]" />
                <p className="flex-1 text-xs leading-snug text-[#2D3436] dark:text-[#E8E8E8]">{announcement.message}</p>
                <button
                  onClick={() => setAnnouncementDismissed(true)}
                  aria-label="Dismiss announcement"
                  className="shrink-0 grid h-5 w-5 place-items-center rounded-full hover:bg-[var(--sona-accent,#E07A5F)]/15 text-[#8C8C8C]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <div data-tour="folder-tabs" className="flex items-center gap-2 overflow-x-auto px-4 pb-6 scrollbar-thin scrollbar-hiding">
               
  {([
    { key: "all", label: "All" },
    { key: "unread", label: `Unread ${unreadFolderCount ? unreadFolderCount : ""}` },
    { key: "groups", label: `Groups ${groupsFolderCount ? groupsFolderCount : ""}` },
    { key: "pinned", label: `Favorites ${favoritesFolderCount ? favoritesFolderCount : ""}` },
  ] as const).map((f) => {
    const isActive = activeFolder === f.key;
    return (
      <button
        key={f.key}
        onClick={() => setActiveFolder(f.key)}
        className={`
          group relative h-8 shrink-0 flex items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-all duration-200 ease-out
          ${isActive 
            ? "bg-[var(--sona-accent,#E07A5F)]/80 text-white shadow-md shadow-[var(--sona-accent,#E07A5F)]/20 hover:brightness-105 active:scale-[0.97]" 
            : "bg-transparent text-[#5A6062] hover:bg-[#EBE5DC] hover:text-[#2D3436] dark:bg-white/[0.04] dark:text-zinc-400 dark:hover:bg-white/[0.08] dark:hover:text-zinc-200 border border-gray-300 border-1 dark:border-white/5"
          }
          ${!me.is_pro && !isActive ? "opacity-75 hover:opacity-100" : ""}
        `}
      >
        {f.label}
      </button>
    );
  })}

  {customFolders.map((f) => {
    const isActive = activeFolder === f.id;
    return (
      <button
        key={f.id}
        onClick={() => setActiveFolder(f.id)}
        onDoubleClick={() => openRenameFolderModal(f.id, f.name)}
        onContextMenu={(e) => {
          e.preventDefault();
          openRenameFolderModal(f.id, f.name);
        }}
        title="Tap to filter · double-tap or right-click to rename"
        className={`
          group relative h-8 shrink-0 flex items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-all duration-200 ease-out
          ${isActive 
            ? "bg-[var(--sona-accent,#E07A5F)]/80 text-white shadow-md shadow-[var(--sona-accent,#E07A5F)]/20 hover:brightness-105 active:scale-[0.97]" 
            : "bg-transparent text-[#5A6062] hover:bg-[#EBE5DC] hover:text-[#2D3436] dark:bg-white/[0.04] dark:text-zinc-400 dark:hover:bg-white/[0.08] dark:hover:text-zinc-200 border border-gray-300 border-1 dark:border-white/5"
          }
          ${!me.is_pro && !isActive ? "opacity-75 hover:opacity-100" : ""}
        `}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`h-3.5 w-3.5 transition-colors ${isActive ? "text-white/90" : "text-[#8C8C8C] dark:text-zinc-500"}`}>
          <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
        </svg>
        <span className="max-w-[100px] truncate sm:max-w-[150px]">{f.name}</span>
      </button>
    );
  })}

  <div className="flex items-center gap-2 pl-2 border-l border-[#E0D8CC] dark:border-white/10 ml-1">
    <button
      onClick={openCreateFolderModal}
      title="Create a custom folder"
      aria-label="Create a custom folder"
      className="group flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F5F0E8] text-[#5A6062] transition-all duration-200 hover:bg-[#EBE5DC] hover:text-[var(--sona-accent,#E07A5F)] active:scale-95 dark:bg-white/[0.04] dark:text-zinc-400 dark:hover:bg-white/[0.08] dark:hover:text-[var(--sona-accent,#E07A5F)] border border-transparent dark:border-white/5"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    </button>

    <button
      onClick={() => setJoinLinkOpen((v) => !v)}
      title="Join a group with an invite link"
      aria-label="Join a group with an invite link"
      aria-expanded={joinLinkOpen}
      className={`group flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-200 active:scale-95 border border-transparent dark:border-white/5 ${
        joinLinkOpen
          ? "bg-[var(--sona-accent,#E07A5F)]/10 text-[var(--sona-accent,#E07A5F)] shadow-inner"
          : "bg-[#F5F0E8] text-[#5A6062] hover:bg-[#EBE5DC] hover:text-[var(--sona-accent,#E07A5F)] dark:bg-white/[0.04] dark:text-zinc-400 dark:hover:bg-white/[0.08]"
      }`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
      </svg>
    </button>
  </div>
</div>

{joinLinkOpen && (
  <div className="flex items-center gap-2.5 px-3 pb-3 pt-1 transition-all duration-200 ease-out">
    <div className="relative min-w-0 flex-1 group">
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8C8C8C] group-focus-within:text-[var(--sona-accent,#E07A5F)] transition-colors duration-200 pointer-events-none"
      >
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
      </svg>

      <input
        autoFocus
        value={joinLink}
        onChange={(e) => setJoinLink(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") openInviteLink();
          if (e.key === "Escape") setJoinLinkOpen(false);
        }}
        placeholder="Paste an invite link"
        aria-label="Invite link"
        className="w-full h-9 rounded-full bg-[#F5F0E8] border border-black/5 pl-10 pr-4 text-xs font-medium text-[#2D3436] shadow-[inset_0_2px_4px_0_rgba(0,0,0,0.04)] outline-none transition-all duration-200 placeholder:text-[#8C8C8C]/70 focus:bg-white focus:border-[var(--sona-accent,#E07A5F)]/30 focus:ring-4 focus:ring-[var(--sona-accent,#E07A5F)]/10 dark:bg-[#1A1A1A] dark:border-white/10 dark:text-[#E8E8E8] dark:shadow-[inset_0_2px_4px_0_rgba(0,0,0,0.6)] dark:focus:bg-[#222] dark:focus:border-[var(--sona-accent,#E07A5F)]/40 dark:focus:ring-[var(--sona-accent,#E07A5F)]/20"
      />
    </div>

    <button
      onClick={openInviteLink}
      disabled={!joinLink.trim()}
      className="shrink-0 flex items-center gap-1.5 h-9 rounded-full bg-[var(--sona-accent,#E07A5F)] px-4 text-xs font-semibold text-white shadow-md shadow-[var(--sona-accent,#E07A5F)]/20 transition-all duration-200 hover:shadow-lg hover:shadow-[var(--sona-accent,#E07A5F)]/30 hover:brightness-110 active:scale-[0.97] active:shadow-sm disabled:opacity-40 disabled:shadow-none disabled:hover:brightness-100 disabled:active:scale-100 dark:shadow-black/40"
    >
      Open
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2.5" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className="h-3.5 w-3.5"
      >
        <line x1="5" y1="12" x2="19" y2="12"></line>
        <polyline points="12 5 19 12 12 19"></polyline>
      </svg>
    </button>
  </div>
)}
            
            {me && (
  <div data-tour="status-bar" className="absolute bottom-6 left-6 z-30">
    <button
      title="Status & Update news"
      onClick={() => navigate({ to: "/status", search: { user: undefined } })}
      className="group relative flex h-[60px] w-[60px] items-center justify-center rounded-2xl
        bg-white/30 dark:bg-zinc-800/40
        backdrop-blur-xl
        border border-white/40 dark:border-white/10
        shadow-[0_8px_16px_-4px_rgba(224,122,95,0.15),0_4px_6px_-2px_rgba(0,0,0,0.05)]
        dark:shadow-[0_8px_16px_-4px_rgba(0,0,0,0.4)]
        before:absolute before:inset-0 before:rounded-2xl before:bg-gradient-to-b before:from-white/40 before:to-transparent dark:before:from-white/10 dark:before:to-transparent
        transition-all duration-300 ease-out
        hover:-translate-y-1
        hover:shadow-[0_12px_24px_-4px_rgba(224,122,95,0.25)]
        dark:hover:shadow-[0_12px_24px_-4px_rgba(0,0,0,0.5)]
        active:translate-y-0.5 active:scale-95 active:shadow-inner"
    >
      <span className="absolute inset-0 rounded-2xl bg-[#E07A5F]/10 blur-md opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      
      <LuCircleFadingPlus className="relative z-10 h-7 w-7 text-[#E07A5F] transition-transform duration-300 drop-shadow-[0_2px_4px_rgba(224,122,95,0.3)] group-hover:scale-110 group-hover:rotate-12 dark:text-[#F4A261]" />
    </button>
  </div>
)}


            <div className="scrollbar-hiding flex-1 overflow-y-auto pb-24">
             {query.trim() && (
               <button
                 onClick={askSonaAIFromSearch}
                 className="mx-3 mb-2 flex w-[calc(100%-1.5rem)] items-center gap-3 rounded-2xl bg-gradient-to-r from-[var(--sona-accent,#E07A5F)]/10 to-[#F4A261]/10 border border-[var(--sona-accent,#E07A5F)]/20 px-4 py-3 text-left transition hover:from-[var(--sona-accent,#E07A5F)]/15 hover:to-[#F4A261]/15"
               >
                 <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[var(--sona-accent,#E07A5F)] to-[#F4A261] text-white">
                   <Sparkles className="h-4.5 w-4.5" />
                 </div>
                 <div className="min-w-0 flex-1">
                   <div className="text-sm font-semibold text-[#2D3436] dark:text-[#E8E8E8]">Ask Sona AI</div>
                   <div className="truncate text-xs text-[#8C8C8C]">“{query.trim()}”</div>
                 </div>
               </button>
             )}
             <AnimatePresence initial={false}>
             {(filtered.flatMap((c, chatIndex) => {
      const title = chatTitle(c, c.memberIds.includes(me.id) ? me.id : "");
      const last = c.lastMessage;
      const mine = last?.sender_id === me.id;
      const isActive = c.id === activeId;
      const ai = isAIChat(c);
      const isSelected = selectedChatIds.has(c.id);
      const otherIsBusiness = !c.is_group && !ai
        && profiles[c.memberIds.find((id) => id !== me.id) ?? ""]?.is_business;
      const adSlot = !query.trim() && !selectMode && listAds.length > 0 ? adSlotAfter(chatIndex, filtered.length) : null;
      const adToShow = adSlot === null ? null : listAds[adSlot % listAds.length];
      return [
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
            if (selectMode) return;
            closeMessageMenu();
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
                    <MdVerified
                      className="h-[15px] w-[15px] shrink-0 dark:text-white text-[#202124] "
                      aria-label="Verified Sona AI"
                      title="Verified Sona AI premium "
                    />
                  )}
                  
                </span>
                {c.is_group && c.category && c.category !== "general" && (
                  <span className="shrink-0 text-[var(--sona-accent,#E07A5F)]" title={categoryMeta[c.category].label}>
                    <CategoryIcon category={c.category} />
                  </span>
                )}
                {c.isPinned && (
                  <Pin className="h-3 w-3 shrink-0 fill-[#8C8C8C] text-[#8C8C8C]" />
                )}
              </span>
              <div className="flex shrink-0 flex-col items-end gap-1">
      
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
                      <span className="inline-flex items-center gap-1 truncate text-[var(--sona-accent,#E07A5F)]">
                        <IoMdMic className="h-3.5 w-3.5 shrink-0 animate-pulse" /> recording audio…
                      </span>
                    );
                  }
                  if (act?.typing.length) {
                    return <span className="truncate animate-pulse text-[var(--sona-accent,#E07A5F)]">typing…</span>;
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
              {c.is_hidden && <Lock className="h-3 w-3 text-[var(--sona-accent,#E07A5F)]/5 shrink-0" />}
            </div>
          </div>
        </motion.div>,
        ...(adToShow ? [<ChatListAd key={`ad-${adToShow.id}-${chatIndex}`} ad={adToShow} />] : []),
      ];
    })
  )}
  {!loadingChats && filtered.length === 0 && ( <div className="-mb-2">
        <EmptyChatState onStartChat={openNewChat} />
      </div>)} 
               </AnimatePresence>
</div>

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
                      className="fixed z-50 overflow-hidden rounded-xl border border-[var(--sona-accent,#E07A5F)]/10 bg-white dark:bg-[#2A2A2A] py-1.5 shadow-2xl"
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
<button
  data-tour="new-chat-fab"
  onClick={() => {
    if (accountRestricted) { toast.danger(composerNotice ?? "Your account is restricted."); return; }
    setShowNewChat(true);
  }}
  aria-label="New chat"
  className="group absolute bottom-6 right-6 z-30 flex h-[60px] w-[60px] items-center justify-center rounded-2xl
    bg-white/30 dark:bg-zinc-800/40
    backdrop-blur-xl
    border border-white/40 dark:border-white/10
    shadow-[0_8px_16px_-4px_rgba(224,122,95,0.15),0_4px_6px_-2px_rgba(0,0,0,0.05)]
    dark:shadow-[0_8px_16px_-4px_rgba(0,0,0,0.4)]
    before:absolute before:inset-0 before:rounded-2xl before:bg-gradient-to-b before:from-white/40 before:to-transparent dark:before:from-white/10 dark:before:to-transparent
    transition-all duration-300 ease-out
    hover:-translate-y-1
    hover:shadow-[0_12px_24px_-4px_rgba(224,122,95,0.25)]
    dark:hover:shadow-[0_12px_24px_-4px_rgba(0,0,0,0.5)]
    active:translate-y-0.5 active:scale-95 active:shadow-inner"
>
  <span className="absolute inset-0 rounded-2xl bg-[#E07A5F]/10 blur-md opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
  
  <BiSolidMessageSquareAdd className="relative z-10 h-8 w-8 text-zinc-800 dark:text-white rotate-90 drop-shadow-[0_2px_4px_rgba(224,122,95,0.3)] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[100deg] group-active:scale-90" />
</button>
          </aside>

          <section className={`${showSidebarMobile ? "hidden" : "flex"} relative h-full min-w-0 flex-1 flex-col md:flex bg-[#F0EBE3] dark:bg-[#1A1A1A]`}>
            {active ? (
              <>
                <header className="relative z-10 flex items-center gap-3 border-b border-zinc-200/60 bg-white/80 px-2 py-3 backdrop-blur-xl dark:border-zinc-800/60 dark:bg-[#0F0F11]/80 md:px-5">
  <button onClick={closeActiveChat} className="group grid h-10 w-10 place-items-center rounded-full border border-zinc-200/60 bg-white/50 text-zinc-600 transition-all hover:border-zinc-300 hover:bg-white hover:shadow-md dark:border-zinc-800/60 dark:bg-zinc-900/50 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-900 md:hidden" aria-label="Back">
    <RiArrowLeftWideFill className="h-5 w-5 transition-transform group-hover:-translate-x-0.5" />
  </button>

  <button
    onClick={() => {
      if (active.is_group) { setShowMemberList(true); return; }
      const otherId = active.memberIds.find((id) => id !== me.id);
      const other = otherId ? profilesById[otherId] : undefined;
      // Resolve back to the real registered profile — profilesById can
      // carry a nickname overlay (see the `profiles`/`chats` memos above),
      // but the profile page itself must always show the account's actual
      // registered name, never the viewer's private rename for them.
      if (other) setViewingProfile((otherId && profilesRaw[otherId]) || other);
    }}
    className="group relative shrink-0 transition-transform hover:scale-105"
  >
    <div className="rounded-full ring-2 ring-zinc-200/60 dark:ring-zinc-800/60">
      <Avatar url={chatAvatarUrl(active, me.id)} name={chatTitle(active, me.id)} ai={isAIChat(active)} />
    </div>
    {!!active.disappearing_seconds && (
      <div
        className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-white shadow-sm ring-2 ring-white dark:bg-zinc-900 dark:ring-zinc-900"
        title={`Disappearing messages: ${disappearingLabel(active.disappearing_seconds)}`}
      >
        <CiTimer className="h-3 w-3 text-[#E07A5F]" />
      </div>
    )}
  </button>

  <div className="min-w-0 flex-1">
    <button
      onClick={() => active.is_group && setShowMemberList(true)}
      className="group flex w-full items-center gap-2 text-left"
    >
      <h2 className="truncate text-base font-bold tracking-tight text-zinc-900 dark:text-white">
        {(() => {
          const title = chatTitle(active, me.id);
          const otherId = active.memberIds.find((id) => id !== me.id);
          const otherIsBusiness = !active.is_group && !isAIChat(active)
            && otherId && profilesById[otherId]?.is_business;
          return (
            <span className="flex items-center gap-1.5">
              {title}
              {isAIChat(active) && (
                <MdVerified className="h-4 w-4 shrink-0 dark:text-white text-[#202124] drop-shadow-[0_1px_2px_rgba(59,130,246,0.3)]" />
              )}
              {otherIsBusiness && (
                <MdVerified
                  className="h-4 w-4 shrink-0 text-amber-500 drop-shadow-[0_1px_2px_rgba(217,160,23,0.3)]"
                  aria-label="Verified Business"
                  title="Verified Business"
                />
              )}
              {active.is_hidden && (
                <Lock className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
              )}
            </span>
          );
        })()}
      </h2>
      {active.memberRoles[me.id] === "admin" && active.is_group && (
        <span title="Admin" className="inline-flex"><BadgeCheck className="h-4 w-4 text-blue-500 drop-shadow-[0_1px_2px_rgba(59,130,246,0.3)]" /></span>
      )}
      {active.is_group && active.category && active.category !== "general" && (
        <span className="inline-flex items-center rounded-full bg-[#E07A5F]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#E07A5F] ring-1 ring-inset ring-[#E07A5F]/20">
          {categoryMeta[active.category].label}
        </span>
      )}
    </button>
    
    <button
      onClick={() => active.is_group && setShowMemberList(true)}
      className="mt-0.5 flex w-full items-center gap-1.5 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400"
    >
      {recordingNames.length > 0 ? (
        <span className="inline-flex items-center gap-1.5 text-[#E07A5F]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#E07A5F] opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#E07A5F]"></span>
          </span>
          {recordingNames.join(", ")} recording audio…
        </span>
      ) : typingNames.length > 0 ? (
        <span className="inline-flex items-center gap-1.5 text-[#E07A5F]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#E07A5F] opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#E07A5F]"></span>
          </span>
          {typingNames.join(", ")} typing…
        </span>
      ) : isAIChat(active) ? (
        <span className="inline-flex items-center gap-1.5">
          By SumStack
        </span>
      ) : active.is_group ? (() => {
        const onlineCount = active.members.filter((m) => onlineIds.has(m.id)).length;
        return (
          <div className="flex w-full items-center gap-2 overflow-hidden">
            {onlineCount > 0 && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                
                {onlineCount} Online
              </span>
            )}
            <div className="relative flex-1 overflow-hidden">
              <div className="whitespace-nowrap animate-marquee flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
                <span className="mx-2">{active.members.map((m) => m.display_name).join(", ")}</span>
                <span className="opacity-50">•</span>
                <span className="mx-2">{active.members.map((m) => m.display_name).join(", ")}</span>
              </div>
            </div>
          </div>
        );
      })() : (() => {
        const otherId = active.memberIds.find((id) => id !== me.id);
        const other = otherId ? profilesById[otherId] : undefined;
        const online = otherId ? onlineIds.has(otherId) : false;
      const otherIsBusiness = !active.is_group && !isAIChat(active)
            && otherId && profilesById[otherId]?.is_business;
      
        if (online) {
          return (
            <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></span>
              Online
            </span>
          );
        }
        if (other?.last_seen) {
          return (
            <span className="inline-flex items-center gap-1.5 min-w-0">
            
              <span className="text-rotate duration-[8s] min-w-0 max-w-full">
                <span className="justify-items-center">
                  <span className="truncate">{fmtLastSeen(other.last_seen)}</span>
                  <span className="inline-flex items-center gap-1 font-semibold italic truncate">
                    {other.display_name}
                    {other.is_pro && (
                      <MdVerified className="h-3.5 w-3.5 shrink-0 text-blue-500" aria-label="Pro" title="Pro" />
                    )}
                    {otherIsBusiness && <span className="text-[#202124] dark:text-blue-600 " > • Business account </span>} 
                  </span>
                </span>
              </span>
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1.5 text-zinc-400 dark:text-zinc-600">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700"></span>
            Offline
          </span>
        );
      })()}
    </button>
  </div>

  <div className="flex items-center gap-1.5 shrink-0">
    {!isAIChat(active) && (
      <>
        <button onClick={() => startCall("voice")} className="group grid h-10 w-10 place-items-center rounded-full border border-zinc-200/60 bg-white/50 text-zinc-600 transition-all hover:border-zinc-300 hover:bg-white hover:shadow-md hover:text-[#E07A5F] dark:border-zinc-800/60 dark:bg-zinc-900/50 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-[#E07A5F]" aria-label="Voice call">
          <Phone className="h-[18px] w-[18px] transition-transform group-hover:scale-110" />
        </button>
        <button onClick={() => startCall("video")} className="group grid h-10 w-10 place-items-center rounded-full border border-zinc-200/60 bg-white/50 text-zinc-600 transition-all hover:border-zinc-300 hover:bg-white hover:shadow-md hover:text-[#E07A5F] dark:border-zinc-800/60 dark:bg-zinc-900/50 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-[#E07A5F]" aria-label="Video call">
          <Video className="h-[18px] w-[18px] transition-transform group-hover:scale-110" />
        </button>
      </>
    )}
    <DropdownMenu open={menuOpen} onOpenChange={handleMenuOpenChange}>
      <DropdownMenuTrigger asChild>
        <button className="group grid h-10 w-10 place-items-center rounded-full border border-zinc-200/60 bg-white/50 text-zinc-600 transition-all hover:border-zinc-300 hover:bg-white hover:shadow-md dark:border-zinc-800/60 dark:bg-zinc-900/50 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-900" aria-label="Menu">
          <MoreVertical className="h-[18px] w-[18px] transition-transform group-hover:rotate-90" />
        </button>
      </DropdownMenuTrigger>
                
      

        

  <DropdownMenuContent align="end" className="w-64">
    {menuView === "root" && (
      <>
        <DropdownMenuItem
          onClick={() => {
            setShowMsgSearch((s) => !s);
            setMenuOpen(false);
          }}
        >
          Search
        </DropdownMenuItem>

        {!isAIChat(active) && (
          <DropdownMenuItem
            disabled={isSummarized}
            onClick={() => {
              setMenuOpen(false);
              void runSummary();
            }}
          >
            {isSummarized ? "Summarizing…" : "Summarize"}
          </DropdownMenuItem>
        )}

        <DropdownMenuItem
          onClick={() => {
            setShowMediaGallery(true);
            setMenuOpen(false);
          }}
        >
          Media, links, and docs
        </DropdownMenuItem>

        {!isAIChat(active) && (
          <DropdownMenuItem
            onClick={() => {
              setMenuOpen(false);
              void openScheduledList();
            }}
          >
            Scheduled messages
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            setMenuView("more");
          }}
          className="flex items-center justify-between"
        >
          More
          <IoMdArrowDropright />
        </DropdownMenuItem>
      </>
    )}

    {menuView === "more" && (
      <>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            setMenuView("root");
          }}
          className="flex items-center gap-2 text-[#8C8C8C]"
        >
          <IoMdArrowDropleft />
          Back
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {!isAIChat(active) && (
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setMenuView("disappearing");
            }}
          >
            Disappearing messages
            {active.disappearing_seconds
              ? ` · ${disappearingLabel(active.disappearing_seconds)}`
              : ""}
          </DropdownMenuItem>
        )}

        {!isAIChat(active) && (
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setMenuView("export");
            }}
          >
            Export chat
          </DropdownMenuItem>
        )}

        <DropdownMenuItem
          onClick={() => {
            setMenuOpen(false);
            void clearChat();
          }}
        >
          Clear chat
        </DropdownMenuItem>

        {!isAIChat(active) && (
          <DropdownMenuItem
            onClick={() => {
              setMenuOpen(false);
              void toggleHideChat();
            }}
          >
            {active.is_hidden ? "Unhide chat" : "Hide & encrypt"}
          </DropdownMenuItem>
        )}

        {active.is_hidden && isUnlocked(active.id) && (
          <DropdownMenuItem
            onClick={() => {
              setMenuOpen(false);
              relock();
            }}
          >
            Lock chat
          </DropdownMenuItem>
        )}

        {!isAIChat(active) && !active.is_group && activeOtherId && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                const other = profilesById[activeOtherId];
                if (other) setReportTarget(other);
                setMenuOpen(false);
              }}
            >
              Report
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setMenuOpen(false);
                void (iBlockedThem ? unblockOther() : blockOther());
              }}
              className="text-red-500 focus:text-red-500"
            >
              {iBlockedThem ? "Unblock" : "Block"}
            </DropdownMenuItem>
          </>
        )}
      </>
    )}

    {menuView === "disappearing" && (
      <>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            setMenuView("more");
          }}
          className="text-[#8C8C8C] gap-3 flex"
        >
          <IoMdArrowDropleft /> Back
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {DISAPPEARING_OPTIONS.map((opt) => {
          const selected =
            (active?.disappearing_seconds ?? null) === (opt.seconds ?? null);
          return (
            <DropdownMenuItem
              key={opt.label}
              onClick={() => {
                setMenuOpen(false);
                void setDisappearing(opt.seconds);
              }}
              className="flex items-center justify-between"
            >
              {opt.label}
              {selected && <Check className="h-4 w-4 text-[var(--sona-accent,#E07A5F)]" />}
            </DropdownMenuItem>
          );
        })}
      </>
    )}

    {menuView === "export" && (
      <>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            setMenuView("more");
          }}
          className="text-[#8C8C8C] flex gap-2"
        >
          <IoMdArrowDropleft /> Back
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => {
            setMenuOpen(false);
            exportChat("json");
          }}
        >
          Export as JSON
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => {
            setMenuOpen(false);
            exportChat("pdf");
          }}
        >
          Export as PDF
        </DropdownMenuItem>
      </>
    )}
  </DropdownMenuContent>
</DropdownMenu>
                  
                </div>
                </header>

                {active.is_group && active.description && (
                  <div className="border-b border-[var(--sona-accent,#E07A5F)]/10 bg-[#FFFDF9] dark:bg-[#1E1E1E]">
                    <button
                      onClick={() => setDescOpen((v) => !v)}
                      className="flex w-full items-center gap-1.5 px-4 py-2 text-xs font-medium text-[#8C8C8C] hover:text-[var(--sona-accent,#E07A5F)] transition"
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

                {(() => {
                  const pinned = messages.filter((m) => m.pinned_by).sort((a, b) => (b.pinned_at ?? "").localeCompare(a.pinned_at ?? ""));
                  if (pinned.length === 0) return null;
                  const current = pinned[Math.min(pinnedBannerIndex, pinned.length - 1)];
                  return (
                    <div className="flex items-center gap-2 border-b border-[var(--sona-accent,#E07A5F)]/10 bg-[var(--sona-accent,#E07A5F)]/5 px-4 py-2">
                      <Pin className="h-4 w-4 shrink-0 text-[var(--sona-accent,#E07A5F)]" />
                      <button
                        onClick={() => jumpToMessage(current.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="text-[11px] font-semibold text-[var(--sona-accent,#E07A5F)]">
                          {pinned.length > 1 ? `Pinned message ${pinnedBannerIndex + 1}/${pinned.length}` : "Pinned message"}
                        </div>
                        <div className="truncate text-xs text-[#2D3436] dark:text-[#E8E8E8]">
                          <MessagePreview msg={current} decrypted={decrypted} />
                        </div>
                      </button>
                      {pinned.length > 1 && (
                        <button
                          onClick={() => setPinnedBannerIndex((i) => (i + 1) % pinned.length)}
                          className="grid h-7 w-7 shrink-0 place-items-center rounded-full hover:bg-[var(--sona-accent,#E07A5F)]/10"
                          aria-label="Next pinned message"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => togglePinMessage(current)}
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-full hover:bg-[var(--sona-accent,#E07A5F)]/10"
                        aria-label="Unpin message"
                        title="Unpin"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })()}

                {showMsgSearch && (
                  <div className="flex items-center gap-2 border-b border-[var(--sona-accent,#E07A5F)]/10 bg-[#FFFDF9] dark:bg-[#1E1E1E] px-4 py-2">
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

                <div ref={scrollRef} onScroll={handleListScroll} className="scrollbar-thin flex-1 overflow-y-auto px-3 py-4 md:px-8 chat-pattern">
                  <div ref={contentRef} className="mx-auto flex max-w-3xl flex-col gap-0.5">
                    <div className="mx-auto rounded-full bg-[#F4A261]/20 px-4 py-1.5 text-[11px] text-[#8C8C8C] backdrop-blur mb-3 border border-[var(--sona-accent,#E07A5F)]/10">
                      {isAIChat(active) ? "Chat with Sona" : "Type @sona to summon the Sona AI"}
                    </div>
                    {isAIChat(active) && messages.length === 0 && (
                      <SonaAIGreeting
                        name={me?.display_name?.split(" ")[0]}
                        onSuggestion={(s) => setDraft(s)}
                      />
                    )}

                    
                 <AnimatePresence initial={false}>
                      {messages.map((m, idx) => {
                        const prev = messages[idx - 1];
                        const groupWithPrev = prev && prev.sender_id === m.sender_id && new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 60_000;
                        const showDateSeparator = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();

                        const overrideBody = m.is_encrypted ? (decrypted[m.id] ?? "Locked message — unlock this chat to read") : undefined;
                        const parentMsg = m.reply_to_id ? messages.find((x) => x.id === m.reply_to_id) : undefined;
                        const parentBody = parentMsg ? <MessagePreview msg={parentMsg} decrypted={decrypted} /> : undefined;
                        const parentName = parentMsg ? (parentMsg.sender_id === me.id ? "You" : (profiles[parentMsg.sender_id]?.display_name ?? "…")) : undefined;

                        const isCurrentMatch = showMsgSearch && msgSearchMatches[msgSearchIndex]?.id === m.id;
                        const isJumpHighlighted = jumpHighlightId === m.id;

                        return (
                          <div key={m.id} className="contents">
                            {showDateSeparator && (
                              <motion.div 
                                initial={{ opacity: 0, y: -8 }} 
                                animate={{ opacity: 1, y: 0 }} 
                                className="my-4 flex justify-center"
                              >
                                <span className="rounded-full bg-white/60 dark:bg-zinc-800/60 px-4 py-1.5 text-[11px] font-semibold tracking-wide text-zinc-500 dark:text-zinc-400 backdrop-blur-md border border-zinc-200/50 dark:border-zinc-700/50 shadow-sm">
                                  {fmtDateLabel(m.created_at)}
                                </span>
                              </motion.div>
                            )}
                            
                            {m.id === unreadDividerId && (
                              <motion.div 
                                initial={{ opacity: 0, scale: 0.95 }} 
                                animate={{ opacity: 1, scale: 1 }} 
                                className="my-4 flex items-center gap-3"
                              >
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--sona-accent,#E07A5F)]/40 to-transparent" />
                                <span className="shrink-0 rounded-full bg-[var(--sona-accent,#E07A5F)] px-3.5 py-1 text-[11px] font-bold tracking-wide text-white shadow-md shadow-[#E07A5F]/20">
                                  {unreadSnapshot} unread {unreadSnapshot === 1 ? "message" : "messages"}
                                </span>
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--sona-accent,#E07A5F)]/40 to-transparent" />
                              </motion.div>
                            )}
                            
                            <motion.div
                              layout="position"
                              initial={{ opacity: 0, y: 16 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.96 }}
                              transition={{ type: "spring", stiffness: 400, damping: 30, mass: 0.8 }}
                              ref={(el) => { if (el) msgRefs.current.set(m.id, el); else msgRefs.current.delete(m.id); }}
                              className={
                                isCurrentMatch
                                  ? "relative rounded-2xl ring-2 ring-[var(--sona-accent,#E07A5F)] ring-offset-2 ring-offset-transparent transition-all duration-300"
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
                                  isPinned={!!m.pinned_by}
                                  onTogglePin={() => togglePinMessage(m)}
                                  isBookmarked={bookmarkedIds.has(m.id)}
                                  onToggleBookmark={() => toggleBookmark(m)}
                                  selectMode={msgSelectMode}
                                  selected={selectedMsgIds.has(m.id)}
                                  onToggleSelect={() => toggleSelectMessage(m.id)}
                                  menuOpen={openMessageMenu?.id === m.id}
                                  menuPos={openMessageMenu?.id === m.id ? { x: openMessageMenu.x, y: openMessageMenu.y } : null}
                                  onOpenMenu={(x, y) => openMessageMenuFor(m.id, x, y)}
                                  onCloseMenu={closeMessageMenu}
                                  onAskSona={() => setAskSonaMessage(m)}
                                  deliveries={deliveries}
                                  onRetrySend={() => retryMessage(m.id)}
                                  onShowMessageInfo={() => setMessageInfoTarget(m)}
                                />
                              </MessageErrorBoundary>
                            </motion.div>
                          </div>
                        );
                      })}
                    </AnimatePresence>

                    {typingNames.length > 0 && (
  <>
    <style>{`
      @keyframes typingWave {
        0%, 60%, 100% { transform: translateY(0); opacity: 0.6; }
        30% { transform: translateY(-4px); opacity: 1; }
      }
    `}</style>

    <div className="flex items-end gap-2 mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="group relative flex items-center gap-2 rounded-2xl rounded-bl-sm bg-white/95 dark:bg-[#1A1A1A]/95 px-3.5 py-2.5 shadow-[0_8px_24px_-4px_rgba(0,0,0,0.08),0_2px_6px_-2px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.5)] border border-black/[0.04] dark:border-white/[0.06] backdrop-blur-md transition-all duration-300">
        
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8C8C8C] dark:text-zinc-500 mr-1">
          {typingNames.length === 1 
            ? `${typingNames[0]} is typing` 
            : `${typingNames.length} people are typing`}
        </span>

        <div className="flex items-center gap-1.5 pl-1 border-l border-black/5 dark:border-white/5">
          <span 
            className="h-1.5 w-1.5 rounded-full bg-[var(--sona-accent,#E07A5F)] shadow-[0_0_6px_var(--sona-accent,#E07A5F)]"
            style={{ animation: 'typingWave 1.4s ease-in-out infinite' }}
          />
          <span 
            className="h-1.5 w-1.5 rounded-full bg-[var(--sona-accent,#E07A5F)] shadow-[0_0_6px_var(--sona-accent,#E07A5F)]"
            style={{ animation: 'typingWave 1.4s ease-in-out infinite 0.15s' }}
          />
          <span 
            className="h-1.5 w-1.5 rounded-full bg-[var(--sona-accent,#E07A5F)] shadow-[0_0_6px_var(--sona-accent,#E07A5F)]"
            style={{ animation: 'typingWave 1.4s ease-in-out infinite 0.3s' }}
          />
        </div>
      </div>
    </div>
  </>
)}
                    {isAIChat(active) && sonaTyping && <SonaTypingIndicator />}
                  </div>
                </div>

                {(replyTo || editing) && (
  <div className="border-t border-[var(--sona-accent,#E07A5F)]/10 chat-pattern dark:bg-[#242424] px-3 py-2 md:px-6">
    <div className="mx-auto flex max-w-3xl items-center gap-2">
      <div className="flex-1 min-w-0 rounded-lg border-l-[3px] border-[var(--sona-accent,#E07A5F)] bg-[#F5F0E8]/60 dark:bg-[#2A2A2A]/60 px-3 py-1.5">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--sona-accent,#E07A5F)]">
          {editing ? (
            <>
              <Pencil className="h-3 w-3" />
              <span>Editing</span>
            </>
          ) : (
            <>
              <Reply className="h-3 w-3" />
              <span>
                {replyTo?.sender_id === me?.id ? "You" : (replyTo ? profiles[replyTo.sender_id]?.display_name : null) ?? "…"}
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
                                className={`h-20 w-20 rounded-lg object-cover border border-[var(--sona-accent,#E07A5F)]/20 bg-black/5 transition-opacity ${sending ? "opacity-50" : ""}`}
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
                            <div key={i} className={`flex items-center gap-2 rounded-lg border border-[var(--sona-accent,#E07A5F)]/20 bg-white dark:bg-[#2A2A2A] px-3 py-2 transition-opacity ${sending ? "opacity-60" : ""}`}>
                              {sending ? (
                                <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[var(--sona-accent,#E07A5F)]" />
                              ) : (
                                <FileText className="h-5 w-5 text-[var(--sona-accent,#E07A5F)] shrink-0" />
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

                {msgSelectMode ? (
                  <div className="flex items-center justify-between gap-2 border-t border-[var(--sona-accent,#E07A5F)]/10 bg-[#FFFDF9] px-3 py-2.5 dark:bg-[#242424]">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={exitMsgSelectMode}
                        aria-label="Cancel selection"
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-[var(--sona-accent,#E07A5F)]/10"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <span className="text-sm font-semibold text-[#2D3436] dark:text-[#E8E8E8]">
                        {selectedMsgIds.size} selected
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Tooltip title="Pin">
                        <button
                          onClick={bulkPin}
                          disabled={selectedMsgIds.size === 0}
                          className="grid h-9 w-9 place-items-center rounded-full hover:bg-[var(--sona-accent,#E07A5F)]/10 disabled:opacity-30"
                          aria-label="Pin selected"
                        >
                          <Pin className="h-4 w-4 text-[var(--sona-accent,#E07A5F)]" />
                        </button>
                      </Tooltip>
                      <Tooltip title="Save">
                        <button
                          onClick={bulkBookmark}
                          disabled={selectedMsgIds.size === 0}
                          className="grid h-9 w-9 place-items-center rounded-full hover:bg-[var(--sona-accent,#E07A5F)]/10 disabled:opacity-30"
                          aria-label="Save selected"
                        >
                          <Bookmark className="h-4 w-4 text-[var(--sona-accent,#E07A5F)]" />
                        </button>
                      </Tooltip>
                      <Tooltip title="Forward">
                        <button
                          onClick={bulkForward}
                          disabled={selectedMsgIds.size === 0}
                          className="grid h-9 w-9 place-items-center rounded-full hover:bg-[var(--sona-accent,#E07A5F)]/10 disabled:opacity-30"
                          aria-label="Forward selected"
                        >
                          <Forward className="h-4 w-4 text-[var(--sona-accent,#E07A5F)]" />
                        </button>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <button
                          onClick={bulkDelete}
                          disabled={selectedMsgIds.size === 0}
                          className="grid h-9 w-9 place-items-center rounded-full hover:bg-red-500/10 disabled:opacity-30"
                          aria-label="Delete selected"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                ) : composerNotice ? (
                  <div className="border-t border-[var(--sona-accent,#E07A5F)]/10 bg-[#FFFDF9] px-4 py-5 text-center dark:bg-[#242424]">
                    <p className="mx-auto flex max-w-md items-center justify-center gap-2 rounded-2xl bg-[#F5F0E8] px-4 py-3 text-sm font-medium text-[#8C8C8C] dark:bg-[#2A2A2A]">
                      {broadcastLocked && !accountRestricted && !iBlockedThem && !theyBlockedMe ? (
                        <Radio className="h-4 w-4 shrink-0 text-[var(--sona-accent,#E07A5F)]" />
                      ) : (
                        <Ban className="h-4 w-4 shrink-0 text-[var(--sona-accent,#E07A5F)]" />
                      )}
                      {composerNotice}
                    </p>
                    {iBlockedThem && !accountRestricted && (
                      <button onClick={unblockOther} className="mt-3 rounded-full bg-[var(--sona-accent,#E07A5F)] px-5 py-2 text-xs font-semibold text-white">
                        Unblock
                      </button>
                    )}
                  </div>
                ) : (
                <div className="relative">
                {moderationResult && (moderationResult.shouldLog || !moderationResult.allowed) && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-full z-20 px-4 pb-2 chat-pattern">
                    <div className="pointer-events-auto">
                      <ModerationAlert result={moderationResult} />
                    </div>
                  </div>
                )}
                <Composer
                  draft={draft}
                  inputRef={composerInputRef}
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
                    if (upErr) { toast.danger(upErr.message); return; }
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
                  onCreateAd={!isAIChat(active) && me.is_business ? () => setShowAdComposer(true) : undefined}
                />
                </div>
                )}
              </>
            ) : (
              <div className="grid flex-1 place-items-center p-6 text-center text-[#8C8C8C] chat-pattern">
                <div>
                  <SonaLogo alt="" className="mx-auto h-24 w-24" />
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
                  if (error) toast.danger(error.message);
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
          onViewProfile={(m) => { setShowMemberList(false); setViewingProfile(profilesRaw[m.id] || m); }}
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

      {showAdComposer && me && (
        <AdComposerModal
          meId={me.id}
          canPostInChat={!!activeId}
          onClose={() => setShowAdComposer(false)}
          onCreated={onAdCreated}
        />
      )}

      {assigningFolders && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4" onClick={() => setAssigningFolders(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-[#FFFDF9] p-5 shadow-xl dark:bg-[#242424]" onClick={(e) => e.stopPropagation()}>
            <h3 className="flex items-center gap-2 text-base font-semibold text-[#2D3436] dark:text-[#E8E8E8]">
              <FolderCog className="h-4 w-4 text-[var(--sona-accent,#E07A5F)]" /> Add to folder
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
                    {allIn && <Check className="h-4 w-4 text-[var(--sona-accent,#E07A5F)]" />}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={openCreateFolderModal} className="flex items-center gap-1 rounded-xl bg-[#F5F0E8] px-3 py-2 text-sm dark:bg-[#3A3A3A] dark:text-[#E8E8E8]">
                <FolderPlus className="h-3.5 w-3.5" /> New folder
              </button>
              <button onClick={() => { setAssigningFolders(false); exitSelectMode(); }} className="rounded-xl bg-[var(--sona-accent,#E07A5F)] px-4 py-2 text-sm font-semibold text-white">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {folderModal && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4" onClick={() => setFolderModal(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-[#FFFDF9] p-5 shadow-xl dark:bg-[#242424]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-[#2D3436] dark:text-[#E8E8E8]">
              {folderModal.mode === "create" ? "New folder" : "Rename folder"}
            </h3>
            <input
              autoFocus
              maxLength={30}
              placeholder="e.g. Work, Family, Close friends"
              value={folderModal.value}
              onChange={(e) => setFolderModal((s) => (s ? { ...s, value: e.target.value } : s))}
              onKeyDown={(e) => e.key === "Enter" && submitFolderModal()}
              className="mt-4 w-full rounded-xl bg-[#F5F0E8] px-3 py-2 text-sm text-[#2D3436] outline-none dark:bg-[#2A2A2A] dark:text-[#E8E8E8]"
            />
            <div className="mt-4 flex items-center gap-2">
              {folderModal.mode === "rename" && folderModal.id && (
                <button
                  onClick={() => {
                    const folder = customFolders.find((cf) => cf.id === folderModal.id);
                    if (folder) deleteCustomFolder(folder.id, folder.name);
                  }}
                  className="mr-auto rounded-xl bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-500 hover:bg-red-500/20 transition"
                >
                  Delete folder
                </button>
              )}
              <button onClick={() => setFolderModal(null)} className="rounded-xl bg-[#F5F0E8] px-3 py-2 text-sm dark:bg-[#3A3A3A] dark:text-[#E8E8E8]">
                Cancel
              </button>
              <button onClick={submitFolderModal} className="rounded-xl bg-[var(--sona-accent,#E07A5F)] px-4 py-2 text-sm font-semibold text-white">
                {folderModal.mode === "create" ? "Create" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {reportTarget && me && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4" onClick={() => setReportTarget(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-[#FFFDF9] p-5 shadow-xl dark:bg-[#242424]" onClick={(e) => e.stopPropagation()}>
            <h3 className="flex items-center gap-2 text-base font-semibold text-[#2D3436] dark:text-[#E8E8E8]">
              <AlertTriangle className="h-4 w-4 text-[var(--sona-accent,#E07A5F)]" /> Report {reportTarget.display_name}
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
              <button onClick={submitReport} className="rounded-xl bg-[var(--sona-accent,#E07A5F)] px-4 py-2 text-sm font-semibold text-white">Send report</button>
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
          nickname={viewingProfile.id !== me.id ? nicknames[viewingProfile.id] : undefined}
          onSetNickname={
            viewingProfile.id !== me.id
              ? (name) => setContactNickname(viewingProfile.id, name).catch(() => toast.danger("Couldn't save that nickname — try again."))
              : undefined
          }
          onClearNickname={
            viewingProfile.id !== me.id
              ? () => clearContactNickname(viewingProfile.id).catch(() => toast.danger("Couldn't remove that nickname — try again."))
              : undefined
          }
          onEdit={() => { setViewingProfile(null); setShowSettings(true); }}
          moderation={viewingProfile.id === me.id ? myModeration : otherModeration}
          messageDisabled={viewingProfile.id !== me.id && (otherModeration?.action === "ban" || otherModeration?.action === "suspend")}
          messageDisabledReason={
            otherModeration?.action === "ban"
              ? "This account is banned — you can't message them."
              : otherModeration?.action === "suspend"
                ? "This account is suspended — you can't message them."
                : undefined
          }
          onReport={viewingProfile.id !== me.id && !viewingProfile.is_ai ? () => { setViewingProfile(null); setReportTarget(viewingProfile); } : undefined}
          online={onlineIds.has(viewingProfile.id)}
          lastSeen={viewingProfile.last_seen ?? null}
          onOpenMedia={
            viewingProfile.id !== me.id && activeId
              ? () => { setViewingProfile(null); setShowMediaGallery(true); }
              : undefined
          }
          mediaStats={viewingProfile.id !== me.id ? profileMediaStats : undefined}
          onOpenBookmarks={
            viewingProfile.id === me.id
              ? () => { setViewingProfile(null); setShowSavedMessages(true); loadSavedMessages(); }
              : undefined
          }
          bookmarksCount={viewingProfile.id === me.id ? selfBookmarksCount ?? undefined : undefined}
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
                toast.success("Contact link copied");
              }
            } catch {
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

      {forwardingMessages && me && (
        <ForwardModal
          messages={forwardingMessages}
          chats={chats}
          meId={me.id}
          onClose={() => { setForwardingMessages(null); exitMsgSelectMode(); }}
          onForwarded={() => {}}
        />
      )}

      {askSonaMessage && me && activeId && (
        <AskSonaPanel
          chatId={activeId}
          message={askSonaMessage}
          onClose={() => setAskSonaMessage(null)}
          onUseReply={(text) => setDraft(text)}
        />
      )}

      {messageInfoTarget && me && active && (
        <MessageInfoPopover
          message={messageInfoTarget}
          reads={reads}
          deliveries={deliveries}
          memberIds={active.memberIds}
          members={active.members}
          isGroup={active.is_group}
          decrypted={decrypted}
          meId={me.id}
          onClose={() => setMessageInfoTarget(null)}
          onRetry={() => { retryMessage(messageInfoTarget.id); setMessageInfoTarget(null); }}
        />
      )}

      {showSavedMessages && me && (
        <SavedMessagesModal
          messages={savedMessages}
          chats={chats}
          meId={me.id}
          loading={loadingSaved}
          decrypted={decrypted}
          onClose={() => setShowSavedMessages(false)}
          onOpen={(chatId, messageId) => openMessageInChat(chatId, messageId)}
          onRemove={(m) => toggleBookmark(m)}
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
          onSaved={(p) => { setMe(p); setProfilesRaw((prev) => ({ ...prev, [p.id]: p })); }}
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
            className="w-full max-w-md rounded-2xl border border-[var(--sona-accent,#E07A5F)]/10 bg-[#FFFDF9] dark:bg-[#2A2A2A] p-5 shadow-xl" onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-[var(--sona-accent,#E07A5F)]" />
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
                className="flex items-center gap-1.5 rounded-xl bg-[var(--sona-accent,#E07A5F)] px-3 py-2 text-sm font-medium text-white hover:opacity-90 transition"
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
            className="w-full max-w-md rounded-2xl border border-[var(--sona-accent,#E07A5F)]/10 bg-[#FFFDF9] dark:bg-[#2A2A2A] p-5 shadow-xl" onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-[var(--sona-accent,#E07A5F)]" />
              <h3 className="text-base font-semibold text-[#2D3436] dark:text-[#E8E8E8]">Scheduled messages</h3>
            </div>
            {scheduledMessages.length === 0 ? (
              <p className="text-sm text-[#8C8C8C]">No messages scheduled in this chat.</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {scheduledMessages.map((m) => (
                  <div key={m.id} className="flex items-start gap-2 rounded-xl border border-[var(--sona-accent,#E07A5F)]/10 bg-white/60 dark:bg-white/5 p-3">
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

