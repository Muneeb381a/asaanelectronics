import { rateLimit } from 'express-rate-limit';
import type { RequestHandler } from 'express';

function safeLimit(limiter: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(limiter(req, res, next)).catch(next);
  };
}

// Login / OTP: 10 attempts per 15 min per IP; only failed requests count
export const loginLimiter = safeLimit(rateLimit({
  windowMs: 15 * 60_000, max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true, legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { success: false, data: null, error: 'Too many login attempts. Try again in 15 minutes.' },
}));

// Payments: 30 POST requests per minute per IP
export const paymentLimiter = safeLimit(rateLimit({
  windowMs: 60_000, max: 30,
  standardHeaders: true, legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { success: false, data: null, error: 'Payment rate limit exceeded. Please slow down.' },
}));
