import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { CustomerNotesService } from './customer-notes.service.js';
import { resolveStaffScope, assertCustomerInScope } from '../../utils/staffScope.js';
import { success } from '../../utils/response.js';

const svc = new CustomerNotesService();

export async function listNotes(req: AuthRequest, res: Response) {
  const page  = Math.max(1, Number(req.query['page'])  || 1);
  const limit = Math.min(Math.max(1, Number(req.query['limit']) || 10), 50);
  await assertCustomerInScope(req.params['customerId']!, req.user!.sellerId!, await resolveStaffScope(req));
  success(res, await svc.list(req.params['customerId']!, req.user!.sellerId!, page, limit));
}

export async function addNote(req: AuthRequest, res: Response) {
  const { note } = req.body as { note: string };
  const result = await svc.add(req.params['customerId']!, req.user!.sellerId!, req.user!.userId, note);
  success(res, result, 201);
}

export async function deleteNote(req: AuthRequest, res: Response) {
  await svc.remove(req.params['noteId']!, req.user!.sellerId!, req.user!.userId);
  success(res, null);
}
