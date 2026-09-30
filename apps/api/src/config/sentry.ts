import * as Sentry from '@sentry/node';
import { env } from './env.js';

// Runs as a side effect the moment this module is imported — must be the
// FIRST import in server.ts (ESM import order, not a called-later function)
// so Sentry's instrumentation is active before app.js and its routes load.
// No-op unless SENTRY_DSN is set (dev-safe, matches the Turnstile/Cloudinary
// pattern — nothing breaks locally or in a fresh deploy without the key).
if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
}

export function captureError(err: unknown) {
  if (!env.SENTRY_DSN) return;
  Sentry.captureException(err);
}
