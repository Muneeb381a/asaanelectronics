import type { CreateSellerInput } from '@assaan/shared';
import { api } from './client.ts';
import type { AuthResponse } from './auth.api.ts';

export interface SellerSettings {
  dailyTarget?: number;
  weeklyTarget?: number;
  monthlyTarget?: number;
  commissionRate?: number;
}

export interface Seller {
  id: string;
  shopName: string;
  phone: string;
  address: string | null;
  plan: string;
  trialEndsAt: string | null;
  createdAt: string;
  murabahaMode: boolean;
  settings: SellerSettings | null;
}

interface CreateSellerResponse extends AuthResponse {
  seller: Seller;
}

export type PaymentAccountType = 'BANK' | 'JAZZCASH' | 'EASYPAISA' | 'SADAPAY' | 'NAYAPAY' | 'OTHER';

export interface PaymentAccount {
  id: string;
  type: PaymentAccountType;
  accountTitle: string;
  accountNumber: string;
  bankName: string | null;
  createdAt: string;
}

function unwrap<T>(res: { data: { data: T } }) {
  return res.data.data;
}

export const sellersApi = {
  create: (data: CreateSellerInput) =>
    api.post<{ data: CreateSellerResponse }>('/sellers', data).then(unwrap<CreateSellerResponse>),

  getMe: () =>
    api.get<{ data: Seller }>('/sellers/me').then(unwrap<Seller>),

  update: (data: { shopName?: string; phone?: string; address?: string; murabahaMode?: boolean; settings?: SellerSettings }) =>
    api.patch<{ data: Seller }>('/sellers/me', data).then(unwrap<Seller>),

  listPaymentAccounts: () =>
    api.get<{ data: PaymentAccount[] }>('/sellers/me/payment-accounts').then(unwrap<PaymentAccount[]>),

  addPaymentAccount: (data: { type: PaymentAccountType; accountTitle: string; accountNumber: string; bankName?: string }) =>
    api.post<{ data: PaymentAccount }>('/sellers/me/payment-accounts', data).then(unwrap<PaymentAccount>),

  removePaymentAccount: (id: string) =>
    api.delete(`/sellers/me/payment-accounts/${id}`),
};
