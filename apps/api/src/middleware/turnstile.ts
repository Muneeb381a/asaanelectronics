import type { Request, Response, NextFunction } from 'express';
import { AppError } from './error.js';
import { env } from '../config/env.js';

// Not configured — dev-safe no-op, same pattern as JazzCash/NADRA: nothing breaks
// locally, and it only starts enforcing once TURNSTILE_SECRET_KEY is set.
export function turnstileConfigured(): boolean {
  return !!env.TURNSTILE_SECRET_KEY;
}

export async function verifyTurnstileToken(token: string | undefined, remoteIp?: string): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY) return true;
  if (!token) return false;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET_KEY,
        response: token,
        ...(remoteIp ? { remoteip: remoteIp } : {}),
      }),
    });
    const data = (await res.json()) as { success: boolean };
    return !!data.success;
  } catch {
    // Cloudflare's own verify endpoint being briefly unreachable is rare enough that
    // failing closed (block) is the safer default over silently letting bots through.
    return false;
  }
}

// Bot/credential-stuffing gate for the handful of public, unauthenticated auth
// endpoints (login, register, forgot-password) — sits after validate() so
// req.body.turnstileToken is already typed and present when sent.
export function requireTurnstile(req: Request, _res: Response, next: NextFunction) {
  const token = (req.body as { turnstileToken?: string }).turnstileToken;
  verifyTurnstileToken(token, req.ip)
    .then((ok) => {
      if (!ok) return next(new AppError('Verification failed. Please refresh and try again.', 403));
      next();
    })
    .catch(next);
}
