// scripts/stem-selftest.ts
//
// Zero-dependency self-test for the math/physics agents (no API keys, no network):
//   npx tsx scripts/stem-selftest.ts
//
// The "model" is scripted, so these tests prove the SYSTEM catches and corrects
// mistakes — they don't depend on any real model being smart that day.

import assert from "node:assert/strict";
import {
  evaluate,
  tryEvaluate,
  verifyClaim,
  fmt,
  equivalentAtRandomPoints,
} from "../src/lib/stem/calc";
import { sameDimension, toSI, dimensionOf } from "../src/lib/stem/units";
import { detectStemIntent } from "../src/lib/stem/detect";
import {
  extractJson,
  parseSolutionResponse,
  runStemAgents,
  type ChatMsg,
} from "../src/lib/stem/agents";
import type { AgentRole, ProgressSnapshot } from "../src/lib/stem/types";
import { encodeThinking, decodeThinking } from "../src/lib/stem/think";
import { splitSources, stripSources } from "../src/lib/sources";

let passed = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${(e as Error).stack}`);
    process.exitCode = 1;
  }
}
const near = (a: number, b: number, rel = 1e-9) =>
  assert.ok(Math.abs(a - b) <= rel * Math.max(1, Math.abs(b)), `${a} !≈ ${b}`);

// ── calculator ───────────────────────────────────────────────────────────────
console.log("calculator");
await test("precedence & associativity", () => {
  near(evaluate("2+3*4"), 14);
  near(evaluate("-2^2"), -4);
  near(evaluate("2^-3"), 0.125);
  near(evaluate("2^3^2"), 512);
  near(evaluate("(1+2)*(3+4)"), 21);
  near(evaluate("10/4"), 2.5);
});
await test("implicit multiplication", () => {
  near(evaluate("2x", { x: 5 }), 10);
  near(evaluate("3(x+1)", { x: 1 }), 6);
  near(evaluate("x sin(y)", { x: 2, y: Math.PI / 2 }), 2);
});
await test("functions, constants, unicode", () => {
  near(evaluate("sqrt(16)+ln(e)"), 5);
  near(evaluate("sind(30)"), 0.5, 1e-12);
  near(evaluate("log(1000)"), 3);
  near(evaluate("log(8,2)"), 3);
  near(evaluate("nCr(5,2)"), 10);
  near(evaluate("5!".replace("!", "") + "*1"), 5);
  near(evaluate("3×4−2÷2"), 11);
  near(evaluate("√9 + 2²"), 7);
  near(evaluate("0.5*2*3^2"), 9);
  near(evaluate("v0^2/(2*g_earth)", { v0: 20 }), 400 / (2 * 9.80665));
  near(evaluate("6.022e23*2"), 1.2044e24);
});
await test("rejects bad / hostile input (no eval)", () => {
  for (const bad of [
    "",
    "1/0",
    "sqrt(-1)",
    "foo(2)",
    "constructor",
    "process.exit()",
    "__proto__",
    "2+",
    "(1+2",
    "1;2",
    "x",
    "a".repeat(600),
    "((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((1))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))",
  ]) {
    assert.equal(tryEvaluate(bad), null, `should reject: ${bad.slice(0, 30)}`);
  }
});
await test("variables beat constants only when supplied", () => {
  near(evaluate("c_light"), 299792458);
  near(evaluate("e", { e: 3 }), 3);
});

console.log("claims (self-checking tools)");
await test("value claim catches wrong arithmetic", () => {
  assert.equal(
    verifyClaim({ type: "value", label: "KE", expr: "0.5*m*v^2", equals: 9 }, { m: 2, v: 3 }).ok,
    true,
  );
  const bad = verifyClaim(
    { type: "value", label: "KE", expr: "0.5*m*v^2", equals: 12 },
    { m: 2, v: 3 },
  );
  assert.equal(bad.ok, false);
  assert.match(bad.detail, /9/);
});
await test("derivative claim: right vs wrong", () => {
  assert.equal(
    verifyClaim({ type: "derivative", label: "d", f: "x^3*sin(x)", df: "3*x^2*sin(x)+x^3*cos(x)" })
      .ok,
    true,
  );
  assert.equal(
    verifyClaim({ type: "derivative", label: "d", f: "x^3*sin(x)", df: "3*x^2*cos(x)" }).ok,
    false,
  );
});
await test("integral claim", () => {
  assert.equal(
    verifyClaim({ type: "integral", label: "i", f: "x^2", a: 0, b: 3, equals: 9 }).ok,
    true,
  );
  assert.equal(
    verifyClaim({ type: "integral", label: "i", f: "x^2", a: 0, b: 3, equals: 6 }).ok,
    false,
  );
});
await test("root claim", () => {
  assert.equal(verifyClaim({ type: "root", label: "r", f: "x^2-5*x+6", at: 3 }).ok, true);
  assert.equal(verifyClaim({ type: "root", label: "r", f: "x^2-5*x+6", at: 4 }).ok, false);
});
await test("identity claim (algebra)", () => {
  assert.equal(
    verifyClaim({ type: "identity", label: "(x+1)^2", lhs: "(x+1)^2", rhs: "x^2+2*x+1" }).ok,
    true,
  );
  assert.equal(
    verifyClaim({ type: "identity", label: "(x+1)^2", lhs: "(x+1)^2", rhs: "x^2+1" }).ok,
    false,
  );
  assert.equal(
    equivalentAtRandomPoints("x^3/3", "x^3/3+7", { allowConstantOffset: true }).ok,
    true,
  );
  assert.equal(
    equivalentAtRandomPoints("x^3/3", "x^3/3+x", { allowConstantOffset: true }).ok,
    false,
  );
});
await test("fmt", () => {
  assert.equal(fmt(9.80665), "9.807");
  assert.equal(fmt(6.674e-11), "6.674×10^-11");
  assert.equal(fmt(12), "12");
});

// ── units ────────────────────────────────────────────────────────────────────
console.log("units");
await test("dimensional analysis", () => {
  assert.equal(sameDimension("N", "kg*m/s^2"), true);
  assert.equal(sameDimension("N", "kg m s^-2"), true);
  assert.equal(sameDimension("m/s²", "m/s^2"), true);
  assert.equal(sameDimension("J", "N*m"), true);
  assert.equal(sameDimension("W", "J/s"), true);
  assert.equal(sameDimension("V", "J/C"), true);
  assert.equal(sameDimension("J", "N"), false);
  assert.equal(sameDimension("m/s", "m/s^2"), false);
  assert.equal(sameDimension("m/s", "flurbs"), null);
  assert.ok(dimensionOf("kPa") && dimensionOf("mA") && dimensionOf("µs"));
});
await test("SI conversion", () => {
  near(toSI(5, "km")!, 5000);
  near(toSI(90, "km/h")!, 25);
  near(toSI(2, "g")!, 0.002);
  near(toSI(1, "min")!, 60);
});

// ── intent detection ─────────────────────────────────────────────────────────
console.log("intent detection");
await test("fires on real math/physics work", () => {
  for (const p of [
    "Solve x^2 - 5x + 6 = 0",
    "A ball is thrown upward at 20 m/s. How high does it go?",
    "Differentiate x^3 sin(x)",
    "calculate the kinetic energy of a 1200 kg car moving at 25 m/s",
    "find the integral of x^2 from 0 to 3",
    "A 10 ohm resistor is connected to a 12 V battery, what is the current?",
    "prove that the sum of the first n odd numbers is n^2",
    "/solve how fast is a rock after falling 5 m",
  ])
    assert.ok(detectStemIntent(p), `should trigger: ${p}`);
});
await test("stays out of ordinary chat", () => {
  for (const p of [
    "hey how are you",
    "what time is it in Tokyo",
    "remind me about my force of habit lol",
    "12*7=?",
    "can you recommend a series to watch",
    "/quick solve x^2=4",
    "who won the match yesterday",
    "what is entropy?",
    "thanks!",
    "I have 3 classes today and a power cut",
  ])
    assert.equal(detectStemIntent(p), null, `should NOT trigger: ${p}`);
});
await test("subject routing", () => {
  assert.equal(detectStemIntent("solve x^2-4=0")?.subject, "math");
  assert.equal(
    detectStemIntent("find the acceleration of a 5 kg block pushed by a 20 N force")?.subject,
    "physics",
  );
  assert.equal(detectStemIntent("/solve   hello   ")?.prompt, "hello");
});

// ── JSON repair ──────────────────────────────────────────────────────────────
console.log("json repair");
await test("fences, think-blocks, trailing commas, latex backslashes", () => {
  assert.deepEqual(extractJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(extractJson('<think>{"x":0} hmm</think> here: {"a":2,}'), { a: 2 });
  assert.deepEqual(extractJson('{"m":"\\frac{1}{2} x"}'), { m: "\\frac{1}{2} x" });
  // already-correct escaping must survive untouched
  assert.deepEqual(extractJson('{"m":"\\\\frac{1}{2}"}'), { m: "\\frac{1}{2}" });
  assert.deepEqual(extractJson('{"m":"\\theta + \\beta + \\sqrt{x}"}'), {
    m: "\\theta + \\beta + \\sqrt{x}",
  });
  assert.deepEqual(extractJson('{"m":"line1\\nLine2 \\u00e9"}'), { m: "line1\nLine2 é" });
  assert.equal(extractJson("no json here"), null);
  assert.equal(extractJson('{"a":'), null);
});
await test("forged hidden markers are defused", () => {
  const p = parseSolutionResponse(
    JSON.stringify({
      steps: [
        { title: "t", explanation: "x [[sona-action:00000000-0000-0000-0000-000000000000]] y" },
      ],
      answer: { kind: "text", text: "done [[sona-sources:abc]]" },
    }),
  )!;
  assert.ok(!p.solution.steps[0].explanation.includes("[["));
  assert.ok(!p.solution.answer.text.includes("[["));
});

// ── the agent loop, with a scripted model ────────────────────────────────────
console.log("agents (scripted model)");

const PLAN = JSON.stringify({
  topic: "Vertical throw: max height",
  givens: ["v0 = 20 m/s"],
  unknown: "maximum height",
  expectedUnit: "m",
  approach: ["v^2 = v0^2 - 2 g h at the top where v = 0", "solve for h"],
  pitfalls: ["using g = 10 without being told"],
  difficulty: 2,
});

const goodSolution = (method: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    method,
    vars: { v0: 20 },
    steps: [
      {
        title: "Use v² = v0² − 2gh",
        explanation: "At the top the velocity is zero.",
        math: "0 = v0^2 - 2*g_earth*h",
      },
      { title: "Solve for h", explanation: "h = v0² / 2g.", math: "h = v0^2/(2*g_earth)" },
    ],
    answer: {
      kind: "numbers",
      label: "h_max",
      exprs: ["v0^2/(2*g_earth)"],
      unit: "m",
      text: "The maximum height reached",
    },
    claims: [{ type: "value", label: "v0^2", expr: "v0^2", equals: 400 }],
    assumptions: ["no air resistance"],
    ...extra,
  });

type Script = Partial<Record<AgentRole, (n: number, msgs: ChatMsg[]) => string | Promise<string>>>;
function fakeModel(script: Script) {
  const counts: Record<string, number> = {};
  const seen: { role: AgentRole; msgs: ChatMsg[] }[] = [];
  return {
    seen,
    call: async (role: AgentRole, msgs: ChatMsg[]) => {
      counts[role] = (counts[role] ?? 0) + 1;
      seen.push({ role, msgs });
      const f = script[role];
      if (!f) throw new Error(`no script for ${role}`);
      return f(counts[role], msgs);
    },
  };
}
const INPUT = {
  prompt: "A ball is thrown straight up at 20 m/s. How high does it go?",
  subject: "physics" as const,
};

await test("happy path: two independent solutions agree -> verified, 3 model calls", async () => {
  const m = fakeModel({
    planner: () => PLAN,
    solver: () => goodSolution("kinematics"),
    solver_b: () =>
      goodSolution("energy conservation", {
        vars: { v0: 20, m: 1 },
        answer: {
          kind: "numbers",
          label: "h_max",
          exprs: ["(0.5*m*v0^2)/(m*g_earth)"],
          unit: "m",
          text: "Max height",
        },
      }),
  });
  const phases: string[] = [];
  const r = await runStemAgents(INPUT, { call: m.call, onProgress: (s) => phases.push(s.phase) });
  assert.equal(r.status, "ok");
  if (r.status !== "ok") return;
  assert.equal(r.trace.level, "verified");
  assert.equal(r.trace.llmCalls, 3);
  assert.equal(r.trace.corrections.length, 0);
  assert.match(r.body, /h_max ≈ 20\.39 m/);
  assert.match(r.body, /Verified/);
  assert.deepEqual([...new Set(phases)], ["planning", "solving", "verifying", "writing", "done"]);
  // B must never see the plan (independence)
  const bPrompt = m.seen
    .find((s) => s.role === "solver_b")!
    .msgs.map((x) => x.content)
    .join("\n");
  assert.ok(!bPrompt.includes("PLAN (from the planning agent"));
  console.log("\n--- sample message body ---\n" + r.body + "\n---------------------------\n");
});

await test("MISTAKE CAUGHT: wrong formula + wrong arithmetic -> corrector fixes it -> verified", async () => {
  const wrong = goodSolution("kinematics", {
    steps: [{ title: "Use h = v0 t", explanation: "Forgot gravity.", math: "h = v0*2" }],
    answer: { kind: "numbers", label: "h_max", exprs: ["v0*2"], unit: "m", text: "Max height" },
    claims: [{ type: "value", label: "v0 t", expr: "v0*2", equals: 41 }], // arithmetic also wrong (tool says 40)
  });
  const m = fakeModel({
    planner: () => PLAN,
    solver: () => wrong,
    solver_b: () => goodSolution("energy conservation"),
    corrector: (_n, msgs) => {
      const user = msgs[msgs.length - 1].content;
      assert.match(user, /TOOL REPORT/);
      assert.match(user, /actually evaluates to 40/); // the calculator's finding is handed over
      assert.match(user, /solution 1 got 40/); // and the disagreement
      return goodSolution("kinematics (fixed)", {
        whatWasWrong: "I ignored gravity; h = v0^2/(2g), not v0*t.",
      });
    },
  });
  const r = await runStemAgents(INPUT, { call: m.call });
  assert.equal(r.status, "ok");
  if (r.status !== "ok") return;
  assert.equal(r.trace.level, "verified");
  assert.equal(r.trace.corrections.length, 1);
  assert.match(r.trace.corrections[0].fix, /ignored gravity/);
  assert.match(r.body, /20\.39/);
  assert.match(r.body, /caught and fixed a mistake/);
});

await test("WRONG DIMENSIONS caught (answer in joules for a height)", async () => {
  const m = fakeModel({
    planner: () => PLAN,
    solver: () =>
      goodSolution("energy", {
        answer: { kind: "numbers", label: "h", exprs: ["0.5*v0^2"], unit: "J", text: "x" },
      }),
    solver_b: () => goodSolution("kinematics"),
    corrector: () =>
      goodSolution("fixed", { whatWasWrong: "Reported energy per unit mass instead of height." }),
  });
  const r = await runStemAgents(INPUT, { call: m.call });
  assert.equal(r.status === "ok" && r.trace.level, "verified");
  assert.equal(r.status === "ok" && r.trace.corrections.length, 1);
});

await test("auto-fix: model's mental arithmetic is replaced by the calculator's number", async () => {
  const m = fakeModel({
    planner: () => PLAN,
    solver: () =>
      goodSolution("k", {
        answer: {
          kind: "numbers",
          label: "h",
          exprs: ["v0^2/(2*g_earth)"],
          unit: "m",
          text: "The height is 25 m",
        },
      }),
    solver_b: () => goodSolution("e"),
  });
  const r = await runStemAgents(INPUT, { call: m.call });
  assert.equal(r.status, "ok");
  if (r.status !== "ok") return;
  assert.match(r.body, /h ≈ 20\.39 m/);
  assert.ok(
    !/25 m/.test(r.body.split("**Working**")[0]),
    "the model's wrong stated number must not reach the headline",
  );
});

await test("honest when it can't fix it: unverified, with the open issue shown", async () => {
  const bad = goodSolution("k", {
    claims: [{ type: "value", label: "bad claim", expr: "v0*2", equals: 99 }],
  });
  const m = fakeModel({
    planner: () => PLAN,
    solver: () => bad,
    solver_b: () => bad,
    corrector: () => bad,
  });
  const r = await runStemAgents(INPUT, { call: m.call, maxCorrections: 2 });
  assert.equal(r.status, "ok");
  if (r.status !== "ok") return;
  assert.equal(r.trace.level, "unverified");
  assert.match(r.body, /Not fully verified/);
  assert.ok(r.trace.openIssues.length > 0);
});

await test("solver A returns garbage -> B is promoted, flagged 'checked' not 'verified'", async () => {
  const m = fakeModel({
    planner: () => PLAN,
    solver: () => "Sure! The answer is 20 m. {oops",
    solver_b: () => goodSolution("energy"),
  });
  const r = await runStemAgents(INPUT, { call: m.call });
  assert.equal(r.status === "ok" && r.trace.level, "checked");
});

await test("both solvers garbage -> failed (caller falls back to normal chat)", async () => {
  const m = fakeModel({ planner: () => PLAN, solver: () => "nope", solver_b: () => "also nope" });
  const r = await runStemAgents(INPUT, { call: m.call });
  assert.equal(r.status, "failed");
});

await test("planner failure is soft: still solves", async () => {
  const m = fakeModel({
    planner: () => {
      throw new Error("busy");
    },
    solver: () => goodSolution("k"),
    solver_b: () => goodSolution("e"),
  });
  const r = await runStemAgents(INPUT, { call: m.call });
  assert.equal(r.status === "ok" && r.trace.level, "verified");
  assert.equal(r.status === "ok" && r.trace.plan, null);
});

await test("symbolic: wrong derivative caught by numeric differentiation, then fixed", async () => {
  const mk = (df: string, ans: string) =>
    JSON.stringify({
      method: "product rule",
      vars: {},
      steps: [{ title: "Product rule", explanation: "d(uv)=u'v+uv'", math: `f' = ${df}` }],
      answer: { kind: "expression", label: "f'(x)", exprs: [ans], text: `f'(x) = ${ans}` },
      claims: [
        { type: "derivative", label: "d/dx of x^3 sin(x)", f: "x^3*sin(x)", df, variable: "x" },
      ],
    });
  const good = "3*x^2*sin(x)+x^3*cos(x)";
  const m = fakeModel({
    planner: () =>
      JSON.stringify({ topic: "Product rule", approach: ["u'v + uv'"], difficulty: 2 }),
    solver: () => mk("3*x^2*cos(x)", "3*x^2*cos(x)"),
    solver_b: () => mk("x^3*cos(x)+3*x^2*sin(x)", "x^3*cos(x)+3*x^2*sin(x)"),
    corrector: () => mk(good, good),
  });
  const r = await runStemAgents(
    { prompt: "Differentiate x^3 sin(x)", subject: "math" },
    { call: m.call },
  );
  assert.equal(r.status === "ok" && r.trace.level, "verified");
  assert.equal(r.status === "ok" && r.trace.corrections.length, 1);
});

