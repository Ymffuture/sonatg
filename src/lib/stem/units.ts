// src/lib/stem/units.ts
//
// Isomorphic dimensional analysis. The planner says what KIND of quantity the
// answer must be ("m/s", "J", "N*m"); the solver reports its final unit; we
// compare their SI dimensions. A final answer in Joules to a "find the force"
// question is caught here without any LLM involved.
//
//   dimensionOf("kg*m/s^2")  -> [1,1,-2,0,0,0,0]   (same as "N")
//   sameDimension("N", "kg m s^-2")  -> true
//   sameDimension("J", "N")          -> false
//   sameDimension("m/s", "flurbs")   -> null        (unknown unit: can't judge)

// exponents of [m, kg, s, A, K, mol, cd]
export type Dim = [number, number, number, number, number, number, number];

type U = { dim: Dim; f: number }; // dimension + factor to the SI coherent unit

const D = (m = 0, kg = 0, s = 0, A = 0, K = 0, mol = 0, cd = 0): Dim => [m, kg, s, A, K, mol, cd];
const u = (dim: Dim, f = 1): U => ({ dim, f });

const BASE: Record<string, U> = {
  m: u(D(1)),
  g: u(D(0, 1), 1e-3), // the SI base unit is the kilogram
  s: u(D(0, 0, 1)),
  A: u(D(0, 0, 0, 1)),
  K: u(D(0, 0, 0, 0, 1)),
  mol: u(D(0, 0, 0, 0, 0, 1)),
  cd: u(D(0, 0, 0, 0, 0, 0, 1)),
};

const DERIVED: Record<string, U> = {
  N: u(D(1, 1, -2)),
  Pa: u(D(-1, 1, -2)),
  J: u(D(2, 1, -2)),
  W: u(D(2, 1, -3)),
  Hz: u(D(0, 0, -1)),
  C: u(D(0, 0, 1, 1)),
  V: u(D(2, 1, -3, -1)),
  ohm: u(D(2, 1, -3, -2)),
  Ω: u(D(2, 1, -3, -2)),
  F: u(D(-2, -1, 4, 2)),
  T: u(D(0, 1, -2, -1)),
  H: u(D(2, 1, -2, -2)),
  Wb: u(D(2, 1, -2, -1)),
  S: u(D(-2, -1, 3, 2)),
  L: u(D(3), 1e-3),
  l: u(D(3), 1e-3),
  eV: u(D(2, 1, -2), 1.602176634e-19),
  cal: u(D(2, 1, -2), 4.184),
  bar: u(D(-1, 1, -2), 1e5),
  atm: u(D(-1, 1, -2), 101_325),
  u: u(D(0, 1), 1.6605390666e-27),
  amu: u(D(0, 1), 1.6605390666e-27),
  min: u(D(0, 0, 1), 60),
  h: u(D(0, 0, 1), 3600),
  hr: u(D(0, 0, 1), 3600),
  day: u(D(0, 0, 1), 86_400),
  yr: u(D(0, 0, 1), 3.15576e7),
  rad: u(D()),
  deg: u(D(), Math.PI / 180),
  "°": u(D(), Math.PI / 180),
  sr: u(D()),
  dimensionless: u(D()),
  Bq: u(D(0, 0, -1)),
  Gy: u(D(2, 0, -2)),
  Sv: u(D(2, 0, -2)),
  lm: u(D(0, 0, 0, 0, 0, 0, 1)),
  lx: u(D(-2, 0, 0, 0, 0, 0, 1)),
  rpm: u(D(0, 0, -1), (2 * Math.PI) / 60),
  mph: u(D(1, 0, -1), 0.44704),
  kph: u(D(1, 0, -1), 1 / 3.6),
};

// "m" is milli, "M" is mega — case matters. "da" (deca) is two letters.
const PREFIXES: Record<string, number> = {
  da: 1e1,
  Y: 1e24,
  Z: 1e21,
  E: 1e18,
  P: 1e15,
  T: 1e12,
  G: 1e9,
  M: 1e6,
  k: 1e3,
  h: 1e2,
  d: 1e-1,
  c: 1e-2,
  m: 1e-3,
  µ: 1e-6,
  μ: 1e-6,
  u: 1e-6,
  n: 1e-9,
  p: 1e-12,
  f: 1e-15,
};

const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

function lookupUnit(name: string): U | null {
  if (has(DERIVED, name)) return DERIVED[name];
  if (has(BASE, name)) return BASE[name];
  for (const [p, pf] of Object.entries(PREFIXES)) {
    if (name.length > p.length && name.startsWith(p)) {
      const rest = name.slice(p.length);
      const hit = has(DERIVED, rest) ? DERIVED[rest] : has(BASE, rest) ? BASE[rest] : null;
      if (hit) return u(hit.dim, hit.f * pf);
    }
  }
  return null;
}

