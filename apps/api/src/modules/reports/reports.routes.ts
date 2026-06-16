import { Router } from 'express';
import { authenticate, requireSeller } from '../../middleware/auth.js';
import { getMonthlyReport } from './reports.controller.js';

const router = Router();

router.use(authenticate, requireSeller);
router.get('/monthly', getMonthlyReport);

export default router;
