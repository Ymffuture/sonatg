import { motion, AnimatePresence } from "framer-motion";
import {
  CloseOutlined,
  MessageOutlined,
  EditOutlined,
  CalendarOutlined,
  WarningOutlined,
  FlagOutlined,
  BlockOutlined,
  UnlockOutlined,
  PictureOutlined,
  LinkOutlined,
  FileTextOutlined,
  CrownOutlined,
  RobotOutlined,
  RightOutlined,
  ZoomInOutlined,
  ExclamationCircleOutlined,
  SafetyCertificateOutlined,
  InfoCircleOutlined,
  CheckCircleFilled,
  ShareAltOutlined,
} from "@ant-design/icons";
import {
  Button,
  Tag,
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
import { MdVerified } from "react-icons/md";
import { FaFacebookF, FaXTwitter, FaInstagram, FaThreads } from "react-icons/fa6";
const { Text, Title } = Typography;

const MOD_META: Record<string, { label: string; color: string; note: string }> = {
  warn: { label: "Warning issued", color: "#F59E0B", note: "An administrator has warned this account." },
  suspend: { label: "Suspended", color: "#E07A5F", note: "Messaging and other features are disabled." },
  ban: { label: "Banned", color: "#EF4444", note: "This account is banned from Sona." },
};

export function ProfileViewModal({
  profile, isSelf, onClose, onMessage, onEdit, moderation, onReport,
  online, lastSeen, onOpenMedia, isBlocked, onToggleBlock, hasStatus,
  socials, onShareContact,
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

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 24 }}
        transition={{ type: "spring", damping: 26, stiffness: 320 }}
        className="relative w-full max-w-sm rounded-3xl border border-white/20 dark:border-white/10 bg-white/85 dark:bg-[#1a1a1a]/85 backdrop-blur-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <Watermark
          content={profile.is_pro ? profile.display_name : ""}
          font={{ color: "#8c8c8c", fontSize: 8 }}
          gap={[300, 240]}
          rotate={-22}
          className="h-full"
        >
          <div className="max-h-[85vh] overflow-y-auto scrollbar-thin p-6">
            {/* Header */}
            <div className="flex justify-end">
              <Tooltip title="Close" placement="bottom">
                <Button
                  type="text"
                  shape="circle"
                  icon={<CloseOutlined className="text-[#2D3436] dark:text-[#E8E8E8]" />}
                  onClick={onClose}
                  className="hover:!bg-[#E07A5F]/10"
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
                <Badge
                  dot
                  color={online ? "#4ade80" : "#8C8C8C"}
                  offset={[-6, 94]}
                  style={{ width: 14, height: 14, minWidth: 14 }}
                >
                  <div
                    className={`rounded-full overflow-hidden shadow-2xl ${
                      hasStatus ? "ring-[3px] ring-[#25D366] ring-offset-2 ring-offset-white dark:ring-offset-[#1a1a1a]" : "ring-[3px] ring-[#E07A5F]/15"
                    }`}
                  >
                    <Image
                      src={profile.avatar_url || fallbackSvg}
                      width={112}
                      height={112}
                      className="object-cover !block"
                      preview={{
                        mask: (
                          <div className="flex items-center justify-center w-full h-full bg-black/30 rounded-full">
                            <ZoomInOutlined className="text-white text-xl" />
                          </div>
                        ),
                        maskClassName: "rounded-full",
                      }}
                    />
                  </div>
                </Badge>
                
              </motion.div>

              {/* Name row with verified badge inline */}
              <div className="flex items-center justify-center gap-1.5 mt-4">
                <Title level={4} className="!m-0 !text-[#2D3436] dark:!text-[#E8E8E8]">
                  {profile.display_name}
                </Title>

                {/* Verified badge next to name — AI is always verified; humans need Pro */}
                {(profile.is_ai || profile.is_pro) && (
                  <Tooltip title={profile.is_ai ? "Verified AI Assistant" : "Verified Pro Account"}>
                    <span className="inline-flex items-center justify-center">
                      {profile.is_ai
                        ? <MdVerified style={{ color: "#1877F2", fontSize: 18 }} />
                        : <CheckCircleFilled style={{ color: "#8B5CF6", fontSize: 18 }} />}
                    </span>
                  </Tooltip>
                )}
              </div>

              {/* Presence */}
              {!isSelf && !profile.is_ai && (online !== undefined || lastSeen !== undefined) && (
                <Text className="!mt-1 !text-xs !font-medium block">
                  {online ? (
                    <span className="text-[#4ade80] flex items-center justify-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#4ade80] inline-block" /> Online
                    </span>
                  ) : lastSeen ? (
                    <span className="text-[#8C8C8C]">{fmtLastSeen(lastSeen)}</span>
                  ) : (
                    <span className="text-[#8C8C8C]">Offline</span>
                  )}
                </Text>
              )}

              {profile.bio && (
                <Text className="!mt-3 !text-sm !text-[#5C5C5C] dark:!text-[#B8B8B8] !leading-relaxed block max-w-[260px]">
                  <InfoCircleOutlined className="mr-1 text-[#E07A5F] text-xs" />
                  {profile.bio}
                </Text>
              )}

              {/* ─── Social Media Links ─── */}
              {hasSocials && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="flex items-center justify-center gap-2.5 mt-3"
                >
                  {socials?.facebook && (
                    <Tooltip title="Facebook">
                      <a
                        href={socials.facebook}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-9 w-9 rounded-full bg-[#1E1E1E]/10 dark:bg-white/10 flex items-center justify-center text-[#1E1E1E] dark:text-[#F5F5F5] hover:bg-[#1E1E1E] hover:text-white dark:hover:bg-[#F5F5F5] dark:hover:text-[#1E1E1E] transition-all duration-200 hover:scale-110"
                      >
                        <FaFacebookF className="text-[15px]" />
                      </a>
                    </Tooltip>
                  )}
                  {socials?.x && (
                    <Tooltip title="X">
                      <a
                        href={socials.x}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-9 w-9 rounded-full bg-[#1E1E1E]/10 dark:bg-white/10 flex items-center justify-center text-[#1E1E1E] dark:text-[#F5F5F5] hover:bg-[#1E1E1E] hover:text-white dark:hover:bg-[#F5F5F5] dark:hover:text-[#1E1E1E] transition-all duration-200 hover:scale-110"
                      >
                        <FaXTwitter className="text-[15px]" />
                      </a>
                    </Tooltip>
                  )}
                  {socials?.instagram && (
                    <Tooltip title="Instagram">
                      <a
                        href={socials.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-9 w-9 rounded-full bg-[#1E1E1E]/10 dark:bg-white/10 flex items-center justify-center text-[#1E1E1E] dark:text-[#F5F5F5] hover:bg-[#1E1E1E] hover:text-white dark:hover:bg-[#F5F5F5] dark:hover:text-[#1E1E1E] transition-all duration-200 hover:scale-110"
                      >
                        <FaInstagram className="text-[15px]" />
                      </a>
                    </Tooltip>
                  )}
                  {socials?.threads && (
                    <Tooltip title="Threads">
                      <a
                        href={socials.threads}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-9 w-9 rounded-full bg-[#1E1E1E]/10 dark:bg-white/10 flex items-center justify-center text-[#1E1E1E] dark:text-[#F5F5F5] hover:bg-[#1E1E1E] hover:text-white dark:hover:bg-[#F5F5F5] dark:hover:text-[#1E1E1E] transition-all duration-200 hover:scale-110"
                      >
                        <FaThreads className="text-[15px]" />
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
                  animate={{ opacity: 1, height: "auto", marginTop: 16 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  className="overflow-hidden"
                >
                  <Alert
                    message={mod.label}
                    description={
                      <div>
                        <Text className="!text-xs !text-[#5C5C5C] dark:!text-[#B8B8B8] block">{mod.reason || mod.note}</Text>
                        {mod.expires_at && (
                          <Text className="!text-[11px] !text-[#8C8C8C] block mt-1">
                            Until {new Date(mod.expires_at).toLocaleDateString()}
                          </Text>
                        )}
                      </div>
                    }
                    type="warning"
                    showIcon
                    icon={<ExclamationCircleOutlined />}
                    className="!rounded-xl !border-[1.5px]"
                    style={{ backgroundColor: `${mod.color}12`, borderColor: `${mod.color}45` }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* ─── Smart 4-Column Info Grid ─── */}
            <div className="mt-5 grid grid-cols-4 gap-2.5">
              {joined && (
                <Tooltip title={`Member since ${joined}`} placement="top">
                  <div className="flex flex-col items-center gap-1 rounded-2xl bg-[#F5F0E8] dark:bg-[#2A2A2A] p-3 transition hover:bg-[#EFE6D8] dark:hover:bg-[#333] cursor-default">
                    <CalendarOutlined className="text-lg text-[#E07A5F]" />
                    <Text className="!text-[9px] !text-[#8C8C8C] uppercase tracking-wider font-medium">Joined</Text>
                    <Text className="!text-[11px] !font-bold !text-[#2D3436] dark:!text-[#E8E8E8]">{joined}</Text>
                  </div>
                </Tooltip>
              )}

              {!isSelf && onOpenMedia && (
                <Tooltip title="View shared photos, videos & files" placement="top">
                  <button
                    onClick={onOpenMedia}
                    className="flex flex-col items-center gap-1 rounded-2xl bg-[#F5F0E8] dark:bg-[#2A2A2A] p-3 transition hover:bg-[#EFE6D8] dark:hover:bg-[#333] col-span-3"
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-[#E07A5F]/10 flex items-center justify-center">
                        <PictureOutlined className="text-[#E07A5F] text-sm" />
                      </div>
                      <div className="h-7 w-7 rounded-lg bg-[#E07A5F]/10 flex items-center justify-center">
                        <LinkOutlined className="text-[#E07A5F] text-sm" />
                      </div>
                      <div className="h-7 w-7 rounded-lg bg-[#E07A5F]/10 flex items-center justify-center">
                        <FileTextOutlined className="text-[#E07A5F] text-sm" />
                      </div>
                    </div>
                    <Text className="!text-[9px] !text-[#8C8C8C] uppercase tracking-wider font-medium">Media & Docs</Text>
                    <Text className="!text-[11px] !font-bold !text-[#2D3436] dark:!text-[#E8E8E8] flex items-center gap-1">
                      View all <RightOutlined className="!text-[9px]" />
                    </Text>
                  </button>
                </Tooltip>
              )}
            </div>

            <Divider className="!my-5 !border-[#E07A5F]/10" />

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2.5">
              {isSelf ? (
                <>
                  <Button
                    type="primary"
                    size="large"
                    icon={<EditOutlined />}
                    onClick={onEdit}
                    style={{ backgroundColor: "#E07A5F", borderColor: "#E07A5F", borderRadius: 999, height: 44 }}
                    className="!font-semibold !shadow-lg hover:!opacity-90 !transition-opacity col-span-2"
                  >
                    Edit profile
                  </Button>
                  {onShareContact && (
                    <Button
                      size="large"
                      icon={<ShareAltOutlined />}
                      onClick={onShareContact}
                      style={{ borderRadius: 999, height: 44 }}
                      className="!font-semibold !bg-[#F5F0E8] dark:!bg-[#2A2A2A] !text-[#2D3436] dark:!text-[#E8E8E8] hover:!bg-[#EFE6D8] dark:hover:!bg-[#333] !border-0 !shadow-sm col-span-2"
                    >
                      Share my contact
                    </Button>
                  )}
                </>
              ) : (
                <>
                  {!profile.is_ai && onMessage && (
                    <Button
                      type="primary"
                      size="large"
                      icon={<MessageOutlined />}
                      onClick={onMessage}
                      style={{ backgroundColor:!profile.is_pro? "" :"#E07A5F", borderColor:!profile.is_pro ? "" :"#E07A5F", borderRadius: 50, height: 44 }}
                      className={`!font-semibold !shadow-lg hover:!opacity-90 !transition-opacity col-span-2 ${ profile.is_pro ? bg-gradient-to-br from-violet-700 via-violet-500 to-fuchsia-500:"" } `} 
                    
                    >
                      Message
                    </Button>
                  )}
                  {onShareContact && (
                    <Button
                      size="large"
                      icon={<ShareAltOutlined />}
                      onClick={onShareContact}
                      style={{ borderRadius: 50, height: 44 }}
                      className="!font-semibold !bg-[#F5F0E8] dark:!bg-[#2A2A2A] !text-[#2D3436] dark:!text-[#E8E8E8] hover:!bg-[#EFE6D8] dark:hover:!bg-[#333] !border-0 !shadow-sm"
                    >
                      Share
                    </Button>
                  )}
                  {onToggleBlock && (
                    <Button
                      size="large"
                      icon={isBlocked ? <UnlockOutlined /> : <BlockOutlined />}
                      onClick={onToggleBlock}
                      style={{ borderRadius: 50, height: 44 }}
                      className="!font-semibold !bg-[#F5F0E8] dark:!bg-[#2A2A2A] !text-[#2D3436] dark:!text-[#E8E8E8] hover:!bg-[#EFE6D8] dark:hover:!bg-[#333] !border-0 !shadow-sm"
                    >
                      {isBlocked ? "Unblock" : "Block"}
                    </Button>
                  )}
                  {onReport && (
                    <Button
                      size="large"
                      icon={<FlagOutlined />}
                      onClick={onReport}
                      danger
                      ghost
                      style={{ borderRadius: 50, height: 44 }}
                      className="!font-semibold !border-red-400/40 hover:!border-red-500 hover:!text-red-500 col-span-2"
                    >
                      Report
                    </Button>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="mt-6 flex flex-col items-center gap-1 text-center">
              <div className="flex items-center gap-1.5 opacity-60">
                <SafetyCertificateOutlined className="text-[#E07A5E] text-xs" />
                <Text className="!text-[10px] !text-[#8C8C8C] tracking-wide uppercase font-medium">
                  End-to-end encrypted
                </Text>
              </div>
              <Text className="!text-[10px] !text-[#8C8C8C]/70 tracking-wide">
                Powered by <span className="font-semibold text-[#E07A5F]/80">Swiftmeta</span>
              </Text>
            </div>
          </div>
        </Watermark>
      </motion.div>
    </div>
  );
}
