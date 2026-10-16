// src/lib/stem/calc.ts
//
// Isomorphic (no env vars, no network, NO eval) calculator for the math/physics
// agents. LLMs are unreliable at arithmetic, so every number the agents show is
// recomputed here, and every "claim" a solver makes can be machine-checked.
//
//   evaluate("0.5*m*v^2", { m: 2, v: 3 })      -> 9
//   verifyClaim({ type: "derivative", ... })    -> { ok, detail }
//
// Grammar (precedence low -> high):  + -   |   * / (and implicit multiplication,
// "2x", "3(x+1)", "x sin(x)")   |   unary + -   |   ^ (right-assoc, also "**")
// Unary minus binds looser than ^, so  -2^2 = -4  and  2^-3 = 0.125.

export type Vars = Record<string, number>;

// Physical constants have DESCRIPTIVE names on purpose: a bare `c`, `g` or `h`
// would silently collide with a variable of the same name in a math problem.
export const CONSTANTS: Readonly<Record<string, number>> = Object.freeze({
  pi: Math.PI,
  e: Math.E,
  tau: 2 * Math.PI,
  g_earth: 9.80665, // m/s^2
  c_light: 299_792_458, // m/s
  G_grav: 6.6743e-11, // m^3 kg^-1 s^-2
  h_planck: 6.62607015e-34, // J s
  hbar: 1.054571817e-34, // J s
  k_B: 1.380649e-23, // J/K
  N_A: 6.02214076e23, // 1/mol
  q_e: 1.602176634e-19, // C
  eps_0: 8.8541878128e-12, // F/m
  mu_0: 1.25663706212e-6, // N/A^2
  k_coulomb: 8.9875517923e9, // N m^2 / C^2
  R_gas: 8.314462618, // J/(mol K)
  sigma_SB: 5.670374419e-8, // W m^-2 K^-4
  m_e: 9.1093837015e-31, // kg
  m_p: 1.67262192369e-27, // kg
  m_n: 1.67492749804e-27, // kg
  amu: 1.6605390666e-27, // kg
  atm: 101_325, // Pa
  M_earth: 5.9722e24, // kg
  R_earth: 6.371e6, // m
  M_sun: 1.98847e30, // kg
  AU: 1.495978707e11, // m
});

export const CONSTANT_NAMES = Object.keys(CONSTANTS);

const MAX_EXPR_LEN = 500;
const MAX_DEPTH = 60;

function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0 || n > 170)
    throw new Error("factorial needs an integer 0..170");
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}
function nCr(n: number, k: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(k) || k < 0 || n < 0 || k > n)
    throw new Error("nCr needs 0 <= k <= n integers");
  k = Math.min(k, n - k);
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
}
function nPr(n: number, k: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(k) || k < 0 || n < 0 || k > n)
    throw new Error("nPr needs 0 <= k <= n integers");
  let r = 1;
  for (let i = 0; i < k; i++) r *= n - i;
  return r;
}

type Fn = { arity: number | [number, number]; run: (...a: number[]) => number };

