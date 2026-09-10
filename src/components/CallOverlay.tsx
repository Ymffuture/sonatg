import { useEffect, useRef, useState } from "react";
import { Phone, ShieldCheck, Wifi, AlertTriangle } from "lucide-react";

// Requires two env vars, set in your deployment (Vercel -> Project Settings
// -> Environment Variables) AND locally in .env / .env.local:
//   VITE_ZEGO_APP_ID        — numeric App ID from the ZegoCloud console
//   VITE_ZEGO_SERVER_SECRET — the 32-char Server Secret from the same project
//
// These use generateKitTokenForTest(), ZegoCloud's own client-side token
// helper meant for getting calls working quickly during development. It's
// fine to ship with while you're building, but because the secret has to be
// bundled into client JS for this to work, anyone could technically extract
// it from your app and mint their own room tokens. For production hardening,
// move token generation to a server function (like cloudinary.functions.ts
// does for Cloudinary) using Zego's token04 server-side signing — see
// https://docs.zegocloud.com/article/11648 for the algorithm.
//
// Both App ID and Server Secret live in Zego's console under
// Project Management -> your project -> Basic information.

export type CallKind = "voice" | "video";

export function CallOverlay({
  roomId,
  userId,
  userName,
  kind,
  groupCall,
  onLeave,
}: {
  roomId: string;
  userId: string;
  userName: string;
  kind: CallKind;
  groupCall: boolean;
  onLeave: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let zp: { destroy: () => void } | null = null;
    let cancelled = false;

    (async () => {
      const appId = Number(import.meta.env.VITE_ZEGO_APP_ID);
      const serverSecret = import.meta.env.VITE_ZEGO_SERVER_SECRET as string;

      if (!appId || !serverSecret) {
        console.error(
          "ZegoCloud is not configured — set VITE_ZEGO_APP_ID and VITE_ZEGO_SERVER_SECRET."
        );
        setError("Call service not configured.");
        setIsConnecting(false);
        return;
      }

      try {
        const { ZegoUIKitPrebuilt } = await import("@zegocloud/zego-uikit-prebuilt");
        if (cancelled || !containerRef.current) return;

        const token = ZegoUIKitPrebuilt.generateKitTokenForTest(
          appId,
          serverSecret,
          roomId,
          userId,
          userName
        );

        const instance = ZegoUIKitPrebuilt.create(token);
        zp = instance;

        instance.joinRoom({
          container: containerRef.current,
          scenario: {
            mode: groupCall ? ZegoUIKitPrebuilt.GroupCall : ZegoUIKitPrebuilt.OneONoneCall,
          },
          turnOnMicrophoneWhenJoining: true,
          turnOnCameraWhenJoining: kind === "video",
          showMyCameraToggleButton: kind === "video",
          showMyMicrophoneToggleButton: true,
          showAudioVideoSettingsButton: true,
          showScreenSharingButton: kind === "video",
          showTextChat: false,
          showUserList: groupCall,
          showLeavingView: false,
          onJoinRoom: () => {
            if (!cancelled) {
              // Small delay to let Zego render its first frame before fading out our overlay
              setTimeout(() => setIsConnecting(false), 400);
            }
          },
          onLeaveRoom: onLeave,
        });
      } catch (err) {
        console.error("Failed to initialize ZegoCloud:", err);
        setError("Failed to connect to call servers.");
        setIsConnecting(false);
      }
    })();

    return () => {
      cancelled = true;
      zp?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-[#0b141a] overflow-hidden">
      {/* Zego Container (Fades in once connected) */}
      <div 
        ref={containerRef} 
        className={`h-full w-full transition-opacity duration-700 ease-in-out ${isConnecting ? 'opacity-0' : 'opacity-100'}`} 
      />

      {/* Premium Connecting Overlay */}
      {isConnecting && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gradient-to-b from-[#0b141a] via-[#111b21] to-[#0b141a] text-white">
          {/* Ambient Glow */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(37,211,102,0.15),transparent_60%)] pointer-events-none" />
          
          <div className="relative z-10 flex flex-col items-center px-6">
            {error ? (
              <>
                <div className="relative mb-8">
                  <div className="absolute inset-0 bg-[#FA3B4B]/20 blur-3xl rounded-full" />
                  <div className="relative w-24 h-24 rounded-full overflow-hidden ring-2 ring-red-500/30 shadow-2xl bg-[#FA3B4B]/10 grid place-items-center">
                    <AlertTriangle size={40} className="text-[#FA3B4B]" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-white drop-shadow-lg text-center">
                  Connection Failed
                </h2>
                <p className="mt-3 text-sm font-medium text-white/50 max-w-xs text-center leading-relaxed">
                  {error} Please check your internet connection and try again.
                </p>
                <button
                  onClick={onLeave}
                  className="mt-8 px-6 py-3 rounded-full bg-white/10 border border-white/10 text-white font-semibold backdrop-blur-md hover:bg-white/20 transition-all active:scale-95"
                >
                  Go Back
                </button>
              </>
            ) : (
              <>
                <div className="relative mb-10">
                  <div className="absolute inset-0 bg-[#25D366]/20 blur-3xl rounded-full animate-pulse" />
                  <div className="relative w-24 h-24 rounded-full overflow-hidden ring-2 ring-white/20 shadow-2xl bg-gradient-to-br from-[#25D366] to-[#128C7E] grid place-items-center">
                    <Phone size={40} className="text-white animate-pulse" />
                  </div>
                  {/* Expanding rings */}
                  <span className="absolute inset-0 rounded-full border border-[#25D366]/40 animate-ping" style={{ animationDuration: '2s' }} />
                  <span className="absolute inset-[-16px] rounded-full border border-[#25D366]/20 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
                </div>
                
                <h2 className="text-2xl font-bold tracking-tight text-white drop-shadow-lg">
                  {groupCall ? "Joining Group Call" : "Connecting..."}
                </h2>
                
                <p className="mt-4 text-sm font-medium text-white/60 flex items-center gap-2">
                  <ShieldCheck size={14} className="text-[#25D366]" />
                  Setting up secure connection
                </p>
                
                <div className="mt-8 flex gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#25D366] animate-bounce" style={{ animationDelay: "0s" }} />
                  <span className="w-2 h-2 rounded-full bg-[#25D366] animate-bounce" style={{ animationDelay: "0.15s" }} />
                  <span className="w-2 h-2 rounded-full bg-[#25D366] animate-bounce" style={{ animationDelay: "0.3s" }} />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Custom CSS to polish Zego's default UI slightly */}
      <style>{`
        /* Ensure video feeds cover their containers nicely */
        .zego-uikit-prebuilt-container video {
          object-fit: cover !important;
          border-radius: 12px;
        }
        /* Smooth out Zego's internal icon hover states */
        .zego-uikit-prebuilt-container .zego-icon {
          transition: all 0.2s ease !important;
        }
      `}</style>
    </div>
  );
}
