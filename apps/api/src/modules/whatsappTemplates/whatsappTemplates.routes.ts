import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { whatsappTemplateSchema } from '@assaan/shared';
import { authenticate, requireSeller, requireOwner } from '../../middleware/auth.js';
import { listTemplates, createTemplate, updateTemplate, deleteTemplate } from './whatsappTemplates.controller.js';

const router = Router();
router.use(authenticate, requireSeller);

router.get('/',     listTemplates);
router.post('/',    requireOwner, validate(whatsappTemplateSchema), createTemplate);
router.patch('/:id', requireOwner, validate(whatsappTemplateSchema), updateTemplate);
router.delete('/:id', requireOwner, deleteTemplate);

export default router;
