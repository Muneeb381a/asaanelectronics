import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertOctagon, Plus, X, Trash2, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { repossessionsApi, type Repossession } from '../api/repossessions.api.ts';
import { getErrorMessage } from '../utils/error.ts';
import { fmtDate } from '../utils/dateFormat.ts';

function pkr(v: string | number) {
  return 'PKR ' + Number(v).toLocaleString('en-PK', { maximumFractionDigits: 0 });
}

function todayStr() { return new Date().toISOString().slice(0, 10); }

const CONDITION_LABELS: Record<string, string> = { good: 'Good', fair: 'Fair', poor: 'Poor' };
const CONDITION_STYLES: Record<string, string> = {
  good: 'bg-green-100 text-green-700',
  fair: 'bg-amber-100 text-amber-700',
  poor: 'bg-red-100 text-red-700',
};
const STATUS_LABELS: Record<string, string> = { in_stock: 'In Stock', sold: 'Sold', disposed: 'Disposed', returned: 'Returned' };
const STATUS_STYLES: Record<string, string> = {
  in_stock: 'bg-blue-100 text-blue-700',
  sold:     'bg-green-100 text-green-700',
  disposed: 'bg-gray-100 text-gray-500',
  returned: 'bg-purple-100 text-purple-700',
};

// ── Record Repossession Modal ────────────────────────────────────────────────
function RepossessionModal({ item, onClose }: { item?: Repossession; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    installmentId:   item?.installmentId   ?? '',
    repossessedDate: item?.repossessedDate ?? todayStr(),
    deviceName:      item?.deviceName      ?? '',
    imei:            item?.imei            ?? '',
    condition:       item?.condition       ?? 'fair',
    reason:          item?.reason          ?? '',
    amountRecovered: item?.amountRecovered ?? '',
    assessedValue:   item?.assessedValue   ?? '',
    notes:           item?.notes           ?? '',
  });

  const mut = useMutation({
    mutationFn: () => item
      ? repossessionsApi.update(item.id, {
          condition:    form.condition as 'good' | 'fair' | 'poor',
          assessedValue: form.assessedValue ? Number(form.assessedValue) : undefined,
          notes:        form.notes || undefined,
        })
      : repossessionsApi.create({
          installmentId:   form.installmentId,
          repossessedDate: form.repossessedDate,
          deviceName:      form.deviceName,
          imei:            form.imei || undefined,
          condition:       form.condition as 'good' | 'fair' | 'poor',
          reason:          form.reason || undefined,
          amountRecovered: form.amountRecovered ? Number(form.amountRecovered) : undefined,
          assessedValue:   form.assessedValue ? Number(form.assessedValue) : undefined,
          notes:           form.notes || undefined,
        }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['repossessions'] });
      void qc.invalidateQueries({ queryKey: ['repossession-stats'] });
      toast.success(item ? 'Updated' : 'Repossession recorded');
      onClose();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="text-base font-semibold text-gray-900">{item ? 'Edit Repossession' : 'Record Repossession'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-3">
          {!item && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Installment ID *</label>
              <input
                value={form.installmentId}
                onChange={(e) => setForm((f) => ({ ...f, installmentId: e.target.value }))}
                placeholder="Paste installment ID"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
              <p className="text-xs text-gray-400 mt-1">Use "Repossess" action on the Installments page for easier entry</p>
            </div>
          )}
          {!item && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Device Name *</label>
                <input value={form.deviceName} onChange={(e) => setForm((f) => ({ ...f, deviceName: e.target.value }))}
                  placeholder="e.g. Samsung A54" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Repossession Date *</label>
                <input type="date" value={form.repossessedDate} onChange={(e) => setForm((f) => ({ ...f, repossessedDate: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">IMEI</label>
                <input value={form.imei} onChange={(e) => setForm((f) => ({ ...f, imei: e.target.value }))}
                  placeholder="Leave blank to auto-fill from installment" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Reason</label>
                <input value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                  placeholder="Non-payment, damage, etc." className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Amount Recovered (PKR)</label>
                <input type="number" value={form.amountRecovered} onChange={(e) => setForm((f) => ({ ...f, amountRecovered: e.target.value }))}
                  placeholder="0" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Condition</label>
            <select value={form.condition} onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value as 'good' | 'fair' | 'poor' }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="poor">Poor</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Assessed Value (PKR)</label>
            <input type="number" value={form.assessedValue} onChange={(e) => setForm((f) => ({ ...f, assessedValue: e.target.value }))}
              placeholder="0" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2} placeholder="Optional notes..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
        </div>
        <div className="px-6 pb-5 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-xl border border-gray-200 transition">Cancel</button>
          <button
            onClick={() => mut.mutate()}
            disabled={mut.isPending || (!item && (!form.installmentId || !form.deviceName))}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 transition disabled:opacity-50"
          >
            {mut.isPending ? 'Saving…' : item ? 'Update' : 'Record Repossession'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sell / Update Modal ───────────────────────────────────────────────────────
function UpdateStatusModal({ item, onClose }: { item: Repossession; onClose: () => void }) {
  const qc = useQueryClient();
  const [status,    setStatus]    = useState<string>(item.status);
  const [soldPrice, setSoldPrice] = useState('');

  const mut = useMutation({
    mutationFn: () => repossessionsApi.update(item.id, {
      status:    status as Repossession['status'],
      soldPrice: soldPrice ? Number(soldPrice) : undefined,
    }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['repossessions'] });
      void qc.invalidateQueries({ queryKey: ['repossession-stats'] });
      toast.success('Status updated');
      onClose();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Update Status</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-3">
          <p className="text-sm text-gray-600">{item.deviceName}</p>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">New Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="in_stock">In Stock</option>
              <option value="sold">Sold</option>
              <option value="disposed">Disposed</option>
              <option value="returned">Returned to Customer</option>
            </select>
          </div>
          {status === 'sold' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Sale Price (PKR)</label>
              <input type="number" value={soldPrice} onChange={(e) => setSoldPrice(e.target.value)}
                placeholder="0" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}
        </div>
        <div className="px-6 pb-5 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-xl border border-gray-200 transition">Cancel</button>
          <button onClick={() => mut.mutate()} disabled={mut.isPending}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition disabled:opacity-50">
            {mut.isPending ? 'Saving…' : 'Update'}
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
  { label: 'Returned', value: 'returned' },
  { label: 'Disposed', value: 'disposed' },
];

export default function RepossessionsPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [showAdd,      setShowAdd]      = useState(false);
  const [editItem,     setEditItem]     = useState<Repossession | null>(null);
  const [statusItem,   setStatusItem]   = useState<Repossession | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['repossessions', statusFilter],
    queryFn:  () => repossessionsApi.list({ status: statusFilter || undefined, limit: 100 }),
    staleTime: 30_000,
  });

  const { data: stats } = useQuery({
    queryKey: ['repossession-stats'],
    queryFn:  repossessionsApi.stats,
    staleTime: 30_000,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => repossessionsApi.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['repossessions'] });
      void qc.invalidateQueries({ queryKey: ['repossession-stats'] });
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
            <AlertOctagon size={22} className="text-red-600" />
            Repossessions
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Devices taken back for non-payment</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 transition"
        >
          <Plus size={16} />
          Record
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total',      value: stats.total,    sub: pkr(stats.total_outstanding) + ' outstanding' },
            { label: 'In Stock',   value: stats.in_stock, sub: 'devices held' },
            { label: 'Recovered',  value: pkr(stats.total_recovered), sub: 'partial payments' },
            { label: 'Sold',       value: stats.sold,     sub: pkr(stats.total_sold) + ' earned' },
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
                ? 'bg-red-600 text-white border-red-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-red-300'
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
            <AlertOctagon size={32} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No repossessions recorded</p>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Device</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Customer</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Condition</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Outstanding</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{r.deviceName}</p>
                        {r.imei && <p className="text-xs text-gray-400">{r.imei}</p>}
                        {r.reason && <p className="text-xs text-red-500">{r.reason}</p>}
                      </td>
                      <td className="px-4 py-3">
                        {r.customerName
                          ? <><p className="text-gray-900">{r.customerName}</p><p className="text-xs text-gray-400">{r.customerPhone}</p></>
                          : <span className="text-gray-400">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-gray-600">{fmtDate(r.repossessedDate)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${CONDITION_STYLES[r.condition]}`}>
                          {CONDITION_LABELS[r.condition]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-red-700">{pkr(r.outstandingAtRepossession)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_STYLES[r.status]}`}>
                          {STATUS_LABELS[r.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => setStatusItem(r)}
                            className="px-2.5 py-1 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition font-medium">
                            Update
                          </button>
                          <button onClick={() => setEditItem(r)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => { if (confirm('Remove this repossession record?')) deleteMut.mutate(r.id); }}
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
                      {r.reason && <p className="text-xs text-red-500">{r.reason}</p>}
                    </div>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full shrink-0 ${STATUS_STYLES[r.status]}`}>
                      {STATUS_LABELS[r.status]}
                    </span>
                  </div>
                  {r.customerName && <p className="text-xs text-gray-500">{r.customerName} · {fmtDate(r.repossessedDate)}</p>}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-red-700">{pkr(r.outstandingAtRepossession)} outstanding</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setStatusItem(r)} className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded-lg">Update</button>
                      <button onClick={() => setEditItem(r)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg transition"><Pencil size={14} /></button>
                      <button onClick={() => { if (confirm('Remove?')) deleteMut.mutate(r.id); }} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg transition"><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {showAdd    && <RepossessionModal onClose={() => setShowAdd(false)} />}
      {editItem   && <RepossessionModal item={editItem} onClose={() => setEditItem(null)} />}
      {statusItem && <UpdateStatusModal item={statusItem} onClose={() => setStatusItem(null)} />}
    </div>
  );
}
