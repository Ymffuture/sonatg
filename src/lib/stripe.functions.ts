import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { recordSubscriptionPeriod } from "@/lib/subscriptionPeriod";

// ─────────────────────────────────────────────────────────────────────────
// Stripe Checkout — a second payment method alongside the PayPal flow in
// paypal.functions.ts, for BOTH plans (Sona Purple and Sona Business).
// Kept as its own file/functions rather than merged into paypal.functions.ts
// since the two providers have unrelated APIs; the shape (start -> redirect
// -> capture-on-return -> flip a profiles flag) intentionally mirrors the
// PayPal functions so paypal-return.tsx's pattern could be copied almost
// verbatim for stripe-return.tsx.
//
// No `stripe` npm package is used here — same choice as paypal.functions.ts
// (raw fetch against the REST API) to avoid adding an SDK dependency for
// what's really just two HTTP calls.
//
// Required server env vars (Vercel -> Project Settings -> Environment
// Variables — server-only, never prefix with VITE_):
//   STRIPE_SECRET_KEY              — sk_test_... or sk_live_...
//   STRIPE_PRICE_MONTHLY_USD       — e.g. "1.99"  (Sona Purple, monthly)
//   STRIPE_PRICE_YEARLY_USD        — e.g. "14.99" (Sona Purple, yearly)
//   STRIPE_PRICE_BUSINESS_MONTHLY_USD — e.g. "9.99"
//   STRIPE_PRICE_BUSINESS_YEARLY_USD  — e.g. "89.99"
//
// NOTE on robustness: like the existing PayPal flow, this verifies payment
// by retrieving the Checkout Session when the buyer is redirected back to
// the app (see stripe-return.tsx), not via a webhook. That matches the
// pattern already used everywhere else in this codebase, but it does mean
// a payment that completes without the buyer's browser ever returning
// (closed tab, crashed browser, some async payment methods) won't flip the
// flag. If that turns out to matter in practice, add a
// `checkout.session.completed` webhook route as a second, more reliable
// path to the same profiles update — safe to layer on top of this later
// since it writes the exact same field.
// ─────────────────────────────────────────────────────────────────────────

type Plan = "purple" | "business";
type Interval = "monthly" | "yearly";

const PLAN_LABEL: Record<Plan, string> = {
  purple: "Sona Purple",
  business: "Sona Business verification",
};

const PLAN_ENV_PREFIX: Record<Plan, string> = {
  purple: "STRIPE_PRICE",
  business: "STRIPE_PRICE_BUSINESS",
};

function priceFor(plan: Plan, interval: Interval): string {
  const key = `${PLAN_ENV_PREFIX[plan]}_${interval === "yearly" ? "YEARLY" : "MONTHLY"}_USD`;
  const amount = process.env[key];
  if (!amount) {
    throw new Error(`${key} is not set. Ask the app owner to add it.`);
  }
  return amount;
}

function stripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set. Ask the app owner to add it.");
  return key;
}

async function stripeRequest<T>(path: string, params: Record<string, string>, method: "GET" | "POST" = "POST"): Promise<T> {
  const url = method === "GET"
    ? `https://api.stripe.com/v1/${path}?${new URLSearchParams(params)}`
    : `https://api.stripe.com/v1/${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${stripeSecretKey()}`,
      ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: method === "POST" ? new URLSearchParams(params) : undefined,
  });
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(json.error?.message || "Stripe request failed");
  return json;
}

// Step 1 — create a Checkout Session and hand back its URL to redirect to.
// Price is defined inline (price_data) rather than a pre-created Stripe
// Dashboard Product/Price, so there's nothing to set up in Stripe beyond
// the secret key — the price comes straight from the same env vars pattern
// PayPal uses.
export const startStripeCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { plan?: Plan; interval?: Interval } | undefined) => ({
    plan: data?.plan === "business" ? ("business" as const) : ("purple" as const),
    interval: data?.interval === "yearly" ? ("yearly" as const) : ("monthly" as const),
  }))
  .handler(async ({ context, data }) => {
    const amount = priceFor(data.plan, data.interval);
    const unitAmountCents = Math.round(parseFloat(amount) * 100);
    if (!Number.isFinite(unitAmountCents) || unitAmountCents <= 0) {
      throw new Error(`Configured price for ${data.plan}/${data.interval} is invalid: "${amount}"`);
    }

    const origin = process.env.APP_ORIGIN || "https://sonatg.lovable.app";

    const session = await stripeRequest<{ id?: string; url?: string }>("checkout/sessions", {
      mode: "payment",
      "payment_method_types[0]": "card",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(unitAmountCents),
      "line_items[0][price_data][product_data][name]": `${PLAN_LABEL[data.plan]} — ${data.interval} plan`,
      client_reference_id: context.userId,
      "metadata[plan]": data.plan,
      "metadata[interval]": data.interval,
      "metadata[userId]": context.userId,
      success_url: `${origin}/stripe-return?session_id={CHECKOUT_SESSION_ID}&plan=${data.plan}`,
      cancel_url: `${origin}/stripe-return?cancelled=1&plan=${data.plan}`,
    });

    if (!session.id || !session.url) throw new Error("Stripe did not return a Checkout Session URL");
    return { sessionId: session.id, url: session.url };
  });

// Step 2 — called from /stripe-return once the buyer completes (or leaves)
// the hosted Checkout page. Confirms payment_status === "paid" and that the
// session was created for this signed-in user, then flips the same
// profiles flag the equivalent PayPal capture function does.
export const captureStripeSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { sessionId: string }) => data)
  .handler(async ({ context, data }) => {
    const session = await stripeRequest<{
      payment_status?: string;
      client_reference_id?: string;
      customer?: string | null;
      metadata?: { plan?: string; interval?: string };
    }>(`checkout/sessions/${data.sessionId}`, {}, "GET");

    const plan: Plan = session.metadata?.plan === "business" ? "business" : "purple";
    const interval: Interval = session.metadata?.interval === "yearly" ? "yearly" : "monthly";
    const paidForThisUser = session.client_reference_id === context.userId;

    if (session.payment_status !== "paid" || !paidForThisUser) {
      throw new Error("Payment was not completed. No changes were made to your account.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update(plan === "business" ? { is_business: true } : { is_pro: true })
      .eq("id", context.userId);
    if (error) throw new Error(`Payment succeeded but updating your account failed: ${error.message}`);

    // Business isn't tracked in `subscriptions` (that table's tier column
    // is Purple/free only — see the 20260715014025 migration) — only
    // record a renewal date for Purple.
    if (plan === "purple") {
      await recordSubscriptionPeriod({
        userId: context.userId,
        provider: "stripe",
        interval,
        providerCustomerId: session.customer ?? null,
      });
    }

    return { success: true as const, plan };
  });
