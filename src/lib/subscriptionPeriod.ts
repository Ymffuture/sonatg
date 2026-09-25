// Small shared helper used by every payment provider's server-verified
// capture handler (paypal.functions.ts, stripe.functions.ts) to record a
// renewal date + provider on the `subscriptions` table once a Sona Purple
// payment is confirmed. Kept separate from the individual provider files
// since it has nothing provider-specific in it and both need the exact
// same logic — duplicating it risked the two drifting (e.g. one rounding
// "yearly" to 365 days, the other to 12 calendar months).
//
// NOTE: this is intentionally only wired into flows that verify payment
// server-side before flipping profiles.is_pro (currently PayPal capture and
// Stripe checkout-session retrieval). The existing Paystack Purple flow
// redirects straight to `/?upgraded=1` with no server-side verification
// step at all (see paystack.functions.ts's startPaystackCheckout comment),
// so there's nothing here to hook a subscriptions write into yet — a user
// who upgraded via Paystack will have is_pro=true but no `subscriptions`
// row, which the Settings UI handles by falling back to a generic message
// instead of a specific renewal date.

export type BillingInterval = "monthly" | "yearly";
export type SubscriptionProvider = "paypal" | "stripe" | "paystack";

/** ISO timestamp for "now + 1 month" or "now + 1 year", calendar-aware (not a fixed 30/365-day offset). */
export function nextPeriodEnd(interval: BillingInterval, from: Date = new Date()): string {
  const d = new Date(from);
  if (interval === "yearly") {
    d.setFullYear(d.getFullYear() + 1);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString();
}

/**
 * Upserts the caller's Purple subscription row. Uses the service-role
 * client (same pattern as the profiles.is_pro update right next to every
 * call site of this function) since it must succeed regardless of the
 * `subscriptions` table's "own sub read"-only RLS policy — there is no
 * client-side insert/update policy on this table by design, so this must
 * always run server-side, right after the payment is confirmed.
 */
export async function recordSubscriptionPeriod(params: {
  userId: string;
  provider: SubscriptionProvider;
  interval: BillingInterval;
  providerCustomerId?: string | null;
}): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("subscriptions").upsert(
    {
      user_id: params.userId,
      tier: "pro",
      provider: params.provider,
      provider_customer_id: params.providerCustomerId ?? null,
      current_period_end: nextPeriodEnd(params.interval),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  // Deliberately not thrown: the payment already succeeded and profiles.is_pro
  // is the source of truth for access — a failure to record the *display*
  // details (renewal date/provider) shouldn't roll back or fail the upgrade.
  if (error) {
    console.error("[recordSubscriptionPeriod] failed to upsert subscriptions row:", error.message);
  }
}
