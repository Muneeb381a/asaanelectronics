import { api } from './client.ts';

export type Plan = 'TRIAL' | 'BASIC' | 'PRO' | 'ENTERPRISE';

export interface Shop {
  id: string;
  shopName: string;
  phone: string;
  address: string | null;
  plan: Plan;
  isActive: boolean;
  trialEndsAt: string | null;
  planExpiresAt: string | null;
  createdAt: string;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerId: string | null;
}

export interface CreateShopInput {
  shopName: string;
  phone: string;
  address?: string;
  plan?: Plan;
}

export interface CreateShopOwnerInput {
  name: string;
  email: string;
  password: string;
}

const unwrap = <T>(res: { data: { data: T } }) => res.data.data;

export const ownerApi = {
  listShops: () =>
    api.get<{ data: Shop[] }>('/owner/shops').then(unwrap<Shop[]>),

  createShop: (data: CreateShopInput) =>
    api.post<{ data: Shop }>('/owner/shops', data).then(unwrap<Shop>),

  createShopOwner: (shopId: string, data: CreateShopOwnerInput) =>
    api.post(`/owner/shops/${shopId}/owner`, data).then(unwrap<unknown>),

  deleteShop: (id: string) =>
    api.delete(`/owner/shops/${id}`),

  toggleShopStatus: (id: string, isActive: boolean) =>
    api.patch<{ data: Shop }>(`/owner/shops/${id}/status`, { isActive }).then(unwrap<Shop>),

  changePlan: (sellerId: string, plan: Plan, planExpiresAt?: string) =>
    api.patch(`/billing/${sellerId}/plan`, { plan, planExpiresAt }).then(unwrap<unknown>),
};
