import { randomUUID } from 'crypto';
import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  vehicleInstallments, vehiclePayments, vehicleStock,
  customers, users, ledgerEntries,
} from '../../db/schema.js';
import { AppError } from '../../middleware/error.js';
import { clearSellerStatsCache } from '../stats/stats.service.js';

type PaymentMethod = 'CASH' | 'BANK' | 'JAZZCASH' | 'EASYPAISA' | 'OTHER';
type VStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'DEFAULTED' | 'CANCELLED' | 'CLOSED';

type CreateBody = {
  vehicleId:         string;
  customerId:        string;
  totalAmount:       number;
  downPayment:       number;
  months:            number;
  startDate:         string;
  paymentFrequency?: 'monthly' | 'weekly' | 'daily';
  paymentDueDay?:    number;
  guarantorName?:    string;
  guarantorPhone?:   string;
  guarantorCnic?:    string;
  guarantorAddress?: string;
  guarantorRelation?: string;
  guarantor2Name?:   string;
  guarantor2Phone?:  string;
  guarantor2Cnic?:   string;
  guarantor2Address?: string;
  notes?:            string;
};

type RecordPaymentBody = {
  amount:       number;
  method:       PaymentMethod;
  note?:        string;
  collectedBy?: string;
  periodDue?:   string;
  daysLate?:    number;
  proofImageUrl?: string;
};

export class VehicleInstallmentsService {
  async list(
    sellerId: string, page: number, limit: number,
    status?: string, search?: string, vehicleType?: string,
  ) {
    const offset = (page - 1) * limit;
    const conds: SQL[] = [
      eq(vehicleInstallments.sellerId, sellerId),
      isNull(vehicleInstallments.deletedAt),
    ];

    if (status) {
      conds.push(eq(vehicleInstallments.status, status as VStatus));
    } else {
      const startOfMonth = new Date();
      startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
      conds.push(
        or(
          sql`${vehicleInstallments.status} != 'COMPLETED'`,
          and(
            eq(vehicleInstallments.status, 'COMPLETED'),
            sql`${vehicleInstallments.completedAt} >= ${startOfMonth.toISOString()}`,
          ),
        )!,
      );
    }

    if (vehicleType) {
      conds.push(eq(vehicleStock.vehicleType, vehicleType as 'BIKE' | 'RICKSHAW' | 'LOADER_RICKSHAW' | 'ELECTRIC_BIKE' | 'ELECTRIC_RICKSHAW'));
    }

    if (search) {
      const s = `%${search.trim()}%`;
      conds.push(or(
        ilike(customers.name,                  s),
        ilike(customers.phone,                 s),
        ilike(vehicleStock.brand,              s),
        ilike(vehicleStock.model,              s),
        ilike(vehicleStock.engineNumber,       s),
        ilike(vehicleStock.chassisNumber,      s),
        ilike(vehicleInstallments.invoiceNumber, s),
      )!);
    }

    const where = and(...conds);

    const [rows, [{ total }]] = await Promise.all([
      db.select({
        id:                  vehicleInstallments.id,
        sellerId:            vehicleInstallments.sellerId,
        vehicleId:           vehicleInstallments.vehicleId,
        customerId:          vehicleInstallments.customerId,
        totalAmount:         vehicleInstallments.totalAmount,
        downPayment:         vehicleInstallments.downPayment,
        remaining:           vehicleInstallments.remaining,
        monthly:             vehicleInstallments.monthly,
        months:              vehicleInstallments.months,
        startDate:           vehicleInstallments.startDate,
        paymentFrequency:    vehicleInstallments.paymentFrequency,
        paymentDueDay:       vehicleInstallments.paymentDueDay,
        invoiceNumber:       vehicleInstallments.invoiceNumber,
        status:              vehicleInstallments.status,
        letterStatus:        vehicleInstallments.letterStatus,
        letterSentAt:        vehicleInstallments.letterSentAt,
        biometricStatus:     vehicleInstallments.biometricStatus,
        biometricDoneAt:     vehicleInstallments.biometricDoneAt,
        notes:               vehicleInstallments.notes,
        createdAt:           vehicleInstallments.createdAt,
        completedAt:         vehicleInstallments.completedAt,
        guarantorName:       vehicleInstallments.guarantorName,
        guarantorPhone:      vehicleInstallments.guarantorPhone,
        // Vehicle info
        vehicleType:         vehicleStock.vehicleType,
        brand:               vehicleStock.brand,
        model:               vehicleStock.model,
        year:                vehicleStock.year,
        color:               vehicleStock.color,
        engineNumber:        vehicleStock.engineNumber,
        chassisNumber:       vehicleStock.chassisNumber,
        registrationNumber:  vehicleStock.registrationNumber,
        vehicleCondition:    vehicleStock.condition,
        vehiclePhotoUrl:     vehicleStock.photoUrl,
        // Customer info
        customerName:        customers.name,
        customerPhone:       customers.phone,
        customerArea:        customers.area,
        customerPhotoUrl:    customers.photoUrl,
        customerFileNumber:  customers.fileNumber,
      })
      .from(vehicleInstallments)
      .innerJoin(vehicleStock, eq(vehicleInstallments.vehicleId, vehicleStock.id))
      .innerJoin(customers,    eq(vehicleInstallments.customerId, customers.id))
      .where(where)
      .orderBy(desc(vehicleInstallments.createdAt))
      .limit(limit).offset(offset),

      db.select({ total: sql<number>`count(*)::int` })
        .from(vehicleInstallments)
        .innerJoin(vehicleStock, eq(vehicleInstallments.vehicleId, vehicleStock.id))
        .innerJoin(customers,    eq(vehicleInstallments.customerId, customers.id))
        .where(where),
    ]);

    return { data: rows, total, page, limit };
  }

