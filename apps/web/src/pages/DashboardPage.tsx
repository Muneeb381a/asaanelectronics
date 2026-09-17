import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../utils/error.ts';
import {
  X, Send, CheckCircle, Wallet, Clock, ChevronRight, Plus, Gift, Package, Bell, Users,
  ArrowUpRight, CheckSquare, TrendingUp, AlertTriangle, BadgeCheck, MessageCircle, Receipt,
  CalendarDays, Target, Activity,
} from 'lucide-react';
import { useAuthStore } from '../store/auth.store.ts';
import { statsApi } from '../api/stats.api.ts';
import { installmentsApi } from '../api/installments.api.ts';
import { recoveryApi } from '../api/recovery.api.ts';
import { sellersApi } from '../api/sellers.api.ts';
import { customersApi } from '../api/customers.api.ts';
import { handoversApi, type StaffBalance } from '../api/handovers.api.ts';
import { RowSkeleton, BlockSkeleton } from '../components/ui/Skeleton.tsx';
import { fmtDate } from '../utils/dateFormat.ts';

/* ─── helpers ────────────────────────────────────────────────────────────── */
const pkr   = (v: number) => 'PKR ' + v.toLocaleString('en-PK', { maximumFractionDigits: 0 });
const pkrSh = (v: number) => {
  if (v >= 10_00_000) return `${(v / 10_00_000).toFixed(1)}M`;
  if (v >= 1_00_000)  return `${(v / 1_00_000).toFixed(v % 1_00_000 === 0 ? 0 : 1)}L`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(v % 1_000 === 0 ? 0 : 1)}K`;
  return String(v);
};
const greet = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Subah Bakhair' : h < 17 ? 'Adaab' : 'Shaam Bakhair';
};
const waLink = (phone: string, msg: string) =>
  `https://wa.me/92${phone.replace(/^0/, '').replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;

/* ─── primitives ─────────────────────────────────────────────────────────── */
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm ${className}`}>{children}</section>;
}

function CardHead({ title, subtitle, action, icon: Icon, tone = 'gray' }: {
  title: string; subtitle?: string; action?: React.ReactNode;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  tone?: 'gray' | 'blue' | 'red' | 'amber' | 'emerald' | 'violet' | 'pink';
}) {
  const tones: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-600', blue: 'bg-blue-50 text-blue-600', red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600', emerald: 'bg-emerald-50 text-emerald-600', violet: 'bg-violet-50 text-violet-600',
    pink: 'bg-pink-50 text-pink-600',
  };
  return (
    <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
      <div className="flex items-center gap-3 min-w-0">
        {Icon && <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tones[tone]}`}><Icon size={15} /></div>}
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-gray-900 leading-tight truncate">{title}</h2>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5 truncate">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

function LinkBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-0.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition">
      {children} <ChevronRight size={13} />
    </button>
  );
}

