import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, MessageCircle, Sparkles, Lock, Mic, Image as ImageIcon, Users, Bell, Shield,
  Crown, Phone, Download, Forward, UserCircle2, FolderOpen, Video, FileText,
  CalendarClock, Pin, Ban, Radio, ChevronDown, ChevronUp,
} from "lucide-react";

export const Route = createFileRoute("/learn")({
  head: () => ({
    meta: [
      { title: "Learn Sona — How the app works" },
      { name: "description", content: "A guided tour of Sona: chats, AI, status updates, voice notes, encryption, reactions, calls, forwarding, media galleries, upload limits, and Sona Pro." },
      { property: "og:title", content: "Learn Sona" },
      { property: "og:description", content: "A guided tour of Sona's chat, status, AI, and privacy features, plus every upload limit in one place." },
    ],
  }),
  component: LearnPage,
});

type Section = {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  pro?: boolean;
  body: React.ReactNode;
};

type LimitRow = {
  key: string;
  type: string;
  icon: React.ComponentType<{ className?: string }>;
  perMessage: string;
  maxSize: number;
  maxSizeLabel: string;
  notes: string;
};

const sections: Section[] = [
  {
    id: "getting-started",
    title: "Getting started",
    icon: MessageCircle,
    body: (
      <>
        <p>Sign up with your email or Google. Sona automatically creates your profile and drops you into a private chat with <strong className="text-zinc-900 dark:text-white">Sona AI</strong>, your always-on assistant.</p>
        <p className="mt-3">Tap the floating <strong className="text-zinc-900 dark:text-white">+</strong> button in the sidebar to slide up the friends drawer and start a new 1:1 conversation with anyone on Sona.</p>
      </>
    ),
  },
  {
    id: "chats",
    title: "Sending messages",
    icon: MessageCircle,
    body: (
      <>
        <p>Type in the composer and press <kbd className="rounded-md border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 text-xs font-mono dark:border-zinc-700 dark:bg-zinc-800">Enter</kbd> to send. <kbd className="rounded-md border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 text-xs font-mono dark:border-zinc-700 dark:bg-zinc-800">Shift+Enter</kbd> adds a new line.</p>
        <p className="mt-3">Tap a bubble to see quick actions: Reply, React, Edit, Forward, or Delete for everyone.</p>
      </>
    ),
  },
  {
    id: "forwarding",
    title: "Forwarding messages",
    icon: Forward,
    body: <p>Open any message's quick-action menu and tap <strong className="text-zinc-900 dark:text-white">Forward</strong> to resend it into one or more other chats, instantly.</p>,
  },
  {
    id: "ai",
    title: "Sona AI & @sona mentions",
    icon: Sparkles,
    body: (
      <>
        <p>In your Sona AI chat, just talk. In any other chat, type <code className="rounded-md bg-[#E07A5F]/10 px-1.5 py-0.5 text-sm font-mono text-[#E07A5F]">@sona</code> anywhere in your message to summon the assistant.</p>
        <p className="mt-3">Sona can read images you attach and answer questions about them <span className="ml-1 inline-flex rounded-full bg-[#8B5CF6]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#8B5CF6] ring-1 ring-inset ring-[#8B5CF6]/20">Pro</span></p>
      </>
    ),
  },
  {
    id: "media",
    title: "Photos, files & video",
    icon: ImageIcon,
    body: (
      <>
        <p>Tap the <strong className="text-zinc-900 dark:text-white">+</strong> button beside the composer to open a smooth attachment tray with Emoji, File, Image, and Video.</p>
        <p className="mt-3">Photos and files upload straight to Sona's storage; videos upload via Cloudinary with a live progress percentage.</p>
      </>
    ),
  },
  {
    id: "voice",
    title: "Voice notes",
    icon: Mic,
    body: <p>Tap the microphone when the input is empty to record a voice note. Send when done, or trash to cancel.</p>,
  },
  {
    id: "reactions",
    title: "Reactions, replies & edits",
    icon: Users,
    body: (
      <>
        <p>Tap a message to add an emoji reaction. Counts show under the bubble.</p>
        <p className="mt-3">Use Reply to quote a specific message. Use Edit to correct your own text.</p>
      </>
    ),
  },
  {
    id: "contact-info",
    title: "Contact info",
    icon: UserCircle2,
    body: (
      <>
        <p>Tap anyone's avatar to open their consolidated contact info screen: bio, live status, last seen, join date, and shortcuts to message, block, report, or jump into shared media.</p>
        <p className="mt-3">Online presence updates live — no refresh needed.</p>
      </>
    ),
  },
  {
    id: "media-gallery",
    title: "Media, links & docs gallery",
    icon: FolderOpen,
    body: <p>Open a chat's header menu or contact info screen and tap <strong className="text-zinc-900 dark:text-white">Media, links, and docs</strong> for a browsable grid of everything shared in that conversation.</p>,
  },
  {
    id: "block-report",
    title: "Block & report",
    icon: Ban,
    body: (
      <>
        <p>From anyone's contact info screen, tap <strong className="text-zinc-900 dark:text-white">Block</strong> to instantly stop receiving their messages.</p>
        <p className="mt-3">Tap <strong className="text-zinc-900 dark:text-white">Report</strong> if someone's behaviour breaks Sona's rules.</p>
      </>
    ),
  },
  {
    id: "status",
    title: "Status",
    icon: Radio,
    body: (
      <>
        <p>Tap the Add status tile at the start of the Status row to post a text, photo, or video update.</p>
        <p className="mt-3">Statuses disappear automatically after 24 hours and track who has seen them.</p>
      </>
    ),
  },
  {
    id: "scheduling",
    title: "Scheduled & pinned messages",
    icon: CalendarClock,
    body: (
      <>
        <p>Compose a message, then tap the clock icon to pick a future send time instead of sending immediately.</p>
        <p className="mt-3">Pin any message to the top of a chat so it's never buried.</p>
      </>
    ),
  },
  {
    id: "privacy",
    title: "Hidden chats & encryption",
    icon: Lock,
    pro: true,
    body: (
      <>
        <p>Sona Pro unlocks <strong className="text-zinc-900 dark:text-white">Hide & encrypt</strong>. New messages in that chat are encrypted client-side with AES-GCM before leaving your device.</p>
        <p className="mt-3">Re-open a hidden chat and enter your passcode to decrypt.</p>
      </>
    ),
  },
  {
    id: "calls",
    title: "Voice & video calls",
    icon: Phone,
    pro: true,
    body: <p>Voice and video calls are part of Sona Pro. Tap the phone or camera icon in the chat header to start a call.</p>,
  },
  {
    id: "notifications",
    title: "Notifications",
    icon: Bell,
    body: <p>Enable push notifications from <strong className="text-zinc-900 dark:text-white">Settings → Advanced</strong> to get pinged for new messages even when Sona isn't open in a tab.</p>,
  },
  {
    id: "install",
    title: "Install Sona as an app",
    icon: Download,
    body: (
      <>
        <p>Sona is a full installable app. On desktop and Android, look for the Download icon in the sidebar header.</p>
        <p className="mt-3">On iPhone/iPad, use Safari's Share menu and choose Add to Home Screen.</p>
      </>
    ),
  },
  {
    id: "security",
    title: "Security model",
    icon: Shield,
    body: (
      <ul className="list-disc space-y-2 pl-5 marker:text-[#E07A5F]">
        <li>Row-level security on every table: you only see chats you're a member of.</li>
        <li>Media stored in a private bucket, served through short-lived signed URLs.</li>
        <li>AES-GCM 256-bit encryption for hidden chats.</li>
        <li>Blocked users disappear from your sidebar and can't message you.</li>
      </ul>
    ),
  },
  {
    id: "pro",
    title: "Sona Pro",
    icon: Crown,
    pro: true,
    body: (
      <>
        <p>Sona Pro unlocks the premium layer:</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 marker:text-[#8B5CF6]">
          <li>AI chat summaries</li>
          <li>Vision — Sona reads your images</li>
          <li>Unlimited hidden encrypted chats</li>
          <li>Voice and video calls</li>
        </ul>
      </>
    ),
  },
];

const LIMIT_BAR_CEILING = 100 * 1024 * 1024;

const limitRows: LimitRow[] = [
  { key: "image", type: "Images", icon: ImageIcon, perMessage: "Up to 3 per message", maxSize: 2 * 1024 * 1024, maxSizeLabel: "2 MB each", notes: "JPEG, PNG, WebP, GIF." },
  { key: "doc", type: "Documents", icon: FileText, perMessage: "Up to 2 per message", maxSize: 5 * 1024 * 1024, maxSizeLabel: "5 MB each", notes: ".pdf, .docx, .txt, .md, .json, .csv, and source-code extensions." },
  { key: "video", type: "Videos (chat)", icon: Video, perMessage: "1 per message", maxSize: 100 * 1024 * 1024, maxSizeLabel: "100 MB", notes: "Uploaded via Cloudinary with live progress." },
  { key: "voice", type: "Voice notes", icon: Mic, perMessage: "1 per message", maxSize: 10 * 1024 * 1024, maxSizeLabel: "~10 MB", notes: "Long recordings are limited by file size." },
  { key: "status", type: "Status updates", icon: Radio, perMessage: "1 photo or video per post", maxSize: 10 * 1024 * 1024, maxSizeLabel: "10 MB", notes: "Video status clips are also capped at 60 seconds." },
];

function LimitCard({ row }: { row: LimitRow }) {
  const pct = Math.round((row.maxSize / LIMIT_BAR_CEILING) * 100);

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-zinc-200/60 bg-white/60 p-5 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-zinc-300 hover:shadow-xl dark:border-zinc-800/60 dark:bg-zinc-900/40 dark:hover:border-zinc-700">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E07A5F]/10 text-[#E07A5F] ring-1 ring-inset ring-[#E07A5F]/20 transition-colors group-hover:bg-[#E07A5F]/15">
            <row.icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-zinc-900 dark:text-white">{row.type}</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{row.perMessage}</p>
          </div>
        </div>
        <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-bold text-white shadow-sm dark:bg-white dark:text-zinc-900">
          {row.maxSizeLabel}
        </span>
      </div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div className="h-full rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#E07A5F] transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{row.notes}</p>
    </div>
  );
}

