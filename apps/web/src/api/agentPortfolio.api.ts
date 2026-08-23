import { api } from './client.ts';

export interface PortfolioRow {
  id: string;
  agent_id: string;
  agent_name: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string | null;
  assigned_at: string;
  notes: string | null;
  installment_id: string | null;
  installment_amount: string | null;
  installment_status: string | null;
}

export interface DeductionRow {
  id: string;
  type: 'UNCOLLECTED' | 'ADVANCE' | 'DAMAGE' | 'OTHER';
  amount: string;
  description: string;
  customer_name: string | null;
  installment_id: string | null;
  created_at: string;
}

export interface AgentSalarySummaryRow {
  id: string;
  name: string;
  baseSalary: number;
  deductions: number;
  deductionCount: number;
  netSalary: number;
  portfolioSize: number;
}

export interface SalarySummary {
  month: string;
  staff: AgentSalarySummaryRow[];
}

export const agentPortfolioApi = {
  list: (agentId?: string) =>
    api.get<{ data: PortfolioRow[] }>('/agent-portfolio', { params: agentId ? { agentId } : {} })
      .then((r) => r.data.data),

  assign: (body: { customerId: string; agentId: string; notes?: string }) =>
    api.post<{ data: PortfolioRow }>('/agent-portfolio/assign', body).then((r) => r.data.data),

  unassign: (id: string) =>
    api.patch(`/agent-portfolio/${id}/unassign`).then((r) => r.data),

  // Deductions
  listDeductions: (staffId: string, month: string) =>
    api.get<{ data: DeductionRow[] }>('/agent-portfolio/deductions', { params: { staffId, month } })
      .then((r) => r.data.data),

  addDeduction: (body: {
    staffId: string; month: string;
    type: 'UNCOLLECTED' | 'ADVANCE' | 'DAMAGE' | 'OTHER';
    amount: number; description: string;
    installmentId?: string; customerId?: string;
  }) =>
    api.post<{ data: DeductionRow }>('/agent-portfolio/deductions', body).then((r) => r.data.data),

  deleteDeduction: (id: string) =>
    api.delete(`/agent-portfolio/deductions/${id}`),

  calculateUncollected: (month: string) =>
    api.post<{ data: { created: number; skipped: number } }>('/agent-portfolio/deductions/calculate', { month })
      .then((r) => r.data.data),

  salarySummary: (month?: string) =>
    api.get<{ data: SalarySummary }>('/agent-portfolio/salary-summary', { params: month ? { month } : {} })
      .then((r) => r.data.data),
};
