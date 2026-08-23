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

export type CashflowCalendarDay = {
  date:            string;
  expectedAmount:  number;
  expectedCount:   number;
  collectedAmount: number;
  collectedCount:  number;
};

export type CashflowDayInstallment = {
  id:               string;
  customerName:     string;
  customerPhone:    string;
  area:             string | null;
  address:          string | null;
  productName:      string;
  monthly:          number;
  remaining:        number;
  status:           string;
  paymentFrequency: string;
  paidToday:        number;
  paymentCount:     number;
};

export type CohortRow = {
  cohortMonth:    string;
  cohortLabel:    string;
  total:          number;
  completed:      number;
  active:         number;
  defaulted:      number;
  cancelled:      number;
  totalValue:     number;
  completedValue: number;
  completionRate: number;
  defaultRate:    number;
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

  getCashflowCalendar: (year: number, month: number): Promise<CashflowCalendarDay[]> =>
    api.get(`/reports/cashflow-calendar?year=${year}&month=${month}`).then((res) => res.data.data),

  getCashflowDay: (date: string): Promise<CashflowDayInstallment[]> =>
    api.get(`/reports/cashflow-day?date=${date}`).then((res) => res.data.data),

  getCohortAnalysis: (): Promise<CohortRow[]> =>
    api.get('/reports/cohort').then((res) => res.data.data),
};
