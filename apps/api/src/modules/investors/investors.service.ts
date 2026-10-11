import { and, eq, isNull, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { db } from '../../db/index.js';
import { investors, investorContributions, investorPayouts, ledgerEntries } from '../../db/schema.js';
import { AppError } from '../../middleware/error.js';
import { accountingSvc } from '../accounting/accounting.service.js';

export class InvestorsService {
  async list(sellerId: string) {
    const rows = await db.execute<{
      id: string; name: string; phone: string | null; cnic: string | null;
      profit_share_percent: string; notes: string | null; is_active: boolean; created_at: string;
      total_contributed: string; total_paid_out: string; last_payout_period: string | null;
    }>(sql`
      SELECT
        i.id, i.name, i.phone, i.cnic, i.profit_share_percent, i.notes, i.is_active, i.created_at,
        COALESCE(c.total, 0)::text AS total_contributed,
        COALESCE(p.total, 0)::text AS total_paid_out,
        p.last_period AS last_payout_period
      FROM investors i
      LEFT JOIN (
        SELECT investor_id, SUM(amount::numeric) AS total
        FROM investor_contributions GROUP BY investor_id
      ) c ON c.investor_id = i.id
      LEFT JOIN (
        SELECT investor_id, SUM(amount::numeric) AS total, MAX(period) AS last_period
        FROM investor_payouts GROUP BY investor_id
      ) p ON p.investor_id = i.id
      WHERE i.seller_id = ${sellerId} AND i.deleted_at IS NULL
      ORDER BY i.is_active DESC, i.name ASC
    `);

    return rows.map((r) => ({
      id:                 r.id,
      name:               r.name,
      phone:              r.phone,
      cnic:               r.cnic,
      profitSharePercent: Number(r.profit_share_percent),
      notes:              r.notes,
      isActive:           r.is_active,
      createdAt:          r.created_at,
      totalContributed:   Number(r.total_contributed),
      totalPaidOut:       Number(r.total_paid_out),
      netPosition:        Number(r.total_contributed) - Number(r.total_paid_out),
      lastPayoutPeriod:   r.last_payout_period,
    }));
  }

  async create(sellerId: string, body: { name: string; phone?: string; cnic?: string; profitSharePercent: number; notes?: string }) {
    const [row] = await db
      .insert(investors)
      .values({ id: randomUUID(), sellerId, ...body, profitSharePercent: String(body.profitSharePercent) })
      .returning();
    return row;
  }

  async update(id: string, sellerId: string, body: {
    name?: string; phone?: string | null; cnic?: string | null;
    profitSharePercent?: number; notes?: string | null; isActive?: boolean;
  }) {
    const { profitSharePercent, ...rest } = body;
    const [row] = await db
      .update(investors)
      .set({ ...rest, ...(profitSharePercent !== undefined && { profitSharePercent: String(profitSharePercent) }) })
      .where(and(eq(investors.id, id), eq(investors.sellerId, sellerId), isNull(investors.deletedAt)))
      .returning();
    if (!row) throw new AppError('Investor not found', 404);
    return row;
  }

  async remove(id: string, sellerId: string, actorId: string | undefined) {
    const [row] = await db
      .update(investors)
      .set({ deletedAt: new Date(), deletedBy: actorId ?? null, isActive: false })
      .where(and(eq(investors.id, id), eq(investors.sellerId, sellerId), isNull(investors.deletedAt)))
      .returning({ id: investors.id });
    if (!row) throw new AppError('Investor not found', 404);
  }

  private async assertInvestor(id: string, sellerId: string) {
    const investor = await db.query.investors.findFirst({
      where: and(eq(investors.id, id), eq(investors.sellerId, sellerId), isNull(investors.deletedAt)),
      columns: { id: true, name: true, profitSharePercent: true },
    });
    if (!investor) throw new AppError('Investor not found', 404);
    return investor;
  }

  // ── Ledger (contributions ∪ payouts) ────────────────────────────────────────

  async getLedger(investorId: string, sellerId: string) {
    const investor = await this.assertInvestor(investorId, sellerId);

    const rows = await db.execute<{
      type: 'CONTRIBUTION' | 'PAYOUT'; id: string; date: string; amount: string;
      note: string | null; period: string | null; method: string | null;
      calculated_share: string | null; by_name: string | null;
    }>(sql`
      SELECT 'CONTRIBUTION' AS type, c.id, c.contributed_on AS date, c.amount,
             c.note, NULL AS period, NULL AS method, NULL AS calculated_share, u.name AS by_name
      FROM investor_contributions c
      LEFT JOIN users u ON u.id = c.recorded_by_id
      WHERE c.investor_id = ${investorId}

      UNION ALL

      SELECT 'PAYOUT' AS type, p.id, p.paid_on AS date, p.amount,
             p.note, p.period, p.method, p.calculated_share, u.name AS by_name
      FROM investor_payouts p
      LEFT JOIN users u ON u.id = p.paid_by_id
      WHERE p.investor_id = ${investorId}

      ORDER BY date DESC
    `);

    let totalContributed = 0, totalPaidOut = 0;
    for (const r of rows) {
      if (r.type === 'CONTRIBUTION') totalContributed += Number(r.amount);
      else                           totalPaidOut += Number(r.amount);
    }

    return {
      investorId: investor.id,
      investorName: investor.name,
      profitSharePercent: Number(investor.profitSharePercent),
      summary: { totalContributed, totalPaidOut, netPosition: totalContributed - totalPaidOut },
      rows: rows.map((r) => ({
        type: r.type,
        id: r.id,
        date: r.date,
        amount: Number(r.amount),
        note: r.note,
        period: r.period,
        method: r.method,
        calculatedShare: r.calculated_share !== null ? Number(r.calculated_share) : null,
        recordedByName: r.by_name,
      })),
    };
  }

  // ── Contributions ────────────────────────────────────────────────────────────

  async addContribution(investorId: string, sellerId: string, actorId: string | undefined, body: {
    amount: number; contributedOn: string; note?: string;
  }) {
    return db.transaction(async (tx) => {
      const investor = await this.assertInvestor(investorId, sellerId);

      const [row] = await tx.insert(investorContributions).values({
        investorId, sellerId,
        amount:        String(body.amount),
        contributedOn: body.contributedOn,
        note:          body.note ?? null,
        recordedById:  actorId ?? null,
      }).returning();

      const memo = `Investor contribution — ${investor.name}`;
      await tx.insert(ledgerEntries).values({
        sellerId,
        type: 'CREDIT',
        category: 'INVESTOR_CONTRIBUTION',
        amount: String(body.amount),
        description: memo,
        date: new Date(body.contributedOn),
        referenceId: row!.id,
        refType: 'MANUAL',
      });
      await accountingSvc.postInvestorContributionEntry(sellerId, { contributionId: row!.id, amount: body.amount, memo, userId: actorId }, tx);

      return { ...row!, amount: Number(row!.amount) };
    });
  }

  async removeContribution(contributionId: string, investorId: string, sellerId: string) {
    return db.transaction(async (tx) => {
      const [contrib] = await tx
        .select({ id: investorContributions.id })
        .from(investorContributions)
        .where(and(
          eq(investorContributions.id, contributionId),
          eq(investorContributions.investorId, investorId),
          eq(investorContributions.sellerId, sellerId),
        ));
      if (!contrib) throw new AppError('Contribution not found', 404);

      await tx.delete(investorContributions).where(eq(investorContributions.id, contributionId));

      await tx.delete(ledgerEntries).where(
        and(eq(ledgerEntries.referenceId, contributionId), eq(ledgerEntries.refType, 'MANUAL'), eq(ledgerEntries.category, 'INVESTOR_CONTRIBUTION')),
      );
      await accountingSvc.voidByRef(sellerId, 'INVESTOR_CONTRIBUTION', contributionId, tx);
    });
  }

  // ── Payouts ──────────────────────────────────────────────────────────────────

  async recordPayout(investorId: string, sellerId: string, actorId: string | undefined, body: {
    period: string; method: 'MANUAL' | 'AUTO'; calculatedShare?: number; amount: number; note?: string; paidOn: string;
  }) {
    return db.transaction(async (tx) => {
      const investor = await this.assertInvestor(investorId, sellerId);

      const existing = await tx
        .select({ id: investorPayouts.id })
        .from(investorPayouts)
        .where(and(eq(investorPayouts.investorId, investorId), eq(investorPayouts.period, body.period)));
      if (existing.length > 0) {
        throw new AppError(`A payout for ${body.period} has already been recorded for this investor`, 409);
      }

      const [row] = await tx.insert(investorPayouts).values({
        investorId, sellerId,
        period:          body.period,
        method:          body.method,
        calculatedShare: body.calculatedShare !== undefined ? String(body.calculatedShare) : null,
        amount:          String(body.amount),
        note:            body.note ?? null,
        paidOn:          body.paidOn,
        paidById:        actorId ?? null,
      }).returning();

      const memo = `Investor profit payout — ${investor.name} (${body.period})`;
      await tx.insert(ledgerEntries).values({
        sellerId,
        type: 'DEBIT',
        category: 'INVESTOR_PAYOUT',
        amount: String(body.amount),
        description: memo,
        date: new Date(body.paidOn),
        referenceId: row!.id,
        refType: 'MANUAL',
      });
      await accountingSvc.postInvestorPayoutEntry(sellerId, { payoutId: row!.id, amount: body.amount, memo, userId: actorId }, tx);

      return {
        ...row!,
        amount: Number(row!.amount),
        calculatedShare: row!.calculatedShare !== null ? Number(row!.calculatedShare) : null,
      };
    });
  }

  async removePayout(payoutId: string, investorId: string, sellerId: string) {
    return db.transaction(async (tx) => {
      const [payout] = await tx
        .select({ id: investorPayouts.id })
        .from(investorPayouts)
        .where(and(
          eq(investorPayouts.id, payoutId),
          eq(investorPayouts.investorId, investorId),
          eq(investorPayouts.sellerId, sellerId),
        ));
      if (!payout) throw new AppError('Payout not found', 404);

      await tx.delete(investorPayouts).where(eq(investorPayouts.id, payoutId));

      await tx.delete(ledgerEntries).where(
        and(eq(ledgerEntries.referenceId, payoutId), eq(ledgerEntries.refType, 'MANUAL'), eq(ledgerEntries.category, 'INVESTOR_PAYOUT')),
      );
      await accountingSvc.voidByRef(sellerId, 'INVESTOR_PAYOUT', payoutId, tx);
    });
  }
}
