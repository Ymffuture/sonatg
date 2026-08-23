import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Clock, MessageCircle } from "lucide-react";
import { getBlogPost, blogPosts } from "@/lib/blog-posts";

export const Route = createFileRoute("/blog/$slug")({
  loader: ({ params }) => {
    const post = getBlogPost(params.slug);
    if (!post) throw notFound();
    return post;
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.title} — Sona Blog` },
          { name: "description", content: loaderData.description },
          { property: "og:title", content: loaderData.title },
          { property: "og:description", content: loaderData.description },
          { property: "og:type", content: "article" },
        ]
      : [],
  }),
  component: BlogPostPage,
});

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function BlogPostPage() {
  const post = Route.useLoaderData();

  const related = blogPosts.filter((p) => p.slug !== post.slug).slice(0, 2);

  return (
    <div className="min-h-dvh bg-[#FAF8F5] text-[#111b21] dark:bg-[#151c1c] dark:text-white">
      <header className="sticky top-0 z-10 border-b border-black/5 bg-white dark:bg-[#1a1a1a]">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link to="/blog" className="grid h-10 w-10 place-items-center rounded-full transition hover:bg-black/5 dark:hover:bg-white/10">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="truncate text-sm font-semibold text-[#667781] dark:text-[#8696a0]">Sona Blog</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <article>
          <div className="mb-3 flex items-center gap-2 text-xs font-medium text-[#E07A5F]">
            <span className="rounded-full bg-[#E07A5F]/10 px-2.5 py-1">{post.tag}</span>
            <span className="flex items-center gap-1 text-[#667781] dark:text-[#8696a0]">
              <Clock className="h-3 w-3" /> {post.readMins} min read
            </span>
            <span className="text-[#667781] dark:text-[#8696a0]">· {fmtDate(post.date)}</span>
          </div>

          <h1 className="text-3xl font-bold leading-tight">{post.title}</h1>
          <p className="mt-3 text-base leading-7 text-[#667781] dark:text-[#aebac1]">{post.description}</p>

          <div className="mt-8 space-y-5 text-[15.5px] leading-8 text-[#1a1a1a] dark:text-[#e8e8e8]">
            {post.body.map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>

          {/*
            Ad slot: place your AdSense unit here. This sits below substantial,
            original article content — never on empty states or inside the chat UI.
            Example:
            <ins className="adsbygoogle" style={{ display: "block" }}
                 data-ad-client="ca-pub-XXXXXXXXXXXXXXX"
                 data-ad-slot="XXXXXXXXXX"
                 data-ad-format="auto"
                 data-full-width-responsive="true" />
          */}
          <div className="my-10 rounded-2xl border border-dashed border-black/10 p-6 text-center text-xs text-[#8C8C8C] dark:border-white/10">
            Ad slot — placed after the article content
          </div>
        </article>

        {related.length > 0 && (
          <section className="mt-4">
            <h2 className="mb-3 text-sm font-semibold text-[#667781] dark:text-[#8696a0]">More from the blog</h2>
            <div className="space-y-3">
              {related.map((p) => (
                <Link
                  key={p.slug}
                  to="/blog/$slug"
                  params={{ slug: p.slug }}
                  className="block rounded-2xl border border-black/5 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-[#202c33]"
                >
                  <h3 className="text-base font-semibold leading-snug">{p.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-[#667781] dark:text-[#aebac1]">{p.description}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

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
