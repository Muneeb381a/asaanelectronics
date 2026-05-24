import type { RequestHandler } from 'express';

interface IpRecord {
  failures:     number;
  windowStart:  number;  // ms timestamp
  blockedUntil: number | null;
}

const store = new Map<string, IpRecord>();

const WINDOW_MS      = 15 * 60_000;  // failure window  = 15 min
const MAX_FAILURES   = 10;           // failures before block
const BLOCK_DURATION = 30 * 60_000;  // block duration  = 30 min

// Prune stale entries every 15 min to prevent memory growth
setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of store) {
    const expired = rec.blockedUntil
      ? rec.blockedUntil < now
      : now - rec.windowStart > WINDOW_MS;
    if (expired) store.delete(ip);
  }
}, WINDOW_MS).unref();

export function isBlocked(ip: string): boolean {
  const rec = store.get(ip);
  if (!rec?.blockedUntil) return false;
  if (Date.now() >= rec.blockedUntil) { store.delete(ip); return false; }
  return true;
}

export function recordFailure(ip: string): void {
  const now = Date.now();
  const rec = store.get(ip) ?? { failures: 0, windowStart: now, blockedUntil: null };

  // Reset window if it has expired (and not currently blocked)
  if (!rec.blockedUntil && now - rec.windowStart > WINDOW_MS) {
    rec.failures    = 0;
    rec.windowStart = now;
  }

  rec.failures++;
  if (rec.failures >= MAX_FAILURES) {
    rec.blockedUntil = now + BLOCK_DURATION;
  }
  store.set(ip, rec);
}

export function recordSuccess(ip: string): void {
  store.delete(ip);
}

export const ipBlockMiddleware: RequestHandler = (req, res, next) => {
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  if (isBlocked(ip)) {
    res.status(429).json({
      success: false, data: null,
      error: 'Too many failed attempts — your IP is temporarily blocked. Try again in 30 minutes.',
    });
    return;
  }
  next();
};
