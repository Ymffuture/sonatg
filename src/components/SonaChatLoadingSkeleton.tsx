import { Loader2 } from "lucide-react";
import sonaLogo from "@/assets/sona-logo.png";

/* ─── Main Page Loader + Nav Skeleton ─── */
export function SonaChatLoadingSkeleton() {
  return (
    <div className="h-dvh w-full bg-[#F0EBE3] text-[#2D3436] hide-scrollbar dark:bg-[#1A1A1A] dark:text-[#E8E8E8]">
      <div className="mx-auto flex h-full max-w-[1400px] overflow-hidden md:p-4">
        <div className="flex h-full w-full overflow-hidden rounded-none bg-white shadow-2xl md:rounded-3xl md:border border-[#E07A5F]/20 dark:bg-[#242424] dark:border-[#E07A5F]/10">
          {/* Sidebar with nav bar skeleton */}
          <aside className="relative h-full w-full flex-col border-r border-[#E07A5F]/10 bg-[#FFFDF9] dark:bg-[#1E1E1E] md:flex md:w-[32%] md:min-w-[300px] md:max-w-[420px]">
            {/* Nav bar skeleton */}
            <div className="flex items-center justify-between gap-2 px-4 py-3">
              <div className="h-8 w-28 rounded-lg bg-[#E07A5F]/10 animate-pulse" />
              <div className="flex items-center gap-1">
                {[1, 2].map((i) => (
                  <div key={i} className="h-9 w-9 rounded-full bg-[silver]/10 animate-pulse" />
                ))}
              </div>
            </div>
            <div className="px-3 pb-2 pt-2">
              <div className="h-10 rounded-full bg-[#E07A5F]/10 animate-pulse" />
            </div>
            <div className="flex-1 space-y-1 px-2 pt-1">
              {[1, 2, 3, 4, 5, 6, 7,8,9,10,11,12,13].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <div className="h-12 w-12 shrink-0 rounded-full bg-[#1E1E1E]/20 animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-2/5 rounded bg-[#E07A5F]/20 animate-pulse" />
                    <div className="h-2.5 w-4/5 rounded bg-[#E07A5F]/10 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </aside>
          {/* Main page loader */}
          <section className="hidden md:flex h-full flex-1 flex-col bg-[#F0EBE3] dark:bg-[#1A1A1A] items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="h-16 w-16 rounded-2xl bg-[#E07A5F]/20 animate-pulse" />
                <img src={sonaLogo} alt="" className="absolute inset-0 h-16 w-16 rounded-2xl object-contain p-2 opacity-60" />
              </div>
              <div className="flex items-center gap-2 text-[#8C8C8C]">
                <Loader2 className="h-6 w-6 animate-spin text-[#E07A5F]" />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
