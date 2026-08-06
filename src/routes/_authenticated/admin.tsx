import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft, Shield, Building2, Mail, Users, Plus, Trash2, Ban,
  AlertTriangle, Flag, PauseCircle, CheckCircle2, Search, Loader2, Pencil,
} from "lucide-react";
import { notification } from "antd";
import { supabase } from "@/integrations/supabase/client";
import { useConfirm } from "@/hooks/useConfirmDialog";
import type { Profile } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
  head: () => ({
    meta: [
      { title: "Admin console — Sona" },
      { name: "description", content: "Manage Sona members, allowed organization email domains, invitations, warnings, suspensions and bans." },
      { property: "og:title", content: "Admin console — Sona" },
      { property: "og:description", content: "Manage members, organizations and moderation in Sona." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type OrgDomain = { id: string; domain: string; label: string | null; is_active: boolean };
type Invite = { id: string; email: string; domain: string | null; status: string; created_at: string };
type Report = {
  id: string; reporter_id: string; reported_id: string; chat_id: string | null;
  reason: string; details: string | null; status: string; created_at: string;
};
type Moderation = {
  id: string; user_id: string; action: "warn" | "suspend" | "ban" | "clear";
  reason: string | null; expires_at: string | null; is_active: boolean; created_at: string;
};

const ACTION_META: Record<string, { label: string; color: string }> = {
  warn: { label: "Warned", color: "#F59E0B" },
  suspend: { label: "Suspended", color: "#E07A5F" },
  ban: { label: "Banned", color: "#EF4444" },
  clear: { label: "Active", color: "#10B981" },
};

function err(e: unknown, fallback: string) {
  const message = e instanceof Error ? e.message : String(e ?? fallback);
  notification.error({ message: fallback, description: message, placement: "top" });
}

function AdminPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState<"members" | "reports" | "orgs" | "invites">("members");

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [mods, setMods] = useState<Moderation[]>([]);
  const [domains, setDomains] = useState<OrgDomain[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const [newDomain, setNewDomain] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) { setChecking(false); return; }
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle();
      setIsAdmin(!!data);
      setChecking(false);
    })();
  }, []);

  const loadAll = useCallback(async () => {
    setBusy(true);
    try {
      const [p, m, d, i, r] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_moderation").select("*").order("created_at", { ascending: false }),
        supabase.from("org_domains").select("*").order("domain"),
        supabase.from("org_invites").select("*").order("created_at", { ascending: false }),
        supabase.from("reports").select("*").order("created_at", { ascending: false }),
      ]);
      if (p.error) throw p.error;
      setProfiles((p.data ?? []) as Profile[]);
      setMods((m.data ?? []) as Moderation[]);
      setDomains((d.data ?? []) as OrgDomain[]);
      setInvites((i.data ?? []) as Invite[]);
      setReports((r.data ?? []) as Report[]);
    } catch (e) {
      err(e, "Couldn't load admin data");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { if (isAdmin) loadAll(); }, [isAdmin, loadAll]);

  const latestMod = useMemo(() => {
    const map: Record<string, Moderation> = {};
    for (const m of mods) if (!map[m.user_id]) map[m.user_id] = m;
    return map;
  }, [mods]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((p) =>
      p.display_name.toLowerCase().includes(q) || (p.email ?? "").toLowerCase().includes(q));
  }, [profiles, query]);

  const profileById = useMemo(() => {
    const map: Record<string, Profile> = {};
    for (const p of profiles) map[p.id] = p;
    return map;
  }, [profiles]);

  const setReportStatus = async (rep: Report, status: string) => {
    try {
      const { error } = await supabase.from("reports").update({ status }).eq("id", rep.id);
      if (error) throw error;
      loadAll();
    } catch (e) { err(e, "Couldn't update report"); }
  };

  const activeDomains = useMemo(() => domains.filter((d) => d.is_active).map((d) => d.domain.toLowerCase()), [domains]);

  /* ── actions ── */
  const moderate = async (user: Profile, action: "warn" | "suspend" | "ban" | "clear") => {
    const labels = { warn: "Warn", suspend: "Suspend", ban: "Ban", clear: "Reinstate" } as const;
    const ok = await confirm({
      title: `${labels[action]} ${user.display_name}?`,
      description: action === "clear" ? "This clears active restrictions." : "You can reverse this at any time.",
      confirmText: labels[action],
      danger: action === "ban" || action === "suspend",
    });
    if (!ok) return;
    const reason = action === "clear" ? null : window.prompt("Reason (optional)") || null;
    try {
      const { data: auth } = await supabase.auth.getUser();
      await supabase.from("user_moderation").update({ is_active: false }).eq("user_id", user.id).eq("is_active", true);
      const { error } = await supabase.from("user_moderation").insert({
        user_id: user.id,
        action,
        reason,
        created_by: auth.user?.id ?? null,
        expires_at: action === "suspend" ? new Date(Date.now() + 7 * 864e5).toISOString() : null,
      });
      if (error) throw error;
      notification.success({ message: `${labels[action]}ed`, description: user.display_name, placement: "top" });
      loadAll();
    } catch (e) { err(e, "Action failed"); }
  };

  const renameUser = async (user: Profile) => {
    const name = window.prompt("New display name", user.display_name)?.trim();
    if (!name) return;
    try {
      const { error } = await supabase.from("profiles").update({ display_name: name }).eq("id", user.id);
      if (error) throw error;
      notification.success({ message: "Username updated", description: name, placement: "top" });
      loadAll();
    } catch (e) { err(e, "Couldn't update username"); }
  };

  const addDomain = async () => {
    const domain = newDomain.trim().toLowerCase().replace(/^@/, "");
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
      notification.warning({ message: "Invalid domain", description: "Example: company.com", placement: "top" });
      return;
    }
    try {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("org_domains").insert({
        domain, label: newLabel.trim() || null, created_by: auth.user?.id ?? null,
      });
      if (error) throw error;
      setNewDomain(""); setNewLabel("");
      notification.success({ message: "Organization allowed", description: domain, placement: "top" });
      loadAll();
    } catch (e) { err(e, "Couldn't add organization"); }
  };

  const toggleDomain = async (d: OrgDomain) => {
    try {
      const { error } = await supabase.from("org_domains").update({ is_active: !d.is_active }).eq("id", d.id);
      if (error) throw error;
      loadAll();
    } catch (e) { err(e, "Couldn't update organization"); }
  };

  const removeDomain = async (d: OrgDomain) => {
    if (!(await confirm({ title: `Remove ${d.domain}?`, danger: true, confirmText: "Remove" }))) return;
    try {
      const { error } = await supabase.from("org_domains").delete().eq("id", d.id);
      if (error) throw error;
      loadAll();
    } catch (e) { err(e, "Couldn't remove organization"); }
  };

  const sendInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    const domain = email.split("@")[1];
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(email)) {
      notification.warning({ message: "Invalid email", description: "Enter a valid address", placement: "top" });
      return;
    }
    if (activeDomains.length && !activeDomains.includes(domain ?? "")) {
      notification.error({
        message: "Domain not allowed",
        description: `Only these organizations are allowed: ${activeDomains.join(", ")}`,
        placement: "top",
      });
      return;
    }
    try {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("org_invites").insert({
        email, domain: domain ?? null, invited_by: auth.user?.id ?? null,
      });
      if (error) throw error;
      setInviteEmail("");
      notification.success({ message: "Invitation created", description: email, placement: "top" });
      loadAll();
    } catch (e) { err(e, "Couldn't create invitation"); }
  };

  const revokeInvite = async (inv: Invite) => {
    try {
      const { error } = await supabase.from("org_invites").update({ status: "revoked" }).eq("id", inv.id);
      if (error) throw error;
      loadAll();
    } catch (e) { err(e, "Couldn't revoke invitation"); }
  };

  /* ── render ── */
  if (checking) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[#F0EBE3] dark:bg-[#121212]">
        <Loader2 className="h-6 w-6 animate-spin text-[#E07A5F]" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[#F0EBE3] px-6 text-center dark:bg-[#121212]">
        <div>
          <Shield className="mx-auto h-10 w-10 text-[#E07A5F]" />
          <h1 className="mt-3 text-lg font-bold text-[#2D3436] dark:text-[#E8E8E8]">Admins only</h1>
          <p className="mt-1 text-sm text-[#8C8C8C]">This console is restricted to Sona administrators.</p>
          <button onClick={() => navigate({ to: "/" })} className="mt-5 rounded-full bg-[#E07A5F] px-5 py-2 text-sm font-semibold text-white">
            Back to chats
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#F0EBE3] dark:bg-[#121212]">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-[#E07A5F]/15 bg-[#F0EBE3]/95 px-4 py-3 backdrop-blur dark:bg-[#1A1A1A]/95">
        <button onClick={() => navigate({ to: "/" })} aria-label="Back to chats"
          className="grid h-9 w-9 place-items-center rounded-full text-[#2D3436] transition hover:bg-[#E07A5F]/10 dark:text-[#E8E8E8]">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold text-[#2D3436] dark:text-[#E8E8E8]">Admin console</h1>
        {busy && <Loader2 className="ml-auto h-4 w-4 animate-spin text-[#E07A5F]" />}
      </header>

      <nav className="flex gap-2 px-4 py-3">
        {([["members", "Members", Users], ["reports", "Reports", Flag], ["orgs", "Organizations", Building2], ["invites", "Invites", Mail]] as const).map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition ${
              tab === k ? "bg-[#E07A5F] text-white" : "bg-white text-[#8C8C8C] dark:bg-[#1E1E1E]"}`}>
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </nav>

      <main className="px-4 pb-16">
        {tab === "members" && (
          <section>
            <div className="mb-3 flex items-center gap-2 rounded-2xl bg-white px-3 py-2 dark:bg-[#1E1E1E]">
              <Search className="h-4 w-4 text-[#8C8C8C]" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or email"
                className="w-full bg-transparent text-sm text-[#2D3436] outline-none dark:text-[#E8E8E8]" />
            </div>

            <ul className="space-y-2">
              {filtered.map((p) => {
                const m = latestMod[p.id];
                const state = m && m.is_active && m.action !== "clear" ? m.action : "clear";
                return (
                  <li key={p.id} className="rounded-2xl bg-white p-3 dark:bg-[#1E1E1E]">
                    <div className="flex items-center gap-3">
                      <img src={p.avatar_url ?? ""} alt="" className="h-10 w-10 shrink-0 rounded-full bg-[#E07A5F]/20 object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[#2D3436] dark:text-[#E8E8E8]">{p.display_name}</p>
                        <p className="truncate text-xs text-[#8C8C8C]">{p.email ?? "no email"}</p>
                      </div>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                        style={{ backgroundColor: `${ACTION_META[state]!.color}22`, color: ACTION_META[state]!.color }}>
                        {ACTION_META[state]!.label}
                      </span>
                    </div>
                    {m?.reason && state !== "clear" && (
                      <p className="mt-2 text-xs text-[#8C8C8C]">Reason: {m.reason}</p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button onClick={() => renameUser(p)} className="flex items-center gap-1 rounded-full bg-[#E07A5F]/10 px-3 py-1.5 text-xs font-semibold text-[#E07A5F]">
                        <Pencil className="h-3 w-3" /> Username
                      </button>
                      <button onClick={() => moderate(p, "warn")} className="flex items-center gap-1 rounded-full bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-600">
                        <AlertTriangle className="h-3 w-3" /> Warn
                      </button>
                      <button onClick={() => moderate(p, "suspend")} className="flex items-center gap-1 rounded-full bg-orange-500/10 px-3 py-1.5 text-xs font-semibold text-orange-600">
                        <PauseCircle className="h-3 w-3" /> Suspend
                      </button>
                      <button onClick={() => moderate(p, "ban")} className="flex items-center gap-1 rounded-full bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-600">
                        <Ban className="h-3 w-3" /> Ban
                      </button>
                      <button onClick={() => moderate(p, "clear")} className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-600">
                        <CheckCircle2 className="h-3 w-3" /> Reinstate
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {tab === "reports" && (
          <section>
            <ul className="space-y-2">
              {reports.map((r) => {
                const reporter = profileById[r.reporter_id];
                const reported = profileById[r.reported_id];
                return (
                  <li key={r.id} className="rounded-2xl bg-white p-3 dark:bg-[#1E1E1E]">
                    <div className="flex items-start gap-3">
                      <Flag className="mt-0.5 h-4 w-4 shrink-0 text-[#E07A5F]" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#2D3436] dark:text-[#E8E8E8]">
                          {reported?.display_name ?? "Unknown user"}
                          <span className="font-normal text-[#8C8C8C]"> reported by {reporter?.display_name ?? "someone"}</span>
                        </p>
                        <p className="mt-0.5 text-xs font-medium text-[#E07A5F]">{r.reason}</p>
                        {r.details && <p className="mt-1 text-xs text-[#8C8C8C]">{r.details}</p>}
                        <p className="mt-1 text-[11px] text-[#8C8C8C]">{new Date(r.created_at).toLocaleString()}</p>
                      </div>
                      <span className="rounded-full bg-[#E07A5F]/10 px-2 py-0.5 text-[10px] font-bold text-[#E07A5F]">{r.status}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {reported && (
                        <>
                          <button onClick={() => moderate(reported, "warn")} className="flex items-center gap-1 rounded-full bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-600">
                            <AlertTriangle className="h-3 w-3" /> Warn
                          </button>
                          <button onClick={() => moderate(reported, "suspend")} className="flex items-center gap-1 rounded-full bg-orange-500/10 px-3 py-1.5 text-xs font-semibold text-orange-600">
                            <PauseCircle className="h-3 w-3" /> Suspend
                          </button>
                          <button onClick={() => moderate(reported, "ban")} className="flex items-center gap-1 rounded-full bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-600">
                            <Ban className="h-3 w-3" /> Ban
                          </button>
                        </>
                      )}
                      {r.status !== "resolved" && (
                        <button onClick={() => setReportStatus(r, "resolved")} className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-600">
                          <CheckCircle2 className="h-3 w-3" /> Resolve
                        </button>
                      )}
                      {r.status !== "dismissed" && (
                        <button onClick={() => setReportStatus(r, "dismissed")} className="rounded-full bg-[#8C8C8C]/10 px-3 py-1.5 text-xs font-semibold text-[#8C8C8C]">
                          Dismiss
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
              {!reports.length && <p className="px-1 text-sm text-[#8C8C8C]">No reports yet.</p>}
            </ul>
          </section>
        )}

        {tab === "orgs" && (
          <section>
            <div className="rounded-2xl bg-white p-4 dark:bg-[#1E1E1E]">
              <p className="text-sm font-semibold text-[#2D3436] dark:text-[#E8E8E8]">Allowed email domains</p>
              <p className="mt-1 text-xs text-[#8C8C8C]">Only these organizations can be invited.</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input value={newDomain} onChange={(e) => setNewDomain(e.target.value)} placeholder="company.com"
                  className="flex-1 rounded-xl bg-[#F0EBE3] px-3 py-2 text-sm outline-none dark:bg-[#2A2A2A] dark:text-[#E8E8E8]" />
                <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Label (optional)"
                  className="flex-1 rounded-xl bg-[#F0EBE3] px-3 py-2 text-sm outline-none dark:bg-[#2A2A2A] dark:text-[#E8E8E8]" />
                <button onClick={addDomain} className="flex items-center justify-center gap-1 rounded-xl bg-[#E07A5F] px-4 py-2 text-sm font-semibold text-white">
                  <Plus className="h-4 w-4" /> Add
                </button>
              </div>
            </div>

            <ul className="mt-3 space-y-2">
              {domains.map((d) => (
                <li key={d.id} className="flex items-center gap-3 rounded-2xl bg-white p-3 dark:bg-[#1E1E1E]">
                  <Building2 className="h-4 w-4 text-[#E07A5F]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#2D3436] dark:text-[#E8E8E8]">@{d.domain}</p>
                    {d.label && <p className="truncate text-xs text-[#8C8C8C]">{d.label}</p>}
                  </div>
                  <button onClick={() => toggleDomain(d)}
                    className={`rounded-full px-3 py-1 text-[11px] font-bold ${d.is_active ? "bg-emerald-500/10 text-emerald-600" : "bg-[#8C8C8C]/15 text-[#8C8C8C]"}`}>
                    {d.is_active ? "Active" : "Paused"}
                  </button>
                  <button onClick={() => removeDomain(d)} aria-label="Remove" className="grid h-8 w-8 place-items-center rounded-full text-red-500 hover:bg-red-500/10">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
              {!domains.length && <p className="px-1 text-sm text-[#8C8C8C]">No organizations yet.</p>}
            </ul>
          </section>
        )}

        {tab === "invites" && (
          <section>
            <div className="rounded-2xl bg-white p-4 dark:bg-[#1E1E1E]">
              <p className="text-sm font-semibold text-[#2D3436] dark:text-[#E8E8E8]">Invite someone</p>
              <p className="mt-1 text-xs text-[#8C8C8C]">
                {activeDomains.length ? `Allowed: ${activeDomains.map((d) => `@${d}`).join(", ")}` : "Add an organization first to restrict invites."}
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="person@company.com"
                  className="flex-1 rounded-xl bg-[#F0EBE3] px-3 py-2 text-sm outline-none dark:bg-[#2A2A2A] dark:text-[#E8E8E8]" />
                <button onClick={sendInvite} className="flex items-center justify-center gap-1 rounded-xl bg-[#E07A5F] px-4 py-2 text-sm font-semibold text-white">
                  <Mail className="h-4 w-4" /> Invite
                </button>
              </div>
            </div>

            <ul className="mt-3 space-y-2">
              {invites.map((inv) => (
                <li key={inv.id} className="flex items-center gap-3 rounded-2xl bg-white p-3 dark:bg-[#1E1E1E]">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#2D3436] dark:text-[#E8E8E8]">{inv.email}</p>
                    <p className="text-xs text-[#8C8C8C]">{new Date(inv.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className="rounded-full bg-[#E07A5F]/10 px-2 py-0.5 text-[10px] font-bold text-[#E07A5F]">{inv.status}</span>
                  {inv.status === "pending" && (
                    <button onClick={() => revokeInvite(inv)} className="rounded-full px-3 py-1 text-[11px] font-bold text-red-500 hover:bg-red-500/10">
                      Revoke
                    </button>
                  )}
                </li>
              ))}
              {!invites.length && <p className="px-1 text-sm text-[#8C8C8C]">No invitations yet.</p>}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
