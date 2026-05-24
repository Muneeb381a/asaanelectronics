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
}

interface ListResponse {
  data: Installment[];
  total: number;
  page: number;
  limit: number;
}

const unwrap = <T>(res: { data: { data: T } }) => res.data.data;

export const installmentsApi = {
  list: (params?: { page?: number; limit?: number; status?: string; search?: string; customerId?: string }) =>
    api.get<{ data: ListResponse }>('/installments', { params }).then(unwrap<ListResponse>),

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
};
