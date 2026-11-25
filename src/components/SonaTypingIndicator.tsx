
import { motion, AnimatePresence } from "framer-motion";

export function SonaTypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -5, scale: 0.98 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="mt-3 flex items-center gap-3"
      role="status"
      aria-live="polite"
    >
      <style>{`
        @keyframes sona-breathe {
          0%, 100% {
            transform: scale(0.88);
            opacity: .65;
          }
          50% {
            transform: scale(1.08);
            opacity: 1;
          }
        }

        @keyframes sona-orbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes sona-light {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(220%); }
        }

        @keyframes sona-wave {
          0%, 100% { transform: scaleY(.45); opacity: .4; }
          50% { transform: scaleY(1); opacity: 1; }
        }

        .sona-core {
          animation: sona-breathe 2s ease-in-out infinite;
        }

        .sona-orbit {
          animation: sona-orbit 5s linear infinite;
        }

        .sona-wave {
          animation: sona-wave 1s ease-in-out infinite;
          transform-origin: center;
        }

        .sona-thinking {
          background: linear-gradient(
            90deg,
            #a1a1aa 0%,
            #a1a1aa 35%,
            #ffffff 50%,
            #a1a1aa 65%,
            #a1a1aa 100%
          );
          background-size: 250% 100%;
          background-clip: text;
          -webkit-background-clip: text;
          color: transparent;
          animation: sona-light 2.5s linear infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .sona-core, .sona-orbit,
          .sona-wave, .sona-thinking {
            animation: none !important;
          }
        }
      `}</style>

      {/* Animated Sona intelligence symbol */}
      <div className="relative flex h-9 w-9 items-center justify-center">
        <div className="sona-orbit absolute inset-0 rounded-full border border-[#E07A5F]/40 border-t-[#E07A5F]" />

        <div className="sona-core flex h-6 w-6 items-center justify-center rounded-full bg-[#E07A5F]/15 shadow-[0_0_18px_rgba(224,122,95,0.3)]">
          <div className="h-2.5 w-2.5 rounded-full bg-[#E07A5F] shadow-[0_0_10px_#E07A5F]" />
        </div>
      </div>

      {/* Intelligence activity */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tracking-tight text-zinc-800 dark:text-zinc-100">
            Sona
          </span>

          <div className="flex h-3 items-center gap-[3px]" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className="sona-wave h-2 w-[3px] rounded-full bg-[#E07A5F]"
                style={{ animationDelay: `${i * 0.13}s` }}
              />
            ))}
          </div>
        </div>

        <span className="sona-thinking text-xs font-medium tracking-wide">
          Thinking...
        </span>
      </div>

      <span className="sr-only">
        Sona AI is thinking and composing a response
      </span>
    </motion.div>
  );
}