await test("multiple roots compared as a set (order-independent)", async () => {
  const quad = (a: string[]) =>
    JSON.stringify({
      method: "factoring",
      vars: { a: 1, b: -5, c: 6 },
      steps: [{ title: "Quadratic formula", explanation: "x = (-b ± √(b²−4ac)) / 2a" }],
      answer: { kind: "numbers", label: "x", exprs: a, text: "roots" },
      claims: [
        { type: "root", label: "x=2", f: "x^2-5*x+6", at: 2 },
        { type: "root", label: "x=3", f: "x^2-5*x+6", at: 3 },
      ],
    });
  const m = fakeModel({
    planner: () => JSON.stringify({ topic: "Quadratic", approach: ["formula"], difficulty: 1 }),
    solver: () => quad(["(-b+sqrt(b^2-4*a*c))/(2*a)", "(-b-sqrt(b^2-4*a*c))/(2*a)"]),
    solver_b: () => quad(["2", "3"]),
  });
  const r = await runStemAgents(
    { prompt: "Solve x^2 - 5x + 6 = 0", subject: "math" },
    { call: m.call },
  );
  assert.equal(r.status === "ok" && r.trace.level, "verified");
  if (r.status === "ok") assert.match(r.body, /x = 3, or 2|x = 2, or 3/);
});

