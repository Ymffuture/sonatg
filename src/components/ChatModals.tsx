import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Settings, DoorOpen, BadgeCheck, Camera, UserPlus, CheckSquare, Square, Trash2,
  Ban, Search, Sparkles, Crown, Plus, Users, UserX, User,
  Lock, Unlock, LogOut, Bell, Shield, Pencil,
  Briefcase, Gamepad2, GraduationCap, Heart, Music, Plane, Newspaper, HelpCircle, Tag,
  Radio, Copy, KeyRound, Mail, Check, Bookmark, BookmarkX, Link2, Zap,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { startPaystackCheckout } from "@/lib/paystack.functions";
import { deleteMyAccount } from "@/lib/account.functions";
import { unlockChat } from "@/lib/crypto";
import { useBackToClose } from "@/hooks/useBackStack";
import { useConfirm } from "@/hooks/useConfirmDialog";
import {
  CHAT_CATEGORIES, type Profile, type ChatCategory, type MessageRow,
} from "@/lib/db";
import { type ChatWithMeta, explainSupabaseError, usernameFromEmail, isReservedSonaName, fallbackNameFromEmail, chatTitle } from "@/utils/utils";
import { MessagePreview } from "./SonaChatParts";
import { useSonaTheme } from "@/hooks/useSonaTheme";
import { Avatar } from "./Avatar";
import { Spin, Skeleton, Tooltip, notification, Empty } from "antd";
import { setChatBroadcastMode, createClass, joinClassByCode } from "@/features/classroom";
import { fetchMyNotificationPreferences, updateMyNotificationPreferences, type NotificationPreferences } from "@/lib/announcements";
import type { ClassRow } from "@/features/classroom";
import { createChatInvite, listChatInvites, revokeChatInvite, inviteUrl, parseAllowedEmails, type ChatInviteRow } from "@/features/invites";
import SoundSettings from "./SoundSettings";
import { postSystemMessage } from "@/lib/systemMessages";
import { isFreeTierLimitError, FREE_CHAT_LIMIT_MESSAGE, FREE_CHAT_LIMIT, FREE_DAILY_MESSAGE_LIMIT, FREE_PIN_LIMIT, countMyChats, countMessagesSentToday } from "@/lib/planLimits";
import { PRICING, type BillingInterval } from "@/lib/pricing";

import { VscVerifiedFilled } from "react-icons/vsc";
import {
  MdDiamond,
  MdLock,
  MdPalette,
  MdVideoCall,
  MdPhone,
  MdFileDownload,
  MdCloudUpload,
} from "react-icons/md";

/* ─── Themed Notification Helper ─── */
const MILKY_CLASS =
  "!bg-white/80 dark:!bg-zinc-950/80 !backdrop-blur-2xl !rounded-2xl !border !border-white/40 dark:!border-zinc-800/60 !shadow-2xl " +
  "[&_.ant-notification-notice-message]:!text-zinc-900 dark:[&_.ant-notification-notice-message]:!text-zinc-100 " +
  "[&_.ant-notification-notice-description]:!text-zinc-600 dark:[&_.ant-notification-notice-description]:!text-zinc-400";

const notify = {
  success: ({ message, description }: { message: string; description?: string }) =>
    notification.success({
      message,
      description,
      placement: "top",
      className: `${MILKY_CLASS} [&_.ant-notification-notice-icon]:!text-[var(--sona-accent,#E07A5F)]`,
    }),
  error: ({ message, description }: { message: string; description?: string }) =>
    notification.error({
      message,
      description,
      placement: "top",
      className: `${MILKY_CLASS} [&_.ant-notification-notice-icon]:!text-red-500`,
    }),
};

/* ─── Category Icon Helper ─── */
function CategoryIcon({ category, className = "h-3.5 w-3.5" }: { category?: ChatCategory; className?: string }) {
  switch (category) {
    case "business": return <Briefcase className={className} />;
    case "gaming": return <Gamepad2 className={className} />;
    case "education": return <GraduationCap className={className} />;
    case "lifestyle": return <Heart className={className} />;
    case "entertainment": return <Music className={className} />;
    case "travel": return <Plane className={className} />;
    case "news": return <Newspaper className={className} />;
    case "support": return <HelpCircle className={className} />;
    default: return <Tag className={className} />;
  }
}

/* ─── Premium Glass Modal Wrapper ─── */
function GlassSheet({
  children, onClose, maxHeight = "85vh", className = "",
}: {
  children: React.ReactNode; onClose: () => void; maxHeight?: string; className?: string;
}) {
  useBackToClose(onClose);
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        className="absolute inset-0 bg-black/40 backdrop-blur-md" 
      />
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className={`relative w-full flex flex-col rounded-t-3xl border-t border-white/30 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-2xl shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.3)] ${className}`}
        style={{ maxHeight }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-zinc-700 pointer-events-none" />
        <div className="pt-3 pb-1 flex justify-center">
          <div className="h-1.5 w-12 rounded-full bg-zinc-300/50 dark:bg-zinc-700/50" />
        </div>
        {children}
      </motion.div>
    </div>
  );
}

/* ─── Member List ─── */
export function MemberListModal({
  chat, meId, isAdmin, onClose, onOpenSettings, onLeave, onViewProfile, onRemoveMember,
}: {
  chat: ChatWithMeta; meId: string; isAdmin: boolean;
  onClose: () => void; onOpenSettings: () => void; onLeave: () => void;
  onViewProfile?: (member: Profile) => void;
  onRemoveMember?: (member: Profile) => void;
}) {
  const confirm = useConfirm();
  return (
    <GlassSheet onClose={onClose}>
      <div className="px-5 pt-2 pb-4 flex items-center justify-between border-b border-zinc-200/50 dark:border-zinc-800/50">
        <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
          {chat.title || "Group"} <span className="text-zinc-400 font-normal">· {chat.members.length}</span>
        </h3>
        <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" aria-label="Close">
          <X className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
        </button>
      </div>

      <div className="scrollbar-thin flex-1 overflow-y-auto px-2 pb-2">
        <motion.div layout className="space-y-1 p-2">
          <AnimatePresence>
            {chat.members.map((m, i) => {
              const role = chat.memberRoles[m.id] ?? "participant";
              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: i * 0.03, type: "spring", stiffness: 300, damping: 25 }}
                  role={onViewProfile ? "button" : undefined}
                  tabIndex={onViewProfile ? 0 : undefined}
                  onClick={onViewProfile ? () => onViewProfile(m) : undefined}
                  onKeyDown={onViewProfile ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onViewProfile(m); } } : undefined}
                  className={`flex items-center gap-3 p-3 rounded-2xl transition-all duration-200 outline-none ${onViewProfile ? "cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-900" : ""}`}
                >
                  <Avatar url={m.avatar_url} name={m.display_name} size={44} ai={m.is_ai} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {m.display_name}{m.id === meId && <span className="text-zinc-400 font-normal"> (you)</span>}
                      </span>
                      {role === "admin" && (
                        <Tooltip title="Admin">
                          <BadgeCheck className="h-4 w-4 text-blue-500 shrink-0" />
                        </Tooltip>
                      )}
                    </div>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 capitalize">{role}</span>
                    {m.bio && <p className="mt-0.5 truncate text-xs text-zinc-400 italic">{m.bio}</p>}
                  </div>
                  {isAdmin && m.id !== meId && onRemoveMember && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        const ok = await confirm({
                          title: `Remove ${m.display_name}?`,
                          description: "They'll be removed from this group and won't see new messages, but can be re-added later.",
                          confirmText: "Remove",
                          danger: true,
                        });
                        if (ok) onRemoveMember(m);
                      }}
                      aria-label={`Remove ${m.display_name}`}
                      className="shrink-0 grid h-8 w-8 place-items-center rounded-full text-zinc-400 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                    >
                      <UserX className="h-4 w-4" />
                    </button>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      </div>

      <div className="px-5 pb-6 pt-4 border-t border-zinc-200/50 dark:border-zinc-800/50 space-y-3 bg-white/50 dark:bg-zinc-950/50 backdrop-blur-xl">
        {isAdmin && (
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={onOpenSettings}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[var(--sona-accent,#E07A5F)] py-3 text-sm font-semibold text-white hover:opacity-95 transition-all shadow-lg shadow-[var(--sona-accent,#E07A5F)]/20 active:scale-[0.98]"
          >
            <Settings className="h-4 w-4" /> Group settings
          </motion.button>
        )}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={onLeave}
          className="w-full flex items-center justify-center gap-2 rounded-2xl border border-red-500/20 dark:border-red-500/30 py-3 text-sm font-semibold text-red-500 hover:bg-red-500/10 transition-all active:scale-[0.98]"
        >
          <DoorOpen className="h-4 w-4" /> Leave group
        </motion.button>
      </div>
    </GlassSheet>
  );
}

