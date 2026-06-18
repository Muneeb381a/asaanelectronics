import { Router } from 'express';
import { authenticate, requireSeller } from '../../middleware/auth.js';
import { getMonthlyReport, getMonthlyCustomers } from './reports.controller.js';

const router = Router();

router.use(authenticate, requireSeller);
router.get('/monthly',           getMonthlyReport);
router.get('/monthly-customers', getMonthlyCustomers);

export default router;