await test("budget: a hanging model can't hold the chat hostage", async () => {
  const hang = () =>
    new Promise<string>(() => {
      /* never resolves */
    });
  const m = fakeModel({ planner: hang, solver: hang, solver_b: hang });
  const t = Date.now();
  const r = await runStemAgents(INPUT, { call: m.call, budgetMs: 4_000 });
  assert.equal(r.status, "failed");
  assert.ok(Date.now() - t < 6_000, `took ${Date.now() - t}ms`);
});

// ── live thinking marker ─────────────────────────────────────────────────────
console.log("thinking marker");
await test("progress snapshot survives the body round-trip and hides from previews", () => {
  const snap: ProgressSnapshot = {
    phase: "verifying",
    note: "n",
    plan: {
      topic: "Vertical throw",
      givens: [],
      unknown: "max height",
      approach: ["a", "b"],
      pitfalls: [],
      difficulty: 2,
    },
    round: 1,
    events: [],
    startedAt: 1_700_000_000_000,
    methods: { a: "kinematics", b: "energy" },
    stepTitles: ["Use v² = v0² − 2gh"],
    checks: [
      { label: "v0^2 = 400", ok: true },
      { label: "bad]]one", ok: false },
    ],
    issues: ["x"],
  };
  const body = encodeThinking(snap);
  const parts = splitSources(body);
  assert.equal(parts.text, "");
  assert.equal(parts.thinking?.phase, "verifying");
  assert.equal(parts.thinking?.methods.b, "energy");
  assert.equal(parts.thinking?.checks.length, 2);
  assert.equal(parts.thinking?.checks[1].label, "bad]]one"); // "]]" inside a label must not break the marker
  assert.equal(stripSources(body), "Thinking…");
  assert.equal(decodeThinking("%7Bnot-json"), null);
  assert.equal(
    decodeThinking(encodeURIComponent(JSON.stringify({ phase: "hax", startedAt: 1 }))),
    null,
  );
  assert.equal(splitSources("a normal answer").thinking, null);
});
await test("run emits rich progress (plan, methods, steps, checks) for the live panel", async () => {
  const m = fakeModel({
    planner: () => PLAN,
    solver: () => goodSolution("kinematics"),
    solver_b: () => goodSolution("energy conservation"),
  });
  const snaps: ProgressSnapshot[] = [];
  await runStemAgents(INPUT, { call: m.call, paceMs: 20, onProgress: (s) => snaps.push(s) });
  const verifying = snaps.find((s) => s.phase === "verifying")!;
  assert.equal(verifying.methods.a, "kinematics");
  assert.equal(verifying.methods.b, "energy conservation");
  assert.ok(verifying.stepTitles.length >= 2);
  assert.equal(verifying.checks[0].ok, true);
  assert.ok(snaps.every((s) => s.startedAt === snaps[0].startedAt));
});

console.log(`\n${passed} checks passed${process.exitCode ? " — WITH FAILURES" : ""}`);
