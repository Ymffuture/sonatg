import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search, MoreVertical, Phone, Video, Paperclip, Smile, Send, Mic,
  ArrowLeft, Check, CheckCheck, Moon, Sun, Image as ImageIcon, Plus, X,
} from "lucide-react";
import { initialChats, type Chat, type Message } from "@/lib/chat-data";

function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    const stored = localStorage.getItem("sona-theme");
    if (stored === "dark" || stored === "light") return stored;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    localStorage.setItem("sona-theme", theme);
  }, [theme]);
  return { theme, toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")) };
}

const nowTime = () =>
  new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function Ticks({ status }: { status?: Message["status"] }) {
  if (!status) return null;
  if (status === "sent") return <Check className="h-3.5 w-3.5 opacity-70" />;
  if (status === "delivered") return <CheckCheck className="h-3.5 w-3.5 opacity-70" />;
  return <CheckCheck className="h-3.5 w-3.5 text-skyblue-deep" />;
}

function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br from-skyblue to-skyblue-deep text-primary-foreground shadow-md">
        <span className="text-lg font-black tracking-tight">S</span>
      </div>
      <div className="leading-tight">
        <div className="text-base font-bold">Sona</div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">talk gold</div>
      </div>
    </div>
  );
}

function ChatListItem({
  chat, active, onClick,
}: { chat: Chat; active: boolean; onClick: () => void }) {
  const last = chat.messages[chat.messages.length - 1];
  const preview = last?.text ?? (last?.image ? "📷 Photo" : "");
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-secondary ${
        active ? "bg-secondary" : ""
      }`}
    >
      <div className="relative shrink-0">
        <img src={chat.avatar} alt={chat.name} className="h-12 w-12 rounded-full object-cover" />
        {chat.online && (
          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-sidebar bg-emerald-500" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-semibold">{chat.name}</span>
          <span className="text-[11px] text-muted-foreground">{last?.time}</span>
        </div>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          {last?.fromMe && <Ticks status={last.status} />}
          <span className="truncate">{preview}</span>
        </div>
      </div>
    </button>
  );
}

function Bubble({ msg }: { msg: Message }) {
  const mine = msg.fromMe;
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`relative max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-bubble ${
          mine
            ? "rounded-br-md bg-bubble-me text-bubble-me-foreground"
            : "rounded-bl-md bg-bubble-them text-bubble-them-foreground"
        }`}
      >
        {msg.image && (
          <img
            src={msg.image}
            alt=""
            className="mb-1 max-h-72 w-full rounded-xl object-cover"
          />
        )}
        {msg.text && <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.text}</p>}
        <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] opacity-70">
          <span>{msg.time}</span>
          {mine && <Ticks status={msg.status} />}
        </div>
      </div>
    </div>
  );
}

const EMOJIS = ["😀","😂","🥲","😍","😎","🤔","🙌","👍","🔥","🎉","❤️","✨","🥂","📷","🙏","😴"];

export default function SonaChat() {
  const { theme, toggle } = useTheme();
  const [chats, setChats] = useState<Chat[]>(initialChats);
  const [activeId, setActiveId] = useState<string>(initialChats[0].id);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [showSidebarMobile, setShowSidebarMobile] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const active = chats.find((c) => c.id === activeId)!;
  const filtered = useMemo(
    () => chats.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())),
    [chats, query]
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [activeId, active.messages.length]);

  const send = () => {
    if (!draft.trim() && !pendingImage) return;
    const msg: Message = {
      id: crypto.randomUUID(),
      fromMe: true,
      text: draft.trim() || undefined,
      image: pendingImage ?? undefined,
      time: nowTime(),
      status: "sent",
    };
    setChats((cs) =>
      cs.map((c) => (c.id === activeId ? { ...c, messages: [...c.messages, msg] } : c))
    );
    setDraft("");
    setPendingImage(null);
    setShowEmoji(false);

    // simulate delivered → read + auto reply
    setTimeout(() => updateStatus(msg.id, "delivered"), 600);
    setTimeout(() => updateStatus(msg.id, "read"), 1500);
    setTimeout(() => {
      const reply: Message = {
        id: crypto.randomUUID(),
        fromMe: false,
        text: pickReply(msg.text),
        time: nowTime(),
      };
      setChats((cs) =>
        cs.map((c) => (c.id === activeId ? { ...c, messages: [...c.messages, reply] } : c))
      );
    }, 2200);
  };

  const updateStatus = (id: string, status: Message["status"]) =>
    setChats((cs) =>
      cs.map((c) =>
        c.id === activeId
          ? { ...c, messages: c.messages.map((m) => (m.id === id ? { ...m, status } : m)) }
          : c
      )
    );

  const onPickFile = (f?: File | null) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setPendingImage(String(reader.result));
    reader.readAsDataURL(f);
  };

  return (
    <div className="h-dvh w-full bg-background text-foreground">
      <div className="mx-auto flex h-full max-w-[1400px] overflow-hidden md:p-4">
        <div className="flex h-full w-full overflow-hidden rounded-none bg-card shadow-xl md:rounded-3xl md:border">
          {/* Sidebar */}
          <aside
            className={`${
              showSidebarMobile ? "flex" : "hidden"
            } h-full w-full flex-col border-r bg-sidebar text-sidebar-foreground md:flex md:w-[340px] lg:w-[380px]`}
          >
            <div className="flex items-center justify-between gap-2 px-4 py-3">
              <Logo />
              <div className="flex items-center gap-1">
                <button
                  onClick={toggle}
                  aria-label="Toggle theme"
                  className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary"
                >
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
                <button className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary">
                  <Plus className="h-4 w-4" />
                </button>
                <button className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary">
                  <MoreVertical className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="px-3 pb-2">
              <div className="flex items-center gap-2 rounded-full bg-secondary px-3 py-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search or start new chat"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>

            <div className="scrollbar-thin flex-1 overflow-y-auto">
              {filtered.map((c) => (
                <ChatListItem
                  key={c.id}
                  chat={c}
                  active={c.id === activeId}
                  onClick={() => {
                    setActiveId(c.id);
                    setShowSidebarMobile(false);
                  }}
                />
              ))}
              {filtered.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">No chats found</div>
              )}
            </div>
          </aside>

          {/* Chat panel */}
          <section
            className={`${
              showSidebarMobile ? "hidden" : "flex"
            } h-full min-w-0 flex-1 flex-col md:flex`}
          >
            {/* Header */}
            <header className="flex items-center gap-3 border-b bg-card px-3 py-2.5 md:px-4">
              <button
                onClick={() => setShowSidebarMobile(true)}
                className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary md:hidden"
                aria-label="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <img src={active.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{active.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {active.online ? "online" : active.lastSeen ?? "offline"}
                </div>
              </div>
              <button className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary">
                <Video className="h-4 w-4" />
              </button>
              <button className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary">
                <Phone className="h-4 w-4" />
              </button>
              <button className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary">
                <MoreVertical className="h-4 w-4" />
              </button>
            </header>

            {/* Messages */}
            <div ref={scrollRef} className="scrollbar-thin chat-pattern flex-1 overflow-y-auto px-3 py-4 md:px-8">
              <div className="mx-auto flex max-w-3xl flex-col gap-2">
                <div className="mx-auto rounded-full bg-card/80 px-3 py-1 text-[11px] text-muted-foreground backdrop-blur">
                  End-to-end encrypted · Sona keeps it gold
                </div>
                {active.messages.map((m) => (
                  <Bubble key={m.id} msg={m} />
                ))}
              </div>
            </div>

            {/* Pending image preview */}
            {pendingImage && (
              <div className="border-t bg-card px-3 py-2 md:px-6">
                <div className="mx-auto flex max-w-3xl items-center gap-3">
                  <img src={pendingImage} alt="" className="h-14 w-14 rounded-lg object-cover" />
                  <span className="flex-1 text-sm text-muted-foreground">Image ready to send</span>
                  <button
                    onClick={() => setPendingImage(null)}
                    className="grid h-8 w-8 place-items-center rounded-full hover:bg-secondary"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Composer */}
            <div className="relative border-t bg-card px-2 py-2 md:px-6 md:py-3">
              {showEmoji && (
                <div className="absolute bottom-full left-2 mb-2 grid max-w-xs grid-cols-8 gap-1 rounded-2xl border bg-popover p-2 shadow-xl md:left-6">
                  {EMOJIS.map((e) => (
                    <button
                      key={e}
                      onClick={() => setDraft((d) => d + e)}
                      className="grid h-8 w-8 place-items-center rounded-lg text-lg hover:bg-secondary"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}
              <div className="mx-auto flex max-w-3xl items-end gap-2">
                <button
                  onClick={() => setShowEmoji((s) => !s)}
                  className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground hover:bg-secondary"
                  aria-label="Emoji"
                >
                  <Smile className="h-5 w-5" />
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground hover:bg-secondary"
                  aria-label="Attach"
                >
                  <Paperclip className="h-5 w-5" />
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onPickFile(e.target.files?.[0])}
                />
                <div className="flex flex-1 items-center gap-2 rounded-3xl bg-secondary px-4 py-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    rows={1}
                    placeholder="Type a message"
                    className="max-h-32 min-h-6 flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Image"
                  >
                    <ImageIcon className="h-4 w-4" />
                  </button>
                </div>
                <button
                  onClick={send}
                  className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-skyblue to-skyblue-deep text-primary-foreground shadow-md transition-transform hover:scale-105"
                  aria-label="Send"
                >
                  {draft.trim() || pendingImage ? (
                    <Send className="h-5 w-5" />
                  ) : (
                    <Mic className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function pickReply(text?: string) {
  const t = (text ?? "").toLowerCase();
  if (t.includes("hi") || t.includes("hello") || t.includes("hey")) return "Hey! 👋";
  if (t.includes("?")) return "Hmm, let me think about that 🤔";
  if (t.includes("love") || t.includes("❤️")) return "❤️❤️";
  const options = ["Got it!", "Sounds good 👍", "Haha 😂", "Nice!", "Talk gold ✨", "On my way!"];
  return options[Math.floor(Math.random() * options.length)];
}
