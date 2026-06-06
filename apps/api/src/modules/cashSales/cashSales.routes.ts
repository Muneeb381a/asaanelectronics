import { Router } from 'express';
import { authenticate, requireSeller, requireOwner } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/checkPermission.js';
import { validate } from '../../middleware/validate.js';
import { createCashSaleSchema } from '@assaan/shared';
import { listCashSales, createCashSale, deleteCashSale } from './cashSales.controller.js';

const router = Router();
router.use(authenticate, requireSeller);

router.get('/',       requirePermission('canManageProducts'), listCashSales);
router.post('/',      requirePermission('canManageProducts'), validate(createCashSaleSchema), createCashSale);
router.delete('/:id', requireOwner, deleteCashSale);

export default router;
