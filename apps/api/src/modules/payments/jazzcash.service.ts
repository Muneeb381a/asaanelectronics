import crypto from 'crypto';
import { and, eq, gt, isNull, lt } from 'drizzle-orm';
import { env } from '../../config/env.js';
import { db } from '../../db/index.js';
import { jazzcashLinks } from '../../db/schema.js';

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

const LINK_TTL_MS = 4 * 60 * 60 * 1000;

// Opportunistic cleanup of expired rows (serverless: no long-lived timers).
async function pruneExpired() {
  await db.delete(jazzcashLinks).where(lt(jazzcashLinks.expiresAt, new Date(Date.now() - 24 * 60 * 60 * 1000))).catch(() => undefined);
}

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

export async function createJazzCashLink(opts: {
  installmentId: string;
  amount:        number;
  customerName:  string;
  customerPhone: string;
  sellerId:      string;
  description?:  string;
}): Promise<PendingJazzCashLink & { configured: boolean }> {
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

  await db.insert(jazzcashLinks).values({
    txnRefNo,
    sellerId:      opts.sellerId,
    installmentId: opts.installmentId,
    amount:        String(opts.amount),
    customerName:  opts.customerName,
    params:        ppFiltered,
    formUrl,
    expiresAt:     new Date(Date.now() + LINK_TTL_MS),
  });
  void pruneExpired();

  return { ...link, configured: true };
}

export async function getPendingLink(txnRefNo: string): Promise<PendingJazzCashLink | undefined> {
  const [row] = await db.select().from(jazzcashLinks)
    .where(and(eq(jazzcashLinks.txnRefNo, txnRefNo), gt(jazzcashLinks.expiresAt, new Date()), isNull(jazzcashLinks.recordedAt)));
  if (!row) return undefined;
  return {
    installmentId: row.installmentId,
    amount:        Number(row.amount),
    customerName:  row.customerName,
    sellerId:      row.sellerId,
    txnRefNo:      row.txnRefNo,
    params:        row.params,
    formUrl:       row.formUrl,
    createdAt:     row.createdAt.getTime(),
  };
}

/** Marks a link consumed so a replayed callback cannot record the payment twice. */
export async function markLinkRecorded(txnRefNo: string): Promise<boolean> {
  const rows = await db.update(jazzcashLinks).set({ recordedAt: new Date() })
    .where(and(eq(jazzcashLinks.txnRefNo, txnRefNo), isNull(jazzcashLinks.recordedAt)))
    .returning({ txnRefNo: jazzcashLinks.txnRefNo });
  return rows.length > 0;
}

export function verifyCallbackHash(params: Record<string, string>): boolean {
  const salt = env.JAZZCASH_INTEGRITY_SALT;
  if (!salt) return false;
  const { pp_SecureHash: receivedHash, ...rest } = params;
  const computed = secureHash(salt, rest);
  return computed === receivedHash?.toUpperCase();
}

export async function buildPayPageHtml(txnRefNo: string): Promise<string | null> {
  const link = await getPendingLink(txnRefNo);
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
