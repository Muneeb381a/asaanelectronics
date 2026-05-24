import { and, desc, eq, ilike, isNull, or, sql, type SQL } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { customers, installments, products, sellers } from '../../db/schema.js';
import { AppError } from '../../middleware/error.js';
import { hashCnic, maskCnic } from '../../utils/hash.js';
import { PLAN_LIMITS, isUnlimited } from '../../config/plans.js';

type BureauShopRow = { shopName: string; activeCount: number; defaultedCount: number; completedCount: number; cancelledCount: number; totalRemaining: string };

function buildBureau(rows: BureauShopRow[]) {
  return {
    totalActive:    rows.reduce((s, r) => s + r.activeCount, 0),
    totalDefaulted: rows.reduce((s, r) => s + r.defaultedCount, 0),
    totalCompleted: rows.reduce((s, r) => s + r.completedCount, 0),
    totalRemaining: rows.reduce((s, r) => s + Number(r.totalRemaining), 0).toFixed(2),
    shops: rows.map(({ shopName, activeCount, defaultedCount, completedCount, cancelledCount, totalRemaining }) => ({
      shopName, activeCount, defaultedCount, completedCount, cancelledCount, totalRemaining,
    })),
  };
}

function riskLabel(score: number): 'GOOD' | 'AVERAGE' | 'RISKY' | 'BLACKLIST' {
  if (score <= 30) return 'GOOD';
  if (score <= 60) return 'AVERAGE';
  if (score <= 80) return 'RISKY';
  return 'BLACKLIST';
}

// Reused in SELECT and WHERE — must stay in sync
const lifecycleSQL = sql<string>`(
  CASE
    WHEN EXISTS (SELECT 1 FROM installments i WHERE i.customer_id = ${customers.id} AND i.status = 'DEFAULTED' AND i.deleted_at IS NULL)
      THEN 'DEFAULT'
    WHEN EXISTS (SELECT 1 FROM installments i WHERE i.customer_id = ${customers.id} AND i.status = 'ACTIVE' AND i.deleted_at IS NULL
      AND i.start_date + (i.months * INTERVAL '1 month') < NOW())
      THEN 'AT_RISK'
    WHEN EXISTS (SELECT 1 FROM installments i WHERE i.customer_id = ${customers.id} AND i.status = 'ACTIVE'    AND i.deleted_at IS NULL)
     AND EXISTS (SELECT 1 FROM installments i WHERE i.customer_id = ${customers.id} AND i.status = 'COMPLETED' AND i.deleted_at IS NULL)
      THEN 'REPEAT'
    WHEN EXISTS (SELECT 1 FROM installments i WHERE i.customer_id = ${customers.id} AND i.status = 'ACTIVE' AND i.deleted_at IS NULL)
      THEN 'ACTIVE'
    WHEN NOT EXISTS (SELECT 1 FROM installments i WHERE i.customer_id = ${customers.id} AND i.status IN ('ACTIVE','PENDING') AND i.deleted_at IS NULL)
     AND EXISTS (SELECT 1 FROM installments i WHERE i.customer_id = ${customers.id} AND i.status = 'COMPLETED' AND i.deleted_at IS NULL)
      THEN 'CLOSED'
    WHEN ${customers.verificationStatus} = 'APPROVED' THEN 'VERIFIED'
    ELSE 'LEAD'
  END
)`;

type CreateBody = {
  name: string;
  cnic: string;
  phone: string;
  fatherName?: string;
  cnicExpiry?: string;
  address?: string;
  officeAddress?: string;
  salary?: number;
  occupation?: string;
  employer?: string;
  guarantorName?: string;
  guarantorPhone?: string;
  guarantorCnic?: string;
  guarantorAddress?: string;
  guarantorRelation?: string;
  guarantorCnicFrontUrl?: string;
  guarantorCnicBackUrl?: string;
  guarantor2Name?: string;
  guarantor2Phone?: string;
  guarantor2Cnic?: string;
  guarantor2Address?: string;
  guarantor2Relation?: string;
  guarantor2CnicFrontUrl?: string;
  guarantor2CnicBackUrl?: string;
  photoUrl?: string;
  cnicFrontUrl?: string;
  cnicBackUrl?: string;
  blankChequeUrl?: string;
  chequeBank?: string;
  chequeAccountNo?: string;
  chequeNo?: string;
  cnicFrontHash?: string;
  cnicBackHash?: string;
  blankChequeHash?: string;
};

