import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { deliveries, cashSales, installments, customers, products, users } from '../../db/schema.js';
import { AppError } from '../../middleware/error.js';
import type { CreateDeliveryInput, MarkDeliveredInput, MarkRejectedInput } from '@assaan/shared';

const ACTIVE_STATUSES = ['PENDING', 'OUT_FOR_DELIVERY'] as const;

export class DeliveriesService {
  async list(sellerId: string, actor: { userId: string; isOwner: boolean }, status?: string) {
    const conditions = [eq(deliveries.sellerId, sellerId)];
    if (!actor.isOwner) {
      conditions.push(or(eq(deliveries.driverUserId, actor.userId), eq(deliveries.createdByUserId, actor.userId))!);
    }
    if (status) conditions.push(eq(deliveries.status, status as typeof deliveries.status.enumValues[number]));

    const rows = await db
      .select()
      .from(deliveries)
      .where(and(...conditions))
      .orderBy(desc(deliveries.createdAt));

    return rows;
  }

  // Staff only see {id, name, role} from GET /staff (permissions are owner-only
  // there) — this gives anyone with canManageDeliveries a way to pick a driver
  // by name without exposing other staff's full permission set.
  async listDrivers(sellerId: string) {
    return db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(and(
        eq(users.sellerId, sellerId),
        eq(users.role, 'SELLER_STAFF'),
        sql`(${users.permissions}->>'canManageDeliveries')::boolean IS TRUE`,
      ));
  }

  async getOne(id: string, sellerId: string) {
    const [row] = await db.select().from(deliveries).where(and(eq(deliveries.id, id), eq(deliveries.sellerId, sellerId)));
    if (!row) throw new AppError('Delivery not found', 404);
    return row;
  }

  async create(sellerId: string, actorUserId: string, body: CreateDeliveryInput) {
    return db.transaction(async (tx) => {
      // Advisory-lock the sale id so two staff can't both create a delivery for it at once.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${body.saleId}))`);

      const saleCol = body.saleType === 'CASH' ? deliveries.cashSaleId : deliveries.installmentId;
      const [existingActive] = await tx
        .select({ id: deliveries.id })
        .from(deliveries)
        .where(and(eq(deliveries.sellerId, sellerId), eq(saleCol, body.saleId), inArray(deliveries.status, ACTIVE_STATUSES)));
      if (existingActive) throw new AppError('A delivery is already in progress for this sale', 409);

      let customerName: string;
      let customerPhone: string | null;
      let productName: string;
      let quantity: number;
      let serialSnapshot: string | null;

      if (body.saleType === 'CASH') {
        const [row] = await tx
          .select({
            productId: cashSales.productId, quantity: cashSales.quantity,
            customerName: cashSales.customerName, customerPhone: cashSales.customerPhone,
            imeiNumber: cashSales.imeiNumber,
          })
          .from(cashSales)
          .where(and(eq(cashSales.id, body.saleId), eq(cashSales.sellerId, sellerId)));
        if (!row) throw new AppError('Cash sale not found', 404);

        const [product] = await tx.select({ name: products.name }).from(products).where(eq(products.id, row.productId));
        customerName  = row.customerName ?? 'Walk-in Customer';
        customerPhone = row.customerPhone;
        productName   = product?.name ?? 'Item';
        quantity      = row.quantity;
        serialSnapshot = row.imeiNumber;
      } else {
        const [row] = await tx
          .select({ customerId: installments.customerId, productId: installments.productId, imeiNumber: installments.imeiNumber })
          .from(installments)
          .where(and(eq(installments.id, body.saleId), isNull(installments.deletedAt)));
        if (!row) throw new AppError('Installment not found', 404);

        const [customer] = await tx
          .select({ name: customers.name, phone: customers.phone, address: customers.address, sellerId: customers.sellerId })
          .from(customers)
          .where(eq(customers.id, row.customerId));
        if (!customer || customer.sellerId !== sellerId) throw new AppError('Installment not found', 404);

        const [product] = await tx.select({ name: products.name }).from(products).where(eq(products.id, row.productId));
        customerName   = customer.name;
        customerPhone  = customer.phone;
        productName    = product?.name ?? 'Item';
        quantity       = 1;
        serialSnapshot = row.imeiNumber;
      }

      let driverName = body.driverName ?? null;
      if (body.driverUserId) {
        const [driver] = await tx.select({ name: users.name }).from(users).where(and(eq(users.id, body.driverUserId), eq(users.sellerId, sellerId)));
        if (!driver) throw new AppError('Driver not found', 404);
        driverName = driver.name;
      }
      if (!driverName) throw new AppError('Driver name is required', 400);

      const year = new Date().getFullYear();
      const [{ nextSeq }] = await tx.execute<{ nextSeq: number }>(sql`
        SELECT COALESCE(MAX(CAST(SPLIT_PART(slip_number, '-', 3) AS INTEGER)), 0) + 1 AS "nextSeq"
        FROM deliveries WHERE seller_id = ${sellerId} AND slip_number LIKE ${'DS-' + year + '-%'}
      `);
      const slipNumber = `DS-${year}-${String(nextSeq).padStart(5, '0')}`;

      const [row] = await tx.insert(deliveries).values({
        sellerId,
        saleType:        body.saleType,
        cashSaleId:      body.saleType === 'CASH' ? body.saleId : null,
        installmentId:   body.saleType === 'INSTALLMENT' ? body.saleId : null,
        slipNumber,
        customerName,
        customerPhone,
        deliveryAddress: body.deliveryAddress,
        productName,
        quantity,
        serialSnapshot,
        driverUserId: body.driverUserId ?? null,
        driverName,
        driverPhone: body.driverPhone ?? null,
        scheduledDate: body.scheduledDate ?? null,
        createdByUserId: actorUserId,
      }).returning();

      return row!;
    });
  }

