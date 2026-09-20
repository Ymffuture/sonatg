import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "@heroui/react";
import {
  Sparkles,
  ArrowLeft,
  MessageSquareText,
  Reply as ReplyIcon,
  PenLine,
  Languages,
  ListTree,
  ScanSearch,
  Smile,
  ShieldCheck,
  MessagesSquare,
  Send,
  Copy,
  Check,
  RotateCcw,
  AlertCircle,
  History,
  Volume2,
  VolumeX,
} from "lucide-react";
import { VscVerifiedFilled } from "react-icons/vsc";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  askSonaAboutMessage,
  type MessageIntelAction,
  type RewriteTone,
} from "@/lib/messageIntelligence.functions";
import type { MessageRow } from "@/lib/db";
import { useBackToClose } from "@/hooks/useBackStack";
import {Spinner} from "@heroui/react";

type ActionDef = {
  id: MessageIntelAction;
  label: string;
  icon: React.ReactNode;
  useContext?: boolean;
  /** Renders its result as tappable reply chips instead of a plain text block. */
  listStyle?: boolean;
};

const ACTIONS: ActionDef[] = [
  { id: "explain", label: "Explain", icon: <MessageSquareText className="h-4 w-4" />, useContext: true },
  { id: "suggest_reply", label: "Suggest reply", icon: <ReplyIcon className="h-4 w-4" />, useContext: true, listStyle: true },
  { id: "rewrite", label: "Rewrite", icon: <PenLine className="h-4 w-4" /> },
  { id: "translate", label: "Translate", icon: <Languages className="h-4 w-4" /> },
  { id: "summarize", label: "Summarize", icon: <ListTree className="h-4 w-4" /> },
  { id: "extract", label: "Extract info", icon: <ScanSearch className="h-4 w-4" /> },
  { id: "tone_check", label: "Tone check", icon: <Smile className="h-4 w-4" />, useContext: true },
  { id: "fact_check", label: "Fact check", icon: <ShieldCheck className="h-4 w-4" /> },
  { id: "follow_up", label: "Follow-ups", icon: <MessagesSquare className="h-4 w-4" />, useContext: true, listStyle: true },
];

const ACTIONS_BY_ID = new Map(ACTIONS.map((a) => [a.id, a]));

const REWRITE_TONES: { id: RewriteTone; label: string }[] = [
  { id: "professional", label: "Professional" },
  { id: "casual", label: "Casual" },
  { id: "clear", label: "Clearer" },
  { id: "concise", label: "Concise" },
];

const LANGUAGE_PRESETS = [
  "English", "Spanish", "French", "Portuguese", "Zulu", "Xhosa", "Afrikaans", "isiZulu",
];

const MAX_HISTORY = 8;

type HistoryEntry = {
  id: string;
  action: MessageIntelAction;
  /** Short chip label, e.g. "Rewrite · Casual" or "Translate · Spanish". */
  chipLabel: string;
  result: string | null;
  replyOptions: string[] | null;
};

function messagePreviewText(msg: MessageRow): string {
  if (msg.kind === "text") return msg.body || "";
  if (msg.kind === "voice") return msg.transcript || "[voice note — not yet transcribed]";
  return `[${msg.kind}]`;
}

function parseReplyOptions(raw: string): string[] {
  return raw
    .split("\n")
    .map((l) => l.replace(/^\s*[-*\d.)]+\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 5);
}

