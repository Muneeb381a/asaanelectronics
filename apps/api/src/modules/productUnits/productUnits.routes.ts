import { Router } from 'express';
import { authenticate, requireSeller } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { requirePermission } from '../../middleware/checkPermission.js';
import {
  createProductUnitSchema,
  bulkCreateProductUnitsSchema,
  updateProductUnitSchema,
} from '@assaan/shared';
import {
  listUnits, getUnitStats, lookupImei, ptaCheck,
  createUnit, bulkCreateUnits, updateUnit, removeUnit,
} from './productUnits.controller.js';

const router = Router();
router.use(authenticate, requireSeller);

router.get('/stats',           getUnitStats);
router.get('/lookup/:imei',    lookupImei);
router.get('/pta-check/:imei', ptaCheck);
router.get('/',               listUnits);
router.post('/',              requirePermission('canManageProducts'), validate(createProductUnitSchema),      createUnit);
router.post('/bulk',          requirePermission('canManageProducts'), validate(bulkCreateProductUnitsSchema), bulkCreateUnits);
router.patch('/:id',          requirePermission('canManageProducts'), validate(updateProductUnitSchema),      updateUnit);
router.delete('/:id',         requirePermission('canManageProducts'), removeUnit);

export default router;
