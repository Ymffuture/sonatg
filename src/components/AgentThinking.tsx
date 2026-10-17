// src/components/AgentThinking.tsx
//
// Live "thinking" panel for Sona's math & physics agents — shown in the AI message
// bubble while a run is in progress (the body is a hidden [[sona-think:…]] marker that
// gets replaced by the answer when the run finishes).
//
//   ◌ Solving it two ways…                    14s  ⌄      ← shimmering status, phase icon, live timer
//   │
//   ✓ Planned the approach                                ← each phase is a step on a timeline
//   │   Projectile motion: maximum height
//   │   · v² = v0² − 2gh at the top
//   ◌ Solving two independent ways                        ← active step: animated lucide icon
//       Solver 1: kinematics   Solver 2: energy
//
// Reduced-motion users get the same information without the shimmer / pulses.

import { useEffect, useState, type ReactNode, type SyntheticEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Calculator,
  Check,
  CheckCircle2,
  ChevronDown,
  Compass,
  PenLine,
  Sigma,
  Wrench,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { ThinkingView } from "@/lib/stem/think";
import type { Phase } from "@/lib/stem/types";

const ACCENT = "var(--sona-accent,#E07A5F)";
const ORDER: Phase[] = ["planning", "solving", "verifying", "correcting", "writing", "done"];

type StepKey = "plan" | "solve" | "check" | "fix" | "write";
type Status = "active" | "done";

const ICON: Record<StepKey, LucideIcon> = {
  plan: Compass,
  solve: Sigma,
  check: Calculator,
  fix: Wrench,
  write: PenLine,
};

/** A small, phase-specific motion for the icon of the step that's currently running. */
const ICON_MOTION: Record<
  StepKey,
  { animate: Record<string, number[]>; transition: Record<string, unknown> }
> = {
  plan: {
    animate: { rotate: [0, 40, -25, 15, 0] },
    transition: { duration: 2.4, repeat: Infinity, ease: "easeInOut" },
  },
  solve: {
    animate: { scale: [1, 1.18, 1], y: [0, -1.5, 0] },
    transition: { duration: 1.1, repeat: Infinity, ease: "easeInOut" },
  },
  check: {
    animate: { opacity: [1, 0.35, 1], scale: [1, 0.92, 1] },
    transition: { duration: 0.9, repeat: Infinity, ease: "easeInOut" },
  },
  fix: {
    animate: { rotate: [0, -28, 18, -10, 0] },
    transition: { duration: 1.2, repeat: Infinity, ease: "easeInOut" },
  },
  write: {
    animate: { x: [0, 2, -1, 2, 0], rotate: [0, -8, 0, -8, 0] },
    transition: { duration: 1.2, repeat: Infinity, ease: "easeInOut" },
  },
};

function headline(v: ThinkingView): string {
  switch (v.phase) {
    case "planning":
      return "Planning the approach";
    case "solving":
      return "Solving it two ways";
    case "verifying":
      return v.round > 0 ? "Re-checking the fix" : "Checking the numbers";
    case "correcting":
      return "Fixing a mistake";
    default:
      return "Writing it up";
  }
}

function headerStep(phase: Phase): StepKey {
  return phase === "planning"
    ? "plan"
    : phase === "solving"
      ? "solve"
      : phase === "verifying"
        ? "check"
        : phase === "correcting"
          ? "fix"
          : "write";
}

function useElapsed(startedAt: number): number {
  const read = () => Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const [s, setS] = useState(read);
  useEffect(() => {
    setS(read());
    const t = setInterval(() => setS(read()), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedAt]);
  return s;
}

/** Status text with a light sweep, like Claude's "Thinking…". Static for reduced motion. */
function Shimmer({ children, reduced }: { children: ReactNode; reduced: boolean }) {
  if (reduced) return <span className="font-medium">{children}</span>;
  return (
    <motion.span
      className="bg-clip-text font-medium text-transparent"
      style={{
        backgroundImage:
          "linear-gradient(90deg, color-mix(in srgb, currentColor 42%, transparent) 35%, currentColor 50%, color-mix(in srgb, currentColor 42%, transparent) 65%)",
        backgroundSize: "250% 100%",
      }}
      animate={{ backgroundPosition: ["120% 0", "-120% 0"] }}
      transition={{ duration: 2.1, repeat: Infinity, ease: "linear" }}
    >
      {children}
    </motion.span>
  );
}

/** Icon that swaps (rotate + fade) whenever the step changes, then keeps its own looping motion. */
function PhaseIcon({
  step,
  reduced,
  size = 16,
}: {
  step: StepKey;
  reduced: boolean;
  size?: number;
}) {
  const Icon = ICON[step];
  const m = ICON_MOTION[step];
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={step}
        initial={reduced ? false : { opacity: 0, rotate: -90, scale: 0.5 }}
        animate={{ opacity: 1, rotate: 0, scale: 1 }}
        exit={reduced ? undefined : { opacity: 0, rotate: 90, scale: 0.5 }}
        transition={{ duration: 0.2 }}
        className="inline-grid place-items-center"
      >
        <motion.span
          className="inline-grid place-items-center"
          animate={reduced ? undefined : m.animate}
          transition={m.transition}
        >
          <Icon width={size} height={size} strokeWidth={2} aria-hidden />
        </motion.span>
      </motion.span>
    </AnimatePresence>
  );
}

function StepRow({
  step,
  status,
  title,
  last,
  reduced,
  children,
}: {
  step: StepKey;
  status: Status;
  title: string;
  last: boolean;
  reduced: boolean;
  children?: ReactNode;
}) {
  return (
    <motion.li
      layout={!reduced}
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="relative pl-8"
    >
      {!last && (
        <span aria-hidden className="absolute top-6 -bottom-3 left-[11px] w-px bg-border" />
      )}
      <span
        aria-hidden
        className="absolute top-0 left-0 grid size-6 place-items-center rounded-full border"
        style={
          status === "active"
            ? {
                borderColor: `color-mix(in srgb, ${ACCENT} 55%, transparent)`,
                background: `color-mix(in srgb, ${ACCENT} 12%, transparent)`,
                color: ACCENT,
              }
            : undefined
        }
      >
        {status === "active" && !reduced && (
          <motion.span
            className="absolute inset-0 rounded-full"
            style={{ boxShadow: `0 0 0 0 color-mix(in srgb, ${ACCENT} 45%, transparent)` }}
            animate={{
              boxShadow: [
                `0 0 0 0 color-mix(in srgb, ${ACCENT} 45%, transparent)`,
                `0 0 0 7px color-mix(in srgb, ${ACCENT} 0%, transparent)`,
              ],
            }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
          />
        )}
        {status === "done" ? (
          <motion.span
            initial={reduced ? false : { scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 18 }}
            className="grid place-items-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            style={{ width: 24, height: 24 }}
          >
            <Check width={13} height={13} strokeWidth={3} aria-hidden />
          </motion.span>
        ) : (
          <PhaseIcon step={step} reduced={reduced} size={13} />
        )}
      </span>
      <p
        className={`text-[13.5px] leading-6 ${status === "active" ? "font-medium text-foreground" : "text-foreground/80"}`}
      >
        {title}
      </p>
      {children && <div className="mt-0.5 mb-1">{children}</div>}
    </motion.li>
  );
}

/** Muted "reasoning" lines that fade in one after another, like a thought stream. */
function Thoughts({
  items,
  reduced,
  cap = 6,
}: {
  items: string[];
  reduced: boolean;
  cap?: number;
}) {
  const shown = items.slice(0, cap);
  return (
    <ul className="space-y-1 border-l border-border/70 pl-2.5">
      {shown.map((t, i) => (
        <motion.li
          key={`${i}-${t}`}
          initial={reduced ? false : { opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25, delay: reduced ? 0 : Math.min(i, 5) * 0.09 }}
          className="text-[12.5px] leading-snug text-muted-foreground"
        >
          {t}
        </motion.li>
      ))}
      {items.length > cap && (
        <li className="text-[12px] text-muted-foreground/70">+{items.length - cap} more</li>
      )}
    </ul>
  );
}

export function AgentThinking({ view }: { view: ThinkingView }) {
  const reduced = !!useReducedMotion();
  const elapsed = useElapsed(view.startedAt);
  const [open, setOpen] = useState(true);
  const idx = ORDER.indexOf(view.phase);
  const stop = (e: SyntheticEvent) => e.stopPropagation();

  const reached = (p: Phase) => idx >= ORDER.indexOf(p);
  const planStatus: Status = view.plan || idx > 0 ? "done" : "active";
  const showFix = view.round > 0 || view.phase === "correcting";
  const showWrite = view.phase === "writing" || view.phase === "done";
  const passed = view.checks.filter((c) => c.ok).length;

  const steps: Array<(last: boolean) => ReactNode> = [];
  const push = (node: (last: boolean) => ReactNode) => steps.push(node);

  push((last) => (
    <StepRow
      key="plan"
      step="plan"
      status={planStatus}
      title={planStatus === "done" ? "Planned the approach" : "Planning the approach"}
      last={last}
      reduced={reduced}
    >
      {view.plan && (
        <div className="space-y-1">
          <p className="text-[12.5px] font-medium text-foreground/90">{view.plan.topic}</p>
          {view.plan.unknown && (
            <p className="text-[12.5px] text-muted-foreground">Find: {view.plan.unknown}</p>
          )}
          <Thoughts items={view.plan.approach} reduced={reduced} />
        </div>
      )}
    </StepRow>
  ));

  if (reached("solving")) {
    push((last) => (
      <StepRow
        key="solve"
        step="solve"
        status={view.phase === "solving" ? "active" : "done"}
        title={
          view.phase === "solving" ? "Solving two independent ways" : "Solved two independent ways"
        }
        last={last}
        reduced={reduced}
      >
        {(view.methods.a || view.methods.b) && (
          <p className="mb-1 text-[12.5px] text-muted-foreground">
            {view.methods.a && (
              <span>
                Solver 1: <span className="text-foreground/85">{view.methods.a}</span>
              </span>
            )}
            {view.methods.a && view.methods.b && <span className="mx-1.5 opacity-40">·</span>}
            {view.methods.b && (
              <span>
                Solver 2: <span className="text-foreground/85">{view.methods.b}</span>
              </span>
            )}
          </p>
        )}
        {view.steps.length > 0 && <Thoughts items={view.steps} reduced={reduced} />}
      </StepRow>
    ));
  }

  if (reached("verifying")) {
    const active = view.phase === "verifying";
    push((last) => (
      <StepRow
        key="check"
        step="check"
        status={active ? "active" : "done"}
        title={
          active
            ? view.round > 0
              ? "Re-checking the fix with a calculator"
              : "Checking every number with a calculator"
            : "Checked with a calculator"
        }
        last={last}
        reduced={reduced}
      >
        {view.checks.length > 0 && (
          <div>
            <ul className="space-y-1">
              {view.checks.slice(0, 6).map((c, i) => (
                <motion.li
                  key={`${i}-${c.label}`}
                  initial={reduced ? false : { opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.22, delay: reduced ? 0 : Math.min(i, 6) * 0.08 }}
                  className="flex items-start gap-1.5 text-[12.5px] leading-snug text-muted-foreground"
                >
                  {c.ok ? (
                    <CheckCircle2
                      className="mt-px size-3.5 shrink-0 text-emerald-500"
                      aria-hidden
                    />
                  ) : (
                    <XCircle className="mt-px size-3.5 shrink-0 text-red-500" aria-hidden />
                  )}
                  <span>{c.label}</span>
                </motion.li>
              ))}
            </ul>
            <p className="mt-1 text-[12px] tabular-nums text-muted-foreground/80">
              {passed}/{view.checks.length} passed{view.checks.length > 6 ? ` · showing 6` : ""}
            </p>
          </div>
        )}
      </StepRow>
    ));
  }

  if (showFix) {
    const active = view.phase === "correcting";
    push((last) => (
      <StepRow
        key="fix"
        step="fix"
        status={active ? "active" : "done"}
        title={
          active
            ? `Found a problem — correcting (attempt ${view.round})`
            : `Fixed a problem (attempt ${view.round})`
        }
        last={last}
        reduced={reduced}
      >
        {view.issues.length > 0 && active && (
          <Thoughts items={view.issues} reduced={reduced} cap={3} />
        )}
      </StepRow>
    ));
  }

  if (showWrite)
    push((last) => (
      <StepRow
        key="write"
        step="write"
        status="active"
        title="Writing up the solution"
        last={last}
        reduced={reduced}
      />
    ));

  return (
    <div
      onClick={stop}
      onPointerDown={stop}
      onTouchStart={stop}
      onContextMenu={stop}
      className="pr-12 pb-2"
    >
      <div className="w-[min(100%,25rem)] overflow-hidden rounded-2xl border border-border/60 bg-muted/30">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="sona-thinking-steps"
          className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-[var(--sona-accent,#E07A5F)]/50"
        >
          <span
            className="relative grid size-7 shrink-0 place-items-center rounded-full"
            style={{ background: `color-mix(in srgb, ${ACCENT} 14%, transparent)`, color: ACCENT }}
          >
            {!reduced && (
              <motion.span
                aria-hidden
                className="absolute inset-0 rounded-full"
                style={{ border: `1.5px solid ${ACCENT}` }}
                animate={{ scale: [1, 1.5], opacity: [0.55, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
              />
            )}
            <PhaseIcon step={headerStep(view.phase)} reduced={reduced} />
          </span>
          <span
            className="min-w-0 flex-1 truncate text-[14px] text-foreground"
            role="status"
            aria-live="polite"
          >
            <Shimmer reduced={reduced}>{headline(view)}…</Shimmer>
          </span>
          <span className="text-[12px] tabular-nums text-muted-foreground">{elapsed}s</span>
          <ChevronDown
            className={`size-4 shrink-0 text-muted-foreground transition-transform duration-300 ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              id="sona-thinking-steps"
              key="body"
              initial={reduced ? false : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={reduced ? undefined : { height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <ol className="space-y-3 border-t border-border/50 px-3.5 pt-3 pb-3.5">
                {steps.map((render, i) => render(i === steps.length - 1))}
              </ol>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
