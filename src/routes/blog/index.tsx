import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock, MessageCircle, Loader2, BookOpen, ArrowRight } from "lucide-react";
import { listPublishedPosts, type BlogPost } from "@/lib/blog.functions";
import { AdSlot } from "@/components/AdSlot";

export const Route = createFileRoute("/blog/")({
  component: BlogIndexPage,
});

function BlogIndexPage() {
  const [posts, setPosts] = useState<BlogPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listPublishedPosts()
      .then((data) => { if (alive) setPosts(data); })
      .catch((e) => { if (alive) setError(e.message || "Couldn't load posts"); });
    return () => { alive = false; };
  }, []);

  return (
    <>
      <section className="mb-12 text-center sm:mb-16">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E07A5F]/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-widest text-[#E07A5F] ring-1 ring-inset ring-[#E07A5F]/20 dark:bg-[#E07A5F]/15 dark:ring-[#E07A5F]/30">
          <BookOpen className="h-3.5 w-3.5" /> Sona Blog
        </span>
        <h1 className="mt-6 text-4xl font-black tracking-tight text-zinc-900 dark:text-white sm:text-5xl">
          Guides, privacy, and <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#8B5CF6] to-[#E07A5F]">product notes</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
          Writing from the team building Sona — on private messaging, organizing group chats,
          and how we think about putting AI inside a conversation without breaking it.
        </p>
      </section>

      {error && (
        <div className="mb-8 rounded-2xl border border-red-500/20 bg-red-500/5 p-5 text-sm text-red-600 backdrop-blur-sm dark:text-red-400">
          <strong className="font-semibold">Oops!</strong> {error}
        </div>
      )}

      {!posts && !error && (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-sm text-zinc-500 dark:text-zinc-400">
          <Loader2 className="h-6 w-6 animate-spin text-[#E07A5F]" />
          <span>Loading articles…</span>
        </div>
      )}

      {posts && posts.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-300 bg-white/50 p-12 text-center backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/20">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
            <BookOpen className="h-8 w-8 text-zinc-400" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-white">No posts yet</h3>
          <p className="mt-2 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">We're writing something great. Check back soon.</p>
        </div>
      )}

      <div className="space-y-8">
        {posts?.map((post, i) => (
          <div key={post.id}>
            <Link
              to="/blog/$slug"
              params={{ slug: post.slug }}
              className="group block overflow-hidden rounded-3xl border border-zinc-200/60 bg-white/80 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-zinc-300 hover:shadow-xl dark:border-zinc-800/60 dark:bg-zinc-900/40 dark:hover:border-zinc-700 dark:hover:shadow-zinc-900/50"
            >
              {post.cover_image_url && (
                <div className="relative h-56 w-full overflow-hidden sm:h-64">
                  <img
                    src={post.cover_image_url}
                    alt={post.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                </div>
              )}
              <div className="p-6 sm:p-8">
                <div className="mb-4 flex flex-wrap items-center gap-3 text-xs font-medium">
                  <span className="rounded-full bg-[#E07A5F]/10 px-3 py-1 text-[#E07A5F] ring-1 ring-inset ring-[#E07A5F]/20 dark:bg-[#E07A5F]/15 dark:ring-[#E07A5F]/30">
                    {post.tag}
                  </span>
                  <span className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
                    <Clock className="h-3.5 w-3.5" /> {post.read_mins} min read
                  </span>
                </div>
                <h2 className="text-xl font-bold tracking-tight text-zinc-900 transition-colors group-hover:text-[#E07A5F] dark:text-white sm:text-2xl">
                  {post.title}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 sm:text-base">
                  {post.description}
                </p>
                <div className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[#E07A5F] opacity-0 transition-all duration-300 group-hover:opacity-100">
                  Read article <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </Link>

            {/* One in-feed ad, only after enough real posts precede it. */}
            {i === 3 && posts.length > 4 && (
              <div className="mt-8 rounded-2xl border border-zinc-200/50 bg-zinc-50/50 p-4 text-center text-xs text-zinc-400 backdrop-blur-sm dark:border-zinc-800/50 dark:bg-zinc-900/20 dark:text-zinc-600">
                <AdSlot slot="2345678901" format="fluid" />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-16 flex justify-center pb-10">
        <Link
          to="/"
          className="group inline-flex items-center gap-2 rounded-full bg-zinc-900 px-6 py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-black hover:shadow-xl dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <MessageCircle className="h-4 w-4 transition-transform group-hover:-rotate-12" />
          Back to chats
        </Link>
      </div>
    </>
  );
}
