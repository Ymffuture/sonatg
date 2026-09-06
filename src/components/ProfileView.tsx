import { motion, AnimatePresence } from "framer-motion";
import {
  CloseOutlined,
  EditOutlined,
  CalendarOutlined,
  FlagOutlined,
  BlockOutlined,
  UnlockOutlined,
  PictureOutlined,
  LinkOutlined,
  FileTextOutlined,
  RightOutlined,
  ZoomInOutlined,
  ExclamationCircleOutlined,
  SafetyCertificateOutlined,
  ShareAltOutlined,
} from "@ant-design/icons";
import {
  Button,
  Tooltip,
  Badge,
  Divider,
  Image,
  Watermark,
  Typography,
  Alert,
} from "antd";
import type { Profile } from "@/lib/db";
import { fmtLastSeen } from "@/lib/db";
import { FaFacebookF, FaXTwitter, FaInstagram, FaThreads } from "react-icons/fa6";
import { LuMessageSquareText } from "react-icons/lu";
import { VscVerifiedFilled } from "react-icons/vsc";

const { Text, Title } = Typography;

const MOD_META: Record<string, { label: string; color: string; note: string }> = {
  warn: { label: "Warning issued", color: "#F59E0B", note: "An administrator has warned this account." },
  suspend: { label: "Suspended", color: "#E07A5F", note: "Messaging and other features are disabled." },
  ban: { label: "Banned", color: "#EF4444", note: "This account is banned from Sona." },
};

