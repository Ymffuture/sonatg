export function SonaTypingIndicator() {
  return (
    <div className="mt-3 flex items-end gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center gap-1 bg-[transparent] px-5 py-4">
        <svg width="56" height="32" viewBox="0 0 56 32" aria-label="Sona AI is composing a reply">
          <style>{`
            /* Unified Morphing Loop: Combine -> Linear Form -> Triangle Formation -> Loop */
            @keyframes sona-morph-dot-1 {
              0%, 100% { transform: translate(0px, 0px) scale(0.4); fill: #F4A261; opacity: 0.4; }      /* Combined / Coalesced */
              25%      { transform: translate(-14px, 0px) scale(1); fill: #E07A5F; opacity: 1; }     /* Linear - Left dot */
              50%      { transform: translate(0px, -10px) scale(1.1); fill: #3F7D20; opacity: 1; }   /* Triangle - Top dot */
              75%      { transform: translate(0px, -10px) scale(1.1); fill: #E07A5F; opacity: 1; }   /* Hold Triangle Shape */
            }

            @keyframes sona-morph-dot-2 {
              0%, 100% { transform: translate(0px, 0px) scale(0.4); fill: #F4A261; opacity: 0.4; }      /* Combined / Coalesced */
              25%      { transform: translate(0px, 0px) scale(1); fill: #E07A5F; opacity: 1; }       /* Linear - Center dot */
              50%      { transform: translate(-10px, 6px) scale(1); fill: #3F7D20; opacity: 1; }     /* Triangle - Bottom Left dot */
              75%      { transform: translate(-10px, 6px) scale(1); fill: #E07A5F; opacity: 1; }     /* Hold Triangle Shape */
            }

            @keyframes sona-morph-dot-3 {
              0%, 100% { transform: translate(0px, 0px) scale(0.4); fill: #F4A261; opacity: 0.4; }      /* Combined / Coalesced */
              25%      { transform: translate(14px, 0px) scale(1); fill: #E07A5F; opacity: 1; }      /* Linear - Right dot */
              50%      { transform: translate(10px, 6px) scale(1); fill: #3F7D20; opacity: 1; }      /* Triangle - Bottom Right dot */
              75%      { transform: translate(10px, 6px) scale(1); fill: #E07A5F; opacity: 1; }      /* Hold Triangle Shape */
            }

            /* Dynamic Morphing Wireframe Layout */
            @keyframes sona-wireframe-morph {
              0%, 25%, 100% { opacity: 0; }
              50%, 75%      { opacity: 0.08; }
            }

            @keyframes sona-gemini-triangle-rotate {
              0%   { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }

            @keyframes sona-gemini-pulse {
              0%, 100% { filter: drop-shadow(0 0 2px rgba(224, 122, 95, 0.15)); }
              50%      { filter: drop-shadow(0 0 10px rgba(224, 122, 95, 0.45)); }
            }

            @keyframes sona-gemini-trail {
              0%   { stroke-dashoffset: 0; opacity: 0.08; }
              50%  { opacity: 0.2; }
              100% { stroke-dashoffset: -120; opacity: 0.08; }
            }

            .sona-gemini-group {
              animation: sona-gemini-triangle-rotate 12s linear infinite;
              transform-origin: 28px 16px;
            }

            .sona-morph-dot {
              transform-origin: 28px 16px;
              transition: fill 0.4s ease;
            }

            .sona-dot-1 { animation: sona-morph-dot-1 5s ease-in-out infinite; }
            .sona-dot-2 { animation: sona-morph-dot-2 5s ease-in-out infinite; }
            .sona-dot-3 { animation: sona-morph-dot-3 5s ease-in-out infinite; }

            .sona-wireframe {
              animation: sona-wireframe-morph 5s ease-in-out infinite;
            }

            .sona-gemini-glow {
              animation: sona-gemini-pulse 2.5s ease-in-out infinite;
            }

            .sona-gemini-trail {
              animation: sona-gemini-trail 6s linear infinite;
              transform-origin: 28px 16px;
            }
          `}</style>

          {/* Rotating ambient background group */}
          <g className="sona-gemini-group">
            <circle cx="28" cy="16" r="15" fill="none" stroke="#E07A5F" strokeWidth="0.4" className="sona-gemini-trail" strokeDasharray="35 85" />
            <circle cx="28" cy="16" r="20" fill="none" stroke="#E07A5F" strokeWidth="0.2" className="sona-gemini-trail" strokeDasharray="25 65" style={{ animationDelay: "-3s" }} />
            <circle cx="28" cy="16" r="10" fill="#E07A5F" opacity="0.03" className="sona-gemini-glow" />

            {/* Dynamic Connecting Wireframe (Only visible during triangle phase) */}
            <g className="sona-wireframe" stroke="#E07A5F" strokeWidth="0.75">
              <line x1="28" y1="6" x2="18" y2="22" />
              <line x1="18" y1="22" x2="38" y2="22" />
              <line x1="38" y1="22" x2="28" y2="6" />
            </g>

            {/* Core Morphing Elements */}
            <g className="sona-gemini-glow">
              <circle cx="28" cy="16" r="3.5" className="sona-morph-dot sona-dot-1" />
              <circle cx="28" cy="16" r="3.5" className="sona-morph-dot sona-dot-2" />
              <circle cx="28" cy="16" r="3.5" className="sona-morph-dot sona-dot-3" />
            </g>
          </g>
        </svg>
      </div>
      <span className="sr-only">Sona AI is composing a reply</span>
    </div>
  );
}
