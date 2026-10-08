import { and, desc, eq, gte, isNull, lt, sql, inArray } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  customerAssignments, salaryDeductions, users, customers, installments,
  payments, sellers,
} from '../../db/schema.js';
import { AppError } from '../../middleware/error.js';
import { daysOverdueSql } from '../../utils/dueDate.js';

// ── Assignments ──────────────────────────────────────────────────────────────

// Reports per assigned customer whether the responsible agent has actually
// done anything: last payment received, last recovery action logged (call/
// visit/promise/refusal), and how overdue they currently are — so an
// assignment shows real collection status, not just a name on a roster.
export async function listAgentPortfolio(sellerId: string, agentId?: string) {
  const rows = await db.execute<{
    id: string; agent_id: string; agent_name: string;
    customer_id: string; customer_name: string; customer_phone: string | null;
    assigned_at: string; notes: string | null;
    installment_id: string | null; installment_amount: string | null;
    installment_remaining: string | null; installment_status: string | null;
    days_overdue: number | null;
    last_payment_amount: string | null; last_payment_date: string | null;
    last_action_type: string | null; last_action_date: string | null; last_promise_date: string | null;
  }>(sql`
    SELECT
      ca.id,
      ca.agent_id,
      u.name           AS agent_name,
      ca.customer_id,
      c.name           AS customer_name,
      c.phone          AS customer_phone,
      ca.assigned_at,
      ca.notes,
      i.id             AS installment_id,
      i.monthly        AS installment_amount,
      i.remaining      AS installment_remaining,
      i.status         AS installment_status,
      CASE WHEN i.id IS NULL THEN NULL ELSE ${daysOverdueSql('i')} END AS days_overdue,
      lp.amount        AS last_payment_amount,
      lp.paid_on       AS last_payment_date,
      la.type          AS last_action_type,
      la.created_at    AS last_action_date,
      la.promise_date  AS last_promise_date
    FROM customer_assignments ca
    JOIN users u     ON u.id  = ca.agent_id
    JOIN customers c ON c.id  = ca.customer_id
    LEFT JOIN LATERAL (
      SELECT id, monthly, remaining, status, total_amount, down_payment,
             start_date, payment_frequency, payment_due_day
      FROM installments
      WHERE customer_id = ca.customer_id
        AND deleted_at IS NULL
        AND status IN ('ACTIVE', 'PENDING')
      ORDER BY created_at DESC
      LIMIT 1
    ) i ON true
    LEFT JOIN LATERAL (
      SELECT pay.amount, pay.paid_on
      FROM payments pay
      WHERE pay.installment_id = i.id AND pay.deleted_at IS NULL
      ORDER BY pay.paid_on DESC
      LIMIT 1
    ) lp ON i.id IS NOT NULL
    LEFT JOIN LATERAL (
      SELECT type, created_at, promise_date
      FROM recovery_actions
      WHERE installment_id = i.id
      ORDER BY created_at DESC
      LIMIT 1
    ) la ON i.id IS NOT NULL
    WHERE ca.seller_id   = ${sellerId}
      AND ca.unassigned_at IS NULL
      ${agentId ? sql`AND ca.agent_id = ${agentId}` : sql``}
    ORDER BY u.name, days_overdue DESC NULLS LAST, c.name
  `);
  return rows;
}

export async function assignCustomer(
  sellerId: string,
  assignedById: string,
  body: { customerId: string; agentId: string; notes?: string },
) {
  // Verify customer belongs to seller
  const customer = await db.query.customers.findFirst({
    where: and(eq(customers.id, body.customerId), eq(customers.sellerId, sellerId), isNull(customers.deletedAt)),
    columns: { id: true, name: true },
  });
  if (!customer) throw new AppError('Customer not found', 404);

  // Verify agent belongs to seller
  const agent = await db.query.users.findFirst({
    where: and(eq(users.id, body.agentId), eq(users.sellerId, sellerId), eq(users.role, 'SELLER_STAFF')),
    columns: { id: true, name: true },
  });
  if (!agent) throw new AppError('Staff member not found', 404);

  // Check not already actively assigned to someone
  const existing = await db.query.customerAssignments.findFirst({
    where: and(
      eq(customerAssignments.sellerId, sellerId),
      eq(customerAssignments.customerId, body.customerId),
      isNull(customerAssignments.unassignedAt),
    ),
    columns: { id: true, agentId: true },
  });
  if (existing && existing.agentId === body.agentId) {
    throw new AppError('Customer is already assigned to this agent', 409);
  }

  // Unassign from previous agent if any
  if (existing) {
    await db.update(customerAssignments)
      .set({ unassignedAt: new Date() })
      .where(eq(customerAssignments.id, existing.id));
  }

  const [row] = await db.insert(customerAssignments).values({
    sellerId,
    customerId:   body.customerId,
    agentId:      body.agentId,
    assignedById,
    notes:        body.notes ?? null,
  }).returning();

  return { ...row, customerName: customer.name, agentName: agent.name };
}

