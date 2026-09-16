import { useEffect, useState } from "react";
import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { verifyPaystackBusiness } from "@/lib/paystack.functions";

// Paystack redirects the buyer here with ?reference=... on completion
// (success or failure — Paystack doesn't distinguish via query params the
// way PayPal/Stripe do), appended by startPaystackBusinessCheckout's
// callback_url. The Purple plan's Paystack flow redirects straight to
// `/?upgraded=1` instead (see paystack.functions.ts) since it's a
// dashboard-managed Plan subscription that Paystack itself confirms before
// redirecting; Business uses a one-off `amount` charge, so this route
// verifies the transaction server-side before flipping is_business.
export const Route = createFileRoute("/paystack-return")({
  validateSearch: (search: Record<string, unknown>) => ({
    reference: typeof search.reference === "string" ? search.reference : undefined,
    plan: search.plan === "business" ? ("business" as const) : ("business" as const),
  }),
  component: PaystackReturnPage,
});

type Status = "capturing" | "success" | "error";

function PaystackReturnPage() {
  const { reference } = useSearch({ from: "/paystack-return" });
  const verifyBusiness = useServerFn(verifyPaystackBusiness);
  const [status, setStatus] = useState<Status>(reference ? "capturing" : "error");
  const [message, setMessage] = useState<string>(reference ? "" : "Missing payment reference.");

  useEffect(() => {
    if (!reference) return;
    let cancelledEffect = false;
    (async () => {
      try {
        await verifyBusiness({ data: { reference } });
        if (!cancelledEffect) setStatus("success");
      } catch (e) {
        if (!cancelledEffect) {
          setStatus("error");
          setMessage((e as Error).message || "Something went wrong finishing your payment.");
        }
      }
    })();
    return () => {
      cancelledEffect = true;
    };
  }, [reference, verifyBusiness]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#FFFDF9] px-6 text-center dark:bg-[#0F0F11]">
      {status === "capturing" && (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Confirming your Paystack payment…</p>
        </>
      )}
      {status === "success" && (
        <>
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Your business is verified 🎉</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            You can now send ad messages and your profile shows the verified business badge.
          </p>
          <Link to="/" className="mt-2 rounded-2xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white">
            Back to Sona
          </Link>
        </>
      )}
      {status === "error" && (
        <>
          <XCircle className="h-10 w-10 text-red-500" />
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Payment couldn't be confirmed</h1>
          <p className="max-w-sm text-sm text-zinc-600 dark:text-zinc-400">{message}</p>
          <Link to="/" className="mt-2 rounded-2xl bg-zinc-900 px-5 py-2.5 text-sm font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
            Back to Sona
          </Link>
        </>
      )}
    </main>
  );
}
