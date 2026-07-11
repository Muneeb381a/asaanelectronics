import { api } from './client.ts';

export type HandoverStatus = 'PENDING' | 'CONFIRMED' | 'DISPUTED';

export interface Handover {
  id: string;
  sellerId: string;
  staffId: string;
  handedAmount: string;
  confirmedAmount: string | null;
  note: string | null;
  ownerNote: string | null;
  status: HandoverStatus;
  handoverDate: string;
  confirmedAt: string | null;
  confirmedById: string | null;
  createdAt: string;
  staffName: string;
  staffEmail: string;
  confirmedByName: string | null;
}

export interface PendingHandoverRef {
  id: string;
  handedAmount: string;
  createdAt: string;
  note: string | null;
}

export interface StaffBalance {
  staffId: string;
  staffName: string;
  staffEmail: string;
  totalCollected: string;
  totalConfirmed: string;
  pendingBalance: string;
  pendingHandover: PendingHandoverRef | null;
}

const unwrap = <T>(res: { data: { data: T } }) => res.data.data;

export const handoversApi = {
  list: (params?: { staffId?: string; date?: string }): Promise<Handover[]> =>
    api.get('/handovers', { params }).then(unwrap<Handover[]>),

  collectedToday: (staffId?: string): Promise<{ collected: number }> =>
    api.get('/handovers/collected-today', { params: staffId ? { staffId } : {} }).then(unwrap<{ collected: number }>),

  // All staff pending balances — owner only
  pendingBalances: (): Promise<StaffBalance[]> =>
    api.get('/handovers/pending-balances').then(unwrap<StaffBalance[]>),

  // Own balance — any logged-in user; owner can pass staffId query param
  myBalance: (staffId?: string): Promise<StaffBalance | null> =>
    api.get('/handovers/my-balance', { params: staffId ? { staffId } : {} }).then(unwrap<StaffBalance | null>),

  create: (data: { handedAmount: number; note?: string; handoverDate?: string }): Promise<Handover> =>
    api.post('/handovers', data).then(unwrap<Handover>),

  confirm: (id: string, data: { confirmedAmount: number; ownerNote?: string }): Promise<Handover> =>
    api.patch(`/handovers/${id}/confirm`, data).then(unwrap<Handover>),

  dispute: (id: string, ownerNote?: string): Promise<Handover> =>
    api.patch(`/handovers/${id}/dispute`, { ownerNote }).then(unwrap<Handover>),

  reopen: (id: string): Promise<Handover> =>
    api.patch(`/handovers/${id}/reopen`, {}).then(unwrap<Handover>),

  directReceive: (data: { staffId: string; amount: number; note?: string }): Promise<Handover> =>
    api.post('/handovers/direct-receive', data).then(unwrap<Handover>),
};
