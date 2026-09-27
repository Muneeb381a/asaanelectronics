import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { AppError } from '../../middleware/error.js';
import { invalidateSessionCache } from '../../middleware/auth.js';
import { PLAN_LIMITS, type Plan } from '../../config/plans.js';
import {
  sellers, users, customers, products, categoryTemplates, suppliers, supplierInvoices,
  supplierInvoiceLines, supplierPayments, chartOfAccounts, journalEntries, ledgerLines,
  installments, payments, verifications, recoveryActions, returns, customerNotes,
  customerDocuments, customerAssignments, expenses, ledgerEntries, cashSales, auditLogs,
  paymentAccounts, productUnits, staffHandovers, whatsappTemplates, reconciliationRuns,
  financialPeriods, attendance, commissionPayments, salaryPayments, salaryDeductions,
  jazzcashLinks, tradeIns, repossessions, refreshTokens, superAdminAuditLogs,
} from '../../db/schema.js';
import { uploadBackupObject, fetchBackupBuffer, listBackupObjects, backupsConfigured } from './r2.js';

export type BackupTrigger = 'auto' | 'manual' | 'pre-restore' | 'shop_deleted';

export interface BackupListItem {
  id: string; // the R2 object key, used as the opaque backup id in the API
  trigger: BackupTrigger;
  createdAt: string;
  sizeBytes: number;
}

// Everything that has a direct `sellerId` column, in dependency order (parents before
// children) — this exact order is used to insert on restore, and reversed to delete.
// installments / payments / verifications / ledgerLines are scoped indirectly (via a
// join) and are spliced in by hand below at the point their dependency is satisfied.
const DIRECT_TABLES = [
  ['users', users], ['customers', customers], ['products', products],
  ['categoryTemplates', categoryTemplates], ['suppliers', suppliers],
  ['supplierInvoices', supplierInvoices], ['supplierInvoiceLines', supplierInvoiceLines],
  ['supplierPayments', supplierPayments], ['chartOfAccounts', chartOfAccounts],
  ['journalEntries', journalEntries],
  // ledgerLines, installments, payments, verifications go here — see buildSnapshot/restoreBackup
  ['recoveryActions', recoveryActions], ['returns', returns], ['customerNotes', customerNotes],
  ['customerDocuments', customerDocuments], ['customerAssignments', customerAssignments],
  ['expenses', expenses], ['ledgerEntries', ledgerEntries], ['cashSales', cashSales],
  ['auditLogs', auditLogs], ['paymentAccounts', paymentAccounts], ['productUnits', productUnits],
  ['staffHandovers', staffHandovers], ['whatsappTemplates', whatsappTemplates],
  ['reconciliationRuns', reconciliationRuns], ['financialPeriods', financialPeriods],
  ['attendance', attendance], ['commissionPayments', commissionPayments],
  ['salaryPayments', salaryPayments], ['salaryDeductions', salaryDeductions],
  ['jazzcashLinks', jazzcashLinks], ['tradeIns', tradeIns], ['repossessions', repossessions],
] as const;

interface BackupSnapshot {
  version: 1;
  sellerId: string;
  shopName: string;
  createdAt: string;
  tables: Record<string, unknown[]>;
}

function assertBackupsConfigured() {
  if (!backupsConfigured()) throw new AppError('Backups are not configured on this server yet.', 503);
}

async function buildSnapshot(sellerId: string): Promise<BackupSnapshot> {
  const seller = await db.query.sellers.findFirst({ where: eq(sellers.id, sellerId) });
  if (!seller) throw new AppError('Shop not found', 404);

  const tables: Record<string, unknown[]> = { sellers: [seller] };
  for (const [key, table] of DIRECT_TABLES) {
    tables[key] = await db.select().from(table as any).where(eq((table as any).sellerId, sellerId));
  }

  const customerIds = (tables.customers as { id: string }[]).map((c) => c.id);
  tables.installments = customerIds.length
    ? await db.select().from(installments).where(inArray(installments.customerId, customerIds))
    : [];
  const installmentIds = (tables.installments as { id: string }[]).map((i) => i.id);
  tables.payments = installmentIds.length
    ? await db.select().from(payments).where(inArray(payments.installmentId, installmentIds))
    : [];
  tables.verifications = customerIds.length
    ? await db.select().from(verifications).where(inArray(verifications.customerId, customerIds))
    : [];
  const journalIds = (tables.journalEntries as { id: string }[]).map((j) => j.id);
  tables.ledgerLines = journalIds.length
    ? await db.select().from(ledgerLines).where(inArray(ledgerLines.journalId, journalIds))
    : [];

  return { version: 1, sellerId, shopName: seller.shopName, createdAt: new Date().toISOString(), tables };
}

