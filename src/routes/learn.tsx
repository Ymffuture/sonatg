import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Collapse, Tag, Table, Progress, Alert, Tooltip, Divider, Badge, Segmented,
} from "antd";
import type { CollapseProps } from "antd";
import {
  ArrowLeft, MessageCircle, Sparkles, Lock, Mic, Image as ImageIcon, Users, Bell, Shield,
  Crown, Phone, Clock, Download, Forward, UserCircle2, FolderOpen, Video, FileText,
  CalendarClock, Pin, Ban, Flag, Radio,
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

// ─── Brand palette used throughout this page ───────────────────────────────
// Green  = live / available / within limits
// Orange = warning / approaching a limit / Pro-only
// #1e1e1e = the app's own dark-mode surface color
const GREEN = "#25D366";
const ORANGE = "#F59E0B";
const DARK = "#1e1e1e";
const BRAND = "#E07A5F";

type Section = {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  pro?: boolean;
  body: React.ReactNode;
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
        <p>Type in the composer and press <kbd>Enter</kbd> to send. Shift+Enter adds a new line. Sona plays a subtle chime when you send and receive, just like the messengers you know.</p>
        <p>Tap a bubble to see quick actions: <em>Reply</em>, <em>React</em>, <em>Edit</em>, <em>Forward</em>, or <em>Delete for everyone</em>. Long-press or right-click a chat in the sidebar to select and bulk-delete.</p>
      </>
    ),
  },
  {
    id: "forwarding",
    title: "Forwarding messages",
    icon: Forward,
    body: (
      <>
        <p>Open any message's quick-action menu and tap <strong>Forward</strong> to resend it into one or more other chats, instantly. Forwarded messages carry a small <Tag color={ORANGE} className="align-middle">Forwarded</Tag> label so the recipient always knows where it came from.</p>
      </>
    ),
  },
  {
    id: "ai",
    title: "Sona AI & @sona mentions",
    icon: Sparkles,
    body: (
      <>
        <p>In your Sona AI chat, just talk. In <em>any other chat</em>, type <code>@sona</code> anywhere in your message to summon the assistant — Sona joins the conversation and replies inline, visible to everyone in the chat.</p>
        <p>Sona can read images you attach and answer questions about them <Tag color={ORANGE}>Pro</Tag></p>
      </>
    ),
  },
  {
    id: "media",
    title: "Photos, files & video",
    icon: ImageIcon,
    body: (
      <>
        <p>Tap the <strong>+</strong> button beside the composer to open a smooth attachment tray with four options: Emoji, File, Image, and Video.</p>
        <p>Photos and files upload straight to Sona's storage; videos upload via Cloudinary with a live progress percentage next to the input. See the exact size and count limits for each type in the table below.</p>
      </>
    ),
  },
  {
    id: "voice",
    title: "Voice notes",
    icon: Mic,
    body: (
      <p>Tap the microphone (when the input is empty) to record a voice note. Send when done, or trash to cancel. Recipients get an inline player with a scrubbable progress bar and a transcript on request.</p>
    ),
  },
  {
    id: "reactions",
    title: "Reactions, replies & edits",
    icon: Users,
    body: (
      <>
        <p>Tap a message → smile+ to add an emoji reaction. Counts show under the bubble.</p>
        <p>Use <em>Reply</em> to quote a specific message. Use <em>Edit</em> to correct your own text; edited messages show a small "edited" label.</p>
      </>
    ),
  },
  {
    id: "contact-info",
    title: "Contact info",
    icon: UserCircle2,
    body: (
      <>
        <p>Tap anyone's avatar to open their consolidated <strong>contact info</strong> screen: bio, live online/offline status, exact last-seen time, join date, and one-tap shortcuts to message, block, report, or jump straight into their shared media.</p>
        <p>Online presence updates live — no refresh needed. "Last seen" shows as <em>today at 17:33</em>, <em>yesterday at 17:33</em>, or a full date like <em>1 Aug 2026 at 17:33</em> once it's more than a day old.</p>
      </>
    ),
  },
  {
    id: "media-gallery",
    title: "Media, links & docs gallery",
    icon: FolderOpen,
    body: (
      <p>Open a chat's header menu (or its contact info screen) and tap <strong>"Media, links, and docs"</strong> for a browsable grid of everything ever shared in that conversation — tap any tile to open it full-screen, including videos.</p>
    ),
  },
  {
    id: "block-report",
    title: "Block & report",
    icon: Ban,
    body: (
      <>
        <p>From anyone's contact info screen, tap <strong>Block</strong> to instantly stop receiving their messages — they disappear from your sidebar too. Unblock any time from the same screen.</p>
        <p>Tap <strong>Report</strong> if someone's behaviour breaks Sona's rules — reports go straight to the Sona team for review.</p>
      </>
    ),
  },
  {
    id: "status",
    title: "Status",
    icon: Radio,
    body: (
      <>
        <p>Tap the <strong>Add status</strong> tile at the start of the Status row to post a text, photo, or video update. Text statuses let you pick a background color; photos and videos upload straight from your device.</p>
        <p>Each status tile shows the actual content as its background so you can tell what's inside before tapping. Statuses disappear automatically after <strong>24 hours</strong>. Sona tracks who's seen it, just like read receipts on your messages.</p>
      </>
    ),
  },
  {
    id: "scheduling",
    title: "Scheduled & pinned messages",
    icon: CalendarClock,
    body: (
      <>
        <p>Compose a message, then tap the clock icon to pick a future send time instead of sending immediately. Manage everything queued up from <strong>Scheduled messages</strong> in the chat header menu.</p>
        <p className="flex items-center gap-1.5"><Pin className="h-3.5 w-3.5 text-[#E07A5F]" /> Pin any message to the top of a chat so it's never buried.</p>
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
        <p><strong>Sona Pro</strong> unlocks <em>Hide & encrypt</em>. When enabled, new messages in that chat are encrypted client-side with AES-GCM before ever leaving your device. Your passcode is derived locally and <strong>never sent to our servers</strong>.</p>
        <p>Re-open a hidden chat and enter your passcode to decrypt. Tap <em>Lock now</em> to relock instantly.</p>
      </>
    ),
  },
  {
    id: "calls",
    title: "Voice & video calls",
    icon: Phone,
    pro: true,
    body: <p>Voice and video calls are part of <strong>Sona Pro</strong>. Tap the phone or camera icon in the chat header to start a call.</p>,
  },
  {
    id: "notifications",
    title: "Notifications",
    icon: Bell,
    body: <p>Enable push notifications from <em>Settings → Advanced</em> to get pinged for new messages even when Sona isn't open in a tab.</p>,
  },
  {
    id: "install",
    title: "Install Sona as an app",
    icon: Download,
    body: (
      <>
        <p>Sona is a full <strong>installable app (PWA)</strong> — not just a browser bookmark. On desktop and Android, look for the <strong>Download</strong> icon in the sidebar header (next to Share); tapping it opens your browser's native install prompt, the same one you'd see for any app in your device's store.</p>
        <p>Once installed, Sona opens in its own standalone window with no browser address bar, gets a real home-screen/desktop icon, and keeps working offline for anything already loaded.</p>
        <p>On iPhone/iPad, Safari doesn't support that install button — instead, tap the <em>Share</em> icon in Safari's toolbar and choose <em>Add to Home Screen</em>.</p>
      </>
    ),
  },
  {
    id: "security",
    title: "Security model",
    icon: Shield,
    body: (
      <ul className="list-disc pl-5 space-y-1">
        <li>Row-level security on every table: you only see chats you're a member of.</li>
        <li>Media stored in a private bucket, served through short-lived signed URLs.</li>
        <li>AES-GCM 256-bit encryption for hidden chats, keys derived via PBKDF2 (120k iterations).</li>
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
        <ul className="list-disc pl-5 space-y-1">
          <li>✨ AI chat summaries</li>
          <li>🖼️ Vision — Sona reads your images</li>
          <li>🔒 Unlimited hidden encrypted chats</li>
          <li>📞 Voice &amp; video calls</li>
        </ul>
        <p>Subscribe from <em>Settings → Subscription</em>. Billing is handled by Paystack.</p>
      </>
    ),
  },
];

