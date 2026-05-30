import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

type AccessPayload    = { userId: string; sellerId: string | null; role: string; sessionId?: string };
type OtpPayload       = { userId: string; purpose: 'LOGIN' | 'PASSWORD_RESET' };
type CustomerPayload  = { customerId: string; sellerId: string; type: 'CUSTOMER' };

const OTP_SECRET = env.JWT_OTP_SECRET;

export function signAccess(payload: AccessPayload) {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
}

export function signRefresh(payload: { userId: string }) {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
}

export function verifyAccess(token: string) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessPayload & jwt.JwtPayload;
}

export function verifyRefresh(token: string) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as { userId: string } & jwt.JwtPayload;
}

export function signOtpToken(payload: OtpPayload) {
  return jwt.sign(payload, OTP_SECRET, { expiresIn: '10m' });
}

export function verifyOtpToken(token: string) {
  return jwt.verify(token, OTP_SECRET) as OtpPayload & jwt.JwtPayload;
}

const PORTAL_SECRET = env.JWT_PORTAL_SECRET;

export function signCustomerToken(payload: CustomerPayload) {
  return jwt.sign(payload, PORTAL_SECRET, { expiresIn: '2h' });
}

export function verifyCustomerToken(token: string) {
  return jwt.verify(token, PORTAL_SECRET) as CustomerPayload & jwt.JwtPayload;
}
