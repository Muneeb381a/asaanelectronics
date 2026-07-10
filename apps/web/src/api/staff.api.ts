import { api } from './client.ts';

export type StaffPermissions = {
  canAddCustomer: boolean;
  canEditCustomer: boolean;
  canAddInstallment: boolean;
  canRecordPayment: boolean;
  canViewReports: boolean;
  canManageProducts: boolean;
  canVerifyCustomers: boolean;
  canRecordExpense: boolean;
  canManageReturns: boolean;
  canSearchCnic: boolean;
  canMakeCashSales: boolean;
  canViewAllInstallments: boolean;
};

export type StaffMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: StaffPermissions | null;
  frozenUntil: string | null;
  createdAt: string;
};

// Each entry: [label, description shown as tooltip/subtext]
const PERM_LABELS: Record<keyof StaffPermissions, string> = {
  // Customer management
  canAddCustomer:         'Add new customers',
  canEditCustomer:        'Edit customer details',
  canVerifyCustomers:     'Verify customers (AVO)',
  canSearchCnic:          'CNIC bureau search (cross-shop)',
  // Installment & payment operations
  canAddInstallment:      'Create installments',
  canRecordPayment:       'Record payments',
  canMakeCashSales:       'Make cash sales',
  canManageReturns:       'Process product returns',
  // Inventory
  canManageProducts:      'Add / edit products & inventory',
  // Finance (sensitive — owner should control)
  canRecordExpense:       'Record shop expenses',
  canViewReports:         'View analytics & financial reports',
  // Data visibility
  canViewAllInstallments: 'See all installments (not just own customers)',
};

export type PermGroup = { label: string; keys: (keyof StaffPermissions)[] };

export const PERM_GROUPS: PermGroup[] = [
  {
    label: 'Customer Management',
    keys: ['canAddCustomer', 'canEditCustomer', 'canVerifyCustomers', 'canSearchCnic'],
  },
  {
    label: 'Installments & Payments',
    keys: ['canAddInstallment', 'canRecordPayment', 'canMakeCashSales', 'canManageReturns'],
  },
  {
    label: 'Inventory',
    keys: ['canManageProducts'],
  },
  {
    label: 'Finance & Reports (Sensitive)',
    keys: ['canRecordExpense', 'canViewReports'],
  },
  {
    label: 'Data Visibility',
    keys: ['canViewAllInstallments'],
  },
];

export { PERM_LABELS };

export interface CommissionRow {
  userId: string;
  userName: string;
  collected: number;
  payments: number;
  commission: number;
}

export interface CommissionReport {
  month: string;
  commissionRate: number;
  staff: CommissionRow[];
}

export const staffApi = {
  list: () => api.get<{ data: StaffMember[] }>('/staff').then((r) => r.data.data),
  commissions: (month?: string) =>
    api.get<{ data: CommissionReport }>('/staff/commissions', { params: month ? { month } : {} })
      .then((r) => r.data.data),
  create: (body: { name: string; email: string; password: string; permissions?: StaffPermissions }) =>
    api.post<{ data: StaffMember }>('/staff', body).then((r) => r.data.data),
  updatePermissions: (id: string, permissions: Partial<StaffPermissions>) =>
    api.patch<{ data: StaffMember }>(`/staff/${id}/permissions`, permissions).then((r) => r.data.data),
  freeze: (id: string, durationMonths: number | 'permanent') =>
    api.patch<{ data: StaffMember }>(`/staff/${id}/freeze`, { durationMonths }).then((r) => r.data.data),
  unfreeze: (id: string) =>
    api.patch<{ data: StaffMember }>(`/staff/${id}/unfreeze`, {}).then((r) => r.data.data),
  remove: (id: string) => api.delete(`/staff/${id}`),
};
