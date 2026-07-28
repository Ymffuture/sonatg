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

type OutgoingCall = {
  sessionId: string;
  chatId: string;
  kind: CallKind;
  groupCall: boolean;
  targetName: string;
  targetAvatar: string | null;
};

type ActiveCall = {
  sessionId: string;
  chatId: string;
  kind: CallKind;
  groupCall: boolean;
};

export type CallManagerHandle = {
  startCall: (
    chatId: string,
    otherMemberIds: string[],
    kind: CallKind,
    groupCall: boolean,
    targetName: string,
    targetAvatar: string | null
  ) => Promise<void>;
};

/* ─── WhatsApp-style pulsing avatar ─── */
function CallerAvatar({ name, avatar, size = 128 }: { name: string; avatar: string | null; size?: number }) {
  return (
    <div className="relative grid place-items-center" style={{ width: size + 48, height: size + 48 }}>
      <span className="absolute rounded-full bg-white/10 animate-ping" style={{ width: size + 48, height: size + 48, animationDuration: "2.2s" }} />
      <span className="absolute rounded-full bg-white/10 animate-ping" style={{ width: size + 24, height: size + 24, animationDuration: "2.2s", animationDelay: "0.4s" }} />
      <div className="relative overflow-hidden rounded-full ring-2 ring-white/20" style={{ width: size, height: size }}>
        {avatar ? (
          <img src={avatar} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center bg-[#25D366] text-4xl font-semibold text-white">
            {name?.[0]?.toUpperCase() ?? "?"}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Round call-control button, WhatsApp style (icon + label) ─── */
function CallButton({
  onClick, danger, children, label,
}: { onClick: () => void; danger?: boolean; children: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={onClick}
        aria-label={label}
        className={`grid h-16 w-16 place-items-center rounded-full transition-colors ${
          danger ? "bg-[#FA3B4B] hover:bg-[#e2323f]" : "bg-white/15 hover:bg-white/25 text-white"
        }`}
      >
        {children}
      </button>
      <span className="text-xs text-white/70">{label}</span>
    </div>
  );
}

// Mounted once near the top of SonaChat so incoming calls can ring even
// while the caller's chat isn't the one currently open. Each user listens
// on their own personal broadcast channel (`calls:${meId}`) for invites;
// starting a call broadcasts an invite to every other member of the chat.
export const CallManager = forwardRef<CallManagerHandle, { meId: string; meName: string; meAvatar: string | null }>(
  function CallManager({ meId, meName, meAvatar }, ref) {
    const [incoming, setIncoming] = useState<IncomingCall | null>(null);
    const [outgoing, setOutgoing] = useState<OutgoingCall | null>(null);
    const [active, setActive] = useState<ActiveCall | null>(null);
    const ringSecondsRef = useRef(0);
    const [ringSeconds, setRingSeconds] = useState(0);

    useEffect(() => {
      const channel = supabase.channel(`calls:${meId}`);
      channel
        .on("broadcast", { event: "invite" }, ({ payload }) => {
          setIncoming(payload as IncomingCall);
        })
        .on("broadcast", { event: "cancel" }, ({ payload }) => {
          setIncoming((cur) => (cur?.sessionId === (payload as { sessionId: string }).sessionId ? null : cur));
        })
        .on("broadcast", { event: "accept" }, ({ payload }) => {
          setOutgoing((cur) => {
            if (cur?.sessionId !== (payload as { sessionId: string }).sessionId) return cur;
            setActive({ sessionId: cur.sessionId, chatId: cur.chatId, kind: cur.kind, groupCall: cur.groupCall });
            return null;
          });
        })
        .on("broadcast", { event: "decline" }, ({ payload }) => {
          setOutgoing((cur) => (cur?.sessionId === (payload as { sessionId: string }).sessionId ? null : cur));
          setActive((cur) => (cur?.sessionId === (payload as { sessionId: string }).sessionId ? null : cur));
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }, [meId]);

    // Ringtone while the incoming-call screen is up.
    useEffect(() => {
      if (incoming) {
        const audio = new Audio("/ringtone.mp3");
        audio.loop = true;
        audio.play().catch(() => {});
        return () => audio.pause();
      }
    }, [incoming]);

    // "Calling…" elapsed-seconds counter for the outgoing screen.
    useEffect(() => {
      if (!outgoing) { ringSecondsRef.current = 0; setRingSeconds(0); return; }
      const t = setInterval(() => { ringSecondsRef.current += 1; setRingSeconds(ringSecondsRef.current); }, 1000);
      return () => clearInterval(t);
    }, [outgoing]);

    const startCall = useCallback(
      async (
        chatId: string,
        otherMemberIds: string[],
        kind: CallKind,
        groupCall: boolean,
        targetName: string,
        targetAvatar: string | null
      ) => {
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
        setOutgoing({ sessionId, chatId, kind, groupCall, targetName, targetAvatar });
      },
      [meId, meName, meAvatar]
    );

    useImperativeHandle(ref, () => ({ startCall }), [startCall]);

    const acceptIncoming = () => {
      if (!incoming) return;
      supabase.channel(`calls:${incoming.fromId}`).send({
        type: "broadcast",
        event: "accept",
        payload: { sessionId: incoming.sessionId },
      });
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

    const cancelOutgoing = () => {
      if (!outgoing) return;
      setOutgoing(null);
    };

    const fmtRing = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

    return (
      <>
        {/* ─── Incoming call ─── */}
        {incoming && (
          <div className="fixed inset-0 z-[110] flex flex-col items-center justify-between bg-gradient-to-b from-[#0b141a] via-[#111b21] to-[#0b141a] py-16 text-white">
            <p className="text-sm font-medium tracking-wide text-white/60">
              Incoming {incoming.kind === "video" ? "video call" : "voice call"}
            </p>

            <div className="flex flex-col items-center gap-6">
              <CallerAvatar name={incoming.fromName} avatar={incoming.fromAvatar} />
              <div className="text-center">
                <p className="text-2xl font-semibold">{incoming.fromName}</p>
                <p className="mt-1 text-sm text-white/50">SonaTG</p>
              </div>
            </div>

            <div className="flex w-full max-w-xs items-center justify-between px-8">
              <CallButton onClick={declineIncoming} danger label="Decline">
                <PhoneOff className="h-7 w-7" />
              </CallButton>
              <CallButton onClick={acceptIncoming} label="Accept">
                <Phone className="h-7 w-7 text-[#25D366]" />
              </CallButton>
            </div>
          </div>
        )}

        {/* ─── Outgoing call ("Calling…") ─── */}
        {outgoing && (
          <div className="fixed inset-0 z-[110] flex flex-col items-center justify-between bg-gradient-to-b from-[#0b141a] via-[#111b21] to-[#0b141a] py-16 text-white">
            <div />
            <div className="flex flex-col items-center gap-6">
              <CallerAvatar name={outgoing.targetName} avatar={outgoing.targetAvatar} />
              <div className="text-center">
                <p className="text-2xl font-semibold">{outgoing.targetName}</p>
                <p className="mt-1 text-sm text-white/50">
                  {outgoing.kind === "video" ? "Video calling…" : "Calling…"} {fmtRing(ringSeconds)}
                </p>
              </div>
            </div>
            <CallButton onClick={cancelOutgoing} danger label="Cancel">
              <PhoneOff className="h-7 w-7" />
            </CallButton>
          </div>
        )}

        {/* ─── Connected call ─── */}
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
