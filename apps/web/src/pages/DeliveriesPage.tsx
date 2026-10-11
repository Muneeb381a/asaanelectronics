import { PageHeader, shell } from '../components/ui/Page';
import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Truck, Printer, Check, X, Ban, AlertTriangle, PenLine, Upload, RotateCcw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { deliveriesApi, type Delivery, type DeliveryStatus } from '../api/deliveries.api.ts';
import { sellersApi } from '../api/sellers.api.ts';
import { openDeliveryChallan } from '../utils/challan.ts';
import { getErrorMessage } from '../utils/error.ts';
import ConfirmDialog from '../components/ui/ConfirmDialog.tsx';
import SignaturePad, { type SignaturePadHandle } from '../components/SignaturePad.tsx';

const STATUS_STYLES: Record<DeliveryStatus, { label: string; cls: string }> = {
  PENDING:          { label: 'Pending',          cls: 'bg-slate-100 text-slate-600' },
  OUT_FOR_DELIVERY: { label: 'Out for Delivery',  cls: 'bg-blue-100 text-blue-700' },
  DELIVERED:        { label: 'Delivered',         cls: 'bg-emerald-100 text-emerald-700' },
  REJECTED:         { label: 'Rejected',          cls: 'bg-red-100 text-red-700' },
  CANCELLED:        { label: 'Cancelled',         cls: 'bg-gray-100 text-gray-400' },
};

