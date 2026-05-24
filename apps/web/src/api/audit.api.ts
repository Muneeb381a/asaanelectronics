import { api } from './client.ts';

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  description: string;
  reason: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  meta: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  sessionId: string | null;
  createdAt: string;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  actorRole: string | null;
}

export interface AuditListResponse {
  data: AuditLog[];
  total: number;
  page: number;
  limit: number;
}

const unwrap = <T>(res: { data: { data: T } }) => res.data.data;

export const auditApi = {
  list: (params: {
    from?: string; to?: string; userId?: string;
    action?: string; entityType?: string; page?: number; limit?: number;
  } = {}) =>
    api.get<{ data: AuditListResponse }>('/audit', { params }).then(unwrap<AuditListResponse>),
};
