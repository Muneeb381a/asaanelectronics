import { useState, type ElementType } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  CreditCard, Package, Users, Zap, ShoppingCart,
  Bell, CheckCircle, Send, X, PhoneCall,
  Wallet, Clock, AlertTriangle, ChevronRight, Plus,
  TrendingDown, Activity, Gift, BarChart3,
} from 'lucide-react';
import { useAuthStore } from '../store/auth.store.ts';
import { statsApi } from '../api/stats.api.ts';
import { recoveryApi } from '../api/recovery.api.ts';
import { sellersApi } from '../api/sellers.api.ts';
import { customersApi } from '../api/customers.api.ts';
import { handoversApi, type StaffBalance } from '../api/handovers.api.ts';
import { RowSkeleton } from '../components/ui/Skeleton.tsx';
import { fmtDate } from '../utils/dateFormat.ts';

/* ── helpers ────────────────────────────────────────────────────────────── */
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

const STATUS: Record<string, { bg: string; text: string; label: string }> = {
  ACTIVE:    { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Active'  },
  COMPLETED: { bg: 'bg-blue-50',   text: 'text-blue-700',    label: 'Khatam'  },
  DEFAULTED: { bg: 'bg-red-50',    text: 'text-red-700',     label: 'Overdue' },
  CANCELLED: { bg: 'bg-slate-100', text: 'text-slate-500',   label: 'Cancel'  },
};

/* ── CashReceiveModal ───────────────────────────────────────────────────── */
function CashReceiveModal({ target, onClose }: { target: StaffBalance; onClose: () => void }) {
  const qc  = useQueryClient();
  const sys = Number(target.pendingBalance);
  const [amt,  setAmt]  = useState(target.pendingHandover ? target.pendingHandover.handedAmount : String(sys));
  const [note, setNote] = useState('');
  const mut = useMutation({
    mutationFn: () => handoversApi.directReceive({ staffId: target.staffId, amount: Number(amt), note: note.trim() || undefined }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['handover-pending-balances'] });
      toast.success(`${target.staffName} se ${pkr(Number(amt))} li`);
      onClose();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Masla ho gaya'),
  });
  const diff = Number(amt) - sys;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-slate-950 px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-white font-black text-sm">Cash Receive</p>
            <p className="text-slate-400 text-xs mt-0.5">{target.staffName}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition"><X size={16}/></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-blue-50 rounded-xl px-3 py-2.5">
              <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wide">System</p>
              <p className="text-xl font-black text-blue-700 tabular-nums">{pkr(sys)}</p>
            </div>
            {target.pendingHandover && (
              <div className="bg-amber-50 rounded-xl px-3 py-2.5">
                <p className="text-[10px] text-amber-500 font-bold uppercase tracking-wide">Staff Submit</p>
                <p className="text-xl font-black text-amber-700 tabular-nums">{pkr(Number(target.pendingHandover.handedAmount))}</p>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Gini hui raqam *</label>
            <input type="number" value={amt} onChange={e => setAmt(e.target.value)} autoFocus
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-base font-black tabular-nums focus:outline-none focus:border-emerald-400 transition"/>
            {Number(amt) !== sys && Math.abs(diff) >= 1 && (
              <p className={`text-xs mt-1 font-bold ${diff < 0 ? 'text-red-500' : 'text-amber-500'}`}>
                {pkr(Math.abs(diff))} {diff < 0 ? 'kam' : 'zyada'}
              </p>
            )}
          </div>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Note (optional)"
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-emerald-400 transition"/>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2.5 text-sm font-bold border border-slate-200 rounded-xl hover:bg-slate-50 transition">Wapas</button>
            <button disabled={!amt || Number(amt) <= 0 || mut.isPending} onClick={() => mut.mutate()}
              className="flex-1 py-2.5 text-sm font-black text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition flex items-center justify-center gap-1.5">
              {mut.isPending ? 'Ho raha…' : <><CheckCircle size={14}/> Li</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Portfolio row ──────────────────────────────────────────────────────── */
function PortfolioRow({ label, value, sub, valueColor = 'text-slate-900', onClick }: {
  label: string; value: number | string; sub?: string; valueColor?: string; onClick?: () => void;
}) {
  return (
    <div onClick={onClick}
      className={`flex items-center justify-between px-5 py-3 ${onClick ? 'cursor-pointer hover:bg-slate-50 transition' : ''}`}>
      <p className="text-xs text-slate-500 font-medium">{label}</p>
      <div className="text-right">
        <p className={`text-sm font-black tabular-nums ${valueColor}`}>{value}</p>
        {sub && <p className="text-[10px] text-slate-400 tabular-nums mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN DASHBOARD
══════════════════════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const user     = useAuthStore(s => s.user);
  const navigate = useNavigate();
  const qc       = useQueryClient();
  const isOwner  = user?.role === 'SELLER_OWNER';
  const perms    = user?.permissions as Record<string, boolean> | null | undefined;
  const firstName = user?.name?.split(' ')[0] ?? 'Aap';

  const [showHandover,  setShowHandover]  = useState(false);
  const [handoverAmt,   setHandoverAmt]   = useState('');
  const [handoverNote,  setHandoverNote]  = useState('');
  const [receiveTarget, setReceiveTarget] = useState<StaffBalance | null>(null);

  /* queries */
  const { data: myBal } = useQuery<StaffBalance | null>({
    queryKey: ['handover-my-balance'],
    queryFn:  () => handoversApi.myBalance(),
    enabled:  !isOwner, staleTime: 30_000, refetchInterval: 120_000,
  });
  const { data: pendingBals = [] } = useQuery<StaffBalance[]>({
    queryKey: ['handover-pending-balances'],
    queryFn:  handoversApi.pendingBalances,
    enabled:  isOwner, staleTime: 30_000, refetchInterval: 120_000,
  });
  const submitHandover = useMutation({
    mutationFn: () => handoversApi.create({ handedAmount: Number(handoverAmt), note: handoverNote.trim() || undefined }),
    onSuccess:  () => {
      setShowHandover(false); setHandoverAmt(''); setHandoverNote('');
      void qc.invalidateQueries({ queryKey: ['handover-my-balance'] });
    },
  });
  const { data: dash, isLoading } = useQuery({
    queryKey: ['dashboard'], queryFn: statsApi.getDashboard,
    staleTime: 60_000, gcTime: 5 * 60_000, refetchInterval: 5 * 60_000,
  });
  const { data: briefing } = useQuery({
    queryKey: ['daily-briefing'], queryFn: statsApi.getDailyBriefing,
    staleTime: 60_000, gcTime: 5 * 60_000, refetchInterval: 5 * 60_000,
  });
  const pDueCount = dash?.stats?.promisesDueCount ?? 0;
  const { data: promises = [] } = useQuery({
    queryKey: ['promises-due'], queryFn: recoveryApi.promisesDue,
    enabled: pDueCount > 0, staleTime: 60_000,
  });
  const { data: shop } = useQuery({
    queryKey: ['shop-me'], queryFn: sellersApi.getMe,
    staleTime: 5 * 60_000, enabled: isOwner,
  });
  const { data: birthdays = [] } = useQuery({
    queryKey: ['upcoming-birthdays'], queryFn: customersApi.getUpcomingBirthdays,
    staleTime: 60 * 60_000,
  });

  /* derived */
  const d            = dash?.stats;
  const today        = fmtDate(new Date());
  const todayTotal   = (d?.todayCollections ?? 0) + (d?.todayCashSales ?? 0);
  const monthTotal   = (d?.monthCollections ?? 0) + (d?.monthCashSales ?? 0);
  const lowStock     = d?.lowStockItems ?? [];
  const completingSoon = d?.completingSoon ?? [];
  const staffCash    = pendingBals.filter(s => Number(s.pendingBalance) > 0);
  const fieldTotal   = staffCash.reduce((a, s) => a + Number(s.pendingBalance), 0);
  const netFaida     = monthTotal - (d?.monthExpenseTotal ?? 0);
  const daysInMonth  = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const daysLeft     = daysInMonth - new Date().getDate();
  const monthPct     = d?.monthInstTarget ? Math.min(100, Math.round((d.monthCollections / d.monthInstTarget) * 100)) : 0;
  const dailyTarget  = shop?.settings?.dailyTarget;
  const dailyPct     = dailyTarget ? Math.min(100, Math.round((todayTotal / dailyTarget) * 100)) : 0;

  /* quick actions */
  const actions: { label: string; icon: ElementType; to: string }[] = [
    ...(isOwner || perms?.canAddInstallment ? [{ label: 'Installment', icon: CreditCard,   to: '/installments' }] : []),
    ...(isOwner || perms?.canAddCustomer    ? [{ label: 'Customer',    icon: Users,        to: '/customers'    }] : []),
    ...(isOwner || perms?.canMakeCashSales  ? [{ label: 'Cash Sale',   icon: ShoppingCart, to: '/cash-sales'   }] : []),
    ...(isOwner || perms?.canRecordExpense  ? [{ label: 'Kharcha',     icon: Zap,          to: '/expenses'     }] : []),
    ...(isOwner || perms?.canManageProducts ? [{ label: 'Products',    icon: Package,      to: '/products'     }] : []),
  ];

  /* aaj ka kaam counts */
  const dueTodayCount  = briefing?.dueToday ?? 0;
  const overdueCount   = briefing?.overdueTotal ?? 0;
  const totalPending   = dueTodayCount + overdueCount + pDueCount;
  const allClear       = briefing && totalPending === 0;

  return (
    <div className="flex flex-col min-h-full bg-[#F0F2F8]">

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-30 bg-slate-950">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/5">
          <div>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em] select-none">{today}</p>
            <h1 className="text-[15px] font-black text-white leading-tight mt-0.5">
              {greet()}, <span className="text-blue-400">{firstName}</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Staff: handover status */}
            {!isOwner && myBal && Number(myBal.pendingBalance) > 0 && !myBal.pendingHandover && (
              <button onClick={() => { setHandoverAmt(String(Number(myBal.pendingBalance))); setShowHandover(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl transition">
                <Send size={11}/> Jama Karo
              </button>
            )}
            {!isOwner && myBal?.pendingHandover && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600/20 border border-amber-500/20 text-amber-300 text-xs font-black rounded-xl">
                <Clock size={11}/> Pending Confirm
              </span>
            )}
            {/* Owner: reports */}
            {isOwner && (
              <button onClick={() => navigate('/reports')}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white/8 hover:bg-white/15 text-slate-300 text-xs font-bold rounded-xl transition">
                <BarChart3 size={12}/> Reports
              </button>
            )}
            {/* Primary CTA */}
            {(isOwner || perms?.canAddInstallment) && (
              <button onClick={() => navigate('/installments')}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl transition shadow-sm shadow-blue-900/50">
                <Plus size={12}/> <span className="hidden sm:inline">Naya</span> Installment
              </button>
            )}
          </div>
        </div>

        {/* Quick actions row */}
        {actions.length > 0 && (
          <div className="flex items-center gap-2 px-4 sm:px-6 py-2 overflow-x-auto scrollbar-none">
            {actions.map(a => (
              <button key={a.to} onClick={() => navigate(a.to)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/7 hover:bg-white/15 border border-white/8 text-slate-300 hover:text-white text-xs font-bold rounded-xl whitespace-nowrap transition shrink-0">
                <a.icon size={11}/>
                {a.label}
              </button>
            ))}
            {isOwner && (
              <button onClick={() => navigate('/reports')}
                className="ml-auto sm:hidden flex items-center gap-1 px-3 py-1.5 text-slate-500 text-xs font-bold whitespace-nowrap">
                Report <ChevronRight size={10}/>
              </button>
            )}
          </div>
        )}
      </header>

      {/* ══ STAFF CASH BANNER ══════════════════════════════════════════════ */}
      {!isOwner && myBal && Number(myBal.pendingBalance) > 0 && (
        <div className={`border-b ${myBal.pendingHandover ? 'bg-amber-50 border-amber-200' : 'bg-emerald-600 border-emerald-700'} shrink-0`}>
          <div className="flex items-center justify-between px-5 sm:px-8 py-3.5">
            <div className="flex items-center gap-3">
              <Wallet size={18} className={myBal.pendingHandover ? 'text-amber-600' : 'text-emerald-100'}/>
              <div>
                <p className={`text-xs font-bold ${myBal.pendingHandover ? 'text-amber-600' : 'text-emerald-100'}`}>
                  {myBal.pendingHandover ? 'Handover pending confirmation' : 'Cash in Hand'}
                </p>
                <p className={`text-xl font-black tabular-nums ${myBal.pendingHandover ? 'text-amber-800' : 'text-white'}`}>
                  {pkr(Number(myBal.pendingBalance))}
                </p>
              </div>
            </div>
            {!myBal.pendingHandover && (
              <button onClick={() => { setHandoverAmt(String(Number(myBal.pendingBalance))); setShowHandover(true); }}
                className="flex items-center gap-1.5 px-4 py-2 bg-white text-emerald-700 font-black text-sm rounded-xl hover:bg-emerald-50 transition shrink-0">
                <Send size={13}/> Jama Karein
              </button>
            )}
          </div>
        </div>
      )}

      {/* ══ FINANCIAL COMMAND ZONE (owner only) ════════════════════════════ */}
      {isOwner && (
        <div className="bg-white border-b border-slate-200 shrink-0">
          <div className="px-5 sm:px-8">

            {/* Primary financial row */}
            <div className="py-5 flex flex-col sm:flex-row sm:items-start gap-5 sm:gap-10">

              {/* Monthly number — DOMINANT */}
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.25em] select-none">Is Mahine</p>
                {isLoading ? (
                  <div className="space-y-2 mt-1">
                    <div className="h-12 bg-slate-100 rounded-xl animate-pulse w-40"/>
                    <div className="h-3 bg-slate-100 rounded animate-pulse w-28"/>
                  </div>
                ) : (
                  <>
                    <p className="text-[2.75rem] sm:text-5xl font-black text-slate-900 tabular-nums leading-none mt-1">{pkrSh(monthTotal)}</p>
                    <p className="text-[11px] text-slate-400 mt-2 tabular-nums">
                      Qist <span className="text-slate-600 font-semibold">{pkrSh(d?.monthCollections ?? 0)}</span>
                      <span className="mx-1.5 text-slate-200">·</span>
                      Sale <span className="text-slate-600 font-semibold">{pkrSh(d?.monthCashSales ?? 0)}</span>
                    </p>
                    {(d?.monthInstTarget ?? 0) > 0 && (
                      <div className="mt-3 max-w-xs">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-700 ${monthPct >= 80 ? 'bg-emerald-500' : monthPct >= 50 ? 'bg-blue-500' : 'bg-amber-400'}`}
                              style={{ width: `${monthPct}%` }}/>
                          </div>
                          <span className="text-[11px] font-black text-slate-500 tabular-nums shrink-0">{monthPct}%</span>
                        </div>
                        <p className="text-[10px] text-slate-400 tabular-nums">
                          Target {pkrSh(d!.monthInstTarget!)}
                          {monthTotal > d!.monthInstTarget!
                            ? <span className="text-emerald-600 font-black ml-1">· Exceed!</span>
                            : <span className="ml-1">· {pkrSh(Math.max(0, d!.monthInstTarget! - monthTotal))} aur chahiye</span>
                          }
                          <span className="text-slate-300 mx-1">·</span>
                          <span>{daysLeft} din baaki</span>
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Vertical divider (desktop) */}
              <div className="hidden sm:block w-px bg-slate-100 self-stretch my-1"/>

              {/* Sub-numbers */}
              <div className="flex sm:flex-col gap-5 sm:gap-3.5">
                {[
                  { label: 'Aaj Aya',   val: todayTotal,               cls: 'text-slate-900'  },
                  { label: 'Net Faida', val: Math.abs(netFaida),       cls: netFaida >= 0 ? 'text-emerald-600' : 'text-red-500', pre: netFaida < 0 ? '−' : '' },
                  { label: 'Kharcha',   val: d?.monthExpenseTotal ?? 0, cls: 'text-rose-600'   },
                ].map(({ label, val, cls, pre = '' }) => (
                  <div key={label}>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] select-none">{label}</p>
                    {isLoading
                      ? <div className="h-6 bg-slate-100 rounded-lg animate-pulse w-16 mt-1"/>
                      : <p className={`text-xl sm:text-2xl font-black tabular-nums leading-tight mt-0.5 ${cls}`}>{pre}{pkrSh(val)}</p>
                    }
                  </div>
                ))}
              </div>
            </div>

            {/* Status strip */}
            {!isLoading && (
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 py-3 border-t border-slate-100">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Activity size={11} className="text-blue-500"/>
                  <span><span className="font-black text-slate-800">{d?.activeCount ?? 0}</span> active plans</span>
                </div>

                {(d?.overdueCount ?? 0) > 0 ? (
                  <button onClick={() => navigate('/installments')}
                    className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 font-black transition">
                    <AlertTriangle size={11}/>
                    <span>{d!.overdueCount} overdue · {pkrSh(d!.overdueAmount)} baaki</span>
                    <ChevronRight size={11}/>
                  </button>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                    <CheckCircle size={11}/> Koi overdue nahi
                  </span>
                )}

                {dailyTarget && (
                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 select-none">Roz</span>
                    <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${todayTotal >= dailyTarget ? 'bg-emerald-500' : 'bg-blue-500'}`}
                        style={{ width: `${dailyPct}%` }}/>
                    </div>
                    <span className="text-[10px] font-black text-slate-600 tabular-nums">{dailyPct}%</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ PAGE BODY ═══════════════════════════════════════════════════════ */}
      <div className="flex-1 px-3 sm:px-5 lg:px-6 py-4">
        <div className="lg:grid lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_340px] gap-4 items-start">

          {/* ── LEFT COLUMN ─────────────────────────────────────────── */}
          <div className="space-y-4">

            {/* AAJ KA KAAM ───────────────────────────────────────── */}
            <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden">

              {/* Section header — clean, no dark bg */}
              <div className="flex items-start justify-between px-5 pt-5 pb-4">
                <div>
                  <h2 className="text-[15px] font-black text-slate-900 leading-tight">Aaj Ka Kaam</h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {briefing
                      ? totalPending > 0
                        ? `${totalPending} cheez pending — ${today}`
                        : `Sab clear · ${today}`
                      : today
                    }
                  </p>
                </div>
                {briefing && totalPending > 0 && (
                  <div className="flex gap-1.5 shrink-0 mt-0.5">
                    {dueTodayCount > 0  && <span className="text-[10px] font-black px-2 py-0.5 bg-blue-50  text-blue-600  rounded-lg border border-blue-100">{dueTodayCount} due</span>}
                    {overdueCount > 0   && <span className="text-[10px] font-black px-2 py-0.5 bg-red-50   text-red-600   rounded-lg border border-red-100">{overdueCount} late</span>}
                    {pDueCount > 0      && <span className="text-[10px] font-black px-2 py-0.5 bg-amber-50 text-amber-600 rounded-lg border border-amber-100">{pDueCount} wada</span>}
                  </div>
                )}
              </div>

              {!briefing ? (
                <div className="border-t border-slate-100"><RowSkeleton rows={5}/></div>
              ) : (
                <>
                  {/* ── Due today ── */}
                  {briefing.dueTodayAccounts.length > 0 && (
                    <div className="border-t border-slate-100">
                      <div className="flex items-center justify-between px-5 py-2.5 bg-blue-50">
                        <div className="flex items-center gap-2">
                          <Clock size={12} className="text-blue-600 shrink-0"/>
                          <span className="text-xs font-black text-blue-700">{briefing.dueToday} log aaj milenge</span>
                        </div>
                        {briefing.dueTomorrow > 0 && (
                          <span className="text-[10px] text-blue-400">+{briefing.dueTomorrow} kal</span>
                        )}
                      </div>
                      {briefing.dueTodayAccounts.slice(0, 20).map((acct, i) => (
                        <div key={acct.id}
                          className={`flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition ${i > 0 ? 'border-t border-slate-50' : 'border-t border-blue-50'}`}>
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-xs font-black text-blue-700 shrink-0 select-none">
                            {acct.customerName[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate leading-tight">{acct.customerName}</p>
                            <p className="text-[11px] text-slate-400">{acct.customerPhone}</p>
                          </div>
                          <p className="text-sm font-black text-blue-700 tabular-nums shrink-0 mr-2">{pkr(acct.monthly)}</p>
                          <a href={waLink(acct.customerPhone, `Assalam-o-Alaikum ${acct.customerName}! Aaj ka installment ${pkr(acct.monthly)} due hai. Jazak'Allah!`)}
                            target="_blank" rel="noopener noreferrer"
                            className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-[#25D366] hover:bg-[#1fb859] text-white text-[11px] font-black rounded-xl transition">
                            <PhoneCall size={10}/> WA
                          </a>
                        </div>
                      ))}
                      {briefing.dueTodayAccounts.length > 20 && (
                        <button onClick={() => navigate('/installments')}
                          className="w-full py-2.5 text-xs text-blue-600 font-black border-t border-slate-50 hover:bg-blue-50 transition">
                          +{briefing.dueTodayAccounts.length - 20} aur dekho
                        </button>
                      )}
                    </div>
                  )}

                  {/* ── Overdue ── */}
                  {briefing.urgentAccounts.length > 0 && (
                    <div className="border-t border-slate-100">
                      <div className="flex items-center gap-2 px-5 py-2.5 bg-red-50">
                        <AlertTriangle size={12} className="text-red-500 shrink-0"/>
                        <span className="text-xs font-black text-red-700">{briefing.overdueTotal} overdue — foran call karo</span>
                      </div>
                      {briefing.urgentAccounts.map((acct, i) => {
                        const sev = acct.daysOverdue >= 30 ? 'bg-red-100 text-red-700' : acct.daysOverdue >= 14 ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700';
                        return (
                          <div key={acct.id}
                            className={`flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition ${i > 0 ? 'border-t border-slate-50' : 'border-t border-red-50'}`}>
                            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center text-xs font-black text-red-600 shrink-0 select-none">
                              {acct.customerName[0]?.toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-900 truncate leading-tight">{acct.customerName}</p>
                              <p className="text-[11px] text-slate-400">{acct.customerPhone}</p>
                            </div>
                            <div className="text-right shrink-0 mr-2">
                              <p className="text-sm font-black text-slate-900 tabular-nums">{pkr(acct.monthly)}</p>
                              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-lg ${sev}`}>{acct.daysOverdue}d late</span>
                            </div>
                            <a href={waLink(acct.customerPhone, `Assalam-o-Alaikum ${acct.customerName}! Aapka installment ${acct.daysOverdue} din se due hai. ${pkr(acct.monthly)} jama karwain. Shukriya!`)}
                              target="_blank" rel="noopener noreferrer"
                              className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-[#25D366] hover:bg-[#1fb859] text-white text-[11px] font-black rounded-xl transition">
                              <PhoneCall size={10}/> WA
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* ── Promises ── */}
                  {pDueCount > 0 && promises.length > 0 && (
                    <div className="border-t border-slate-100">
                      <div className="flex items-center gap-2 px-5 py-2.5 bg-amber-50">
                        <Bell size={12} className="text-amber-600 shrink-0"/>
                        <span className="text-xs font-black text-amber-700">{pDueCount} waday aaj due hain</span>
                      </div>
                      {promises.slice(0, 5).map((p, i) => (
                        <div key={p.id}
                          className={`flex items-center gap-3 px-5 py-3 ${i > 0 ? 'border-t border-slate-50' : 'border-t border-amber-50'}`}>
                          <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-xs font-black text-amber-600 shrink-0 select-none">
                            {p.customerName[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate leading-tight">{p.customerName}</p>
                            <p className="text-[11px] text-slate-400 truncate">{p.productName}{p.note ? ` · ${p.note}` : ''}</p>
                          </div>
                          <span className="shrink-0 text-[10px] font-black bg-amber-100 text-amber-700 px-2.5 py-1 rounded-lg border border-amber-200">Wada</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── All clear ── */}
                  {allClear && (
                    <div className="border-t border-slate-100 px-5 py-8 flex flex-col items-center text-center">
                      <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center mb-3">
                        <CheckCircle size={22} className="text-emerald-500"/>
                      </div>
                      <p className="text-sm font-black text-slate-800">Sab Clear Hai</p>
                      <p className="text-xs text-slate-400 mt-1 max-w-xs">Aaj koi due, overdue, ya wada pending nahi. Sab theek chal raha hai.</p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* RECENT INSTALLMENTS ──────────────────────────────────── */}
            <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
                <h3 className="text-sm font-black text-slate-900">Recent Installments</h3>
                <button onClick={() => navigate('/installments')}
                  className="text-xs text-blue-600 font-black hover:underline flex items-center gap-0.5">
                  Sab <ChevronRight size={11}/>
                </button>
              </div>
              {isLoading ? (
                <RowSkeleton rows={5}/>
              ) : !d?.recentInstallments.length ? (
                <div className="py-10 text-center">
                  <p className="text-xs text-slate-400">Koi installment nahi.{' '}
                    <button onClick={() => navigate('/installments')} className="text-blue-600 font-black hover:underline">Banao</button>
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {d.recentInstallments.map((inst, i) => {
                    const s = STATUS[inst.status] ?? { bg: 'bg-slate-100', text: 'text-slate-500', label: inst.status };
                    return (
                      <div key={inst.id} onClick={() => navigate('/installments')}
                        className={`flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-slate-50 transition ${i === 0 ? '' : ''}`}>
                        <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-xs font-black text-slate-600 shrink-0 select-none">
                          {inst.customerName[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate leading-tight">{inst.customerName}</p>
                          <p className="text-[10px] text-slate-400 truncate">{inst.productName}</p>
                        </div>
                        <div className="text-right shrink-0 mr-1.5">
                          <p className="text-xs font-black text-slate-900 tabular-nums">{pkr(Number(inst.remaining))}</p>
                          <p className="text-[10px] text-slate-400">baaki</p>
                        </div>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${s.bg} ${s.text}`}>
                          {s.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>{/* end left col */}

          {/* ── RIGHT SIDEBAR ───────────────────────────────────────── */}
          <div className="mt-4 lg:mt-0 space-y-4">
            <div className="lg:sticky lg:top-[94px] space-y-4">

              {/* PORTFOLIO NUMBERS ─────────────────────────────────── */}
              {isOwner && (
                <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide">Portfolio</h3>
                    <button onClick={() => navigate('/installments')}
                      className="text-[11px] text-blue-600 font-black hover:underline flex items-center gap-0.5">
                      Sab Dekho <ChevronRight size={10}/>
                    </button>
                  </div>
                  {isLoading ? (
                    <RowSkeleton rows={5}/>
                  ) : (
                    <div className="divide-y divide-slate-50">
                      <PortfolioRow
                        label="Active Plans"
                        value={d?.activeCount ?? 0}
                        sub={`${d?.monthlyActiveCount ?? 0} mahana · ${d?.dailyActiveCount ?? 0} roz`}
                        valueColor="text-blue-700"
                      />
                      <PortfolioRow
                        label="Overdue"
                        value={d?.overdueCount ?? 0}
                        sub={(d?.overdueAmount ?? 0) > 0 ? pkr(d!.overdueAmount) : 'sab clear'}
                        valueColor={(d?.overdueCount ?? 0) > 0 ? 'text-red-600' : 'text-slate-300'}
                        onClick={() => navigate('/installments')}
                      />
                      <PortfolioRow
                        label="Khatam Hone Wale"
                        value={completingSoon.length}
                        sub="1–5 qist baaki"
                        valueColor={completingSoon.length > 0 ? 'text-amber-600' : 'text-slate-300'}
                      />
                      <PortfolioRow
                        label="Naye (Is Mahine)"
                        value={d?.newThisMonthCount ?? 0}
                        sub={pkrSh(d?.newThisMonthValue ?? 0)}
                        valueColor="text-slate-900"
                      />
                      <PortfolioRow
                        label="Khatam (Is Mahine)"
                        value={d?.completedThisMonthCount ?? 0}
                        sub={pkrSh(d?.completedThisMonthValue ?? 0)}
                        valueColor={(d?.completedThisMonthCount ?? 0) > 0 ? 'text-emerald-600' : 'text-slate-300'}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* CASH IN FIELD ─────────────────────────────────────── */}
              {isOwner && staffCash.length > 0 && (
                <div className="bg-white rounded-2xl ring-1 ring-amber-200/60 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 bg-amber-50 border-b border-amber-100">
                    <div className="flex items-center gap-2">
                      <Wallet size={12} className="text-amber-600"/>
                      <span className="text-xs font-black text-amber-800">Cash in Field</span>
                    </div>
                    <span className="text-sm font-black text-amber-700 tabular-nums">{pkr(fieldTotal)}</span>
                  </div>
                  {staffCash.map((s, i) => (
                    <div key={s.staffId}
                      className={`flex items-center gap-2.5 px-5 py-3 ${i > 0 ? 'border-t border-slate-50' : ''}`}>
                      <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center text-[11px] font-black text-slate-600 shrink-0 select-none">
                        {s.staffName[0]?.toUpperCase()}
                      </div>
                      <p className="text-xs font-bold text-slate-800 flex-1 truncate">{s.staffName}</p>
                      <p className="text-xs font-black tabular-nums text-slate-900 shrink-0 mr-1">{pkr(Number(s.pendingBalance))}</p>
                      <button onClick={() => setReceiveTarget(s)}
                        className={`shrink-0 text-[11px] font-black px-2.5 py-1.5 rounded-xl transition ${
                          s.pendingHandover
                            ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-200'
                            : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border border-emerald-200'
                        }`}>
                        {s.pendingHandover ? 'Confirm' : 'Li'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* KHATAM HONE WALE ──────────────────────────────────── */}
              {isOwner && completingSoon.length > 0 && (
                <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <TrendingDown size={12} className="text-emerald-600"/>
                      <span className="text-xs font-black text-slate-800">Khatam Hone Wale</span>
                    </div>
                    <span className="text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-lg">{completingSoon.length}</span>
                  </div>
                  {completingSoon.map((c, i) => {
                    const pill = c.paymentsLeft === 1 ? 'bg-red-50 text-red-700 border-red-100' : 'bg-amber-50 text-amber-700 border-amber-100';
                    return (
                      <div key={c.id}
                        className={`flex items-center gap-2.5 px-5 py-3 ${i > 0 ? 'border-t border-slate-50' : ''}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-xs font-bold text-slate-900 truncate">{c.customerName}</p>
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border shrink-0 ${pill}`}>{c.paymentsLeft}x</span>
                          </div>
                          <p className="text-[10px] text-slate-400 truncate">{c.productName}</p>
                        </div>
                        <a href={waLink(c.customerPhone, `Assalam-o-Alaikum ${c.customerName}! Sirf ${c.paymentsLeft} installment baaki hai. Aakhri payment ke liye shukriya!`)}
                          target="_blank" rel="noopener noreferrer"
                          className="shrink-0 text-[11px] font-black text-white bg-[#25D366] hover:bg-[#1fb859] px-2.5 py-1.5 rounded-xl transition">
                          WA
                        </a>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* LOW STOCK ─────────────────────────────────────────── */}
              {lowStock.length > 0 && (
                <div className="bg-white rounded-2xl ring-1 ring-amber-200/60 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 bg-amber-50 border-b border-amber-100">
                    <div className="flex items-center gap-2">
                      <Package size={12} className="text-amber-600"/>
                      <span className="text-xs font-black text-amber-800">Kam Stock</span>
                    </div>
                    <button onClick={() => navigate('/products')} className="text-[11px] text-amber-700 font-black hover:underline">Manage →</button>
                  </div>
                  <div className="px-5 py-3.5 flex flex-wrap gap-1.5">
                    {lowStock.map(p => (
                      <span key={p.id}
                        className={`text-[11px] font-black px-2.5 py-1 rounded-xl border ${p.stock === 0 ? 'bg-red-50 text-red-700 border-red-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                        {p.name} ({p.stock})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* BIRTHDAYS ─────────────────────────────────────────── */}
              {birthdays.length > 0 && (
                <div className="bg-white rounded-2xl ring-1 ring-pink-200/60 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2 px-5 py-3 bg-pink-50 border-b border-pink-100">
                    <Gift size={12} className="text-pink-500"/>
                    <span className="text-xs font-black text-pink-700">{birthdays.length} Birthday is hafte</span>
                  </div>
                  {birthdays.map((c, i) => {
                    const [, mm, dd] = c.dob.split('-');
                    const bday   = new Date(`${new Date().getFullYear()}-${mm}-${dd}`);
                    const todayD = new Date(); todayD.setHours(0,0,0,0);
                    const isToday = bday.toDateString() === todayD.toDateString();
                    return (
                      <div key={c.id}
                        className={`flex items-center gap-2.5 px-5 py-3 ${i > 0 ? 'border-t border-slate-50' : ''}`}>
                        <div className="w-7 h-7 bg-pink-100 rounded-full flex items-center justify-center text-[11px] font-black text-pink-600 shrink-0 select-none">
                          {c.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-bold text-slate-900 truncate">{c.name}</p>
                            {isToday && <span className="text-[9px] font-black bg-pink-100 border border-pink-200 text-pink-700 px-1.5 py-0.5 rounded shrink-0">Aaj!</span>}
                          </div>
                          {c.area && <p className="text-[10px] text-slate-400">{c.area}</p>}
                        </div>
                        <a href={waLink(c.phone, `Assalamu Alaikum ${c.name}! Aaj aap ka birthday hai — bohat mubarak ho!`)}
                          target="_blank" rel="noopener noreferrer"
                          className="shrink-0 text-[11px] font-black text-white bg-[#25D366] hover:bg-[#1fb859] px-2.5 py-1.5 rounded-xl transition">
                          WA
                        </a>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          </div>{/* end sidebar */}

        </div>
      </div>

      {/* ══ STAFF HANDOVER MODAL ════════════════════════════════════════════ */}
      {showHandover && !isOwner && (() => {
        const bal  = Number(myBal?.pendingBalance ?? 0);
        const amt  = Number(handoverAmt);
        const diff = amt - bal;
        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="bg-slate-950 px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-white font-black text-sm">Cash Jama Karein</p>
                  <p className="text-slate-400 text-xs mt-0.5">Owner ko hand over karo</p>
                </div>
                <button onClick={() => setShowHandover(false)} className="text-slate-400 hover:text-white transition"><X size={16}/></button>
              </div>
              <div className="p-5 space-y-3">
                <div className="bg-slate-50 rounded-xl px-4 py-3 ring-1 ring-slate-200">
                  <p className="text-[10px] text-slate-400 font-medium">System ka hisaab</p>
                  <p className="text-2xl font-black text-slate-900 tabular-nums">{pkr(bal)}</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">Actual Amount *</label>
                  <input type="number" value={handoverAmt} onChange={e => setHandoverAmt(e.target.value)} autoFocus
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-xl font-black tabular-nums focus:outline-none focus:border-emerald-400 transition"/>
                  {handoverAmt && amt !== bal && (
                    <p className={`text-xs mt-1.5 font-black ${diff < 0 ? 'text-red-500' : 'text-amber-500'}`}>
                      {pkr(Math.abs(diff))} {diff < 0 ? 'kam' : 'zyada'}
                    </p>
                  )}
                </div>
                <textarea value={handoverNote} onChange={e => setHandoverNote(e.target.value)} rows={2} placeholder="Note (optional)…"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:border-emerald-400 transition"/>
              </div>
              <div className="flex gap-2 px-5 pb-5">
                <button onClick={() => setShowHandover(false)} className="flex-1 py-2.5 text-sm font-bold border border-slate-200 rounded-xl hover:bg-slate-50 transition">Wapas</button>
                <button disabled={!handoverAmt || amt <= 0 || submitHandover.isPending} onClick={() => submitHandover.mutate()}
                  className="flex-1 py-2.5 text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl transition flex items-center justify-center gap-1.5">
                  {submitHandover.isPending ? <span className="animate-pulse">Jama ho raha…</span> : <><Send size={13}/> Jama Karein</>}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {receiveTarget && <CashReceiveModal target={receiveTarget} onClose={() => setReceiveTarget(null)}/>}
    </div>
  );
}
