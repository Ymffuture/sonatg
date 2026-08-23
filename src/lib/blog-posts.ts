export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  date: string; // ISO date, display only
  readMins: number;
  tag: string;
  body: string[]; // paragraphs, rendered as-is
};

export const blogPosts: BlogPost[] = [
  {
    slug: "end-to-end-privacy-in-everyday-chat",
    title: "What 'Private' Should Actually Mean in a Chat App",
    description:
      "Most apps say 'your data is safe' without explaining what that means. Here's a plain-language look at what Sona actually does — and doesn't do — with your messages.",
    date: "2026-07-02",
    readMins: 6,
    tag: "Privacy",
    body: [
      "Every messaging app claims to care about privacy. Almost none explain what that promise actually covers. When you send a message, who can read it — right now, and five years from now? That question is more useful than any marketing slogan, so let's answer it directly for how Sona is built.",
      "By default, messages in Sona are stored so that only members of a chat can read them, enforced at the database level with row-level security rather than trusted to application code alone. That distinction matters: a bug in a screen's logic shouldn't be able to leak a stranger's conversation, because the database itself refuses the request before it ever reaches your screen.",
      "For people who want a stronger guarantee, Sona Pro adds the option to hide and encrypt a conversation. When you turn this on, new messages in that chat are encrypted on your own device using AES-GCM before they ever leave it. The server stores ciphertext it cannot read. Reopening that chat later requires the passcode you set, which decrypts the conversation locally, on your device, not on a server somewhere.",
      "It's worth being honest about what this does and doesn't protect against. Client-side encryption protects your messages from a compromised or curious server operator, and from anyone intercepting traffic in transit. It does not protect you if someone has physical access to your unlocked device, or if the person you're chatting with chooses to screenshot or forward what you sent them — no messaging app, encrypted or not, can prevent that, because at some point the message has to be readable by a human being on the other end.",
      "That last point is one people underestimate. A lot of 'privacy' anxiety in group chats isn't really about encryption at all — it's about who has access to the group, and whether messages can be deleted for everyone once sent. Sona lets you delete a message for everyone, not just yourself, and lets you leave or be removed from a group, both of which do more for day-to-day privacy than encryption alone.",
      "The practical takeaway: use hidden, encrypted chats for the conversations where confidentiality genuinely matters to you — financial details, health information, anything you'd rather not have sitting in plaintext on a server. For everyday chatting with friends, the default row-level security is already doing real work you don't have to think about. Privacy in a chat app isn't one feature; it's a set of layered decisions, and knowing which layer protects against which threat is more useful than trusting a single badge that says 'encrypted.'",
    ],
  },
  {
    slug: "why-your-group-chat-feels-chaotic",
    title: "Why Your Group Chat Feels Chaotic (and How to Fix It Without Leaving It)",
    description:
      "Group chats don't get chaotic because of the people in them — they get chaotic because most chat apps give you no tools to organize a fast-moving conversation. Here's what actually helps.",
    date: "2026-07-18",
    readMins: 5,
    tag: "Guides",
    body: [
      "There's a specific feeling everyone who's been in an active group chat knows: you open the app, see 40 unread messages, and have no idea which three actually matter to you. This isn't a discipline problem or a 'too many people' problem. It's a tooling problem — most chat apps are built for one-on-one conversation and just stretch that same flat, linear format across a group, with no way to separate the important thread from the noise.",
      "The single most useful fix is threaded replies. Instead of a message getting buried the moment three other people start talking about something else, replying to a specific message keeps that sub-conversation visibly attached to what it's responding to. In Sona, tapping Reply on any message quotes it, and if a message accumulates enough replies, it becomes an open-able thread — so the person who asked 'what time are we meeting?' three messages ago doesn't have to scroll back to find the answer.",
      "Pinning is the second underused tool. Every active group chat eventually needs a message everyone should be able to find without scrolling — an address, a deadline, a link. Pinning that message keeps it fixed at the top of the chat instead of relying on everyone's memory or a screenshot someone took and then lost.",
      "Reactions do more organizational work than people give them credit for. A thumbs-up on 'can everyone confirm 6pm' is a faster, less noisy way to answer than fourteen separate 'yes' messages, each of which triggers a notification for everyone else. If your group chat notification volume feels unmanageable, look at how many of those messages are actually answers to a yes/no question that a reaction would have handled silently.",
      "Scheduled messages solve a different, quieter problem: the 11pm thought you have about tomorrow's plan that you don't want to send at 11pm. Writing it now and scheduling it for 9am the next day means the idea doesn't get lost, and nobody's phone buzzes at a bad hour.",
      "None of this requires switching apps or imposing new rules on your group. It requires knowing the tools exist and reaching for the right one — reply instead of retyping context, pin instead of relying on memory, react instead of piling on identical replies, schedule instead of sending at a bad time. Chaos in a group chat is almost always a missing feature, not a people problem.",
    ],
  },
  {
    slug: "ai-inside-your-messages-without-losing-context",
    title: "The Right Way to Put AI Inside a Chat App",
    description:
      "Bolting a chatbot onto a messaging app is easy. Making it useful without breaking the flow of a real conversation is the actual hard part. Here's the design thinking behind Sona AI.",
    date: "2026-08-05",
    readMins: 7,
    tag: "Product",
    body: [
      "The easy version of 'AI in a chat app' is a separate tab with a chatbot in it, disconnected from everything else happening in your conversations. That's not nothing, but it treats AI as a bolt-on feature rather than something that understands the context you're already in — which is where most of the actual value would come from.",
      "The harder, more useful version is AI that can be summoned inside the conversation you're already having, without forcing you to copy-paste context into a separate window. That's the reasoning behind how @sona mentions work: typing @sona anywhere in a message, in any chat, brings the assistant into that specific conversation with access to what's actually being discussed, rather than starting from a blank slate every time.",
      "There's a real design tension here worth naming honestly: an AI that can read your conversation is more useful, but it's also a bigger trust ask. That's why Sona AI only participates in a chat when explicitly mentioned or when you're talking to it directly in its own dedicated chat — it doesn't passively read every conversation you're part of. Being summoned, not ambient, is the difference between a tool you control and one that feels like it's always listening.",
      "Image understanding follows the same logic. Being able to attach a photo and ask a question about it — 'what does this error mean,' 'translate this menu,' 'is this receipt itemized correctly' — is only useful if it happens inside the flow of the conversation you're already having, not in a separate upload-and-wait interface. Keeping that capability inside the chat composer, rather than behind a different screen, is what makes people actually use it instead of forgetting it exists.",
      "The last piece is restraint. Every additional AI feature is a candidate for making the app feel cluttered or gimmicky. The features that earned a place in Sona — mention-based summoning, image Q&A, and AI-assisted replies — were each kept because they solved a real friction point people ran into while chatting, not because 'AI' needed to be present somewhere in the product. That's a smaller, more deliberate list than most AI feature roadmaps, and it's smaller on purpose: an assistant you reach for is more valuable than one you have to work around.",
    ],
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug);
}
