import { and, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { customers, installments, products, sellers } from '../../db/schema.js';
import { hashCnicBoth } from '../../utils/hash.js';

export class SearchService {
  async globalSearch(sellerId: string, q: string) {
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

    // Run all queries in parallel (bureau only when CNIC)
    const [customerRows, installmentRows, productRows, bureauRows] = await Promise.all([
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

      // Cross-shop bureau — only runs when search is a CNIC
      isCnic ? (async () => {
        const [hmac, legacy] = hashCnicBoth(clean);
        return db.execute<{
          shopName:       string;
          activeCount:    number;
          defaultedCount: number;
          completedCount: number;
          totalRemaining: string;
        }>(sql`
          SELECT
            s.shop_name                                                                               AS "shopName",
            COUNT(CASE WHEN i.status = 'ACTIVE'    THEN 1 END)::int                                  AS "activeCount",
            COUNT(CASE WHEN i.status = 'DEFAULTED' THEN 1 END)::int                                  AS "defaultedCount",
            COUNT(CASE WHEN i.status = 'COMPLETED' THEN 1 END)::int                                  AS "completedCount",
            COALESCE(SUM(CASE WHEN i.status = 'ACTIVE' THEN i.remaining::numeric ELSE 0 END), 0)::text AS "totalRemaining"
          FROM customers c
          JOIN sellers s ON c.seller_id = s.id
          LEFT JOIN installments i ON i.customer_id = c.id AND i.deleted_at IS NULL
          WHERE c.cnic_hash IN (${hmac}, ${legacy})
            AND c.seller_id != ${sellerId}
            AND c.deleted_at IS NULL
          GROUP BY s.shop_name, s.id, c.id
          ORDER BY "activeCount" DESC, "defaultedCount" DESC
          LIMIT 10
        `);
      })() : Promise.resolve([] as { shopName: string; activeCount: number; defaultedCount: number; completedCount: number; totalRemaining: string }[]),
    ]);

    return {
      customers:    customerRows,
      installments: installmentRows,
      products:     productRows,
      bureau:       bureauRows,
    };
  }
}