function Avatar({ name, tone = 'blue' }: { name: string; tone?: 'blue' | 'red' | 'amber' | 'violet' | 'emerald' | 'pink' | 'gray' }) {
  const tones: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700', red: 'bg-red-50 text-red-700', amber: 'bg-amber-50 text-amber-700',
    violet: 'bg-violet-50 text-violet-700', emerald: 'bg-emerald-50 text-emerald-700', pink: 'bg-pink-50 text-pink-700',
    gray: 'bg-gray-100 text-gray-600',
  };
  return <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${tones[tone]}`}>{name[0]?.toUpperCase() ?? '?'}</div>;
}

function WaButton({ phone, msg, label }: { phone: string; msg: string; label?: string }) {
  return (
    <a href={waLink(phone, msg)} target="_blank" rel="noopener noreferrer" title="WhatsApp"
      className="shrink-0 h-9 min-w-9 px-2.5 inline-flex items-center justify-center gap-1 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] text-white text-xs font-semibold transition">
      <MessageCircle size={14} />{label}
    </a>
  );
}

function StatCard({ label, value, sub, icon: Icon, tone, onClick, progress }: {
  label: string; value: string; sub?: React.ReactNode;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone: 'blue' | 'emerald' | 'amber' | 'red' | 'violet' | 'gray';
  onClick?: () => void; progress?: number | null;
}) {
  const tones: Record<string, { icon: string; bar: string }> = {
    blue:    { icon: 'bg-blue-600 text-white',    bar: 'bg-blue-600'    },
    emerald: { icon: 'bg-emerald-600 text-white', bar: 'bg-emerald-600' },
    amber:   { icon: 'bg-amber-500 text-white',   bar: 'bg-amber-500'   },
    red:     { icon: 'bg-red-600 text-white',     bar: 'bg-red-600'     },
    violet:  { icon: 'bg-violet-600 text-white',  bar: 'bg-violet-600'  },
    gray:    { icon: 'bg-gray-700 text-white',    bar: 'bg-gray-700'    },
  };
  const t = tones[tone]!;
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className={`text-left bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm p-4 flex flex-col gap-3 ${onClick ? 'hover:ring-blue-300 hover:shadow-md transition' : ''}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500">{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${t.icon}`}><Icon size={15} /></div>
      </div>
      <p className="text-2xl font-bold text-gray-900 tabular-nums leading-none">{value}</p>
      {progress !== undefined && progress !== null ? (
        <div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${t.bar}`} style={{ width: `${Math.min(100, progress)}%` }} />
          </div>
          {sub && <p className="text-[11px] text-gray-500 mt-1.5">{sub}</p>}
        </div>
      ) : (
        sub && <p className="text-[11px] text-gray-500">{sub}</p>
      )}
    </Tag>
  );
}

function SectionLabel({ tone, children, right }: { tone: 'violet' | 'red' | 'blue' | 'amber'; children: React.ReactNode; right?: React.ReactNode }) {
  const t: Record<string, string> = { violet: 'bg-violet-50 text-violet-700', red: 'bg-red-50 text-red-700', blue: 'bg-blue-50 text-blue-700', amber: 'bg-amber-50 text-amber-700' };
  return (
    <div className={`px-5 py-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider ${t[tone]}`}>
      <span>{children}</span>{right}
    </div>
  );
}

/* ─── Cash receive modal (owner confirms cash from staff) ────────────────── */
function CashReceiveModal({ target, onClose }: { target: StaffBalance; onClose: () => void }) {
  const qc  = useQueryClient();
  const sys = Number(target.pendingBalance);
  const [amt,  setAmt]  = useState(target.pendingHandover ? target.pendingHandover.handedAmount : String(sys));
  const [note, setNote] = useState('');
  const mut = useMutation({
    mutationFn: () => handoversApi.directReceive({ staffId: target.staffId, amount: Number(amt), note: note.trim() || undefined }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['handover-pending-balances'] });
      toast.success(`${target.staffName} se ${pkr(Number(amt))} receive ho gaye`);
      onClose();
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e, 'Masla ho gaya')),
  });
  const diff = Number(amt) - sys;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
          <div>
            <p className="font-semibold text-gray-900 text-sm">Cash receive karein</p>
            <p className="text-xs text-gray-400 mt-0.5">{target.staffName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-blue-50 rounded-xl px-3 py-2.5">
              <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-wide">System</p>
              <p className="text-lg font-bold text-blue-800 tabular-nums">{pkr(sys)}</p>
            </div>
            {target.pendingHandover && (
              <div className="bg-amber-50 rounded-xl px-3 py-2.5">
                <p className="text-[10px] text-amber-600 font-semibold uppercase tracking-wide">Staff ne likha</p>
                <p className="text-lg font-bold text-amber-800 tabular-nums">{pkr(Number(target.pendingHandover.handedAmount))}</p>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Gini hui raqam *</label>
            <input type="number" inputMode="numeric" value={amt} onChange={(e) => setAmt(e.target.value)} autoFocus
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-lg font-bold tabular-nums focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition" />
            {Number(amt) !== sys && Math.abs(diff) >= 1 && (
              <p className={`text-xs mt-1 font-semibold ${diff < 0 ? 'text-red-600' : 'text-amber-600'}`}>{pkr(Math.abs(diff))} {diff < 0 ? 'kam' : 'zyada'}</p>
            )}
          </div>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Note (optional)"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition" />
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold border border-gray-200 rounded-xl hover:bg-gray-50 transition">Cancel</button>
            <button disabled={!amt || Number(amt) <= 0 || mut.isPending} onClick={() => mut.mutate()}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition inline-flex items-center justify-center gap-1.5">
              {mut.isPending ? 'Ho raha…' : <><CheckCircle size={14} /> Receive</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Monthly trend (CSS bars, no chart lib) ─────────────────────────────── */
function TrendBars({ data }: { data: Array<{ label: string; total: number; installments: number; cashSales: number }> }) {
  const max = Math.max(1, ...data.map((m) => m.total));
  const last = data[data.length - 1];
  const prev = data[data.length - 2];
  const delta = prev && prev.total > 0 ? Math.round(((last?.total ?? 0) - prev.total) / prev.total * 100) : null;
  return (
    <div>
      <div className="flex items-end gap-1.5 h-36">
        {data.map((m, i) => {
          const h = Math.max(4, Math.round((m.total / max) * 100));
          const isLast = i === data.length - 1;
          return (
            <div key={m.label} className="flex-1 flex flex-col items-center gap-1.5 group relative">
              <div className="w-full flex items-end" style={{ height: '120px' }}>
                <div className={`w-full rounded-t-md transition-all duration-500 ${isLast ? 'bg-blue-600' : 'bg-blue-200 group-hover:bg-blue-400'}`} style={{ height: `${h}%` }} />
              </div>
              <span className={`text-[10px] ${isLast ? 'text-gray-900 font-semibold' : 'text-gray-400'}`}>{m.label.split(' ')[0]}</span>
              <div className="absolute -top-9 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-900 text-white text-[10px] font-medium px-2 py-1 rounded-md whitespace-nowrap z-10">
                {pkr(m.total)}
              </div>
            </div>
          );
        })}
      </div>
      {last && (
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-gray-500">Is mahine <b className="text-gray-900 tabular-nums">{pkr(last.total)}</b></span>
          {delta !== null && (
            <span className={`font-semibold ${delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{delta >= 0 ? '+' : ''}{delta}% vs pichla mahina</span>
          )}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   DASHBOARD
════════════════════════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const user      = useAuthStore((s) => s.user);
  const navigate  = useNavigate();
  const qc        = useQueryClient();
  const isOwner   = user?.role === 'SELLER_OWNER';
  const perms     = user?.permissions as Record<string, boolean> | null | undefined;
  const firstName = user?.name?.split(' ')[0] ?? 'Aap';

  const [showHandover,  setShowHandover]  = useState(false);
  const [handoverAmt,   setHandoverAmt]   = useState('');
  const [handoverNote,  setHandoverNote]  = useState('');
  const [receiveTarget, setReceiveTarget] = useState<StaffBalance | null>(null);

  /* ── queries ── */
  const { data: myBal } = useQuery<StaffBalance | null>({
    queryKey: ['handover-my-balance'], queryFn: () => handoversApi.myBalance(),
    enabled: !isOwner, staleTime: 30_000, refetchInterval: 120_000,
  });
  const { data: pendingBals = [] } = useQuery<StaffBalance[]>({
    queryKey: ['handover-pending-balances'], queryFn: handoversApi.pendingBalances,
    enabled: isOwner, staleTime: 30_000, refetchInterval: 120_000,
  });
  const submitHandover = useMutation({
    mutationFn: () => handoversApi.create({ handedAmount: Number(handoverAmt), note: handoverNote.trim() || undefined }),
    onSuccess: () => {
      setShowHandover(false); setHandoverAmt(''); setHandoverNote('');
      void qc.invalidateQueries({ queryKey: ['handover-my-balance'] });
      toast.success('Handover submit ho gaya — owner confirm karega');
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e, 'Submit nahi hua')),
  });
  const { data: dash, isLoading } = useQuery({
    queryKey: ['dashboard'], queryFn: statsApi.getDashboard,
    staleTime: 60_000, gcTime: 5 * 60_000, refetchInterval: 5 * 60_000,
  });
  const { data: briefing } = useQuery({
    queryKey: ['daily-briefing'], queryFn: statsApi.getDailyBriefing,
    staleTime: 60_000, gcTime: 5 * 60_000, refetchInterval: 5 * 60_000,
  });
  const { data: staffToday = [] } = useQuery({
    queryKey: ['staff-today-collections'], queryFn: statsApi.getStaffTodayCollections,
    enabled: isOwner, staleTime: 60_000, refetchInterval: 3 * 60_000,
  });
  const pDueCount = dash?.stats?.promisesDueCount ?? 0;
  const { data: promises = [] } = useQuery({
    queryKey: ['promises-due'], queryFn: recoveryApi.promisesDue,
    enabled: pDueCount > 0, staleTime: 60_000,
  });
  const approveMut = useMutation({
    mutationFn: (id: string) => installmentsApi.approve(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['daily-briefing'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Installment approve ho gaya');
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e, 'Masla ho gaya')),
  });
  const { data: shop } = useQuery({ queryKey: ['shop-me'], queryFn: sellersApi.getMe, staleTime: 5 * 60_000 });
  const { data: birthdays = [] } = useQuery({ queryKey: ['upcoming-birthdays'], queryFn: customersApi.getUpcomingBirthdays, staleTime: 60 * 60_000 });

  /* ── derived ── */
  const d              = dash?.stats;
  const reports        = dash?.reports;
  const aging          = reports?.agingBuckets;
  const trend          = reports?.monthlyCollections ?? [];
  const todayTotal     = (d?.todayCollections ?? 0) + (d?.todayCashSales ?? 0);
  const monthTotal     = (d?.monthCollections ?? 0) + (d?.monthCashSales ?? 0);
  const lowStock       = d?.lowStockItems ?? [];
  const completingSoon = d?.completingSoon ?? [];
  const staffCash      = pendingBals.filter((s) => Number(s.pendingBalance) > 0);
  const fieldTotal     = staffCash.reduce((a, s) => a + Number(s.pendingBalance), 0);
  const netFaida       = monthTotal - (d?.monthExpenseTotal ?? 0);
  const dailyTarget    = shop?.settings?.dailyTarget;
  const monthlyTarget  = shop?.settings?.monthlyTarget;
  const dailyPct       = dailyTarget ? Math.round((todayTotal / dailyTarget) * 100) : null;
  const monthPct       = monthlyTarget ? Math.round((monthTotal / monthlyTarget) * 100) : null;
  const bOverdue       = briefing?.overdueTotal ?? 0;
  const bDueToday      = briefing?.dueToday ?? 0;
  const bPending       = isOwner ? (briefing?.pendingApprovalCount ?? 0) : 0;
  const totalWork      = bOverdue + bDueToday + pDueCount + bPending;
  const allClear       = !!briefing && totalWork === 0;
  const overdueCount   = d?.overdueCount ?? 0;
  const totalPending   = (d?.monthlyActiveRemaining ?? 0) + (d?.dailyActiveRemaining ?? 0);
  const agingTotal     = aging ? aging.days0_7 + aging.days8_30 + aging.days31_90 + aging.days90plus : 0;
  const staffTodayMax  = staffToday.length ? Math.max(...staffToday.map((s) => s.total)) : 0;
  const staffTodaySum  = staffToday.reduce((a, s) => a + s.total, 0);
  const myPending      = Number(myBal?.pendingBalance ?? 0);

  return (
    <div className="min-h-full bg-canvas">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">

        {/* ── Greeting + actions ─────────────────────────────────────────── */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-gray-500">{greet()}, {firstName}</p>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight mt-0.5">
              {allClear ? 'Aaj sab clear hai' : briefing ? `${totalWork} kaam aaj ke liye` : 'Dashboard'}
            </h1>
            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1.5"><CalendarDays size={12} /> {fmtDate(new Date())}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {!isOwner && myPending > 0 && (
              <div className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border ${myBal?.pendingHandover ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                <Wallet size={13} /> {pkrSh(myPending)} haath mein {myBal?.pendingHandover && '· pending'}
              </div>
            )}
            {!isOwner && myPending > 0 && !myBal?.pendingHandover && (
              <button onClick={() => { setHandoverAmt(String(myPending)); setShowHandover(true); }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition">
                <Send size={13} /> Cash jama karein
              </button>
            )}
            {(isOwner || perms?.canRecordPayment) && (
              <button onClick={() => navigate('/installments')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold text-gray-700 bg-white ring-1 ring-gray-200 hover:bg-gray-50 transition">
                <Receipt size={14} /> Payment record
              </button>
            )}
            {(isOwner || perms?.canAddInstallment) && (
              <button onClick={() => navigate('/installments')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-600/20 transition">
                <Plus size={14} /> Naya plan
              </button>
            )}
          </div>
        </div>

        {/* ── KPI strip (owner) ──────────────────────────────────────────── */}
        {isOwner && (
          isLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">{[0, 1, 2, 3, 4].map((i) => <BlockSkeleton key={i} className="h-[118px] rounded-2xl" />)}</div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <StatCard label="Aaj ki collection" value={pkrSh(todayTotal)} icon={Wallet} tone="blue" onClick={() => navigate('/installments')}
                progress={dailyPct} sub={dailyPct !== null ? `${dailyPct}% of ${pkrSh(dailyTarget!)} target` : `${d?.todayCashSales ? pkrSh(d.todayCashSales) + ' cash sale' : 'Target set karein → Settings'}`} />
              <StatCard label="Is mahine" value={pkrSh(monthTotal)} icon={TrendingUp} tone="emerald" onClick={() => navigate('/reports')}
                progress={monthPct} sub={monthPct !== null ? `${monthPct}% of ${pkrSh(monthlyTarget!)} target` : <>Kharch ke baad <b className={netFaida >= 0 ? 'text-emerald-700' : 'text-red-600'}>{netFaida >= 0 ? '+' : '-'}{pkrSh(Math.abs(netFaida))}</b></>} />
              <StatCard label="Active plans" value={(d?.activeCount ?? 0).toLocaleString()} icon={BadgeCheck} tone="violet" onClick={() => navigate('/installments')}
                sub={`${d?.monthlyActiveCount ?? 0} mahana · ${d?.dailyActiveCount ?? 0} roz`} />
              <StatCard label="Overdue" value={overdueCount.toLocaleString()} icon={AlertTriangle} tone={overdueCount > 0 ? 'red' : 'gray'} onClick={() => navigate('/recovery')}
                sub={overdueCount > 0 ? `${pkrSh(d?.overdueAmount ?? 0)} late · ${pkrSh(totalPending)} kul baaki` : `Sab time par · ${pkrSh(totalPending)} baaki`} />
              <StatCard label="Customers" value={(d?.totalCustomers ?? 0).toLocaleString()} icon={Users} tone="gray" onClick={() => navigate('/customers')}
                sub={`+${d?.newThisMonthCount ?? 0} naye is mahine`} />
            </div>
          )
        )}

        {/* ── Staff cash card ────────────────────────────────────────────── */}
        {!isOwner && myBal && myPending > 0 && (
          <Card className="p-5 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${myBal.pendingHandover ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}><Wallet size={22} /></div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-500">{myBal.pendingHandover ? 'Handover owner ke confirm ka intezaar' : 'Cash aap ke haath mein'}</p>
              <p className="text-2xl font-bold text-gray-900 tabular-nums">{pkr(myPending)}</p>
            </div>
            {!myBal.pendingHandover && (
              <button onClick={() => { setHandoverAmt(String(myPending)); setShowHandover(true); }}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition shrink-0 inline-flex items-center gap-1.5">
                <Send size={13} /> Jama
              </button>
            )}
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

          {/* ═════ LEFT (2/3) ═════ */}
          <div className="lg:col-span-2 space-y-5">

            {/* Aaj ka kaam */}
            <Card className="overflow-hidden">
              <CardHead icon={CheckSquare} tone={allClear ? 'emerald' : 'blue'} title="Aaj ka kaam"
                subtitle={!briefing ? 'Load ho raha…' : allClear ? 'Koi due, overdue ya wada nahi' : `${totalWork} items`}
                action={briefing && totalWork > 0 && (
                  <div className="flex items-center gap-1 flex-wrap justify-end">
                    {bPending > 0  && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700">{bPending} approve</span>}
                    {bOverdue > 0  && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700">{bOverdue} late</span>}
                    {bDueToday > 0 && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{bDueToday} aaj</span>}
                    {pDueCount > 0 && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">{pDueCount} wada</span>}
                  </div>
                )} />

              {!briefing ? <RowSkeleton rows={5} /> : (
                <div className="divide-y divide-gray-100">
                  {isOwner && briefing.pendingApprovals?.length > 0 && (
                    <div>
                      <SectionLabel tone="violet">Approve karein ({briefing.pendingApprovalCount})</SectionLabel>
                      {briefing.pendingApprovals.map((p) => (
                        <div key={p.id} className="flex items-center gap-3 px-5 py-3 border-t border-gray-50 hover:bg-gray-50/60 transition">
                          <Avatar name={p.customerName} tone="violet" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{p.customerName}</p>
                            <p className="text-[11px] text-gray-500 truncate">{p.productName} · {pkr(p.totalAmount)}</p>
                          </div>
                          <button disabled={approveMut.isPending && approveMut.variables === p.id} onClick={() => approveMut.mutate(p.id)}
                            className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 transition disabled:opacity-50">
                            <CheckSquare size={12} /> {approveMut.isPending && approveMut.variables === p.id ? '…' : 'Approve'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {briefing.urgentAccounts.length > 0 && (
                    <div>
                      <SectionLabel tone="red" right={<LinkBtn onClick={() => navigate('/recovery')}>Recovery</LinkBtn>}>Overdue ({briefing.overdueTotal})</SectionLabel>
                      {briefing.urgentAccounts.map((a) => (
                        <div key={a.id} className="flex items-center gap-3 px-5 py-3 border-t border-gray-50 hover:bg-gray-50/60 transition">
                          <Avatar name={a.customerName} tone="red" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{a.customerName}</p>
                            <p className="text-[11px] text-gray-500">{a.customerPhone}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-gray-900 tabular-nums">{pkr(a.monthly)}</p>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${a.daysOverdue >= 30 ? 'bg-red-100 text-red-800' : 'bg-amber-50 text-amber-700'}`}>{a.daysOverdue} din late</span>
                          </div>
                          <WaButton phone={a.customerPhone} msg={`Assalam-o-Alaikum ${a.customerName}! Aap ki installment ${a.daysOverdue} din se due hai. ${pkr(a.monthly)} jama karwa dein. Shukriya.`} />
                        </div>
                      ))}
                    </div>
                  )}

                  {briefing.dueTodayAccounts.length > 0 && (
                    <div>
                      <SectionLabel tone="blue" right={(briefing.dueTomorrow ?? 0) > 0 ? <span className="normal-case tracking-normal font-medium text-blue-600/70">+{briefing.dueTomorrow} kal</span> : undefined}>
                        Aaj ki qist ({briefing.dueToday})
                      </SectionLabel>
                      {briefing.dueTodayAccounts.slice(0, 20).map((a) => (
                        <div key={a.id} className="flex items-center gap-3 px-5 py-3 border-t border-gray-50 hover:bg-gray-50/60 transition">
                          <Avatar name={a.customerName} tone="blue" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{a.customerName}</p>
                            <p className="text-[11px] text-gray-500">{a.customerPhone}</p>
                          </div>
                          <p className="text-sm font-bold text-blue-700 tabular-nums shrink-0">{pkr(a.monthly)}</p>
                          <WaButton phone={a.customerPhone} msg={`Assalam-o-Alaikum ${a.customerName}! Aaj ki installment ${pkr(a.monthly)} due hai. Jazak'Allah!`} />
                        </div>
                      ))}
                      {briefing.dueTodayAccounts.length > 20 && (
                        <button onClick={() => navigate('/collection-sheet')} className="w-full py-2.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition border-t border-gray-50">
                          +{briefing.dueTodayAccounts.length - 20} aur dekhein
                        </button>
                      )}
                    </div>
                  )}

                  {pDueCount > 0 && promises.length > 0 && (
                    <div>
                      <SectionLabel tone="amber">Aaj ke waday ({pDueCount})</SectionLabel>
                      {promises.slice(0, 6).map((p) => (
                        <div key={p.id} className="flex items-center gap-3 px-5 py-3 border-t border-gray-50 hover:bg-gray-50/60 transition">
                          <Avatar name={p.customerName} tone="amber" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{p.customerName}</p>
                            <p className="text-[11px] text-gray-500 truncate">{p.productName}{p.note ? ` · ${p.note}` : ''}</p>
                          </div>
                          <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full bg-amber-50 text-amber-700"><Bell size={10} /> Wada</span>
                          <WaButton phone={p.customerPhone} msg={`Assalam-o-Alaikum ${p.customerName}! Aap ne aaj payment ka wada kiya tha. Kab tak jama karwa rahe hain? Shukriya.`} />
                        </div>
                      ))}
                    </div>
                  )}

                  {allClear && (
                    <div className="py-14 flex flex-col items-center text-center">
                      <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3"><CheckCircle size={26} /></div>
                      <p className="text-sm font-semibold text-gray-900">Sab clear hai</p>
                      <p className="text-xs text-gray-500 mt-1">Koi due, overdue ya wada nahi. Mashaallah!</p>
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* Trend + staff (owner) */}
            {isOwner && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Card>
                  <CardHead icon={Activity} tone="blue" title="Collection trend" subtitle="Pichlay 12 mahine" action={<LinkBtn onClick={() => navigate('/reports')}>Reports</LinkBtn>} />
                  <div className="p-5">
                    {isLoading ? <BlockSkeleton className="h-40 rounded-xl" /> : trend.length ? <TrendBars data={trend} /> : <p className="text-sm text-gray-400 text-center py-10">Data nahi</p>}
                  </div>
                </Card>

                <Card>
                  <CardHead icon={Users} tone="emerald" title="Staff aaj" subtitle={staffTodaySum > 0 ? `${staffToday.reduce((a, s) => a + s.count, 0)} payments · ${pkr(staffTodaySum)}` : 'Aaj abhi koi collection nahi'} action={<LinkBtn onClick={() => navigate('/staff')}>Staff</LinkBtn>} />
                  <div className="p-3">
                    {isLoading ? <RowSkeleton rows={3} /> : staffToday.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-10">Koi staff nahi</p>
                    ) : staffToday.map((s) => {
                      const pct = staffTodayMax > 0 ? Math.round((s.total / staffTodayMax) * 100) : 0;
                      return (
                        <div key={s.staffId} className="flex items-center gap-3 px-2 py-2.5">
                          <Avatar name={s.staffName} tone={s.total > 0 ? 'emerald' : 'gray'} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-gray-900 truncate">{s.staffName}</p>
                              <p className={`text-sm font-bold tabular-nums ${s.total > 0 ? 'text-gray-900' : 'text-gray-300'}`}>{s.total > 0 ? pkrSh(s.total) : '—'}</p>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1.5">
                              <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>
            )}

            {/* Insights (owner) — collection health, cash expected, debtors, areas */}
            {isOwner && !isLoading && (reports || dash?.advanced) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {reports && (
                  <Card>
                    <CardHead icon={Target} tone="emerald" title="Collection health" subtitle="Tamam plans par ab tak" action={<LinkBtn onClick={() => navigate('/reports')}>Reports</LinkBtn>} />
                    <div className="p-5 space-y-4">
                      <div>
                        <div className="flex items-end justify-between mb-1.5">
                          <p className="text-xs text-gray-500">Collection rate</p>
                          <p className={`text-2xl font-bold tabular-nums ${reports.collectionRate.rate >= 80 ? 'text-emerald-700' : reports.collectionRate.rate >= 60 ? 'text-amber-700' : 'text-red-700'}`}>{reports.collectionRate.rate}%</p>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${reports.collectionRate.rate >= 80 ? 'bg-emerald-500' : reports.collectionRate.rate >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.min(100, reports.collectionRate.rate)}%` }} />
                        </div>
                        <div className="flex justify-between text-[11px] text-gray-500 mt-1.5 tabular-nums">
                          <span>Wasool <b className="text-gray-800">{pkrSh(reports.collectionRate.totalCollected)}</b></span>
                          <span>Baaki <b className="text-gray-800">{pkrSh(reports.collectionRate.totalOutstanding)}</b></span>
                        </div>
                      </div>
                      {dash?.advanced && (
                        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100">
                          <div>
                            <p className="text-[11px] text-gray-500">Recovery efficiency</p>
                            <p className="text-lg font-bold text-gray-900 tabular-nums">{Math.round(dash.advanced.recovery.efficiency)}%</p>
                            <p className="text-[10px] text-gray-400">{dash.advanced.recovery.overdueCount} overdue / defaulted</p>
                          </div>
                          <div>
                            <p className="text-[11px] text-gray-500">Agle 7 din expected</p>
                            <p className="text-lg font-bold text-blue-700 tabular-nums">{pkrSh(dash.advanced.cashflowForecast.slice(0, 7).reduce((a, f) => a + f.expected, 0))}</p>
                            <p className="text-[10px] text-gray-400">30 din: {pkrSh(dash.advanced.cashflowForecast.reduce((a, f) => a + f.expected, 0))}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                )}

                {reports && reports.topDebtors.length > 0 && (
                  <Card>
                    <CardHead icon={AlertTriangle} tone="amber" title="Sab se zyada baaki" subtitle="Top customers by outstanding" action={<LinkBtn onClick={() => navigate('/customers')}>Customers</LinkBtn>} />
                    <div className="divide-y divide-gray-50">
                      {reports.topDebtors.slice(0, 5).map((t, i) => (
                        <div key={t.phone + i} className="flex items-center gap-3 px-5 py-2.5">
                          <span className="text-xs font-semibold text-gray-300 w-4 tabular-nums">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{t.name}</p>
                            <p className="text-[11px] text-gray-500">{t.count} plan{t.count !== 1 ? 's' : ''} · {t.phone}</p>
                          </div>
                          <p className="text-sm font-bold text-gray-900 tabular-nums">{pkrSh(t.remaining)}</p>
                          <WaButton phone={t.phone} msg={`Assalam-o-Alaikum ${t.name}! Aap ka ${pkr(t.remaining)} baaki hai. Meharbani kar ke jald jama karwa dein.`} />
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {dash?.advanced && dash.advanced.areaHeatmap.length > 0 && (
                  <Card className="md:col-span-2">
                    <CardHead icon={Activity} tone="red" title="Ilaqe ke hisaab se overdue" subtitle="Kis area mein recovery ki zaroorat zyada hai" action={<LinkBtn onClick={() => navigate('/collection-sheet')}>Field Sheet</LinkBtn>} />
                    <div className="p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                      {dash.advanced.areaHeatmap.slice(0, 5).map((a) => (
                        <div key={a.city} className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                          <p className="text-xs font-semibold text-gray-700 truncate" title={a.city}>{a.city}</p>
                          <p className="text-xl font-bold text-red-700 tabular-nums mt-1">{a.overdueCount}</p>
                          <p className="text-[10px] text-gray-500">overdue{a.defaultedCount > 0 && <> · <span className="text-red-600">{a.defaultedCount} defaulted</span></>}</p>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            )}

            {/* Recent installments */}
            <Card className="overflow-hidden">
              <CardHead icon={Clock} title="Recent installments" subtitle="Aakhri banaye gaye plans" action={<LinkBtn onClick={() => navigate('/installments')}>Sab</LinkBtn>} />
              {isLoading ? <RowSkeleton rows={5} /> : !d?.recentInstallments.length ? (
                <p className="py-10 text-center text-sm text-gray-400">Abhi koi installment nahi. <button onClick={() => navigate('/installments')} className="font-semibold text-blue-600">Pehla plan banayein</button></p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {d.recentInstallments.map((inst) => {
                    const sc: Record<string, { cls: string; label: string }> = {
                      ACTIVE:    { cls: 'bg-blue-50 text-blue-700',       label: 'Active'    },
                      PENDING:   { cls: 'bg-violet-50 text-violet-700',   label: 'Pending'   },
                      COMPLETED: { cls: 'bg-emerald-50 text-emerald-700', label: 'Complete'  },
                      DEFAULTED: { cls: 'bg-red-50 text-red-700',         label: 'Defaulted' },
                      CANCELLED: { cls: 'bg-gray-100 text-gray-500',      label: 'Cancelled' },
                      CLOSED:    { cls: 'bg-gray-100 text-gray-500',      label: 'Closed'    },
                    };
                    const s = sc[inst.status] ?? { cls: 'bg-gray-100 text-gray-500', label: inst.status };
                    return (
                      <button key={inst.id} onClick={() => navigate('/installments')} className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-gray-50/60 transition">
                        <Avatar name={inst.customerName} tone="blue" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{inst.customerName}</p>
                          <p className="text-[11px] text-gray-500 truncate">{inst.productName} · {fmtDate(inst.createdAt)}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-gray-900 tabular-nums">{pkr(Number(inst.remaining))}</p>
                          <p className="text-[10px] text-gray-400">baaki · {pkrSh(Number(inst.monthly))}/qist</p>
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-1 rounded-full shrink-0 ${s.cls}`}>{s.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* ═════ RIGHT (1/3) ═════ */}
          <div className="space-y-5">

            {isOwner && aging && agingTotal > 0 && (
              <Card>
                <CardHead icon={AlertTriangle} tone="red" title="Overdue breakdown" subtitle={`${agingTotal} accounts`} action={<LinkBtn onClick={() => navigate('/recovery')}>Recovery</LinkBtn>} />
                <div className="p-5 space-y-3">
                  {([
                    { label: '1–7 din',   v: aging.days0_7,    bar: 'bg-amber-400'  },
                    { label: '8–30 din',  v: aging.days8_30,   bar: 'bg-orange-500' },
                    { label: '31–90 din', v: aging.days31_90,  bar: 'bg-red-500'    },
                    { label: '90+ din',   v: aging.days90plus, bar: 'bg-red-800'    },
                  ]).map((b) => (
                    <div key={b.label}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-600 font-medium">{b.label}</span>
                        <span className={`font-bold tabular-nums ${b.v > 0 ? 'text-gray-900' : 'text-gray-300'}`}>{b.v}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${b.bar}`} style={{ width: `${agingTotal ? Math.round((b.v / agingTotal) * 100) : 0}%` }} />
                      </div>
                    </div>
                  ))}
                  {aging.days31_90 + aging.days90plus > 0 && (
                    <p className="text-[11px] text-red-700 bg-red-50 rounded-lg px-3 py-2 mt-2">{aging.days31_90 + aging.days90plus} accounts 30+ din se late — fori follow-up karein</p>
                  )}
                </div>
              </Card>
            )}

            {isOwner && (
              <Card>
                <CardHead icon={Target} tone="violet" title="Portfolio" subtitle="Is mahine ka khulasa" />
                <div className="divide-y divide-gray-50">
                  {([
                    { label: 'Naye plans',        value: d?.newThisMonthCount ?? 0,       sub: pkrSh(d?.newThisMonthValue ?? 0),       cls: 'text-blue-700' },
                    { label: 'Mukammal huay',     value: d?.completedThisMonthCount ?? 0, sub: pkrSh(d?.completedThisMonthValue ?? 0), cls: 'text-emerald-700' },
                    { label: 'Khatam hone wale',  value: completingSoon.length,           sub: '1–3 qist baaki',                        cls: 'text-amber-700' },
                    { label: 'Kul baaki',         value: pkrSh(totalPending),             sub: `${d?.activeCount ?? 0} active plans`,   cls: 'text-gray-900' },
                    { label: 'Kharch is mahine',  value: pkrSh(d?.monthExpenseTotal ?? 0), sub: `net ${netFaida >= 0 ? '+' : '-'}${pkrSh(Math.abs(netFaida))}`, cls: 'text-red-700' },
                  ] as Array<{ label: string; value: number | string; sub: string; cls: string }>).map((r) => (
                    <div key={r.label} className="flex items-center justify-between px-5 py-3">
                      <p className="text-xs font-medium text-gray-600">{r.label}</p>
                      <div className="text-right">
                        <p className={`text-sm font-bold tabular-nums ${r.cls}`}>{r.value}</p>
                        <p className="text-[10px] text-gray-400">{r.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {isOwner && staffCash.length > 0 && (
              <Card>
                <CardHead icon={Wallet} tone="amber" title="Cash in field" subtitle="Staff ke paas" action={<span className="text-sm font-bold text-amber-700 tabular-nums">{pkrSh(fieldTotal)}</span>} />
                <div className="divide-y divide-gray-50">
                  {staffCash.map((s) => (
                    <div key={s.staffId} className="flex items-center gap-2.5 px-5 py-3">
                      <Avatar name={s.staffName} tone="amber" />
                      <p className="text-sm font-semibold text-gray-900 flex-1 truncate">{s.staffName}</p>
                      <p className="text-sm font-bold text-gray-900 tabular-nums">{pkrSh(Number(s.pendingBalance))}</p>
                      <button onClick={() => setReceiveTarget(s)}
                        className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition ${s.pendingHandover ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100' : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'}`}>
                        {s.pendingHandover ? 'Confirm' : 'Receive'}
                      </button>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {isOwner && completingSoon.length > 0 && (
              <Card>
                <CardHead icon={BadgeCheck} tone="emerald" title="Khatam hone wale" subtitle="1–3 qist baaki" action={<span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">{completingSoon.length}</span>} />
                <div className="divide-y divide-gray-50">
                  {completingSoon.map((c) => (
                    <div key={c.id} className="flex items-center gap-2.5 px-5 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-gray-900 truncate">{c.customerName}</p>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${c.paymentsLeft === 1 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{c.paymentsLeft} baaki</span>
                        </div>
                        <p className="text-[11px] text-gray-500 truncate mt-0.5">{c.productName} · {pkrSh(c.remaining)}</p>
                      </div>
                      <WaButton phone={c.customerPhone} msg={`Assalam-o-Alaikum ${c.customerName}! Sirf ${c.paymentsLeft} installment baaki hai. Shukriya!`} />
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {lowStock.length > 0 && (
              <Card>
                <CardHead icon={Package} tone="amber" title="Kam stock" subtitle={`${lowStock.length} items`} action={<LinkBtn onClick={() => navigate('/products')}>Products</LinkBtn>} />
                <div className="px-5 py-3 flex flex-wrap gap-1.5">
                  {lowStock.map((p) => (
                    <span key={p.id} className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${p.stock === 0 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{p.name} · {p.stock}</span>
                  ))}
                </div>
              </Card>
            )}

            {birthdays.length > 0 && (
              <Card>
                <CardHead icon={Gift} tone="pink" title="Birthdays" subtitle={`${birthdays.length} is hafte`} />
                <div className="divide-y divide-gray-50">
                  {birthdays.map((c) => {
                    const [, mm, dd] = c.dob.split('-');
                    const isToday = (() => { const t = new Date(); return t.getMonth() + 1 === Number(mm) && t.getDate() === Number(dd); })();
                    return (
                      <div key={c.id} className="flex items-center gap-2.5 px-5 py-3">
                        <Avatar name={c.name} tone="pink" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                            {isToday && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-pink-50 text-pink-700">Aaj</span>}
                          </div>
                          <p className="text-[11px] text-gray-500">{isToday ? 'Aaj birthday hai' : `${dd}/${mm}`}{c.area ? ` · ${c.area}` : ''}</p>
                        </div>
                        <WaButton phone={c.phone} msg={`Assalamu Alaikum ${c.name}! Aap ko salgirah bohat bohat mubarak ho — ${shop?.shopName ?? 'Assaan Electronics'}`} />
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {isOwner && !isLoading && staffCash.length === 0 && completingSoon.length === 0 && lowStock.length === 0 && birthdays.length === 0 && !(aging && agingTotal > 0) && (
              <Card className="p-6 text-center">
                <ArrowUpRight size={22} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">Koi alert nahi — sab theek chal raha hai.</p>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* ── Staff handover modal ───────────────────────────────────────── */}
      {showHandover && !isOwner && (() => {
        const amt  = Number(handoverAmt);
        const diff = amt - myPending;
        return (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">Cash jama karein</p>
                  <p className="text-xs text-gray-400 mt-0.5">Owner ko hand over</p>
                </div>
                <button onClick={() => setShowHandover(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition"><X size={16} /></button>
              </div>
              <div className="p-5 space-y-3">
                <div className="rounded-xl px-4 py-3 bg-blue-50">
                  <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide">System ka hisaab</p>
                  <p className="text-2xl font-bold text-blue-900 tabular-nums">{pkr(myPending)}</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Asal raqam jo de rahe hain *</label>
                  <input type="number" inputMode="numeric" value={handoverAmt} onChange={(e) => setHandoverAmt(e.target.value)} autoFocus
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-xl font-bold tabular-nums focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition" />
                  {handoverAmt && amt !== myPending && (
                    <p className={`text-xs mt-1.5 font-semibold ${diff < 0 ? 'text-red-600' : 'text-amber-600'}`}>{pkr(Math.abs(diff))} {diff < 0 ? 'kam' : 'zyada'}</p>
                  )}
                </div>
                <textarea value={handoverNote} onChange={(e) => setHandoverNote(e.target.value)} rows={2} placeholder="Note (optional)"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition" />
                <div className="flex gap-2">
                  <button onClick={() => setShowHandover(false)} className="flex-1 py-2.5 text-sm font-semibold border border-gray-200 rounded-xl hover:bg-gray-50 transition">Cancel</button>
                  <button disabled={!handoverAmt || amt <= 0 || submitHandover.isPending} onClick={() => submitHandover.mutate()}
                    className="flex-1 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:opacity-50 transition inline-flex items-center justify-center gap-1.5">
                    {submitHandover.isPending ? 'Jama ho raha…' : <><Send size={13} /> Jama karein</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {receiveTarget && <CashReceiveModal target={receiveTarget} onClose={() => setReceiveTarget(null)} />}
    </div>
  );
}
