import { Router } from 'express';
import { authenticate, requireSeller } from '../../middleware/auth.js';
import { getStats, getReports, getAdvanced } from './stats.controller.js';

const router = Router();

router.use(authenticate, requireSeller);
router.get('/', getStats);
router.get('/reports', getReports);
router.get('/advanced', getAdvanced);

export default router;
