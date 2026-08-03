import { useEffect, useRef, useState } from "react";
import { X, ChevronRight } from "lucide-react";

export type TourStep = {
  targetSelector: string;
  title: string;
  description: string;
  placement?: "top" | "bottom" | "left" | "right";
};

const STORAGE_KEY = "sona-onboarding-complete";

export function hasSeenOnboarding(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}

function markOnboardingComplete() {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch { /* ignore */ }
}

export function OnboardingTour({ steps, onFinish }: { steps: TourStep[]; onFinish: () => void }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [entering, setEntering] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);

  const step = steps[index];

  useEffect(() => {
    setEntering(true);
    const measure = () => {
      const el = step ? document.querySelector(step.targetSelector) : null;
      if (el) {
        setRect(el.getBoundingClientRect());
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      } else {
        setRect(null);
      }
    };
    const t = setTimeout(measure, 50);
    window.addEventListener("resize", measure);
    const interval = setInterval(measure, 400);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measure);
      clearInterval(interval);
    };
  }, [step]);

  useEffect(() => {
    const t = setTimeout(() => setEntering(false), 300);
    return () => clearTimeout(t);
  }, [index]);

  const finish = () => {
    markOnboardingComplete();
    onFinish();
  };

  const next = () => {
    if (index < steps.length - 1) setIndex((i) => i + 1);
    else finish();
  };
  const prev = () => index > 0 && setIndex((i) => i - 1);
  const skip = () => finish();

  if (!step) return null;

  const pad = 10;
  const highlight = rect
    ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }
    : null;

  const placement = step.placement ?? "bottom";
  const cardWidth = 320;
  const margin = 18;

  let cardStyle: React.CSSProperties = { position: "fixed", zIndex: 210 };
  if (highlight) {
    const safeLeft = Math.min(Math.max(highlight.left + highlight.width / 2 - cardWidth / 2, 16), window.innerWidth - cardWidth - 16);
    if (placement === "bottom") {
      cardStyle = { ...cardStyle, top: highlight.top + highlight.height + margin, left: safeLeft };
    } else if (placement === "top") {
      cardStyle = { ...cardStyle, bottom: window.innerHeight - highlight.top + margin, left: safeLeft };
    } else if (placement === "right") {
      cardStyle = { ...cardStyle, top: Math.max(16, highlight.top + highlight.height / 2 - 80), left: highlight.left + highlight.width + margin };
    } else {
      cardStyle = { ...cardStyle, top: Math.max(16, highlight.top + highlight.height / 2 - 80), right: window.innerWidth - highlight.left + margin };
    }
  } else {
    cardStyle = { ...cardStyle, top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  }

  return (
    <div className="fixed inset-0 z-[200]">
      {/* Soft overlay with animated opacity */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] animate-in fade-in duration-300" />

      {/* Spotlight cutout */}
      {highlight ? (
        <>
          <div className="fixed bg-black/50 backdrop-blur-[2px]" style={{ top: 0, left: 0, right: 0, height: Math.max(0, highlight.top) }} />
          <div className="fixed bg-black/50 backdrop-blur-[2px]" style={{ top: highlight.top + highlight.height, left: 0, right: 0, bottom: 0 }} />
          <div className="fixed bg-black/50 backdrop-blur-[2px]" style={{ top: highlight.top, left: 0, width: Math.max(0, highlight.left), height: highlight.height }} />
          <div className="fixed bg-black/50 backdrop-blur-[2px]" style={{ top: highlight.top, left: highlight.left + highlight.width, right: 0, height: highlight.height }} />
          
          {/* Glow ring + pulse */}
          <div
            className="fixed rounded-xl ring-[3px] ring-[#E07A5F]/60 shadow-[0_0_32px_rgba(224,122,95,0.25)] animate-pulse pointer-events-none transition-all duration-300"
            style={{ top: highlight.top, left: highlight.left, width: highlight.width, height: highlight.height }}
          />
          <div
            className="fixed rounded-xl ring-1 ring-white/40 pointer-events-none transition-all duration-300"
            style={{ top: highlight.top, left: highlight.left, width: highlight.width, height: highlight.height }}
          />
        </>
      ) : (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px]" />
      )}

      {/* Glass tooltip card */}
      <div
        ref={cardRef}
        style={cardStyle}
        className={`
          w-[320px] rounded-2xl border border-white/20 bg-white/80 dark:bg-[#1E1E1E]/80 
          backdrop-blur-xl shadow-[0_20px_60px_-12px_rgba(0,0,0,0.35)] p-5
          transition-all duration-300 ease-out
          ${entering ? "opacity-0 translate-y-3 scale-[0.97]" : "opacity-100 translate-y-0 scale-100"}
        `}
      >
        {/* Small arrow notch */}
        {highlight && placement === "bottom" && (
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white/80 dark:bg-[#1E1E1E]/80 border-l border-t border-white/20 rotate-45 backdrop-blur-xl" />
        )}
        {highlight && placement === "top" && (
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white/80 dark:bg-[#1E1E1E]/80 border-r border-b border-white/20 rotate-45 backdrop-blur-xl" />
        )}

        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="inline-block rounded-full bg-[#E07A5F]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#E07A5F] mb-2">
              Step {index + 1} of {steps.length}
            </span>
            <h3 className="text-[15px] font-bold text-[#2D3436] dark:text-[#F5F0E8] leading-snug">
              {step.title}
            </h3>
          </div>
          <button
            onClick={skip}
            aria-label="Skip tour"
            className="shrink-0 rounded-full p-1.5 text-[#8C8C8C] hover:text-[#2D3436] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-2 text-[13px] leading-relaxed text-[#5a5a5a] dark:text-[#b0b0b0]">
          {step.description}
        </p>

        <div className="mt-5 flex items-center justify-between">
          {/* Segmented progress */}
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`
                  h-1 rounded-full transition-all duration-500
                  ${i === index ? "w-6 bg-[#E07A5F]" : i < index ? "w-2 bg-[#E07A5F]/40" : "w-2 bg-[#E07A5F]/15"}
                `}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {index > 0 && (
              <button
                onClick={prev}
                className="rounded-full px-3 py-2 text-xs font-medium text-[#8C8C8C] hover:text-[#2D3436] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition"
              >
                Back
              </button>
            )}
            <button
              onClick={next}
              className="group flex items-center gap-1 rounded-full bg-[#E07A5F] px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-[#E07A5F]/25 hover:shadow-[#E07A5F]/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              {index < steps.length - 1 ? (
                <>Next <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" /></>
              ) : (
                "Get started"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
