import React, { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck, FileText } from "lucide-react";

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

type Section = { id: string; title: string; body: React.ReactNode };

const sections: Section[] = [
  {
    id: "info",
    title: "1. Information we collect",
    body: (
      <>
        <p>
          We collect information you provide directly (for example: account details, profile information,
          messages, and any media you upload) and information collected automatically (for example: device
          identifiers, usage data, logs, and cookies). We do not sell personal information.
        </p>
      </>
    ),
  },
  {
    id: "use",
    title: "2. How we use information",
    body: (
      <>
        <p>
          We use information to provide, improve, and personalise the service, to communicate with you, to
          detect and prevent abuse, and to comply with legal obligations.
        </p>
      </>
    ),
  },
  {
    id: "sharing",
    title: "3. Sharing and disclosure",
    body: (
      <>
        <p>
          We may share information with service providers who process data on our behalf, to comply with legal
          requests, or to protect rights and safety. We require vendors to maintain appropriate safeguards for
          personal information.
        </p>
      </>
    ),
  },
  {
    id: "security",
    title: "4. Security",
    body: (
      <>
        <p>
          We implement reasonable administrative, technical, and physical safeguards designed to protect
          information. However, no system is completely secure — please exercise caution when sharing sensitive
          information.
        </p>
      </>
    ),
  },
  {
    id: "choices",
    title: "5. Your choices",
    body: (
      <>
        <p>
          You can access, update, or delete certain account information via account settings. You may opt out of
          promotional communications by following the unsubscribe instructions in those messages.
        </p>
      </>
    ),
  },
  {
    id: "children",
    title: "6. Children",
    body: (
      <>
        <p>
          The service is not intended for children under 13. We do not knowingly collect personal information
          from children under 13.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    title: "7. Changes to this policy",
    body: (
      <>
        <p>
          We may update this policy from time to time. When we make material changes we'll update the "last
          updated" date above and, when required by law, provide notice in the app.
        </p>
      </>
    ),
  },
  {
    id: "contact",
    title: "8. Contact",
    body: (
      <p>
        If you have questions about this policy, contact us at <a href="mailto:support.sonatg@gmail.com">support.sonatg@gmail.com</a>.
      </p>
    ),
  },
];

function PrivacyPage() {
  const [openId, setOpenId] = useState<string | null>(null);

  const toggle = (id: string) => setOpenId((prev) => (prev === id ? null : id));

  return (
    <div className="max-w-3xl mx-auto py-12 px-6">
      <header className="flex items-center gap-3 mb-6">
        <Link to=".." className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2">
          <ArrowLeft size={18} /> Back
        </Link>
        <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          <FileText size={16} /> Last updated: {LAST_UPDATED}
        </div>
      </header>

      <h1 className="text-3xl font-semibold flex items-center gap-3">
        <ShieldCheck /> Privacy Policy
      </h1>

      <p className="mt-2 text-sm text-muted-foreground">Effective date: {new Date().toISOString().slice(0, 10)}</p>

      <div className="mt-8 space-y-3">
        {sections.map((s) => (
          <section key={s.id} className="border rounded-md">
            <button
              onClick={() => toggle(s.id)}
              aria-expanded={openId === s.id}
              className="w-full text-left px-4 py-3 flex items-center justify-between"
            >
              <div>
                <div className="font-medium">{s.title}</div>
              </div>
              <div className="text-xl" aria-hidden>
                {openId === s.id ? "−" : "+"}
              </div>
            </button>

            {openId === s.id && <div className="px-4 pb-4 pt-0 text-sm">{s.body}</div>}
          </section>
        ))}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Note: this policy is a template and does not constitute legal advice. Consider consulting legal counsel.
      </p>
    </div>
  );
}

export default PrivacyPage;
