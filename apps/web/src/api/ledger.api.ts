import { api } from './client.ts';

export interface LedgerEntry {
  id: string;
  sellerId: string;
  type: 'CREDIT' | 'DEBIT';
  category: string;
  amount: string;
  description: string;
  date: string;
  referenceId: string | null;
  refType: string | null;
  createdAt: string;
}

export interface WalletBalance {
  credits: number;
  debits: number;
  balance: number;
}

export interface DailySummary {
  date: string;
  credits: number;
  debits: number;
  net: number;
  txCount: number;
  entries: LedgerEntry[];
}

export interface MonthlyRow {
  month: string;
  label: string;
  revenue: number;
  expenses: number;
  profit: number;
}

export interface ProfitLoss {
  revenue: number;
  expenses: number;
  profit: number;
  margin: number;
  monthly: MonthlyRow[];
  byCategory: { category: string; total: number }[];
}

const unwrap = <T>(res: { data: { data: T } }) => res.data.data;

export const ledgerApi = {
  balance: () =>
    api.get<{ data: WalletBalance }>('/ledger/balance').then(unwrap<WalletBalance>),

  cashBook: (from?: string, to?: string, limit?: number) =>
    api.get<{ data: LedgerEntry[] }>('/ledger/cashbook', { params: { from, to, limit } }).then(unwrap<LedgerEntry[]>),

  daily: (date?: string) =>
    api.get<{ data: DailySummary }>('/ledger/daily', { params: { date } }).then(unwrap<DailySummary>),

  pl: (from?: string, to?: string) =>
    api.get<{ data: ProfitLoss }>('/ledger/pl', { params: { from, to } }).then(unwrap<ProfitLoss>),
};
