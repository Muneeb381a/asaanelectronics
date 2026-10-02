import { z } from 'zod';

export const repairJobStatus = z.enum([
  'RECEIVED', 'DIAGNOSING', 'AWAITING_PARTS', 'REPAIRING', 'REPAIRED', 'UNREPAIRABLE', 'RETURNED',
]);

export const createRepairJobSchema = z.object({
  customerName:     z.string().min(1).max(100),
  customerPhone:    z.string().min(10).max(15),
  deviceName:       z.string().min(1).max(100),
  imeiNumber:       z.string().max(20).optional(),
  issueDescription: z.string().min(1).max(1000),
  estimatedCost:    z.number().nonnegative().optional(),
  promisedAt:       z.string().optional(),
  assignedToId:     z.string().optional(),
  notes:            z.string().max(1000).optional(),
});

export const updateRepairJobStatusSchema = z.object({
  status:        repairJobStatus,
  actualCost:    z.number().nonnegative().optional(),
  paymentMethod: z.enum(['CASH', 'BANK', 'JAZZCASH', 'EASYPAISA', 'OTHER']).optional(),
  partsUsed:     z.string().max(500).optional(),
  notes:         z.string().max(1000).optional(),
});

export const updateRepairJobSchema = z.object({
  customerName:     z.string().min(1).max(100).optional(),
  customerPhone:    z.string().min(10).max(15).optional(),
  deviceName:       z.string().min(1).max(100).optional(),
  imeiNumber:       z.string().max(20).optional(),
  issueDescription: z.string().min(1).max(1000).optional(),
  estimatedCost:    z.number().nonnegative().optional(),
  promisedAt:       z.string().optional(),
  assignedToId:     z.string().optional(),
  notes:            z.string().max(1000).optional(),
});

export type CreateRepairJobInput       = z.infer<typeof createRepairJobSchema>;
export type UpdateRepairJobStatusInput = z.infer<typeof updateRepairJobStatusSchema>;
export type UpdateRepairJobInput       = z.infer<typeof updateRepairJobSchema>;