const SUPERSCRIPTS: Record<string, string> = {
  "⁻": "-",
  "⁰": "0",
  "¹": "1",
  "²": "2",
  "³": "3",
  "⁴": "4",
  "⁵": "5",
  "⁶": "6",
  "⁷": "7",
  "⁸": "8",
  "⁹": "9",
};

function normaliseUnit(src: string): string {
  return src
    .replace(
      /[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+/g,
      (m) =>
        "^" +
        Array.from(m)
          .map((c) => SUPERSCRIPTS[c] ?? c)
          .join(""),
    )
    .replace(/[·⋅∙×]/g, "*")
    .replace(/\*\*/g, "^")
    .replace(/\s*\/\s*/g, "/")
    .trim();
}

const mul = (a: U, b: U, k = 1): U =>
  u(a.dim.map((x, i) => x + k * b.dim[i]) as Dim, a.f * Math.pow(b.f, k));

/** Parses a unit string to an SI dimension vector + scale factor. Returns null if any part is unknown. */
export function parseUnit(unit: string | null | undefined): U | null {
  if (unit === null || unit === undefined) return null;
  const src = normaliseUnit(String(unit));
  if (src === "" || src === "1") return u(D());
  if (src.length > 80) return null;
  const toks = src.match(/[A-Za-zµμΩ°]+|-?\d+(?:\.\d+)?|[*/^()]/g);
  if (!toks || toks.join("").length < src.replace(/\s+/g, "").length) return null;

  let p = 0;
  const peek = () => toks[p];

  // unit := term (('*' | '/' | implicit) term)*   term := atom ('^' number)?
  function parseAtom(): U | null {
    const t = toks![p++];
    if (t === undefined) return null;
    if (t === "(") {
      const inner = parseProduct();
      if (inner === null || toks![p++] !== ")") return null;
      return inner;
    }
    if (/^[A-Za-zµμΩ°]+$/.test(t)) return lookupUnit(t);
    if (t === "1") return u(D());
    return null;
  }
  function parseTerm(): U | null {
    const a = parseAtom();
    if (a === null) return null;
    if (peek() === "^") {
      p++;
      const e = Number(toks![p++]);
      if (!Number.isFinite(e)) return null;
      return u(a.dim.map((x) => x * e) as Dim, Math.pow(a.f, e));
    }
    return a;
  }
  function parseProduct(): U | null {
    let acc = parseTerm();
    if (acc === null) return null;
    for (;;) {
      const t = peek();
      if (t === "*") {
        p++;
        const r = parseTerm();
        if (r === null) return null;
        acc = mul(acc, r);
      } else if (t === "/") {
        p++;
        const r = parseTerm();
        if (r === null) return null;
        acc = mul(acc, r, -1);
      } else if (t !== undefined && t !== ")" && t !== "^" && !/^-?\d/.test(t)) {
        const r = parseTerm(); // implicit product: "kg m"
        if (r === null) return null;
        acc = mul(acc, r);
      } else break;
    }
    return acc;
  }

  const out = parseProduct();
  return out !== null && p === toks.length ? out : null;
}

export function dimensionOf(unit: string | null | undefined): Dim | null {
  return parseUnit(unit)?.dim ?? null;
}

/** Converts a value in `unit` to the coherent SI unit (km -> m, g -> kg, min -> s). Null if the unit is unknown. */
export function toSI(value: number, unit: string | null | undefined): number | null {
  const p = parseUnit(unit);
  return p ? value * p.f : null;
}

/** true / false when both units are understood, null when either is unknown (can't judge). */
export function sameDimension(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean | null {
  const da = dimensionOf(a);
  const db = dimensionOf(b);
  if (!da || !db) return null;
  return da.every((x, i) => Math.abs(x - db[i]) < 1e-9);
}

const SYMBOLS = ["m", "kg", "s", "A", "K", "mol", "cd"];

/** Human-readable SI form of a dimension, e.g. [1,1,-2,0,0,0,0] -> "kg·m·s^-2". */
export function describeDimension(unit: string): string | null {
  const d = dimensionOf(unit);
  if (!d) return null;
  const parts = d
    .map((e, i) => (e === 0 ? "" : e === 1 ? SYMBOLS[i] : `${SYMBOLS[i]}^${e}`))
    .filter(Boolean);
  return parts.length ? parts.join("·") : "dimensionless";
}
