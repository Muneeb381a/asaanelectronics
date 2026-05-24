import { Router } from 'express';
import { authenticate, requireSeller, requireOwner } from '../../middleware/auth.js';
import { listAuditLogs } from './audit.controller.js';

const router = Router();
router.use(authenticate, requireSeller, requireOwner);

router.get('/', listAuditLogs);

export default router;
