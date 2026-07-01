import { api } from './client.ts';

export interface RecentInstallment {
  id: string;
  customerName: string;
  productName: string;
  remaining: string;
  monthly: string;
  status: string;
  createdAt: string;
}

export interface Stats {
  todayCollections: number;
  monthCollections: number;
  todayCashSales: number;
  monthCashSales: number;
  activeCount: number;
  overdueCount: number;
  overdueAmount: number;
  recentInstallments: RecentInstallment[];
  lowStockItems: Array<{ id: string; name: string; stock: number; minStock: number }>;
  promisesDueCount: number;
  guarantorRiskCount: number;
  budgetAlertsCount: number;
}

export interface Reports {
  monthlyCollections: Array<{ month: string; label: string; total: number; installments: number; cashSales: number }>;
  collectionRate: { totalBilled: number; totalCollected: number; rate: number };
  agingBuckets: { current: number; days0_7: number; days8_30: number; days31_90: number; days90plus: number };
  topDebtors: Array<{ name: string; phone: string; remaining: number; count: number }>;
  topProducts: Array<{ name: string; totalAmount: number; count: number }>;
}

export interface Advanced {
  cashflowForecast: Array<{ date: string; expected: number }>;
  recovery: { efficiency: number; totalDue: number; totalCollected: number; overdueCount: number };
  staffProductivity: Array<{ userId: string; name: string; count: number; total: number }>;
  areaHeatmap: Array<{ city: string; overdueCount: number; defaultedCount: number }>;
}

export interface DashboardData {
  stats:    Stats;
  reports:  Reports | null;
  advanced: Advanced | null;
}

export interface DailyBriefing {
  dueToday:       number;
  overdueTotal:   number;
  promisesToday:  number;
  collectedToday: number;
  defaultedCount: number;
}

export const statsApi = {
  getDashboard:     () => api.get<{ data: DashboardData }>('/stats/dashboard').then((r) => r.data.data),
  getDailyBriefing: () => api.get<{ data: DailyBriefing }>('/stats/daily-briefing').then((r) => r.data.data),
  // Individual endpoints kept for any page that needs just one piece
  get:         () => api.get<{ data: Stats }>('/stats').then((r) => r.data.data),
  getReports:  () => api.get<{ data: Reports }>('/stats/reports').then((r) => r.data.data),
  getAdvanced: () => api.get<{ data: Advanced }>('/stats/advanced').then((r) => r.data.data),
};
