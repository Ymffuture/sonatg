import { useEffect, useRef } from "react";

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
        onLeave();
        return;
      }

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
        onLeaveRoom: onLeave,
      });
    })();

    return () => {
      cancelled = true;
      zp?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-black">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
