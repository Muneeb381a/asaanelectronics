import { and, eq, ilike, isNull, ne, or, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { customers, installments, products, sellers } from '../../db/schema.js';
import { hashCnicBoth } from '../../utils/hash.js';

export class SearchService {
  async globalSearch(sellerId: string, q: string, canSearchCnic = false) {
    const clean = q.trim().replace(/-/g, '');
    if (clean.length < 2) return { customers: [], installments: [], products: [], bureau: [] };

    const isImei  = /^\d{14,16}$/.test(clean);
    const isCnic  = /^\d{13}$/.test(clean);
    const isPhone = /^\d{10,13}$/.test(clean);

    // ── Customers (own shop) ──────────────────────────────────────────────────
    const custConds = [
      ilike(customers.name, `%${clean}%`),
    ];
    if (isPhone) custConds.push(ilike(customers.phone, `%${clean}%`));
    if (isCnic) {
      const [hmac, legacy] = hashCnicBoth(clean);
      custConds.push(eq(customers.cnicHash, hmac));
      custConds.push(eq(customers.cnicHash, legacy));
    }

    // ── Installments (own shop) ───────────────────────────────────────────────
    const instConds = [
      ilike(customers.name, `%${clean}%`),
    ];
    if (isPhone) instConds.push(ilike(customers.phone, `%${clean}%`));
    if (isImei)  instConds.push(ilike(installments.imeiNumber, `%${clean}%`));
    if (/^INV-/i.test(q.trim())) instConds.push(ilike(installments.invoiceNumber, `%${q.trim()}%`));

    // ── Products (own shop) ───────────────────────────────────────────────────
    const prodConds = [ilike(products.name, `%${clean}%`)];
    if (products.serial) prodConds.push(ilike(products.serial, `%${clean}%`));

    // Run main queries in parallel
    const [customerRows, installmentRows, productRows] = await Promise.all([
      db.select({
        id:             customers.id,
        name:           customers.name,
        phone:          customers.phone,
        area:           customers.area,
        cnicMasked:     customers.cnicMasked,
        isBlacklisted:  customers.isBlacklisted,
        verificationStatus: customers.verificationStatus,
        lifecycleStage: sql<string>`COALESCE(
          (
            SELECT CASE
              WHEN MAX(CASE WHEN i.status = 'DEFAULTED' THEN 1 ELSE 0 END) = 1 THEN 'DEFAULT'
              WHEN MAX(CASE WHEN i.status = 'ACTIVE' AND i.deleted_at IS NULL THEN 1 ELSE 0 END) = 1 THEN 'ACTIVE'
              WHEN MAX(CASE WHEN i.status = 'COMPLETED' AND i.deleted_at IS NULL THEN 1 ELSE 0 END) = 1 THEN 'CLOSED'
              ELSE NULL
            END
            FROM installments i
            WHERE i.customer_id = ${customers.id} AND i.deleted_at IS NULL
          ),
          'LEAD'
        )`,
      }).from(customers).where(and(
        eq(customers.sellerId, sellerId),
        isNull(customers.deletedAt),
        or(...custConds),
      )).limit(8),

      db.select({
        id:               installments.id,
        invoiceNumber:    installments.invoiceNumber,
        totalAmount:      installments.totalAmount,
        remaining:        installments.remaining,
        monthly:          installments.monthly,
        status:           installments.status,
        imeiNumber:       installments.imeiNumber,
        paymentFrequency: installments.paymentFrequency,
        customerName:     customers.name,
        customerPhone:    customers.phone,
        customerId:       customers.id,
        productName:      sql<string>`(SELECT p.name FROM products p WHERE p.id = ${installments.productId})`,
      }).from(installments)
        .innerJoin(customers, eq(installments.customerId, customers.id))
        .where(and(
          eq(customers.sellerId, sellerId),
          isNull(installments.deletedAt),
          or(...instConds),
        ))
        .orderBy(sql`${installments.createdAt} DESC`)
        .limit(8),

      db.select({
        id:       products.id,
        name:     products.name,
        brand:    products.brand,
        model:    products.model,
        price:    products.price,
        stock:    products.stock,
        serial:   products.serial,
        category: products.category,
      }).from(products).where(and(
        eq(products.sellerId, sellerId),
        isNull(products.deletedAt),
        or(...prodConds),
      )).limit(6),
    ]);

    // Cross-shop bureau — separate from main Promise.all so its failure never breaks search
    let bureauRows: {
      customerId:    string;
      customerName:  string;
      customerPhone: string;
      cnicMasked:    string;
      shopName:      string;
      activeCount:   number;
      defaultedCount: number;
      completedCount: number;
      totalRemaining: string;
    }[] = [];

    if (isCnic && canSearchCnic) {
      try {
        const [hmac, legacy] = hashCnicBoth(clean);
        bureauRows = await db
          .select({
            customerId:    customers.id,
            customerName:  customers.name,
            customerPhone: customers.phone,
            cnicMasked:    customers.cnicMasked,
            shopName:      sellers.shopName,
            activeCount:   sql<number>`COUNT(CASE WHEN ${installments.status} = 'ACTIVE'    THEN 1 END)::int`,
            defaultedCount: sql<number>`COUNT(CASE WHEN ${installments.status} = 'DEFAULTED' THEN 1 END)::int`,
            completedCount: sql<number>`COUNT(CASE WHEN ${installments.status} = 'COMPLETED' THEN 1 END)::int`,
            totalRemaining: sql<string>`COALESCE(SUM(CASE WHEN ${installments.status} = 'ACTIVE' THEN ${installments.remaining}::numeric ELSE 0 END), 0)::text`,
          })
          .from(customers)
          .innerJoin(sellers, eq(customers.sellerId, sellers.id))
          .leftJoin(installments, and(
            eq(installments.customerId, customers.id),
            isNull(installments.deletedAt),
          ))
          .where(and(
            or(eq(customers.cnicHash, hmac), eq(customers.cnicHash, legacy)),
            ne(customers.sellerId, sellerId),
            isNull(customers.deletedAt),
          ))
          .groupBy(
            customers.id, customers.name, customers.phone,
            customers.cnicMasked, sellers.shopName, sellers.id,
          )
          .orderBy(sql`COUNT(CASE WHEN ${installments.status} = 'ACTIVE' THEN 1 END) DESC NULLS LAST`)
          .limit(10);
      } catch (err) {
        console.error('[search] bureau lookup failed:', err);
      }
    }

    return {
      customers:    customerRows,
      installments: installmentRows,
      products:     productRows,
      bureau:       bureauRows,
    };
  }
}
