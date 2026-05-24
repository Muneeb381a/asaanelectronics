import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { authenticateCustomer } from '../../middleware/portalAuth.js';
import { validate } from '../../middleware/validate.js';
import { portalLogin, portalMe, portalInstallments, portalPayments } from './portal.controller.js';

const router = Router();

const loginLimiter = rateLimit({ windowMs: 60_000, max: 5, standardHeaders: true });

const portalLoginSchema = z.object({
  cnic:  z.string().regex(/^\d{13}$/, 'CNIC must be exactly 13 digits'),
  phone: z.string().min(1, 'Phone is required').max(20),
});

router.post('/login', loginLimiter, validate(portalLoginSchema), portalLogin);

router.use(authenticateCustomer);
router.get('/me',                          portalMe);
router.get('/installments',                portalInstallments);
router.get('/installments/:id/payments',   portalPayments);

export default router;
