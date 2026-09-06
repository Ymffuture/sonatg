import { useMemo, useState, useEffect, useRef } from "react";
import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import { Sparkles, PenTool, Lightbulb, Moon, ArrowUpRight } from "lucide-react";
import sonaLogo from "@/assets/sona-logo.png";

const SUGGESTIONS = [
  {
    text: "Summarize what I should focus on today",
    icon: Sparkles,
    gradient: "from-amber-500/20 to-orange-500/20",
    iconColor: "text-amber-500",
    tag: "Plan",
  },
  {
    text: "Help me write a message to a friend",
    icon: PenTool,
    gradient: "from-rose-500/20 to-pink-500/20",
    iconColor: "text-rose-500",
    tag: "Write",
  },
  {
    text: "Explain something I'm curious about",
    icon: Lightbulb,
    gradient: "from-yellow-500/20 to-amber-500/20",
    iconColor: "text-yellow-500",
    tag: "Learn",
  },
  {
    text: "Give me an idea for tonight",
    icon: Moon,
    gradient: "from-violet-500/20 to-indigo-500/20",
    iconColor: "text-violet-500",
    tag: "Inspire",
  },
];

function greetingForHour(h: number) {
  if (h < 5) return { text: "Still up", sub: "Let's make the most of these quiet hours" };
  if (h < 12) return { text: "Good morning", sub: "Here's to a productive day ahead" };
  if (h < 18) return { text: "Good afternoon", sub: "How can I help you power through?" };
  return { text: "Good evening", sub: "Wind down or wind up — I'm here" };
}

/* ─── Neural Network Background ─────────────────────────────── */
function NeuralBackground() {
  const nodes = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 2 + 1,
        duration: Math.random() * 20 + 20,
        delay: Math.random() * 5,
      })),
    []
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Multi-point gradient mesh */}
      <div className="absolute -top-40 left-1/4 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-[#E07A5F]/10 to-transparent blur-[120px]" />
      <div className="absolute -bottom-40 right-1/4 h-[500px] w-[500px] rounded-full bg-gradient-to-tl from-[#8B5CF6]/8 to-transparent blur-[120px]" />
      <div className="absolute top-1/3 left-1/2 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-gradient-to-b from-[#F4A261]/6 to-transparent blur-[100px]" />

      {/* Floating neural nodes */}
      <svg className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="nodeGlow">
            <stop offset="0%" stopColor="#E07A5F" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#E07A5F" stopOpacity="0" />
          </radialGradient>
        </defs>
        {nodes.map((node) => (
          <motion.circle
            key={node.id}
            cx={`${node.x}%`}
            cy={`${node.y}%`}
            r={node.size}
            fill="url(#nodeGlow)"
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0.2, 0.6, 0.2],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: node.duration / 4,
              repeat: Infinity,
              delay: node.delay,
              ease: "easeInOut",
            }}
          />
        ))}
      </svg>

      {/* Subtle noise texture */}
      <div
        className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}