function backupKey(sellerId: string, trigger: BackupTrigger, when: Date): string {
  return `backups/${sellerId}/${when.toISOString().slice(0, 10)}-${trigger}-${when.getTime()}.json.gz`;
}

function parseKey(key: string): { trigger: BackupTrigger; stamp: number } | null {
  const m = /^backups\/[^/]+\/\d{4}-\d{2}-\d{2}-(auto|manual|pre-restore|shop_deleted)-(\d+)\.json\.gz$/.exec(key);
  if (!m) return null;
  return { trigger: m[1] as BackupTrigger, stamp: Number(m[2]) };
}

function assertOwnedKey(sellerId: string, key: string) {
  if (!key.startsWith(`backups/${sellerId}/`) || !parseKey(key)) throw new AppError('Backup not found', 404);
}

export async function createBackup(sellerId: string, trigger: BackupTrigger): Promise<{ id: string; sizeBytes: number }> {
  assertBackupsConfigured();
  const snapshot = await buildSnapshot(sellerId);
  const key = backupKey(sellerId, trigger, new Date());
  const { sizeBytes } = await uploadBackupObject(key, snapshot);
  return { id: key, sizeBytes };
}

export async function listBackups(sellerId: string): Promise<BackupListItem[]> {
  if (!backupsConfigured()) return [];
  const objects = await listBackupObjects(`backups/${sellerId}/`);
  const items: BackupListItem[] = [];
  for (const o of objects) {
    const parsed = parseKey(o.key);
    if (!parsed) continue;
    items.push({ id: o.key, trigger: parsed.trigger, createdAt: new Date(parsed.stamp).toISOString(), sizeBytes: o.sizeBytes });
  }
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getBackupFile(sellerId: string, key: string): Promise<Buffer> {
  assertBackupsConfigured();
  assertOwnedKey(sellerId, key);
  return fetchBackupBuffer(key);
}

// JSON round-tripping turns every Date into an ISO string; timestamp columns need a
// real Date instance back before insert. Detected by shape (has a time component),
// not by schema introspection — plain 'YYYY-MM-DD' date-mode columns are left as-is.
const ISO_WITH_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
function reviveDates(rows: unknown[]): Record<string, unknown>[] {
  return (rows as Record<string, unknown>[]).map((row) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) out[k] = typeof v === 'string' && ISO_WITH_TIME.test(v) ? new Date(v) : v;
    return out;
  });
}

const INSERT_CHUNK = 200;

