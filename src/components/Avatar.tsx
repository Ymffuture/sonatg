import sonaAi from "@/assets/sona01.png";
import { Check, CheckCheck } from "lucide-react";
import type { ReadStatus } from "@/utils";

export function Avatar({ url, name, size = 40, ai = false }: { url?: string | null; name: string; size?: number; ai?: boolean }) {
  if (ai) return <img src={sonaAi} alt="Sona AI" width={size} height={size} loading="lazy" style={{ width: size, height: size }} className="rounded-full object-cover shrink-0 bg-white" />;
  const src = url || `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=F4A261&textColor=2D3436`;
  return <img src={src} alt={name} loading="lazy" style={{ width: size, height: size }} className="rounded-full object-cover shrink-0" />;
}


export function TickIcon({ status, className }: { status: ReadStatus; className?: string }) {
  if (status === "read") return <CheckCheck className={`${className ?? ""} text-[#E07A5F]`} />;
  if (status === "delivered") return <CheckCheck className={className} />;
  return <Check className={className} />;
}

