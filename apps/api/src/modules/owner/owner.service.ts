import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  sellers, users, customers, products, installments, payments,
  verifications, recoveryActions, expenses, ledgerEntries, cashSales,
  auditLogs, returns,
} from '../../db/schema.js';
import { AppError } from '../../middleware/error.js';
import { hashPassword } from '../../utils/hash.js';

export class OwnerService {
  async listShops() {
    const rows = await db
      .select({
        id: sellers.id,
        shopName: sellers.shopName,
        phone: sellers.phone,
        address: sellers.address,
        plan: sellers.plan,
        isActive: sellers.isActive,
        trialEndsAt: sellers.trialEndsAt,
        planExpiresAt: sellers.planExpiresAt,
        createdAt: sellers.createdAt,
        ownerName: users.name,
        ownerEmail: users.email,
        ownerId: users.id,
      })
      .from(sellers)
      .leftJoin(users, and(eq(users.sellerId, sellers.id), eq(users.role, 'SELLER_OWNER')));

    return rows;
  }

  async toggleShopStatus(id: string, isActive: boolean) {
    const shop = await db.query.sellers.findFirst({ where: eq(sellers.id, id), columns: { id: true } });
    if (!shop) throw new AppError('Shop not found', 404);
    const [updated] = await db.update(sellers).set({ isActive }).where(eq(sellers.id, id)).returning();
    return updated;
  }

  async createShop(body: { shopName: string; phone: string; address?: string; plan?: 'TRIAL' | 'BASIC' | 'PRO' }) {
    const [seller] = await db
      .insert(sellers)
      .values({
        shopName: body.shopName,
        phone: body.phone,
        address: body.address,
        plan: body.plan ?? 'TRIAL',
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      })
      .returning();
    return seller;
  }

  async createShopOwner(sellerId: string, body: { name: string; email: string; password: string }) {
    const shop = await db.query.sellers.findFirst({ where: eq(sellers.id, sellerId), columns: { id: true } });
    if (!shop) throw new AppError('Shop not found', 404);

    const existing = await db.query.users.findFirst({ where: eq(users.email, body.email), columns: { id: true } });
    if (existing) throw new AppError('Email already registered', 409);

    const password = await hashPassword(body.password);
    const [user] = await db
      .insert(users)
      .values({ name: body.name, email: body.email, password, role: 'SELLER_OWNER', sellerId })
      .returning();

    return { id: user!.id, name: user!.name, email: user!.email, sellerId: user!.sellerId };
  }

  async deleteShop(id: string) {
    const shop = await db.query.sellers.findFirst({ where: eq(sellers.id, id), columns: { id: true } });
    if (!shop) throw new AppError('Shop not found', 404);

    await db.transaction(async (tx) => {
      // Collect IDs needed for child queries
      const shopCustomers = await tx
        .select({ id: customers.id })
        .from(customers)
        .where(eq(customers.sellerId, id));
      const customerIds = shopCustomers.map((c) => c.id);

      const installmentIds: string[] = [];
      if (customerIds.length > 0) {
        const shopInstallments = await tx
          .select({ id: installments.id })
          .from(installments)
          .where(inArray(installments.customerId, customerIds));
        installmentIds.push(...shopInstallments.map((i) => i.id));
      }

      // 1. verifications — avoId → users is RESTRICT, must go first
      if (customerIds.length > 0) {
        await tx.delete(verifications).where(inArray(verifications.customerId, customerIds));
      }

      // 2. returns — customerId → customers and productId → products are RESTRICT
      await tx.delete(returns).where(eq(returns.sellerId, id));

      // 3. recovery_actions — sellerId → sellers is RESTRICT (installmentId cascade would handle it
      //    when installments are deleted, but we delete installments next so do this first)
      await tx.delete(recoveryActions).where(eq(recoveryActions.sellerId, id));

      // 4. payments — installmentId → installments is RESTRICT
      if (installmentIds.length > 0) {
        await tx.delete(payments).where(inArray(payments.installmentId, installmentIds));
      }

      // 5. installments — customerId → customers is RESTRICT
      if (customerIds.length > 0) {
        await tx.delete(installments).where(inArray(installments.customerId, customerIds));
      }

      // 6. customers — cascades customer_notes and any remaining verifications
      await tx.delete(customers).where(eq(customers.sellerId, id));

      // 7. remaining shop-level records (all sellerId → sellers RESTRICT)
      await tx.delete(expenses).where(eq(expenses.sellerId, id));
      await tx.delete(ledgerEntries).where(eq(ledgerEntries.sellerId, id));
      await tx.delete(cashSales).where(eq(cashSales.sellerId, id));
      await tx.delete(auditLogs).where(eq(auditLogs.sellerId, id));

      // 8. products — sellerId → sellers RESTRICT (cash_sales already deleted above)
      await tx.delete(products).where(eq(products.sellerId, id));

      // 9. users — sellerId → sellers RESTRICT; refresh_tokens and otps cascade automatically
      await tx.delete(users).where(eq(users.sellerId, id));

      // 10. seller — chart_of_accounts, journal_entries → ledger_lines,
      //     reconciliation_runs, payment_accounts all cascade from here
      await tx.delete(sellers).where(eq(sellers.id, id));
    });
  }
}