  async dispatch(id: string, sellerId: string) {
    const row = await this.assertStatus(id, sellerId, ['PENDING']);
    const [updated] = await db
      .update(deliveries)
      .set({ status: 'OUT_FOR_DELIVERY', dispatchedAt: new Date() })
      .where(eq(deliveries.id, row.id))
      .returning();
    return updated!;
  }

  async markDelivered(id: string, sellerId: string, body: MarkDeliveredInput) {
    const row = await this.assertStatus(id, sellerId, ['PENDING', 'OUT_FOR_DELIVERY']);
    const [updated] = await db
      .update(deliveries)
      .set({
        status: 'DELIVERED',
        deliveredAt: new Date(),
        signatureUrl: body.signatureUrl ?? null,
        proofPhotoUrl: body.proofPhotoUrl ?? null,
        conditionNote: body.conditionNote ?? null,
      })
      .where(eq(deliveries.id, row.id))
      .returning();
    return updated!;
  }

  async markRejected(id: string, sellerId: string, body: MarkRejectedInput) {
    const row = await this.assertStatus(id, sellerId, ['PENDING', 'OUT_FOR_DELIVERY']);
    const [updated] = await db
      .update(deliveries)
      .set({
        status: 'REJECTED',
        rejectionReason: body.rejectionReason,
        proofPhotoUrl: body.proofPhotoUrl ?? null,
      })
      .where(eq(deliveries.id, row.id))
      .returning();
    return updated!;
  }

  async markStockReversed(id: string, sellerId: string) {
    const [row] = await db.select({ id: deliveries.id, status: deliveries.status }).from(deliveries).where(and(eq(deliveries.id, id), eq(deliveries.sellerId, sellerId)));
    if (!row) throw new AppError('Delivery not found', 404);
    if (row.status !== 'REJECTED') throw new AppError('Only a rejected delivery needs a stock-reversed acknowledgement', 400);
    const [updated] = await db.update(deliveries).set({ stockReversed: true }).where(eq(deliveries.id, id)).returning();
    return updated!;
  }

  async cancel(id: string, sellerId: string) {
    const row = await this.assertStatus(id, sellerId, ['PENDING', 'OUT_FOR_DELIVERY']);
    const [updated] = await db.update(deliveries).set({ status: 'CANCELLED' }).where(eq(deliveries.id, row.id)).returning();
    return updated!;
  }

  private async assertStatus(id: string, sellerId: string, allowed: string[]) {
    const [row] = await db.select().from(deliveries).where(and(eq(deliveries.id, id), eq(deliveries.sellerId, sellerId)));
    if (!row) throw new AppError('Delivery not found', 404);
    if (!allowed.includes(row.status)) throw new AppError(`Delivery is already ${row.status.replace('_', ' ').toLowerCase()}`, 400);
    return row;
  }
}
