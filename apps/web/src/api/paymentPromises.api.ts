import { api } from './client.ts';

export type PromiseStatus = 'PENDING' | 'KEPT' | 'KEPT_LATE' | 'BROKEN' | 'CANCELLED';

export interface PaymentPromise {
  id: string;
  installmentId: string;
  promisedDate: string;
  promisedAmount: string | null;
  note: string | null;
  createdAt: string;
  createdByName: string | null;
  cancelledAt: string | null;
  status: PromiseStatus;
}

export interface PromiseFollowUp {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  installmentId: string;
  promisedDate: string;
  promisedAmount: string | null;
  note: string | null;
  createdAt: string;
  status: PromiseStatus;
}

const unwrap = <T>(res: { data: { data: T } }) => res.data.data;

export const paymentPromisesApi = {
  list: (customerId: string) =>
    api.get<{ data: PaymentPromise[] }>(`/customers/${customerId}/promises`).then(unwrap<PaymentPromise[]>),

  create: (customerId: string, body: { installmentId: string; promisedDate: string; promisedAmount?: number; note?: string }) =>
    api.post<{ data: PaymentPromise }>(`/customers/${customerId}/promises`, body).then(unwrap<PaymentPromise>),

  cancel: (customerId: string, promiseId: string) =>
    api.delete(`/customers/${customerId}/promises/${promiseId}`),

  followUps: () =>
    api.get<{ data: PromiseFollowUp[] }>('/customers/promises/followups').then(unwrap<PromiseFollowUp[]>),
};