// ─── Upload limits reference ────────────────────────────────────────────────
type LimitRow = {
  key: string;
  type: string;
  icon: React.ComponentType<{ className?: string }>;
  perMessage: string;
  maxSize: number; // bytes, for the progress bar
  maxSizeLabel: string;
  notes: string;
};

const LIMIT_BAR_CEILING = 100 * 1024 * 1024; // 100MB — the largest limit on the page, used to scale every bar consistently

const limitRows: LimitRow[] = [
  {
    key: "image",
    type: "Images",
    icon: ImageIcon,
    perMessage: "Up to 3 per message",
    maxSize: 2 * 1024 * 1024,
    maxSizeLabel: "2 MB each",
    notes: "JPEG, PNG, WebP, GIF — anything your browser can preview.",
  },
  {
    key: "doc",
    type: "Documents",
    icon: FileText,
    perMessage: "Up to 2 per message",
    maxSize: 5 * 1024 * 1024,
    maxSizeLabel: "5 MB each",
    notes: ".pdf, .docx, .txt, .md, .json, .csv, and common source-code extensions.",
  },
  {
    key: "video",
    type: "Videos (chat)",
    icon: Video,
    perMessage: "1 per message",
    maxSize: 100 * 1024 * 1024,
    maxSizeLabel: "100 MB",
    notes: "Uploaded via Cloudinary with a live progress indicator — comfortably covers clips well over 50MB.",
  },
  {
    key: "voice",
    type: "Voice notes",
    icon: Mic,
    perMessage: "1 per message",
    maxSize: 10 * 1024 * 1024,
    maxSizeLabel: "~10 MB",
    notes: "Length isn't capped by a timer — just keep an eye on file size for very long recordings.",
  },
  {
    key: "status",
    type: "Status updates",
    icon: Radio,
    perMessage: "1 photo or video per post",
    maxSize: 10 * 1024 * 1024,
    maxSizeLabel: "10 MB",
    notes: "Video status clips are also capped at 60 seconds, whichever limit is hit first.",
  },
];

