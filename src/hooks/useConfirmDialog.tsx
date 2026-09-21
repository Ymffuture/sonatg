import { createContext, useContext, useState, useCallback, useRef } from "react";
import { AlertDialog, Button } from "@heroui/react";

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
};

type ConfirmState = ConfirmOptions & { open: boolean };

const ConfirmContext = createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(null);

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

      <AlertDialog
        isOpen={state.open}
        onOpenChange={(open) => {
          if (!open) close(false);
        }}
      >
        <AlertDialog.Backdrop>
          <AlertDialog.Container>
            <AlertDialog.Dialog className="sm:max-w-[400px]">
              <AlertDialog.CloseTrigger />
              <AlertDialog.Header>
                <AlertDialog.Icon status={state.danger ? "danger" : "default"} />
                <AlertDialog.Heading>{state.title}</AlertDialog.Heading>
              </AlertDialog.Header>
              {state.description && (
                <AlertDialog.Body>
                  <p>{state.description}</p>
                </AlertDialog.Body>
              )}
              <AlertDialog.Footer>
                <Button variant="tertiary" onPress={() => close(false)}>
                  {state.cancelText ?? "Cancel"}
                </Button>
                <Button
                  variant={state.danger ? "danger" : "primary"}
                  onPress={() => close(true)}
                >
                  {state.confirmText ?? "Confirm"}
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within a ConfirmProvider");
  return ctx;
}
