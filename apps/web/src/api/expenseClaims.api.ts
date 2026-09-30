import { api } from './client.ts';

export type ExpenseCategory = 'RENT' | 'SALARY' | 'UTILITY' | 'PURCHASE' | 'MAINTENANCE' | 'TRANSPORT' | 'OTHER';
export type ExpenseClaimStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ExpenseClaim {
  id: string;
  staffId: string;
  staffName: string | null;
  category: ExpenseCategory;
  amount: string;
  description: string | null;
  claimDate: string;
  receiptImageUrl: string | null;
  status: ExpenseClaimStatus;
  approvedAmount: string | null;
  ownerNote: string | null;
  createdAt: string;
}

const unwrap = <T>(res: { data: { data: T } }) => res.data.data;

export const expenseClaimsApi = {
  list: (staffId?: string) =>
    api.get<{ data: ExpenseClaim[] }>('/expense-claims', { params: staffId ? { staffId } : {} }).then(unwrap<ExpenseClaim[]>),

  create: (data: { category: ExpenseCategory; amount: number; description?: string; claimDate?: string; receiptImageUrl?: string }) =>
    api.post<{ data: ExpenseClaim }>('/expense-claims', data).then(unwrap<ExpenseClaim>),

  approve: (id: string, data: { approvedAmount?: number; ownerNote?: string }) =>
    api.patch<{ data: ExpenseClaim }>(`/expense-claims/${id}/approve`, data).then(unwrap<ExpenseClaim>),

  reject: (id: string, ownerNote?: string) =>
    api.patch<{ data: ExpenseClaim }>(`/expense-claims/${id}/reject`, { ownerNote }).then(unwrap<ExpenseClaim>),
};
