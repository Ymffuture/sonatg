import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CloseOutlined,
  MessageOutlined,
  EditOutlined,
  CalendarOutlined,
  WarningOutlined,
  PictureOutlined,
  RightOutlined,
  StopOutlined,
  UnlockOutlined,
  FlagOutlined,
  CrownOutlined,
  RobotOutlined,
  InfoCircleOutlined,
  CheckCircleFilled,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import { Image, Tooltip, Badge, Tag, Divider, Watermark } from "antd";
import { Avatar } from "./Avatar";
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
  const [previewOpen, setPreviewOpen] = useState(false);
  const joined = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : null;
  const mod = moderation && MOD_META[moderation.action] ? { ...MOD_META[moderation.action]!, ...moderation } : null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 24 }}
          transition={{ type: "spring", damping: 26, stiffness: 320 }}
          className="w-full max-w-sm rounded-3xl border border-white/20 dark:border-white/10 bg-white/85 dark:bg-[#1a1a1a]/85 backdrop-blur-xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex justify-end p-4 pb-0">
           
            <Tooltip title="Close">
              <button
                onClick={onClose}
                className="grid h-8 w-8 place-items-center rounded-full hover:bg-[#E07A5F]/10 transition"
                aria-label="Close"
              >
                <CloseOutlined className="text-sm text-[#2D3436] dark:text-[#E8E8E8]" />
              </button>
            </Tooltip>
          </div>

          <div className="flex flex-col items-center text-center px-6 pb-6 -mt-1">
            {/* Avatar with zoom */}
            <div
              className={`relative group ${profile.avatar_url ? "cursor-pointer" : ""}`}
              onClick={() => profile.avatar_url && setPreviewOpen(true)}
            >
              <Badge
                dot
                status={online ? "success" : "default"}
                offset={[-4, 92]}
                className={!online ? "opacity-0" : ""}
              >
                <div
                  className="rounded-full p-[3px]"
                  style={{
                    background: online
                      ? "linear-gradient(135deg, #25D366, #E07A5F)"
                      : "transparent",
                  }}
                >
                  <Avatar url={profile.avatar_url} name={profile.display_name} size={96} ai={profile.is_ai} />
                </div>
              </Badge>

              {profile.avatar_url && (
                <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                  <PictureOutlined className="text-white text-xl opacity-0 group-hover:opacity-80 transition-all" />
                </div>
              )}

              {/* Hidden antd Image for zoom preview */}
              <Image
                src={profile.avatar_url || undefined}
                preview={{
                  visible: previewOpen,
                  onVisibleChange: (vis) => setPreviewOpen(vis),
                  mask: false,
                }}
                style={{ display: "none" }}
              />
            </div>

            {/* Name & Badges */}
            <div className="mt-4 flex items-center gap-2 flex-wrap justify-center">
              <h2 className="text-xl font-bold text-[#2D3436] dark:text-[#E8E8E8]">
                {profile.display_name}
              </h2>
              {profile.is_ai && (
                <Tooltip title="AI Assistant">
                  <Tag
                    color="#E07A5F"
                    icon={<RobotOutlined />}
                    className="rounded-full border-0 text-[10px] font-bold px-2 py-0.5"
                  >
                    AI
                  </Tag>
                </Tooltip>
              )}
              {profile.is_pro && (
                <Tooltip title="Pro Member">
                  <Tag
                    color="#E07A5F"
                    icon={<CrownOutlined />}
                    className="rounded-full border-0 text-[10px] font-bold px-2 py-0.5"
                  >
                    PRO
                  </Tag>
                </Tooltip>
              )}
            </div>

            {/* Presence */}
            {!isSelf && !profile.is_ai && (online !== undefined || lastSeen !== undefined) && (
              <p className="mt-1.5 text-xs font-medium flex items-center gap-1.5">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${online ? "bg-green-400 animate-pulse" : "bg-[#8C8C8C]"}`}
                />
                {online ? (
                  <span className="text-green-400">Online</span>
                ) : lastSeen ? (
                  <span className="text-[#8C8C8C]">{fmtLastSeen(lastSeen)}</span>
                ) : (
                  <span className="text-[#8C8C8C]">Offline</span>
                )}
              </p>
            )}

            {/* Bio */}
            {profile.bio && (
              <p className="mt-3 text-sm text-[#5C5C5C] dark:text-[#B8B8B8] leading-relaxed max-w-[280px]">
                {profile.bio}
              </p>
            )}

            {/* Moderation Warning */}
            <AnimatePresence>
              {mod && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 w-full overflow-hidden"
                >
                  <div
                    className="w-full rounded-2xl px-4 py-3 text-left"
                    style={{
                      backgroundColor: `${mod.color}1A`,
                      border: `1px solid ${mod.color}44`,
                    }}
                  >
                    <p
                      className="flex items-center gap-1.5 text-xs font-bold"
                      style={{ color: mod.color }}
                    >
                      <WarningOutlined /> {mod.label}
                    </p>
                    <p className="mt-1 text-xs text-[#5C5C5C] dark:text-[#B8B8B8]">
                      {mod.reason || mod.note}
                    </p>
                    {mod.expires_at && (
                      <p className="mt-1 text-[11px] text-[#8C8C8C]">
                        Until {new Date(mod.expires_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ─── Info Grid (WhatsApp-style) ─── */}
            <div className="mt-5 w-full grid grid-cols-3 gap-2">
              {joined && (
                <Tooltip title={`Joined ${joined}`}>
                  <div className="flex flex-col items-center gap-1.5 rounded-xl bg-[#F5F0E8] dark:bg-[#2A2A2A] p-3 transition hover:bg-[#EFE6D8] dark:hover:bg-[#333]">
                    <CalendarOutlined className="text-[#E07A5F] text-lg" />
                    <span className="text-[10px] font-semibold text-[#8C8C8C]">{joined}</span>
                  </div>
                </Tooltip>
              )}
              <Tooltip
                title={
                  online
                    ? "Online now"
                    : lastSeen
                    ? `Last seen ${fmtLastSeen(lastSeen)}`
                    : "Offline"
                }
              >
                <div className="flex flex-col items-center gap-1.5 rounded-xl bg-[#F5F0E8] dark:bg-[#2A2A2A] p-3 transition hover:bg-[#EFE6D8] dark:hover:bg-[#333]">
                  <CheckCircleFilled
                    className={online ? "text-green-400 text-lg" : "text-[#8C8C8C] text-lg"}
                  />
                  <span className="text-[10px] font-semibold text-[#8C8C8C]">
                    {online ? "Online" : "Away"}
                  </span>
                </div>
              </Tooltip>
              <Tooltip title="End-to-end encrypted">
                <div className="flex flex-col items-center gap-1.5 rounded-xl bg-[#F5F0E8] dark:bg-[#2A2A2A] p-3 transition hover:bg-[#EFE6D8] dark:hover:bg-[#333]">
                  <SafetyCertificateOutlined className="text-[#E07A5F] text-lg" />
                  <span className="text-[10px] font-semibold text-[#8C8C8C]">Secure</span>
                </div>
              </Tooltip>
            </div>

            <Divider className="my-4 border-[#E07A5F]/10" />

            {/* Media, links, docs */}
            {!isSelf && onOpenMedia && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onOpenMedia}
                className="flex w-full items-center gap-3 rounded-2xl border border-[#E07A5F]/10 bg-[#F5F0E8] dark:bg-[#2A2A2A] px-4 py-3.5 text-left hover:bg-[#EFE6D8] dark:hover:bg-[#333] transition"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#E07A5F]/10 text-[#E07A5F]">
                  <PictureOutlined className="text-lg" />
                </span>
                <span className="flex-1 text-sm font-semibold text-[#2D3436] dark:text-[#E8E8E8]">
                  Media, links, and docs
                </span>
                <RightOutlined className="text-xs text-[#8C8C8C]" />
              </motion.button>
            )}

            {/* ─── Action Grid ─── */}
            <div className="mt-3 w-full grid grid-cols-2 gap-2">
              {isSelf ? (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onEdit}
                  className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-[#E07A5F] py-3 text-sm font-semibold text-white hover:opacity-90 transition shadow-lg"
                >
                  <EditOutlined /> Edit profile
                </motion.button>
              ) : (
                <>
                  {!profile.is_ai && onMessage && (
                    <Tooltip title="Send message">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={onMessage}
                        className="flex flex-col items-center gap-1.5 rounded-xl bg-[#E07A5F] py-3 text-white hover:opacity-90 transition shadow-md"
                      >
                        <MessageOutlined className="text-lg" />
                        <span className="text-[11px] font-semibold">Message</span>
                      </motion.button>
                    </Tooltip>
                  )}
                  {onToggleBlock && (
                    <Tooltip title={isBlocked ? "Unblock user" : "Block user"}>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={onToggleBlock}
                        className={`flex flex-col items-center gap-1.5 rounded-xl py-3 transition shadow-md ${
                          isBlocked
                            ? "bg-green-500/10 text-green-500 hover:bg-green-500/20"
                            : "bg-[#F5F0E8] dark:bg-[#2A2A2A] text-[#2D3436] dark:text-[#E8E8E8] hover:bg-[#EFE6D8] dark:hover:bg-[#333]"
                        }`}
                      >
                        {isBlocked ? (
                          <UnlockOutlined className="text-lg" />
                        ) : (
                          <StopOutlined className="text-lg" />
                        )}
                        <span className="text-[11px] font-semibold">
                          {isBlocked ? "Unblock" : "Block"}
                        </span>
                      </motion.button>
                    </Tooltip>
                  )}
                  {onReport && (
                    <Tooltip title="Report user">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={onReport}
                        className="flex flex-col items-center gap-1.5 rounded-xl bg-red-500/10 py-3 text-red-500 hover:bg-red-500/20 transition shadow-md"
                      >
                        <FlagOutlined className="text-lg" />
                        <span className="text-[11px] font-semibold">Report</span>
                      </motion.button>
                    </Tooltip>
                  )}
                </>
              )}
            </div>

            {/* ─── Powered by Swiftmeta ─── */}
            <div className="mt-5 flex items-center justify-center gap-1.5 text-[10px] text-[#8C8C8C]">
              <InfoCircleOutlined />
              <span>
                Powered by <span className="font-semibold text-[#E07A5F]">Swiftmeta</span>
              </span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
