import { env } from './env.js';

// Exact origins only. Vercel project names are globally claimable, so a name-prefix
// wildcard would let anyone obtain a credentialed origin. Preview deployments are
// allowed only for the team slug given in VERCEL_PREVIEW_SCOPE.
const allowedOrigins = new Set(
  env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
    .concat('https://web-red-six-12.vercel.app'),
);

const previewRe = env.VERCEL_PREVIEW_SCOPE
  ? new RegExp(`^https://web-[a-z0-9-]+-${env.VERCEL_PREVIEW_SCOPE.replace(/[^a-z0-9-]/gi, '')}\\.vercel\\.app$`)
  : null;

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;
  return previewRe ? previewRe.test(origin) : false;
}
