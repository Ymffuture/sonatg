import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Search, MoreVertical, Paperclip, Smile, Send, Mic, ArrowLeft, Moon, Sun,
  Image as ImageIcon, Plus, X, LogOut, Sparkles, Play, Pause, Trash2, SmilePlus,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { askSonaAI } from "@/lib/ai.functions";
import { SONA_AI_ID, fmtTime, type ChatRow, type MessageRow, type Profile, type ReactionRow } from "@/lib/db";
import { toast } from "sonner";

type ChatWithMeta = ChatRow & {
  memberIds: string[];
  members: Profile[];
  lastMessage?: MessageRow;
};

function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("sona-theme") : null;
    const t = stored === "dark" || stored === "light"
      ? stored
      : window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    setTheme(t as "light" | "dark");
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("sona-theme", theme);
  }, [theme]);
  return { theme, toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")) };
}

const EMOJIS = ["😀","😂","🥲","😍","😎","🤔","🙌","👍","🔥","🎉","❤️","✨","🥂","📷","🙏","😴"];
const REACT_EMOJIS = ["❤️","😂","👍","🔥","😮","🙏"];

function Avatar({ url, name, size = 40 }: { url?: string | null; name: string; size?: number }) {
  const src = url || `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=AEE4FF&textColor=1F2937`;
  return <img src={src} alt={name} style={{ width: size, height: size }} className="rounded-full object-cover shrink-0" />;
}

function chatTitle(c: ChatWithMeta, meId: string) {
  if (c.title && c.is_group) return c.title;
  const other = c.members.find((m) => m.id !== meId);
  if (other?.is_ai) return "Sona AI";
  return other?.display_name || c.title || "Chat";
}
function chatAvatar(c: ChatWithMeta, meId: string) {
  const other = c.members.find((m) => m.id !== meId);
  return other?.avatar_url ?? null;
}
function isAIChat(c: ChatWithMeta) {
  return c.memberIds.includes(SONA_AI_ID);
}

