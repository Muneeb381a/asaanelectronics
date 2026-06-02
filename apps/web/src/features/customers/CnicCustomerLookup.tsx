import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, ShieldCheck, ShieldX, Clock, AlertTriangle, CheckCircle2, UserX, Loader2 } from 'lucide-react';
import { customersApi, type CustomerLookupResult } from '../../api/customers.api.ts';

function formatCnic(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 13);
  if (d.length <= 5)  return d;
  if (d.length <= 12) return `${d.slice(0, 5)}-${d.slice(5)}`;
  return `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}`;
}

const VSTATUS: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  PENDING:      { label: 'Pending',   cls: 'bg-amber-100 text-amber-700',   icon: <Clock size={11} /> },
  UNDER_REVIEW: { label: 'In Review', cls: 'bg-blue-100 text-blue-700',     icon: <Clock size={11} /> },
  APPROVED:     { label: 'Verified',  cls: 'bg-emerald-100 text-emerald-700', icon: <ShieldCheck size={11} /> },
  REJECTED:     { label: 'Rejected',  cls: 'bg-red-100 text-red-600',       icon: <ShieldX size={11} /> },
};

const RISK_CFG: Record<string, { label: string; bar: string; text: string }> = {
  GOOD:      { label: 'Low Risk',   bar: 'bg-emerald-500', text: 'text-emerald-700' },
  AVERAGE:   { label: 'Average',    bar: 'bg-amber-400',   text: 'text-amber-700' },
  RISKY:     { label: 'Risky',      bar: 'bg-orange-500',  text: 'text-orange-700' },
  BLACKLIST: { label: 'Blacklist',  bar: 'bg-red-500',     text: 'text-red-700' },
};

interface Props {
  onFound: (customer: CustomerLookupResult) => void;
  onAddNew?: (prefillCnic: string) => void;
  title?: string;
  subtitle?: string;
}

export default function CnicCustomerLookup({ onFound, onAddNew, title, subtitle }: Props) {
  const [rawCnic, setRawCnic]     = useState('');
  const [searchCnic, setSearchCnic] = useState('');

  const digits = rawCnic.replace(/\D/g, '');
  const isReady = digits.length === 13;

  const { data, isFetching, isError } = useQuery({
    queryKey: ['cnic-lookup-staff', searchCnic],
    queryFn:  () => customersApi.lookup(searchCnic),
    enabled:  searchCnic.length === 13,
    retry:    false,
  });

  const customer = data?.ownRecord ?? null;
  const searched = searchCnic.length === 13;

  function handleSearch() {
    if (!isReady) return;
    setSearchCnic(digits);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSearch();
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Header */}
      {(title || subtitle) && (
        <div className="mb-6 text-center">
          {title   && <h2 className="text-lg font-bold text-gray-900">{title}</h2>}
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
      )}

      {/* CNIC input */}
      <div className="flex gap-2 mb-5">
        <div className="relative flex-1">
          <input
            type="text"
            value={rawCnic}
            onChange={(e) => {
              const formatted = formatCnic(e.target.value);
              setRawCnic(formatted);
              if (formatted !== rawCnic) setSearchCnic(''); // reset on change
            }}
            onKeyDown={handleKeyDown}
            placeholder="35202-XXXXXXX-X"
            maxLength={15}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-sm font-mono tracking-wider outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition placeholder:font-sans placeholder:tracking-normal"
          />
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
        <button
          onClick={handleSearch}
          disabled={!isReady || isFetching}
          className="px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition flex items-center gap-2 shrink-0"
        >
          {isFetching ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
          Search
        </button>
      </div>

      {/* CNIC format hint */}
      {digits.length > 0 && digits.length < 13 && (
        <p className="text-xs text-amber-600 mb-4 flex items-center gap-1.5">
          <AlertTriangle size={11} /> {13 - digits.length} more digits needed
        </p>
      )}

      {/* Error */}
      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 mb-4">
          Search failed. Check your connection and try again.
        </div>
      )}

      {/* Found */}
      {searched && !isFetching && customer && (
        <div className="border border-emerald-200 bg-emerald-50/50 rounded-2xl overflow-hidden">
          {/* Customer card */}
          <div className="flex items-start gap-4 p-4">
            {customer.photoUrl ? (
              <img src={customer.photoUrl} alt="" loading="lazy"
                className="w-14 h-14 rounded-xl object-cover shrink-0 ring-2 ring-white shadow" />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-xl shrink-0 shadow">
                {customer.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <p className="text-base font-bold text-gray-900">{customer.name}</p>
                {(() => {
                  const vs = VSTATUS[customer.verificationStatus] ?? VSTATUS.PENDING;
                  return (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${vs.cls}`}>
                      {vs.icon} {vs.label}
                    </span>
                  );
                })()}
              </div>
              <p className="text-sm text-gray-500">{customer.phone}</p>
              <p className="text-xs text-gray-400 font-mono mt-0.5">{customer.cnicMasked}</p>
              {customer.employer && (
                <p className="text-xs text-gray-400 mt-0.5">{customer.employer}</p>
              )}
            </div>
          </div>

          {/* Credit score mini bar */}
          {(() => {
            const creditScore = 100 - customer.riskScore;
            const r = RISK_CFG[customer.riskLabel] ?? RISK_CFG.GOOD;
            return (
              <div className="px-4 pb-3 flex items-center gap-3">
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide shrink-0">Credit</span>
                <div className="flex-1 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                  <div className={`h-full rounded-full ${r.bar}`} style={{ width: `${creditScore}%` }} />
                </div>
                <span className={`text-xs font-bold tabular-nums ${r.text}`}>{creditScore}/100</span>
                <span className={`text-[10px] font-semibold ${r.text}`}>{r.label}</span>
              </div>
            );
          })()}

          {/* Action */}
          <div className="px-4 pb-4">
            <button
              onClick={() => onFound(customer)}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={15} />
              Select This Customer
            </button>
          </div>
        </div>
      )}

      {/* Not found */}
      {searched && !isFetching && !customer && !isError && (
        <div className="border border-gray-200 bg-gray-50 rounded-2xl p-5 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <UserX size={22} className="text-gray-400" />
          </div>
          <p className="text-sm font-semibold text-gray-700 mb-1">Customer not found</p>
          <p className="text-xs text-gray-400 mb-4">
            This CNIC is not registered in the system.
          </p>
          {onAddNew && (
            <button
              onClick={() => onAddNew(rawCnic)}
              className="px-5 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold rounded-xl transition"
            >
              + Register New Customer
            </button>
          )}
        </div>
      )}
    </div>
  );
}
