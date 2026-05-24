import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ShieldCheck, LogOut, ChevronDown, ChevronUp,
  CreditCard, CheckCircle2, Clock, XCircle,
  Phone, MapPin, Briefcase, User, Calendar, Package, TrendingUp,
} from 'lucide-react';
import { portalApi, type PortalInstallment, type PortalPayment } from '../../api/portal.api.ts';
import { usePortalStore } from '../../store/portal.store.ts';

// ── helpers ────────────────────────────────────────────────────────────────────

function pkr(v: number) {
  return 'PKR ' + v.toLocaleString('en-PK', { maximumFractionDigits: 0 });
}

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Verification status pipeline ───────────────────────────────────────────────

const VSTEPS = ['PENDING', 'UNDER_REVIEW', 'APPROVED'] as const;
const VSTEP_META = {
  PENDING:      { label: 'Applied',     icon: Clock },
  UNDER_REVIEW: { label: 'Under Review', icon: ShieldCheck },
  APPROVED:     { label: 'Verified',    icon: CheckCircle2 },
  REJECTED:     { label: 'Rejected',    icon: XCircle },
};

const LIFECYCLE_META: Record<string, { label: string; color: string; bg: string }> = {
  LEAD:     { label: 'Applied',      color: 'text-slate-600',   bg: 'bg-slate-100'   },
  VERIFIED: { label: 'Verified',     color: 'text-blue-700',    bg: 'bg-blue-100'    },
  ACTIVE:   { label: 'Active',       color: 'text-emerald-700', bg: 'bg-emerald-100' },
  AT_RISK:  { label: 'At Risk',      color: 'text-amber-700',   bg: 'bg-amber-100'   },
  DEFAULT:  { label: 'Defaulted',    color: 'text-red-700',     bg: 'bg-red-100'     },
  CLOSED:   { label: 'Plan Closed',  color: 'text-gray-600',    bg: 'bg-gray-100'    },
  REPEAT:   { label: 'Repeat Customer', color: 'text-violet-700', bg: 'bg-violet-100' },
};

