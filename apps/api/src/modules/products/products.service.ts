import { and, asc, eq, ilike, isNull, isNotNull, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { db } from '../../db/index.js';
import { products, installments, supplierInvoices, supplierInvoiceLines } from '../../db/schema.js';
import { AppError } from '../../middleware/error.js';
import type { CreateProductInput, UpdateProductInput } from '@assaan/shared';

export interface BulkReceiveUnit {
  name:             string;
  category?:        string;
  brand?:           string;
  model?:           string;
  color?:           string;
  purchasePrice?:   number;
  price:            number;   // sale price
  installmentPrice?: number;
  stock?:           number;
  minStock?:        number;
  description?:     string;
  // mobile
  imeiNumber?:      string;
  // vehicle
  chassisNumber?:   string;
  engineNumber?:    string;
  registrationNumber?: string;
  vehicleCondition?: 'NEW' | 'USED';
  modelYear?:       number;
  letterStatus?:    'NONE' | 'FIRST_NOTICE' | 'SECOND_NOTICE' | 'LEGAL_NOTICE' | 'FILED';
  biometricStatus?: 'PENDING' | 'SELLER_DONE' | 'BUYER_DONE' | 'COMPLETED' | 'NOT_REQUIRED';
  vehicleFileLocation?: 'WITH_SHOP' | 'WITH_CUSTOMER' | 'WITH_RTO' | 'WITH_NADRA' | 'IN_TRANSFER' | 'WITH_COURT' | 'WITH_POLICE';
}

export interface BulkReceiveInput {
  supplierId?:  string;
  invoiceDate?: string;
  paidAmount?:  number;
  units:        BulkReceiveUnit[];
}

export class ProductsService {
  async list(sellerId: string, page: number, limit: number, search?: string) {
    const base = and(eq(products.sellerId, sellerId), isNull(products.deletedAt));
    const where = search
      ? and(base, ilike(products.name, `%${search}%`))
      : base;

    const [rows, [{ count }]] = await Promise.all([
      db.select().from(products).where(where).limit(limit).offset((page - 1) * limit).orderBy(asc(products.name)),
      db.select({ count: sql<number>`count(*)::int` }).from(products).where(where),
    ]);

    return { data: rows, total: count, page, limit };
  }

  async create(sellerId: string, body: CreateProductInput) {
    const [product] = await db
      .insert(products)
      .values({
        ...body,
        price: String(body.price),
        installmentPrice: body.installmentPrice !== undefined ? String(body.installmentPrice) : undefined,
        purchasePrice: body.purchasePrice !== undefined ? String(body.purchasePrice) : undefined,
        supplierId: body.supplierId ?? null,
        sellerId,
      })
      .returning();
    return product;
  }

  async update(id: string, sellerId: string, body: UpdateProductInput) {
    const existing = await db.query.products.findFirst({
      where: and(eq(products.id, id), eq(products.sellerId, sellerId), isNull(products.deletedAt)),
    });
    if (!existing) throw new AppError('Product not found', 404);

    const { price, installmentPrice, purchasePrice, supplierId, ...rest } = body;
    const [updated] = await db
      .update(products)
      .set({
        ...rest,
        ...(price !== undefined && { price: String(price) }),
        ...(installmentPrice !== undefined && { installmentPrice: String(installmentPrice) }),
        ...(purchasePrice !== undefined && { purchasePrice: String(purchasePrice) }),
        ...(supplierId !== undefined && { supplierId: supplierId || null }),
      })
      .where(and(eq(products.id, id), eq(products.sellerId, sellerId)))
      .returning();
    return updated;
  }

  async remove(id: string, sellerId: string, deletedBy?: string) {
    const existing = await db.query.products.findFirst({
      where: and(eq(products.id, id), eq(products.sellerId, sellerId), isNull(products.deletedAt)),
    });
    if (!existing) throw new AppError('Product not found', 404);

    await db.update(products)
      .set({ deletedAt: new Date(), deletedBy })
      .where(and(eq(products.id, id), eq(products.sellerId, sellerId)));
    return existing;
  }

  async getCategories(sellerId: string) {
    const rows = await db
      .selectDistinct({ category: products.category })
      .from(products)
      .where(and(eq(products.sellerId, sellerId), isNull(products.deletedAt), isNotNull(products.category)))
      .orderBy(asc(products.category));
    return rows.map((r) => r.category).filter(Boolean) as string[];
  }

  async getIntelligence(sellerId: string) {
    type Row = {
      id: string; name: string; stock: number; purchase_price: string | null;
      sales_last30: number; sales_prev30: number; sales_90: number;
      last_sale_at: string | null; velocity30: number; days_since_last: number | null;
    };

    const rows = await db.execute<Row>(sql`
      WITH sales AS (
        SELECT
          p.id, p.name, p.stock, p.purchase_price,
          COUNT(CASE WHEN i.created_at >= NOW() - INTERVAL '30 days'  THEN 1 END)::int  AS sales_last30,
          COUNT(CASE WHEN i.created_at >= NOW() - INTERVAL '60 days'
                      AND i.created_at <  NOW() - INTERVAL '30 days'  THEN 1 END)::int  AS sales_prev30,
          COUNT(CASE WHEN i.created_at >= NOW() - INTERVAL '90 days'  THEN 1 END)::int  AS sales_90,
          MAX(CASE WHEN i.status != 'CANCELLED' AND i.deleted_at IS NULL THEN i.created_at END) AS last_sale_at
        FROM products p
        LEFT JOIN installments i ON i.product_id = p.id AND i.deleted_at IS NULL AND i.status != 'CANCELLED'
        WHERE p.seller_id = ${sellerId} AND p.deleted_at IS NULL
        GROUP BY p.id, p.name, p.stock, p.purchase_price
      )
      SELECT *,
        ROUND(sales_90::numeric / 3.0, 1)                      AS velocity30,
        EXTRACT(DAY FROM NOW() - last_sale_at)::int             AS days_since_last
      FROM sales
      ORDER BY sales_last30 DESC, name ASC
    `);

    const fastMoving = rows
      .filter((r) => r.sales_last30 > 0)
      .slice(0, 8)
      .map((r) => ({
        id: r.id, name: r.name, stock: r.stock,
        salesLast30: Number(r.sales_last30),
        trendPct: r.sales_prev30 > 0
          ? Math.round(((r.sales_last30 - r.sales_prev30) / r.sales_prev30) * 100)
          : null,
      }));

    const slowMoving = rows
      .filter((r) => r.stock > 0 && (r.days_since_last === null || Number(r.days_since_last) > 30))
      .map((r) => ({
        id: r.id, name: r.name, stock: r.stock,
        daysSinceLastSale: r.days_since_last !== null ? Number(r.days_since_last) : null,
        severity: (r.days_since_last === null || Number(r.days_since_last) > 90) ? 'CRITICAL' as const : 'WARNING' as const,
      }))
      .sort((a, b) => (a.severity === 'CRITICAL' ? -1 : 1) || (b.daysSinceLastSale ?? 999) - (a.daysSinceLastSale ?? 999))
      .slice(0, 10);

    const demandForecast = rows
      .map((r) => {
        const velocity = Number(r.velocity30);
        const predicted30 = Math.round(velocity);
        const confidence = r.sales_90 >= 9 ? 'HIGH' as const : r.sales_90 >= 4 ? 'MEDIUM' as const : 'LOW' as const;
        return { id: r.id, name: r.name, stock: r.stock, predicted30, confidence, salesLast30: Number(r.sales_last30) };
      })
      .filter((r) => r.predicted30 > 0 || r.salesLast30 > 0)
      .sort((a, b) => b.predicted30 - a.predicted30)
      .slice(0, 10);

    const reorderSuggestions = rows
      .flatMap((r) => {
        const predicted30 = Math.round(Number(r.velocity30));
        if (predicted30 === 0) return [];
        if (r.stock >= predicted30 * 1.5) return [];
        const velocity7 = predicted30 / 4.3;
        const priority  = r.stock < velocity7 ? 'URGENT' as const : 'SOON' as const;
        return [{
          id: r.id, name: r.name, stock: r.stock, predicted30,
          suggestedQty:  Math.max(1, Math.ceil(predicted30 * 2) - r.stock),
          priority,
          purchasePrice: r.purchase_price,
        }];
      })
      .sort((a, b) => (a.priority === 'URGENT' ? -1 : 1))
      .slice(0, 10);

    return { fastMoving, slowMoving, demandForecast, reorderSuggestions };
  }

  async bulkCreate(sellerId: string, input: BulkReceiveInput) {
    if (!input.units?.length) throw new AppError('At least one unit required', 400);
    if (input.units.length > 100) throw new AppError('Max 100 units per batch', 400);

    return db.transaction(async (tx) => {
      // Insert all product records
      const created = await tx
        .insert(products)
        .values(
          input.units.map((u) => ({
            id:                 randomUUID(),
            sellerId,
            name:               u.name,
            category:           u.category ?? null,
            brand:              u.brand ?? null,
            model:              u.model ?? null,
            color:              u.color ?? null,
            price:              String(u.price),
            installmentPrice:   u.installmentPrice != null ? String(u.installmentPrice) : null,
            purchasePrice:      u.purchasePrice   != null ? String(u.purchasePrice)   : null,
            stock:              u.stock ?? 1,
            minStock:           u.minStock ?? 1,
            description:        u.description ?? null,
            supplierId:         input.supplierId ?? null,
            imeiNumber:         u.imeiNumber       ?? null,
            chassisNumber:      u.chassisNumber    ?? null,
            engineNumber:       u.engineNumber     ?? null,
            registrationNumber: u.registrationNumber ?? null,
            vehicleCondition:   u.vehicleCondition ?? null,
            modelYear:          u.modelYear        ?? null,
            letterStatus:       u.letterStatus     ?? null,
            biometricStatus:    u.biometricStatus  ?? null,
            vehicleFileLocation: u.vehicleFileLocation ?? null,
          })),
        )
        .returning();

      // Create supplier invoice if supplierId given
      if (input.supplierId && input.invoiceDate) {
        const totalAmount = input.units.reduce((s, u) => s + (u.purchasePrice ?? 0), 0);
        const desc = `Stock receive: ${input.units[0]?.name ?? 'products'} ×${input.units.length}`;

        const [invoice] = await tx
          .insert(supplierInvoices)
          .values({
            id:          randomUUID(),
            sellerId,
            supplierId:  input.supplierId,
            totalAmount: String(totalAmount),
            paidAmount:  String(input.paidAmount ?? 0),
            description: desc,
            invoiceDate: input.invoiceDate,
          })
          .returning();

        await tx.insert(supplierInvoiceLines).values(
          created.map((p, i) => ({
            id:          randomUUID(),
            invoiceId:   invoice!.id,
            sellerId,
            productId:   p.id,
            productName: p.name,
            quantity:    1,
            unitPrice:   String(input.units[i]?.purchasePrice ?? p.price),
          })),
        );
      }

      return created;
    });
  }

  async getValuation(sellerId: string) {
    const [row] = await db.execute<{
      total_stock_value: string;
      total_sale_value: string;
      products_with_cost: number;
      total_products: number;
      total_units: number;
    }>(sql`
      SELECT
        COALESCE(SUM(stock * purchase_price::numeric), 0)      AS total_stock_value,
        COALESCE(SUM(stock * price::numeric), 0)               AS total_sale_value,
        COUNT(*) FILTER (WHERE purchase_price IS NOT NULL)::int AS products_with_cost,
        COUNT(*)::int                                           AS total_products,
        COALESCE(SUM(stock), 0)::int                           AS total_units
      FROM products
      WHERE seller_id = ${sellerId} AND deleted_at IS NULL AND stock > 0
    `);
    const r = row!;
    return {
      totalStockValue:   Number(r.total_stock_value),
      totalSaleValue:    Number(r.total_sale_value),
      potentialProfit:   Number(r.total_sale_value) - Number(r.total_stock_value),
      productsWithCost:  r.products_with_cost,
      totalProducts:     r.total_products,
      totalUnits:        r.total_units,
    };
  }

}
