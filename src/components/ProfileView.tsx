import { X, BadgeCheck, Crown, Sparkles, MessageCircle, Pencil, Calendar, AlertTriangle, Flag } from "lucide-react";
import { Avatar } from "./Avatar";
import type { Profile } from "@/lib/db";

const MOD_META: Record<string, { label: string; color: string; note: string }> = {
  warn: { label: "Warning issued", color: "#F59E0B", note: "An administrator has warned this account." },
  suspend: { label: "Suspended", color: "#E07A5F", note: "Messaging and other features are disabled." },
  ban: { label: "Banned", color: "#EF4444", note: "This account is banned from Sona." },
};

export function ProfileViewModal({
  profile, isSelf, onClose, onMessage, onEdit, moderation, onReport,
}: {
  profile: Profile;
  isSelf: boolean;
  onClose: () => void;
  onMessage?: () => void; // omitted/undefined when viewing your own profile
  onEdit?: () => void;    // only relevant when isSelf
  moderation?: { action: string; reason: string | null; expires_at: string | null } | null;
  onReport?: () => void;
}) {
  const joined = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : null;
  const mod = moderation && MOD_META[moderation.action] ? { ...MOD_META[moderation.action]!, ...moderation } : null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-3xl border border-white/20 dark:border-white/10 bg-white/85 dark:bg-[#1a1a1a]/85 backdrop-blur-xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end">
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-[#E07A5F]/10 transition" aria-label="Close">
            <X className="h-4 w-4 text-[#2D3436] dark:text-[#E8E8E8]" />
          </button>
        </div>

        <div className="flex flex-col items-center text-center -mt-4">
          <Avatar url={profile.avatar_url} name={profile.display_name} size={112} ai={profile.is_ai} />
          <div className="mt-4 flex items-center gap-1.5">
            <h2 className="text-lg font-bold text-[#2D3436] dark:text-[#E8E8E8]">{profile.display_name}</h2>
            {profile.is_ai && <Sparkles className="h-4 w-4 text-[#E07A5F]" aria-label="AI" />}
            {profile.is_pro && <Crown className="h-4 w-4 text-[#E07A5F]" aria-label="Pro" />}
          </div>

          {profile.bio && (
            <p className="mt-2 text-sm text-[#5C5C5C] dark:text-[#B8B8B8] leading-relaxed">{profile.bio}</p>
          )}

          {mod && (
            <div
              className="mt-4 w-full rounded-2xl px-4 py-3 text-left"
              style={{ backgroundColor: `${mod.color}1A`, border: `1px solid ${mod.color}44` }}
            >
              <p className="flex items-center gap-1.5 text-xs font-bold" style={{ color: mod.color }}>
                <AlertTriangle className="h-3.5 w-3.5" /> {mod.label}
              </p>
              <p className="mt-1 text-xs text-[#5C5C5C] dark:text-[#B8B8B8]">{mod.reason || mod.note}</p>
              {mod.expires_at && (
                <p className="mt-1 text-[11px] text-[#8C8C8C]">Until {new Date(mod.expires_at).toLocaleDateString()}</p>
              )}
            </div>
          )}

          {joined && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-[#8C8C8C]">
              <Calendar className="h-3.5 w-3.5" />
              Joined {joined}
            </div>
          )}

          <div className="mt-6 flex w-full flex-col gap-2">
            {isSelf ? (
              <button
                onClick={onEdit}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-[#E07A5F] py-2.5 text-sm font-semibold text-white hover:opacity-90 transition shadow-lg"
              >
                <Pencil className="h-4 w-4" /> Edit profile
              </button>
            ) : (
              <>
                {!profile.is_ai && onMessage && (
                  <button
                    onClick={onMessage}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-[#E07A5F] py-2.5 text-sm font-semibold text-white hover:opacity-90 transition shadow-lg"
                  >
                    <MessageCircle className="h-4 w-4" /> Message
                  </button>
                )}
                {onReport && (
                  <button
                    onClick={onReport}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-red-500/10 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-500/20 transition"
                  >
                    <Flag className="h-4 w-4" /> Report user
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
