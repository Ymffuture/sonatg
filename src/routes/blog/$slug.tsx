import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Clock, MessageCircle } from "lucide-react";
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
    <div className="py-16 text-center">
      <p className="text-sm text-[#667781] dark:text-[#aebac1]">This post doesn't exist or isn't published.</p>
      <Link to="/blog" className="mt-4 inline-block text-sm font-semibold text-[#E07A5F] hover:underline">
        ← Back to blog
      </Link>
    </div>
  ),
  component: BlogPostPage,
});

function BlogPostPage() {
  const post = Route.useLoaderData();
  const paragraphs = post.body.split(/\n\s*\n/).filter(Boolean);

  return (
    <article>
      {post.cover_image_url && (
        <img
          src={post.cover_image_url}
          alt={post.title}
          className="mb-6 h-56 w-full rounded-2xl object-cover sm:h-72"
        />
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium text-[#E07A5F]">
        <span className="rounded-full bg-[#E07A5F]/10 px-2.5 py-1">{post.tag}</span>
        <span className="flex items-center gap-1 text-[#667781] dark:text-[#8696a0]">
          <Clock className="h-3 w-3" /> {post.read_mins} min read
        </span>
        <span className="text-[#667781] dark:text-[#8696a0]">· {fmtBlogDate(post.created_at)}</span>
      </div>

      <h1 className="text-3xl font-bold leading-tight">{post.title}</h1>
      <p className="mt-3 text-base leading-7 text-[#667781] dark:text-[#aebac1]">{post.description}</p>

      <div className="mt-8 space-y-5 text-[15.5px] leading-8 text-[#1a1a1a] dark:text-[#e8e8e8]">
        {paragraphs.map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>

      {/*
        Once approved, create a real "Display ad" unit in your AdSense
        dashboard and swap the slot id below for the one it gives you.
        Auto ads (script in __root.tsx) already work without this.
      */}
      <div className="my-10">
        <AdSlot slot="1234567890" />
      </div>

      <div className="py-6 text-center">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full bg-[#E07A5F] px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:brightness-95"
        >
          <MessageCircle className="h-4 w-4" />
          Back to chats
        </Link>
      </div>
    </article>
  );
}
