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

const GREEN = "#1E1E1E ";
const ORANGE = "#F59E0B";
const DARK = "#1f2c34";
const BRAND = "#1E1E1E ";
const BG = "#efeae2";
const CARD = "#ffffff";

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
        <p>Sign up with your email or Google. Sona automatically creates your profile and drops you into a private chat with <strong>Sona AI</strong>, your always-on assistant.</p>
        <p>Tap the floating <strong>+</strong> button in the sidebar to slide up the friends drawer and start a new 1:1 conversation with anyone on Sona.</p>
      </>
    ),
  },
  {
    id: "chats",
    title: "Sending messages",
    icon: MessageCircle,
    body: (
      <>
        <p>Type in the composer and press <kbd>Enter</kbd> to send. Shift+Enter adds a new line.</p>
        <p>Tap a bubble to see quick actions: Reply, React, Edit, Forward, or Delete for everyone.</p>
      </>
    ),
  },
  {
    id: "forwarding",
    title: "Forwarding messages",
    icon: Forward,
    body: <p>Open any message's quick-action menu and tap <strong>Forward</strong> to resend it into one or more other chats, instantly.</p>,
  },
  {
    id: "ai",
    title: "Sona AI & @sona mentions",
    icon: Sparkles,
    body: (
      <>
        <p>In your Sona AI chat, just talk. In any other chat, type <code>@sona</code> anywhere in your message to summon the assistant.</p>
        <p>Sona can read images you attach and answer questions about them <span className="ml-1 inline-flex rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600">Pro</span></p>
      </>
    ),
  },
  {
    id: "media",
    title: "Photos, files & video",
    icon: ImageIcon,
    body: (
      <>
        <p>Tap the <strong>+</strong> button beside the composer to open a smooth attachment tray with Emoji, File, Image, and Video.</p>
        <p>Photos and files upload straight to Sona's storage; videos upload via Cloudinary with a live progress percentage.</p>
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
        <p>Use Reply to quote a specific message. Use Edit to correct your own text.</p>
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
        <p>Online presence updates live — no refresh needed.</p>
      </>
    ),
  },
  {
    id: "media-gallery",
    title: "Media, links & docs gallery",
    icon: FolderOpen,
    body: <p>Open a chat's header menu or contact info screen and tap Media, links, and docs for a browsable grid of everything shared in that conversation.</p>,
  },
  {
    id: "block-report",
    title: "Block & report",
    icon: Ban,
    body: (
      <>
        <p>From anyone's contact info screen, tap Block to instantly stop receiving their messages.</p>
        <p>Tap Report if someone's behaviour breaks Sona's rules.</p>
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
        <p>Statuses disappear automatically after 24 hours and track who has seen them.</p>
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
        <p>Pin any message to the top of a chat so it's never buried.</p>
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
        <p>Sona Pro unlocks Hide & encrypt. New messages in that chat are encrypted client-side with AES-GCM before leaving your device.</p>
        <p>Re-open a hidden chat and enter your passcode to decrypt.</p>
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
    body: <p>Enable push notifications from Settings → Advanced to get pinged for new messages even when Sona isn't open in a tab.</p>,
  },
  {
    id: "install",
    title: "Install Sona as an app",
    icon: Download,
    body: (
      <>
        <p>Sona is a full installable app. On desktop and Android, look for the Download icon in the sidebar header.</p>
        <p>On iPhone/iPad, use Safari's Share menu and choose Add to Home Screen.</p>
      </>
    ),
  },
  {
    id: "security",
    title: "Security model",
    icon: Shield,
    body: (
      <ul className="list-disc space-y-2 pl-5">
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
        <ul className="list-disc space-y-2 pl-5">
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
  const color = pct >= 70 ? GREEN : pct >= 25 ? BRAND : ORANGE;

  return (
    <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-[#202c33]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#25D366]/10 text-[#25D366]">
            <row.icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-[#111b21] dark:text-white">{row.type}</h3>
            <p className="text-sm text-[#667781] dark:text-[#8696a0]">{row.perMessage}</p>
          </div>
        </div>
        <span className="rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ background: color }}>
          {row.maxSizeLabel}
        </span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <p className="mt-3 text-sm leading-6 text-[#667781] dark:text-[#aebac1]">{row.notes}</p>
    </div>
  );
}

function UploadLimitsSection() {
  const [view, setView] = useState<"cards" | "list">("cards");

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-[#25D366]/15 bg-[#25D366]/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-[#111b21] dark:text-white">Files over the limit are skipped automatically</div>
          <div className="text-sm text-[#667781] dark:text-[#8696a0]">Sona tells you exactly which files were too large or too many, right in the composer.</div>
        </div>
        <div className="inline-flex rounded-full bg-white p-1 shadow-sm dark:bg-[#202c33]">
          <button
            onClick={() => setView("cards")}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${view === "cards" ? "bg-[#25D366] text-white" : "text-[#667781] dark:text-[#8696a0]"}`}
          >
            Cards
          </button>
          <button
            onClick={() => setView("list")}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${view === "list" ? "bg-[#25D366] text-white" : "text-[#667781] dark:text-[#8696a0]"}`}
          >
            List
          </button>
        </div>
      </div>

      {view === "cards" ? (
        <div className="grid gap-3 md:grid-cols-2">
          {limitRows.map((row) => (
            <LimitCard key={row.key} row={row} />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm dark:border-white/10 dark:bg-[#202c33]">
          {limitRows.map((row, idx) => {
            const pct = Math.round((row.maxSize / LIMIT_BAR_CEILING) * 100);
            const color = pct >= 70 ? GREEN : pct >= 25 ? BRAND : ORANGE;

            return (
              <div key={row.key} className={`grid gap-3 p-4 md:grid-cols-[220px_1fr_140px] ${idx !== limitRows.length - 1 ? "border-b border-black/5 dark:border-white/10" : ""}`}>
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#25D366]/10 text-[#25D366]">
                    <row.icon className="h-5 w-5" />
                  </div>
                  <div className="font-medium text-[#111b21] dark:text-white">{row.type}</div>
                </div>
                <div className="text-sm text-[#667781] dark:text-[#aebac1]">
                  <div>{row.perMessage}</div>
                  <div className="mt-1">{row.notes}</div>
                </div>
                <div className="md:text-right">
                  <div className="text-sm font-semibold text-[#111b21] dark:text-white">{row.maxSizeLabel}</div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/5 dark:bg-white/10 md:ml-auto">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
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
    <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm dark:border-white/10 dark:bg-[#202c33]">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 p-4 text-left transition hover:bg-black/2 dark:hover:bg-white/5"
      >
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#25D366]/10 text-[#25D366]">
            <section.icon className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-[#111b21] dark:text-white">
                <span className="mr-1 text-[#25D366]">{index + 1}.</span>
                {section.title}
              </span>
              {section.pro ? (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600">Pro</span>
              ) : null}
            </div>
          </div>
        </div>
        {open ? <ChevronUp className="h-5 w-5 text-[#667781]" /> : <ChevronDown className="h-5 w-5 text-[#667781]" />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="border-t border-black/5 px-4 pb-4 pt-1 text-sm leading-7 text-[#667781] dark:border-white/10 dark:text-[#aebac1]">
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
    <div className="min-h-dvh bg-[transparent] text-[#111b21] dark:bg-[#ffffff] dark:text-white">
      <header className="sticky top-0 z-10 border-b border-black/5 bg-[transparent] text-white shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link to="/" className="grid h-10 w-10 place-items-center rounded-full transition hover:bg-white/15">
            <ArrowLeft className="h-8 w-8" />
          </Link>
          <div>
            <img
  src="/s-logo.png"
  alt="Sona"
  className="h-10 w-full"
/>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <section className="rounded-[28px] bg-white p-6 shadow-sm dark:bg-[#202c33]">
          <h2 className="text-2xl font-bold">Welcome to Sona</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667781] dark:text-[#aebac1]">
            Sona is a warm, private messenger with a built-in AI companion. Below is everything the app can do, followed by a quick reference for every upload limit in one place.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-[#25D366]/10 px-3 py-1 font-medium text-[#25D366]">Available on Free</span>
            <span className="rounded-full bg-amber-500/10 px-3 py-1 font-medium text-amber-600">Sona Pro</span>
          </div>
        </section>

        <section className="mt-6 rounded-[28px] bg-white p-6 shadow-sm dark:bg-[#202c33]">
          <div className="mb-4">
            <h2 className="text-xl font-bold">Upload limits</h2>
            <p className="text-sm text-[#667781] dark:text-[#aebac1]">What you can attach, how many at once, and how big each file can be.</p>
          </div>
          <UploadLimitsSection />
        </section>

        <section className="mt-6 rounded-[28px] bg-white p-6 shadow-sm dark:bg-[#202c33]">
          <div className="mb-4">
            <h2 className="text-xl font-bold">Features, A to Z</h2>
            <p className="text-sm text-[#667781] dark:text-[#aebac1]">Tap any section to expand it.</p>
          </div>
          <div className="space-y-3">
            {sections.map((section, index) => (
              <AccordionItem key={section.id} section={section} index={index} />
            ))}
          </div>
        </section>

        <div className="py-8 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:brightness-95"
          >
            <MessageCircle className="h-4 w-4" />
            Back to chats
          </Link>
        </div>
      </main>
    </div>
  );
}
