import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  RotateCcw, Plus, X, CheckCircle, XCircle, Clock, PackageCheck,
  AlertTriangle, RefreshCw, ShieldCheck, Loader2, Search,
} from 'lucide-react';
import { returnsApi, type Return, type ReturnType, type ReturnReason, type ReturnCondition, type ResolutionType } from '../api/returns.api.ts';
import { getErrorMessage } from '../utils/error.ts';
import { customersApi } from '../api/customers.api.ts';
import { productsApi } from '../api/products.api.ts';
import { useAuthStore } from '../store/auth.store.ts';

// ── Config maps ────────────────────────────────────────────────────────────────
const TYPE_LABELS: Record<ReturnType, string> = {
  RETURN:               'Return',
  EXCHANGE:             'Exchange',
  WARRANTY_REPLACEMENT: 'Warranty',
};
const TYPE_COLORS: Record<ReturnType, string> = {
  RETURN:               'bg-red-50 text-red-600 border-red-200',
  EXCHANGE:             'bg-blue-50 text-blue-600 border-blue-200',
  WARRANTY_REPLACEMENT: 'bg-violet-50 text-violet-600 border-violet-200',
};

const REASON_LABELS: Record<ReturnReason, string> = {
  DEFECTIVE:        'Defective',
  DAMAGED_IN_USE:   'Damaged in Use',
  WRONG_ITEM:       'Wrong Item',
  CUSTOMER_REQUEST: 'Customer Request',
  WARRANTY_CLAIM:   'Warranty Claim',
  OTHER:            'Other',
};

