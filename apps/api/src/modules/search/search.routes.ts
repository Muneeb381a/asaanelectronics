import { Router } from 'express';
import { authenticate, requireSeller } from '../../middleware/auth.js';
import { globalSearch } from './search.controller.js';

const router = Router();
router.use(authenticate, requireSeller);
router.get('/', globalSearch);

export default router;
