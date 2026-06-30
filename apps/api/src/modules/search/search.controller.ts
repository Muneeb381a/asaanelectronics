import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { SearchService } from './search.service.js';
import { success } from '../../utils/response.js';

const svc = new SearchService();

export async function globalSearch(req: AuthRequest, res: Response) {
  const q = (req.query['q'] as string ?? '').trim();
  if (q.length < 2) {
    success(res, { customers: [], installments: [], products: [] });
    return;
  }
  success(res, await svc.globalSearch(req.user!.sellerId!, q));
}