/* ─── Group Settings ─── */
export function GroupSettingsModal({
  chat, meId, onClose, onUpdated, onDelete,
}: {
  chat: ChatWithMeta; meId: string; onClose: () => void;
  onUpdated: () => void; onDelete: () => void;
}) {
  const [title, setTitle] = useState(chat.title ?? "");
  const [description, setDescription] = useState(chat.description ?? "");
  const [category, setCategory] = useState<ChatCategory>(chat.category ?? "general");
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const avatarPreview = useMemo(() => (avatarFile ? URL.createObjectURL(avatarFile) : null), [avatarFile]);
  useEffect(() => () => { if (avatarPreview) URL.revokeObjectURL(avatarPreview); }, [avatarPreview]);

  const [addOpen, setAddOpen] = useState(false);
  const [candidates, setCandidates] = useState<Profile[]>([]);
  const [addSelected, setAddSelected] = useState<Set<string>>(new Set());
  const [addBusy, setAddBusy] = useState(false);

  const [isBroadcast, setIsBroadcast] = useState(false);
  const [classInfo, setClassInfo] = useState<ClassRow | null>(null);
  const [classroomBusy, setClassroomBusy] = useState(false);

  const [invites, setInvites] = useState<ChatInviteRow[]>([]);
  const [inviteEmails, setInviteEmails] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState<string | null>(null);

  const loadInvites = async () => {
    try { setInvites(await listChatInvites(chat.id)); } catch { /* ignore */ }
  };
  useEffect(() => { void loadInvites(); }, [chat.id]);

  const makeInvite = async () => {
    let emails: string[];
    try {
      emails = parseAllowedEmails(inviteEmails);
    } catch (e) {
      notify.error({ message: "Invalid email", description: e instanceof Error ? e.message : "Enter full addresses like name@company.com, one per line or separated by commas." });
      return;
    }
    setInviteBusy(true);
    try {
      const created = await createChatInvite({ chatId: chat.id, allowedEmails: emails.length ? emails : null, expiresInDays: 7 });
      setInvites((prev) => [created, ...prev]);
      setInviteEmails("");
      await navigator.clipboard?.writeText(inviteUrl(created.token)).catch(() => {});
      notify.success({
        message: "Invite link created",
        description: emails.length
          ? `Copied. Only ${emails.length === 1 ? emails[0] : `${emails.length} people`} can join — expires in 7 days.`
          : "Copied to clipboard. Expires in 7 days.",
      });
    } catch (e) {
      const explained = explainSupabaseError(e);
      notify.error({ message: explained.title, description: `${explained.explanation}\n\nDetails: ${explained.raw}` });
    } finally {
      setInviteBusy(false);
    }
  };

  const copyInvite = async (invite: ChatInviteRow) => {
    await navigator.clipboard?.writeText(inviteUrl(invite.token)).catch(() => {});
    setCopiedInvite(invite.id);
    setTimeout(() => setCopiedInvite((c) => (c === invite.id ? null : c)), 1500);
    notify.success({ message: "Link copied", description: "Share it with the people you want in this group." });
  };

  const revokeInvite = async (invite: ChatInviteRow) => {
    try {
      await revokeChatInvite(invite.id);
      setInvites((prev) => prev.map((i) => (i.id === invite.id ? { ...i, is_active: false } : i)));
      notify.success({ message: "Invite revoked", description: "That link no longer works for anyone." });
    } catch (e) {
      const explained = explainSupabaseError(e);
      notify.error({ message: explained.title, description: `${explained.explanation}\n\nDetails: ${explained.raw}` });
    }
  };

  useEffect(() => {
    (async () => {
      const [{ data: chatRow }, { data: cls }] = await Promise.all([
        supabase.from("chats").select("is_broadcast").eq("id", chat.id).maybeSingle(),
        supabase.from("classes").select("*").eq("chat_id", chat.id).eq("is_active", true).maybeSingle(),
      ]);
      setIsBroadcast(Boolean((chatRow as { is_broadcast?: boolean } | null)?.is_broadcast));
      setClassInfo((cls as ClassRow) ?? null);
    })();
  }, [chat.id]);

  const toggleBroadcast = async () => {
    setClassroomBusy(true);
    try {
      const next = !isBroadcast;
      await setChatBroadcastMode(chat.id, next);
      setIsBroadcast(next);
      notify.success({
        message: next ? "Broadcast mode on" : "Broadcast mode off",
        description: next ? "Only you (and other posters) can send messages here." : "Everyone in the group can send messages again.",
      });
    } catch (e) {
      const explained = explainSupabaseError(e);
      notify.error({ message: explained.title, description: `${explained.explanation}\n\nDetails: ${explained.raw}` });
    } finally {
      setClassroomBusy(false);
    }
  };

  const generateClassCode = async () => {
    setClassroomBusy(true);
    try {
      const created = await createClass(chat.id, chat.title || "Class");
      setClassInfo(created);
      notify.success({ message: "Class code created", description: created.join_code });
    } catch (e) {
      const explained = explainSupabaseError(e);
      notify.error({ message: explained.title, description: `${explained.explanation}\n\nDetails: ${explained.raw}` });
    } finally {
      setClassroomBusy(false);
    }
  };

  const copyClassCode = () => {
    if (!classInfo) return;
    navigator.clipboard?.writeText(classInfo.join_code);
    notify.success({ message: "Code copied", description: classInfo.join_code });
  };

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
      const { error } = await supabase.from("chats").update({ title: title.trim() || chat.title, avatar_url, category, description: description.trim() || null }).eq("id", chat.id);
      if (error) throw error;
      notify.success({ message: "Group updated", description: "Your changes have been saved for everyone." });
      onUpdated();
      onClose();
    } catch (e) {
      const explained = explainSupabaseError(e);
      notify.error({ message: explained.title, description: `${explained.explanation}\n\nDetails: ${explained.raw}` });
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
      const names = Array.from(addSelected)
        .map((id) => candidates.find((c) => c.id === id)?.display_name)
        .filter((n): n is string => !!n);
      if (names.length) {
        await postSystemMessage(
          chat.id,
          names.length === 1
            ? `${names[0]} joined the group`
            : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]} joined the group`,
        );
      }
      notify.success({ message: `Added ${addSelected.size} member(s)`, description: "They can now see the group and its message history." });
      setAddOpen(false);
      setAddSelected(new Set());
      onUpdated();
    } catch (e) {
      const explained = explainSupabaseError(e);
      notify.error({ message: explained.title, description: `${explained.explanation}\n\nDetails: ${explained.raw}` });
    } finally {
      setAddBusy(false);
    }
  };

  return (
    <GlassSheet onClose={onClose} className="md:mx-auto md:mb-8 md:max-w-md md:rounded-3xl md:border">
      <div className="px-5 pt-2 pb-4 flex items-center justify-between border-b border-zinc-200/50 dark:border-zinc-800/50">
        <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Group settings</h3>
        <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" aria-label="Close">
          <X className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
        </button>
      </div>

      <div className="scrollbar-thin flex-1 overflow-y-auto px-5 pb-4 space-y-5">
        {/* Avatar */}
        <div className="flex justify-center pt-2">
          <motion.label whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="relative cursor-pointer group">
            <Avatar url={avatarPreview ?? chat.avatar_url} name={chat.title ?? "Group"} size={88} />
            <span className="absolute bottom-0 right-0 grid h-8 w-8 place-items-center rounded-full bg-[var(--sona-accent,#E07A5F)] text-white ring-4 ring-white dark:ring-zinc-950 shadow-lg group-hover:bg-[#d4694f] transition-colors">
              <Camera className="h-4 w-4" />
            </span>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)} />
          </motion.label>
        </div>

        {/* Name */}
        <div>
          <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Group name</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1.5 w-full rounded-xl bg-zinc-50/50 dark:bg-zinc-900/50 px-3 py-2.5 text-sm outline-none transition-all duration-200 border border-zinc-200/50 dark:border-zinc-800/50 focus:border-[var(--sona-accent,#E07A5F)] focus:ring-2 focus:ring-[var(--sona-accent,#E07A5F)]/20 text-zinc-900 dark:text-zinc-100"
          />
        </div>

        {/* Description */}
        <div>
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Description</label>
            <span className="text-[10px] text-zinc-400">{description.length}/250</span>
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 250))}
            placeholder="What's this group about?"
            rows={2}
            className="mt-1.5 w-full resize-none rounded-xl bg-zinc-50/50 dark:bg-zinc-900/50 px-3 py-2.5 text-sm outline-none transition-all duration-200 border border-zinc-200/50 dark:border-zinc-800/50 focus:border-[var(--sona-accent,#E07A5F)] focus:ring-2 focus:ring-[var(--sona-accent,#E07A5F)]/20 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
          />
        </div>

        {/* Category */}
        <div>
          <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2 block">Category</label>
          <div className="flex flex-wrap gap-2">
            {CHAT_CATEGORIES.map((cat) => (
              <motion.button
                key={cat.value}
                whileTap={{ scale: 0.95 }}
                onClick={() => setCategory(cat.value)}
                className={`relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 border ${
                  category === cat.value
                    ? "bg-[var(--sona-accent,#E07A5F)] text-white border-transparent shadow-md shadow-[var(--sona-accent,#E07A5F)]/20"
                    : "bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                <CategoryIcon category={cat.value} />
                {cat.label}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Add members */}
        <div>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => setAddOpen((v) => !v)}
            className="w-full flex items-center gap-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 px-3 py-2.5 text-sm font-medium text-zinc-900 dark:text-zinc-100 border border-zinc-200/50 dark:border-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
          >
            <UserPlus className="h-4 w-4 text-[var(--sona-accent,#E07A5F)]" /> Add participants
            {addSelected.size > 0 && <span className="ml-auto text-xs font-bold text-[var(--sona-accent,#E07A5F)]">{addSelected.size} selected</span>}
          </motion.button>
          
          <AnimatePresence>
            {addOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-3 max-h-56 overflow-y-auto rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-md">
                  {candidates.length === 0 ? (
                    <p className="p-4 text-center text-xs text-zinc-500">Everyone's already in this group.</p>
                  ) : (
                    <>
                      {candidates.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => setAddSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(u.id)) next.delete(u.id); else next.add(u.id);
                            return next;
                          })}
                          className="flex w-full items-center gap-3 border-b border-zinc-200/30 dark:border-zinc-800/30 p-3 last:border-0 hover:bg-[var(--sona-accent,#E07A5F)]/5 transition-colors text-left"
                        >
                          <Avatar url={u.avatar_url} name={u.display_name} size={36} />
                          <span className="flex-1 truncate text-sm text-zinc-900 dark:text-zinc-100">{u.display_name}</span>
                          {addSelected.has(u.id) ? <CheckSquare className="h-5 w-5 text-[var(--sona-accent,#E07A5F)]" /> : <Square className="h-5 w-5 text-zinc-400" />}
                        </button>
                      ))}
                      <button
                        onClick={addMembers}
                        disabled={addBusy || addSelected.size === 0}
                        className="w-full py-3 text-sm font-semibold text-white bg-[var(--sona-accent,#E07A5F)] disabled:opacity-50 hover:bg-[#d4694f] transition-colors flex items-center justify-center gap-2"
                      >
                        {addBusy ? <><Spin size="small" /> Adding…</> : "Add selected"}
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Classroom mode */}
        <div className="rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-900/50 p-4 backdrop-blur-sm space-y-3">
          <p className="flex items-center gap-2 text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
            <GraduationCap className="h-4 w-4 text-[var(--sona-accent,#E07A5F)]" /> Classroom
          </p>

          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={toggleBroadcast}
            disabled={classroomBusy}
            className="w-full flex items-center gap-3 rounded-xl bg-white dark:bg-zinc-950 px-3 py-3 text-sm font-medium text-zinc-900 dark:text-zinc-100 border border-zinc-200/50 dark:border-zinc-800/50 disabled:opacity-60 transition-all"
          >
            <Radio className="h-5 w-5 text-[var(--sona-accent,#E07A5F)]" />
            <span className="flex-1 text-left">
              Broadcast-only
              <span className="block text-[11px] font-normal text-zinc-500">Only you can post — others can read but not reply</span>
            </span>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${isBroadcast ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"}`}>
              {isBroadcast ? "On" : "Off"}
            </span>
          </motion.button>

          {classInfo ? (
            <div className="flex items-center gap-3 rounded-xl bg-white dark:bg-zinc-950 px-3 py-3 border border-zinc-200/50 dark:border-zinc-800/50">
              <KeyRound className="h-5 w-5 shrink-0 text-[var(--sona-accent,#E07A5F)]" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Join code</p>
                <p className="font-mono text-sm font-bold tracking-widest text-zinc-900 dark:text-zinc-100">{classInfo.join_code}</p>
              </div>
              <motion.button whileTap={{ scale: 0.9 }} onClick={copyClassCode} aria-label="Copy join code" className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                <Copy className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
              </motion.button>
            </div>
          ) : (
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={generateClassCode}
              disabled={classroomBusy}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--sona-accent,#E07A5F)]/10 px-3 py-3 text-sm font-semibold text-[var(--sona-accent,#E07A5F)] disabled:opacity-60 hover:bg-[var(--sona-accent,#E07A5F)]/15 transition-colors"
            >
              {classroomBusy ? <Spin size="small" /> : <KeyRound className="h-4 w-4" />}
              Generate join code
            </motion.button>
          )}
        </div>

        {/* Invite link */}
        <div className="rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-900/50 p-4 backdrop-blur-sm space-y-3">
          <p className="flex items-center gap-2 text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
            <Link2 className="h-4 w-4 text-[var(--sona-accent,#E07A5F)]" /> Invite link
          </p>
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            Share a link instead of adding people one by one. Restrict it to specific emails so only those people can join.
          </p>

          <div className="flex items-start gap-3 rounded-xl bg-white dark:bg-zinc-950 px-3 py-2.5 border border-zinc-200/50 dark:border-zinc-800/50">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
            <textarea
              value={inviteEmails}
              onChange={(e) => setInviteEmails(e.target.value)}
              placeholder="Restrict to emails (optional) — one per line, or separated by commas"
              rows={2}
              className="flex-1 resize-none bg-transparent text-sm outline-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
            />
          </div>

          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={makeInvite}
            disabled={inviteBusy}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--sona-accent,#E07A5F)]/10 px-3 py-2.5 text-sm font-semibold text-[var(--sona-accent,#E07A5F)] disabled:opacity-60 hover:bg-[var(--sona-accent,#E07A5F)]/15 transition-colors"
          >
            {inviteBusy ? <Spin size="small" /> : <Link2 className="h-4 w-4" />}
            Create invite link
          </motion.button>

          {invites.length > 0 && (
            <div className="space-y-2">
              {invites.map((inv) => (
                <div key={inv.id} className={`flex items-center gap-2 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white dark:bg-zinc-950 px-3 py-2.5 transition-all ${inv.is_active ? "" : "opacity-50"}`}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
                      {inv.allowed_emails?.length ? inv.allowed_emails.join(", ") : "Anyone with the link"}
                    </p>
                    <p className="truncate text-[10px] text-zinc-500">
                      {inv.is_active ? "Active" : "Revoked"} · {inv.uses}/{inv.max_uses} used
                      {inv.expires_at ? ` · expires ${new Date(inv.expires_at).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                  {inv.is_active && (
                    <>
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => copyInvite(inv)} aria-label="Copy invite link" className="grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                        {copiedInvite === inv.id ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />}
                      </motion.button>
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => revokeInvite(inv)} aria-label="Revoke invite link" className="grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-red-500/10 transition-colors">
                        <X className="h-4 w-4 text-red-500" />
                      </motion.button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Danger zone */}
        <div className="pt-4 border-t border-zinc-200/50 dark:border-zinc-800/50">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={onDelete}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-red-500/20 dark:border-red-500/30 py-3 text-sm font-semibold text-red-500 hover:bg-red-500/10 transition-all active:scale-[0.98]"
          >
            <Trash2 className="h-4 w-4" /> Remove group
          </motion.button>
        </div>
      </div>

      <div className="px-5 pb-6 pt-4 border-t border-zinc-200/50 dark:border-zinc-800/50 bg-white/50 dark:bg-zinc-950/50 backdrop-blur-xl">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={save}
          disabled={saving}
          className="w-full rounded-xl bg-[var(--sona-accent,#E07A5F)] py-3 text-sm font-semibold text-white shadow-lg shadow-[var(--sona-accent,#E07A5F)]/20 hover:opacity-95 disabled:opacity-60 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          {saving ? <><Spin size="small" /> Saving…</> : "Save changes"}
        </motion.button>
      </div>
    </GlassSheet>
  );
}

/* ─── New Chat ─── */
export function NewChatModal({ meId, onClose, onCreated }: { meId: string; onClose: () => void; onCreated: (id: string) => void }) {
  useBackToClose(onClose);
  const [mode, setMode] = useState<"direct" | "group" | "class">("direct");
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [groupTitle, setGroupTitle] = useState("");
  const [category, setCategory] = useState<ChatCategory>("general");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupError, setGroupError] = useState<{ title: string; explanation: string; raw: string } | null>(null);

  const [classCode, setClassCode] = useState("");
  const [joiningClass, setJoiningClass] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("profiles").select("*").neq("id", meId).order("display_name", { ascending: true }).limit(200);
      if (error) notify.error({ message: error.message, description: "The user list couldn't be loaded — check your connection." });
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
      notify.success({ message: `Chat with ${prof.display_name} created`, description: "You can start messaging them right away." });
      onCreated(chat.id);
    } catch (e) {
      console.error("startWith failed", e);
      if (isFreeTierLimitError(e)) {
        notify.error({ message: "Sona Purple limit reached", description: FREE_CHAT_LIMIT_MESSAGE });
        return;
      }
      const explained = explainSupabaseError(e);
      notify.error({ message: explained.title, description: `${explained.explanation}\n\nDetails: ${explained.raw}` });
      setGroupError(explained);
    } finally { setBusyId(null); }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const createGroup = async () => {
    if (!groupTitle.trim()) return notify.error({ message: "Give your group a name", description: "Every group needs a name so members can recognize it." });
    if (selectedIds.size === 0) return notify.error({ message: "Pick at least one person", description: "Select at least one contact to add before creating the group." });
    setCreatingGroup(true);
    try {
      const { data: chat, error: cErr } = await supabase.from("chats").insert({ is_group: true, title: groupTitle.trim(), category, created_by: meId }).select().single();
      if (cErr) throw cErr;

      const { error: selfErr } = await supabase.from("chat_members").insert({ chat_id: chat.id, user_id: meId, role: "admin" });
      if (selfErr) throw selfErr;

      const otherRows = Array.from(selectedIds).map((user_id) => ({ chat_id: chat.id, user_id }));
      if (otherRows.length) {
        const { error: mErr } = await supabase.from("chat_members").insert(otherRows);
        if (mErr) throw mErr;
      }

      notify.success({ message: `"${groupTitle.trim()}" created`, description: "All selected members have been added." });
      onCreated(chat.id);
    } catch (e) {
      console.error("createGroup failed", e);
      if (isFreeTierLimitError(e)) {
        notify.error({ message: "Sona Purple limit reached", description: FREE_CHAT_LIMIT_MESSAGE });
        return;
      }
      const explained = explainSupabaseError(e);
      notify.error({ message: explained.title, description: `${explained.explanation}\n\nDetails: ${explained.raw}` });
      setGroupError(explained);
    } finally {
      setCreatingGroup(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-md" />
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="relative w-full rounded-t-3xl md:rounded-3xl border-t md:border border-white/30 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-2xl shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.3)] md:shadow-2xl md:mx-auto md:mb-8 md:max-w-md max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-zinc-700 pointer-events-none" />
        <div className="pt-3 pb-1 flex justify-center md:hidden">
          <div className="h-1.5 w-12 rounded-full bg-zinc-300/50 dark:bg-zinc-700/50" />
        </div>
        
        <div className="px-5 pt-3 pb-4 flex items-center justify-between border-b border-zinc-200/50 dark:border-zinc-800/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-500/10 text-[var(--sona-accent,#E07A5F)]">
              <Users className="h-4 w-4" />
            </div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              {mode === "direct" ? "Choose a friend" : mode === "group" ? "New group" : "Join a class"}
            </h3>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" aria-label="Close">
            <X className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
          </button>
        </div>

        {/* Mode tabs with sliding indicator */}
        <div className="px-5 py-4">
          <div className="relative flex gap-1 rounded-2xl bg-zinc-100/50 dark:bg-zinc-900/50 p-1 border border-zinc-200/50 dark:border-zinc-800/50 backdrop-blur-md">
            {(["direct", "group", "class"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="relative flex-1 rounded-xl px-2 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors z-10"
              >
                {mode === m && (
                  <motion.div
                    layoutId="active-mode-tab"
                    className="absolute inset-0 rounded-xl bg-white dark:bg-zinc-800 shadow-sm border border-zinc-200/50 dark:border-zinc-700/50"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
                <span className="relative z-10 text-zinc-600 dark:text-zinc-400">
                  {m === "direct" ? "Direct" : m === "group" ? "Group" : "Class Code"}
                </span>
              </button>
            ))}
          </div>
        </div>

        {mode === "class" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="px-5 pb-4 space-y-3">
            <p className="text-xs text-zinc-500">Enter the class code your teacher shared (e.g. K7QX-3RTN).</p>
            <input
              value={classCode}
              onChange={(e) => setClassCode(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX"
              className="w-full rounded-xl bg-zinc-50/50 dark:bg-zinc-900/50 px-3 py-3 text-sm font-mono tracking-widest outline-none transition-all duration-200 border border-zinc-200/50 dark:border-zinc-800/50 focus:border-[var(--sona-accent,#E07A5F)] focus:ring-2 focus:ring-[var(--sona-accent,#E07A5F)]/20 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
            />
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={async () => {
                if (!classCode.trim()) return;
                setJoiningClass(true);
                try {
                  const chatId = await joinClassByCode(classCode);
                  notify.success({ message: "Joined class", description: "You now have access to the class chat." });
                  onCreated(chatId);
                } catch (e) {
                  const explained = explainSupabaseError(e);
                  notify.error({ message: "Couldn't join", description: explained.explanation || "Check the code and try again." });
                } finally {
                  setJoiningClass(false);
                }
              }}
              disabled={joiningClass || !classCode.trim()}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--sona-accent,#E07A5F)] py-3 text-sm font-semibold text-white shadow-lg shadow-[var(--sona-accent,#E07A5F)]/20 hover:opacity-95 disabled:opacity-60 transition-all active:scale-[0.98]"
            >
              {joiningClass ? <><Spin size="small" /> Joining…</> : "Join class"}
            </motion.button>
          </motion.div>
        )}

        {mode === "group" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="px-5 pb-3 space-y-3">
            <input
              value={groupTitle}
              onChange={(e) => setGroupTitle(e.target.value)}
              placeholder="Group name (e.g. Grade 11 Study Group)"
              className="w-full rounded-xl bg-zinc-50/50 dark:bg-zinc-900/50 px-3 py-3 text-sm outline-none transition-all duration-200 border border-zinc-200/50 dark:border-zinc-800/50 focus:border-[var(--sona-accent,#E07A5F)] focus:ring-2 focus:ring-[var(--sona-accent,#E07A5F)]/20 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
            />
            <div className="flex flex-wrap gap-2">
              {CHAT_CATEGORIES.map((cat) => (
                <motion.button
                  key={cat.value}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setCategory(cat.value)}
                  className={`relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 border ${
                    category === cat.value
                      ? "bg-[var(--sona-accent,#E07A5F)] text-white border-transparent shadow-md shadow-[var(--sona-accent,#E07A5F)]/20"
                      : "bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  <CategoryIcon category={cat.value} />
                  {cat.label}
                </motion.button>
              ))}
            </div>
            {selectedIds.size > 0 && (
              <p className="text-xs font-medium text-[var(--sona-accent,#E07A5F)]">{selectedIds.size} {selectedIds.size === 1 ? "person" : "people"} selected</p>
            )}
          </motion.div>
        )}

        {mode !== "class" && (
          <>
            <div className="px-5 pb-3">
              <div className="flex items-center gap-3 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/50 px-3 py-2.5 border border-zinc-200/50 dark:border-zinc-800/50 backdrop-blur-sm focus-within:border-[var(--sona-accent,#E07A5F)] focus-within:ring-2 focus-within:ring-[var(--sona-accent,#E07A5F)]/20 transition-all">
                <Search className="h-4 w-4 text-zinc-400" />
                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people…" className="flex-1 bg-transparent text-sm outline-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400" />
              </div>
            </div>
            <div className="scrollbar-thin flex-1 overflow-y-auto px-2 pb-4">
              {loading ? (
                <div className="px-4 py-6 space-y-3">
                  <Skeleton avatar paragraph={{ rows: 1 }} active />
                  <Skeleton avatar paragraph={{ rows: 1 }} active />
                  <Skeleton avatar paragraph={{ rows: 1 }} active />
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center text-sm text-zinc-500">No users found</div>
              ) : (
                <motion.div layout className="space-y-1">
                  <AnimatePresence>
                    {filtered.map((u, i) => (
                      <motion.button
                        key={u.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ delay: i * 0.03, type: "spring", stiffness: 300, damping: 25 }}
                        disabled={mode === "direct" && busyId === u.id}
                        onClick={() => (mode === "direct" ? startWith(u) : toggleSelected(u.id))}
                        className="flex w-full items-center gap-3 border-b border-zinc-200/30 dark:border-zinc-800/30 p-3 text-left last:border-0 hover:bg-[var(--sona-accent,#E07A5F)]/5 disabled:opacity-60 rounded-xl transition-all"
                      >
                        <Avatar url={u.avatar_url} name={u.display_name} size={44} ai={u.is_ai} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{u.display_name}</div>
                            {u.is_ai && (
                              <Tooltip title="AI Assistant">
                                <VscVerifiedFilled className="h-4 w-4 text-blue-500 shrink-0 drop-shadow-[0_1px_2px_rgba(59,130,246,0.3)]" />
                              </Tooltip>
                            )}
                            {u.is_pro && (
                              <Tooltip title="Pro Account">
                                <MdDiamond className="h-4 w-4 text-[#8B5CF6] drop-shadow" />
                              </Tooltip>
                            )}
                          </div>
                          <div className="truncate text-xs text-zinc-500">{usernameFromEmail(u.display_name, u.email)}</div>
                        </div>
                        {mode === "direct" ? (
                          busyId === u.id ? <Spin size="small" /> : <Plus className="h-5 w-5 text-[var(--sona-accent,#E07A5F)]" />
                        ) : selectedIds.has(u.id) ? (
                          <CheckSquare className="h-5 w-5 text-[var(--sona-accent,#E07A5F)]" />
                        ) : (
                          <Square className="h-5 w-5 text-zinc-400" />
                        )}
                      </motion.button>
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
            </div>
          </>
        )}

        {mode === "group" && (
          <div className="px-5 pb-6 pt-2 border-t border-zinc-200/50 dark:border-zinc-800/50 bg-white/50 dark:bg-zinc-950/50 backdrop-blur-xl">
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={createGroup}
              disabled={creatingGroup}
              className="w-full rounded-xl bg-[var(--sona-accent,#E07A5F)] py-3 text-sm font-semibold text-white shadow-lg shadow-[var(--sona-accent,#E07A5F)]/20 transition-all hover:opacity-95 disabled:opacity-60 flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              {creatingGroup ? (<span className="flex items-center gap-2"><Spin size="small" /> Creating…</span>) : "Create group"}
            </motion.button>
          </div>
        )}
      </motion.div>

      {groupError && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 backdrop-blur-md p-4" onClick={(e) => e.stopPropagation()}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            className="w-full max-w-sm rounded-2xl border border-zinc-200/50 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-2xl p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-center gap-3 text-red-500">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
                <Ban className="h-5 w-5" />
              </div>
              <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100">{groupError.title}</h4>
            </div>
            <p className="mb-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{groupError.explanation}</p>
            <details className="mb-6 rounded-xl bg-zinc-50 dark:bg-zinc-900 p-3 text-xs text-zinc-500 border border-zinc-200/50 dark:border-zinc-800">
              <summary className="cursor-pointer select-none font-semibold">Technical details</summary>
              <p className="mt-2 break-words font-mono">{groupError.raw}</p>
            </details>
            <div className="flex gap-3">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  navigator.clipboard.writeText(groupError.raw);
                  notify.success({ message: "Error copied", description: "Paste it when reporting the issue." });
                }}
                className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-800 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
              >
                Copy error
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setGroupError(null)}
                className="flex-1 rounded-xl bg-[var(--sona-accent,#E07A5F)] py-2.5 text-sm font-semibold text-white hover:bg-[#d4694f] transition-colors"
              >
                Got it
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

/* ─── Free-tier usage mini-panel (shown in Settings → Subscription for non-Purple users) ─── */
function FreeTierUsage({ meId }: { meId: string }) {
  const [chatsUsed, setChatsUsed] = useState<number | null>(null);
  const [messagesToday, setMessagesToday] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([countMyChats(meId), countMessagesSentToday(meId)]).then(([chats, msgs]) => {
      if (!cancelled) { setChatsUsed(chats); setMessagesToday(msgs); }
    });
    return () => { cancelled = true; };
  }, [meId]);

  const Row = ({ label, used, limit }: { label: string; used: number | null; limit: number }) => (
    <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
      <span>{label}</span>
      <span className="font-semibold text-zinc-800 dark:text-zinc-200">
        {used === null ? "…" : `${Math.min(used, limit)} / ${limit}`}
      </span>
    </div>
  );

  return (
    <div className="mt-4 space-y-2 rounded-xl border border-zinc-200/60 dark:border-zinc-700/50 bg-white/40 dark:bg-zinc-900/40 p-3">
      <Row label="Chats" used={chatsUsed} limit={FREE_CHAT_LIMIT} />
      <Row label="Messages today" used={messagesToday} limit={FREE_DAILY_MESSAGE_LIMIT} />
      <p className="pt-1 text-[11px] leading-snug text-zinc-500 dark:text-zinc-500">
        Free-plan limit — upgrade to Sona Purple for unlimited chats and messages.
      </p>
    </div>
  );
}

/* ─── Settings ─── */
export function SettingsModal({ me, onClose, onSaved }: { me: Profile; onClose: () => void; onSaved: (p: Profile) => void }) {
  useBackToClose(onClose);
  const [tab, setTab] = useState<"profile" | "advanced" | "theme" | "subscription">("profile");
  const [name, setName] = useState(me.display_name ?? "");
  const [bio, setBio] = useState(me.bio ?? "");
  const [isAdmin, setIsAdmin] = useState(false);
  const [facebookUrl, setFacebookUrl] = useState(me.facebook_url ?? "");
  const [xUrl, setXUrl] = useState(me.x_url ?? "");
  const [instagramUrl, setInstagramUrl] = useState(me.instagram_url ?? "");
  const [threadsUrl, setThreadsUrl] = useState(me.threads_url ?? "");
  const [busy, setBusy] = useState(false);
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const [avatarUrl, setAvatarUrl] = useState(me.avatar_url ?? "");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [notif, setNotif] = useState<NotificationPermission>(typeof Notification !== "undefined" ? Notification.permission : "default");
  const [emailPrefs, setEmailPrefs] = useState<NotificationPreferences | null>(null);
  const [emailPrefsBusy, setEmailPrefsBusy] = useState(false);
  const sonaTheme = useSonaTheme(!!me.is_pro, me.theme_id, async (id) => {
    onSaved({ ...me, theme_id: id });
    const { error } = await supabase.from("profiles").update({ theme_id: id }).eq("id", me.id);
    if (error) notify.error({ message: "Couldn't sync theme", description: "It's applied here, but may not follow you to other devices." });
  });

  useEffect(() => {
    fetchMyNotificationPreferences(me.id).then(setEmailPrefs).catch(() => {});
  }, [me.id]);

  useEffect(() => {
    let alive = true;
    supabase.from("user_roles").select("role").eq("user_id", me.id).eq("role", "admin").maybeSingle()
      .then(({ data }) => { if (alive) setIsAdmin(!!data); });
    return () => { alive = false; };
  }, [me.id]);

  const toggleEmailPref = async (key: "notify_app_updates" | "notify_offline_messages") => {
    if (!emailPrefs) return;
    const next = { ...emailPrefs, [key]: !emailPrefs[key] };
    setEmailPrefs(next);
    setEmailPrefsBusy(true);
    try {
      await updateMyNotificationPreferences(me.id, { [key]: next[key] });
    } catch {
      setEmailPrefs(emailPrefs);
      notify.error({ message: "Couldn't update", description: "Try again in a moment." });
    } finally {
      setEmailPrefsBusy(false);
    }
  };

  const pickAvatar = () => avatarInputRef.current?.click();

  const uploadAvatar = async (file: File) => {
    if (!file.type.startsWith("image/")) return notify.error({ message: "Invalid file", description: "Only image formats like JPG, PNG, or WEBP are supported." });
    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${me.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const freshUrl = `${pub.publicUrl}?v=${Date.now()}`;
      const { data, error } = await supabase.from("profiles").update({ avatar_url: freshUrl }).eq("id", me.id).select().single();
      if (error) throw error;
      setAvatarUrl(freshUrl);
      onSaved(data as Profile);
      notify.success({ message: "Profile picture updated", description: "Your new photo is now visible to everyone." });
    } catch (e) {
      notify.error({ message: (e as Error).message || "Couldn't upload picture", description: "Check your connection and file size, then try again." });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      let finalName = name.trim() || "Friend";
      if (isReservedSonaName(finalName) && !isAdmin) {
        finalName = fallbackNameFromEmail(me.email);
        setName(finalName);
        notify.error({ message: "\"Sona\" is a reserved name", description: `Only the admin can use that name — we've set yours to "${finalName}" instead.` });
      }
      const { data, error } = await supabase.from("profiles").update({
        display_name: finalName,
        bio: bio.trim() || null,
        facebook_url: facebookUrl.trim() || null,
        x_url: xUrl.trim() || null,
        instagram_url: instagramUrl.trim() || null,
        threads_url: threadsUrl.trim() || null,
      }).eq("id", me.id).select().single();
      if (error) throw error;
      onSaved(data as Profile);
      notify.success({ message: "Saved", description: "Your profile details have been updated." });
      onClose();
    } catch (e) { 
      notify.error({ message: (e as Error).message, description: "Something went wrong while saving. Please try again." }); 
    } finally { setBusy(false); }
  };

  const signOut = async () => { await supabase.auth.signOut(); window.location.href = "/auth"; };

  const paystackCheckout = useServerFn(startPaystackCheckout);
  const deleteAccount = useServerFn(deleteMyAccount);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await deleteAccount();
      notify.success({ message: "Account deleted", description: "All your data has been permanently removed." });
      await supabase.auth.signOut();
      window.location.href = "/auth";
    } catch (e) {
      notify.error({ message: "Couldn't delete account", description: (e as Error).message || "Something went wrong." });
      setDeleting(false);
    }
  };

  const upgrade = async () => {
    setBusy(true);
    try {
      const r = await paystackCheckout({ data: { interval } }) as { url: string };
      notify.success({ message: "Redirecting to Paystack…", description: "You'll be taken to a secure checkout page." });
      window.location.href = r.url;
    } catch (e) { 
      notify.error({ message: (e as Error).message, description: "Something went wrong." }); 
    } finally { setBusy(false); }
  };

  const askNotif = async () => {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setNotif(p);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-md sm:p-4" onClick={onClose}>
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="flex w-full sm:max-w-md flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl border border-white/30 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-2xl shadow-2xl max-h-[92vh] sm:max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-zinc-700 pointer-events-none" />
        
        <div className="shrink-0 px-5 pt-5 pb-2">
          <div className="flex items-center gap-2 mb-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300">
              <Settings className="h-4 w-4" />
            </div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Settings</h3>
            {me.is_pro && (
              <Tooltip title="Purple account">
                <span className="ml-auto inline-flex items-center gap-1 text-zinc-900 dark:text-zinc-100 rounded-full bg-[#8B5CF6]/10 px-2.5 py-1 text-[10px] font-bold border border-[#8B5CF6]/20 cursor-default">
                  <MdDiamond className="h-3 w-3 text-[#8B5CF6]" /> Purple
                </span>
              </Tooltip>
            )}
          </div>
          
          <div className="mb-2 flex gap-1 rounded-2xl bg-zinc-100/50 dark:bg-zinc-900/50 p-1 border border-zinc-200/50 dark:border-zinc-800/50 backdrop-blur-md">
            {(["profile", "advanced", "theme", "subscription"] as const).map((t) => (
              <button 
                key={t} 
                onClick={() => setTab(t)}
                className="relative flex-1 rounded-xl px-2 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors z-10"
              >
                {tab === t && (
                  <motion.div
                    layoutId="active-settings-tab"
                    className="absolute inset-0 rounded-xl bg-white dark:bg-zinc-800 shadow-sm border border-zinc-200/50 dark:border-zinc-700/50"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center justify-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                  {t === "profile" && <User className="h-3.5 w-3.5" />}
                  {t === "advanced" && <Settings className="h-3.5 w-3.5" />}
                  {t === "theme" && <MdPalette className="h-3.5 w-3.5" />}
                  {t === "subscription" && <Crown className="h-3.5 w-3.5" />}
                  {t}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-5 py-3">
          <AnimatePresence mode="wait">
            {tab === "profile" && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-5 pb-4"
              >
                <div className="flex flex-col items-center gap-3 pb-2">
                  <div className="relative group">
                    <Avatar url={avatarUrl} name={name || "?"} size={80} />
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={pickAvatar}
                      disabled={uploadingAvatar}
                      aria-label="Change profile picture"
                      className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-[var(--sona-accent,#E07A5F)] text-white shadow-lg ring-4 ring-white dark:ring-zinc-950 hover:bg-[#d4694f] disabled:opacity-60 transition-colors"
                    >
                      {uploadingAvatar ? <Spin size="small" /> : <Pencil className="h-4 w-4" />}
                    </motion.button>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); e.target.value = ""; }}
                    />
                  </div>
                  <button onClick={pickAvatar} disabled={uploadingAvatar} className="text-xs font-semibold text-[var(--sona-accent,#E07A5F)] hover:underline disabled:opacity-60 transition-colors">
                    {uploadingAvatar ? "Uploading…" : "Change photo"}
                  </button>
                </div>
                
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Display name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)}
                    className="mt-1.5 w-full rounded-xl bg-zinc-50/50 dark:bg-zinc-900/50 px-3 py-2.5 text-sm outline-none transition-all duration-200 border border-zinc-200/50 dark:border-zinc-800/50 focus:border-[var(--sona-accent,#E07A5F)] focus:ring-2 focus:ring-[var(--sona-accent,#E07A5F)]/20 text-zinc-900 dark:text-zinc-100" />
                </div>
                
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">About</label>
                    <span className="text-[10px] text-zinc-400">{bio.length}/140</span>
                  </div>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value.slice(0, 140))}
                    placeholder="Add a short bio…"
                    rows={2}
                    className="mt-1.5 w-full resize-none rounded-xl bg-zinc-50/50 dark:bg-zinc-900/50 px-3 py-2.5 text-sm outline-none transition-all duration-200 border border-zinc-200/50 dark:border-zinc-800/50 focus:border-[var(--sona-accent,#E07A5F)] focus:ring-2 focus:ring-[var(--sona-accent,#E07A5F)]/20 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
                  />
                </div>
                
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Social links (optional)</label>
                  <div className="mt-2 grid grid-cols-2 gap-2.5">
                    <input value={facebookUrl} onChange={(e) => setFacebookUrl(e.target.value)} placeholder="Facebook URL" className="w-full rounded-xl bg-zinc-50/50 dark:bg-zinc-900/50 px-3 py-2.5 text-xs outline-none transition-all duration-200 border border-zinc-200/50 dark:border-zinc-800/50 focus:border-[var(--sona-accent,#E07A5F)] focus:ring-2 focus:ring-[var(--sona-accent,#E07A5F)]/20 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400" />
                    <input value={xUrl} onChange={(e) => setXUrl(e.target.value)} placeholder="X (Twitter) URL" className="w-full rounded-xl bg-zinc-50/50 dark:bg-zinc-900/50 px-3 py-2.5 text-xs outline-none transition-all duration-200 border border-zinc-200/50 dark:border-zinc-800/50 focus:border-[var(--sona-accent,#E07A5F)] focus:ring-2 focus:ring-[var(--sona-accent,#E07A5F)]/20 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400" />
                    <input value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} placeholder="Instagram URL" className="w-full rounded-xl bg-zinc-50/50 dark:bg-zinc-900/50 px-3 py-2.5 text-xs outline-none transition-all duration-200 border border-zinc-200/50 dark:border-zinc-800/50 focus:border-[var(--sona-accent,#E07A5F)] focus:ring-2 focus:ring-[var(--sona-accent,#E07A5F)]/20 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400" />
                    <input value={threadsUrl} onChange={(e) => setThreadsUrl(e.target.value)} placeholder="Threads URL" className="w-full rounded-xl bg-zinc-50/50 dark:bg-zinc-900/50 px-3 py-2.5 text-xs outline-none transition-all duration-200 border border-zinc-200/50 dark:border-zinc-800/50 focus:border-[var(--sona-accent,#E07A5F)] focus:ring-2 focus:ring-[var(--sona-accent,#E07A5F)]/20 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400" />
                  </div>
                </div>
                <p className="text-xs text-zinc-500 text-center pt-2">Signed in as <span className="font-medium text-zinc-700 dark:text-zinc-300">{me.email}</span></p>
              </motion.div>
            )}

            {tab === "advanced" && (
              <motion.div
                key="advanced"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4 pb-4 text-sm"
              >
                <div className="rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-900/50 p-4 backdrop-blur-sm">
                  <div className="flex items-center gap-2.5 font-bold text-zinc-900 dark:text-zinc-100"><Bell className="h-4 w-4 text-[var(--sona-accent,#E07A5F)]" /> Push notifications</div>
                  <p className="mt-1.5 text-xs text-zinc-500">Status: <span className="font-medium capitalize">{notif}</span></p>
                  {notif !== "granted" && (
                    <motion.button whileTap={{ scale: 0.95 }} onClick={askNotif} className="mt-3 rounded-xl bg-zinc-200/50 dark:bg-zinc-800/50 px-3 py-2 text-xs font-semibold hover:bg-[var(--sona-accent,#E07A5F)]/10 hover:text-[var(--sona-accent,#E07A5F)] text-zinc-700 dark:text-zinc-300 border border-zinc-200/50 dark:border-zinc-800/50 transition-all">Enable notifications</motion.button>
                  )}
                </div>
                
                <div className="rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-900/50 p-4 backdrop-blur-sm">
                  <div className="flex items-center gap-2.5 font-bold text-zinc-900 dark:text-zinc-100"><Mail className="h-4 w-4 text-[var(--sona-accent,#E07A5F)]" /> Email notifications</div>
                  <p className="mt-1.5 text-xs text-zinc-500">Sent to {me.email || "your account email"} — separate from in-app push notifications.</p>
                  <div className="mt-4 space-y-3">
                    <label className="flex items-center justify-between gap-3 cursor-pointer group">
                      <span className="text-xs text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors">
                        New message while I'm offline
                        <span className="block text-[10px] text-zinc-500 mt-0.5">Get an email so you don't miss it.</span>
                      </span>
                      <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-zinc-200 dark:bg-zinc-800 transition-colors focus-within:ring-2 focus-within:ring-[var(--sona-accent,#E07A5F)]/20">
                        <input
                          type="checkbox"
                          checked={emailPrefs?.notify_offline_messages ?? true}
                          disabled={!emailPrefs || emailPrefsBusy}
                          onChange={() => toggleEmailPref("notify_offline_messages")}
                          className="peer sr-only"
                        />
                        <span className="absolute left-1 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-5 peer-checked:bg-[var(--sona-accent,#E07A5F)]" />
                      </div>
                    </label>
                    <label className="flex items-center justify-between gap-3 cursor-pointer group">
                      <span className="text-xs text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors">
                        App updates
                        <span className="block text-[10px] text-zinc-500 mt-0.5">Get an email about new announcements.</span>
                      </span>
                      <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-zinc-200 dark:bg-zinc-800 transition-colors focus-within:ring-2 focus-within:ring-[var(--sona-accent,#E07A5F)]/20">
                        <input
                          type="checkbox"
                          checked={emailPrefs?.notify_app_updates ?? true}
                          disabled={!emailPrefs || emailPrefsBusy}
                          onChange={() => toggleEmailPref("notify_app_updates")}
                          className="peer sr-only"
                        />
                        <span className="absolute left-1 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-5 peer-checked:bg-[var(--sona-accent,#E07A5F)]" />
                      </div>
                    </label>
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-900/50 p-4 backdrop-blur-sm">
                  <div className="flex items-center gap-2.5 font-bold text-zinc-900 dark:text-zinc-100"><Music className="h-4 w-4 text-[var(--sona-accent,#E07A5F)]" /> Sounds</div>
                  <div className="mt-3"><SoundSettings /></div>
                </div>

                <div className="rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-900/50 p-4 backdrop-blur-sm">
                  <div className="flex items-center gap-2.5 font-bold text-zinc-900 dark:text-zinc-100"><Shield className="h-4 w-4 text-[var(--sona-accent,#E07A5F)]" /> Security</div>
                  <ul className="mt-3 space-y-2 text-xs text-zinc-500">
                    <li className="flex items-center gap-2"><Lock className="h-3.5 w-3.5 text-zinc-400" /> End-to-end AES-GCM encryption for hidden chats</li>
                    <li className="flex items-center gap-2"><Shield className="h-3.5 w-3.5 text-zinc-400" /> Passcodes never leave your device</li>
                    <li className="flex items-center gap-2"><CheckSquare className="h-3.5 w-3.5 text-zinc-400" /> Row-level security on every message</li>
                  </ul>
                </div>

                <div className="rounded-2xl border border-red-500/20 dark:border-red-500/30 bg-red-500/5 p-4">
                  <div className="flex items-center gap-2.5 font-bold text-red-500"><Trash2 className="h-4 w-4" /> Delete account</div>
                  <p className="mt-1.5 text-xs text-zinc-500 leading-relaxed">
                    Permanently deletes your profile, messages, statuses, and every other trace of your data. This cannot be undone.
                  </p>
                  {!confirmingDelete ? (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setConfirmingDelete(true)}
                      className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-500/20 transition-all"
                    >
                      Delete my account…
                    </motion.button>
                  ) : (
                    <div className="mt-3 space-y-3">
                      <p className="text-xs text-zinc-700 dark:text-zinc-300">
                        Type <span className="font-mono font-bold text-red-500">DELETE</span> to confirm.
                      </p>
                      <input
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        placeholder="DELETE"
                        className="w-full rounded-xl border border-red-500/30 bg-white/60 dark:bg-zinc-950/60 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-red-500/20 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
                      />
                      <div className="flex items-center gap-2">
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={handleDeleteAccount}
                          disabled={deleteConfirmText !== "DELETE" || deleting}
                          className="flex items-center gap-1.5 rounded-xl bg-red-500 px-3 py-2 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                          {deleting && <Spin size="small" />} {deleting ? "Deleting…" : "Permanently delete"}
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => { setConfirmingDelete(false); setDeleteConfirmText(""); }}
                          disabled={deleting}
                          className="rounded-xl px-3 py-2 text-xs font-medium text-zinc-500 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 transition-all"
                        >
                          Cancel
                        </motion.button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {tab === "theme" && (
              <motion.div
                key="theme"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4 pb-4"
              >
                <div className="rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-900/50 p-4 backdrop-blur-sm">
                  <div className="font-bold text-zinc-900 dark:text-zinc-100">Chat theme</div>
                  <p className="mt-1.5 text-xs text-zinc-500 leading-relaxed">
                    Pick an accent color for pins, selection highlights, and your message bubbles.
                    {!me.is_pro && " Unlock the rest with Sona Pro."}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {sonaTheme.presets.map((preset) => {
                      const locked = preset.pro && !me.is_pro;
                      const active = sonaTheme.themeId === preset.id;
                      return (
                        <motion.button
                          key={preset.id}
                          type="button"
                          disabled={locked}
                          whileTap={!locked ? { scale: 0.95 } : undefined}
                          onClick={() => sonaTheme.setThemeId(preset.id)}
                          className={`group relative flex flex-col items-start gap-2.5 rounded-xl border p-3 text-left transition-all ${
                            active
                              ? "border-transparent ring-2"
                              : "border-zinc-200/50 dark:border-zinc-800/50 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50"
                          } ${locked ? "cursor-not-allowed opacity-60" : ""}`}
                          style={active ? { ["--tw-ring-color" as string]: preset.accent } : undefined}
                        >
                          <div
                            className="flex h-10 w-full items-center justify-between rounded-lg px-2.5 transition-transform group-hover:scale-[1.02]"
                            style={{ background: preset.bg, border: "1px solid rgba(0,0,0,0.06)" }}
                          >
                            <span className="h-5 w-5 rounded-full shadow-sm" style={{ backgroundColor: preset.accent }} />
                            {active && (
                              <span className="grid h-5 w-5 place-items-center rounded-full" style={{ backgroundColor: preset.accent }}>
                                <Check className="h-3 w-3 text-white" strokeWidth={4} />
                              </span>
                            )}
                            {locked && (
                              <span className="grid h-5 w-5 place-items-center rounded-full bg-black/30">
                                <Lock className="h-3 w-3 text-white" />
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{preset.name}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                  {!me.is_pro && (
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setTab("subscription")}
                      className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#8B5CF6]/10 py-2.5 text-xs font-bold text-[#8B5CF6] hover:bg-[#8B5CF6]/15 transition-all"
                    >
                      <Crown className="h-3.5 w-3.5" />
                      Unlock all themes with Pro
                    </motion.button>
                  )}
                </div>
              </motion.div>
            )}

            {tab === "subscription" && (
              <motion.div
                key="subscription"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4 pb-4 text-sm"
              >
                {/* Free plan — always shown so people can see what they're on / what they'd give up */}
                <div className={`rounded-3xl border p-5 ${!me.is_pro ? "border-zinc-300 dark:border-zinc-600" : "border-zinc-200/70 dark:border-zinc-700/50"} bg-white/40 dark:bg-zinc-900/40`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-zinc-900 dark:text-zinc-100">
                      <span>Free</span>
                      {!me.is_pro && (
                        <span className="rounded-full bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
                          Current plan
                        </span>
                      )}
                    </div>
                    <div className="text-lg font-black text-zinc-900 dark:text-zinc-100">
                      R0<span className="text-[11px] font-semibold text-zinc-500">/month</span>
                    </div>
                  </div>
                  <ul className="mt-3 space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
                    <li>Up to {FREE_CHAT_LIMIT} chats</li>
                    <li>{FREE_DAILY_MESSAGE_LIMIT} messages a day</li>
                    <li>Pin up to {FREE_PIN_LIMIT} chats</li>
                    <li>Photos, voice notes, files, groups & invite links</li>
                  </ul>
                </div>

                {/* 3D tilt card wrapper */}
                <div
                  className="relative group"
                  style={{ perspective: "1000px" }}
                  onMouseMove={(e) => {
                    const card = e.currentTarget.querySelector<HTMLElement>("[data-tilt-surface]");
                    if (!card) return;
                    const rect = card.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    const centerX = rect.width / 2;
                    const centerY = rect.height / 2;
                    const rotateX = ((y - centerY) / centerY) * -5;
                    const rotateY = ((x - centerX) / centerX) * 5;
                    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
                  }}
                  onMouseLeave={(e) => {
                    const card = e.currentTarget.querySelector<HTMLElement>("[data-tilt-surface]");
                    if (!card) return;
                    card.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)";
                  }}
                >
                  {/* Tilt surface */}
                  <div
                    data-tilt-surface
                    className="relative overflow-hidden rounded-3xl border border-white/20 dark:border-zinc-700/50 bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-orange-500/5 p-6 shadow-2xl backdrop-blur-xl transition-transform duration-200 ease-out"
                    style={{ transformStyle: "preserve-3d" }}
                  >
                    {/* Ambient Glow */}
                    <div className="absolute -top-20 -right-20 w-40 h-40 bg-violet-500/20 rounded-full blur-3xl transition-opacity group-hover:opacity-100 opacity-50 pointer-events-none" />
                    <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-orange-500/20 rounded-full blur-3xl transition-opacity group-hover:opacity-100 opacity-50 pointer-events-none" />
                    
                    {/* Content with translateZ */}
                    <div className="relative z-10" style={{ transform: "translateZ(30px)" }}>
                      <div className="flex items-center gap-2.5 font-bold text-zinc-900 dark:text-zinc-100 tracking-wide">
                        <MdDiamond className="h-5 w-5 text-[#8B5CF6] drop-shadow" />
                        <span>Sona Purple</span>
                      </div>

                      <ul className="mt-4 space-y-3 text-xs text-zinc-700 dark:text-zinc-300">
                        <li className="flex items-center gap-2.5">
                          <Sparkles className="h-4 w-4 text-[#8B5CF6] drop-shadow" />
                          <span>Unlimited AI chat summaries</span>
                        </li>
                        <li className="flex items-center gap-2.5">
                          <MdLock className="h-4 w-4 text-[#8B5CF6] drop-shadow" />
                          <span>Unlimited hidden encrypted chats</span>
                        </li>
                        <li className="flex items-center gap-2.5">
                          <MdPalette className="h-4 w-4 text-[#8B5CF6] drop-shadow" />
                          <span>Premium themes & custom chat backgrounds</span>
                        </li>
                        <li className="flex items-center gap-2.5">
                          <MdVideoCall className="h-4 w-4 text-[#8B5CF6] drop-shadow" />
                          <span>HD video calls with spatial audio</span>
                        </li>
                        <li className="flex items-center gap-2.5">
                          <MdPhone className="h-4 w-4 text-[#8B5CF6] drop-shadow" />
                          <span>Crystal-clear voice calls</span>
                        </li>
                        <li className="flex items-center gap-2.5">
                          <MdFileDownload className="h-4 w-4 text-[#8B5CF6] drop-shadow" />
                          <span>Export chat messages (JSON / PDF)</span>
                        </li>
                        <li className="flex items-center gap-2.5">
                          <MdCloudUpload className="h-4 w-4 text-[#8B5CF6] drop-shadow" />
                          <span>Unlimited media uploads (photos, videos, files)</span>
                        </li>
                        <li className="flex items-center gap-2.5">
                          <Zap className="h-4 w-4 text-[#8B5CF6] drop-shadow" />
                          <span>Unlimited chats & unlimited daily messages</span>
                        </li>
                      </ul>

                      {!me.is_pro && <FreeTierUsage meId={me.id} />}

                      {!me.is_pro && (
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          {(["monthly", "yearly"] as const).map((iv) => {
                            const selected = interval === iv;
                            return (
                              <button
                                key={iv}
                                type="button"
                                onClick={() => setInterval(iv)}
                                className={`rounded-2xl border px-3 py-3 text-left transition ${selected ? "border-[#8B5CF6] bg-[#8B5CF6]/10" : "border-zinc-200/70 dark:border-zinc-700/60 bg-white/40 dark:bg-zinc-900/40"}`}
                              >
                                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{iv === "monthly" ? "Monthly" : "Yearly"}</div>
                                <div className="mt-1 text-sm font-black text-zinc-900 dark:text-zinc-100">
                                  {iv === "monthly" ? PRICING.monthly.label : PRICING.yearly.label}
                                  <span className="text-[10px] font-semibold text-zinc-500">{iv === "monthly" ? PRICING.monthly.per : PRICING.yearly.per}</span>
                                </div>
                                <div className="text-[10px] text-zinc-500">
                                  {iv === "monthly" ? "Billed every month" : `${PRICING.yearly.perMonthLabel}/mo · save ${PRICING.yearly.savePercent}%`}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {me.is_pro ? (
                        <div className="mt-6 space-y-3">
                          <div className="flex items-center gap-2 text-xs font-bold text-[#8B5CF6]">
                            <Zap className="h-4 w-4 drop-shadow" />
                            <span>You’re on Purple</span>
                          </div>
                          <a
                            href="/pricing#cancel"
                            className="block w-full rounded-2xl border border-zinc-200 dark:border-zinc-700 px-4 py-3 text-center text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          >
                            Cancel plan
                          </a>
                        </div>
                      ) : (
                        <motion.button
                          whileTap={{ scale: 0.98 }}
                          disabled={busy}
                          onClick={upgrade}
                          className="mt-4 w-full rounded-2xl bg-[#8B5CF6] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition-all hover:-translate-y-0.5 hover:bg-[#7c3aed] hover:shadow-xl hover:shadow-violet-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
                          style={{ transform: "translateZ(35px)" }}
                        >
                          {busy ? (
                            <span className="flex items-center justify-center gap-2">
                              <Spin size="small" />
                              Processing…
                            </span>
                          ) : (
                            `Upgrade — ${interval === "monthly" ? `${PRICING.monthly.label}${PRICING.monthly.per}` : `${PRICING.yearly.label}${PRICING.yearly.per}`}`
                          )}
                        </motion.button>
                      )}

                      <a
                        href="/pricing"
                        className="mt-3 block text-center text-[11px] font-semibold text-[#8B5CF6] hover:underline"
                      >
                        See full pricing details
                      </a>

                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="shrink-0 flex items-center justify-between gap-3 border-t border-zinc-200/50 dark:border-zinc-800/50 px-5 py-4 bg-white/50 dark:bg-zinc-950/50 backdrop-blur-xl">
          <motion.button whileTap={{ scale: 0.95 }} onClick={signOut} className="rounded-xl px-3 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-500/10 flex items-center gap-1.5 transition-colors">
            <LogOut className="h-4 w-4" /> Sign out
          </motion.button>
          <div className="flex gap-2">
            <motion.button whileTap={{ scale: 0.95 }} onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors">Close</motion.button>
            {tab === "profile" && (
              <motion.button 
                whileTap={{ scale: 0.95 }}
                disabled={busy} 
                onClick={save} 
                className="rounded-xl bg-[var(--sona-accent,#E07A5F)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60 hover:bg-[#d4694f] transition-colors shadow-lg shadow-[var(--sona-accent,#E07A5F)]/20 flex items-center gap-2"
              >
                {busy ? <><Spin size="small" /> Saving…</> : "Save"}
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Unlock ─── */
export function UnlockModal({ chatId, onUnlocked, onCancel }: { chatId: string; onUnlocked: () => void; onCancel: () => void }) {
  useBackToClose(onCancel);
  const [pass, setPass] = useState("");
  const submit = () => {
    if (!pass) return;
    unlockChat(chatId, pass);
    onUnlocked();
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-md p-4" onClick={onCancel}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} 
        animate={{ opacity: 1, scale: 1 }} 
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="w-full max-w-sm rounded-2xl border border-zinc-200/50 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-2xl p-6 shadow-2xl" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--sona-accent,#E07A5F)]/10 text-[var(--sona-accent,#E07A5F)]">
            <Lock className="h-5 w-5" />
          </div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Unlock hidden chat</h3>
        </div>
        <p className="text-xs text-zinc-500 mb-4 leading-relaxed">Enter your passcode to decrypt messages. It never leaves your device.</p>
        <input 
          type="password" 
          value={pass} 
          onChange={(e) => setPass(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder="Passcode"
          className="w-full rounded-xl bg-zinc-50/50 dark:bg-zinc-900/50 px-3 py-3 text-sm outline-none transition-all duration-200 border border-zinc-200/50 dark:border-zinc-800/50 focus:border-[var(--sona-accent,#E07A5F)] focus:ring-2 focus:ring-[var(--sona-accent,#E07A5F)]/20 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 mb-5" 
        />
        <div className="flex justify-end gap-3">
          <motion.button whileTap={{ scale: 0.95 }} onClick={onCancel} className="rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors">Cancel</motion.button>
          <motion.button whileTap={{ scale: 0.95 }} onClick={submit} className="rounded-xl bg-[var(--sona-accent,#E07A5F)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#d4694f] transition-colors shadow-lg shadow-[var(--sona-accent,#E07A5F)]/20">Unlock</motion.button>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Saved Messages ─── */
export function SavedMessagesModal({
  messages, chats, meId, loading, decrypted, onClose, onOpen, onRemove,
}: {
  messages: (MessageRow & { chat_id: string })[];
  chats: ChatWithMeta[];
  meId: string;
  loading: boolean;
  decrypted?: Record<string, string>;
  onClose: () => void;
  onOpen: (chatId: string, messageId: string) => void;
  onRemove: (msg: MessageRow) => void;
}) {
  useBackToClose(onClose);
  const chatsById = useMemo(() => new Map(chats.map((c) => [c.id, c])), [chats]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-md" />
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="relative w-full rounded-t-3xl md:rounded-3xl border-t md:border border-zinc-200/50 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-2xl shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.3)] md:shadow-2xl md:mx-auto md:mb-8 md:max-w-md max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-zinc-700 pointer-events-none" />
        <div className="pt-3 pb-1 flex justify-center md:hidden">
          <div className="h-1.5 w-12 rounded-full bg-zinc-300/50 dark:bg-zinc-700/50" />
        </div>
        
        <div className="px-5 pt-3 pb-4 flex items-center justify-between border-b border-zinc-200/50 dark:border-zinc-800/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-500/10 text-[var(--sona-accent,#E07A5F)]">
              <Bookmark className="h-4 w-4" />
            </div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Saved Messages</h3>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" aria-label="Close">
            <X className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
          {loading ? (
            <div className="space-y-3 p-2">
              {[0, 1, 2].map((i) => <Skeleton key={i} active title={false} paragraph={{ rows: 2 }} />)}
            </div>
          ) : messages.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={<span className="text-sm text-zinc-500">Nothing saved yet — long-press any message and tap "Save message".</span>}
              className="py-12"
            />
          ) : (
            <motion.div layout className="space-y-2">
              <AnimatePresence>
                {messages.map((m, i) => {
                  const chat = chatsById.get(m.chat_id);
                  const title = chat ? chatTitle(chat, meId) : "Unknown chat";
                  return (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ delay: i * 0.03 }}
                      className="group flex items-start gap-3 rounded-2xl px-3 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all cursor-pointer border border-transparent hover:border-zinc-200/50 dark:hover:border-zinc-800/50"
                      onClick={() => onOpen(m.chat_id, m.id)}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-bold text-[var(--sona-accent,#E07A5F)]">{title}</span>
                          <span suppressHydrationWarning className="shrink-0 text-[10px] font-medium text-zinc-400">
                            {new Date(m.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="mt-1 truncate text-sm text-zinc-700 dark:text-zinc-300">
                          <MessagePreview msg={m} decrypted={decrypted} />
                        </div>
                      </div>
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => { e.stopPropagation(); onRemove(m); }}
                        aria-label="Remove from Saved Messages"
                        className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-500/10 transition-all"
                      >
                        <BookmarkX className="h-4 w-4 text-red-500" />
                      </motion.button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
