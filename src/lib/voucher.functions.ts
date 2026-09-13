import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ─────────────────────────────────────────────────────────────────────────
// Voucher/gift-code redemption — a third way to get Sona Purple alongside
// Paystack and PayPal. There's no external payment API here: the app
// owner (or a reseller) mints codes out-of-band with the
// generate_purple_vouchers() SQL function (see the
// 20260913030000_purple_vouchers.sql migration), sells or gifts them
// however, and the buyer redeems the code in-app.
//
// All the validation (code exists, not already used, not expired) and the
// actual is_pro flip happen atomically inside the security-definer
// redeem_purple_voucher() Postgres function, so this server fn is mostly
// a thin, auth-checked wrapper around one RPC call. Using the user's own
// RLS-scoped client (from requireSupabaseAuth) is fine here — the
// function runs as SECURITY DEFINER and grants EXECUTE only to
// `authenticated`, so no service-role key is needed for this one.
// ─────────────────────────────────────────────────────────────────────────

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export const redeemVoucher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { code: string }) => {
    const code = normalizeCode(data?.code ?? "");
    if (!code) throw new Error("Enter a voucher code first.");
    return { code };
  })
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase.rpc("redeem_purple_voucher", {
      _code: data.code,
    });

    if (error) {
      // Postgres exceptions raised inside the function land here with
      // the message we wrote in the migration (invalid/used/expired).
      throw new Error(error.message || "That code didn't work. Double-check it and try again.");
    }

    const interval = (rows as { interval: string }[] | null)?.[0]?.interval;
    return { success: true as const, interval: interval === "yearly" ? "yearly" : "monthly" };
  });