const FUNCTIONS: ReadonlyMap<string, Fn> = new Map<string, Fn>([
  ["sin", { arity: 1, run: Math.sin }],
  ["cos", { arity: 1, run: Math.cos }],
  ["tan", { arity: 1, run: Math.tan }],
  ["asin", { arity: 1, run: Math.asin }],
  ["acos", { arity: 1, run: Math.acos }],
  ["atan", { arity: 1, run: Math.atan }],
  ["atan2", { arity: 2, run: Math.atan2 }],
  ["sinh", { arity: 1, run: Math.sinh }],
  ["cosh", { arity: 1, run: Math.cosh }],
  ["tanh", { arity: 1, run: Math.tanh }],
  // degree-based trig, common in physics word problems
  ["sind", { arity: 1, run: (x) => Math.sin((x * Math.PI) / 180) }],
  ["cosd", { arity: 1, run: (x) => Math.cos((x * Math.PI) / 180) }],
  ["tand", { arity: 1, run: (x) => Math.tan((x * Math.PI) / 180) }],
  ["asind", { arity: 1, run: (x) => (Math.asin(x) * 180) / Math.PI }],
  ["acosd", { arity: 1, run: (x) => (Math.acos(x) * 180) / Math.PI }],
  ["atand", { arity: 1, run: (x) => (Math.atan(x) * 180) / Math.PI }],
  ["rad", { arity: 1, run: (x) => (x * Math.PI) / 180 }],
  ["deg", { arity: 1, run: (x) => (x * 180) / Math.PI }],
  ["sqrt", { arity: 1, run: Math.sqrt }],
  ["cbrt", { arity: 1, run: Math.cbrt }],
  ["exp", { arity: 1, run: Math.exp }],
  ["ln", { arity: 1, run: Math.log }],
  ["log10", { arity: 1, run: Math.log10 }],
  ["log2", { arity: 1, run: Math.log2 }],
  // log(x) = base 10, log(x, b) = base b
  [
    "log",
    { arity: [1, 2], run: (x, b) => (b === undefined ? Math.log10(x) : Math.log(x) / Math.log(b)) },
  ],
  ["abs", { arity: 1, run: Math.abs }],
  ["sign", { arity: 1, run: Math.sign }],
  ["floor", { arity: 1, run: Math.floor }],
  ["ceil", { arity: 1, run: Math.ceil }],
  ["round", { arity: 1, run: Math.round }],
  ["min", { arity: 2, run: Math.min }],
  ["max", { arity: 2, run: Math.max }],
  ["pow", { arity: 2, run: Math.pow }],
  ["hypot", { arity: 2, run: Math.hypot }],
  ["factorial", { arity: 1, run: factorial }],
  ["nCr", { arity: 2, run: nCr }],
  ["nPr", { arity: 2, run: nPr }],
]);

export const FUNCTION_NAMES = Array.from(FUNCTIONS.keys());

// ── tokenizer ────────────────────────────────────────────────────────────────

type Tok =
  | { t: "num"; v: number }
  | { t: "id"; v: string }
  | { t: "op"; v: "+" | "-" | "*" | "/" | "^" | "(" | ")" | "," };

function normalise(src: string): string {
  return src
    .replace(/[−–—]/g, "-")
    .replace(/[×·⋅∙]/g, "*")
    .replace(/÷/g, "/")
    .replace(/π/g, " pi ")
    .replace(/√\s*\(/g, "sqrt(")
    .replace(/√\s*(\d+\.?\d*|[A-Za-z_]\w*)/g, "sqrt($1)")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/\*\*/g, "^");
}

function tokenize(src: string): Tok[] {
  const s = normalise(src);
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    const num = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(s.slice(i));
    if (num) {
      out.push({ t: "num", v: Number(num[0]) });
      i += num[0].length;
      continue;
    }
    const id = /^[A-Za-z_][A-Za-z0-9_]*/.exec(s.slice(i));
    if (id) {
      out.push({ t: "id", v: id[0] });
      i += id[0].length;
      continue;
    }
    if ("+-*/^(),".includes(ch)) {
      out.push({ t: "op", v: ch as Extract<Tok, { t: "op" }>["v"] });
      i++;
      continue;
    }
    throw new Error(`unexpected character "${ch}"`);
  }
  return out;
}

// ── parser / evaluator (recursive descent, evaluates as it parses) ───────────

class Parser {
  private p = 0;
  private depth = 0;
  constructor(
    private toks: Tok[],
    private vars: ReadonlyMap<string, number>,
  ) {}

  parse(): number {
    const v = this.expr();
    if (this.p < this.toks.length) throw new Error("unexpected trailing input");
    return v;
  }

  private peek(): Tok | undefined {
    return this.toks[this.p];
  }
  private isOp(v: string): boolean {
    const k = this.peek();
    return !!k && k.t === "op" && k.v === v;
  }
  private enter() {
    if (++this.depth > MAX_DEPTH) throw new Error("expression nested too deeply");
  }
  private leave() {
    this.depth--;
  }

