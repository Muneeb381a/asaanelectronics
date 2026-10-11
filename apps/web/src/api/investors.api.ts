import { api } from './client.ts';

export interface Investor {
  id:                 string;
  name:               string;
  phone:              string | null;
  cnic:               string | null;
  profitSharePercent: number;
  notes:              string | null;
  isActive:           boolean;
  createdAt:          string;
  totalContributed:   number;
  totalPaidOut:       number;
  netPosition:        number;
  lastPayoutPeriod:   string | null;
}

export interface InvestorLedgerRow {
  type:             'CONTRIBUTION' | 'PAYOUT';
  id:               string;
  date:             string;
  amount:           number;
  note:             string | null;
  period:           string | null;
  method:           string | null;
  calculatedShare:  number | null;
  recordedByName:   string | null;
}

export interface InvestorLedger {
  investorId:          string;
  investorName:        string;
  profitSharePercent:  number;
  summary: {
    totalContributed: number;
    totalPaidOut:     number;
    netPosition:      number;
  };
  rows: InvestorLedgerRow[];
}

const unwrap = <T>(res: { data: { data: T } }) => res.data.data;

export const investorsApi = {
  list: () =>
    api.get<{ data: Investor[] }>('/investors').then(unwrap<Investor[]>),

  create: (body: { name: string; phone?: string; cnic?: string; profitSharePercent: number; notes?: string }) =>
    api.post<{ data: Investor }>('/investors', body).then(unwrap<Investor>),

  update: (id: string, body: Partial<{
    name: string; phone: string | null; cnic: string | null;
    profitSharePercent: number; notes: string | null; isActive: boolean;
  }>) =>
    api.patch<{ data: Investor }>(`/investors/${id}`, body).then(unwrap<Investor>),

  remove: (id: string) => api.delete(`/investors/${id}`),

  getLedger: (id: string) =>
    api.get<{ data: InvestorLedger }>(`/investors/${id}/ledger`).then(unwrap<InvestorLedger>),

  addContribution: (id: string, body: { amount: number; contributedOn: string; note?: string }) =>
    api.post<{ data: InvestorLedgerRow }>(`/investors/${id}/contributions`, body).then(unwrap<InvestorLedgerRow>),

  removeContribution: (id: string, contribId: string) =>
    api.delete(`/investors/${id}/contributions/${contribId}`),

  recordPayout: (id: string, body: {
    period: string; method: 'MANUAL' | 'AUTO' | 'MANUAL_SPLIT'; calculatedShare?: number; amount: number; note?: string; paidOn: string;
  }) =>
    api.post<{ data: InvestorLedgerRow }>(`/investors/${id}/payouts`, body).then(unwrap<InvestorLedgerRow>),

  removePayout: (id: string, payoutId: string) =>
    api.delete(`/investors/${id}/payouts/${payoutId}`),
};
