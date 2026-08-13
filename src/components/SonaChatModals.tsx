import { X, Sparkles, Clock, Download } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { OnboardingTour } from "./OnboardingTour";
import { ProfileViewModal } from "./ProfileView";
import { ForwardModal } from "./ForwardModal";
import { MediaGalleryModal } from "./MediaGalleryModal";
import { MediaViewer } from "./MessageBubble";
import { SettingsModal, UnlockModal } from "./ChatModals";
import { chatTitle } from "@/utils/utils";
import type { ChatWithMeta } from "@/utils/utils";
import type { MessageRow, Profile } from "@/lib/db";
import { ONBOARDING_STEPS } from "./sonaChatShared";

type GalleryViewer = { kind: "image" | "video" | "pdf"; url: string; name?: string } | null;
type Moderation = { action: "warn" | "suspend" | "ban"; reason?: string | null } | null;

export function SonaChatModals(props: {
  me: Profile;
  chats: ChatWithMeta[];
  active: ChatWithMeta | null | undefined;
  activeId: string | null;
  activeOtherId: string | null;
  onlineIds: Set<string>;
  myModeration: Moderation;

  viewingProfile: Profile | null;
  setViewingProfile: (p: Profile | null) => void;
  messageProfile: (p: Profile) => void;
  setShowSettings: (v: boolean) => void;
  setReportTarget: (p: Profile | null) => void;
  iBlockedThem: boolean;
  unblockOther: () => void;
  blockOther: () => void;

  forwardingMessage: MessageRow | null;
  setForwardingMessage: (m: MessageRow | null) => void;

  showMediaGallery: boolean;
  setShowMediaGallery: (v: boolean) => void;
  galleryViewer: GalleryViewer;
  setGalleryViewer: (v: GalleryViewer) => void;

  showSettings: boolean;
  setMe: (p: Profile) => void;
  setProfiles: (fn: (prev: Record<string, Profile>) => Record<string, Profile>) => void;

  needsUnlock: boolean;
  setNeedsUnlock: (v: boolean) => void;
  setActiveId: (id: string | null) => void;

  summary: string | null;
  setSummary: (v: string | null) => void;

  showScheduledList: boolean;
  setShowScheduledList: (v: boolean) => void;
  scheduledMessages: MessageRow[];
  cancelScheduled: (id: string) => void;

  showTour: boolean;
  setShowTour: (v: boolean) => void;
}) {
  const {
    me, chats, active, activeId, activeOtherId, onlineIds, myModeration,
    viewingProfile, setViewingProfile, messageProfile, setShowSettings, setReportTarget,
    iBlockedThem, unblockOther, blockOther,
    forwardingMessage, setForwardingMessage,
    showMediaGallery, setShowMediaGallery, galleryViewer, setGalleryViewer,
    showSettings, setMe, setProfiles,
    needsUnlock, setNeedsUnlock, setActiveId,
    summary, setSummary,
    showScheduledList, setShowScheduledList, scheduledMessages, cancelScheduled,
    showTour, setShowTour,
  } = props;

  return (
    <>
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
    </>
  );
}
