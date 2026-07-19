import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, MessageCircle, Sparkles, Lock, Mic, Image as ImageIcon, Users, Bell, Shield, Crown, Phone } from "lucide-react";

export const Route = createFileRoute("/learn")({
  head: () => ({
    meta: [
      { title: "Learn Sona — How the app works" },
      { name: "description", content: "A guided tour of Sona: chats, AI, voice notes, encryption, reactions, calls and Sona Pro." },
      { property: "og:title", content: "Learn Sona" },
      { property: "og:description", content: "A guided tour of Sona's chat, AI and privacy features." },
    ],
  }),
  component: LearnPage,
});

type Section = { id: string; title: string; icon: React.ComponentType<{ className?: string }>; body: React.ReactNode };

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
        <p>Tap a bubble to see quick actions: <em>Reply</em>, <em>React</em>, <em>Edit</em>, or <em>Delete for everyone</em>. Long-press or right-click a chat in the sidebar to select and bulk-delete.</p>
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
        <p>Sona can read images you attach and answer questions about them (Pro).</p>
      </>
    ),
  },
  {
    id: "media",
    title: "Photos & voice notes",
    icon: ImageIcon,
    body: (
      <>
        <p>Tap the paperclip or image icon to attach a photo. Preview it before sending.</p>
        <p>Tap the microphone (when the input is empty) to record a voice note. Send when done, or trash to cancel. Recipients get an inline player with progress.</p>
      </>
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
    id: "privacy",
    title: "Hidden chats & encryption",
    icon: Lock,
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
    body: <p>Voice and video calls are part of <strong>Sona Pro</strong>. Tap the phone or camera icon in the chat header to start a call.</p>,
  },
  {
    id: "notifications",
    title: "Notifications & PWA",
    icon: Bell,
    body: (
      <>
        <p>Enable push notifications from <em>Settings → Advanced</em>. Add Sona to your home screen from your browser menu — it works as an installable PWA.</p>
      </>
    ),
  },
  {
    id: "security",
    title: "Security model",
    icon: Shield,
    body: (
      <>
        <ul className="list-disc pl-5 space-y-1">
          <li>Row-level security on every table: you only see chats you're a member of.</li>
          <li>Media stored in a private bucket, served through short-lived signed URLs.</li>
          <li>AES-GCM 256-bit encryption for hidden chats, keys derived via PBKDF2 (120k iterations).</li>
          <li>Blocked users disappear from your sidebar and can't message you.</li>
        </ul>
      </>
    ),
  },
  {
    id: "pro",
    title: "Sona Pro",
    icon: Crown,
    body: (
      <>
        <p>Sona Pro unlocks the premium layer:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>✨ AI chat summaries</li>
          <li>🖼️ Vision — Sona reads your images</li>
          <li>🔒 Unlimited hidden encrypted chats</li>
          <li>📞 Voice & video calls</li>
        </ul>
        <p>Subscribe from <em>Settings → Subscription</em>. Billing is handled by Paystack.</p>
      </>
    ),
  },
];

function LearnPage() {
  return (
    <div className="min-h-dvh bg-[#F0EBE3] text-[#2D3436] dark:bg-[#1A1A1A] dark:text-[#E8E8E8]">
      <header className="sticky top-0 z-10 border-b border-[#E07A5F]/20 bg-[#E07A5F] text-white">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <Link to="/" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/20"><ArrowLeft className="h-4 w-4" /></Link>
          <div>
            <h1 className="text-lg font-bold leading-tight">Learn Sona</h1>
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/80">How the app works</p>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-4xl gap-8 px-4 py-8 md:grid-cols-[220px_1fr]">
        <nav className="md:sticky md:top-20 md:self-start rounded-2xl border border-[#E07A5F]/15 bg-[#FFFDF9] dark:bg-[#242424] p-4">
          <h2 className="text-xs uppercase tracking-widest text-[#8C8C8C] mb-3">Contents</h2>
          <ol className="space-y-1.5 text-sm">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[#F4A261]/20 text-[#2D3436] dark:text-[#E8E8E8]">
                  <span className="text-[#E07A5F] font-semibold w-5 tabular-nums">{i + 1}.</span>
                  <s.icon className="h-3.5 w-3.5 text-[#E07A5F] shrink-0" />
                  <span className="truncate">{s.title}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="space-y-10">
          <section className="rounded-2xl border border-[#E07A5F]/15 bg-[#FFFDF9] dark:bg-[#242424] p-6">
            <h2 className="text-2xl font-bold">Welcome to Sona ✨</h2>
            <p className="mt-2 text-[#8C8C8C]">Sona is a warm, private messenger with a built-in AI companion. This page walks you through everything the app can do — jump to any section using the table of contents.</p>
          </section>

          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-24 rounded-2xl border border-[#E07A5F]/15 bg-[#FFFDF9] dark:bg-[#242424] p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#E07A5F]/15 text-[#E07A5F]">
                  <s.icon className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-bold"><span className="text-[#E07A5F]">{i + 1}.</span> {s.title}</h3>
              </div>
              <div className="space-y-2 text-sm leading-relaxed text-[#2D3436] dark:text-[#E8E8E8]">{s.body}</div>
            </section>
          ))}

          <div className="pt-4 text-center">
            <Link to="/" className="inline-flex items-center gap-2 rounded-full bg-[#E07A5F] px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-[#D4694F]">
              <MessageCircle className="h-4 w-4" /> Back to chats
            </Link>
          </div>
        </article>
      </main>
    </div>
  );
}
