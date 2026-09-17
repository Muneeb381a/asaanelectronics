import { eq, sql, type SQL } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import type { AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';

// A staff member without canViewAllInstallments sees a customer when they created it
// OR the owner assigned it to them (Staff › Assignments). `alias` is the customers
// table alias in the surrounding query ('customers' when the table is unaliased).
export function staffScopeSql(staffUserId: string, alias = 'c'): SQL {
  const a = sql.raw(alias);
  return sql`(
    ${a}.created_by_user_id = ${staffUserId}
    OR EXISTS (
      SELECT 1 FROM customer_assignments ca
      WHERE ca.customer_id = ${a}.id AND ca.agent_id = ${staffUserId} AND ca.unassigned_at IS NULL
    )
  )`;
}

/** Same as staffScopeSql, but a no-op (TRUE) when there is no restricted staff user. */
export function staffScopeOrTrue(staffUserId: string | undefined, alias = 'c'): SQL {
  return staffUserId ? staffScopeSql(staffUserId, alias) : sql`TRUE`;
}

/**
 * Who is this request restricted to?
 * - Owner / super-admin → undefined (sees whole shop)
 * - Staff WITH canViewAllInstallments → undefined
 * - Staff WITHOUT it → their own userId; callers filter to records they created,
 *   collected, sold, or customers assigned to them.
 */
export async function resolveStaffScope(req: AuthRequest): Promise<string | undefined> {
  const user = req.user!;
  if (user.role !== 'SELLER_STAFF') return undefined;
  const member = await db.query.users.findFirst({
    where: eq(users.id, user.userId),
    columns: { permissions: true },
  });
  const canViewAll = member?.permissions?.canViewAllInstallments ?? false;
  return canViewAll ? undefined : user.userId;
}

/** 404 when the customer is outside this staff member's scope (or doesn't exist in the shop). */
export async function assertCustomerInScope(customerId: string, sellerId: string, staffUserId: string | undefined) {
  if (!staffUserId) return;
  const [row] = await db.execute<{ id: string }>(sql`
    SELECT customers.id FROM customers
    WHERE customers.id = ${customerId} AND customers.seller_id = ${sellerId}
      AND customers.deleted_at IS NULL AND ${staffScopeSql(staffUserId, 'customers')}
    LIMIT 1
  `);
  if (!row) throw new AppError('Customer not found', 404);
}
