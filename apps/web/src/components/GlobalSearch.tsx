import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search, X, Users, CreditCard, Package, Loader2, AlertOctagon,
  ChevronRight, Phone, MapPin,
} from 'lucide-react';
import { searchApi, type SearchResults } from '../api/search.api.ts';

const STATUS_COLOR: Record<string, string> = {
  ACTIVE:    'bg-green-100 text-green-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
  DEFAULTED: 'bg-red-100 text-red-700',
  PENDING:   'bg-yellow-100 text-yellow-700',
  CANCELLED: 'bg-gray-100 text-gray-600',
  CLOSED:    'bg-gray-100 text-gray-600',
};

function pkr(v: string | number) {
  return 'PKR ' + Number(v).toLocaleString('en-PK', { maximumFractionDigits: 0 });
}

function useDebounce(value: string, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function GlobalSearch({ open, onClose }: Props) {
  const [q, setQ] = useState('');
  const debouncedQ = useDebounce(q, 300);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const { data, isFetching } = useQuery<SearchResults>({
    queryKey: ['global-search', debouncedQ],
    queryFn:  () => searchApi.search(debouncedQ),
    enabled:  debouncedQ.trim().length >= 2,
    staleTime: 10_000,
  });

  const hasResults = data && (
    data.customers.length > 0 || data.installments.length > 0 || data.products.length > 0
  );

  const go = useCallback((path: string) => { navigate(path); onClose(); }, [navigate, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-16 px-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <Search className="w-5 h-5 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search customers, installments, products, IMEI…"
            className="flex-1 text-sm outline-none bg-transparent text-gray-800 placeholder-gray-400"
          />
          {isFetching && <Loader2 className="w-4 h-4 text-indigo-500 animate-spin shrink-0" />}
          {q && !isFetching && (
            <button onClick={() => setQ('')} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block text-xs text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">Esc</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {!debouncedQ || debouncedQ.trim().length < 2 ? (
            <div className="py-10 text-center text-sm text-gray-400">
              Type at least 2 characters to search
            </div>
          ) : isFetching && !data ? (
            <div className="py-10 text-center text-sm text-gray-400">Searching…</div>
          ) : !hasResults ? (
            <div className="py-10 text-center text-sm text-gray-400">
              No results for "<span className="font-medium text-gray-600">{debouncedQ}</span>"
            </div>
          ) : (
            <div className="divide-y divide-gray-50">

              {/* Customers */}
              {(data?.customers.length ?? 0) > 0 && (
                <div>
                  <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                    <Users className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Customers</span>
                  </div>
                  {data!.customers.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => go(`/customers/${c.id}`)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 transition-colors group text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-sm font-semibold shrink-0">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-800 truncate">{c.name}</span>
                          {c.isBlacklisted && (
                            <AlertOctagon className="w-3.5 h-3.5 text-red-500 shrink-0" aria-label="Blacklisted" />
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                          <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>
                          {c.area && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{c.area}</span>}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              {/* Installments */}
              {(data?.installments.length ?? 0) > 0 && (
                <div>
                  <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                    <CreditCard className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Installments</span>
                  </div>
                  {data!.installments.map((inst) => (
                    <button
                      key={inst.id}
                      onClick={() => go(`/installments/${inst.id}`)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-emerald-50 transition-colors group text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                        <CreditCard className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-800 truncate">{inst.customerName}</span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${STATUS_COLOR[inst.status] ?? 'bg-gray-100 text-gray-600'}`}>
                            {inst.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                          <span>{inst.productName}</span>
                          <span>Remaining: {pkr(inst.remaining)}</span>
                          {inst.invoiceNumber && <span className="text-indigo-500">{inst.invoiceNumber}</span>}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-emerald-400 shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              {/* Products */}
              {(data?.products.length ?? 0) > 0 && (
                <div>
                  <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                    <Package className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Products</span>
                  </div>
                  {data!.products.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => go(`/products`)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-amber-50 transition-colors group text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                        <Package className="w-4 h-4 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-gray-800 truncate block">{p.name}</span>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                          <span>{pkr(p.price)}</span>
                          <span className={p.stock > 0 ? 'text-green-600' : 'text-red-500'}>
                            {p.stock > 0 ? `${p.stock} in stock` : 'Out of stock'}
                          </span>
                          {p.category && <span>{p.category}</span>}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-amber-400 shrink-0" />
                    </button>
                  ))}
                  <div className="h-2" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
