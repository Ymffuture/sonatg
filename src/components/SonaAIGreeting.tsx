import { useMemo } from "react";
import sonaLogo from "@/assets/sona-logo.png";

// Shown inside the Sona AI chat whenever it has no messages (a brand-new
// account, or right after "Clear chat"). Deliberately built around the
// actual Sona AI brand mark (sona-logo.png) rather than a generic bot/robot
// icon — the animation (orbit ring, glow, sparkles) is layered around that
// logo, not a replacement for it.

const SUGGESTIONS = [
  "Summarize what I should focus on today",
  "Help me write a message to a friend",
  "Explain something I'm curious about",
  "Give me an idea for tonight",
];

function greetingForHour(h: number) {
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function SonaAIGreeting({
  name,
  onSuggestion,
}: {
  name?: string | null;
  onSuggestion: (text: string) => void;
}) {
  // Computed once per mount (not per render/tick) — this is a greeting,
  // not a live clock.
  const greeting = useMemo(() => greetingForHour(new Date().getHours()), []);

  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center animate-in fade-in duration-300">
      <div className="relative mb-5 h-28 w-28">
        <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full">
          <defs>
            <radialGradient id="sonaGreetGlow">
              <stop offset="0%" stopColor="#F4A261" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#E07A5F" stopOpacity="0" />
            </radialGradient>
          </defs>
          <style>{`
            @keyframes sona-orbit { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            @keyframes sona-pulse { 0%, 100% { opacity: .55; transform: scale(1); } 50% { opacity: 1; transform: scale(1.06); } }
            @keyframes sona-spark { 0%, 100% { opacity: .15; transform: scale(.7); } 50% { opacity: .9; transform: scale(1.15); } }
            .sona-greet-ring { animation: sona-orbit 14s linear infinite; transform-origin: center; }
            .sona-greet-glow { animation: sona-pulse 2.6s ease-in-out infinite; transform-origin: center; }
            .sona-greet-sp { animation: sona-spark 2.8s ease-in-out infinite; transform-origin: center; }
          `}</style>
          <circle cx="100" cy="100" r="82" fill="none" stroke="#E07A5F" strokeWidth="1" strokeDasharray="6 8" opacity="0.25" className="sona-greet-ring" />
          <circle cx="100" cy="100" r="58" fill="url(#sonaGreetGlow)" className="sona-greet-glow" />
          <circle cx="40" cy="55" r="3" fill="#F4A261" className="sona-greet-sp" style={{ animationDelay: "0.3s" }} />
          <circle cx="165" cy="70" r="2.5" fill="#E07A5F" className="sona-greet-sp" style={{ animationDelay: "0.9s" }} />
          <circle cx="150" cy="150" r="3" fill="#F4A261" className="sona-greet-sp" style={{ animationDelay: "1.4s" }} />
          <circle cx="45" cy="150" r="2" fill="#E07A5F" className="sona-greet-sp" style={{ animationDelay: "0.6s" }} />
        </svg>
        {/* The actual Sona AI logo, centered on top of the animated
            orbit/glow/sparkle layer above — no bot icon anywhere. */}
        <img
          src={sonaLogo}
          alt="Sona AI"
          className="absolute inset-0 m-auto h-14 w-14 object-contain drop-shadow-[0_2px_10px_rgba(224,122,95,0.35)]"
        />
      </div>

      <h3 className="text-lg font-bold text-[#2D3436] dark:text-[#E8E8E8]">
        {greeting}
        {name ? `, ${name}` : ""}
      </h3>
      <p className="mt-1 max-w-[280px] text-sm text-[#8C8C8C]">Ask me anything, or try one of these:</p>

      <div className="mt-4 flex max-w-[360px] flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSuggestion(s)}
            className="rounded-full border border-[var(--sona-accent,#E07A5F)]/20 bg-[var(--sona-accent,#E07A5F)]/5 px-3.5 py-1.5 text-xs font-medium text-[#2D3436] transition hover:bg-[var(--sona-accent,#E07A5F)]/15 active:scale-95 dark:text-[#E8E8E8]"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

export { SonaAIGreeting };
