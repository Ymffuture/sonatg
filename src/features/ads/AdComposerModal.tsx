// src/features/ads/AdComposerModal.tsx
//
// Lets a verified business account (profiles.is_business — see the
// 20260915090000_business_accounts_and_ads.sql migration) build an ad
// message: an image, a headline, and a call-to-action button. The modal
// does its own image upload (same "chat-media" bucket and compression
// helper the regular image-attachment flow in SonaChat.tsx uses) and hands
// the finished fields back via onCreated — the caller is responsible for
// actually inserting the { kind: "ad", ... } message row, same split of
// responsibility as PollComposerModal (modal creates the poll row itself,
// but the caller still posts the "poll" message that references it).
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
};

interface AdComposerModalProps {
  meId: string;
  onClose: () => void;
  onCreated: (ad: CreatedAd) => void;
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function AdComposerModal({ meId, onClose, onCreated }: AdComposerModalProps) {
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

  const submit = async () => {
    if (!canSubmit || !imageFile || busy) return;
    setBusy(true);
    setError(null);
    try {
      const compressed = await compressImageForUpload(imageFile);
      const path = `${meId}/ads/${crypto.randomUUID()}-${compressed.name}`;
      const { error: upErr } = await supabase.storage.from("chat-media").upload(path, compressed);
      if (upErr) throw upErr;
      const { data: signed, error: signErr } = await supabase.storage
        .from("chat-media")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signErr || !signed) throw signErr || new Error("Couldn't get a URL for the uploaded image.");

      onCreated({
        mediaUrl: signed.signedUrl,
        title: title.trim(),
        ctaLabel: ctaLabel.trim(),
        ctaUrl: normalizeUrl(ctaUrl),
      });
    } catch (e) {
      setError((e as Error).message || "Something went wrong creating the ad. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[70] grid place-items-center bg-black/40 p-4" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-[#1E1E1E]"
        >
          <div className="flex items-center justify-between border-b border-black/5 px-5 py-4 dark:border-white/10">
            <h3 className="flex items-center gap-2 text-base font-bold text-zinc-900 dark:text-zinc-100">
              <Megaphone className="h-4.5 w-4.5 text-amber-500" /> New ad
            </h3>
            <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full text-zinc-500 hover:bg-black/5 dark:hover:bg-white/10">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handlePickImage(e.target.files)} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex h-40 w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 transition hover:border-amber-400 dark:border-zinc-700 dark:bg-zinc-900"
            >
              {imagePreview ? (
                <img src={imagePreview} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex flex-col items-center gap-1.5 text-zinc-400">
                  <ImagePlus className="h-6 w-6" />
                  <span className="text-xs font-semibold">Add an image</span>
                </span>
              )}
            </button>

            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-zinc-500">Headline</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
                placeholder="e.g. 20% off this weekend only"
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-amber-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-zinc-500">Button label</label>
                <input
                  value={ctaLabel}
                  onChange={(e) => setCtaLabel(e.target.value)}
                  maxLength={24}
                  placeholder="Shop now"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-amber-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-zinc-500">Link</label>
                <input
                  value={ctaUrl}
                  onChange={(e) => setCtaUrl(e.target.value)}
                  placeholder="yourstore.com"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-amber-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>

            {error && <p className="text-xs font-semibold text-red-500">{error}</p>}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-black/5 px-5 py-4 dark:border-white/10">
            <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={!canSubmit || busy}
              className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-amber-600 disabled:opacity-50"
            >
              {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Posting…</> : "Post ad"}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