  private expr(): number {
    this.enter();
    let v = this.term();
    while (this.isOp("+") || this.isOp("-")) {
      const op = (this.toks[this.p++] as { v: string }).v;
      const r = this.term();
      v = op === "+" ? v + r : v - r;
    }
    this.leave();
    return v;
  }

  private startsOperand(): boolean {
    const k = this.peek();
    if (!k) return false;
    return k.t === "num" || k.t === "id" || (k.t === "op" && k.v === "(");
  }

  private term(): number {
    let v = this.unary();
    for (;;) {
      if (this.isOp("*") || this.isOp("/")) {
        const op = (this.toks[this.p++] as { v: string }).v;
        const r = this.unary();
        v = op === "*" ? v * r : v / r;
      } else if (this.startsOperand()) {
        v = v * this.unary(); // implicit multiplication: 2x, 3(x+1), x sin(x)
      } else break;
    }
    return v;
  }

  private unary(): number {
    if (this.isOp("-")) {
      this.p++;
      return -this.unary();
    }
    if (this.isOp("+")) {
      this.p++;
      return this.unary();
    }
    return this.power();
  }

  private power(): number {
    const base = this.primary();
    if (this.isOp("^")) {
      this.p++;
      const exp = this.unary(); // right-assoc and allows 2^-3
      return Math.pow(base, exp);
    }
    return base;
  }

  private primary(): number {
    const k = this.toks[this.p++];
    if (!k) throw new Error("unexpected end of expression");
    if (k.t === "num") return k.v;
    if (k.t === "op" && k.v === "(") {
      const v = this.expr();
      if (!this.isOp(")")) throw new Error('missing ")"');
      this.p++;
      return v;
    }
    if (k.t === "id") {
      const fn = FUNCTIONS.get(k.v);
      if (fn && this.isOp("(")) {
        this.p++;
        const args: number[] = [];
        if (!this.isOp(")")) {
          for (;;) {
            args.push(this.expr());
            if (this.isOp(",")) {
              this.p++;
              continue;
            }
            break;
          }
        }
        if (!this.isOp(")")) throw new Error(`missing ")" after ${k.v}(`);
        this.p++;
        const [lo, hi] = Array.isArray(fn.arity) ? fn.arity : [fn.arity, fn.arity];
        if (args.length < lo || args.length > hi)
          throw new Error(`${k.v}() takes ${lo === hi ? lo : `${lo}-${hi}`} argument(s)`);
        return fn.run(...args);
      }
      if (this.vars.has(k.v)) return this.vars.get(k.v)!;
      if (Object.prototype.hasOwnProperty.call(CONSTANTS, k.v)) return CONSTANTS[k.v];
      if (fn) throw new Error(`${k.v} is a function — write ${k.v}(...)`);
      throw new Error(`unknown name "${k.v}"`);
    }
    throw new Error(`unexpected "${(k as { v: string }).v}"`);
  }
}

/** Evaluates a numeric expression. Throws a short, human-readable Error on bad input. */
export function evaluate(expr: string, vars: Vars = {}): number {
  if (typeof expr !== "string" || !expr.trim()) throw new Error("empty expression");
  if (expr.length > MAX_EXPR_LEN) throw new Error("expression too long");
  const map = new Map<string, number>();
  for (const [k, v] of Object.entries(vars))
    if (typeof v === "number" && Number.isFinite(v)) map.set(k, v);
  const out = new Parser(tokenize(expr), map).parse();
  if (!Number.isFinite(out)) throw new Error("result is not a finite number");
  return out;
}

/** Like evaluate() but returns null instead of throwing. */
export function tryEvaluate(expr: string, vars: Vars = {}): number | null {
  try {
    return evaluate(expr, vars);
  } catch {
    return null;
  }
}

/** Free names an expression uses that are not functions or constants (i.e. its variables). */
export function freeVariables(expr: string): string[] {
  const seen = new Set<string>();
  try {
    const toks = tokenize(expr);
    toks.forEach((tk, i) => {
      if (tk.t !== "id") return;
      const next = toks[i + 1];
      const isCall = FUNCTIONS.has(tk.v) && next?.t === "op" && next.v === "(";
      if (isCall || Object.prototype.hasOwnProperty.call(CONSTANTS, tk.v)) return;
      seen.add(tk.v);
    });
  } catch {
    /* unparseable: no variables */
  }
  return Array.from(seen);
}

