import { api } from './client.ts';

export type RecoveryActionType = 'CALLED' | 'VISITED' | 'PROMISE_TO_PAY' | 'REFUSED' | 'LEGAL_WARNING';

export interface RecoveryAction {
  id: string;
  installmentId: string;
  type: RecoveryActionType;
  note: string | null;
  promiseDate: string | null;
  createdAt: string;
  actorName: string | null;
  actorRole: string | null;
}

export interface PromiseDue {
  id: string;
  installmentId: string;
  promiseDate: string;
  note: string | null;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  productName: string;
  actorName: string | null;
  remaining?: string;
}

const unwrap = <T>(res: { data: { data: T } }) => res.data.data;

export const recoveryApi = {
  list: (installmentId: string) =>
    api.get<{ data: RecoveryAction[] }>('/recovery', { params: { installmentId } }).then(unwrap<RecoveryAction[]>),

  create: (body: { installmentId: string; type: RecoveryActionType; note?: string; promiseDate?: string }) =>
    api.post<{ data: RecoveryAction }>('/recovery', body).then(unwrap<RecoveryAction>),

  remove: (id: string) =>
    api.delete(`/recovery/${id}`),

  promisesDue: () =>
    api.get<{ data: PromiseDue[] }>('/recovery/promises-due').then(unwrap<PromiseDue[]>),

  allPromises: () =>
    api.get<{ data: PromiseDue[] }>('/recovery/promises-all').then(unwrap<PromiseDue[]>),
};
