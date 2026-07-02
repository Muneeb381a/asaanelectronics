import { api } from './client.ts';

export type Plan = 'TRIAL' | 'BASIC' | 'PRO' | 'ENTERPRISE';

export interface UsageStat {
  used: number;
  limit: number;
  pct: number;
  unlimited: boolean;
}

export interface BillingUsage {
  plan: Plan;
  planLabel: string;
  priceMonthly: number;
  trialEndsAt: string | null;
  planExpiresAt: string | null;
  trialDaysLeft: number | null;
  trialExpired: boolean;
  planExpired: boolean;
  inGracePeriod: boolean;
  graceDaysLeft: number;
  hardBlocked: boolean;
  isActive: boolean;
  limits: {
    customers: UsageStat;
    staff: UsageStat;
    installments: UsageStat;
  };
}

const unwrap = <T>(res: { data: { data: T } }) => res.data.data;

export const billingApi = {
  getUsage: () =>
    api.get<{ data: BillingUsage }>('/billing/usage').then(unwrap<BillingUsage>),
};
