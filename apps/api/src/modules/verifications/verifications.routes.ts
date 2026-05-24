import { Router } from 'express';
import { authenticate, requireSeller, requireOwner } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { submitVerificationSchema } from '@assaan/shared';
import { myQueue, submitVerification, getReport, avoStats, reVerifyCustomer } from './verifications.controller.js';

const router = Router();
router.use(authenticate, requireSeller);

router.get('/my-queue',                   myQueue);
router.post('/customers/:id',             validate(submitVerificationSchema), submitVerification);
router.get('/customers/:id/report',       getReport);
router.post('/customers/:id/re-verify',   requireOwner, reVerifyCustomer);
router.get('/avo-stats',                  requireOwner, avoStats);

export default router;
