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

export interface PlatformStats {
  totalShops: number;
  activeShops: number;
  suspendedShops: number;
  expiredShops: number;
  trialShops: number;
  paidShops: number;
  newThisMonth: number;
  mrr: number;
  totalRevenueCollected: number;
  revenueThisMonth: number;
  totalCustomers: number;
  totalInstallments: number;
  trialExpiring7: Shop[];
  planExpiring7: Shop[];
  planExpiring14: Shop[];
  planExpiring30: Shop[];
}

export interface ShopUsageLimits {
  customers: number;
  staff: number;
  installments: number;
  label: string;
  priceMonthly: number;
}

export interface ShopUsage {
  customers: number;
  installments: number;
  staff: number;
  paymentsThisMonth: number;
  totalRevenue: number;
  lastActivity: string | null;
}

export interface AdminPaymentLog {
  id: string;
  sellerId: string;
  amount: string;
  method: string;
  reference: string | null;
  forMonth: string | null;
  note: string | null;
  createdAt: string;
  shopName: string | null;
}

export interface AdminShopNote {
  id: string;
  sellerId: string;
  content: string;
  createdBy: string | null;
  createdAt: string;
}

export interface ShopDetail {
  shop: Shop & { murabaha_mode?: boolean; settings?: unknown };
  usage: ShopUsage;
  limits: ShopUsageLimits;
  paymentLogs: AdminPaymentLog[];
  notes: AdminShopNote[];
}

export interface SuperAdminAuditLog {
  id: string;
  action: string;
  sellerId: string | null;
  shopName: string | null;
  note: string | null;
  meta: unknown;
  createdAt: string;
  actorName: string | null;
  actorEmail: string | null;
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

  // A1: Platform stats
  getPlatformStats: () =>
    api.get<{ data: PlatformStats }>('/owner/stats').then(unwrap<PlatformStats>),

  // A3: Shop usage drill-in
  getShopUsage: (id: string) =>
    api.get<{ data: ShopDetail }>(`/owner/shops/${id}/usage`).then(unwrap<ShopDetail>),

  // A4: Payment logs
  listPaymentLogs: (sellerId?: string) =>
    api.get<{ data: AdminPaymentLog[] }>('/owner/payment-logs', { params: sellerId ? { sellerId } : {} }).then(unwrap<AdminPaymentLog[]>),

  addPaymentLog: (sellerId: string, data: { amount: number; method: string; reference?: string; forMonth?: string; note?: string }) =>
    api.post<{ data: AdminPaymentLog }>(`/owner/shops/${sellerId}/payment-logs`, data).then(unwrap<AdminPaymentLog>),

  deletePaymentLog: (logId: string) =>
    api.delete(`/owner/payment-logs/${logId}`),

  // A7: Shop notes
  addShopNote: (sellerId: string, content: string) =>
    api.post<{ data: AdminShopNote }>(`/owner/shops/${sellerId}/notes`, { content }).then(unwrap<AdminShopNote>),

  deleteShopNote: (sellerId: string, noteId: string) =>
    api.delete(`/owner/shops/${sellerId}/notes/${noteId}`),

  // A10: Super-admin audit log
  listAdminAuditLogs: (sellerId?: string, limit = 100) =>
    api.get<{ data: SuperAdminAuditLog[] }>('/owner/admin-audit-logs', {
      params: { ...(sellerId ? { sellerId } : {}), limit },
    }).then(unwrap<SuperAdminAuditLog[]>),
};
