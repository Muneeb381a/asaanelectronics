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
  commissionRate: string | null;
  monthlySalary: string | null;
  createdAt: string;
};

// Each entry: [label, description shown as tooltip/subtext]
const PERM_LABELS: Record<keyof StaffPermissions, string> = {
  canAddCustomer:         'Add new customers',
  canEditCustomer:        'Edit customer details',
  canVerifyCustomers:     'Verify customers (AVO)',
  canSearchCnic:          'CNIC bureau search (cross-shop)',
  canAddInstallment:      'Create installments',
  canRecordPayment:       'Record payments',
  canMakeCashSales:       'Make cash sales',
  canManageReturns:       'Process product returns',
  canManageProducts:      'Add / edit products & inventory',
  canRecordExpense:       'Record shop expenses',
  canViewReports:         'View analytics & financial reports',
  canViewAllInstallments: 'See all installments (not just own customers)',
};

export type PermGroup = { label: string; keys: (keyof StaffPermissions)[] };

export const PERM_GROUPS: PermGroup[] = [
  { label: 'Customer Management',        keys: ['canAddCustomer', 'canEditCustomer', 'canVerifyCustomers', 'canSearchCnic'] },
  { label: 'Installments & Payments',    keys: ['canAddInstallment', 'canRecordPayment', 'canMakeCashSales', 'canManageReturns'] },
  { label: 'Inventory',                  keys: ['canManageProducts'] },
  { label: 'Finance & Reports',          keys: ['canRecordExpense', 'canViewReports'] },
  { label: 'Data Visibility',            keys: ['canViewAllInstallments'] },
];

export { PERM_LABELS };

// Commission
export interface CommissionPaid {
  id: string;
  amount: number;
  paidAt: string;
  note: string | null;
}

export interface CommissionRow {
  userId:         string;
  userName:       string;
  collected:      number;
  payments:       number;
  commissionRate: number;
  commission:     number;
  paid:           CommissionPaid | null;
}

export interface CommissionReport {
  month:          string;
  commissionRate: number;
  staff:          CommissionRow[];
}

// Salary
export interface SalaryPaid {
  id:     string;
  amount: number;
  paidAt: string;
  note:   string | null;
}

export interface SalaryRow {
  id:            string;
  name:          string;
  email:         string;
  monthlySalary: number | null;
  paid:          SalaryPaid | null;
}

export interface SalaryReport {
  month: string;
  staff: SalaryRow[];
}

export const staffApi = {
  list: () =>
    api.get<{ data: StaffMember[] }>('/staff').then((r) => r.data.data),

  create: (body: { name: string; email: string; password: string; permissions?: StaffPermissions }) =>
    api.post<{ data: StaffMember }>('/staff', body).then((r) => r.data.data),

  updatePermissions: (id: string, permissions: Partial<StaffPermissions>) =>
    api.patch<{ data: StaffMember }>(`/staff/${id}/permissions`, permissions).then((r) => r.data.data),

  updateProfile: (id: string, body: { commissionRate?: number | null; monthlySalary?: number | null }) =>
    api.patch<{ data: StaffMember }>(`/staff/${id}/profile`, body).then((r) => r.data.data),

  freeze: (id: string, durationMonths: number | 'permanent') =>
    api.patch<{ data: StaffMember }>(`/staff/${id}/freeze`, { durationMonths }).then((r) => r.data.data),

  unfreeze: (id: string) =>
    api.patch<{ data: StaffMember }>(`/staff/${id}/unfreeze`, {}).then((r) => r.data.data),

  remove: (id: string) => api.delete(`/staff/${id}`),

  // Commission
  commissions: (month?: string) =>
    api.get<{ data: CommissionReport }>('/staff/commissions', { params: month ? { month } : {} })
      .then((r) => r.data.data),

  payCommission: (body: { staffId: string; month: string; amount: number; note?: string }) =>
    api.post<{ data: object }>('/staff/commissions/pay', body).then((r) => r.data.data),

  deleteCommissionPayment: (staffId: string, month: string) =>
    api.delete('/staff/commissions/pay', { data: { staffId, month } }),

  // Salary
  salaries: (month?: string) =>
    api.get<{ data: SalaryReport }>('/staff/salaries', { params: month ? { month } : {} })
      .then((r) => r.data.data),

  paySalary: (body: { staffId: string; month: string; amount: number; note?: string }) =>
    api.post<{ data: object }>('/staff/salaries/pay', body).then((r) => r.data.data),

  deleteSalaryPayment: (staffId: string, month: string) =>
    api.delete('/staff/salaries/pay', { data: { staffId, month } }),
};