  async stats(sellerId: string) {
    const [statusCounts, [outstandingRow]] = await Promise.all([
      db.select({
        status: vehicleInstallments.status,
        count:  sql<number>`count(*)::int`,
      })
      .from(vehicleInstallments)
      .where(and(eq(vehicleInstallments.sellerId, sellerId), isNull(vehicleInstallments.deletedAt)))
      .groupBy(vehicleInstallments.status),

      db.select({ outstanding: sql<number>`COALESCE(SUM(remaining::numeric), 0)::float` })
        .from(vehicleInstallments)
        .where(and(
          eq(vehicleInstallments.sellerId, sellerId),
          isNull(vehicleInstallments.deletedAt),
          eq(vehicleInstallments.status, 'ACTIVE'),
        )),
    ]);

    const map: Record<string, number> = {};
    statusCounts.forEach((r) => { map[r.status] = r.count; });
    return {
      total:       statusCounts.reduce((s, r) => s + r.count, 0),
      pending:     map['PENDING']   ?? 0,
      active:      map['ACTIVE']    ?? 0,
      completed:   map['COMPLETED'] ?? 0,
      defaulted:   map['DEFAULTED'] ?? 0,
      cancelled:   map['CANCELLED'] ?? 0,
      outstanding: outstandingRow.outstanding,
    };
  }

