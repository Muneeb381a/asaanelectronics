import { Router } from 'express';
import { authenticate, requireSeller, requireOwner } from '../../middleware/auth.js';
import { listAuditLogs, cleanupAuditLogs } from './audit.controller.js';

const router = Router();
router.use(authenticate, requireSeller, requireOwner);

router.get('/', listAuditLogs);
router.post('/cleanup', cleanupAuditLogs);

export default router;
