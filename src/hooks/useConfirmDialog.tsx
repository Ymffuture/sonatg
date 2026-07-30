import { createContext, useContext, useState, useCallback, useRef } from "react";
import { AlertTriangle, Shield, MessageSquare, Layers, X } from "lucide-react";

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
};

type ConfirmState = ConfirmOptions & { open: boolean };

const ConfirmContext = createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(null);

/* ─── Ambient background orbs for the overlay ─── */
function AmbientOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div
        className="absolute top-[20%] left-[30%] w-64 h-64 rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, #E07A5F 0%, transparent 70%)" }}
      />
      <div
        className="absolute bottom-[20%] right-[25%] w-48 h-48 rounded-full opacity-15 blur-3xl"
        style={{ background: "radial-gradient(circle, #4FA6E0 0%, transparent 70%)" }}
      />
      <div
        className="absolute top-[50%] left-[55%] w-32 h-32 rounded-full opacity-10 blur-2xl"
        style={{ background: "radial-gradient(circle, #F4A261 0%, transparent 70%)" }}
      />
    </div>
  );
}

/* ─── Subtle background icon pattern ─── */
function IconPattern() {
  return (
    <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
      <Shield className="absolute top-[15%] left-[10%] text-white" size={24} strokeWidth={1} />
      <MessageSquare className="absolute top-[40%] right-[15%] text-white" size={20} strokeWidth={1} />
      <Layers className="absolute bottom-[30%] left-[20%] text-white" size={28} strokeWidth={1} />
      <AlertTriangle className="absolute top-[60%] left-[50%] text-white" size={18} strokeWidth={1} />
    </div>
  );
}

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
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          style={{
            background: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
          }}
          onClick={() => close(false)}
        >
          <AmbientOrbs />
          <IconPattern />

          {/* Dialog wrapper with spring animation */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm animate-in fade-in zoom-in-95 duration-200"
            style={{
              animationTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
          >
            {/* Gradient border glow */}
            <div
              className="absolute -inset-[1px] rounded-2xl opacity-60 pointer-events-none"
              style={{
                background: state.danger
                  ? "linear-gradient(135deg, rgba(239,68,68,0.4) 0%, rgba(239,68,68,0.05) 50%, rgba(239,68,68,0.15) 100%)"
                  : "linear-gradient(135deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.05) 50%, rgba(224,122,95,0.2) 100%)",
              }}
            />

            {/* Main glass card */}
            <div
              className="relative rounded-2xl border border-white/20 dark:border-white/10 p-6 overflow-hidden"
              style={{
                background: "rgba(255, 255, 255, 0.08)",
                backdropFilter: "blur(40px) saturate(180%)",
                WebkitBackdropFilter: "blur(40px) saturate(180%)",
                boxShadow:
                  "0 25px 50px -12px rgba(0,0,0,0.5), inset 0 1px 0 0 rgba(255,255,255,0.15)",
              }}
            >
              {/* Top sheen */}
              <div
                className="absolute inset-0 rounded-2xl opacity-30 pointer-events-none"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,0.12) 0%, transparent 40%)",
                }}
              />

              {/* Subtle noise texture */}
              <div
                className="absolute inset-0 rounded-2xl opacity-[0.02] pointer-events-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                }}
              />

              {/* Content */}
              <div className="relative z-10">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-xl transition-colors duration-300"
                    style={{
                      background: state.danger
                        ? "rgba(239, 68, 68, 0.12)"
                        : "rgba(224, 122, 95, 0.12)",
                      border: state.danger
                        ? "1px solid rgba(239, 68, 68, 0.2)"
                        : "1px solid rgba(224, 122, 95, 0.2)",
                    }}
                  >
                    {state.danger ? (
                      <AlertTriangle
                        className="h-5 w-5 text-red-400"
                        strokeWidth={2}
                      />
                    ) : (
                      <Shield
                        className="h-5 w-5 text-[#F4A261]"
                        strokeWidth={2}
                      />
                    )}
                  </div>

                  <div className="min-w-0 flex-1 pt-0.5">
                    <h3 className="text-base font-semibold text-[#2D3436] dark:text-[#E8E8E8] tracking-tight">
                      {state.title}
                    </h3>
                    {state.description && (
                      <p className="mt-1.5 text-sm text-[#8C8C8C] leading-relaxed">
                        {state.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Buttons */}
                <div className="mt-6 flex justify-end gap-2.5">
                  <button
                    onClick={() => close(false)}
                    className="px-4 py-2 rounded-full text-sm font-medium text-[#2D3436]/70 dark:text-[#E8E8E8]/70 hover:text-[#2D3436] dark:hover:text-[#E8E8E8] hover:bg-white/10 dark:hover:bg-white/10 transition-all duration-200 border border-transparent hover:border-white/10"
                  >
                    {state.cancelText ?? "Cancel"}
                  </button>
                  <button
                    onClick={() => close(true)}
                    className="px-5 py-2 rounded-full text-sm font-semibold text-white transition-all duration-200 hover:scale-105 active:scale-95"
                    style={{
                      background: state.danger
                        ? "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)"
                        : "linear-gradient(135deg, #E07A5F 0%, #D97757 100%)",
                      boxShadow: state.danger
                        ? "0 4px 20px rgba(239, 68, 68, 0.35)"
                        : "0 4px 20px rgba(224, 122, 95, 0.35)",
                    }}
                  >
                    {state.confirmText ?? "Confirm"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within a ConfirmProvider");
  return ctx;
}
