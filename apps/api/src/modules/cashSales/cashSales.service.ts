import { and, desc, eq, gte, ilike, isNull, lte, or, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { cashSales, ledgerEntries, products, users } from '../../db/schema.js';
import { AppError } from '../../middleware/error.js';
import { markUnitSoldInTx, markUnitAvailableInTx, productHasUnits } from '../productUnits/productUnits.service.js';
import { clearSellerStatsCache } from '../stats/stats.service.js';
import { FinancialPeriodsService } from '../expenses/financial-periods.service.js';

const periodsSvc = new FinancialPeriodsService();

// A staff member's running cash balance — everything they've ever collected
// in CASH (sales + installment payments) minus what's been handed over and
// CONFIRMED by the owner. Mirrors handovers.service.ts pendingBalances().
// Deleting or shrinking a CASH transaction can silently push this negative
// if that cash was already counted into a confirmed handover total (which,
// once confirmed, never re-reads live transactions — it's a fixed record of
// what the owner actually received) — verified in production: 63 confirmed
// handovers whose linked items no longer summed to their confirmed amount.
async function staffPendingCashBalance(sellerId: string, staffId: string): Promise<number> {
  const [row] = await db.execute<{ balance: string }>(sql`
    SELECT (
      COALESCE((
        SELECT SUM(p.amount) FROM payments p
        JOIN installments i ON i.id = p.installment_id
        JOIN customers c ON c.id = i.customer_id
        WHERE p.collected_by = ${staffId} AND c.seller_id = ${sellerId}
          AND p.deleted_at IS NULL AND p.method = 'CASH'
      ), 0)
      +
      COALESCE((
        SELECT SUM(amount) FROM cash_sales
        WHERE sold_by_user_id = ${staffId} AND seller_id = ${sellerId} AND method = 'CASH'
      ), 0)
      -
      COALESCE((
        SELECT SUM(confirmed_amount) FROM staff_handovers
        WHERE staff_id = ${staffId} AND seller_id = ${sellerId} AND status = 'CONFIRMED'
      ), 0)
    )::text AS balance
  `);
  return Number(row?.balance ?? 0);
}

type CreateBody = {
  productId:     string;
  quantity:      number;
  amount:        number;
  method:        'CASH' | 'BANK' | 'JAZZCASH' | 'EASYPAISA' | 'OTHER';
  customerName?: string;
  customerPhone?: string;
  imeiNumber?:   string;
  note?:         string;
};

type UpdateBody = {
  amount?:        number;
  method?:        'CASH' | 'BANK' | 'JAZZCASH' | 'EASYPAISA' | 'OTHER';
  customerName?:  string | null;
  customerPhone?: string | null;
  imeiNumber?:    string | null;
  note?:          string | null;
};

export class CashSalesService {
  async list(sellerId: string, page: number, limit: number, from?: string, to?: string, search?: string, staffUserId?: string) {
    const conds = [eq(cashSales.sellerId, sellerId)];
    // Restricted staff only see the sales they made themselves.
    if (staffUserId) conds.push(eq(cashSales.soldByUserId, staffUserId));
    if (from) conds.push(gte(cashSales.createdAt, new Date(from)));
    if (to) {
      const toDate = new Date(to);
      toDate.setUTCHours(23, 59, 59, 999);
      conds.push(lte(cashSales.createdAt, toDate));
    }
    if (search) conds.push(
      or(
        ilike(products.name, `%${search}%`),
        ilike(cashSales.customerName, `%${search}%`),
      )!,
    );

    const where = and(...conds);

    const [rows, [{ count }]] = await Promise.all([
      db
        .select({
          id:            cashSales.id,
          productId:     cashSales.productId,
          quantity:      cashSales.quantity,
          amount:        cashSales.amount,
          method:        cashSales.method,
          customerName:  cashSales.customerName,
          customerPhone: cashSales.customerPhone,
          imeiNumber:    cashSales.imeiNumber,
          note:          cashSales.note,
          soldByUserId:  cashSales.soldByUserId,
          soldByName:    users.name,
          createdAt:     cashSales.createdAt,
          productName:   products.name,
          productCategory: products.category,
        })
        .from(cashSales)
        .innerJoin(products, eq(cashSales.productId, products.id))
        .leftJoin(users, eq(cashSales.soldByUserId, users.id))
        .where(where)
        .orderBy(desc(cashSales.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(cashSales)
        .innerJoin(products, eq(cashSales.productId, products.id))
        .where(where),
    ]);

    return { data: rows, total: count, page, limit };
  }

  async create(sellerId: string, soldByUserId: string, body: CreateBody) {
    const product = await db.query.products.findFirst({
      where: and(eq(products.id, body.productId), eq(products.sellerId, sellerId), isNull(products.deletedAt)),
    });
    if (!product) throw new AppError('Product not found', 404);

    // Phones / vehicles sell one physical unit at a time, identified by IMEI or chassis/engine.
    const serialized = await productHasUnits(db, body.productId, sellerId);
    const serial = body.imeiNumber?.trim() || null;
    if (serialized && !serial) {
      throw new AppError('Is product ki units IMEI / chassis number se register hain — bechne ke liye unit ka number chunein', 400);
    }
    if ((serialized || serial) && body.quantity !== 1) {
      throw new AppError('Unit (IMEI / chassis) ke saath quantity 1 hi ho sakti hai — har unit alag sale hai', 400);
    }
    if (!serialized && product.stock < body.quantity) throw new AppError(`Insufficient stock — only ${product.stock} available`, 400);

    return db.transaction(async (tx) => {
      if (serial) {
        const claim = await markUnitSoldInTx(tx, serial, sellerId, 'cash', body.customerName ?? 'Cash Customer', body.productId);
        if (serialized && !claim.claimed) {
          throw new AppError(`"${serial}" is product ki inventory mein nahi mila — Products › Serials mein check karein`, 400);
        }
      }

      const [sale] = await tx
        .insert(cashSales)
        .values({
          sellerId,
          productId:     body.productId,
          quantity:      body.quantity,
          amount:        String(body.amount),
          method:        body.method,
          customerName:  body.customerName ?? null,
          customerPhone: body.customerPhone ?? null,
          imeiNumber:    body.imeiNumber ?? null,
          note:          body.note ?? null,
          soldByUserId,
        })
        .returning();

      await tx
        .update(products)
        .set({ stock: sql`GREATEST(${products.stock} - ${body.quantity}, 0)` })
        .where(eq(products.id, body.productId));

      await tx.insert(ledgerEntries).values({
        sellerId,
        type:        'CREDIT',
        category:    'CASH',
        amount:      String(body.amount),
        description: `Cash Sale — ${product.name}${body.customerName ? ` · ${body.customerName}` : ''}`,
        referenceId: sale.id,
        refType:     'MANUAL',
      });

      clearSellerStatsCache(sellerId);
      return { ...sale, productName: product.name };
    });
  }

  async update(id: string, sellerId: string, body: UpdateBody) {
    const [existing] = await db
      .select({
        id: cashSales.id, productId: cashSales.productId, amount: cashSales.amount,
        customerName: cashSales.customerName, createdAt: cashSales.createdAt,
        method: cashSales.method, soldByUserId: cashSales.soldByUserId,
      })
      .from(cashSales)
      .where(and(eq(cashSales.id, id), eq(cashSales.sellerId, sellerId)));

    if (!existing) throw new AppError('Cash sale not found', 404);
    if (await periodsSvc.isLocked(sellerId, existing.createdAt))
      throw new AppError('This cash sale is in a locked financial period and cannot be edited. Unlock the period first.', 400);

    const newAmount = body.amount != null ? String(body.amount) : undefined;

    // Shrinking the amount after this cash was already counted into a staff's
    // confirmed handover total can push their pending balance negative — the
    // handover's confirmedAmount is a fixed record of what the owner actually
    // received, it never re-reads live transactions.
    if (newAmount && Number(newAmount) < Number(existing.amount) && existing.method === 'CASH' && existing.soldByUserId) {
      const balance = await staffPendingCashBalance(sellerId, existing.soldByUserId);
      const delta = Number(existing.amount) - Number(newAmount);
      if (balance - delta < -0.01)
        throw new AppError('Lowering this amount would push the seller\'s cash balance negative — this cash may already be counted in a confirmed handover. Adjust the handover instead.', 400);
    }

    return db.transaction(async (tx) => {
      const [updated] = await tx.update(cashSales).set({
        ...(newAmount                  && { amount: newAmount }),
        ...(body.method                && { method: body.method }),
        ...('customerName'  in body    && { customerName:  body.customerName  ?? null }),
        ...('customerPhone' in body    && { customerPhone: body.customerPhone ?? null }),
        ...('imeiNumber'    in body    && { imeiNumber:    body.imeiNumber    ?? null }),
        ...('note'          in body    && { note:          body.note          ?? null }),
      }).where(and(eq(cashSales.id, id), eq(cashSales.sellerId, sellerId))).returning();

      if (newAmount) {
        const [prod] = await tx.select({ name: products.name }).from(products).where(eq(products.id, existing.productId));
        await tx.update(ledgerEntries).set({
          amount:      newAmount,
          description: `Cash Sale — ${prod?.name ?? ''}${body.customerName ? ` · ${body.customerName}` : (existing.customerName ? ` · ${existing.customerName}` : '')}`,
        }).where(and(eq(ledgerEntries.referenceId, id), eq(ledgerEntries.refType, 'MANUAL')));
      }

      return updated;
    }).then((row) => { clearSellerStatsCache(sellerId); return row; });
  }

  async remove(id: string, sellerId: string) {
    const [existing] = await db
      .select({
        id: cashSales.id, productId: cashSales.productId, quantity: cashSales.quantity,
        amount: cashSales.amount, imeiNumber: cashSales.imeiNumber, createdAt: cashSales.createdAt,
        method: cashSales.method, soldByUserId: cashSales.soldByUserId,
      })
      .from(cashSales)
      .where(and(eq(cashSales.id, id), eq(cashSales.sellerId, sellerId)));

    if (!existing) throw new AppError('Cash sale not found', 404);
    if (await periodsSvc.isLocked(sellerId, existing.createdAt))
      throw new AppError('This cash sale is in a locked financial period and cannot be reversed. Unlock the period first.', 400);

    // Cash already physically handed over and confirmed by the owner can't be
    // un-sold digitally — the handover's confirmedAmount is a fixed record of
    // what the owner actually received, it never shrinks when a transaction
    // behind it is later deleted, so removing this sale would silently push
    // the staff's pending balance negative by this amount (and every later
    // sale would read that much short — mirrors the same guard in
    // payments.service.ts remove(), generalized to not depend on whether the
    // greedy handover-item matcher happened to claim this specific row).
    if (existing.method === 'CASH' && existing.soldByUserId) {
      const balance = await staffPendingCashBalance(sellerId, existing.soldByUserId);
      if (balance - Number(existing.amount) < -0.01)
        throw new AppError('This cash was already handed over and confirmed — cancelling it would push the seller\'s balance negative. Adjust the handover instead.', 400);
    }

    await db.transaction(async (tx) => {
      await tx.delete(cashSales).where(eq(cashSales.id, id));

      if (existing.imeiNumber) {
        await markUnitAvailableInTx(tx, existing.imeiNumber, sellerId);
      }

      await tx
        .update(products)
        .set({ stock: sql`${products.stock} + ${existing.quantity}` })
        .where(eq(products.id, existing.productId));

      await tx.delete(ledgerEntries).where(
        and(eq(ledgerEntries.referenceId, id), eq(ledgerEntries.refType, 'MANUAL')),
      );
    });

    clearSellerStatsCache(sellerId);
    return existing;
  }
}
