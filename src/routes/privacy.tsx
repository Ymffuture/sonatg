import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, ShieldCheck, FileText, 
  Database, Settings, Share2, Lock, UserCog, Baby, RefreshCw, Mail, ChevronDown 
} from "lucide-react";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Sona" },
      { name: "description", content: "How Sona collects, uses, and shares personal information when you use the app." },
      { property: "og:title", content: "Privacy Policy — Sona" },
      { property: "og:description", content: "How Sona collects, uses, and shares personal information when you use the app." },
    ],
  }),
  component: PrivacyPage,
});

const LAST_UPDATED = "1 August 2026";

type Section = { 
  id: string; 
  title: string; 
  icon: React.ComponentType<{ className?: string }>;
  body: React.ReactNode; 
};

const sections: Section[] = [
  {
    id: "info",
    title: "Information we collect",
    icon: Database,
    body: (
      <p className="leading-relaxed">
        We collect information you provide directly (for example: account details, profile information,
        messages, and any media you upload) and information collected automatically (for example: device
        identifiers, usage data, logs, and cookies). We do not sell personal information.
      </p>
    ),
  },
  {
    id: "use",
    title: "How we use information",
    icon: Settings,
    body: (
      <p className="leading-relaxed">
        We use information to provide, improve, and personalise the service, to communicate with you, to
        detect and prevent abuse, and to comply with legal obligations.
      </p>
    ),
  },
  {
    id: "sharing",
    title: "Sharing and disclosure",
    icon: Share2,
    body: (
      <p className="leading-relaxed">
        We may share information with service providers who process data on our behalf, to comply with legal
        requests, or to protect rights and safety. We require vendors to maintain appropriate safeguards for
        personal information.
      </p>
    ),
  },
  {
    id: "security",
    title: "Security",
    icon: Lock,
    body: (
      <p className="leading-relaxed">
        We implement reasonable administrative, technical, and physical safeguards designed to protect
        information. However, no system is completely secure — please exercise caution when sharing sensitive
        information.
      </p>
    ),
  },
  {
    id: "choices",
    title: "Your choices",
    icon: UserCog,
    body: (
      <p className="leading-relaxed">
        You can access, update, or delete certain account information via account settings. You may opt out of
        promotional communications by following the unsubscribe instructions in those messages.
      </p>
    ),
  },
  {
    id: "children",
    title: "Children",
    icon: Baby,
    body: (
      <p className="leading-relaxed">
        The service is not intended for children under 13. We do not knowingly collect personal information
        from children under 13.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    icon: RefreshCw,
    body: (
      <p className="leading-relaxed">
        We may update this policy from time to time. When we make material changes we'll update the "last
        updated" date above and, when required by law, provide notice in the app.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    icon: Mail,
    body: (
      <p className="leading-relaxed">
        If you have questions about this policy, contact us at{' '}
        <a href="mailto:support.sonatg@gmail.com" className="font-semibold text-[#E07A5F] hover:underline underline-offset-2 transition-colors">
          support.sonatg@gmail.com
        </a>.
      </p>
    ),
  },
];

function PrivacyPage() {
  // Open the first section by default for better initial UX
  const [openId, setOpenId] = useState<string | null>("info");

  const toggle = (id: string) => setOpenId((prev) => (prev === id ? null : id));

  return (
    <div className="relative min-h-dvh bg-[#FFFDF9] text-zinc-900 transition-colors duration-300 dark:bg-[#0F0F11] dark:text-zinc-100">
      {/* Subtle ambient background gradient for premium feel */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-100/40 via-transparent to-transparent dark:from-purple-900/10" />
      
      <div className="relative mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        {/* Header */}
        <header className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <Link 
            to=".." 
            className="group inline-flex w-fit items-center gap-2 rounded-full border border-zinc-200 bg-white/80 px-4 py-2 text-sm font-semibold text-zinc-600 backdrop-blur-md transition-all hover:border-zinc-300 hover:text-zinc-900 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-100"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" /> 
            Back
          </Link>
          <div className="flex items-center gap-2 rounded-full bg-zinc-100 px-4 py-2 text-xs font-medium text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
            <FileText className="h-3.5 w-3.5" /> 
            Last updated: {LAST_UPDATED}
          </div>
        </header>

        {/* Title Section */}
        <div className="mb-10 text-center sm:text-left">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E07A5F]/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-widest text-[#E07A5F] ring-1 ring-inset ring-[#E07A5F]/20 dark:bg-[#E07A5F]/15 dark:ring-[#E07A5F]/30">
            <ShieldCheck className="h-3.5 w-3.5" /> Legal
          </span>
          <h1 className="mt-5 text-4xl font-black tracking-tight text-zinc-900 dark:text-white sm:text-5xl">
            Privacy <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#8B5CF6] to-[#E07A5F]">Policy</span>
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
            How Sona collects, uses, and shares personal information when you use the app.
          </p>
        </div>

        {/* Accordion Sections */}
        <div className="space-y-3">
          {sections.map((s) => {
            const isOpen = openId === s.id;
            const Icon = s.icon;

            return (
              <div 
                key={s.id} 
                className={`group overflow-hidden rounded-2xl border backdrop-blur-xl transition-all duration-300 ${
                  isOpen 
                    ? "border-[#E07A5F]/30 bg-white/80 shadow-lg dark:border-[#E07A5F]/20 dark:bg-zinc-900/60" 
                    : "border-zinc-200/60 bg-white/60 hover:border-zinc-300 hover:shadow-md dark:border-zinc-800/60 dark:bg-zinc-900/40 dark:hover:border-zinc-700"
                }`}
              >
                <button
                  onClick={() => toggle(s.id)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 p-5 text-left transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-colors ${
                      isOpen 
                        ? "bg-[#E07A5F]/10 text-[#E07A5F] ring-1 ring-inset ring-[#E07A5F]/20" 
                        : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-base font-bold text-zinc-900 dark:text-white">
                      {s.title}
                    </span>
                  </div>
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full transition-all duration-300 ${
                    isOpen 
                      ? "bg-[#E07A5F] text-white" 
                      : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}>
                    <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-zinc-200/60 px-5 pb-5 pt-4 text-[15px] leading-relaxed text-zinc-600 dark:border-zinc-800/60 dark:text-zinc-400">
                        {s.body}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Footer Note */}
        <div className="mt-10 flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Note: this policy is a template and does not constitute legal advice. Consider consulting legal counsel for compliance with local regulations.
          </p>
        </div>
      </div>
    </div>
  );
}

export default PrivacyPage;
