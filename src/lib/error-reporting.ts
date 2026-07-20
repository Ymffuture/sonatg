export function reportError(error: unknown, context: Record<string, unknown> = {}) {
  // Log errors to console in development
  if (typeof window === "undefined") {
    console.error("Server error:", error, context);
    return;
  }

  console.error("Client error:", error, context);

  // In production, you can integrate with error tracking services like:
  // - Sentry: sentry.captureException(error, { extra: context })
  // - LogRocket: logRocket.captureException(error)
  // - Custom API: fetch('/api/errors', { method: 'POST', body: JSON.stringify({ error, context }) })
}
