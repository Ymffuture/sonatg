import { useEffect, useRef, useState } from "react";
import { Sparkles, Shield, Phone, Lock, Image as ImageIcon, MessageSquare } from "lucide-react";

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

/**
 * Renders a Google AdSense display ad unit with a premium animated placeholder.
 * 
 * Features a fun, moving marquee of app features, a glowing background orb, 
 * and a shimmer effect, ensuring the ad space is engaging even while loading.
 */
export function AdSlot({
  slot,
  format = "auto",
  className = "",
}: {
  slot: string;
  format?: string;
  className?: string;
}) {
  const ref = useRef<HTMLModElement>(null);
  const pushed = useRef(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (pushed.current) return;
    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
      pushed.current = true;
      
      // Fallback: assume loaded after a reasonable delay to fade out the shimmer
      const timer = setTimeout(() => setIsLoaded(true), 2000);
      return () => clearTimeout(timer);
    } catch {
      // AdSense script not loaded yet (e.g., blocked by an ad blocker) — fail silently.
    }
  }, []);

  const features = [
    { icon: MessageSquare, text: "Private Messaging" },
    { icon: Shield, text: "End-to-End Encryption" },
    { icon: Sparkles, text: "AI Chat Summaries" },
    { icon: Phone, text: "Voice & Video Calls" },
    { icon: Lock, text: "Hidden Encrypted Chats" },
    { icon: ImageIcon, text: "Rich Media Sharing" },
  ];

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-zinc-200/50 bg-zinc-50/50 dark:border-zinc-800/50 dark:bg-zinc-900/20 backdrop-blur-sm ${className}`}>
      
      {/* Premium Animated Background Branding */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
        <div className="relative flex flex-col items-center gap-4 w-full">
          {/* Subtle glowing orb behind the text */}
          <div className="absolute inset-0 blur-3xl bg-[#E07A5F]/15 dark:bg-[#E07A5F]/10 animate-pulse rounded-full scale-150" />
          
          {/* Moving Features Marquee */}
          <div className="relative w-full overflow-hidden flex items-center justify-center py-2">
            <div className="flex animate-marquee whitespace-nowrap gap-8">
              {/* Original set */}
              {features.map((feature, idx) => (
                <span 
                  key={idx} 
                  className="text-xs font-bold tracking-wide text-zinc-500 dark:text-zinc-500 uppercase flex items-center gap-2"
                >
                  <feature.icon className="h-3.5 w-3.5 text-[#E07A5F]" /> 
                  {feature.text}
                </span>
              ))}
              {/* Duplicated set for seamless infinite loop */}
              {features.map((feature, idx) => (
                <span 
                  key={`dup-${idx}`} 
                  className="text-xs font-bold tracking-wide text-zinc-500 dark:text-zinc-500 uppercase flex items-center gap-2"
                >
                  <feature.icon className="h-3.5 w-3.5 text-[#E07A5F]" /> 
                  {feature.text}
                </span>
              ))}
            </div>
          </div>
          
          {/* Static branded text below */}
          <span className="relative text-[10px] font-bold tracking-[0.25em] uppercase text-zinc-400 dark:text-zinc-600">
            sonatg.vercel.app
          </span>
        </div>
      </div>

      {/* Premium Shimmer Effect Overlay (fades out when loaded) */}
      {!isLoaded && (
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_2.5s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-white/10 pointer-events-none" />
      )}

      {/* Actual AdSense Container */}
      <ins
        ref={ref}
        className="adsbygoogle block relative z-10 min-h-[90px]"
        style={{ display: "block" }}
        data-ad-client="ca-pub-2722864790738174"
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
      
      {/* Custom Animations Keyframes */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 25s linear infinite;
        }
        /* Fun interaction: pauses the marquee when the user hovers over the ad slot */
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}
