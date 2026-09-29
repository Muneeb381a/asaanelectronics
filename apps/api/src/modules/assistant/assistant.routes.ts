import { Router } from 'express';
import { authenticate, requireSeller } from '../../middleware/auth.js';
import { assistantLimiter } from '../../middleware/limiters.js';
import { ask } from './assistant.controller.js';

const router = Router();

router.use(authenticate, requireSeller);
router.post('/ask', assistantLimiter, ask);

export default router;