// ── numeric helpers ──────────────────────────────────────────────────────────

export function closeTo(a: number, b: number, relTol = 5e-3, absTol = 1e-9): boolean {
  return Math.abs(a - b) <= Math.max(absTol, relTol * Math.max(Math.abs(a), Math.abs(b)));
}

/** Compare two numbers lists ignoring order (e.g. the roots of a quadratic). */
export function sameNumberSet(a: number[], b: number[], relTol = 1e-3): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.every((x, i) => closeTo(x, sb[i], relTol, 1e-9));
}

/** Deterministic PRNG (mulberry32) so verification is reproducible. */
function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleVars(
  names: string[],
  ranges: Record<string, [number, number]> | undefined,
  n: number,
): Vars[] {
  const rand = rng(1234567);
  const out: Vars[] = [];
  for (let i = 0; i < n; i++) {
    const v: Vars = {};
    for (const name of names) {
      const [lo, hi] = ranges?.[name] ?? [0.3, 2.7]; // positive default keeps sqrt/ln/powers defined
      v[name] = lo + (hi - lo) * rand();
    }
    out.push(v);
  }
  return out;
}

/**
 * Do two expressions agree at several random points? Points where either side
 * is undefined (domain errors) are skipped; at least 3 valid points are needed.
 */
export function equivalentAtRandomPoints(
  a: string,
  b: string,
  opts: {
    vars?: Record<string, [number, number]>;
    allowConstantOffset?: boolean;
    extra?: Vars;
  } = {},
): { ok: boolean; detail: string } {
  const names = Array.from(new Set([...freeVariables(a), ...freeVariables(b)])).filter(
    (n) => !(opts.extra && n in opts.extra),
  );
  const pts = sampleVars(names, opts.vars, 14);
  let valid = 0;
  let offset: number | null = null;
  for (const p of pts) {
    const scope = { ...(opts.extra ?? {}), ...p };
    const va = tryEvaluate(a, scope);
    const vb = tryEvaluate(b, scope);
    if (va === null || vb === null) continue;
    valid++;
    if (opts.allowConstantOffset) {
      const d = va - vb;
      if (offset === null) offset = d;
      else if (!closeTo(d, offset, 1e-6, 1e-7 * (1 + Math.abs(va)))) {
        return {
          ok: false,
          detail: `they differ by a non-constant amount (e.g. at ${fmtVars(p)})`,
        };
      }
    } else if (!closeTo(va, vb, 1e-6, 1e-9)) {
      return { ok: false, detail: `they disagree at ${fmtVars(p)}: ${fmt(va)} vs ${fmt(vb)}` };
    }
  }
  if (valid < 3)
    return { ok: false, detail: "couldn't evaluate both sides at enough sample points" };
  return { ok: true, detail: `matched at ${valid} sample points` };
}

function fmtVars(v: Vars): string {
  return (
    Object.entries(v)
      .map(([k, x]) => `${k}=${fmt(x)}`)
      .join(", ") || "the given values"
  );
}

/** Compact number formatting for messages and answers (4 significant figures). */
export function fmt(n: number, sig = 4): string {
  if (!Number.isFinite(n)) return String(n);
  if (n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e6 || abs < 1e-3) {
    const [m, e] = n.toExponential(sig - 1).split("e");
    const mant = m.replace(/\.?0+$/, "");
    return `${mant}×10^${Number(e)}`;
  }
  return String(Number(n.toPrecision(sig)));
}

/** Central-difference derivative; step scales with |x| for accuracy. */
function numericDerivative(f: (x: number) => number, x: number): number {
  const h = 1e-5 * Math.max(1, Math.abs(x));
  return (f(x + h) - f(x - h)) / (2 * h);
}

/** Composite Simpson's rule (n even). */
function simpson(f: (x: number) => number, a: number, b: number, n = 2000): number {
  if (a === b) return 0;
  const h = (b - a) / n;
  let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2);
  return (s * h) / 3;
}

