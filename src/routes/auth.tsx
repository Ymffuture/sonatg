import { createFileRoute, useNavigate, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Alert, notification } from "antd";
import { LoadingOutlined } from "@ant-design/icons";
import {
  Mail, Lock, User, ArrowRight, MessageCircle,
  Sparkles, Shield, Zap, CheckCircle2, ChevronDown, Loader2,
} from "lucide-react";
import { isReservedSonaName, fallbackNameFromEmail } from "@/utils/utils";

type AuthMethod = "email" | "google" | "facebook" | "github" | "spotify";
const LAST_USED_KEY = "sona-last-auth-method";

function LastUsed() {
  return (
    <span className="ml-auto rounded-full bg-[#E07A5F]/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#E07A5F] ring-1 ring-inset ring-[#E07A5F]/20">
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

function SpotifyIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="#1ED760">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.521 17.34c-.216.36-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.081-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.66.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.48.12-1.021-.12-1.141-.6-.12-.48.12-1.02.6-1.14 4.32-1.32 9.719-.66 13.439 1.62.361.181.54.78.301 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.6.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.301.421-1.021.599-1.561.3z" />
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

  return (
    <div className={`leading-none min-w-0 rounded-xl bg-zinc-100 dark:bg-zinc-800 px-3.5 py-2 border border-zinc-200/60 dark:border-zinc-700/60 ${className}`}>
      <span className="text-[20px] font-bold tracking-tight text-zinc-900 dark:text-white">
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
  const [oauthLoading, setOauthLoading] = useState<"google" | "facebook" | "github" | "spotify" | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(LAST_USED_KEY);
    if (saved === "email" || saved === "google" || saved === "facebook" || saved === "github" || saved === "spotify") {
      setLastUsed(saved);
      if (saved === "github" || saved === "spotify") setShowMoreMethods(true);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get("authError");
    if (authError) {
      setErrorMsg(authError);
      params.delete("authError");
      const rest = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${rest ? `?${rest}` : ""}`);
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

        const chosenName = isReservedSonaName(name) ? fallbackNameFromEmail(email) : (name || email.split("@")[0]);
        if (isReservedSonaName(name)) {
          notification.info({
            message: "\"Sona\" is a reserved name",
            description: `We've set your display name to "${chosenName}" instead — you can change it later from Settings.`,
            placement: "top",
          });
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: chosenName },
          },
        });
        if (error) throw error;
        localStorage.setItem(LAST_USED_KEY, "email");

        const alreadyRegistered = data.user && data.user.identities && data.user.identities.length === 0;

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

  const oauth = async (provider: "google" | "facebook" | "github" | "spotify") => {
    setLoading(true);
    setOauthLoading(provider);
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
      setOauthLoading(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[#FFFDF9] p-4 text-zinc-900 transition-colors duration-300 dark:bg-[#0F0F11] dark:text-zinc-100">
      {/* Ambient background blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full bg-purple-100/40 blur-[120px] dark:bg-purple-900/10" />
        <div className="absolute top-1/3 -right-32 h-[500px] w-[500px] rounded-full bg-[#E07A5F]/10 blur-[120px]" />
        <div className="absolute -bottom-32 left-1/4 h-[500px] w-[500px] rounded-full bg-[#F4A261]/10 blur-[120px]" />
      </div>

      {/* Floating glass bubbles — desktop only */}
      <div className="pointer-events-none absolute inset-0 hidden overflow-hidden lg:block">
        <div className="absolute top-[18%] left-[8%] animate-float rounded-2xl rounded-bl-sm border border-zinc-200/60 bg-white/60 px-4 py-3 shadow-xl backdrop-blur-xl dark:border-zinc-800/60 dark:bg-zinc-900/60">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            <MessageCircle className="h-4 w-4 text-[#E07A5F]" />
            <span>Hey! Welcome to Sona</span>
          </div>
        </div>
        <div className="absolute top-[30%] right-[10%] animate-float rounded-2xl rounded-br-sm border border-[#E07A5F]/20 bg-[#E07A5F]/10 px-4 py-3 shadow-xl backdrop-blur-xl" style={{ animationDelay: '1.5s' }}>
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
            <Sparkles className="h-4 w-4 text-[#E07A5F]" />
            <span>AI-powered chats</span>
          </div>
        </div>
        <div className="absolute bottom-[22%] left-[12%] animate-float rounded-2xl rounded-bl-sm border border-zinc-200/60 bg-white/60 px-4 py-3 shadow-xl backdrop-blur-xl dark:border-zinc-800/60 dark:bg-zinc-900/60" style={{ animationDelay: '3s' }}>
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            <Shield className="h-4 w-4 text-[#E07A5F]" />
            <span>End-to-end encrypted</span>
          </div>
        </div>
        <div className="absolute bottom-[35%] right-[8%] animate-float rounded-2xl rounded-br-sm border border-[#E07A5F]/20 bg-[#E07A5F]/10 px-4 py-3 shadow-xl backdrop-blur-xl" style={{ animationDelay: '2.5s' }}>
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
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
        className="relative z-10 w-full max-w-5xl overflow-hidden rounded-3xl border border-zinc-200/60 bg-white/70 shadow-2xl backdrop-blur-2xl dark:border-zinc-800/60 dark:bg-zinc-900/70 dark:shadow-black/40"
      >
        <div className="flex min-h-[640px] flex-col lg:flex-row">
          
          {/* Left panel — Form */}
          <div className="flex flex-col justify-center p-6 sm:p-10 lg:w-1/2 lg:py-12 lg:px-16 xl:px-20">
            <div className="mb-8 flex items-center gap-3">
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
                <h2 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">
                  {mode === "signin" ? "Welcome back" : "Create account"}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                  {mode === "signin"
                    ? "Sign in to continue your conversations."
                    : "Join the community and start talking gold."}
                </p>
                {lastUsed === "email" && mode === "signin" && (
                  <p className="mt-3 inline-flex items-center rounded-full bg-[#E07A5F]/10 px-3 py-1 text-xs font-semibold text-[#E07A5F]">
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
                className="mb-6"
              >
                <Alert
                  message={errorMsg}
                  type="error"
                  showIcon
                  closable
                  onClose={() => setErrorMsg(null)}
                  className="rounded-xl border-red-500/20 bg-red-500/5 text-red-600 dark:bg-red-500/10 dark:text-red-400"
                />
              </motion.div>
            )}

            <form onSubmit={submit} className="space-y-4">
              {mode === "signup" && (
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-[#E07A5F]" />
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Display name"
                    className="w-full rounded-xl border border-zinc-200/60 bg-zinc-50/50 px-11 py-3.5 text-sm outline-none transition-all placeholder:text-zinc-400 focus:border-[#E07A5F]/40 focus:bg-white focus:ring-2 focus:ring-[#E07A5F]/10 dark:border-zinc-800/60 dark:bg-zinc-900/50 dark:text-zinc-100 dark:focus:border-[#E07A5F]/40 dark:focus:bg-zinc-900"
                  />
                </div>
              )}
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-[#E07A5F]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  className="w-full rounded-xl border border-zinc-200/60 bg-zinc-50/50 px-11 py-3.5 text-sm outline-none transition-all placeholder:text-zinc-400 focus:border-[#E07A5F]/40 focus:bg-white focus:ring-2 focus:ring-[#E07A5F]/10 dark:border-zinc-800/60 dark:bg-zinc-900/50 dark:text-zinc-100 dark:focus:border-[#E07A5F]/40 dark:focus:bg-zinc-900"
                />
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-[#E07A5F]" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full rounded-xl border border-zinc-200/60 bg-zinc-50/50 px-11 py-3.5 text-sm outline-none transition-all placeholder:text-zinc-400 focus:border-[#E07A5F]/40 focus:bg-white focus:ring-2 focus:ring-[#E07A5F]/10 dark:border-zinc-800/60 dark:bg-zinc-900/50 dark:text-zinc-100 dark:focus:border-[#E07A5F]/40 dark:focus:bg-zinc-900"
                />
              </div>

              {mode === "signup" && (
                <div className="flex items-start gap-3 pt-1">
                  <input
                    id="acceptTerms"
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    className="mt-1 h-4 w-4 cursor-pointer rounded border-zinc-300 text-[#E07A5F] focus:ring-[#E07A5F]/20 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                  <label htmlFor="acceptTerms" className="cursor-pointer text-sm text-zinc-500 dark:text-zinc-400">
                    I agree to the <Link to="/terms" className="font-semibold text-[#E07A5F] hover:underline">Terms of Service</Link> and <Link to="/privacy" className="font-semibold text-[#E07A5F] hover:underline">Privacy Policy</Link>.
                  </label>
                </div>
              )}

              <button
                disabled={loading}
                className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-zinc-900 py-3.5 text-sm font-bold text-white shadow-lg shadow-zinc-900/20 transition-all hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 dark:bg-white dark:text-zinc-900 dark:shadow-white/20"
              >
                {loading ? (
                  <LoadingOutlined style={{ fontSize: 16 }} />
                ) : (
                  <>
                    {mode === "signin" ? "Sign in" : "Get started"}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </form>

            {mode === "signin" && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => navigate({ to: "/forgot-password" })}
                  className="text-sm font-medium text-zinc-500 transition-colors hover:text-[#E07A5F] dark:text-zinc-400"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <div className="my-8 flex items-center gap-4 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
              <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
              OR
              <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            </div>

            {/* ─── Smart Social Login Buttons ─── */}
            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => oauth("google")}
                disabled={loading || !!oauthLoading}
                className="group relative flex w-full items-center gap-3 overflow-hidden rounded-xl border border-zinc-200/60 bg-white py-3.5 px-4 text-sm font-semibold text-zinc-700 transition-all hover:border-zinc-300 hover:bg-zinc-50 hover:shadow-md active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800/60 dark:bg-zinc-900/50 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/50"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 transition-colors group-hover:bg-white dark:bg-zinc-800 dark:group-hover:bg-zinc-700">
                  {oauthLoading === "google" ? <Loader2 className="h-5 w-5 animate-spin text-[#4285F4]" /> : <GoogleIcon className="h-5 w-5" />}
                </div>
                <span className="flex-1 text-left">{oauthLoading === "google" ? "Redirecting to Google…" : "Continue with Google"}</span>
                {lastUsed === "google" && <LastUsed />}
              </button>

              <button
                onClick={() => oauth("facebook")}
                disabled={loading || !!oauthLoading}
                className="group relative flex w-full items-center gap-3 overflow-hidden rounded-xl border border-zinc-200/60 bg-white py-3.5 px-4 text-sm font-semibold text-zinc-700 transition-all hover:border-zinc-300 hover:bg-zinc-50 hover:shadow-md active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800/60 dark:bg-zinc-900/50 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/50"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 transition-colors group-hover:bg-white dark:bg-zinc-800 dark:group-hover:bg-zinc-700">
                  {oauthLoading === "facebook" ? <Loader2 className="h-5 w-5 animate-spin text-[#1877F2]" /> : <FacebookIcon className="h-5 w-5 text-[#1877F2]" />}
                </div>
                <span className="flex-1 text-left">{oauthLoading === "facebook" ? "Redirecting to Facebook…" : "Continue with Facebook"}</span>
                {lastUsed === "facebook" && <LastUsed />}
              </button>
            </div>

            {/* ─── More login options (collapsed by default) ─── */}
            <button
              type="button"
              onClick={() => setShowMoreMethods((v) => !v)}
              className="mt-4 flex w-full items-center justify-center gap-1.5 py-2 text-xs font-semibold text-zinc-400 transition-colors hover:text-[#E07A5F]"
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
                    disabled={loading || !!oauthLoading}
                    className="group relative mt-2 flex w-full items-center gap-3 overflow-hidden rounded-xl border border-zinc-200/60 bg-white py-3.5 px-4 text-sm font-semibold text-zinc-700 transition-all hover:border-zinc-300 hover:bg-zinc-50 hover:shadow-md active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800/60 dark:bg-zinc-900/50 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/50"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 transition-colors group-hover:bg-white dark:bg-zinc-800 dark:group-hover:bg-zinc-700">
                      {oauthLoading === "github" ? <Loader2 className="h-5 w-5 animate-spin text-zinc-900 dark:text-white" /> : <GitHubIcon className="h-5 w-5 text-zinc-900 dark:text-white" />}
                    </div>
                    <span className="flex-1 text-left">{oauthLoading === "github" ? "Redirecting to GitHub…" : "Continue with GitHub"}</span>
                    {lastUsed === "github" && <LastUsed />}
                  </button>

                  <button
                    onClick={() => oauth("spotify")}
                    disabled={loading || !!oauthLoading}
                    className="group relative mt-2 flex w-full items-center gap-3 overflow-hidden rounded-xl border border-zinc-200/60 bg-white py-3.5 px-4 text-sm font-semibold text-zinc-700 transition-all hover:border-zinc-300 hover:bg-zinc-50 hover:shadow-md active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800/60 dark:bg-zinc-900/50 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/50"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 transition-colors group-hover:bg-white dark:bg-zinc-800 dark:group-hover:bg-zinc-700">
                      {oauthLoading === "spotify" ? <Loader2 className="h-5 w-5 animate-spin text-[#1ED760]" /> : <SpotifyIcon className="h-5 w-5" />}
                    </div>
                    <span className="flex-1 text-left">{oauthLoading === "spotify" ? "Redirecting to Spotify…" : "Continue with Spotify"}</span>
                    {lastUsed === "spotify" && <LastUsed />}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <p className="mt-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
              {mode === "signin" ? "New to Sona?" : "Already have an account?"} {" "}
              <button
                className="font-bold text-[#E07A5F] transition-colors hover:text-[#C45D43]"
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              >
                {mode === "signin" ? "Create one" : "Sign in"}
              </button>
            </p>

            {/* Trust badges */}
            <div className="mt-8 flex items-center justify-center gap-6 text-[11px] font-semibold text-zinc-400">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#E07A5F]" /> Free forever
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#E07A5F]" /> No credit card
              </span>
            </div>
          </div>

          {/* Right panel — Branding */}
          <div className="relative flex flex-col justify-center overflow-hidden bg-gradient-to-br from-[#E07A5F] to-[#C45D43] p-8 text-white lg:w-1/2 lg:p-12">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute -top-20 -left-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
              <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full border border-white/10" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full border border-white/10" />
            </div>

            <div className="relative z-10 mb-10 text-center lg:text-left">
              <h2 className="mb-4 text-4xl font-black leading-[1.1] tracking-tight lg:text-5xl">
                Connect with<br className="hidden lg:block" /> people who<br className="hidden lg:block" /> matter.
              </h2>
              <p className="mx-auto max-w-[320px] text-sm leading-relaxed text-white/80 lg:mx-0">
                Join thousands of conversations. Chat smart, stay private, and express yourself freely with Sona.
              </p>
            </div>

            <div className="relative z-10 flex flex-col gap-3">
              {[
                { icon: MessageCircle, label: "Smart Messaging", desc: "AI-powered conversations" },
                { icon: Shield, label: "Private & Secure", desc: "Encrypted by default" },
                { icon: Zap, label: "Lightning Fast", desc: "Real-time sync across devices" },
              ].map((feature) => (
                <div key={feature.label} className="flex items-center gap-4 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-md transition-all hover:bg-white/15">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <div className="text-sm">
                    <div className="font-bold">{feature.label}</div>
                    <div className="text-xs text-white/70">{feature.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Public content footer */}
      <div className="relative z-10 mt-10 w-full max-w-3xl text-center">
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          Sona is a private messaging app with real-time chat, voice and video calls, and an
          AI assistant you can bring into any conversation with an @sona mention. Messages are
          protected by database-level access control by default, and Sona Pro adds fully
          encrypted, hidden chats for conversations where privacy matters most.
        </p>
        <nav className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs font-semibold text-zinc-400">
          <Link to="/blog" className="transition-colors hover:text-[#E07A5F]">Blog</Link>
          <Link to="/help" className="transition-colors hover:text-[#E07A5F]">Help Center</Link>
          <Link to="/faq" className="transition-colors hover:text-[#E07A5F]">FAQ</Link>
          <Link to="/learn" className="transition-colors hover:text-[#E07A5F]">How Sona works</Link>
          <Link to="/privacy" className="transition-colors hover:text-[#E07A5F]">Privacy</Link>
          <Link to="/terms" className="transition-colors hover:text-[#E07A5F]">Terms</Link>
        </nav>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(1deg); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
