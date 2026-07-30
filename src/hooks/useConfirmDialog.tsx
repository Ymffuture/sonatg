import { createContext, useContext, useState, useCallback, useRef } from "react";
import { AlertTriangle } from "lucide-react";

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
};

type ConfirmState = ConfirmOptions & { open: boolean };

const ConfirmContext = createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(null);

// Replaces window.confirm() with an in-app, on-brand dialog. Native
// browser confirm() dialogs look completely out of place next to the
// milky-glass UI everywhere else, can't be styled, and on some mobile
// browsers/PWA install modes don't even render reliably at all.
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmState>({ open: false, title: "" });
  const resolveRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setState({ ...opts, open: true });
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const close = (result: boolean) => {
    setState((s) => ({ ...s, open: false }));
    resolveRef.current?.(result);
    resolveRef.current = null;
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state.open && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => close(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-white/40 dark:border-white/10 bg-white/80 dark:bg-[#242424]/85 backdrop-blur-xl p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-start gap-3">
              {state.danger && (
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-500/10">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
              )}
              <div className="min-w-0">
                <h3 className="font-semibold text-[#2D3436] dark:text-[#E8E8E8]">{state.title}</h3>
                {state.description && (
                  <p className="mt-1 text-sm text-[#8C8C8C]">{state.description}</p>
                )}
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => close(false)}
                className="rounded-full px-4 py-2 text-sm font-medium text-[#2D3436] dark:text-[#E8E8E8] hover:bg-black/5 dark:hover:bg-white/10 transition"
              >
                {state.cancelText ?? "Cancel"}
              </button>
              <button
                onClick={() => close(true)}
                className={`rounded-full px-4 py-2 text-sm font-semibold text-white transition ${
                  state.danger ? "bg-red-500 hover:bg-red-600" : "bg-[#E07A5F] hover:opacity-90"
                }`}
              >
                {state.confirmText ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

// Returns an async confirm(...) function: `if (!await confirm({ title })) return;`
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within a ConfirmProvider");
  return ctx;
}
