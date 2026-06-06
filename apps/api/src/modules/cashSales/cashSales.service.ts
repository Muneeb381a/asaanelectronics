import { and, desc, eq, gte, ilike, isNull, lte, or, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { cashSales, ledgerEntries, products } from '../../db/schema.js';
import { AppError } from '../../middleware/error.js';

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

export class CashSalesService {
  async list(sellerId: string, page: number, limit: number, from?: string, to?: string, search?: string) {
    const conds = [eq(cashSales.sellerId, sellerId)];
    if (from) conds.push(gte(cashSales.createdAt, new Date(from)));
    if (to)   conds.push(lte(cashSales.createdAt, new Date(to)));
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
          createdAt:     cashSales.createdAt,
          productName:   products.name,
          productCategory: products.category,
        })
        .from(cashSales)
        .innerJoin(products, eq(cashSales.productId, products.id))
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
    if (product.stock < body.quantity) throw new AppError(`Insufficient stock — only ${product.stock} available`, 400);

    return db.transaction(async (tx) => {
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
        .set({ stock: sql`${products.stock} - ${body.quantity}` })
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

      return { ...sale, productName: product.name };
    });
  }

  async remove(id: string, sellerId: string) {
    const [existing] = await db
      .select({ id: cashSales.id, productId: cashSales.productId, quantity: cashSales.quantity, amount: cashSales.amount })
      .from(cashSales)
      .where(and(eq(cashSales.id, id), eq(cashSales.sellerId, sellerId)));

    if (!existing) throw new AppError('Cash sale not found', 404);

    await db.transaction(async (tx) => {
      await tx.delete(cashSales).where(eq(cashSales.id, id));

      await tx
        .update(products)
        .set({ stock: sql`${products.stock} + ${existing.quantity}` })
        .where(eq(products.id, existing.productId));

      await tx.delete(ledgerEntries).where(
        and(eq(ledgerEntries.referenceId, id), eq(ledgerEntries.refType, 'MANUAL')),
      );
    });

    return existing;
  }
}
