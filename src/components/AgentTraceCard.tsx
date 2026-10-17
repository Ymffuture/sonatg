// src/components/AgentTraceCard.tsx
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  ChevronRight,
  Wrench,
  XCircle,
  Clock,
  Cpu,
} from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { supabase } from "@/integrations/supabase/client";
import type { AgentTrace } from "@/lib/stem/types";

// Utility for conditional classes (replace with your project's `cn` from `clsx` + `tailwind-merge` if available)
function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}

// A trace never changes after creation, so cache it for the session.
const cache = new Map<string, AgentTrace | null>();

type RunsTable = {
  select: (cols: string) => {
    eq: (
      col: string,
      val: string,
    ) => {
      maybeSingle: () => Promise<{ data: { trace?: unknown } | null; error: unknown }>;
    };
  };
};

async function loadTrace(id: string): Promise<AgentTrace | null> {
  if (cache.has(id)) return cache.get(id) ?? null;

  // ai_agent_runs isn't in the generated Supabase types yet, hence the narrow cast.
  const { data, error } = await (supabase as unknown as { from: (t: string) => RunsTable })
    .from("ai_agent_runs")
    .select("trace")
    .eq("id", id)
    .maybeSingle();

  if (error) return null;

  const t =
    data?.trace && typeof data.trace === "object" && (data.trace as AgentTrace).v === 1
      ? (data.trace as AgentTrace)
      : null;

  cache.set(id, t);
  return t;
}

const LEVEL = {
  verified: {
    label: "Verified",
    tone: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20 dark:bg-emerald-500/5",
    Icon: CheckCircle2,
  },
  checked: {
    label: "Checked",
    tone: "text-sky-600 dark:text-sky-400",
    bg: "bg-sky-500/10 border-sky-500/20 dark:bg-sky-500/5",
    Icon: CheckCircle2,
  },
  unverified: {
    label: "Not fully verified",
    tone: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20 dark:bg-amber-500/5",
    Icon: AlertTriangle,
  },
} as const;

