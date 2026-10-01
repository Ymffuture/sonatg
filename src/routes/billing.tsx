import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Crown, Receipt, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PRICING } from "@/lib/pricing";

export const Route = createFileRoute("/billing")({
  head: () => ({
    meta: [
      { title: "Billing history — Sona Purple" },
      { name: "description", content: "See your current Sona plan, past payments and how to cancel Sona Purple." },
      { property: "og:title", content: "Billing history — Sona Purple" },
      { property: "og:description", content: "Your current plan, past payments and a clear way to cancel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BillingPage,
});

type Payment = {
  id: string;
  provider: string;
  billing_interval: string;
  amount_cents: number;
  currency: string;
  status: string;
  created_at: string;
};
type Sub = { tier: string; provider: string | null; current_period_end: string | null };

function BillingPage() {
  const [state, setState] = useState<"loading" | "signedout" | "ready">("loading");
  const [isPro, setIsPro] = useState(false);
  const [sub, setSub] = useState<Sub | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return setState("signedout");
      const [p, s, pay] = await Promise.all([
        supabase.from("profiles").select("is_pro").eq("id", u.user.id).maybeSingle(),
        supabase.from("subscriptions").select("tier, provider, current_period_end").eq("user_id", u.user.id).maybeSingle(),
        supabase.from("payments").select("id, provider, billing_interval, amount_cents, currency, status, created_at").order("created_at", { ascending: false }),
      ]);
      setIsPro(!!p.data?.is_pro);
      setSub((s.data as Sub) ?? null);
      setPayments((pay.data as Payment[]) ?? []);
      setState("ready");
    })();
  }, []);

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-3xl px-5 py-12">
        <Link to="/pricing" className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to pricing
        </Link>
        <h1 className="mt-8 flex items-center gap-2 text-3xl font-black tracking-tight">
          <Receipt className="h-7 w-7 text-primary" /> Billing history
        </h1>

        {state === "loading" && <p className="mt-8 text-sm text-muted-foreground">Loading…</p>}
        {state === "signedout" && (
          <p className="mt-8 text-sm text-muted-foreground">
            <Link to="/auth" className="font-semibold text-primary underline">Sign in</Link> to see your plan and payments.
          </p>
        )}

        {state === "ready" && (
          <>
            <section className="mt-8 rounded-2xl border border-border bg-card p-6">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Current plan</h2>
              <div className="mt-3 flex items-center gap-2 text-xl font-bold">
                {isPro ? <><Crown className="h-5 w-5 text-primary" /> Sona Purple</> : "Free"}
              </div>
              {isPro && sub?.current_period_end && (
                <p className="mt-1 text-sm text-muted-foreground">
                  Renews or ends on <strong>{fmtDate(sub.current_period_end)}</strong>
                  {sub.provider ? ` · paid with ${sub.provider}` : ""}
                </p>
              )}
              {!isPro && (
                <p className="mt-1 text-sm text-muted-foreground">
                  Upgrade for {PRICING.monthly.label}{PRICING.monthly.per} or {PRICING.yearly.label}{PRICING.yearly.per} in Settings → Subscription.
                </p>
              )}
            </section>

            <section className="mt-6 rounded-2xl border border-border bg-card p-6">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Past payments</h2>
              {payments.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No payments yet.</p>
              ) : (
                <ul className="mt-3 divide-y divide-border">
                  {payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between py-3 text-sm">
                      <div>
                        <div className="font-semibold">Sona Purple · {p.billing_interval === "yearly" ? "Yearly" : "Monthly"}</div>
                        <div className="text-xs text-muted-foreground">{fmtDate(p.created_at)} · {p.provider}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">R{(p.amount_cents / 100).toFixed(2)}</div>
                        <div className="text-xs capitalize text-muted-foreground">{p.status}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
              <h2 className="flex items-center gap-2 font-bold"><XCircle className="h-5 w-5 text-destructive" /> Cancel your plan</h2>
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Open Sona and go to <strong>Settings → Subscription</strong>.</li>
                <li>Tap <strong>Cancel plan</strong> and confirm.</li>
                <li>Or use the manage-subscription link in your payment receipt email.</li>
              </ol>
              <p className="mt-3 text-sm text-muted-foreground">You keep Purple until the end of the period you paid for. Your chats stay; free limits apply again after.</p>
              <Link to="/" className="mt-4 inline-block rounded-xl bg-destructive px-4 py-2 text-sm font-bold text-destructive-foreground">Go to Settings</Link>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
