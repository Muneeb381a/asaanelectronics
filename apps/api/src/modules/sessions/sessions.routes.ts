import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { listSessions, revokeSession, revokeAllSessions } from './sessions.controller.js';

const router = Router();
router.use(authenticate);

router.get('/',        listSessions);
router.delete('/all',  revokeAllSessions);
router.delete('/:id',  revokeSession);

export default router;
