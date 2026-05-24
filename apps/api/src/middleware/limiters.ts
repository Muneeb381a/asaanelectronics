import { rateLimit } from 'express-rate-limit';

// Login / OTP: 10 attempts per 15 min per IP; only failed requests count
export const loginLimiter = rateLimit({
  windowMs: 15 * 60_000, max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true, legacyHeaders: false,
  message: { success: false, data: null, error: 'Too many login attempts. Try again in 15 minutes.' },
});

// Payments: 30 POST requests per minute per IP
export const paymentLimiter = rateLimit({
  windowMs: 60_000, max: 30,
  standardHeaders: true, legacyHeaders: false,
  message: { success: false, data: null, error: 'Payment rate limit exceeded. Please slow down.' },
});
