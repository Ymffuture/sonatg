// src/features/classroom/AttendanceCodeForm.tsx
//
// Student-side "type the 6-digit code from the teacher's screen" form.
// Used on the /attend page and inside the group members sheet. Works across
// every open class the student belongs to, so they don't have to say which.

import { useRef, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { markAttendanceByCode, statusMessage, type AttendanceResult } from "./attendance";

export function AttendanceCodeForm({ onDone }: { onDone?: (r: AttendanceResult) => void }) {
  const [digits, setDigits] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AttendanceResult | null>(null);
  const lastSubmitted = useRef("");

  const submit = async (code: string) => {
    if (busy || code.length !== 6 || lastSubmitted.current === code) return;
    lastSubmitted.current = code;
    setBusy(true);
    setError(null);
    try {
      const r = await markAttendanceByCode(code);
      setResult(r);
      if (r.status === "marked" || r.status === "already") onDone?.(r);
    } catch (e) {
      setError((e as Error).message || "Couldn't check you in.");
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  const onChange = (raw: string) => {
    const next = raw.replace(/\D/g, "").slice(0, 6);
    setDigits(next);
    lastSubmitted.current = "";
    setError(null);
    setResult(null);
    if (next.length === 6) void submit(next); // auto-submit on the 6th digit
  };

  const msg = result ? statusMessage(result) : null;

  return (
    <div>
      <label htmlFor="attend-code" className="sr-only">6-digit attendance code</label>
      <input
        id="attend-code"
        value={digits}
        onChange={(e) => onChange(e.target.value)}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={6}
        placeholder="••••••"
        disabled={busy || msg?.ok === true}
        className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-center font-mono text-3xl font-bold tracking-[0.35em] text-foreground outline-none transition focus:border-[var(--sona-accent,#E07A5F)] disabled:opacity-60"
      />

      <div className="mt-3 min-h-[3rem]" aria-live="polite">
        {busy && (
          <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Checking…
          </p>
        )}
        {!busy && msg && (
          <div className={`flex items-start gap-2 rounded-xl p-3 text-sm ${msg.ok ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-red-500/10 text-red-600 dark:text-red-400"}`}>
            {msg.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
            <div>
              <p className="font-semibold">{msg.title}</p>
              {msg.detail && <p className="mt-0.5 opacity-90">{msg.detail}</p>}
            </div>
          </div>
        )}
        {!busy && error && (
          <p className="flex items-start gap-2 rounded-xl bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {error}
          </p>
        )}
      </div>
    </div>
  );
}
