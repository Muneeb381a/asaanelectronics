import { sql, type SQL } from 'drizzle-orm';

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
