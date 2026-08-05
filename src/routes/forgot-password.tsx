import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/forgot-password")({
  ssr: false,
  component: ForgotPasswordPage,
  head: () => ({
    meta: [
      { title: "Reset password · Sona" },
      { name: "description", content: "Reset your Sona account password by email." },
      { property: "og:title", content: "Reset password · Sona" },
      { property: "og:description", content: "Reset your Sona account password by email." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      setSent(true);
      toast.success("Reset link sent — check your inbox.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-[#F0EBE3] dark:bg-[#1A1A1A] p-4">
      <div className="w-full max-w-md rounded-3xl bg-white/70 dark:bg-[#242424]/70 backdrop-blur-xl border border-white/50 dark:border-white/10 p-8 shadow-xl">
        <h1 className="text-2xl font-bold text-[#2D3436] dark:text-[#E8E8E8]">Reset your password</h1>
        <p className="mt-2 text-sm text-[#8C8C8C]">
          {sent ? "We sent you a reset link. Follow it to set a new password." : "Enter your email and we'll send you a reset link."}
        </p>

        {!sent && (
          <form onSubmit={submit} className="mt-6 space-y-3">
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8C8C8C]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="w-full rounded-xl bg-[#F5F0E8] dark:bg-[#2A2A2A] pl-10 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#E07A5F]/40 text-[#2D3436] dark:text-[#E8E8E8] placeholder:text-[#A0A0A0]"
              />
            </div>
            <button
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-[#E07A5F] to-[#D4694F] py-3 text-sm font-semibold text-white shadow-lg shadow-[#E07A5F]/25 transition hover:shadow-xl disabled:opacity-60"
            >
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        <Link to="/auth" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-[#E07A5F] hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>
      </div>
    </div>
  );
}
