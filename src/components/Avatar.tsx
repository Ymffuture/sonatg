import sonaAi from "@/assets/sona01.png";
import { Check, CheckCheck, User } from "lucide-react";
import type { ReadStatus } from "@/utils/utils";

export function Avatar({ url, name, size = 40, ai = false }: { url?: string | null; name: string; size?: number; ai?: boolean }) {
  if (ai) {
    return (
      <img
        src={sonaAi}
        alt="Sona AI"
        width={size}
        height={size}
        loading="lazy"
        style={{ width: size, height: size }}
        className="rounded-full object-cover shrink-0 bg-white ring-2 ring-[#E07A5F]/20"
      />
    );
  }

  if (url) {
    return (
      <img
        src={url}
        alt={name}
        loading="lazy"
        style={{ width: size, height: size }}
        className="rounded-full object-cover shrink-0"
      />
    );
  }

  /* ─── No image: 3D Glass Avatar ─── */
  return (
    <div
      style={{ width: size, height: size }}
      className="relative grid place-items-center rounded-full shrink-0 overflow-hidden
        /* Glass layers */
        bg-gradient-to-br from-white/40 via-white/20 to-[#E07A5F]/10
        dark:from-white/20 dark:via-white/10 dark:to-[#E07A5F]/5
        backdrop-blur-xl
        border border-white/50 dark:border-white/25
        /* 3D shadow stack */
        shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_12px_rgba(224,122,95,0.15),0_8px_24px_rgba(224,122,95,0.1),inset_0_1px_0_rgba(255,255,255,0.6)]
        dark:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_4px_12px_rgba(224,122,95,0.15),0_8px_24px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.15)]
        /* Top convex highlight */
        after:absolute after:inset-0 after:rounded-full after:border after:border-t-white/60 after:border-b-transparent after:border-x-transparent
        dark:after:border-t-white/20
        /* Bottom subtle gradient tint */
        before:absolute before:inset-0 before:rounded-full before:bg-gradient-to-b before:from-transparent before:to-[#E07A5F]/10 dark:before:to-[#E07A5F]/5"
    >
      <User
        className="relative z-10 text-[#E07A5F]/60 dark:text-[#E07A5F]/50 drop-shadow-sm"
        style={{ width: size * 0.45, height: size * 0.45 }}
      />
    </div>
  );
}

export function TickIcon({ status, className }: { status: ReadStatus; className?: string }) {
  if (status === "read") {
    return (
      <CheckCheck
        className={`${className ?? ""} text-blue-500 drop-shadow-[0_1px_2px_rgba(224,122,95,0.3)]`}
      />
    );
  }
  if (status === "delivered") {
    return <CheckCheck className={`${className ?? ""} text-[#8C8C8C]`} />;
  }
  return <Check className={`${className ?? ""} text-[#8C8C8C]`} />;
}
