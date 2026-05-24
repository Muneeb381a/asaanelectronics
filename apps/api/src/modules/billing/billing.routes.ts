import { Router } from 'express';
import { authenticate, requireSeller, requireSuperAdmin } from '../../middleware/auth.js';
import { getUsage, changePlan } from './billing.controller.js';

const router = Router();

// Shop owner: see their own usage
router.get('/usage', authenticate, requireSeller, getUsage);

// Super admin: change any shop's plan
router.patch('/:sellerId/plan', authenticate, requireSuperAdmin, changePlan);

export default router;
