import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import {
  Phone,
  PhoneOff,
  PhoneMissed,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Volume2,
  MessageSquare,
  MoreVertical,
  User,
  Users,
  Clock,
  Shield,
  Radio,
} from "lucide-react";
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

/* ─── Lucide Icon Background Pattern ─── */
function IconBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
      <Phone className="absolute top-[12%] left-[18%] text-white/[0.04] rotate-12" size={32} strokeWidth={1.5} />
      <Video className="absolute top-[28%] right-[14%] text-white/[0.035] -rotate-6" size={28} strokeWidth={1.5} />
      <MessageSquare className="absolute bottom-[22%] left-[12%] text-white/[0.03] rotate-3" size={24} strokeWidth={1.5} />
      <Mic className="absolute top-[55%] right-[20%] text-white/[0.03] -rotate-12" size={36} strokeWidth={1.5} />
      <Radio className="absolute top-[42%] left-[8%] text-white/[0.025] rotate-45" size={20} strokeWidth={1.5} />
      <Users className="absolute bottom-[35%] right-[10%] text-white/[0.03]" size={28} strokeWidth={1.5} />
      <Shield className="absolute top-[8%] left-[50%] text-white/[0.02]" size={24} strokeWidth={1.5} />
    </div>
  );
}

/* ─── Enhanced Pulsing Avatar ─── */
function CallerAvatar({
  name,
  avatar,
  size = 128,
  pulse = true,
}: {
  name: string;
  avatar: string | null;
  size?: number;
  pulse?: boolean;
}) {
  const initial = name?.[0]?.toUpperCase() ?? "?";
  const gradient = avatar
    ? undefined
    : "bg-gradient-to-br from-[#25D366] to-[#128C7E]";

  return (
    <div
      className="relative grid place-items-center"
      style={{ width: size + 48, height: size + 48 }}
    >
      {pulse && (
        <>
          <span
            className="absolute rounded-full border border-white/[0.08] animate-ping"
            style={{ width: size + 48, height: size + 48, animationDuration: "2.5s" }}
          />
          <span
            className="absolute rounded-full border border-white/[0.12] animate-ping"
            style={{
              width: size + 28,
              height: size + 28,
              animationDuration: "2.5s",
              animationDelay: "0.5s",
            }}
          />
          <span
            className="absolute rounded-full bg-white/[0.06] animate-ping"
            style={{
              width: size + 12,
              height: size + 12,
              animationDuration: "2.5s",
              animationDelay: "1s",
            }}
          />
        </>
      )}
      <div
        className={`relative overflow-hidden rounded-full ring-2 ring-white/20 shadow-2xl shadow-black/50 ${gradient}`}
        style={{ width: size, height: size }}
      >
        {avatar ? (
          <img src={avatar} alt={name} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-4xl font-bold text-white">
            {initial}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Round Call Control Button ─── */
function CallButton({
  onClick,
  variant = "default",
  icon: Icon,
  label,
  size = "lg",
}: {
  onClick: () => void;
  variant?: "default" | "danger" | "success" | "glass";
  icon: React.ElementType;
  label: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClasses = {
    sm: "h-12 w-12",
    md: "h-14 w-14",
    lg: "h-16 w-16",
  };

  const variantClasses = {
    default: "bg-white/15 hover:bg-white/25 text-white",
    danger: "bg-[#FA3B4B] hover:bg-[#e2323f] text-white shadow-lg shadow-red-500/20",
    success: "bg-[#25D366] hover:bg-[#128C7E] text-white shadow-lg shadow-green-500/20",
    glass: "bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm",
  };

  const iconSizes = { sm: 18, md: 20, lg: 24 };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={onClick}
        aria-label={label}
        className={`grid place-items-center rounded-full transition-all duration-300 active:scale-95 hover:scale-110 ${sizeClasses[size]} ${variantClasses[variant]}`}
      >
        <Icon size={iconSizes[size]} strokeWidth={2} />
      </button>
      <span className="text-[11px] font-medium text-white/60 tracking-wide">{label}</span>
    </div>
  );
}

/* ─── Active Call Control Bar ─── */
function ActiveCallControls({
  kind,
  onLeave,
}: {
  kind: CallKind;
  onLeave: () => void;
}) {
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [speaker, setSpeaker] = useState(false);

  return (
    <div className="flex w-full max-w-sm items-end justify-between px-4 pb-6">
      <CallButton
        onClick={() => setMuted((m) => !m)}
        variant="glass"
        icon={muted ? MicOff : Mic}
        label={muted ? "Unmute" : "Mute"}
        size="sm"
      />
      <CallButton
        onClick={() => setSpeaker((s) => !s)}
        variant="glass"
        icon={Volume2}
        label={speaker ? "Earpiece" : "Speaker"}
        size="sm"
      />
      <CallButton
        onClick={() => {}}
        variant="glass"
        icon={MessageSquare}
        label="Chat"
        size="sm"
      />
      {kind === "video" && (
        <CallButton
          onClick={() => setVideoOff((v) => !v)}
          variant="glass"
          icon={videoOff ? VideoOff : Video}
          label={videoOff ? "Start" : "Stop"}
          size="sm"
        />
      )}
      <CallButton
        onClick={onLeave}
        variant="danger"
        icon={PhoneMissed}
        label="End"
        size="md"
      />
    </div>
  );
}

export const CallManager = forwardRef<
  CallManagerHandle,
  { meId: string; meName: string; meAvatar: string | null }
>(function CallManager({ meId, meName, meAvatar }, ref) {
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const [outgoing, setOutgoing] = useState<OutgoingCall | null>(null);
  const [active, setActive] = useState<ActiveCall | null>(null);
  const ringSecondsRef = useRef(0);
  const [ringSeconds, setRingSeconds] = useState(0);
  const [callDuration, setCallDuration] = useState(0);

  /* ── Supabase broadcast listeners ── */
  useEffect(() => {
    const channel = supabase.channel(`calls:${meId}`);
    channel
      .on("broadcast", { event: "invite" }, ({ payload }) => {
        setIncoming(payload as IncomingCall);
      })
      .on("broadcast", { event: "cancel" }, ({ payload }) => {
        setIncoming((cur) =>
          cur?.sessionId === (payload as { sessionId: string }).sessionId ? null : cur
        );
      })
      .on("broadcast", { event: "accept" }, ({ payload }) => {
        setOutgoing((cur) => {
          if (cur?.sessionId !== (payload as { sessionId: string }).sessionId) return cur;
          setActive({
            sessionId: cur.sessionId,
            chatId: cur.chatId,
            kind: cur.kind,
            groupCall: cur.groupCall,
          });
          return null;
        });
      })
      .on("broadcast", { event: "decline" }, ({ payload }) => {
        const sid = (payload as { sessionId: string }).sessionId;
        setOutgoing((cur) => (cur?.sessionId === sid ? null : cur));
        setActive((cur) => (cur?.sessionId === sid ? null : cur));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [meId]);

  /* ── Ringtone ── */
  useEffect(() => {
    if (!incoming) return;
    const audio = new Audio("/ringtone.mp3");
    audio.loop = true;
    audio.play().catch(() => {});
    return () => {
      audio.pause();
    };
  }, [incoming]);

  /* ── Outgoing ring timer ── */
  useEffect(() => {
    if (!outgoing) {
      ringSecondsRef.current = 0;
      setRingSeconds(0);
      return;
    }
    const t = setInterval(() => {
      ringSecondsRef.current += 1;
      setRingSeconds(ringSecondsRef.current);
    }, 1000);
    return () => clearInterval(t);
  }, [outgoing]);

  /* ── Active call duration timer ── */
  useEffect(() => {
    if (!active) {
      setCallDuration(0);
      return;
    }
    const t = setInterval(() => setCallDuration((d) => d + 1), 1000);
    return () => clearInterval(t);
  }, [active]);

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
            payload: {
              sessionId,
              chatId,
              kind,
              fromId: meId,
              fromName: meName,
              fromAvatar: meAvatar,
            } satisfies IncomingCall,
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
    setActive({
      sessionId: incoming.sessionId,
      chatId: incoming.chatId,
      kind: incoming.kind,
      groupCall: false,
    });
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

  const endActive = () => {
    setActive(null);
  };

  const fmtTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <>
      {/* ═══════════════════════════════════════
          INCOMING CALL SCREEN
         ═══════════════════════════════════════ */}
      {incoming && (
        <div className="fixed inset-0 z-[110] flex flex-col items-center justify-between bg-gradient-to-b from-[#0b141a] via-[#111b21] to-[#0b141a] text-white">
          <IconBackground />

          {/* Header */}
          <div className="flex flex-col items-center gap-2 mt-20">
            <p className="text-xs font-semibold tracking-[0.25em] text-white/50 uppercase">
              Incoming {incoming.kind === "video" ? "Video Call" : "Voice Call"}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[#25D366] animate-pulse" />
              <span className="text-[11px] font-medium text-[#25D366]/80 tracking-wider">
                SonaTG
              </span>
            </div>
          </div>

          {/* Avatar + Name */}
          <div className="flex flex-col items-center gap-6">
            <CallerAvatar
              name={incoming.fromName}
              avatar={incoming.fromAvatar}
              size={140}
            />
            <div className="text-center">
              <h2 className="text-3xl font-semibold tracking-tight text-white">
                {incoming.fromName}
              </h2>
              <p className="mt-2 text-sm text-white/40 font-medium">
                {incoming.kind === "video" ? "Video call" : "Voice call"} incoming…
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex w-full max-w-xs items-center justify-between px-8 pb-16">
            <CallButton
              onClick={declineIncoming}
              variant="danger"
              icon={PhoneOff}
              label="Decline"
            />
            <CallButton
              onClick={acceptIncoming}
              variant="success"
              icon={Phone}
              label="Accept"
            />
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          OUTGOING CALL SCREEN
         ═══════════════════════════════════════ */}
      {outgoing && (
        <div className="fixed inset-0 z-[110] flex flex-col items-center justify-between bg-gradient-to-b from-[#0b141a] via-[#111b21] to-[#0b141a] text-white">
          <IconBackground />

          <div className="mt-20">
            <p className="text-xs font-semibold tracking-[0.25em] text-white/50 uppercase">
              {outgoing.kind === "video" ? "Video Calling" : "Calling"}
            </p>
          </div>

          <div className="flex flex-col items-center gap-6">
            <CallerAvatar
              name={outgoing.targetName}
              avatar={outgoing.targetAvatar}
              size={132}
              pulse={false}
            />
            <div className="text-center">
              <h2 className="text-3xl font-semibold tracking-tight text-white">
                {outgoing.targetName}
              </h2>
              <div className="flex items-center justify-center gap-2 mt-3">
                <span className="text-sm text-white/50 font-medium tabular-nums">
                  {fmtTime(ringSeconds)}
                </span>
                <span className="flex gap-0.5">
                  <span
                    className="w-1 h-1 rounded-full bg-white/40 animate-bounce"
                    style={{ animationDelay: "0s" }}
                  />
                  <span
                    className="w-1 h-1 rounded-full bg-white/40 animate-bounce"
                    style={{ animationDelay: "0.15s" }}
                  />
                  <span
                    className="w-1 h-1 rounded-full bg-white/40 animate-bounce"
                    style={{ animationDelay: "0.3s" }}
                  />
                </span>
              </div>
            </div>
          </div>

          <div className="pb-16">
            <CallButton
              onClick={cancelOutgoing}
              variant="danger"
              icon={PhoneOff}
              label="Cancel"
            />
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          ACTIVE CALL SCREEN
         ═══════════════════════════════════════ */}
      {active && (
        <div className="fixed inset-0 z-[110] flex flex-col items-center bg-gradient-to-b from-[#0b141a] via-[#111b21] to-[#0b141a] text-white">
          <IconBackground />

          {/* Top Bar */}
          <div className="flex flex-col items-center gap-3 mt-6">
            <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-white/20 shadow-lg">
              {active.groupCall ? (
                <div className="w-full h-full bg-gradient-to-br from-[#34B7F1] to-[#128C7E] grid place-items-center">
                  <Users size={28} className="text-white" />
                </div>
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#25D366] to-[#128C7E] grid place-items-center text-xl font-bold">
                  {"?"}
                </div>
              )}
            </div>
            <div className="text-center">
              <h3 className="text-base font-semibold text-white">
                {active.groupCall ? "Group Call" : "Active Call"}
              </h3>
              <div className="flex items-center justify-center gap-1.5 mt-1">
                <Clock size={12} className="text-white/50" />
                <span className="text-xs text-white/50 tabular-nums font-medium">
                  {fmtTime(callDuration)}
                </span>
              </div>
            </div>
          </div>

          {/* Video Placeholder / Call Overlay */}
          <div className="flex-1 flex items-center justify-center w-full max-w-sm mx-4 my-4">
            <CallOverlay
              roomId={active.sessionId}
              userId={meId}
              userName={meName}
              kind={active.kind}
              groupCall={active.groupCall}
              onLeave={endActive}
            />
          </div>

          {/* Bottom Controls */}
          <ActiveCallControls kind={active.kind} onLeave={endActive} />
        </div>
      )}
    </>
  );
});
