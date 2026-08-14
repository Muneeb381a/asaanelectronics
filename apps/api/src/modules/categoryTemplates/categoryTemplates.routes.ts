import { Router } from 'express';
import { authenticate, requireSeller } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createCategoryTemplateSchema } from '@assaan/shared';
import { listTemplates, getByCategory, upsertTemplate, deleteTemplate } from './categoryTemplates.controller.js';

const router = Router();
router.use(authenticate, requireSeller);

router.get('/',                        listTemplates);
router.get('/by-category/:categoryName', getByCategory);
router.post('/',   validate(createCategoryTemplateSchema), upsertTemplate);
router.delete('/:id', deleteTemplate);

export default router;
