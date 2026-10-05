// src/components/StudySetCard.tsx
//
// Card under a Sona AI reply when the user asked for a quiz or flashcards.
// Tap Start -> the player opens in a bottom sheet. The set itself is fetched by
// id with the user's own session; the table's RLS only returns it to the person
// who asked, so in a group chat everyone else simply sees no card.

import { useEffect, useState } from "react";
import { BookOpen, Layers, ListChecks } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { supabase } from "@/integrations/supabase/client";
import { validateStudySet, type StudySet } from "@/lib/studyTools";
import { StudyPlayer, bestScoreKey } from "./StudyPlayer";

// A set never changes after creation, so cache it for the session.
const cache = new Map<string, StudySet | null>();

async function loadSet(studyId: string): Promise<StudySet | null> {
  if (cache.has(studyId)) return cache.get(studyId) ?? null;
  const { data, error } = await (supabase as unknown as {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: (t: string) => any;
  })
    .from("ai_study_sets")
    .select("payload")
    .eq("id", studyId)
    .maybeSingle();
  if (error) return null; // don't cache failures — a retry on remount may succeed
  // Re-validate: never render a row we haven't checked (older/odd data can't break the UI).
  const set = data ? validateStudySet(data.payload, { allow: ["quiz", "flashcards"] }) : null;
  cache.set(studyId, set);
  return set;
}

export function StudySetCard({ studyId }: { studyId: string }) {
  const [set, setSet] = useState<StudySet | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "hidden">("loading");
  const [open, setOpen] = useState(false);
  const [best, setBest] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    loadSet(studyId).then((s) => {
      if (!alive) return;
      setSet(s);
      setState(s ? "ready" : "hidden");
    }).catch(() => alive && setState("hidden"));
    return () => { alive = false; };
  }, [studyId]);

  // Refresh "Best: x/y" each time the sheet closes.
  useEffect(() => {
    if (open) return;
    try {
      const v = localStorage.getItem(bestScoreKey(studyId));
      setBest(v === null ? null : Number(v));
    } catch { setBest(null); }
  }, [open, studyId]);

  if (state !== "ready" || !set) return null;

  const isQuiz = set.kind === "quiz";
  const count = isQuiz ? set.questions.length : set.cards.length;
  const Icon = isQuiz ? ListChecks : Layers;
  // The bubble has long-press / tap handlers; keep them off this card.
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div
      onClick={stop}
      onPointerDown={stop}
      onTouchStart={stop}
      onContextMenu={stop}
      className="mr-12 mb-2 mt-1 rounded-2xl border border-[var(--sona-accent,#E07A5F)]/30 bg-[var(--sona-accent,#E07A5F)]/5 p-3.5"
    >
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--sona-accent-dark,#C2634A)]">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {isQuiz ? "Quiz" : "Flashcards"} · {count} {isQuiz ? (count === 1 ? "question" : "questions") : count === 1 ? "card" : "cards"}
      </div>
      <p className="mt-1.5 text-[15px] font-semibold leading-snug text-foreground">{set.title}</p>
      {isQuiz && best !== null && (
        <p className="mt-0.5 text-xs text-muted-foreground">Best score: {best}/{count}</p>
      )}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--sona-accent,#E07A5F)] px-4 py-1.5 text-sm font-semibold text-white transition active:scale-95"
      >
        <BookOpen className="h-4 w-4" aria-hidden /> {isQuiz ? "Start quiz" : "Study cards"}
      </button>

      <Drawer open={open} onOpenChange={setOpen} shouldScaleBackground={false}>
        <DrawerContent className="max-h-[92dvh] outline-none">
          <DrawerHeader className="pb-2 text-left">
            <DrawerTitle>{set.title}</DrawerTitle>
            <DrawerDescription>
              {isQuiz ? "Pick an answer for each question." : "Tap a card to flip it, then say whether you knew it."}
            </DrawerDescription>
          </DrawerHeader>
          <div
            className="overflow-y-auto overscroll-contain px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
            data-vaul-no-drag
          >
            {open && <StudyPlayer set={set} studyId={studyId} onClose={() => setOpen(false)} />}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
