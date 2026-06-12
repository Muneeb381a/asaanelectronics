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
  customerArea:     string | null;
}

interface ListResponse {
  data: Installment[];
  total: number;
  page: number;
  limit: number;
}

const unwrap = <T>(res: { data: { data: T } }) => res.data.data;

export const installmentsApi = {
  list: (params?: { page?: number; limit?: number; status?: string; search?: string; customerId?: string; frequency?: string }) =>
    api.get<{ data: ListResponse }>('/installments', { params }).then(unwrap<ListResponse>),

  exportAll: (params?: { status?: string; search?: string; frequency?: string }) =>
    api.get<{ data: ListResponse }>('/installments', { params: { ...params, export: '1', limit: 5000 } }).then(unwrap<ListResponse>),

  getOne: (id: string) =>
    api.get<{ data: Installment }>(`/installments/${id}`).then(unwrap<Installment>),

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
};
