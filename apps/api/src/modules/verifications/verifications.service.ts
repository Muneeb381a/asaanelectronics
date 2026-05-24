import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { verifications, customers, users } from '../../db/schema.js';
import { AppError } from '../../middleware/error.js';
import { fsm } from '../../utils/fsm.js';

type SubmitBody = {
  status: 'APPROVED' | 'REJECTED';
  addressVerified: boolean;
  employerVerified: boolean;
  guarantor1Reachable: boolean;
  guarantor2Reachable: boolean;
  photoEvidenceUrl?: string;
  notes?: string;
  latitude: number;
  longitude: number;
  locationAccuracy: number;
};

export class VerificationsService {
  /** AVO: list customers assigned to me */
  async myQueue(avoId: string, sellerId: string) {
    return db
      .select({
        id: customers.id,
        name: customers.name,
        cnicMasked: customers.cnicMasked,
        phone: customers.phone,
        address: customers.address,
        occupation: customers.occupation,
        employer: customers.employer,
        verificationStatus: customers.verificationStatus,
        photoUrl: customers.photoUrl,
        createdAt: customers.createdAt,
      })
      .from(customers)
      .where(and(eq(customers.sellerId, sellerId), eq(customers.assignedAvoId, avoId)));
  }

  /** AVO: submit verification report */
  async submit(customerId: string, avoId: string, sellerId: string, body: SubmitBody) {
    const customer = await db.query.customers.findFirst({
      where: and(eq(customers.id, customerId), eq(customers.sellerId, sellerId)),
    });
    if (!customer) throw new AppError('Customer not found', 404);
    if (customer.assignedAvoId !== avoId) throw new AppError('Not assigned to you', 403);
    fsm.verification.assert(customer.verificationStatus, body.status);

    await db.transaction(async (tx) => {
      await tx.insert(verifications).values({
        customerId,
        avoId,
        status: body.status,
        addressVerified: body.addressVerified,
        employerVerified: body.employerVerified,
        guarantor1Reachable: body.guarantor1Reachable,
        guarantor2Reachable: body.guarantor2Reachable,
        photoEvidenceUrl: body.photoEvidenceUrl,
        notes: body.notes,
        latitude: String(body.latitude),
        longitude: String(body.longitude),
        locationAccuracy: String(body.locationAccuracy),
      });
      await tx.update(customers)
        .set({ verificationStatus: body.status === 'APPROVED' ? 'APPROVED' : 'REJECTED' })
        .where(eq(customers.id, customerId));
    });

    return { ok: true };
  }

  /** Get verification report for a customer */
  async getReport(customerId: string, sellerId: string) {
    const customer = await db.query.customers.findFirst({
      where: and(eq(customers.id, customerId), eq(customers.sellerId, sellerId)),
      columns: { id: true },
    });
    if (!customer) throw new AppError('Customer not found', 404);

    const report = await db.query.verifications.findFirst({
      where: eq(verifications.customerId, customerId),
    });
    if (!report) return null;

    const avo = await db.query.users.findFirst({
      where: eq(users.id, report.avoId),
      columns: { id: true, name: true, email: true },
    });

    return { ...report, avo };
  }

  /** Owner: reset rejected customer back to PENDING for re-verification */
  async reVerify(customerId: string, sellerId: string) {
    const customer = await db.query.customers.findFirst({
      where: and(eq(customers.id, customerId), eq(customers.sellerId, sellerId)),
      columns: { id: true, verificationStatus: true },
    });
    if (!customer) throw new AppError('Customer not found', 404);
    if (customer.verificationStatus !== 'REJECTED') throw new AppError('Only rejected customers can be re-submitted', 400);

    await db.update(customers)
      .set({ verificationStatus: 'PENDING', assignedAvoId: null })
      .where(eq(customers.id, customerId));
    return { ok: true };
  }

  /** Owner: AVO performance stats */
  async avoStats(sellerId: string) {
    const avos = await db
      .select({
        id: users.id,
        name: users.name,
        total: sql<number>`count(*)::int`,
        approved: sql<number>`count(*) filter (where ${verifications.status} = 'APPROVED')::int`,
        rejected: sql<number>`count(*) filter (where ${verifications.status} = 'REJECTED')::int`,
        defaults: sql<number>`count(*) filter (where ${customers.verificationStatus} = 'APPROVED' AND EXISTS (
          SELECT 1 FROM installments WHERE customer_id = ${customers.id} AND status = 'DEFAULTED'
        ))::int`,
      })
      .from(users)
      .innerJoin(verifications, eq(verifications.avoId, users.id))
      .innerJoin(customers, eq(customers.id, verifications.customerId))
      .where(eq(users.sellerId, sellerId))
      .groupBy(users.id, users.name);

    return avos;
  }
}
