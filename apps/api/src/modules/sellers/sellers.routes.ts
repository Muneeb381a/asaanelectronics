import { Router } from 'express';
import { authenticate, requireSeller, requireOwner } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createSellerSchema } from '@assaan/shared';
import { createSeller, getMyShop, updateMyShop } from './sellers.controller.js';

const router = Router();

router.use(authenticate);

router.post('/', validate(createSellerSchema), createSeller);
router.get('/me', requireSeller, getMyShop);
router.patch('/me', requireSeller, requireOwner, updateMyShop);

export default router;
