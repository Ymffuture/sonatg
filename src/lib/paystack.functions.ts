import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Initialize a Paystack subscription checkout for the current user.
// Requires PAYSTACK_SECRET_KEY and PAYSTACK_PLAN_CODE_MONTHLY server env.
export const startPaystackCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    const plan = process.env.PAYSTACK_PLAN_CODE_MONTHLY;
    if (!secret) throw new Error("PAYSTACK_SECRET_KEY is not set. Ask the app owner to add it.");
    if (!plan) throw new Error("PAYSTACK_PLAN_CODE_MONTHLY is not set. Ask the app owner to add it.");

    const email = (context.claims as { email?: string } | undefined)?.email;
    if (!email) throw new Error("Missing email on session");

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
