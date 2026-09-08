import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, Crown, Sparkles } from "lucide-react";
import { PRICING } from "@/lib/pricing";
import { FREE_CHAT_LIMIT, FREE_DAILY_MESSAGE_LIMIT, FREE_PIN_LIMIT } from "@/lib/planLimits";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Sona Purple pricing — plans, billing and cancelling" },
      {
        name: "description",
        content:
          "Sona Purple costs R28.99 a month or R227.88 a year (R18.99 a month, 66% off). See what's in the free plan, what Purple unlocks, and how to cancel.",
      },
      { property: "og:title", content: "Sona Purple pricing" },
      { property: "og:description", content: "R28.99 a month or R227.88 a year. Compare the free plan and Sona Purple, and learn how to cancel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PricingPage,
});

const freeFeatures = [
  `Up to ${FREE_CHAT_LIMIT} chats`,
  `${FREE_DAILY_MESSAGE_LIMIT} messages a day`,
  `Pin up to ${FREE_PIN_LIMIT} chats`,
  "Photos, voice notes and files",
  "Status updates and reactions",
  "Group chats and invite links",
];

const purpleFeatures = [
  "Unlimited chats and messages",
  "Pin as many chats as you like",
  "Voice and video calls",
  "AI chat summaries with Sona",
  "Hidden, encrypted chats",
  "Premium themes and chat backgrounds",
  "Export your chats (JSON / PDF)",
  "Larger photo, video and file uploads",
];

function PricingPage() {
  return (
    <main className="min-h-screen bg-[#FFFDF9] text-zinc-900 dark:bg-[#141414] dark:text-zinc-100">
      <div className="mx-auto w-full max-w-4xl px-5 py-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
          <ArrowLeft className="h-4 w-4" /> Back to Sona
        </Link>

        <header className="mt-8 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#8B5CF6]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#8B5CF6]">
            <Crown className="h-3.5 w-3.5" /> Sona Purple
          </span>
          <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Simple pricing, no surprises</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
            Start free. Upgrade to Purple whenever you want more chats, calls and AI help. Cancel any time.
          </p>
        </header>

        <section className="mt-10 grid gap-5 sm:grid-cols-2">
          <div className="rounded-3xl border border-zinc-200 bg-white/70 p-6 dark:border-zinc-800 dark:bg-zinc-900/50">
            <h2 className="text-lg font-bold">Free</h2>
            <p className="mt-1 text-3xl font-black">R0<span className="text-sm font-semibold text-zinc-500">/month</span></p>
            <ul className="mt-5 space-y-2.5 text-sm">
              {freeFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                  <span className="text-zinc-700 dark:text-zinc-300">{f}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-[#8B5CF6]/30 bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-orange-500/5 p-6 shadow-xl">
            <span className="absolute right-5 top-5 rounded-full bg-[#8B5CF6] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
              {PRICING.yearly.savePercent}% off yearly
            </span>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Sparkles className="h-4 w-4 text-[#8B5CF6]" /> Purple
            </h2>
            <p className="mt-1 text-3xl font-black">
              {PRICING.monthly.label}
              <span className="text-sm font-semibold text-zinc-500">{PRICING.monthly.per}</span>
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              or <strong>{PRICING.yearly.label}{PRICING.yearly.per}</strong> — that's {PRICING.yearly.perMonthLabel} a month.
            </p>
            <ul className="mt-5 space-y-2.5 text-sm">
              {purpleFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#8B5CF6]" />
                  <span className="text-zinc-700 dark:text-zinc-300">{f}</span>
                </li>
              ))}
            </ul>
            <Link
              to="/"
              className="mt-6 block w-full rounded-2xl bg-[#8B5CF6] px-4 py-3 text-center text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition hover:-translate-y-0.5 hover:bg-[#7c3aed]"
            >
              Upgrade in Settings → Subscription
            </Link>
          </div>
        </section>

        <section className="mt-12 space-y-6 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">How billing works</h2>
            <p className="mt-2">
              Payments are handled securely by Paystack in South African Rand. Monthly plans renew every month on the day you
              subscribed; yearly plans renew once a year. Purple features unlock as soon as your payment goes through.
            </p>
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Cancelling your plan</h2>
            <p className="mt-2">
              You can cancel any time — open <strong>Settings → Subscription</strong> in Sona and choose <strong>Cancel plan</strong>,
              or use the manage-subscription link in the receipt email from Paystack. You keep Purple until the end of the period
              you already paid for, then your account moves back to the free plan. Nothing is deleted: your chats and media stay,
              but the free limits ({FREE_CHAT_LIMIT} chats, {FREE_DAILY_MESSAGE_LIMIT} messages a day, {FREE_PIN_LIMIT} pinned chats) apply again.
            </p>
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Refunds</h2>
            <p className="mt-2">
              Payments already taken aren't refunded, but cancelling stops all future charges immediately. If something went
              wrong with a charge, contact us and we'll sort it out.
            </p>
          </div>
          <p className="text-xs text-zinc-500">
            See our <Link to="/terms" className="underline">Terms</Link> and <Link to="/privacy" className="underline">Privacy Policy</Link> for the full details.
          </p>
        </section>
      </div>
    </main>
  );
}
