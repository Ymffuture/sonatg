import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/" });
  },
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Sign in · Sona" },
      { name: "description", content: "Sign in to Sona — talk gold." },
    ],
  }),
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Welcome to Sona ✨");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) toast.error(result.error.message);
    setLoading(false);
  };

  return (
    <div className="min-h-dvh grid place-items-center bg-background text-foreground p-4">
      <div className="w-full max-w-md rounded-3xl border bg-card p-6 shadow-xl md:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-skyblue to-skyblue-deep text-primary-foreground shadow-md">
            <span className="text-xl font-black">S</span>
          </div>
          <div>
            <h1 className="text-xl font-bold leading-none">Sona</h1>
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">talk gold</p>
          </div>
        </div>

        <h2 className="text-lg font-semibold">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "signin" ? "Sign in with your email." : "Join the gold conversation."}
        </p>

        <form onSubmit={submit} className="mt-5 space-y-3">
          {mode === "signup" && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Display name"
              className="w-full rounded-xl bg-secondary px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          )}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-xl bg-secondary px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-xl bg-secondary px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-br from-skyblue to-skyblue-deep py-3 text-sm font-semibold text-primary-foreground shadow-md transition disabled:opacity-60"
          >
            {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-widest text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          or
          <div className="h-px flex-1 bg-border" />
        </div>

        <button
          onClick={google}
          disabled={loading}
          className="w-full rounded-xl border bg-background py-3 text-sm font-medium transition hover:bg-secondary disabled:opacity-60"
        >
          Continue with Google
        </button>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "signin" ? "New to Sona?" : "Already have an account?"}{" "}
          <button
            className="font-semibold text-foreground underline"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "Create one" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
