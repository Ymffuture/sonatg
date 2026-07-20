import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Supabase automatically handles the OAuth callback
        // Check if we have a valid session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error || !session) {
          toast.error("Authentication failed");
          window.location.href = "/auth";
          return;
        }

        // Redirect to home page on success
        toast.success("Successfully signed in! 🎉");
        window.location.href = "/";
      } catch (err) {
        toast.error((err as Error).message);
        window.location.href = "/auth";
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
