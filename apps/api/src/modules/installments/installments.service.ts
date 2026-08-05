import { randomUUID } from 'crypto';
import { and, asc, desc, eq, ilike, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { customers, installments, ledgerEntries, payments, products } from '../../db/schema.js';
import { AppError } from '../../middleware/error.js';
import { markUnitSoldInTx, markUnitAvailableInTx } from '../productUnits/productUnits.service.js';
import { clearSellerStatsCache } from '../stats/stats.service.js';
import { fsm } from '../../utils/fsm.js';
import { hashCnicBoth, maskCnic } from '../../utils/hash.js';
import type { ImportInstallmentRow } from '@assaan/shared';

// Normalise Pakistani phone numbers to 11-digit local format (03xxxxxxxxx)
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('92') && digits.length === 12) return '0' + digits.slice(2);
  if (digits.startsWith('0092') && digits.length === 14) return '0' + digits.slice(4);
  return digits;
}

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
  paymentDueDay?:    number;
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
    if (status) {
      conditions.push(eq(installments.status, status as 'ACTIVE' | 'COMPLETED' | 'DEFAULTED' | 'CANCELLED' | 'CLOSED' | 'PENDING'));
    } else {
      // Default "All" view: hide completed installments from previous months.
      // Completed this month (or completedAt is null but status=COMPLETED → treat as old) stay hidden.
      // Only COMPLETED with completedAt >= start of current month are shown in default view.
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      conditions.push(
        or(
          sql`${installments.status} != 'COMPLETED'`,
          and(
            eq(installments.status, 'COMPLETED'),
            sql`${installments.completedAt} >= ${startOfMonth.toISOString()}`,
          ),
        )!,
      );
    }
    if (search) {
      const cleanSearch = search.trim().replace(/-/g, '');
      const rawSearch = search.trim();
      const conds: SQL[] = [
        ilike(customers.name,  `%${cleanSearch}%`),
        ilike(customers.phone, `%${cleanSearch}%`),
        ilike(customers.fileNumber, `${cleanSearch}%`),
        ilike(installments.invoiceNumber, `%${rawSearch}%`),
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
          paymentDueDay:     installments.paymentDueDay,
          customerArea:      customers.area,
          customerFileNumber: customers.fileNumber,
          customerPhotoUrl:  customers.photoUrl,
          isOverdue: sql<boolean>`(
            ${installments.status} = 'ACTIVE' AND (
              CASE WHEN ${installments.paymentFrequency} = 'daily'
                THEN ${installments.startDate} + (
                  (GREATEST(0, FLOOR(
                    (${installments.totalAmount}::numeric - ${installments.downPayment}::numeric - ${installments.remaining}::numeric)
                    / NULLIF(${installments.monthly}::numeric, 0)
                  )) + 1) || ' days'
                )::interval
                ELSE (
                  DATE_TRUNC('month', ${installments.startDate} + (
                    (GREATEST(0, FLOOR(
                      (${installments.totalAmount}::numeric - ${installments.downPayment}::numeric - ${installments.remaining}::numeric)
                      / NULLIF(${installments.monthly}::numeric, 0)
                    )) + 1) || ' months'
                  )::interval)::date + (${installments.paymentDueDay} - 1)
                )
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
        paymentDueDay:     installments.paymentDueDay,
        customerArea:       customers.area,
        customerFileNumber: customers.fileNumber,
        customerPhotoUrl:   customers.photoUrl,
        pausedUntil:       installments.pausedUntil,
        pauseReason:       installments.pauseReason,
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

    // Manual "Do Not Sell" blacklist check
    if (customer.isBlacklisted) {
      throw new AppError(
        `Customer is blacklisted${customer.blacklistReason ? ': ' + customer.blacklistReason : ''}`,
        403,
      );
    }

    // Auto-blacklist: customer has a prior defaulted installment
    const blacklisted = await db.query.installments.findFirst({
      where: and(eq(installments.customerId, body.customerId), eq(installments.status, 'DEFAULTED'), isNull(installments.deletedAt)),
      columns: { id: true },
    });
    if (blacklisted) throw new AppError('Customer is blacklisted due to a defaulted installment', 403);

    // IMEI duplicate hard block — prevent same IMEI on two active installments
    if (body.imeiNumber) {
      const dupeImei = await db.query.installments.findFirst({
        where: and(
          eq(installments.imeiNumber, body.imeiNumber),
          inArray(installments.status, ['ACTIVE', 'PENDING']),
          isNull(installments.deletedAt),
        ),
        columns: { id: true, imeiNumber: true },
      });
      if (dupeImei) {
        throw new AppError(`IMEI ${body.imeiNumber} is already linked to an active installment`, 409);
      }
    }

    const remaining = body.totalAmount - body.downPayment;
    const freq = body.paymentFrequency ?? 'monthly';
    // Daily plans round to nearest 5 PKR; monthly plans round to nearest 25 PKR
    const monthly = freq === 'daily'
      ? Math.round((remaining / body.months) / 5) * 5
      : Math.round((remaining / body.months) / 25) * 25;

    const result = await db.transaction(async (tx) => {
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
          paymentDueDay:    body.paymentDueDay ?? 10,
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
    clearSellerStatsCache(sellerId);
    return result;
  }

  async approve(id: string, sellerId: string) {
    const row = await this.getOne(id, sellerId);
    fsm.installment.assert(row.status, 'ACTIVE');
    const [updated] = await db
      .update(installments).set({ status: 'ACTIVE' })
      .where(eq(installments.id, id)).returning();
    clearSellerStatsCache(sellerId);
    return updated;
  }

  async close(id: string, sellerId: string) {
    const row = await this.getOne(id, sellerId);
    fsm.installment.assert(row.status, 'CLOSED');
    const [updated] = await db
      .update(installments).set({ status: 'CLOSED' })
      .where(eq(installments.id, id)).returning();
    clearSellerStatsCache(sellerId);
    return updated;
  }

  async markDefault(id: string, sellerId: string) {
    const row = await this.getOne(id, sellerId);
    fsm.installment.assert(row.status, 'DEFAULTED');
    const [updated] = await db
      .update(installments).set({ status: 'DEFAULTED' })
      .where(eq(installments.id, id)).returning();
    clearSellerStatsCache(sellerId);
    return updated;
  }

  async cancel(id: string, sellerId: string) {
    const row = await this.getOne(id, sellerId);
    fsm.installment.assert(row.status, 'CANCELLED');

    const result = await db.transaction(async (tx) => {
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
    clearSellerStatsCache(sellerId);
    return result;
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
    clearSellerStatsCache(sellerId);
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
    clearSellerStatsCache(sellerId);
    return updated;
  }

  async waiver(id: string, sellerId: string, body: { amount: number; reason?: string }) {
    const row = await this.getOne(id, sellerId);
    if (row.status !== 'ACTIVE' && row.status !== 'DEFAULTED') {
      throw new AppError('Balance waiver can only be applied to active or defaulted installments', 400);
    }
    if (body.amount <= 0) throw new AppError('Waiver amount must be positive', 400);

    const currentRemaining = Number(row.remaining);
    if (body.amount > currentRemaining) {
      throw new AppError(`Waiver amount (${body.amount}) exceeds remaining balance (${currentRemaining})`, 400);
    }

    const newRemaining = Number((currentRemaining - body.amount).toFixed(2));
    const isFullyCleared = newRemaining <= 0;

    const result = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(installments)
        .set({
          remaining: String(newRemaining),
          ...(isFullyCleared ? { status: 'COMPLETED', completedAt: new Date() } : {}),
        })
        .where(eq(installments.id, id))
        .returning();

      await tx.insert(ledgerEntries).values({
        sellerId,
        type: 'CREDIT',
        category: 'WAIVER',
        amount: String(body.amount.toFixed(2)),
        description: body.reason
          ? `Balance waiver: ${body.reason}`
          : `Balance waiver on installment ${id.slice(-8)}`,
        referenceId: id,
        refType: 'MANUAL',
      });

      return updated;
    });
    clearSellerStatsCache(sellerId);
    return result;
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
      if (newRemaining === 0 && row.status === 'ACTIVE') { patch.status = 'COMPLETED'; patch.completedAt = new Date(); }
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
    clearSellerStatsCache(sellerId);
    return { ...updated, customerName: row.customerName, productName: row.productName };
  }

  async bulkImport(rows: ImportInstallmentRow[], sellerId: string, createdByUserId: string) {
    let imported = 0;
    let customersCreated = 0;
    let customersLinked  = 0;
    let productsCreated  = 0;
    const errors: Array<{ row: number; message: string }> = [];

    // ── Phase 1: Validate dates upfront ──────────────────────────────────
    type VRow = { row: ImportInstallmentRow; rowNum: number; phoneKey: string; productKey: string; startDate: Date };
    const vRows: VRow[] = [];
    for (const [i, row] of rows.entries()) {
      const rowNum = i + 2;
      const startDate = new Date(row.startDate);
      if (isNaN(startDate.getTime())) {
        errors.push({ row: rowNum, message: 'Invalid start date — use YYYY-MM-DD format' });
        continue;
      }
      vRows.push({ row, rowNum, phoneKey: normalizePhone(row.phone.trim()), productKey: row.productName.trim().toLowerCase(), startDate });
    }
    if (vRows.length === 0) return { imported, customersCreated, customersLinked, productsCreated, errors };

    // ── Phase 2: Batch-resolve customers (1 query + 1 insert if needed) ──
    const uniquePhones = [...new Set(vRows.map(r => r.phoneKey))];
    const existingCusts = await db
      .select({ id: customers.id, phone: customers.phone })
      .from(customers)
      .where(and(eq(customers.sellerId, sellerId), inArray(customers.phone, uniquePhones), isNull(customers.deletedAt)));

    const customerCache = new Map<string, string>(); // phone → customerId
    for (const c of existingCusts) {
      customerCache.set(c.phone, c.id);
      customersLinked++;
    }

    const missingPhones = uniquePhones.filter(p => !customerCache.has(p));
    if (missingPhones.length > 0) {
      // Use first row per phone for name/CNIC/area
      const firstRowByPhone = new Map<string, VRow>();
      for (const vr of vRows) {
        if (!firstRowByPhone.has(vr.phoneKey)) firstRowByPhone.set(vr.phoneKey, vr);
      }
      const insertValues = missingPhones.map(phone => {
        const vr = firstRowByPhone.get(phone)!;
        const cnicRaw = vr.row.cnic?.trim() || `IMPORT-${randomUUID()}`;
        const [cnicHash] = hashCnicBoth(cnicRaw);
        const cnicMasked = vr.row.cnic?.trim() ? maskCnic(vr.row.cnic.trim()) : 'XXXXX-XXXXXXX-X';
        return { sellerId, name: vr.row.customerName.trim(), phone, area: vr.row.area?.trim() || null, cnicHash, cnicMasked, createdByUserId };
      });
      const newCusts = await db.insert(customers).values(insertValues).returning({ id: customers.id, phone: customers.phone });
      for (const c of newCusts) {
        customerCache.set(c.phone, c.id);
        customersCreated++;
      }
    }

    // ── Phase 3: Batch-resolve products (1 query + 1 insert if needed) ───
    const uniqueProductKeys = [...new Set(vRows.map(r => r.productKey))];
    const existingProds = await db
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(and(
        eq(products.sellerId, sellerId),
        or(...uniqueProductKeys.map(k => ilike(products.name, k)))!,
      ));

    const productCache = new Map<string, string>(); // lower(name) → productId
    for (const p of existingProds) {
      productCache.set(p.name.toLowerCase(), p.id);
    }

    const missingProductKeys = uniqueProductKeys.filter(k => !productCache.has(k));
    if (missingProductKeys.length > 0) {
      const firstRowByProduct = new Map<string, VRow>();
      for (const vr of vRows) {
        if (!firstRowByProduct.has(vr.productKey)) firstRowByProduct.set(vr.productKey, vr);
      }
      const insertValues = missingProductKeys.map(key => {
        const vr = firstRowByProduct.get(key)!;
        return { sellerId, name: vr.row.productName.trim(), price: String(vr.row.totalAmount), stock: 0 };
      });
      const newProds = await db.insert(products).values(insertValues).returning({ id: products.id, name: products.name });
      for (const p of newProds) {
        productCache.set(p.name.toLowerCase(), p.id);
        productsCreated++;
      }
    }

    // ── Phase 4: Resolve IDs for each row ────────────────────────────────
    type RRow = VRow & { customerId: string; productId: string };
    const rRows: RRow[] = [];
    for (const vr of vRows) {
      const customerId = customerCache.get(vr.phoneKey);
      const productId  = productCache.get(vr.productKey);
      if (!customerId || !productId) {
        errors.push({ row: vr.rowNum, message: 'Could not resolve customer or product' });
        continue;
      }
      rRows.push({ ...vr, customerId, productId });
    }
    if (rRows.length === 0) {
      if (imported > 0) clearSellerStatsCache(sellerId);
      return { imported, customersCreated, customersLinked, productsCreated, errors };
    }

    // ── Phase 5: Batch dup-check (1 query, compare in memory) ────────────
    const allCustIds = [...new Set(rRows.map(r => r.customerId))];
    const allProdIds = [...new Set(rRows.map(r => r.productId))];
    const existingInsts = await db
      .select({ customerId: installments.customerId, productId: installments.productId,
                totalAmount: installments.totalAmount, downPayment: installments.downPayment,
                startDate: installments.startDate })
      .from(installments)
      .where(and(inArray(installments.customerId, allCustIds), inArray(installments.productId, allProdIds), isNull(installments.deletedAt)));

    const toDateKey = (d: Date | string) => {
      const dt = typeof d === 'string' ? new Date(d) : d;
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    };
    const normAmt = (v: string | number) => parseFloat(String(v)).toFixed(2);
    const dupSet = new Set(existingInsts.map(i =>
      `${i.customerId}:${i.productId}:${normAmt(i.totalAmount)}:${normAmt(i.downPayment)}:${toDateKey(i.startDate)}`
    ));

    // ── Phase 6: Collect valid rows, then batch-insert installments ───────
    type InstValue = typeof installments.$inferInsert;
    const toInsert: InstValue[] = [];

    for (const rr of rRows) {
      const dupKey = `${rr.customerId}:${rr.productId}:${normAmt(rr.row.totalAmount)}:${normAmt(rr.row.downPayment)}:${toDateKey(rr.startDate)}`;
      if (dupSet.has(dupKey)) {
        errors.push({ row: rr.rowNum, message: `Duplicate — installment for ${rr.row.customerName} (${rr.row.productName}) on this start date already exists` });
        continue;
      }
      const remaining = rr.row.remaining !== undefined ? rr.row.remaining : rr.row.totalAmount - rr.row.downPayment;
      toInsert.push({
        customerId:       rr.customerId,
        productId:        rr.productId,
        totalAmount:      String(rr.row.totalAmount),
        downPayment:      String(rr.row.downPayment),
        remaining:        String(remaining),
        monthly:          String(rr.row.monthly),
        months:           rr.row.months,
        startDate:        rr.startDate,
        status:           rr.row.status ?? 'ACTIVE',
        imeiNumber:       rr.row.imeiNumber?.trim() || null,
        paymentFrequency: 'monthly',
      });
      imported++;
    }

    if (toInsert.length > 0) {
      await db.insert(installments).values(toInsert);
    }

    if (imported > 0) clearSellerStatsCache(sellerId);
    return { imported, customersCreated, customersLinked, productsCreated, errors };
  }

  async dueSheet(sellerId: string, staffUserId?: string) {
    const rows = await db.execute<{
      id: string; monthly: string; remaining: string; months: number;
      payment_frequency: string; start_date: string; payment_due_day: number;
      total_amount: string; down_payment: string;
      customer_name: string; customer_phone: string; customer_address: string | null;
      product_name: string;
    }>(sql`
      SELECT i.id, i.monthly, i.remaining, i.months, i.payment_frequency,
             i.start_date, i.payment_due_day, i.total_amount, i.down_payment,
             c.name AS customer_name, c.phone AS customer_phone, c.address AS customer_address,
             p.name AS product_name
      FROM installments i
      INNER JOIN customers c ON i.customer_id = c.id
      INNER JOIN products p ON i.product_id = p.id
      WHERE c.seller_id = ${sellerId}
        AND i.status = 'ACTIVE'
        AND i.deleted_at IS NULL
        AND c.deleted_at IS NULL
        ${staffUserId ? sql`AND c.created_by_user_id = ${staffUserId}` : sql``}
      LIMIT 2000
    `);

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const dueItems: Array<{
      id: string; customerName: string; customerPhone: string; customerAddress: string;
      productName: string; monthly: number; remaining: number;
      nextDueDate: string; daysOverdue: number; area: string;
    }> = [];

    for (const inst of rows) {
      const monthly = Number(inst.monthly);
      if (monthly <= 0) continue;

      const paidAmt = Number(inst.total_amount) - Number(inst.down_payment) - Number(inst.remaining);
      const paidPeriods = Math.max(0, Math.floor(paidAmt / monthly + 0.001));
      const nextPeriod = paidPeriods + 1;
      if (nextPeriod > inst.months) continue;

      const startDate = new Date(inst.start_date);
      let nextDueDate: Date;

      if (inst.payment_frequency === 'daily') {
        nextDueDate = new Date(startDate);
        nextDueDate.setDate(nextDueDate.getDate() + nextPeriod);
      } else {
        const dueDay = Number(inst.payment_due_day) || 10;
        const mo = startDate.getMonth() + nextPeriod;
        const lastDay = new Date(startDate.getFullYear(), mo + 1, 0).getDate();
        nextDueDate = new Date(startDate.getFullYear(), mo, Math.min(dueDay, lastDay));
      }

      const nextDateStr = `${nextDueDate.getFullYear()}-${String(nextDueDate.getMonth() + 1).padStart(2, '0')}-${String(nextDueDate.getDate()).padStart(2, '0')}`;

      if (nextDateStr <= todayStr) {
        const nextMidnight = new Date(nextDueDate.getFullYear(), nextDueDate.getMonth(), nextDueDate.getDate());
        const daysOverdue = Math.max(0, Math.floor(
          (todayMidnight.getTime() - nextMidnight.getTime()) / 86_400_000,
        ));
        const area = inst.customer_address
          ? inst.customer_address.split(',').pop()?.trim() || 'Unknown'
          : 'Unknown';

        dueItems.push({
          id:              inst.id,
          customerName:    inst.customer_name,
          customerPhone:   inst.customer_phone,
          customerAddress: inst.customer_address ?? '',
          productName:     inst.product_name,
          monthly,
          remaining:       Number(inst.remaining),
          nextDueDate:     nextDateStr,
          daysOverdue,
          area,
        });
      }
    }

    dueItems.sort((a, b) => a.area.localeCompare(b.area) || a.customerName.localeCompare(b.customerName));
    return dueItems;
  }

  async collectionSchedule(sellerId: string, days: number = 7) {
    const rows = await db.execute<{
      id: string; monthly: string; remaining: string; months: number;
      payment_frequency: string; start_date: string; payment_due_day: number;
      total_amount: string; down_payment: string;
      customer_name: string; customer_phone: string; customer_address: string | null;
      customer_area: string | null;
      product_name: string; last_payment_date: string | null; last_payment_amount: string | null;
    }>(sql`
      SELECT i.id, i.monthly, i.remaining, i.months, i.payment_frequency,
             i.start_date, i.payment_due_day, i.total_amount, i.down_payment,
             c.name AS customer_name, c.phone AS customer_phone, c.address AS customer_address,
             c.area AS customer_area,
             p.name AS product_name,
             lp.paid_on AS last_payment_date,
             lp.amount   AS last_payment_amount
      FROM installments i
      INNER JOIN customers c ON i.customer_id = c.id
      INNER JOIN products  p ON i.product_id  = p.id
      LEFT JOIN LATERAL (
        SELECT amount, paid_on
        FROM payments
        WHERE installment_id = i.id AND deleted_at IS NULL
        ORDER BY paid_on DESC, created_at DESC
        LIMIT 1
      ) lp ON true
      WHERE c.seller_id = ${sellerId}
        AND i.status = 'ACTIVE'
        AND i.deleted_at IS NULL
        AND c.deleted_at IS NULL
      LIMIT 3000
    `);

    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const windowEnd = new Date(todayMidnight);
    windowEnd.setDate(windowEnd.getDate() + days);

    type ScheduleItem = {
      id: string; customerName: string; customerPhone: string; customerAddress: string;
      productName: string; monthly: number; remaining: number; paymentFrequency: string;
      nextDueDate: string; daysUntilDue: number; area: string;
      lastPaymentDate: string | null; lastPaymentAmount: number | null;
      urgency: 'overdue' | 'today' | 'upcoming';
    };

    const items: ScheduleItem[] = [];

    for (const inst of rows) {
      const monthly = Number(inst.monthly);
      if (monthly <= 0) continue;

      const paidAmt = Number(inst.total_amount) - Number(inst.down_payment) - Number(inst.remaining);
      const paidPeriods = Math.max(0, Math.floor(paidAmt / monthly + 0.001));
      const nextPeriod = paidPeriods + 1;
      if (nextPeriod > inst.months) continue;

      const startDate = new Date(inst.start_date);
      let nextDueDate: Date;

      if (inst.payment_frequency === 'daily') {
        nextDueDate = new Date(startDate);
        nextDueDate.setDate(nextDueDate.getDate() + nextPeriod);
      } else {
        const dueDay = Number(inst.payment_due_day) || 10;
        const mo = startDate.getMonth() + nextPeriod;
        const lastDay = new Date(startDate.getFullYear(), mo + 1, 0).getDate();
        nextDueDate = new Date(startDate.getFullYear(), mo, Math.min(dueDay, lastDay));
      }

      const nextMidnight = new Date(nextDueDate.getFullYear(), nextDueDate.getMonth(), nextDueDate.getDate());

      // Include overdue AND upcoming within window
      if (nextMidnight > windowEnd) continue;

      const diffDays = Math.floor(
        (nextMidnight.getTime() - todayMidnight.getTime()) / 86_400_000,
      );

      const nextDateStr = `${nextDueDate.getFullYear()}-${String(nextDueDate.getMonth() + 1).padStart(2, '0')}-${String(nextDueDate.getDate()).padStart(2, '0')}`;
      const area = inst.customer_area?.trim()
        || (inst.customer_address ? inst.customer_address.split(',').pop()?.trim() : null)
        || 'Unknown';

      items.push({
        id:                  inst.id,
        customerName:        inst.customer_name,
        customerPhone:       inst.customer_phone,
        customerAddress:     inst.customer_address ?? '',
        productName:         inst.product_name,
        monthly,
        remaining:           Number(inst.remaining),
        paymentFrequency:    inst.payment_frequency,
        nextDueDate:         nextDateStr,
        daysUntilDue:        diffDays,
        area,
        lastPaymentDate:     inst.last_payment_date ?? null,
        lastPaymentAmount:   inst.last_payment_amount != null ? Number(inst.last_payment_amount) : null,
        urgency:             diffDays < 0 ? 'overdue' : diffDays === 0 ? 'today' : 'upcoming',
      });
    }

    // Sort: overdue first (most overdue at top), then today, then upcoming (soonest first)
    items.sort((a, b) => {
      if (a.urgency !== b.urgency) {
        const order = { overdue: 0, today: 1, upcoming: 2 };
        return order[a.urgency] - order[b.urgency];
      }
      if (a.urgency === 'overdue') return a.daysUntilDue - b.daysUntilDue; // most overdue first
      return a.daysUntilDue - b.daysUntilDue; // soonest first for upcoming
    });

    const summary = {
      overdue:  items.filter((i) => i.urgency === 'overdue').length,
      today:    items.filter((i) => i.urgency === 'today').length,
      upcoming: items.filter((i) => i.urgency === 'upcoming').length,
      totalDue: items.reduce((s, i) => s + i.monthly, 0),
    };

    return { items, summary };
  }

  async pause(id: string, sellerId: string, pausedBy: string, body: { months: number; reason?: string }) {
    const row = await this.getOne(id, sellerId);
    if (row.status !== 'ACTIVE') throw new AppError('Only active installments can be paused', 400);
    if (body.months < 1 || body.months > 6) throw new AppError('Pause duration must be 1–6 months', 400);

    const now = new Date();
    const pausedUntil = new Date(now);
    pausedUntil.setMonth(pausedUntil.getMonth() + body.months);

    const [updated] = await db
      .update(installments)
      .set({ pausedUntil, pauseReason: body.reason ?? null, pausedBy })
      .where(eq(installments.id, id))
      .returning();
    clearSellerStatsCache(sellerId);
    return updated;
  }

  async unpause(id: string, sellerId: string) {
    const row = await this.getOne(id, sellerId);
    if (!row.pausedUntil) throw new AppError('Installment is not paused', 400);

    const [updated] = await db
      .update(installments)
      .set({ pausedUntil: null, pauseReason: null, pausedBy: null })
      .where(eq(installments.id, id))
      .returning();
    clearSellerStatsCache(sellerId);
    return updated;
  }

  async transfer(id: string, sellerId: string, ownerId: string, body: { newCustomerId: string; reason?: string }) {
    const old = await this.getOne(id, sellerId);
    if (old.status !== 'ACTIVE') throw new AppError('Only active installments can be transferred', 400);
    if (old.customerId === body.newCustomerId) throw new AppError('Cannot transfer to the same customer', 400);

    const [newCust] = await db
      .select({ id: customers.id, name: customers.name })
      .from(customers)
      .where(and(eq(customers.id, body.newCustomerId), eq(customers.sellerId, sellerId), isNull(customers.deletedAt)));
    if (!newCust) throw new AppError('Customer not found', 404);

    const monthly    = Number(old.monthly);
    const remaining  = Number(old.remaining);
    const paidAmount = Number(old.totalAmount) - Number(old.downPayment) - remaining;
    const paidPeriods     = Math.max(0, Math.floor(paidAmount / (monthly || 1) + 0.001));
    const remainingPeriods = Math.max(1, old.months - paidPeriods);

    return db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${sellerId}))`);

      // Cancel old installment
      await tx.update(installments).set({ status: 'CANCELLED' }).where(eq(installments.id, id));

      // Generate new invoice number
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

      const [newInst] = await tx
        .insert(installments)
        .values({
          customerId:       body.newCustomerId,
          productId:        old.productId,
          totalAmount:      String(remaining),
          downPayment:      '0',
          remaining:        String(remaining),
          monthly:          String(monthly.toFixed(2)),
          months:           remainingPeriods,
          startDate:        new Date(),
          invoiceNumber,
          imeiNumber:       old.imeiNumber,
          cashPrice:        old.cashPrice,
          profitMarkup:     old.profitMarkup,
          paymentFrequency: old.paymentFrequency as 'monthly' | 'daily',
          paymentDueDay:    old.paymentDueDay,
          status:           'ACTIVE',
        })
        .returning();

      return {
        oldId:          id,
        newInstallment: { ...newInst, customerName: newCust.name, productName: old.productName },
        oldCustomerName: old.customerName,
        newCustomerName: newCust.name,
        reason:          body.reason ?? null,
      };
    });
  }

  async overdueWithStage(sellerId: string, search?: string) {
    const searchFilter = search
      ? sql`AND (c.name ILIKE ${`%${search}%`} OR c.phone ILIKE ${`%${search}%`})`
      : sql``;

    const DUE_DATE_EXPR = sql`
      CASE WHEN i.payment_frequency = 'daily' THEN
        i.start_date + ((GREATEST(0, FLOOR(
          (i.total_amount::numeric - i.down_payment::numeric - i.remaining::numeric)
          / NULLIF(i.monthly::numeric, 0)
        )) + 1) || ' days')::interval
      ELSE
        DATE_TRUNC('month', i.start_date + ((GREATEST(0, FLOOR(
          (i.total_amount::numeric - i.down_payment::numeric - i.remaining::numeric)
          / NULLIF(i.monthly::numeric, 0)
        )) + 1) || ' months')::interval)::date + (i.payment_due_day - 1)
      END
    `;

    return db.execute<{
      id: string; customer_id: string; product_id: string;
      total_amount: string; down_payment: string; remaining: string; monthly: string; months: number;
      start_date: string; invoice_number: string | null; payment_frequency: string; payment_due_day: number;
      status: string; created_at: string; imei_number: string | null;
      customer_name: string; customer_phone: string; customer_area: string | null; product_name: string;
      days_overdue: number;
      last_action_type: string | null; last_action_date: string | null; last_promise_date: string | null;
    }>(sql`
      SELECT
        i.id, i.customer_id, i.product_id,
        i.total_amount, i.down_payment, i.remaining, i.monthly, i.months,
        i.start_date, i.invoice_number, i.payment_frequency, i.payment_due_day,
        i.status, i.created_at, i.imei_number,
        c.name AS customer_name, c.phone AS customer_phone,
        c.area AS customer_area, p.name AS product_name,
        GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - (${DUE_DATE_EXPR}))) / 86400))::int AS days_overdue,
        la.type AS last_action_type,
        la.created_at AS last_action_date,
        la.promise_date AS last_promise_date
      FROM installments i
      INNER JOIN customers c ON i.customer_id = c.id
      INNER JOIN products p ON i.product_id = p.id
      LEFT JOIN LATERAL (
        SELECT type, created_at, promise_date
        FROM recovery_actions
        WHERE installment_id = i.id
        ORDER BY created_at DESC
        LIMIT 1
      ) la ON TRUE
      WHERE c.seller_id = ${sellerId}
        AND i.status = 'ACTIVE'
        AND i.deleted_at IS NULL
        AND c.deleted_at IS NULL
        ${searchFilter}
        AND (${DUE_DATE_EXPR}) < NOW()
      ORDER BY days_overdue DESC, i.remaining::numeric DESC
      LIMIT 500
    `);
  }
}
