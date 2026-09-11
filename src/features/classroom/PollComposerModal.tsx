// src/features/classroom/PollComposerModal.tsx
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, Plus, Trash2, HelpCircle, EyeOff, Circle, CheckSquare, AlertCircle 
} from "lucide-react";
import { createPoll, updatePoll, replacePollOptions } from "./polls";
import type { PollWithOptions } from "./types";

interface PollComposerModalProps {
  chatId: string;
  onClose: () => void;
  onCreated: (pollId: string) => void;
  editing?: PollWithOptions | null;
  onUpdated?: () => void;
}

// Animation variants for smooth, premium feel
const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } }
};

const modalVariants = {
  hidden: { opacity: 0, y: "100%", scale: 0.98 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { type: "spring", stiffness: 400, damping: 35, mass: 0.8 }
  },
  exit: { 
    opacity: 0, 
    y: "100%", 
    scale: 0.98,
    transition: { duration: 0.2, ease: "easeInOut" }
  }
};

export function PollComposerModal({ 
  chatId, onClose, onCreated, editing, onUpdated 
}: PollComposerModalProps) {
  const isEditing = Boolean(editing);
  const hasVotes = Boolean(editing && Object.values(editing.voteCounts).some((c) => c > 0));

  const [question, setQuestion] = useState(editing?.question ?? "");
  const [options, setOptions] = useState<string[]>(editing ? editing.options.map((o) => o.label) : ["", ""]);
  const [isQuiz, setIsQuiz] = useState(editing?.is_quiz ?? false);
  const [allowMultiple, setAllowMultiple] = useState(editing?.allow_multiple ?? false);
  const [correctIndex, setCorrectIndex] = useState<number | null>(editing?.correct_option_index ?? null);
  const [hideResults, setHideResults] = useState(editing ? !editing.results_visible : false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateOption = (i: number, v: string) => setOptions((prev) => prev.map((o, idx) => (idx === i ? v : o)));
  const addOption = () => options.length < 8 && setOptions((prev) => [...prev, ""]);
  const removeOption = (i: number) => setOptions((prev) => prev.filter((_, idx) => idx !== i));

  const toggleQuiz = (checked: boolean) => {
    setIsQuiz(checked);
    setCorrectIndex(null);
    if (checked) setAllowMultiple(false); // Quizzes require exactly one correct answer
  };

  const submit = async () => {
    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim()) { setError("Please add a question."); return; }
    if (cleanOptions.length < 2) { setError("Please add at least 2 options."); return; }
    if (isQuiz && correctIndex == null) { setError("Please mark the correct answer for the quiz."); return; }

    setBusy(true);
    setError(null);
    try {
      if (isEditing && editing) {
        await updatePoll(editing.id, {
          question: question.trim(),
          correctOptionIndex: isQuiz ? correctIndex : null,
          allowMultiple,
        });
        if (!hasVotes) {
          await replacePollOptions(editing.id, cleanOptions);
        }
        onUpdated?.();
        onClose();
      } else {
        const poll = await createPoll({
          chatId,
          question: question.trim(),
          options: cleanOptions,
          isQuiz,
          correctOptionIndex: isQuiz ? correctIndex : null,
          allowMultiple,
          resultsVisible: !hideResults,
        });
        onCreated(poll.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : `Couldn't ${isEditing ? "update" : "create"} the poll.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-md"
        variants={backdropVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={onClose}
      >
        <motion.div
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={(e) => e.stopPropagation()}
          className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-white dark:bg-zinc-900 p-6 max-h-[85vh] overflow-y-auto ring-1 ring-black/5 dark:ring-white/10 shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-[#E07A5F]/10 text-[#E07A5F]">
                <HelpCircle className="h-4 w-4" />
              </div>
              <p className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                {isEditing ? "Edit poll" : "Create new poll"}
              </p>
            </div>
            <motion.button 
              onClick={onClose} 
              whileHover={{ scale: 1.05, backgroundColor: "rgba(0,0,0,0.05)" }}
              whileTap={{ scale: 0.95 }}
              className="grid h-8 w-8 place-items-center rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 dark:hover:bg-white/10 transition-colors" 
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </motion.button>
          </div>

          {/* Question Input */}
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question…"
            className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-[#E07A5F]/20 focus:border-[#E07A5F]/50 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
          />

          {hasVotes && (
            <p className="mt-2.5 flex items-start gap-2 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              People have already voted. Options are locked, but you can still edit the question and correct answer.
            </p>
          )}

          {/* Options List */}
          <div className="mt-4 space-y-2.5">
            {options.map((opt, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2.5"
              >
                {isQuiz && (
                  <input
                    type="radio"
                    name="correct"
                    checked={correctIndex === i}
                    onChange={() => setCorrectIndex(i)}
                    className="h-4 w-4 shrink-0 accent-[#E07A5F] cursor-pointer"
                    aria-label={`Mark option ${i + 1} correct`}
                  />
                )}
                <input
                  value={opt}
                  onChange={(e) => updateOption(i, e.target.value)}
                  placeholder={`Option ${i + 1}`}
                  disabled={hasVotes}
                  className="flex-1 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 px-3.5 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-[#E07A5F]/20 focus:border-[#E07A5F]/50 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {options.length > 2 && !hasVotes && (
                  <motion.button 
                    onClick={() => removeOption(i)} 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    aria-label="Remove option" 
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-zinc-400 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </motion.button>
                )}
              </motion.div>
            ))}
            
            {options.length < 8 && !hasVotes && (
              <motion.button 
                onClick={addOption} 
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 py-2.5 text-xs font-semibold text-zinc-500 hover:border-[#E07A5F]/50 hover:text-[#E07A5F] dark:text-zinc-400 dark:hover:text-[#E07A5F] transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Add another option
              </motion.button>
            )}
          </div>

          {/* Choice Type Segmented Control */}
          <div className="mt-5">
            <div className="flex items-center gap-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 p-1">
              <button
                type="button"
                onClick={() => setAllowMultiple(false)}
                disabled={hasVotes}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all disabled:opacity-50 ${
                  !allowMultiple
                    ? "bg-white dark:bg-zinc-700 text-[#E07A5F] shadow-sm"
                    : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                }`}
              >
                <Circle className="h-3.5 w-3.5" /> Single choice
              </button>
              <button
                type="button"
                onClick={() => !isQuiz && setAllowMultiple(true)}
                disabled={hasVotes || isQuiz}
                title={isQuiz ? "Quizzes only allow one correct answer" : undefined}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all disabled:opacity-50 ${
                  allowMultiple
                    ? "bg-white dark:bg-zinc-700 text-[#E07A5F] shadow-sm"
                    : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                }`}
              >
                <CheckSquare className="h-3.5 w-3.5" /> Multiple choice
              </button>
            </div>
            {hasVotes && (
              <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                Choice type cannot be changed after votes are cast.
              </p>
            )}
          </div>

          {/* Toggles */}
          <div className="mt-5 space-y-3">
            <label className="flex cursor-pointer items-center gap-3 group">
              <div className="relative flex items-center">
                <input 
                  type="checkbox" 
                  checked={isQuiz} 
                  onChange={(e) => toggleQuiz(e.target.checked)} 
                  className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-zinc-300 dark:border-zinc-600 bg-transparent checked:border-[#E07A5F] checked:bg-[#E07A5F] transition-all" 
                />
                <CheckSquare className="pointer-events-none absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100" />
              </div>
              <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors">
                Quiz mode (mark the correct answer)
              </span>
            </label>

            {!isEditing && (
              <label className="flex cursor-pointer items-center gap-3 group">
                <div className="relative flex items-center">
                  <input 
                    type="checkbox" 
                    checked={hideResults} 
                    onChange={(e) => setHideResults(e.target.checked)} 
                    className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-zinc-300 dark:border-zinc-600 bg-transparent checked:border-[#E07A5F] checked:bg-[#E07A5F] transition-all" 
                  />
                  <CheckSquare className="pointer-events-none absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100" />
                </div>
                <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors">
                  <EyeOff className="h-3.5 w-3.5 text-zinc-400" /> 
                  Hide results until I reveal them
                </span>
              </label>
            )}
          </div>

          {/* Error Banner */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-4 flex items-start gap-2.5 rounded-xl bg-red-500/10 p-3 text-xs font-medium text-red-600 dark:text-red-400"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit Button */}
          <motion.button
            onClick={submit}
            disabled={busy}
            whileHover={{ scale: busy ? 1 : 1.01 }}
            whileTap={{ scale: busy ? 1 : 0.99 }}
            className="mt-6 w-full rounded-xl bg-zinc-900 dark:bg-zinc-100 py-3.5 text-sm font-semibold text-white dark:text-zinc-900 shadow-lg shadow-black/5 transition-all disabled:opacity-60 disabled:hover:scale-100"
          >
            {busy ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white dark:border-zinc-900/30 dark:border-t-zinc-900" />
                {isEditing ? "Saving changes…" : "Creating poll…"}
              </span>
            ) : (
              isEditing ? "Save changes" : "Post poll"
            )}
          </motion.button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
