import { api } from './client.ts';

export interface Session {
  id: string;
  deviceName: string | null;
  deviceType: string | null;
  ip: string | null;
  lastActiveAt: string | null;
  createdAt: string;
  expiresAt: string;
  isSuspicious: boolean;
}

const unwrap = <T>(res: { data: { data: T } }) => res.data.data;

export const sessionsApi = {
  list: () =>
    api.get<{ data: Session[] }>('/sessions').then(unwrap<Session[]>),

  revoke: (id: string) =>
    api.delete(`/sessions/${id}`),

  revokeAll: (exceptId?: string) =>
    api.delete('/sessions/all', { data: { exceptId } }),
};
