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
    <div className="relative min-h-dvh bg-[#FFFDF9] text-zinc-900 transition-colors duration-300 dark:bg-[#0F0F11] dark:text-zinc-100">
      {/* Subtle ambient background gradient for premium feel */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-100/40 via-transparent to-transparent dark:from-purple-900/10" />
      
      <header className="sticky top-0 z-20 border-b border-zinc-200/60 bg-white/80 backdrop-blur-xl transition-colors dark:border-zinc-800/60 dark:bg-[#0F0F11]/80">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-5 py-4 sm:px-8">
          <Link 
            to="/" 
            className="group grid h-10 w-10 place-items-center rounded-full border border-zinc-200 bg-white/50 shadow-sm transition-all hover:border-zinc-300 hover:bg-white hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
            aria-label="Back to Sona"
          >
            <ArrowLeft className="h-4.5 w-4.5 text-zinc-600 transition-transform group-hover:-translate-x-0.5 dark:text-zinc-400" />
          </Link>
          <Link 
            to="/blog" 
            className="text-lg font-bold tracking-tight text-zinc-900 transition-colors hover:text-[var(--sona-accent,#E07A5F)] dark:text-white dark:hover:text-[var(--sona-accent,#E07A5F)]"
          >
            Sona Blog
          </Link>
        </div>
      </header>

      <main className="relative mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <Outlet />
      </main>
    </div>
  );
}
