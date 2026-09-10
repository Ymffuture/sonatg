import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FileText, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Sona" },
      { name: "description", content: "The terms that govern your use of Sona, including accounts, acceptable use, Sona Pro billing, and account termination." },
      { property: "og:title", content: "Terms of Service — Sona" },
      { property: "og:description", content: "The terms that govern your use of Sona." },
    ],
  }),
  component: TermsPage,
});

const LAST_UPDATED = "1 August 2026";

type Clause = { id: string; title: string; body: React.ReactNode };

const clauses: Clause[] = [
  {
    id: "acceptance",
    title: "Acceptance of these terms",
    body: (
      <p className="leading-relaxed">
        By creating a Sona account or using the app, you agree to these terms. If you do not
        agree, please stop using Sona. We may update these terms from time to time; when we do,
        we'll change the "last updated" date above and, for material changes, let you know in the app.
      </p>
    ),
  },
  {
    id: "accounts",
    title: "Your account",
    body: (
      <div className="space-y-3">
        <p className="leading-relaxed">You need an email address (or a supported sign-in provider) to use Sona. You're responsible for keeping your login credentials and any hidden-chat passcodes safe.</p>
        <p className="leading-relaxed">You must be old enough to form a binding contract where you live, and you must provide accurate information when you sign up.</p>
      </div>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    body: (
      <div className="space-y-3">
        <p className="leading-relaxed">Don't use Sona to:</p>
        <ul className="list-disc space-y-1.5 pl-5 marker:text-[#E07A5F]">
          <li>Harass, threaten, impersonate, or abuse other people.</li>
          <li>Share illegal content, malware, or content you don't have the right to share.</li>
          <li>Spam, scrape, or attempt to bypass rate limits, security controls, or access other users' data.</li>
          <li>Reverse-engineer, resell, or overload the service or its AI features.</li>
        </ul>
        <p className="leading-relaxed">You can block any user from the chat menu. We may suspend or remove accounts that break these rules.</p>
      </div>
    ),
  },
  {
    id: "content",
    title: "Your content",
    body: (
      <div className="space-y-3">
        <p className="leading-relaxed">You keep ownership of the messages, photos, voice notes, and status updates you post. You grant us only the limited permission needed to store, transmit, and display that content so the app works for you and the people you send it to.</p>
        <p className="leading-relaxed">You're responsible for what you send. Messages you delete "for everyone" are removed from the chat for all members.</p>
      </div>
    ),
  },
  {
    id: "ai",
    title: "Sona AI",
    body: (
      <div className="space-y-3">
        <p className="leading-relaxed">Sona AI is an assistant powered by third-party language models. When you chat with Sona AI, or mention <code className="rounded-md bg-[#E07A5F]/10 px-1.5 py-0.5 text-sm font-mono text-[#E07A5F]">@sona</code> in another chat, the relevant message content from that chat is sent to the model provider to generate a reply.</p>
        <p className="leading-relaxed">AI output can be wrong, incomplete, or out of date. Don't rely on it for legal, medical, financial, or other professional advice.</p>
      </div>
    ),
  },
  {
    id: "pro",
    title: "Sona Pro & billing",
    body: (
      <div className="space-y-3">
        <p className="leading-relaxed">Sona Pro is an optional paid subscription that unlocks AI summaries, image understanding, hidden encrypted chats, and calls. Billing is handled by Paystack; we don't store your card details.</p>
        <p className="leading-relaxed">Subscriptions renew automatically each period until cancelled. You can cancel at any time from Settings → Subscription, and access continues until the end of the period you've paid for. Except where required by law, payments already made are non-refundable.</p>
      </div>
    ),
  },
  {
    id: "availability",
    title: "Availability and changes",
    body: (
      <p className="leading-relaxed">We work to keep Sona online, but we don't guarantee uninterrupted service. Features may change, and we may add, modify, or retire parts of the app over time.</p>
    ),
  },
  {
    id: "termination",
    title: "Ending your account",
    body: (
      <p className="leading-relaxed">You can stop using Sona and request deletion of your account at any time. We may suspend or terminate accounts that violate these terms or create risk for other users.</p>
    ),
  },
  {
    id: "liability",
    title: "Disclaimers and liability",
    body: (
      <p className="leading-relaxed">Sona is provided "as is", without warranties of any kind to the maximum extent allowed by law. To the extent permitted by law, we're not liable for indirect or consequential losses, or for loss of data or content you didn't back up elsewhere.</p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p className="leading-relaxed">Questions about these terms? Reach out through the support contact listed in the app, and we'll get back to you.</p>
    ),
  },
];

function TermsPage() {
  return (
    <LegalShell
      icon={FileText}
      title="Terms of Service"
      subtitle="The rules of using Sona"
      lastUpdated={LAST_UPDATED}
      intro="These terms are maintained by the Sona team and describe what you can expect from Sona and what we expect from you. They're written in plain language on purpose."
      clauses={clauses}
      otherHref="/privacy"
      otherLabel="Read the Privacy Policy"
      otherIcon={ShieldCheck}
    />
  );
}

export function LegalShell({
  icon: Icon,
  title,
  subtitle,
  lastUpdated,
  intro,
  clauses: items,
  otherHref,
  otherLabel,
  otherIcon: OtherIcon,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  lastUpdated: string;
  intro: string;
  clauses: Clause[];
  otherHref: "/privacy" | "/terms";
  otherLabel: string;
  otherIcon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="relative min-h-dvh bg-[#FFFDF9] text-zinc-900 transition-colors duration-300 dark:bg-[#0F0F11] dark:text-zinc-100">
      {/* Subtle ambient background gradient for premium feel */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-100/40 via-transparent to-transparent dark:from-purple-900/10" />
      
      {/* Premium Glassmorphic Header */}
      <header className="sticky top-0 z-20 border-b border-zinc-200/60 bg-white/80 backdrop-blur-xl transition-colors dark:border-zinc-800/60 dark:bg-[#0F0F11]/80">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-5 py-4 sm:px-8">
          <Link 
            to="/" 
            className="group grid h-10 w-10 place-items-center rounded-full border border-zinc-200 bg-white/50 shadow-sm transition-all hover:border-zinc-300 hover:bg-white hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
            aria-label="Back to chats"
          >
            <ArrowLeft className="h-4.5 w-4.5 text-zinc-600 transition-transform group-hover:-translate-x-0.5 dark:text-zinc-400" />
          </Link>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">{title}</h1>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">{subtitle}</p>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="grid gap-8 md:grid-cols-[240px_1fr]">
          
          {/* Premium Sidebar Navigation */}
          <nav className="md:sticky md:top-24 md:self-start">
            <div className="rounded-2xl border border-zinc-200/60 bg-white/60 p-5 backdrop-blur-xl dark:border-zinc-800/60 dark:bg-zinc-900/40">
              <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Contents</h2>
              <ol className="space-y-1 text-sm">
                {items.map((c, i) => (
                  <li key={c.id}>
                    <a 
                      href={`#${c.id}`} 
                      className="group flex items-start gap-2 rounded-lg px-2.5 py-2 transition-all hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
                    >
                      <span className="mt-0.5 text-xs font-bold text-zinc-400 transition-colors group-hover:text-[#E07A5F] dark:text-zinc-600 dark:group-hover:text-[#E07A5F]">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="text-zinc-700 transition-colors group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-200">
                        {c.title}
                      </span>
                    </a>
                  </li>
                ))}
              </ol>
              <Link 
                to={otherHref} 
                className="mt-6 flex items-center gap-2.5 rounded-xl border border-zinc-200/60 bg-zinc-50/50 px-3.5 py-3 text-xs font-semibold text-zinc-700 transition-all hover:border-[#E07A5F]/30 hover:bg-[#E07A5F]/5 hover:text-[#E07A5F] dark:border-zinc-800/60 dark:bg-zinc-900/50 dark:text-zinc-300 dark:hover:border-[#E07A5F]/30 dark:hover:bg-[#E07A5F]/10 dark:hover:text-[#E07A5F]"
              >
                <OtherIcon className="h-4 w-4" /> {otherLabel}
              </Link>
            </div>
          </nav>

          {/* Premium Content Area */}
          <article className="space-y-6">
            {/* Intro Card */}
            <section className="relative overflow-hidden rounded-3xl border border-zinc-200/60 bg-white/60 p-6 backdrop-blur-xl dark:border-zinc-800/60 dark:bg-zinc-900/40 sm:p-8">
              <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#E07A5F]/10 blur-3xl" />
              <div className="relative flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#E07A5F]/10 text-[#E07A5F] ring-1 ring-inset ring-[#E07A5F]/20">
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
                    {title}
                  </h2>
                  <p className="mt-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">Last updated {lastUpdated}</p>
                  <p className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {intro}
                  </p>
                </div>
              </div>
            </section>

            {/* Clauses */}
            {items.map((c, i) => (
              <section 
                key={c.id} 
                id={c.id} 
                className="scroll-mt-28 rounded-2xl border border-zinc-200/60 bg-white/60 p-6 backdrop-blur-xl transition-all hover:border-zinc-300 hover:shadow-md dark:border-zinc-800/60 dark:bg-zinc-900/40 dark:hover:border-zinc-700 sm:p-8"
              >
                <h3 className="mb-4 flex items-center gap-3 text-lg font-bold text-zinc-900 dark:text-white">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E07A5F]/10 text-xs font-black text-[#E07A5F] ring-1 ring-inset ring-[#E07A5F]/20">
                    {i + 1}
                  </span>
                  {c.title}
                </h3>
                <div className="text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {c.body}
                </div>
              </section>
            ))}

            {/* Footer */}
            <div className="mt-12 flex justify-center pb-10">
              <Link
                to="/"
                className="group inline-flex items-center gap-2 rounded-full bg-zinc-900 px-6 py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-black hover:shadow-xl dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
                Back to Sona
              </Link>
            </div>
          </article>
        </div>
      </main>
    </div>
  );
}
