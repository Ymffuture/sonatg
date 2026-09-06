import * as React from "react";
import { motion } from "framer-motion";

/* ─── Premium Shimmer Skeleton ──────────────────────────────── */
function Skeleton({ className = "", delay = 0, style }: { className?: string; delay?: number; style?: React.CSSProperties }) {
  return (
    <div style={style} className={`relative overflow-hidden bg-stone-200/80 dark:bg-zinc-800/80 ${className}`}>
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-stone-50/80 dark:via-zinc-700/80 to-transparent"
        initial={{ x: "-100%" }}
        animate={{ x: "100%" }}
        transition={{
          repeat: Infinity,
          duration: 1.8,
          ease: "easeInOut",
          delay: delay,
        }}
      />
    </div>
  );
}

export function StatusPageLoader() {
  return (
    <div className="h-dvh w-full bg-[#F0EBE3] text-[#2D3436] dark:bg-[#121212] dark:text-[#E8E8E8]">
      <div className="mx-auto flex h-full max-w-[1400px] overflow-hidden md:p-4">
        <div className="flex h-full w-full overflow-hidden rounded-none bg-white shadow-2xl md:rounded-3xl md:border border-[#E07A5F]/20 dark:bg-[#1E1E1E] dark:border-[#E07A5F]/10">
          
          {/* ─── Sidebar ─── */}
          <aside className="relative flex h-full w-full flex-col border-r border-[#E07A5F]/10 bg-[#FFFDF9] dark:bg-[#1E1E1E] md:w-[32%] md:min-w-[300px] md:max-w-[420px]">
            
            {/* Nav bar */}
            <div className="flex items-center justify-between gap-2 px-4 py-4">
              <Skeleton className="h-7 w-24 rounded-lg" delay={0.1} />
              <div className="flex items-center gap-2 rounded-full border border-[#E07A5F]/10 bg-stone-100 dark:bg-zinc-900 p-1">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-8 w-8 rounded-full" delay={0.2 + i * 0.15} />
                ))}
              </div>
            </div>

            {/* Search */}
            <div className="px-4 pb-3">
              <Skeleton className="h-11 w-full rounded-full" delay={0.3} />
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-2 px-4 pb-4 overflow-x-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-stone-300 dark:scrollbar-thumb-zinc-700">
              {[11, 20, 24, 18, 24, 16].map((w, i) => (
                <Skeleton 
                  key={i} 
                  className="h-8 shrink-0 rounded-full" 
                  style={{ width: `${w * 4}px` }} 
                  delay={0.4 + i * 0.1} 
                />
              ))}
            </div>

            {/* Status banner */}
            <div className="mx-3 mb-3">
              <div className="flex items-center gap-3 h-12 w-full rounded-2xl bg-[#E07A5F]/5 dark:bg-[#E07A5F]/10 border border-[#E07A5F]/10 px-4">
                <Skeleton className="h-5 w-5 rounded-full shrink-0" delay={0.6} />
                <Skeleton className="h-3.5 w-48 rounded-full" delay={0.7} />
              </div>
            </div>

            {/* Chat rows */}
            <div className="flex-1 space-y-1 px-3 pt-1 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-stone-300 dark:scrollbar-thumb-zinc-700">
              {[...Array(9).keys()].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-stone-100/50 dark:hover:bg-zinc-800/30 transition-colors">
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <Skeleton className="h-12 w-12 rounded-full" delay={0.5 + i * 0.1} />
                    {i % 3 === 1 && (
                      <Skeleton 
                        className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-[#FFFDF9] dark:border-[#1E1E1E]" 
                        delay={0.6 + i * 0.1} 
                      />
                    )}
                  </div>

                  {/* Text content */}
                  <div className="flex-1 min-w-0 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <Skeleton className="h-3.5 w-28 rounded-full" delay={0.55 + i * 0.1} />
                      <Skeleton className="h-3 w-10 rounded-full" delay={0.6 + i * 0.1} />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <Skeleton className="h-3 w-[70%] rounded-full" delay={0.65 + i * 0.1} />
                      {i % 2 === 0 && (
                        <Skeleton className="h-5 w-5 rounded-full" delay={0.7 + i * 0.1} />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* FAB */}
            <div className="absolute bottom-6 right-6">
              <Skeleton className="h-14 w-14 rounded-2xl shadow-lg shadow-[#E07A5F]/20" delay={0.8} />
            </div>
          </aside>

          {/* ─── Main area (empty state loader) ─── */}
          <section className="hidden md:flex h-full flex-1 flex-col bg-[#F0EBE3] dark:bg-[#121212] items-center justify-center relative overflow-hidden">
            {/* Ambient background glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#E07A5F]/5 dark:bg-[#E07A5F]/10 rounded-full blur-3xl pointer-events-none" />
            
            {/* Floating animation to keep UI feeling alive */}
            <motion.div 
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              className="relative z-10 flex flex-col items-center gap-6"
            >
              <div className="relative">
                <Skeleton className="h-20 w-20 rounded-3xl" delay={0.5} />
                <motion.div 
                  animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }}
                  transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                  className="absolute inset-0 rounded-3xl bg-[#E07A5F]/30 blur-2xl"
                />
              </div>
              <div className="space-y-2.5 text-center px-8">
                <Skeleton className="h-4 w-56 rounded-full mx-auto" delay={0.6} />
                <Skeleton className="h-3 w-40 rounded-full mx-auto" delay={0.7} />
              </div>
            </motion.div>
          </section>
        </div>
      </div>
    </div>
  );
}
