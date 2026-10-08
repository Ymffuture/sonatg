// src/features/ads/AdComposerModal.tsx
import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Megaphone, ImagePlus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { compressImageForUpload } from "@/utils/utils";

export type CreatedAd = {
  mediaUrl: string;
  title: string;
  ctaLabel: string;
  ctaUrl: string;
  /** "list" = between chats for everyone; "chat" = only inside the open chat. */
  placement: "list" | "chat";
};

interface AdComposerModalProps {
  meId: string;
  onClose: () => void;
  onCreated: (ad: CreatedAd) => Promise<void>;
  /** True when a chat is open, so "This chat only" is a valid choice. */
  canPostInChat?: boolean;
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function AdComposerModal({ meId, onClose, onCreated, canPostInChat = false }: AdComposerModalProps) {
  const [placement, setPlacement] = useState<"list" | "chat">("list");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [ctaLabel, setCtaLabel] = useState("Learn more");
  const [ctaUrl, setCtaUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const canSubmit = !!imageFile && title.trim().length > 0 && ctaLabel.trim().length > 0 && ctaUrl.trim().length > 0;

  const handlePickImage = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const describeError = (e: unknown, context: Record<string, unknown> = {}): string => {
    const err = e as { message?: string; code?: string; details?: string; hint?: string } | null;
    const payload = {
      message: err?.message || String(e) || "Unknown error",
      ...(err?.code ? { code: err.code } : {}),
      ...(err?.details ? { details: err.details } : {}),
      ...(err?.hint ? { hint: err.hint } : {}),
      ...context,
    };
    console.error("[AdComposerModal]", payload);
    return JSON.stringify(payload, null, 2);
  };

  const submit = async () => {
    if (!canSubmit || !imageFile || busy) return;
    setBusy(true);
    setError(null);
    try {
      const compressed = await compressImageForUpload(imageFile);
      const path = `${meId}/ads/${crypto.randomUUID()}-${compressed.name}`;
      const { error: upErr } = await supabase.storage.from("chat-media").upload(path, compressed);
      if (upErr) {
        setError(describeError(upErr, { stage: "upload", bucket: "chat-media", path }));
        return;
      }
      const { data: signed, error: signErr } = await supabase.storage
        .from("chat-media")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signErr || !signed) {
        setError(describeError(signErr || new Error("Couldn't get a URL for the uploaded image."), { stage: "sign-url", bucket: "chat-media", path }));
        return;
      }

      await onCreated({
        mediaUrl: signed.signedUrl,
        title: title.trim(),
        ctaLabel: ctaLabel.trim(),
        ctaUrl: normalizeUrl(ctaUrl),
        placement: canPostInChat ? placement : "list",
      });
      onClose();
    } catch (e) {
      setError(describeError(e, { stage: "post" }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[70] grid place-items-center bg-black/70 backdrop-blur-md p-4" 
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-[0_0_60px_-15px_rgba(245,158,11,0.6)] ring-1 ring-amber-500/40 dark:bg-[#1a1a1a] dark:shadow-[0_0_60px_-15px_rgba(245,158,11,0.4)] dark:ring-amber-500/30"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-black/5 bg-gradient-to-r from-amber-50 to-white px-6 py-5 dark:from-amber-950/30 dark:to-[#1a1a1a] dark:border-white/10">
            <h3 className="flex items-center gap-2.5 text-lg font-extrabold text-zinc-900 dark:text-zinc-50">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500 text-white shadow-lg shadow-amber-500/30">
                <Megaphone className="h-5 w-5" />
              </span>
              <span className="bg-gradient-to-r from-amber-600 to-amber-500 bg-clip-text text-transparent dark:from-amber-400 dark:to-amber-300">
                Create New Ad
              </span>
            </h3>
            <button 
              onClick={onClose} 
              className="grid h-9 w-9 place-items-center rounded-full text-zinc-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30 dark:hover:text-red-400"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="max-h-[70vh] space-y-5 overflow-y-auto px-6 py-5">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handlePickImage(e.target.files)} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="group relative flex h-48 w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/50 transition-all hover:border-amber-500 hover:bg-amber-100/50 dark:border-amber-700/50 dark:bg-amber-950/20 dark:hover:border-amber-500 dark:hover:bg-amber-900/30"
            >
              {imagePreview ? (
                <img src={imagePreview} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
              ) : (
                <span className="flex flex-col items-center gap-2 text-amber-600 dark:text-amber-400">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50">
                    <ImagePlus className="h-6 w-6" />
                  </div>
                  <span className="text-sm font-bold">Click to add an image</span>
                  <span className="text-xs font-medium text-amber-600/70 dark:text-amber-400/70">Recommended: 1200 x 628 px</span>
                </span>
              )}
            </button>

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Headline</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
                placeholder="e.g. 20% off this weekend only"
                className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-900 outline-none transition-all focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-amber-500 dark:focus:ring-amber-500/20"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Button label</label>
                <input
                  value={ctaLabel}
                  onChange={(e) => setCtaLabel(e.target.value)}
                  maxLength={24}
                  placeholder="Shop now"
                  className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-900 outline-none transition-all focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-amber-500 dark:focus:ring-amber-500/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Link</label>
                <input
                  value={ctaUrl}
                  onChange={(e) => setCtaUrl(e.target.value)}
                  placeholder="yourstore.com"
                  className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-900 outline-none transition-all focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-amber-500 dark:focus:ring-amber-500/20"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Where it shows</label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  ["list", "Chat list", "Between chats, for everyone"],
                  ["chat", "This chat", "Only inside the open chat"],
                ] as const).map(([value, label, hint]) => {
                  const disabled = value === "chat" && !canPostInChat;
                  const on = (canPostInChat ? placement : "list") === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      disabled={disabled}
                      onClick={() => setPlacement(value)}
                      className={`rounded-xl border px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${on ? "border-amber-500 bg-amber-50 ring-4 ring-amber-500/10 dark:bg-amber-950/30" : "border-zinc-300 dark:border-zinc-600"}`}
                    >
                      <span className="block text-sm font-bold text-zinc-900 dark:text-zinc-100">{label}</span>
                      <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">{hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-950/40">
                <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-red-600 dark:text-red-400">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-200 text-red-700 dark:bg-red-900 dark:text-red-300">!</span>
                  Error (also logged to console)
                </p>
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-red-100/50 p-3 font-mono text-[11px] leading-relaxed text-red-700 dark:bg-red-900/30 dark:text-red-300">
                  {error}
                </pre>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-black/5 bg-zinc-50/50 px-6 py-5 dark:border-white/10 dark:bg-black/20">
            <button 
              onClick={onClose} 
              className="rounded-xl px-5 py-3 text-sm font-bold text-zinc-600 transition hover:bg-zinc-200/50 dark:text-zinc-300 dark:hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={!canSubmit || busy}
              className="group relative flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-amber-500/30 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-amber-500/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-lg"
            >
              {busy ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> Posting…
                </>
              ) : (
                <>
                  <Megaphone className="h-5 w-5 transition-transform group-hover:scale-110" /> Post Ad
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
