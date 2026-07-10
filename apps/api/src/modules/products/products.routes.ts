import { Router } from 'express';
import { authenticate, requireSeller, requireOwner } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/checkPermission.js';
import { validate } from '../../middleware/validate.js';
import { createProductSchema, updateProductSchema } from '@assaan/shared';
import { listProducts, createProduct, updateProduct, deleteProduct, getInventoryIntelligence, getValuation } from './products.controller.js';

const router = Router();

router.use(authenticate, requireSeller);

router.get('/intelligence', requirePermission(['canManageProducts', 'canViewReports']), getInventoryIntelligence);
router.get('/valuation',   requirePermission(['canManageProducts', 'canViewReports']), getValuation);
router.get('/',            requirePermission('canManageProducts'), listProducts);
router.post('/',      requirePermission('canManageProducts'), validate(createProductSchema), createProduct);
router.patch('/:id',  requirePermission('canManageProducts'), validate(updateProductSchema), updateProduct);
router.delete('/:id', requireOwner, deleteProduct);

export default router;
