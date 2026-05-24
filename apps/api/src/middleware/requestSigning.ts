import { createHmac } from 'crypto';
import type { RequestHandler } from 'express';

const MAX_AGE_MS = 5 * 60_000; // reject requests older than 5 minutes (replay protection)

const secret = process.env['REQUEST_SIGNING_SECRET'];

// Disabled when env var is not set — opt-in feature
export const requestSigningMiddleware: RequestHandler = (req, res, next) => {
  if (!secret) return next();

  const timestamp = req.headers['x-request-timestamp'] as string | undefined;
  const signature = req.headers['x-request-signature'] as string | undefined;

  if (!timestamp || !signature) {
    res.status(401).json({ success: false, data: null, error: 'Missing request signature headers.' });
    return;
  }

  const ts = Number(timestamp);
  if (isNaN(ts) || Math.abs(Date.now() - ts) > MAX_AGE_MS) {
    res.status(401).json({ success: false, data: null, error: 'Request timestamp expired or invalid.' });
    return;
  }

  // Payload: METHOD:path:timestamp  (body excluded — avoids streaming/buffer issues)
  const payload  = `${req.method}:${req.path}:${timestamp}`;
  const expected = createHmac('sha256', secret).update(payload).digest('hex');

  // Constant-time comparison to prevent timing attacks
  if (!timingSafeEqual(expected, signature)) {
    res.status(401).json({ success: false, data: null, error: 'Invalid request signature.' });
    return;
  }

  next();
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
