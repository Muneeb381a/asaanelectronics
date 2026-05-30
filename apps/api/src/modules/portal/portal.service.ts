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

    const [lifecycleRows, statsRows, riskRows, seller] = await Promise.all([
      db.execute<{ stage: string }>(sql`
        SELECT
          CASE
            WHEN EXISTS (SELECT 1 FROM installments i WHERE i.customer_id = ${customerId} AND i.status = 'DEFAULTED' AND i.deleted_at IS NULL)
              THEN 'DEFAULT'
            WHEN EXISTS (SELECT 1 FROM installments i WHERE i.customer_id = ${customerId} AND i.status = 'ACTIVE' AND i.deleted_at IS NULL
              AND (CASE WHEN i.payment_frequency = 'daily'
                THEN i.start_date + (i.months || ' days')::interval
                ELSE i.start_date + (i.months || ' months')::interval
              END) < NOW())
              THEN 'AT_RISK'
            WHEN EXISTS (SELECT 1 FROM installments i WHERE i.customer_id = ${customerId} AND i.status = 'ACTIVE' AND i.deleted_at IS NULL)
             AND EXISTS (SELECT 1 FROM installments i WHERE i.customer_id = ${customerId} AND i.status = 'COMPLETED' AND i.deleted_at IS NULL)
              THEN 'REPEAT'
            WHEN EXISTS (SELECT 1 FROM installments i WHERE i.customer_id = ${customerId} AND i.status = 'ACTIVE' AND i.deleted_at IS NULL)
              THEN 'ACTIVE'
            WHEN NOT EXISTS (SELECT 1 FROM installments i WHERE i.customer_id = ${customerId} AND i.status IN ('ACTIVE','PENDING') AND i.deleted_at IS NULL)
             AND EXISTS (SELECT 1 FROM installments i WHERE i.customer_id = ${customerId} AND i.status = 'COMPLETED' AND i.deleted_at IS NULL)
              THEN 'CLOSED'
            WHEN ${customer.verificationStatus} = 'APPROVED' THEN 'VERIFIED'
            ELSE 'LEAD'
          END AS stage
      `),
      db.execute<{ total_paid: number; total_remaining: number; active_count: number; next_due: string | null }>(sql`
        SELECT
          COALESCE(SUM(i.total_amount - i.down_payment - i.remaining), 0)::numeric AS total_paid,
          COALESCE(SUM(i.remaining), 0)::numeric                                    AS total_remaining,
          COUNT(CASE WHEN i.status = 'ACTIVE' THEN 1 END)::int                     AS active_count,
          MIN(CASE WHEN i.status = 'ACTIVE'
            THEN (CASE WHEN i.payment_frequency = 'daily'
              THEN i.start_date + (i.months || ' days')::interval
              ELSE i.start_date + (i.months || ' months')::interval
            END)::date END)::text  AS next_due
        FROM installments i
        WHERE i.customer_id = ${customerId} AND i.deleted_at IS NULL
          AND i.status IN ('ACTIVE', 'PENDING')
      `),
      db.execute<{ risk_score: number }>(sql`
        SELECT LEAST(100, (
          CASE
            WHEN EXISTS (SELECT 1 FROM installments i WHERE i.customer_id = ${customerId} AND i.status = 'DEFAULTED' AND i.deleted_at IS NULL) THEN 40
            WHEN EXISTS (SELECT 1 FROM installments i WHERE i.customer_id = ${customerId} AND i.status = 'ACTIVE' AND i.deleted_at IS NULL AND (CASE WHEN i.payment_frequency = 'daily' THEN i.start_date + (i.months || ' days')::interval ELSE i.start_date + (i.months || ' months')::interval END) < NOW()) THEN 22
            ELSE 0
          END
          + CASE WHEN c.guarantor_name IS NULL THEN 20 WHEN c.guarantor2_cnic IS NOT NULL THEN 0 WHEN c.guarantor_cnic IS NOT NULL THEN 8 ELSE 14 END
          + CASE c.verification_status WHEN 'APPROVED' THEN 0 WHEN 'UNDER_REVIEW' THEN 8 WHEN 'PENDING' THEN 15 WHEN 'REJECTED' THEN 20 ELSE 15 END
          + CASE WHEN c.occupation IS NULL AND c.employer IS NULL THEN 10 WHEN c.employer IS NULL THEN 5 ELSE 0 END
          + CASE
              WHEN (SELECT COUNT(*) FROM installments i WHERE i.customer_id = ${customerId} AND i.status = 'ACTIVE' AND i.deleted_at IS NULL) >= 3 THEN 10
              WHEN (SELECT COUNT(*) FROM installments i WHERE i.customer_id = ${customerId} AND i.status = 'ACTIVE' AND i.deleted_at IS NULL) = 2 THEN 5
              ELSE 0
            END
        )::int) AS risk_score
        FROM customers c WHERE c.id = ${customerId}
      `),
      db.query.sellers.findFirst({ where: eq(sellers.id, customer.sellerId), columns: { shopName: true } }),
    ]);

    const stats    = statsRows[0];
    const riskScore = Number(riskRows[0]?.risk_score ?? 50);

    return {
      ...customer,
      lifecycleStage: lifecycleRows[0]?.stage ?? 'LEAD',
      totalPaid:      Number(stats?.total_paid ?? 0),
      totalRemaining: Number(stats?.total_remaining ?? 0),
      activeCount:    Number(stats?.active_count ?? 0),
      nextDue:        stats?.next_due ?? null,
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
        installments.paymentFrequency, installments.createdAt, products.name, products.brand,
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
      const isDaily     = r.paymentFrequency === 'daily';
      const paidMonths  = monthly > 0 ? Math.round(paid / monthly) : 0;
      const dueDate     = new Date(r.startDate);
      if (isDaily) {
        dueDate.setDate(dueDate.getDate() + months);
      } else {
        dueDate.setMonth(dueDate.getMonth() + months);
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
