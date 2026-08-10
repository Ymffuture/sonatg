import { motion, AnimatePresence } from "framer-motion";
import {
  CloseOutlined,
  EditOutlined,
  MessageOutlined,
  BlockOutlined,
  UnlockOutlined,
  FlagOutlined,
  CalendarOutlined,
  PictureOutlined,
  WarningOutlined,
  CrownOutlined,
  RobotOutlined,
  RightOutlined,
  ZoomInOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import { Image, Button, Tag, Divider, Tooltip } from "antd";
import type { Profile } from "@/lib/db";
import { fmtLastSeen } from "@/lib/db";

const MOD_META: Record<string, { label: string; color: string; note: string }> = {
  warn: { label: "Warning issued", color: "#F59E0B", note: "An administrator has warned this account." },
  suspend: { label: "Suspended", color: "#E07A5F", note: "Messaging and other features are disabled." },
  ban: { label: "Banned", color: "#EF4444", note: "This account is banned from Sona." },
};

export function ProfileViewModal({
  profile, isSelf, onClose, onMessage, onEdit, moderation, onReport,
  online, lastSeen, onOpenMedia, isBlocked, onToggleBlock,
}: {
  profile: Profile;
  isSelf: boolean;
  onClose: () => void;
  onMessage?: () => void;
  onEdit?: () => void;
  moderation?: { action: string; reason: string | null; expires_at: string | null } | null;
  onReport?: () => void;
  online?: boolean;
  lastSeen?: string | null;
  onOpenMedia?: () => void;
  isBlocked?: boolean;
  onToggleBlock?: () => void;
}) {
  const joined = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : null;
  const mod = moderation && MOD_META[moderation.action] ? { ...MOD_META[moderation.action]!, ...moderation } : null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-3xl border border-white/20 dark:border-white/10 bg-white/90 dark:bg-[#1a1a1a]/90 backdrop-blur-xl shadow-2xl scrollbar-thin"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 flex items-center justify-end px-4 py-3 bg-white/50 dark:bg-[#1a1a1a]/50 backdrop-blur-md">
          <Tooltip title="Close" placement="bottom">
            <button
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-full hover:bg-[#E07A5F]/10 transition"
              aria-label="Close"
            >
              <CloseOutlined className="text-sm text-[#2D3436] dark:text-[#E8E8E8]" />
            </button>
          </Tooltip>
        </div>

        {/* Profile Hero */}
        <div className="flex flex-col items-center text-center px-6 pb-2">
          {/* Zoomable Avatar */}
          <div className="relative">
            {profile.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt={profile.display_name}
                width={128}
                height={128}
                className="rounded-full object-cover border-4 border-white dark:border-[#2A2A2A] shadow-2xl"
                preview={{
                  mask: (
                    <div className="flex items-center justify-center w-full h-full rounded-full bg-black/30 text-white transition">
                      <ZoomInOutlined className="text-xl" />
                    </div>
                  ),
                  maskClassName: "rounded-full",
                }}
              />
            ) : (
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[#E07A5F] to-[#F4A261] flex items-center justify-center text-5xl font-bold text-white shadow-2xl border-4 border-white dark:border-[#2A2A2A]">
                {profile.display_name.charAt(0).toUpperCase()}
              </div>
            )}

            {/* Floating Badges */}
            <div className="absolute -bottom-1 -right-1 flex gap-1">
              {profile.is_pro && (
                <Tooltip title="Pro member">
                  <div className="h-7 w-7 rounded-full bg-[#E07A5F] flex items-center justify-center shadow-md border-2 border-white dark:border-[#1a1a1a]">
                    <CrownOutlined className="text-xs text-white" />
                  </div>
                </Tooltip>
              )}
              {profile.is_ai && (
                <Tooltip title="AI Assistant">
                  <div className="h-7 w-7 rounded-full bg-[#2A2A2A] flex items-center justify-center shadow-md border-2 border-white dark:border-[#1a1a1a]">
                    <RobotOutlined className="text-xs text-[#E07A5F]" />
                  </div>
                </Tooltip>
              )}
            </div>
          </div>

          {/* Name */}
          <h2 className="mt-5 text-xl font-bold text-[#2D3436] dark:text-[#E8E8E8]">
            {profile.display_name}
          </h2>

          {/* Presence */}
          {!isSelf && !profile.is_ai && (online !== undefined || lastSeen !== undefined) && (
            <div className="mt-2">
              {online ? (
                <Tag className="rounded-full px-3 py-0.5 text-xs font-medium border-0 bg-[#22c55e]/15 text-[#22c55e]">
                  Online
                </Tag>
              ) : lastSeen ? (
                <Tag className="rounded-full px-3 py-0.5 text-xs font-medium border-0 bg-[#F5F0E8] dark:bg-[#2A2A2A] text-[#8C8C8C]">
                  <CalendarOutlined className="mr-1" />
                  {fmtLastSeen(lastSeen)}
                </Tag>
              ) : (
                <Tag className="rounded-full px-3 py-0.5 text-xs font-medium border-0 bg-[#F5F0E8] dark:bg-[#2A2A2A] text-[#8C8C8C]">
                  Offline
                </Tag>
              )}
            </div>
          )}
        </div>

        {/* About Section */}
        {profile.bio && (
          <div className="px-6 py-2">
            <Divider className="my-3 border-[#E07A5F]/10" />
            <div className="text-left">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#8C8C8C] mb-1.5">About</p>
              <p className="text-sm text-[#5C5C5C] dark:text-[#B8B8B8] leading-relaxed font-medium">
                {profile.bio}
              </p>
            </div>
          </div>
        )}

        {/* Moderation Warning */}
        <AnimatePresence>
          {mod && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="px-6 overflow-hidden"
            >
              <div
                className="rounded-2xl px-4 py-3 text-left"
                style={{ backgroundColor: `${mod.color}15`, border: `1px solid ${mod.color}40` }}
              >
                <p className="flex items-center gap-1.5 text-xs font-bold" style={{ color: mod.color }}>
                  <WarningOutlined /> {mod.label}
                </p>
                <p className="mt-1 text-xs text-[#5C5C5C] dark:text-[#B8B8B8]">{mod.reason || mod.note}</p>
                {mod.expires_at && (
                  <p className="mt-1 text-[11px] text-[#8C8C8C]">Until {new Date(mod.expires_at).toLocaleDateString()}</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Info & Media Links */}
        <div className="px-6 py-2">
          <Divider className="my-3 border-[#E07A5F]/10" />
          <div className="space-y-3">
            {joined && (
              <div className="flex items-center gap-3 text-sm text-[#8C8C8C]">
                <div className="h-9 w-9 rounded-xl bg-[#F5F0E8] dark:bg-[#2A2A2A] flex items-center justify-center">
                  <CalendarOutlined className="text-[#E07A5F]" />
                </div>
                <span className="font-medium">Joined {joined}</span>
              </div>
            )}

            {!isSelf && onOpenMedia && (
              <button
                onClick={onOpenMedia}
                className="flex w-full items-center gap-3 rounded-xl border border-[#E07A5F]/10 bg-[#F5F0E8] dark:bg-[#2A2A2A] px-3 py-3 text-left hover:bg-[#EFE6D8] dark:hover:bg-[#333] transition group"
              >
                <div className="h-9 w-9 rounded-xl bg-[#E07A5F]/10 flex items-center justify-center text-[#E07A5F]">
                  <PictureOutlined className="text-lg" />
                </div>
                <span className="flex-1 text-sm font-semibold text-[#2D3436] dark:text-[#E8E8E8]">
                  Media, links, and docs
                </span>
                <RightOutlined className="text-xs text-[#8C8C8C] group-hover:translate-x-0.5 transition-transform" />
              </button>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 space-y-2.5">
          {isSelf ? (
            <Button
              type="primary"
              block
              size="large"
              icon={<EditOutlined />}
              onClick={onEdit}
              style={{ backgroundColor: "#E07A5F", borderColor: "#E07A5F", borderRadius: 9999, fontWeight: 600, height: 44 }}
              className="hover:opacity-90 transition shadow-lg"
            >
              Edit profile
            </Button>
          ) : (
            <>
              {!profile.is_ai && onMessage && (
                <Button
                  type="primary"
                  block
                  size="large"
                  icon={<MessageOutlined />}
                  onClick={onMessage}
                  style={{ backgroundColor: "#E07A5F", borderColor: "#E07A5F", borderRadius: 9999, fontWeight: 600, height: 44 }}
                  className="hover:opacity-90 transition shadow-lg"
                >
                  Message
                </Button>
              )}
              {onToggleBlock && (
                <Button
                  block
                  size="large"
                  icon={isBlocked ? <UnlockOutlined /> : <BlockOutlined />}
                  onClick={onToggleBlock}
                  style={{ borderRadius: 9999, fontWeight: 600, height: 44 }}
                  className="bg-[#F5F0E8] dark:bg-[#2A2A2A] text-[#2D3436] dark:text-[#E8E8E8] border-0 hover:bg-[#EFE6D8] dark:hover:bg-[#333] transition"
                >
                  {isBlocked ? "Unblock" : "Block"}
                </Button>
              )}
              {onReport && (
                <Button
                  block
                  size="large"
                  icon={<FlagOutlined />}
                  onClick={onReport}
                  danger
                  ghost
                  style={{ borderRadius: 9999, fontWeight: 600, height: 44 }}
                  className="border-red-500/30 text-red-500 hover:border-red-500 hover:text-red-500 transition"
                >
                  Report
                </Button>
              )}
            </>
          )}
        </div>

        {/* Swiftmeta App Info Footer */}
        <div className="px-6 pb-6 pt-0 text-center">
          <Divider className="my-2 border-[#E07A5F]/10" />
          <div className="flex flex-col items-center gap-1">
            <p className="text-[10px] text-[#8C8C8C] flex items-center justify-center gap-1.5 font-medium">
              <InfoCircleOutlined />
              <span>Powered by Swiftmeta</span>
            </p>
            <p className="text-[10px] text-[#8C8C8C]/60 max-w-[240px] leading-tight">
              Sona — Talk Gold. Private messaging, voice & video calls, and AI-powered conversations.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
