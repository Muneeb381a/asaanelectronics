import type { CreateInstallmentInput } from '@assaan/shared';
import { api } from './client.ts';

export type InstallmentStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'DEFAULTED' | 'CANCELLED' | 'CLOSED';

export interface Installment {
  id: string;
  customerId: string;
  productId: string;
  totalAmount: string;
  downPayment: string;
  remaining: string;
  monthly: string;
  months: number;
  startDate: string;
  invoiceNumber: string | null;
  status: InstallmentStatus;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  productName: string;
  isOverdue: boolean;
  imeiNumber:       string | null;
  cashPrice:        string | null;
  profitMarkup:     string | null;
  paymentFrequency: string | null;
  paymentDueDay:    number;
  customerArea:     string | null;
  pausedUntil:      string | null;
  pauseReason:      string | null;
}

interface ListResponse {
  data: Installment[];
  total: number;
  page: number;
  limit: number;
}

export interface DueSheetItem {
  id: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  productName: string;
  monthly: number;
  remaining: number;
  nextDueDate: string;
  daysOverdue: number;
  area: string;
}

export interface CollectionScheduleItem {
  id: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  productName: string;
  monthly: number;
  remaining: number;
  paymentFrequency: string;
  nextDueDate: string;
  daysUntilDue: number;
  area: string;
  lastPaymentDate: string | null;
  lastPaymentAmount: number | null;
  urgency: 'overdue' | 'today' | 'upcoming';
}

export interface CollectionSchedule {
  items: CollectionScheduleItem[];
  summary: { overdue: number; today: number; upcoming: number; totalDue: number };
}

const unwrap = <T>(res: { data: { data: T } }) => res.data.data;

export const installmentsApi = {
  list: (params?: { page?: number; limit?: number; status?: string; search?: string; customerId?: string; frequency?: string; sortBy?: string; sortDir?: string }) =>
    api.get<{ data: ListResponse }>('/installments', { params }).then(unwrap<ListResponse>),

  exportAll: (params?: { status?: string; search?: string; frequency?: string }) =>
    api.get<{ data: ListResponse }>('/installments', { params: { ...params, export: '1', limit: 5000 } }).then(unwrap<ListResponse>),

  getOne: (id: string) =>
    api.get<{ data: Installment }>(`/installments/${id}`).then(unwrap<Installment>),

  getSettlement: (id: string) =>
    api.get<{ data: {
      installmentId: string; customerName: string; productName: string;
      remaining: number; discountPercent: number; discountAmount: number; settlementAmount: number; status: string;
    } }>(`/installments/${id}/settlement`).then(unwrap<{
      installmentId: string; customerName: string; productName: string;
      remaining: number; discountPercent: number; discountAmount: number; settlementAmount: number; status: string;
    }>),

  create: (data: CreateInstallmentInput) =>
    api.post<{ data: Installment }>('/installments', data).then(unwrap<Installment>),

  markDefault: (id: string) =>
    api.patch<{ data: Installment }>(`/installments/${id}/default`).then(unwrap<Installment>),

  cancel: (id: string) =>
    api.patch<{ data: Installment }>(`/installments/${id}/cancel`).then(unwrap<Installment>),

  reschedule: (id: string, body: { newMonths?: number; newMonthly?: number }) =>
    api.patch<{ data: Installment }>(`/installments/${id}/reschedule`, body).then(unwrap<Installment>),

  approve: (id: string) =>
    api.patch<{ data: Installment }>(`/installments/${id}/approve`).then(unwrap<Installment>),

  close: (id: string) =>
    api.patch<{ data: Installment }>(`/installments/${id}/close`).then(unwrap<Installment>),

  remove: (id: string) =>
    api.delete(`/installments/${id}`),

  update: (id: string, data: import('@assaan/shared').UpdateInstallmentInput) =>
    api.patch<{ data: Installment }>(`/installments/${id}`, data).then((r) => r.data.data),

  importBulk: (rows: import('@assaan/shared').ImportInstallmentRow[]) =>
    api.post<{ data: { imported: number; customersCreated: number; customersLinked: number; productsCreated: number; errors: Array<{ row: number; message: string }> } }>('/installments/import', { rows }).then((r) => r.data.data),

  dueSheet: () =>
    api.get<{ data: DueSheetItem[] }>('/installments/due-sheet').then(unwrap<DueSheetItem[]>),

  waiver: (id: string, body: { amount: number; reason?: string }) =>
    api.patch<{ data: Installment }>(`/installments/${id}/waiver`, body).then(unwrap<Installment>),

  pause: (id: string, body: { months: number; reason?: string }) =>
    api.patch<{ data: Installment }>(`/installments/${id}/pause`, body).then(unwrap<Installment>),

  unpause: (id: string) =>
    api.delete<{ data: Installment }>(`/installments/${id}/pause`).then(unwrap<Installment>),

  overdueWithStage: (search?: string) =>
    api.get<{ data: OverdueWithStageItem[] }>('/installments/overdue-stage', { params: search ? { search } : undefined }).then(unwrap<OverdueWithStageItem[]>),

  transfer: (id: string, body: { newCustomerId: string; reason?: string }) =>
    api.patch<{ data: TransferResult }>(`/installments/${id}/transfer`, body).then(unwrap<TransferResult>),

  collectionSchedule: (days: number = 7) =>
    api.get<{ data: CollectionSchedule }>('/installments/collection-schedule', { params: { days } }).then(unwrap<CollectionSchedule>),
};

export interface TransferResult {
  oldId: string;
  newInstallment: Installment & { customerName: string; productName: string };
  oldCustomerName: string;
  newCustomerName: string;
  reason: string | null;
}

export interface OverdueWithStageItem {
  id: string;
  customer_id: string;
  product_id: string;
  total_amount: string;
  down_payment: string;
  remaining: string;
  monthly: string;
  months: number;
  start_date: string;
  invoice_number: string | null;
  payment_frequency: string;
  payment_due_day: number;
  status: string;
  created_at: string;
  imei_number: string | null;
  customer_name: string;
  customer_phone: string;
  customer_area: string | null;
  product_name: string;
  days_overdue: number;
  last_action_type: string | null;
  last_action_date: string | null;
  last_promise_date: string | null;
}
