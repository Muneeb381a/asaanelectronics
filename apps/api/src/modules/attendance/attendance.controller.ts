import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { AttendanceService } from './attendance.service.js';
import { success } from '../../utils/response.js';

const svc = new AttendanceService();

export async function clockIn(req: AuthRequest, res: Response) {
  const sellerId = req.user!.sellerId!;
  const userId   = req.user!.userId;
  success(res, await svc.clockIn(sellerId, userId), 201);
}

export async function clockOut(req: AuthRequest, res: Response) {
  const sellerId = req.user!.sellerId!;
  const userId   = req.user!.userId;
  const { notes } = req.body as { notes?: string };
  success(res, await svc.clockOut(sellerId, userId, notes));
}

export async function getStatus(req: AuthRequest, res: Response) {
  const sellerId = req.user!.sellerId!;
  const userId   = req.user!.userId;
  success(res, await svc.getStatus(sellerId, userId));
}

export async function getByMonth(req: AuthRequest, res: Response) {
  const sellerId = req.user!.sellerId!;
  const now   = new Date();
  const year  = parseInt(req.query['year']  as string) || now.getFullYear();
  const month = parseInt(req.query['month'] as string) || now.getMonth() + 1;
  success(res, await svc.getByMonth(sellerId, year, month));
}

export async function getStaffSummary(req: AuthRequest, res: Response) {
  const sellerId = req.user!.sellerId!;
  const now   = new Date();
  const year  = parseInt(req.query['year']  as string) || now.getFullYear();
  const month = parseInt(req.query['month'] as string) || now.getMonth() + 1;
  success(res, await svc.getStaffSummary(sellerId, year, month));
}
