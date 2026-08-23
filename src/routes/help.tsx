import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, MessageCircle, Lock, Users, Bell, Sparkles, CreditCard, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help Center — Sona" },
      { name: "description", content: "Answers to common questions about messaging, privacy, groups, notifications, Sona AI, and billing." },
      { property: "og:title", content: "Sona Help Center" },
      { property: "og:description", content: "Real answers to the questions people actually ask about Sona." },
    ],
  }),
  component: HelpPage,
});

type Topic = {
  icon: typeof MessageCircle;
  title: string;
  items: { q: string; a: string }[];
};

const TOPICS: Topic[] = [
  {
    icon: MessageCircle,
    title: "Messaging",
    items: [
      {
        q: "Can I unsend a message after everyone has seen it?",
        a: "Yes. Long-press (or right-click on desktop) any message you sent and choose Delete for everyone. This removes it from the chat for all participants, not just your own view. There's no time limit, but if someone already screenshotted it, deleting the message can't undo that — nothing can, in any app.",
      },
      {
        q: "What's the difference between Delete for me and Delete for everyone?",
        a: "Delete for me removes the message from your device only; everyone else still sees it. Delete for everyone removes it from the conversation for all participants. You'll only see the second option on messages you sent.",
      },
      {
        q: "Why does a message show 'Delivered' but not 'Read'?",
        a: "Delivered means the message reached the recipient's device. Read appears once they've actually opened the chat. If someone has read receipts turned off in their settings, you won't see a Read status even after they've seen it — that's their choice to make, and if you turn yours off, you won't see others' read receipts either.",
      },
      {
        q: "Can I schedule a message to send later?",
        a: "Yes — open the composer, tap and hold the send button, and choose a time. The message stays in a Scheduled queue until then and can be edited or cancelled before it goes out.",
      },
    ],
  },
  {
    icon: Lock,
    title: "Privacy & security",
    items: [
      {
        q: "Are my messages encrypted?",
        a: "All messages are protected by row-level database security so only chat participants can access them. For a stronger guarantee, Sona Pro lets you turn any chat into a hidden, encrypted chat — messages are encrypted on your device before they're sent, and the server only ever stores unreadable ciphertext.",
      },
      {
        q: "Can Sona staff read my messages?",
        a: "Regular messages are stored securely and access is restricted to what's needed for moderation of reported content. Encrypted chats (Sona Pro) go further — the server literally cannot decrypt them, so there's nothing for anyone, staff included, to read.",
      },
      {
        q: "Someone is harassing me — what can I do?",
        a: "Open the chat, tap their name, and choose Report. You can block them at the same time, which stops them from messaging you or seeing your profile. Reports go to our moderation team, and repeat or severe violations can result in suspension or a ban.",
      },
      {
        q: "How do I set an app lock?",
        a: "In Settings → Privacy, enable App Lock and set a PIN or use biometric unlock (Face ID / fingerprint, on supported devices). This locks the entire app whenever it's reopened after being backgrounded.",
      },
    ],
  },
  {
    icon: Users,
    title: "Groups",
    items: [
      {
        q: "How many people can be in a group?",
        a: "Standard groups support up to 256 members. If you need more for a community or event, contact us — larger group support is available on a case-by-case basis.",
      },
      {
        q: "How do I stop being added to random groups?",
        a: "In Settings → Privacy → Groups, choose who can add you: Everyone, My Contacts, or Nobody. When set to Nobody, people will need to send you an invite link instead, which you can accept or decline.",
      },
      {
        q: "Can I leave a group without people noticing?",
        a: "You can leave any group at any time from the group info screen. Other members will see you've left in the member list, the same way they would in any group — there's no silent-leave option, since transparency about group membership matters for the people still in the conversation.",
      },
    ],
  },
  {
    icon: Sparkles,
    title: "Sona AI",
    items: [
      {
        q: "How do I talk to Sona AI?",
        a: "Type @sona anywhere in any chat to bring the assistant into that specific conversation, or open the dedicated Sona AI chat from your chat list for a one-on-one conversation with it directly.",
      },
      {
        q: "Does Sona AI read all my messages?",
        a: "No. It only sees messages in a conversation when you explicitly mention it with @sona, or when you're chatting with it directly. It doesn't passively monitor your other conversations.",
      },
      {
        q: "Can I ask Sona AI about an image?",
        a: "Yes — attach a photo in any chat where you're talking to Sona AI (or mention @sona with an image attached) and ask your question directly in the message.",
      },
    ],
  },
  {
    icon: Bell,
    title: "Notifications",
    items: [
      {
        q: "I'm not getting notifications for a specific chat",
        a: "Open that chat, tap the chat name at the top, and check that it's not muted. Also confirm notifications are allowed for the app in your phone's system settings — muting can happen at either level.",
      },
      {
        q: "How do I mute a group without leaving it?",
        a: "Open the group info screen and toggle Mute. You can mute for 8 hours, 1 week, or always, and you'll still receive messages, just without a notification.",
      },
    ],
  },
  {
    icon: CreditCard,
    title: "Sona Pro & billing",
    items: [
      {
        q: "What does Sona Pro include?",
        a: "Sona Pro adds hidden and encrypted chats, larger file uploads, priority support, and removes standard usage limits. Check the Upgrade screen in Settings for the current full feature list and pricing.",
      },
      {
        q: "How do I cancel my subscription?",
        a: "Go to Settings → Sona Pro → Manage subscription. Cancelling stops future renewals but keeps your Pro features active until the end of the current billing period.",
      },
      {
        q: "I was charged but don't see Pro features unlocked",
        a: "This is usually a sync delay — try closing and reopening the app. If Pro still isn't active after a few minutes, contact support with your payment receipt and we'll sort it out.",
      },
    ],
  },
  {
    icon: ShieldAlert,
    title: "Account & safety",
    items: [
      {
        q: "How do I recover my account if I lose access?",
        a: "Use the Forgot password link on the sign-in screen with the email tied to your account. If you no longer have access to that email, contact support with any identifying account details you have (username, sign-up date, recent contacts) so we can verify ownership.",
      },
      {
        q: "How do I permanently delete my account?",
        a: "Go to Settings → Account → Delete account. This is permanent: your messages, groups, and profile are removed and this cannot be undone. If you're unsure, consider deactivating instead, if that option is available to you.",
      },
    ],
  },
];

