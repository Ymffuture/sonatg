// src/components/AskSonaPanel.tsx
//
// The "Ask Sona" panel — a compact, native-feeling bottom sheet that opens
// when a user picks "Ask Sona" on a message. It shows exactly which message
// is being analyzed, offers a row of intelligent actions (Explain / Suggest
// a reply / Rewrite / Translate / Summarize / Extract info / a free-form
// question), and renders the result inline. Nothing here is written back
// into the chat — the result lives only in this panel until the user
// explicitly chooses to use it (e.g. inserting a suggested reply into the
// composer).
//
// Follows the same bottom-sheet + framer-motion conventions as ForwardModal,
// and calls the askSonaAboutMessage server function the same way every other
// Sona AI surface calls its server fn (useServerFn + try/catch + toast).

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Sparkles,
  X,
  MessageSquareText,
  Reply as ReplyIcon,
  PenLine,
  Languages,
  ListTree,
  ScanSearch,
  Send,
  Loader2,
  Copy,
  Check,
  RotateCcw,
} from "lucide-react";
import { VscVerifiedFilled } from "react-icons/vsc";
import {
  askSonaAboutMessage,
  type MessageIntelAction,
  type RewriteTone,
} from "@/lib/messageIntelligence.functions";
import type { MessageRow } from "@/lib/db";
import { useBackToClose } from "@/hooks/useBackStack";

type ActionDef = {
  id: MessageIntelAction;
  label: string;
  icon: React.ReactNode;
  /** Whether this action benefits from a small window of surrounding context. */
  useContext?: boolean;
};

const ACTIONS: ActionDef[] = [
  {
    id: "explain",
    label: "Explain",
    icon: <MessageSquareText className="h-4 w-4" />,
    useContext: true,
  },
  {
    id: "suggest_reply",
    label: "Suggest a reply",
    icon: <ReplyIcon className="h-4 w-4" />,
    useContext: true,
  },
  { id: "rewrite", label: "Rewrite", icon: <PenLine className="h-4 w-4" /> },
  { id: "translate", label: "Translate", icon: <Languages className="h-4 w-4" /> },
  { id: "summarize", label: "Summarize", icon: <ListTree className="h-4 w-4" /> },
  { id: "extract", label: "Extract info", icon: <ScanSearch className="h-4 w-4" /> },
];

const REWRITE_TONES: { id: RewriteTone; label: string }[] = [
  { id: "professional", label: "Professional" },
  { id: "casual", label: "Casual" },
  { id: "clear", label: "Clearer" },
  { id: "concise", label: "Concise" },
];

const LANGUAGE_PRESETS = [
  "English",
  "Spanish",
  "French",
  "Portuguese",
  "Zulu",
  "Xhosa",
  "Afrikaans",
  "isiZulu",
];

function messagePreviewText(msg: MessageRow): string {
  if (msg.kind === "text") return msg.body || "";
  if (msg.kind === "voice") return msg.transcript || "[voice note — not yet transcribed]";
  return `[${msg.kind}]`;
}

