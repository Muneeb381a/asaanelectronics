import type { Request, Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { PaymentsService } from './payments.service.js';
import { AuditService } from '../audit/audit.service.js';
import { success } from '../../utils/response.js';
import { auditCtx } from '../../utils/auditCtx.js';
import {
  createJazzCashLink, buildPayPageHtml, getPendingLink,
  verifyCallbackHash, isJazzCashConfigured,
} from './jazzcash.service.js';
const svc   = new PaymentsService();
const audit = new AuditService();

export async function listPayments(req: AuthRequest, res: Response) {
  const installmentId = req.query['installmentId'] as string | undefined;
  if (installmentId) {
    const page  = Math.max(1, parseInt(req.query['page']  as string) || 1);
    const limit = Math.max(1, parseInt(req.query['limit'] as string) || 50);
    success(res, await svc.listByInstallment(installmentId, req.user!.sellerId!, page, limit));
  } else {
    const from = req.query['from'] as string | undefined;
    const to   = req.query['to']   as string | undefined;
    success(res, await svc.listBySeller(req.user!.sellerId!, from, to));
  }
}

export async function patchPayment(req: AuthRequest, res: Response) {
  const { amount, method, note } = req.body as { amount?: number; method?: 'CASH' | 'BANK' | 'JAZZCASH' | 'EASYPAISA' | 'OTHER'; note?: string };
  const result = await svc.update(req.params['id']!, req.user!.sellerId!, { amount, method, note });
  success(res, result);
  void audit.log({
    sellerId: req.user!.sellerId!, userId: req.user!.userId,
    action: 'PAYMENT_UPDATED', entityType: 'PAYMENT', entityId: req.params['id']!,
    description: `Edited payment${amount !== undefined ? ` — new amount PKR ${Number(amount).toLocaleString()}` : ''}`,
    meta: { amount, method, note },
    ...auditCtx(req),
  }).catch(console.error);
}

export async function deletePayment(req: AuthRequest, res: Response) {
  const removed = await svc.remove(req.params['id']!, req.user!.sellerId!, req.user!.userId);
  success(res, null);
  void audit.log({
    sellerId: req.user!.sellerId!, userId: req.user!.userId,
    action: 'PAYMENT_DELETED', entityType: 'PAYMENT', entityId: removed.id,
    description: `Soft-deleted payment PKR ${Number(removed.amount).toLocaleString()} via ${removed.method}`,
    meta: { amount: removed.amount, method: removed.method },
    ...auditCtx(req),
  }).catch(console.error);
}

export async function recordBulkPayments(req: AuthRequest, res: Response) {
  const { entries } = req.body as {
    entries: Array<{ installmentId: string; amount: number; method: string; note?: string }>;
  };
  if (!Array.isArray(entries)) {
    res.status(400).json({ message: 'entries must be an array' });
    return;
  }
  const result = await svc.recordBulk(req.user!.sellerId!, entries as Parameters<typeof svc.recordBulk>[1]);
  success(res, result, 200);
  void audit.log({
    sellerId: req.user!.sellerId!, userId: req.user!.userId,
    action: 'PAYMENTS_BULK', entityType: 'PAYMENT', entityId: 'bulk',
    description: `Bulk payment entry — ${result.succeeded} succeeded, ${result.failed.length} failed`,
    meta: { total: result.total, succeeded: result.succeeded, failed: result.failed.length },
    ...auditCtx(req),
  }).catch(console.error);
}

export async function recordPayment(req: AuthRequest, res: Response) {
  const result = await svc.record(req.user!.sellerId!, req.body);
  success(res, result, 201);
  void audit.log({
    sellerId: req.user!.sellerId!, userId: req.user!.userId,
    action: 'PAYMENT_RECORDED', entityType: 'PAYMENT', entityId: result.payment.id,
    description: `Payment PKR ${Number(result.payment.amount).toLocaleString()} via ${result.payment.method}${result.completed ? ' — installment fully paid' : ` — PKR ${result.remaining.toLocaleString()} remaining`}`,
    meta: { amount: result.payment.amount, method: result.payment.method, remaining: result.remaining, completed: result.completed },
    ...auditCtx(req),
  }).catch(console.error);
}

// ── JazzCash payment links ────────────────────────────────────────────────────

export async function generateJazzCashLink(req: AuthRequest, res: Response) {
  const { installmentId, amount, customerName, customerPhone, description } = req.body as {
    installmentId: string;
    amount:        number;
    customerName:  string;
    customerPhone: string;
    description?:  string;
  };

  if (!installmentId || !amount || !customerName) {
    res.status(400).json({ success: false, error: 'installmentId, amount, customerName required' });
    return;
  }

  const link = createJazzCashLink({
    installmentId, amount, customerName,
    customerPhone: customerPhone ?? '',
    sellerId: req.user!.sellerId!,
    description,
  });

  const redirectUrl = link.configured && link.txnRefNo
    ? `${req.protocol}://${req.get('host')}/api/payments/jazzcash-pay/${link.txnRefNo}`
    : null;

  const amountFmt = Number(amount).toLocaleString('en-PK', { maximumFractionDigits: 0 });
  const whatsappMsg = redirectUrl
    ? `Assalamu Alaikum ${customerName},\n\nKindly pay PKR ${amountFmt} via JazzCash:\n${redirectUrl}\n\nLink expires in 2 hours.`
    : `Assalamu Alaikum ${customerName},\n\nKindly pay PKR ${amountFmt} via JazzCash. Shukriya!`;

  success(res, {
    configured:    link.configured,
    txnRefNo:      link.txnRefNo || null,
    redirectUrl,
    whatsappMsg,
    amount,
  });
}

export async function jazzCashPayPage(req: Request, res: Response) {
  const { txnRefNo } = req.params as { txnRefNo: string };
  const html = buildPayPageHtml(txnRefNo);
  if (!html) {
    res.status(404).send('Payment link expired or not found');
    return;
  }
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
}

export async function jazzCashCallback(req: Request, res: Response) {
  const params = req.body as Record<string, string>;

  if (!verifyCallbackHash(params)) {
    res.status(400).json({ error: 'Invalid signature' });
    return;
  }

  const { pp_ResponseCode, pp_TxnRefNo, pp_Amount } = params;

  if (pp_ResponseCode !== '000') {
    // Payment failed or cancelled — nothing to record
    res.json({ received: true, recorded: false, reason: 'non-success response code' });
    return;
  }

  const link = getPendingLink(pp_TxnRefNo ?? '');
  if (!link) {
    res.json({ received: true, recorded: false, reason: 'link not found (may have expired)' });
    return;
  }

  try {
    const amount = pp_Amount ? Math.round(Number(pp_Amount) / 100) : link.amount;
    await svc.record(link.sellerId, {
      installmentId: link.installmentId,
      amount,
      method: 'JAZZCASH',
      note:   `JazzCash — ref ${pp_TxnRefNo}`,
    });
    res.json({ received: true, recorded: true });
  } catch (err) {
    console.error('JazzCash callback record error:', err);
    res.json({ received: true, recorded: false, reason: String(err) });
  }
}

export function jazzCashStatus(_req: Request, res: Response) {
  res.json({ configured: isJazzCashConfigured() });
}