export function ProfileViewModal({
  profile, isSelf, onClose, onMessage, onEdit, moderation, onReport,
  online, lastSeen, onOpenMedia, isBlocked, onToggleBlock, hasStatus,
  socials, onShareContact, messageDisabled, messageDisabledReason,
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
  hasStatus?: boolean;
  messageDisabled?: boolean;
  messageDisabledReason?: string;
  socials?: {
    facebook?: string;
    x?: string;
    instagram?: string;
    threads?: string;
  };
  onShareContact?: () => void;
}) {
  const joined = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })
    : null;
  const mod = moderation && MOD_META[moderation.action]
    ? { ...MOD_META[moderation.action]!, ...moderation }
    : null;

  const initial = profile.display_name?.charAt(0).toUpperCase() ?? "?";
  const fallbackSvg = `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="112" height="112"><rect width="112" height="112" fill="%23E07A5F"/><text x="56" y="56" dominant-baseline="central" text-anchor="middle" fill="white" font-size="40" font-weight="bold" font-family="system-ui">${initial}</text></svg>`
  )}`;

  const hasSocials = socials && (socials.facebook || socials.x || socials.instagram || socials.threads);
  const isPremium = profile.is_pro || profile.is_ai;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-md p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 20 }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="relative w-full max-w-sm rounded-[2rem] border border-white/20 dark:border-white/10 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25),0_0_0_1px_rgba(255,255,255,0.1)_inset] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle ambient background glows */}
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-rose-500/10 dark:bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-violet-500/10 dark:bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />
        
        {/* Top highlight edge */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-white/20 pointer-events-none" />

        <Watermark
          content={profile.is_pro ? profile.display_name : ""}
          font={{ color: "rgba(128,128,128,0.06)", fontSize: 10 }}
          gap={[300, 240]}
          rotate={-22}
          className="h-full"
        >
          <div className="relative max-h-[85vh] overflow-y-auto scrollbar-thin p-6 z-10">
            {/* Header */}
            <div className="flex justify-end">
              <Tooltip title="Close" placement="bottom">
                <Button
                  type="text"
                  shape="circle"
                  icon={<CloseOutlined className="text-zinc-500 dark:text-zinc-400" />}
                  onClick={onClose}
                  className="hover:!bg-zinc-100 dark:hover:!bg-zinc-800 !transition-colors"
                />
              </Tooltip>
            </div>

            {/* Avatar + Name */}
            <div className="flex flex-col items-center text-center -mt-1">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.05, type: "spring", stiffness: 260, damping: 20 }}
                className="relative"
              >
                <div className={`relative rounded-full p-[2px] ${
                  isPremium
                    ? "bg-gradient-to-tr from-amber-300 via-rose-400 to-violet-500 shadow-lg shadow-violet-500/20"
                    : hasStatus 
                      ? "ring-[3px] ring-[#25D366] ring-offset-2 ring-offset-white dark:ring-offset-zinc-950" 
                      : "bg-zinc-200 dark:bg-zinc-800"
                }`}>
                  <div className="rounded-full bg-white dark:bg-zinc-950 p-[2px]">
                    <Badge
                      dot
                      color={online ? "#4ade80" : "#8C8C8C"}
                      offset={[-4, 92]}
                      style={{ width: 14, height: 14, minWidth: 14 }}
                    >
                      <Image
                        src={profile.avatar_url || fallbackSvg}
                        width={112}
                        height={112}
                        className="object-cover !block rounded-full"
                        preview={{
                          mask: (
                            <div className="flex items-center justify-center w-full h-full bg-black/40 backdrop-blur-sm rounded-full transition-all">
                              <ZoomInOutlined className="text-white text-xl drop-shadow-md" />
                            </div>
                          ),
                          maskClassName: "rounded-full",
                        }}
                      />
                    </Badge>
                  </div>
                </div>
              </motion.div>

              {/* Name row with verified badge inline */}
              <div className="flex items-center justify-center gap-1.5 mt-5">
                <Title level={4} className="!m-0 !text-zinc-900 dark:!text-zinc-50 !font-bold !tracking-tight">
                  {profile.display_name}
                </Title>

                {isPremium && (
                  <Tooltip title={profile.is_ai ? "Verified AI Assistant" : "Verified Pro Account"}>
                    <VscVerifiedFilled 
                      className={`h-5 w-5 drop-shadow-sm ${profile.is_ai ? "text-blue-500" : "text-violet-500"}`} 
                    />
                  </Tooltip>
                )}
              </div>

              {/* Presence */}
              {!isSelf && !profile.is_ai && (online !== undefined || lastSeen !== undefined) && (
                <Text className="!mt-1.5 !text-xs !font-medium block">
                  {online ? (
                    <span className="text-emerald-500 flex items-center justify-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block animate-pulse" /> Online
                    </span>
                  ) : lastSeen ? (
                    <span className="text-zinc-500 dark:text-zinc-400">{fmtLastSeen(lastSeen)}</span>
                  ) : (
                    <span className="text-zinc-500 dark:text-zinc-400">Offline</span>
                  )}
                </Text>
              )}

              {profile.bio && (
                <Text className="!mt-3 !text-sm !text-zinc-500 dark:!text-zinc-400 !leading-relaxed block max-w-[280px] text-center">
                  {profile.bio}
                </Text>
              )}

              {/* ─── Social Media Links ─── */}
              {hasSocials && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="flex items-center justify-center gap-3 mt-4"
                >
                  {socials?.facebook && (
                    <Tooltip title="Facebook" placement="top">
                      <a
                        href={socials.facebook}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group h-10 w-10 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:bg-[#1877F2] hover:text-white dark:hover:bg-[#1877F2] dark:hover:text-white transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-[#1877F2]/30"
                      >
                        <FaFacebookF className="text-[16px]" />
                      </a>
                    </Tooltip>
                  )}
                  {socials?.x && (
                    <Tooltip title="X" placement="top">
                      <a
                        href={socials.x}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group h-10 w-10 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-black/20 dark:hover:shadow-white/20"
                      >
                        <FaXTwitter className="text-[16px]" />
                      </a>
                    </Tooltip>
                  )}
                  {socials?.instagram && (
                    <Tooltip title="Instagram" placement="top">
                      <a
                        href={socials.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group h-10 w-10 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:bg-gradient-to-tr hover:from-yellow-400 hover:via-red-500 hover:to-purple-600 hover:text-white transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-red-500/30"
                      >
                        <FaInstagram className="text-[16px]" />
                      </a>
                    </Tooltip>
                  )}
                  {socials?.threads && (
                    <Tooltip title="Threads" placement="top">
                      <a
                        href={socials.threads}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group h-10 w-10 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-black/20 dark:hover:shadow-white/20"
                      >
                        <FaThreads className="text-[16px]" />
                      </a>
                    </Tooltip>
                  )}
                </motion.div>
              )}
            </div>

            {/* Moderation Alert */}
            <AnimatePresence>
              {mod && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: "auto", marginTop: 24 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  className="overflow-hidden"
                >
                  <Alert
                    message={<span className="!text-zinc-900 dark:!text-zinc-100 font-semibold flex items-center gap-2">{mod.label}</span>}
                    description={
                      <div>
                        <Text className="!text-xs !text-zinc-600 dark:!text-zinc-400 block">{mod.reason || mod.note}</Text>
                        {mod.expires_at && (
                          <Text className="!text-[11px] !text-zinc-500 dark:!text-zinc-500 block mt-1.5 font-medium">
                            Until {new Date(mod.expires_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </Text>
                        )}
                      </div>
                    }
                    type="warning"
                    showIcon
                    icon={<ExclamationCircleOutlined style={{ color: mod.color, fontSize: 16 }} />}
                    className="!rounded-xl !border"
                    style={{ 
                      backgroundColor: `${mod.color}10`, 
                      borderColor: `${mod.color}30` 
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* ─── Smart Info Grid ─── */}
            <div className={`mt-6 grid gap-3 ${joined ? 'grid-cols-4' : 'grid-cols-1'}`}>
              {joined && (
                <Tooltip title={`Member since ${joined}`} placement="top">
                  <div className="flex flex-col items-center gap-1.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800/50 p-3 transition-all duration-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 cursor-default group col-span-1">
                    <CalendarOutlined className="text-lg text-zinc-400 group-hover:text-rose-500 transition-colors" />
                    <Text className="!text-[9px] !text-zinc-500 dark:!text-zinc-500 uppercase tracking-widest font-semibold">Joined</Text>
                    <Text className="!text-[11px] !font-bold !text-zinc-900 dark:!text-zinc-100">{joined}</Text>
                  </div>
                </Tooltip>
              )}

              {!isSelf && onOpenMedia && (
                <Tooltip title="View shared photos, videos & files" placement="top">
                  <button
                    onClick={onOpenMedia}
                    className={`flex flex-col items-center justify-center gap-2 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800/50 p-3 transition-all duration-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 group w-full ${joined ? 'col-span-3' : 'col-span-4'}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center text-rose-500 group-hover:scale-110 transition-transform duration-300">
                        <PictureOutlined className="text-base" />
                      </div>
                      <div className="h-8 w-8 rounded-xl bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center text-violet-500 group-hover:scale-110 transition-transform duration-300">
                        <LinkOutlined className="text-base" />
                      </div>
                      <div className="h-8 w-8 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform duration-300">
                        <FileTextOutlined className="text-base" />
                      </div>
                    </div>
                    <div className="flex flex-col items-center">
                      <Text className="!text-[9px] !text-zinc-500 uppercase tracking-widest font-semibold">Media & Docs</Text>
                      <Text className="!text-[12px] !font-bold !text-zinc-900 dark:!text-zinc-100 flex items-center gap-1 group-hover:gap-1.5 transition-all">
                        View all <RightOutlined className="!text-[10px]" />
                      </Text>
                    </div>
                  </button>
                </Tooltip>
              )}
            </div>

            <Divider className="!my-6 !border-zinc-200 dark:!border-zinc-800" />

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3">
              {isSelf ? (
                <>
                  <Button
                    type="primary"
                    size="large"
                    icon={<EditOutlined className="!text-base" />}
                    onClick={onEdit}
                    style={{ 
                      background: "linear-gradient(135deg, #E07A5F 0%, #d4694f 100%)", 
                      borderColor: "transparent", 
                      borderRadius: 999, 
                      height: 48,
                      boxShadow: "0 4px 14px 0 rgba(224, 122, 95, 0.39)"
                    }}
                    className="!font-semibold !text-white hover:!opacity-95 !transition-all active:scale-[0.98] col-span-2"
                  >
                    Edit profile
                  </Button>
                  {onShareContact && (
                    <Button
                      size="large"
                      icon={<ShareAltOutlined className="!text-base" />}
                      onClick={onShareContact}
                      style={{ borderRadius: 999, height: 48 }}
                      className="!font-semibold !bg-zinc-100 dark:!bg-zinc-900 !text-zinc-900 dark:!text-zinc-100 hover:!bg-zinc-200 dark:hover:!bg-zinc-800 !border-0 !shadow-sm !transition-all active:scale-[0.98] col-span-2"
                    >
                      Share my contact
                    </Button>
                  )}
                </>
              ) : (
                <>
                  {!profile.is_ai && onMessage && (
                    <Tooltip title={messageDisabled ? messageDisabledReason : undefined} placement="top">
                      <span className="col-span-2 block">
                        <Button
                          type="primary"
                          size="large"
                          block
                          icon={<LuMessageSquareText className="!text-base" />}
                          onClick={messageDisabled ? undefined : onMessage}
                          disabled={messageDisabled}
                          style={{ 
                            borderRadius: 999, 
                            height: 48,
                            boxShadow: profile.is_pro && !messageDisabled ? "0 4px 14px 0 rgba(139, 92, 246, 0.4)" : "0 4px 14px 0 rgba(224, 122, 95, 0.39)"
                          }}
                          className={`!font-semibold !text-white hover:!opacity-95 !transition-all active:scale-[0.98] border-0 disabled:!opacity-50 disabled:!cursor-not-allowed disabled:!shadow-none ${
                            profile.is_pro && !messageDisabled 
                              ? "bg-gradient-to-r from-violet-600 via-fuchsia-500 to-rose-500" 
                              : "bg-[#E07A5F] hover:bg-[#d4694f]"
                          }`}
                        >
                          Message
                        </Button>
                      </span>
                    </Tooltip>
                  )}
                  {onShareContact && (
                    <Button
                      size="large"
                      icon={<ShareAltOutlined className="!text-base" />}
                      onClick={onShareContact}
                      style={{ borderRadius: 999, height: 48 }}
                      className="!font-semibold !bg-zinc-100 dark:!bg-zinc-900 !text-zinc-900 dark:!text-zinc-100 hover:!bg-zinc-200 dark:hover:!bg-zinc-800 !border-0 !shadow-sm !transition-all active:scale-[0.98]"
                    >
                      Share
                    </Button>
                  )}
                  {onToggleBlock && (
                    <Button
                      size="large"
                      icon={isBlocked ? <UnlockOutlined className="!text-base" /> : <BlockOutlined className="!text-base" />}
                      onClick={onToggleBlock}
                      style={{ borderRadius: 999, height: 48 }}
                      className="!font-semibold !bg-zinc-100 dark:!bg-zinc-900 !text-zinc-900 dark:!text-zinc-100 hover:!bg-zinc-200 dark:hover:!bg-zinc-800 !border-0 !shadow-sm !transition-all active:scale-[0.98]"
                    >
                      {isBlocked ? "Unblock" : "Block"}
                    </Button>
                  )}
                  {onReport && (
                    <Button
                      size="large"
                      icon={<FlagOutlined className="!text-base" />}
                      onClick={onReport}
                      style={{ borderRadius: 999, height: 48 }}
                      className="!font-semibold !bg-red-50 dark:!bg-red-950/30 !text-red-600 dark:!text-red-400 hover:!bg-red-100 dark:hover:!bg-red-950/50 !border border-red-200 dark:!border-red-900 !shadow-sm !transition-all active:scale-[0.98] col-span-2"
                    >
                      Report Account
                    </Button>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="mt-8 flex flex-col items-center gap-2 text-center pb-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800/50">
                <SafetyCertificateOutlined className="text-emerald-500 text-xs" />
                <Text className="!text-[10px] !text-zinc-500 dark:!text-zinc-400 tracking-widest uppercase font-semibold">
                  End-to-end encrypted
                </Text>
              </div>
              <Text className="!text-[10px] !text-zinc-400 dark:!text-zinc-600 tracking-wide">
                Powered by <span className="font-bold text-zinc-600 dark:text-zinc-300">Swiftmeta</span>
              </Text>
            </div>
          </div>
        </Watermark>
      </motion.div>
    </div>
  );
}
