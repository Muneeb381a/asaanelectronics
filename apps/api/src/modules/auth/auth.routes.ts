import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { registerSchema, loginSchema, changePasswordSchema } from '@assaan/shared';
import { ipBlockMiddleware } from '../../middleware/ipBlock.js';
import { loginLimiter } from '../../middleware/limiters.js';
import { authenticate } from '../../middleware/auth.js';
import {
  setup, register, login, verifyLoginOtp, resendOtp,
  forgotPassword, resetPassword, refresh, logout, changePassword,
} from './auth.controller.js';

const router = Router();

router.post('/setup',           validate(registerSchema), setup);
router.post('/register',        validate(registerSchema), register);
// Login + OTP verification get IP-block check AND the strict per-IP rate limit
router.post('/login',           ipBlockMiddleware, loginLimiter, validate(loginSchema), login);
router.post('/verify-otp',      ipBlockMiddleware, loginLimiter, verifyLoginOtp);
router.post('/resend-otp',      loginLimiter, resendOtp);
router.post('/forgot-password', loginLimiter, forgotPassword);
router.post('/reset-password',  resetPassword);
router.post('/refresh',         refresh);
router.post('/logout',          logout);
router.post('/change-password', authenticate, validate(changePasswordSchema), changePassword);

export default router;
