import { X, BadgeCheck, Crown, Sparkles, MessageCircle, Pencil, Calendar } from "lucide-react";
import { Avatar } from "./Avatar";
import type { Profile } from "@/lib/db";

export function ProfileViewModal({
  profile, isSelf, onClose, onMessage, onEdit,
}: {
  profile: Profile;
  isSelf: boolean;
  onClose: () => void;
  onMessage?: () => void; // omitted/undefined when viewing your own profile
  onEdit?: () => void;    // only relevant when isSelf
}) {
  const joined = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : null;

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
            {profile.is_ai && <Sparkles className="h-4 w-4 text-[#E07A5F]" titleAccess="AI" />}
            {profile.is_pro && <Crown className="h-4 w-4 text-[#E07A5F]" titleAccess="Pro" />}
          </div>

          {profile.bio && (
            <p className="mt-2 text-sm text-[#5C5C5C] dark:text-[#B8B8B8] leading-relaxed">{profile.bio}</p>
          )}

          {joined && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-[#8C8C8C]">
              <Calendar className="h-3.5 w-3.5" />
              Joined {joined}
            </div>
          )}

          <div className="mt-6 flex w-full gap-2">
            {isSelf ? (
              <button
                onClick={onEdit}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-[#E07A5F] py-2.5 text-sm font-semibold text-white hover:opacity-90 transition shadow-lg"
              >
                <Pencil className="h-4 w-4" /> Edit profile
              </button>
            ) : (
              !profile.is_ai && onMessage && (
                <button
                  onClick={onMessage}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-[#E07A5F] py-2.5 text-sm font-semibold text-white hover:opacity-90 transition shadow-lg"
                >
                  <MessageCircle className="h-4 w-4" /> Message
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