function UploadLimitsSection() {
  const [view, setView] = useState<"cards" | "list">("cards");

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200/60 bg-white/60 p-5 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800/60 dark:bg-zinc-900/40">
        <div>
          <div className="text-sm font-bold text-zinc-900 dark:text-white">Files over the limit are skipped automatically</div>
          <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Sona tells you exactly which files were too large or too many, right in the composer.</div>
        </div>
        <div className="inline-flex rounded-full border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-800 dark:bg-zinc-900">
          <button
            onClick={() => setView("cards")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${view === "cards" ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"}`}
          >
            Cards
          </button>
          <button
            onClick={() => setView("list")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${view === "list" ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"}`}
          >
            List
          </button>
        </div>
      </div>

      {view === "cards" ? (
        <div className="grid gap-4 md:grid-cols-2">
          {limitRows.map((row) => (
            <LimitCard key={row.key} row={row} />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200/60 bg-white/60 backdrop-blur-xl dark:border-zinc-800/60 dark:bg-zinc-900/40">
          {limitRows.map((row, idx) => {
            const pct = Math.round((row.maxSize / LIMIT_BAR_CEILING) * 100);
            return (
              <div key={row.key} className={`grid gap-4 p-5 md:grid-cols-[220px_1fr_160px] md:items-center ${idx !== limitRows.length - 1 ? "border-b border-zinc-200/60 dark:border-zinc-800/60" : ""}`}>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E07A5F]/10 text-[#E07A5F] ring-1 ring-inset ring-[#E07A5F]/20">
                    <row.icon className="h-5 w-5" />
                  </div>
                  <div className="font-bold text-zinc-900 dark:text-white">{row.type}</div>
                </div>
                <div className="text-sm text-zinc-600 dark:text-zinc-400">
                  <div className="font-medium text-zinc-700 dark:text-zinc-300">{row.perMessage}</div>
                  <div className="mt-1">{row.notes}</div>
                </div>
                <div className="md:text-right">
                  <div className="text-sm font-bold text-zinc-900 dark:text-white">{row.maxSizeLabel}</div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800 md:ml-auto">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#E07A5F]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AccordionItem({ section, index }: { section: Section; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`group overflow-hidden rounded-2xl border backdrop-blur-xl transition-all duration-300 ${open ? "border-[#E07A5F]/30 bg-white/80 shadow-lg dark:border-[#E07A5F]/20 dark:bg-zinc-900/60" : "border-zinc-200/60 bg-white/60 hover:border-zinc-300 hover:shadow-md dark:border-zinc-800/60 dark:bg-zinc-900/40 dark:hover:border-zinc-700"}`}>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 p-5 text-left transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-colors ${section.pro ? "bg-[#8B5CF6]/10 text-[#8B5CF6] ring-1 ring-inset ring-[#8B5CF6]/20" : "bg-[#E07A5F]/10 text-[#E07A5F] ring-1 ring-inset ring-[#E07A5F]/20"}`}>
            <section.icon className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-bold text-zinc-900 dark:text-white">
                <span className="mr-1.5 text-zinc-400 dark:text-zinc-600">{String(index + 1).padStart(2, '0')}.</span>
                {section.title}
              </span>
              {section.pro ? (
                <span className="rounded-full bg-[#8B5CF6]/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#8B5CF6] ring-1 ring-inset ring-[#8B5CF6]/20">Pro</span>
              ) : null}
            </div>
          </div>
        </div>
        <div className={`flex h-8 w-8 items-center justify-center rounded-full transition-all duration-300 ${open ? "bg-[#E07A5F] text-white rotate-180" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"}`}>
          <ChevronDown className="h-4 w-4" />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-zinc-200/60 px-5 pb-5 pt-4 text-[15px] leading-relaxed text-zinc-600 dark:border-zinc-800/60 dark:text-zinc-400">
              {section.body}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LearnPage() {
  return (
    <div className="relative min-h-dvh bg-[#FFFDF9] text-zinc-900 transition-colors duration-300 dark:bg-[#0F0F11] dark:text-zinc-100">
      {/* Subtle ambient background gradient */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-100/40 via-transparent to-transparent dark:from-purple-900/10" />
      
      <header className="sticky top-0 z-20 border-b border-zinc-200/60 bg-white/80 backdrop-blur-xl transition-colors dark:border-zinc-800/60 dark:bg-[#0F0F11]/80">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-5 py-4 sm:px-8">
          <Link to="/" className="group grid h-10 w-10 place-items-center rounded-full border border-zinc-200 bg-white/50 shadow-sm transition-all hover:border-zinc-300 hover:bg-white hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-zinc-700 dark:hover:bg-zinc-900">
            <ArrowLeft className="h-4.5 w-4.5 text-zinc-600 transition-transform group-hover:-translate-x-0.5 dark:text-zinc-400" />
          </Link>
          <div className="flex items-center gap-2">
            <img src="/s-logo.png" alt="Sona" className="h-8 w-auto" />
            <span className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">Learn</span>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        {/* Hero Section */}
        <section className="relative overflow-hidden rounded-3xl border border-zinc-200/60 bg-white/60 p-8 backdrop-blur-xl dark:border-zinc-800/60 dark:bg-zinc-900/40 sm:p-12">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#E07A5F]/10 blur-3xl" />
          <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-[#8B5CF6]/10 blur-3xl" />
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E07A5F]/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-widest text-[#E07A5F] ring-1 ring-inset ring-[#E07A5F]/20">
              <Sparkles className="h-3.5 w-3.5" /> User Guide
            </span>
            <h2 className="mt-6 text-4xl font-black tracking-tight text-zinc-900 dark:text-white sm:text-5xl">
              Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#8B5CF6] to-[#E07A5F]">Sona</span>
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
              Sona is a warm, private messenger with a built-in AI companion. Below is everything the app can do, followed by a quick reference for every upload limit in one place.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-xs">
              <span className="rounded-full bg-zinc-100 px-3.5 py-1.5 font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700">Available on Free</span>
              <span className="rounded-full bg-[#8B5CF6]/10 px-3.5 py-1.5 font-semibold text-[#8B5CF6] ring-1 ring-inset ring-[#8B5CF6]/20">Sona Pro</span>
            </div>
          </div>
        </section>

        {/* Upload Limits */}
        <section className="mt-10 rounded-3xl border border-zinc-200/60 bg-white/60 p-6 backdrop-blur-xl dark:border-zinc-800/60 dark:bg-zinc-900/40 sm:p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Upload limits</h2>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">What you can attach, how many at once, and how big each file can be.</p>
          </div>
          <UploadLimitsSection />
        </section>

        {/* Features A-Z */}
        <section className="mt-10 rounded-3xl border border-zinc-200/60 bg-white/60 p-6 backdrop-blur-xl dark:border-zinc-800/60 dark:bg-zinc-900/40 sm:p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Features, A to Z</h2>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Tap any section to expand it.</p>
          </div>
          <div className="space-y-3">
            {sections.map((section, index) => (
              <AccordionItem key={section.id} section={section} index={index} />
            ))}
          </div>
        </section>

        {/* Footer */}
        <div className="mt-16 flex justify-center pb-10">
          <Link
            to="/"
            className="group inline-flex items-center gap-2 rounded-full bg-zinc-900 px-6 py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-black hover:shadow-xl dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <MessageCircle className="h-4 w-4 transition-transform group-hover:-rotate-12" />
            Back to chats
          </Link>
        </div>
      </main>
    </div>
  );
}
