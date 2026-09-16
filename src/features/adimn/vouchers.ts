// src/features/admin/vouchers.ts
// Thin client wrapper for the admin "Vouchers" tab. Minting goes through
// the generate_vouchers RPC rather than a raw insert, so the admin-role
// check lives in the database (see has_role() inside the function), not
// just in the UI. Listing relies on the "Admins can view vouchers" RLS
// policy. See supabase/migrations/20260916100000_business_vouchers.sql.

import { supabase } from "@/integrations/supabase/client";

export type VoucherPlan = "purple" | "business";
export type VoucherInterval = "monthly" | "yearly";

export type VoucherRow = {
  code: string;
  plan: VoucherPlan;
  interval: VoucherInterval;
  redeemed_by: string | null;
  redeemed_at: string | null;
  expires_at: string | null;
  created_at: string;
};

export async function generateVouchers(
  plan: VoucherPlan,
  interval: VoucherInterval,
  count: number,
  expiresAt?: Date | null,
): Promise<string[]> {
  const { data, error } = await supabase.rpc("generate_vouchers", {
    _plan: plan,
    _interval: interval,
    _count: count,
    _expires_at: expiresAt ? expiresAt.toISOString() : null,
  });
  if (error) throw error;
  return (data as string[] | null) ?? [];
}

export async function fetchVouchers(): Promise<VoucherRow[]> {
  const { data, error } = await supabase
    .from("vouchers")
    .select("code, plan, interval, redeemed_by, redeemed_at, expires_at, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as VoucherRow[];
}
