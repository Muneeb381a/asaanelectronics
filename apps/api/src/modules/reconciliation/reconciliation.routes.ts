import { Router } from 'express';
import { authenticate, requireSeller, requireOwner } from '../../middleware/auth.js';
import { getLatest, getHistory, runNow } from './reconciliation.controller.js';

const router = Router();
router.use(authenticate, requireSeller);

router.get('/latest',  getLatest);
router.get('/history', getHistory);
router.post('/run',    requireOwner, runNow);

export default router;
