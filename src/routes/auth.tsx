import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Mail, Lock, User, ArrowRight, MessageCircle,
  Sparkles, Shield, Zap, CheckCircle2,
} from "lucide-react";

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
        toast.success("Welcome to Sona");
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
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh relative flex items-center justify-center overflow-hidden bg-[#F0EBE3] dark:bg-[#1A1A1A] p-4">
      {/* Ambient background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full bg-[#E07A5F]/15 blur-[100px] animate-pulse" />
        <div className="absolute top-1/3 -right-32 h-[500px] w-[500px] rounded-full bg-[#F4A261]/15 blur-[100px] animate-pulse" style={{ animationDelay: '1.5s' }} />
        <div className="absolute -bottom-32 left-1/4 h-[500px] w-[500px] rounded-full bg-[#E07A5F]/10 blur-[100px] animate-pulse" style={{ animationDelay: '3s' }} />
      </div>

      {/* Floating glass bubbles — desktop only */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none hidden lg:block">
        <div className="absolute top-[18%] left-[8%] px-4 py-2.5 rounded-2xl rounded-bl-sm bg-white/50 dark:bg-white/5 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-xl animate-float">
          <div className="flex items-center gap-2 text-sm text-[#2D3436] dark:text-[#E8E8E8]">
            <MessageCircle className="h-4 w-4 text-[#E07A5F]" />
            <span>Hey! Welcome to Sona</span>
          </div>
        </div>
        <div className="absolute top-[30%] right-[10%] px-4 py-2.5 rounded-2xl rounded-br-sm bg-[#E07A5F]/20 backdrop-blur-xl border border-[#E07A5F]/20 shadow-xl animate-float" style={{ animationDelay: '1.2s' }}>
          <div className="flex items-center gap-2 text-sm text-[#2D3436] dark:text-[#E8E8E8]">
            <Sparkles className="h-4 w-4 text-[#E07A5F]" />
            <span>AI-powered chats</span>
          </div>
        </div>
        <div className="absolute bottom-[22%] left-[12%] px-4 py-2.5 rounded-2xl rounded-bl-sm bg-white/50 dark:bg-white/5 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-xl animate-float" style={{ animationDelay: '2.4s' }}>
          <div className="flex items-center gap-2 text-sm text-[#2D3436] dark:text-[#E8E8E8]">
            <Shield className="h-4 w-4 text-[#E07A5F]" />
            <span>End-to-end encrypted</span>
          </div>
        </div>
        <div className="absolute bottom-[35%] right-[8%] px-4 py-2.5 rounded-2xl rounded-br-sm bg-[#E07A5F]/20 backdrop-blur-xl border border-[#E07A5F]/20 shadow-xl animate-float" style={{ animationDelay: '3.6s' }}>
          <div className="flex items-center gap-2 text-sm text-[#2D3436] dark:text-[#E8E8E8]">
            <Zap className="h-4 w-4 text-[#E07A5F]" />
            <span>Talk gold</span>
          </div>
        </div>
      </div>

      {/* Main glass card */}
      <div className="relative w-full max-w-5xl rounded-[2rem] bg-white/60 dark:bg-[#242424]/60 backdrop-blur-2xl border border-white/50 dark:border-white/10 shadow-2xl overflow-hidden">
        <div className="grid lg:grid-cols-5 min-h-[640px]">
          
          {/* Left panel — Branding */}
          <div className="hidden lg:flex lg:col-span-2 flex-col justify-between p-10 bg-gradient-to-br from-[#E07A5F] to-[#C45D43] text-white relative overflow-hidden">
            {/* Decorative circles */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
              <div className="absolute -top-20 -left-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
              <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full border border-white/10" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full border border-white/10" />
            </div>

            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-8">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 shadow-lg">
                  <span className="text-2xl font-black">S</span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold leading-none tracking-tight">Sona</h1>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-white/80 font-medium">talk gold</p>
                </div>
              </div>

              <h2 className="text-4xl font-bold leading-[1.1] mb-4">
                Connect with<br />
                people who<br />
                matter.
              </h2>
              <p className="text-white/80 text-sm leading-relaxed max-w-[260px]">
                Join thousands of conversations. Chat smart, stay private, and express yourself freely with Sona.
              </p>
            </div>

            <div className="relative z-10 space-y-3">
              {[
                { icon: MessageCircle, label: "Smart Messaging", desc: "AI-powered conversations" },
                { icon: Shield, label: "Private & Secure", desc: "Encrypted by default" },
                { icon: Zap, label: "Lightning Fast", desc: "Real-time sync across devices" },
              ].map((feature) => (
                <div key={feature.label} className="flex items-center gap-3 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 p-3 transition hover:bg-white/15">
                  <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                    <feature.icon className="h-4 w-4" />
                  </div>
                  <div className="text-sm">
                    <div className="font-semibold">{feature.label}</div>
                    <div className="text-white/70 text-xs">{feature.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right panel — Form */}
          <div className="lg:col-span-3 flex flex-col justify-center p-6 sm:p-10 lg:p-12">
            <div className="lg:hidden flex items-center gap-3 mb-8">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[#E07A5F] to-[#C45D43] text-white shadow-md">
                <span className="text-lg font-black">S</span>
              </div>
              <div>
                <h1 className="text-lg font-bold leading-none text-[#2D3436] dark:text-[#E8E8E8]">Sona</h1>
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#8C8C8C]">talk gold</p>
              </div>
            </div>

            <div className="mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-[#2D3436] dark:text-[#E8E8E8]">
                {mode === "signin" ? "Welcome back" : "Create account"}
              </h2>
              <p className="mt-2 text-sm text-[#8C8C8C]">
                {mode === "signin" 
                  ? "Sign in to continue your conversations." 
                  : "Join the community and start talking gold."}
              </p>
            </div>

            <form onSubmit={submit} className="space-y-3">
              {mode === "signup" && (
                <div className="relative group">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8C8C8C] transition group-focus-within:text-[#E07A5F]" />
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Display name"
                    className="w-full rounded-xl bg-[#F5F0E8] dark:bg-[#2A2A2A] pl-10 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#E07A5F]/40 text-[#2D3436] dark:text-[#E8E8E8] placeholder:text-[#8C8C8C] border border-transparent transition shadow-sm"
                  />
                </div>
              )}
              <div className="relative group">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8C8C8C] transition group-focus-within:text-[#E07A5F]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  className="w-full rounded-xl bg-[#F5F0E8] dark:bg-[#2A2A2A] pl-10 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#E07A5F]/40 text-[#2D3436] dark:text-[#E8E8E8] placeholder:text-[#8C8C8C] border border-transparent transition shadow-sm"
                />
              </div>
              <div className="relative group">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8C8C8C] transition group-focus-within:text-[#E07A5F]" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full rounded-xl bg-[#F5F0E8] dark:bg-[#2A2A2A] pl-10 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#E07A5F]/40 text-[#2D3436] dark:text-[#E8E8E8] placeholder:text-[#8C8C8C] border border-transparent transition shadow-sm"
                />
              </div>

              <button
                disabled={loading}
                className="group w-full rounded-xl bg-gradient-to-r from-[#E07A5F] to-[#D4694F] py-3 text-sm font-semibold text-white shadow-lg shadow-[#E07A5F]/25 transition-all hover:shadow-xl hover:shadow-[#E07A5F]/30 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:hover:scale-100 flex items-center justify-center gap-2 mt-1"
              >
                {loading ? (
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    {mode === "signin" ? "Sign in" : "Get started"}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </form>

            <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-widest text-[#8C8C8C] font-medium">
              <div className="h-px flex-1 bg-[#E07A5F]/10" />
              or continue with
              <div className="h-px flex-1 bg-[#E07A5F]/10" />
            </div>

            <button
              onClick={google}
              disabled={loading}
              className="w-full rounded-xl border border-[#E07A5F]/10 bg-white dark:bg-[#2A2A2A] py-3 text-sm font-medium text-[#2D3436] dark:text-[#E8E8E8] transition hover:bg-[#F5F0E8] dark:hover:bg-[#3A3A3A] disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>

            <p className="mt-8 text-center text-sm text-[#8C8C8C]">
              {mode === "signin" ? "New to Sona?" : "Already have an account?"}{" "}
              <button
                className="font-semibold text-[#E07A5F] hover:text-[#C45D43] transition underline underline-offset-2"
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              >
                {mode === "signin" ? "Create one" : "Sign in"}
              </button>
            </p>

            {/* Trust badges */}
            <div className="mt-6 flex items-center justify-center gap-4 text-[10px] text-[#8C8C8C]">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-[#E07A5F]" /> Free forever
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-[#E07A5F]" /> No credit card
              </span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-16px) rotate(1deg); }
        }
        .animate-float {
          animation: float 5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
