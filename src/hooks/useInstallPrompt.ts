import { useEffect, useState, useCallback } from "react";

// Chrome doesn't define this type in lib.dom yet.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// Captures the browser's native "app install" event so we can trigger the
// real install flow (standalone window, home-screen icon, splash screen —
// same as claude.ai's own install button) from our own UI button, instead
// of relying on the user finding it buried in the browser menu, where it
// often only offers a plain bookmark-style "Add shortcut".
export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(
    () => typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)").matches
  );

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return outcome === "accepted";
  }, [deferredPrompt]);

  return {
    // Only true once Chrome has actually decided the app is installable
    // (valid manifest + service worker + correctly sized icons) AND it's
    // not already installed.
    canInstall: Boolean(deferredPrompt) && !installed,
    installed,
    promptInstall,
  };
}
