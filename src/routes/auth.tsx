import { createFileRoute, useNavigate, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Alert, notification } from "antd";
import { LoadingOutlined } from "@ant-design/icons";
import {
  Mail, Lock, User, ArrowRight, MessageCircle,
  Sparkles, Shield, Zap, CheckCircle2, ChevronDown,
} from "lucide-react";

type AuthMethod = "email" | "google" | "facebook" | "github";
const LAST_USED_KEY = "sona-last-auth-method";

function LastUsed() {
  return (
    <span className="ml-auto rounded-full bg-[#E07A5F]/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[#E07A5F]">
      Last used
    </span>
  );
}

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

/* ─── Brand Icons (inline SVGs) ─── */
function GoogleIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function FacebookIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function GitHubIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.29 1.19-3.09-.12-.29-.51-1.47.11-3.06 0 0 .97-.31 3.18 1.18a11.05 11.05 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.24 2.77.12 3.06.74.8 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.14 0 1.54-.01 2.79-.01 3.17 0 .31.21.67.8.56A10.51 10.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}

/* ─── Logo Component with PNG fallback ─── */
function BrandLogo({ className = "" }: { className?: string }) {
  const [imgError, setImgError] = useState(false);

  if (!imgError) {
    return (
      <img
        src="/s-logo.png"
        alt="Sona"
        className={`object-contain ${className}`}
        onError={() => setImgError(true)}
      />
    );
  }

  // Fallback text logo if PNG fails to load
  return (
    <div className={`leading-none min-w-0 rounded-xl bg-gradient-to-br from-[#E07A5F]/10 to-[#F4A261]/5 px-3.5 py-2 dark:from-[#E07A5F]/20 dark:to-transparent border border-[#E07A5F]/10 ${className}`}>
      <span className="text-[20px] font-bold tracking-tight text-[#2D3436] dark:text-white">
        Sona<span className="font-black text-[#E07A5F]">TG</span>
      </span>
    </div>
  );
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [lastUsed, setLastUsed] = useState<AuthMethod | null>(null);
  const [showMoreMethods, setShowMoreMethods] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(LAST_USED_KEY);
    if (saved === "email" || saved === "google" || saved === "facebook" || saved === "github") {
      setLastUsed(saved);
      if (saved === "github") setShowMoreMethods(true);
    }
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      if (mode === "signup") {
        if (!acceptTerms) {
          setErrorMsg("You must accept the Terms of Service and Privacy Policy to create an account.");
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        localStorage.setItem(LAST_USED_KEY, "email");

        const alreadyRegistered =
          data.user && data.user.identities && data.user.identities.length === 0;

        if (alreadyRegistered) {
          setErrorMsg("An account with this email already exists. Try signing in instead.");
          notification.error({
            message: "Account already exists",
            description: "Try signing in instead, or use 'Forgot password?' if you don't remember it.",
            placement: "topRight",
          });
        } else if (!data.session) {
          notification.success({
            message: "Verification email sent",
            description: `We sent a confirmation link to ${email}. Check your inbox (and spam folder) to finish creating your account.`,
            placement: "topRight",
            duration: 6,
          });
          setErrorMsg(null);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        localStorage.setItem(LAST_USED_KEY, "email");
      }
    } catch (err) {
      const msg = (err as Error).message;
      setErrorMsg(msg);
      notification.error({
        message: mode === "signup" ? "Couldn't create account" : "Couldn't sign in",
        description: msg,
        placement: "topRight",
      });
    } finally {
      setLoading(false);
    }
  };

  const oauth = async (provider: "google" | "facebook" | "github") => {
    setLoading(true);
    setErrorMsg(null);
    try {
      localStorage.setItem(LAST_USED_KEY, provider);
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh relative flex flex-col items-center justify-center overflow-hidden bg-[#F0EBE3] dark:bg-[#1A1A1A] p-4">
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
        <div className="absolute top-[30%] right-[10%] px-4 py-2.5 rounded-2xl rounded-br-sm bg-[#E07A5F]/20 backdrop-blur-xl border border-[#E07A5F]/20 shadow-xl animate-float" style={{ animationDelay: '1.5s' }}>
          <div className="flex items-center gap-2 text-sm text-[#2D3436] dark:text-[#E8E8E8]">
            <Sparkles className="h-4 w-4 text-[#E07A5F]" />
            <span>AI-powered chats</span>
          </div>
        </div>
        <div className="absolute bottom-[22%] left-[12%] px-4 py-2.5 rounded-2xl rounded-bl-sm bg-white/50 dark:bg-white/5 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-xl animate-float" style={{ animationDelay: '3s' }}>
          <div className="flex items-center gap-2 text-sm text-[#2D3436] dark:text-[#E8E8E8]">
            <Shield className="h-4 w-4 text-[#E07A5F]" />
            <span>End-to-end encrypted</span>
          </div>
        </div>
        <div className="absolute bottom-[35%] right-[8%] px-4 py-2.5 rounded-2xl rounded-br-sm bg-[#E07A5F]/20 backdrop-blur-xl border border-[#E07A5F]/20 shadow-xl animate-float" style={{ animationDelay: '2.5s' }}>
          <div className="flex items-center gap-2 text-sm text-[#2D3436] dark:text-[#E8E8E8]">
            <Zap className="h-4 w-4 text-[#E07A5F]" />
            <span>Talk gold</span>
          </div>
        </div>
      </div>

      {/* Main glass card */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-5xl rounded-[2rem] bg-white/60 dark:bg-[#242424]/60 backdrop-blur-2xl border border-white/50 dark:border-white/10 shadow-2xl overflow-hidden">
        <div className="flex flex-col min-h-[640px]">
          
          {/* Top panel — Form */}
          <div className="flex flex-col justify-center p-6 sm:p-10 lg:py-12 lg:px-24 xl:px-32">
            <div className="flex items-center gap-3 mb-8">
              <BrandLogo className="h-10 w-auto" />
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="mb-8"
              >
                <h2 className="text-2xl sm:text-3xl font-bold text-[#2D3436] dark:text-[#E8E8E8]">
                  {mode === "signin" ? "Welcome back" : "Create account"}
                </h2>
                <p className="mt-2 text-sm text-[#8C8C8C]">
                  {mode === "signin"
                    ? "Sign in to continue your conversations."
                    : "Join the community and start talking gold."}
                </p>
                {lastUsed === "email" && mode === "signin" && (
                  <p className="mt-3 inline-flex items-center rounded-full bg-[#E07A5F]/10 px-3 py-1 text-xs text-[#E07A5F]">
                    You last signed in with your email
                  </p>
                )}
              </motion.div>
            </AnimatePresence>

            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-4"
              >
                <Alert
                  message={errorMsg}
                  type="error"
                  showIcon
                  closable
                  onClose={() => setErrorMsg(null)}
                  className="rounded-xl"
                  style={{
                    backgroundColor: 'rgba(224, 122, 95, 0.08)',
                    borderColor: 'rgba(224, 122, 95, 0.25)',
                  }}
                />
              </motion.div>
            )}

            <form onSubmit={submit} className="space-y-3">
              {mode === "signup" && (
                <div className="relative group">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8C8C8C] transition group-focus-within:text-[#E07A5F]" />
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Display name"
                    className="w-full rounded-xl bg-[#F5F0E8] dark:bg-[#2A2A2A] pl-10 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#E07A5F]/40 text-[#2D3436] dark:text-[#E8E8E8] placeholder:text-[#A0A0A0] transition-all"
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
                  className="w-full rounded-xl bg-[#F5F0E8] dark:bg-[#2A2A2A] pl-10 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#E07A5F]/40 text-[#2D3436] dark:text-[#E8E8E8] placeholder:text-[#A0A0A0] transition-all"
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
                  className="w-full rounded-xl bg-[#F5F0E8] dark:bg-[#2A2A2A] pl-10 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#E07A5F]/40 text-[#2D3436] dark:text-[#E8E8E8] placeholder:text-[#A0A0A0] transition-all"
                />
              </div>

              {mode === "signup" && (
                <div className="flex items-start gap-3 mt-2">
                  <input
                    id="acceptTerms"
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    className="mt-1 h-4 w-4 accent-[#E07A5F] rounded cursor-pointer"
                  />
                  <label htmlFor="acceptTerms" className="text-sm text-[#6B6B6B] cursor-pointer">
                    I agree to the <Link to="/terms" className="text-[#E07A5F] hover:underline">Terms of Service</Link> and <Link to="/privacy" className="text-[#E07A5F] hover:underline">Privacy Policy</Link>.
                  </label>
                </div>
              )}

              <button
                disabled={loading}
                className="group w-full rounded-xl bg-gradient-to-r from-[#E07A5F] to-[#D4694F] py-3 text-sm font-semibold text-white shadow-lg shadow-[#E07A5F]/25 transition-all hover:shadow-xl hover:shadow-[#E07A5F]/30 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <LoadingOutlined style={{ fontSize: 16, color: '#fff' }} />
                ) : (
                  <>
                    {mode === "signin" ? "Sign in" : "Get started"}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </form>

            {mode === "signin" && (
              <div className="mt-3 text-sm text-center">
                <button
                  onClick={() => navigate({ to: "/forgot-password" })}
                  className="text-[#E07A5F] hover:text-[#C45D43] dashed dashed-offset-2 transition"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-widest text-[#8C8C8C] font-medium">
              <div className="h-px flex-1 bg-[#E07A5F]/10" />
              OR
              <div className="h-px flex-1 bg-[#E07A5F]/10" />
            </div>

            {/* ─── Smart Social Login Buttons ─── */}
            <div className="grid grid-cols-1 gap-3">
              {/* Google */}
              <button
                onClick={() => oauth("google")}
                disabled={loading}
                className="group relative w-full overflow-hidden rounded-xl border border-[#E07A5F]/10 bg-white dark:bg-[#2A2A2A] py-3 px-4 text-sm font-medium text-[#2D3436] dark:text-[#E8E8E8] transition-all duration-300 hover:bg-[#F5F0E8] dark:hover:bg-[#333333] hover:border-[#4285F4]/30 hover:shadow-md hover:shadow-[#4285F4]/10 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-3"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F5F0E8] dark:bg-[#1A1A1A] transition-colors group-hover:bg-white dark:group-hover:bg-[#2A2A2A]">
                  <GoogleIcon className="h-5 w-5" />
                </div>
                <span className="flex-1 text-left">Continue with Google</span>
                {lastUsed === "google" && <LastUsed />}
                <div className="absolute bottom-0 left-0 h-0.5 w-0 bg-[#4285F4] transition-all duration-300 group-hover:w-full" />
              </button>

              {/* Facebook */}
              <button
                onClick={() => oauth("facebook")}
                disabled={loading}
                className="group relative w-full overflow-hidden rounded-xl border border-[#E07A5F]/10 bg-white dark:bg-[#2A2A2A] py-3 px-4 text-sm font-medium text-[#2D3436] dark:text-[#E8E8E8] transition-all duration-300 hover:bg-[#F5F0E8] dark:hover:bg-[#333333] hover:border-[#1877F2]/30 hover:shadow-md hover:shadow-[#1877F2]/10 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-3"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F5F0E8] dark:bg-[#1A1A1A] transition-colors group-hover:bg-white dark:group-hover:bg-[#2A2A2A]">
                  <FacebookIcon className="h-5 w-5 text-[#1877F2]" />
                </div>
                <span className="flex-1 text-left">Continue with Facebook</span>
                {lastUsed === "facebook" && <LastUsed />}
                <div className="absolute bottom-0 left-0 h-0.5 w-0 bg-[#1877F2] transition-all duration-300 group-hover:w-full" />
              </button>
            </div>

            {/* ─── More login options (collapsed by default) ─── */}
            <button
              type="button"
              onClick={() => setShowMoreMethods((v) => !v)}
              className="mt-3 flex w-full items-center justify-center gap-1.5 py-2 text-xs font-medium text-[#8C8C8C] transition hover:text-[#E07A5F]"
            >
              {showMoreMethods ? "Fewer options" : "More login options"}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${showMoreMethods ? "rotate-180" : ""}`} />
            </button>

            <AnimatePresence initial={false}>
              {showMoreMethods && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <button
                    onClick={() => oauth("github")}
                    disabled={loading}
                    className="group relative mt-1 w-full overflow-hidden rounded-xl border border-[#E07A5F]/10 bg-white dark:bg-[#2A2A2A] py-3 px-4 text-sm font-medium text-[#2D3436] dark:text-[#E8E8E8] transition-all duration-300 hover:bg-[#F5F0E8] dark:hover:bg-[#333333] hover:border-black/30 hover:shadow-md active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-3"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F5F0E8] dark:bg-[#1A1A1A] transition-colors group-hover:bg-white dark:group-hover:bg-[#2A2A2A]">
                      <GitHubIcon className="h-5 w-5 text-[#181717] dark:text-white" />
                    </div>
                    <span className="flex-1 text-left">Continue with GitHub</span>
                    {lastUsed === "github" && <LastUsed />}
                    <div className="absolute bottom-0 left-0 h-0.5 w-0 bg-[#181717] dark:bg-white transition-all duration-300 group-hover:w-full" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <p className="mt-8 text-center text-sm text-[#8C8C8C]">
              {mode === "signin" ? "New to Sona?" : "Already have an account?"} {" "}
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

          {/* Bottom panel — Branding */}
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8 p-8 lg:p-10 bg-gradient-to-br from-[#E07A5F] to-[#C45D43] text-white relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
              <div className="absolute -top-20 -left-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
              <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full border border-white/10" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full border border-white/10" />
            </div>

            <div className="relative z-10 text-center lg:text-left">
              <h2 className="text-3xl lg:text-4xl font-bold leading-[1.1] mb-3">
                Connect with<br className="hidden lg:block" /> people who<br className="hidden lg:block" /> matter.
              </h2>
              <p className="text-white/80 text-sm leading-relaxed max-w-[320px] mx-auto lg:mx-0">
                Join thousands of conversations. Chat smart, stay private, and express yourself freely with Sona.
              </p>
            </div>

            <div className="relative z-10 flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              {[
                { icon: MessageCircle, label: "Smart Messaging", desc: "AI-powered conversations" },
                { icon: Shield, label: "Private & Secure", desc: "Encrypted by default" },
                { icon: Zap, label: "Lightning Fast", desc: "Real-time sync across devices" },
              ].map((feature) => (
                <div key={feature.label} className="flex-1 min-w-[180px] flex items-center gap-3 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 p-3 transition hover:bg-white/15">
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
        </div>
      </motion.div>

      {/* Public content footer */}
      <div className="relative z-10 mt-10 w-full max-w-3xl text-center">
        <p className="mx-auto max-w-xl text-sm leading-6 text-[#5b5b5b] dark:text-[#a8a8a8]">
          Sona is a private messaging app with real-time chat, voice and video calls, and an
          AI assistant you can bring into any conversation with an @sona mention. Messages are
          protected by database-level access control by default, and Sona Pro adds fully
          encrypted, hidden chats for conversations where privacy matters most.
        </p>
        <nav className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-medium text-[#8C8C8C]">
          <Link to="/blog" className="hover:text-[#E07A5F] hover:underline">Blog</Link>
          <Link to="/help" className="hover:text-[#E07A5F] hover:underline">Help Center</Link>
          <Link to="/faq" className="hover:text-[#E07A5F] hover:underline">FAQ</Link>
          <Link to="/learn" className="hover:text-[#E07A5F] hover:underline">How Sona works</Link>
          <Link to="/privacy" className="hover:text-[#E07A5F] hover:underline">Privacy</Link>
          <Link to="/terms" className="hover:text-[#E07A5F] hover:underline">Terms</Link>
        </nav>
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
