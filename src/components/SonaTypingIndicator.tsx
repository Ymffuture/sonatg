export function SonaTypingIndicator() {
  return (
    <div className="mt-3 flex items-end gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center gap-1 bg-[transparent] px-5 py-4">
        <svg width="56" height="32" viewBox="0 0 56 32" aria-label="Sona AI is composing a reply">
          <style>{`
            @keyframes sona-gemini-combine {
              0% { 
                transform: translate(0, 0) scale(0.3); 
                opacity: 0.2;
              }
              20% {
                transform: translate(0, 0) scale(1.2);
                opacity: 1;
              }
              40% {
                transform: translate(-10px, -8px) scale(1);
                opacity: 1;
              }
              60% {
                transform: translate(0, -12px) scale(1);
                opacity: 1;
              }
              80% {
                transform: translate(10px, -8px) scale(1);
                opacity: 1;
              }
              100% {
                transform: translate(0, 0) scale(0.8);
                opacity: 0.3;
              }
            }

            @keyframes sona-gemini-triangle-rotate {
              0% { 
                transform: rotate(0deg) scale(1); 
              }
              50% { 
                transform: rotate(180deg) scale(1.05); 
              }
              100% { 
                transform: rotate(360deg) scale(1); 
              }
            }

            @keyframes sona-gemini-pulse {
              0%, 100% { 
                filter: drop-shadow(0 0 4px rgba(224, 122, 95, 0.1));
              }
              50% { 
                filter: drop-shadow(0 0 16px rgba(224, 122, 95, 0.4));
              }
            }

            @keyframes sona-gemini-trail {
              0% { 
                stroke-dashoffset: 0; 
                opacity: 0.1;
              }
              50% { 
                opacity: 0.3;
              }
              100% { 
                stroke-dashoffset: -80; 
                opacity: 0.1;
              }
            }

            .sona-gemini-dot {
              animation: sona-gemini-combine 2.8s ease-in-out infinite;
              transform-origin: center;
            }

            .sona-gemini-dot:nth-child(1) { 
              animation-delay: 0s; 
            }
            .sona-gemini-dot:nth-child(2) { 
              animation-delay: 0.35s; 
            }
            .sona-gemini-dot:nth-child(3) { 
              animation-delay: 0.7s; 
            }

            .sona-gemini-group {
              animation: sona-gemini-triangle-rotate 8s ease-in-out infinite;
              transform-origin: 28px 16px;
            }

            .sona-gemini-glow {
              animation: sona-gemini-pulse 2s ease-in-out infinite;
            }

            .sona-gemini-trail {
              animation: sona-gemini-trail 3s linear infinite;
            }

            .sona-gemini-dot-inner {
              transition: all 0.3s ease;
            }

            .sona-gemini-dot-inner:hover {
              filter: drop-shadow(0 0 12px rgba(224, 122, 95, 0.6));
              transform: scale(1.3);
            }
          `}</style>

          {/* Rotating container */}
          <g className="sona-gemini-group">
            {/* Orbital ring */}
            <circle 
              cx="28" 
              cy="16" 
              r="18" 
              fill="none" 
              stroke="#E07A5F" 
              strokeWidth="0.5" 
              opacity="0.08"
              className="sona-gemini-trail"
              strokeDasharray="40 80"
            />

            {/* Secondary orbital ring */}
            <circle 
              cx="28" 
              cy="16" 
              r="22" 
              fill="none" 
              stroke="#E07A5F" 
              strokeWidth="0.3" 
              opacity="0.05"
              className="sona-gemini-trail"
              strokeDasharray="30 90"
              style={{ animationDelay: "0.5s" }}
            />

            {/* Glow behind dots */}
            <circle 
              cx="28" 
              cy="16" 
              r="14" 
              fill="#E07A5F" 
              opacity="0.03"
              className="sona-gemini-glow"
            />

            {/* Dot 1 - Top */}
            <circle 
              cx="28" 
              cy="6" 
              r="4" 
              fill="#E07A5F"
              className="sona-gemini-dot sona-gemini-glow"
            />
            
            {/* Dot 2 - Bottom Left */}
            <circle 
              cx="18" 
              cy="22" 
              r="4" 
              fill="#E07A5F"
              className="sona-gemini-dot sona-gemini-glow"
            />
            
            {/* Dot 3 - Bottom Right */}
            <circle 
              cx="38" 
              cy="22" 
              r="4" 
              fill="#E07A5F"
              className="sona-gemini-dot sona-gemini-glow"
            />

            {/* Connecting lines between dots */}
            <g opacity="0.06">
              <line x1="28" y1="6" x2="18" y2="22" stroke="#E07A5F" strokeWidth="1" />
              <line x1="18" y1="22" x2="38" y2="22" stroke="#E07A5F" strokeWidth="1" />
              <line x1="38" y1="22" x2="28" y2="6" stroke="#E07A5F" strokeWidth="1" />
            </g>
          </g>
        </svg>
      </div>
      <span className="sr-only">Sona AI is composing a reply</span>
    </div>
  );
}
