export function SonaTypingIndicator() {
  return (
    <div className="mt-3 flex items-end gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-[var(--sona-accent,#E07A5F)]/10 bg-white px-4 py-3.5 shadow-sm dark:bg-[#2A2A2A] dark:border-[#E07A5F]/20">
        <svg width="40" height="16" viewBox="0 0 40 16" aria-label="Sona AI is composing a reply">
          <style>{`
            @keyframes sona-type-wave {
              0%, 60%, 100% { 
                transform: translateY(0) scale(1); 
                opacity: 0.4; 
              }
              30% { 
                transform: translateY(-6px) scale(1.1); 
                opacity: 1; 
              }
            }
            @keyframes sona-type-glow {
              0%, 100% { filter: drop-shadow(0 0 2px rgba(224, 122, 95, 0)); }
              50% { filter: drop-shadow(0 0 8px rgba(224, 122, 95, 0.3)); }
            }
            .sona-type-dot { 
              animation: sona-type-wave 1.2s ease-in-out infinite; 
              transform-origin: center;
              transition: all 0.2s;
            }
            .sona-type-dot:hover {
              animation-play-state: paused;
              transform: scale(1.3);
              opacity: 1;
            }
          `}</style>
          
          {/* Subtle glow behind dots */}
          <circle cx="7" cy="8" r="8" fill="#E07A5F" opacity="0.04" />
          <circle cx="20" cy="8" r="8" fill="#E07A5F" opacity="0.04" />
          <circle cx="33" cy="8" r="8" fill="#E07A5F" opacity="0.04" />
          
          {/* Main dots with gradient */}
          <defs>
            <linearGradient id="sona-dot-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#E07A5F" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#D96A4E" stopOpacity="1" />
            </linearGradient>
          </defs>
          
          <circle 
            cx="7" 
            cy="8" 
            r="3.5" 
            fill="url(#sona-dot-grad)" 
            className="sona-type-dot" 
            style={{ animationDelay: "0s" }} 
          />
          <circle 
            cx="20" 
            cy="8" 
            r="3.5" 
            fill="url(#sona-dot-grad)" 
            className="sona-type-dot" 
            style={{ animationDelay: "0.15s" }} 
          />
          <circle 
            cx="33" 
            cy="8" 
            r="3.5" 
            fill="url(#sona-dot-grad)" 
            className="sona-type-dot" 
            style={{ animationDelay: "0.3s" }} 
          />
        </svg>
      </div>
      
      {/* Optional: Tiny label for accessibility */}
      <span className="sr-only">Sona AI is composing a reply</span>
    </div>
  );
}
