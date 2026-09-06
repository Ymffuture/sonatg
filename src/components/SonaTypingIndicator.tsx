import { motion } from "framer-motion";

export function SonaTypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="mt-3 flex items-end gap-2.5"
    >
      {/* Glassmorphic bubble container */}
      <motion.div
        animate={{
          boxShadow: [
            "0 4px 20px -4px rgba(224, 122, 95, 0.15)",
            "0 8px 30px -4px rgba(224, 122, 95, 0.25)",
            "0 4px 20px -4px rgba(224, 122, 95, 0.15)",
          ],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="relative flex items-center gap-3 rounded-3xl border border-[#E07A5F]/20 bg-white/80 dark:bg-zinc-900/80 px-5 py-4 backdrop-blur-xl"
      >
        {/* Ambient glow backdrop */}
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#E07A5F]/5 via-transparent to-[#F4A261]/5" />

        {/* Animated SVG indicator */}
        <div className="relative">
          <svg width="56" height="32" viewBox="0 0 56 32" aria-label="Sona AI is composing a reply">
            <defs>
              {/* Gradient definitions for premium look */}
              <radialGradient id="dotGradient1" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#F4A261" stopOpacity="1" />
                <stop offset="100%" stopColor="#E07A5F" stopOpacity="0.8" />
              </radialGradient>
              <radialGradient id="dotGradient2" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#E07A5F" stopOpacity="1" />
                <stop offset="100%" stopColor="#3F7D20" stopOpacity="0.9" />
              </radialGradient>
              <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#E07A5F" stopOpacity="0.6" />
                <stop offset="50%" stopColor="#F4A261" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#E07A5F" stopOpacity="0.6" />
              </linearGradient>
              <filter id="softGlow">
                <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <style>{`
              @keyframes sona-morph-dot-1 {
                0%, 100% { transform: translate(0px, 0px) scale(0.5); opacity: 0.5; }
                20% { transform: translate(-14px, 0px) scale(1); opacity: 1; }
                40% { transform: translate(0px, -10px) scale(1.15); opacity: 1; }
                60% { transform: translate(0px, -10px) scale(1.15); opacity: 1; }
                80% { transform: translate(0px, 0px) scale(0.5); opacity: 0.5; }
              }

              @keyframes sona-morph-dot-2 {
                0%, 100% { transform: translate(0px, 0px) scale(0.5); opacity: 0.5; }
                20% { transform: translate(0px, 0px) scale(1); opacity: 1; }
                40% { transform: translate(-10px, 6px) scale(1); opacity: 1; }
                60% { transform: translate(-10px, 6px) scale(1); opacity: 1; }
                80% { transform: translate(0px, 0px) scale(0.5); opacity: 0.5; }
              }

              @keyframes sona-morph-dot-3 {
                0%, 100% { transform: translate(0px, 0px) scale(0.5); opacity: 0.5; }
                20% { transform: translate(14px, 0px) scale(1); opacity: 1; }
                40% { transform: translate(10px, 6px) scale(1); opacity: 1; }
                60% { transform: translate(10px, 6px) scale(1); opacity: 1; }
                80% { transform: translate(0px, 0px) scale(0.5); opacity: 0.5; }
              }

              @keyframes sona-wireframe-morph {
                0%, 15%, 85%, 100% { opacity: 0; }
                35%, 65% { opacity: 0.12; }
              }

              @keyframes sona-orbit-rotate {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }

              @keyframes sona-orbit-rotate-reverse {
                from { transform: rotate(0deg); }
                to { transform: rotate(-360deg); }
              }

              @keyframes sona-pulse-glow {
                0%, 100% { filter: drop-shadow(0 0 3px rgba(224, 122, 95, 0.2)); }
                50% { filter: drop-shadow(0 0 12px rgba(224, 122, 95, 0.5)); }
              }

              @keyframes sona-trail-flow {
                0% { stroke-dashoffset: 0; opacity: 0.1; }
                50% { opacity: 0.25; }
                100% { stroke-dashoffset: -120; opacity: 0.1; }
              }

              @keyframes sona-particle-float {
                0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.3; }
                50% { transform: translate(var(--tx, 5px), var(--ty, -5px)) scale(1.5); opacity: 0.8; }
              }

              .sona-orbit-group {
                animation: sona-orbit-rotate 15s linear infinite;
                transform-origin: 28px 16px;
              }

              .sona-orbit-group-reverse {
                animation: sona-orbit-rotate-reverse 20s linear infinite;
                transform-origin: 28px 16px;
              }

              .sona-morph-dot {
                transform-origin: 28px 16px;
              }

              .sona-dot-1 { animation: sona-morph-dot-1 4s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
              .sona-dot-2 { animation: sona-morph-dot-2 4s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
              .sona-dot-3 { animation: sona-morph-dot-3 4s cubic-bezier(0.4, 0, 0.2, 1) infinite; }

              .sona-wireframe {
                animation: sona-wireframe-morph 4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
              }

              .sona-glow-pulse {
                animation: sona-pulse-glow 2s ease-in-out infinite;
              }

              .sona-trail {
                animation: sona-trail-flow 8s linear infinite;
                transform-origin: 28px 16px;
              }

              .sona-particle {
                animation: sona-particle-float 3s ease-in-out infinite;
              }
            `}</style>

            {/* Floating particles */}
            <circle cx="10" cy="8" r="1" fill="#E07A5F" className="sona-particle" style={{ '--tx': '3px', '--ty': '-4px', animationDelay: '0s' } as React.CSSProperties} />
            <circle cx="46" cy="10" r="0.8" fill="#F4A261" className="sona-particle" style={{ '--tx': '-2px', '--ty': '3px', animationDelay: '0.5s' } as React.CSSProperties} />
            <circle cx="15" cy="26" r="1.2" fill="#3F7D20" className="sona-particle" style={{ '--tx': '4px', '--ty': '2px', animationDelay: '1s' } as React.CSSProperties} />
            <circle cx="42" cy="24" r="0.9" fill="#E07A5F" className="sona-particle" style={{ '--tx': '-3px', '--ty': '-3px', animationDelay: '1.5s' } as React.CSSProperties} />

            {/* Outer rotating orbital rings */}
            <g className="sona-orbit-group">
              <circle cx="28" cy="16" r="18" fill="none" stroke="url(#ringGradient)" strokeWidth="0.5" className="sona-trail" strokeDasharray="40 60" />
            </g>

            <g className="sona-orbit-group-reverse">
              <circle cx="28" cy="16" r="22" fill="none" stroke="#E07A5F" strokeWidth="0.3" className="sona-trail" strokeDasharray="30 70" style={{ animationDelay: '-4s' }} />
            </g>

            {/* Inner ambient glow */}
            <circle cx="28" cy="16" r="12" fill="#E07A5F" opacity="0.04" className="sona-glow-pulse" />

            {/* Dynamic wireframe connections */}
            <g className="sona-wireframe" stroke="#E07A5F" strokeWidth="0.8" strokeLinecap="round">
              <line x1="28" y1="6" x2="18" y2="22" />
              <line x1="18" y1="22" x2="38" y2="22" />
              <line x1="38" y1="22" x2="28" y2="6" />
            </g>

            {/* Core morphing dots with gradients */}
            <g className="sona-glow-pulse" filter="url(#softGlow)">
              <circle cx="28" cy="16" r="3.5" fill="url(#dotGradient1)" className="sona-morph-dot sona-dot-1" />
              <circle cx="28" cy="16" r="3.5" fill="url(#dotGradient2)" className="sona-morph-dot sona-dot-2" />
              <circle cx="28" cy="16" r="3.5" fill="url(#dotGradient1)" className="sona-morph-dot sona-dot-3" />
            </g>
          </svg>
        </div>

        {/* "Thinking..." label with animated dots */}
        <div className="flex items-center gap-1">
          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Thinking</span>
          <motion.span
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="text-zinc-400 dark:text-zinc-600"
          >
            .
          </motion.span>
          <motion.span
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
            className="text-zinc-400 dark:text-zinc-600"
          >
            .
          </motion.span>
          <motion.span
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
            className="text-zinc-400 dark:text-zinc-600"
          >
            .
          </motion.span>
        </div>
      </motion.div>

      <span className="sr-only">Sona AI is composing a reply</span>
    </motion.div>
  );
}
