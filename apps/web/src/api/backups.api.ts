import { api } from './client.ts';

export type BackupTrigger = 'auto' | 'manual' | 'pre-restore' | 'shop_deleted';

export interface BackupListItem {
  id: string;
  trigger: BackupTrigger;
  createdAt: string;
  sizeBytes: number;
}

export const backupsApi = {
  list: () => api.get<{ data: BackupListItem[] }>('/backups').then((r) => r.data.data),

  create: () => api.post<{ data: { id: string; sizeBytes: number } }>('/backups').then((r) => r.data.data),

  download: async (id: string) => {
    const res = await api.get(`/backups/${encodeURIComponent(id)}/download`, { responseType: 'blob' });
    return res.data as Blob;
  },

  restore: (id: string) => api.post(`/backups/${encodeURIComponent(id)}/restore`).then((r) => r.data.data),

  // Platform-admin support access to any shop's backups
  listForShop: (sellerId: string) =>
    api.get<{ data: BackupListItem[] }>(`/owner/shops/${sellerId}/backups`).then((r) => r.data.data),

  restoreForShop: (sellerId: string, id: string) =>
    api.post(`/owner/shops/${sellerId}/backups/${encodeURIComponent(id)}/restore`).then((r) => r.data.data),
};
