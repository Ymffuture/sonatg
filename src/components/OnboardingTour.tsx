import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

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
    return true; // fail closed — don't nag if storage is unavailable
  }
}

function markOnboardingComplete() {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch { /* ignore */ }
}

// A real spotlight tour: measures the actual target element on screen with
// getBoundingClientRect and cuts a highlighted hole in a dark overlay
// around it, with a tooltip card anchored beside it — not just another
// static modal walking through screenshots.
export function OnboardingTour({ steps, onFinish }: { steps: TourStep[]; onFinish: () => void }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const rafRef = useRef<number | null>(null);

  const step = steps[index];

  useEffect(() => {
    const measure = () => {
      const el = step ? document.querySelector(step.targetSelector) : null;
      if (el) {
        setRect(el.getBoundingClientRect());
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        setRect(null);
      }
    };
    measure();
    // Re-measure on resize/scroll since layout can shift (mobile keyboard,
    // sidebar collapse, etc).
    window.addEventListener("resize", measure);
    const interval = setInterval(measure, 300); // catches late-mounting targets
    return () => {
      window.removeEventListener("resize", measure);
      clearInterval(interval);
    };
  }, [step]);

  const finish = () => {
    markOnboardingComplete();
    onFinish();
  };

  const next = () => {
    if (index < steps.length - 1) setIndex((i) => i + 1);
    else finish();
  };
  const skip = () => finish();

  if (!step) return null;

  const pad = 8;
  const highlight = rect
    ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }
    : null;

  // Position the tooltip card relative to the highlighted element.
  const placement = step.placement ?? "bottom";
  let cardStyle: React.CSSProperties = { position: "fixed", zIndex: 210 };
  if (highlight) {
    const cardWidth = 300;
    const margin = 14;
    if (placement === "bottom") {
      cardStyle = { ...cardStyle, top: highlight.top + highlight.height + margin, left: Math.min(Math.max(highlight.left, 12), window.innerWidth - cardWidth - 12) };
    } else if (placement === "top") {
      cardStyle = { ...cardStyle, bottom: window.innerHeight - highlight.top + margin, left: Math.min(Math.max(highlight.left, 12), window.innerWidth - cardWidth - 12) };
    } else if (placement === "right") {
      cardStyle = { ...cardStyle, top: highlight.top, left: highlight.left + highlight.width + margin };
    } else {
      cardStyle = { ...cardStyle, top: highlight.top, right: window.innerWidth - highlight.left + margin };
    }
  } else {
    cardStyle = { ...cardStyle, top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  }

  return (
    <div className="fixed inset-0 z-[200]">
      {/* Dark overlay with a cutout around the highlighted element, built
          from four rectangles rather than an SVG mask — simpler and avoids
          mask-support edge cases. */}
      {highlight ? (
        <>
          <div className="fixed bg-black/70 transition-all duration-300" style={{ top: 0, left: 0, right: 0, height: Math.max(0, highlight.top) }} />
          <div className="fixed bg-black/70 transition-all duration-300" style={{ top: highlight.top + highlight.height, left: 0, right: 0, bottom: 0 }} />
          <div className="fixed bg-black/70 transition-all duration-300" style={{ top: highlight.top, left: 0, width: Math.max(0, highlight.left), height: highlight.height }} />
          <div className="fixed bg-black/70 transition-all duration-300" style={{ top: highlight.top, left: highlight.left + highlight.width, right: 0, height: highlight.height }} />
          <div
            className="fixed rounded-xl ring-2 ring-[#E07A5F] transition-all duration-300 pointer-events-none"
            style={{ top: highlight.top, left: highlight.left, width: highlight.width, height: highlight.height }}
          />
        </>
      ) : (
        <div className="fixed inset-0 bg-black/70" />
      )}

      <div style={cardStyle} className="w-[300px] rounded-2xl border border-white/20 bg-white dark:bg-[#242424] p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-[#2D3436] dark:text-[#E8E8E8]">{step.title}</h3>
          <button onClick={skip} aria-label="Skip tour" className="shrink-0 rounded-full p-1 hover:bg-black/5 dark:hover:bg-white/10">
            <X className="h-3.5 w-3.5 text-[#8C8C8C]" />
          </button>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-[#8C8C8C]">{step.description}</p>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === index ? "bg-[#E07A5F]" : "bg-[#E07A5F]/25"}`} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={skip} className="text-xs font-medium text-[#8C8C8C] hover:underline">Skip</button>
            <button onClick={next} className="rounded-full bg-[#E07A5F] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition">
              {index < steps.length - 1 ? "Next" : "Got it"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
