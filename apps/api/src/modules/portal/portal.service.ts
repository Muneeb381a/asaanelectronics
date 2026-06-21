import { and, desc, eq, isNull, or, sql, sum } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { customers, installments, payments, products, sellers } from '../../db/schema.js';
import { AppError } from '../../middleware/error.js';
import { hashCnic, hashCnicBoth } from '../../utils/hash.js';
import { signCustomerToken } from '../../utils/jwt.js';

export class PortalService {
  async login(cnic: string, phone: string) {
    const [hmacHash, legacyHash] = hashCnicBoth(cnic);

    const customer = await db.query.customers.findFirst({
      where: and(
        or(eq(customers.cnicHash, hmacHash), eq(customers.cnicHash, legacyHash)),
        eq(customers.phone, phone),
        isNull(customers.deletedAt),
      ),
    });
    if (!customer) throw new AppError('No account found with these details', 404);

    // Silently upgrade legacy SHA-256 hash to HMAC-SHA256
    if (customer.cnicHash !== hmacHash) {
      await db.update(customers).set({ cnicHash: hmacHash }).where(eq(customers.id, customer.id));
    }

    const seller = await db.query.sellers.findFirst({
      where: eq(sellers.id, customer.sellerId),
      columns: { shopName: true },
    });

    const token = signCustomerToken({
      customerId: customer.id,
      sellerId:   customer.sellerId,
      type:       'CUSTOMER',
    });

    return {
      token,
      customer: {
        id:                 customer.id,
        name:               customer.name,
        cnicMasked:         customer.cnicMasked,
        phone:              customer.phone,
        verificationStatus: customer.verificationStatus,
      },
      shopName: seller?.shopName ?? 'Your Shop',
    };
  }

  async getProfile(customerId: string) {
    const customer = await db.query.customers.findFirst({
      where: and(eq(customers.id, customerId), isNull(customers.deletedAt)),
      columns: {
        id: true, name: true, cnicMasked: true, phone: true, address: true,
        occupation: true, employer: true, verificationStatus: true,
        guarantorName: true, guarantorPhone: true,
        guarantor2Name: true, guarantor2Phone: true,
        photoUrl: true, createdAt: true, sellerId: true,
      },
    });
    if (!customer) throw new AppError('Customer not found', 404);

    // Single CTE replaces 3 separate round-trips (lifecycle + stats + risk), all derived from one pass over installments
    const [combinedRows, seller] = await Promise.all([
      db.execute<{
        defaulted_count: number; active_count: number; completed_count: number;
        active_or_pending: number; overdue_active_count: number;
        total_paid: string; total_remaining: string; active_count_num: number; next_due: string | null;
        guarantor_name: string | null; guarantor_cnic: string | null; guarantor2_cnic: string | null;
      }>(sql`
        WITH inst_agg AS (
          SELECT
            COUNT(*) FILTER (WHERE i.status = 'DEFAULTED' AND i.deleted_at IS NULL)           AS defaulted_count,
            COUNT(*) FILTER (WHERE i.status = 'ACTIVE'    AND i.deleted_at IS NULL)            AS active_count,
            COUNT(*) FILTER (WHERE i.status = 'COMPLETED' AND i.deleted_at IS NULL)            AS completed_count,
            COUNT(*) FILTER (WHERE i.status IN ('ACTIVE','PENDING') AND i.deleted_at IS NULL)  AS active_or_pending,
            COUNT(*) FILTER (
              WHERE i.status = 'ACTIVE' AND i.deleted_at IS NULL
                AND (CASE WHEN i.payment_frequency = 'daily'
                      THEN i.start_date + (i.months || ' days')::interval
                      ELSE i.start_date + (i.months || ' months')::interval
                    END) < NOW()
            )                                                                                   AS overdue_active_count,
            COALESCE(SUM(i.total_amount - i.down_payment - i.remaining)
              FILTER (WHERE i.deleted_at IS NULL AND i.status NOT IN ('CANCELLED','CLOSED')), 0)::numeric AS total_paid,
            COALESCE(SUM(i.remaining)
              FILTER (WHERE i.deleted_at IS NULL AND i.status IN ('ACTIVE','PENDING')), 0)::numeric       AS total_remaining,
            MIN(CASE WHEN i.status = 'ACTIVE' AND i.deleted_at IS NULL
              THEN (CASE WHEN i.payment_frequency = 'daily'
                THEN i.start_date + (i.months || ' days')::interval
                ELSE i.start_date + (i.months || ' months')::interval
              END)::date END)::text                                                             AS next_due
          FROM installments i
          WHERE i.customer_id = ${customerId}
        )
        SELECT a.*, c.guarantor_name, c.guarantor_cnic, c.guarantor2_cnic
        FROM inst_agg a
        CROSS JOIN customers c
        WHERE c.id = ${customerId}
      `),
      db.query.sellers.findFirst({ where: eq(sellers.id, customer.sellerId), columns: { shopName: true } }),
    ]);

    const agg = combinedRows[0];
    const defaultedCount      = Number(agg?.defaulted_count ?? 0);
    const activeCount         = Number(agg?.active_count ?? 0);
    const completedCount      = Number(agg?.completed_count ?? 0);
    const activeOrPending     = Number(agg?.active_or_pending ?? 0);
    const overdueActiveCount  = Number(agg?.overdue_active_count ?? 0);

    const lifecycleStage = (() => {
      if (defaultedCount > 0)                                   return 'DEFAULT';
      if (overdueActiveCount > 0)                               return 'AT_RISK';
      if (activeCount > 0 && completedCount > 0)                return 'REPEAT';
      if (activeCount > 0)                                      return 'ACTIVE';
      if (activeOrPending === 0 && completedCount > 0)          return 'CLOSED';
      if (customer.verificationStatus === 'APPROVED')           return 'VERIFIED';
      return 'LEAD';
    })();

    const verifPenalty = ({ 'APPROVED': 0, 'UNDER_REVIEW': 8, 'PENDING': 15, 'REJECTED': 20 } as Record<string, number>)[customer.verificationStatus ?? ''] ?? 15;
    const guarantorPenalty = agg?.guarantor_name == null ? 20 : agg.guarantor2_cnic != null ? 0 : agg.guarantor_cnic != null ? 8 : 14;
    const employPenalty = customer.occupation == null && customer.employer == null ? 10 : customer.employer == null ? 5 : 0;
    const activeCountPenalty = activeCount >= 3 ? 10 : activeCount >= 2 ? 5 : 0;
    const riskBase = defaultedCount > 0 ? 40 : overdueActiveCount > 0 ? 22 : 0;
    const riskScore = Math.min(100, riskBase + guarantorPenalty + verifPenalty + employPenalty + activeCountPenalty);

    return {
      ...customer,
      lifecycleStage,
      totalPaid:      Number(agg?.total_paid ?? 0),
      totalRemaining: Number(agg?.total_remaining ?? 0),
      activeCount,
      nextDue:        agg?.next_due ?? null,
      shopName:       seller?.shopName ?? '',
      creditScore:    100 - riskScore,
    };
  }

