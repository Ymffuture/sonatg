// src/features/admin/rosterImport.ts
// Bulk-import a CSV of student emails (a class roster export) into
// public.org_invites, reusing the existing invite/domain-restriction
// system rather than inventing a parallel one. No new dependency added —
// small dependency-free CSV parser since papaparse isn't in package.json.

import { supabase } from "@/integrations/supabase/client";

export interface RosterRow {
  email: string;
  displayName?: string;
}

export interface RosterImportResult {
  totalRows: number;
  imported: number;
  skippedInvalidEmail: string[];
  skippedWrongDomain: string[];
  failed: Array<{ email: string; error: string }>;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;

/**
 * Parses a simple CSV with a header row. Expects at least an "email"
 * column; an optional "name" or "display_name" column is used for
 * bookkeeping only (org_invites doesn't store it — extend the table if
 * you want it persisted). Handles quoted fields and CRLF/LF line endings.
 */
export function parseRosterCsv(csvText: string): RosterRow[] {
  const lines = csvText.split(/\r\n|\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const splitLine = (line: string): string[] => {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        cells.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
    cells.push(current);
    return cells.map((c) => c.trim());
  };

  const header = splitLine(lines[0]).map((h) => h.toLowerCase());
  const emailIdx = header.findIndex((h) => h === "email" || h === "e-mail" || h === "student email");
  const nameIdx = header.findIndex((h) => h === "name" || h === "display_name" || h === "student name");

  if (emailIdx === -1) {
    throw new Error('CSV must have an "email" column header.');
  }

  const rows: RosterRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i]);
    const email = cells[emailIdx]?.toLowerCase();
    if (!email) continue;
    rows.push({ email, displayName: nameIdx !== -1 ? cells[nameIdx] : undefined });
  }
  return rows;
}

/**
 * Imports a parsed roster as pending org_invites, enforcing the same
 * active-domain allowlist the single-invite flow in the admin console
 * uses. Runs as a series of client-side inserts under the caller's own
 * RLS (admin-only per the "admins manage invites" policy), so no new
 * server function is required.
 */
export async function importRosterAsInvites(
  rows: RosterRow[],
  activeDomains: string[],
): Promise<RosterImportResult> {
  const result: RosterImportResult = {
    totalRows: rows.length,
    imported: 0,
    skippedInvalidEmail: [],
    skippedWrongDomain: [],
    failed: [],
  };

  const { data: auth } = await supabase.auth.getUser();
  const invitedBy = auth.user?.id ?? null;

  const toInsert: Array<{ email: string; domain: string | null; invited_by: string | null }> = [];

  for (const row of rows) {
    if (!EMAIL_RE.test(row.email)) {
      result.skippedInvalidEmail.push(row.email);
      continue;
    }
    const domain = row.email.split("@")[1];
    if (activeDomains.length && !activeDomains.includes(domain)) {
      result.skippedWrongDomain.push(row.email);
      continue;
    }
    toInsert.push({ email: row.email, domain: domain ?? null, invited_by: invitedBy });
  }

  // Insert in chunks to stay well under typical request-size limits for
  // large rosters (e.g. a 500-student CSV).
  const CHUNK = 200;
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK);
    const { error } = await supabase.from("org_invites").insert(chunk);
    if (error) {
      for (const c of chunk) result.failed.push({ email: c.email, error: error.message });
    } else {
      result.imported += chunk.length;
    }
  }

  return result;
}
