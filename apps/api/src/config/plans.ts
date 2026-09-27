export type Plan = 'TRIAL' | 'BASIC' | 'PRO' | 'ENTERPRISE';

export type PlanLimits = {
  customers:    number;  // -1 = unlimited
  staff:        number;
  installments: number;
  label:        string;
  priceMonthly: number;  // PKR, 0 = free, -1 = custom
  trialDays:    number;
  badge:        string;
  hasAutomaticBackups: boolean;
};

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  TRIAL: {
    customers:    50,
    staff:        2,
    installments: 100,
    label:        'Trial',
    priceMonthly: 0,
    trialDays:    14,
    badge:        'amber',
    hasAutomaticBackups: false,
  },
  BASIC: {
    customers:    500,
    staff:        5,
    installments: 2000,
    label:        'Basic',
    priceMonthly: 2999,
    trialDays:    0,
    badge:        'blue',
    hasAutomaticBackups: true,
  },
  PRO: {
    customers:    5000,
    staff:        20,
    installments: -1,
    label:        'Pro',
    priceMonthly: 7999,
    trialDays:    0,
    badge:        'purple',
    hasAutomaticBackups: true,
  },
  ENTERPRISE: {
    customers:    -1,
    staff:        -1,
    installments: -1,
    label:        'Enterprise',
    priceMonthly: -1,
    trialDays:    0,
    badge:        'indigo',
    hasAutomaticBackups: true,
  },
};

export function getLimit(plan: Plan, key: keyof Pick<PlanLimits, 'customers' | 'staff' | 'installments'>): number {
  return PLAN_LIMITS[plan][key];
}

export function isUnlimited(limit: number) { return limit === -1; }
