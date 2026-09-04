import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Loader2, Link2, ShieldAlert, Users, LogIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { previewChatInvite, joinChatByInvite, type InvitePreview } from "@/features/invites";
import { Avatar } from "@/components/Avatar";

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

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (alive) setSignedIn(!!auth.user);
      try {
        const p = await previewChatInvite(token);
        if (alive) setPreview(p);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "This invite couldn't be loaded.");
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
      await joinChatByInvite(token);
      navigate({ to: "/" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't join this group.");
      setJoining(false);
    }
  };

  const title = preview?.title || "Sona group";

  return (
    <main className="min-h-dvh grid place-items-center bg-[#F5F0E8] dark:bg-[#1E1E1E] px-4 py-10">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        className="w-full max-w-sm rounded-3xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-white/5 p-6 shadow-xl backdrop-blur-xl text-center"
      >
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-[var(--sona-accent,#E07A5F)]/10">
          <Link2 className="h-6 w-6 text-[var(--sona-accent,#E07A5F)]" />
        </div>

        {loading ? (
          <p className="flex items-center justify-center gap-2 py-6 text-sm text-[#8C8C8C]">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking this invite…
          </p>
        ) : !preview ? (
          <>
            <h1 className="text-lg font-semibold text-[#2D3436] dark:text-[#E8E8E8]">Invite not found</h1>
            <p className="mt-2 text-sm text-[#8C8C8C]">This link is invalid or has been revoked.</p>
          </>
        ) : (
          <>
            <div className="mx-auto mb-3 w-fit">
              <Avatar url={preview.avatar_url} name={title} size={64} />
            </div>
            <h1 className="text-lg font-semibold text-[#2D3436] dark:text-[#E8E8E8]">{title}</h1>
            <p className="mt-1 flex items-center justify-center gap-1.5 text-xs text-[#8C8C8C]">
              <Users className="h-3.5 w-3.5" /> {preview.is_group ? "Group chat on Sona" : "Chat on Sona"}
            </p>

            {preview.allowed_email && (
              <p className="mt-3 rounded-xl bg-[var(--sona-accent,#E07A5F)]/10 px-3 py-2 text-[11px] text-[var(--sona-accent,#E07A5F)]">
                This invite is reserved for <span className="font-semibold">{preview.allowed_email}</span>
              </p>
            )}

            {preview.already_member ? (
              <Link
                to="/"
                className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-[var(--sona-accent,#E07A5F)] py-3 text-sm font-semibold text-white shadow-lg"
              >
                You're already in — open chat
              </Link>
            ) : !preview.is_valid ? (
              <p className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-red-500/10 px-3 py-2.5 text-xs font-medium text-red-500">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                {preview.reason || "This invite is no longer valid."}
              </p>
            ) : signedIn === false ? (
              <Link
                to="/auth"
                search={{ redirect: `/invite/${token}` } as never}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--sona-accent,#E07A5F)] py-3 text-sm font-semibold text-white shadow-lg"
              >
                <LogIn className="h-4 w-4" /> Sign in to join
              </Link>
            ) : (
              <button
                onClick={join}
                disabled={joining}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--sona-accent,#E07A5F)] py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-60"
              >
                {joining ? <><Loader2 className="h-4 w-4 animate-spin" /> Joining…</> : "Join group"}
              </button>
            )}

            {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
          </>
        )}

        <Link to="/" className="mt-4 block text-[11px] text-[#8C8C8C] underline underline-offset-2">
          Back to Sona
        </Link>
      </motion.section>
    </main>
  );
}
