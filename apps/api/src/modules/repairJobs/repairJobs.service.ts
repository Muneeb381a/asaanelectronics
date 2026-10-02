import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { repairJobs, ledgerEntries, users } from '../../db/schema.js';
import { AppError } from '../../middleware/error.js';
import { clearSellerStatsCache } from '../stats/stats.service.js';

type CreateBody = {
  customerName: string;
  customerPhone: string;
  deviceName: string;
  imeiNumber?: string;
  issueDescription: string;
  estimatedCost?: number;
  promisedAt?: string;
  assignedToId?: string;
  notes?: string;
};

type UpdateStatusBody = {
  status: 'RECEIVED' | 'DIAGNOSING' | 'AWAITING_PARTS' | 'REPAIRING' | 'REPAIRED' | 'UNREPAIRABLE' | 'RETURNED';
  actualCost?: number;
  paymentMethod?: 'CASH' | 'BANK' | 'JAZZCASH' | 'EASYPAISA' | 'OTHER';
  partsUsed?: string;
  notes?: string;
};

// A job only ever reaches RETURNED once — the ledger entry it posts must not
// be able to post twice if status is "advanced" to RETURNED again by mistake.
const TERMINAL = new Set(['RETURNED', 'UNREPAIRABLE']);

export class RepairJobsService {
  async list(sellerId: string, status?: string, assignedToId?: string) {
    const conds = [eq(repairJobs.sellerId, sellerId)];
    if (status)       conds.push(eq(repairJobs.status, status as UpdateStatusBody['status']));
    if (assignedToId) conds.push(eq(repairJobs.assignedToId, assignedToId));

    return db.select({
      id:               repairJobs.id,
      jobNumber:        repairJobs.jobNumber,
      customerName:     repairJobs.customerName,
      customerPhone:    repairJobs.customerPhone,
      deviceName:       repairJobs.deviceName,
      imeiNumber:       repairJobs.imeiNumber,
      issueDescription: repairJobs.issueDescription,
      status:           repairJobs.status,
      estimatedCost:    repairJobs.estimatedCost,
      actualCost:       repairJobs.actualCost,
      paymentMethod:    repairJobs.paymentMethod,
      partsUsed:        repairJobs.partsUsed,
      promisedAt:       repairJobs.promisedAt,
      completedAt:      repairJobs.completedAt,
      returnedAt:       repairJobs.returnedAt,
      notes:            repairJobs.notes,
      createdAt:        repairJobs.createdAt,
      assignedToName:   users.name,
    })
      .from(repairJobs)
      .leftJoin(users, eq(users.id, repairJobs.assignedToId))
      .where(and(...conds))
      .orderBy(desc(repairJobs.createdAt));
  }

  async getOne(id: string, sellerId: string) {
    const job = await db.query.repairJobs.findFirst({
      where: and(eq(repairJobs.id, id), eq(repairJobs.sellerId, sellerId)),
    });
    if (!job) throw new AppError('Repair job not found', 404);
    return job;
  }

  async create(sellerId: string, receivedById: string, body: CreateBody) {
    const year = new Date().getFullYear();
    const [{ nextSeq }] = await db.execute<{ nextSeq: number }>(sql`
      SELECT COALESCE(MAX(CAST(SPLIT_PART(job_number, '-', 3) AS INTEGER)), 0) + 1 AS "nextSeq"
      FROM repair_jobs
      WHERE seller_id = ${sellerId} AND job_number LIKE ${'REP-' + year + '-%'}
    `);
    const jobNumber = `REP-${year}-${String(nextSeq).padStart(4, '0')}`;

    const [job] = await db.insert(repairJobs).values({
      sellerId,
      jobNumber,
      customerName:     body.customerName.trim(),
      customerPhone:    body.customerPhone.trim(),
      deviceName:       body.deviceName.trim(),
      imeiNumber:       body.imeiNumber?.trim() || null,
      issueDescription: body.issueDescription.trim(),
      estimatedCost:    body.estimatedCost != null ? String(body.estimatedCost) : null,
      promisedAt:       body.promisedAt ? new Date(body.promisedAt) : null,
      assignedToId:     body.assignedToId || null,
      notes:            body.notes?.trim() || null,
      receivedById,
    }).returning();
    return job!;
  }