function HelpPage() {
  return (
    <div className="min-h-dvh bg-[#FAF8F5] text-[#111b21] dark:bg-[#151c1c] dark:text-white">
      <header className="sticky top-0 z-10 border-b border-black/5 bg-white dark:bg-[#1a1a1a]">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link to="/" className="grid h-10 w-10 place-items-center rounded-full transition hover:bg-black/5 dark:hover:bg-white/10">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-bold">Help Center</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="mb-8 text-sm leading-6 text-[#667781] dark:text-[#aebac1]">
          Answers to the questions people actually ask us, grouped by topic. Can't find yours?{" "}
          <Link to="/faq" className="text-[#E07A5F] hover:underline">Check the FAQ</Link> or reach out from Settings → Help.
        </p>

        <div className="space-y-8">
          {TOPICS.map((topic) => (
            <section key={topic.title}>
              <div className="mb-3 flex items-center gap-2">
                <topic.icon className="h-4 w-4 text-[#E07A5F]" />
                <h2 className="text-base font-bold">{topic.title}</h2>
              </div>
              <div className="space-y-3">
                {topic.items.map((item) => (
                  <div key={item.q} className="rounded-2xl border border-black/5 bg-white p-4 dark:border-white/10 dark:bg-[#202c33]">
                    <p className="text-sm font-semibold leading-6">{item.q}</p>
                    <p className="mt-1.5 text-sm leading-6 text-[#667781] dark:text-[#aebac1]">{item.a}</p>
                  </div>
                ))}
              </div>
            </section>
          ))}
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
