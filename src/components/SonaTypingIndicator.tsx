import { motion } from "framer-motion";

export function SonaTypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="mt-3 flex items-end gap-2.5"
    >
      <div className="relative flex items-center gap-3 rounded-3xl px-5 py-4">
        {/* Ambient glow backdrop */}
        <div className="absolute inset-0 rounded-3xl" />

        <style>{`
          @keyframes sona-orb-breathe {
            0%, 100% { transform: scale(0.85); opacity: 0.55; }
            50% { transform: scale(1.05); opacity: 1; }
          }
          @keyframes sona-orb-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes sona-shimmer-sweep {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
          .sona-orb {
            animation: sona-orb-breathe 2.2s ease-in-out infinite;
          }
          .sona-orb-ring {
            animation: sona-orb-spin 6s linear infinite;
          }
          .sona-shimmer-text {
            background-image: linear-gradient(
              90deg,
              rgba(113, 113, 122, 0.55) 0%,
              rgba(113, 113, 122, 0.55) 40%,
              rgba(224, 122, 95, 1) 50%,
              rgba(113, 113, 122, 0.55) 60%,
              rgba(113, 113, 122, 0.55) 100%
            );
            background-size: 200% 100%;
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
            animation: sona-shimmer-sweep 2.2s linear infinite;
          }
          .dark .sona-shimmer-text {
            background-image: linear-gradient(
              90deg,
              rgba(161, 161, 170, 0.45) 0%,
              rgba(161, 161, 170, 0.45) 40%,
              rgba(244, 162, 97, 1) 50%,
              rgba(161, 161, 170, 0.45) 60%,
              rgba(161, 161, 170, 0.45) 100%
            );
            background-size: 200% 100%;
          }
          @media (prefers-reduced-motion: reduce) {
            .sona-orb, .sona-orb-ring, .sona-shimmer-text { animation: none; }
            .sona-shimmer-text { color: rgb(113, 113, 122); background-image: none; }
          }
        `}</style>

        {/* Single soft pulsing orb, with a thin rotating ring instead of a busy SVG */}
        <div className="relative h-6 w-6 shrink-0" aria-hidden="true">
          <div
            className="sona-orb-ring absolute inset-0 rounded-full"
            style={{
              background: "conic-gradient(from 0deg, #E07A5F, transparent 40%, transparent 60%, #F4A261, transparent)",
              WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 1.5px), black calc(100% - 1.5px))",
              mask: "radial-gradient(farthest-side, transparent calc(100% - 1.5px), black calc(100% - 1.5px))",
            }}
          />
          <div
            className="sona-orb absolute inset-[3px] rounded-full"
            style={{
              background: "radial-gradient(circle at 35% 30%, #F4A261, #E07A5F 60%, #3F7D20 130%)",
              boxShadow: "0 0 10px rgba(224, 122, 95, 0.5)",
            }}
          />
        </div>

        {/* Shimmering "Thinking..." label — same sweep technique used in Claude's own UI */}
        <span className="sona-shimmer-text text-sm font-medium">Thinking&hellip;</span>
      </div>

      <span className="sr-only">Sona AI is composing a reply</span>
    </motion.div>
  );
}
