// src/lib/studyTools.ts
//
// Isomorphic (no env vars, no network) helpers for Sona AI's study tools:
//   • "quiz me on these notes"          -> interactive multiple-choice quiz
//   • "make flashcards from this"       -> flip cards
//   • "explain it like I'm 12" / ELI5   -> a simple-language explanation style
//
// Same trust model as src/lib/aiActions.ts: the model is only told about these
// tools when the USER's own message asked for one, its output is validated
// against strict limits, and the result is stored server-side and referenced
// from the chat message by id ([[sona-study:<uuid>]]) — the message body never
// carries the JSON.
//
// Prompt-based (not native tool-calling) so it works on every model in
// aiModels.ts, including the free ones.

export type QuizQuestion = {
  q: string;
  options: string[];
  /** Index into `options` of the single correct answer. */
  answer: number;
  explain?: string;
};
export type Flashcard = { front: string; back: string };

export type StudySet =
  | { kind: "quiz"; title: string; questions: QuizQuestion[] }
  | { kind: "flashcards"; title: string; cards: Flashcard[] };

export type StudyKind = StudySet["kind"];

export const STUDY_LIMITS = {
  title: 80,
  question: 240,
  option: 140,
  explain: 240,
  minOptions: 2,
  maxOptions: 5,
  maxQuestions: 10,
  defaultQuestions: 5,
  front: 200,
  back: 400,
  maxCards: 20,
  defaultCards: 10,
  /** Notes can be pasted into the message; plain chat stays capped lower. */
  maxPromptChars: 12_000,
  plainPromptChars: 4_000,
} as const;

// ── intent detection ─────────────────────────────────────────────────────────

export type StudyIntents = {
  quiz: boolean;
  flashcards: boolean;
  /** Age to explain to ("like I'm 12" -> 12), or null when no simple-explanation request. */
  eli: number | null;
};

const WORD_AGES: Record<string, number> = {
  five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
};

function clampAge(n: number): number {
  return Math.min(17, Math.max(5, Math.round(n)));
}

function parseAge(raw: string | undefined): number | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  const n = /^\d+$/.test(s) ? Number(s) : WORD_AGES[s];
  return Number.isFinite(n) ? clampAge(n as number) : null;
}

/**
 * Users put the request at the start ("quiz me on this: <notes…>") or the end
 * ("<notes…> — make flashcards"). Looking only at those edges means a pasted
 * note that merely CONTAINS the word "quiz" or "in simple terms" can't trigger a tool.
 */
function edges(text: string, n = 400): string {
  return text.length <= n * 2 ? text : `${text.slice(0, n)}\n${text.slice(-n)}`;
}

const MAKE_VERB =
  "(?:make|create|generate|give|write|build|prepare|draft|set up|come up with|put together|turn|convert|do|run|need|want)";