  async getOne(id: string, sellerId: string) {
    const [inst] = await db.select({
      id:                   vehicleInstallments.id,
      sellerId:             vehicleInstallments.sellerId,
      vehicleId:            vehicleInstallments.vehicleId,
      customerId:           vehicleInstallments.customerId,
      totalAmount:          vehicleInstallments.totalAmount,
      downPayment:          vehicleInstallments.downPayment,
      remaining:            vehicleInstallments.remaining,
      monthly:              vehicleInstallments.monthly,
      months:               vehicleInstallments.months,
      startDate:            vehicleInstallments.startDate,
      paymentFrequency:     vehicleInstallments.paymentFrequency,
      paymentDueDay:        vehicleInstallments.paymentDueDay,
      invoiceNumber:        vehicleInstallments.invoiceNumber,
      status:               vehicleInstallments.status,
      letterStatus:         vehicleInstallments.letterStatus,
      letterSentAt:         vehicleInstallments.letterSentAt,
      biometricStatus:      vehicleInstallments.biometricStatus,
      biometricDoneAt:      vehicleInstallments.biometricDoneAt,
      notes:                vehicleInstallments.notes,
      createdAt:            vehicleInstallments.createdAt,
      completedAt:          vehicleInstallments.completedAt,
      guarantorName:        vehicleInstallments.guarantorName,
      guarantorPhone:       vehicleInstallments.guarantorPhone,
      guarantorCnic:        vehicleInstallments.guarantorCnic,
      guarantorAddress:     vehicleInstallments.guarantorAddress,
      guarantorRelation:    vehicleInstallments.guarantorRelation,
      guarantor2Name:       vehicleInstallments.guarantor2Name,
      guarantor2Phone:      vehicleInstallments.guarantor2Phone,
      guarantor2Cnic:       vehicleInstallments.guarantor2Cnic,
      guarantor2Address:    vehicleInstallments.guarantor2Address,
      // Vehicle
      vehicleType:          vehicleStock.vehicleType,
      brand:                vehicleStock.brand,
      model:                vehicleStock.model,
      year:                 vehicleStock.year,
      color:                vehicleStock.color,
      engineNumber:         vehicleStock.engineNumber,
      chassisNumber:        vehicleStock.chassisNumber,
      registrationNumber:   vehicleStock.registrationNumber,
      vehicleCondition:     vehicleStock.condition,
      vehicleSellingPrice:  vehicleStock.sellingPrice,
      vehiclePhotoUrl:      vehicleStock.photoUrl,
      // Customer
      customerName:         customers.name,
      customerPhone:        customers.phone,
      customerArea:         customers.area,
      customerAddress:      customers.address,
      customerPhotoUrl:     customers.photoUrl,
      customerFileNumber:   customers.fileNumber,
      customerCnicMasked:   customers.cnicMasked,
      customerFatherName:   customers.fatherName,
    })
    .from(vehicleInstallments)
    .innerJoin(vehicleStock, eq(vehicleInstallments.vehicleId, vehicleStock.id))
    .innerJoin(customers,    eq(vehicleInstallments.customerId, customers.id))
    .where(and(eq(vehicleInstallments.id, id), eq(vehicleInstallments.sellerId, sellerId)));

    if (!inst) throw new AppError('Vehicle installment not found', 404);

    const paymentHistory = await db.select({
      id:            vehiclePayments.id,
      amount:        vehiclePayments.amount,
      method:        vehiclePayments.method,
      paidOn:        vehiclePayments.paidOn,
      note:          vehiclePayments.note,
      receiptNumber: vehiclePayments.receiptNumber,
      periodDue:     vehiclePayments.periodDue,
      daysLate:      vehiclePayments.daysLate,
      proofImageUrl: vehiclePayments.proofImageUrl,
      collectedBy:   vehiclePayments.collectedBy,
      deletedAt:     vehiclePayments.deletedAt,
      collectorName: users.name,
    })
    .from(vehiclePayments)
    .leftJoin(users, eq(vehiclePayments.collectedBy, users.id))
    .where(and(
      eq(vehiclePayments.vehicleInstallmentId, id),
      isNull(vehiclePayments.deletedAt),
    ))
    .orderBy(desc(vehiclePayments.paidOn));

    return { ...inst, payments: paymentHistory };
  }

