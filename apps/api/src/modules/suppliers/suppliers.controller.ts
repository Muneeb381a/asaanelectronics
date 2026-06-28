import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { SuppliersService } from './suppliers.service.js';
import { success } from '../../utils/response.js';

const svc = new SuppliersService();

export async function listSuppliers(req: AuthRequest, res: Response) {
  success(res, await svc.list(req.user!.sellerId!));
}

export async function createSupplier(req: AuthRequest, res: Response) {
  success(res, await svc.create(req.user!.sellerId!, req.body), 201);
}

export async function updateSupplier(req: AuthRequest, res: Response) {
  success(res, await svc.update(req.params['id']!, req.user!.sellerId!, req.body));
}

export async function deleteSupplier(req: AuthRequest, res: Response) {
  await svc.remove(req.params['id']!, req.user!.sellerId!);
  res.status(204).end();
}

// ── Invoices ──────────────────────────────────────────────────────────────────

export async function listInvoices(req: AuthRequest, res: Response) {
  success(res, await svc.listInvoices(req.params['supplierId']!, req.user!.sellerId!));
}

export async function createInvoice(req: AuthRequest, res: Response) {
  success(res, await svc.createInvoice(req.user!.sellerId!, {
    supplierId:  req.params['supplierId']!,
    ...req.body,
  }), 201);
}

export async function updateInvoicePaid(req: AuthRequest, res: Response) {
  const { paidAmount } = req.body as { paidAmount: number };
  success(res, await svc.updateInvoicePaid(req.params['invoiceId']!, req.user!.sellerId!, paidAmount));
}

export async function deleteInvoice(req: AuthRequest, res: Response) {
  await svc.removeInvoice(req.params['invoiceId']!, req.user!.sellerId!);
  res.status(204).end();
}
