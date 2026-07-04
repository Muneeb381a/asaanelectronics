import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  sellers, installments, payments, customers,
  ledgerEntries, journalEntries, ledgerLines,
  reconciliationRuns, type Anomaly,
} from '../../db/schema.js';

export class ReconciliationService {
  async runForSeller(sellerId: string, trigger: 'SCHEDULED' | 'MANUAL' = 'SCHEDULED') {
    const anomalies: Anomaly[] = [];

    const [ledgerTotal, paymentsTotal] = await Promise.all([
      this.#ledgerCreditTotal(sellerId),
      this.#paymentsTotal(sellerId),
    ]);

    // ── Check 1: Ledger ↔ Payments ───────────────────────────────────
    const diff = Math.abs(ledgerTotal - paymentsTotal);
    if (diff > 1) {
      anomalies.push({
        type: 'LEDGER_PAYMENT_MISMATCH',
        severity: 'HIGH',
        detail: `Ledger credits PKR ${ledgerTotal.toFixed(0)} vs payments total PKR ${paymentsTotal.toFixed(0)} — gap of PKR ${diff.toFixed(0)}`,
        diff,
      });
    }

    // ── Check 2: Installment remaining drift ─────────────────────────
    const drifts = await this.#installmentDrifts(sellerId);
    for (const d of drifts) {
      anomalies.push({
        type: 'INSTALLMENT_REMAINING_DRIFT',
        severity: 'MEDIUM',
        detail: `Installment ${d.id.slice(0, 8).toUpperCase()}: stored remaining PKR ${d.storedRemaining.toFixed(0)}, computed PKR ${d.computedRemaining.toFixed(0)} — drift of PKR ${Math.abs(d.drift).toFixed(0)}`,
        entityId: d.id,
        diff: Math.abs(d.drift),
      });
    }

    // ── Check 3: Journal entry imbalance ─────────────────────────────
    const imbalanced = await this.#journalImbalances(sellerId);
    for (const j of imbalanced) {
      anomalies.push({
        type: 'JOURNAL_IMBALANCE',
        severity: 'HIGH',
        detail: `Journal ${j.id.slice(0, 8).toUpperCase()} (${j.memo}): debits PKR ${j.debitSum.toFixed(0)} ≠ credits PKR ${j.creditSum.toFixed(0)}`,
        entityId: j.id,
        diff: Math.abs(j.debitSum - j.creditSum),
      });
    }

    const [run] = await db.insert(reconciliationRuns).values({
      sellerId,
      trigger,
      status:        anomalies.length === 0 ? 'OK' : 'ANOMALIES',
      anomalyCount:  anomalies.length,
      anomalies,
      ledgerTotal:   String(ledgerTotal),
      paymentsTotal: String(paymentsTotal),
      diff:          String(Math.abs(ledgerTotal - paymentsTotal)),
    }).returning();

    return run!;
  }

  async runForAllSellers() {
    const allSellers = await db.select({ id: sellers.id }).from(sellers);
    const results = await Promise.allSettled(
      allSellers.map((s) => this.runForSeller(s.id, 'SCHEDULED')),
    );
    const failed = results.filter((r) => r.status === 'rejected').length;
    console.log(`[Reconciliation] ${allSellers.length} sellers processed, ${failed} failed`);
    return results;
  }

  async latestForSeller(sellerId: string) {
    const [run] = await db
      .select()
      .from(reconciliationRuns)
      .where(eq(reconciliationRuns.sellerId, sellerId))
      .orderBy(desc(reconciliationRuns.runAt))
      .limit(1);
    return run ?? null;
  }

  async historyForSeller(sellerId: string, limit = 30) {
    return db
      .select({
        id:           reconciliationRuns.id,
        runAt:        reconciliationRuns.runAt,
        trigger:      reconciliationRuns.trigger,
        status:       reconciliationRuns.status,
        anomalyCount: reconciliationRuns.anomalyCount,
        diff:         reconciliationRuns.diff,
      })
      .from(reconciliationRuns)
      .where(eq(reconciliationRuns.sellerId, sellerId))
      .orderBy(desc(reconciliationRuns.runAt))
      .limit(limit);
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  async #ledgerCreditTotal(sellerId: string): Promise<number> {
    const [row] = await db
      .select({ total: sql<number>`COALESCE(SUM(amount)::float, 0)` })
      .from(ledgerEntries)
      .where(and(eq(ledgerEntries.sellerId, sellerId), eq(ledgerEntries.type, 'CREDIT')));
    return Number(row?.total ?? 0);
  }

  async #paymentsTotal(sellerId: string): Promise<number> {
    const [row] = await db
      .select({ total: sql<number>`COALESCE(SUM(${payments.amount})::float, 0)` })
      .from(payments)
      .innerJoin(installments, eq(payments.installmentId, installments.id))
      .innerJoin(customers, eq(installments.customerId, customers.id))
      .where(and(eq(customers.sellerId, sellerId), isNull(payments.deletedAt)));
    return Number(row?.total ?? 0);
  }

  async #installmentDrifts(sellerId: string) {
    const rows = await db
      .select({
        id:             installments.id,
        totalAmount:    installments.totalAmount,
        storedRemaining: installments.remaining,
        paidSum: sql<number>`COALESCE(SUM(${payments.amount}) FILTER (WHERE ${payments.deletedAt} IS NULL), 0)::float`,
      })
      .from(installments)
      .innerJoin(customers, eq(installments.customerId, customers.id))
      .leftJoin(payments, eq(payments.installmentId, installments.id))
      .where(and(eq(customers.sellerId, sellerId), isNull(installments.deletedAt)))
      .groupBy(installments.id, installments.totalAmount, installments.remaining);

    return rows
      .map((r) => {
        const computedRemaining = Number(r.totalAmount) - Number(r.paidSum);
        const drift = Number(r.storedRemaining) - computedRemaining;
        return { id: r.id, storedRemaining: Number(r.storedRemaining), computedRemaining, drift };
      })
      .filter((r) => Math.abs(r.drift) > 1);
  }

  async #journalImbalances(sellerId: string) {
    const rows = await db
      .select({
        id:        journalEntries.id,
        memo:      journalEntries.memo,
        debitSum:  sql<number>`COALESCE(SUM(${ledgerLines.debit})::float, 0)`,
        creditSum: sql<number>`COALESCE(SUM(${ledgerLines.credit})::float, 0)`,
      })
      .from(journalEntries)
      .leftJoin(ledgerLines, eq(ledgerLines.journalId, journalEntries.id))
      .where(eq(journalEntries.sellerId, sellerId))
      .groupBy(journalEntries.id, journalEntries.memo);

    return rows.filter((r) => Math.abs(Number(r.debitSum) - Number(r.creditSum)) > 0.01);
  }
}
