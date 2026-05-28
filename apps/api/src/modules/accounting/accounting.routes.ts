import { Router } from 'express';
import { authenticate, requireSeller, requireOwner } from '../../middleware/auth.js';
import { getBalances, listJournalEntries } from './accounting.controller.js';

const router = Router();
router.use(authenticate, requireSeller, requireOwner);

router.get('/balances', getBalances);
router.get('/journal',  listJournalEntries);

export default router;
