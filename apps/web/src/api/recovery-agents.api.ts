import { api } from './client.ts';

export interface AgentStat {
  userId: string;
  name: string;
  totalCollected: number;
  collectionCount: number;
  thisMonthTotal: number;
  thisMonthCount: number;
  lastCollectedAt: string | null;
}

export interface AgentCollection {
  id: string;
  amount: string;
  method: string;
  paidOn: string;
  note: string | null;
  proofImageUrl: string | null;
  customerName: string;
  customerPhone: string | null;
  productName: string;
  installmentId: string;
}

export interface AgentCollectionsResult {
  agent: { id: string; name: string };
  data: AgentCollection[];
  total: number;
  page: number;
  limit: number;
}

const unwrap = <T>(res: { data: { data: T } }) => res.data.data;

export const recoveryAgentsApi = {
  stats: () =>
    api.get<{ data: AgentStat[] }>('/recovery/agents').then(unwrap<AgentStat[]>),

  collections: (userId: string, page = 1, limit = 50) =>
    api
      .get<{ data: AgentCollectionsResult }>(`/recovery/agents/${userId}/collections`, {
        params: { page, limit },
      })
      .then(unwrap<AgentCollectionsResult>),
};