// ── claims: things a solver asserts that the tool can check ──────────────────

export type Claim =
  | { type: "value"; label: string; expr: string; equals: number; tol?: number }
  | {
      type: "identity";
      label: string;
      lhs: string;
      rhs: string;
      ranges?: Record<string, [number, number]>;
    }
  | { type: "derivative"; label: string; f: string; df: string; variable?: string }
  | {
      type: "integral";
      label: string;
      f: string;
      a: number;
      b: number;
      equals: number;
      variable?: string;
      tol?: number;
    }
  | { type: "root"; label: string; f: string; at: number; variable?: string };

export type ClaimResult = { label: string; type: Claim["type"]; ok: boolean; detail: string };

/** Machine-checks one claim. Never throws — a claim the tool can't evaluate counts as failed. */
export function verifyClaim(claim: Claim, givens: Vars = {}): ClaimResult {
  const base = { label: claim.label, type: claim.type };
  try {
    switch (claim.type) {
      case "value": {
        const got = evaluate(claim.expr, givens);
        const ok = closeTo(got, claim.equals, claim.tol ?? 5e-3);
        return {
          ...base,
          ok,
          detail: ok
            ? `${claim.expr} = ${fmt(got)} ✓`
            : `${claim.expr} actually evaluates to ${fmt(got)}, not ${fmt(claim.equals)}`,
        };
      }
      case "identity": {
        const r = equivalentAtRandomPoints(claim.lhs, claim.rhs, {
          vars: claim.ranges,
          extra: givens,
        });
        return { ...base, ok: r.ok, detail: r.ok ? `both sides ${r.detail}` : r.detail };
      }
      case "derivative": {
        const v = claim.variable || freeVariables(claim.f)[0] || "x";
        const others = { ...givens };
        const pts = sampleVars([v], undefined, 8);
        let valid = 0;
        for (const p of pts) {
          const x = p[v];
          const f = (t: number) => evaluate(claim.f, { ...others, [v]: t });
          let num: number, sym: number;
          try {
            num = numericDerivative(f, x);
            sym = evaluate(claim.df, { ...others, [v]: x });
          } catch {
            continue;
          }
          valid++;
          if (!closeTo(num, sym, 1e-4, 1e-6)) {
            return {
              ...base,
              ok: false,
              detail: `at ${v}=${fmt(x)} the true slope is ${fmt(num)} but the claimed derivative gives ${fmt(sym)}`,
            };
          }
        }
        if (valid < 3)
          return {
            ...base,
            ok: false,
            detail: "couldn't evaluate the derivative at enough points",
          };
        return { ...base, ok: true, detail: `d/d${v} matched numerically at ${valid} points` };
      }
      case "integral": {
        const v = claim.variable || freeVariables(claim.f)[0] || "x";
        const got = simpson((t) => evaluate(claim.f, { ...givens, [v]: t }), claim.a, claim.b);
        const ok = closeTo(got, claim.equals, claim.tol ?? 1e-3, 1e-7);
        return {
          ...base,
          ok,
          detail: ok
            ? `numeric integral = ${fmt(got)} ✓`
            : `numeric integration gives ${fmt(got)}, not ${fmt(claim.equals)}`,
        };
      }
      case "root": {
        const v = claim.variable || freeVariables(claim.f)[0] || "x";
        const at = evaluate(claim.f, { ...givens, [v]: claim.at });
        const scale = Math.max(
          1,
          Math.abs(evaluate(claim.f, { ...givens, [v]: claim.at + 1 })),
          Math.abs(claim.at),
        );
        const ok = Math.abs(at) <= 1e-6 * scale;
        return {
          ...base,
          ok,
          detail: ok
            ? `f(${fmt(claim.at)}) ≈ 0 ✓`
            : `f(${fmt(claim.at)}) = ${fmt(at)} (should be 0)`,
        };
      }
    }
  } catch (e) {
    return { ...base, ok: false, detail: `couldn't evaluate: ${(e as Error).message}` };
  }
}
