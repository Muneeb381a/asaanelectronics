import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/auth.store.ts';
import { Plus, Search, Pencil, Trash2, X, ChevronLeft, ChevronRight, Bike } from 'lucide-react';
import { vehicleStockApi, type VehicleStock, type CreateVehicleStockInput, type VehicleType, type VehicleCondition, type VehicleStockStatus } from '../api/vehicleStock.api.ts';
import { useDebounce } from '../hooks/useDebounce.ts';
import { getErrorMessage } from '../utils/error.ts';
import ConfirmDialog from '../components/ui/ConfirmDialog.tsx';

const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  BIKE:              'Bike / Motorcycle',
  RICKSHAW:          'Auto Rickshaw',
  LOADER_RICKSHAW:   'Loader Rickshaw',
  ELECTRIC_BIKE:     'Electric Bike',
  ELECTRIC_RICKSHAW: 'Electric Rickshaw',
};

const VEHICLE_TYPE_ICONS: Record<VehicleType, string> = {
  BIKE:              '🏍️',
  RICKSHAW:          '🛺',
  LOADER_RICKSHAW:   '🚛',
  ELECTRIC_BIKE:     '⚡🏍️',
  ELECTRIC_RICKSHAW: '⚡🛺',
};

const STATUS_STYLES: Record<VehicleStockStatus, string> = {
  AVAILABLE:       'bg-green-100 text-green-700',
  RESERVED:        'bg-amber-100 text-amber-700',
  SOLD_INSTALLMENT:'bg-blue-100 text-blue-700',
  SOLD_CASH:       'bg-slate-100 text-slate-600',
};

const STATUS_LABELS: Record<VehicleStockStatus, string> = {
  AVAILABLE:        'Available',
  RESERVED:         'Reserved',
  SOLD_INSTALLMENT: 'On Installment',
  SOLD_CASH:        'Sold (Cash)',
};

const VEHICLE_TYPES: VehicleType[] = ['BIKE', 'RICKSHAW', 'LOADER_RICKSHAW', 'ELECTRIC_BIKE', 'ELECTRIC_RICKSHAW'];
const COMMON_BRANDS = ['Honda', 'Yamaha', 'United', 'Road Prince', 'Super Power', 'Ravi', 'Sazgar', 'Qingqi', 'GS', 'Crown', 'Other'];

const INITIAL_FORM: CreateVehicleStockInput = {
  vehicleType:   'BIKE',
  brand:         '',
  model:         '',
  year:          new Date().getFullYear(),
  color:         '',
  engineNumber:  '',
  chassisNumber: '',
  condition:     'NEW',
};

