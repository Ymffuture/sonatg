import { motion } from "framer-motion";

export function SonaTypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="mt-3 flex items-end gap-2.5"
    >
      <div className="flex items-center gap-3 rounded-2xl px-4 py-3">
        <style>{`
          @keyframes grok-dot-pulse {
            0%, 60%, 100% { transform: translateY(0) scale(0.85); opacity: 0.35; }
            30% { transform: translateY(-3px) scale(1.15); opacity: 1; }
          }
          @keyframes grok-shimmer-sweep {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
          .grok-dot {
            animation: grok-dot-pulse 1.4s ease-in-out infinite;
          }
          .grok-shimmer-text {
            background-image: linear-gradient(
              90deg,
              rgba(113, 113, 122, 0.55) 0%,
              rgba(113, 113, 122, 0.55) 40%,
              rgba(24, 24, 27, 1) 50%,
              rgba(113, 113, 122, 0.55) 60%,
              rgba(113, 113, 122, 0.55) 100%
            );
            background-size: 200% 100%;
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
            animation: grok-shimmer-sweep 2s linear infinite;
          }
          .dark .grok-shimmer-text {
            background-image: linear-gradient(
              90deg,
              rgba(161, 161, 170, 0.45) 0%,
              rgba(161, 161, 170, 0.45) 40%,
              rgba(244, 244, 245, 1) 50%,
              rgba(161, 161, 170, 0.45) 60%,
              rgba(161, 161, 170, 0.45) 100%
            );
            background-size: 200% 100%;
          }
          @media (prefers-reduced-motion: reduce) {
            .grok-dot, .grok-shimmer-text { animation: none; }
            .grok-dot { opacity: 0.6; }
            .grok-shimmer-text { color: rgb(113, 113, 122); background-image: none; }
          }
        `}</style>

{/* Staggered monochrome dots — Grok's signature minimal pulse */}
        <div className="flex items-center gap-1.5" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="grok-dot h-1.5 w-1.5 rounded-full bg-zinc-500 dark:bg-zinc-400"
              style={{ animationDelay: `${i * 0.18}s` }}
            />
          ))}
        </div>

{/* Shimmering "Thinking..." label, monochrome sweep like Grok's UI */}
        <span className="grok-shimmer-text text-sm font-medium tracking-tight">
          typing&hellip;
        </span>
      </div>

<span className="sr-only">Sona AI is composing a reply</span>
    </motion.div>
  );
}