  async update(id: string, sellerId: string, body: Partial<CreateBody>) {
    const existing = await this.getOne(id, sellerId);
    if (TERMINAL.has(existing.status)) throw new AppError('Cannot edit a closed repair job', 400);

    const [updated] = await db.update(repairJobs).set({
      ...(body.customerName      !== undefined && { customerName: body.customerName.trim() }),
      ...(body.customerPhone     !== undefined && { customerPhone: body.customerPhone.trim() }),
      ...(body.deviceName        !== undefined && { deviceName: body.deviceName.trim() }),
      ...(body.imeiNumber        !== undefined && { imeiNumber: body.imeiNumber?.trim() || null }),
      ...(body.issueDescription  !== undefined && { issueDescription: body.issueDescription.trim() }),
      ...(body.estimatedCost     !== undefined && { estimatedCost: body.estimatedCost != null ? String(body.estimatedCost) : null }),
      ...(body.promisedAt        !== undefined && { promisedAt: body.promisedAt ? new Date(body.promisedAt) : null }),
      ...(body.assignedToId      !== undefined && { assignedToId: body.assignedToId || null }),
      ...(body.notes             !== undefined && { notes: body.notes?.trim() || null }),
      updatedAt: new Date(),
    }).where(eq(repairJobs.id, id)).returning();
    return updated!;
  }

  async updateStatus(id: string, sellerId: string, body: UpdateStatusBody) {
    return db.transaction(async (tx) => {
      const [existing] = await tx.select().from(repairJobs)
        .where(and(eq(repairJobs.id, id), eq(repairJobs.sellerId, sellerId)));
      if (!existing) throw new AppError('Repair job not found', 404);
      if (TERMINAL.has(existing.status)) throw new AppError('This repair job is already closed', 400);

      const postingPayment = body.status === 'RETURNED' && body.actualCost != null && body.actualCost > 0;
      if (postingPayment) {
        await tx.insert(ledgerEntries).values({
          sellerId,
          type:        'CREDIT',
          category:    'SERVICE',
          amount:      String(body.actualCost),
          description: `Repair Service — ${existing.deviceName} · ${existing.customerName} (${existing.jobNumber})`,
          referenceId: id,
          refType:     'MANUAL',
        });
      }

      const [updated] = await tx.update(repairJobs).set({
        status:      body.status,
        ...(body.actualCost     !== undefined && { actualCost: body.actualCost != null ? String(body.actualCost) : null }),
        ...(body.paymentMethod  !== undefined && { paymentMethod: body.paymentMethod }),
        ...(body.partsUsed      !== undefined && { partsUsed: body.partsUsed?.trim() || null }),
        ...(body.notes          !== undefined && { notes: body.notes?.trim() || null }),
        ...(body.status === 'REPAIRED' && { completedAt: new Date() }),
        ...(body.status === 'RETURNED' && { returnedAt: new Date() }),
        updatedAt: new Date(),
      }).where(eq(repairJobs.id, id)).returning();

      clearSellerStatsCache(sellerId);
      return updated!;
    });
  }

  async remove(id: string, sellerId: string) {
    const existing = await this.getOne(id, sellerId);
    await db.transaction(async (tx) => {
      await tx.delete(ledgerEntries).where(and(eq(ledgerEntries.referenceId, id), eq(ledgerEntries.refType, 'MANUAL')));
      await tx.delete(repairJobs).where(eq(repairJobs.id, id));
    });
    clearSellerStatsCache(sellerId);
    return existing;
  }
}
