import { api } from './client.ts';

export interface AccountBalance {
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface BalancesResponse {
  cash: number;
  receivables: number;
  revenue: number;
  expenses: number;
  netPL: number;
  accounts: AccountBalance[];
}

export interface JournalLine {
  journalId: string;
  debit: string;
  credit: string;
  accountCode: string;
  accountName: string;
}

export interface JournalEntry {
  id: string;
  memo: string;
  refType: string | null;
  postedAt: string;
  lines: JournalLine[];
}

export interface JournalResponse {
  data: JournalEntry[];
  total: number;
  page: number;
  limit: number;
}

const unwrap = <T>(res: { data: { data: T } }) => res.data.data;

export const accountingApi = {
  getBalances: () =>
    api.get<{ data: BalancesResponse }>('/accounting/balances').then(unwrap<BalancesResponse>),
  listJournal: (params: { from?: string; to?: string; page?: number; limit?: number } = {}) =>
    api.get<{ data: JournalResponse }>('/accounting/journal', { params }).then(unwrap<JournalResponse>),
};
