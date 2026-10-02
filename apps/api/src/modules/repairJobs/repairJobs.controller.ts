import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { RepairJobsService } from './repairJobs.service.js';
import { AuditService } from '../audit/audit.service.js';
import { success } from '../../utils/response.js';
import { auditCtx } from '../../utils/auditCtx.js';

const svc   = new RepairJobsService();
const audit = new AuditService();

export async function listRepairJobs(req: AuthRequest, res: Response) {
  const status       = req.query['status'] as string | undefined;
  const assignedToId = req.query['assignedToId'] as string | undefined;
  success(res, await svc.list(req.user!.sellerId!, status, assignedToId));
}

export async function getRepairJob(req: AuthRequest, res: Response) {
  success(res, await svc.getOne(req.params['id']!, req.user!.sellerId!));
}

export async function createRepairJob(req: AuthRequest, res: Response) {
  const job = await svc.create(req.user!.sellerId!, req.user!.userId, req.body);
  success(res, job, 201);
  void audit.log({
    sellerId: req.user!.sellerId!, userId: req.user!.userId,
    action: 'REPAIR_JOB_CREATED', entityType: 'REPAIR_JOB', entityId: job.id,
    description: `Repair job ${job.jobNumber} opened — ${job.deviceName} · ${job.customerName}`,
    ...auditCtx(req),
  }).catch(console.error);
}

export async function updateRepairJob(req: AuthRequest, res: Response) {
  success(res, await svc.update(req.params['id']!, req.user!.sellerId!, req.body));
}

export async function updateRepairJobStatus(req: AuthRequest, res: Response) {
  const job = await svc.updateStatus(req.params['id']!, req.user!.sellerId!, req.body);
  success(res, job);
  void audit.log({
    sellerId: req.user!.sellerId!, userId: req.user!.userId,
    action: 'REPAIR_JOB_STATUS', entityType: 'REPAIR_JOB', entityId: job.id,
    description: `Repair job ${job.jobNumber} → ${job.status}`,
    ...auditCtx(req),
  }).catch(console.error);
}

export async function deleteRepairJob(req: AuthRequest, res: Response) {
  const removed = await svc.remove(req.params['id']!, req.user!.sellerId!);
  success(res, null);
  void audit.log({
    sellerId: req.user!.sellerId!, userId: req.user!.userId,
    action: 'REPAIR_JOB_DELETED', entityType: 'REPAIR_JOB', entityId: removed.id,
    description: `Repair job ${removed.jobNumber} deleted`,
    ...auditCtx(req),
  }).catch(console.error);
}
