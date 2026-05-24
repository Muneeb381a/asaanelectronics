import { api } from './client.ts';

export type PaymentMethod = 'CASH' | 'BANK' | 'JAZZCASH' | 'EASYPAISA' | 'OTHER';

export interface Payment {
  id: string;
  installmentId: string;
  amount: string;
  method: PaymentMethod;
  note: string | null;
  paidOn: string;
}

export interface RecordPaymentInput {
  installmentId: string;
  amount: number;
  method: PaymentMethod;
  note?: string;
}

interface RecordResult {
  payment: Payment;
  remaining: number;
  completed: boolean;
}

const unwrap = <T>(res: { data: { data: T } }) => res.data.data;

export const paymentsApi = {
  list: (installmentId: string) =>
    api.get<{ data: Payment[] }>('/payments', { params: { installmentId } }).then(unwrap<Payment[]>),

  record: (data: RecordPaymentInput) =>
    api.post<{ data: RecordResult }>('/payments', data).then(unwrap<RecordResult>),

  remove: (id: string) =>
    api.delete(`/payments/${id}`),
};