/** Splits a "1. foo\n2. bar\n3. baz" style numbered list into clean options. */
function parseReplyOptions(raw: string): string[] {
  return raw
    .split("\n")
    .map((l) => l.replace(/^\s*[-*\d.)]+\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 5);
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
  /** Called when the user taps a suggested reply — typically wired to fill the composer. */
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

  const [tone, setTone] = useState<RewriteTone>("clear");
  const [language, setLanguage] = useState("English");
  const [question, setQuestion] = useState("");

  const isEligible = message.kind === "text" || (message.kind === "voice" && !!message.transcript);
  const preview = useMemo(() => messagePreviewText(message), [message]);

  async function run(
    action: MessageIntelAction,
    extra?: { tone?: RewriteTone; language?: string; question?: string },
  ) {
    setActiveAction(action);
    setLoading(true);
    setError(null);
    setResult(null);
    setReplyOptions(null);
    setCopied(false);
    try {
      const def = ACTIONS.find((a) => a.id === action);
      const res = (await askSona({
        data: {
          chatId,
          messageId: message.id,
          action,
          useContext: !!def?.useContext,
          ...extra,
        },
      })) as { result: string };

      if (action === "suggest_reply") {
        setReplyOptions(parseReplyOptions(res.result));
      } else {
        setResult(res.result);
      }
    } catch (e) {
      const msg = (e as Error).message || "Sona couldn't process that. Try again.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  function runAsk() {
    if (!question.trim()) return;
    run("ask", { question: question.trim() });
  }

  function copyResult() {
    if (!result) return;
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function reset() {
    setActiveAction(null);
    setResult(null);
    setReplyOptions(null);
    setError(null);
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex flex-col justify-end bg-black/60 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="relative flex max-h-[88vh] w-full flex-col rounded-t-3xl md:rounded-3xl border-t md:border border-white/20 dark:border-white/10 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-2xl shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.1)_inset] md:shadow-2xl md:mx-auto md:mb-8 md:max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-[var(--sona-accent,#E07A5F)]/10 blur-3xl pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-white/20 pointer-events-none" />

        {/* Header */}
        <div className="relative flex items-center justify-between px-5 py-4 border-b border-zinc-200/50 dark:border-zinc-800/50">
          <h3 className="flex items-center gap-2.5 text-base font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--sona-accent,#E07A5F)]/10 text-[var(--sona-accent,#E07A5F)]">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="inline-flex items-center gap-1">
              Ask Sona <VscVerifiedFilled className="h-3.5 w-3.5 text-blue-500" />
            </span>
          </h3>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {/* Selected message preview — always visible so the user knows exactly what Sona is looking at */}
          <div className="px-5 pt-4">
            <div className="rounded-2xl border border-[var(--sona-accent,#E07A5F)]/15 bg-[var(--sona-accent,#E07A5F)]/5 px-4 py-3">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--sona-accent,#E07A5F)]">
                Selected message
              </div>
              <p className="line-clamp-4 text-[13px] text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap break-words">
                {preview}
              </p>
            </div>
          </div>

          {!isEligible ? (
            <div className="px-5 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
              Sona can only analyze text messages, or voice notes that have been transcribed.
            </div>
          ) : (
            <>
              {/* Action grid */}
              <div className="grid grid-cols-3 gap-2 px-5 py-4">
                {ACTIONS.map((a) => (
                  <button
                    key={a.id}
                    onClick={() =>
                      a.id === "rewrite" || a.id === "translate" ? setActiveAction(a.id) : run(a.id)
                    }
                    className={`flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-[11.5px] font-semibold transition-all ${
                      activeAction === a.id
                        ? "border-[var(--sona-accent,#E07A5F)]/50 bg-[var(--sona-accent,#E07A5F)]/10 text-[var(--sona-accent,#E07A5F)]"
                        : "border-zinc-200/60 dark:border-zinc-800/60 text-zinc-600 dark:text-zinc-300 hover:border-[var(--sona-accent,#E07A5F)]/40 hover:bg-[var(--sona-accent,#E07A5F)]/5"
                    }`}
                  >
                    {a.icon}
                    {a.label}
                  </button>
                ))}
              </div>

              {/* Rewrite tone picker */}
              {activeAction === "rewrite" && !loading && !result && (
                <div className="flex flex-wrap gap-2 px-5 pb-3">
                  {REWRITE_TONES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setTone(t.id);
                        run("rewrite", { tone: t.id });
                      }}
                      className="rounded-full border border-[var(--sona-accent,#E07A5F)]/30 px-3.5 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-[var(--sona-accent,#E07A5F)]/10 hover:border-[var(--sona-accent,#E07A5F)]/60 transition-colors"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Translate language picker */}
              {activeAction === "translate" && !loading && !result && (
                <div className="px-5 pb-3">
                  <div className="mb-2 flex flex-wrap gap-2">
                    {LANGUAGE_PRESETS.map((l) => (
                      <button
                        key={l}
                        onClick={() => {
                          setLanguage(l);
                          run("translate", { language: l });
                        }}
                        className="rounded-full border border-[var(--sona-accent,#E07A5F)]/30 px-3.5 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-[var(--sona-accent,#E07A5F)]/10 hover:border-[var(--sona-accent,#E07A5F)]/60 transition-colors"
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      placeholder="Or type any language…"
                      className="flex-1 rounded-full border border-zinc-200 dark:border-zinc-800 bg-transparent px-4 py-2 text-sm outline-none focus:border-[var(--sona-accent,#E07A5F)]"
                    />
                    <button
                      onClick={() => run("translate", { language })}
                      disabled={!language.trim()}
                      className="rounded-full bg-[var(--sona-accent,#E07A5F)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                    >
                      Go
                    </button>
                  </div>
                </div>
              )}

              {/* Loading */}
              {loading && (
                <div className="flex flex-col items-center gap-2 px-5 py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-[var(--sona-accent,#E07A5F)]" />
                  <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    Sona is thinking…
                  </span>
                </div>
              )}

              {/* Error */}
              {error && !loading && (
                <div className="mx-5 mb-4 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-500">
                  {error}
                </div>
              )}

              {/* Reply suggestions */}
              {replyOptions && !loading && (
                <div className="flex flex-col gap-2 px-5 pb-2">
                  {replyOptions.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        onUseReply(opt);
                        onClose();
                      }}
                      className="flex items-center justify-between gap-2 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 px-4 py-3 text-left text-sm text-zinc-700 dark:text-zinc-200 hover:border-[var(--sona-accent,#E07A5F)]/50 hover:bg-[var(--sona-accent,#E07A5F)]/5 transition-colors"
                    >
                      <span>{opt}</span>
                      <Send className="h-3.5 w-3.5 shrink-0 opacity-50" />
                    </button>
                  ))}
                </div>
              )}

              {/* Free-text result */}
              {result && !loading && (
                <div className="px-5 pb-2">
                  <div className="relative rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 bg-zinc-50/60 dark:bg-zinc-900/60 px-4 py-3 text-sm text-zinc-700 dark:text-zinc-200 whitespace-pre-wrap">
                    {result}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={copyResult}
                      className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                    {(activeAction === "rewrite" || activeAction === "translate") && (
                      <button
                        onClick={() => {
                          onUseReply(result);
                          onClose();
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[var(--sona-accent,#E07A5F)] px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        <Send className="h-3 w-3" /> Use in composer
                      </button>
                    )}
                    <button
                      onClick={reset}
                      className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <RotateCcw className="h-3 w-3" /> Try another
                    </button>
                  </div>
                </div>
              )}

              {/* Custom "Ask Sona" question box — always available at the bottom */}
              <div className="mt-1 border-t border-zinc-200/50 dark:border-zinc-800/50 px-5 py-4">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
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
                    className="flex-1 rounded-full border border-zinc-200 dark:border-zinc-800 bg-transparent px-4 py-2 text-sm outline-none focus:border-[var(--sona-accent,#E07A5F)]"
                  />
                  <button
                    onClick={runAsk}
                    disabled={!question.trim() || loading}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--sona-accent,#E07A5F)] text-white disabled:opacity-40"
                    aria-label="Ask"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
