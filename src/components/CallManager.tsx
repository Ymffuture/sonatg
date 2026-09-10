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
  targetName?: string;
  targetAvatar?: string | null;
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
    sm: "h-14 w-14",
    md: "h-16 w-16",
    lg: "h-20 w-20",
  };

  const variantClasses = {
    default: "bg-white/15 hover:bg-white/25 text-white border border-white/10",
    danger: "bg-[#FA3B4B] hover:bg-[#e2323f] text-white shadow-xl shadow-red-500/30 border border-red-400/20",
    success: "bg-[#25D366] hover:bg-[#128C7E] text-white shadow-xl shadow-green-500/30 border border-green-400/20",
    glass: "bg-white/10 hover:bg-white/20 text-white backdrop-blur-md border border-white/10",
  };

  const iconSizes = { sm: 22, md: 26, lg: 32 };

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={onClick}
        aria-label={label}
        className={`grid place-items-center rounded-full transition-all duration-300 active:scale-90 hover:scale-105 ${sizeClasses[size]} ${variantClasses[variant]}`}
      >
        <Icon size={iconSizes[size]} strokeWidth={2} />
      </button>
      <span className="text-[11px] font-medium text-white/60 tracking-wide uppercase">{label}</span>
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
    <div className="relative z-10 w-full px-6 pb-12 pt-4 flex flex-col items-center gap-8">
      {/* Secondary Controls Row */}
      <div className="flex items-center justify-center gap-8 w-full max-w-xs">
        <CallButton
          onClick={() => setMuted((m) => !m)}
          variant={muted ? "danger" : "glass"}
          icon={muted ? MicOff : Mic}
          label={muted ? "Unmute" : "Mute"}
          size="sm"
        />
        <CallButton
          onClick={() => setSpeaker((s) => !s)}
          variant={speaker ? "success" : "glass"}
          icon={Volume2}
          label={speaker ? "Speaker" : "Earpiece"}
          size="sm"
        />
        {kind === "video" && (
          <CallButton
            onClick={() => setVideoOff((v) => !v)}
            variant={videoOff ? "danger" : "glass"}
            icon={videoOff ? VideoOff : Video}
            label={videoOff ? "Video On" : "Video Off"}
            size="sm"
          />
        )}
      </div>

      {/* End Call Button */}
      <button
        onClick={onLeave}
        aria-label="End call"
        className="group relative flex items-center justify-center w-20 h-20 rounded-full bg-[#FA3B4B] hover:bg-[#e2323f] text-white shadow-xl shadow-red-500/30 border border-red-400/20 transition-all duration-300 active:scale-90 hover:scale-105"
      >
        <PhoneOff size={32} strokeWidth={2} className="transition-transform group-hover:rotate-12" />
        <span className="absolute -bottom-8 text-xs font-medium text-white/60 tracking-wider uppercase">End</span>
      </button>
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
  const callStartedAtRef = useRef<number | null>(null);
  const isCallerRef = useRef(false);

  const fmtTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const insertCallLog = useCallback(
    async (chatId: string, kind: CallKind, outcome: "answered" | "missed" | "declined", durationMs: number) => {
      await supabase.from("messages").insert({
        chat_id: chatId,
        sender_id: meId,
        kind: "call",
        file_name: JSON.stringify({ kind, outcome, durationMs }),
      });
    },
    [meId]
  );

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
          isCallerRef.current = true;
          callStartedAtRef.current = Date.now();
          setActive({
            sessionId: cur.sessionId,
            chatId: cur.chatId,
            kind: cur.kind,
            groupCall: cur.groupCall,
            targetName: cur.targetName,
            targetAvatar: cur.targetAvatar,
          });
          return null;
        });
      })
      .on("broadcast", { event: "decline" }, ({ payload }) => {
        const sid = (payload as { sessionId: string }).sessionId;
        setOutgoing((cur) => {
          if (cur?.sessionId === sid) insertCallLog(cur.chatId, cur.kind, "declined", 0);
          return cur?.sessionId === sid ? null : cur;
        });
        setActive((cur) => (cur?.sessionId === sid ? null : cur));
      })
      .on("broadcast", { event: "resolved-elsewhere" }, ({ payload }) => {
        const sid = (payload as { sessionId: string }).sessionId;
        setIncoming((cur) => (cur?.sessionId === sid ? null : cur));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [meId, insertCallLog]);

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
    supabase.channel(`calls:${meId}`).send({
      type: "broadcast",
      event: "resolved-elsewhere",
      payload: { sessionId: incoming.sessionId },
    });
    isCallerRef.current = false;
    callStartedAtRef.current = null;
    setActive({
      sessionId: incoming.sessionId,
      chatId: incoming.chatId,
      kind: incoming.kind,
      groupCall: false,
      targetName: incoming.fromName,
      targetAvatar: incoming.fromAvatar,
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
    supabase.channel(`calls:${meId}`).send({
      type: "broadcast",
      event: "resolved-elsewhere",
      payload: { sessionId: incoming.sessionId },
    });
    setIncoming(null);
  };

  const cancelOutgoing = () => {
    if (!outgoing) return;
    insertCallLog(outgoing.chatId, outgoing.kind, "missed", 0);
    setOutgoing(null);
  };

  const endActive = () => {
    if (active && isCallerRef.current && callStartedAtRef.current) {
      const durationMs = Date.now() - callStartedAtRef.current;
      insertCallLog(active.chatId, active.kind, "answered", durationMs);
    }
    isCallerRef.current = false;
    callStartedAtRef.current = null;
    setActive(null);
  };

  return (
    <>
      {/* ═══════════════════════════════════════
          INCOMING CALL SCREEN
         ═══════════════════════════════════════ */}
      {incoming && (
        <div className="fixed inset-0 z-[110] flex flex-col items-center justify-between bg-[#0b141a] text-white overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-[#0b141a] via-[#111b21] to-[#0b141a]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(37,211,102,0.15),transparent_60%)]" />
          <IconBackground />

          <div className="relative z-10 flex flex-col items-center gap-3 mt-16">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-4 py-1.5 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse" />
              <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-white/70">
                Incoming {incoming.kind === "video" ? "Video" : "Voice"} Call
              </span>
            </span>
          </div>

          <div className="relative z-10 flex flex-col items-center gap-8">
            <CallerAvatar name={incoming.fromName} avatar={incoming.fromAvatar} size={144} />
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-white drop-shadow-lg">
                {incoming.fromName}
              </h2>
              <p className="mt-3 text-sm font-medium text-white/50">
                {incoming.kind === "video" ? "Video call" : "Voice call"} incoming…
              </p>
            </div>
          </div>

          <div className="relative z-10 flex w-full max-w-xs items-center justify-between px-8 pb-16">
            <CallButton onClick={declineIncoming} variant="danger" icon={PhoneOff} label="Decline" />
            <CallButton onClick={acceptIncoming} variant="success" icon={Phone} label="Accept" />
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          OUTGOING CALL SCREEN
         ═══════════════════════════════════════ */}
      {outgoing && (
        <div className="fixed inset-0 z-[110] flex flex-col items-center justify-between bg-[#0b141a] text-white overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-[#0b141a] via-[#111b21] to-[#0b141a]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(37,211,102,0.1),transparent_60%)]" />
          <IconBackground />

          <div className="relative z-10 mt-16">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-4 py-1.5 backdrop-blur-md">
              <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-white/70">
                {outgoing.kind === "video" ? "Video Calling" : "Calling"}
              </span>
            </span>
          </div>

          <div className="relative z-10 flex flex-col items-center gap-8">
            <CallerAvatar name={outgoing.targetName} avatar={outgoing.targetAvatar} size={132} pulse={false} />
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-white drop-shadow-lg">
                {outgoing.targetName}
              </h2>
              <div className="flex items-center justify-center gap-3 mt-4 bg-white/5 border border-white/10 rounded-full px-5 py-2 backdrop-blur-md">
                <span className="text-lg font-mono font-medium text-white/90 tabular-nums tracking-wider">
                  {fmtTime(ringSeconds)}
                </span>
                <span className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] animate-bounce" style={{ animationDelay: "0s" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] animate-bounce" style={{ animationDelay: "0.15s" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] animate-bounce" style={{ animationDelay: "0.3s" }} />
                </span>
              </div>
            </div>
          </div>

          <div className="relative z-10 pb-16">
            <CallButton onClick={cancelOutgoing} variant="danger" icon={PhoneOff} label="Cancel" />
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          ACTIVE CALL SCREEN
         ═══════════════════════════════════════ */}
      {active && (
        <div className="fixed inset-0 z-[110] flex flex-col items-center bg-[#0b141a] text-white overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-[#0b141a] via-[#111b21] to-[#0b141a]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(37,211,102,0.15),transparent_50%)]" />
          <IconBackground />

          {/* Top Info with Prominent Timer */}
          <div className="relative z-10 flex flex-col items-center gap-5 mt-10 w-full px-6">
            <div className="relative">
              <div className="absolute inset-0 bg-[#25D366]/20 blur-3xl rounded-full animate-pulse" />
              <div className="relative w-28 h-28 rounded-full overflow-hidden ring-2 ring-white/20 shadow-2xl bg-gradient-to-br from-[#25D366] to-[#128C7E] grid place-items-center">
                {active.groupCall ? (
                  <Users size={48} className="text-white/90" />
                ) : active.targetAvatar ? (
                  <img src={active.targetAvatar} alt={active.targetName} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-4xl font-bold text-white">
                    {active.targetName?.[0]?.toUpperCase() ?? "?"}
                  </span>
                )}
              </div>
            </div>
            <div className="text-center z-10">
              <h3 className="text-xl font-semibold text-white tracking-tight drop-shadow-md">
                {active.groupCall ? "Group Call" : "Active Call"}
              </h3>
              <div className="flex items-center justify-center gap-2 mt-3 bg-white/10 backdrop-blur-md px-5 py-2 rounded-full border border-white/10 shadow-lg">
                <Clock size={16} className="text-[#25D366]" />
                <span className="text-xl text-white tabular-nums font-mono font-medium tracking-wider">
                  {fmtTime(callDuration)}
                </span>
              </div>
            </div>
          </div>

          {/* Video Placeholder / Call Overlay */}
          <div className="relative z-10 flex-1 flex items-center justify-center w-full max-w-sm mx-4 my-6">
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
