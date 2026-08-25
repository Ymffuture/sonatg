import { useEffect, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, MessageCircle, Loader2 } from "lucide-react";
import { CheckCircleFilled, FacebookOutlined, TwitterOutlined, InstagramOutlined } from "@ant-design/icons";
import { MdVerified } from "react-icons/md";
import { supabase } from "@/integrations/supabase/client";

type PublicProfile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  is_pro: boolean | null;
  is_ai: boolean | null;
  facebook_url: string | null;
  x_url: string | null;
  instagram_url: string | null;
  threads_url: string | null;
};

async function fetchPublicProfile(id: string): Promise<PublicProfile | null> {
  const { data, error } = await supabase.rpc("get_public_profile", { profile_id: id });
  if (error) throw error;
  return data?.[0] ?? null;
}

export const Route = createFileRoute("/u/$id")({
  loader: async ({ params }) => {
    const profile = await fetchPublicProfile(params.id);
    if (!profile) throw notFound();
    return profile;
  },
  head: ({ loaderData }) =>
    loaderData
      ? {
          meta: [
            { title: `${loaderData.display_name} on Sona` },
            { name: "description", content: `Chat with ${loaderData.display_name} on Sona.` },
            { property: "og:title", content: `${loaderData.display_name} on Sona` },
            { property: "og:description", content: `Chat with ${loaderData.display_name} on Sona.` },
            ...(loaderData.avatar_url ? [{ property: "og:image", content: loaderData.avatar_url }] : []),
            { name: "robots", content: "noindex" },
          ],
        }
      : {},
  notFoundComponent: () => (
    <div className="grid min-h-dvh place-items-center bg-[#FAF8F5] px-4 dark:bg-[#151c1c]">
      <div className="text-center">
        <p className="text-sm text-[#667781] dark:text-[#aebac1]">This profile doesn't exist or the link is invalid.</p>
        <Link to="/" className="mt-4 inline-block text-sm font-semibold text-[#E07A5F] hover:underline">
          Go to Sona
        </Link>
      </div>
    </div>
  ),
  component: PublicProfilePage,
});

function PublicProfilePage() {
  const profile = Route.useLoaderData();
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setIsAuthed(!!data.user));
  }, []);

  const initial = profile.display_name?.charAt(0).toUpperCase() ?? "?";
  const hasSocials = profile.facebook_url || profile.x_url || profile.instagram_url || profile.threads_url;

  return (
    <div className="min-h-dvh bg-[#FAF8F5] text-[#111b21] dark:bg-[#151c1c] dark:text-white">
      <header className="sticky top-0 z-10 border-b border-black/5 bg-white dark:bg-[#1a1a1a]">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          <Link to="/" className="grid h-10 w-10 place-items-center rounded-full transition hover:bg-black/5 dark:hover:bg-white/10">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-sm font-semibold text-[#667781] dark:text-[#8696a0]">Sona</h1>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-10">
        <div className="rounded-3xl border border-black/5 bg-white p-6 text-center shadow-sm dark:border-white/10 dark:bg-[#202c33]">
          <div className="relative mx-auto h-24 w-24">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.display_name}
                className="h-24 w-24 rounded-full object-cover ring-4 ring-[#E07A5F]/10"
              />
            ) : (
              <div className="grid h-24 w-24 place-items-center rounded-full bg-[#E07A5F] text-3xl font-bold text-white ring-4 ring-[#E07A5F]/10">
                {initial}
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-center gap-1.5">
            <h2 className="text-xl font-bold">{profile.display_name}</h2>
            {(profile.is_ai || profile.is_pro) && (
              profile.is_ai
                ? <MdVerified style={{ color: "#1877F2", fontSize: 18 }} />
                : <CheckCircleFilled style={{ color: "#8B5CF6", fontSize: 18 }} />
            )}
          </div>

          {profile.is_ai && (
            <span className="mt-1 inline-block rounded-full bg-[#1877F2]/10 px-2.5 py-0.5 text-[10px] font-bold text-[#1877F2]">
              AI ASSISTANT
            </span>
          )}
          {!profile.is_ai && profile.is_pro && (
            <span className="mt-1 inline-block rounded-full bg-[#8B5CF6]/10 px-2.5 py-0.5 text-[10px] font-bold text-[#8B5CF6]">
              Purple
            </span>
          )}

          {profile.bio && (
            <p className="mt-3 text-sm leading-6 text-[#667781] dark:text-[#aebac1]">{profile.bio}</p>
          )}

          {hasSocials && (
            <div className="mt-4 flex items-center justify-center gap-3">
              {profile.facebook_url && (
                <a href={profile.facebook_url} target="_blank" rel="noopener noreferrer"
                  className="grid h-9 w-9 place-items-center rounded-full bg-[#1877F2]/10 text-[#1877F2] transition hover:bg-[#1877F2]/20">
                  <FacebookOutlined />
                </a>
              )}
              {profile.x_url && (
                <a href={profile.x_url} target="_blank" rel="noopener noreferrer"
                  className="grid h-9 w-9 place-items-center rounded-full bg-black/10 text-black dark:bg-white/10 dark:text-white transition hover:bg-black/20 dark:hover:bg-white/20">
                  <TwitterOutlined />
                </a>
              )}
              {profile.instagram_url && (
                <a href={profile.instagram_url} target="_blank" rel="noopener noreferrer"
                  className="grid h-9 w-9 place-items-center rounded-full bg-[#E1306C]/10 text-[#E1306C] transition hover:bg-[#E1306C]/20">
                  <InstagramOutlined />
                </a>
              )}
            </div>
          )}

          <div className="mt-6">
            {isAuthed === null ? (
              <div className="flex items-center justify-center gap-2 py-2.5 text-sm text-[#8C8C8C]">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : isAuthed ? (
              <Link
                to="/"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#E07A5F] py-3 text-sm font-semibold text-white shadow-md transition hover:brightness-95"
              >
                <MessageCircle className="h-4 w-4" />
                Open Sona to message
              </Link>
            ) : (
              <Link
                to="/auth"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#E07A5F] py-3 text-sm font-semibold text-white shadow-md transition hover:brightness-95"
              >
                <MessageCircle className="h-4 w-4" />
                Sign in to message {profile.display_name.split(" ")[0]}
              </Link>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-[#8C8C8C]">
          Shared from Sona — private messaging with real-time chat and an AI assistant.
        </p>
      </main>
    </div>
  );
}
