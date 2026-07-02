import { api } from './client.ts';

export type BroadcastType   = 'info' | 'warning' | 'maintenance' | 'success';
export type BroadcastTarget = 'ALL' | 'TRIAL' | 'BASIC' | 'PRO' | 'ENTERPRISE';

export interface Broadcast {
  id: string;
  title: string;
  body: string;
  targetPlan: BroadcastTarget;
  type: BroadcastType;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
}

const unwrap = <T>(res: { data: { data: T } }) => res.data.data;

export const broadcastsApi = {
  getActive: () =>
    api.get<{ data: Broadcast[] }>('/broadcasts').then(unwrap<Broadcast[]>),
};
