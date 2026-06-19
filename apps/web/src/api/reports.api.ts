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

export type MonthlyCustomerRow = {
  srNo:             number;
  clientId:         string;
  customerName:     string;
  customerPhone:    string;
  rupees:           number;
  paidAmount:       number;
  monthlyAmount:    number;
  remaining:        number;
  status:           'Paid' | 'Pending';
  paymentFrequency: 'monthly' | 'daily';
};

export const reportsApi = {
  getMonthly: (year: number): Promise<MonthlyReportRow[]> =>
    api.get(`/reports/monthly?year=${year}`).then((res) => res.data.data),

  getMonthlyCustomers: (year: number, month: number): Promise<MonthlyCustomerRow[]> =>
    api.get(`/reports/monthly-customers?year=${year}&month=${month}`).then((res) => res.data.data),
};