export async function unassignCustomer(id: string, sellerId: string) {
  const existing = await db.query.customerAssignments.findFirst({
    where: and(
      eq(customerAssignments.id, id),
      eq(customerAssignments.sellerId, sellerId),
      isNull(customerAssignments.unassignedAt),
    ),
    columns: { id: true },
  });
  if (!existing) throw new AppError('Active assignment not found', 404);

  const [updated] = await db.update(customerAssignments)
    .set({ unassignedAt: new Date() })
    .where(eq(customerAssignments.id, id))
    .returning();

  return updated;
}

// ── Salary Deductions ────────────────────────────────────────────────────────

export async function listDeductions(sellerId: string, staffId: string, month: string) {
  const rows = await db.execute<{
    id: string; type: string; amount: string; description: string;
    customer_name: string | null; installment_id: string | null; created_at: string;
  }>(sql`
    SELECT
      sd.id,
      sd.type,
      sd.amount,
      sd.description,
      c.name    AS customer_name,
      sd.installment_id,
      sd.created_at
    FROM salary_deductions sd
    LEFT JOIN customers c ON c.id = sd.customer_id
    WHERE sd.seller_id = ${sellerId}
      AND sd.staff_id  = ${staffId}
      AND sd.month     = ${month}
    ORDER BY sd.created_at
  `);
  return rows;
}

export async function addDeduction(
  sellerId: string,
  createdById: string,
  body: {
    staffId: string;
    month: string;
    type: 'UNCOLLECTED' | 'ADVANCE' | 'DAMAGE' | 'OTHER';
    amount: number;
    description: string;
    installmentId?: string;
    customerId?: string;
  },
) {
  const staff = await db.query.users.findFirst({
    where: and(eq(users.id, body.staffId), eq(users.sellerId, sellerId), eq(users.role, 'SELLER_STAFF')),
    columns: { id: true },
  });
  if (!staff) throw new AppError('Staff not found', 404);

  if (body.installmentId) {
    const [inst] = await db.select({ id: installments.id }).from(installments)
      .innerJoin(customers, eq(installments.customerId, customers.id))
      .where(and(eq(installments.id, body.installmentId), eq(customers.sellerId, sellerId)));
    if (!inst) throw new AppError('Installment not found', 404);
  }
  if (body.customerId) {
    const cust = await db.query.customers.findFirst({
      where: and(eq(customers.id, body.customerId), eq(customers.sellerId, sellerId)),
      columns: { id: true },
    });
    if (!cust) throw new AppError('Customer not found', 404);
  }

  const [row] = await db.insert(salaryDeductions).values({
    sellerId,
    staffId:       body.staffId,
    month:         body.month,
    type:          body.type,
    amount:        String(body.amount),
    description:   body.description,
    installmentId: body.installmentId ?? null,
    customerId:    body.customerId    ?? null,
    createdById,
  }).returning();

  return row;
}

export async function removeDeduction(id: string, sellerId: string) {
  const [deleted] = await db.delete(salaryDeductions)
    .where(and(eq(salaryDeductions.id, id), eq(salaryDeductions.sellerId, sellerId)))
    .returning();
  if (!deleted) throw new AppError('Deduction not found', 404);
  return deleted;
}

// ── Auto-calculate uncollected deductions for a month ────────────────────────
// For every agent, find their assigned customers, check which had no payment
// in the given month, and create UNCOLLECTED deduction rows for each miss.