export async function restoreBackup(sellerId: string, key: string): Promise<void> {
  assertBackupsConfigured();
  assertOwnedKey(sellerId, key);
  const snapshot = JSON.parse((await fetchBackupBuffer(key)).toString('utf8')) as BackupSnapshot;
  if (snapshot.sellerId !== sellerId) throw new AppError('This backup does not belong to this shop.', 400);

  // Mandatory safety net — restore is the one action that can destroy today's live
  // data, so the current state is snapshotted first, unconditionally. A mistaken
  // restore is itself always undoable.
  await createBackup(sellerId, 'pre-restore');

  await db.transaction(async (tx) => {
    const t = snapshot.tables;

    const insertChunked = async (table: any, rows: unknown[] | undefined) => {
      const list = rows ?? [];
      if (!list.length) return;
      const revived = reviveDates(list);
      for (let i = 0; i < revived.length; i += INSERT_CHUNK) {
        await tx.insert(table).values(revived.slice(i, i + INSERT_CHUNK) as any);
      }
    };

    // ── Delete phase: leaves first. Id sets for the join-scoped tables are looked
    // up before their parents are deleted. ─────────────────────────────────────
    const currentCustomerIds = (await tx.select({ id: customers.id }).from(customers).where(eq(customers.sellerId, sellerId))).map((r) => r.id);
    const currentInstallmentIds = currentCustomerIds.length
      ? (await tx.select({ id: installments.id }).from(installments).where(inArray(installments.customerId, currentCustomerIds))).map((r) => r.id)
      : [];
    const currentJournalIds = (await tx.select({ id: journalEntries.id }).from(journalEntries).where(eq(journalEntries.sellerId, sellerId))).map((r) => r.id);

    await tx.delete(repossessions).where(eq(repossessions.sellerId, sellerId));
    await tx.delete(tradeIns).where(eq(tradeIns.sellerId, sellerId));
    await tx.delete(jazzcashLinks).where(eq(jazzcashLinks.sellerId, sellerId));
    await tx.delete(salaryDeductions).where(eq(salaryDeductions.sellerId, sellerId));
    await tx.delete(salaryPayments).where(eq(salaryPayments.sellerId, sellerId));
    await tx.delete(commissionPayments).where(eq(commissionPayments.sellerId, sellerId));
    await tx.delete(attendance).where(eq(attendance.sellerId, sellerId));
    await tx.delete(financialPeriods).where(eq(financialPeriods.sellerId, sellerId));
    await tx.delete(reconciliationRuns).where(eq(reconciliationRuns.sellerId, sellerId));
    await tx.delete(whatsappTemplates).where(eq(whatsappTemplates.sellerId, sellerId));
    await tx.delete(staffHandovers).where(eq(staffHandovers.sellerId, sellerId));
    await tx.delete(productUnits).where(eq(productUnits.sellerId, sellerId));
    await tx.delete(paymentAccounts).where(eq(paymentAccounts.sellerId, sellerId));
    await tx.delete(auditLogs).where(eq(auditLogs.sellerId, sellerId));
    await tx.delete(cashSales).where(eq(cashSales.sellerId, sellerId));
    await tx.delete(customerAssignments).where(eq(customerAssignments.sellerId, sellerId));
    await tx.delete(customerDocuments).where(eq(customerDocuments.sellerId, sellerId));
    await tx.delete(customerNotes).where(eq(customerNotes.sellerId, sellerId));
    await tx.delete(returns).where(eq(returns.sellerId, sellerId));
    await tx.delete(recoveryActions).where(eq(recoveryActions.sellerId, sellerId));
    if (currentJournalIds.length) await tx.delete(ledgerLines).where(inArray(ledgerLines.journalId, currentJournalIds));
    if (currentCustomerIds.length) await tx.delete(verifications).where(inArray(verifications.customerId, currentCustomerIds));
    if (currentInstallmentIds.length) await tx.delete(payments).where(inArray(payments.installmentId, currentInstallmentIds));
    if (currentCustomerIds.length) await tx.delete(installments).where(inArray(installments.customerId, currentCustomerIds));
    await tx.delete(journalEntries).where(eq(journalEntries.sellerId, sellerId));
    await tx.delete(chartOfAccounts).where(eq(chartOfAccounts.sellerId, sellerId));
    await tx.delete(ledgerEntries).where(eq(ledgerEntries.sellerId, sellerId));
    await tx.delete(expenses).where(eq(expenses.sellerId, sellerId));
    await tx.delete(supplierPayments).where(eq(supplierPayments.sellerId, sellerId));
    await tx.delete(supplierInvoiceLines).where(eq(supplierInvoiceLines.sellerId, sellerId));
    await tx.delete(supplierInvoices).where(eq(supplierInvoices.sellerId, sellerId));
    await tx.delete(suppliers).where(eq(suppliers.sellerId, sellerId));
    await tx.delete(categoryTemplates).where(eq(categoryTemplates.sellerId, sellerId));
    await tx.delete(products).where(eq(products.sellerId, sellerId));
    await tx.delete(customers).where(eq(customers.sellerId, sellerId));
    await tx.delete(users).where(eq(users.sellerId, sellerId));

    // ── Insert phase: roots first ─────────────────────────────────────────────
    await insertChunked(users, t.users);
    await insertChunked(customers, t.customers);
    await insertChunked(products, t.products);
    await insertChunked(categoryTemplates, t.categoryTemplates);
    await insertChunked(suppliers, t.suppliers);
    await insertChunked(supplierInvoices, t.supplierInvoices);
    await insertChunked(supplierInvoiceLines, t.supplierInvoiceLines);
    await insertChunked(supplierPayments, t.supplierPayments);
    await insertChunked(chartOfAccounts, t.chartOfAccounts);
    await insertChunked(journalEntries, t.journalEntries);
    await insertChunked(ledgerLines, t.ledgerLines);
    await insertChunked(installments, t.installments);
    await insertChunked(payments, t.payments);
    await insertChunked(verifications, t.verifications);
    await insertChunked(recoveryActions, t.recoveryActions);
    await insertChunked(returns, t.returns);
    await insertChunked(customerNotes, t.customerNotes);
    await insertChunked(customerDocuments, t.customerDocuments);
    await insertChunked(customerAssignments, t.customerAssignments);
    await insertChunked(expenses, t.expenses);
    await insertChunked(ledgerEntries, t.ledgerEntries);
    await insertChunked(cashSales, t.cashSales);
    // sessionId points at refreshTokens, which are never backed up (ephemeral) —
    // null it out so a stale id from the snapshot can't fail the insert's FK.
    const auditRows = ((t.auditLogs ?? []) as Record<string, unknown>[]).map((r) => ({ ...r, sessionId: null }));
    await insertChunked(auditLogs, auditRows);
    await insertChunked(paymentAccounts, t.paymentAccounts);
    await insertChunked(productUnits, t.productUnits);
    await insertChunked(staffHandovers, t.staffHandovers);
    await insertChunked(whatsappTemplates, t.whatsappTemplates);
    await insertChunked(reconciliationRuns, t.reconciliationRuns);
    await insertChunked(financialPeriods, t.financialPeriods);
    await insertChunked(attendance, t.attendance);
    await insertChunked(commissionPayments, t.commissionPayments);
    await insertChunked(salaryPayments, t.salaryPayments);
    await insertChunked(salaryDeductions, t.salaryDeductions);
    await insertChunked(jazzcashLinks, t.jazzcashLinks);
    await insertChunked(tradeIns, t.tradeIns);
    await insertChunked(repossessions, t.repossessions);

    // The shop's own profile/settings — never plan/isActive/trialApprovalStatus, which
    // are platform-administered and must not be silently reverted by a data restore.
    const backedUpSeller = (t.sellers as Record<string, unknown>[] | undefined)?.[0];
    if (backedUpSeller) {
      await tx.update(sellers).set({
        shopName:     backedUpSeller.shopName as string,
        phone:        backedUpSeller.phone as string,
        address:      backedUpSeller.address as string | null,
        murabahaMode: backedUpSeller.murabahaMode as boolean,
        settings:     backedUpSeller.settings as any,
      }).where(eq(sellers.id, sellerId));
    }
  });

  // Users/passwords were just rolled back — every existing session for this shop is
  // now stale and must re-authenticate, same as a suspend forces re-login.
  const shopUserIds = (await db.select({ id: users.id }).from(users).where(eq(users.sellerId, sellerId))).map((r) => r.id);
  if (shopUserIds.length) {
    await db.delete(refreshTokens).where(inArray(refreshTokens.userId, shopUserIds));
  }
  invalidateSessionCache();
}