  async create(sellerId: string, body: CreateBody) {
    // Verify vehicle belongs to seller and is available
    const [vehicle] = await db.select().from(vehicleStock).where(
      and(eq(vehicleStock.id, body.vehicleId), eq(vehicleStock.sellerId, sellerId), isNull(vehicleStock.deletedAt)),
    );
    if (!vehicle) throw new AppError('Vehicle not found in stock', 404);
    if (vehicle.status !== 'AVAILABLE' && vehicle.status !== 'RESERVED') {
      throw new AppError(`Vehicle is already ${vehicle.status.toLowerCase().replace('_', ' ')}`, 400);
    }

    // Verify customer belongs to seller
    const [customer] = await db.select({ id: customers.id }).from(customers).where(
      and(eq(customers.id, body.customerId), eq(customers.sellerId, sellerId), isNull(customers.deletedAt)),
    );
    if (!customer) throw new AppError('Customer not found', 404);

    const totalAmount  = body.totalAmount;
    const downPayment  = body.downPayment;
    const remaining    = totalAmount - downPayment;
    const monthly      = Number((remaining / body.months).toFixed(2));

    // Generate invoice number
    const year = new Date().getFullYear();
    const [{ nextInv }] = await db.execute<{ nextInv: number }>(sql`
      SELECT COALESCE(MAX(
        CAST(SPLIT_PART(invoice_number, '-', 3) AS INTEGER)
      ), 0) + 1 AS "nextInv"
      FROM vehicle_installments
      WHERE seller_id = ${sellerId}
        AND invoice_number LIKE ${'VINV-' + year + '-%'}
    `);
    const invoiceNumber = `VINV-${year}-${String(nextInv).padStart(5, '0')}`;

    return db.transaction(async (tx) => {
      const [inst] = await tx.insert(vehicleInstallments).values({
        sellerId,
        vehicleId:         body.vehicleId,
        customerId:        body.customerId,
        totalAmount:       String(totalAmount),
        downPayment:       String(downPayment),
        remaining:         String(remaining),
        monthly:           String(monthly),
        months:            body.months,
        startDate:         new Date(body.startDate),
        paymentFrequency:  body.paymentFrequency ?? 'monthly',
        paymentDueDay:     body.paymentDueDay ?? 10,
        invoiceNumber,
        status:            'ACTIVE',
        guarantorName:     body.guarantorName    ?? null,
        guarantorPhone:    body.guarantorPhone   ?? null,
        guarantorCnic:     body.guarantorCnic    ?? null,
        guarantorAddress:  body.guarantorAddress ?? null,
        guarantorRelation: body.guarantorRelation ?? null,
        guarantor2Name:    body.guarantor2Name   ?? null,
        guarantor2Phone:   body.guarantor2Phone  ?? null,
        guarantor2Cnic:    body.guarantor2Cnic   ?? null,
        guarantor2Address: body.guarantor2Address ?? null,
        notes:             body.notes ?? null,
      }).returning();

      // Mark vehicle as SOLD_INSTALLMENT
      await tx.update(vehicleStock).set({
        status:    'SOLD_INSTALLMENT',
        soldAt:    new Date(),
        updatedAt: new Date(),
      }).where(eq(vehicleStock.id, body.vehicleId));

      // Ledger entry for down payment (if any)
      if (downPayment > 0) {
        await tx.insert(ledgerEntries).values({
          sellerId,
          type:        'CREDIT',
          category:    'CASH',
          amount:      String(downPayment),
          description: `Down payment — ${vehicle.brand} ${vehicle.model} · ${vehicle.engineNumber}`,
          referenceId: inst.id,
          refType:     'PAYMENT',
        });
      }

      clearSellerStatsCache(sellerId);
      return inst;
    });
  }

