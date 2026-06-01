import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ClipboardCheck, Phone, MapPin, Briefcase, CheckCircle2, XCircle,
  ImageIcon, X, Navigation, AlertCircle, Loader2, WifiOff, RefreshCw, Clock,
} from 'lucide-react';
import { verificationsApi, type QueueCustomer } from '../api/verifications.api.ts';
import { api } from '../api/client.ts';
import { avoDb } from '../lib/avoOfflineDb.ts';
import { getErrorMessage } from '../utils/error.ts';
import { useOfflineSync } from '../hooks/useOfflineSync.ts';
import toast from 'react-hot-toast';

const VSTATUS = {
  PENDING:      { label: 'Pending',   cls: 'bg-amber-100 text-amber-700'  },
  UNDER_REVIEW: { label: 'In Review', cls: 'bg-blue-100 text-blue-700'    },
  APPROVED:     { label: 'Approved',  cls: 'bg-green-100 text-green-700'  },
  REJECTED:     { label: 'Rejected',  cls: 'bg-red-100 text-red-700'      },
};

type GpsState =
  | { status: 'acquiring' }
  | { status: 'acquired'; lat: number; lng: number; accuracy: number }
  | { status: 'denied'; reason: string };

type ChecklistState = {
  addressVerified: boolean;
  employerVerified: boolean;
  guarantor1Reachable: boolean;
  guarantor2Reachable: boolean;
};

