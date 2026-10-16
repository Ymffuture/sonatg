// src/lib/stem/detect.ts
//
// Decides whether a chat message should be handed to the math/physics agents.
// Pure regex, no network, no LLM call — it runs on every Sona AI message, so it
// must be cheap and must NOT fire on ordinary chat ("this force of habit…").
//
// Escape hatches the user controls:
//   "/quick <question>"  -> never use the agents for this message
//   "/solve <question>"  -> always use the agents for this message

import type { StemSubject } from "./types";

export type StemIntent = {
  subject: StemSubject;
  /** The prompt with any /solve prefix removed. */
  prompt: string;
  forced: boolean;
};

const MATH_WORDS = new RegExp(
  "\\b(" +
    [
      "solve",
      "simplify",
      "factori[sz]e",
      "expand",
      "integrate",
      "integral",
      "differentiate",
      "derivative",
      "antiderivative",
      "limit of",
      "prove",
      "proof",
      "theorem",
      "equation",
      "inequality",
      "polynomial",
      "quadratic",
      "cubic",
      "matrix",
      "matrices",
      "determinant",
      "eigen\\w*",
      "probability",
      "permutation",
      "combination",
      "logarithm",
      "trigonometr\\w*",
      "sin|cos|tan|sec|csc|cot",
      "arithmetic sequence",
      "geometric sequence",
      "series",
      "converge\\w*",
      "modulo",
      "mod \\d+",
      "prime",
      "gcd",
      "lcm",
      "vector",
      "dot product",
      "cross product",
      "slope",
      "gradient",
      "tangent line",
      "area under",
      "standard deviation",
      "variance",
      "binomial",
      "permutations",
      "factorial",
      "complex number",
      "roots? of",
      "sum of the first",
      "perimeter",
      "hypotenuse",
      "pythag\\w*",
      "calculus",
      "algebra",
      "geometry",
      "domain and range",
    ].join("|") +
    ")\\b",
  "i",
);

const PHYSICS_WORDS = new RegExp(
  "\\b(" +
    [
      "velocity",
      "speed",
      "acceleration",
      "decelerat\\w*",
      "force",
      "newtons?",
      "momentum",
      "impulse",
      "torque",
      "kinetic",
      "potential energy",
      "work done",
      "power",
      "friction",
      "projectile",
      "trajectory",
      "pendulum",
      "spring constant",
      "oscillat\\w*",
      "wavelength",
      "frequency",
      "refraction",
      "refractive",
      "lens",
      "focal",
      "mirror",
      "voltage",
      "current",
      "resistance",
      "resistor",
      "capacitor",
      "capacitance",
      "inductor",
      "circuit",
      "ohm",
      "magnetic",
      "electric field",
      "charge",
      "coulomb",
      "gravity",
      "gravitational",
      "orbit\\w*",
      "escape velocity",
      "pressure",
      "buoyan\\w*",
      "density",
      "specific heat",
      "thermodynamic\\w*",
      "entropy",
      "ideal gas",
      "photon",
      "quantum",
      "relativity",
      "half-life",
      "radioactive",
      "decay",
      "doppler",
      "collision",
      "free fall",
      "centripetal",
      "angular",
      "moment of inertia",
      "joules?",
      "watts?",
      "kilograms?",
      "m/s",
      "km/h",
      "kinematics",
      "dynamics",
      "thermal",
      "heat capacity",
      "latent heat",
      "emf",
      "wave speed",
      "standing wave",
      "interference",
      "diffraction",
    ].join("|") +
    ")\\b",
  "i",
);

/** Words that turn a topic mention into an actual "do the work" request. */
const WORK_VERBS =
  /\b(calculate|compute|find|determine|work out|evaluate|solve|derive|show that|prove|how (?:far|fast|long|high|much|many|hot|cold|heavy|strong)|what(?:'s| is| are) the (?:value|magnitude|speed|velocity|acceleration|force|energy|power|current|voltage|resistance|time|distance|height|range|period|frequency|wavelength|mass|pressure|area|volume|probability|derivative|integral|limit|sum|product|roots?|solutions?|answer))\b/i;

/** Symbols that only really appear in quantitative problems. */
const SYMBOLIC =
  /(∫|√|∑|π|\bd\/d[a-z]\b|\b[a-z]\s*\^\s*[\d(]|[a-z]\s*[²³]|\d\s*[a-z]\s*[+\-=]|\b(?:sin|cos|tan|ln|log)\s*\()/i;

const HAS_NUMBER = /\d/;
// Pure arithmetic like "12*7=?" — the normal reply handles those fine.
const PURE_ARITHMETIC = /^[\s\d+\-*/().^%,=?×÷xX]{1,40}$/;

const CONCEPTUAL_ONLY = /^\s*(what is|what's|who|why|explain|tell me about|define)\b[^\d=]*$/i;

export function detectStemIntent(rawPrompt: string): StemIntent | null {
  const original = String(rawPrompt ?? "");
  let prompt = original.trim();
  if (prompt.length < 6) return null;

  if (/^\/quick\b/i.test(prompt)) return null;
  const forced = /^\/solve\b/i.test(prompt);
  if (forced) prompt = prompt.replace(/^\/solve\b\s*/i, "").trim();
  if (!prompt) return null;

  const math = MATH_WORDS.test(prompt);
  const physics = PHYSICS_WORDS.test(prompt);
  const symbolic =
    SYMBOLIC.test(prompt) || (/=/.test(prompt) && /[a-z]/i.test(prompt) && HAS_NUMBER.test(prompt));
  const quantitative = HAS_NUMBER.test(prompt) || symbolic;
  const verb = WORK_VERBS.test(prompt);

  const subject: StemSubject = math && physics ? "both" : physics ? "physics" : "math";

  if (forced) return { subject, prompt, forced: true };
  if (PURE_ARITHMETIC.test(prompt)) return null;

  let run = false;
  if (math) run = quantitative || verb;
  if (!run && physics)
    run = (quantitative && verb) || (quantitative && countMatches(PHYSICS_WORDS, prompt) >= 2);
  // A bare equation / derivative / integral with no topic words at all.
  if (
    !run &&
    symbolic &&
    /\b(solve|simplify|integrate|differentiate|find|evaluate|prove|factor|expand)\b/i.test(prompt)
  )
    run = true;

  // Pure "what is entropy?" style questions have no numbers to crunch.
  if (run && !quantitative && CONCEPTUAL_ONLY.test(prompt)) run = false;

  return run ? { subject, prompt, forced: false } : null;
}

function countMatches(re: RegExp, text: string): number {
  const g = new RegExp(re.source, "gi");
  return (text.match(g) ?? []).length;
}
