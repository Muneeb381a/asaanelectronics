import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search, X, Users, CreditCard, Package, Loader2, AlertOctagon,
  ChevronRight, Phone, MapPin, ShieldAlert, CheckCircle2, Clock, Star,
} from 'lucide-react';
import { searchApi, type SearchResults } from '../api/search.api.ts';

const STATUS_META: Record<string, { label: string; cls: string; dot: string }> = {
  ACTIVE:    { label: 'Active',    cls: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  COMPLETED: { label: 'Complete',  cls: 'bg-blue-100 text-blue-700',       dot: 'bg-blue-500'    },
  DEFAULTED: { label: 'Default',   cls: 'bg-red-100 text-red-700',         dot: 'bg-red-500'     },
  PENDING:   { label: 'Pending',   cls: 'bg-amber-100 text-amber-700',     dot: 'bg-amber-400'   },
  CANCELLED: { label: 'Cancelled', cls: 'bg-gray-100 text-gray-500',       dot: 'bg-gray-300'    },
  CLOSED:    { label: 'Closed',    cls: 'bg-gray-100 text-gray-500',       dot: 'bg-gray-300'    },
};

const LIFECYCLE_META: Record<string, { label: string; cls: string }> = {
  LEAD:     { label: 'Lead',     cls: 'bg-slate-100 text-slate-500'    },
  VERIFIED: { label: 'Verified', cls: 'bg-blue-100 text-blue-700'      },
  ACTIVE:   { label: 'Active',   cls: 'bg-emerald-100 text-emerald-700'},
  AT_RISK:  { label: 'At Risk',  cls: 'bg-amber-100 text-amber-700'    },
  DEFAULT:  { label: 'Default',  cls: 'bg-red-100 text-red-700'        },
  CLOSED:   { label: 'Closed',   cls: 'bg-gray-100 text-gray-500'      },
  REPEAT:   { label: 'Repeat',   cls: 'bg-violet-100 text-violet-700'  },
};

function pkr(v: string | number) {
  return 'PKR ' + Number(v).toLocaleString('en-PK', { maximumFractionDigits: 0 });
}

function acsLabel(score: number): { label: string; cls: string; bar: string } {
  if (score >= 90) return { label: 'Excellent',       cls: 'text-emerald-700 bg-emerald-50 border-emerald-200', bar: 'bg-emerald-500' };
  if (score >= 75) return { label: 'Good',             cls: 'text-blue-700 bg-blue-50 border-blue-200',         bar: 'bg-blue-500' };
  if (score >= 55) return { label: 'Average',          cls: 'text-amber-700 bg-amber-50 border-amber-200',      bar: 'bg-amber-400' };
  if (score >= 35) return { label: 'Risky',            cls: 'text-orange-700 bg-orange-50 border-orange-200',   bar: 'bg-orange-500' };
  return             { label: 'Very High Risk',  cls: 'text-red-700 bg-red-50 border-red-200',           bar: 'bg-red-500' };
}

function useDebounce(value: string, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

// Auto-format input as CNIC (XXXXX-XXXXXXX-X) when user types only digits.
// If input has letters, return as-is (normal text search).
function formatIfCnic(raw: string): string {
  const digits = raw.replace(/-/g, '');
  if (!/^\d*$/.test(digits) || digits.length > 13) return raw;
  if (digits.length === 0) return '';
  if (digits.length <= 5)  return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
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
    data.customers.length > 0 || data.installments.length > 0 ||
    data.products.length > 0  || (data.bureau?.length ?? 0) > 0
  );

  const isCnicQuery = /^\d{13}$/.test(debouncedQ.replace(/-/g, ''));
  const bureauEmpty = !isFetching && isCnicQuery && data != null && (data.bureau?.length ?? 0) === 0;

  const go = useCallback((path: string, state?: Record<string, string>) => {
    navigate(path, state ? { state } : undefined);
    onClose();
  }, [navigate, onClose]);

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
            onChange={(e) => setQ(formatIfCnic(e.target.value))}
            placeholder="Name, phone, CNIC (35202-…), IMEI…"
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
                  <div className="flex items-center gap-2 px-4 pt-3 pb-2">
                    <Users className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Customers</span>
                    <span className="ml-auto text-[10px] text-gray-400">{data!.customers.length} result{data!.customers.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="px-3 pb-2 space-y-1">
                    {data!.customers.map((c) => {
                      const lm = LIFECYCLE_META[c.lifecycleStage] ?? LIFECYCLE_META['LEAD']!;
                      return (
                        <button
                          key={c.id}
                          onClick={() => go('/customers', { openCustomerId: c.id })}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-indigo-50 active:bg-indigo-100 transition-colors group text-left border border-transparent hover:border-indigo-100"
                        >
                          {/* Avatar */}
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm" style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)' }}>
                            {c.name.charAt(0).toUpperCase()}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                              <span className="text-sm font-semibold text-gray-900 truncate">{c.name}</span>
                              {c.fileNumber && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-600 border border-indigo-200 font-mono shrink-0">#{c.fileNumber}</span>
                              )}
                              {c.isBlacklisted && (
                                <span className="flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-600 border border-red-200 shrink-0">
                                  <AlertOctagon className="w-2.5 h-2.5" />DO NOT SELL
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${lm.cls}`}>{lm.label}</span>
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <Phone className="w-2.5 h-2.5 text-gray-400" />{c.phone}
                              </span>
                              {c.area && (
                                <span className="text-xs text-gray-400 flex items-center gap-1">
                                  <MapPin className="w-2.5 h-2.5" />{c.area}
                                </span>
                              )}
                              <span className="text-[10px] font-mono text-gray-400">{c.cnicMasked}</span>
                            </div>
                          </div>

                          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 shrink-0 transition-colors" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Installments */}
              {(data?.installments.length ?? 0) > 0 && (
                <div>
                  <div className="flex items-center gap-2 px-4 pt-3 pb-2">
                    <CreditCard className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Installments</span>
                    <span className="ml-auto text-[10px] text-gray-400">{data!.installments.length} result{data!.installments.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="px-3 pb-2 space-y-1">
                    {data!.installments.map((inst) => {
                      const sm = STATUS_META[inst.status] ?? STATUS_META['PENDING']!;
                      const total = Number(inst.totalAmount);
                      const remaining = Number(inst.remaining);
                      const pct = total > 0 ? Math.round(((total - remaining) / total) * 100) : 0;
                      const isDaily = inst.paymentFrequency === 'daily';
                      return (
                        <button
                          key={inst.id}
                          onClick={() => go('/customers', { openCustomerId: inst.customerId })}
                          className="w-full px-3 py-2.5 rounded-xl hover:bg-emerald-50 active:bg-emerald-100 transition-colors group text-left border border-transparent hover:border-emerald-100"
                        >
                          {/* Row 1: name + badges + status */}
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                              <span className="text-sm font-semibold text-gray-900 truncate">{inst.customerName}</span>
                              {inst.customerFileNumber && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-600 border border-indigo-200 font-mono shrink-0">#{inst.customerFileNumber}</span>
                              )}
                              {isDaily && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 border border-orange-200 shrink-0">Daily</span>
                              )}
                            </div>
                            <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${sm.cls}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${sm.dot} shrink-0`} />
                              {sm.label}
                            </span>
                          </div>

                          {/* Row 2: product + invoice */}
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs text-gray-600 font-medium truncate">{inst.productName}</span>
                            {inst.invoiceNumber && (
                              <span className="text-[10px] text-indigo-400 font-mono shrink-0">{inst.invoiceNumber}</span>
                            )}
                            {inst.imeiNumber && (
                              <span className="text-[10px] text-gray-400 font-mono shrink-0 truncate">IMEI: {inst.imeiNumber}</span>
                            )}
                          </div>

                          {/* Row 3: amounts + progress */}
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
                                <span>Baki: <span className={`font-bold ${remaining > 0 ? 'text-orange-500' : 'text-emerald-600'}`}>{pkr(remaining)}</span></span>
                                <span className="font-mono">{pct}% paid</span>
                              </div>
                              <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-1 rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-emerald-500 shrink-0 transition-colors" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Bureau empty state — shown when CNIC searched but no cross-shop history found */}
              {bureauEmpty && (data?.customers.length ?? 0) + (data?.installments.length ?? 0) === 0 && (
                <div className="px-4 py-6 text-center">
                  <ShieldAlert className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 font-medium">No cross-shop history found</p>
                  <p className="text-xs text-gray-400 mt-0.5">Koi doosri shop mein is CNIC ka record nahi mila</p>
                </div>
              )}
              {bureauEmpty && ((data?.customers.length ?? 0) + (data?.installments.length ?? 0)) > 0 && (
                <div className="mx-4 my-2 px-3 py-2 bg-green-50 border border-green-100 rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  <p className="text-xs text-green-700">Is CNIC ki koi doosri shop mein history nahi — bureau clear hai</p>
                </div>
              )}

              {/* Cross-shop Bureau + ACS Score */}
              {(data?.bureau?.length ?? 0) > 0 && (() => {
                const score = data!.acsScore ?? 100;
                const acs   = acsLabel(score);
                const totalDefaults  = data!.bureau.reduce((s, b) => s + b.defaultedCount, 0);
                const totalCompleted = data!.bureau.reduce((s, b) => s + b.completedCount, 0);
                const totalActive    = data!.bureau.reduce((s, b) => s + b.activeCount, 0);
                const totalRemaining = data!.bureau.reduce((s, b) => s + Number(b.totalRemaining), 0);
                return (
                  <div>
                    {/* ACS Score Card */}
                    <div className={`mx-4 mt-3 mb-2 rounded-xl border p-3 ${acs.cls}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <Star className="w-3.5 h-3.5" />
                          <span className="text-[11px] font-bold uppercase tracking-wider">Assaan Credit Score</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-black">{score}</span>
                          <span className="text-xs font-semibold opacity-60">/ 100</span>
                        </div>
                      </div>
                      {/* Score bar */}
                      <div className="w-full h-1.5 rounded-full bg-black/10 mb-2">
                        <div className={`h-1.5 rounded-full transition-all ${acs.bar}`} style={{ width: `${score}%` }} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">{acs.label}</span>
                        <div className="flex items-center gap-3 text-[11px] opacity-80">
                          {totalCompleted > 0 && <span><CheckCircle2 className="w-3 h-3 inline mr-0.5" />{totalCompleted} complete</span>}
                          {totalActive    > 0 && <span><Clock       className="w-3 h-3 inline mr-0.5" />{totalActive} active</span>}
                          {totalDefaults  > 0 && <span><AlertOctagon className="w-3 h-3 inline mr-0.5" />{totalDefaults} default</span>}
                          {totalRemaining > 0 && <span>{pkr(totalRemaining)} baki</span>}
                        </div>
                      </div>
                    </div>

                    {/* Per-shop breakdown header */}
                    <div className="flex items-center gap-2 px-4 pt-1 pb-1">
                      <ShieldAlert className="w-3.5 h-3.5 text-orange-500" />
                      <span className="text-xs font-semibold text-orange-600 uppercase tracking-wide">Shop-wise History</span>
                      <span className="text-[10px] text-orange-400 ml-auto">{data!.bureau.length} shop{data!.bureau.length !== 1 ? 's' : ''}</span>
                    </div>

                    {/* Per-shop rows */}
                    {data!.bureau.map((b, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-2.5 bg-orange-50/40 border-l-2 border-orange-200">
                        <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-xs font-semibold shrink-0">
                          {b.customerName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-gray-800 truncate">{b.customerName}</span>
                            {b.cnicMasked && <span className="font-mono text-[10px] text-gray-400">{b.cnicMasked}</span>}
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-0.5 flex-wrap">
                            <span className="font-medium text-orange-600">{b.shopName}</span>
                            <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{b.customerPhone}</span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] mt-0.5 flex-wrap">
                            {b.activeCount    > 0 && <span className="text-blue-600"><Clock        className="w-3 h-3 inline mr-0.5" />{b.activeCount} active · {pkr(b.totalRemaining)} baki</span>}
                            {b.defaultedCount > 0 && <span className="text-red-600 font-semibold"><AlertOctagon className="w-3 h-3 inline mr-0.5" />{b.defaultedCount} default</span>}
                            {b.completedCount > 0 && <span className="text-emerald-600"><CheckCircle2 className="w-3 h-3 inline mr-0.5" />{b.completedCount} complete</span>}
                            {b.activeCount === 0 && b.defaultedCount === 0 && b.completedCount === 0 && <span className="text-gray-400">Koi installment nahi</span>}
                          </div>
                        </div>
                      </div>
                    ))}

                    {totalDefaults > 0 && (
                      <div className="mx-4 mb-2 mt-1 p-2 bg-red-50 border border-red-100 rounded-lg">
                        <p className="text-[10px] text-red-600 text-center font-medium">
                          ⚠️ Is customer ne kisi shop mein default kiya hai — approve karne se pehle carefully review karein
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}

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
