import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Search, X, ChevronLeft, ChevronRight, Car, AlertTriangle } from 'lucide-react';
import {
  vehicleInstallmentsApi,
  type VehicleInstallment, type CreateVehicleInstallmentInput, type VehicleInstallmentStatus,
  type LetterStatus, type BiometricStatus,
} from '../api/vehicleInstallments.api.ts';
import { vehicleStockApi, type VehicleType } from '../api/vehicleStock.api.ts';
import { customersApi } from '../api/customers.api.ts';
import { useDebounce } from '../hooks/useDebounce.ts';
import { fmtDate } from '../utils/dateFormat.ts';
import { getErrorMessage } from '../utils/error.ts';
import VehicleInstallmentModal from '../features/vehicleInstallments/VehicleInstallmentModal.tsx';

const VEHICLE_TYPE_ICONS: Record<VehicleType, string> = {
  BIKE: '🏍️', RICKSHAW: '🛺', LOADER_RICKSHAW: '🚛',
  ELECTRIC_BIKE: '⚡🏍️', ELECTRIC_RICKSHAW: '⚡🛺',
};

const LETTER_COLORS: Record<LetterStatus, string> = {
  NONE:          'bg-gray-100 text-gray-400',
  FIRST_NOTICE:  'bg-amber-100 text-amber-700',
  SECOND_NOTICE: 'bg-orange-100 text-orange-700',
  LEGAL_NOTICE:  'bg-red-100 text-red-700',
  FILED:         'bg-red-600 text-white',
};
const LETTER_ABBR: Record<LetterStatus, string> = {
  NONE: '—', FIRST_NOTICE: '1st', SECOND_NOTICE: '2nd', LEGAL_NOTICE: 'Legal', FILED: 'Filed',
};

const BIO_COLORS: Record<BiometricStatus, string> = {
  PENDING:      'bg-gray-100 text-gray-400',
  SELLER_DONE:  'bg-blue-100 text-blue-700',
  BUYER_DONE:   'bg-indigo-100 text-indigo-700',
  COMPLETED:    'bg-green-100 text-green-700',
  NOT_REQUIRED: 'bg-slate-100 text-slate-400',
};
const BIO_ABBR: Record<BiometricStatus, string> = {
  PENDING: 'Pending', SELLER_DONE: 'Seller✓', BUYER_DONE: 'Buyer✓', COMPLETED: 'Done✓', NOT_REQUIRED: 'N/A',
};

function LetterBadge({ status }: { status: LetterStatus }) {
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${LETTER_COLORS[status]}`}>{LETTER_ABBR[status]}</span>;
}
function BioBadge({ status }: { status: BiometricStatus }) {
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${BIO_COLORS[status]}`}>{BIO_ABBR[status]}</span>;
}

const STATUS_STYLES: Record<VehicleInstallmentStatus, string> = {
  PENDING:   'bg-amber-100 text-amber-700',
  ACTIVE:    'bg-green-100 text-green-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
  DEFAULTED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
  CLOSED:    'bg-slate-100 text-slate-500',
};

const pkr = (n: number | string) => 'PKR ' + Number(n).toLocaleString('en-PK', { maximumFractionDigits: 0 });

function calcNextDue(inst: VehicleInstallment): Date | null {
  if (inst.status !== 'ACTIVE') return null;
  const down = Number(inst.downPayment);
  const rem  = Number(inst.remaining);
  const mon  = Number(inst.monthly);
  const tot  = Number(inst.totalAmount);
  if (mon <= 0) return null;
  const paid        = (tot - down) - rem;
  const periodsPaid = Math.max(0, Math.floor(paid / mon + 0.001));
  const base   = new Date(inst.startDate);
  const dueDay = inst.paymentDueDay ?? 10;
  const year   = base.getFullYear();
  const month  = base.getMonth() + periodsPaid + 1;
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(dueDay, lastDay));
}

const STATUS_FILTERS = [
  { label: 'All', value: '' }, { label: 'Active', value: 'ACTIVE' },
  { label: 'Pending', value: 'PENDING' }, { label: 'Completed', value: 'COMPLETED' },
  { label: 'Defaulted', value: 'DEFAULTED' }, { label: 'Cancelled', value: 'CANCELLED' },
];
const TYPE_FILTERS = [
  { label: 'All Types', value: '' }, { label: '🏍️ Bikes', value: 'BIKE' },
  { label: '🛺 Rickshaws', value: 'RICKSHAW' }, { label: '🚛 Loader', value: 'LOADER_RICKSHAW' },
  { label: '⚡ E-Bike', value: 'ELECTRIC_BIKE' }, { label: '⚡🛺 E-Rickshaw', value: 'ELECTRIC_RICKSHAW' },
];