export default function VehicleStockPage() {
  const isOwner = useAuthStore((s) => s.user?.role === 'SELLER_OWNER');
  const qc = useQueryClient();

  const [page, setPage]         = useState(1);
  const [search, setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter]     = useState('');
  const dSearch = useDebounce(search, 350);

  const [showForm, setShowForm]       = useState(false);
  const [editId, setEditId]           = useState<string | null>(null);
  const [form, setForm]               = useState<CreateVehicleStockInput>(INITIAL_FORM);
  const [customBrand, setCustomBrand] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<VehicleStock | null>(null);

  const { data: stats } = useQuery({
    queryKey: ['vehicle-stock-stats'],
    queryFn: vehicleStockApi.stats,
    staleTime: 30_000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['vehicle-stock', page, dSearch, statusFilter, typeFilter],
    queryFn: () => vehicleStockApi.list({ page, limit: 20, search: dSearch || undefined, status: statusFilter || undefined, vehicleType: typeFilter || undefined }),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

  const saveMut = useMutation({
    mutationFn: (v: CreateVehicleStockInput) =>
      editId ? vehicleStockApi.update(editId, v) : vehicleStockApi.create(v),
    onSuccess: () => {
      toast.success(editId ? 'Vehicle updated' : 'Vehicle added to stock');
      qc.invalidateQueries({ queryKey: ['vehicle-stock'] });
      qc.invalidateQueries({ queryKey: ['vehicle-stock-stats'] });
      closeForm();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => vehicleStockApi.delete(id),
    onSuccess: () => {
      toast.success('Vehicle removed from stock');
      qc.invalidateQueries({ queryKey: ['vehicle-stock'] });
      qc.invalidateQueries({ queryKey: ['vehicle-stock-stats'] });
      setDeleteTarget(null);
    },
    onError: (e) => { toast.error(getErrorMessage(e)); setDeleteTarget(null); },
  });

  function openForm(v?: VehicleStock) {
    if (v) {
      setEditId(v.id);
      const known = COMMON_BRANDS.includes(v.brand);
      setCustomBrand(!known);
      setForm({
        vehicleType:         v.vehicleType,
        brand:               v.brand,
        model:               v.model,
        year:                v.year ?? undefined,
        color:               v.color ?? '',
        engineNumber:        v.engineNumber,
        chassisNumber:       v.chassisNumber,
        registrationNumber:  v.registrationNumber ?? '',
        condition:           v.condition,
        purchasePrice:       v.purchasePrice ? Number(v.purchasePrice) : undefined,
        sellingPrice:        v.sellingPrice  ? Number(v.sellingPrice)  : undefined,
        supplierName:        v.supplierName  ?? '',
        notes:               v.notes ?? '',
        purchasedAt:         v.purchasedAt ?? '',
      });
    } else {
      setEditId(null);
      setCustomBrand(false);
      setForm(INITIAL_FORM);
    }
    setShowForm(true);
  }

  function closeForm() { setShowForm(false); setEditId(null); setForm(INITIAL_FORM); }

  const f = (k: keyof CreateVehicleStockInput, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  const totalPages = Math.ceil((data?.total ?? 0) / 20);

  const statCards = [
    { label: 'Total Stock', value: stats?.total ?? 0,           color: 'bg-slate-50 border-slate-200',   text: 'text-slate-700' },
    { label: 'Available',   value: stats?.available ?? 0,       color: 'bg-green-50 border-green-200',   text: 'text-green-700' },
    { label: 'On Install.', value: stats?.soldInstallment ?? 0, color: 'bg-blue-50 border-blue-200',     text: 'text-blue-700'  },
    { label: 'Sold Cash',   value: stats?.soldCash ?? 0,        color: 'bg-gray-50 border-gray-200',     text: 'text-gray-700'  },
  ];

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Bike size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Vehicle Stock</h1>
            <p className="text-xs text-gray-500">Bikes, Rickshaws & more</p>
          </div>
        </div>
        {isOwner && (
          <button onClick={() => openForm()}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition">
            <Plus size={15} /> Add Vehicle
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((s) => (
          <div key={s.label} className={`rounded-xl border p-3 ${s.color}`}>
            <div className={`text-2xl font-black ${s.text}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search brand, model, engine #..."
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300">
          <option value="">All Types</option>
          {VEHICLE_TYPES.map((t) => <option key={t} value={t}>{VEHICLE_TYPE_LABELS[t]}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300">
          <option value="">All Status</option>
          <option value="AVAILABLE">Available</option>
          <option value="RESERVED">Reserved</option>
          <option value="SOLD_INSTALLMENT">On Installment</option>
          <option value="SOLD_CASH">Sold Cash</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type / Vehicle</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Engine # / Chassis #</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Condition</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Selling Price</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                {isOwner && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={6} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse w-full" /></td></tr>
                ))
              ) : data?.data.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center">
                  <div className="text-3xl mb-2">🏍️</div>
                  <p className="text-gray-500 text-sm">No vehicles in stock</p>
                  {isOwner && <button onClick={() => openForm()} className="mt-2 text-indigo-600 text-sm font-medium hover:underline">Add first vehicle</button>}
                </td></tr>
              ) : data?.data.map((v) => (
                <tr key={v.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{VEHICLE_TYPE_ICONS[v.vehicleType]}</span>
                      <div>
                        <div className="font-semibold text-gray-900">{v.brand} {v.model}</div>
                        <div className="text-xs text-gray-500">{v.year ?? '—'} · {v.color ?? '—'} · {VEHICLE_TYPE_LABELS[v.vehicleType]}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">
                    <div>ENG: {v.engineNumber}</div>
                    <div className="text-gray-500">CHS: {v.chassisNumber}</div>
                    {v.registrationNumber && <div className="text-indigo-600 font-semibold">{v.registrationNumber}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${v.condition === 'NEW' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                      {v.condition}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-900">
                    {v.sellingPrice ? `PKR ${Number(v.sellingPrice).toLocaleString()}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[v.status]}`}>
                      {STATUS_LABELS[v.status]}
                    </span>
                  </td>
                  {isOwner && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openForm(v)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition">
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(v)}
                          disabled={v.status === 'SOLD_INSTALLMENT' || v.status === 'RESERVED'}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">{data?.total} vehicles</span>
            <div className="flex items-center gap-1">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-40"><ChevronLeft size={16} /></button>
              <span className="text-xs px-2">{page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-40"><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">{editId ? 'Edit Vehicle' : 'Add Vehicle to Stock'}</h2>
              <button onClick={closeForm} className="p-1 text-gray-400 hover:text-gray-600 rounded"><X size={18} /></button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); saveMut.mutate(form); }} className="p-5 space-y-4">
              {/* Vehicle Type */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Vehicle Type *</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {VEHICLE_TYPES.map((t) => (
                    <button type="button" key={t}
                      onClick={() => f('vehicleType', t)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition ${form.vehicleType === t ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      <span>{VEHICLE_TYPE_ICONS[t as VehicleType]}</span>
                      <span className="text-xs">{VEHICLE_TYPE_LABELS[t as VehicleType]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Brand + Model */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Brand *</label>
                  {!customBrand ? (
                    <select value={form.brand} onChange={(e) => {
                      if (e.target.value === 'Other') { setCustomBrand(true); f('brand', ''); }
                      else f('brand', e.target.value);
                    }} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" required>
                      <option value="">Select brand</option>
                      {COMMON_BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                  ) : (
                    <div className="flex gap-1">
                      <input value={form.brand} onChange={(e) => f('brand', e.target.value)} placeholder="Enter brand" required
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                      <button type="button" onClick={() => { setCustomBrand(false); f('brand', ''); }}
                        className="px-2 text-gray-400 hover:text-gray-600"><X size={14} /></button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Model *</label>
                  <input value={form.model} onChange={(e) => f('model', e.target.value)} placeholder="e.g. CD70, CG125" required
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
              </div>

              {/* Year + Color + Condition */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Year</label>
                  <input type="number" value={form.year ?? ''} onChange={(e) => f('year', e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="2024" min={2000} max={2030}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Color</label>
                  <input value={form.color ?? ''} onChange={(e) => f('color', e.target.value)} placeholder="Black, Red..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Condition *</label>
                  <select value={form.condition} onChange={(e) => f('condition', e.target.value as VehicleCondition)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                    <option value="NEW">New</option>
                    <option value="USED">Used</option>
                  </select>
                </div>
              </div>

              {/* Engine + Chassis + Registration */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Engine Number *</label>
                  <input value={form.engineNumber} onChange={(e) => f('engineNumber', e.target.value.toUpperCase())} placeholder="ENG-XXXXXXXX" required
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Chassis Number *</label>
                  <input value={form.chassisNumber} onChange={(e) => f('chassisNumber', e.target.value.toUpperCase())} placeholder="CHS-XXXXXXXX" required
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Reg. Number</label>
                  <input value={form.registrationNumber ?? ''} onChange={(e) => f('registrationNumber', e.target.value.toUpperCase())} placeholder="LHR-1234"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
              </div>

              {/* Prices */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Purchase Price (PKR)</label>
                  <input type="number" value={form.purchasePrice ?? ''} onChange={(e) => f('purchasePrice', e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="0" min={0}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Selling Price (PKR)</label>
                  <input type="number" value={form.sellingPrice ?? ''} onChange={(e) => f('sellingPrice', e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="0" min={0}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
              </div>

              {/* Supplier + Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Supplier Name</label>
                  <input value={form.supplierName ?? ''} onChange={(e) => f('supplierName', e.target.value)} placeholder="Supplier / Distributor"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Purchased Date</label>
                  <input type="date" value={form.purchasedAt ?? ''} onChange={(e) => f('purchasedAt', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Notes</label>
                <textarea value={form.notes ?? ''} onChange={(e) => f('notes', e.target.value)} rows={2} placeholder="Any additional notes..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={closeForm}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition">
                  Cancel
                </button>
                <button type="submit" disabled={saveMut.isPending}
                  className="flex-1 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition disabled:opacity-60">
                  {saveMut.isPending ? 'Saving...' : editId ? 'Update Vehicle' : 'Add to Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove Vehicle from Stock"
        description={`Remove ${deleteTarget?.brand} ${deleteTarget?.model} (${deleteTarget?.engineNumber}) from stock? This cannot be undone.`}
        confirmLabel="Remove"
        variant="danger"
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
