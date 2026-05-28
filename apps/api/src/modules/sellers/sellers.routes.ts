import { Router } from 'express';
import { authenticate, requireSeller, requireOwner } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createSellerSchema } from '@assaan/shared';
import {
  createSeller, getMyShop, updateMyShop,
  listPaymentAccounts, addPaymentAccount, removePaymentAccount,
} from './sellers.controller.js';

const router = Router();

router.use(authenticate);

router.post('/', validate(createSellerSchema), createSeller);
router.get('/me', requireSeller, getMyShop);
router.patch('/me', requireSeller, requireOwner, updateMyShop);

router.get('/me/payment-accounts', requireSeller, listPaymentAccounts);
router.post('/me/payment-accounts', requireSeller, requireOwner, addPaymentAccount);
router.delete('/me/payment-accounts/:id', requireSeller, requireOwner, removePaymentAccount);

export default router;