// Nightly cron: backs up the batch of eligible shops most overdue for one. One shop's
// failure never aborts the batch — it's logged and simply retried the next night,
// since a failed shop's lastBackupAt is left unchanged and sorts back to the front.
export async function runNightlyBatch(batchSize = 50): Promise<{ attempted: number; succeeded: number; failed: number }> {
  if (!backupsConfigured()) return { attempted: 0, succeeded: 0, failed: 0 };

  const eligiblePlans = (Object.keys(PLAN_LIMITS) as Plan[]).filter((p) => PLAN_LIMITS[p].hasAutomaticBackups);
  const candidates = await db.select({ id: sellers.id })
    .from(sellers)
    .where(and(isNull(sellers.deletedAt), inArray(sellers.plan, eligiblePlans)))
    .orderBy(sql`${sellers.lastBackupAt} asc nulls first`)
    .limit(batchSize);

  let succeeded = 0;
  let failed = 0;
  for (const { id } of candidates) {
    try {
      await createBackup(id, 'auto');
      await db.update(sellers).set({ lastBackupAt: new Date() }).where(eq(sellers.id, id));
      succeeded++;
    } catch (err) {
      failed++;
      await db.insert(superAdminAuditLogs).values({
        action: 'BACKUP_FAILED',
        sellerId: id,
        note: err instanceof Error ? err.message : 'Unknown error',
      }).catch(() => {});
    }
  }
  return { attempted: candidates.length, succeeded, failed };
}
