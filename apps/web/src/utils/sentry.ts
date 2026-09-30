import * as Sentry from '@sentry/react';

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

// No-op unless VITE_SENTRY_DSN is set — matches the VITE_TURNSTILE_SITE_KEY
// pattern (Turnstile.tsx): dev/local builds and any deploy without the key
// work exactly as before, just without error reporting.
export function initSentry() {
  if (!DSN) return;
  Sentry.init({
    dsn: DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
  });
}

export function captureError(error: unknown, extra?: Record<string, unknown>) {
  if (!DSN) return;
  Sentry.captureException(error, extra ? { extra } : undefined);
}