  async getInstallments(customerId: string) {
    const rows = await db
      .select({
        id:               installments.id,
        totalAmount:      installments.totalAmount,
        downPayment:      installments.downPayment,
        remaining:        installments.remaining,
        monthly:          installments.monthly,
        months:           installments.months,
        startDate:        installments.startDate,
        status:           installments.status,
        invoiceNumber:    installments.invoiceNumber,
        paymentFrequency: installments.paymentFrequency,
        paymentDueDay:    installments.paymentDueDay,
        createdAt:        installments.createdAt,
        productName:      products.name,
        productBrand:     products.brand,
        totalPaid:        sum(payments.amount),
      })
      .from(installments)
      .innerJoin(products, eq(installments.productId, products.id))
      .leftJoin(
        payments,
        and(eq(payments.installmentId, installments.id), isNull(payments.deletedAt)),
      )
      .where(and(eq(installments.customerId, customerId), isNull(installments.deletedAt)))
      .groupBy(
        installments.id, installments.totalAmount, installments.downPayment,
        installments.remaining, installments.monthly, installments.months,
        installments.startDate, installments.status, installments.invoiceNumber,
        installments.paymentFrequency, installments.paymentDueDay, installments.createdAt,
        products.name, products.brand,
      )
      .orderBy(desc(installments.createdAt));

    return rows.map((r) => {
      const totalAmount   = Number(r.totalAmount);
      const downPayment   = Number(r.downPayment);
      const remaining     = Number(r.remaining);
      const monthly       = Number(r.monthly);
      const months        = r.months;
      const installmentDue = totalAmount - downPayment;
      const paid          = Number(r.totalPaid ?? 0);
      const isDaily    = r.paymentFrequency === 'daily';
      const paidMonths = monthly > 0 ? Math.floor(paid / monthly) : 0;
      const dueDate    = new Date(r.startDate);
      if (isDaily) {
        dueDate.setDate(dueDate.getDate() + paidMonths + 1);
      } else {
        const dueDay   = r.paymentDueDay ?? 10;
        const year     = dueDate.getFullYear();
        const month    = dueDate.getMonth() + paidMonths + 1;
        const lastDay  = new Date(year, month + 1, 0).getDate();
        dueDate.setFullYear(year, month, Math.min(dueDay, lastDay));
      }

      return {
        id:               r.id,
        invoiceNumber:    r.invoiceNumber,
        productName:      r.productName,
        productBrand:     r.productBrand,
        totalAmount,
        downPayment,
        monthly,
        months,
        remaining,
        status:           r.status,
        startDate:        r.startDate,
        paymentFrequency: r.paymentFrequency,
        dueDate,
        paidMonths,
        totalMonths:      months,
        progressPct:      months > 0 ? Math.min(100, Math.round((paidMonths / months) * 100)) : 0,
        amountPaid:       installmentDue - remaining,
      };
    });
  }

  async getPayments(customerId: string, installmentId: string) {
    // Verify the installment belongs to this customer
    const inst = await db.query.installments.findFirst({
      where: and(
        eq(installments.id, installmentId),
        eq(installments.customerId, customerId),
        isNull(installments.deletedAt),
      ),
      columns: { id: true },
    });
    if (!inst) throw new AppError('Installment not found', 404);

    return db
      .select({
        id:     payments.id,
        amount: payments.amount,
        paidOn: payments.paidOn,
        method: payments.method,
        note:   payments.note,
      })
      .from(payments)
      .where(and(eq(payments.installmentId, installmentId), isNull(payments.deletedAt)))
      .orderBy(desc(payments.paidOn));
  }
}
