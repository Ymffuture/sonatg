// src/lib/stem/think.ts
//
// The live "thinking" state of an agent run, sent to the chat as a hidden marker in the
// message body ("[[sona-think:<url-encoded json>]]"). The bubble renders it as an animated
// timeline (AgentThinking.tsx); when the run finishes the whole body is replaced by the answer.
// Isomorphic: the server encodes, the browser decodes. Kept tiny — it's rewritten every ~0.7s.

import type { Phase, ProgressSnapshot } from "./types";

export type ThinkingView = {
  phase: Phase;
  note: string;
  /** Epoch ms when the run started — the client ticks its own timer from this. */
  startedAt: number;
  round: number;
  plan: { topic: string; unknown: string; approach: string[] } | null;
  methods: { a?: string; b?: string };
  /** Titles of the primary solver's reasoning steps. */
  steps: string[];
  checks: { label: string; ok: boolean }[];
  issues: string[];
};

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function toThinkingView(s: ProgressSnapshot): ThinkingView {
  return {
    phase: s.phase,
    note: clip(s.note, 120),
    startedAt: s.startedAt,
    round: s.round,
    plan: s.plan
      ? {
          topic: clip(s.plan.topic, 80),
          unknown: clip(s.plan.unknown, 140),
          approach: s.plan.approach.slice(0, 5).map((a) => clip(a, 160)),
        }
      : null,
    methods: { a: s.methods.a && clip(s.methods.a, 70), b: s.methods.b && clip(s.methods.b, 70) },
    steps: s.stepTitles.slice(0, 8).map((t) => clip(t, 80)),
    checks: s.checks.slice(0, 10).map((c) => ({ label: clip(c.label, 70), ok: c.ok })),
    issues: s.issues.slice(0, 3).map((i) => clip(i, 160)),
  };
}

export function encodeThinking(s: ProgressSnapshot): string {
  return `[[sona-think:${encodeURIComponent(JSON.stringify(toThinkingView(s)))}]]`;
}

const PHASES: readonly Phase[] = [
  "planning",
  "solving",
  "verifying",
  "correcting",
  "writing",
  "done",
];

/** Defensive: the body comes from the database, so validate rather than trust the shape. */
export function decodeThinking(raw: string): ThinkingView | null {
  try {
    const v = JSON.parse(decodeURIComponent(raw)) as Partial<ThinkingView>;
    if (
      !v ||
      typeof v !== "object" ||
      !PHASES.includes(v.phase as Phase) ||
      typeof v.startedAt !== "number"
    )
      return null;
    const strs = (x: unknown) =>
      Array.isArray(x) ? x.filter((i): i is string => typeof i === "string") : [];
    return {
      phase: v.phase as Phase,
      note: typeof v.note === "string" ? v.note : "",
      startedAt: v.startedAt,
      round: typeof v.round === "number" ? v.round : 0,
      plan:
        v.plan && typeof v.plan === "object"
          ? {
              topic: String(v.plan.topic ?? ""),
              unknown: String(v.plan.unknown ?? ""),
              approach: strs(v.plan.approach),
            }
          : null,
      methods: {
        a: typeof v.methods?.a === "string" ? v.methods.a : undefined,
        b: typeof v.methods?.b === "string" ? v.methods.b : undefined,
      },
      steps: strs(v.steps),
      checks: Array.isArray(v.checks)
        ? v.checks.filter(
            (c): c is { label: string; ok: boolean } =>
              !!c && typeof c.label === "string" && typeof c.ok === "boolean",
          )
        : [],
      issues: strs(v.issues),
    };
  } catch {
    return null;
  }
}