// --- Markdown styling for Sona's responses (headings, bold, tables, lists, quotes, code) ---
const MARKDOWN_COMPONENTS: Components = {
  h1: ({ children }) => (
    <h1 className="mb-3 mt-4 text-lg font-bold text-zinc-900 dark:text-zinc-50 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2.5 mt-4 text-base font-bold text-zinc-900 dark:text-zinc-50 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-3 text-sm font-bold text-zinc-900 dark:text-zinc-50 first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mb-1.5 mt-2 text-[13px] font-bold text-zinc-900 dark:text-zinc-50 first:mt-0">{children}</h4>
  ),
  h5: ({ children }) => (
    <h5 className="mb-1 mt-2 text-[13px] font-semibold text-zinc-900 dark:text-zinc-50 first:mt-0">{children}</h5>
  ),
  h6: ({ children }) => (
    <h6 className="mb-1 mt-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 first:mt-0">{children}</h6>
  ),
  strong: ({ children }) => (
    <strong className="font-bold text-zinc-900 dark:text-zinc-50">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-zinc-700 dark:text-zinc-200">{children}</em>
  ),
  del: ({ children }) => (
    <del className="opacity-50 line-through">{children}</del>
  ),
  p: ({ children }) => (
    <p className="mb-3 last:mb-0 text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mb-3 list-disc space-y-1.5 pl-5 last:mb-0 marker:text-[var(--sona-accent,#E07A5F)]">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 list-decimal space-y-1.5 pl-5 last:mb-0 marker:text-[var(--sona-accent,#E07A5F)]">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">{children}</li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mb-3 border-l-[3px] border-[var(--sona-accent,#E07A5F)]/50 bg-[var(--sona-accent,#E07A5F)]/5 px-3.5 py-2.5 last:mb-0 rounded-r-xl">
      {children}
    </blockquote>
  ),
  hr: () => (
    <hr className="my-4 border-zinc-200 dark:border-zinc-700" />
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-[var(--sona-accent,#E07A5F)] underline underline-offset-2 hover:opacity-80 transition-opacity"
    >
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="mb-3 last:mb-0 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-zinc-100 dark:bg-zinc-800/70">{children}</thead>
  ),
  tbody: ({ children }) => <tbody>{children}</tbody>,
  th: ({ children }) => (
    <th className="border-b border-zinc-200 dark:border-zinc-700 px-3 py-2.5 text-left font-bold text-zinc-900 dark:text-zinc-100">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-zinc-100 dark:border-zinc-800/60 px-3 py-2.5 align-top text-zinc-700 dark:text-zinc-300">
      {children}
    </td>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = /language-/.test(className || "");
    if (isBlock) {
      return (
        <code className={`${className} block font-mono text-xs`} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className="rounded-md bg-zinc-200/70 dark:bg-zinc-800 px-1.5 py-0.5 font-mono text-[0.85em] text-[var(--sona-accent,#E07A5F)]" {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="mb-3 last:mb-0 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800/70 p-3">{children}</pre>
  ),
  img: ({ src, alt }) => (
    <img src={src} alt={alt} className="my-3 max-w-full rounded-xl border border-zinc-200 dark:border-zinc-800" />
  ),
};

/** Renders Sona's free-text output as styled markdown (headings, bold, tables, lists, quotes, code). */
function MarkdownResult({ content }: { content: string }) {
  return (
    <div className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function AskSonaPanel({
  chatId,
  message,
  onClose,
  onUseReply,
}: {
  chatId: string;
  message: MessageRow;
  onClose: () => void;
  onUseReply: (text: string) => void;
}) {
  useBackToClose(onClose);
  const askSona = useServerFn(askSonaAboutMessage);

  const [activeAction, setActiveAction] = useState<MessageIntelAction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [replyOptions, setReplyOptions] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const [tone, setTone] = useState<RewriteTone>("clear");
  const [language, setLanguage] = useState("English");
  const [question, setQuestion] = useState("");

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);

  const isEligible = message.kind === "text" || (message.kind === "voice" && !!message.transcript);
  const preview = useMemo(() => messagePreviewText(message), [message]);

  // Stop any in-flight speech synthesis the moment the panel unmounts, so
  // audio never keeps playing after the user has moved on.
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  async function run(
    action: MessageIntelAction,
    extra?: { tone?: RewriteTone; language?: string; question?: string },
    chipLabelOverride?: string,
  ) {
    setActiveAction(action);
    setActiveHistoryId(null);
    setLoading(true);
    setError(null);
    setResult(null);
    setReplyOptions(null);
    setCopied(false);
    stopSpeaking();
    try {
      const def = ACTIONS_BY_ID.get(action);
      const res = (await askSona({
        data: {
          chatId,
          messageId: message.id,
          action,
          useContext: !!def?.useContext,
          ...extra,
        },
      })) as { result: string };

      const entry: HistoryEntry = {
        id: `${Date.now()}`,
        action,
        chipLabel: chipLabelOverride ?? def?.label ?? action,
        result: null,
        replyOptions: null,
      };

      if (def?.listStyle) {
        const opts = parseReplyOptions(res.result);
        setReplyOptions(opts);
        entry.replyOptions = opts;
      } else {
        setResult(res.result);
        entry.result = res.result;
      }
      setActiveHistoryId(entry.id);
      setHistory((prev) => [entry, ...prev].slice(0, MAX_HISTORY));
    } catch (e) {
      const msg = (e as Error).message || "Sona couldn't process that. Try again.";
      setError(msg);
      toast.danger(msg);
    } finally {
      setLoading(false);
    }
  }

  function openHistoryEntry(entry: HistoryEntry) {
    stopSpeaking();
    setActiveAction(entry.action);
    setActiveHistoryId(entry.id);
    setResult(entry.result);
    setReplyOptions(entry.replyOptions);
    setError(null);
  }

  function runAsk() {
    if (!question.trim()) return;
    run("ask", { question: question.trim() }, `Asked: "${question.trim().slice(0, 24)}${question.trim().length > 24 ? "…" : ""}"`);
  }

  function copyResult() {
    if (!result) return;
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function stopSpeaking() {
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    setSpeaking(false);
  }

  function toggleSpeak() {
    if (!result || typeof window === "undefined" || !window.speechSynthesis) return;
    if (speaking) {
      stopSpeaking();
      return;
    }
    const utter = new SpeechSynthesisUtterance(result);
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
    setSpeaking(true);
  }

  function reset() {
    setActiveAction(null);
    setActiveHistoryId(null);
    setResult(null);
    setReplyOptions(null);
    setError(null);
    stopSpeaking();
  }

  const canSpeak = typeof window !== "undefined" && !!window.speechSynthesis;

  return (
    <motion.div
      initial={{ y: "100%", opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: "100%", opacity: 0 }}
      transition={{ type: "spring", damping: 28, stiffness: 300 }}
      className="fixed inset-0 z-[110] flex flex-col overflow-hidden bg-white dark:bg-zinc-950"
    >
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-[var(--sona-accent,#E07A5F)]/10 blur-3xl" />

      {/* Header */}
      <div className="relative flex items-center gap-3 px-4 py-4 border-b border-zinc-200/50 dark:border-zinc-800/50 shrink-0">
        <motion.button
          whileHover={{ scale: 1.05, backgroundColor: "rgba(0,0,0,0.05)" }}
          whileTap={{ scale: 0.95 }}
          onClick={onClose}
          aria-label="Back"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full dark:hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-zinc-700 dark:text-zinc-300" />
        </motion.button>
        <h3 className="flex items-center gap-2.5 text-base font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--sona-accent,#E07A5F)]/20 to-[var(--sona-accent,#E07A5F)]/5 text-[var(--sona-accent,#E07A5F)] ring-1 ring-[var(--sona-accent,#E07A5F)]/20">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="inline-flex items-center gap-1.5">
            Ask Sona AI
            <VscVerifiedFilled className="h-4 w-4 text-blue-500" />
          </span>
        </h3>
      </div>

      <div className="relative flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800">
        <div className="mx-auto w-full max-w-2xl">
          {/* Selected message preview */}
          <div className="px-5 pt-5 pb-2">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="group relative rounded-2xl border border-[var(--sona-accent,#E07A5F)]/15 bg-[var(--sona-accent,#E07A5F)]/5 px-4 py-3.5 transition-colors hover:border-[var(--sona-accent,#E07A5F)]/30"
            >
              <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--sona-accent,#E07A5F)]">
                <MessageSquareText className="h-3 w-3" />
                Selected message
              </div>
              <p className="line-clamp-4 text-[13px] leading-relaxed text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap break-words">
                {preview}
              </p>
            </motion.div>
          </div>

          {!isEligible ? (
            <div className="flex flex-col items-center gap-3 px-6 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
              <AlertCircle className="h-8 w-8 opacity-50" />
              <p>Sona can only analyze text messages, or voice notes that have been transcribed.</p>
            </div>
          ) : (
            <>
              {/* Session history rail — every result computed this session, one tap away */}
              {history.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto px-5 pb-1 pt-1 scrollbar-thin">
                  <History className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                  {history.map((h) => (
                    <motion.button
                      key={h.id}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => openHistoryEntry(h)}
                      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                        activeHistoryId === h.id
                          ? "border-[var(--sona-accent,#E07A5F)]/60 bg-[var(--sona-accent,#E07A5F)]/10 text-[var(--sona-accent,#E07A5F)]"
                          : "border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                      }`}
                    >
                      {h.chipLabel}
                    </motion.button>
                  ))}
                </div>
              )}

              {/* Action grid */}
              <div className="grid grid-cols-3 gap-2.5 px-6 py-5">
                {ACTIONS.map((a) => (
                  <motion.button
                    key={a.id}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() =>
                      a.id === "rewrite" || a.id === "translate" ? setActiveAction(a.id) : run(a.id)
                    }
                    className={`flex flex-col items-center justify-center gap-2 rounded-2xl border px-2 py-3.5 text-[11.5px] font-semibold transition-all ${
                      activeAction === a.id
                        ? "border-[var(--sona-accent,#E07A5F)]/50 bg-[var(--sona-accent,#E07A5F)]/10 text-[var(--sona-accent,#E07A5F)] shadow-[0_4px_12px_-4px_rgba(224,122,95,0.3)]"
                        : "border-zinc-200/60 dark:border-zinc-800/60 text-zinc-600 dark:text-zinc-300 hover:border-[var(--sona-accent,#E07A5F)]/40 hover:bg-[var(--sona-accent,#E07A5F)]/5"
                    }`}
                  >
                    {a.icon}
                    <span className="text-center leading-tight">{a.label}</span>
                  </motion.button>
                ))}
              </div>

              {/* Rewrite tone picker */}
              <AnimatePresence>
                {activeAction === "rewrite" && !loading && !result && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex flex-wrap gap-2 px-6 pb-4"
                  >
                    {REWRITE_TONES.map((t) => (
                      <motion.button
                        key={t.id}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          setTone(t.id);
                          run("rewrite", { tone: t.id }, `Rewrite · ${t.label}`);
                        }}
                        className="rounded-full border border-[var(--sona-accent,#E07A5F)]/30 px-4 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-[var(--sona-accent,#E07A5F)]/10 hover:border-[var(--sona-accent,#E07A5F)]/60 transition-colors"
                      >
                        {t.label}
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Translate language picker */}
              <AnimatePresence>
                {activeAction === "translate" && !loading && !result && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="px-6 pb-4"
                  >
                    <div className="mb-3 flex flex-wrap gap-2">
                      {LANGUAGE_PRESETS.map((l) => (
                        <motion.button
                          key={l}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            setLanguage(l);
                            run("translate", { language: l }, `Translate · ${l}`);
                          }}
                          className="rounded-full border border-[var(--sona-accent,#E07A5F)]/30 px-3.5 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-[var(--sona-accent,#E07A5F)]/10 hover:border-[var(--sona-accent,#E07A5F)]/60 transition-colors"
                        >
                          {l}
                        </motion.button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        placeholder="Or type any language…"
                        className="flex-1 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 px-4 py-2.5 text-sm outline-none focus:border-[var(--sona-accent,#E07A5F)] focus:ring-2 focus:ring-[var(--sona-accent,#E07A5F)]/20 transition-all"
                      />
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => run("translate", { language }, `Translate · ${language}`)}
                        disabled={!language.trim()}
                        className="rounded-full bg-[var(--sona-accent,#E07A5F)] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[var(--sona-accent,#E07A5F)]/20 disabled:opacity-40 disabled:shadow-none transition-all"
                      >
                        Go
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Unique Loading Animation */}
              {loading && <Spinner size="xl" />}

              {/* Error */}
              <AnimatePresence>
                {error && !loading && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mx-6 mb-4 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-600 dark:text-red-400"
                  >
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Reply / follow-up suggestions */}
              <AnimatePresence>
                {replyOptions && !loading && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col gap-2.5 px-6 pb-4"
                  >
                    {replyOptions.map((opt, i) => (
                      <motion.button
                        key={i}
                        whileHover={{ scale: 1.01, borderColor: "rgba(224, 122, 95, 0.5)" }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          onUseReply(opt);
                          onClose();
                        }}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 bg-white/50 dark:bg-zinc-900/50 px-4 py-3.5 text-left text-sm text-zinc-700 dark:text-zinc-200 hover:bg-[var(--sona-accent,#E07A5F)]/5 transition-all"
                      >
                        <span className="leading-relaxed">{opt}</span>
                        <Send className="h-3.5 w-3.5 shrink-0 opacity-40 group-hover:opacity-100" />
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Free-text result */}
              <AnimatePresence>
                {result && !loading && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="px-6 pb-4"
                  >
                    <div className="relative overflow-hidden rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 bg-zinc-50/80 dark:bg-zinc-900/80 px-4 py-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
                      {/* Subtle top gradient accent */}
                      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--sona-accent,#E07A5F)]/40 to-transparent" />
                      <MarkdownResult content={result} />
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={copyResult}
                        className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3.5 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                      >
                        {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied ? "Copied" : "Copy"}
                      </motion.button>

                      {canSpeak && (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={toggleSpeak}
                          className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3.5 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                        >
                          {speaking ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                          {speaking ? "Stop" : "Read aloud"}
                        </motion.button>
                      )}

                      {(activeAction === "rewrite" || activeAction === "translate") && (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            onUseReply(result);
                            onClose();
                          }}
                          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--sona-accent,#E07A5F)] px-4 py-2 text-xs font-semibold text-white shadow-md shadow-[var(--sona-accent,#E07A5F)]/20 transition-all"
                        >
                          <Send className="h-3.5 w-3.5" /> Use in composer
                        </motion.button>
                      )}

                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={reset}
                        className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Try another
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Custom "Ask Sona" question box */}
              <div className="mt-auto border-t border-zinc-200/50 dark:border-zinc-800/50 bg-zinc-50/30 dark:bg-zinc-900/30 px-6 py-5">
                <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  <Sparkles className="h-3 w-3" />
                  Or ask a custom question
                </div>
                <div className="flex gap-2">
                  <input
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") runAsk();
                    }}
                    placeholder="e.g. Who is this person talking about?"
                    className="flex-1 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-[var(--sona-accent,#E07A5F)] focus:ring-2 focus:ring-[var(--sona-accent,#E07A5F)]/20 transition-all placeholder:text-zinc-400"
                  />
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={runAsk}
                    disabled={!question.trim() || loading}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--sona-accent,#E07A5F)] text-white shadow-lg shadow-[var(--sona-accent,#E07A5F)]/20 disabled:opacity-40 disabled:shadow-none transition-all"
                    aria-label="Ask"
                  >
                    <Send className="h-4 w-4" />
                  </motion.button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
