import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { customers, installments, products, returns } from '../../db/schema.js';
import { AppError } from '../../middleware/error.js';

type CreateBody = {
  customerId: string;
  productId: string;
  installmentId?: string;
  type: 'RETURN' | 'EXCHANGE' | 'WARRANTY_REPLACEMENT';
  reason: 'DEFECTIVE' | 'DAMAGED_IN_USE' | 'WRONG_ITEM' | 'CUSTOMER_REQUEST' | 'WARRANTY_CLAIM' | 'OTHER';
  condition: 'GOOD' | 'DAMAGED' | 'UNUSABLE';
  notes?: string;
};

type ResolveBody = {
  status: 'APPROVED' | 'REJECTED';
  resolutionType?: 'RESALE' | 'DAMAGED_WRITE_OFF' | 'REPLACEMENT_SENT';
  replacementProductId?: string;
  refundAmount?: number;
  notes?: string;
};

export class ReturnsService {
  async list(sellerId: string, page: number, limit: number, status?: string, customerId?: string) {
    const conditions = [eq(returns.sellerId, sellerId)];
    if (status)     conditions.push(eq(returns.status, status as 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED'));
    if (customerId) conditions.push(eq(returns.customerId, customerId));
    const where = and(...conditions);

    const [rows, [{ count }]] = await Promise.all([
      db.select({
        id:                   returns.id,
        type:                 returns.type,
        reason:               returns.reason,
        condition:            returns.condition,
        status:               returns.status,
        resolutionType:       returns.resolutionType,
        refundAmount:         returns.refundAmount,
        notes:                returns.notes,
        installmentId:        returns.installmentId,
        replacementProductId: returns.replacementProductId,
        createdAt:            returns.createdAt,
        resolvedAt:           returns.resolvedAt,
        customerName:         customers.name,
        customerPhone:        customers.phone,
        productName:          products.name,
      })
        .from(returns)
        .innerJoin(customers, eq(returns.customerId, customers.id))
        .innerJoin(products, eq(returns.productId, products.id))
        .where(where)
        .orderBy(desc(returns.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      db.select({ count: sql<number>`count(*)::int` }).from(returns).where(where),
    ]);

    return { data: rows, total: count, page, limit };
  }

  async getOne(id: string, sellerId: string) {
    const [row] = await db
      .select({
        id:                   returns.id,
        sellerId:             returns.sellerId,
        installmentId:        returns.installmentId,
        customerId:           returns.customerId,
        productId:            returns.productId,
        type:                 returns.type,
        reason:               returns.reason,
        condition:            returns.condition,
        status:               returns.status,
        notes:                returns.notes,
        resolutionType:       returns.resolutionType,
        replacementProductId: returns.replacementProductId,
        refundAmount:         returns.refundAmount,
        resolvedAt:           returns.resolvedAt,
        createdAt:            returns.createdAt,
        customerName:         customers.name,
        productName:          products.name,
      })
      .from(returns)
      .innerJoin(customers, eq(returns.customerId, customers.id))
      .innerJoin(products, eq(returns.productId, products.id))
      .where(and(eq(returns.id, id), eq(returns.sellerId, sellerId)));

    if (!row) throw new AppError('Return not found', 404);
    return row;
  }

  async create(sellerId: string, userId: string, body: CreateBody) {
    const [customer, product] = await Promise.all([
      db.query.customers.findFirst({
        where: and(eq(customers.id, body.customerId), eq(customers.sellerId, sellerId), isNull(customers.deletedAt)),
        columns: { id: true, name: true },
      }),
      db.query.products.findFirst({
        where: and(eq(products.id, body.productId), eq(products.sellerId, sellerId)),
        columns: { id: true, name: true },
      }),
    ]);
    if (!customer) throw new AppError('Customer not found', 404);
    if (!product)  throw new AppError('Product not found', 404);

    if (body.installmentId) {
      const [inst] = await db
        .select({ id: installments.id })
        .from(installments)
        .innerJoin(customers, eq(installments.customerId, customers.id))
        .where(and(eq(installments.id, body.installmentId), eq(customers.sellerId, sellerId), isNull(installments.deletedAt)));
      if (!inst) throw new AppError('Installment not found', 404);
    }

    const [ret] = await db.insert(returns).values({
      sellerId,
      installmentId:   body.installmentId,
      customerId:      body.customerId,
      productId:       body.productId,
      type:            body.type,
      reason:          body.reason,
      condition:       body.condition,
      notes:           body.notes,
      createdByUserId: userId,
    }).returning();

    return { ...ret, customerName: customer.name, productName: product.name };
  }

  async resolve(id: string, sellerId: string, userId: string, body: ResolveBody) {
    const ret = await this.getOne(id, sellerId);
    if (ret.status !== 'PENDING') throw new AppError('Only pending returns can be resolved', 400);

    if (body.status === 'APPROVED') {
      if (!body.resolutionType) throw new AppError('resolutionType required when approving', 400);

      return db.transaction(async (tx) => {
        if (body.resolutionType === 'RESALE') {
          await tx.update(products)
            .set({ stock: sql`${products.stock} + 1` })
            .where(eq(products.id, ret.productId));
        }

        if (body.resolutionType === 'REPLACEMENT_SENT') {
          if (!body.replacementProductId) throw new AppError('replacementProductId required for replacement', 400);
          const repProd = await tx.query.products.findFirst({
            where: and(eq(products.id, body.replacementProductId), eq(products.sellerId, sellerId)),
            columns: { id: true, stock: true },
          });
          if (!repProd)         throw new AppError('Replacement product not found', 404);
          if (repProd.stock < 1) throw new AppError('Replacement product is out of stock', 400);
          await tx.update(products)
            .set({ stock: sql`${products.stock} - 1` })
            .where(eq(products.id, body.replacementProductId));
        }

        const [updated] = await tx.update(returns).set({
          status:               'COMPLETED',
          resolutionType:       body.resolutionType,
          replacementProductId: body.replacementProductId ?? null,
          refundAmount:         body.refundAmount != null ? String(body.refundAmount) : null,
          resolvedAt:           new Date(),
          resolvedByUserId:     userId,
          ...(body.notes && { notes: body.notes }),
        }).where(eq(returns.id, id)).returning();
        return updated;
      });
    }

    const [updated] = await db.update(returns).set({
      status:          'REJECTED',
      resolvedAt:      new Date(),
      resolvedByUserId: userId,
      ...(body.notes && { notes: body.notes }),
    }).where(eq(returns.id, id)).returning();
    return updated;
  }
}
