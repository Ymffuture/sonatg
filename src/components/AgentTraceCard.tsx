// src/components/AgentTraceCard.tsx
//
// Pill under a math/physics answer: "Verified · 2 solvers agreed". Tap -> bottom sheet
// ("How Sona solved this") with the plan, calculator checks, solver agreement and any
// mistakes the agents caught and fixed. The trace is fetched by id with the user's own
// session; RLS only returns it to members of the chat.

import { useEffect, useState } from "react";
import { AlertTriangle, Brain, CheckCircle2, ChevronRight, Wrench, XCircle } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { supabase } from "@/integrations/supabase/client";
import type { AgentTrace } from "@/lib/stem/types";

// A trace never changes after creation, so cache it for the session.
const cache = new Map<string, AgentTrace | null>();

async function loadTrace(id: string): Promise<AgentTrace | null> {
  if (cache.has(id)) return cache.get(id) ?? null;
  const { data, error } = await (
    supabase as unknown as {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      from: (t: string) => any;
    }
  )
    .from("ai_agent_runs")
    .select("trace")
    .eq("id", id)
    .maybeSingle();
  if (error) return null; // don't cache failures
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
    Icon: CheckCircle2,
  },
  checked: { label: "Checked", tone: "text-sky-600 dark:text-sky-400", Icon: CheckCircle2 },
  unverified: {
    label: "Not fully verified",
    tone: "text-amber-600 dark:text-amber-400",
    Icon: AlertTriangle,
  },
} as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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

  if (state !== "ready" || !trace) return null;
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const lv = LEVEL[trace.level];
  const passed = trace.checks.filter((c) => c.ok).length;
  const summary = [
    lv.label,
    trace.agreement.compared && trace.agreement.agreed ? "2 solvers agreed" : null,
    trace.checks.length ? `${passed}/${trace.checks.length} checks` : null,
    trace.corrections.length
      ? `${trace.corrections.length} fix${trace.corrections.length === 1 ? "" : "es"}`
      : null,
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
        className={
          "group inline-flex max-w-full cursor-pointer select-none items-center gap-2 rounded-full border py-1.5 pr-3 pl-2.5 shadow-sm ring-1 transition-all duration-200 hover:shadow-md active:scale-[0.97] " +
          (mine
            ? "border-black/10 ring-black/[0.04] dark:border-white/15 dark:ring-white/10"
            : "border-[var(--sona-accent,#E07A5F)]/25 ring-black/[0.04] hover:border-[var(--sona-accent,#E07A5F)]/50 dark:ring-white/10")
        }
      >
        <Brain className={`size-4 shrink-0 ${lv.tone}`} aria-hidden />
        <span className="truncate text-[13px] font-medium text-foreground">{summary}</span>
        <ChevronRight
          className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </div>

      <Drawer open={open} onOpenChange={setOpen} shouldScaleBackground={false}>
        <DrawerContent className="flex h-[min(90dvh,760px)] max-h-[90dvh] min-h-0 flex-col outline-none">
          <DrawerHeader className="shrink-0 border-b bg-background pb-3 text-left">
            <DrawerTitle className="text-base font-semibold">How Sona solved this</DrawerTitle>
            <DrawerDescription className="text-sm">
              {trace.llmCalls} agent calls · {(trace.elapsedMs / 1000).toFixed(1)}s
              {trace.budgetHit ? " · time limit reached" : ""}
            </DrawerDescription>
          </DrawerHeader>

          <div
            className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4 pb-[max(2rem,env(safe-area-inset-bottom))] [scrollbar-width:thin]"
            data-vaul-no-drag
          >
            <div className={`flex items-center gap-2 text-sm font-semibold ${lv.tone}`}>
              <lv.Icon className="size-4" aria-hidden /> {lv.label}
            </div>

            {trace.plan && (
              <Section title="1 · Plan">
                <p className="text-sm font-semibold text-foreground">{trace.plan.topic}</p>
                {trace.plan.unknown && (
                  <p className="mt-1 text-sm text-muted-foreground">Find: {trace.plan.unknown}</p>
                )}
                {trace.plan.givens.length > 0 && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Given: {trace.plan.givens.join("; ")}
                  </p>
                )}
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-foreground">
                  {trace.plan.approach.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ol>
                {trace.plan.pitfalls.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Watch out for: {trace.plan.pitfalls.join("; ")}
                  </p>
                )}
              </Section>
            )}

            <Section title="2 · Two independent solutions">
              <p className="text-sm text-foreground">
                Solver 1{trace.method ? `: ${trace.method}` : ""}
                <br />
                Solver 2{trace.methodB ? `: ${trace.methodB}` : " did not return a usable solution"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {trace.agreement.note[0]?.toUpperCase()}
                {trace.agreement.note.slice(1)}.
              </p>
            </Section>

            <Section title="3 · Calculator checks">
              {trace.checks.length === 0 && trace.unitCheck.ok === null ? (
                <p className="text-sm text-muted-foreground">
                  No machine-checkable claims were made for this answer.
                </p>
              ) : (
                <ul className="space-y-2">
                  {trace.checks.map((c, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
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
                  {trace.unitCheck.ok !== null && (
                    <li className="flex items-start gap-2 text-sm">
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
                          — {trace.unitCheck.got} vs expected {trace.unitCheck.expected}
                        </span>
                      </span>
                    </li>
                  )}
                </ul>
              )}
            </Section>

            {trace.corrections.length > 0 && (
              <Section title="4 · Mistakes caught">
                <ul className="space-y-3">
                  {trace.corrections.map((c) => (
                    <li key={c.round} className="text-sm">
                      <p className="flex items-center gap-1.5 font-medium text-foreground">
                        <Wrench className="size-3.5" aria-hidden /> Attempt {c.round}
                      </p>
                      <p className="mt-1 text-muted-foreground">Problem found: {c.problem}</p>
                      <p className="mt-1 text-foreground">{c.fix}</p>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {trace.openIssues.length > 0 && (
              <Section title="Still open">
                <ul className="list-disc space-y-1 pl-5 text-sm text-amber-700 dark:text-amber-400">
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
