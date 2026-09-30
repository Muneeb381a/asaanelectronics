import { Router } from 'express';
import multer from 'multer';
import { authenticate, requireSeller, requireOwner } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createSellerSchema, updateSellerSchema } from '@assaan/shared';
import { AppError } from '../../middleware/error.js';
import {
  createSeller, getMyShop, updateMyShop,
  uploadLogo, deleteLogo,
  listPaymentAccounts, addPaymentAccount, removePaymentAccount,
} from './sellers.controller.js';

const router = Router();

const ALLOWED_LOGO_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // client compresses first; 2 MB gives headroom
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_LOGO_MIME.has(file.mimetype)) return cb(null, true);
    cb(new AppError('Invalid file type. Only JPG, PNG, or WEBP allowed.', 400));
  },
});

router.use(authenticate);

router.post('/', validate(createSellerSchema), createSeller);
router.get('/me', requireSeller, getMyShop);
router.patch('/me', requireSeller, requireOwner, validate(updateSellerSchema), updateMyShop);

router.post('/me/logo',   requireSeller, requireOwner, logoUpload.single('file'), uploadLogo);
router.delete('/me/logo', requireSeller, requireOwner, deleteLogo);

router.get('/me/payment-accounts', requireSeller, listPaymentAccounts);
router.post('/me/payment-accounts', requireSeller, requireOwner, addPaymentAccount);
router.delete('/me/payment-accounts/:id', requireSeller, requireOwner, removePaymentAccount);

export default router;
