import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Result } from "antd";

import appCss from "../styles.css?url";
import { reportError } from "../lib/error-reporting";
import { ConfirmProvider } from "@/hooks/useConfirmDialog";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Result
        status="404"
        title="404"
        subTitle="The page you're looking for doesn't exist or has been moved."
        extra={
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        }
      />
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportError(error, { boundary: "root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Result
        status="500"
        title="This page didn't load"
        subTitle="Something went wrong on our end. You can try refreshing or head back home."
        extra={
          <div className="flex flex-wrap justify-center gap-2">
            <button
              onClick={() => {
                router.invalidate();
                reset();
              }}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Try again
            </button>
            <a
              href="/"
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              Go home
            </a>
          </div>
        }
      />
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" },
      { title: "Sona — Talk Gold" },
      { name: "theme-color", content: "#F0EBE3", media: "(prefers-color-scheme: light)" },
      { name: "theme-color", content: "#1A1A1A", media: "(prefers-color-scheme: dark)" },
      { name: "color-scheme", content: "light dark" },
      { name: "description", content: "Private messaging, voice & video calls, and AI-powered conversations — all in one beautiful place." },
      { name: "keywords", content: "messaging, chat, private, encrypted, voice calls, video calls, AI chat" },
      { name: "author", content: "Sona" },
      { name:"google-adsense-account", content:"ca-pub-2722864790738174"} , 
      { name:"google-site-verification", content:"xXWElQQdEb1YSMqAy524N-B58KqSZqsf5zc0O8fWg3A"}, 
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Sona" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "application-name", content: "Sona" },
      { name: "msapplication-TileColor", content: "#E07A5F" },
      { name: "msapplication-config", content: "/browserconfig.xml" },
      { property: "og:site_name", content: "Sona" },
      { property: "og:title", content: "Sona — Talk Gold" },
      { property: "og:description", content: "Private messaging, voice & video calls, and AI-powered conversations — all in one beautiful place." },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "en_US" },
      { property: "og:url", content: "https://sona.chat" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@sona_app" },
      { name: "twitter:title", content: "Sona — Talk Gold" },
      { name: "twitter:description", content: "Private messaging, voice & video calls, and AI-powered conversations." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/c2848763-a982-4e16-b7b5-e800f59cee97" },
      { property: "og:image:alt", content: "Sona — Talk Gold. A modern chat experience." },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/c2848763-a982-4e16-b7b5-e800f59cee97" },
      { name: "twitter:image:alt", content: "Sona — Talk Gold. A modern chat experience." },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
      { rel: "mask-icon", href: "/favicon.png", color: "#E07A5F" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});

    let reloaded = false;
    const onControllerChange = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);

  useEffect(() => {
    import("@/integrations/supabase/client").then(({ supabase }) => {
      const { data: sub } = supabase.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
          router.invalidate();
          if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
        }
      });
      (window as unknown as { __sonaAuthSub?: { unsubscribe: () => void } }).__sonaAuthSub = sub.subscription;
    });
    return () => {
      const s = (window as unknown as { __sonaAuthSub?: { unsubscribe: () => void } }).__sonaAuthSub;
      s?.unsubscribe();
    };
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <ConfirmProvider>
        <Outlet />
      </ConfirmProvider>
    </QueryClientProvider>
  );
}
