import { Router } from 'express';
import { authenticate, requireSeller, requireOwner } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/checkPermission.js';
import { listReturns, getReturn, createReturn, resolveReturn } from './returns.controller.js';

const router = Router();
router.use(authenticate, requireSeller);

router.get('/',               listReturns);
router.get('/:id',            getReturn);
router.post('/',              requirePermission('canManageReturns'), createReturn);
router.patch('/:id/resolve',  requireOwner, resolveReturn);

export default router;
