// src/components/SonaActionCard.tsx
//
// The confirm card Sona AI shows when the user asked it to DO something
// (post a poll, schedule a message). Nothing runs until "Confirm" is tapped.
// Only the user who asked can see/use it: the row is fetched with their own
// session, so in a group chat everyone else simply gets no card.

import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "@heroui/react";
import { BarChart3, CalendarClock, Check, Loader2, X } from "lucide-react";
import {
  dismissSonaAction,
  getSonaAction,
  runSonaAction,
  type SonaActionView,
} from "@/lib/aiActions.functions";
import type { CreatePollPayload, ScheduleMessagePayload } from "@/lib/aiActions";

type Phase = "loading" | "hidden" | "ready" | "running" | "done" | "dismissed" | "expired";

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export function SonaActionCard({ actionId }: { actionId: string }) {
  const fetchAction = useServerFn(getSonaAction);
  const runAction = useServerFn(runSonaAction);
  const dismissAction = useServerFn(dismissSonaAction);

  const [action, setAction] = useState<SonaActionView | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [doneText, setDoneText] = useState("");

  useEffect(() => {
    let alive = true;
    fetchAction({ data: { actionId } })
      .then((a) => {
        if (!alive) return;
        if (!a) return setPhase("hidden"); // not mine, or gone
        setAction(a);
        if (a.status === "done") { setDoneText("Done."); setPhase("done"); }
        else if (a.status === "dismissed") setPhase("dismissed");
        else if (a.expired) setPhase("expired");
        else setPhase("ready"); // pending (or a stuck "running" from a closed tab — let them retry)
      })
      .catch(() => alive && setPhase("hidden"));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionId]);

  if (phase === "loading" || phase === "hidden" || !action) return null;

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  const confirm = async () => {
    setPhase("running");
    try {
      const res = await runAction({
        data: { actionId, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      });
      setDoneText(res.summary);
      setPhase("done");
    } catch (e) {
      toast.danger((e as Error).message || "Couldn't do that.");
      setPhase("ready");
    }
  };

  const dismiss = async () => {
    setPhase("dismissed");
    try { await dismissAction({ data: { actionId } }); } catch { /* it's only a UI hint */ }
  };

  const isPoll = action.type === "create_poll";
  const poll = action.payload as CreatePollPayload;
  const sched = action.payload as ScheduleMessagePayload;
  const Icon = isPoll ? BarChart3 : CalendarClock;

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
        {isPoll ? "Create a poll" : "Schedule a message"}
      </div>

      {isPoll ? (
        <div className="mt-2">
          <p className="text-[15px] font-semibold leading-snug text-foreground">{poll.question}</p>
          <ul className="mt-2 space-y-1.5">
            {poll.options.map((o, i) => (
              <li key={i} className="rounded-xl border border-border bg-background/70 px-3 py-1.5 text-sm text-foreground">
                {o}
              </li>
            ))}
          </ul>
          {poll.allowMultiple && <p className="mt-2 text-xs text-muted-foreground">People can pick more than one answer.</p>}
          <p className="mt-2 text-xs text-muted-foreground">Posts to this chat as you.</p>
        </div>
      ) : (
        <div className="mt-2">
          <p className="whitespace-pre-wrap break-words rounded-xl border border-border bg-background/70 px-3 py-2 text-sm text-foreground">
            {sched.text}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Sends to this chat as you on <span className="font-semibold text-foreground">{formatWhen(sched.sendAt)}</span>.
          </p>
        </div>
      )}

      <div className="mt-3">
        {(phase === "ready" || phase === "running") && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={confirm}
              disabled={phase === "running"}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--sona-accent,#E07A5F)] px-4 py-1.5 text-sm font-semibold text-white transition active:scale-95 disabled:opacity-60"
            >
              {phase === "running" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
              {phase === "running" ? "Working…" : "Confirm"}
            </button>
            <button
              type="button"
              onClick={dismiss}
              disabled={phase === "running"}
              className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-muted disabled:opacity-60"
            >
              <X className="h-4 w-4" aria-hidden /> Not now
            </button>
          </div>
        )}
        {phase === "done" && (
          <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
            <Check className="h-4 w-4" aria-hidden /> {doneText}
          </p>
        )}
        {phase === "dismissed" && <p className="text-sm text-muted-foreground">Dismissed.</p>}
        {phase === "expired" && <p className="text-sm text-muted-foreground">This suggestion expired — ask Sona again.</p>}
      </div>
    </div>
  );
}
