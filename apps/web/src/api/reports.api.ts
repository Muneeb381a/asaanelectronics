import { api } from './client.ts';

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

export const reportsApi = {
  getMonthly: (year: number): Promise<MonthlyReportRow[]> =>
    api.get(`/reports/monthly?year=${year}`).then((res) => res.data.data),
};