/* ─── Premium Orbital Logo ──────────────────────────────────── */
function PremiumOrb() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.1 }}
      className="relative mb-10 h-40 w-40"
    >
      {/* Outer rotating rings */}
      <svg viewBox="0 0 240 240" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id="ring1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#E07A5F" stopOpacity="0" />
            <stop offset="50%" stopColor="#E07A5F" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#F4A261" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="ring2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0" />
            <stop offset="50%" stopColor="#8B5CF6" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#E07A5F" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="coreGlow2">
            <stop offset="0%" stopColor="#F4A261" stopOpacity="0.5" />
            <stop offset="50%" stopColor="#E07A5F" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#E07A5F" stopOpacity="0" />
          </radialGradient>
          <filter id="softGlow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Outer orbit */}
        <motion.circle
          cx="120"
          cy="120"
          r="105"
          fill="none"
          stroke="url(#ring1)"
          strokeWidth="1.5"
          strokeDasharray="6 10"
          animate={{ rotate: 360 }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "center" }}
        />

        {/* Middle orbit (counter-rotating) */}
        <motion.circle
          cx="120"
          cy="120"
          r="85"
          fill="none"
          stroke="url(#ring2)"
          strokeWidth="1"
          strokeDasharray="3 8"
          animate={{ rotate: -360 }}
          transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "center" }}
        />

        {/* Inner orbit */}
        <motion.circle
          cx="120"
          cy="120"
          r="65"
          fill="none"
          stroke="#E07A5F"
          strokeWidth="0.5"
          strokeDasharray="1 6"
          opacity="0.3"
          animate={{ rotate: 360 }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "center" }}
        />

        {/* Breathing core */}
        <motion.circle
          cx="120"
          cy="120"
          r="55"
          fill="url(#coreGlow2)"
          animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "center" }}
        />

        {/* Orbiting particles */}
        <motion.circle
          r="3"
          fill="#E07A5F"
          filter="url(#softGlow)"
          animate={{ rotate: 360 }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "120px 120px", cx: 120, cy: 15 }}
        />
        <motion.circle
          r="2.5"
          fill="#8B5CF6"
          filter="url(#softGlow)"
          animate={{ rotate: -360 }}
          transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "120px 120px", cx: 120, cy: 35 }}
        />
        <motion.circle
          r="2"
          fill="#F4A261"
          filter="url(#softGlow)"
          animate={{ rotate: 360 }}
          transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "120px 120px", cx: 120, cy: 55 }}
        />
      </svg>

      {/* Centered Logo */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, type: "spring", stiffness: 200, damping: 15 }}
          className="relative"
        >
          {/* Logo glow backdrop */}
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#E07A5F]/40 to-[#F4A261]/40 blur-2xl" />
          <div className="absolute inset-0 rounded-3xl bg-white/10 backdrop-blur-sm" />

          <img
            src={sonaLogo}
            alt="Sona AI"
            className="relative h-16 w-16 object-contain drop-shadow-[0_8px_24px_rgba(224,122,95,0.5)]"
          />

          {/* Online indicator with pulse */}
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.6, type: "spring", stiffness: 300, damping: 15 }}
            className="absolute -bottom-1 -right-1 flex h-4 w-4"
          >
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-4 w-4 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-950 shadow-lg shadow-emerald-500/50" />
          </motion.span>
        </motion.div>
      </div>
    </motion.div>
  );
}

