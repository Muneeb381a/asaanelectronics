import { api } from './client.ts';

export interface BackupData {
  exportedAt: string;
  sellerId:   string;
  customers:  Record<string, unknown>[];
  installments: Record<string, unknown>[];
  products:   Record<string, unknown>[];
  expenses:   Record<string, unknown>[];
}

export const exportsApi = {
  getBackup: () => api.get<{ data: BackupData }>('/exports/backup').then((r) => r.data.data),
};
