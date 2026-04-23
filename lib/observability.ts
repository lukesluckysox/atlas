import * as Sentry from "@sentry/nextjs";

/**
 * Report an error to Sentry with optional context. Safe to call even when
 * Sentry is not initialized (no DSN) — the SDK no-ops internally.
 */
export function reportError(
  error: unknown,
  context?: Record<string, unknown>
): void {
  if (context && Object.keys(context).length > 0) {
    Sentry.withScope((scope) => {
      for (const [key, value] of Object.entries(context)) {
        scope.setExtra(key, value);
      }
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}
