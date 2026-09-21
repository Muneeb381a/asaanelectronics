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

async function loadStaffPermissions(userId: string) {
  const member = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { permissions: true },
  });
  return member?.permissions ?? null;
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
  const perms = await loadStaffPermissions(user.userId);
  return perms?.canViewAllInstallments ? undefined : user.userId;
}

/**
 * Same as resolveStaffScope, but ALSO unscoped when `hasSearchTerm` is true and the
 * staff member can record payments. A customer may walk up to any employee's counter
 * to pay — not just their own collector — so a deliberate search (not passive
 * browsing of "my customers") must be able to find that customer shop-wide.
 * payments.record() itself has no ownership check, so this grants no capability
 * the staff member didn't already have; it only lets them find what to act on.
 */
export async function resolveStaffScopeForSearch(req: AuthRequest, hasSearchTerm: boolean): Promise<string | undefined> {
  const user = req.user!;
  if (user.role !== 'SELLER_STAFF') return undefined;
  const perms = await loadStaffPermissions(user.userId);
  if (perms?.canViewAllInstallments) return undefined;
  if (hasSearchTerm && perms?.canRecordPayment) return undefined;
  return user.userId;
}

/**
 * For point-lookups by ID that only feed the payment-recording UI — an installment's
 * detail or settlement, its payment history, a customer opened from a search result.
 * The ID was already found through an unscoped search, so treat this the same way.
 */
export async function resolveStaffScopeForPayments(req: AuthRequest): Promise<string | undefined> {
  return resolveStaffScopeForSearch(req, true);
}

/**
 * Global search (Ctrl+K) is only shown to staff with canSearchCnic — the same
 * permission (alongside canAddInstallment/canAddCustomer/canRecordPayment) that
 * already unlocks the unscoped CNIC lookup on customers.routes.ts. Keep both
 * "can this staff member look up an arbitrary customer" checks in sync.
 */
export async function resolveStaffScopeForLookup(req: AuthRequest): Promise<string | undefined> {
  const user = req.user!;
  if (user.role !== 'SELLER_STAFF') return undefined;
  const perms = await loadStaffPermissions(user.userId);
  if (perms?.canViewAllInstallments) return undefined;
  const canLookUpAnyCustomer =
    perms?.canSearchCnic || perms?.canRecordPayment || perms?.canAddInstallment || perms?.canAddCustomer;
  return canLookUpAnyCustomer ? undefined : user.userId;
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
