import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import { Phone, PhoneOff, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CallOverlay, type CallKind } from "./CallOverlay";

type IncomingCall = {
  sessionId: string;
  chatId: string;
  kind: CallKind;
  fromId: string;
  fromName: string;
  fromAvatar: string | null;
};

type ActiveCall = {
  sessionId: string;
  chatId: string;
  kind: CallKind;
  groupCall: boolean;
};

export type CallManagerHandle = {
  startCall: (chatId: string, otherMemberIds: string[], kind: CallKind, groupCall: boolean) => Promise<void>;
};

// Mounted once near the top of SonaChat so incoming calls can ring even
// while the caller's chat isn't the one currently open. Each user listens
// on their own personal broadcast channel (`calls:${meId}`) for invites;
// starting a call broadcasts an invite to every other member of the chat.
export const CallManager = forwardRef<CallManagerHandle, { meId: string; meName: string; meAvatar: string | null }>(
  function CallManager({ meId, meName, meAvatar }, ref) {
    const [incoming, setIncoming] = useState<IncomingCall | null>(null);
    const [active, setActive] = useState<ActiveCall | null>(null);
    const ringtoneRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
      const channel = supabase.channel(`calls:${meId}`);
      channel
        .on("broadcast", { event: "invite" }, ({ payload }) => {
          setIncoming(payload as IncomingCall);
        })
        .on("broadcast", { event: "cancel" }, ({ payload }) => {
          setIncoming((cur) => (cur?.sessionId === (payload as { sessionId: string }).sessionId ? null : cur));
        })
        .on("broadcast", { event: "decline" }, ({ payload }) => {
          setActive((cur) => (cur?.sessionId === (payload as { sessionId: string }).sessionId ? null : cur));
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }, [meId]);

    useEffect(() => {
      if (incoming) {
        const audio = new Audio("/ringtone.mp3");
        audio.loop = true;
        audio.play().catch(() => {});
        ringtoneRef.current = audio;
        return () => { audio.pause(); ringtoneRef.current = null; };
      }
    }, [incoming]);

    const startCall = useCallback(
      async (chatId: string, otherMemberIds: string[], kind: CallKind, groupCall: boolean) => {
        const sessionId = crypto.randomUUID();
        await Promise.all(
          otherMemberIds.map((id) =>
            supabase.channel(`calls:${id}`).send({
              type: "broadcast",
              event: "invite",
              payload: { sessionId, chatId, kind, fromId: meId, fromName: meName, fromAvatar: meAvatar } satisfies IncomingCall,
            })
          )
        );
        setActive({ sessionId, chatId, kind, groupCall });
      },
      [meId, meName, meAvatar]
    );

    useImperativeHandle(ref, () => ({ startCall }), [startCall]);

    const acceptIncoming = () => {
      if (!incoming) return;
      setActive({ sessionId: incoming.sessionId, chatId: incoming.chatId, kind: incoming.kind, groupCall: false });
      setIncoming(null);
    };

    const declineIncoming = () => {
      if (!incoming) return;
      supabase.channel(`calls:${incoming.fromId}`).send({
        type: "broadcast",
        event: "decline",
        payload: { sessionId: incoming.sessionId },
      });
      setIncoming(null);
    };

    return (
      <>
        {incoming && (
          <div className="fixed inset-0 z-[110] flex flex-col items-center justify-center gap-6 bg-black/80 backdrop-blur-sm text-white">
            <div className="h-24 w-24 overflow-hidden rounded-full ring-4 ring-[#D97757]">
              {incoming.fromAvatar ? (
                <img src={incoming.fromAvatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center bg-[#D97757] text-2xl font-bold">
                  {incoming.fromName?.[0]?.toUpperCase() ?? "?"}
                </div>
              )}
            </div>
            <div className="text-center">
              <p className="text-xl font-semibold">{incoming.fromName}</p>
              <p className="text-sm text-white/60">
                Incoming {incoming.kind === "video" ? "video" : "voice"} call…
              </p>
            </div>
            <div className="flex items-center gap-10">
              <button
                onClick={declineIncoming}
                className="grid h-14 w-14 place-items-center rounded-full bg-red-500 hover:bg-red-600"
                aria-label="Decline"
              >
                <PhoneOff className="h-6 w-6" />
              </button>
              <button
                onClick={acceptIncoming}
                className="grid h-14 w-14 place-items-center rounded-full bg-emerald-500 hover:bg-emerald-600"
                aria-label="Accept"
              >
                {incoming.kind === "video" ? <Video className="h-6 w-6" /> : <Phone className="h-6 w-6" />}
              </button>
            </div>
          </div>
        )}

        {active && (
          <CallOverlay
            roomId={active.sessionId}
            userId={meId}
            userName={meName}
            kind={active.kind}
            groupCall={active.groupCall}
            onLeave={() => setActive(null)}
          />
        )}
      </>
    );
  }
);
