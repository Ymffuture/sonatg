// src/lib/stem/types.ts
//
// Shared (browser + server) types for Sona's math & physics agent system.

import type { Claim, ClaimResult } from "./calc";

export type StemSubject = "math" | "physics" | "both";

export type AgentRole = "planner" | "solver" | "solver_b" | "corrector";

/** What the Planner agent produces before any solving starts. */
export type Plan = {
  topic: string;
  /** Things the problem gives us, with units where relevant. */
  givens: string[];
  /** What we are asked to find. */
  unknown: string;
  /** A unit of the same dimension as the final answer (e.g. "m/s"), when the answer is a physical quantity. */
  expectedUnit?: string;
  /** Ordered strategy, 2–6 short lines. */
  approach: string[];
  /** Common traps for this kind of problem. */
  pitfalls: string[];
  difficulty: 1 | 2 | 3 | 4 | 5;
};

export type Step = {
  title: string;
  explanation: string;
  /** One line of plain-text math, e.g. "v = sqrt(2*g_earth*h)". */
  math?: string;
};

/**
 * What kind of final answer this is — it decides how the machine checks it.
 *  numbers       – one or more numeric values (all roots of an equation, a speed…)
 *  expression    – a formula in free variables (a simplification, a derived law)
 *  antiderivative– an integral without limits (compared up to a constant)
 *  text          – a proof, a word answer… (no machine comparison possible)
 */
export type AnswerKind = "numbers" | "expression" | "antiderivative" | "text";

export type Answer = {
  kind: AnswerKind;
  /** Name of the thing found, e.g. "v_final" or "x". */
  label?: string;
  /** numbers: one expression per value. expression/antiderivative: exactly one. */
  exprs: string[];
  unit?: string;
  /** Human-readable statement of the answer (always present). */
  text: string;
};

export type Solution = {
  /** Numeric givens in SI units, usable by name inside every expression below. */
  vars: Record<string, number>;
  steps: Step[];
  answer: Answer;
  /** Machine-checkable assertions the solver commits to. */
  claims: Claim[];
  /** Name of the method, e.g. "energy conservation". */
  method?: string;
  assumptions: string[];
};

export type Issue = {
  source: "claim" | "unit" | "agreement" | "answer" | "format";
  message: string;
};

export type VerificationLevel =
  /** Machine checks passed AND an independent second solution agrees. */
  | "verified"
  /** Machine checks passed, but there was no independent solution to compare against. */
  | "checked"
  /** Could not be confirmed; shown with its open issues. */
  | "unverified";

export type Evaluated = {
  /** Tool-computed values of answer.exprs (null where an expression failed). */
  values: (number | null)[];
  claimResults: ClaimResult[];
  issues: Issue[];
  unit: { expected?: string; got?: string; ok: boolean | null };
};

export type Correction = {
  round: number;
  problem: string;
  fix: string;
};

export type Phase = "planning" | "solving" | "verifying" | "correcting" | "writing" | "done";

export type TraceEvent = {
  /** ms since the run started */
  at: number;
  phase: Phase;
  note: string;
};

/** Everything the "How Sona solved this" sheet shows. Stored as JSON in ai_agent_runs.trace. */
export type AgentTrace = {
  v: 1;
  subject: StemSubject;
  plan: Plan | null;
  method: string | null;
  methodB: string | null;
  checks: ClaimResult[];
  agreement: { compared: boolean; agreed: boolean; note: string };
  unitCheck: { expected?: string; got?: string; ok: boolean | null };
  corrections: Correction[];
  level: VerificationLevel;
  openIssues: string[];
  events: TraceEvent[];
  elapsedMs: number;
  llmCalls: number;
  budgetHit: boolean;
};

export type StemOutcome =
  | { status: "ok"; body: string; trace: AgentTrace }
  /** Nothing usable came out — the caller should fall back to the normal chat reply. */
  | { status: "failed"; reason: string };

export type ProgressSnapshot = {
  phase: Phase;
  note: string;
  plan: Plan | null;
  round: number;
  events: TraceEvent[];
};
