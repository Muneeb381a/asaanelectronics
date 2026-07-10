import type { Response } from 'express';
import { eq } from 'drizzle-orm';
import type { AuthRequest } from '../../middleware/auth.js';
import { SearchService } from './search.service.js';
import { success } from '../../utils/response.js';
import { db } from '../../db/index.js';
import { users } from '../../db/schema.js';

const svc = new SearchService();

export async function globalSearch(req: AuthRequest, res: Response) {
  const q = (req.query['q'] as string ?? '').trim();
  if (q.length < 2) {
    success(res, { customers: [], installments: [], products: [], bureau: [] });
    return;
  }

  const user = req.user!;
  let canSearchCnic = user.role === 'SELLER_OWNER' || user.role === 'SUPER_ADMIN';
  if (!canSearchCnic && /^\d{13}$/.test(q.replace(/-/g, ''))) {
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, user.userId),
      columns: { permissions: true },
    });
    canSearchCnic = !!dbUser?.permissions?.canSearchCnic;
  }

  success(res, await svc.globalSearch(user.sellerId!, q, canSearchCnic));
}
