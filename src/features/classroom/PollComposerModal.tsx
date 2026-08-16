// src/features/classroom/PollComposerModal.tsx
// Poll/quiz creation AND editing modal. Opened from the chat composer's
// attach menu to create a new poll, or from PollCard's creator menu to
// edit an existing one (pass `editing`). Self-contained — doesn't depend
// on the app's other modal primitives, just plain Tailwind.

import { useState } from "react";
import { X, Plus, Trash2, HelpCircle, EyeOff } from "lucide-react";
import { createPoll, updatePoll, replacePollOptions } from "./polls";
import type { PollWithOptions } from "./types";

interface PollComposerModalProps {
  chatId: string;
  onClose: () => void;
  /** Called with the poll's id after a successful create, so the caller can send a "poll" message. */
  onCreated: (pollId: string) => void;
  /** Pass the existing poll to edit it in place instead of creating a new one. */
  editing?: PollWithOptions | null;
  /** Called after a successful edit so the caller can refresh the card. */
  onUpdated?: () => void;
}

export function PollComposerModal({ chatId, onClose, onCreated, editing, onUpdated }: PollComposerModalProps) {
  const isEditing = Boolean(editing);
  const hasVotes = Boolean(editing && Object.values(editing.voteCounts).some((c) => c > 0));

  const [question, setQuestion] = useState(editing?.question ?? "");
  const [options, setOptions] = useState<string[]>(editing ? editing.options.map((o) => o.label) : ["", ""]);
  const [isQuiz, setIsQuiz] = useState(editing?.is_quiz ?? false);
  const [correctIndex, setCorrectIndex] = useState<number | null>(editing?.correct_option_index ?? null);
  const [hideResults, setHideResults] = useState(editing ? !editing.results_visible : false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateOption = (i: number, v: string) => setOptions((prev) => prev.map((o, idx) => (idx === i ? v : o)));
  const addOption = () => options.length < 8 && setOptions((prev) => [...prev, ""]);
  const removeOption = (i: number) => setOptions((prev) => prev.filter((_, idx) => idx !== i));

  const submit = async () => {
    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim()) { setError("Add a question first."); return; }
    if (cleanOptions.length < 2) { setError("Add at least 2 options."); return; }
    if (isQuiz && correctIndex == null) { setError("Pick the correct answer for a quiz."); return; }

    setBusy(true);
    setError(null);
    try {
      if (isEditing && editing) {
        await updatePoll(editing.id, {
          question: question.trim(),
          correctOptionIndex: isQuiz ? correctIndex : null,
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl bg-white dark:bg-[#1E1E1E] p-5 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-semibold text-[#2D3436] dark:text-[#E8E8E8]">
            <HelpCircle className="h-4 w-4 text-[#E07A5F]" /> {isEditing ? "Edit poll" : "New poll"}
          </p>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-[#E07A5F]/10" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question…"
          className="mt-4 w-full rounded-xl bg-[#F0EBE3] dark:bg-[#2A2A2A] px-3 py-2.5 text-sm outline-none text-[#2D3436] dark:text-[#E8E8E8]"
        />

        {hasVotes && (
          <p className="mt-2 text-[11px] text-[#8C8C8C]">
            People have already voted, so options are locked — you can still edit the question and correct answer.
          </p>
        )}

        <div className="mt-3 space-y-2">
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              {isQuiz && (
                <input
                  type="radio"
                  name="correct"
                  checked={correctIndex === i}
                  onChange={() => setCorrectIndex(i)}
                  className="h-4 w-4 accent-[#E07A5F]"
                  aria-label={`Mark option ${i + 1} correct`}
                />
              )}
              <input
                value={opt}
                onChange={(e) => updateOption(i, e.target.value)}
                placeholder={`Option ${i + 1}`}
                disabled={hasVotes}
                className="flex-1 rounded-xl bg-[#F0EBE3] dark:bg-[#2A2A2A] px-3 py-2 text-sm outline-none text-[#2D3436] dark:text-[#E8E8E8] disabled:opacity-60"
              />
              {options.length > 2 && !hasVotes && (
                <button onClick={() => removeOption(i)} aria-label="Remove option" className="grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-red-500/10 text-red-500">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          {options.length < 8 && !hasVotes && (
            <button onClick={addOption} className="flex items-center gap-1 text-xs font-semibold dark:text-white text-[#2D3436]">
              <Plus className="h-3.5 w-3.5" /> Add option
            </button>
          )}
        </div>

        <label className="mt-4 flex items-center gap-2 text-xs font-medium text-[#2D3436] dark:text-[#E8E8E8]">
          <input type="checkbox" checked={isQuiz} onChange={(e) => { setIsQuiz(e.target.checked); setCorrectIndex(null); }} className="h-4 w-4 accent-[#E07A5F]" />
          Quiz mode (mark the correct answer)
        </label>

        {!isEditing && (
          <label className="mt-2 flex items-center gap-2 text-xs font-medium text-[#2D3436] dark:text-[#E8E8E8]">
            <input type="checkbox" checked={hideResults} onChange={(e) => setHideResults(e.target.checked)} className="h-4 w-4 accent-[#E07A5F]" />
            <EyeOff className="h-3.5 w-3.5 text-[#8C8C8C]" /> Hide results until I reveal them
          </label>
        )}

        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

        <button
          onClick={submit}
          disabled={busy}
          className="mt-5 w-full rounded-full bg-[#1E1E1E] dark:bg-zinc-800 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? (isEditing ? "Saving…" : "Creating…") : (isEditing ? "Save changes" : "Post poll")}
        </button>
      </div>
    </div>
  );
}
