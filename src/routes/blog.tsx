import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Clock, MessageCircle } from "lucide-react";
import { blogPosts } from "@/lib/blog-posts";

export const Route = createFileRoute("/blog")({
  head: () => ({
    meta: [
      { title: "Sona Blog — Guides, privacy, and product notes" },
      {
        name: "description",
        content:
          "Articles about private messaging, group chat organization, and how Sona AI works — written by the team building Sona.",
      },
      { property: "og:title", content: "Sona Blog" },
      {
        property: "og:description",
        content: "Guides on privacy, group chats, and AI — from the team building Sona.",
      },
    ],
  }),
  component: BlogIndexPage,
});

function BlogIndexPage() {
  return (
    <div className="min-h-dvh bg-[#FAF8F5] text-[#111b21] dark:bg-[#151c1c] dark:text-white">
      <header className="sticky top-0 z-10 border-b border-black/5 bg-white dark:bg-[#1a1a1a]">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link to="/" className="grid h-10 w-10 place-items-center rounded-full transition hover:bg-black/5 dark:hover:bg-white/10">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-bold">Sona Blog</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <section className="mb-8">
          <h2 className="text-2xl font-bold">Guides, privacy, and product notes</h2>
          <p className="mt-2 text-sm leading-6 text-[#667781] dark:text-[#aebac1]">
            Writing from the team building Sona — on private messaging, organizing group chats,
            and how we think about putting AI inside a conversation without breaking it.
          </p>
        </section>

        <div className="space-y-4">
          {blogPosts
            .slice()
            .sort((a, b) => (a.date < b.date ? 1 : -1))
            .map((post) => (
              <Link
                key={post.slug}
                to="/blog/$slug"
                params={{ slug: post.slug }}
                className="block rounded-2xl border border-black/5 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-[#202c33]"
              >
                <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[#E07A5F]">
                  <span className="rounded-full bg-[#E07A5F]/10 px-2.5 py-1">{post.tag}</span>
                  <span className="flex items-center gap-1 text-[#667781] dark:text-[#8696a0]">
                    <Clock className="h-3 w-3" /> {post.readMins} min read
                  </span>
                </div>
                <h3 className="text-lg font-semibold leading-snug">{post.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-[#667781] dark:text-[#aebac1]">
                  {post.description}
                </p>
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
      </main>
    </div>
  );
}
