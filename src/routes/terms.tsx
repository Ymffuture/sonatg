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
      <p>
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
      <>
        <p>You need an email address (or a supported sign-in provider) to use Sona. You're responsible for keeping your login credentials and any hidden-chat passcodes safe.</p>
        <p>You must be old enough to form a binding contract where you live, and you must provide accurate information when you sign up.</p>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    body: (
      <>
        <p>Don't use Sona to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Harass, threaten, impersonate, or abuse other people.</li>
          <li>Share illegal content, malware, or content you don't have the right to share.</li>
          <li>Spam, scrape, or attempt to bypass rate limits, security controls, or access other users' data.</li>
          <li>Reverse-engineer, resell, or overload the service or its AI features.</li>
        </ul>
        <p>You can block any user from the chat menu. We may suspend or remove accounts that break these rules.</p>
      </>
    ),
  },
  {
    id: "content",
    title: "Your content",
    body: (
      <>
        <p>You keep ownership of the messages, photos, voice notes, and status updates you post. You grant us only the limited permission needed to store, transmit, and display that content so the app works for you and the people you send it to.</p>
        <p>You're responsible for what you send. Messages you delete "for everyone" are removed from the chat for all members.</p>
      </>
    ),
  },
  {
    id: "ai",
    title: "Sona AI",
    body: (
      <>
        <p>Sona AI is an assistant powered by third-party language models. When you chat with Sona AI, or mention <code>@sona</code> in another chat, the relevant message content from that chat is sent to the model provider to generate a reply.</p>
        <p>AI output can be wrong, incomplete, or out of date. Don't rely on it for legal, medical, financial, or other professional advice.</p>
      </>
    ),
  },
  {
    id: "pro",
    title: "Sona Pro & billing",
    body: (
      <>
        <p>Sona Pro is an optional paid subscription that unlocks AI summaries, image understanding, hidden encrypted chats, and calls. Billing is handled by Paystack; we don't store your card details.</p>
        <p>Subscriptions renew automatically each period until cancelled. You can cancel at any time from Settings → Subscription, and access continues until the end of the period you've paid for. Except where required by law, payments already made are non-refundable.</p>
      </>
    ),
  },
  {
    id: "availability",
    title: "Availability and changes",
    body: (
      <p>We work to keep Sona online, but we don't guarantee uninterrupted service. Features may change, and we may add, modify, or retire parts of the app over time.</p>
    ),
  },
  {
    id: "termination",
    title: "Ending your account",
    body: (
      <p>You can stop using Sona and request deletion of your account at any time. We may suspend or terminate accounts that violate these terms or create risk for other users.</p>
    ),
  },
  {
    id: "liability",
    title: "Disclaimers and liability",
    body: (
      <p>Sona is provided "as is", without warranties of any kind to the maximum extent allowed by law. To the extent permitted by law, we're not liable for indirect or consequential losses, or for loss of data or content you didn't back up elsewhere.</p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>Questions about these terms? Reach out through the support contact listed in the app, and we'll get back to you.</p>
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
    <div className="min-h-dvh bg-[#F0EBE3] text-[#2D3436] dark:bg-[#1A1A1A] dark:text-[#E8E8E8]">
      <header className="sticky top-0 z-10 border-b border-[#E07A5F]/20 bg-[#E07A5F] text-white">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <Link to="/" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/20" aria-label="Back to chats">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-bold leading-tight">{title}</h1>
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/80">{subtitle}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-4xl gap-8 px-4 py-8 md:grid-cols-[220px_1fr]">
        <nav className="md:sticky md:top-20 md:self-start rounded-2xl border border-[#E07A5F]/15 bg-[#FFFDF9] dark:bg-[#242424] p-4">
          <h2 className="text-xs uppercase tracking-widest text-[#8C8C8C] mb-3">Contents</h2>
          <ol className="space-y-1.5 text-sm">
            {items.map((c, i) => (
              <li key={c.id}>
                <a href={`#${c.id}`} className="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-[#F4A261]/20 text-[#2D3436] dark:text-[#E8E8E8]">
                  <span className="text-[#E07A5F] font-semibold w-5 shrink-0 tabular-nums">{i + 1}.</span>
                  <span>{c.title}</span>
                </a>
              </li>
            ))}
          </ol>
          <Link to={otherHref} className="mt-4 flex items-center gap-2 rounded-lg border border-[#E07A5F]/20 px-2 py-2 text-xs font-medium hover:bg-[#F4A261]/20">
            <OtherIcon className="h-3.5 w-3.5 text-[#E07A5F]" /> {otherLabel}
          </Link>
        </nav>

        <article className="space-y-6">
          <section className="rounded-2xl border border-[#E07A5F]/15 bg-[#FFFDF9] dark:bg-[#242424] p-6">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#E07A5F]/15 text-[#E07A5F]">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{title}</h2>
                <p className="text-xs text-[#8C8C8C]">Last updated {lastUpdated}</p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[#8C8C8C]">{intro}</p>
          </section>

          {items.map((c, i) => (
            <section key={c.id} id={c.id} className="scroll-mt-24 rounded-2xl border border-[#E07A5F]/15 bg-[#FFFDF9] dark:bg-[#242424] p-6">
              <h3 className="text-lg font-bold mb-2">
                <span className="text-[#E07A5F]">{i + 1}.</span> {c.title}
              </h3>
              <div className="space-y-2 text-sm leading-relaxed">{c.body}</div>
            </section>
          ))}

          <div className="pt-2 text-center">
            <Link to="/" className="inline-flex items-center gap-2 rounded-full bg-[#E07A5F] px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-[#D4694F]">
              <ArrowLeft className="h-4 w-4" /> Back to Sona
            </Link>
          </div>
        </article>
      </main>
    </div>
  );
}
