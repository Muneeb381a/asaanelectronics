import { api } from './client.ts';

export type AreaRow = {
  area: string;
  customers: number;
  active: number;
  overdue: number;
  overdueAmount: string;
  totalCollected: string;
  remaining: string;
};

export type MonthlyReportRow = {
  month: number;
  monthName: string;
  newInstallments: number;
  totalSaleAmount: number;
  downPayments: number;
  newCustomers: number;
  paymentsCollected: number;
  cashSalesCount: number;
  cashSalesAmount: number;
  totalExpenses: number;
  netRevenue: number;
};

export type MonthlyCustomerRow = {
  srNo:             number;
  clientId:         string;
  customerName:     string;
  customerPhone:    string;
  rupees:           number;
  paidAmount:       number;
  monthlyAmount:    number;
  remaining:        number;
  status:           'Paid' | 'Pending' | 'Defaulted';
  paymentFrequency: 'monthly' | 'daily';
};

export type AgingBucket = {
  bucket: 'current' | '1-7' | '8-30' | '31-90' | '90+';
  count: number;
  totalOutstanding: string;
};

export type HeatmapDay = { day: number; total: number; count: number };

export const reportsApi = {
  getMonthly: (year: number): Promise<MonthlyReportRow[]> =>
    api.get(`/reports/monthly?year=${year}`).then((res) => res.data.data),

  getMonthlyCustomers: (year: number, month: number): Promise<MonthlyCustomerRow[]> =>
    api.get(`/reports/monthly-customers?year=${year}&month=${month}`).then((res) => res.data.data),

  getAreaReport: (): Promise<AreaRow[]> =>
    api.get('/reports/areas').then((res) => res.data.data),

  getAgingReport: (): Promise<AgingBucket[]> =>
    api.get('/reports/aging').then((res) => res.data.data),

  getCollectionsHeatmap: (year: number, month: number): Promise<HeatmapDay[]> =>
    api.get(`/reports/collections-heatmap?year=${year}&month=${month}`).then((res) => res.data.data),
};
