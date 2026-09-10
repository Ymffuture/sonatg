import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Clock, MessageCircle, Calendar, ArrowLeft } from "lucide-react";
import { getPublishedPost, fmtBlogDate } from "@/lib/blog.functions";
import { AdSlot } from "@/components/AdSlot";

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    const post = await getPublishedPost(params.slug);
    if (!post) throw notFound();
    return post;
  },
  head: ({ loaderData }) =>
    loaderData
      ? {
          meta: [
            { title: `${loaderData.title} — Sona Blog` },
            { name: "description", content: loaderData.description },
            { property: "og:title", content: loaderData.title },
            { property: "og:description", content: loaderData.description },
            { property: "og:type", content: "article" },
            ...(loaderData.cover_image_url ? [{ property: "og:image", content: loaderData.cover_image_url }] : []),
          ],
        }
      : {},
  notFoundComponent: () => (
    <div className="flex min-h-[50vh] flex-col items-center justify-center py-16 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
        <ArrowLeft className="h-8 w-8 text-zinc-400" />
      </div>
      <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Post not found</h2>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">This post doesn't exist or isn't published.</p>
      <Link 
        to="/blog" 
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-black dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to blog
      </Link>
    </div>
  ),
  component: BlogPostPage,
});

function BlogPostPage() {
  const post = Route.useLoaderData();
  const paragraphs = post.body.split(/\n\s*\n/).filter(Boolean);

  return (
    <article className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Hero Section */}
      <header className="mb-10 space-y-6">
        {post.cover_image_url && (
          <div className="relative overflow-hidden rounded-3xl border border-zinc-200/60 bg-zinc-100 shadow-xl dark:border-zinc-800/60 dark:bg-zinc-900/50">
            <img
              src={post.cover_image_url}
              alt={post.title}
              className="h-64 w-full object-cover transition-transform duration-700 hover:scale-105 sm:h-80 lg:h-96"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          </div>
        )}

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-wider">
            <span className="rounded-full bg-[#E07A5F]/10 px-3.5 py-1.5 text-[#E07A5F] ring-1 ring-inset ring-[#E07A5F]/20 dark:bg-[#E07A5F]/15 dark:ring-[#E07A5F]/30">
              {post.tag}
            </span>
            <span className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
              <Clock className="h-3.5 w-3.5" /> {post.read_mins} min read
            </span>
            <span className="hidden sm:inline text-zinc-300 dark:text-zinc-700">•</span>
            <span className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
              <Calendar className="h-3.5 w-3.5" /> {fmtBlogDate(post.created_at)}
            </span>
          </div>

          <h1 className="text-3xl font-black leading-tight tracking-tight text-zinc-900 dark:text-white sm:text-4xl lg:text-5xl">
            {post.title}
          </h1>
          
          <p className="max-w-2xl text-lg leading-relaxed text-zinc-600 dark:text-zinc-400 sm:text-xl">
            {post.description}
          </p>
        </div>
      </header>

      {/* Divider */}
      <div className="mb-10 h-px w-full bg-gradient-to-r from-transparent via-zinc-300 to-transparent dark:via-zinc-700" />

      {/* Content Body */}
      <div className="mx-auto max-w-2xl space-y-6 text-[17px] leading-8 text-zinc-800 dark:text-zinc-300">
        {paragraphs.map((para, i) => (
          <p key={i} className="first-letter:text-2xl first-letter:font-bold first-letter:text-zinc-900 first-letter:dark:text-white">
            {para}
          </p>
        ))}
      </div>

      {/* Elegant Ad Container */}
      <div className="mx-auto my-12 max-w-2xl">
        <div className="rounded-2xl border border-zinc-200/50 bg-zinc-50/50 p-4 text-center text-xs text-zinc-400 backdrop-blur-sm dark:border-zinc-800/50 dark:bg-zinc-900/20 dark:text-zinc-600">
          <AdSlot slot="1234567890" />
        </div>
      </div>

      {/* Footer Navigation */}
      <footer className="mt-16 flex flex-col items-center justify-center gap-6 border-t border-zinc-200 pt-10 dark:border-zinc-800">
        <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <span>Enjoyed this article?</span>
          <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
          <Link to="/blog" className="font-semibold text-[#E07A5F] transition-colors hover:text-[#c96548]">
            Read more from the blog
          </Link>
        </div>
        
        <Link
          to="/"
          className="group inline-flex items-center gap-2 rounded-full bg-zinc-900 px-6 py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-black hover:shadow-xl dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <MessageCircle className="h-4 w-4 transition-transform group-hover:-rotate-12" />
          Back to chats
        </Link>
      </footer>
    </article>
  );
}