type UpdateBody = Partial<CreateBody>;

export class CustomersService {
  async list(sellerId: string, page: number, limit: number, search?: string, lifecycle?: string, verificationStatus?: string) {
    const base = and(eq(customers.sellerId, sellerId), isNull(customers.deletedAt));
    const searchCond = search
      ? and(base, or(ilike(customers.name, `%${search}%`), ilike(customers.phone, `%${search}%`)))
      : base;
    const lifecycleCond = lifecycle ? and(searchCond, sql`${lifecycleSQL} = ${lifecycle}`) : searchCond;
    const where = verificationStatus
      ? and(lifecycleCond, eq(customers.verificationStatus, verificationStatus as 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED'))
      : lifecycleCond;

    const riskScore = sql<number>`LEAST(100, (
      CASE
        WHEN EXISTS (SELECT 1 FROM installments i WHERE i.customer_id = ${customers.id} AND i.status = 'DEFAULTED'  AND i.deleted_at IS NULL) THEN 40
        WHEN EXISTS (SELECT 1 FROM installments i WHERE i.customer_id = ${customers.id} AND i.status = 'ACTIVE' AND i.deleted_at IS NULL AND i.start_date + (i.months * INTERVAL '1 month') < NOW()) THEN 22
        ELSE 0
      END
      +
      CASE
        WHEN ${customers.guarantorName} IS NULL THEN 20
        WHEN ${customers.guarantor2Cnic} IS NOT NULL THEN 0
        WHEN ${customers.guarantorCnic}  IS NOT NULL THEN 8
        ELSE 14
      END
      +
      CASE ${customers.verificationStatus}
        WHEN 'APPROVED'     THEN 0
        WHEN 'UNDER_REVIEW' THEN 8
        WHEN 'PENDING'      THEN 15
        WHEN 'REJECTED'     THEN 20
        ELSE 15
      END
      +
      CASE
        WHEN ${customers.occupation} IS NULL AND ${customers.employer} IS NULL THEN 10
        WHEN ${customers.employer}   IS NULL THEN 5
        ELSE 0
      END
      +
      CASE
        WHEN (SELECT COUNT(*) FROM installments i WHERE i.customer_id = ${customers.id} AND i.status = 'ACTIVE' AND i.deleted_at IS NULL) >= 3 THEN 10
        WHEN (SELECT COUNT(*) FROM installments i WHERE i.customer_id = ${customers.id} AND i.status = 'ACTIVE' AND i.deleted_at IS NULL) = 2  THEN 5
        ELSE 0
      END
    )::int)`;

    const [rows, [{ count }]] = await Promise.all([
      db.select({
        id: customers.id,
        sellerId: customers.sellerId,
        name: customers.name,
        cnicMasked: customers.cnicMasked,
        phone: customers.phone,
        address: customers.address,
        occupation: customers.occupation,
        employer: customers.employer,
        guarantorName: customers.guarantorName,
        guarantorPhone: customers.guarantorPhone,
        guarantorCnic: customers.guarantorCnic,
        guarantorAddress: customers.guarantorAddress,
        guarantorRelation: customers.guarantorRelation,
        guarantor2Name: customers.guarantor2Name,
        guarantor2Phone: customers.guarantor2Phone,
        guarantor2Cnic: customers.guarantor2Cnic,
        guarantor2Address: customers.guarantor2Address,
        guarantor2Relation: customers.guarantor2Relation,
        fatherName: customers.fatherName,
        cnicExpiry: customers.cnicExpiry,
        officeAddress: customers.officeAddress,
        salary: customers.salary,
        photoUrl: customers.photoUrl,
        cnicFrontUrl: customers.cnicFrontUrl,
        cnicBackUrl: customers.cnicBackUrl,
        blankChequeUrl: customers.blankChequeUrl,
        chequeBank: customers.chequeBank,
        chequeAccountNo: customers.chequeAccountNo,
        chequeNo: customers.chequeNo,
        guarantorCnicFrontUrl: customers.guarantorCnicFrontUrl,
        guarantorCnicBackUrl: customers.guarantorCnicBackUrl,
        guarantor2CnicFrontUrl: customers.guarantor2CnicFrontUrl,
        guarantor2CnicBackUrl: customers.guarantor2CnicBackUrl,
        verificationStatus: customers.verificationStatus,
        assignedAvoId: customers.assignedAvoId,
        createdByUserId: customers.createdByUserId,
        createdAt: customers.createdAt,
        riskScore,
        lifecycleStage: lifecycleSQL,
      }).from(customers).where(where).limit(limit).offset((page - 1) * limit)
        .orderBy(desc(customers.createdAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(customers).where(where),
    ]);

    const data = rows.map((r) => ({
      ...r,
      riskScore: Number(r.riskScore),
      riskLabel: riskLabel(Number(r.riskScore)),
    }));
    return { data, total: count, page, limit };
  }

  async lifecycleCounts(sellerId: string) {
    const rows = await db.execute<{ stage: string; count: number }>(sql`
      SELECT lifecycle AS stage, COUNT(*)::int AS count
      FROM (
        SELECT
          CASE
            WHEN EXISTS (SELECT 1 FROM installments i WHERE i.customer_id = c.id AND i.status = 'DEFAULTED' AND i.deleted_at IS NULL)
              THEN 'DEFAULT'
            WHEN EXISTS (SELECT 1 FROM installments i WHERE i.customer_id = c.id AND i.status = 'ACTIVE' AND i.deleted_at IS NULL
              AND i.start_date + (i.months * INTERVAL '1 month') < NOW())
              THEN 'AT_RISK'
            WHEN EXISTS (SELECT 1 FROM installments i WHERE i.customer_id = c.id AND i.status = 'ACTIVE'    AND i.deleted_at IS NULL)
             AND EXISTS (SELECT 1 FROM installments i WHERE i.customer_id = c.id AND i.status = 'COMPLETED' AND i.deleted_at IS NULL)
              THEN 'REPEAT'
            WHEN EXISTS (SELECT 1 FROM installments i WHERE i.customer_id = c.id AND i.status = 'ACTIVE' AND i.deleted_at IS NULL)
              THEN 'ACTIVE'
            WHEN NOT EXISTS (SELECT 1 FROM installments i WHERE i.customer_id = c.id AND i.status IN ('ACTIVE','PENDING') AND i.deleted_at IS NULL)
             AND EXISTS (SELECT 1 FROM installments i WHERE i.customer_id = c.id AND i.status = 'COMPLETED' AND i.deleted_at IS NULL)
              THEN 'CLOSED'
            WHEN c.verification_status = 'APPROVED' THEN 'VERIFIED'
            ELSE 'LEAD'
          END AS lifecycle
        FROM customers c
        WHERE c.seller_id = ${sellerId} AND c.deleted_at IS NULL
      ) sub
      GROUP BY lifecycle
    `);
    const counts: Record<string, number> = {
      LEAD: 0, VERIFIED: 0, ACTIVE: 0, AT_RISK: 0, DEFAULT: 0, CLOSED: 0, REPEAT: 0,
    };
    for (const r of rows) counts[r.stage] = r.count;
    return counts;
  }

  async lookupByCnic(sellerId: string, cnic: string) {
    const hash = hashCnic(cnic);

    const riskScore = sql<number>`LEAST(100, (
      CASE
        WHEN EXISTS (SELECT 1 FROM installments i WHERE i.customer_id = ${customers.id} AND i.status = 'DEFAULTED' AND i.deleted_at IS NULL) THEN 40
        WHEN EXISTS (SELECT 1 FROM installments i WHERE i.customer_id = ${customers.id} AND i.status = 'ACTIVE' AND i.deleted_at IS NULL AND i.start_date + (i.months * INTERVAL '1 month') < NOW()) THEN 22
        ELSE 0
      END
      + CASE WHEN ${customers.guarantorName} IS NULL THEN 20 WHEN ${customers.guarantor2Cnic} IS NOT NULL THEN 0 WHEN ${customers.guarantorCnic} IS NOT NULL THEN 8 ELSE 14 END
      + CASE ${customers.verificationStatus} WHEN 'APPROVED' THEN 0 WHEN 'UNDER_REVIEW' THEN 8 WHEN 'PENDING' THEN 15 WHEN 'REJECTED' THEN 20 ELSE 15 END
      + CASE WHEN ${customers.occupation} IS NULL AND ${customers.employer} IS NULL THEN 10 WHEN ${customers.employer} IS NULL THEN 5 ELSE 0 END
      + CASE WHEN (SELECT COUNT(*) FROM installments i WHERE i.customer_id = ${customers.id} AND i.status = 'ACTIVE' AND i.deleted_at IS NULL) >= 3 THEN 10
             WHEN (SELECT COUNT(*) FROM installments i WHERE i.customer_id = ${customers.id} AND i.status = 'ACTIVE' AND i.deleted_at IS NULL) = 2  THEN 5
             ELSE 0 END
    )::int)`;

    const rows = await db.select({
      id: customers.id,
      name: customers.name,
      cnicMasked: customers.cnicMasked,
      phone: customers.phone,
      address: customers.address,
      officeAddress: customers.officeAddress,
      occupation: customers.occupation,
      employer: customers.employer,
      salary: customers.salary,
      fatherName: customers.fatherName,
      cnicExpiry: customers.cnicExpiry,
      photoUrl: customers.photoUrl,
      verificationStatus: customers.verificationStatus,
      createdAt: customers.createdAt,
      riskScore,
      lifecycleStage: lifecycleSQL,
    }).from(customers).where(and(
      eq(customers.sellerId, sellerId),
      eq(customers.cnicHash, hash),
      isNull(customers.deletedAt),
    ));

    // Run own-record query + cross-shop bureau query in parallel
    type BureauRow = {
      shopName: string;
      activeCount: number;
      defaultedCount: number;
      completedCount: number;
      cancelledCount: number;
      totalRemaining: string;
    };

    const bureauPromise = db.execute<BureauRow>(sql`
      SELECT
        s.shop_name                                                                          AS "shopName",
        COUNT(CASE WHEN i.status = 'ACTIVE'    THEN 1 END)::int                             AS "activeCount",
        COUNT(CASE WHEN i.status = 'DEFAULTED' THEN 1 END)::int                             AS "defaultedCount",
        COUNT(CASE WHEN i.status = 'COMPLETED' THEN 1 END)::int                             AS "completedCount",
        COUNT(CASE WHEN i.status = 'CANCELLED' THEN 1 END)::int                             AS "cancelledCount",
        COALESCE(SUM(CASE WHEN i.status = 'ACTIVE' THEN i.remaining::numeric ELSE 0 END), 0)::text AS "totalRemaining"
      FROM customers c
      JOIN sellers s ON c.seller_id = s.id
      LEFT JOIN installments i ON i.customer_id = c.id AND i.deleted_at IS NULL
      WHERE c.cnic_hash = ${hash}
        AND c.seller_id != ${sellerId}
        AND c.deleted_at IS NULL
      GROUP BY s.shop_name, s.id, c.id
      ORDER BY "activeCount" DESC, "defaultedCount" DESC
    `);

    if (!rows.length) {
      // Customer not in this shop — still return bureau data
      const bureauRows = await bureauPromise;
      return {
        ownRecord: null,
        bureau: bureauRows.length > 0 ? buildBureau(bureauRows) : null,
      };
    }

    const customer = rows[0]!;

    const [custInstallments, bureauRows] = await Promise.all([
      db.select({
        id: installments.id,
        status: installments.status,
        totalAmount: installments.totalAmount,
        downPayment: installments.downPayment,
        remaining: installments.remaining,
        monthly: installments.monthly,
        months: installments.months,
        startDate: installments.startDate,
        createdAt: installments.createdAt,
        productName: products.name,
        productId: installments.productId,
      }).from(installments)
        .innerJoin(products, eq(installments.productId, products.id))
        .where(and(eq(installments.customerId, customer.id), isNull(installments.deletedAt)))
        .orderBy(desc(installments.createdAt)),
      bureauPromise,
    ]);

    return {
      ownRecord: {
        ...customer,
        riskScore: Number(customer.riskScore),
        riskLabel: riskLabel(Number(customer.riskScore)),
        installments: custInstallments,
      },
      bureau: bureauRows.length > 0 ? buildBureau(bureauRows) : null,
    };
  }

  async getOne(id: string, sellerId: string) {
    const customer = await db.query.customers.findFirst({
      where: and(eq(customers.id, id), eq(customers.sellerId, sellerId), isNull(customers.deletedAt)),
    });
    if (!customer) throw new AppError('Customer not found', 404);
    return customer;
  }

  async create(sellerId: string, body: CreateBody, createdByUserId?: string) {
    // Plan limit check
    const seller = await db.query.sellers.findFirst({ where: eq(sellers.id, sellerId), columns: { plan: true } });
    const limit = PLAN_LIMITS[seller?.plan ?? 'TRIAL'].customers;
    if (!isUnlimited(limit)) {
      const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(customers).where(eq(customers.sellerId, sellerId));
      if (count >= limit) throw new AppError(`Customer limit reached (${limit} on ${seller?.plan ?? 'TRIAL'} plan). Please upgrade.`, 402);
    }

    const hash = hashCnic(body.cnic);
    const existing = await db.query.customers.findFirst({
      where: and(eq(customers.sellerId, sellerId), eq(customers.cnicHash, hash)),
      columns: { id: true, deletedAt: true },
    });
    if (existing) {
      if (!existing.deletedAt) throw new AppError('A customer with this CNIC already exists', 409);
      throw new AppError('A deleted customer record with this CNIC exists. Contact support to restore the account.', 409);
    }

    const hashConds: SQL[] = [];
    if (body.cnicFrontHash)   hashConds.push(eq(customers.cnicFrontHash,   body.cnicFrontHash));
    if (body.cnicBackHash)    hashConds.push(eq(customers.cnicBackHash,    body.cnicBackHash));
    if (body.blankChequeHash) hashConds.push(eq(customers.blankChequeHash, body.blankChequeHash));
    if (hashConds.length > 0) {
      const dupDoc = await db.query.customers.findFirst({
        where: and(eq(customers.sellerId, sellerId), isNull(customers.deletedAt), or(...hashConds)),
        columns: { cnicMasked: true },
      });
      if (dupDoc) throw new AppError(`Duplicate document detected — this image is already linked to customer ${dupDoc.cnicMasked}. Possible fraud.`, 409);
    }

    const [customer] = await db
      .insert(customers)
      .values({
        sellerId,
        name: body.name,
        cnicHash: hash,
        cnicMasked: maskCnic(body.cnic),
        phone: body.phone,
        fatherName: body.fatherName,
        cnicExpiry: body.cnicExpiry,
        address: body.address,
        officeAddress: body.officeAddress,
        salary: body.salary?.toString(),
        occupation: body.occupation,
        employer: body.employer,
        guarantorName: body.guarantorName,
        guarantorPhone: body.guarantorPhone,
        guarantorCnic: body.guarantorCnic,
        guarantorAddress: body.guarantorAddress,
        guarantorRelation: body.guarantorRelation,
        guarantorCnicFrontUrl: body.guarantorCnicFrontUrl,
        guarantorCnicBackUrl: body.guarantorCnicBackUrl,
        guarantor2Name: body.guarantor2Name,
        guarantor2Phone: body.guarantor2Phone,
        guarantor2Cnic: body.guarantor2Cnic,
        guarantor2Address: body.guarantor2Address,
        guarantor2Relation: body.guarantor2Relation,
        guarantor2CnicFrontUrl: body.guarantor2CnicFrontUrl,
        guarantor2CnicBackUrl: body.guarantor2CnicBackUrl,
        photoUrl: body.photoUrl,
        cnicFrontUrl: body.cnicFrontUrl,
        cnicBackUrl: body.cnicBackUrl,
        blankChequeUrl: body.blankChequeUrl,
        chequeBank: body.chequeBank,
        chequeAccountNo: body.chequeAccountNo,
        chequeNo: body.chequeNo,
        cnicFrontHash: body.cnicFrontHash,
        cnicBackHash: body.cnicBackHash,
        blankChequeHash: body.blankChequeHash,
        createdByUserId,
      })
      .returning();
    return customer;
  }

  async update(id: string, sellerId: string, body: UpdateBody) {
    const existing = await db.query.customers.findFirst({
      where: and(eq(customers.id, id), eq(customers.sellerId, sellerId), isNull(customers.deletedAt)),
    });
    if (!existing) throw new AppError('Customer not found', 404);

    const [updated] = await db
      .update(customers)
      .set({
        ...(body.name && { name: body.name }),
        ...(body.phone && { phone: body.phone }),
        ...(body.cnic && { cnicHash: hashCnic(body.cnic), cnicMasked: maskCnic(body.cnic) }),
        ...(body.fatherName !== undefined && { fatherName: body.fatherName }),
        ...(body.cnicExpiry !== undefined && { cnicExpiry: body.cnicExpiry }),
        ...(body.address !== undefined && { address: body.address }),
        ...(body.officeAddress !== undefined && { officeAddress: body.officeAddress }),
        ...(body.salary !== undefined && { salary: body.salary?.toString() }),
        ...(body.occupation !== undefined && { occupation: body.occupation }),
        ...(body.employer !== undefined && { employer: body.employer }),
        ...(body.guarantorName !== undefined && { guarantorName: body.guarantorName }),
        ...(body.guarantorPhone !== undefined && { guarantorPhone: body.guarantorPhone }),
        ...(body.guarantorCnic !== undefined && { guarantorCnic: body.guarantorCnic }),
        ...(body.guarantorAddress !== undefined && { guarantorAddress: body.guarantorAddress }),
        ...(body.guarantorRelation !== undefined && { guarantorRelation: body.guarantorRelation }),
        ...(body.guarantorCnicFrontUrl !== undefined && { guarantorCnicFrontUrl: body.guarantorCnicFrontUrl }),
        ...(body.guarantorCnicBackUrl !== undefined && { guarantorCnicBackUrl: body.guarantorCnicBackUrl }),
        ...(body.guarantor2Name !== undefined && { guarantor2Name: body.guarantor2Name }),
        ...(body.guarantor2Phone !== undefined && { guarantor2Phone: body.guarantor2Phone }),
        ...(body.guarantor2Cnic !== undefined && { guarantor2Cnic: body.guarantor2Cnic }),
        ...(body.guarantor2Address !== undefined && { guarantor2Address: body.guarantor2Address }),
        ...(body.guarantor2Relation !== undefined && { guarantor2Relation: body.guarantor2Relation }),
        ...(body.guarantor2CnicFrontUrl !== undefined && { guarantor2CnicFrontUrl: body.guarantor2CnicFrontUrl }),
        ...(body.guarantor2CnicBackUrl !== undefined && { guarantor2CnicBackUrl: body.guarantor2CnicBackUrl }),
        ...(body.photoUrl !== undefined && { photoUrl: body.photoUrl }),
        ...(body.cnicFrontUrl !== undefined && { cnicFrontUrl: body.cnicFrontUrl }),
        ...(body.cnicBackUrl !== undefined && { cnicBackUrl: body.cnicBackUrl }),
        ...(body.blankChequeUrl !== undefined && { blankChequeUrl: body.blankChequeUrl }),
        ...(body.chequeBank !== undefined && { chequeBank: body.chequeBank }),
        ...(body.chequeAccountNo !== undefined && { chequeAccountNo: body.chequeAccountNo }),
        ...(body.chequeNo !== undefined && { chequeNo: body.chequeNo }),
        ...(body.cnicFrontHash !== undefined && { cnicFrontHash: body.cnicFrontHash }),
        ...(body.cnicBackHash !== undefined && { cnicBackHash: body.cnicBackHash }),
        ...(body.blankChequeHash !== undefined && { blankChequeHash: body.blankChequeHash }),
      })
      .where(and(eq(customers.id, id), eq(customers.sellerId, sellerId)))
      .returning();
    return updated;
  }

  async assignAvo(customerId: string, sellerId: string, avoId: string) {
    const customer = await db.query.customers.findFirst({
      where: and(eq(customers.id, customerId), eq(customers.sellerId, sellerId), isNull(customers.deletedAt)),
    });
    if (!customer) throw new AppError('Customer not found', 404);
    if (customer.createdByUserId === avoId) throw new AppError('AVO cannot verify a customer they created', 403);

    const [updated] = await db
      .update(customers)
      .set({ assignedAvoId: avoId, verificationStatus: 'UNDER_REVIEW' })
      .where(eq(customers.id, customerId))
      .returning({ id: customers.id, verificationStatus: customers.verificationStatus, assignedAvoId: customers.assignedAvoId });
    return updated;
  }

  async getRiskBreakdown(id: string, sellerId: string) {
    const customer = await db.query.customers.findFirst({
      where: and(eq(customers.id, id), eq(customers.sellerId, sellerId), isNull(customers.deletedAt)),
    });
    if (!customer) throw new AppError('Customer not found', 404);

    const activeCountRow = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(installments)
      .where(and(eq(installments.customerId, id), eq(installments.status, 'ACTIVE'), isNull(installments.deletedAt)));

    const [hasDefaulted, hasOverdue] = await Promise.all([
      db.query.installments.findFirst({
        where: and(eq(installments.customerId, id), eq(installments.status, 'DEFAULTED'), isNull(installments.deletedAt)),
        columns: { id: true },
      }),
      db.execute<{ overdue: boolean }>(sql`
        SELECT EXISTS (
          SELECT 1 FROM installments
          WHERE customer_id = ${id}
            AND status = 'ACTIVE'
            AND deleted_at IS NULL
            AND start_date + (months * INTERVAL '1 month') < NOW()
        ) AS overdue
      `),
    ]);

    const isOverdue = (hasOverdue as unknown as Array<{ overdue: boolean }>)[0]?.overdue ?? false;
    const activeCount = Number(activeCountRow[0]?.count ?? 0);

    const factors = {
      defaultHistory:    hasDefaulted ? 40 : (isOverdue ? 22 : 0),
      guarantorCoverage: customer.guarantorName === null ? 20
        : customer.guarantor2Cnic !== null ? 0
        : customer.guarantorCnic  !== null ? 8 : 14,
      verificationStatus:
        customer.verificationStatus === 'APPROVED'     ? 0
        : customer.verificationStatus === 'UNDER_REVIEW' ? 8
        : customer.verificationStatus === 'PENDING'      ? 15
        : 20,
      employmentInfo:    !customer.occupation && !customer.employer ? 10 : !customer.employer ? 5 : 0,
      activeInstallments: activeCount >= 3 ? 10 : activeCount === 2 ? 5 : 0,
    };

    const total = Math.min(100, Object.values(factors).reduce((a, b) => a + b, 0));

    return {
      total,
      label: riskLabel(total),
      factors: {
        defaultHistory:    { score: factors.defaultHistory,    max: 40, label: 'Default / Overdue History' },
        guarantorCoverage: { score: factors.guarantorCoverage, max: 20, label: 'Guarantor Coverage' },
        verificationStatus:{ score: factors.verificationStatus,max: 20, label: 'Verification Status' },
        employmentInfo:    { score: factors.employmentInfo,    max: 10, label: 'Employment Info' },
        activeInstallments:{ score: factors.activeInstallments,max: 10, label: 'Active Installment Load' },
      },
    };
  }

  async remove(id: string, sellerId: string, deletedBy: string) {
    const existing = await db.query.customers.findFirst({
      where: and(eq(customers.id, id), eq(customers.sellerId, sellerId), isNull(customers.deletedAt)),
    });
    if (!existing) throw new AppError('Customer not found', 404);
    const now = new Date();
    await Promise.all([
      db.update(customers).set({ deletedAt: now, deletedBy }).where(eq(customers.id, id)),
      db.update(installments).set({ deletedAt: now }).where(
        and(eq(installments.customerId, id), isNull(installments.deletedAt))
      ),
    ]);
    return existing;
  }
}
