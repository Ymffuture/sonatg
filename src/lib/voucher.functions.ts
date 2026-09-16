import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ─────────────────────────────────────────────────────────────────────────
// Voucher/gift-code redemption — a payment-free way to get Sona Purple OR
// Sona Business, alongside Paystack and PayPal. There's no external
// payment API here: an admin mints codes in-app (see the "Vouchers" tab in
// the admin console, src/features/adimn/vouchers.ts) via the
// generate_vouchers() SQL function, sells or gifts them however, and the
// buyer redeems the code here.
//
// All the validation (code exists, not already used, not expired) and the
// actual is_pro / is_business flip happen atomically inside the
// security-definer redeem_voucher() Postgres function (see the
// 20260916100000_business_vouchers.sql migration, which supersedes the
// original plan-specific redeem_purple_voucher()), so this server fn is
// mostly a thin, auth-checked wrapper around one RPC call. Using the
// user's own RLS-scoped client (from requireSupabaseAuth) is fine here —
// the function runs as SECURITY DEFINER and grants EXECUTE only to
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
    const { data: rows, error } = await context.supabase.rpc("redeem_voucher", {
      _code: data.code,
    });

    if (error) {
      // Postgres exceptions raised inside the function land here with
      // the message we wrote in the migration (invalid/used/expired).
      throw new Error(error.message || "That code didn't work. Double-check it and try again.");
    }

    const row = (rows as { plan: string; interval: string }[] | null)?.[0];
    return {
      success: true as const,
      plan: row?.plan === "business" ? ("business" as const) : ("purple" as const),
      interval: row?.interval === "yearly" ? "yearly" : "monthly",
    };
  });
