import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { success } from '../../utils/response.js';
import { recordFailure, recordSuccess } from '../../middleware/ipBlock.js';
import { AppError } from '../../middleware/error.js';
import type { AuthRequest } from '../../middleware/auth.js';

const svc = new AuthService();

function device(req: Request) {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}

function clientIp(req: Request) {
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

export async function setup(req: Request, res: Response) {
  success(res, await svc.setup(req.body, device(req)), 201);
}

export async function register(req: Request, res: Response) {
  success(res, await svc.register(req.body, device(req)), 201);
}

export async function login(req: Request, res: Response) {
  const ip = clientIp(req);
  try {
    const result = await svc.login(req.body, device(req));
    recordSuccess(ip);
    success(res, result);
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 401) recordFailure(ip);
    throw err;
  }
}

export async function verifyLoginOtp(req: Request, res: Response) {
  const ip = clientIp(req);
  try {
    const result = await svc.verifyLoginOtp(req.body, device(req));
    recordSuccess(ip);
    success(res, result);
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 401) recordFailure(ip);
    throw err;
  }
}

export async function resendOtp(req: Request, res: Response) {
  success(res, await svc.resendOtp(req.body));
}

export async function forgotPassword(req: Request, res: Response) {
  await svc.forgotPassword(req.body);
  success(res, null);
}

export async function resetPassword(req: Request, res: Response) {
  await svc.resetPassword(req.body);
  success(res, null);
}

export async function refresh(req: Request, res: Response) {
  success(res, await svc.refresh((req.body as { token: string }).token, device(req)));
}

export async function changePassword(req: AuthRequest, res: Response) {
  await svc.changePassword(req.user!.userId, (req.body as { currentPassword: string }).currentPassword, (req.body as { newPassword: string }).newPassword);
  success(res, null);
}

export async function logout(req: Request, res: Response) {
  await svc.logout((req.body as { token: string }).token);
  success(res, null);
}
