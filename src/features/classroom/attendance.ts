// src/features/classroom/attendance.ts
//
// Client wrappers for the rotating-QR attendance functions defined in
// supabase/migrations/20261005100000_class_attendance.sql.
//
// The teacher's screen shows a code that changes every 20 s; only the database
// knows the per-session secret, so nothing here can forge a code.

import { supabase } from "@/integrations/supabase/client";

export type AttendanceStatus = "marked" | "already" | "wrong_code" | "locked";

export type AttendanceResult = {
  status: AttendanceStatus;
  className: string | null;
  title: string | null;
};

export type AttendanceSessionRow = {
  id: string;
  class_id: string;
  chat_id: string;
  created_by: string;
  title: string | null;
  started_at: string;
  closed_at: string | null;
};

export type AttendanceRecordRow = { user_id: string; marked_at: string };

export const ATTENDANCE_CODE_SECONDS = 20;

// The attendance tables/functions aren't in the generated Supabase types yet
// (regenerate them after running the migration and these casts can go).
type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type From = (table: string) => any;
const rpc: Rpc = (fn, args) => (supabase as unknown as { rpc: Rpc }).rpc(fn, args);
const from: From = (t) => (supabase as unknown as { from: From }).from(t);

function unwrap<T>(res: { data: unknown; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

function toResult(data: unknown): AttendanceResult {
  const row = (Array.isArray(data) ? data[0] : data) as
    | { status?: string; class_name?: string | null; title?: string | null }
    | undefined;
  if (!row?.status) throw new Error("Unexpected response from the server.");
  return {
    status: row.status as AttendanceStatus,
    className: row.class_name ?? null,
    title: row.title ?? null,
  };
}

export async function startAttendanceSession(classId: string, title?: string): Promise<string> {
  return unwrap<string>(await rpc("start_attendance_session", { _class: classId, _title: title?.trim() || null }));
}

/** Teacher only. `secondsLeft` is how long this code stays the CURRENT one (server clock). */
export async function getAttendanceCode(sessionId: string): Promise<{ code: string; secondsLeft: number }> {
  const data = unwrap<Array<{ code: string; seconds_left: number }>>(
    await rpc("attendance_current_code", { _session: sessionId }),
  );
  const row = data?.[0];
  if (!row) throw new Error("Couldn't get the attendance code.");
  return { code: row.code, secondsLeft: row.seconds_left };
}

export async function closeAttendanceSession(sessionId: string): Promise<void> {
  unwrap<unknown>(await rpc("close_attendance_session", { _session: sessionId }));
}

/** Student: the QR/URL path — the session id is known. */
export async function markAttendance(sessionId: string, code: string): Promise<AttendanceResult> {
  return toResult(unwrap(await rpc("mark_attendance", { _session: sessionId, _code: code })));
}

/** Student: the typed-code path — only the 6 digits are known. */
export async function markAttendanceByCode(code: string): Promise<AttendanceResult> {
  return toResult(unwrap(await rpc("mark_attendance_by_code", { _code: code })));
}

/** The currently open session for a chat's class, if any (readable by every member). */
export async function getOpenAttendanceSession(chatId: string): Promise<AttendanceSessionRow | null> {
  const { data, error } = await from("attendance_sessions")
    .select("id, class_id, chat_id, created_by, title, started_at, closed_at")
    .eq("chat_id", chatId)
    .is("closed_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as AttendanceSessionRow | null) ?? null;
}

/** Teacher: who has checked in so far. (RLS lets students see only their own row.) */
export async function listAttendanceRecords(sessionId: string): Promise<AttendanceRecordRow[]> {
  const { data, error } = await from("attendance_records")
    .select("user_id, marked_at")
    .eq("session_id", sessionId)
    .order("marked_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as AttendanceRecordRow[];
}

/** What the QR encodes: scanning with the phone's normal camera opens the app and checks the student in. */
export function attendanceUrl(sessionId: string, code: string): string {
  const u = new URL("/attend", window.location.origin);
  u.searchParams.set("s", sessionId);
  u.searchParams.set("c", code);
  return u.toString();
}

export function statusMessage(r: AttendanceResult): { ok: boolean; title: string; detail: string } {
  const where = [r.className, r.title].filter(Boolean).join(" · ");
  switch (r.status) {
    case "marked":
      return { ok: true, title: "You're marked present", detail: where };
    case "already":
      return { ok: true, title: "Already checked in", detail: where || "Your attendance was already recorded." };
    case "wrong_code":
      return {
        ok: false,
        title: "That code didn't work",
        detail: "Codes change every 20 seconds. Scan the QR on your teacher's screen again, or type the code shown right now.",
      };
    case "locked":
      return {
        ok: false,
        title: "Too many wrong codes",
        detail: "Attendance is locked for you in this session. Ask your teacher to mark you present.",
      };
  }
}

// ── CSV export ───────────────────────────────────────────────────────────────

// Spreadsheet apps run cells that start with = + - @ as formulas; a student's
// display name must never be able to do that.
function csvCell(v: string): string {
  let s = v.replace(/\r?\n/g, " ");
  if (/^[=+\-@\t]/.test(s)) s = `'${s}`;
  return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function attendanceCsv(opts: {
  title: string;
  startedAt: string;
  people: Array<{ id: string; name: string; email?: string | null }>;
  records: AttendanceRecordRow[];
}): string {
  const at = new Map(opts.records.map((r) => [r.user_id, r.marked_at]));
  const rows = [["Name", "Email", "Status", "Checked in at"]];
  const present = opts.people.filter((p) => at.has(p.id));
  const absent = opts.people.filter((p) => !at.has(p.id));
  for (const p of present) rows.push([p.name, p.email ?? "", "Present", new Date(at.get(p.id)!).toLocaleString()]);
  for (const p of absent) rows.push([p.name, p.email ?? "", "Absent", ""]);
  const head = [`# ${opts.title}`, `# Started ${new Date(opts.startedAt).toLocaleString()}`];
  return "\uFEFF" + [...head, ...rows.map((r) => r.map(csvCell).join(","))].join("\r\n");
}

export function downloadTextFile(filename: string, text: string, mime = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
