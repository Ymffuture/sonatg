// src/components/StudyPlayer.tsx
//
// Interactive quiz + flashcard player, shown in a bottom sheet from StudySetCard.
// Everything runs locally on a validated StudySet — no network, nothing to save
// except the best quiz score (localStorage, best effort).

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, CheckCircle2, RotateCcw, Shuffle, X, XCircle } from "lucide-react";
import type { StudySet } from "@/lib/studyTools";

const OPTION_LABELS = ["A", "B", "C", "D", "E"];
const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-full bg-[var(--sona-accent,#E07A5F)] px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition active:scale-[0.98] disabled:opacity-50";
const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted active:scale-[0.98]";

export const bestScoreKey = (studyId: string) => `sona:study-best:${studyId}`;

function readBest(studyId: string): number | null {
  try {
    const v = localStorage.getItem(bestScoreKey(studyId));
    return v === null ? null : Number(v);
  } catch {
    return null;
  }
}
function writeBest(studyId: string, score: number) {
  try {
    const prev = readBest(studyId);
    if (prev === null || score > prev) localStorage.setItem(bestScoreKey(studyId), String(score));
  } catch { /* private mode etc. — not important */ }
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
function shuffle<T>(a: T[]): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <div
        className="h-full rounded-full bg-[var(--sona-accent,#E07A5F)] transition-[width] duration-300"
        style={{ width: `${max ? (value / max) * 100 : 0}%` }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Quiz
// ─────────────────────────────────────────────────────────────────────────────
function QuizPlayer({
  set,
  studyId,
  onClose,
}: {
  set: Extract<StudySet, { kind: "quiz" }>;
  studyId: string;
  onClose: () => void;
}) {
  const total = set.questions.length;
  const [order, setOrder] = useState<number[]>(() => range(total));
  const [pos, setPos] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correctMap, setCorrectMap] = useState<Record<number, boolean>>({});
  const [fullRound, setFullRound] = useState(true);

  const done = pos >= order.length;
  const qIndex = order[pos];
  const q = done ? null : set.questions[qIndex];
  const roundCorrect = order.filter((i) => correctMap[i]).length;
  const missed = order.filter((i) => correctMap[i] === false);

  const pick = useCallback(
    (i: number) => {
      if (picked !== null || !q) return;
      setPicked(i);
      setCorrectMap((m) => ({ ...m, [qIndex]: i === q.answer }));
    },
    [picked, q, qIndex],
  );

  const next = useCallback(() => {
    if (picked === null) return;
    setPicked(null);
    setPos((p) => p + 1);
  }, [picked]);

  // Save the best score once a FULL run finishes.
  useEffect(() => {
    if (done && fullRound) writeBest(studyId, roundCorrect);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  // Keyboard: 1-5 pick an answer, Enter / → continue.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[1-5]$/.test(e.key) && q && Number(e.key) <= q.options.length) pick(Number(e.key) - 1);
      else if ((e.key === "Enter" || e.key === "ArrowRight") && picked !== null) { e.preventDefault(); next(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [q, picked, pick, next]);

  const restart = (indices: number[], full: boolean) => {
    setCorrectMap((m) => {
      const copy = { ...m };
      for (const i of indices) delete copy[i];
      return full ? {} : copy;
    });
    setOrder(indices);
    setPos(0);
    setPicked(null);
    setFullRound(full);
  };

  if (done) {
    const best = readBest(studyId);
    const pct = Math.round((roundCorrect / order.length) * 100);
    return (
      <div className="space-y-4">
        <div className="rounded-2xl bg-[var(--sona-accent,#E07A5F)]/10 p-5 text-center">
          <p className="text-4xl font-bold text-foreground">{roundCorrect} / {order.length}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {pct === 100 ? "Perfect score! 🎉" : pct >= 70 ? "Nice work — nearly there." : "Good start — review the ones you missed."}
            {fullRound && best !== null ? ` Best: ${best}/${total}` : ""}
          </p>
        </div>

        <ul className="space-y-2" aria-label="Review">
          {order.map((i) => {
            const item = set.questions[i];
            const ok = correctMap[i];
            return (
              <li key={i} className="rounded-xl border border-border p-3 text-sm">
                <p className="flex items-start gap-2 font-medium text-foreground">
                  {ok
                    ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-label="Correct" />
                    : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-label="Incorrect" />}
                  <span>{item.q}</span>
                </p>
                {!ok && (
                  <p className="mt-1.5 pl-6 text-muted-foreground">
                    Answer: <span className="font-semibold text-foreground">{item.options[item.answer]}</span>
                  </p>
                )}
                {item.explain && <p className="mt-1 pl-6 text-xs text-muted-foreground">{item.explain}</p>}
              </li>
            );
          })}
        </ul>

        <div className="flex flex-wrap gap-2">
          {missed.length > 0 && (
            <button type="button" className={btnPrimary} onClick={() => restart(missed, false)}>
              <RotateCcw className="h-4 w-4" aria-hidden /> Retry missed ({missed.length})
            </button>
          )}
          <button type="button" className={missed.length ? btnGhost : btnPrimary} onClick={() => restart(shuffle(range(total)), true)}>
            <Shuffle className="h-4 w-4" aria-hidden /> Restart
          </button>
          <button type="button" className={btnGhost} onClick={onClose}>Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
          <span>Question {pos + 1} of {order.length}</span>
          <span>{roundCorrect} correct</span>
        </div>
        <ProgressBar value={pos} max={order.length} />
      </div>

      <h3 className="text-[17px] font-semibold leading-snug text-foreground">{q!.q}</h3>

      <div className="space-y-2" role="group" aria-label="Answer options">
        {q!.options.map((opt, i) => {
          const isAnswer = i === q!.answer;
          const isPicked = i === picked;
          const reveal = picked !== null;
          const tone = !reveal
            ? "border-border hover:bg-muted"
            : isAnswer
              ? "border-emerald-500 bg-emerald-500/10"
              : isPicked
                ? "border-red-500 bg-red-500/10"
                : "border-border opacity-60";
          return (
            <button
              key={i}
              type="button"
              onClick={() => pick(i)}
              disabled={reveal}
              aria-pressed={isPicked}
              className={`flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left text-[15px] text-foreground transition ${tone}`}
            >
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-bold text-muted-foreground">
                {OPTION_LABELS[i]}
              </span>
              <span className="flex-1">{opt}</span>
              {reveal && isAnswer && <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-label="Correct answer" />}
              {reveal && isPicked && !isAnswer && <X className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-label="Your answer" />}
            </button>
          );
        })}
      </div>

      <div aria-live="polite" className="min-h-[2.5rem]">
        {picked !== null && (
          <div className={`rounded-xl p-3 text-sm ${picked === q!.answer ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-red-500/10 text-red-700 dark:text-red-300"}`}>
            <p className="font-semibold">{picked === q!.answer ? "Correct!" : "Not quite."}</p>
            {q!.explain && <p className="mt-0.5 opacity-90">{q!.explain}</p>}
          </div>
        )}
      </div>

      <button type="button" className={`${btnPrimary} w-full`} onClick={next} disabled={picked === null}>
        {pos + 1 >= order.length ? "See results" : "Next"} <ArrowRight className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Flashcards
// ─────────────────────────────────────────────────────────────────────────────
function CardPlayer({
  set,
  onClose,
}: {
  set: Extract<StudySet, { kind: "flashcards" }>;
  onClose: () => void;
}) {
  const total = set.cards.length;
  const [deck, setDeck] = useState<number[]>(() => range(total));
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<number[]>([]);
  const [learning, setLearning] = useState<number[]>([]);

  const done = pos >= deck.length;
  const card = done ? null : set.cards[deck[pos]];

  const grade = useCallback(
    (gotIt: boolean) => {
      if (!flipped || done) return;
      const idx = deck[pos];
      (gotIt ? setKnown : setLearning)((l) => [...l, idx]);
      setFlipped(false);
      setPos((p) => p + 1);
    },
    [flipped, done, deck, pos],
  );

  // Space/Enter flip, ← "still learning", → "got it".
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || done) return;
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); setFlipped((f) => !f); }
      else if (e.key === "ArrowLeft") grade(false);
      else if (e.key === "ArrowRight") grade(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done, grade]);

  const restart = (indices: number[]) => {
    setDeck(indices);
    setPos(0);
    setFlipped(false);
    setKnown([]);
    setLearning([]);
  };

  if (done) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl bg-[var(--sona-accent,#E07A5F)]/10 p-5 text-center">
          <p className="text-4xl font-bold text-foreground">{known.length} / {deck.length}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {learning.length === 0 ? "You knew them all! 🎉" : `${learning.length} still to learn — go again on just those.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {learning.length > 0 && (
            <button type="button" className={btnPrimary} onClick={() => restart(learning)}>
              <RotateCcw className="h-4 w-4" aria-hidden /> Study missed ({learning.length})
            </button>
          )}
          <button type="button" className={learning.length ? btnGhost : btnPrimary} onClick={() => restart(shuffle(range(total)))}>
            <Shuffle className="h-4 w-4" aria-hidden /> Shuffle &amp; restart
          </button>
          <button type="button" className={btnGhost} onClick={onClose}>Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
          <span>Card {pos + 1} of {deck.length}</span>
          <span>{known.length} known</span>
        </div>
        <ProgressBar value={pos} max={deck.length} />
      </div>

      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        aria-label={flipped ? "Showing the answer. Tap to see the question." : "Showing the question. Tap to reveal the answer."}
        className={`flex min-h-[200px] w-full flex-col items-center justify-center rounded-3xl border p-6 text-center transition-colors ${
          flipped ? "border-[var(--sona-accent,#E07A5F)] bg-[var(--sona-accent,#E07A5F)]/10" : "border-border bg-muted/40"
        }`}
      >
        <span className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {flipped ? "Answer" : "Question"}
        </span>
        <span className="text-xl font-semibold leading-snug text-foreground">{flipped ? card!.back : card!.front}</span>
        {!flipped && <span className="mt-4 text-xs text-muted-foreground">Tap to flip</span>}
      </button>

      <div className="grid grid-cols-2 gap-2" aria-live="polite">
        <button type="button" className={btnGhost} onClick={() => grade(false)} disabled={!flipped}>
          <X className="h-4 w-4" aria-hidden /> Still learning
        </button>
        <button type="button" className={btnPrimary} onClick={() => grade(true)} disabled={!flipped}>
          <Check className="h-4 w-4" aria-hidden /> Got it
        </button>
      </div>
    </div>
  );
}

export function StudyPlayer({ set, studyId, onClose }: { set: StudySet; studyId: string; onClose: () => void }) {
  // Remount (fresh state) if a different set is passed in.
  const key = useMemo(() => `${studyId}:${set.kind}`, [studyId, set.kind]);
  return set.kind === "quiz"
    ? <QuizPlayer key={key} set={set} studyId={studyId} onClose={onClose} />
    : <CardPlayer key={key} set={set} onClose={onClose} />;
}
