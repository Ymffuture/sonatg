export type Message = {
  id: string;
  fromMe: boolean;
  text?: string;
  image?: string;
  time: string;
  status?: "sent" | "delivered" | "read";
};

export type Chat = {
  id: string;
  name: string;
  avatar: string;
  online?: boolean;
  lastSeen?: string;
  messages: Message[];
};

const avatar = (seed: string, bg = "AEE4FF", fg = "1F2937") =>
  `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${bg}&textColor=${fg}`;

export const initialChats: Chat[] = [
  {
    id: "1",
    name: "Aarav Mehta",
    avatar: avatar("Aarav Mehta"),
    online: true,
    messages: [
      { id: "m1", fromMe: false, text: "Hey! Are we still on for tonight?", time: "09:12" },
      { id: "m2", fromMe: true, text: "Absolutely! 8pm at the usual place ✨", time: "09:14", status: "read" },
      { id: "m3", fromMe: false, text: "Perfect. I'll bring the cards.", time: "09:15" },
      { id: "m4", fromMe: true, text: "Sona - talk gold 🥂", time: "09:16", status: "read" },
    ],
  },
  {
    id: "2",
    name: "Priya Sharma",
    avatar: avatar("Priya Sharma", "FCD5CE"),
    lastSeen: "last seen today at 10:24",
    messages: [
      { id: "m1", fromMe: false, text: "Check this out 👇", time: "Yesterday" },
      { id: "m2", fromMe: false, image: "https://images.unsplash.com/photo-1503023345310-bd7c1de61c7d?w=600&q=70", time: "Yesterday" },
      { id: "m3", fromMe: true, text: "Whoa, gorgeous shot!", time: "Yesterday", status: "delivered" },
    ],
  },
  {
    id: "3",
    name: "Design Team",
    avatar: avatar("Design Team", "CDE7B0"),
    online: true,
    messages: [
      { id: "m1", fromMe: false, text: "Kavya: pushed the new tokens", time: "08:02" },
      { id: "m2", fromMe: false, text: "Rohit: 🔥🔥", time: "08:03" },
      { id: "m3", fromMe: true, text: "Reviewing now.", time: "08:20", status: "read" },
    ],
  },
  {
    id: "4",
    name: "Mom ❤️",
    avatar: avatar("Mom", "FFD6A5"),
    lastSeen: "online",
    online: true,
    messages: [
      { id: "m1", fromMe: false, text: "Beta, khaana kha liya?", time: "Mon" },
      { id: "m2", fromMe: true, text: "Haan Ma, abhi kar raha 🍛", time: "Mon", status: "read" },
    ],
  },
  {
    id: "5",
    name: "Kabir",
    avatar: avatar("Kabir", "D0BFFF"),
    lastSeen: "last seen yesterday",
    messages: [
      { id: "m1", fromMe: false, text: "Bro, send that doc?", time: "Sun" },
      { id: "m2", fromMe: true, text: "Sending in 5.", time: "Sun", status: "sent" },
    ],
  },
];