/* ─── Suggestion Card ───────────────────────────────────────── */
function SuggestionCard({
  suggestion,
  index,
  onSuggestion,
}: {
  suggestion: typeof SUGGESTIONS[number];
  index: number;
  onSuggestion: (text: string) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLButtonElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useTransform(mouseY, [-100, 100], [3, -3]);
  const rotateY = useTransform(mouseX, [-100, 100], [-3, 3]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left - rect.width / 2);
    mouseY.set(e.clientY - rect.top - rect.height / 2);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
    setIsHovered(false);
  };

  const Icon = suggestion.icon;

  return (
    <motion.button
      ref={cardRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: 0.5 + index * 0.08,
        type: "spring",
        stiffness: 200,
        damping: 20,
      }}
      whileTap={{ scale: 0.97 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={() => onSuggestion(suggestion.text)}
      style={{
        rotateX: isHovered ? rotateX : 0,
        rotateY: isHovered ? rotateY : 0,
        transformPerspective: 1000,
      }}
      className="group relative flex items-center gap-3.5 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 bg-white/60 dark:bg-white/[0.03] px-4 py-4 text-left backdrop-blur-xl transition-colors duration-300 hover:border-[#E07A5F]/30 dark:hover:border-[#E07A5F]/25 hover:bg-white/90 dark:hover:bg-white/[0.06] sm:flex-1 sm:min-w-[170px] sm:flex-col sm:items-start sm:gap-3 sm:py-5"
    >
      {/* Gradient border on hover */}
      <motion.div
        className="absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `linear-gradient(135deg, rgba(224,122,95,0.15), rgba(139,92,246,0.1))`,
          padding: "1px",
          WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      />

      {/* Tag */}
      <span className="absolute right-3 top-3 text-[9px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300 sm:right-4 sm:top-4">
        {suggestion.tag}
      </span>

      {/* Icon container */}
      <motion.div
        animate={isHovered ? { scale: 1.1, rotate: -5 } : { scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 15 }}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${suggestion.gradient} sm:h-12 sm:w-12`}
      >
        <Icon className={`h-5 w-5 ${suggestion.iconColor} sm:h-6 sm:w-6`} strokeWidth={1.75} />
      </motion.div>

      {/* Text */}
      <span className="text-sm font-medium leading-snug text-zinc-800 dark:text-zinc-200 transition-colors">
        {suggestion.text}
      </span>

      {/* Arrow indicator */}
      <motion.div
        animate={isHovered ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 }}
        className="absolute right-3 top-1/2 -translate-y-1/2 sm:right-4 sm:top-5 sm:translate-y-0"
      >
        <ArrowUpRight className="h-4 w-4 text-[#E07A5F]" strokeWidth={2.5} />
      </motion.div>
    </motion.button>
  );
}

/* ─── Main Greeting Component ───────────────────────────────── */
function SonaAIGreeting({
  name,
  onSuggestion,
}: {
  name?: string | null;
  onSuggestion: (text: string) => void;
}) {
  const { text: greeting, sub: subtitle } = useMemo(
    () => greetingForHour(new Date().getHours()),
    []
  );

  return (
    <div className="relative flex min-h-full flex-col items-center justify-center px-6 py-16 text-center overflow-hidden">
      <NeuralBackground />

      {/* Cursor-following spotlight */}
      <CursorSpotlight />

      {/* Orbital Logo */}
      <PremiumOrb />

      {/* Text Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 max-w-md"
      >
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
          {greeting}
          {name ? (
            <>
              ,{" "}
              <span className="relative inline-block">
                <span className="relative z-10 bg-gradient-to-r from-[#E07A5F] via-[#F4A261] to-[#8B5CF6] bg-clip-text text-transparent">
                  {name}
                </span>
                <motion.span
                  className="absolute inset-x-0 -bottom-1 h-[2px] bg-gradient-to-r from-[#E07A5F] via-[#F4A261] to-[#8B5CF6]"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.8, duration: 0.6, ease: "easeOut" }}
                  style={{ transformOrigin: "left" }}
                />
              </span>
            </>
          ) : null}
        </h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="mt-3 text-base font-medium text-zinc-500 dark:text-zinc-400"
        >
          {subtitle}
        </motion.p>
      </motion.div>

      {/* Suggestions */}
      <div className="relative z-10 mt-10 w-full max-w-2xl">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="mb-4 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-600"
        >
          <span className="h-px w-8 bg-gradient-to-r from-transparent to-zinc-300 dark:to-zinc-700" />
          Try asking
          <span className="h-px w-8 bg-gradient-to-l from-transparent to-zinc-300 dark:to-zinc-700" />
        </motion.p>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
          {SUGGESTIONS.map((s, i) => (
            <SuggestionCard
              key={s.text}
              suggestion={s}
              index={i}
              onSuggestion={onSuggestion}
            />
          ))}
        </div>
      </div>

      {/* Keyboard hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9, duration: 0.5 }}
        className="relative z-10 mt-10 flex items-center gap-2 text-[11px] font-medium text-zinc-400 dark:text-zinc-600"
      >
        <kbd className="flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 px-2 py-1 font-sans text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 shadow-sm backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-[#E07A5F] animate-pulse" />
          /
        </kbd>
        <span>to focus input</span>
      </motion.div>
    </div>
  );
}

/* ─── Cursor Spotlight Effect ───────────────────────────────── */
function CursorSpotlight() {
  const [pos, setPos] = useState({ x: 50, y: 50 });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      setPos({
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100,
      });
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  return (
    <div
      className="pointer-events-none absolute inset-0 opacity-60 transition-opacity duration-500"
      style={{
        background: `radial-gradient(600px circle at ${pos.x}% ${pos.y}%, rgba(224,122,95,0.08), transparent 40%)`,
      }}
      aria-hidden="true"
    />
  );
}

export { SonaAIGreeting };
