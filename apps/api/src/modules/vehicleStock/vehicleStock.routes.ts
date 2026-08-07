import { Router } from 'express';
import { authenticate, requireSeller, requireOwner } from '../../middleware/auth.js';
import {
  listVehicleStock, getVehicleStockStats, getVehicleStock,
  createVehicleStock, updateVehicleStock, deleteVehicleStock,
} from './vehicleStock.controller.js';

const router = Router();
router.use(authenticate, requireSeller);

router.get('/stats', getVehicleStockStats);
router.get('/',      listVehicleStock);
router.get('/:id',   getVehicleStock);
router.post('/',     requireOwner, createVehicleStock);
router.patch('/:id', requireOwner, updateVehicleStock);
router.delete('/:id',requireOwner, deleteVehicleStock);

export default router;
