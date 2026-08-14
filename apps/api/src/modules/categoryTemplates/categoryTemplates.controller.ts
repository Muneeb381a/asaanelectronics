import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { CategoryTemplatesService } from './categoryTemplates.service.js';
import { success } from '../../utils/response.js';
import type { CreateCategoryTemplateInput } from '@assaan/shared';

const svc = new CategoryTemplatesService();

export async function listTemplates(req: AuthRequest, res: Response) {
  success(res, await svc.list(req.user!.sellerId!));
}

export async function getByCategory(req: AuthRequest, res: Response) {
  const fields = await svc.getByCategory(req.user!.sellerId!, req.params['categoryName']!);
  success(res, fields);
}

export async function upsertTemplate(req: AuthRequest, res: Response) {
  const result = await svc.upsert(req.user!.sellerId!, req.body as CreateCategoryTemplateInput);
  success(res, result, 201);
}

export async function deleteTemplate(req: AuthRequest, res: Response) {
  await svc.remove(req.params['id']!, req.user!.sellerId!);
  success(res, null);
}
