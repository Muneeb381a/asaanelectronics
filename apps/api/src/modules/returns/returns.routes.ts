import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { createReturnSchema, resolveReturnSchema } from '@assaan/shared';
import { authenticate, requireSeller, requireOwner } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/checkPermission.js';
import { listReturns, getReturn, createReturn, resolveReturn } from './returns.controller.js';

const router = Router();
router.use(authenticate, requireSeller);

router.get('/',               requirePermission('canManageReturns'), listReturns);
router.get('/:id',            requirePermission('canManageReturns'), getReturn);
router.post('/',              requirePermission('canManageReturns'), validate(createReturnSchema), createReturn);
router.patch('/:id/resolve',  requireOwner, validate(resolveReturnSchema), resolveReturn);

export default router;
