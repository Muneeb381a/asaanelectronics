import { env } from './env.js';

const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean);

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  return /^https:\/\/(web-red-six-12|assaan[a-z0-9-]*)\.vercel\.app$/.test(origin);
}
