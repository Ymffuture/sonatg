import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  component: AuthCallbackPage,
});

// Supabase redirects OAuth failures back here as query params AND as a
// "#error=..." hash fragment (some providers use one, some the other), so
// both need checking. Without this, an OAuth failure (e.g. Spotify
// rejecting an unverified email) silently fell through to getSession(),
// which just returns no session and shows a generic "Authentication
// failed" toast with no explanation.
function readAuthError(): { code: string; description: string } | null {
  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const code = params.get("error_code") || hashParams.get("error_code") || params.get("error") || hashParams.get("error");
  const description = params.get("error_description") || hashParams.get("error_description");
  if (!code) return null;
  return { code, description: description ? decodeURIComponent(description.replace(/\+/g, " ")) : code };
}

function friendlyAuthError(code: string, description: string): string {
  switch (code) {
    case "provider_email_needs_verification":
      return "Your email isn't verified with that provider yet. Verify your email with them, then try signing in again.";
    case "access_denied":
      return "Sign-in was cancelled or denied.";
    default:
      return description || "Something went wrong signing you in.";
  }
}

function AuthCallbackPage() {
  useEffect(() => {
    const handleCallback = async () => {
      const authError = readAuthError();
      if (authError) {
        const message = friendlyAuthError(authError.code, authError.description);
        // Carry the message to /auth via a query param so it can be shown
        // in the page's existing error Alert rather than just a toast
        // that disappears before the redirect even finishes.
        window.location.href = `/auth?authError=${encodeURIComponent(message)}`;
        return;
      }

      try {
        // Supabase automatically handles the OAuth callback
        // Check if we have a valid session
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error || !session) {
          window.location.href = `/auth?authError=${encodeURIComponent("Authentication failed. Please try again.")}`;
          return;
        }

        // Redirect to home page on success
        toast.success("Successfully signed in! 🎉");
        window.location.href = "/";
      } catch (err) {
        window.location.href = `/auth?authError=${encodeURIComponent((err as Error).message)}`;
      }
    };

    handleCallback();
  }, []);

  return (
    <div className="min-h-dvh grid place-items-center bg-background text-foreground">
      <div className="text-center">
        <h1 className="text-xl font-semibold">Completing sign in...</h1>
        <p className="mt-2 text-sm text-muted-foreground">Please wait while we authenticate you.</p>
      </div>
    </div>
  );
}
