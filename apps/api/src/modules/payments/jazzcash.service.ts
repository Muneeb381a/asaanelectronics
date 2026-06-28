import crypto from 'crypto';
import { env } from '../../config/env.js';

export interface PendingJazzCashLink {
  installmentId: string;
  amount:        number;
  customerName:  string;
  sellerId:      string;
  txnRefNo:      string;
  params:        Record<string, string>;
  formUrl:       string;
  createdAt:     number;
}

// In-memory store — links expire after 4h
const pendingLinks = new Map<string, PendingJazzCashLink>();

// Prune expired entries every 15 minutes
setInterval(() => {
  const cutoff = Date.now() - 4 * 60 * 60 * 1000;
  for (const [k, v] of pendingLinks) {
    if (v.createdAt < cutoff) pendingLinks.delete(k);
  }
}, 15 * 60 * 1000);

export function isJazzCashConfigured(): boolean {
  return !!(env.JAZZCASH_MERCHANT_ID && env.JAZZCASH_PASSWORD && env.JAZZCASH_INTEGRITY_SALT);
}

function pad2(n: number) { return String(n).padStart(2, '0'); }

function datetime(d: Date): string {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
}

function secureHash(salt: string, params: Record<string, string>): string {
  const sortedVals = Object.keys(params).sort().map((k) => params[k]!);
  const data = salt + '&' + sortedVals.join('&');
  return crypto.createHmac('sha256', salt).update(data).digest('hex').toUpperCase();
}

export function createJazzCashLink(opts: {
  installmentId: string;
  amount:        number;
  customerName:  string;
  customerPhone: string;
  sellerId:      string;
  description?:  string;
}): PendingJazzCashLink & { configured: boolean } {
  if (!isJazzCashConfigured()) {
    return {
      configured:    false,
      installmentId: opts.installmentId,
      amount:        opts.amount,
      customerName:  opts.customerName,
      sellerId:      opts.sellerId,
      txnRefNo:      '',
      params:        {},
      formUrl:       '',
      createdAt:     Date.now(),
    };
  }

  const merchantId  = env.JAZZCASH_MERCHANT_ID!;
  const password    = env.JAZZCASH_PASSWORD!;
  const salt        = env.JAZZCASH_INTEGRITY_SALT!;
  const returnUrl   = env.JAZZCASH_RETURN_URL ?? 'https://example.com/payment/result';
  const isSandbox   = env.JAZZCASH_SANDBOX !== false;

  const now    = new Date();
  const expiry = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  // TxnRefNo must start with PP and contain only alphanumerics
  const suffix   = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  const txnRefNo = `PP${datetime(now)}${suffix}`;

  const amountPaisa = String(Math.round(opts.amount * 100));

  const pp: Record<string, string> = {
    pp_Amount:              amountPaisa,
    pp_BillReference:       `INST${opts.installmentId.slice(-8).replace(/-/g, '')}`,
    pp_Description:         opts.description ?? `Installment — ${opts.customerName}`,
    pp_Language:            'EN',
    pp_MerchantID:          merchantId,
    pp_Password:            password,
    pp_ReturnURL:           returnUrl,
    pp_TxnCurrency:         'PKR',
    pp_TxnDateTime:         datetime(now),
    pp_TxnExpiryDateTime:   datetime(expiry),
    pp_TxnRefNo:            txnRefNo,
    pp_TxnType:             'MWALLET',
    pp_Version:             '1.1',
    pp_MobileNumber:        opts.customerPhone.replace(/\D/g, '').replace(/^92/, '0').replace(/^0?/, '0').slice(0, 11),
    pp_CNIC:                '',
  };

  // Remove empty values before hashing
  const ppFiltered = Object.fromEntries(Object.entries(pp).filter(([, v]) => v !== ''));
  ppFiltered['pp_SecureHash'] = secureHash(salt, ppFiltered);

  const formUrl = isSandbox
    ? 'https://sandbox.jazzcash.com.pk/CustomerPortal/transact/wizardflow?payment'
    : 'https://payments.jazzcash.com.pk/CustomerPortal/transact/wizardflow?payment';

  const link: PendingJazzCashLink = {
    installmentId: opts.installmentId,
    amount:        opts.amount,
    customerName:  opts.customerName,
    sellerId:      opts.sellerId,
    txnRefNo,
    params:        ppFiltered,
    formUrl,
    createdAt:     Date.now(),
  };

  pendingLinks.set(txnRefNo, link);

  return { ...link, configured: true };
}

export function getPendingLink(txnRefNo: string): PendingJazzCashLink | undefined {
  return pendingLinks.get(txnRefNo);
}

export function verifyCallbackHash(params: Record<string, string>): boolean {
  const salt = env.JAZZCASH_INTEGRITY_SALT;
  if (!salt) return false;
  const { pp_SecureHash: receivedHash, ...rest } = params;
  const computed = secureHash(salt, rest);
  return computed === receivedHash?.toUpperCase();
}

export function buildPayPageHtml(txnRefNo: string): string | null {
  const link = pendingLinks.get(txnRefNo);
  if (!link) return null;

  const fields = Object.entries(link.params)
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${v.replace(/"/g, '&quot;')}" />`)
    .join('\n    ');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Redirecting to JazzCash...</title></head>
<body style="font-family:sans-serif;text-align:center;padding:40px">
  <p style="color:#555;font-size:14px">Please wait, redirecting to JazzCash payment page...</p>
  <form id="f" method="POST" action="${link.formUrl}">
    ${fields}
  </form>
  <script>document.getElementById('f').submit();</script>
</body>
</html>`;
}
