import { Router } from 'express';
import { authenticate, requireSuperAdmin } from '../../middleware/auth.js';
import { listShops, createShop, createShopOwner, deleteShop, toggleShopStatus } from './owner.controller.js';

const router = Router();

router.use(authenticate, requireSuperAdmin);

router.get('/shops', listShops);
router.post('/shops', createShop);
router.post('/shops/:id/owner', createShopOwner);
router.delete('/shops/:id', deleteShop);
router.patch('/shops/:id/status', toggleShopStatus);

export default router;
