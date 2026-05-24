import type { CreateSellerInput } from '@assaan/shared';
import { api } from './client.ts';
import type { AuthResponse } from './auth.api.ts';

interface Seller {
  id: string;
  shopName: string;
  phone: string;
  address: string | null;
  plan: string;
  trialEndsAt: string | null;
  createdAt: string;
}

interface CreateSellerResponse extends AuthResponse {
  seller: Seller;
}

function unwrap<T>(res: { data: { data: T } }) {
  return res.data.data;
}

export const sellersApi = {
  create: (data: CreateSellerInput) =>
    api.post<{ data: CreateSellerResponse }>('/sellers', data).then(unwrap<CreateSellerResponse>),

  getMe: () =>
    api.get<{ data: Seller }>('/sellers/me').then(unwrap<Seller>),

  update: (data: { shopName?: string; phone?: string; address?: string }) =>
    api.patch<{ data: Seller }>('/sellers/me', data).then(unwrap<Seller>),
};
