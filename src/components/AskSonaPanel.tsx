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
  Copy,
  Check,
  RotateCcw,
  AlertCircle,
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
  useContext?: boolean;
};

const ACTIONS: ActionDef[] = [
  { id: "explain", label: "Explain", icon: <MessageSquareText className="h-4 w-4" />, useContext: true },
  { id: "suggest_reply", label: "Suggest reply", icon: <ReplyIcon className="h-4 w-4" />, useContext: true },
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
  "English", "Spanish", "French", "Portuguese", "Zulu", "Xhosa", "Afrikaans", "isiZulu",
];

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

// --- Premium Loading Animation Component ---
function SonaThinkingLoader() {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-10">
      <div className="relative flex h-16 w-16 items-center justify-center">
        {/* Outer orbital ring */}
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-[var(--sona-accent,#E07A5F)] border-r-[var(--sona-accent,#E07A5F)]/30"
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        />
        {/* Inner counter-rotating ring */}
        <motion.div
          className="absolute inset-2 rounded-full border-2 border-transparent border-b-[var(--sona-accent,#E07A5F)]/60 border-l-[var(--sona-accent,#E07A5F)]"
          animate={{ rotate: -360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
        />
        {/* Pulsing core */}
        <motion.div
          className="h-3 w-3 rounded-full bg-[var(--sona-accent,#E07A5F)] shadow-[0_0_20px_rgba(224,122,95,0.6)]"
          animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
      
      {/* Animated text dots */}
      <div className="flex items-center gap-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">
        <span>Sona is analyzing</span>
        {[0, 0.2, 0.4].map((delay, i) => (
          <motion.span
            key={i}
            animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{ duration: 1.2, repeat: Infinity, delay, ease: "easeInOut" }}
          >
            .
          </motion.span>
        ))}
      </div>
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
        className="relative flex max-h-[88vh] w-full flex-col rounded-t-[2rem] md:rounded-3xl border-t md:border border-white/30 dark:border-white/10 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-2xl shadow-[0_-20px_60px_-15px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.15)_inset] md:shadow-2xl md:mx-auto md:mb-8 md:max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient background glow */}
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-[var(--sona-accent,#E07A5F)]/10 blur-3xl pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-white/20 pointer-events-none" />

        {/* Drag Handle (Mobile) */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="h-1.5 w-12 rounded-full bg-zinc-300 dark:bg-zinc-700" />
        </div>

        {/* Header */}
        <div className="relative flex items-center justify-between px-6 py-4 border-b border-zinc-200/50 dark:border-zinc-800/50">
          <h3 className="flex items-center gap-2.5 text-base font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--sona-accent,#E07A5F)]/20 to-[var(--sona-accent,#E07A5F)]/5 text-[var(--sona-accent,#E07A5F)] ring-1 ring-[var(--sona-accent,#E07A5F)]/20">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="inline-flex items-center gap-1.5">
              Ask Sona 
              <VscVerifiedFilled className="h-4 w-4 text-blue-500" />
            </span>
          </h3>
          <motion.button
            whileHover={{ scale: 1.05, backgroundColor: "rgba(0,0,0,0.05)" }}
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full dark:hover:bg-zinc-800 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
          </motion.button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800">
          {/* Selected message preview */}
          <div className="px-6 pt-5 pb-2">
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
                    {a.label}
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
                          run("rewrite", { tone: t.id });
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
                            run("translate", { language: l });
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
                        onClick={() => run("translate", { language })}
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
              {loading && <SonaThinkingLoader />}

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

              {/* Reply suggestions */}
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
                    <div className="relative overflow-hidden rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 bg-zinc-50/80 dark:bg-zinc-900/80 px-4 py-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-200 whitespace-pre-wrap">
                      {/* Subtle top gradient accent */}
                      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--sona-accent,#E07A5F)]/40 to-transparent" />
                      {result}
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
      </motion.div>
    </div>
  );
}
