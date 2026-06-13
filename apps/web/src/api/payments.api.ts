import { api } from './client.ts';

export type PaymentMethod = 'CASH' | 'BANK' | 'JAZZCASH' | 'EASYPAISA' | 'OTHER';

export interface Payment {
  id: string;
  installmentId: string;
  amount: string;
  method: PaymentMethod;
  note: string | null;
  paidOn: string;
  deletedAt: string | null;
  collectedBy: string | null;
  collectorName: string | null;
  proofImageUrl: string | null;
}

export interface RecordPaymentInput {
  installmentId: string;
  amount: number;
  method: PaymentMethod;
  note?: string;
  collectedBy?: string;
  proofImageUrl?: string;
}

interface RecordResult {
  payment: Payment;
  remaining: number;
  completed: boolean;
}

export interface SellerPayment {
  id: string;
  amount: string;
  method: PaymentMethod;
  paidOn: string;
  note: string | null;
  customerName: string;
  customerPhone: string;
  productName: string;
  collectorName: string | null;
  invoiceNumber: string | null;
}

const unwrap = <T>(res: { data: { data: T } }) => res.data.data;

export const paymentsApi = {
  list: (installmentId: string) =>
    api.get<{ data: { data: Payment[]; total: number; page: number; limit: number } }>(
      '/payments', { params: { installmentId, limit: 100 } }
    ).then((res) => res.data.data.data),

  record: (data: RecordPaymentInput) =>
    api.post<{ data: RecordResult }>('/payments', data).then(unwrap<RecordResult>),

  patch: (id: string, data: { amount?: number; method?: PaymentMethod; note?: string }) =>
    api.patch<{ data: { remaining: number; completed: boolean } }>(`/payments/${id}`, data)
      .then(unwrap<{ remaining: number; completed: boolean }>),

  remove: (id: string) =>
    api.delete(`/payments/${id}`),

  listBySeller: (params?: { from?: string; to?: string }) =>
    api.get<{ data: SellerPayment[] }>('/payments', { params }).then(unwrap<SellerPayment[]>),
};
