import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, Plus, X, Trash2, Pencil, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { tradeInsApi, type TradeIn } from '../api/tradeIns.api.ts';
import { getErrorMessage } from '../utils/error.ts';

function pkr(v: string | number) {
  return 'PKR ' + Number(v).toLocaleString('en-PK', { maximumFractionDigits: 0 });
}


const CONDITION_LABELS: Record<string, string> = { good: 'Good', fair: 'Fair', poor: 'Poor' };
const CONDITION_STYLES: Record<string, string> = {
  good: 'bg-green-100 text-green-700',
  fair: 'bg-amber-100 text-amber-700',
  poor: 'bg-red-100 text-red-700',
};
const STATUS_LABELS: Record<string, string> = { in_stock: 'In Stock', sold: 'Sold', disposed: 'Disposed' };
const STATUS_STYLES: Record<string, string> = {
  in_stock: 'bg-blue-100 text-blue-700',
  sold:     'bg-green-100 text-green-700',
  disposed: 'bg-gray-100 text-gray-500',
};

// ── Add / Edit Modal ─────────────────────────────────────────────────────────
function TradeInModal({ item, onClose }: { item?: TradeIn; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    deviceName:    item?.deviceName    ?? '',
    brand:         item?.brand         ?? '',
    model:         item?.model         ?? '',
    imei:          item?.imei          ?? '',
    color:         item?.color         ?? '',
    storageGb:     item?.storageGb != null ? String(item.storageGb) : '',
    condition:     item?.condition     ?? 'good',
    assessedValue: item?.assessedValue ?? '',
    notes:         item?.notes         ?? '',
  });

  const mut = useMutation({
    mutationFn: () => item
      ? tradeInsApi.update(item.id, {
          condition:     form.condition as 'good' | 'fair' | 'poor',
          assessedValue: form.assessedValue ? Number(form.assessedValue) : undefined,
          notes:         form.notes || undefined,
        })
      : tradeInsApi.create({
          deviceName:    form.deviceName,
          brand:         form.brand || undefined,
          model:         form.model || undefined,
          imei:          form.imei || undefined,
          color:         form.color || undefined,
          storageGb:     form.storageGb ? Number(form.storageGb) : undefined,
          condition:     form.condition as 'good' | 'fair' | 'poor',
          assessedValue: Number(form.assessedValue),
          notes:         form.notes || undefined,
        }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['trade-ins'] });
      void qc.invalidateQueries({ queryKey: ['trade-in-stats'] });
      toast.success(item ? 'Trade-in updated' : 'Trade-in recorded');
      onClose();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const field = (label: string, key: keyof typeof form, placeholder?: string, type = 'text') => (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="text-base font-semibold text-gray-900">{item ? 'Edit Trade-In' : 'Record Trade-In'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-3">
          {!item && field('Device Name *', 'deviceName', 'e.g. Samsung A54')}
          <div className="grid grid-cols-2 gap-3">
            {!item && field('Brand', 'brand', 'Samsung')}
            {!item && field('Model', 'model', 'A54')}
          </div>
          {!item && field('IMEI', 'imei', '15-digit IMEI')}
          <div className="grid grid-cols-2 gap-3">
            {!item && field('Color', 'color', 'Black')}
            {!item && field('Storage (GB)', 'storageGb', '128', 'number')}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Condition *</label>
            <select
              value={form.condition}
              onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value as 'good' | 'fair' | 'poor' }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="poor">Poor</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Assessed Value (PKR) *</label>
            <input
              type="number"
              value={form.assessedValue}
              onChange={(e) => setForm((f) => ({ ...f, assessedValue: e.target.value }))}
              placeholder="0"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Optional notes..."
            />
          </div>
        </div>
        <div className="px-6 pb-5 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-xl border border-gray-200 transition">
            Cancel
          </button>
          <button
            onClick={() => mut.mutate()}
            disabled={mut.isPending || (!item && !form.deviceName) || !form.assessedValue}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
          >
            {mut.isPending ? 'Saving…' : item ? 'Update' : 'Add Trade-In'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sell / Update Status Modal ────────────────────────────────────────────────
function SellModal({ item, onClose }: { item: TradeIn; onClose: () => void }) {
  const qc = useQueryClient();
  const [soldPrice, setSoldPrice] = useState('');

  const mut = useMutation({
    mutationFn: () => tradeInsApi.update(item.id, { status: 'sold', soldPrice: Number(soldPrice) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['trade-ins'] });
      void qc.invalidateQueries({ queryKey: ['trade-in-stats'] });
      toast.success('Marked as sold');
      onClose();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Mark as Sold</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-3">
          <p className="text-sm text-gray-600">{item.deviceName}{item.brand ? ` · ${item.brand}` : ''}</p>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Sale Price (PKR)</label>
            <input
              type="number"
              value={soldPrice}
              onChange={(e) => setSoldPrice(e.target.value)}
              placeholder={item.assessedValue}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="px-6 pb-5 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-xl border border-gray-200 transition">
            Cancel
          </button>
          <button
            onClick={() => mut.mutate()}
            disabled={mut.isPending || !soldPrice}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-xl hover:bg-green-700 transition disabled:opacity-50"
          >
            {mut.isPending ? 'Saving…' : 'Confirm Sale'}
          </button>
        </div>
      </div>
    </div>
  );
}

const STATUS_FILTERS = [
  { label: 'All',      value: '' },
  { label: 'In Stock', value: 'in_stock' },
  { label: 'Sold',     value: 'sold' },
  { label: 'Disposed', value: 'disposed' },
];

export default function TradeInsPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [showAdd,  setShowAdd]  = useState(false);
  const [editItem, setEditItem] = useState<TradeIn | null>(null);
  const [sellItem, setSellItem] = useState<TradeIn | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['trade-ins', statusFilter],
    queryFn: () => tradeInsApi.list({ status: statusFilter || undefined, limit: 100 }),
    staleTime: 30_000,
  });

  const { data: stats } = useQuery({
    queryKey: ['trade-in-stats'],
    queryFn: tradeInsApi.stats,
    staleTime: 30_000,
  });

  const disposeMut = useMutation({
    mutationFn: (id: string) => tradeInsApi.update(id, { status: 'disposed' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['trade-ins'] });
      void qc.invalidateQueries({ queryKey: ['trade-in-stats'] });
      toast.success('Marked as disposed');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => tradeInsApi.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['trade-ins'] });
      void qc.invalidateQueries({ queryKey: ['trade-in-stats'] });
      toast.success('Removed');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const rows = data?.data ?? [];

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ArrowLeftRight size={22} className="text-blue-600" />
            Trade-Ins
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Devices accepted in exchange</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition"
        >
          <Plus size={16} />
          Add Trade-In
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total',    value: stats.total,    sub: pkr(stats.total_assessed) + ' assessed' },
            { label: 'In Stock', value: stats.in_stock, sub: 'available' },
            { label: 'Sold',     value: stats.sold,     sub: pkr(stats.total_sold) + ' earned' },
            { label: 'Disposed', value: stats.disposed, sub: 'written off' },
          ].map(({ label, value, sub }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-500 font-medium">{label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setStatusFilter(value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
              statusFilter === value
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <Package size={32} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No trade-ins found</p>
            <button onClick={() => setShowAdd(true)} className="mt-3 text-xs text-blue-600 hover:underline">
              Record your first trade-in
            </button>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Device</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Customer</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Condition</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Assessed</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Sale Price</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{r.deviceName}</p>
                        <p className="text-xs text-gray-400">{[r.brand, r.model, r.imei].filter(Boolean).join(' · ')}</p>
                      </td>
                      <td className="px-4 py-3">
                        {r.customerName
                          ? <><p className="text-gray-900">{r.customerName}</p><p className="text-xs text-gray-400">{r.customerPhone}</p></>
                          : <span className="text-gray-400">—</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${CONDITION_STYLES[r.condition]}`}>
                          {CONDITION_LABELS[r.condition]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{pkr(r.assessedValue)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{r.soldPrice ? pkr(r.soldPrice) : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_STYLES[r.status]}`}>
                          {STATUS_LABELS[r.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          {r.status === 'in_stock' && (
                            <button
                              onClick={() => setSellItem(r)}
                              className="px-2.5 py-1 text-xs bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition font-medium"
                            >
                              Sell
                            </button>
                          )}
                          {r.status === 'in_stock' && (
                            <button
                              onClick={() => disposeMut.mutate(r.id)}
                              className="px-2.5 py-1 text-xs bg-gray-50 text-gray-500 rounded-lg hover:bg-gray-100 transition"
                            >
                              Dispose
                            </button>
                          )}
                          <button onClick={() => setEditItem(r)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => { if (confirm('Remove this trade-in?')) deleteMut.mutate(r.id); }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-gray-50">
              {rows.map((r) => (
                <div key={r.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900">{r.deviceName}</p>
                      <p className="text-xs text-gray-400">{[r.brand, r.model].filter(Boolean).join(' ')}</p>
                    </div>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full shrink-0 ${STATUS_STYLES[r.status]}`}>
                      {STATUS_LABELS[r.status]}
                    </span>
                  </div>
                  {r.customerName && (
                    <p className="text-xs text-gray-500">{r.customerName} · {r.customerPhone}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${CONDITION_STYLES[r.condition]}`}>{CONDITION_LABELS[r.condition]}</span>
                      <span className="text-xs text-gray-600 font-medium">{pkr(r.assessedValue)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {r.status === 'in_stock' && (
                        <button onClick={() => setSellItem(r)} className="px-2.5 py-1 text-xs bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition font-medium">
                          Sell
                        </button>
                      )}
                      <button onClick={() => setEditItem(r)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg transition">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => { if (confirm('Remove?')) deleteMut.mutate(r.id); }} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg transition">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {showAdd   && <TradeInModal onClose={() => setShowAdd(false)} />}
      {editItem  && <TradeInModal item={editItem} onClose={() => setEditItem(null)} />}
      {sellItem  && <SellModal item={sellItem} onClose={() => setSellItem(null)} />}
    </div>
  );
}