const TABS: { value: DeliveryStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

/* ══════════════════════════════════════════════════════════
   MARK DELIVERED MODAL — draw signature live, or upload a photo
   of a signed paper slip. At least one proof is required.
══════════════════════════════════════════════════════════ */
function MarkDeliveredModal({ delivery, onClose }: { delivery: Delivery; onClose: () => void }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<'draw' | 'upload'>('draw');
  const [conditionNote, setConditionNote] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const padRef = useRef<SignaturePadHandle>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const mut = useMutation({
    mutationFn: async () => {
      let signatureUrl: string | undefined;
      let proofPhotoUrl: string | undefined;

      if (mode === 'draw') {
        if (padRef.current?.isEmpty()) throw new Error('Pehle signature draw karein');
        const blob = await padRef.current?.toBlob();
        if (!blob) throw new Error('Signature capture failed');
        signatureUrl = await deliveriesApi.uploadProof(blob, 'signature.png');
      } else {
        if (!photoFile) throw new Error('Pehle photo chunein');
        proofPhotoUrl = await deliveriesApi.uploadProof(photoFile, photoFile.name);
      }

      return deliveriesApi.markDelivered(delivery.id, { signatureUrl, proofPhotoUrl, conditionNote: conditionNote.trim() || undefined });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['deliveries'] });
      toast.success('Delivery mark ho gayi — proof save ho gaya');
      onClose();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
    onSettled: () => setSubmitting(false),
  });

  const submit = () => { setSubmitting(true); mut.mutate(); };
  const valid = mode === 'draw' ? true : !!photoFile;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="border-b border-gray-100 flex items-center justify-between px-5 py-4">
          <div>
            <p className="text-gray-900 font-semibold text-sm">Delivery Confirm Karo</p>
            <p className="text-xs text-slate-400 mt-0.5">{delivery.slipNumber} · {delivery.customerName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition"><X size={16} /></button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-2 bg-slate-100 rounded-xl p-1">
            <button onClick={() => setMode('draw')}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition ${mode === 'draw' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
              <PenLine size={12} /> Sign Karao
            </button>
            <button onClick={() => setMode('upload')}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition ${mode === 'upload' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
              <Upload size={12} /> Photo Upload
            </button>
          </div>

          {mode === 'draw' ? (
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Customer Yahan Sign Kare</label>
              <SignaturePad ref={padRef} height={150} />
              <button onClick={() => padRef.current?.clear()} className="mt-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-700">Clear</button>
            </div>
          ) : (
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Signed Paper Slip Ki Photo</label>
              {photoFile ? (
                <div className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2.5">
                  <span className="text-xs text-slate-600 truncate">{photoFile.name}</span>
                  <button onClick={() => setPhotoFile(null)} className="text-slate-400 hover:text-red-500"><X size={14} /></button>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()}
                  className="w-full h-24 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center gap-1.5 text-slate-400 hover:border-blue-400 hover:text-blue-500 transition">
                  <Upload size={18} /> <span className="text-xs">Photo Chuno</span>
                </button>
              )}
              <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.webp,.heic,.heif" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) setPhotoFile(f); e.target.value = ''; }} />
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Condition Note <span className="font-normal text-slate-400">(optional)</span></label>
            <input value={conditionNote} onChange={(e) => setConditionNote(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 transition"
              placeholder="e.g. box thori si dented, customer ne accept kar liya" />
          </div>
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="flex-1 border border-slate-200 rounded-xl py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition">Wapas</button>
          <button onClick={submit} disabled={!valid || submitting}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-40 transition flex items-center justify-center gap-1.5">
            <Check size={14} /> {submitting ? 'Save ho raha…' : 'Delivered Confirm Karo'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MARK REJECTED MODAL
══════════════════════════════════════════════════════════ */
function MarkRejectedModal({ delivery, onClose }: { delivery: Delivery; onClose: () => void }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');

  const mut = useMutation({
    mutationFn: () => deliveriesApi.markRejected(delivery.id, { rejectionReason: reason.trim() }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['deliveries'] });
      toast.success('Delivery rejected mark ho gayi');
      onClose();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="border-b border-gray-100 flex items-center justify-between px-5 py-4">
          <p className="text-gray-900 font-semibold text-sm">Delivery Reject Karo</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
            <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-700">Stock/unit "sold" hi rahega — ye yahan automatically reverse nahi hota. Baad mein Deliveries board se "Stock Fix Ho Gaya" mark karein jab aap sale cancel/adjust kar lein.</p>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Reason *</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} autoFocus
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-red-400 transition"
              placeholder="e.g. customer ne wrong item bataya, ghar pe nahi mila, etc." />
          </div>
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="flex-1 border border-slate-200 rounded-xl py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition">Wapas</button>
          <button onClick={() => mut.mutate()} disabled={!reason.trim() || mut.isPending}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-40 transition">
            {mut.isPending ? 'Save ho raha…' : 'Reject Karo'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   DELIVERY ROW
══════════════════════════════════════════════════════════ */
function DeliveryRow({ delivery, index, shop }: { delivery: Delivery; index: number; shop: { shopName: string; phone: string; address?: string | null; logoUrl?: string | null; theme?: string | null } }) {
  const qc = useQueryClient();
  const [marking, setMarking] = useState<'delivered' | 'rejected' | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const dispatchMut = useMutation({
    mutationFn: () => deliveriesApi.dispatch(delivery.id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['deliveries'] }); toast.success('Dispatch ho gaya'); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const cancelMut = useMutation({
    mutationFn: () => deliveriesApi.cancel(delivery.id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['deliveries'] }); toast.success('Delivery cancel ho gayi'); setConfirmCancel(false); },
    onError: (e) => { toast.error(getErrorMessage(e)); setConfirmCancel(false); },
  });
  const stockReversedMut = useMutation({
    mutationFn: () => deliveriesApi.markStockReversed(delivery.id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['deliveries'] }); toast.success('Stock fix mark ho gaya'); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const st = STATUS_STYLES[delivery.status];
  const canDispatch = delivery.status === 'PENDING';
  const canAct      = delivery.status === 'PENDING' || delivery.status === 'OUT_FOR_DELIVERY';
  const canCancel   = canAct;

  return (
    <>
      {marking === 'delivered' && <MarkDeliveredModal delivery={delivery} onClose={() => setMarking(null)} />}
      {marking === 'rejected'  && <MarkRejectedModal  delivery={delivery} onClose={() => setMarking(null)} />}

      <div className={`${index > 0 ? 'border-t border-slate-100' : ''} px-4 py-3 hover:bg-slate-50/60 transition`}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <Truck size={15} className="text-blue-500" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-slate-900 truncate">{delivery.customerName}</p>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${st.cls}`}>{st.label}</span>
              {delivery.status === 'REJECTED' && !delivery.stockReversed && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 bg-amber-100 text-amber-700">Stock not fixed</span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {delivery.productName}{delivery.quantity > 1 ? ` ×${delivery.quantity}` : ''} · {delivery.slipNumber}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5 truncate">
              Driver: {delivery.driverName}{delivery.driverPhone ? ` · ${delivery.driverPhone}` : ''}
              {delivery.scheduledDate ? ` · ${delivery.scheduledDate}` : ''}
            </p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button title="Print slip"
              onClick={() => void openDeliveryChallan({
                shop, slipNumber: delivery.slipNumber, saleType: delivery.saleType,
                customerName: delivery.customerName, customerPhone: delivery.customerPhone,
                deliveryAddress: delivery.deliveryAddress, productName: delivery.productName,
                quantity: delivery.quantity, serialSnapshot: delivery.serialSnapshot,
                driverName: delivery.driverName, driverPhone: delivery.driverPhone,
                scheduledDate: delivery.scheduledDate, createdAt: delivery.createdAt,
                signatureUrl: delivery.signatureUrl, conditionNote: delivery.conditionNote,
              })}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition">
              <Printer size={14} />
            </button>

            {canDispatch && (
              <button title="Dispatch" onClick={() => dispatchMut.mutate()} disabled={dispatchMut.isPending}
                className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition">
                <Truck size={11} /> Dispatch
              </button>
            )}
            {canAct && (
              <>
                <button title="Mark delivered" onClick={() => setMarking('delivered')}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition">
                  <Check size={11} /> Delivered
                </button>
                <button title="Mark rejected" onClick={() => setMarking('rejected')}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                  <Ban size={14} />
                </button>
              </>
            )}
            {delivery.status === 'REJECTED' && !delivery.stockReversed && (
              <button title="Mark stock fixed" onClick={() => stockReversedMut.mutate()} disabled={stockReversedMut.isPending}
                className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition">
                <RotateCcw size={11} /> Stock Fix Ho Gaya
              </button>
            )}
            {canCancel && (
              <button title="Cancel" onClick={() => setConfirmCancel(true)}
                className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                <X size={14} />
              </button>
            )}
            <ConfirmDialog
              open={confirmCancel}
              title="Ye delivery cancel karein?"
              description="Slip cancelled mark ho jayegi. Dobara zaroorat ho to isi sale k liye nayi delivery bana sakte hain."
              confirmLabel="Haan, cancel karo"
              cancelLabel="Nahi"
              isPending={cancelMut.isPending}
              onConfirm={() => cancelMut.mutate()}
              onCancel={() => setConfirmCancel(false)}
            />
          </div>
        </div>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════ */
export default function DeliveriesPage() {
  const [tab, setTab] = useState<DeliveryStatus | 'ALL'>('ALL');

  const { data: seller } = useQuery({ queryKey: ['seller-me'], queryFn: sellersApi.getMe, staleTime: 10 * 60_000, retry: false });

  const { data: deliveries = [], isLoading } = useQuery({
    queryKey: ['deliveries', tab],
    queryFn: () => deliveriesApi.list(tab === 'ALL' ? undefined : tab),
    staleTime: 60_000,
  });

  const pendingCount   = deliveries.filter((d) => d.status === 'PENDING').length;
  const outCount       = deliveries.filter((d) => d.status === 'OUT_FOR_DELIVERY').length;
  const todayStr        = new Date().toISOString().slice(0, 10);
  const deliveredToday  = deliveries.filter((d) => d.status === 'DELIVERED' && d.deliveredAt?.slice(0, 10) === todayStr).length;
  const unresolvedRejected = deliveries.filter((d) => d.status === 'REJECTED' && !d.stockReversed).length;

  const shop = {
    shopName: seller?.shopName ?? '', phone: seller?.phone ?? '', address: seller?.address,
    logoUrl: seller?.logoUrl ?? null, theme: seller?.settings?.theme ?? null,
    receiptStyle: seller?.settings?.receiptStyle ?? null,
  };

  return (
    <div className="bg-canvas">
      <div className={`${shell.wide} !pb-0`}>
        <PageHeader title="Deliveries"
          subtitle={<>{deliveries.length} slip{deliveries.length !== 1 ? 's' : ''}{unresolvedRejected > 0 && <span className="text-amber-600 font-semibold"> · {unresolvedRejected} rejected, stock not fixed</span>}</>} />
      </div>

      {/* KPI strip */}
      <div className="bg-white border-y border-gray-200 mt-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100 max-w-5xl mx-auto">
          {[
            { label: 'Pending',      val: pendingCount,      dot: 'bg-slate-400',   vCls: 'text-slate-900' },
            { label: 'Out for Delivery', val: outCount,      dot: 'bg-blue-500',    vCls: 'text-blue-700' },
            { label: 'Delivered Today',  val: deliveredToday, dot: 'bg-emerald-500', vCls: 'text-emerald-700' },
            { label: 'Rejected (Unresolved)', val: unresolvedRejected, dot: unresolvedRejected > 0 ? 'bg-amber-500' : 'bg-slate-300', vCls: unresolvedRejected > 0 ? 'text-amber-600' : 'text-slate-300' },
          ].map((t, i) => (
            <div key={i} className="px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1">
                <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.label}</p>
              </div>
              <p className={`text-2xl font-bold tabular-nums ${t.vCls}`}>{t.val}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-3 sm:px-5 py-4 max-w-5xl mx-auto space-y-4">
        {/* Status tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {TABS.map((t) => (
            <button key={t.value} onClick={() => setTab(t.value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${tab === t.value ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="divide-y divide-slate-50">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                  <div className="w-9 h-9 bg-slate-100 rounded-xl" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-slate-100 rounded w-32" />
                    <div className="h-2 bg-slate-100 rounded w-48" />
                  </div>
                </div>
              ))}
            </div>
          ) : deliveries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-3">
                <Truck size={28} className="text-slate-300" />
              </div>
              <p className="text-sm font-bold text-slate-600">Koi delivery nahi</p>
              <p className="text-xs text-slate-400 mt-1">Cash Sales ya Installments page se "Delivery" button se slip banayein.</p>
            </div>
          ) : (
            <div>
              {deliveries.map((d, i) => <DeliveryRow key={d.id} delivery={d} index={i} shop={shop} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
