import { createHash, createHmac } from 'crypto';
import type { RequestHandler } from 'express';
import { env } from '../config/env.js';

const MAX_AGE_MS = 5 * 60_000; // reject requests older than 5 minutes (replay protection)

const secret = env.REQUEST_SIGNING_SECRET;

// Body is part of the signature so a captured signature can't be replayed with a
// different payload. JSON bodies are re-serialised (client signs JSON.stringify(data));
// multipart / empty bodies hash the empty string.
function bodyHash(req: Parameters<RequestHandler>[0]): string {
  const isJson = typeof req.headers['content-type'] === 'string' && req.headers['content-type'].includes('application/json');
  const raw = isJson && req.body !== undefined && req.body !== null ? JSON.stringify(req.body) : '';
  return createHash('sha256').update(raw).digest('hex');
}

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

  const payload  = `${req.method}:${req.path}:${timestamp}:${bodyHash(req)}`;
  const expected = createHmac('sha256', secret).update(payload).digest('hex');

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