function UploadLimitsTable() {
  const [view, setView] = useState<"cards" | "table">("cards");

  const columns = [
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      render: (_: string, row: LimitRow) => (
        <span className="flex items-center gap-2 font-medium">
          <row.icon className="h-4 w-4" style={{ color: BRAND }} />
          {row.type}
        </span>
      ),
    },
    { title: "Per message", dataIndex: "perMessage", key: "perMessage" },
    {
      title: "Max size",
      dataIndex: "maxSizeLabel",
      key: "maxSizeLabel",
      render: (label: string, row: LimitRow) => {
        const pct = Math.round((row.maxSize / LIMIT_BAR_CEILING) * 100);
        const color = pct >= 70 ? GREEN : pct >= 25 ? BRAND : ORANGE;
        return (
          <div className="min-w-[140px]">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-semibold">{label}</span>
            </div>
            <Progress percent={pct} showInfo={false} strokeColor={color} trailColor="#e5e0d6" size="small" />
          </div>
        );
      },
    },
    { title: "Notes", dataIndex: "notes", key: "notes", className: "text-[#8C8C8C]" },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Alert
          type="info"
          showIcon
          message="Files over these limits are skipped automatically"
          description="Sona tells you exactly which files were too large or too many, right in the composer — nothing fails silently."
          style={{ borderColor: `${BRAND}33`, background: `${BRAND}0D` }}
          className="flex-1 mr-3"
        />
        <Segmented
          value={view}
          onChange={(v) => setView(v as "cards" | "table")}
          options={[
            { label: "Cards", value: "cards" },
            { label: "Table", value: "table" },
          ]}
        />
      </div>

      {view === "table" ? (
        <Table
          columns={columns}
          dataSource={limitRows}
          pagination={false}
          rowKey="key"
          className="upload-limits-table"
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {limitRows.map((row, i) => {
            const pct = Math.round((row.maxSize / LIMIT_BAR_CEILING) * 100);
            const color = pct >= 70 ? GREEN : pct >= 25 ? BRAND : ORANGE;
            return (
              <motion.div
                key={row.key}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.35, delay: i * 0.05 }}
                className="rounded-2xl p-4 text-white shadow-md"
                style={{ background: DARK }}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 font-semibold">
                    <row.icon className="h-4 w-4" style={{ color: BRAND }} />
                    {row.type}
                  </span>
                  <Tag color={color} style={{ border: "none" }}>{row.maxSizeLabel}</Tag>
                </div>
                <p className="mt-1 text-xs text-white/60">{row.perMessage}</p>
                <Progress percent={pct} showInfo={false} strokeColor={color} trailColor="rgba(255,255,255,0.12)" size="small" className="mt-2" />
                <p className="mt-2 text-xs text-white/70">{row.notes}</p>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LearnPage() {
  const collapseItems: CollapseProps["items"] = sections.map((s, i) => ({
    key: s.id,
    label: (
      <span className="flex items-center gap-3">
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
          style={{ background: `${BRAND}26`, color: BRAND }}
        >
          <s.icon className="h-4 w-4" />
        </span>
        <span className="font-semibold">
          <span style={{ color: BRAND }}>{i + 1}.</span> {s.title}
        </span>
        {s.pro && <Tag color={ORANGE} style={{ border: "none" }}>Pro</Tag>}
      </span>
    ),
    children: (
      <div className="space-y-2 text-sm leading-relaxed pl-11 text-[#2D3436] dark:text-[#E8E8E8]">
        {s.body}
      </div>
    ),
  }));

  return (
    <div className="min-h-dvh bg-[#F0EBE3] text-[#2D3436] dark:bg-[#1A1A1A] dark:text-[#E8E8E8]">
      <header className="sticky top-0 z-10 border-b border-[#E07A5F]/20 text-white" style={{ background: BRAND }}>
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <Link to="/" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/20"><ArrowLeft className="h-4 w-4" /></Link>
          <div>
            <h1 className="text-lg font-bold leading-tight">Learn Sona</h1>
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/80">Every feature, and every upload limit</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl gap-8 px-4 py-8">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-2xl border border-[#E07A5F]/15 bg-[#FFFDF9] dark:bg-[#242424] p-6 mb-8"
        >
          <h2 className="text-2xl font-bold">Welcome to Sona ✨</h2>
          <p className="mt-2 text-[#8C8C8C]">Sona is a warm, private messenger with a built-in AI companion. Below is everything the app can do, followed by a quick reference for every upload limit in one place.</p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <Badge color={GREEN} text="Available on Free" />
            <Divider type="vertical" />
            <Badge color={ORANGE} text="Sona Pro" />
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.4 }}
          className="rounded-2xl border border-[#E07A5F]/15 bg-[#FFFDF9] dark:bg-[#242424] p-6 mb-8"
        >
          <h2 className="text-xl font-bold mb-1">Upload limits</h2>
          <p className="text-sm text-[#8C8C8C] mb-4">What you can attach, how many at once, and how big each file can be.</p>
          <UploadLimitsTable />
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.4 }}
          className="rounded-2xl border border-[#E07A5F]/15 bg-[#FFFDF9] dark:bg-[#242424] p-6"
        >
          <h2 className="text-xl font-bold mb-1">Features, A to Z</h2>
          <p className="text-sm text-[#8C8C8C] mb-4">Tap any section to expand it.</p>
          <Collapse
            items={collapseItems}
            bordered={false}
            className="learn-collapse"
            style={{ background: "transparent" }}
          />
        </motion.section>

        <div className="pt-8 text-center pb-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:opacity-90"
            style={{ background: BRAND }}
          >
            <MessageCircle className="h-4 w-4" /> Back to chats
          </Link>
        </div>
      </main>
    </div>
  );
}
