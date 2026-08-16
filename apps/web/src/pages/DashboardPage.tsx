import { useState, type ElementType } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  CreditCard, Package, BarChart3, Users, Zap, ShoppingCart,
  Bell, Target, Gift, CheckCircle, Send, X, PhoneCall,
  Wallet, Clock, AlertTriangle, ChevronRight, Plus,
  TrendingUp, TrendingDown, Activity, Calendar, Layers,
} from 'lucide-react';
import { useAuthStore } from '../store/auth.store.ts';
import { statsApi } from '../api/stats.api.ts';
import { recoveryApi } from '../api/recovery.api.ts';
import { sellersApi } from '../api/sellers.api.ts';
import { customersApi } from '../api/customers.api.ts';
import { handoversApi, type StaffBalance } from '../api/handovers.api.ts';
import { RowSkeleton } from '../components/ui/Skeleton.tsx';
import { fmtDate } from '../utils/dateFormat.ts';

/* ── helpers ── */
const pkr   = (v: number) => 'PKR ' + v.toLocaleString('en-PK', { maximumFractionDigits: 0 });
const pkrSh = (v: number) => {
  if (v >= 10_00_000) return `${(v / 10_00_000).toFixed(1)}M`;
  if (v >= 1_00_000)  return `${(v / 1_00_000).toFixed(v % 1_00_000 === 0 ? 0 : 1)}L`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(v % 1_000 === 0 ? 0 : 1)}K`;
  return String(v);
};
const greet = () => { const h = new Date().getHours(); return h < 12 ? 'Subah Bakhair' : h < 17 ? 'Adaab' : 'Shaam Bakhair'; };
const waLink = (phone: string, msg: string) =>
  `https://wa.me/92${phone.replace(/^0/, '').replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;

/* ══ CashReceiveModal ══ */
function CashReceiveModal({ target, onClose }: { target: StaffBalance; onClose: () => void }) {
  const qc  = useQueryClient();
  const sys = Number(target.pendingBalance);
  const [amt,  setAmt]  = useState(target.pendingHandover ? target.pendingHandover.handedAmount : String(sys));
  const [note, setNote] = useState('');
  const mut = useMutation({
    mutationFn: () => handoversApi.directReceive({ staffId: target.staffId, amount: Number(amt), note: note.trim() || undefined }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['handover-pending-balances'] }); toast.success(`${target.staffName} se ${pkr(Number(amt))} li`); onClose(); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Masla ho gaya'),
  });
  const diff = Number(amt) - sys;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-slate-950 px-5 py-4 flex items-center justify-between">
          <div><p className="text-white font-black text-sm">Cash Receive</p><p className="text-slate-400 text-xs mt-0.5">{target.staffName}</p></div>
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
              <p className={`text-xs mt-1 font-bold ${diff < 0 ? 'text-red-500' : 'text-amber-500'}`}>{pkr(Math.abs(diff))} {diff < 0 ? 'kam' : 'zyada'}</p>
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

