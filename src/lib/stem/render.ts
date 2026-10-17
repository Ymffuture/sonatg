// src/lib/stem/render.ts
//
// Turns a verified solution into the chat message body. Deterministic on
// purpose: no extra LLM call, so a correct, verified answer can't be garbled by
// a "writer" model, and every number shown was computed by the calculator.
//
// The chat bubble truncates long text behind "Read more", so the answer and its
// verification status come FIRST and the worked steps follow.

import { fmt } from "./calc";
import type { AgentTrace, Evaluated, Solution } from "./types";

const SUP: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "-": "⁻",
};
const sup = (s: string) =>
  Array.from(s)
    .map((c) => SUP[c] ?? c)
    .join("");

/** 6.674×10^-11 -> 6.674×10⁻¹¹ */
function prettySci(s: string): string {
  return s.replace(/×10\^(-?\d+)/g, (_m, e: string) => `×10${sup(e)}`);
}

/** "m/s^2" -> "m/s²", "kg*m" -> "kg·m" */
export function prettyUnit(u: string): string {
  return u.replace(/\^(-?\d+)/g, (_m, e: string) => sup(e)).replace(/\*/g, "·");
}

/** Light cosmetic pass for a line of plain-text maths. Never changes meaning. */
export function prettyMath(m: string): string {
  return m
    .replace(/sqrt\s*\(/g, "√(")
    .replace(/\bpi\b/g, "π")
    .replace(/\^(-?\d+)(?![\d.])/g, (_x, e: string) => sup(e))
    .replace(/\s*\*\s*/g, " · ")
    .replace(/`/g, "'");
}

export function formatQuantity(value: number, unit?: string): string {
  return `${prettySci(fmt(value))}${unit ? ` ${prettyUnit(unit)}` : ""}`;
}

function headline(sol: Solution, ev: Evaluated): string {
  const { answer } = sol;
  const label = answer.label || "Answer";
  if (answer.kind === "numbers" && ev.values.length && ev.values.every((v) => v !== null)) {
    const vals = (ev.values as number[]).map((v) => formatQuantity(v)).join(", or ");
    const unit = answer.unit ? ` ${prettyUnit(answer.unit)}` : "";
    const approx = (ev.values as number[]).every((v) => Number.isInteger(v)) ? "=" : "≈";
    return `**${label} ${approx} ${vals}${unit}**`;
  }
  if (answer.kind === "expression" || answer.kind === "antiderivative") {
    return `**${label} = \`${prettyMath(answer.exprs[0])}\`${answer.kind === "antiderivative" ? " + C" : ""}**`;
  }
  return `**${answer.text}**`;
}

function verdict(trace: AgentTrace): string {
  const total = trace.checks.length;
  const ok = trace.checks.filter((c) => c.ok).length;
  const fixed = trace.corrections.filter((c) => !/Not adopted/.test(c.fix)).length;
  const fixNote = fixed
    ? ` · caught and fixed ${fixed === 1 ? "a mistake" : `${fixed} mistakes`} on review`
    : "";
  switch (trace.level) {
    case "verified":
      return `✅ **Verified** — two independent solutions agree${total ? ` · ${ok}/${total} calculator checks passed` : ""}${fixNote}`;
    case "checked":
      return `✅ **Checked** — ${ok}/${Math.max(total, ok)} calculator checks passed${trace.agreement.compared ? "" : " (no second solution to compare)"}${fixNote}`;
    default:
      return `⚠️ **Not fully verified** — ${trace.openIssues[0] ?? "some checks didn't pass"}. Please double-check before relying on it.`;
  }
}

export function renderAnswerBody(sol: Solution, ev: Evaluated, trace: AgentTrace): string {
  const out: string[] = [headline(sol, ev), verdict(trace)];

  // For a text/proof answer the headline IS answer.text; for numbers keep the statement as context.
  if (sol.answer.kind === "numbers" && sol.answer.text && !/\d/.test(sol.answer.text))
    out.push(sol.answer.text);

  out.push("**Working**");
  sol.steps.forEach((s, i) => {
    const lines = [`${i + 1}. **${s.title}** — ${s.explanation}`.trimEnd()];
    if (s.math) lines.push(`   \`${prettyMath(s.math)}\``);
    out.push(lines.join("\n"));
  });
  if (sol.assumptions.length) out.push(`*Assumed:* ${sol.assumptions.join("; ")}`);

  const failed = trace.checks.filter((c) => !c.ok);
  if (trace.level === "unverified" && failed.length) {
    out.push(`*Checks that didn't pass:* ${failed.map((c) => c.label).join("; ")}`);
  }
  return out.join("\n\n");
}