export default function SonaChat() {
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const askAI = useServerFn(askSonaAI);

  const [me, setMe] = useState<Profile | null>(null);
  const [chats, setChats] = useState<ChatWithMeta[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [reactions, setReactions] = useState<ReactionRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [showSidebarMobile, setShowSidebarMobile] = useState(true);
  const [showNewChat, setShowNewChat] = useState(false);
  const [reactingOn, setReactingOn] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Bootstrap: current user + profile
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { navigate({ to: "/auth" }); return; }
      const { data: p } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
      if (p) setMe(p as Profile);
    })();
  }, [navigate]);

  // Load chats + members + latest messages
  const loadChats = useCallback(async () => {
    if (!me) return;
    const { data: memberships } = await supabase
      .from("chat_members").select("chat_id").eq("user_id", me.id);
    const chatIds = (memberships ?? []).map((m: { chat_id: string }) => m.chat_id);
    if (chatIds.length === 0) { setChats([]); return; }

    const { data: chatRows } = await supabase
      .from("chats").select("*").in("id", chatIds).order("last_message_at", { ascending: false });
    const { data: allMembers } = await supabase
      .from("chat_members").select("chat_id, user_id").in("chat_id", chatIds);
    const memberIds = Array.from(new Set((allMembers ?? []).map((m: { user_id: string }) => m.user_id)));
    const { data: profs } = await supabase.from("profiles").select("*").in("id", memberIds);

    const profMap: Record<string, Profile> = {};
    (profs ?? []).forEach((p) => { profMap[(p as Profile).id] = p as Profile; });
    setProfiles((prev) => ({ ...prev, ...profMap }));

    // last message per chat
    const { data: latest } = await supabase
      .from("messages").select("*").in("chat_id", chatIds).order("created_at", { ascending: false }).limit(200);
    const lastByChat: Record<string, MessageRow> = {};
    (latest ?? []).forEach((m) => { const row = m as MessageRow; if (!lastByChat[row.chat_id]) lastByChat[row.chat_id] = row; });

    const memsByChat: Record<string, string[]> = {};
    (allMembers ?? []).forEach((m: { chat_id: string; user_id: string }) => {
      (memsByChat[m.chat_id] ||= []).push(m.user_id);
    });

    const result: ChatWithMeta[] = (chatRows ?? []).map((c) => {
      const chat = c as ChatRow;
      const ids = memsByChat[chat.id] ?? [];
      return {
        ...chat,
        memberIds: ids,
        members: ids.map((id) => profMap[id]).filter(Boolean),
        lastMessage: lastByChat[chat.id],
      };
    });
    setChats(result);
    if (!activeId && result.length > 0) setActiveId(result[0].id);
  }, [me, activeId]);

  useEffect(() => { loadChats(); }, [loadChats]);

  // Load messages + reactions for active chat
  useEffect(() => {
    if (!activeId) return;
    (async () => {
      const { data: msgs } = await supabase.from("messages").select("*").eq("chat_id", activeId).order("created_at");
      setMessages((msgs ?? []) as MessageRow[]);
      const ids = (msgs ?? []).map((m) => (m as MessageRow).id);
      if (ids.length) {
        const { data: rx } = await supabase.from("reactions").select("*").in("message_id", ids);
        setReactions((rx ?? []) as ReactionRow[]);
      } else setReactions([]);
    })();
  }, [activeId]);

  // Realtime
  useEffect(() => {
    if (!me) return;
    const channel = supabase
      .channel("sona-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (p) => {
        const m = p.new as MessageRow;
        if (m.chat_id === activeId) setMessages((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, m]);
        loadChats();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "reactions" }, (p) => {
        if (p.eventType === "INSERT") {
          const r = p.new as ReactionRow;
          setReactions((prev) => prev.some((x) => x.id === r.id) ? prev : [...prev, r]);
        } else if (p.eventType === "DELETE") {
          const r = p.old as ReactionRow;
          setReactions((prev) => prev.filter((x) => x.id !== r.id));
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_members" }, () => { loadChats(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [me, activeId, loadChats]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [activeId, messages.length]);

  const active = chats.find((c) => c.id === activeId);
  const filtered = useMemo(() => chats.filter((c) =>
    me ? chatTitle(c, me.id).toLowerCase().includes(query.toLowerCase()) : true
  ), [chats, query, me]);

  // Send
  const send = async () => {
    if (!me || !activeId || (!draft.trim() && !pendingImage)) return;
    let media_url: string | null = null;
    let kind: "text" | "image" = "text";

    if (pendingImage) {
      const path = `${activeId}/${me.id}/${crypto.randomUUID()}-${pendingImage.name}`;
      const { error: upErr } = await supabase.storage.from("chat-media").upload(path, pendingImage);
      if (upErr) { toast.error(upErr.message); return; }
      const { data: signed } = await supabase.storage.from("chat-media").createSignedUrl(path, 60 * 60 * 24 * 365);
      media_url = signed?.signedUrl ?? null;
      kind = "image";
    }
    const body = draft.trim() || null;

    const { error } = await supabase.from("messages").insert({
      chat_id: activeId, sender_id: me.id, kind, body, media_url,
    });
    if (error) { toast.error(error.message); return; }

    const prompt = draft.trim();
    setDraft(""); setPendingImage(null); setShowEmoji(false);

    // AI trigger: dedicated AI chat OR @sona mention
    if (active) {
      const isAI = isAIChat(active);
      const mentionsSona = /(^|\s)@sona\b/i.test(prompt);
      if ((isAI || mentionsSona) && prompt) {
        askAI({ data: { chatId: activeId, prompt } }).catch((e) => toast.error(e.message));
      }
    }
  };

  const onPickFile = (f?: File | null) => { if (f) setPendingImage(f); };

  // Reactions
  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!me) return;
    const existing = reactions.find((r) => r.message_id === messageId && r.user_id === me.id && r.emoji === emoji);
    if (existing) {
      await supabase.from("reactions").delete().eq("id", existing.id);
    } else {
      await supabase.from("reactions").insert({ message_id: messageId, user_id: me.id, emoji });
    }
    setReactingOn(null);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  if (!me) {
    return <div className="grid min-h-dvh place-items-center text-muted-foreground">Loading Sona…</div>;
  }

  return (
    <div className="h-dvh w-full bg-background text-foreground">
      <div className="mx-auto flex h-full max-w-[1400px] overflow-hidden md:p-4">
        <div className="flex h-full w-full overflow-hidden rounded-none bg-card shadow-xl md:rounded-3xl md:border">
          {/* Sidebar */}
          <aside className={`${showSidebarMobile ? "flex" : "hidden"} h-full w-full flex-col border-r bg-sidebar text-sidebar-foreground md:flex md:w-[340px] lg:w-[380px]`}>
            <div className="flex items-center justify-between gap-2 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br from-skyblue to-skyblue-deep text-primary-foreground shadow-md">
                  <span className="text-lg font-black">S</span>
                </div>
                <div className="leading-tight">
                  <div className="text-base font-bold">Sona</div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">talk gold</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={toggle} className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary" aria-label="Toggle theme">
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
                <button onClick={() => setShowNewChat(true)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary" aria-label="New chat">
                  <Plus className="h-4 w-4" />
                </button>
                <button onClick={signOut} className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary" aria-label="Sign out">
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="px-3 pb-2 flex items-center gap-2">
              <Avatar url={me.avatar_url} name={me.display_name} size={36} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{me.display_name}</div>
                <div className="truncate text-[11px] text-muted-foreground">{me.email}</div>
              </div>
            </div>

            <div className="px-3 pb-2">
              <div className="flex items-center gap-2 rounded-full bg-secondary px-3 py-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search chats" className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
              </div>
            </div>

            <div className="scrollbar-thin flex-1 overflow-y-auto">
              {filtered.map((c) => {
                const title = chatTitle(c, me.id);
                const last = c.lastMessage;
                const preview = last?.kind === "image" ? "📷 Photo" : last?.kind === "voice" ? "🎤 Voice note" : (last?.body ?? "");
                return (
                  <button key={c.id} onClick={() => { setActiveId(c.id); setShowSidebarMobile(false); }}
                    className={`flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-secondary ${c.id === activeId ? "bg-secondary" : ""}`}>
                    <div className="relative">
                      <Avatar url={chatAvatar(c, me.id)} name={title} size={48} />
                      {isAIChat(c) && (
                        <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br from-skyblue to-skyblue-deep text-primary-foreground shadow ring-2 ring-sidebar">
                          <Sparkles className="h-2.5 w-2.5" />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold">{title}</span>
                        <span className="text-[11px] text-muted-foreground">{last ? fmtTime(last.created_at) : ""}</span>
                      </div>
                      <div className="truncate text-sm text-muted-foreground">{preview}</div>
                    </div>
                  </button>
                );
              })}
              {filtered.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No chats yet. Tap + to start one.</div>}
            </div>
          </aside>

          {/* Chat panel */}
          <section className={`${showSidebarMobile ? "hidden" : "flex"} h-full min-w-0 flex-1 flex-col md:flex`}>
            {active ? (
              <>
                <header className="flex items-center gap-3 border-b bg-card px-3 py-2.5 md:px-4">
                  <button onClick={() => setShowSidebarMobile(true)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary md:hidden" aria-label="Back">
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <Avatar url={chatAvatar(active, me.id)} name={chatTitle(active, me.id)} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold flex items-center gap-1.5">
                      {chatTitle(active, me.id)}
                      {isAIChat(active) && <Sparkles className="h-3.5 w-3.5 text-skyblue-deep" />}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {isAIChat(active) ? "AI companion · always on" : `${active.members.length} members`}
                    </div>
                  </div>
                  <button className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary"><MoreVertical className="h-4 w-4" /></button>
                </header>

                <div ref={scrollRef} className="scrollbar-thin chat-pattern flex-1 overflow-y-auto px-3 py-4 md:px-8">
                  <div className="mx-auto flex max-w-3xl flex-col gap-2">
                    <div className="mx-auto rounded-full bg-card/80 px-3 py-1 text-[11px] text-muted-foreground backdrop-blur">
                      {isAIChat(active) ? "Chat with Sona AI ✨" : "End-to-end · type @sona to summon the AI"}
                    </div>
                    {messages.map((m) => (
                      <Bubble
                        key={m.id}
                        msg={m}
                        me={me}
                        sender={profiles[m.sender_id]}
                        reactions={reactions.filter((r) => r.message_id === m.id)}
                        onReact={(emoji) => toggleReaction(m.id, emoji)}
                        opening={reactingOn === m.id}
                        onOpenPicker={() => setReactingOn(reactingOn === m.id ? null : m.id)}
                      />
                    ))}
                  </div>
                </div>

                {pendingImage && (
                  <div className="border-t bg-card px-3 py-2 md:px-6">
                    <div className="mx-auto flex max-w-3xl items-center gap-3">
                      <img src={URL.createObjectURL(pendingImage)} alt="" className="h-14 w-14 rounded-lg object-cover" />
                      <span className="flex-1 text-sm text-muted-foreground truncate">{pendingImage.name}</span>
                      <button onClick={() => setPendingImage(null)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-secondary"><X className="h-4 w-4" /></button>
                    </div>
                  </div>
                )}

                <Composer
                  draft={draft} setDraft={setDraft}
                  showEmoji={showEmoji} setShowEmoji={setShowEmoji}
                  onPickFile={onPickFile} fileRef={fileRef}
                  onSend={send}
                  onVoiceUploaded={async (blob, durationMs) => {
                    if (!me || !activeId) return;
                    const path = `${activeId}/${me.id}/${crypto.randomUUID()}.webm`;
                    const { error: upErr } = await supabase.storage.from("chat-media").upload(path, blob, { contentType: blob.type });
                    if (upErr) { toast.error(upErr.message); return; }
                    const { data: signed } = await supabase.storage.from("chat-media").createSignedUrl(path, 60 * 60 * 24 * 365);
                    await supabase.from("messages").insert({
                      chat_id: activeId, sender_id: me.id, kind: "voice",
                      media_url: signed?.signedUrl ?? null, duration_ms: durationMs,
                    });
                  }}
                />
              </>
            ) : (
              <div className="grid flex-1 place-items-center p-6 text-center text-muted-foreground">
                Pick a chat or tap + to start a new one.
              </div>
            )}
          </section>
        </div>
      </div>

      {showNewChat && me && (
        <NewChatModal
          meId={me.id}
          onClose={() => setShowNewChat(false)}
          onCreated={(id) => { setActiveId(id); setShowSidebarMobile(false); setShowNewChat(false); loadChats(); }}
        />
      )}
    </div>
  );
}

function Bubble({
  msg, me, sender, reactions, onReact, opening, onOpenPicker,
}: {
  msg: MessageRow; me: Profile; sender?: Profile; reactions: ReactionRow[];
  onReact: (emoji: string) => void; opening: boolean; onOpenPicker: () => void;
}) {
  const mine = msg.sender_id === me.id;
  const isAI = msg.sender_id === SONA_AI_ID;
  const counts: Record<string, number> = {};
  reactions.forEach((r) => { counts[r.emoji] = (counts[r.emoji] ?? 0) + 1; });

  return (
    <div className={`group flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
      {!mine && <Avatar url={sender?.avatar_url} name={sender?.display_name ?? "?"} size={28} />}
      <div className="relative max-w-[78%]">
        <div className={`relative rounded-2xl px-3 py-2 text-sm shadow-bubble ${
          mine ? "rounded-br-md bg-bubble-me text-bubble-me-foreground"
               : isAI ? "rounded-bl-md bg-gradient-to-br from-skyblue/70 to-skyblue-deep/50 text-charcoal"
               : "rounded-bl-md bg-bubble-them text-bubble-them-foreground"
        }`}>
          {!mine && (
            <div className="mb-0.5 text-[11px] font-semibold opacity-70 flex items-center gap-1">
              {sender?.display_name ?? "…"}
              {isAI && <Sparkles className="h-3 w-3" />}
            </div>
          )}
          {msg.kind === "image" && msg.media_url && (
            <img src={msg.media_url} alt="" className="mb-1 max-h-72 w-full rounded-xl object-cover" />
          )}
          {msg.kind === "voice" && msg.media_url && (
            <VoicePlayer url={msg.media_url} durationMs={msg.duration_ms ?? 0} mine={mine} />
          )}
          {msg.body && <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.body}</p>}
          <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] opacity-70">
            <span>{fmtTime(msg.created_at)}</span>
          </div>
          <button
            onClick={onOpenPicker}
            className={`absolute ${mine ? "-left-8" : "-right-8"} top-1/2 -translate-y-1/2 grid h-7 w-7 place-items-center rounded-full bg-card border shadow opacity-0 transition group-hover:opacity-100`}
            aria-label="React"
          >
            <SmilePlus className="h-3.5 w-3.5" />
          </button>
          {opening && (
            <div className={`absolute -top-10 ${mine ? "right-0" : "left-0"} z-10 flex gap-1 rounded-full border bg-popover px-2 py-1 shadow-lg`}>
              {REACT_EMOJIS.map((e) => (
                <button key={e} onClick={() => onReact(e)} className="text-lg hover:scale-125 transition">{e}</button>
              ))}
            </div>
          )}
        </div>
        {Object.keys(counts).length > 0 && (
          <div className={`mt-1 flex flex-wrap gap-1 ${mine ? "justify-end" : "justify-start"}`}>
            {Object.entries(counts).map(([e, n]) => {
              const mineReacted = reactions.some((r) => r.emoji === e && r.user_id === me.id);
              return (
                <button key={e} onClick={() => onReact(e)}
                  className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs bg-card ${mineReacted ? "ring-1 ring-skyblue-deep" : ""}`}>
                  <span>{e}</span><span className="text-[10px] text-muted-foreground">{n}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function VoicePlayer({ url, durationMs, mine }: { url: string; durationMs: number; mine: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const a = new Audio(url);
    audioRef.current = a;
    a.addEventListener("timeupdate", () => setProgress(a.duration ? a.currentTime / a.duration : 0));
    a.addEventListener("ended", () => { setPlaying(false); setProgress(0); });
    return () => { a.pause(); audioRef.current = null; };
  }, [url]);
  const toggle = () => {
    const a = audioRef.current; if (!a) return;
    if (playing) { a.pause(); setPlaying(false); } else { a.play(); setPlaying(true); }
  };
  const secs = Math.round(durationMs / 1000);
  return (
    <div className="flex items-center gap-2 min-w-[180px] py-1">
      <button onClick={toggle} className={`grid h-8 w-8 place-items-center rounded-full ${mine ? "bg-card/40" : "bg-skyblue/40"}`}>
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <div className="flex-1 h-1.5 rounded-full bg-card/40 overflow-hidden">
        <div className="h-full bg-current opacity-80" style={{ width: `${progress * 100}%` }} />
      </div>
      <span className="text-[10px] opacity-70 tabular-nums">
        {String(Math.floor(secs / 60)).padStart(1, "0")}:{String(secs % 60).padStart(2, "0")}
      </span>
    </div>
  );
}

function Composer({
  draft, setDraft, showEmoji, setShowEmoji, onPickFile, fileRef, onSend, onVoiceUploaded,
}: {
  draft: string; setDraft: (v: string) => void;
  showEmoji: boolean; setShowEmoji: (v: boolean | ((s: boolean) => boolean)) => void;
  onPickFile: (f?: File | null) => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onSend: () => void;
  onVoiceUploaded: (blob: Blob, durationMs: number) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm"
        : "audio/mp4";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const dur = Date.now() - startedRef.current;
        const blob = new Blob(chunksRef.current, { type: mime });
        stream.getTracks().forEach((t) => t.stop());
        if (blob.size > 1000) onVoiceUploaded(blob, dur);
      };
      startedRef.current = Date.now();
      rec.start();
      mediaRef.current = rec;
      setRecording(true); setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } catch { toast.error("Microphone permission denied"); }
  };
  const stopRec = (cancel = false) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const rec = mediaRef.current;
    if (!rec) return;
    if (cancel) chunksRef.current = [];
    rec.stop();
    mediaRef.current = null;
    setRecording(false); setElapsed(0);
  };

  return (
    <div className="relative border-t bg-card px-2 py-2 md:px-6 md:py-3">
      {showEmoji && (
        <div className="absolute bottom-full left-2 mb-2 grid max-w-xs grid-cols-8 gap-1 rounded-2xl border bg-popover p-2 shadow-xl md:left-6">
          {EMOJIS.map((e) => (
            <button key={e} onClick={() => setDraft(draft + e)} className="grid h-8 w-8 place-items-center rounded-lg text-lg hover:bg-secondary">{e}</button>
          ))}
        </div>
      )}
      {recording ? (
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <button onClick={() => stopRec(true)} className="grid h-11 w-11 place-items-center rounded-full bg-secondary text-destructive"><Trash2 className="h-5 w-5" /></button>
          <div className="flex flex-1 items-center gap-2 rounded-3xl bg-secondary px-4 py-3">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-destructive" />
            <span className="text-sm">Recording… {String(Math.floor(elapsed / 60)).padStart(1, "0")}:{String(elapsed % 60).padStart(2, "0")}</span>
          </div>
          <button onClick={() => stopRec(false)} className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-skyblue to-skyblue-deep text-primary-foreground shadow-md"><Send className="h-5 w-5" /></button>
        </div>
      ) : (
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <button onClick={() => setShowEmoji((s) => !s)} className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground hover:bg-secondary"><Smile className="h-5 w-5" /></button>
          <button onClick={() => fileRef.current?.click()} className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground hover:bg-secondary"><Paperclip className="h-5 w-5" /></button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPickFile(e.target.files?.[0])} />
          <div className="flex flex-1 items-center gap-2 rounded-3xl bg-secondary px-4 py-2">
            <textarea
              value={draft} onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
              rows={1} placeholder="Type a message · @sona for AI"
              className="max-h-32 min-h-6 flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <button onClick={() => fileRef.current?.click()} className="text-muted-foreground hover:text-foreground" aria-label="Image"><ImageIcon className="h-4 w-4" /></button>
          </div>
          {draft.trim() ? (
            <button onClick={onSend} className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-skyblue to-skyblue-deep text-primary-foreground shadow-md"><Send className="h-5 w-5" /></button>
          ) : (
            <button onClick={startRec} className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-skyblue to-skyblue-deep text-primary-foreground shadow-md"><Mic className="h-5 w-5" /></button>
          )}
        </div>
      )}
    </div>
  );
}

function NewChatModal({ meId, onClose, onCreated }: { meId: string; onClose: () => void; onCreated: (id: string) => void }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    const target = email.trim().toLowerCase();
    if (!target) return;
    setBusy(true);
    try {
      const { data: prof, error: pErr } = await supabase.from("profiles").select("*").eq("email", target).maybeSingle();
      if (pErr) throw pErr;
      if (!prof) { toast.error("No Sona user with that email yet."); return; }
      if (prof.id === meId) { toast.error("That's you 🙂"); return; }

      // Try to reuse an existing 1:1 chat with this person
      const { data: myChats } = await supabase.from("chat_members").select("chat_id").eq("user_id", meId);
      const ids = (myChats ?? []).map((r: { chat_id: string }) => r.chat_id);
      if (ids.length) {
        const { data: theirs } = await supabase.from("chat_members").select("chat_id").in("chat_id", ids).eq("user_id", prof.id);
        const shared = (theirs ?? []).map((r: { chat_id: string }) => r.chat_id);
        for (const cid of shared) {
          const { count } = await supabase.from("chat_members").select("*", { count: "exact", head: true }).eq("chat_id", cid);
          if (count === 2) { onCreated(cid); return; }
        }
      }

      const { data: chat, error: cErr } = await supabase.from("chats").insert({ is_group: false, created_by: meId }).select().single();
      if (cErr) throw cErr;
      const { error: mErr } = await supabase.from("chat_members").insert([
        { chat_id: chat.id, user_id: meId },
        { chat_id: chat.id, user_id: prof.id },
      ]);
      if (mErr) throw mErr;
      onCreated(chat.id);
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold">Start a new chat</h3>
        <p className="mt-1 text-xs text-muted-foreground">Enter a Sona user's email to connect.</p>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="friend@example.com"
          className="mt-4 w-full rounded-xl bg-secondary px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl px-3 py-2 text-sm hover:bg-secondary">Cancel</button>
          <button disabled={busy} onClick={create} className="rounded-xl bg-gradient-to-br from-skyblue to-skyblue-deep px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {busy ? "…" : "Start"}
          </button>
        </div>
      </div>
    </div>
  );
}
