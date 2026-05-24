import { api } from './client.ts';

export type ExpenseCategory = 'RENT' | 'SALARY' | 'UTILITY' | 'PURCHASE' | 'MAINTENANCE' | 'TRANSPORT' | 'OTHER';

export interface Expense {
  id: string;
  sellerId: string;
  category: ExpenseCategory;
  amount: string;
  description: string | null;
  date: string;
  createdAt: string;
}

const unwrap = <T>(res: { data: { data: T } }) => res.data.data;

export const expensesApi = {
  list: (from?: string, to?: string) =>
    api.get<{ data: Expense[] }>('/expenses', { params: { from, to } }).then(unwrap<Expense[]>),

  create: (body: { category: ExpenseCategory; amount: number; description?: string; date?: string }) =>
    api.post<{ data: Expense }>('/expenses', body).then(unwrap<Expense>),

  remove: (id: string) =>
    api.delete(`/expenses/${id}`),
};
