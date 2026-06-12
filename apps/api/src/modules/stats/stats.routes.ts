import { Router } from 'express';
import { authenticate, requireSeller } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/checkPermission.js';
import { getStats, getReports, getAdvanced, getDashboard } from './stats.controller.js';

const router = Router();

router.use(authenticate, requireSeller);
router.get('/dashboard', getDashboard);
router.get('/',          getStats);
router.get('/reports',   requirePermission('canViewReports'), getReports);
router.get('/advanced',  requirePermission('canViewReports'), getAdvanced);

export default router;
