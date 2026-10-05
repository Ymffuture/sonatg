// src/features/classroom/AttendanceModal.tsx
//
// Teacher's attendance screen (bottom sheet). Shows a QR + 6-digit code that
// rotates every 20 seconds, a live roster, and an export when the session ends.
// Closing the sheet does NOT end the session — reopening resumes it.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ClipboardCheck, Download, Loader2, Megaphone, Play, Square, Users, X } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { postSystemMessage } from "@/lib/systemMessages";
import type { Profile } from "@/lib/db";
import type { ClassRow } from "./types";
import {
  ATTENDANCE_CODE_SECONDS,
  attendanceCsv,
  attendanceUrl,
  closeAttendanceSession,
  downloadTextFile,
  getAttendanceCode,
  getOpenAttendanceSession,
  listAttendanceRecords,
  startAttendanceSession,
  type AttendanceRecordRow,
} from "./attendance";

type Phase = "loading" | "idle" | "running" | "ended";
type Session = { id: string; title: string | null; startedAt: string };

const ROSTER_POLL_MS = 4000;

function QrCanvas({ value }: { value: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Lazy-loaded: the QR library only ships when a teacher actually opens this screen.
        const QRCode = (await import("qrcode")).default;
        if (!alive || !ref.current) return;
        await QRCode.toCanvas(ref.current, value, {
          width: 240,
          margin: 2,
          errorCorrectionLevel: "M",
          color: { dark: "#111111", light: "#ffffff" }, // always black-on-white so it scans in dark mode too
        });
        if (alive) setFailed(false);
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => { alive = false; };
  }, [value]);

  if (failed) {
    return (
      <div className="grid h-[240px] w-[240px] place-items-center rounded-2xl bg-muted p-4 text-center text-sm text-muted-foreground">
        Couldn't draw the QR code. Students can type the 6-digit code below instead.
      </div>
    );
  }
  return (
    <canvas
      ref={ref}
      role="img"
      aria-label="Attendance QR code. It changes every 20 seconds."
      className="h-[240px] w-[240px] rounded-2xl bg-white shadow-sm"
    />
  );
}

