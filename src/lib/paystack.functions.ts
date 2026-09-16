import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ─────────────────────────────────────────────────────────────────────────
// Paystack checkout for BOTH plans — Sona Purple (existing, unchanged
// below) and Sona Business (new). Same PAYSTACK_SECRET_KEY is reused for
// both since it's tied to the Sona business account on Paystack, not to a
// particular plan — Paystack scopes a secret key to the account, not to a
// product. Only the price differs between the two.
//
// Purple keeps using a pre-created Paystack "Plan" (a recurring plan code
// from the Paystack dashboard: Plans -> Create Plan), since it's a
// subscription. Business uses a one-off `amount` instead of a plan code —
// simplest way to charge an independent, changeable price without having
// to keep a second set of Paystack dashboard plans in sync. If Business
// ever needs to auto-renew via Paystack itself, swap `amount` for a second
// pair of plan codes the same way Purple does.
//
// Required server env vars (Vercel -> Project Settings -> Environment
// Variables — server-only, never prefix with VITE_):
//   PAYSTACK_SECRET_KEY               — sk_test_... or sk_live_... (shared)
//   PAYSTACK_PLAN_CODE_MONTHLY        — Purple, existing
//   PAYSTACK_PLAN_CODE_YEARLY         — Purple, existing (optional)
//   PAYSTACK_BUSINESS_PRICE_MONTHLY_ZAR — e.g. "179.99" (Business, new)
//   PAYSTACK_BUSINESS_PRICE_YEARLY_ZAR  — e.g. "1619.88" (Business, new)
// ─────────────────────────────────────────────────────────────────────────

function paystackSecret(): string {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw new Error("PAYSTACK_SECRET_KEY is not set. Ask the app owner to add it.");
  return secret;
}

function emailFromContext(context: { claims?: unknown }): string {
  const email = (context.claims as { email?: string } | undefined)?.email;
  if (!email) throw new Error("Missing email on session");
  return email;
}

// Initialize a Paystack subscription checkout for the current user — Sona
// Purple. Unchanged from before, aside from the shared paystackSecret()
// helper factored out above.
export const startPaystackCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { interval?: "monthly" | "yearly" } | undefined) => ({
    interval: data?.interval === "yearly" ? ("yearly" as const) : ("monthly" as const),
  }))
  .handler(async ({ context, data }) => {
    const secret = paystackSecret();
    const plan =
      data.interval === "yearly"
        ? process.env.PAYSTACK_PLAN_CODE_YEARLY || process.env.PAYSTACK_PLAN_CODE_MONTHLY
        : process.env.PAYSTACK_PLAN_CODE_MONTHLY;
    if (!plan) throw new Error("PAYSTACK_PLAN_CODE_MONTHLY is not set. Ask the app owner to add it.");

    const email = emailFromContext(context);
    const origin = process.env.APP_ORIGIN || "https://sonatg.lovable.app";
    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify({
        email,
        plan,
        callback_url: `${origin}/?upgraded=1`,
        metadata: { user_id: context.userId, purpose: "sona_pro_monthly" },
      }),
    });
    const json = await res.json() as { status: boolean; message: string; data?: { authorization_url: string; reference: string } };
    if (!json.status || !json.data) throw new Error(json.message || "Paystack init failed");
    return { url: json.data.authorization_url, reference: json.data.reference };
  });

// Initialize a Paystack checkout for the current user — Sona Business
// verification. Uses a plain `amount` (in the smallest currency unit —
// kobo/cents, i.e. ZAR * 100) instead of a plan code, since Business is
// priced independently of Purple and isn't set up as a recurring Paystack
// Plan. Verified on return via paystack-return.tsx -> verifyPaystackBusiness
// below (the same "verify on return" shape the removed Stripe flow used).
export const startPaystackBusinessCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { interval?: "monthly" | "yearly" } | undefined) => ({
    interval: data?.interval === "yearly" ? ("yearly" as const) : ("monthly" as const),
  }))
  .handler(async ({ context, data }) => {
    const secret = paystackSecret();
    const amountKey = data.interval === "yearly" ? "PAYSTACK_BUSINESS_PRICE_YEARLY_ZAR" : "PAYSTACK_BUSINESS_PRICE_MONTHLY_ZAR";
    const amountZar = process.env[amountKey];
    if (!amountZar) throw new Error(`${amountKey} is not set. Ask the app owner to add it.`);
    const amountCents = Math.round(parseFloat(amountZar) * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      throw new Error(`Configured Business price for ${data.interval} is invalid: "${amountZar}"`);
    }

    const email = emailFromContext(context);
    const origin = process.env.APP_ORIGIN || "https://sonatg.lovable.app";
    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify({
        email,
        amount: amountCents,
        currency: "ZAR",
        callback_url: `${origin}/paystack-return?plan=business&interval=${data.interval}`,
        metadata: { user_id: context.userId, purpose: "sona_business", plan: "business", interval: data.interval },
      }),
    });
    const json = await res.json() as { status: boolean; message: string; data?: { authorization_url: string; reference: string } };
    if (!json.status || !json.data) throw new Error(json.message || "Paystack init failed");
    return { url: json.data.authorization_url, reference: json.data.reference };
  });

// Called from /paystack-return once Paystack redirects the buyer back —
// verifies the transaction actually succeeded server-side (never trust the
// redirect query string alone) and, only then, flips profiles.is_business
// for this user.
export const verifyPaystackBusiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { reference: string }) => data)
  .handler(async ({ context, data }) => {
    const secret = paystackSecret();
    const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(data.reference)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const json = await res.json() as {
      status: boolean;
      message: string;
      data?: { status?: string; metadata?: { user_id?: string; plan?: string } };
    };
    if (!json.status || !json.data) throw new Error(json.message || "Paystack verification failed");

    const paidForThisUser = json.data.metadata?.user_id === context.userId;
    if (json.data.status !== "success" || !paidForThisUser) {
      throw new Error("Payment was not completed. No changes were made to your account.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("profiles").update({ is_business: true }).eq("id", context.userId);
    if (error) throw new Error(`Payment succeeded but updating your account failed: ${error.message}`);

    return { success: true as const };
  });