const CONDITION_CONFIG: Record<ReturnCondition, { label: string; color: string }> = {
  GOOD:     { label: 'Good',     color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  DAMAGED:  { label: 'Damaged',  color: 'bg-amber-50  text-amber-600  border-amber-200'  },
  UNUSABLE: { label: 'Unusable', color: 'bg-red-50    text-red-600    border-red-200'    },
};

const STATUS_CONFIG = {
  PENDING:   { label: 'Pending',   icon: Clock,        color: 'bg-amber-50  text-amber-600  border-amber-200'  },
  APPROVED:  { label: 'Approved',  icon: CheckCircle,  color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  REJECTED:  { label: 'Rejected',  icon: XCircle,      color: 'bg-red-50    text-red-600    border-red-200'    },
  COMPLETED: { label: 'Completed', icon: PackageCheck, color: 'bg-blue-50   text-blue-600   border-blue-200'  },
};

const RESOLUTION_CONFIG: Record<ResolutionType, { label: string; icon: React.ReactNode }> = {
  RESALE:           { label: 'Back to Resale',      icon: <RefreshCw size={12} /> },
  DAMAGED_WRITE_OFF:{ label: 'Written Off',         icon: <AlertTriangle size={12} /> },
  REPLACEMENT_SENT: { label: 'Replacement Sent',    icon: <PackageCheck size={12} /> },
};

const STATUS_TABS = ['ALL', 'PENDING', 'COMPLETED', 'REJECTED'] as const;

const inp = 'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition bg-white';
const sel = `${inp} cursor-pointer`;

// ── Pill button group ─────────────────────────────────────────────────────────
function Pills<T extends string>({ options, value, onChange, colorMap }: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  colorMap?: Record<T, string>;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
            value === o.value
              ? (colorMap?.[o.value] ?? 'bg-blue-600 text-white border-blue-600')
              : 'border-gray-200 text-gray-500 hover:border-gray-300'
          }`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Create modal ──────────────────────────────────────────────────────────────
function CreateModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    customerId: '',
    productId: '',
    installmentId: '',
    type: 'RETURN' as ReturnType,
    reason: 'DEFECTIVE' as ReturnReason,
    condition: 'DAMAGED' as ReturnCondition,
    notes: '',
  });
  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm((p) => ({ ...p, [k]: v }));

  const { data: custData } = useQuery({
    queryKey: ['customers-select'],
    queryFn: () => customersApi.list({ limit: 200 }),
    staleTime: 60_000,
  });
  const { data: prodData } = useQuery({
    queryKey: ['products-select'],
    queryFn: () => productsApi.list({ limit: 200 }),
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: () => returnsApi.create({
      customerId:    form.customerId,
      productId:     form.productId,
      installmentId: form.installmentId || undefined,
      type:          form.type,
      reason:        form.reason,
      condition:     form.condition,
      notes:         form.notes || undefined,
    }),
    onSuccess: () => { toast.success('Return request created'); onSuccess(); onClose(); },
    onError:   (e) => toast.error(getErrorMessage(e)),
  });

  const valid = form.customerId && form.productId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-gray-900">New Return / Exchange</h2>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 transition"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          {/* Customer */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Customer</label>
            <select value={form.customerId} onChange={(e) => set('customerId', e.target.value)} className={sel}>
              <option value="">Select customer…</option>
              {custData?.data.map((c) => (
                <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>
              ))}
            </select>
          </div>

          {/* Product */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Returned Product</label>
            <select value={form.productId} onChange={(e) => set('productId', e.target.value)} className={sel}>
              <option value="">Select product…</option>
              {prodData?.data.map((p) => (
                <option key={p.id} value={p.id}>{p.name}{p.brand ? ` — ${p.brand}` : ''}{p.model ? ` ${p.model}` : ''}</option>
              ))}
            </select>
          </div>

          {/* Return type */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Request Type</label>
            <Pills
              options={[
                { value: 'RETURN' as ReturnType,               label: 'Return' },
                { value: 'EXCHANGE' as ReturnType,             label: 'Exchange' },
                { value: 'WARRANTY_REPLACEMENT' as ReturnType, label: 'Warranty' },
              ]}
              value={form.type}
              onChange={(v) => set('type', v)}
            />
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Reason</label>
            <select value={form.reason} onChange={(e) => set('reason', e.target.value as ReturnReason)} className={sel}>
              {(Object.entries(REASON_LABELS) as [ReturnReason, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          {/* Condition */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Product Condition</label>
            <Pills
              options={[
                { value: 'GOOD' as ReturnCondition,     label: 'Good' },
                { value: 'DAMAGED' as ReturnCondition,  label: 'Damaged' },
                { value: 'UNUSABLE' as ReturnCondition, label: 'Unusable' },
              ]}
              value={form.condition}
              onChange={(v) => set('condition', v)}
              colorMap={{
                GOOD:     'bg-emerald-500 text-white border-emerald-500',
                DAMAGED:  'bg-amber-500  text-white border-amber-500',
                UNUSABLE: 'bg-red-500    text-white border-red-500',
              }}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Notes (optional)</label>
            <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)}
              rows={2} placeholder="Describe the issue…"
              className={`${inp} resize-none`} />
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose}
            className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">
            Cancel
          </button>
          <button onClick={() => mutation.mutate()} disabled={!valid || mutation.isPending}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition disabled:opacity-50">
            {mutation.isPending ? <><Loader2 size={14} className='animate-spin' /> Submitting…</> : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Resolve modal ─────────────────────────────────────────────────────────────
function ResolveModal({ ret, onClose, onSuccess }: { ret: Return; onClose: () => void; onSuccess: () => void }) {
  const [status,       setStatus]       = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [resolution,   setResolution]   = useState<ResolutionType>('RESALE');
  const [replProdId,   setReplProdId]   = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [notes,        setNotes]        = useState('');

  const { data: prodData } = useQuery({
    queryKey: ['products-select'],
    queryFn: () => productsApi.list({ limit: 200 }),
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: () => returnsApi.resolve(ret.id, {
      status,
      ...(status === 'APPROVED' && {
        resolutionType:       resolution,
        replacementProductId: resolution === 'REPLACEMENT_SENT' ? replProdId : undefined,
        refundAmount:         refundAmount ? Number(refundAmount) : undefined,
      }),
      notes: notes || undefined,
    }),
    onSuccess: () => { toast.success(`Return ${status === 'APPROVED' ? 'approved' : 'rejected'}`); onSuccess(); onClose(); },
    onError:   (e) => toast.error(getErrorMessage(e)),
  });

  const valid = status === 'REJECTED' || (status === 'APPROVED' && (resolution !== 'REPLACEMENT_SENT' || replProdId));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-900">Resolve Return</h2>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 transition"><X size={18} /></button>
        </div>

        {/* Return summary */}
        <div className="p-3 bg-gray-50 rounded-xl mb-4 text-xs text-gray-600 space-y-1">
          <p><span className="font-medium">{ret.customerName}</span> · {ret.productName}</p>
          <p>Reason: {REASON_LABELS[ret.reason]} · Condition: {CONDITION_CONFIG[ret.condition].label}</p>
        </div>

        <div className="space-y-4">
          {/* Decision */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Decision</label>
            <Pills
              options={[
                { value: 'APPROVED' as const, label: 'Approve' },
                { value: 'REJECTED' as const, label: 'Reject'  },
              ]}
              value={status}
              onChange={setStatus}
              colorMap={{ APPROVED: 'bg-emerald-500 text-white border-emerald-500', REJECTED: 'bg-red-500 text-white border-red-500' }}
            />
          </div>

          {status === 'APPROVED' && (
            <>
              {/* Resolution type */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Resolution</label>
                <div className="space-y-1.5">
                  {([
                    { v: 'RESALE'            as ResolutionType, label: 'Add back to resale inventory',  icon: <RefreshCw size={13} className="text-emerald-500" /> },
                    { v: 'DAMAGED_WRITE_OFF' as ResolutionType, label: 'Write off (damaged / unusable)', icon: <AlertTriangle size={13} className="text-amber-500" /> },
                    { v: 'REPLACEMENT_SENT'  as ResolutionType, label: 'Send replacement product',       icon: <PackageCheck size={13} className="text-blue-500" /> },
                  ] as const).map(({ v, label, icon }) => (
                    <button key={v} type="button" onClick={() => setResolution(v)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm transition text-left ${
                        resolution === v ? 'border-blue-400 bg-blue-50 text-blue-800' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}>
                      {icon}
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Replacement product picker */}
              {resolution === 'REPLACEMENT_SENT' && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Replacement Product</label>
                  <select value={replProdId} onChange={(e) => setReplProdId(e.target.value)} className={sel}>
                    <option value="">Select product…</option>
                    {prodData?.data.filter((p) => p.stock > 0).map((p) => (
                      <option key={p.id} value={p.id}>{p.name}{p.brand ? ` — ${p.brand}` : ''} ({p.stock} in stock)</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Refund amount */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Refund Amount (optional)</label>
                <input type="number" min="0" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)}
                  placeholder="PKR 0" className={inp} />
              </div>
            </>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              placeholder="Remarks…" className={`${inp} resize-none`} />
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose}
            className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">
            Cancel
          </button>
          <button onClick={() => mutation.mutate()} disabled={!valid || mutation.isPending}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition disabled:opacity-50">
            {mutation.isPending ? <><Loader2 size={14} className='animate-spin' /> Saving…</> : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Return card ───────────────────────────────────────────────────────────────
function ReturnCard({ ret, isOwner, onResolve }: { ret: Return; isOwner: boolean; onResolve: () => void }) {
  const status    = STATUS_CONFIG[ret.status];
  const StatusIcon = status.icon;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${TYPE_COLORS[ret.type]}`}>
              {TYPE_LABELS[ret.type]}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${CONDITION_CONFIG[ret.condition].color}`}>
              {CONDITION_CONFIG[ret.condition].label}
            </span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${status.color}`}>
              <StatusIcon size={10} />
              {status.label}
            </span>
          </div>

          <p className="text-sm font-semibold text-gray-900">{ret.customerName}</p>
          <p className="text-xs text-gray-500 mt-0.5">{ret.productName}</p>
          <p className="text-xs text-gray-400 mt-1">
            {REASON_LABELS[ret.reason]}
            {ret.notes && <span className="ml-1">· {ret.notes}</span>}
          </p>
        </div>

        <div className="text-right shrink-0">
          <p className="text-xs text-gray-400">
            {new Date(ret.createdAt).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
          {ret.refundAmount && (
            <p className="text-xs font-semibold text-emerald-600 mt-0.5">
              Refund PKR {Number(ret.refundAmount).toLocaleString()}
            </p>
          )}
          {ret.resolutionType && (
            <div className="flex items-center justify-end gap-1 mt-1 text-xs text-gray-500">
              {RESOLUTION_CONFIG[ret.resolutionType].icon}
              {RESOLUTION_CONFIG[ret.resolutionType].label}
            </div>
          )}
        </div>
      </div>

      {ret.status === 'PENDING' && isOwner && (
        <div className="mt-3 pt-3 border-t border-gray-50">
          <button onClick={onResolve}
            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition">
            <ShieldCheck size={13} />
            Resolve this request
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ReturnsPage() {
  const { user }      = useAuthStore();
  const isOwner       = user?.role === 'SELLER_OWNER';
  const qc            = useQueryClient();
  const [tab,         setTab]       = useState<typeof STATUS_TABS[number]>('ALL');
  const [showCreate,  setShowCreate] = useState(false);
  const [resolving,   setResolving]  = useState<Return | null>(null);
  const [page,        setPage]       = useState(1);
  const [search,      setSearch]     = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['returns', tab, page, search],
    queryFn: () => returnsApi.list({ page, limit: 20, status: tab === 'ALL' ? undefined : tab, search: search || undefined }),
    staleTime: 30_000,
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['returns'] });

  const rows  = data?.data   ?? [];
  const total = data?.total  ?? 0;
  const pages = Math.max(1, Math.ceil(total / 20));

  const pendingCount = rows.filter((r) => r.status === 'PENDING').length;

  return (
    <div className="px-4 py-5 sm:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <RotateCcw size={20} className="text-gray-400" />
            Returns & Exchanges
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Product returns, damage reports, and replacement workflow
          </p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition shadow-sm shadow-blue-200">
          <Plus size={15} />
          New Request
        </button>
      </div>

      {/* Status tabs + search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex items-center gap-1 overflow-x-auto">
          {STATUS_TABS.map((t) => (
            <button key={t} onClick={() => { setTab(t); setPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                tab === t ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}>
              {t === 'ALL' ? 'All' : STATUS_CONFIG[t].label}
              {t === 'PENDING' && pendingCount > 0 && tab !== 'PENDING' && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-amber-500 text-white text-[10px] rounded-full">{pendingCount}</span>
              )}
            </button>
          ))}
        </div>
        <div className="relative sm:ml-auto sm:w-56">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search customer / product…"
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition bg-white"
          />
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-gray-200 rounded-2xl">
          <RotateCcw size={28} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">No returns found</p>
          <p className="text-xs text-gray-400 mt-1">Create a return request to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((ret) => (
            <ReturnCard
              key={ret.id}
              ret={ret}
              isOwner={isOwner}
              onResolve={() => setResolving(ret)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-xl disabled:opacity-40 hover:bg-gray-50 transition">
            Prev
          </button>
          <span className="text-xs text-gray-500">{page} / {pages}</span>
          <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-xl disabled:opacity-40 hover:bg-gray-50 transition">
            Next
          </button>
        </div>
      )}

      {/* Modals */}
      {showCreate  && <CreateModal  onClose={() => setShowCreate(false)}  onSuccess={invalidate} />}
      {resolving   && <ResolveModal ret={resolving} onClose={() => setResolving(null)} onSuccess={invalidate} />}
    </div>
  );
}
