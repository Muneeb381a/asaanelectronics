import { Router } from 'express';
import { authenticate, requireSeller } from '../../middleware/auth.js';
import {
  listHandovers, getCollectedToday, createHandover, confirmHandover, disputeHandover,
} from './handovers.controller.js';

const router = Router();
router.use(authenticate, requireSeller);

router.get('/',                    listHandovers);
router.get('/collected-today',     getCollectedToday);
router.post('/',                   createHandover);
router.patch('/:id/confirm',       confirmHandover);
router.patch('/:id/dispute',       disputeHandover);

export default router;
