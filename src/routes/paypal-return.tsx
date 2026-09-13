import { useEffect, useState } from "react";
import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { capturePaypalOrder } from "@/lib/paypal.functions";

// PayPal redirects the buyer here with ?token=<orderId>&PayerID=... on
// success, or ?cancelled=1 if they back out of the approval page. `token`
// IS the order id created by startPaypalCheckout — no need to store it
// client-side between the two steps.
export const Route = createFileRoute("/paypal-return")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : undefined,
    cancelled: search.cancelled === "1",
  }),
  component: PaypalReturnPage,
});

type Status = "capturing" | "success" | "error" | "cancelled";

function PaypalReturnPage() {
  const { token, cancelled } = useSearch({ from: "/paypal-return" });
  const captureOrder = useServerFn(capturePaypalOrder);
  const [status, setStatus] = useState<Status>(cancelled ? "cancelled" : "capturing");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    if (cancelled || !token) return;
    let cancelledEffect = false;
    (async () => {
      try {
        await captureOrder({ data: { orderId: token } });
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
  }, [token, cancelled, captureOrder]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#FFFDF9] px-6 text-center dark:bg-[#0F0F11]">
      {status === "capturing" && (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-[#8B5CF6]" />
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Confirming your PayPal payment…</p>
        </>
      )}
      {status === "success" && (
        <>
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">You're on Sona Purple 🎉</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Your account has been upgraded.</p>
          <Link to="/" className="mt-2 rounded-2xl bg-[#8B5CF6] px-5 py-2.5 text-sm font-bold text-white">
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
      {status === "cancelled" && (
        <>
          <XCircle className="h-10 w-10 text-zinc-400" />
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Checkout cancelled</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No payment was taken.</p>
          <Link to="/" className="mt-2 rounded-2xl bg-zinc-900 px-5 py-2.5 text-sm font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
            Back to Sona
          </Link>
        </>
      )}
    </main>
  );
}
