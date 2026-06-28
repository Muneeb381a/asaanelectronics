import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shield, Phone, User, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { guarantorsApi, type Guarantor } from '../api/guarantors.api.ts';
import { useDebounce } from '../hooks/useDebounce.ts';

const INST_STATUS_STYLES: Record<string, string> = {
  ACTIVE:    'bg-green-100 text-green-700',
  DEFAULTED: 'bg-red-100 text-red-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
  CLOSED:    'bg-slate-100 text-slate-500',
  PENDING:   'bg-amber-100 text-amber-700',
  CANCELLED: 'bg-gray-100 text-gray-400',
};

function GuarantorCard({ g }: { g: Guarantor }) {
  const [expanded, setExpanded] = useState(false);

  const riskColor = g.defaultedCount > 0
    ? 'border-l-red-400'
    : g.activeCount > 0
      ? 'border-l-green-400'
      : 'border-l-gray-200';

  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm border-l-4 ${riskColor} overflow-hidden`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
              <Shield size={16} className="text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 truncate">{g.name ?? 'Unknown'}</p>
              <div className="flex items-center gap-1 text-gray-500">
                <Phone size={11} />
                <span className="text-xs">{g.phone}</span>
              </div>
              {g.relation && <p className="text-xs text-gray-400 mt-0.5">{g.relation}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right">
              <p className="text-xs text-gray-500">{g.customerCount} customer{g.customerCount !== 1 ? 's' : ''}</p>
              <div className="flex gap-1 mt-0.5 justify-end">
                {g.activeCount > 0 && (
                  <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded-full font-medium">
                    {g.activeCount} active
                  </span>
                )}
                {g.defaultedCount > 0 && (
                  <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded-full font-medium">
                    {g.defaultedCount} defaulted
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition"
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {expanded && (
          <div className="mt-3 border-t border-gray-50 pt-3 space-y-2">
            {g.customers.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 py-1">
                <div className="flex items-center gap-2 min-w-0">
                  <User size={12} className="text-gray-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800 font-medium truncate">{c.name}</p>
                    <p className="text-xs text-gray-400">{c.phone}</p>
                  </div>
                </div>
                {c.installmentStatus ? (
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full shrink-0 ${INST_STATUS_STYLES[c.installmentStatus] ?? 'bg-gray-100 text-gray-500'}`}>
                    {c.installmentStatus}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">No installment</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function GuarantorsPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: ['guarantors', debouncedSearch],
    queryFn:  () => guarantorsApi.list(debouncedSearch || undefined),
    staleTime: 30_000,
  });

  const guarantors = data ?? [];
  const totalDefaulted = guarantors.reduce((s, g) => s + g.defaultedCount, 0);
  const totalActive    = guarantors.reduce((s, g) => s + g.activeCount, 0);

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Shield size={22} className="text-blue-600" />
          Guarantors
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">All guarantors registered across your customers</p>
      </div>

      {/* Summary stats */}
      {!isLoading && guarantors.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-500">Total Guarantors</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{guarantors.length}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-500">Active Customers</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{totalActive}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-500">Defaulted</p>
            <p className={`text-2xl font-bold mt-1 ${totalDefaulted > 0 ? 'text-red-600' : 'text-gray-900'}`}>{totalDefaulted}</p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or phone…"
          className="w-full pl-8 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
      ) : guarantors.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-gray-100 shadow-sm">
          <Shield size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">
            {search ? 'No guarantors match your search' : 'No guarantors found — add them when creating customers'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {totalDefaulted > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <p className="text-sm text-red-700 font-medium">
                ⚠ {guarantors.filter((g) => g.defaultedCount > 0).length} guarantor{guarantors.filter((g) => g.defaultedCount > 0).length !== 1 ? 's' : ''} linked to defaulted accounts
              </p>
              <p className="text-xs text-red-500 mt-0.5">Shown first — review before approving new installments for these guarantors</p>
            </div>
          )}
          {guarantors.map((g) => (
            <GuarantorCard key={g.phone} g={g} />
          ))}
        </div>
      )}
    </div>
  );
}
