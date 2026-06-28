import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { WhatsappTemplatesService } from './whatsappTemplates.service.js';
import { success } from '../../utils/response.js';

const svc = new WhatsappTemplatesService();

export async function listTemplates(req: AuthRequest, res: Response) {
  success(res, await svc.list(req.user!.sellerId!));
}

export async function createTemplate(req: AuthRequest, res: Response) {
  success(res, await svc.create(req.user!.sellerId!, req.body), 201);
}

export async function updateTemplate(req: AuthRequest, res: Response) {
  success(res, await svc.update(req.params['id']!, req.user!.sellerId!, req.body));
}

export async function deleteTemplate(req: AuthRequest, res: Response) {
  await svc.remove(req.params['id']!, req.user!.sellerId!);
  success(res, null, 204);
}
