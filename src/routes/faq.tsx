import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ChevronDown, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "Frequently Asked Questions — Sona" },
      { name: "description", content: "General questions about what Sona is, how it's different, pricing, platforms, and data handling." },
      { property: "og:title", content: "Sona FAQ" },
      { property: "og:description", content: "General questions about Sona, answered plainly." },
    ],
  }),
  component: FaqPage,
});

const FAQS: { q: string; a: string }[] = [
  {
    q: "What is Sona, exactly?",
    a: "Sona is a real-time messaging app — one-on-one chats, groups, voice and video calls, and status updates — with an integrated AI assistant you can bring into any conversation. It's built for both casual chatting and more organized group communication, with tools like threaded replies, pinned messages, and scheduled sends that most simpler chat apps don't offer.",
  },
  {
    q: "How is Sona different from other messaging apps?",
    a: "Two things stand out: the AI assistant is summoned into conversations you're already having rather than living in a separate tab, and privacy is layered — standard chats use database-level access control, while Sona Pro adds fully client-side encrypted chats for when you want a stronger guarantee. Beyond that, Sona focuses on making large group chats actually usable, with threading, pinning, and reactions built to cut down on notification noise.",
  },
  {
    q: "Is Sona free to use?",
    a: "Yes, the core app is free — unlimited one-on-one and group messaging, calls, and status updates. Sona Pro is an optional paid tier that adds encrypted hidden chats, larger file uploads, and removes standard usage limits.",
  },
  {
    q: "What platforms is Sona available on?",
    a: "Sona runs as a web app in any modern browser and is installable as a Progressive Web App on both desktop and mobile, so you can add it to your home screen and use it like a native app, including offline caching and push notifications.",
  },
  {
    q: "Do you sell or share my data with advertisers?",
    a: "No. Sona doesn't sell user data or message content to advertisers. Any ads you might see are shown only on public, non-authenticated pages like this one and the blog — never inside your actual conversations.",
  },
  {
    q: "Can I use Sona for my business or organization?",
    a: "Yes — organizations can restrict membership to a verified company email domain and bulk-invite a roster of members. If you're setting this up for a team or school and want guidance, reach out through Settings → Help.",
  },
  {
    q: "What happens to my messages if I delete my account?",
    a: "Deleting your account removes your profile and personal data. Messages you sent in group chats may remain visible to other participants as part of the conversation history, similar to how deleting an email account doesn't erase copies already delivered to other inboxes — this is standard behavior across essentially all messaging platforms, not unique to Sona.",
  },
  {
    q: "Is there a limit to file or video size I can send?",
    a: "Free accounts have a standard per-file size limit suitable for most photos, voice notes, and short videos. Sona Pro increases these limits substantially for people who regularly share larger files.",
  },
  {
    q: "Can I export my chat history?",
    a: "Not yet as a self-serve feature. If you need a copy of your data for personal records or a legal request, contact support through Settings → Help and we'll assist directly.",
  },
];

function FaqPage() {
  const [open, setOpen] = useState<string | null>(FAQS[0]?.q ?? null);

  return (
    <div className="min-h-dvh bg-[#FAF8F5] text-[#111b21] dark:bg-[#151c1c] dark:text-white">
      <header className="sticky top-0 z-10 border-b border-black/5 bg-white dark:bg-[#1a1a1a]">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link to="/" className="grid h-10 w-10 place-items-center rounded-full transition hover:bg-black/5 dark:hover:bg-white/10">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-bold">FAQ</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="mb-8 text-sm leading-6 text-[#667781] dark:text-[#aebac1]">
          General questions about Sona as a product. Looking for step-by-step help instead?{" "}
          <Link to="/help" className="text-[#E07A5F] hover:underline">Visit the Help Center</Link>.
        </p>

        <div className="space-y-2">
          {FAQS.map((item) => {
            const isOpen = open === item.q;
            return (
              <div key={item.q} className="overflow-hidden rounded-2xl border border-black/5 bg-white dark:border-white/10 dark:bg-[#202c33]">
                <button
                  onClick={() => setOpen(isOpen ? null : item.q)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
                >
                  <span className="text-sm font-semibold leading-6">{item.q}</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-[#E07A5F] transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <p className="px-4 pb-4 text-sm leading-6 text-[#667781] dark:text-[#aebac1]">{item.a}</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="py-10 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full bg-[#E07A5F] px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:brightness-95"
          >
            <MessageCircle className="h-4 w-4" />
            Back to chats
          </Link>
        </div>
      </main>
    </div>
  );
}
