import { api } from './client.ts';

export type RepairJobStatus = 'RECEIVED' | 'DIAGNOSING' | 'AWAITING_PARTS' | 'REPAIRING' | 'REPAIRED' | 'UNREPAIRABLE' | 'RETURNED';
export type PaymentMethod = 'CASH' | 'BANK' | 'JAZZCASH' | 'EASYPAISA' | 'OTHER';

export interface RepairJob {
  id: string;
  jobNumber: string;
  customerName: string;
  customerPhone: string;
  deviceName: string;
  imeiNumber: string | null;
  issueDescription: string;
  status: RepairJobStatus;
  estimatedCost: string | null;
  actualCost: string | null;
  paymentMethod: PaymentMethod | null;
  partsUsed: string | null;
  promisedAt: string | null;
  completedAt: string | null;
  returnedAt: string | null;
  notes: string | null;
  createdAt: string;
  assignedToName: string | null;
}

export interface CreateRepairJobBody {
  customerName: string;
  customerPhone: string;
  deviceName: string;
  imeiNumber?: string;
  issueDescription: string;
  estimatedCost?: number;
  promisedAt?: string;
  assignedToId?: string;
  notes?: string;
}

export interface UpdateRepairJobStatusBody {
  status: RepairJobStatus;
  actualCost?: number;
  paymentMethod?: PaymentMethod;
  partsUsed?: string;
  notes?: string;
}

const unwrap = <T>(r: { data: { data: T } }) => r.data.data;

export const repairJobsApi = {
  list: (params?: { status?: string; assignedToId?: string }) =>
    api.get<{ data: RepairJob[] }>('/repair-jobs', { params }).then(unwrap<RepairJob[]>),

  getOne: (id: string) =>
    api.get<{ data: RepairJob }>(`/repair-jobs/${id}`).then(unwrap<RepairJob>),

  create: (body: CreateRepairJobBody) =>
    api.post<{ data: RepairJob }>('/repair-jobs', body).then(unwrap<RepairJob>),

  update: (id: string, body: Partial<CreateRepairJobBody>) =>
    api.patch<{ data: RepairJob }>(`/repair-jobs/${id}`, body).then(unwrap<RepairJob>),

  updateStatus: (id: string, body: UpdateRepairJobStatusBody) =>
    api.patch<{ data: RepairJob }>(`/repair-jobs/${id}/status`, body).then(unwrap<RepairJob>),

  remove: (id: string) => api.delete(`/repair-jobs/${id}`),
};
