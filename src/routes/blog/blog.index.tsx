import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock, MessageCircle, Loader2 } from "lucide-react";
import { listPublishedPosts, type BlogPost } from "@/lib/blog.functions";

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
      <section className="mb-8">
        <h1 className="text-2xl font-bold">Guides, privacy, and product notes</h1>
        <p className="mt-2 text-sm leading-6 text-[#667781] dark:text-[#aebac1]">
          Writing from the team building Sona — on private messaging, organizing group chats,
          and how we think about putting AI inside a conversation without breaking it.
        </p>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-500">
          {error}
        </div>
      )}

      {!posts && !error && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-[#8C8C8C]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading posts…
        </div>
      )}

      {posts && posts.length === 0 && (
        <div className="rounded-2xl border border-black/5 bg-white p-8 text-center text-sm text-[#667781] dark:border-white/10 dark:bg-[#202c33] dark:text-[#aebac1]">
          No posts yet — check back soon.
        </div>
      )}

      <div className="space-y-4">
        {posts?.map((post) => (
          <Link
            key={post.id}
            to="/blog/$slug"
            params={{ slug: post.slug }}
            className="block overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-[#202c33]"
          >
            {post.cover_image_url && (
              <img
                src={post.cover_image_url}
                alt={post.title}
                className="h-44 w-full object-cover"
                loading="lazy"
              />
            )}
            <div className="p-5">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[#E07A5F]">
                <span className="rounded-full bg-[#E07A5F]/10 px-2.5 py-1">{post.tag}</span>
                <span className="flex items-center gap-1 text-[#667781] dark:text-[#8696a0]">
                  <Clock className="h-3 w-3" /> {post.read_mins} min read
                </span>
              </div>
              <h2 className="text-lg font-semibold leading-snug">{post.title}</h2>
              <p className="mt-1.5 text-sm leading-6 text-[#667781] dark:text-[#aebac1]">
                {post.description}
              </p>
            </div>
          </Link>
        ))}
      </div>

      <div className="py-10 text-center">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full bg-[#E07A5F] px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:brightness-95"
        >
          <MessageCircle className="h-4 w-4" />
          Back to chats
        </Link>
      </div>
    </>
  );
}
