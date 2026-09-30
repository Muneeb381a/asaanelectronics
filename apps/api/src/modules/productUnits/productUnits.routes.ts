import { Router } from 'express';
import multer from 'multer';
import { authenticate, requireSeller } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { requirePermission } from '../../middleware/checkPermission.js';
import { AppError } from '../../middleware/error.js';
import {
  createProductUnitSchema,
  bulkCreateProductUnitsSchema,
  updateProductUnitSchema,
} from '@assaan/shared';
import {
  listUnits, getUnitStats, lookupImei, ptaCheck,
  createUnit, bulkCreateUnits, updateUnit, removeUnit,
} from './productUnits.controller.js';
import { listPhotos, addPhoto, removePhoto } from './unitPhotos.controller.js';

const router = Router();
router.use(authenticate, requireSeller);

const ALLOWED_PHOTO_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_PHOTO_MIME.has(file.mimetype)) return cb(null, true);
    cb(new AppError('Invalid file type. Only JPG, PNG, WEBP, or HEIC allowed.', 400));
  },
});

router.get('/stats',           requirePermission(['canManageProducts', 'canAddInstallment', 'canMakeCashSales']), getUnitStats);
router.get('/lookup/:imei',    requirePermission(['canManageProducts', 'canAddInstallment', 'canMakeCashSales']), lookupImei);
router.get('/pta-check/:imei', requirePermission(['canManageProducts', 'canAddInstallment', 'canMakeCashSales']), ptaCheck);
router.get('/',               requirePermission(['canManageProducts', 'canAddInstallment', 'canMakeCashSales']), listUnits);
router.post('/',              requirePermission('canManageProducts'), validate(createProductUnitSchema),      createUnit);
router.post('/bulk',          requirePermission('canManageProducts'), validate(bulkCreateProductUnitsSchema), bulkCreateUnits);
router.patch('/:id',          requirePermission('canManageProducts'), validate(updateProductUnitSchema),      updateUnit);
router.delete('/:id',         requirePermission('canManageProducts'), removeUnit);

router.get('/:unitId/photos',    requirePermission(['canManageProducts', 'canAddInstallment', 'canMakeCashSales']), listPhotos);
router.post('/:unitId/photos',   requirePermission('canManageProducts'), photoUpload.single('file'), addPhoto);
router.delete('/:unitId/photos/:photoId', requirePermission('canManageProducts'), removePhoto);

export default router;
