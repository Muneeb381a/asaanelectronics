import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { CustomerDocumentsService } from './customer-documents.service.js';
import { success } from '../../utils/response.js';

const svc = new CustomerDocumentsService();

export async function listCustomerDocs(req: AuthRequest, res: Response) {
  const customerId = req.params['customerId']!;
  success(res, await svc.list(customerId, req.user!.sellerId!));
}

export async function addCustomerDoc(req: AuthRequest, res: Response) {
  const customerId = req.params['customerId']!;
  const result = await svc.add(customerId, req.user!.sellerId!, req.user!.userId, req.body);
  success(res, result, 201);
}

export async function updateCustomerDoc(req: AuthRequest, res: Response) {
  const { customerId, docId } = req.params as { customerId: string; docId: string };
  success(res, await svc.update(docId, customerId, req.user!.sellerId!, req.body));
}

export async function deleteCustomerDoc(req: AuthRequest, res: Response) {
  const { customerId, docId } = req.params as { customerId: string; docId: string };
  await svc.remove(docId, customerId, req.user!.sellerId!);
  success(res, { deleted: true });
}