export function AttendanceModal({
  classRow,
  members,
  meId,
  onClose,
}: {
  classRow: ClassRow;
  /** Everyone in the class chat; the teacher and the AI are excluded from the head-count. */
  members: Profile[];
  meId: string;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [titleInput, setTitleInput] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [netErr, setNetErr] = useState(false);
  const [records, setRecords] = useState<AttendanceRecordRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [posted, setPosted] = useState(false);

  const students = useMemo(
    () => members.filter((m) => m.id !== meId && !m.is_ai),
    [members, meId],
  );
  const nameOf = useMemo(() => {
    const map = new Map(members.map((m) => [m.id, m.display_name || "Student"]));
    return (id: string) => map.get(id) ?? "Former member";
  }, [members]);

  // ── resume an open session if the teacher closed the sheet earlier ──
  useEffect(() => {
    let alive = true;
    getOpenAttendanceSession(classRow.chat_id)
      .then((s) => {
        if (!alive) return;
        if (s && s.class_id === classRow.id) {
          setSession({ id: s.id, title: s.title, startedAt: s.started_at });
          setPhase("running");
        } else setPhase("idle");
      })
      .catch(() => alive && setPhase("idle"));
    return () => { alive = false; };
  }, [classRow.chat_id, classRow.id]);

  // ── the rotating code: always re-fetched from the server (it owns the secret and the clock) ──
  useEffect(() => {
    if (phase !== "running" || !session) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const r = await getAttendanceCode(session.id);
        if (!alive) return;
        setCode(r.code);
        setExpiresAt(Date.now() + r.secondsLeft * 1000);
        setNetErr(false);
        // Students are also accepted on the PREVIOUS code, so a small fetch delay never breaks a scan.
        timer = setTimeout(tick, r.secondsLeft * 1000 + 100);
      } catch (e) {
        if (!alive) return;
        if (/closed/i.test((e as Error).message)) { setPhase("ended"); return; }
        setNetErr(true);
        timer = setTimeout(tick, 2000);
      }
    };
    void tick();
    return () => { alive = false; clearTimeout(timer); };
  }, [phase, session]);

  // countdown bar
  useEffect(() => {
    if (phase !== "running") return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [phase]);

  // live roster
  const refreshRecords = useCallback(async (sessionId: string) => {
    try { setRecords(await listAttendanceRecords(sessionId)); } catch { /* keep the last list */ }
  }, []);
  useEffect(() => {
    if (phase !== "running" || !session) return;
    void refreshRecords(session.id);
    const t = setInterval(() => void refreshRecords(session.id), ROSTER_POLL_MS);
    return () => clearInterval(t);
  }, [phase, session, refreshRecords]);

  // keep the teacher's screen awake while the QR is up (best effort; not all browsers support it)
  useEffect(() => {
    if (phase !== "running") return;
    type WakeLock = { release: () => Promise<void> };
    let lock: WakeLock | null = null;
    const nav = navigator as unknown as { wakeLock?: { request: (t: "screen") => Promise<WakeLock> } };
    const acquire = () => nav.wakeLock?.request("screen").then((l) => { lock = l; }).catch(() => {});
    void acquire();
    const onVis = () => { if (document.visibilityState === "visible") void acquire(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      void lock?.release().catch(() => {});
    };
  }, [phase]);

  useEffect(() => {
    if (!confirmEnd) return;
    const t = setTimeout(() => setConfirmEnd(false), 3000);
    return () => clearTimeout(t);
  }, [confirmEnd]);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const id = await startAttendanceSession(classRow.id, titleInput);
      const title = titleInput.trim().slice(0, 80) || null;
      setSession({ id, title, startedAt: new Date().toISOString() });
      setRecords([]);
      setCode(null);
      setPosted(false);
      setPhase("running");
      void postSystemMessage(classRow.chat_id, "Attendance is open — scan the QR code on your teacher's screen.");
    } catch (e) {
      setError((e as Error).message || "Couldn't start attendance.");
    } finally {
      setBusy(false);
    }
  };

  const end = async () => {
    if (!session) return;
    if (!confirmEnd) { setConfirmEnd(true); return; }
    setBusy(true);
    setError(null);
    try {
      await closeAttendanceSession(session.id);
      await refreshRecords(session.id);
      setPhase("ended");
    } catch (e) {
      setError((e as Error).message || "Couldn't end attendance.");
    } finally {
      setBusy(false);
      setConfirmEnd(false);
    }
  };

  const presentIds = useMemo(() => new Set(records.map((r) => r.user_id)), [records]);
  const absent = students.filter((s) => !presentIds.has(s.id));
  const presentCount = records.length;
  const label = session?.title || classRow.name;

  const exportCsv = () => {
    if (!session) return;
    const people = [
      ...students.map((s) => ({ id: s.id, name: s.display_name, email: s.email })),
      // anyone who checked in but is no longer in the member list (or is the teacher)
      ...records.filter((r) => !students.some((s) => s.id === r.user_id)).map((r) => ({ id: r.user_id, name: nameOf(r.user_id), email: null })),
    ];
    const day = new Date(session.startedAt).toISOString().slice(0, 10);
    downloadTextFile(
      `attendance-${classRow.name.replace(/[^\w-]+/g, "_").slice(0, 40)}-${day}.csv`,
      attendanceCsv({ title: `${classRow.name}${session.title ? ` — ${session.title}` : ""}`, startedAt: session.startedAt, people, records }),
    );
  };

  const postSummary = async () => {
    setPosted(true);
    // Counts only — never names — in a chat everyone can read.
    await postSystemMessage(classRow.chat_id, `Attendance taken — ${label}: ${presentCount} of ${students.length} present.`);
  };

  const remainingMs = Math.max(0, expiresAt - now);
  const pct = Math.min(100, (remainingMs / (ATTENDANCE_CODE_SECONDS * 1000)) * 100);

  return (
    <Drawer open onOpenChange={(o) => { if (!o) onClose(); }} shouldScaleBackground={false}>
      <DrawerContent className="max-h-[92dvh] outline-none">
        <DrawerHeader className="pb-2 text-left">
          <DrawerTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-[var(--sona-accent,#E07A5F)]" aria-hidden /> Attendance
          </DrawerTitle>
          <DrawerDescription>{classRow.name}</DrawerDescription>
        </DrawerHeader>

        <div className="overflow-y-auto overscroll-contain px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]" data-vaul-no-drag>
          {phase === "loading" && (
            <p className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
            </p>
          )}

          {phase === "idle" && (
            <div className="space-y-3 pb-2">
              <p className="text-sm text-muted-foreground">
                Your screen will show a QR code and a 6-digit code that change every 20 seconds, so a screenshot is useless to anyone not in the room.
              </p>
              <input
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                maxLength={80}
                placeholder="Optional label, e.g. Period 1"
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-[var(--sona-accent,#E07A5F)]"
              />
              <button
                type="button"
                onClick={start}
                disabled={busy}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--sona-accent,#E07A5F)] py-3 text-sm font-semibold text-white shadow-lg transition active:scale-[0.98] disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
                Start attendance
              </button>
            </div>
          )}

          {phase === "running" && session && (
            <div className="space-y-4">
              <div className="flex flex-col items-center">
                {code ? <QrCanvas value={attendanceUrl(session.id, code)} /> : (
                  <div className="grid h-[240px] w-[240px] place-items-center rounded-2xl bg-muted">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
                  </div>
                )}
                <p className="mt-3 font-mono text-4xl font-bold tracking-[0.3em] text-foreground" aria-live="off">
                  {code ?? "······"}
                </p>
                <div className="mt-2 h-1.5 w-60 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div
                    className="h-full rounded-full bg-[var(--sona-accent,#E07A5F)] transition-[width] duration-200 ease-linear"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {netErr ? "Reconnecting…" : "Scan with the phone camera, or type the code in Sona. It changes every 20 s."}
                </p>
              </div>

              <div className="rounded-2xl border border-border p-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Users className="h-4 w-4 text-[var(--sona-accent,#E07A5F)]" aria-hidden />
                  {presentCount} of {students.length} present
                </p>
                {records.length > 0 ? (
                  <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-sm" aria-label="Students checked in">
                    {[...records].reverse().map((r) => (
                      <li key={r.user_id} className="flex items-center justify-between gap-2 text-foreground">
                        <span className="flex min-w-0 items-center gap-1.5"><Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden /><span className="truncate">{nameOf(r.user_id)}</span></span>
                        <span className="shrink-0 text-xs text-muted-foreground">{new Date(r.marked_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">Nobody has checked in yet.</p>
                )}
              </div>

              <button
                type="button"
                onClick={end}
                disabled={busy}
                className={`inline-flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-60 ${confirmEnd ? "bg-red-600 text-white" : "bg-red-500/10 text-red-600 dark:text-red-400"}`}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Square className="h-4 w-4" aria-hidden />}
                {confirmEnd ? "Tap again to end" : "End attendance"}
              </button>
            </div>
          )}

          {phase === "ended" && session && (
            <div className="space-y-3">
              <div className="rounded-2xl bg-emerald-500/10 p-4 text-center">
                <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">{presentCount} / {students.length}</p>
                <p className="text-sm text-emerald-700/80 dark:text-emerald-300/80">present · {label}</p>
              </div>
              {absent.length > 0 && (
                <details className="rounded-2xl border border-border p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-foreground">Absent ({absent.length})</summary>
                  <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-sm text-muted-foreground">
                    {absent.map((s) => <li key={s.id} className="truncate">{s.display_name}</li>)}
                  </ul>
                </details>
              )}
              <button type="button" onClick={exportCsv} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--sona-accent,#E07A5F)] py-3 text-sm font-semibold text-white shadow-lg transition active:scale-[0.98]">
                <Download className="h-4 w-4" aria-hidden /> Download CSV
              </button>
              <button type="button" onClick={postSummary} disabled={posted} className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border py-3 text-sm font-semibold text-foreground transition active:scale-[0.98] disabled:opacity-60">
                <Megaphone className="h-4 w-4" aria-hidden /> {posted ? "Posted to the chat" : "Post the count to the chat"}
              </button>
              <button type="button" onClick={onClose} className="inline-flex w-full items-center justify-center gap-1.5 rounded-full py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted">
                <X className="h-4 w-4" aria-hidden /> Done
              </button>
            </div>
          )}

          {error && <p className="mt-3 rounded-xl bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
