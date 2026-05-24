import { api } from './client.ts';

export interface Anomaly {
  type: 'LEDGER_PAYMENT_MISMATCH' | 'INSTALLMENT_REMAINING_DRIFT' | 'JOURNAL_IMBALANCE';
  severity: 'HIGH' | 'MEDIUM';
  detail: string;
  entityId?: string;
  diff: number;
}

export interface ReconciliationRun {
  id: string;
  sellerId: string;
  runAt: string;
  trigger: string;
  status: 'OK' | 'ANOMALIES';
  anomalyCount: number;
  anomalies: Anomaly[];
  ledgerTotal: string | null;
  paymentsTotal: string | null;
  diff: string | null;
}

export interface HistoryEntry {
  id: string;
  runAt: string;
  trigger: string;
  status: 'OK' | 'ANOMALIES';
  anomalyCount: number;
  diff: string | null;
}

const unwrap = <T>(res: { data: { data: T } }) => res.data.data;

export const reconciliationApi = {
  latest:  () => api.get<{ data: ReconciliationRun | null }>('/reconciliation/latest').then(unwrap<ReconciliationRun | null>),
  history: () => api.get<{ data: HistoryEntry[] }>('/reconciliation/history').then(unwrap<HistoryEntry[]>),
  run:     () => api.post<{ data: ReconciliationRun }>('/reconciliation/run').then(unwrap<ReconciliationRun>),
};