export function detectStudyIntents(prompt: string): StudyIntents {
  const p = edges(prompt ?? "");

  // A request to CREATE one — not just a mention ("I have a quiz tomorrow").
  const quiz =
    /\bquiz me\b|\btest me\b|\btest my knowledge\b/i.test(p) ||
    new RegExp(`\\b${MAKE_VERB}\\b[^.?!\\n]{0,40}\\b(?:quiz(?:zes)?|mcqs?|multiple[\\s-]choice|practice (?:questions?|tests?|exams?))\\b`, "i").test(p) ||
    /\b(?:quiz(?:zes)?|mcqs?|practice (?:questions?|tests?))\s+(?:on|about|from|for|covering)\b/i.test(p);

  const flashcards =
    new RegExp(`\\b${MAKE_VERB}\\b[^.?!\\n]{0,40}\\b(?:flash[\\s-]?cards?|study cards?|revision cards?)\\b`, "i").test(p) ||
    /\b(?:flash[\s-]?cards?|study cards?|revision cards?)\s+(?:on|about|from|for|of|covering)\b/i.test(p) ||
    /\binto\s+(?:some\s+)?(?:flash[\s-]?cards?|study cards?)\b/i.test(p);

  let eli: number | null = null;
  // "explain ... like/as if I'm 12", "ELI12", "ELI5"
  const withAge = p.match(
    /\b(?:like|as if|as though)\s+(?:i(?:'|’)?m|i am|im|i were|i was)\s+(?:a\s+|an\s+)?(\d{1,2}|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen)\b/i,
  );
  const eliCode = p.match(/\beli[\s-]?(\d{1,2})\b/i);
  if (withAge) eli = parseAge(withAge[1]);
  else if (eliCode) eli = parseAge(eliCode[1]);
  else if (/\bexplain\b[^.?!\n]{0,60}\b(?:like|as if)\s+(?:i(?:'|’)?m|i am|im)\s+(?:a\s+|an\s+)?(?:kid|child|beginner|newbie|noob)\b/i.test(p)) eli = 11;
  else if (/\b(?:explain (?:it |this |that )?(?:simply|in simple (?:words|terms)|in plain (?:english|words|language))|(?:eli5)|dumb (?:it|this) down|in (?:simple|plain) (?:words|terms|english|language))\b/i.test(p)) eli = 12;

  return { quiz, flashcards, eli };
}

export const wantsStudySet = (i: StudyIntents) => i.quiz || i.flashcards;

// ── prompt fragments ─────────────────────────────────────────────────────────

export function studyInstructions(i: StudyIntents): string {
  let out = "";

  if (i.eli !== null) {
    out +=
      `\n\n[SIMPLE EXPLANATION MODE] The user wants a plain-language explanation, pitched at a ${i.eli}-year-old. ` +
      `Open with the core idea in ONE plain sentence. Then explain with a single concrete everyday analogy (food, sports, games, ` +
      `school, phones…). Use short sentences and common words; define any technical term the first time it appears; avoid jargon ` +
      `and formulas unless unavoidable (then explain them). Aim for under ~180 words unless asked for more, and end with a line ` +
      `starting "In one sentence:". Be warm, never condescending or babyish. If they pasted notes, explain what's in the notes — ` +
      `don't add unrelated facts. If you're not sure of a fact, say so instead of guessing.`;
  }

  if (wantsStudySet(i)) {
    const specs: string[] = [];
    if (i.quiz)
      specs.push(
        `Quiz: {"kind":"quiz","title":string(<=${STUDY_LIMITS.title}),"questions":[{"q":string(<=${STUDY_LIMITS.question}),` +
          `"options":[${STUDY_LIMITS.minOptions}-${STUDY_LIMITS.maxOptions} strings, each <=${STUDY_LIMITS.option}],` +
          `"answer":number (0-based index of the ONE correct option),"explain":string(<=${STUDY_LIMITS.explain}, one sentence on WHY it is right)}]} ` +
          `with 1-${STUDY_LIMITS.maxQuestions} questions (default ${STUDY_LIMITS.defaultQuestions}; use the number the user asks for). ` +
          `Plausible wrong options, never "all/none of the above".`,
      );
    if (i.flashcards)
      specs.push(
        `Flashcards: {"kind":"flashcards","title":string(<=${STUDY_LIMITS.title}),"cards":[{"front":string(<=${STUDY_LIMITS.front}, a term or question),` +
          `"back":string(<=${STUDY_LIMITS.back}, the concise answer)}]} with 1-${STUDY_LIMITS.maxCards} cards ` +
          `(default ${STUDY_LIMITS.defaultCards}; use the number the user asks for).`,
      );
    out +=
      `\n\n[STUDY TOOLS] The user may be asking you to turn study material into practice. If — and only if — they clearly ask you to ` +
      `CREATE a quiz or flashcards, base it ONLY on the notes/material they gave you (in their message or the recent chat) and do not ` +
      `add outside facts. Then finish your reply with EXACTLY ONE final line, JSON on a single line, in this exact format:\n` +
      `[[sona-study:{...}]]\n` +
      `Formats:\n- ${specs.join("\n- ")}\n` +
      `Rules: before that line write only ONE or TWO short sentences (what you made and how to use it); do not repeat the questions or ` +
      `cards in text; the app turns the line into an interactive card. If the material is too thin or isn't study content, say so and ` +
      `emit no line. Never put the JSON in a code block or anywhere else.`;
  }

  return out;
}

// ── parsing ──────────────────────────────────────────────────────────────────

const MARKER = "[[sona-study:";

/** Balanced-brace scan (string/escape aware) — more reliable than a lazy regex for long JSON. */
function scanJsonObject(text: string, from: number): { json: string; end: number } | null {
  const start = text.indexOf("{", from);
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return { json: text.slice(start, i + 1), end: i + 1 };
    }
  }
  return null; // unbalanced: the reply was cut off mid-JSON
}

function cleanStr(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  // eslint-disable-next-line no-control-regex
  return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/[ \t]+/g, " ").trim().slice(0, max);
}

function shuffled<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function validateStudySet(
  raw: unknown,
  opts: { allow: StudyKind[]; shuffleOptions?: boolean; rng?: () => number },
): StudySet | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const rng = opts.rng ?? Math.random;

  if (r.kind === "quiz" && opts.allow.includes("quiz")) {
    if (!Array.isArray(r.questions)) return null;
    const questions: QuizQuestion[] = [];
    for (const item of r.questions) {
      if (!item || typeof item !== "object") continue;
      const it = item as Record<string, unknown>;
      const q = cleanStr(it.q, STUDY_LIMITS.question);
      if (!q || !Array.isArray(it.options)) continue;
      const answerIdx = typeof it.answer === "number" && Number.isInteger(it.answer) ? it.answer : -1;

      // Clean + de-duplicate options, tracking where the correct one lands.
      const seen = new Set<string>();
      let options: string[] = [];
      let correct = -1;
      it.options.forEach((o, origIdx) => {
        const label = cleanStr(o, STUDY_LIMITS.option);
        const key = label.toLowerCase();
        if (!label || seen.has(key) || options.length >= STUDY_LIMITS.maxOptions) return;
        seen.add(key);
        if (origIdx === answerIdx) correct = options.length;
        options.push(label);
      });
      if (options.length < STUDY_LIMITS.minOptions || correct < 0) continue;

      if (opts.shuffleOptions) {
        // Models love putting the right answer first; remove that tell.
        const order = shuffled(options.map((_, i) => i), rng);
        options = order.map((i) => options[i]);
        correct = order.indexOf(correct);
      }
      const explain = cleanStr(it.explain, STUDY_LIMITS.explain);
      questions.push({ q, options, answer: correct, ...(explain ? { explain } : {}) });
      if (questions.length >= STUDY_LIMITS.maxQuestions) break;
    }
    if (!questions.length) return null;
    return { kind: "quiz", title: cleanStr(r.title, STUDY_LIMITS.title) || "Quiz", questions };
  }

  if (r.kind === "flashcards" && opts.allow.includes("flashcards")) {
    if (!Array.isArray(r.cards)) return null;
    const seen = new Set<string>();
    const cards: Flashcard[] = [];
    for (const item of r.cards) {
      if (!item || typeof item !== "object") continue;
      const it = item as Record<string, unknown>;
      const front = cleanStr(it.front, STUDY_LIMITS.front);
      const back = cleanStr(it.back, STUDY_LIMITS.back);
      const key = front.toLowerCase();
      if (!front || !back || seen.has(key)) continue;
      seen.add(key);
      cards.push({ front, back });
      if (cards.length >= STUDY_LIMITS.maxCards) break;
    }
    if (!cards.length) return null;
    return { kind: "flashcards", title: cleanStr(r.title, STUDY_LIMITS.title) || "Flashcards", cards };
  }

  return null;
}

export type ExtractedStudy = {
  /** Reply text with the study line removed. */
  text: string;
  set: StudySet | null;
  /** The model tried to emit a set (or one was cut off) but it was invalid/not allowed. */
  rejected: boolean;
};

export function extractStudySet(
  reply: string,
  opts: { allow: StudyKind[]; shuffleOptions?: boolean; rng?: () => number },
): ExtractedStudy {
  const at = reply.indexOf(MARKER);

  if (at >= 0) {
    const scanned = scanJsonObject(reply, at + MARKER.length);
    if (!scanned) {
      // Cut off mid-JSON: drop everything from the marker on.
      return { text: reply.slice(0, at).trimEnd(), set: null, rejected: true };
    }
    let tailStart = scanned.end;
    const close = reply.slice(tailStart).match(/^\s*\]\]/);
    if (close) tailStart += close[0].length;
    const text = (reply.slice(0, at) + reply.slice(tailStart)).trim();
    let set: StudySet | null = null;
    try {
      set = validateStudySet(JSON.parse(scanned.json), opts);
    } catch { /* invalid JSON */ }
    return { text, set, rejected: !set };
  }

  // Fallback: a model that ignored the format and replied with ONLY a JSON object.
  const bare = reply.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  if (bare.startsWith("{") && bare.endsWith("}")) {
    try {
      const set = validateStudySet(JSON.parse(bare), opts);
      if (set) return { text: "", set, rejected: false };
    } catch { /* not JSON after all */ }
  }
  return { text: reply, set: null, rejected: false };
}

export function defaultStudyText(set: StudySet): string {
  return set.kind === "quiz"
    ? `Here's a ${set.questions.length}-question quiz — tap Start whenever you're ready.`
    : `Here are ${set.cards.length} flashcards — tap Study to flip through them.`;
}
