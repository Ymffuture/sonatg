export function SonaTypingIndicator() {
  return (
    <div className="mt-3 flex items-end gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center gap-1 bg-[transparent] px-5 py-4">
        <svg width="56" height="32" viewBox="0 0 56 32" aria-label="Sona AI is composing a reply">
          <style>{`
            @keyframes sona-gemini-combine {
              0% { 
                transform: translate(var(--base-x), var(--base-y)) scale(0.3); 
                opacity: 0.2;
              }
              20% {
                transform: translate(var(--base-x), var(--base-y)) scale(1.2);
                opacity: 1;
              }
              40% {
                transform: translate(calc(var(--base-x) - 4px), calc(var(--base-y) - 3px)) scale(1);
                opacity: 1;
              }
              60% {
                transform: translate(var(--base-x), calc(var(--base-y) - 5px)) scale(1);
                opacity: 1;
              }
              80% {
                transform: translate(calc(var(--base-x) + 4px), calc(var(--base-y) - 3px)) scale(1);
                opacity: 1;
              }
              100% {
                transform: translate(var(--base-x), var(--base-y)) scale(0.8);
                opacity: 0.3;
              }
            }

            @keyframes sona-gemini-triangle-rotate {
              0% { transform: rotate(0deg); }
              50% { transform: rotate(180deg) scale(1.05); }
              100% { transform: rotate(360deg); }
            }

            @keyframes sona-gemini-pulse {
              0%, 100% { filter: drop-shadow(0 0 2px rgba(224, 122, 95, 0.2)); }
              50% { filter: drop-shadow(0 0 8px rgba(224, 122, 95, 0.5)); }
            }

            @keyframes sona-gemini-trail {
              0% { stroke-dashoffset: 0; opacity: 0.1; }
              50% { opacity: 0.3; }
              100% { stroke-dashoffset: -120; opacity: 0.1; }
            }

            .sona-gemini-group {
              animation: sona-gemini-triangle-rotate 8s linear infinite;
              transform-origin: 28px 16px;
            }

            .sona-gemini-dot {
              animation: sona-gemini-combine 2.8s ease-in-out infinite;
              transform-origin: 28px 16px; /* Bound to the canvas center to make offset translations predictable */
            }

            .sona-gemini-dot:nth-child(1) { animation-delay: 0s; --base-x: 0px; --base-y: -10px; }
            .sona-gemini-dot:nth-child(2) { animation-delay: 0.35s; --base-x: -10px; --base-y: 6px; }
            .sona-gemini-dot:nth-child(3) { animation-delay: 0.7s; --base-x: 10px; --base-y: 6px; }

            .sona-gemini-glow {
              animation: sona-gemini-pulse 2s ease-in-out infinite;
            }

            .sona-gemini-trail {
              animation: sona-gemini-trail 4s linear infinite;
              transform-origin: 28px 16px;
            }
          `}</style>

          {/* Rotating container */}
          <g className="sona-gemini-group">
            {/* Orbital rings */}
            <circle cx="28" cy="16" r="14" fill="none" stroke="#E07A5F" strokeWidth="0.5" className="sona-gemini-trail" strokeDasharray="30 90" />
            <circle cx="28" cy="16" r="18" fill="none" stroke="#E07A5F" strokeWidth="0.3" className="sona-gemini-trail" strokeDasharray="20 60" style={{ animationDelay: "-2s" }} />

            {/* Ambient glow behind background */}
            <circle cx="28" cy="16" r="10" fill="#E07A5F" opacity="0.04" className="sona-gemini-glow" />

            {/* Static background visual wireframe connection */}
            <g opacity="0.08" stroke="#E07A5F" strokeWidth="0.75">
              <line x1="28" y1="6" x2="18" y2="22" />
              <line x1="18" y1="22" x2="38" y2="22" />
              <line x1="38" y1="22" x2="28" y2="6" />
            </g>

            {/* Dynamic, hardware-accelerated animated dots */}
            {/* Built using CSS variables to normalize native translations smoothly */}
            <g className="sona-gemini-glow">
              <circle cx="28" cy="16" r="3.5" fill="#E07A5F" className="sona-gemini-dot" />
              <circle cx="28" cy="16" r="3.5" fill="#E07A5F" className="sona-gemini-dot" />
              <circle cx="28" cy="16" r="3.5" fill="#E07A5F" className="sona-gemini-dot" />
            </g>
          </g>
        </svg>
      </div>
      <span className="sr-only">Sona AI is composing a reply</span>
    </div>
  );
}