/* ══════════════════════════════════════════════════════
   MAIN DASHBOARD
══════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const user    = useAuthStore(s => s.user);
  const navigate = useNavigate();
  const qc      = useQueryClient();
  const isOwner = user?.role === 'SELLER_OWNER';
  const perms   = user?.permissions as Record<string, boolean> | null | undefined;

  const [showHandover, setShowHandover]   = useState(false);
  const [handoverAmt, setHandoverAmt]     = useState('');
  const [handoverNote, setHandoverNote]   = useState('');
  const [receiveTarget, setReceiveTarget] = useState<StaffBalance | null>(null);

  /* queries */
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
    onSuccess: () => { setShowHandover(false); setHandoverAmt(''); setHandoverNote(''); void qc.invalidateQueries({ queryKey: ['handover-my-balance'] }); },
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
  const { data: shop }       = useQuery({ queryKey: ['shop-me'],              queryFn: sellersApi.getMe,                  staleTime: 5 * 60_000,    enabled: isOwner });
  const { data: birthdays = [] } = useQuery({ queryKey: ['upcoming-birthdays'], queryFn: customersApi.getUpcomingBirthdays, staleTime: 60 * 60_000 });

  /* derived */
  const d           = dash?.stats;
  const today       = fmtDate(new Date());
  const todayTotal  = (d?.todayCollections ?? 0) + (d?.todayCashSales ?? 0);
  const monthTotal  = (d?.monthCollections ?? 0) + (d?.monthCashSales ?? 0);
  const lowStock    = d?.lowStockItems ?? [];
  const staffCash   = pendingBals.filter(s => Number(s.pendingBalance) > 0);
  const fieldTotal  = staffCash.reduce((a, s) => a + Number(s.pendingBalance), 0);
  const netFaida    = monthTotal - (d?.monthExpenseTotal ?? 0);
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const daysLeft    = daysInMonth - new Date().getDate();
  const monthPct    = d?.monthInstTarget ? Math.min(100, Math.round((d.monthCollections / d.monthInstTarget) * 100)) : 0;

  /* quick actions */
  const actions: { label: string; icon: ElementType; color: string; to: string }[] = [
    ...(isOwner || perms?.canAddInstallment ? [{ label: 'Installment', icon: CreditCard,   color: 'bg-blue-600',    to: '/installments' }] : []),
    ...(isOwner || perms?.canAddCustomer    ? [{ label: 'Customer',    icon: Users,        color: 'bg-violet-600',  to: '/customers'    }] : []),
    ...(isOwner || perms?.canMakeCashSales  ? [{ label: 'Cash Sale',   icon: ShoppingCart, color: 'bg-emerald-600', to: '/cash-sales'   }] : []),
    ...(isOwner || perms?.canRecordExpense  ? [{ label: 'Kharcha',     icon: Zap,          color: 'bg-rose-600',    to: '/expenses'     }] : []),
    ...(isOwner || perms?.canManageProducts ? [{ label: 'Products',    icon: Package,      color: 'bg-amber-500',   to: '/products'     }] : []),
  ];

  /* portfolio tiles */
  const portfolioTiles = [
    { label: 'Active Plans',     value: d?.activeCount ?? 0,            sub: `${d?.monthlyActiveCount ?? 0} mahana`,  icon: Activity,     bg: 'bg-blue-50',    icon_cls: 'text-blue-600',    val_cls: 'text-blue-700' },
    { label: 'Overdue',          value: d?.overdueCount ?? 0,           sub: (d?.overdueAmount ?? 0) > 0 ? pkrSh(d!.overdueAmount) : 'sab clear', icon: AlertTriangle, bg: (d?.overdueCount ?? 0) > 0 ? 'bg-red-50' : 'bg-slate-50', icon_cls: (d?.overdueCount ?? 0) > 0 ? 'text-red-500' : 'text-slate-400', val_cls: (d?.overdueCount ?? 0) > 0 ? 'text-red-600' : 'text-slate-400', clickable: true },
    { label: 'Khatam Hone Wale', value: d?.completingSoon.length ?? 0,  sub: '1–5 qist baaki', icon: TrendingDown,  bg: 'bg-emerald-50', icon_cls: 'text-emerald-600', val_cls: 'text-emerald-700' },
    { label: 'Is Mahine Naye',   value: d?.newThisMonthCount ?? 0,      sub: d?.newThisMonthCount ? pkrSh(d.newThisMonthValue) : '—', icon: Layers, bg: 'bg-violet-50', icon_cls: 'text-violet-600', val_cls: 'text-violet-700' },
  ];

  /* STATUS STYLES */
  const STATUS: Record<string, string> = {
    ACTIVE:    'bg-emerald-100 text-emerald-700',
    COMPLETED: 'bg-blue-100 text-blue-700',
    DEFAULTED: 'bg-red-100 text-red-700',
    CANCELLED: 'bg-slate-100 text-slate-500',
  };

  return (
    <div className="bg-[#F0F2F8]">

      {/* ══════ DARK HEADER ══════ */}
      <div className="sticky top-0 z-30 bg-slate-950 shadow-lg shadow-slate-950/20">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3">
          <div>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em]">{today}</p>
            <h1 className="text-[15px] font-black text-white leading-tight mt-0.5">
              {greet()}, <span className="text-blue-400">{user?.name?.split(' ')[0]}</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {!isOwner && myBal && Number(myBal.pendingBalance) > 0 && !myBal.pendingHandover && (
              <button onClick={() => { setHandoverAmt(String(Number(myBal.pendingBalance))); setShowHandover(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-lg transition">
                <Send size={11}/> Jama Karo
              </button>
            )}
            {!isOwner && myBal?.pendingHandover && (
              <span className="flex items-center gap-1 px-3 py-1.5 bg-amber-600/20 text-amber-400 text-xs font-black rounded-lg">
                <Clock size={11}/> Confirm Pending
              </span>
            )}
            {isOwner && (
              <button onClick={() => navigate('/reports')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-black rounded-lg transition">
                <BarChart3 size={12}/> Reports
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ══════ KPI STRIP (owner) ══════ */}
      {isOwner && (
        <div className="bg-white border-b border-slate-200 shadow-sm">
          {isLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-slate-100 animate-pulse">
              {[0,1,2,3].map(i => <div key={i} className="px-5 py-3.5 space-y-2"><div className="h-2 bg-slate-100 rounded w-12"/><div className="h-7 bg-slate-100 rounded w-20"/><div className="h-2 bg-slate-100 rounded w-16"/></div>)}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-slate-100">
              {/* Aaj Aya */}
              <div className="px-5 py-3.5 border-l-[3px] border-blue-500">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.18em] flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-blue-500 inline-block"/>Aaj Aya</p>
                <p className="text-3xl xl:text-4xl font-black text-slate-900 tabular-nums leading-none mt-1.5">{pkrSh(todayTotal)}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] text-slate-400 tabular-nums">Inst <span className="font-bold text-slate-600">{pkrSh(d?.todayCollections ?? 0)}</span></span>
                  <span className="text-slate-200">·</span>
                  <span className="text-[10px] text-slate-400 tabular-nums">Sale <span className="font-bold text-slate-600">{pkrSh(d?.todayCashSales ?? 0)}</span></span>
                </div>
              </div>
              {/* Is Mahine */}
              <div className="px-5 py-3.5 border-l-[3px] border-violet-500">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.18em] flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-violet-500 inline-block"/>Is Mahine</p>
                <p className="text-3xl xl:text-4xl font-black text-slate-900 tabular-nums leading-none mt-1.5">{pkrSh(monthTotal)}</p>
                {(d?.monthInstTarget ?? 0) > 0 ? (
                  <div className="mt-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-700 ${monthPct >= 80 ? 'bg-emerald-500' : monthPct >= 50 ? 'bg-violet-500' : 'bg-amber-400'}`} style={{ width: `${monthPct}%` }}/>
                      </div>
                      <span className="text-[10px] font-black text-slate-500 tabular-nums">{monthPct}%</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-400 mt-1.5">{d?.newThisMonthCount ?? 0} naye plans</p>
                )}
              </div>
              {/* Active Plans */}
              <div className="px-5 py-3.5 border-l-[3px] border-emerald-500">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.18em] flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-emerald-500 inline-block"/>Active Plans</p>
                <p className="text-3xl xl:text-4xl font-black text-slate-900 tabular-nums leading-none mt-1.5">{d?.activeCount ?? 0}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] text-slate-400">Mahana <span className="font-bold text-slate-600">{d?.monthlyActiveCount ?? 0}</span></span>
                  <span className="text-slate-200">·</span>
                  <span className="text-[10px] text-slate-400">Roz <span className="font-bold text-slate-600">{d?.dailyActiveCount ?? 0}</span></span>
                </div>
              </div>
              {/* Overdue */}
              <div className={`px-5 py-3.5 border-l-[3px] cursor-pointer group transition hover:bg-slate-50 ${(d?.overdueCount ?? 0) > 0 ? 'border-red-500' : 'border-slate-200'}`}
                onClick={() => navigate('/installments')}>
                <p className={`text-[9px] font-bold uppercase tracking-[0.18em] flex items-center gap-1 ${(d?.overdueCount ?? 0) > 0 ? 'text-red-400' : 'text-slate-400'}`}>
                  <span className={`w-1 h-1 rounded-full inline-block ${(d?.overdueCount ?? 0) > 0 ? 'bg-red-500' : 'bg-slate-300'}`}/>Overdue
                </p>
                <p className={`text-3xl xl:text-4xl font-black tabular-nums leading-none mt-1.5 ${(d?.overdueCount ?? 0) > 0 ? 'text-red-600' : 'text-slate-300'}`}>{d?.overdueCount ?? 0}</p>
                <p className={`text-[10px] mt-1.5 tabular-nums ${(d?.overdueCount ?? 0) > 0 ? 'text-red-400' : 'text-slate-300'}`}>
                  {(d?.overdueAmount ?? 0) > 0 ? pkr(d!.overdueAmount) + ' baaki' : 'sab theek hai'}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════ STAFF CASH BANNER ══════ */}
      {!isOwner && myBal && Number(myBal.pendingBalance) > 0 && (
        <div className={`border-b ${myBal.pendingHandover ? 'bg-amber-50 border-amber-200' : 'bg-emerald-600 border-emerald-700'}`}>
          <div className="flex items-center justify-between px-4 sm:px-6 py-3">
            <div className="flex items-center gap-3">
              <Wallet size={18} className={myBal.pendingHandover ? 'text-amber-600' : 'text-white/80'}/>
              <div>
                <p className={`text-xs font-bold ${myBal.pendingHandover ? 'text-amber-600' : 'text-emerald-100'}`}>
                  {myBal.pendingHandover ? 'Handover pending confirmation' : 'Cash in Hand'}
                </p>
                <p className={`text-xl font-black tabular-nums ${myBal.pendingHandover ? 'text-amber-800' : 'text-white'}`}>{pkr(Number(myBal.pendingBalance))}</p>
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

      {/* ══════ QUICK ACTIONS ══════ */}
      {actions.length > 0 && (
        <div className="bg-white border-b border-slate-200/80">
          <div className="px-4 sm:px-6 py-2.5 flex gap-2 overflow-x-auto scrollbar-none">
            {actions.map(a => (
              <button key={a.to} onClick={() => navigate(a.to)}
                className="flex items-center gap-2 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 ring-1 ring-slate-200 rounded-xl text-xs font-black text-slate-700 whitespace-nowrap transition shrink-0">
                <div className={`w-5 h-5 ${a.color} rounded-md flex items-center justify-center shrink-0`}>
                  <a.icon size={11} className="text-white"/>
                </div>
                {a.label}
              </button>
            ))}
            {isOwner && (
              <button onClick={() => navigate('/reports')} className="ml-auto flex items-center gap-1.5 px-3.5 py-2 text-xs font-black text-slate-500 hover:text-slate-700 whitespace-nowrap transition shrink-0">
                Full Report <ChevronRight size={11}/>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ══════ PAGE BODY ══════ */}
      <div className="px-3 sm:px-5 lg:px-6 py-4">
        <div className="flex flex-col lg:flex-row gap-4 items-start">

          {/* ────────────────── MAIN COLUMN ────────────────── */}
          <div className="w-full lg:flex-1 lg:min-w-0 space-y-3">

            {/* ── AАJ KА KAAM ── */}
            <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-slate-950">
                <div className="flex items-center gap-2.5">
                  <div className="w-1 h-5 bg-blue-500 rounded-full"/>
                  <h2 className="text-sm font-black text-white">Aaj Ka Kaam</h2>
                  {briefing && (
                    <div className="flex gap-1">
                      {briefing.dueToday    > 0 && <span className="text-[10px] font-black bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">{briefing.dueToday} due</span>}
                      {briefing.overdueTotal > 0 && <span className="text-[10px] font-black bg-red-500/20  text-red-300  px-1.5 py-0.5 rounded">{briefing.overdueTotal} late</span>}
                      {pDueCount            > 0 && <span className="text-[10px] font-black bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">{pDueCount} wada</span>}
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-slate-500">{today}</span>
              </div>

              {!briefing ? <RowSkeleton rows={5}/> : (
                <>
                  {/* Due Today */}
                  {briefing.dueTodayAccounts.length > 0 ? (
                    <div>
                      <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border-b border-blue-100">
                        <Clock size={12} className="text-blue-600 shrink-0"/>
                        <p className="text-xs font-black text-blue-700">{briefing.dueToday} log aaj milenge</p>
                        {briefing.dueTomorrow > 0 && <span className="text-[10px] text-slate-400 ml-auto">+{briefing.dueTomorrow} kal</span>}
                      </div>
                      {briefing.dueTodayAccounts.slice(0, 20).map((acct, i) => (
                        <div key={acct.id} className={`flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition ${i > 0 ? 'border-t border-slate-50' : ''}`}>
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-xs font-black text-blue-700 shrink-0 select-none">{acct.customerName[0]?.toUpperCase()}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate leading-tight">{acct.customerName}</p>
                            <p className="text-[11px] text-slate-400">{acct.customerPhone}</p>
                          </div>
                          <p className="text-sm font-black text-blue-700 tabular-nums shrink-0 mr-2">{pkr(acct.monthly)}</p>
                          <a href={waLink(acct.customerPhone, `Assalam-o-Alaikum ${acct.customerName}! Aaj ka installment ${pkr(acct.monthly)} due hai. Jazak'Allah!`)}
                            target="_blank" rel="noopener noreferrer"
                            className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-black rounded-lg transition shadow-sm shadow-emerald-200">
                            <PhoneCall size={10}/> WA
                          </a>
                        </div>
                      ))}
                      {briefing.dueTodayAccounts.length > 20 && (
                        <button onClick={() => navigate('/installments')} className="w-full py-2 text-xs text-blue-600 font-black border-t border-slate-50 hover:bg-blue-50 transition">
                          +{briefing.dueTodayAccounts.length - 20} aur dekho
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5 px-4 py-3">
                      <Clock size={13} className="text-slate-300 shrink-0"/>
                      <p className="text-xs text-slate-400">Aaj koi installment due nahi</p>
                    </div>
                  )}

                  {/* Overdue */}
                  {briefing.urgentAccounts.length > 0 && (
                    <div className="border-t-[3px] border-red-500">
                      <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border-b border-red-100">
                        <AlertTriangle size={12} className="text-red-600 shrink-0"/>
                        <p className="text-xs font-black text-red-700">{briefing.overdueTotal} log late — foran call karo</p>
                      </div>
                      {briefing.urgentAccounts.map((acct, i) => {
                        const sev = acct.daysOverdue >= 30 ? 'bg-red-100 text-red-700' : acct.daysOverdue >= 14 ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700';
                        return (
                          <div key={acct.id} className={`flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition ${i > 0 ? 'border-t border-slate-50' : ''}`}>
                            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center text-xs font-black text-red-600 shrink-0 select-none">{acct.customerName[0]?.toUpperCase()}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-900 truncate leading-tight">{acct.customerName}</p>
                              <p className="text-[11px] text-slate-400">{acct.customerPhone}</p>
                            </div>
                            <div className="text-right mr-2 shrink-0">
                              <p className="text-sm font-black text-slate-900 tabular-nums">{pkr(acct.monthly)}</p>
                              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${sev}`}>{acct.daysOverdue}d</span>
                            </div>
                            <a href={waLink(acct.customerPhone, `Assalam-o-Alaikum ${acct.customerName}! Aapka installment ${acct.daysOverdue} din se due hai. ${pkr(acct.monthly)} jama karwain.`)}
                              target="_blank" rel="noopener noreferrer"
                              className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-black rounded-lg transition shadow-sm shadow-emerald-200">
                              <PhoneCall size={10}/> WA
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Promises */}
                  {pDueCount > 0 && promises.length > 0 && (
                    <div className="border-t-[3px] border-amber-400">
                      <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-100">
                        <Bell size={12} className="text-amber-600 shrink-0"/>
                        <p className="text-xs font-black text-amber-700">{pDueCount} waday aaj due hain</p>
                      </div>
                      {promises.slice(0, 5).map((p, i) => (
                        <div key={p.id} className={`flex items-center gap-3 px-4 py-2.5 ${i > 0 ? 'border-t border-slate-50' : ''}`}>
                          <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-xs font-black text-amber-600 shrink-0 select-none">{p.customerName[0]?.toUpperCase()}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate leading-tight">{p.customerName}</p>
                            <p className="text-[11px] text-slate-400 truncate">{p.productName}{p.note ? ` · ${p.note}` : ''}</p>
                          </div>
                          <span className="shrink-0 text-[10px] font-black bg-amber-100 text-amber-700 px-2 py-1 rounded-lg">Wada</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* All clear */}
                  {briefing.dueToday === 0 && briefing.overdueTotal === 0 && pDueCount === 0 && (
                    <div className="flex items-center gap-3 px-4 py-3.5 border-t border-slate-50">
                      <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                        <CheckCircle size={15} className="text-emerald-600"/>
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-800">Aaj sab clear hai!</p>
                        <p className="text-xs text-slate-400">Koi due, overdue, ya wada pending nahi</p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ── PORTFOLIO SNAPSHOT ── always visible */}
            {isOwner && (
              <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Layers size={14} className="text-slate-600"/>
                    <h2 className="text-sm font-black text-slate-900">Portfolio Snapshot</h2>
                  </div>
                  <button onClick={() => navigate('/installments')} className="text-xs text-blue-600 font-black hover:underline flex items-center gap-0.5">Sab <ChevronRight size={11}/></button>
                </div>
                {isLoading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 divide-x divide-y sm:divide-y-0 divide-slate-100 animate-pulse">
                    {[0,1,2,3].map(i => <div key={i} className="p-4 space-y-2"><div className="h-6 bg-slate-100 rounded w-10"/><div className="h-3 bg-slate-100 rounded w-16"/></div>)}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100">
                    {portfolioTiles.map((t, i) => (
                      <div key={i} onClick={t.clickable ? () => navigate('/installments') : undefined}
                        className={`p-4 ${t.bg} ${t.clickable ? 'cursor-pointer hover:brightness-95 transition' : ''}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`w-7 h-7 bg-white/60 rounded-lg flex items-center justify-center ${t.icon_cls}`}>
                            <t.icon size={13}/>
                          </div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{t.label}</p>
                        </div>
                        <p className={`text-2xl font-black tabular-nums leading-none ${t.val_cls}`}>{t.value}</p>
                        <p className="text-[11px] text-slate-500 mt-1 font-medium">{t.sub}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── IS MAHINE KI PERFORMANCE (owner, full-width card) ── */}
            {isOwner && (
              <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-violet-600"/>
                    <h2 className="text-sm font-black text-slate-900">Is Mahine Ki Performance</h2>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">{daysLeft} din baaki</span>
                </div>
                {isLoading ? (
                  <div className="p-4 animate-pulse space-y-3"><div className="h-4 bg-slate-100 rounded w-3/4"/><div className="h-3 bg-slate-100 rounded w-1/2"/></div>
                ) : (
                  <div className="p-4">
                    {/* Main amount + target */}
                    <div className="flex items-end justify-between mb-3">
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Collection</p>
                        <p className="text-3xl font-black text-slate-900 tabular-nums leading-none mt-0.5">{pkrSh(monthTotal)}</p>
                        <p className="text-xs text-slate-400 mt-1 tabular-nums">{pkr(monthTotal)}</p>
                      </div>
                      {(d?.monthInstTarget ?? 0) > 0 && (
                        <div className="text-right">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Target</p>
                          <p className="text-xl font-black text-slate-500 tabular-nums leading-none mt-0.5">{pkrSh(d!.monthInstTarget!)}</p>
                          <p className={`text-xs font-black mt-1 tabular-nums ${monthPct >= 80 ? 'text-emerald-600' : monthPct >= 50 ? 'text-blue-600' : 'text-amber-500'}`}>{monthPct}% complete</p>
                        </div>
                      )}
                    </div>
                    {/* Progress bar */}
                    {(d?.monthInstTarget ?? 0) > 0 && (
                      <div className="mb-4">
                        <div className="bg-slate-100 rounded-full h-2.5 overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-700 ${monthPct >= 80 ? 'bg-emerald-500' : monthPct >= 50 ? 'bg-violet-500' : 'bg-amber-400'}`} style={{ width: `${monthPct}%` }}/>
                        </div>
                        {monthTotal > (d?.monthInstTarget ?? 0) && (
                          <p className="text-[11px] text-emerald-600 font-black mt-1.5">+{pkr(monthTotal - d!.monthInstTarget!)} target se zyada!</p>
                        )}
                      </div>
                    )}
                    {/* 4 mini stats grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="bg-emerald-50 rounded-xl px-3 py-2.5">
                        <p className="text-[9px] text-emerald-500 font-bold uppercase tracking-wide">Net Faida</p>
                        <p className={`text-base font-black tabular-nums mt-0.5 ${netFaida >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{netFaida >= 0 ? '' : '-'}{pkrSh(Math.abs(netFaida))}</p>
                      </div>
                      <div className="bg-rose-50 rounded-xl px-3 py-2.5">
                        <p className="text-[9px] text-rose-500 font-bold uppercase tracking-wide">Kharcha</p>
                        <p className="text-base font-black tabular-nums text-rose-700 mt-0.5">{pkrSh(d?.monthExpenseTotal ?? 0)}</p>
                      </div>
                      <div className="bg-blue-50 rounded-xl px-3 py-2.5">
                        <p className="text-[9px] text-blue-500 font-bold uppercase tracking-wide">Naye Plans</p>
                        <p className="text-base font-black tabular-nums text-blue-700 mt-0.5">{d?.newThisMonthCount ?? 0}</p>
                        <p className="text-[10px] text-blue-400">{pkrSh(d?.newThisMonthValue ?? 0)}</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl px-3 py-2.5">
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wide">Khatam Huey</p>
                        <p className="text-base font-black tabular-nums text-slate-700 mt-0.5">{d?.completedThisMonthCount ?? 0}</p>
                        <p className="text-[10px] text-slate-400">{pkrSh(d?.completedThisMonthValue ?? 0)}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── DAILY TARGET ── */}
            {isOwner && shop?.settings?.dailyTarget && (() => {
              const target = shop.settings!.dailyTarget!;
              const pct    = Math.min(Math.round((todayTotal / target) * 100), 100);
              const over   = todayTotal > target;
              return (
                <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm px-4 py-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2"><Target size={13} className="text-blue-600"/><p className="text-xs font-black text-slate-800">Roz Ka Target</p></div>
                    <span className={`text-xs font-black ${over ? 'text-emerald-600' : 'text-blue-600'}`}>{pct}%{over ? ' ✓' : ''}</span>
                  </div>
                  <div className="flex items-baseline gap-2 mb-1.5">
                    <span className="text-lg font-black text-slate-900 tabular-nums">{pkr(todayTotal)}</span>
                    <span className="text-xs text-slate-400">/ {pkr(target)}</span>
                  </div>
                  <div className="bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${over ? 'bg-emerald-500' : pct >= 70 ? 'bg-blue-500' : 'bg-amber-400'}`} style={{ width: `${pct}%` }}/>
                  </div>
                  <p className={`text-[11px] font-bold mt-1 ${over ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {over ? `+${pkr(todayTotal - target)} target se zyada!` : `${pkr(target - todayTotal)} aur chahiye`}
                  </p>
                </div>
              );
            })()}

            {/* ── RECENT INSTALLMENTS ── */}
            <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <div className="flex items-center gap-2"><TrendingUp size={14} className="text-slate-600"/><h2 className="text-sm font-black text-slate-900">Recent Installments</h2></div>
                <button onClick={() => navigate('/installments')} className="text-xs text-blue-600 font-black hover:underline flex items-center gap-0.5">Sab <ChevronRight size={11}/></button>
              </div>
              {isLoading ? <RowSkeleton rows={5}/> : !d?.recentInstallments.length ? (
                <div className="py-10 text-center">
                  <p className="text-xs text-slate-400">Koi installment nahi.{' '}
                    <button onClick={() => navigate('/installments')} className="text-blue-600 font-black hover:underline">Banao</button>
                  </p>
                </div>
              ) : (
                d.recentInstallments.map((inst, i) => (
                  <div key={inst.id} onClick={() => navigate('/installments')}
                    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 transition ${i > 0 ? 'border-t border-slate-50' : ''}`}>
                    <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-xs font-black text-slate-600 shrink-0 select-none">{inst.customerName[0]?.toUpperCase()}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate leading-tight">{inst.customerName}</p>
                      <p className="text-[10px] text-slate-400 truncate">{inst.productName}</p>
                    </div>
                    <div className="text-right shrink-0 mr-2">
                      <p className="text-xs font-black text-slate-900 tabular-nums">{pkr(Number(inst.remaining))}</p>
                      <p className="text-[10px] text-slate-400">baaki</p>
                    </div>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${STATUS[inst.status] ?? 'bg-slate-100 text-slate-500'}`}>
                      {inst.status.charAt(0) + inst.status.slice(1).toLowerCase()}
                    </span>
                  </div>
                ))
              )}
            </div>

          </div>{/* end main col */}

          {/* ────────────────── RIGHT SIDEBAR ────────────────── */}
          <div className="w-full lg:w-72 xl:w-80 shrink-0">
            <div className="lg:sticky lg:top-[60px] space-y-3">

              {/* Cash in Field */}
              {isOwner && staffCash.length > 0 && (
                <div className="bg-white rounded-2xl ring-1 ring-amber-200/80 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50 border-b border-amber-100">
                    <div className="flex items-center gap-2"><Wallet size={12} className="text-amber-600"/><p className="text-xs font-black text-amber-800">Cash in Field</p></div>
                    <p className="text-sm font-black text-amber-700 tabular-nums">{pkr(fieldTotal)}</p>
                  </div>
                  {staffCash.map((s, i) => (
                    <div key={s.staffId} className={`flex items-center gap-2.5 px-4 py-2.5 ${i > 0 ? 'border-t border-slate-50' : ''}`}>
                      <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center text-[11px] font-black text-slate-600 shrink-0 select-none">{s.staffName[0]?.toUpperCase()}</div>
                      <p className="text-xs font-bold text-slate-800 flex-1 truncate">{s.staffName}</p>
                      <p className="text-xs font-black tabular-nums text-slate-900 shrink-0">{pkr(Number(s.pendingBalance))}</p>
                      <button onClick={() => setReceiveTarget(s)}
                        className={`shrink-0 text-[10px] font-black px-2 py-1 rounded-lg transition ${s.pendingHandover ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}>
                        {s.pendingHandover ? 'Confirm' : 'Li'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Is Mahine Sidebar (rich card) */}
              {isOwner && (
                <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                    <div className="flex items-center gap-2"><Calendar size={12} className="text-violet-600"/><p className="text-xs font-black text-slate-700">Is Mahine</p></div>
                    <button onClick={() => navigate('/reports')} className="text-[11px] text-blue-600 font-black hover:underline flex items-center gap-0.5">Report <ChevronRight size={10}/></button>
                  </div>
                  <div className="p-4 space-y-3">
                    {isLoading ? <div className="h-16 bg-slate-100 rounded-xl animate-pulse"/> : (
                      <>
                        <div className="flex items-baseline justify-between">
                          <p className="text-2xl font-black text-slate-900 tabular-nums">{pkrSh(monthTotal)}</p>
                          {(d?.monthInstTarget ?? 0) > 0 && <p className={`text-xs font-black ${monthPct >= 80 ? 'text-emerald-600' : monthPct >= 50 ? 'text-violet-600' : 'text-amber-500'}`}>{monthPct}%</p>}
                        </div>
                        {(d?.monthInstTarget ?? 0) > 0 && (
                          <div className="bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-700 ${monthPct >= 80 ? 'bg-emerald-500' : monthPct >= 50 ? 'bg-violet-500' : 'bg-amber-400'}`} style={{ width: `${monthPct}%` }}/>
                          </div>
                        )}
                        <div className="space-y-2 pt-1">
                          {[
                            { label: 'Net Faida', val: netFaida, cls: netFaida >= 0 ? 'text-emerald-600' : 'text-red-500', pre: netFaida < 0 ? '-' : '' },
                            { label: 'Kharcha',   val: d?.monthExpenseTotal ?? 0, cls: 'text-rose-600', pre: '' },
                          ].map((r, i) => (
                            <div key={i} className="flex items-center justify-between">
                              <p className="text-[11px] text-slate-500">{r.label}</p>
                              <p className={`text-sm font-black tabular-nums ${r.cls}`}>{r.pre}{pkrSh(Math.abs(r.val))}</p>
                            </div>
                          ))}
                          <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2">
                            <div className="bg-slate-50 rounded-xl px-2.5 py-2">
                              <p className="text-[9px] text-slate-400 font-bold">Naye</p>
                              <p className="text-sm font-black text-slate-700">{d?.newThisMonthCount ?? 0}</p>
                              <p className="text-[9px] text-slate-400 tabular-nums">{pkrSh(d?.newThisMonthValue ?? 0)}</p>
                            </div>
                            <div className="bg-slate-50 rounded-xl px-2.5 py-2">
                              <p className="text-[9px] text-slate-400 font-bold">Khatam</p>
                              <p className="text-sm font-black text-slate-700">{d?.completedThisMonthCount ?? 0}</p>
                              <p className="text-[9px] text-slate-400 tabular-nums">{pkrSh(d?.completedThisMonthValue ?? 0)}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                            <p className="text-[11px] text-slate-400">{daysLeft} din baaki</p>
                            {(d?.monthInstTarget ?? 0) > 0 && monthPct < 100 && (
                              <p className="text-[11px] font-black text-slate-600 tabular-nums">{pkrSh(Math.max(0, d!.monthInstTarget! - monthTotal))} chahiye</p>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Completing Soon */}
              {isOwner && d && d.completingSoon.length > 0 && (
                <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-emerald-50 border-b border-emerald-100">
                    <div className="flex items-center gap-2"><TrendingDown size={12} className="text-emerald-600"/><p className="text-xs font-black text-emerald-800">Khatam Hone Wale</p></div>
                    <span className="text-[10px] font-black bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded">{d.completingSoon.length}</span>
                  </div>
                  {d.completingSoon.map((c, i) => {
                    const pill = c.paymentsLeft === 1 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700';
                    return (
                      <div key={c.id} className={`flex items-center gap-2.5 px-4 py-2.5 ${i > 0 ? 'border-t border-slate-50' : ''}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-bold text-slate-900 truncate">{c.customerName}</p>
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded shrink-0 ${pill}`}>{c.paymentsLeft}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 truncate">{c.productName}</p>
                        </div>
                        <a href={waLink(c.customerPhone, `Assalam-o-Alaikum ${c.customerName}! Sirf ${c.paymentsLeft} installment baaki hai.`)}
                          target="_blank" rel="noopener noreferrer"
                          className="shrink-0 text-[10px] font-black text-white bg-emerald-500 hover:bg-emerald-600 px-2 py-1 rounded-lg transition">WA</a>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Low Stock */}
              {lowStock.length > 0 && (
                <div className="bg-white rounded-2xl ring-1 ring-amber-200/80 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50 border-b border-amber-100">
                    <div className="flex items-center gap-2"><Package size={12} className="text-amber-600"/><p className="text-xs font-black text-amber-800">Kam Stock</p></div>
                    <button onClick={() => navigate('/products')} className="text-[10px] text-amber-700 font-black hover:underline">Manage →</button>
                  </div>
                  <div className="px-4 py-3 flex flex-wrap gap-1.5">
                    {lowStock.map(p => (
                      <span key={p.id} className={`text-[11px] font-black px-2 py-1 rounded-lg ${p.stock === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {p.name} ({p.stock})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Birthdays */}
              {birthdays.length > 0 && (
                <div className="bg-white rounded-2xl ring-1 ring-pink-200/80 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-pink-50 border-b border-pink-100">
                    <Gift size={12} className="text-pink-500"/>
                    <p className="text-xs font-black text-pink-700">{birthdays.length} Birthday is hafte</p>
                  </div>
                  {birthdays.map((c, i) => {
                    const [, mm, dd] = c.dob.split('-');
                    const bday  = new Date(`${new Date().getFullYear()}-${mm}-${dd}`);
                    const todayD = new Date(); todayD.setHours(0,0,0,0);
                    const isToday = bday.toDateString() === todayD.toDateString();
                    return (
                      <div key={c.id} className={`flex items-center gap-2.5 px-4 py-2.5 ${i > 0 ? 'border-t border-slate-50' : ''}`}>
                        <div className="w-7 h-7 bg-pink-100 rounded-full flex items-center justify-center text-[11px] font-black text-pink-600 shrink-0 select-none">{c.name[0]}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <p className="text-xs font-bold text-slate-900 truncate">{c.name}</p>
                            {isToday && <span className="text-[9px] font-black bg-pink-100 text-pink-700 px-1 py-0.5 rounded shrink-0">Aaj!</span>}
                          </div>
                          {c.area && <p className="text-[10px] text-slate-400">{c.area}</p>}
                        </div>
                        <a href={waLink(c.phone, `Assalamu Alaikum ${c.name}! Aaj aap ka birthday hai — bohat mubarak ho!`)}
                          target="_blank" rel="noopener noreferrer"
                          className="shrink-0 text-[10px] font-black text-white bg-green-500 hover:bg-green-600 px-2 py-1 rounded-lg transition">WA</a>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Naya Installment CTA */}
              <button onClick={() => navigate('/installments')}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl transition shadow-sm">
                <Plus size={13}/> Naya Installment Banao
              </button>

            </div>
          </div>

        </div>
      </div>

      {/* ══════ HANDOVER MODAL (staff) ══════ */}
      {showHandover && !isOwner && (() => {
        const bal  = Number(myBal?.pendingBalance ?? 0);
        const amt  = Number(handoverAmt);
        const diff = amt - bal;
        return (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="bg-slate-950 px-5 py-4 flex items-center justify-between">
                <div><p className="text-white font-black text-sm">Cash Jama Karein</p><p className="text-slate-400 text-xs mt-0.5">Owner ko hand over karo</p></div>
                <button onClick={() => setShowHandover(false)} className="text-slate-400 hover:text-white transition"><X size={16}/></button>
              </div>
              <div className="p-5 space-y-3">
                <div className="bg-slate-50 rounded-xl px-3 py-2.5 ring-1 ring-slate-200">
                  <p className="text-[10px] text-slate-400">System ka hisaab</p>
                  <p className="text-2xl font-black text-slate-900 tabular-nums">{pkr(bal)}</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Actual Amount *</label>
                  <input type="number" value={handoverAmt} onChange={e => setHandoverAmt(e.target.value)} autoFocus
                    className="w-full border border-slate-200 rounded-xl px-3 py-3 text-xl font-black tabular-nums focus:outline-none focus:border-emerald-400 transition"/>
                  {handoverAmt && amt !== bal && (
                    <p className={`text-xs mt-1.5 font-black ${diff < 0 ? 'text-red-500' : 'text-amber-500'}`}>{pkr(Math.abs(diff))} {diff < 0 ? 'kam' : 'zyada'}</p>
                  )}
                </div>
                <textarea value={handoverNote} onChange={e => setHandoverNote(e.target.value)} rows={2} placeholder="Note…"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-emerald-400 transition"/>
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
