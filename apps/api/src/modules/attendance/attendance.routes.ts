import { Router } from 'express';
import { authenticate, requireSeller } from '../../middleware/auth.js';
import { clockIn, clockOut, getStatus, getByMonth, getStaffSummary } from './attendance.controller.js';

const router = Router();

router.use(authenticate, requireSeller);

router.post('/clock-in',  clockIn);
router.post('/clock-out', clockOut);
router.get('/status',     getStatus);
router.get('/monthly',    getByMonth);
router.get('/summary',    getStaffSummary);

export default router;
