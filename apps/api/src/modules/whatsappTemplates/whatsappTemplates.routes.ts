import { Router } from 'express';
import { authenticate, requireSeller } from '../../middleware/auth.js';
import { listTemplates, createTemplate, updateTemplate, deleteTemplate } from './whatsappTemplates.controller.js';

const router = Router();
router.use(authenticate, requireSeller);

router.get('/',     listTemplates);
router.post('/',    createTemplate);
router.patch('/:id', updateTemplate);
router.delete('/:id', deleteTemplate);

export default router;
