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

const PERM_LABELS: Record<keyof StaffPermissions, string> = {
  canAddCustomer:         'Add customers',
  canEditCustomer:        'Edit customers',
  canAddInstallment:      'Add installments',
  canRecordPayment:       'Record payments',
  canViewReports:         'View reports',
  canManageProducts:      'Manage products',
  canVerifyCustomers:     'AVO — Verify customers',
  canRecordExpense:       'Record expenses',
  canManageReturns:       'Manage returns',
  canSearchCnic:          'CNIC Search (bureau lookup)',
  canMakeCashSales:       'Cash Sales',
  canViewAllInstallments: 'Search all installments (not just own)',
};

export { PERM_LABELS };

export const staffApi = {
  list: () => api.get<{ data: StaffMember[] }>('/staff').then((r) => r.data.data),
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
