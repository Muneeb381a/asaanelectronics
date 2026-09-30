import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { createExpenseClaimSchema, approveExpenseClaimSchema, rejectExpenseClaimSchema } from '@assaan/shared';
import { authenticate, requireSeller, requireOwner } from '../../middleware/auth.js';
import { listClaims, createClaim, approveClaim, rejectClaim } from './staffExpenseClaims.controller.js';

const router = Router();

router.use(authenticate, requireSeller);

router.get('/',            listClaims);
router.post('/',           validate(createExpenseClaimSchema), createClaim);
router.patch('/:id/approve', requireOwner, validate(approveExpenseClaimSchema), approveClaim);
router.patch('/:id/reject',  requireOwner, validate(rejectExpenseClaimSchema), rejectClaim);

export default router;
