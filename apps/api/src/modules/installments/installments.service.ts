import { randomUUID } from 'crypto';
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { customers, installments, ledgerEntries, payments, products } from '../../db/schema.js';
import { AppError } from '../../middleware/error.js';
import { markUnitSoldInTx, markUnitAvailableInTx } from '../productUnits/productUnits.service.js';
import { fsm } from '../../utils/fsm.js';
import { hashCnicBoth, maskCnic } from '../../utils/hash.js';
import type { ImportInstallmentRow } from '@assaan/shared';

type CreateBody = {
  customerId:        string;
  productId:         string;
  totalAmount:       number;
  downPayment:       number;
  months:            number;
  startDate:         string;
  imeiNumber?:       string;
  cashPrice?:        number;
  profitMarkup?:     number;
  paymentFrequency?: 'monthly' | 'daily';
};

export class InstallmentsService {
  async list(
    sellerId: string, page: number, limit: number,
    status?: string, search?: string, customerId?: string, frequency?: string,
    sortBy: string = 'createdAt', sortDir: string = 'desc',
    staffUserId?: string,
  ) {
    const conditions: SQL[] = [eq(customers.sellerId, sellerId), isNull(installments.deletedAt)];
    // Restrict to staff's own customers when they lack canViewAllInstallments
    if (staffUserId) conditions.push(eq(customers.createdByUserId, staffUserId));
    if (status)     conditions.push(eq(installments.status, status as 'ACTIVE' | 'COMPLETED' | 'DEFAULTED' | 'CANCELLED' | 'CLOSED' | 'PENDING'));
    if (search) {
      const cleanSearch = search.trim().replace(/-/g, '');
      const conds: SQL[] = [
        ilike(customers.name,  `%${cleanSearch}%`),
        ilike(customers.phone, `%${cleanSearch}%`),
      ];
      // If input is longer than 11 digits (e.g. typed with country code or extra chars),
      // also try the first 10/11 digits so partial phone matches still work.
      if (/^\d{12,}$/.test(cleanSearch)) {
        conds.push(ilike(customers.phone, `%${cleanSearch.slice(0, 11)}%`));
        conds.push(ilike(customers.phone, `%${cleanSearch.slice(0, 10)}%`));
      }
      // 13-digit input → could be a CNIC; also do hash lookup
      if (/^\d{13}$/.test(cleanSearch)) {
        const [hmac, legacy] = hashCnicBoth(cleanSearch);
        conds.push(eq(customers.cnicHash, hmac));
        conds.push(eq(customers.cnicHash, legacy));
      }
      conditions.push(or(...conds)!);
    }
    if (customerId) conditions.push(eq(installments.customerId, customerId));
    if (frequency)  conditions.push(eq(installments.paymentFrequency, frequency as 'monthly' | 'daily'));
    const statusFilter = and(...conditions);

    const sortColMap: Record<string, Parameters<typeof asc>[0]> = {
      createdAt:    installments.createdAt,
      totalAmount:  installments.totalAmount,
      remaining:    installments.remaining,
      monthly:      installments.monthly,
      customerName: customers.name,
    };
    const sortCol = sortColMap[sortBy] ?? installments.createdAt;
    const orderExpr = sortDir === 'asc' ? asc(sortCol) : desc(sortCol);

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
          imeiNumber:        installments.imeiNumber,
          cashPrice:         installments.cashPrice,
          profitMarkup:      installments.profitMarkup,
          paymentFrequency:  installments.paymentFrequency,
          customerArea:      customers.area,
          isOverdue: sql<boolean>`(
            ${installments.status} = 'ACTIVE' AND (
              CASE WHEN ${installments.paymentFrequency} = 'daily'
                THEN ${installments.startDate} + (
                  (GREATEST(0, FLOOR(
                    (${installments.totalAmount}::numeric - ${installments.downPayment}::numeric - ${installments.remaining}::numeric)
                    / NULLIF(${installments.monthly}::numeric, 0)
                  )) + 1) || ' days'
                )::interval
                ELSE ${installments.startDate} + (
                  (GREATEST(0, FLOOR(
                    (${installments.totalAmount}::numeric - ${installments.downPayment}::numeric - ${installments.remaining}::numeric)
                    / NULLIF(${installments.monthly}::numeric, 0)
                  )) + 1) || ' months'
                )::interval
              END
            ) < now()
          )`,
        })
        .from(installments)
        .innerJoin(customers, eq(installments.customerId, customers.id))
        .innerJoin(products, eq(installments.productId, products.id))
        .where(statusFilter)
        .orderBy(orderExpr)
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
        imeiNumber:        installments.imeiNumber,
        cashPrice:         installments.cashPrice,
        profitMarkup:      installments.profitMarkup,
        paymentFrequency:  installments.paymentFrequency,
        customerArea:      customers.area,
        isOverdue: sql<boolean>`(${installments.status} = 'ACTIVE' AND (
          CASE WHEN ${installments.paymentFrequency} = 'daily'
            THEN (${installments.startDate} + (${installments.months} || ' days')::interval) < now()
            ELSE (${installments.startDate} + (${installments.months} || ' months')::interval) < now()
          END
        ))`,
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
    // Quick pre-check (not race-safe, but gives fast error for obvious OOS)
    if (product.stock < 1) throw new AppError('Product is out of stock', 400);

    const blacklisted = await db.query.installments.findFirst({
      where: and(eq(installments.customerId, body.customerId), eq(installments.status, 'DEFAULTED'), isNull(installments.deletedAt)),
      columns: { id: true },
    });
    if (blacklisted) throw new AppError('Customer is blacklisted due to a defaulted installment', 403);

    const remaining = body.totalAmount - body.downPayment;
    const freq = body.paymentFrequency ?? 'monthly';
    // Daily plans round to nearest 5 PKR; monthly plans round to nearest 25 PKR
    const monthly = freq === 'daily'
      ? Math.round((remaining / body.months) / 5) * 5
      : Math.round((remaining / body.months) / 25) * 25;

    return db.transaction(async (tx) => {
      // Advisory lock prevents concurrent invoice number generation for same seller
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${sellerId}))`);

      // Atomically decrement stock only if still > 0 — prevents race condition where
      // two concurrent requests both passed the pre-check but only one should succeed
      const decremented = await tx
        .update(products)
        .set({ stock: sql`${products.stock} - 1` })
        .where(and(eq(products.id, body.productId), sql`${products.stock} > 0`))
        .returning({ stock: products.stock });
      if (!decremented.length) throw new AppError('Product is out of stock', 400);

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

      // 2a. Validate + claim IMEI unit (throws 409 if already sold)
      if (body.imeiNumber) {
        await markUnitSoldInTx(tx, body.imeiNumber, sellerId, 'installment', customer.name);
      }

      // 2b. Insert installment
      const [installment] = await tx
        .insert(installments)
        .values({
          customerId:   body.customerId,
          productId:    body.productId,
          totalAmount:  String(body.totalAmount),
          downPayment:  String(body.downPayment),
          remaining:    String(remaining),
          monthly:      String(monthly.toFixed(2)),
          months:       body.months,
          startDate:    new Date(body.startDate),
          invoiceNumber,
          imeiNumber:       body.imeiNumber ?? null,
          cashPrice:        body.cashPrice    != null ? String(body.cashPrice)    : null,
          profitMarkup:     body.profitMarkup  != null ? String(body.profitMarkup) : null,
          paymentFrequency: freq,
        })
        .returning();

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

      // Return names already in memory — avoids a follow-up getOne() in the controller
      return { ...installment, customerName: customer.name, productName: product.name };
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
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.update(installments).set({ deletedAt: now, deletedBy }).where(eq(installments.id, id));

      // Release the IMEI unit back to available if one was claimed
      if (row.imeiNumber) {
        await markUnitAvailableInTx(tx, row.imeiNumber, sellerId);
      }

      // Soft-delete all payments for this installment
      const affectedPayments = await tx
        .update(payments).set({ deletedAt: now })
        .where(and(eq(payments.installmentId, id), isNull(payments.deletedAt)))
        .returning({ id: payments.id });

      // Clean up ledger entries for all affected payments
      if (affectedPayments.length > 0) {
        await tx.delete(ledgerEntries).where(
          and(
            inArray(ledgerEntries.referenceId, affectedPayments.map((p) => p.id)),
            eq(ledgerEntries.refType, 'PAYMENT'),
          ),
        );
      }
    });
    return row;
  }

  async reschedule(id: string, sellerId: string, body: { newMonths?: number; newMonthly?: number }) {
    const row = await this.getOne(id, sellerId);
    if (row.status !== 'ACTIVE' && row.status !== 'DEFAULTED') {
      throw new AppError('Only active or defaulted installments can be rescheduled', 400);
    }

    const isDaily   = row.paymentFrequency === 'daily';
    const unit      = isDaily ? 'day' : 'month';
    const roundStep = isDaily ? 5 : 25;
    const remaining = Number(row.remaining);
    let newMonthly: number;
    let newMonths: number;

    if (body.newMonths != null) {
      if (body.newMonths < 1) throw new AppError(`Duration must be at least 1 ${unit}`, 400);
      newMonths  = body.newMonths;
      newMonthly = Math.round((remaining / newMonths) / roundStep) * roundStep;
    } else if (body.newMonthly != null) {
      if (body.newMonthly <= 0)        throw new AppError(`Per-${unit} amount must be positive`, 400);
      if (body.newMonthly > remaining) throw new AppError(`Per-${unit} amount cannot exceed remaining balance`, 400);
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

  async update(id: string, sellerId: string, body: {
    totalAmount?: number; downPayment?: number; monthly?: number; months?: number;
    startDate?: string; imeiNumber?: string | null; cashPrice?: number | null;
    profitMarkup?: number | null; paymentFrequency?: 'monthly' | 'daily';
  }) {
    const row = await this.getOne(id, sellerId);

    const patch: Record<string, unknown> = {};

    // Financial fields — recalculate remaining based on what's already been paid
    if (body.totalAmount !== undefined || body.downPayment !== undefined) {
      const newTotal = body.totalAmount ?? Number(row.totalAmount);
      const newDown  = body.downPayment  ?? Number(row.downPayment);
      if (newDown >= newTotal) throw new AppError('Down payment must be less than total amount', 400);
      const alreadyPaid  = Number(row.totalAmount) - Number(row.downPayment) - Number(row.remaining);
      const newRemaining = newTotal - newDown - alreadyPaid;
      if (newRemaining < 0) throw new AppError('Cannot reduce total: customer has already paid more than the new amount', 400);
      patch.totalAmount = String(newTotal.toFixed(2));
      patch.downPayment = String(newDown.toFixed(2));
      patch.remaining   = String(newRemaining.toFixed(2));
      if (newRemaining === 0 && row.status === 'ACTIVE') patch.status = 'COMPLETED';
    }

    if (body.monthly          !== undefined) patch.monthly          = String(body.monthly.toFixed(2));
    if (body.months           !== undefined) patch.months           = body.months;
    if (body.startDate        !== undefined) patch.startDate        = new Date(body.startDate);
    if (body.paymentFrequency !== undefined) patch.paymentFrequency = body.paymentFrequency;
    if (body.imeiNumber       !== undefined) patch.imeiNumber       = body.imeiNumber;
    if (body.cashPrice        !== undefined) patch.cashPrice        = body.cashPrice !== null ? String(body.cashPrice.toFixed(2)) : null;
    if (body.profitMarkup     !== undefined) patch.profitMarkup     = body.profitMarkup !== null ? String(body.profitMarkup.toFixed(2)) : null;

    if (Object.keys(patch).length === 0) throw new AppError('No fields to update', 400);

    const [updated] = await db
      .update(installments)
      .set(patch as Parameters<typeof db.update>[0] extends never ? never : Record<string, unknown>)
      .where(eq(installments.id, id))
      .returning();
    return { ...updated, customerName: row.customerName, productName: row.productName };
  }

  async bulkImport(rows: ImportInstallmentRow[], sellerId: string, createdByUserId: string) {
    let imported = 0;
    let customersCreated = 0;
    let customersLinked  = 0;
    let productsCreated  = 0;
    const errors: Array<{ row: number; message: string }> = [];

    // In-memory caches so same phone/product within one import batch reuses created records
    const customerCache = new Map<string, string>(); // phone → customerId
    const productCache  = new Map<string, string>(); // lower(name) → productId

    for (const [i, row] of rows.entries()) {
      const rowNum = i + 2; // +2: row 1 = header, +1 for 1-based
      try {
        const startDate = new Date(row.startDate);
        if (isNaN(startDate.getTime())) throw new AppError('Invalid start date — use YYYY-MM-DD format', 400);

        // ── 1. Upsert customer by phone ─────────────────────────────────────
        const phoneKey = row.phone.trim();
        let customerId = customerCache.get(phoneKey);

        if (!customerId) {
          const existing = await db
            .select({ id: customers.id })
            .from(customers)
            .where(and(eq(customers.sellerId, sellerId), eq(customers.phone, phoneKey)))
            .limit(1);

          if (existing.length > 0) {
            customerId = existing[0]!.id;
            customersLinked++;
          } else {
            const cnicRaw = row.cnic?.trim() || `IMPORT-${randomUUID()}`;
            const [cnicHash] = hashCnicBoth(cnicRaw);
            const cnicMasked = row.cnic?.trim() ? maskCnic(row.cnic.trim()) : 'XXXXX-XXXXXXX-X';

            const [newCust] = await db
              .insert(customers)
              .values({ sellerId, name: row.customerName.trim(), phone: phoneKey, area: row.area?.trim() || null, cnicHash, cnicMasked, createdByUserId })
              .returning({ id: customers.id });
            customerId = newCust!.id;
            customersCreated++;
          }
          customerCache.set(phoneKey, customerId);
        }

        // ── 2. Upsert product by name (case-insensitive) ────────────────────
        const productKey = row.productName.trim().toLowerCase();
        let productId = productCache.get(productKey);

        if (!productId) {
          const existing = await db
            .select({ id: products.id })
            .from(products)
            .where(and(eq(products.sellerId, sellerId), ilike(products.name, row.productName.trim())))
            .limit(1);

          if (existing.length > 0) {
            productId = existing[0]!.id;
          } else {
            const [newProd] = await db
              .insert(products)
              .values({ sellerId, name: row.productName.trim(), price: String(row.totalAmount), stock: 0 })
              .returning({ id: products.id });
            productId = newProd!.id;
            productsCreated++;
          }
          productCache.set(productKey, productId);
        }

        // ── 3. Dedup check — skip if identical installment already exists ──
        const dup = await db
          .select({ id: installments.id })
          .from(installments)
          .where(and(
            eq(installments.customerId, customerId),
            eq(installments.productId, productId),
            eq(installments.totalAmount, String(row.totalAmount)),
            eq(installments.downPayment, String(row.downPayment)),
            eq(installments.startDate, startDate),
            isNull(installments.deletedAt),
          ))
          .limit(1);

        if (dup.length > 0) {
          errors.push({ row: rowNum, message: `Duplicate — installment for ${row.customerName} (${row.productName}) on this start date already exists` });
          continue;
        }

        // ── 4. Insert installment (no stock decrement — historical data) ────
        const remaining = row.remaining !== undefined ? row.remaining : row.totalAmount - row.downPayment;

        await db.insert(installments).values({
          customerId,
          productId,
          totalAmount:      String(row.totalAmount),
          downPayment:      String(row.downPayment),
          remaining:        String(remaining),
          monthly:          String(row.monthly),
          months:           row.months,
          startDate,
          status:           row.status ?? 'ACTIVE',
          imeiNumber:       row.imeiNumber?.trim() || null,
          paymentFrequency: 'monthly',
        });

        imported++;
      } catch (e: unknown) {
        errors.push({ row: rowNum, message: e instanceof AppError ? e.message : 'Unexpected error' });
      }
    }

    return { imported, customersCreated, customersLinked, productsCreated, errors };
  }
}