function Section({
  title,
  children,
  variant = "default",
}: {
  title: string;
  children: React.ReactNode;
  variant?: "default" | "success" | "warning";
}) {
  const variantStyles = {
    default: "bg-muted/30 border-border/50",
    success: "bg-emerald-500/5 border-emerald-500/20 dark:bg-emerald-500/10",
    warning: "bg-amber-500/5 border-amber-500/20 dark:bg-amber-500/10",
  };

  return (
    <section className={cn("rounded-xl border p-4 transition-colors", variantStyles[variant])}>
      <h3 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

export function AgentTraceCard({ agentId, mine = false }: { agentId: string; mine?: boolean }) {
  const [trace, setTrace] = useState<AgentTrace | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "hidden">("loading");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    loadTrace(agentId)
      .then((t) => {
        if (!alive) return;
        setTrace(t);
        setState(t ? "ready" : "hidden");
      })
      .catch(() => alive && setState("hidden"));
    return () => {
      alive = false;
    };
  }, [agentId]);

  // Premium touch: Skeleton loader prevents layout shift
  if (state === "loading") {
    return (
      <div className="pr-12 pb-2">
        <div className="h-8 w-56 animate-pulse rounded-full bg-muted/50" />
      </div>
    );
  }

  if (state !== "ready" || !trace) return null;

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const lv = LEVEL[trace.level];
  const passed = trace.checks.filter((c) => c.ok).length;

  const summary = [
    lv.label,
    trace.agreement?.compared && trace.agreement?.agreed ? "2 solvers agreed" : null,
    trace.checks.length ? `${passed}/${trace.checks.length} checks` : null,
    trace.corrections.length
      ? `${trace.corrections.length} fix${trace.corrections.length === 1 ? "" : "es"}`
      : null,
    trace.elapsedMs >= 1000 ? `Thought for ${Math.round(trace.elapsedMs / 1000)}s` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      onClick={stop}
      onPointerDown={stop}
      onTouchStart={stop}
      onContextMenu={stop}
      className="pr-12 pb-2"
    >
      <div
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-label="How Sona solved this. Tap to view."
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          "group relative inline-flex max-w-full cursor-pointer select-none items-center gap-2.5 rounded-full border px-3 py-1.5 shadow-sm transition-all duration-300 hover:shadow-md active:scale-[0.98]",
          mine
            ? "border-border/60 bg-background/80 backdrop-blur-md hover:border-border"
            : "border-[var(--sona-accent,#E07A5F)]/30 bg-[var(--sona-accent,#E07A5F)]/5 hover:border-[var(--sona-accent,#E07A5F)]/50 hover:bg-[var(--sona-accent,#E07A5F)]/10",
        )}
      >
        {/* Subtle glow effect for verified state */}
        {trace.level === "verified" && (
          <span className="absolute inset-0 rounded-full bg-emerald-500/10 blur-md transition-opacity duration-300 opacity-0 group-hover:opacity-100" />
        )}

        <div className="relative flex items-center gap-2.5">
          <Brain className={cn("size-4 shrink-0 transition-colors", lv.tone)} aria-hidden />
          <span className="truncate text-[13px] font-medium text-foreground/90 group-hover:text-foreground">
            {summary}
          </span>
          <ChevronRight
            className="size-3.5 shrink-0 text-muted-foreground/70 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-foreground"
            aria-hidden
          />
        </div>
      </div>

      <Drawer open={open} onOpenChange={setOpen} shouldScaleBackground={false}>
        <DrawerContent className="flex h-[min(90dvh,760px)] max-h-[90dvh] min-h-0 flex-col outline-none">
          {/* Drag Handle */}
          <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-muted-foreground/20" />

          <DrawerHeader className="shrink-0 border-b bg-background/80 pb-4 text-left backdrop-blur-md sticky top-0 z-10">
            <DrawerTitle className="flex items-center gap-2 text-base font-semibold">
              <Brain className="size-4 text-[var(--sona-accent,#E07A5F)]" />
              How Sona solved this
            </DrawerTitle>
            <DrawerDescription className="mt-2 flex flex-wrap items-center gap-3 text-xs font-mono text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Cpu className="size-3.5" />
                {trace.llmCalls} agent calls
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5" />
                {(trace.elapsedMs / 1000).toFixed(1)}s
              </span>
              {trace.budgetHit && (
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Time limit reached
                </span>
              )}
            </DrawerDescription>
          </DrawerHeader>

          <div
            className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 pb-[max(2rem,env(safe-area-inset-bottom))] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20"
            data-vaul-no-drag
          >
            {/* Status Banner */}
            <div
              className={cn(
                "flex items-center gap-2.5 rounded-lg border p-3 text-sm font-semibold",
                lv.bg,
                lv.tone,
              )}
            >
              <lv.Icon className="size-4" aria-hidden />
              {lv.label}
            </div>

            {trace.plan && (
              <Section title="1. Plan">
                <p className="text-sm font-semibold text-foreground">{trace.plan.topic}</p>
                {trace.plan.unknown && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Find:</span> {trace.plan.unknown}
                  </p>
                )}
                {trace.plan.givens.length > 0 && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Given:</span>{" "}
                    {trace.plan.givens.join("; ")}
                  </p>
                )}
                <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-foreground/90">
                  {trace.plan.approach.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ol>
                {trace.plan.pitfalls.length > 0 && (
                  <div className="mt-3 rounded-md bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-400">
                    <span className="font-semibold">Watch out for:</span>{" "}
                    {trace.plan.pitfalls.join("; ")}
                  </div>
                )}
              </Section>
            )}

            <Section title="2. Independent Solutions">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border/50 bg-background p-3 shadow-sm">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Solver 1
                  </span>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {trace.method || "Standard approach"}
                  </p>
                </div>
                <div className="rounded-lg border border-border/50 bg-background p-3 shadow-sm">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Solver 2
                  </span>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {trace.methodB || "Alternative approach"}
                  </p>
                </div>
              </div>
              {trace.agreement?.note && (
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {trace.agreement.note.charAt(0).toUpperCase() + trace.agreement.note.slice(1)}.
                </p>
              )}
            </Section>

            <Section
              title="3. Calculator Checks"
              variant={passed === trace.checks.length ? "success" : "default"}
            >
              {trace.checks.length === 0 && typeof trace.unitCheck?.ok !== "boolean" ? (
                <p className="text-sm italic text-muted-foreground">
                  No machine-checkable claims were made for this answer.
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {trace.checks.map((c, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      {c.ok ? (
                        <CheckCircle2
                          className="mt-0.5 size-4 shrink-0 text-emerald-500"
                          aria-hidden
                        />
                      ) : (
                        <XCircle className="mt-0.5 size-4 shrink-0 text-red-500" aria-hidden />
                      )}
                      <span>
                        <span className="font-medium text-foreground">{c.label}</span>
                        <span className="text-muted-foreground"> — {c.detail}</span>
                      </span>
                    </li>
                  ))}
                  {typeof trace.unitCheck?.ok === "boolean" && (
                    <li className="flex items-start gap-3 text-sm">
                      {trace.unitCheck.ok ? (
                        <CheckCircle2
                          className="mt-0.5 size-4 shrink-0 text-emerald-500"
                          aria-hidden
                        />
                      ) : (
                        <XCircle className="mt-0.5 size-4 shrink-0 text-red-500" aria-hidden />
                      )}
                      <span>
                        <span className="font-medium text-foreground">Units</span>
                        <span className="text-muted-foreground">
                          {" "}
                          — Got <span className="font-mono">{trace.unitCheck.got}</span> vs expected{" "}
                          <span className="font-mono">{trace.unitCheck.expected}</span>
                        </span>
                      </span>
                    </li>
                  )}
                </ul>
              )}
            </Section>

            {trace.corrections.length > 0 && (
              <Section title="4. Mistakes Caught" variant="warning">
                <ul className="space-y-4">
                  {trace.corrections.map((c) => (
                    <li
                      key={c.round}
                      className="relative pl-4 text-sm before:absolute before:left-0 before:top-1.5 before:h-1.5 before:w-1.5 before:rounded-full before:bg-amber-500/50"
                    >
                      <p className="flex items-center gap-1.5 font-semibold text-foreground">
                        <Wrench className="size-3.5 text-amber-500" aria-hidden /> Attempt {c.round}
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        <span className="font-medium text-foreground/80">Problem:</span> {c.problem}
                      </p>
                      <p className="mt-1 text-emerald-600 dark:text-emerald-400">
                        <span className="font-medium">Fix:</span> {c.fix}
                      </p>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {trace.openIssues?.length > 0 && (
              <Section title="Still Open" variant="warning">
                <ul className="list-disc space-y-1.5 pl-5 text-sm text-amber-700 dark:text-amber-400">
                  {trace.openIssues.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </Section>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
