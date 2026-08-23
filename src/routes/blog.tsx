import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

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
    // AdSense loader is scoped to this content layout and everything nested
    // under it (/blog and /blog/$slug) — it must never load on the private
    // chat app or auth screens, which is why it's not in __root.tsx.
    scripts: [
      {
        async: true,
        src: "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2722864790738174",
        crossOrigin: "anonymous",
      },
    ],
  }),
  component: BlogLayout,
});

function BlogLayout() {
  return (
    <div className="min-h-dvh bg-[#FAF8F5] text-[#111b21] dark:bg-[#151c1c] dark:text-white">
      <header className="sticky top-0 z-10 border-b border-black/5 bg-white dark:bg-[#1a1a1a]">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link to="/" className="grid h-10 w-10 place-items-center rounded-full transition hover:bg-black/5 dark:hover:bg-white/10">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <Link to="/blog" className="text-lg font-bold">Sona Blog</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