function useGps() {
  const [gps, setGps] = useState<GpsState>({ status: 'acquiring' });
  useEffect(() => {
    if (!navigator.geolocation) {
      setGps({ status: 'denied', reason: 'GPS not supported on this device' });
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => setGps({ status: 'acquired', lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => setGps({ status: 'denied', reason: err.message }),
      { enableHighAccuracy: true, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);
  return gps;
}

function GpsBadge({ gps }: { gps: GpsState }) {
  if (gps.status === 'acquiring') return (
    <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
      <Loader2 size={13} className="animate-spin" />
      <span className="text-xs font-medium">Acquiring GPS…</span>
    </div>
  );
  if (gps.status === 'denied') return (
    <div className="flex items-center gap-1.5 text-red-600 bg-red-50 rounded-xl px-3 py-2">
      <AlertCircle size={13} />
      <span className="text-xs font-medium">GPS denied — {gps.reason}</span>
    </div>
  );
  return (
    <div className="flex items-center gap-1.5 text-green-700 bg-green-50 rounded-xl px-3 py-2">
      <Navigation size={13} className="fill-green-600" />
      <span className="text-xs font-medium">GPS locked · ±{Math.round(gps.accuracy)}m</span>
      <a href={`https://maps.google.com/?q=${gps.lat},${gps.lng}`} target="_blank" rel="noreferrer"
        className="text-[10px] text-green-600 underline ml-1">View</a>
    </div>
  );
}

interface PhotoResult { previewUrl: string; file: File | null; serverUrl: string | null }

function PhotoCapture({
  isOnline, previewUrl, onCapture,
}: {
  isOnline: boolean;
  previewUrl: string | null;
  onCapture: (r: PhotoResult) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    if (!isOnline) {
      // Store locally — upload on sync
      onCapture({ previewUrl: URL.createObjectURL(file), file, serverUrl: null });
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'assaan/verifications');
      const res = await api.post<{ data: { url: string } }>('/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onCapture({ previewUrl: res.data.data.url, file: null, serverUrl: res.data.data.url });
    } catch { toast.error('Photo upload failed'); }
    finally { setUploading(false); }
  }, [isOnline, onCapture]);

  if (previewUrl) return (
    <div className="relative rounded-xl overflow-hidden border border-gray-200 group">
      <img src={previewUrl} alt="evidence" className="w-full h-40 object-cover" />
      <button type="button" onClick={() => onCapture({ previewUrl: '', file: null, serverUrl: null })}
        className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition">
        <X size={12} />
      </button>
      <div className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[10px] text-center py-1">
        {isOnline ? 'Photo uploaded' : 'Photo saved — will upload when online'}
      </div>
    </div>
  );

  return (
    <button type="button" onClick={() => ref.current?.click()} disabled={uploading}
      className="w-full h-40 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-blue-400 hover:text-blue-500 transition disabled:opacity-50">
      {uploading
        ? <><Loader2 size={20} className="animate-spin" /><span className="text-xs">Uploading…</span></>
        : <>
            <ImageIcon size={22} />
            <span className="text-xs font-medium">Take / upload photo evidence</span>
            <span className="text-[10px]">{isOnline ? 'Required for submission' : 'Saved offline until connected'}</span>
          </>
      }
      <input ref={ref} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
    </button>
  );
}

function CheckRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none group">
      <div onClick={() => onChange(!value)}
        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition shrink-0 ${value ? 'bg-blue-600 border-blue-600' : 'border-gray-300 group-hover:border-blue-400'}`}>
        {value && <CheckCircle2 size={12} className="text-white" />}
      </div>
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

function VerifyModal({
  customer, isOnline, onClose, onSaved,
}: {
  customer: QueueCustomer;
  isOnline: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const qc  = useQueryClient();
  const gps = useGps();

  const [checks, setChecks] = useState<ChecklistState>({
    addressVerified: false, employerVerified: false,
    guarantor1Reachable: false, guarantor2Reachable: false,
  });
  const [photo, setPhoto] = useState<PhotoResult | null>(null);
  const [notes, setNotes]     = useState('');
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [saving, setSaving]   = useState(false);

  const gpsReady   = gps.status === 'acquired';
  const hasPhoto   = !!(photo?.serverUrl || photo?.file);
  const canSubmit  = decision && hasPhoto && gpsReady;

  const handleCapture = useCallback((r: PhotoResult) => {
    setPhoto(r.previewUrl ? r : null);
  }, []);

  // Online submit
  const { mutate, isPending } = useMutation({
    mutationFn: () => {
      if (gps.status !== 'acquired') throw new Error('GPS not available');
      if (!photo?.serverUrl) throw new Error('Photo not uploaded');
      return verificationsApi.submit(customer.id, {
        status: decision!, ...checks,
        photoEvidenceUrl: photo.serverUrl,
        ...(notes && { notes }),
        latitude: gps.lat, longitude: gps.lng, locationAccuracy: gps.accuracy,
      });
    },
    onSuccess: () => {
      toast.success(decision === 'APPROVED' ? 'Customer approved' : 'Customer rejected');
      qc.invalidateQueries({ queryKey: ['my-queue'] });
      onClose();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  // Offline submit — save to IndexedDB
  async function handleOfflineSave() {
    if (gps.status !== 'acquired' || !photo?.file || !decision) return;
    setSaving(true);
    try {
      await avoDb.addPending({
        id:           crypto.randomUUID(),
        customerId:   customer.id,
        customerName: customer.name,
        photoBlob:    photo.file,
        gps:          { lat: gps.lat, lng: gps.lng, accuracy: gps.accuracy },
        checks,
        notes,
        decision,
        createdAt:    new Date().toISOString(),
      });
      toast.success('Saved offline — will sync when connected');
      onSaved();
      onClose();
    } catch {
      toast.error('Failed to save offline');
    } finally {
      setSaving(false);
    }
  }

  const set = (k: keyof ChecklistState) => (v: boolean) => setChecks((c) => ({ ...c, [k]: v }));
  const busy = isPending || saving;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[92vh]">

        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between shrink-0">
          <div>
            <p className="text-sm font-bold text-gray-900">{customer.name}</p>
            <p className="text-xs text-gray-400 font-mono">{customer.cnicMasked}</p>
          </div>
          <div className="flex items-center gap-2">
            {!isOnline && (
              <span className="flex items-center gap-1 text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-semibold">
                <WifiOff size={9} /> Offline
              </span>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><X size={16} /></button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          <GpsBadge gps={gps} />
          {gps.status === 'denied' && (
            <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">
              Enable location permission to submit verification.
            </p>
          )}

          {/* Customer info */}
          <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-xs text-gray-600">
            <div className="flex items-center gap-2"><Phone size={11} className="text-gray-400 shrink-0" />{customer.phone}</div>
            {customer.address && <div className="flex items-center gap-2"><MapPin size={11} className="text-gray-400 shrink-0" />{customer.address}</div>}
            {customer.occupation && (
              <div className="flex items-center gap-2">
                <Briefcase size={11} className="text-gray-400 shrink-0" />
                {customer.occupation}{customer.employer ? ` — ${customer.employer}` : ''}
              </div>
            )}
          </div>

          {/* Photo */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Photo Evidence</p>
            <PhotoCapture isOnline={isOnline} previewUrl={photo?.previewUrl ?? null} onCapture={handleCapture} />
          </div>

          {/* Checklist */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Checklist</p>
            <CheckRow label="Address visited & confirmed"  value={checks.addressVerified}     onChange={set('addressVerified')} />
            <CheckRow label="Employer / job verified"      value={checks.employerVerified}    onChange={set('employerVerified')} />
            <CheckRow label="Guarantor 1 reachable"        value={checks.guarantor1Reachable} onChange={set('guarantor1Reachable')} />
            <CheckRow label="Guarantor 2 reachable"        value={checks.guarantor2Reachable} onChange={set('guarantor2Reachable')} />
          </div>

          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            placeholder="Notes (observations, concerns…)"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />

          <div className="flex gap-2">
            <button onClick={() => setDecision(decision === 'REJECTED' ? null : 'REJECTED')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium border-2 transition ${decision === 'REJECTED' ? 'bg-red-600 border-red-600 text-white' : 'border-red-200 text-red-600 hover:bg-red-50'}`}>
              <XCircle size={15} /> Reject
            </button>
            <button onClick={() => setDecision(decision === 'APPROVED' ? null : 'APPROVED')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium border-2 transition ${decision === 'APPROVED' ? 'bg-green-600 border-green-600 text-white' : 'border-green-200 text-green-600 hover:bg-green-50'}`}>
              <CheckCircle2 size={15} /> Approve
            </button>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 shrink-0 space-y-2">
          {!hasPhoto  && <p className="text-[11px] text-amber-600 text-center">Photo evidence required</p>}
          {!gpsReady && gps.status !== 'denied' && <p className="text-[11px] text-amber-600 text-center">Waiting for GPS lock…</p>}

          {isOnline ? (
            <button onClick={() => mutate()} disabled={!canSubmit || busy}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2">
              {busy ? <><Loader2 size={15} className="animate-spin" />Submitting…</> : 'Submit Verification'}
            </button>
          ) : (
            <button onClick={handleOfflineSave} disabled={!canSubmit || busy}
              className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2">
              {busy
                ? <><Loader2 size={15} className="animate-spin" />Saving…</>
                : <><Clock size={15} /> Save Offline — Sync Later</>
              }
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerificationQueuePage() {
  const [active, setActive] = useState<QueueCustomer | null>(null);
  const qc = useQueryClient();

  const { isOnline, pendingCount, syncing, refreshCount, sync } = useOfflineSync(
    () => qc.invalidateQueries({ queryKey: ['my-queue'] }),
  );

  const { data: onlineQueue, isLoading } = useQuery({
    queryKey: ['my-queue'],
    queryFn:  verificationsApi.myQueue,
    enabled:  isOnline,
  });

  const [offlineQueue, setOfflineQueue] = useState<QueueCustomer[]>([]);

  // Cache to IndexedDB whenever we get fresh data
  useEffect(() => {
    if (onlineQueue?.data) {
      avoDb.saveQueue(onlineQueue.data).catch(() => {});
    }
  }, [onlineQueue]);

  // Load from IndexedDB when offline
  useEffect(() => {
    if (!isOnline) {
      avoDb.getQueue().then(setOfflineQueue).catch(() => {});
    }
  }, [isOnline]);

  const queue   = isOnline ? (onlineQueue?.data ?? []) : offlineQueue;
  const pending = queue.filter((c) => c.verificationStatus === 'UNDER_REVIEW');
  const done    = queue.filter((c) => c.verificationStatus !== 'UNDER_REVIEW');

  return (
    <div className="px-4 py-5 sm:p-6 max-w-2xl mx-auto">

      {/* Header */}
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Verifications</h1>
          <p className="text-sm text-gray-400 mt-0.5">{pending.length} pending · {done.length} completed</p>
        </div>
        {pendingCount > 0 && (
          <button onClick={sync} disabled={!isOnline || syncing}
            className="flex items-center gap-1.5 text-xs bg-orange-100 text-orange-700 hover:bg-orange-200 disabled:opacity-50 px-3 py-1.5 rounded-xl font-semibold transition">
            {syncing
              ? <><Loader2 size={12} className="animate-spin" />Syncing…</>
              : <><RefreshCw size={12} />{pendingCount} pending sync</>
            }
          </button>
        )}
      </div>

      {/* Offline banner */}
      {!isOnline && (
        <div className="mb-4 flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
          <WifiOff size={14} className="text-orange-600 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-orange-700">You're offline</p>
            <p className="text-[11px] text-orange-600">
              {offlineQueue.length > 0
                ? 'Showing cached queue. Verifications saved here will sync automatically when connected.'
                : 'No cached data. Connect once to load your queue.'}
            </p>
          </div>
        </div>
      )}

      {isLoading && isOnline ? (
        <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
      ) : pending.length === 0 && done.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <ClipboardCheck size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">{isOnline ? 'No customers assigned for verification' : 'No cached queue — connect to load'}</p>
        </div>
      ) : (
        <div className="space-y-5">
          {pending.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pending</p>
              {pending.map((c) => (
                <div key={c.id} className="bg-white border border-amber-100 rounded-2xl p-4 flex items-start justify-between shadow-sm gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                    <p className="text-xs text-gray-400">{c.phone} · {c.cnicMasked}</p>
                    {c.address    && <p className="text-xs text-gray-500 mt-0.5 truncate">{c.address}</p>}
                    {c.occupation && <p className="text-xs text-gray-400 mt-0.5">{c.occupation}{c.employer ? ` @ ${c.employer}` : ''}</p>}
                  </div>
                  <button onClick={() => setActive(c)}
                    className="shrink-0 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-700 transition">
                    Verify
                  </button>
                </div>
              ))}
            </div>
          )}

          {done.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Completed</p>
              {done.map((c) => {
                const s = VSTATUS[c.verificationStatus];
                return (
                  <div key={c.id} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center justify-between shadow-sm opacity-70">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                      <p className="text-xs text-gray-400">{c.phone} · {c.cnicMasked}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${s.cls}`}>{s.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {active && (
        <VerifyModal
          customer={active}
          isOnline={isOnline}
          onClose={() => setActive(null)}
          onSaved={() => { setActive(null); refreshCount(); }}
        />
      )}
    </div>
  );
}