  async recordPayment(id: string, sellerId: string, body: RecordPaymentBody) {
    return db.transaction(async (tx) => {
      const [inst] = await tx.select({
        id:        vehicleInstallments.id,
        remaining: vehicleInstallments.remaining,
        status:    vehicleInstallments.status,
        vehicleId: vehicleInstallments.vehicleId,
      })
      .from(vehicleInstallments)
      .where(and(eq(vehicleInstallments.id, id), eq(vehicleInstallments.sellerId, sellerId)));

      if (!inst) throw new AppError('Vehicle installment not found', 404);
      if (inst.status !== 'ACTIVE') throw new AppError('Installment is not active', 400);

      const remainingPaisas = Math.round(Number(inst.remaining) * 100);
      const amountPaisas    = Math.round(body.amount * 100);
      if (amountPaisas > remainingPaisas) {
        throw new AppError(`Amount exceeds remaining balance of PKR ${(remainingPaisas / 100).toFixed(2)}`, 400);
      }

      const newRemaining = (remainingPaisas - amountPaisas) / 100;
      const isCleared    = newRemaining === 0;

      // Get vehicle + customer for description
      const [detail] = await tx.select({
        brand:        vehicleStock.brand,
        model:        vehicleStock.model,
        engineNumber: vehicleStock.engineNumber,
        customerName: customers.name,
      })
      .from(vehicleInstallments)
      .innerJoin(vehicleStock, eq(vehicleInstallments.vehicleId, vehicleStock.id))
      .innerJoin(customers,    eq(vehicleInstallments.customerId, customers.id))
      .where(eq(vehicleInstallments.id, id));

      // Receipt number: VR-YEAR-NNNNN
      const year = new Date().getFullYear();
      const [{ nextRcp }] = await tx.execute<{ nextRcp: number }>(sql`
        SELECT COALESCE(
          MAX(CAST(SPLIT_PART(receipt_number, '-', 3) AS INTEGER)), 0
        ) + 1 AS "nextRcp"
        FROM vehicle_payments
        WHERE seller_id = ${sellerId}
          AND receipt_number LIKE ${'VR-' + year + '-%'}
      `);
      const receiptNumber = `VR-${year}-${String(nextRcp).padStart(5, '0')}`;

      const [[payment]] = await Promise.all([
        tx.insert(vehiclePayments).values({
          vehicleInstallmentId: id,
          sellerId,
          amount:        String(body.amount),
          method:        body.method,
          note:          body.note          ?? null,
          collectedBy:   body.collectedBy   ?? null,
          proofImageUrl: body.proofImageUrl ?? null,
          receiptNumber,
          periodDue:     body.periodDue ?? null,
          daysLate:      body.daysLate  ?? 0,
        }).returning(),

        tx.update(vehicleInstallments).set({
          remaining: String(newRemaining),
          ...(isCleared && { status: 'COMPLETED', completedAt: new Date() }),
        }).where(eq(vehicleInstallments.id, id)),
      ]);

      // Ledger credit
      await tx.insert(ledgerEntries).values({
        sellerId,
        type:        'CREDIT',
        category:    body.method,
        amount:      String(body.amount),
        description: `Vehicle payment — ${detail?.customerName ?? ''} · ${detail?.brand ?? ''} ${detail?.model ?? ''}${body.note ? ` · ${body.note}` : ''}`,
        referenceId: payment.id,
        refType:     'PAYMENT',
      });

      // If completed, transfer ownership (status stays SOLD_INSTALLMENT at stock level — dealers handle reg transfer manually)
      clearSellerStatsCache(sellerId);
      return { payment, remaining: newRemaining, completed: isCleared };
    });
  }

  async markDefault(id: string, sellerId: string) {
    const [inst] = await db.select({ status: vehicleInstallments.status }).from(vehicleInstallments)
      .where(and(eq(vehicleInstallments.id, id), eq(vehicleInstallments.sellerId, sellerId)));
    if (!inst) throw new AppError('Not found', 404);
    if (inst.status !== 'ACTIVE') throw new AppError('Only ACTIVE installments can be defaulted', 400);
    const [updated] = await db.update(vehicleInstallments).set({ status: 'DEFAULTED' })
      .where(eq(vehicleInstallments.id, id)).returning();
    clearSellerStatsCache(sellerId);
    return updated;
  }

  async cancel(id: string, sellerId: string, userId: string) {
    return db.transaction(async (tx) => {
      const [inst] = await tx.select({
        status:    vehicleInstallments.status,
        vehicleId: vehicleInstallments.vehicleId,
      }).from(vehicleInstallments)
        .where(and(eq(vehicleInstallments.id, id), eq(vehicleInstallments.sellerId, sellerId)));
      if (!inst) throw new AppError('Not found', 404);
      if (!['PENDING', 'ACTIVE'].includes(inst.status)) {
        throw new AppError('Only PENDING or ACTIVE installments can be cancelled', 400);
      }
      const [updated] = await tx.update(vehicleInstallments).set({ status: 'CANCELLED' })
        .where(eq(vehicleInstallments.id, id)).returning();

      // Return vehicle to AVAILABLE
      await tx.update(vehicleStock).set({
        status:    'AVAILABLE',
        soldAt:    null,
        updatedAt: new Date(),
      }).where(eq(vehicleStock.id, inst.vehicleId));

      clearSellerStatsCache(sellerId);
      return updated;
    });
  }

