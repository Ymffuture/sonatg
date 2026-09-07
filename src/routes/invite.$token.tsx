import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Loader2, Link2, ShieldAlert, Users, LogIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { previewChatInvite, joinChatByInvite, type InvitePreview } from "@/features/invites";
import { Avatar } from "@/components/Avatar";
import { postSystemMessage } from "@/lib/systemMessages";

export const Route = createFileRoute("/invite/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Join a group on Sona — Talk Gold" },
      { name: "description", content: "You've been invited to a Sona group chat. Open the invite to preview the group and join the conversation." },
      { property: "og:title", content: "Join a group on Sona — Talk Gold" },
      { property: "og:description", content: "You've been invited to a Sona group chat. Preview the group and join the conversation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InvitePage,
});

// Staggered animation variants for a premium, cascading entrance
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { 
    opacity: 1, 
    y: 0,
    transition: { type: "spring", stiffness: 320, damping: 24 }
  },
};

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (alive) setSignedIn(!!auth.user);
      try {
        const p = await previewChatInvite(token);
        if (alive) setPreview(p);
      } catch (e) {
        console.error("preview_chat_invite failed:", e);
        if (alive) {
          setLoadError(e instanceof Error ? e.message : "This invite couldn't be loaded.");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [token]);

  const join = async () => {
    setJoining(true);
    setError(null);
    try {
      const chatId = await joinChatByInvite(token);
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) {
        const { data: prof } = await supabase
          .from("profiles").select("display_name").eq("id", auth.user.id).maybeSingle();
        await postSystemMessage(chatId, `${prof?.display_name ?? "Someone"} joined the group`);
      }
      try { localStorage.setItem("sona:openChat", chatId); } catch { /* no-op */ }
      navigate({ to: "/" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't join this group.");
      setJoining(false);
    }
  };

  const title = preview?.title || "Sona group";
  const accentColor = "var(--sona-accent, #E07A5F)";

  return (
    <main className="relative min-h-dvh grid place-items-center bg-gradient-to-br from-[#FAF8F5] to-[#F0EBE3] dark:from-[#09090b] dark:to-[#18181b] px-4 py-10 overflow-hidden">
      {/* Subtle ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[var(--sona-accent,#E07A5F)]/5 dark:bg-[var(--sona-accent,#E07A5F)]/10 rounded-full blur-3xl pointer-events-none" />

      <motion.section
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        className="relative w-full max-w-sm rounded-[2rem] border border-white/70 dark:border-white/10 bg-white/80 dark:bg-zinc-900/80 p-8 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.08)] dark:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.6)] backdrop-blur-2xl text-center overflow-hidden"
      >
        {/* Subtle top shine effect */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/60 to-transparent dark:from-white/5 dark:to-transparent pointer-events-none" />

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="relative z-10"
        >
          <motion.div variants={itemVariants} className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-[var(--sona-accent,#E07A5F)]/10 ring-1 ring-[var(--sona-accent,#E07A5F)]/20 shadow-sm">
            <Link2 className="h-6 w-6 text-[var(--sona-accent,#E07A5F)]" />
          </motion.div>

          {loading ? (
            <motion.p variants={itemVariants} className="flex items-center justify-center gap-2.5 py-6 text-sm font-medium text-zinc-500 dark:text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin" /> 
              <span>Verifying invite…</span>
            </motion.p>
          ) : !preview ? (
            <motion.div variants={itemVariants} className="space-y-2">
              <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                {loadError ? "Couldn't load invite" : "Invite not found"}
              </h1>
              <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                {loadError ?? "This link is invalid, expired, or has been revoked."}
              </p>
              {loadError && (
                <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-xs font-medium text-red-600 dark:text-red-400 break-words">
                  <span className="opacity-70">Technical detail:</span> {loadError}
                </div>
              )}
            </motion.div>
          ) : (
            <div className="space-y-1">
              <motion.div variants={itemVariants} className="mx-auto mb-4 w-fit">
                <div className="p-1 rounded-full bg-white dark:bg-zinc-800 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
                  <Avatar url={preview.avatar_url} name={title} size={64} />
                </div>
              </motion.div>
              
              <motion.h1 variants={itemVariants} className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                {title}
              </motion.h1>
              
              <motion.p variants={itemVariants} className="flex items-center justify-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                <Users className="h-3.5 w-3.5" /> 
                {preview.is_group ? "Group chat on Sona" : "Chat on Sona"}
              </motion.p>

              {preview.allowed_email && (
                <motion.p variants={itemVariants} className="mt-5 rounded-2xl border border-[var(--sona-accent,#E07A5F)]/20 bg-[var(--sona-accent,#E07A5F)]/5 px-4 py-2.5 text-xs font-medium text-[var(--sona-accent,#E07A5F)] dark:text-[#F0A08A]">
                  Reserved for <span className="font-semibold">{preview.allowed_email}</span>
                </motion.p>
              )}

              <motion.div variants={itemVariants} className="pt-2">
                {preview.already_member ? (
                  <Link
                    to="/"
                    className="group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--sona-accent,#E07A5F)] py-3.5 text-sm font-semibold text-white shadow-[0_4px_14px_0_rgba(224,122,95,0.39)] transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_6px_20px_rgba(224,122,95,0.23)] active:scale-[0.98]"
                  >
                    You're already in — open chat
                  </Link>
                ) : !preview.is_valid ? (
                  <div className="flex items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-xs font-medium text-red-600 dark:text-red-400">
                    <ShieldAlert className="h-4 w-4 shrink-0" />
                    {preview.reason || "This invite is no longer valid."}
                  </div>
                ) : signedIn === false ? (
                  <Link
                    to="/auth"
                    search={{ redirect: `/invite/${token}` } as never}
                    className="group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--sona-accent,#E07A5F)] py-3.5 text-sm font-semibold text-white shadow-[0_4px_14px_0_rgba(224,122,95,0.39)] transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_6px_20px_rgba(224,122,95,0.23)] active:scale-[0.98]"
                  >
                    <LogIn className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" /> 
                    Sign in to join
                  </Link>
                ) : (
                  <button
                    onClick={join}
                    disabled={joining}
                    className="group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--sona-accent,#E07A5F)] py-3.5 text-sm font-semibold text-white shadow-[0_4px_14px_0_rgba(224,122,95,0.39)] transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_6px_20px_rgba(224,122,95,0.23)] active:scale-[0.98] disabled:opacity-60 disabled:hover:scale-100 disabled:active:scale-100"
                  >
                    {joining ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> 
                        <span>Joining…</span>
                      </>
                    ) : (
                      "Join group"
                    )}
                  </button>
                )}

                {error && (
                  <p className="mt-4 rounded-xl bg-red-500/5 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 border border-red-500/10">
                    {error}
                  </p>
                )}
              </motion.div>
            </div>
          )}

          <motion.div variants={itemVariants} className="mt-8 pt-6 border-t border-zinc-200/50 dark:border-white/5">
            <Link 
              to="/" 
              className="inline-block text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 underline underline-offset-4 decoration-zinc-300 dark:decoration-zinc-700 hover:decoration-zinc-400 dark:hover:decoration-zinc-500"
            >
              Back to Sona
            </Link>
          </motion.div>
        </motion.div>
      </motion.section>
    </main>
  );
}