const INITIAL_FORM: CreateVehicleInstallmentInput = {
  vehicleId: '', customerId: '', totalAmount: 0, downPayment: 0, months: 12,
  startDate: new Date().toISOString().split('T')[0]!,
  paymentFrequency: 'monthly', paymentDueDay: 10,
};

export default function VehicleInstallmentsPage() {
  const qc = useQueryClient();

  const [page, setPage]     = useState(1);
  const [search, setSearch] = useState('');
  const [statusF, setStatusF] = useState('');
  const [typeF, setTypeF]     = useState('');
  const dSearch = useDebounce(search, 350);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateVehicleInstallmentInput>(INITIAL_FORM);
  const [selectedInstId, setSelectedInstId] = useState<string | null>(null);

  // Customer search for create form
  const [custSearch, setCustSearch]   = useState('');
  const dCustSearch = useDebounce(custSearch, 350);
  const [custSelected, setCustSelected] = useState<{ id: string; name: string; phone: string } | null>(null);

  // Vehicle search for create form
  const [vehSearch, setVehSearch] = useState('');
  const dVehSearch = useDebounce(vehSearch, 350);
  const [vehSelected, setVehSelected] = useState<{ id: string; brand: string; model: string; engineNumber: string; sellingPrice: string | null } | null>(null);

  const { data: stats } = useQuery({
    queryKey: ['vehicle-installment-stats'],
    queryFn: vehicleInstallmentsApi.stats,
    staleTime: 30_000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['vehicle-installments', page, dSearch, statusF, typeF],
    queryFn: () => vehicleInstallmentsApi.list({ page, limit: 20, search: dSearch || undefined, status: statusF || undefined, vehicleType: typeF || undefined }),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

  const { data: custResults = [] } = useQuery({
    queryKey: ['customers-search-vi', dCustSearch],
    queryFn: () => customersApi.list({ search: dCustSearch, limit: 8 }).then(r => r.data),
    enabled: dCustSearch.length >= 2 && showCreate && !custSelected,
    staleTime: 10_000,
  });

  const { data: vehResults } = useQuery({
    queryKey: ['vehicle-stock-search', dVehSearch],
    queryFn: () => vehicleStockApi.list({ search: dVehSearch || undefined, status: 'AVAILABLE', limit: 8 }),
    enabled: showCreate && !vehSelected,
    staleTime: 10_000,
  });

  const createMut = useMutation({
    mutationFn: (body: CreateVehicleInstallmentInput) => vehicleInstallmentsApi.create(body),
    onSuccess: () => {
      toast.success('Vehicle installment created');
      qc.invalidateQueries({ queryKey: ['vehicle-installments'] });
      qc.invalidateQueries({ queryKey: ['vehicle-installment-stats'] });
      qc.invalidateQueries({ queryKey: ['vehicle-stock'] });
      qc.invalidateQueries({ queryKey: ['vehicle-stock-stats'] });
      closeCreate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  function closeCreate() {
    setShowCreate(false);
    setForm(INITIAL_FORM);
    setCustSelected(null); setCustSearch('');
    setVehSelected(null);  setVehSearch('');
  }

  const f = (k: keyof CreateVehicleInstallmentInput, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  const totalPages = Math.ceil((data?.total ?? 0) / 20);
  const today = new Date();

  const statCards = [
    { label: 'Total',      value: stats?.total ?? 0,       color: 'bg-slate-50 border-slate-200',   text: 'text-slate-700' },
    { label: 'Active',     value: stats?.active ?? 0,      color: 'bg-green-50 border-green-200',   text: 'text-green-700' },
    { label: 'Completed',  value: stats?.completed ?? 0,   color: 'bg-blue-50 border-blue-200',     text: 'text-blue-700'  },
    { label: 'Defaulted',  value: stats?.defaulted ?? 0,   color: 'bg-red-50 border-red-200',       text: 'text-red-700'   },
  ];

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
            <Car size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Vehicle Finance</h1>
            <p className="text-xs text-gray-500">Bike & Rickshaw Installments</p>
          </div>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition">
          <Plus size={15} /> New Installment
        </button>
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
      {(stats?.outstanding ?? 0) > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-2">
          <AlertTriangle size={14} className="text-amber-500 shrink-0" />
          <span className="text-sm text-amber-800 font-medium">
            Total Outstanding: <strong className="text-amber-900">{pkr(stats!.outstanding)}</strong>
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Customer, engine #, invoice..."
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS.map(({ label, value }) => (
            <button key={value} onClick={() => { setStatusF(value); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${statusF === value ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {label}
            </button>
          ))}
        </div>
        <select value={typeF} onChange={(e) => { setTypeF(e.target.value); setPage(1); }}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300">
          {TYPE_FILTERS.map(({ label, value }) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Vehicle / Customer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Engine #</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Monthly</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Remaining</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Next Due</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Letter</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Bio</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={8} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>
                ))
              ) : data?.data.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center">
                  <div className="text-3xl mb-2">🛺</div>
                  <p className="text-gray-500 text-sm">No vehicle installments yet</p>
                  <button onClick={() => setShowCreate(true)} className="mt-2 text-violet-600 text-sm font-medium hover:underline">Create first one</button>
                </td></tr>
              ) : data?.data.map((inst) => {
                const nextDue = calcNextDue(inst);
                const isOverdue = nextDue && nextDue < today && inst.status === 'ACTIVE';
                return (
                  <tr key={inst.id} onClick={() => setSelectedInstId(inst.id)}
                    className="hover:bg-violet-50 cursor-pointer transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{VEHICLE_TYPE_ICONS[inst.vehicleType]}</span>
                        <div>
                          <div className="font-semibold text-gray-900">{inst.brand} {inst.model} {inst.year ? `(${inst.year})` : ''}</div>
                          <div className="text-xs text-gray-500">{inst.customerName} · {inst.customerPhone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{inst.engineNumber}</td>
                    <td className="px-4 py-3 text-right font-semibold text-indigo-700">{pkr(inst.monthly)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-amber-700">{pkr(inst.remaining)}</td>
                    <td className="px-4 py-3">
                      {nextDue ? (
                        <span className={`text-xs font-semibold ${isOverdue ? 'text-red-600' : 'text-gray-700'}`}>
                          {isOverdue && '⚠ '}{fmtDate(nextDue)}
                        </span>
                      ) : <span className="text-xs text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <LetterBadge status={inst.letterStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <BioBadge status={inst.biometricStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[inst.status]}`}>
                        {inst.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">{data?.total} installments</span>
            <div className="flex items-center gap-1">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-1 rounded hover:bg-gray-100 disabled:opacity-40"><ChevronLeft size={16} /></button>
              <span className="text-xs px-2">{page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="p-1 rounded hover:bg-gray-100 disabled:opacity-40"><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>

      {/* ── Create Modal ── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">New Vehicle Installment</h2>
              <button onClick={closeCreate} className="p-1 text-gray-400 hover:text-gray-600 rounded"><X size={18} /></button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); createMut.mutate(form); }} className="p-5 space-y-4">

              {/* Vehicle selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Vehicle (Available Stock) *</label>
                {vehSelected ? (
                  <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2.5">
                    <div>
                      <div className="font-semibold text-indigo-900 text-sm">{vehSelected.brand} {vehSelected.model}</div>
                      <div className="text-xs text-indigo-600 font-mono mt-0.5">ENG: {vehSelected.engineNumber}</div>
                      {vehSelected.sellingPrice && <div className="text-xs text-indigo-500 mt-0.5">{pkr(Number(vehSelected.sellingPrice))}</div>}
                    </div>
                    <button type="button" onClick={() => { setVehSelected(null); setVehSearch(''); f('vehicleId', ''); if (vehSelected.sellingPrice) f('totalAmount', 0); }}
                      className="p-1 text-indigo-400 hover:text-indigo-700"><X size={14} /></button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={vehSearch} onChange={(e) => setVehSearch(e.target.value)}
                      placeholder="Search brand, model, engine #..."
                      className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300" />
                    {vehResults && vehResults.data.length > 0 && (
                      <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-100 py-1 max-h-48 overflow-y-auto">
                        {vehResults.data.map((v) => (
                          <button key={v.id} type="button"
                            onClick={() => {
                              setVehSelected({ id: v.id, brand: v.brand, model: v.model, engineNumber: v.engineNumber, sellingPrice: v.sellingPrice });
                              f('vehicleId', v.id);
                              if (v.sellingPrice) f('totalAmount', Number(v.sellingPrice));
                              setVehSearch('');
                            }}
                            className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 text-left">
                            <span>{VEHICLE_TYPE_ICONS[v.vehicleType]}</span>
                            <div>
                              <div className="text-sm font-semibold text-gray-900">{v.brand} {v.model} {v.year ? `(${v.year})` : ''}</div>
                              <div className="text-xs text-gray-500 font-mono">{v.engineNumber} · {v.color ?? ''}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Customer selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Customer *</label>
                {custSelected ? (
                  <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
                    <div>
                      <div className="font-semibold text-green-900 text-sm">{custSelected.name}</div>
                      <div className="text-xs text-green-600 mt-0.5">{custSelected.phone}</div>
                    </div>
                    <button type="button" onClick={() => { setCustSelected(null); setCustSearch(''); f('customerId', ''); }}
                      className="p-1 text-green-400 hover:text-green-700"><X size={14} /></button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={custSearch} onChange={(e) => setCustSearch(e.target.value)}
                      placeholder="Search customer name or phone..."
                      className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300" />
                    {custResults.length > 0 && (
                      <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-100 py-1 max-h-48 overflow-y-auto">
                        {custResults.map((c: { id: string; name: string; phone: string }) => (
                          <button key={c.id} type="button"
                            onClick={() => { setCustSelected(c); f('customerId', c.id); setCustSearch(''); }}
                            className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 text-left">
                            <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center text-xs font-bold text-violet-700">{c.name[0]}</div>
                            <div>
                              <div className="text-sm font-semibold text-gray-900">{c.name}</div>
                              <div className="text-xs text-gray-500">{c.phone}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Finance Terms */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Total Amount (PKR) *</label>
                  <input type="number" value={form.totalAmount || ''} onChange={(e) => f('totalAmount', Number(e.target.value))}
                    required min={1} placeholder="e.g. 150000"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Down Payment (PKR) *</label>
                  <input type="number" value={form.downPayment || ''} onChange={(e) => f('downPayment', Number(e.target.value))}
                    required min={0} placeholder="e.g. 30000"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
                </div>
              </div>

              {form.totalAmount > 0 && form.downPayment >= 0 && (
                <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-xs text-violet-500 font-medium">Balance</div>
                    <div className="font-bold text-violet-900 text-sm">{pkr(form.totalAmount - form.downPayment)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-violet-500 font-medium">Monthly</div>
                    <div className="font-bold text-violet-900 text-sm">
                      {form.months > 0 ? pkr(Math.ceil((form.totalAmount - form.downPayment) / form.months)) : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-violet-500 font-medium">Months</div>
                    <div className="font-bold text-violet-900 text-sm">{form.months}</div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Duration (months) *</label>
                  <input type="number" value={form.months} onChange={(e) => f('months', Number(e.target.value))}
                    required min={1} max={120}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Due Day</label>
                  <input type="number" value={form.paymentDueDay ?? 10} onChange={(e) => f('paymentDueDay', Number(e.target.value))}
                    min={1} max={28}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Start Date</label>
                  <input type="date" value={form.startDate} onChange={(e) => f('startDate', e.target.value)} required
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
                </div>
              </div>

              {/* Guarantor 1 */}
              <div className="border border-amber-200 bg-amber-50 rounded-xl p-3 space-y-2">
                <div className="text-xs font-bold text-amber-700 uppercase tracking-wide">Guarantor 1</div>
                <div className="grid grid-cols-2 gap-2">
                  <input value={form.guarantorName ?? ''} onChange={(e) => f('guarantorName', e.target.value)} placeholder="Name"
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
                  <input value={form.guarantorPhone ?? ''} onChange={(e) => f('guarantorPhone', e.target.value)} placeholder="Phone"
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
                  <input value={form.guarantorCnic ?? ''} onChange={(e) => f('guarantorCnic', e.target.value)} placeholder="CNIC"
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-300" />
                  <input value={form.guarantorRelation ?? ''} onChange={(e) => f('guarantorRelation', e.target.value)} placeholder="Relation (Father, Brother...)"
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
                  <input value={form.guarantorAddress ?? ''} onChange={(e) => f('guarantorAddress', e.target.value)} placeholder="Address"
                    className="col-span-2 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
                </div>
              </div>

              {/* Guarantor 2 */}
              <div className="border border-orange-200 bg-orange-50 rounded-xl p-3 space-y-2">
                <div className="text-xs font-bold text-orange-700 uppercase tracking-wide">Guarantor 2 (optional)</div>
                <div className="grid grid-cols-2 gap-2">
                  <input value={form.guarantor2Name ?? ''} onChange={(e) => f('guarantor2Name', e.target.value)} placeholder="Name"
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
                  <input value={form.guarantor2Phone ?? ''} onChange={(e) => f('guarantor2Phone', e.target.value)} placeholder="Phone"
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
                  <input value={form.guarantor2Cnic ?? ''} onChange={(e) => f('guarantor2Cnic', e.target.value)} placeholder="CNIC"
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-300" />
                  <input value={form.guarantor2Address ?? ''} onChange={(e) => f('guarantor2Address', e.target.value)} placeholder="Address"
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Notes</label>
                <textarea value={form.notes ?? ''} onChange={(e) => f('notes', e.target.value)} rows={2} placeholder="Any additional notes..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none" />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={closeCreate}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition">Cancel</button>
                <button type="submit" disabled={createMut.isPending || !form.vehicleId || !form.customerId}
                  className="flex-1 py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700 transition disabled:opacity-60">
                  {createMut.isPending ? 'Creating...' : 'Create Installment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedInstId && (
        <VehicleInstallmentModal
          installmentId={selectedInstId}
          onClose={() => setSelectedInstId(null)}
          onUpdated={() => {
            qc.invalidateQueries({ queryKey: ['vehicle-installments'] });
            qc.invalidateQueries({ queryKey: ['vehicle-installment-stats'] });
          }}
        />
      )}
    </div>
  );
}
