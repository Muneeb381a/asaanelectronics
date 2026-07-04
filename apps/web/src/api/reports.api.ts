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

export type ForecastMonth = {
  month:            string;
  monthName:        string;
  expectedAmount:   number;
  monthlyAmount:    number;
  dailyAmount:      number;
  installmentCount: number;
};

export type CustomerBalanceInstallment = {
  installmentId:     string;
  productName:       string;
  totalAmount:       number;
  downPayment:       number;
  remaining:         number;
  monthly:           number;
  months:            number;
  paidTotal:         number;
  lastPaymentDate:   string | null;
  lastPaymentAmount: number | null;
  nextDueDate:       string | null;
  daysUntilDue:      number | null;
  status:            string;
};

export type CustomerBalance = {
  customerId:      string;
  customerName:    string;
  customerPhone:   string;
  customerAddress: string | null;
  installments:    CustomerBalanceInstallment[];
  totalRemaining:  number;
  totalPaid:       number;
  activeCount:     number;
  defaultedCount:  number;
  mostOverdueDays: number;
};

export type CustomerBalancesReport = {
  customers:  CustomerBalance[];
  grandTotal: number;
};

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

  getForecast: (): Promise<ForecastMonth[]> =>
    api.get('/reports/forecast').then((res) => res.data.data),

  getCustomerBalances: (): Promise<CustomerBalancesReport> =>
    api.get('/reports/customer-balances').then((res) => res.data.data),
};
