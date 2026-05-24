import { Router } from 'express';
import { authenticate, requireSeller, requireOwner } from '../../middleware/auth.js';
import { getWalletBalance, getCashBook, getDailySummary, getProfitLoss } from './ledger.controller.js';

const router = Router();
router.use(authenticate, requireSeller, requireOwner);

router.get('/balance',  getWalletBalance);
router.get('/cashbook', getCashBook);
router.get('/daily',    getDailySummary);
router.get('/pl',       getProfitLoss);

export default router;
