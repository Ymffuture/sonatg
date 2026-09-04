export function SonaTypingIndicator() {
  return (
    <div className="mt-3 flex items-end gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-[var(--sona-accent,#E07A5F)]/10 bg-white px-5 py-4 shadow-sm dark:bg-[#2A2A2A] dark:border-[#E07A5F]/20">
        <svg width="48" height="24" viewBox="0 0 48 24" aria-label="Sona AI is composing a reply">
          <style>{`
            @keyframes sona-gemini-emerge {
              0% { 
                transform: translate(0, 0) scale(0.3); 
                opacity: 0;
              }
              20% {
                transform: translate(-6px, -4px) scale(1);
                opacity: 1;
              }
              40% {
                transform: translate(0, -8px) scale(1);
                opacity: 1;
              }
              60% {
                transform: translate(6px, -4px) scale(1);
                opacity: 1;
              }
              80%, 100% {
                transform: translate(0, 0) scale(0.8);
                opacity: 0.3;
              }
            }

            @keyframes sona-gemini-rotate {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }

            @keyframes sona-gemini-pulse {
              0%, 100% { 
                filter: drop-shadow(0 0 4px rgba(224, 122, 95, 0.2));
              }
              50% { 
                filter: drop-shadow(0 0 12px rgba(224, 122, 95, 0.4));
              }
            }

            .sona-gemini-dot {
              animation: sona-gemini-emerge 2.4s ease-in-out infinite;
              transform-origin: center;
            }

            .sona-gemini-dot:nth-child(1) { animation-delay: 0s; }
            .sona-gemini-dot:nth-child(2) { animation-delay: 0.6s; }
            .sona-gemini-dot:nth-child(3) { animation-delay: 1.2s; }

            .sona-gemini-container {
              animation: sona-gemini-rotate 8s linear infinite;
              transform-origin: center;
            }

            .sona-gemini-glow {
              animation: sona-gemini-pulse 2s ease-in-out infinite;
            }
          `}</style>

          {/* Rotating container */}
          <g className="sona-gemini-container">
            {/* Outer ring hint */}
            <circle 
              cx="24" 
              cy="12" 
              r="14" 
              fill="none" 
              stroke="#E07A5F" 
              strokeWidth="0.5" 
              opacity="0.08" 
              strokeDasharray="4 4"
            />

            {/* Three dots forming triangle */}
            <g>
              {/* Dot 1 - Top */}
              <circle 
                cx="24" 
                cy="4" 
                r="3.5" 
                fill="#E07A5F"
                className="sona-gemini-dot sona-gemini-glow"
              />
              
              {/* Dot 2 - Bottom Left */}
              <circle 
                cx="17" 
                cy="17" 
                r="3.5" 
                fill="#E07A5F"
                className="sona-gemini-dot sona-gemini-glow"
              />
              
              {/* Dot 3 - Bottom Right */}
              <circle 
                cx="31" 
                cy="17" 
                r="3.5" 
                fill="#E07A5F"
                className="sona-gemini-dot sona-gemini-glow"
              />
            </g>

            {/* Orbital trail effect */}
            <circle 
              cx="24" 
              cy="12" 
              r="18" 
              fill="none" 
              stroke="#E07A5F" 
              strokeWidth="0.3" 
              opacity="0.06"
              className="sona-gemini-orbital"
            />
          </g>

          <style>{`
            @keyframes sona-gemini-orbital {
              0% { stroke-dashoffset: 0; }
              100% { stroke-dashoffset: 120; }
            }
            .sona-gemini-orbital {
              stroke-dasharray: 30 120;
              animation: sona-gemini-orbital 3s linear infinite;
            }
          `}</style>
        </svg>
      </div>
      <span className="sr-only">Sona AI is composing a reply</span>
    </div>
  );
}
