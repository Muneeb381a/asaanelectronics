import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { whatsappTemplateSchema } from '@assaan/shared';
import { authenticate, requireSeller } from '../../middleware/auth.js';
import { listTemplates, createTemplate, updateTemplate, deleteTemplate } from './whatsappTemplates.controller.js';

const router = Router();
router.use(authenticate, requireSeller);

router.get('/',     listTemplates);
router.post('/',    validate(whatsappTemplateSchema), createTemplate);
router.patch('/:id', validate(whatsappTemplateSchema), updateTemplate);
router.delete('/:id', deleteTemplate);

export default router;
