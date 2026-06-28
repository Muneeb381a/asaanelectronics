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

const unwrap = <T>(res: { data: { data: T } }) => res.data.data;

export const handoversApi = {
  list: (params?: { staffId?: string; date?: string }): Promise<Handover[]> =>
    api.get('/handovers', { params }).then(unwrap<Handover[]>),

  collectedToday: (staffId?: string): Promise<{ collected: number }> =>
    api.get('/handovers/collected-today', { params: staffId ? { staffId } : {} }).then(unwrap<{ collected: number }>),

  create: (data: { handedAmount: number; note?: string; handoverDate?: string }): Promise<Handover> =>
    api.post('/handovers', data).then(unwrap<Handover>),

  confirm: (id: string, data: { confirmedAmount: number; ownerNote?: string }): Promise<Handover> =>
    api.patch(`/handovers/${id}/confirm`, data).then(unwrap<Handover>),

  dispute: (id: string, ownerNote?: string): Promise<Handover> =>
    api.patch(`/handovers/${id}/dispute`, { ownerNote }).then(unwrap<Handover>),
};
