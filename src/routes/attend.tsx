// src/routes/attend.tsx
//
// Landing page for the teacher's rotating attendance QR. A student scans it with
// their normal phone camera -> this page opens -> they're checked in. With no
// code in the URL it shows a box to type the 6 digits instead.

import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { CheckCircle2, ClipboardCheck, Loader2, LogIn, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  markAttendance,
  statusMessage,
  type AttendanceResult,
} from "@/features/classroom/attendance";
import { AttendanceCodeForm } from "@/features/classroom/AttendanceCodeForm";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/attend")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { s?: string; c?: string } => ({
    s: typeof s.s === "string" && UUID_RE.test(s.s) ? s.s : undefined,
    c: typeof s.c === "string" && /^\d{6}$/.test(s.c) ? s.c : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Check in — Sona" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AttendPage,
});

type Phase = "checking" | "signed-out" | "marking" | "result" | "manual";

function AttendPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("checking");
  const [result, setResult] = useState<AttendanceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false); // StrictMode runs effects twice; a scan must only be submitted once

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const { s: sessionId, c: code } = search;

    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return setPhase("signed-out");
      if (!sessionId || !code) return setPhase("manual");

      // Drop the code from the address bar/history right away — it's a short-lived
      // credential and shouldn't linger in a screenshot or a shared link.
      navigate({ to: "/attend", search: {}, replace: true }).catch(() => {});

      setPhase("marking");
      try {
        setResult(await markAttendance(sessionId, code));
      } catch (e) {
        setError((e as Error).message || "Couldn't check you in.");
      }
      setPhase("result");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const msg = result ? statusMessage(result) : null;

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-5 py-10">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-center shadow-xl"
      >
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--sona-accent,#E07A5F)]/12">
          <ClipboardCheck className="h-7 w-7 text-[var(--sona-accent,#E07A5F)]" aria-hidden />
        </div>
        <h1 className="mt-4 text-xl font-bold text-foreground">Class check-in</h1>

        {(phase === "checking" || phase === "marking") && (
          <p className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {phase === "marking" ? "Checking you in…" : "One moment…"}
          </p>
        )}

        {phase === "signed-out" && (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in to Sona first. Codes change every 20 seconds, so after signing in please scan the QR again.
            </p>
            <Link
              to="/auth"
              search={{ redirect: "/attend" } as never}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--sona-accent,#E07A5F)] py-3 text-sm font-semibold text-white shadow-lg"
            >
              <LogIn className="h-4 w-4" aria-hidden /> Sign in
            </Link>
          </>
        )}

        {phase === "manual" && (
          <>
            <p className="mt-2 mb-4 text-sm text-muted-foreground">
              Type the 6-digit code shown on your teacher's screen. It changes every 20 seconds.
            </p>
            <AttendanceCodeForm />
          </>
        )}

        {phase === "result" && (
          <div className="mt-4" aria-live="polite">
            {msg?.ok ? (
              <div className="rounded-2xl bg-emerald-500/10 p-4 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="mx-auto h-9 w-9" aria-hidden />
                <p className="mt-2 text-lg font-bold">{msg.title}</p>
                {msg.detail && <p className="mt-1 text-sm opacity-90">{msg.detail}</p>}
              </div>
            ) : (
              <>
                <div className="rounded-2xl bg-red-500/10 p-4 text-red-600 dark:text-red-400">
                  <XCircle className="mx-auto h-9 w-9" aria-hidden />
                  <p className="mt-2 text-lg font-bold">{msg?.title ?? "Couldn't check you in"}</p>
                  <p className="mt-1 text-sm opacity-90">{msg?.detail ?? error}</p>
                </div>
                {(!msg || msg.title !== "Too many wrong codes") && (
                  <div className="mt-5">
                    <p className="mb-3 text-sm text-muted-foreground">Or type the code on the screen:</p>
                    <AttendanceCodeForm />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <Link to="/" className="mt-6 block text-[11px] text-muted-foreground underline underline-offset-2">
          Back to Sona
        </Link>
      </motion.section>
    </main>
  );
}
