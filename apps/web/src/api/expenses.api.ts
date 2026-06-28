import { api } from './client.ts';

export type ExpenseCategory = 'RENT' | 'SALARY' | 'UTILITY' | 'PURCHASE' | 'MAINTENANCE' | 'TRANSPORT' | 'OTHER';

export interface Expense {
  id: string;
  sellerId: string;
  category: ExpenseCategory;
  amount: string;
  description: string | null;
  date: string;
  isRecurring: boolean;
  recurrenceDay: number;
  createdAt: string;
}

export interface RecurringSuggestion {
  id: string;
  category: ExpenseCategory;
  amount: string;
  description: string | null;
  recurrenceDay: number;
  lastDate: string;
}

const unwrap = <T>(res: { data: { data: T } }) => res.data.data;

export const expensesApi = {
  list: (from?: string, to?: string) =>
    api.get<{ data: Expense[] }>('/expenses', { params: { from, to } }).then(unwrap<Expense[]>),

  create: (body: { category: ExpenseCategory; amount: number; description?: string; date?: string; isRecurring?: boolean; recurrenceDay?: number }) =>
    api.post<{ data: Expense }>('/expenses', body).then(unwrap<Expense>),

  update: (id: string, body: { category?: ExpenseCategory; amount?: number; description?: string; date?: string; isRecurring?: boolean; recurrenceDay?: number }) =>
    api.patch<{ data: Expense }>(`/expenses/${id}`, body).then(unwrap<Expense>),

  remove: (id: string) =>
    api.delete(`/expenses/${id}`),

  getRecurringSuggestions: (): Promise<RecurringSuggestion[]> =>
    api.get('/expenses/recurring-suggestions').then(unwrap<RecurringSuggestion[]>),
};
