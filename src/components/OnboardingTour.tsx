import { useEffect, useRef, useState } from "react";
import { X, ChevronRight, Sparkles } from "lucide-react";

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

  const pad = 12;
  const highlight = rect
    ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }
    : null;

  const placement = step.placement ?? "bottom";
  const cardWidth = 340;
  const margin = 20;

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
      <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm animate-in fade-in duration-300 dark:bg-black/70" />

      {/* Spotlight cutout */}
      {highlight ? (
        <>
          <div className="fixed bg-zinc-900/60 backdrop-blur-sm dark:bg-black/70" style={{ top: 0, left: 0, right: 0, height: Math.max(0, highlight.top) }} />
          <div className="fixed bg-zinc-900/60 backdrop-blur-sm dark:bg-black/70" style={{ top: highlight.top + highlight.height, left: 0, right: 0, bottom: 0 }} />
          <div className="fixed bg-zinc-900/60 backdrop-blur-sm dark:bg-black/70" style={{ top: highlight.top, left: 0, width: Math.max(0, highlight.left), height: highlight.height }} />
          <div className="fixed bg-zinc-900/60 backdrop-blur-sm dark:bg-black/70" style={{ top: highlight.top, left: highlight.left + highlight.width, right: 0, height: highlight.height }} />
          
          {/* Premium Glow ring + pulse */}
          <div
            className="fixed rounded-2xl ring-2 ring-[#E07A5F]/40 shadow-[0_0_40px_rgba(224,122,95,0.15)] animate-pulse pointer-events-none transition-all duration-500 ease-out"
            style={{ top: highlight.top, left: highlight.left, width: highlight.width, height: highlight.height }}
          />
          <div
            className="fixed rounded-2xl ring-1 ring-white/20 pointer-events-none transition-all duration-500 ease-out"
            style={{ top: highlight.top, left: highlight.left, width: highlight.width, height: highlight.height }}
          />
        </>
      ) : (
        <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm dark:bg-black/70" />
      )}

      {/* Glass tooltip card */}
      <div
        ref={cardRef}
        style={cardStyle}
        className={`
          w-[340px] rounded-3xl border border-zinc-200/60 bg-white/90 dark:border-zinc-800/60 dark:bg-zinc-900/90 
          backdrop-blur-2xl shadow-[0_20px_60px_-12px_rgba(0,0,0,0.25)] dark:shadow-[0_20px_60px_-12px_rgba(0,0,0,0.6)] p-6
          transition-all duration-500 ease-out
          ${entering ? "opacity-0 translate-y-4 scale-[0.96]" : "opacity-100 translate-y-0 scale-100"}
        `}
      >
        {/* Small arrow notch */}
        {highlight && placement === "bottom" && (
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white/90 dark:bg-zinc-900/90 border-l border-t border-zinc-200/60 dark:border-zinc-800/60 rotate-45 backdrop-blur-2xl" />
        )}
        {highlight && placement === "top" && (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white/90 dark:bg-zinc-900/90 border-r border-b border-zinc-200/60 dark:border-zinc-800/60 rotate-45 backdrop-blur-2xl" />
        )}

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E07A5F]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#E07A5F] ring-1 ring-inset ring-[#E07A5F]/20 mb-3">
              <Sparkles className="h-3 w-3" />
              Step {index + 1} of {steps.length}
            </span>
            <h3 className="text-lg font-black tracking-tight text-zinc-900 dark:text-white leading-snug">
              {step.title}
            </h3>
          </div>
          <button
            onClick={skip}
            aria-label="Skip tour"
            className="shrink-0 grid h-8 w-8 place-items-center rounded-full text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          {step.description}
        </p>

        <div className="mt-6 flex items-center justify-between">
          {/* Segmented progress */}
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`
                  h-1.5 rounded-full transition-all duration-500 ease-out
                  ${i === index ? "w-8 bg-gradient-to-r from-[#8B5CF6] to-[#E07A5F]" : i < index ? "w-2 bg-[#E07A5F]/40" : "w-2 bg-zinc-200 dark:bg-zinc-800"}
                `}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {index > 0 && (
              <button
                onClick={prev}
                className="rounded-full px-4 py-2 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
              >
                Back
              </button>
            )}
            <button
              onClick={next}
              className="group flex items-center gap-1.5 rounded-full bg-zinc-900 dark:bg-white px-5 py-2.5 text-xs font-bold text-white dark:text-zinc-900 shadow-lg shadow-zinc-900/20 dark:shadow-white/20 hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 transition-all"
            >
              {index < steps.length - 1 ? (
                <>Next <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" /></>
              ) : (
                <>Get started <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" /></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
