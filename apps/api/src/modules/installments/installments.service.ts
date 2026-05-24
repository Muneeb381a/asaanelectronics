import { and, desc, eq, ilike, isNull, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { customers, installments, ledgerEntries, payments, products } from '../../db/schema.js';
import { AppError } from '../../middleware/error.js';
import { fsm } from '../../utils/fsm.js';

type CreateBody = {
  customerId: string;
  productId: string;
  totalAmount: number;
  downPayment: number;
  months: number;
  startDate: string;
};

export class InstallmentsService {
  async list(sellerId: string, page: number, limit: number, status?: string, search?: string, customerId?: string) {
    const conditions: SQL[] = [eq(customers.sellerId, sellerId), isNull(installments.deletedAt)];
    if (status)     conditions.push(eq(installments.status, status as 'ACTIVE' | 'COMPLETED' | 'DEFAULTED' | 'CANCELLED'));
    if (search)     conditions.push(ilike(customers.name, `%${search}%`));
    if (customerId) conditions.push(eq(installments.customerId, customerId));
    const statusFilter = and(...conditions);

    const [rows, [{ count }]] = await Promise.all([
      db
        .select({
          id: installments.id,
          customerId: installments.customerId,
          productId: installments.productId,
          totalAmount: installments.totalAmount,
          downPayment: installments.downPayment,
          remaining: installments.remaining,
          monthly: installments.monthly,
          months: installments.months,
          startDate: installments.startDate,
          invoiceNumber: installments.invoiceNumber,
          status: installments.status,
          createdAt: installments.createdAt,
          customerName: customers.name,
          customerPhone: customers.phone,
          productName: products.name,
        })
        .from(installments)
        .innerJoin(customers, eq(installments.customerId, customers.id))
        .innerJoin(products, eq(installments.productId, products.id))
        .where(statusFilter)
        .orderBy(desc(installments.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(installments)
        .innerJoin(customers, eq(installments.customerId, customers.id))
        .where(statusFilter),
    ]);

    return { data: rows, total: count, page, limit };
  }

  async getOne(id: string, sellerId: string) {
    const [row] = await db
      .select({
        id: installments.id,
        customerId: installments.customerId,
        productId: installments.productId,
        totalAmount: installments.totalAmount,
        downPayment: installments.downPayment,
        remaining: installments.remaining,
        monthly: installments.monthly,
        months: installments.months,
        startDate: installments.startDate,
        invoiceNumber: installments.invoiceNumber,
        status: installments.status,
        createdAt: installments.createdAt,
        customerName: customers.name,
        customerPhone: customers.phone,
        productName: products.name,
      })
      .from(installments)
      .innerJoin(customers, eq(installments.customerId, customers.id))
      .innerJoin(products, eq(installments.productId, products.id))
      .where(and(eq(installments.id, id), eq(customers.sellerId, sellerId), isNull(installments.deletedAt)));

    if (!row) throw new AppError('Installment not found', 404);
    return row;
  }

  async create(sellerId: string, body: CreateBody) {
    if (body.downPayment >= body.totalAmount) {
      throw new AppError('Down payment must be less than total amount', 400);
    }

    const [customer, product] = await Promise.all([
      db.query.customers.findFirst({ where: and(eq(customers.id, body.customerId), eq(customers.sellerId, sellerId)) }),
      db.query.products.findFirst({ where: and(eq(products.id, body.productId), eq(products.sellerId, sellerId)) }),
    ]);
    if (!customer) throw new AppError('Customer not found', 404);
    if (!product) throw new AppError('Product not found', 404);
    if (product.stock < 1) throw new AppError('Product is out of stock', 400);

    const blacklisted = await db.query.installments.findFirst({
      where: and(eq(installments.customerId, body.customerId), eq(installments.status, 'DEFAULTED'), isNull(installments.deletedAt)),
      columns: { id: true },
    });
    if (blacklisted) throw new AppError('Customer is blacklisted due to a defaulted installment', 403);

    const remaining = body.totalAmount - body.downPayment;
    const monthly = remaining / body.months;

    return db.transaction(async (tx) => {
      // Advisory lock prevents concurrent invoice number generation for same seller
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${sellerId}))`);

      // 1. Generate sequential invoice number per seller per year
      const year = new Date().getFullYear();
      const [{ nextSeq }] = await tx.execute<{ nextSeq: number }>(sql`
        SELECT COALESCE(
          MAX(CAST(SPLIT_PART(i.invoice_number, '-', 3) AS INTEGER)), 0
        ) + 1 AS "nextSeq"
        FROM installments i
        INNER JOIN customers c ON i.customer_id = c.id
        WHERE c.seller_id = ${sellerId}
          AND i.invoice_number LIKE ${'INV-' + year + '-%'}
      `);
      const invoiceNumber = `INV-${year}-${String(nextSeq).padStart(4, '0')}`;

      // 2. Insert installment
      const [installment] = await tx
        .insert(installments)
        .values({
          customerId: body.customerId,
          productId: body.productId,
          totalAmount: String(body.totalAmount),
          downPayment: String(body.downPayment),
          remaining: String(remaining),
          monthly: String(monthly.toFixed(2)),
          months: body.months,
          startDate: new Date(body.startDate),
          invoiceNumber,
        })
        .returning();

      // 2. Decrement product stock by 1
      await tx
        .update(products)
        .set({ stock: sql`${products.stock} - 1` })
        .where(eq(products.id, body.productId));

      // 3. Record down payment as first payment entry + ledger CREDIT (if > 0)
      if (body.downPayment > 0) {
        const [downPmt] = await tx.insert(payments).values({
          installmentId: installment.id,
          amount: String(body.downPayment),
          method: 'CASH',
          note: 'Down payment',
        }).returning();

        await tx.insert(ledgerEntries).values({
          sellerId,
          type: 'CREDIT',
          category: 'CASH',
          amount: String(body.downPayment),
          description: `Down Payment — ${product.name} · ${customer.name}`,
          referenceId: downPmt.id,
          refType: 'PAYMENT',
        });
      }

      return installment;
    });
  }

  async approve(id: string, sellerId: string) {
    const row = await this.getOne(id, sellerId);
    fsm.installment.assert(row.status, 'ACTIVE');
    const [updated] = await db
      .update(installments).set({ status: 'ACTIVE' })
      .where(eq(installments.id, id)).returning();
    return updated;
  }

  async close(id: string, sellerId: string) {
    const row = await this.getOne(id, sellerId);
    fsm.installment.assert(row.status, 'CLOSED');
    const [updated] = await db
      .update(installments).set({ status: 'CLOSED' })
      .where(eq(installments.id, id)).returning();
    return updated;
  }

  async markDefault(id: string, sellerId: string) {
    const row = await this.getOne(id, sellerId);
    fsm.installment.assert(row.status, 'DEFAULTED');
    const [updated] = await db
      .update(installments).set({ status: 'DEFAULTED' })
      .where(eq(installments.id, id)).returning();
    return updated;
  }

  async cancel(id: string, sellerId: string) {
    const row = await this.getOne(id, sellerId);
    fsm.installment.assert(row.status, 'CANCELLED');

    return db.transaction(async (tx) => {
      if (row.status === 'PENDING') {
        // Restore reserved stock on pre-activation cancel
        await tx.update(products)
          .set({ stock: sql`${products.stock} + 1` })
          .where(eq(products.id, row.productId));
      }
      const [updated] = await tx
        .update(installments).set({ status: 'CANCELLED' })
        .where(eq(installments.id, id)).returning();
      return updated;
    });
  }

  async remove(id: string, sellerId: string, deletedBy: string) {
    const row = await this.getOne(id, sellerId);
    await db.update(installments)
      .set({ deletedAt: new Date(), deletedBy })
      .where(eq(installments.id, id));
    return row;
  }

  async reschedule(id: string, sellerId: string, body: { newMonths?: number; newMonthly?: number }) {
    const row = await this.getOne(id, sellerId);
    if (row.status !== 'ACTIVE' && row.status !== 'DEFAULTED') {
      throw new AppError('Only active or defaulted installments can be rescheduled', 400);
    }

    const remaining = Number(row.remaining);
    let newMonthly: number;
    let newMonths: number;

    if (body.newMonths != null) {
      if (body.newMonths < 1) throw new AppError('Duration must be at least 1 month', 400);
      newMonths  = body.newMonths;
      newMonthly = remaining / newMonths;
    } else if (body.newMonthly != null) {
      if (body.newMonthly <= 0)        throw new AppError('Monthly amount must be positive', 400);
      if (body.newMonthly > remaining) throw new AppError('Monthly amount cannot exceed remaining balance', 400);
      newMonthly = body.newMonthly;
      newMonths  = Math.ceil(remaining / newMonthly);
    } else {
      throw new AppError('Provide newMonths or newMonthly', 400);
    }

    // Rescheduling a DEFAULTED installment recovers it back to ACTIVE
    const statusUpdate = row.status === 'DEFAULTED' ? { status: 'ACTIVE' as const } : {};

    const [updated] = await db
      .update(installments)
      .set({ monthly: String(newMonthly.toFixed(2)), months: newMonths, ...statusUpdate })
      .where(eq(installments.id, id))
      .returning();
    return updated;
  }
}
