import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, Crown, Sparkles, ShieldCheck, Zap } from "lucide-react";
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
    <main className="relative min-h-screen bg-[#FFFDF9] text-zinc-900 dark:bg-[#0F0F11] dark:text-zinc-100 transition-colors duration-300">
      {/* Subtle ambient background gradient for premium feel */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-100/40 via-transparent to-transparent dark:from-purple-900/10" />
      
      <div className="relative mx-auto w-full max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
        <Link 
          to="/" 
          className="group inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/80 px-4 py-2 text-sm font-semibold text-zinc-600 backdrop-blur-md transition-all hover:border-zinc-300 hover:text-zinc-900 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-100"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" /> 
          Back to Sona
        </Link>

        <header className="mt-12 text-center sm:mt-16">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#8B5CF6]/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-widest text-[#8B5CF6] ring-1 ring-inset ring-[#8B5CF6]/20 dark:bg-[#8B5CF6]/15 dark:ring-[#8B5CF6]/30">
            <Crown className="h-3.5 w-3.5" /> Sona Purple
          </span>
          <h1 className="mt-6 text-4xl font-black tracking-tight text-zinc-900 dark:text-white sm:text-5xl">
            Simple pricing, <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#8B5CF6] to-[#E07A5F]">no surprises</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
            Start free. Upgrade to Purple whenever you want more chats, calls and AI help. Cancel any time.
          </p>
        </header>

        <section className="mt-12 grid gap-6 sm:mt-16 sm:grid-cols-2">
          {/* Free Plan */}
          <div className="group relative flex flex-col rounded-3xl border border-zinc-200 bg-white/60 p-8 backdrop-blur-xl transition-all hover:border-zinc-300 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:border-zinc-700 dark:hover:shadow-zinc-900/50">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                <Zap className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Free</h2>
            </div>
            <div className="mt-6 flex items-baseline gap-1">
              <span className="text-4xl font-black text-zinc-900 dark:text-white">R0</span>
              <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">/month</span>
            </div>
            <ul className="mt-8 flex-1 space-y-4 text-sm">
              {freeFeatures.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <Check className="h-3 w-3 text-zinc-600 dark:text-zinc-400" />
                  </div>
                  <span className="text-zinc-700 dark:text-zinc-300">{f}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Purple Plan */}
          <div className="group relative flex flex-col overflow-hidden rounded-3xl border border-[#8B5CF6]/30 bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-orange-500/5 p-8 shadow-2xl shadow-purple-500/10 transition-all hover:shadow-purple-500/20 dark:border-[#8B5CF6]/40 dark:from-violet-500/15 dark:via-purple-500/10 dark:to-orange-500/10 dark:shadow-purple-900/20">
            {/* Ambient glow effect */}
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#8B5CF6]/20 blur-3xl" />
            
            <span className="absolute right-5 top-5 rounded-full bg-[#8B5CF6] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg shadow-purple-500/30">
              {PRICING.yearly.savePercent}% off yearly
            </span>
            
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#8B5CF6]/20 text-[#8B5CF6] ring-1 ring-inset ring-[#8B5CF6]/30">
                <Sparkles className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Purple</h2>
            </div>
            
            <div className="mt-6 flex items-baseline gap-1">
              <span className="text-4xl font-black text-zinc-900 dark:text-white">{PRICING.monthly.label}</span>
              <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">{PRICING.monthly.per}</span>
            </div>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              or <strong className="text-zinc-900 dark:text-zinc-100">{PRICING.yearly.label}{PRICING.yearly.per}</strong> — that's <strong className="text-[#8B5CF6]">{PRICING.yearly.perMonthLabel}</strong> a month.
            </p>
            
            <ul className="mt-8 flex-1 space-y-4 text-sm">
              {purpleFeatures.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#8B5CF6]/15 ring-1 ring-inset ring-[#8B5CF6]/20 dark:bg-[#8B5CF6]/20">
                    <Check className="h-3 w-3 text-[#8B5CF6]" />
                  </div>
                  <span className="text-zinc-800 dark:text-zinc-200">{f}</span>
                </li>
              ))}
            </ul>

            <Link
              to="/"
              className="mt-8 block w-full rounded-2xl bg-[#8B5CF6] px-4 py-3.5 text-center text-sm font-bold text-white shadow-lg shadow-purple-500/25 transition-all hover:-translate-y-0.5 hover:bg-[#7c3aed] hover:shadow-purple-500/40 active:translate-y-0"
            >
              Upgrade in Settings → Subscription
            </Link>
          </div>
        </section>

        <section className="mt-16 space-y-8 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 sm:mt-20">
          <div className="rounded-2xl border border-zinc-200 bg-white/50 p-6 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/30">
            <h2 className="flex items-center gap-2 text-base font-bold text-zinc-900 dark:text-zinc-100">
              <ShieldCheck className="h-5 w-5 text-[#8B5CF6]" /> How billing works
            </h2>
            <p className="mt-3">
              Payments are handled securely by Paystack in South African Rand. Monthly plans renew every month on the day you
              subscribed; yearly plans renew once a year. Purple features unlock as soon as your payment goes through.
            </p>
          </div>
          
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Cancelling your plan</h2>
              <p className="mt-3">
                You can cancel any time — open <strong className="text-zinc-900 dark:text-zinc-100">Settings → Subscription</strong> in Sona and choose <strong className="text-zinc-900 dark:text-zinc-100">Cancel plan</strong>,
                or use the manage-subscription link in the receipt email from Paystack. You keep Purple until the end of the period
                you already paid for, then your account moves back to the free plan. Nothing is deleted: your chats and media stay,
                but the free limits ({FREE_CHAT_LIMIT} chats, {FREE_DAILY_MESSAGE_LIMIT} messages a day, {FREE_PIN_LIMIT} pinned chats) apply again.
              </p>
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Refunds</h2>
              <p className="mt-3">
                Payments already taken aren't refunded, but cancelling stops all future charges immediately. If something went
                wrong with a charge, contact us and we'll sort it out.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4 text-xs text-zinc-500 dark:text-zinc-500">
            <span>Secured by Paystack</span>
            <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
            <Link to="/terms" className="underline underline-offset-2 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100">Terms</Link>
            <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
            <Link to="/privacy" className="underline underline-offset-2 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100">Privacy Policy</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