function StatusPipeline({ status }: { status: string }) {
  const isRejected = status === 'REJECTED';

  if (isRejected) return (
    <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
      <XCircle size={18} className="text-red-500 shrink-0" />
      <div>
        <p className="text-sm font-semibold text-red-700">Application Rejected</p>
        <p className="text-xs text-red-500 mt-0.5">Contact the shop for more details</p>
      </div>
    </div>
  );

  const activeIdx = VSTEPS.indexOf(status as typeof VSTEPS[number]);

  return (
    <div className="flex items-center gap-1">
      {VSTEPS.map((step, i) => {
        const Icon     = VSTEP_META[step].icon;
        const done     = i <= activeIdx;
        const active   = i === activeIdx;
        const isLast   = i === VSTEPS.length - 1;
        return (
          <div key={step} className="flex items-center gap-1 flex-1">
            <div className="flex flex-col items-center flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                done ? (active ? 'bg-blue-600 shadow-md shadow-blue-200' : 'bg-emerald-500') : 'bg-gray-100'
              }`}>
                <Icon size={15} className={done ? 'text-white' : 'text-gray-400'} />
              </div>
              <p className={`text-[10px] font-medium mt-1 text-center leading-tight ${done ? 'text-gray-700' : 'text-gray-400'}`}>
                {VSTEP_META[step].label}
              </p>
            </div>
            {!isLast && (
              <div className={`h-0.5 w-6 rounded-full mb-3 shrink-0 ${i < activeIdx ? 'bg-emerald-400' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Credit score gauge ─────────────────────────────────────────────────────────

function creditMeta(score: number): { label: string; color: string; stroke: string } {
  if (score >= 80) return { label: 'Excellent', color: 'text-emerald-600', stroke: '#10b981' };
  if (score >= 60) return { label: 'Good',      color: 'text-blue-600',    stroke: '#3b82f6' };
  if (score >= 40) return { label: 'Fair',       color: 'text-amber-600',   stroke: '#f59e0b' };
  return               { label: 'Poor',      color: 'text-red-600',     stroke: '#ef4444' };
}

function CreditScoreCard({ score }: { score: number }) {
  const r    = 44;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const meta = creditMeta(score);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={14} className="text-gray-400" />
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Credit Score</p>
      </div>
      <div className="flex items-center gap-5">
        <div className="relative shrink-0">
          <svg width="100" height="100" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r={r} fill="none" stroke="#f1f5f9" strokeWidth="10" />
            <circle
              cx="50" cy="50" r={r} fill="none"
              stroke={meta.stroke} strokeWidth="10"
              strokeDasharray={`${fill} ${circ}`}
              strokeDashoffset={circ * 0.25}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 0.6s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-xl font-black ${meta.color}`}>{score}</span>
            <span className="text-[9px] text-gray-400 font-medium">/100</span>
          </div>
        </div>
        <div className="flex-1">
          <p className={`text-lg font-bold ${meta.color}`}>{meta.label}</p>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
            Based on payment history, verification status, and guarantor coverage.
          </p>
          <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${score}%`, background: meta.stroke }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Installment card ───────────────────────────────────────────────────────────

const INST_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING:   { label: 'Pending',   cls: 'bg-amber-100 text-amber-700'   },
  ACTIVE:    { label: 'Active',    cls: 'bg-emerald-100 text-emerald-700' },
  COMPLETED: { label: 'Completed', cls: 'bg-blue-100 text-blue-700'     },
  DEFAULTED: { label: 'Defaulted', cls: 'bg-red-100 text-red-700'       },
  CANCELLED: { label: 'Cancelled', cls: 'bg-gray-100 text-gray-500'     },
};

function PaymentRow({ p, monthly }: { p: PortalPayment; monthly: number }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <div>
        <p className="text-xs font-medium text-gray-700">{fmtDate(p.paidOn)}</p>
        <p className="text-[10px] text-gray-400 capitalize">{p.method.toLowerCase().replace('_', ' ')}</p>
      </div>
      <span className={`text-xs font-semibold ${Number(p.amount) >= monthly ? 'text-emerald-600' : 'text-amber-600'}`}>
        {pkr(Number(p.amount))}
      </span>
    </div>
  );
}

function InstallmentCard({ inst }: { inst: PortalInstallment }) {
  const [expanded, setExpanded] = useState(false);
  const statusMeta = INST_STATUS[inst.status] ?? INST_STATUS['PENDING'];

  const { data: payments, isLoading: loadingPay } = useQuery({
    queryKey: ['portal-payments', inst.id],
    queryFn:  () => portalApi.payments(inst.id),
    enabled:  expanded,
    staleTime: 60_000,
  });

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-gray-900 truncate">{inst.productName}</p>
              {inst.productBrand && <span className="text-[10px] text-gray-400">{inst.productBrand}</span>}
            </div>
            {inst.invoiceNumber && (
              <p className="text-[10px] text-gray-400 font-mono mt-0.5">{inst.invoiceNumber}</p>
            )}
          </div>
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${statusMeta.cls}`}>
            {statusMeta.label}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <div className="flex justify-between text-[10px] text-gray-400 mb-1">
            <span>{inst.paidMonths}/{inst.totalMonths} installments</span>
            <span>{inst.progressPct}%</span>
          </div>
          <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                inst.status === 'COMPLETED' ? 'bg-blue-500'
                : inst.status === 'DEFAULTED' ? 'bg-red-500'
                : 'bg-emerald-500'
              }`}
              style={{ width: `${inst.progressPct}%` }}
            />
          </div>
        </div>

        {/* Amounts grid */}
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: 'Monthly',   value: pkr(inst.monthly),       sub: 'installment' },
            { label: 'Paid',      value: pkr(inst.amountPaid),    sub: 'total' },
            { label: 'Remaining', value: pkr(inst.remaining),     sub: 'balance', red: inst.remaining > 0 && inst.status === 'ACTIVE' },
          ].map((item) => (
            <div key={item.label} className={`rounded-xl p-2 ${item.red ? 'bg-red-50' : 'bg-gray-50'}`}>
              <p className={`text-sm font-bold ${item.red ? 'text-red-600' : 'text-gray-800'}`}>{item.value}</p>
              <p className="text-[10px] text-gray-400">{item.label}</p>
            </div>
          ))}
        </div>

        {/* Dates */}
        <div className="flex items-center justify-between mt-3 text-[11px] text-gray-400">
          <span className="flex items-center gap-1"><Calendar size={11} /> Started {fmtDate(inst.startDate)}</span>
          {inst.status === 'ACTIVE' && (
            <span className="flex items-center gap-1"><Clock size={11} /> Due {fmtDate(inst.dueDate)}</span>
          )}
        </div>
      </div>

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 border-t border-gray-50 text-xs text-blue-600 hover:bg-blue-50 transition font-medium"
      >
        {expanded ? <><ChevronUp size={13} /> Hide payments</> : <><ChevronDown size={13} /> View payment history</>}
      </button>

      {/* Payment history */}
      {expanded && (
        <div className="px-4 pb-3 border-t border-gray-50">
          {loadingPay ? (
            <div className="py-4 space-y-2">
              {[1,2,3].map((i) => <div key={i} className="h-8 bg-gray-100 rounded-lg animate-pulse" />)}
            </div>
          ) : !payments?.length ? (
            <p className="text-center text-xs text-gray-400 py-4">No payments recorded yet</p>
          ) : (
            <div className="pt-1">
              {payments.map((p) => <PaymentRow key={p.id} p={p} monthly={inst.monthly} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main dashboard ─────────────────────────────────────────────────────────────

export default function PortalDashboardPage() {
  const navigate = useNavigate();
  const session  = usePortalStore((s) => s.session);
  const logout   = usePortalStore((s) => s.logout);

  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ['portal-me'],
    queryFn:  portalApi.me,
    staleTime: 60_000,
  });

  const { data: installments = [], isLoading: loadingInst } = useQuery({
    queryKey: ['portal-installments'],
    queryFn:  portalApi.installments,
    staleTime: 60_000,
  });

  function handleLogout() {
    logout();
    navigate('/portal', { replace: true });
  }

  const lm      = profile ? (LIFECYCLE_META[profile.lifecycleStage] ?? LIFECYCLE_META['LEAD']) : null;
  const active  = installments.filter((i) => i.status === 'ACTIVE');
  const done    = installments.filter((i) => i.status !== 'ACTIVE');

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Top bar */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center">
              <ShieldCheck size={16} className="text-white" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-900 leading-tight">{session?.shopName ?? 'Customer Portal'}</p>
              <p className="text-[10px] text-gray-400 leading-tight">{session?.name}</p>
            </div>
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-500 transition font-medium">
            <LogOut size={13} /> Logout
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-5">

        {/* Profile + status */}
        {loadingProfile ? (
          <div className="bg-white rounded-2xl p-5 space-y-3 animate-pulse">
            <div className="h-5 w-40 bg-gray-100 rounded" />
            <div className="h-3 w-24 bg-gray-100 rounded" />
            <div className="h-16 bg-gray-100 rounded-xl mt-4" />
          </div>
        ) : profile && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            {/* Name + lifecycle */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
                    <User size={17} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-gray-900">{profile.name}</p>
                    <p className="text-xs text-gray-400 font-mono">{profile.cnicMasked}</p>
                  </div>
                </div>
              </div>
              {lm && (
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${lm.bg} ${lm.color}`}>
                  {lm.label}
                </span>
              )}
            </div>

            {/* Contact info */}
            <div className="space-y-1.5 text-xs text-gray-600">
              <div className="flex items-center gap-2"><Phone size={11} className="text-gray-400" />{profile.phone}</div>
              {profile.address && <div className="flex items-center gap-2"><MapPin size={11} className="text-gray-400" />{profile.address}</div>}
              {profile.occupation && (
                <div className="flex items-center gap-2">
                  <Briefcase size={11} className="text-gray-400" />
                  {profile.occupation}{profile.employer ? ` @ ${profile.employer}` : ''}
                </div>
              )}
            </div>

            {/* Verification pipeline */}
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Application Status</p>
              <StatusPipeline status={profile.verificationStatus} />
            </div>
          </div>
        )}

        {/* Credit score */}
        {profile && <CreditScoreCard score={profile.creditScore} />}

        {/* Summary stat cards */}
        {profile && (
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Total Paid',      value: pkr(profile.totalPaid),      icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Remaining',       value: pkr(profile.totalRemaining),  icon: CreditCard,   color: 'text-blue-600',    bg: 'bg-blue-50'    },
              { label: 'Active Plans',    value: String(profile.activeCount),  icon: Package,      color: 'text-violet-600',  bg: 'bg-violet-50'  },
              { label: 'Next Due',        value: profile.nextDue ? fmtDate(profile.nextDue) : 'None',
                icon: Calendar, color: profile.nextDue ? 'text-amber-600' : 'text-gray-400', bg: profile.nextDue ? 'bg-amber-50' : 'bg-gray-50' },
            ].map((c) => (
              <div key={c.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className={`w-8 h-8 ${c.bg} rounded-xl flex items-center justify-center mb-2`}>
                  <c.icon size={15} className={c.color} />
                </div>
                <p className="text-[10px] text-gray-400 font-medium">{c.label}</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5 leading-tight">{c.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Installment plans */}
        <div>
          <h2 className="text-sm font-bold text-gray-700 mb-3">
            My Installment Plans
            {installments.length > 0 && <span className="ml-2 text-gray-400 font-normal">({installments.length})</span>}
          </h2>

          {loadingInst ? (
            <div className="space-y-3">
              {[1, 2].map((i) => <div key={i} className="h-48 bg-white rounded-2xl border border-gray-100 animate-pulse" />)}
            </div>
          ) : !installments.length ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
              <Package size={28} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm text-gray-400">No installment plans yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {active.length > 0 && (
                <>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Active</p>
                  {active.map((inst) => <InstallmentCard key={inst.id} inst={inst} />)}
                </>
              )}
              {done.length > 0 && (
                <>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mt-2">History</p>
                  {done.map((inst) => <InstallmentCard key={inst.id} inst={inst} />)}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-gray-300 pb-4 flex items-center justify-center gap-1">
          <ShieldCheck size={11} /> Secured · {profile?.shopName}
        </p>
      </div>
    </div>
  );
}
