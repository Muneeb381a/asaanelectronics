import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Search, X, User, Phone, MapPin, ShieldCheck, ShieldX, Clock,
  CreditCard, AlertTriangle, CheckCircle2, ChevronRight, Building2, Store,
} from 'lucide-react';
import {
  customersApi,
  type CustomerLookupResult,
  type CustomerLookupInstallment,
  type BureauData,
  type LookupResponse,
} from '../api/customers.api.ts';

// ── helpers ───────────────────────────────────────────────────────────────────
function formatCnic(digits: string): string {
  if (digits.length <= 5)  return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

function pkr(v: string | number) {
  return 'PKR ' + Number(v).toLocaleString('en-PK', { maximumFractionDigits: 0 });
}

function monthsLeft(inst: CustomerLookupInstallment): number {
  const start   = new Date(inst.startDate).getTime();
  const elapsed = Math.floor((Date.now() - start) / (1000 * 60 * 60 * 24 * 30.44));
  return Math.max(0, inst.months - elapsed);
}

// ── config ────────────────────────────────────────────────────────────────────
const RISK_CFG = {
  GOOD:      { label: 'Low Risk',   bar: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle2 size={11} /> },
  AVERAGE:   { label: 'Average',    bar: 'bg-amber-400',   badge: 'bg-amber-100 text-amber-700',     icon: <Clock size={11} /> },
  RISKY:     { label: 'Risky',      bar: 'bg-orange-500',  badge: 'bg-orange-100 text-orange-700',   icon: <AlertTriangle size={11} /> },
  BLACKLIST: { label: 'Blacklist',  bar: 'bg-red-500',     badge: 'bg-red-100 text-red-700',         icon: <ShieldX size={11} /> },
} as const;

const VSTATUS_CFG = {
  PENDING:      { label: 'Pending',   cls: 'bg-gray-100 text-gray-500' },
  UNDER_REVIEW: { label: 'In Review', cls: 'bg-blue-100 text-blue-700' },
  APPROVED:     { label: 'Verified',  cls: 'bg-emerald-100 text-emerald-700' },
  REJECTED:     { label: 'Rejected',  cls: 'bg-red-100 text-red-600' },
} as const;

const LIFECYCLE_CFG: Record<string, { label: string; cls: string }> = {
  LEAD:     { label: 'Lead',     cls: 'bg-gray-100 text-gray-500' },
  VERIFIED: { label: 'Verified', cls: 'bg-blue-100 text-blue-700' },
  ACTIVE:   { label: 'Active',   cls: 'bg-emerald-100 text-emerald-700' },
  AT_RISK:  { label: 'At Risk',  cls: 'bg-amber-100 text-amber-700' },
  DEFAULT:  { label: 'Default',  cls: 'bg-red-100 text-red-600' },
  CLOSED:   { label: 'Closed',   cls: 'bg-gray-100 text-gray-400' },
  REPEAT:   { label: 'Repeat',   cls: 'bg-purple-100 text-purple-700' },
};

const INST_STATUS_CFG: Record<string, { label: string; cls: string }> = {
  PENDING:   { label: 'Pending',   cls: 'text-gray-400' },
  ACTIVE:    { label: 'Active',    cls: 'text-emerald-600' },
  COMPLETED: { label: 'Completed', cls: 'text-blue-600' },
  DEFAULTED: { label: 'Defaulted', cls: 'text-red-600' },
  CANCELLED: { label: 'Cancelled', cls: 'text-gray-400' },
  CLOSED:    { label: 'Closed',    cls: 'text-gray-500' },
};

// ── bureau section ────────────────────────────────────────────────────────────
function bureauCreditScore(b: BureauData): number {
  let score = 100;
  score -= b.totalDefaulted * 25;
  if (b.totalActive > 3)      score -= 15;
  else if (b.totalActive > 1) score -= 8;
  if (b.totalCompleted > 0)   score += 5;
  return Math.max(0, Math.min(100, score));
}

function bureauScoreMeta(score: number): { label: string; bar: string; text: string; bg: string } {
  if (score >= 80) return { label: 'Good',      bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' };
  if (score >= 60) return { label: 'Average',   bar: 'bg-amber-400',   text: 'text-amber-700',   bg: 'bg-amber-50'   };
  if (score >= 40) return { label: 'Risky',     bar: 'bg-orange-500',  text: 'text-orange-700',  bg: 'bg-orange-50'  };
  return                  { label: 'High Risk', bar: 'bg-red-500',     text: 'text-red-700',     bg: 'bg-red-50'     };
}

function BureauSection({ bureau }: { bureau: BureauData | null }) {
  const isClean   = !bureau || (bureau.totalActive === 0 && bureau.totalDefaulted === 0);
  const hasRisk   = bureau && bureau.totalDefaulted > 0;
  const hasActive = bureau && bureau.totalActive > 0;
  const score     = bureau ? bureauCreditScore(bureau) : 100;
  const scoreMeta = bureauScoreMeta(score);

  return (
    <div className="px-5 pb-4">
      {/* Bureau header with credit score */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
          <Store size={11} /> Bureau Check
        </p>
        <div className={`flex items-center gap-2 px-2.5 py-1 rounded-lg ${scoreMeta.bg} border border-current/10`}>
          <div className="w-14 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${scoreMeta.bar}`} style={{ width: `${score}%` }} />
          </div>
          <span className={`text-[11px] font-bold tabular-nums ${scoreMeta.text}`}>{score}</span>
          <span className={`text-[10px] font-semibold ${scoreMeta.text}`}>{scoreMeta.label}</span>
        </div>
      </div>

      {isClean && (
        <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-100 rounded-xl px-3.5 py-3">
          <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
            <CheckCircle2 size={15} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-700">Saaf Record</p>
            <p className="text-xs text-emerald-600 mt-0.5">Kisi aur shop mein active installment nahi</p>
          </div>
        </div>
      )}

      {!isClean && bureau && (
        <div className={`rounded-xl border overflow-hidden ${hasRisk ? 'border-red-200 bg-red-50/60' : 'border-amber-200 bg-amber-50/60'}`}>
          {/* Summary row */}
          <div className={`flex items-center gap-3 px-3.5 py-2.5 border-b ${hasRisk ? 'border-red-100' : 'border-amber-100'}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${hasRisk ? 'bg-red-100' : 'bg-amber-100'}`}>
              <AlertTriangle size={14} className={hasRisk ? 'text-red-600' : 'text-amber-600'} />
            </div>
            <div className="flex-1">
              <p className={`text-sm font-semibold ${hasRisk ? 'text-red-700' : 'text-amber-700'}`}>
                {hasRisk
                  ? `${bureau.totalDefaulted} default${bureau.totalDefaulted > 1 ? 's' : ''} — High Risk`
                  : `${bureau.totalActive} active installment${bureau.totalActive > 1 ? 's' : ''} elsewhere`
                }
              </p>
              <p className={`text-xs mt-0.5 ${hasRisk ? 'text-red-500' : 'text-amber-600'}`}>
                {hasActive && `${pkr(bureau.totalRemaining)} remaining`}
                {!hasActive && hasRisk && 'Previous defaults recorded'}
              </p>
            </div>
          </div>

          {/* Per-record breakdown — shop name hidden for privacy */}
          <div className="divide-y divide-white/60">
            {bureau.shops.map((shop, i) => (
              <div key={i} className="flex items-center gap-3 px-3.5 py-2">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-[9px] font-bold ${
                  shop.defaultedCount > 0 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'
                }`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-gray-500">
                    {shop.activeCount > 0 && <span className="text-emerald-600 font-medium">{shop.activeCount} active</span>}
                    {shop.activeCount > 0 && shop.defaultedCount > 0 && <span className="mx-1">·</span>}
                    {shop.defaultedCount > 0 && <span className="text-red-600 font-medium">{shop.defaultedCount} defaulted</span>}
                    {shop.completedCount > 0 && (
                      <span className="text-gray-400">
                        {(shop.activeCount > 0 || shop.defaultedCount > 0) && ' · '}
                        {shop.completedCount} completed
                      </span>
                    )}
                  </p>
                </div>
                {shop.activeCount > 0 && (
                  <span className="text-[10px] font-semibold text-gray-600 shrink-0 tabular-nums">
                    {pkr(shop.totalRemaining)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── own record section ────────────────────────────────────────────────────────
function OwnRecord({ customer, onNavigate }: { customer: CustomerLookupResult; onNavigate: (path: string) => void }) {
  const risk   = RISK_CFG[customer.riskLabel];
  const vs     = VSTATUS_CFG[customer.verificationStatus as keyof typeof VSTATUS_CFG] ?? VSTATUS_CFG.PENDING;
  const lc     = LIFECYCLE_CFG[customer.lifecycleStage] ?? { label: customer.lifecycleStage, cls: 'bg-gray-100 text-gray-500' };
  const active = customer.installments.filter((i) => i.status === 'ACTIVE');
  const all    = customer.installments;

  return (
    <>
      {/* Header */}
      <div className="flex items-start gap-4 px-5 pt-5 pb-4">
        {customer.photoUrl ? (
          <img src={customer.photoUrl} alt="" loading="lazy" className="w-14 h-14 rounded-2xl object-cover shrink-0 ring-2 ring-gray-100" />
        ) : (
          <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-xl shrink-0">
            {customer.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold text-gray-900">{customer.name}</h3>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${lc.cls}`}>{lc.label}</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${vs.cls}`}>{vs.label}</span>
          </div>
          <p className="text-sm text-gray-500 font-mono tracking-wide mt-0.5">{customer.cnicMasked}</p>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-gray-400"><Phone size={11} />{customer.phone}</span>
            {customer.employer && <span className="flex items-center gap-1 text-xs text-gray-400"><Building2 size={11} />{customer.employer}</span>}
            {customer.address  && <span className="flex items-center gap-1 text-xs text-gray-400 truncate max-w-44"><MapPin size={11} />{customer.address}</span>}
          </div>
        </div>
      </div>

      {/* Risk score */}
      <div className="px-5 pb-4">
        <div className="bg-gray-50 rounded-xl p-3.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Credit Score — Is Shop</span>
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${risk.badge}`}>
              {risk.icon}{risk.label}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
              <div className={`h-full rounded-full ${risk.bar}`} style={{ width: `${100 - customer.riskScore}%` }} />
            </div>
            <span className="text-sm font-bold text-gray-700 tabular-nums w-12 text-right">
              {100 - customer.riskScore}<span className="text-xs font-normal text-gray-400">/100</span>
            </span>
          </div>
        </div>
      </div>

      {/* Installments */}
      {all.length > 0 && (
        <div className="px-5 pb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Is Shop ki Installments
            {active.length > 0 && <span className="ml-1.5 text-emerald-600">{active.length} active</span>}
          </p>
          <div className="space-y-2">
            {all.slice(0, 4).map((inst) => {
              const left = monthsLeft(inst);
              const st   = INST_STATUS_CFG[inst.status] ?? { label: inst.status, cls: 'text-gray-400' };
              return (
                <div key={inst.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                  <div className="w-7 h-7 rounded-lg bg-white border border-gray-100 flex items-center justify-center shrink-0">
                    <CreditCard size={13} className="text-indigo-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{inst.productName}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {pkr(inst.monthly)}/mo ·{' '}
                      {inst.status === 'ACTIVE'
                        ? `${left} mah baqi · ${pkr(inst.remaining)} due`
                        : pkr(inst.totalAmount)}
                    </p>
                  </div>
                  <span className={`text-[10px] font-semibold shrink-0 ${st.cls}`}>{st.label}</span>
                </div>
              );
            })}
            {all.length > 4 && (
              <p className="text-[10px] text-gray-400 text-center">+{all.length - 4} installments aur hain</p>
            )}
          </div>
        </div>
      )}

      {all.length === 0 && (
        <div className="px-5 pb-4">
          <div className="bg-gray-50 rounded-xl px-4 py-3 text-center">
            <p className="text-xs text-gray-400">Is shop mein koi installment nahi</p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 px-5 pb-5">
        <button
          onClick={() => onNavigate('/customers')}
          className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl py-2.5 transition-colors"
        >
          <User size={14} /> Profile dekhen
        </button>
        <button
          onClick={() => onNavigate(`/installments?customerId=${customer.id}`)}
          className="flex-1 flex items-center justify-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl py-2.5 transition-colors"
        >
          <CreditCard size={14} /> Installments <ChevronRight size={13} />
        </button>
      </div>
    </>
  );
}

// ── ghost card (bureau only — not in this shop) ───────────────────────────────
function GhostRecord({ cnicMasked }: { cnicMasked: string }) {
  return (
    <div className="flex items-start gap-4 px-5 pt-5 pb-4">
      <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center shrink-0">
        <User size={24} className="text-gray-300" />
      </div>
      <div className="flex-1 min-w-0 pt-1">
        <p className="text-sm font-semibold text-gray-700">Is shop mein registered nahi</p>
        <p className="text-xs text-gray-500 font-mono mt-0.5">{cnicMasked}</p>
        <p className="text-xs text-gray-400 mt-1">Doosri shops ka data neeche dekhen</p>
      </div>
    </div>
  );
}

// ── full result view ──────────────────────────────────────────────────────────
function ResultView({ result, cnicDigits, onNavigate }: {
  result: LookupResponse;
  cnicDigits: string;
  onNavigate: (path: string) => void;
}) {
  const { ownRecord, bureau } = result;
  const notFound = !ownRecord && !bureau;

  if (notFound) {
    return (
      <div className="py-10 text-center">
        <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <User size={22} className="text-gray-300" />
        </div>
        <p className="text-sm font-medium text-gray-600">Customer nahi mila</p>
        <p className="text-xs text-gray-400 mt-1">Kisi bhi shop mein is CNIC ka record nahi</p>
      </div>
    );
  }

  // Derive a masked CNIC for display when no own record
  const maskedCnic = ownRecord?.cnicMasked ?? `XXXXX-XXXXXXX-${cnicDigits.slice(-1)}`;

  return (
    <div className="animate-in fade-in slide-in-from-top-2 duration-200">
      {ownRecord
        ? <OwnRecord customer={ownRecord} onNavigate={onNavigate} />
        : <GhostRecord cnicMasked={maskedCnic} />
      }
      <div className="border-t border-gray-100 mx-5 mb-4" />
      <BureauSection bureau={bureau} />
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────
interface Props { open: boolean; onClose: () => void }

export default function GlobalSearch({ open, onClose }: Props) {
  const [raw, setRaw]   = useState('');
  const inputRef        = useRef<HTMLInputElement>(null);
  const navigate        = useNavigate();

  const cnicDigits = raw.replace(/\D/g, '');
  const ready      = cnicDigits.length === 13;

  const { data: result, isFetching, isLoading } = useQuery({
    queryKey: ['cnic-lookup', cnicDigits],
    queryFn:  () => customersApi.lookup(cnicDigits),
    enabled:  ready,
    staleTime: 60_000,
    retry: false,
  });

  const searching = ready && (isFetching || isLoading);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 13);
    setRaw(formatCnic(digits));
  }, []);

  const handleClose = useCallback(() => { setRaw(''); onClose(); }, [onClose]);

  const handleNavigate = useCallback((path: string) => {
    navigate(path);
    handleClose();
  }, [navigate, handleClose]);

  useEffect(() => {
    if (open) { setRaw(''); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [open, handleClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[10vh]"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl shadow-black/20 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Search bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
          {searching
            ? <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin shrink-0" />
            : <Search size={18} className="text-gray-400 shrink-0" />
          }
          <input
            ref={inputRef}
            type="text"
            value={raw}
            onChange={handleInput}
            placeholder="CNIC number drj kren — 35202-1234567-1"
            className="flex-1 text-sm text-gray-800 placeholder-gray-400 bg-transparent outline-none font-mono"
          />
          <div className="flex items-center gap-2 shrink-0">
            {raw && (
              <button onClick={() => setRaw('')} className="text-gray-300 hover:text-gray-500 transition-colors">
                <X size={16} />
              </button>
            )}
            <kbd className="hidden sm:flex px-1.5 py-0.5 bg-gray-100 text-gray-400 text-[10px] rounded font-mono">Esc</kbd>
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto">
          {!ready && !raw && (
            <div className="py-10 text-center">
              <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <ShieldCheck size={22} className="text-indigo-500" />
              </div>
              <p className="text-sm font-semibold text-gray-700">Customer Bureau Check</p>
              <p className="text-xs text-gray-400 mt-1">CNIC enter kren — tamam shops ka record check hoga</p>
            </div>
          )}

          {!ready && raw && (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-400">
                {13 - cnicDigits.length} aur digit{13 - cnicDigits.length !== 1 ? 's' : ''} chahiye
              </p>
            </div>
          )}

          {searching && (
            <div className="py-10 text-center">
              <p className="text-sm text-gray-400 animate-pulse">Tamam shops check ho rahi hain…</p>
            </div>
          )}

          {ready && !searching && result && (
            <ResultView result={result} cnicDigits={cnicDigits} onNavigate={handleNavigate} />
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-50 flex items-center justify-between">
          <span className="text-[10px] text-gray-300">Ctrl+K · Esc</span>
          <span className="text-[10px] text-gray-300 font-mono">{cnicDigits.length}/13</span>
        </div>
      </div>
    </div>
  );
}
