import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

/**
 * Renders a Google AdSense display ad unit with a premium animated placeholder.
 * 
 * The shimmer and branded text provide a high-end loading state, ensuring the 
 * ad space never looks like an empty or broken layout element.
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
      // (AdSense doesn't provide a reliable cross-browser load callback)
      const timer = setTimeout(() => setIsLoaded(true), 2000);
      return () => clearTimeout(timer);
    } catch {
      // AdSense script not loaded yet (e.g., blocked by an ad blocker) — fail silently.
    }
  }, []);

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-zinc-200/50 bg-zinc-50/50 dark:border-zinc-800/50 dark:bg-zinc-900/20 backdrop-blur-sm ${className}`}>
      
      {/* Premium Animated Background Branding */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
        <div className="relative flex flex-col items-center gap-2">
          {/* Subtle glowing orb behind the text */}
          <div className="absolute inset-0 blur-2xl bg-[#E07A5F]/10 dark:bg-[#E07A5F]/5 animate-pulse rounded-full scale-150" />
          
          {/* Elegant branded text */}
          <span className="relative text-[10px] font-bold tracking-[0.25em] uppercase text-zinc-400 dark:text-zinc-600 animate-pulse">
            sonatg.vercel.app
          </span>
          
          {/* Tiny "Sponsored" badge for professionalism */}
          <span className="relative text-[9px] font-semibold tracking-wider text-zinc-300 dark:text-zinc-700 uppercase">
            Sponsored
          </span>
        </div5>
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
      
      {/* Custom Shimmer Keyframes */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
