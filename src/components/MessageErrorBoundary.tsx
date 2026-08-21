import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { reportError } from "@/lib/error-reporting";

interface Props {
  children: ReactNode;
  /** Shown in the fallback + sent to error reporting, to help pin down which message broke. */
  messageId?: string;
}

interface State {
  hasError: boolean;
}

/**
 * Wraps a single message bubble so a render-time crash in one message
 * (bad markdown, malformed table, unexpected payload shape, etc.) shows a
 * small inline fallback instead of bubbling up to the router's root
 * errorComponent and taking down the entire chat view. Without this, one
 * malformed message can make the whole app unusable until reloaded — see
 * the React error #31 table-rendering crash this was added after.
 *
 * Must be a class component: componentDidCatch/getDerivedStateFromError
 * have no hook equivalent yet.
 */
export class MessageErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[MessageErrorBoundary] failed to render message", this.props.messageId, error, info);
    reportError(error, { context: "message-bubble", messageId: this.props.messageId });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="my-1 flex max-w-[75%] items-center gap-2 rounded-2xl border border-[#E07A5F]/30 bg-[#E07A5F]/10 px-3 py-2 text-xs text-[#8C8C8C]">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[#E07A5F]" />
          <span>This message couldn't be displayed.</span>
        </div>
      );
    }
    return this.props.children;
  }
}
