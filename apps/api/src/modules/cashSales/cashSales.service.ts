import { and, desc, eq, gte, ilike, isNull, lte, or, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { cashSales, ledgerEntries, products } from '../../db/schema.js';
import { AppError } from '../../middleware/error.js';
import { markUnitSoldInTx, markUnitAvailableInTx, productHasUnits } from '../productUnits/productUnits.service.js';
import { clearSellerStatsCache } from '../stats/stats.service.js';

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
      .select({ id: cashSales.id, productId: cashSales.productId, amount: cashSales.amount, customerName: cashSales.customerName })
      .from(cashSales)
      .where(and(eq(cashSales.id, id), eq(cashSales.sellerId, sellerId)));

    if (!existing) throw new AppError('Cash sale not found', 404);

    const newAmount = body.amount != null ? String(body.amount) : undefined;

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
      .select({ id: cashSales.id, productId: cashSales.productId, quantity: cashSales.quantity, amount: cashSales.amount, imeiNumber: cashSales.imeiNumber })
      .from(cashSales)
      .where(and(eq(cashSales.id, id), eq(cashSales.sellerId, sellerId)));

    if (!existing) throw new AppError('Cash sale not found', 404);

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
