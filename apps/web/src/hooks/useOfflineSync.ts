import { useState, useEffect, useCallback, useRef } from 'react';
import { avoDb } from '../lib/avoOfflineDb.ts';
import { api } from '../api/client.ts';
import { verificationsApi } from '../api/verifications.api.ts';
import { useOnlineStatus } from './useOnlineStatus.ts';
import toast from 'react-hot-toast';

export function useOfflineSync(onSyncComplete?: () => void) {
  const isOnline = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing]       = useState(false);
  const syncing$ = useRef(false);

  const refreshCount = useCallback(async () => {
    try { setPendingCount(await avoDb.countPending()); } catch { /* IndexedDB unavailable */ }
  }, []);

  const sync = useCallback(async () => {
    if (syncing$.current) return;
    syncing$.current = true;
    setSyncing(true);

    try {
      const pending = await avoDb.getAllPending();
      if (!pending.length) return;

      let ok = 0, fail = 0;

      for (const sub of pending) {
        try {
          let photoEvidenceUrl: string | undefined;
          if (sub.photoBlob) {
            const fd = new FormData();
            fd.append('file', sub.photoBlob, 'evidence.jpg');
            fd.append('folder', 'assaan/verifications');
            const res = await api.post<{ data: { url: string } }>('/upload', fd, {
              headers: { 'Content-Type': 'multipart/form-data' },
            });
            photoEvidenceUrl = res.data.data.url;
          }

          await verificationsApi.submit(sub.customerId, {
            status:               sub.decision,
            addressVerified:      sub.checks.addressVerified,
            employerVerified:     sub.checks.employerVerified,
            guarantor1Reachable:  sub.checks.guarantor1Reachable,
            guarantor2Reachable:  sub.checks.guarantor2Reachable,
            ...(photoEvidenceUrl && { photoEvidenceUrl }),
            ...(sub.notes && { notes: sub.notes }),
            latitude:             sub.gps.lat,
            longitude:            sub.gps.lng,
            locationAccuracy:     sub.gps.accuracy,
          });

          await avoDb.removePending(sub.id);
          ok++;
        } catch {
          fail++;
        }
      }

      if (ok)   toast.success(`${ok} verification${ok > 1 ? 's' : ''} synced successfully`);
      if (fail) toast.error(`${fail} submission${fail > 1 ? 's' : ''} failed to sync — will retry`);
      if (ok)   onSyncComplete?.();
    } finally {
      setSyncing(false);
      syncing$.current = false;
      await refreshCount();
    }
  }, [onSyncComplete, refreshCount]);

  useEffect(() => { refreshCount(); }, [refreshCount]);

  // Auto-sync whatever queued up the moment connectivity comes back.
  useEffect(() => {
    if (!isOnline) return;
    avoDb.countPending().then((n) => { if (n > 0) sync(); }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  return { isOnline, pendingCount, syncing, refreshCount, sync };
}
