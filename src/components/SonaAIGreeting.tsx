import { useMemo, useState } from "react";
import sonaLogo from "@/assets/sona-logo.png";

const SUGGESTIONS = [
  { text: "Summarize what I should focus on today", icon: "☀️" },
  { text: "Help me write a message to a friend", icon: "✍️" },
  { text: "Explain something I'm curious about", icon: "💡" },
  { text: "Give me an idea for tonight", icon: "🌙" },
];

function greetingForHour(h: number) {
  if (h < 5) return { text: "Still up", sub: "Let's make the most of these quiet hours" };
  if (h < 12) return { text: "Good morning", sub: "Here's to a productive day ahead" };
  if (h < 18) return { text: "Good afternoon", sub: "How can I help you power through?" };
  return { text: "Good evening", sub: "Wind down or wind up — I'm here" };
}

function SonaAIGreeting({
  name,
  onSuggestion,
}: {
  name?: string | null;
  onSuggestion: (text: string) => void;
}) {
  const [hoveredSuggestion, setHoveredSuggestion] = useState<number | null>(null);
  
  const { text: greeting, sub: subtitle } = useMemo(
    () => greetingForHour(new Date().getHours()),
    []
  );

  return (
    <div className="relative flex min-h-full flex-col items-center justify-center px-6 py-16 text-center">
      {/* Ambient background glow */}
      <div 
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#E07A5F]/[0.07] blur-[100px]" />
        <div className="absolute left-1/2 top-1/3 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#F4A261]/[0.05] blur-[80px]" />
      </div>

      {/* Orbital Logo System */}
      <div className="relative mb-8 h-36 w-36">
        <svg 
          viewBox="0 0 240 240" 
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="orbitGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#E07A5F" stopOpacity="0" />
              <stop offset="50%" stopColor="#E07A5F" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#E07A5F" stopOpacity="0" />
            </linearGradient>
            <radialGradient id="coreGlow">
              <stop offset="0%" stopColor="#F4A261" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#E07A5F" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#E07A5F" stopOpacity="0" />
            </radialGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Outer orbital ring */}
          <ellipse 
            cx="120" cy="120" rx="100" ry="100" 
            fill="none" 
            stroke="url(#orbitGrad)" 
            strokeWidth="1.5"
            strokeDasharray="4 6"
            opacity="0.4"
            style={{
              transformOrigin: 'center',
              animation: 'sona-orbit-1 20s linear infinite',
            }}
          />
          
          {/* Middle counter-orbital ring */}
          <ellipse 
            cx="120" cy="120" rx="78" ry="78" 
            fill="none" 
            stroke="#E07A5F" 
            strokeWidth="1"
            strokeDasharray="2 8"
            opacity="0.2"
            style={{
              transformOrigin: 'center',
              animation: 'sona-orbit-2 15s linear infinite reverse',
            }}
          />

          {/* Core glow */}
          <circle 
            cx="120" cy="120" r="50" 
            fill="url(#coreGlow)"
            style={{
              transformOrigin: 'center',
              animation: 'sona-breathe 4s ease-in-out infinite',
            }}
          />

          {/* Sparkle stars */}
          {[
            { cx: 45, cy: 60, r: 2.5, delay: '0s', dur: '3s' },
            { cx: 195, cy: 75, r: 2, delay: '0.8s', dur: '2.5s' },
            { cx: 175, cy: 180, r: 2.5, delay: '1.6s', dur: '3.2s' },
            { cx: 55, cy: 175, r: 2, delay: '0.4s', dur: '2.8s' },
            { cx: 120, cy: 35, r: 1.5, delay: '1.2s', dur: '2.2s' },
          ].map((star, i) => (
            <g key={i} style={{
              transformOrigin: `${star.cx}px ${star.cy}px`,
              animation: `sona-sparkle ${star.dur} ease-in-out infinite`,
              animationDelay: star.delay,
            }}>
              <path
                d={`M${star.cx} ${star.cy - star.r} L${star.cx + star.r * 0.3} ${star.cy - star.r * 0.3} L${star.cx + star.r} ${star.cy} L${star.cx + star.r * 0.3} ${star.cy + star.r * 0.3} L${star.cx} ${star.cy + star.r} L${star.cx - star.r * 0.3} ${star.cy + star.r * 0.3} L${star.cx - star.r} ${star.cy} L${star.cx - star.r * 0.3} ${star.cy - star.r * 0.3} Z`}
                fill="#F4A261"
                filter="url(#glow)"
              />
            </g>
          ))}

          {/* Orbiting dot */}
          <circle r="3" fill="#E07A5F" filter="url(#glow)">
            <animateMotion
              dur="12s"
              repeatCount="indefinite"
              path="M 120, 20 A 100,100 0 1,1 119.99,20"
            />
          </circle>
        </svg>

        {/* Centered Logo */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl bg-[#E07A5F]/20 blur-xl" />
            <img
              src={sonaLogo}
              alt="Sona AI"
              className="relative h-16 w-16 object-contain drop-shadow-[0_4px_20px_rgba(224,122,95,0.4)]"
            />
            {/* Online indicator */}
            <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#1a1a1a]" />
            </span>
          </div>
        </div>
      </div>

      {/* Text Content */}
      <div 
        className="relative z-10 max-w-sm"
        style={{
          animation: 'sona-fade-up 0.6s ease-out 0.1s both',
        }}
      >
        <h1 className="text-2xl font-semibold tracking-tight text-[#1a1a1a] dark:text-[#f0f0f0] sm:text-[1.75rem]">
          {greeting}
          {name ? <span className="text-[#E07A5F]">, {name}</span> : null}
        </h1>
        <p className="mt-2 text-sm font-medium text-[#8C8C8C] dark:text-[#6b6b6b]">
          {subtitle}
        </p>
      </div>

      {/* Suggestions */}
      <div 
        className="relative z-10 mt-8 w-full max-w-md"
        style={{
          animation: 'sona-fade-up 0.6s ease-out 0.25s both',
        }}
      >
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[#8C8C8C]/60 dark:text-[#6b6b6b]/60">
          Try asking
        </p>
        <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:justify-center">
          {SUGGESTIONS.map((s, i) => (
            <button
              key={s.text}
              onClick={() => onSuggestion(s.text)}
              onMouseEnter={() => setHoveredSuggestion(i)}
              onMouseLeave={() => setHoveredSuggestion(null)}
              className="group relative flex items-center gap-3 rounded-2xl border border-[#E07A5F]/10 bg-white/60 px-4 py-3.5 text-left shadow-sm backdrop-blur-xl transition-all duration-300 hover:border-[#E07A5F]/30 hover:bg-white/90 hover:shadow-md hover:shadow-[#E07A5F]/5 active:scale-[0.98] dark:border-[#E07A5F]/10 dark:bg-white/[0.03] dark:hover:border-[#E07A5F]/25 dark:hover:bg-white/[0.06] sm:flex-1 sm:min-w-[160px] sm:flex-col sm:items-start sm:gap-2 sm:py-4"
              style={{
                animation: `sona-fade-up 0.5s ease-out ${0.35 + i * 0.08}s both`,
              }}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#E07A5F]/10 text-lg transition-transform duration-300 group-hover:scale-110 sm:h-9 sm:w-9 sm:rounded-2xl">
                {s.icon}
              </span>
              <span className="text-sm font-medium leading-snug text-[#2D3436] transition-colors dark:text-[#E8E8E8]">
                {s.text}
              </span>
              
              {/* Hover arrow indicator */}
              <svg 
                className={`absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#E07A5F] transition-all duration-300 sm:right-4 sm:top-4 sm:translate-y-0 ${
                  hoveredSuggestion === i ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-1'
                }`}
                fill="none" 
                viewBox="0 0 24 24" 
                strokeWidth={2.5} 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      {/* Keyboard hint */}
      <div 
        className="relative z-10 mt-8 flex items-center gap-2 text-[11px] font-medium text-[#8C8C8C]/50 dark:text-[#6b6b6b]/50"
        style={{
          animation: 'sona-fade-up 0.6s ease-out 0.6s both',
        }}
      >
        <kbd className="rounded-md border border-[#8C8C8C]/20 bg-[#8C8C8C]/5 px-1.5 py-0.5 font-sans text-[10px] dark:border-[#6b6b6b]/20 dark:bg-[#6b6b6b]/10">
          /
        </kbd>
        <span>to focus input</span>
      </div>

      {/* Global Styles for Complex Animations */}
      <style>{`
        @keyframes sona-orbit-1 {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes sona-orbit-2 {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }
        @keyframes sona-breathe {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.1); opacity: 1; }
        }
        @keyframes sona-sparkle {
          0%, 100% { opacity: 0.2; transform: scale(0.8) rotate(0deg); }
          50% { opacity: 1; transform: scale(1.2) rotate(180deg); }
        }
        @keyframes sona-fade-up {
          from { 
            opacity: 0; 
            transform: translateY(12px); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0); 
          }
        }
      `}</style>
    </div>
  );
}

export { SonaAIGreeting };