export async function calculateUncollectedDeductions(sellerId: string, createdById: string, month: string) {
  // month = "2026-08"
  const [year, mo] = month.split('-').map(Number);
  const fromDate = new Date(year!, mo! - 1, 1);
  const toDate   = new Date(year!, mo!, 1); // exclusive

  // 1. Get all active assignments for this seller in this month
  //    Active = unassigned_at IS NULL OR unassigned_at > fromDate (still assigned during the month)
  const assignments = await db.execute<{
    assignment_id: string; agent_id: string; agent_name: string;
    customer_id: string; customer_name: string;
    installment_id: string | null; monthly_amount: string | null;
  }>(sql`
    SELECT
      ca.id          AS assignment_id,
      ca.agent_id,
      u.name         AS agent_name,
      ca.customer_id,
      c.name         AS customer_name,
      i.id           AS installment_id,
      i.monthly      AS monthly_amount
    FROM customer_assignments ca
    JOIN users u     ON u.id = ca.agent_id
    JOIN customers c ON c.id = ca.customer_id
    LEFT JOIN LATERAL (
      SELECT id, monthly
      FROM installments
      WHERE customer_id = ca.customer_id
        AND deleted_at IS NULL
        AND status = 'ACTIVE'
      ORDER BY created_at DESC
      LIMIT 1
    ) i ON true
    WHERE ca.seller_id = ${sellerId}
      AND ca.assigned_at < ${toDate.toISOString()}
      AND (ca.unassigned_at IS NULL OR ca.unassigned_at >= ${fromDate.toISOString()})
      AND i.id IS NOT NULL
  `);

  if (!assignments.length) return { created: 0, skipped: 0, deductions: [] };

  // 2. Find which customers actually paid in this month
  const customerIds = [...new Set(assignments.map((a) => a.customer_id))];
  const paidRows = await db.selectDistinct({ customerId: installments.customerId })
    .from(payments)
    .innerJoin(installments, eq(installments.id, payments.installmentId))
    .where(and(
      inArray(installments.customerId, customerIds),
      gte(payments.paidOn, fromDate),
      lt(payments.paidOn, toDate),
      isNull(payments.deletedAt),
    ));
  const paidCustomerIds = new Set(paidRows.map((r) => r.customerId));

  // 3. Check which deductions already exist (to avoid duplicates)
  const agentIds = [...new Set(assignments.map((a) => a.agent_id))];
  const existingRows = agentIds.length
    ? await db.select({ staffId: salaryDeductions.staffId, installmentId: salaryDeductions.installmentId })
        .from(salaryDeductions)
        .where(and(
          eq(salaryDeductions.sellerId, sellerId),
          eq(salaryDeductions.month, month),
          eq(salaryDeductions.type, 'UNCOLLECTED'),
          inArray(salaryDeductions.staffId, agentIds),
        ))
    : [];
  const existingKeys = new Set(existingRows.map((r) => `${r.staffId}:${r.installmentId}`));

  // 4. Build new deduction rows for misses
  const toInsert: Array<{
    sellerId: string; staffId: string; month: string; type: 'UNCOLLECTED';
    amount: string; description: string;
    installmentId: string; customerId: string; createdById: string;
  }> = [];

  for (const a of assignments) {
    if (!a.installment_id || !a.monthly_amount) continue;
    if (paidCustomerIds.has(a.customer_id)) continue; // paid — no deduction
    const key = `${a.agent_id}:${a.installment_id}`;
    if (existingKeys.has(key)) continue; // already exists

    toInsert.push({
      sellerId,
      staffId:       a.agent_id,
      month,
      type:          'UNCOLLECTED',
      amount:        a.monthly_amount,
      description:   `${a.customer_name} ne ${month} mein koi payment nahi di`,
      installmentId: a.installment_id,
      customerId:    a.customer_id,
      createdById,
    });
  }

  const created = toInsert.length
    ? await db.insert(salaryDeductions).values(toInsert).returning()
    : [];

  return { created: created.length, skipped: assignments.length - toInsert.length, deductions: created };
}

// ── Salary Summary ────────────────────────────────────────────────────────────
// For each agent: base salary, total deductions, net = base - deductions

export async function salarySummary(sellerId: string, month: string) {
  const staffList = await db
    .select({ id: users.id, name: users.name, monthlySalary: users.monthlySalary })
    .from(users)
    .where(and(eq(users.sellerId, sellerId), eq(users.role, 'SELLER_STAFF')));

  if (!staffList.length) return { month, staff: [] };

  const staffIds = staffList.map((s) => s.id);

  // Deductions-per-staff and portfolio-size-per-agent are independent reads,
  // both keyed only on staffIds — fetch together.
  const [dedRows, portfolioRows] = await Promise.all([
    // Total deductions per staff for this month
    db.select({
      staffId: salaryDeductions.staffId,
      total:   sql<string>`SUM(${salaryDeductions.amount})::text`,
      count:   sql<string>`COUNT(*)::text`,
    })
      .from(salaryDeductions)
      .where(and(
        eq(salaryDeductions.sellerId, sellerId),
        eq(salaryDeductions.month, month),
        inArray(salaryDeductions.staffId, staffIds),
      ))
      .groupBy(salaryDeductions.staffId),

    // Portfolio size per agent
    db.select({
      agentId: customerAssignments.agentId,
      count:   sql<string>`COUNT(*)::text`,
    })
      .from(customerAssignments)
      .where(and(
        eq(customerAssignments.sellerId, sellerId),
        isNull(customerAssignments.unassignedAt),
        inArray(customerAssignments.agentId, staffIds),
      ))
      .groupBy(customerAssignments.agentId),
  ]);
  const dedMap       = new Map(dedRows.map((r) => [r.staffId, { total: Number(r.total), count: Number(r.count) }]));
  const portfolioMap = new Map(portfolioRows.map((r) => [r.agentId, Number(r.count)]));

  return {
    month,
    staff: staffList.map((s) => {
      const base       = s.monthlySalary ? Number(s.monthlySalary) : 0;
      const ded        = dedMap.get(s.id) ?? { total: 0, count: 0 };
      const net        = Math.max(0, base - ded.total);
      const portfolio  = portfolioMap.get(s.id) ?? 0;
      return {
        id:             s.id,
        name:           s.name,
        baseSalary:     base,
        deductions:     ded.total,
        deductionCount: ded.count,
        netSalary:      net,
        portfolioSize:  portfolio,
      };
    }),
  };
}