  async deleteVehicleInstallment(id: string, sellerId: string, userId: string) {
    return db.transaction(async (tx) => {
      const [inst] = await tx.select({
        status:    vehicleInstallments.status,
        vehicleId: vehicleInstallments.vehicleId,
      }).from(vehicleInstallments)
        .where(and(eq(vehicleInstallments.id, id), eq(vehicleInstallments.sellerId, sellerId), isNull(vehicleInstallments.deletedAt)));
      if (!inst) throw new AppError('Not found', 404);

      await tx.update(vehicleInstallments).set({ deletedAt: new Date(), deletedBy: userId })
        .where(eq(vehicleInstallments.id, id));

      // Return vehicle to AVAILABLE only if cancelled/pending
      if (inst.status === 'CANCELLED' || inst.status === 'PENDING') {
        await tx.update(vehicleStock).set({
          status: 'AVAILABLE', soldAt: null, updatedAt: new Date(),
        }).where(eq(vehicleStock.id, inst.vehicleId));
      }
    });
  }

  async deletePayment(paymentId: string, installmentId: string, sellerId: string, userId: string, reason?: string) {
    return db.transaction(async (tx) => {
      const [pmt] = await tx.select({ amount: vehiclePayments.amount })
        .from(vehiclePayments)
        .where(and(
          eq(vehiclePayments.id, paymentId),
          eq(vehiclePayments.vehicleInstallmentId, installmentId),
          eq(vehiclePayments.sellerId, sellerId),
          isNull(vehiclePayments.deletedAt),
        ));
      if (!pmt) throw new AppError('Payment not found', 404);

      const [inst] = await tx.select({ remaining: vehicleInstallments.remaining, status: vehicleInstallments.status })
        .from(vehicleInstallments)
        .where(eq(vehicleInstallments.id, installmentId));

      const newRemaining = Number(inst.remaining) + Number(pmt.amount);

      await Promise.all([
        tx.update(vehiclePayments).set({
          deletedAt: new Date(), deletedBy: userId, deletedReason: reason ?? null,
        }).where(eq(vehiclePayments.id, paymentId)),

        tx.update(vehicleInstallments).set({
          remaining: String(newRemaining),
          ...(inst.status === 'COMPLETED' && { status: 'ACTIVE', completedAt: null }),
        }).where(eq(vehicleInstallments.id, installmentId)),
      ]);

      clearSellerStatsCache(sellerId);
      return { reversed: true };
    });
  }

  async updateFields(
    id: string,
    sellerId: string,
    body: {
      letterStatus?:   'NONE' | 'FIRST_NOTICE' | 'SECOND_NOTICE' | 'LEGAL_NOTICE' | 'FILED';
      biometricStatus?: 'PENDING' | 'SELLER_DONE' | 'BUYER_DONE' | 'COMPLETED' | 'NOT_REQUIRED';
    },
  ) {
    const [existing] = await db.select({ id: vehicleInstallments.id })
      .from(vehicleInstallments)
      .where(and(eq(vehicleInstallments.id, id), eq(vehicleInstallments.sellerId, sellerId), isNull(vehicleInstallments.deletedAt)));
    if (!existing) throw new AppError('Vehicle installment not found', 404);

    const patch: Record<string, unknown> = {};
    if (body.letterStatus !== undefined) {
      patch.letterStatus  = body.letterStatus;
      patch.letterSentAt  = body.letterStatus === 'NONE' ? null : new Date();
    }
    if (body.biometricStatus !== undefined) {
      patch.biometricStatus = body.biometricStatus;
      patch.biometricDoneAt = body.biometricStatus === 'COMPLETED' ? new Date() : null;
    }

    const [updated] = await db.update(vehicleInstallments)
      .set(patch)
      .where(eq(vehicleInstallments.id, id))
      .returning();
    return updated;
  }
}
