import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ─────────────────────────────────────────────────────────────────────────
// PayPal checkout for Sona Purple, alongside the existing Paystack flow
// (see src/lib/paystack.functions.ts). PayPal doesn't settle in ZAR, so
// this charges in USD — set PAYPAL_PRICE_MONTHLY / PAYPAL_PRICE_YEARLY to
// whatever your ZAR price converts to (update occasionally; PayPal has no
// live FX endpoint on the Orders API).
//
// Required server env vars (Vercel -> Project Settings -> Environment
// Variables — never prefix these with VITE_, they must stay server-only):
//   PAYPAL_CLIENT_ID       — from developer.paypal.com -> your app
//   PAYPAL_CLIENT_SECRET   — same app, "Secret" tab
//   PAYPAL_ENV             — "sandbox" (default) or "live"
//   PAYPAL_PRICE_MONTHLY   — e.g. "1.99" (USD, no currency symbol)
//   PAYPAL_PRICE_YEARLY    — e.g. "14.99"
//
// Flow: startPaypalCheckout creates an Order and returns the buyer's
// approval URL -> the browser redirects there -> PayPal sends the buyer
// back to /paypal-return?token=<orderId> -> that route calls
// capturePaypalOrder, which captures the funds and flips profiles.is_pro
// to true using the service-role client (bypassing RLS, same pattern as
// deleteMyAccount in account.functions.ts).
// ─────────────────────────────────────────────────────────────────────────

const PAYPAL_API_BASE = {
  sandbox: "https://api-m.sandbox.paypal.com",
  live: "https://api-m.paypal.com",
} as const;

function paypalBaseUrl() {
  const env = process.env.PAYPAL_ENV === "live" ? "live" : "sandbox";
  return PAYPAL_API_BASE[env];
}

async function getPaypalAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are not set. Ask the app owner to add them.");
  }

  const res = await fetch(`${paypalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });
  const json = (await res.json()) as { access_token?: string; error_description?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || "Failed to authenticate with PayPal");
  }
  return json.access_token;
}

// Step 1 — create the order and hand back the approval URL to redirect to.
export const startPaypalCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { interval?: "monthly" | "yearly" } | undefined) => ({
    interval: data?.interval === "yearly" ? ("yearly" as const) : ("monthly" as const),
  }))
  .handler(async ({ context, data }) => {
    const amount =
      data.interval === "yearly"
        ? process.env.PAYPAL_PRICE_YEARLY
        : process.env.PAYPAL_PRICE_MONTHLY;
    if (!amount) {
      throw new Error(
        `PAYPAL_PRICE_${data.interval === "yearly" ? "YEARLY" : "MONTHLY"} is not set. Ask the app owner to add it.`
      );
    }

    const accessToken = await getPaypalAccessToken();
    const origin = process.env.APP_ORIGIN || "https://sonatg.lovable.app";

    const res = await fetch(`${paypalBaseUrl()}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            custom_id: context.userId, // carried through to the capture response
            description: `Sona Purple — ${data.interval} plan`,
            amount: { currency_code: "USD", value: amount },
          },
        ],
        application_context: {
          brand_name: "Sona",
          user_action: "PAY_NOW",
          return_url: `${origin}/paypal-return?interval=${data.interval}`,
          cancel_url: `${origin}/paypal-return?cancelled=1`,
        },
      }),
    });

    const json = (await res.json()) as {
      id?: string;
      links?: { rel: string; href: string }[];
      message?: string;
    };
    if (!res.ok || !json.id) throw new Error(json.message || "PayPal order creation failed");

    const approvalUrl = json.links?.find((l) => l.rel === "approve")?.href;
    if (!approvalUrl) throw new Error("PayPal did not return an approval link");

    return { orderId: json.id, url: approvalUrl };
  });

// Step 2 — called from /paypal-return once the buyer approves the payment.
// Captures the funds and, only on a confirmed COMPLETED capture, upgrades
// the signed-in user to Purple.
export const capturePaypalOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orderId: string }) => data)
  .handler(async ({ context, data }) => {
    const accessToken = await getPaypalAccessToken();

    const res = await fetch(`${paypalBaseUrl()}/v2/checkout/orders/${data.orderId}/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const json = (await res.json()) as {
      status?: string;
      purchase_units?: { custom_id?: string; payments?: { captures?: { status?: string }[] } }[];
      message?: string;
      name?: string;
    };

    if (json.name === "UNPROCESSABLE_ENTITY" || !res.ok) {
      throw new Error(json.message || "PayPal capture failed");
    }

    const capture = json.purchase_units?.[0]?.payments?.captures?.[0];
    const paidForThisUser = json.purchase_units?.[0]?.custom_id === context.userId;

    if (json.status !== "COMPLETED" || capture?.status !== "COMPLETED" || !paidForThisUser) {
      throw new Error("Payment was not completed. No changes were made to your account.");
    }

    // Use the service-role client for this write (same pattern as
    // deleteMyAccount in account.functions.ts) rather than the RLS-scoped
    // client from requireSupabaseAuth, so the upgrade only ever happens
    // from this server-verified capture path, not from an arbitrary
    // client-side update to the profiles row.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ is_pro: true })
      .eq("id", context.userId);
    if (error) throw new Error(`Payment succeeded but upgrading your account failed: ${error.message}`);

    return { success: true as const };
  });
