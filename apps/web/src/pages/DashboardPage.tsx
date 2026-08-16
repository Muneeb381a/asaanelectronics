import { useState, type ElementType } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  CreditCard, Package, ArrowRight, BarChart3, Users, Zap,
  ShoppingCart, Bell, Target, Gift, CheckCircle, Send, X,
  PhoneCall, Wallet, Clock, AlertTriangle, TrendingDown,
  ChevronRight, Plus,
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
const pkr  = (v: number) => 'PKR ' + v.toLocaleString('en-PK', { maximumFractionDigits: 0 });
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
const wa = (phone: string, msg: string) =>
  `https://wa.me/92${phone.replace(/^0/, '').replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;

/* ── CashReceiveModal ── */
function CashReceiveModal({ target, onClose }: { target: StaffBalance; onClose: () => void }) {
  const qc  = useQueryClient();
  const sys = Number(target.pendingBalance);
  const [amt, setAmt]   = useState(target.pendingHandover ? target.pendingHandover.handedAmount : String(sys));
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
        <div className="bg-slate-900 px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-white font-black text-sm">Cash Receive</p>
            <p className="text-slate-400 text-xs mt-0.5">{target.staffName}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-blue-50 rounded-xl px-3 py-2.5">
              <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wide">System</p>
              <p className="text-lg font-black text-blue-700 tabular-nums">{pkr(sys)}</p>
            </div>
            {target.pendingHandover && (
              <div className="bg-amber-50 rounded-xl px-3 py-2.5">
                <p className="text-[10px] text-amber-500 font-bold uppercase tracking-wide">Staff Submit</p>
                <p className="text-lg font-black text-amber-700 tabular-nums">{pkr(Number(target.pendingHandover.handedAmount))}</p>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Gini hui raqam *</label>
            <input type="number" value={amt} onChange={e => setAmt(e.target.value)} autoFocus
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-base font-black focus:outline-none focus:border-emerald-400 tabular-nums transition" />
            {Number(amt) !== sys && Math.abs(diff) >= 1 && (
              <p className={`text-xs mt-1 font-bold ${diff < 0 ? 'text-red-500' : 'text-amber-500'}`}>
                {pkr(Math.abs(diff))} {diff < 0 ? 'kam' : 'zyada'}
              </p>
            )}
          </div>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Note (optional)"
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-emerald-400 transition" />
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 text-sm font-bold border border-slate-200 rounded-xl hover:bg-slate-50 transition">Wapas</button>
            <button disabled={!amt || Number(amt) <= 0 || mut.isPending} onClick={() => mut.mutate()}
              className="flex-1 py-2.5 text-sm font-black text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition flex items-center justify-center gap-1.5">
              {mut.isPending ? 'Ho raha…' : <><CheckCircle size={14} /> Li</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════ MAIN PAGE ══════════════════════ */
export default function DashboardPage() {
  const user     = useAuthStore(s => s.user);
  const navigate = useNavigate();
  const qc       = useQueryClient();
  const isOwner  = user?.role === 'SELLER_OWNER';
  const perms    = user?.permissions as Record<string, boolean> | null | undefined;

  const [showHandover, setShowHandover]   = useState(false);
  const [handoverAmt, setHandoverAmt]     = useState('');
  const [handoverNote, setHandoverNote]   = useState('');
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
  const { data: shop } = useQuery({ queryKey: ['shop-me'], queryFn: sellersApi.getMe, staleTime: 5 * 60_000, enabled: isOwner });
  const { data: birthdays = [] } = useQuery({ queryKey: ['upcoming-birthdays'], queryFn: customersApi.getUpcomingBirthdays, staleTime: 60 * 60_000 });

  /* ── derived ── */
  const d          = dash?.stats;
  const today      = fmtDate(new Date());
  const todayTotal = (d?.todayCollections ?? 0) + (d?.todayCashSales ?? 0);
  const monthTotal = (d?.monthCollections ?? 0) + (d?.monthCashSales ?? 0);
  const lowStock   = d?.lowStockItems ?? [];
  const staffCash  = pendingBals.filter(s => Number(s.pendingBalance) > 0);
  const fieldTotal = staffCash.reduce((a, s) => a + Number(s.pendingBalance), 0);

  /* ── quick actions ── */
  const actions: { label: string; icon: ElementType; color: string; to: string }[] = [
    ...(isOwner || perms?.canAddInstallment ? [{ label: 'Installment', icon: CreditCard,   color: 'bg-blue-600',    to: '/installments' }] : []),
    ...(isOwner || perms?.canAddCustomer    ? [{ label: 'Customer',    icon: Users,        color: 'bg-violet-600',  to: '/customers'    }] : []),
    ...(isOwner || perms?.canMakeCashSales  ? [{ label: 'Cash Sale',   icon: ShoppingCart, color: 'bg-emerald-600', to: '/cash-sales'   }] : []),
    ...(isOwner || perms?.canRecordExpense  ? [{ label: 'Kharcha',     icon: Zap,          color: 'bg-rose-600',    to: '/expenses'     }] : []),
    ...(isOwner || perms?.canManageProducts ? [{ label: 'Products',    icon: Package,      color: 'bg-amber-600',   to: '/products'     }] : []),
  ];

  /* ── stat tiles data ── */
  const statTiles = isOwner ? [
    {
      label: 'Aaj Aya',
      value: pkrSh(todayTotal),
      sub: pkr(todayTotal),
      sub2: `${d?.todayCollections ? `Inst: ${pkrSh(d.todayCollections)}` : ''}${d?.todayCashSales ? `  Sale: ${pkrSh(d.todayCashSales)}` : ''}`,
      accent: 'border-blue-500', dot: 'bg-blue-500', loading: isLoading,
    },
    {
      label: 'Is Mahine',
      value: pkrSh(monthTotal),
      sub: pkr(monthTotal),
      sub2: (d?.monthInstTarget ?? 0) > 0
        ? `${Math.min(100, Math.round((d!.monthCollections / d!.monthInstTarget!) * 100))}% target`
        : `${d?.newThisMonthCount ?? 0} naye plans`,
      accent: 'border-violet-500', dot: 'bg-violet-500', loading: isLoading,
    },
    {
      label: 'Active Plans',
      value: String(d?.activeCount ?? 0),
      sub: `${d?.monthlyActiveCount ?? 0} mahana · ${d?.dailyActiveCount ?? 0} roz`,
      sub2: `${d?.newThisMonthCount ?? 0} naye is mahine`,
      accent: 'border-emerald-500', dot: 'bg-emerald-500', loading: isLoading,
    },
    {
      label: 'Overdue',
      value: String(d?.overdueCount ?? 0),
      sub: (d?.overdueAmount ?? 0) > 0 ? pkr(d!.overdueAmount) + ' baaki' : 'sab theek!',
      sub2: (d?.overdueCount ?? 0) > 0 ? 'Foran call karo →' : '',
      accent: (d?.overdueCount ?? 0) > 0 ? 'border-red-500' : 'border-slate-300',
      dot: (d?.overdueCount ?? 0) > 0 ? 'bg-red-500' : 'bg-slate-300',
      loading: isLoading, clickable: (d?.overdueCount ?? 0) > 0,
    },
  ] : [];

  /* ─── RENDER ─── */
  return (
    <div className="min-h-screen bg-slate-100">

      {/* ══════════ DARK HEADER ══════════ */}
      <div className="sticky top-0 z-30 bg-slate-950 shadow-lg">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3">
          <div>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.18em]">{today}</p>
            <h1 className="text-[15px] font-black text-white leading-tight mt-0.5">
              {greet()}, <span className="text-blue-400">{user?.name?.split(' ')[0]}</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {!isOwner && myBal && Number(myBal.pendingBalance) > 0 && !myBal.pendingHandover && (
              <button
                onClick={() => { setHandoverAmt(String(Number(myBal.pendingBalance))); setShowHandover(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-lg transition">
                <Send size={11} /> Jama Karo
              </button>
            )}
            {!isOwner && myBal && myBal.pendingHandover && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600/20 text-amber-400 text-xs font-black rounded-lg">
                <Clock size={11} /> Confirm Pending
              </span>
            )}
            {isOwner && (
              <button onClick={() => navigate('/reports')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-black rounded-lg transition">
                <BarChart3 size={12} /> Reports
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ══════════ STAT TILES STRIP ══════════ */}
      {isOwner && (
        <div className="bg-white border-b border-slate-200 shadow-sm">
          {isLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-slate-100 animate-pulse">
              {[0,1,2,3].map(i => (
                <div key={i} className="px-4 py-3 space-y-1.5">
                  <div className="h-2 bg-slate-100 rounded w-12"/>
                  <div className="h-7 bg-slate-100 rounded w-20"/>
                  <div className="h-2 bg-slate-100 rounded w-16"/>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-slate-100">
              {statTiles.map((t, i) => (
                <div key={i}
                  onClick={t.clickable ? () => navigate('/installments') : undefined}
                  className={`px-4 py-3 border-l-4 ${t.accent} ${t.clickable ? 'cursor-pointer hover:bg-slate-50 transition' : ''}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.dot}`}/>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.label}</p>
                  </div>
                  <p className={`text-2xl font-black tabular-nums leading-none ${i === 3 && (d?.overdueCount ?? 0) > 0 ? 'text-red-600' : 'text-slate-900'}`}>{t.value}</p>
                  <p className="text-[11px] text-slate-500 mt-1 tabular-nums">{t.sub}</p>
                  {t.sub2 && <p className={`text-[10px] mt-0.5 font-bold ${i === 3 && (d?.overdueCount ?? 0) > 0 ? 'text-red-500' : 'text-slate-400'}`}>{t.sub2}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════ STAFF CASH BANNER (staff only) ══════════ */}
      {!isOwner && myBal && Number(myBal.pendingBalance) > 0 && (
        <div className={`border-b ${myBal.pendingHandover ? 'bg-amber-50 border-amber-200' : 'bg-emerald-600 border-emerald-700'}`}>
          <div className="flex items-center justify-between px-4 sm:px-6 py-3">
            <div className="flex items-center gap-3">
              <Wallet size={18} className={myBal.pendingHandover ? 'text-amber-600' : 'text-white/80'} />
              <div>
                <p className={`text-xs font-bold ${myBal.pendingHandover ? 'text-amber-600' : 'text-emerald-100'}`}>
                  {myBal.pendingHandover ? 'Handover pending confirmation' : 'Cash in Hand'}
                </p>
                <p className={`text-lg font-black tabular-nums ${myBal.pendingHandover ? 'text-amber-800' : 'text-white'}`}>
                  {pkr(Number(myBal.pendingBalance))}
                </p>
              </div>
            </div>
            {!myBal.pendingHandover && (
              <button onClick={() => { setHandoverAmt(String(Number(myBal.pendingBalance))); setShowHandover(true); }}
                className="flex items-center gap-1.5 px-4 py-2 bg-white text-emerald-700 font-black text-sm rounded-xl hover:bg-emerald-50 transition shrink-0">
                <Send size={13} /> Jama Karein
              </button>
            )}
          </div>
        </div>
      )}

      {/* ══════════ MAIN BODY ══════════ */}
      <div className="px-3 sm:px-5 lg:px-6 py-4">
        <div className="flex flex-col lg:flex-row gap-4 items-start max-w-[1400px] mx-auto">

          {/* ────── LEFT: QUICK ACTIONS (desktop only) ────── */}
          {actions.length > 0 && (
            <div className="hidden lg:block w-44 xl:w-48 shrink-0">
              <div className="sticky top-[60px]">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2">Quick Add</p>
                <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden">
                  {actions.map((a, i) => (
                    <button key={a.to} onClick={() => navigate(a.to)}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-slate-50 transition ${i > 0 ? 'border-t border-slate-50' : ''}`}>
                      <div className={`w-7 h-7 ${a.color} rounded-lg flex items-center justify-center shrink-0`}>
                        <a.icon size={13} className="text-white" />
                      </div>
                      <span className="text-xs font-bold text-slate-700">{a.label}</span>
                      <ChevronRight size={12} className="text-slate-300 ml-auto" />
                    </button>
                  ))}
                </div>

                {/* Is Mahine mini on desktop left */}
                {isOwner && d && (
                  <div className="mt-3 bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm p-3.5">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Is Mahine</p>
                    <p className="text-xl font-black text-slate-900 tabular-nums">{pkrSh(monthTotal)}</p>
                    {(d.monthInstTarget ?? 0) > 0 && (() => {
                      const pct = Math.min(100, Math.round((d.monthCollections / d.monthInstTarget!) * 100));
                      const bar = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-blue-500' : 'bg-amber-400';
                      return (
                        <div className="mt-2">
                          <div className="flex justify-between mb-1">
                            <p className="text-[9px] text-slate-400">Target {pkrSh(d.monthInstTarget!)}</p>
                            <p className="text-[9px] font-black text-slate-600">{pct}%</p>
                          </div>
                          <div className="bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div className={`h-full rounded-full ${bar} transition-all duration-700`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })()}
                    {(d.monthExpenseTotal ?? 0) > 0 && (
                      <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex justify-between">
                        <p className="text-[10px] text-slate-400">Net Faida</p>
                        {(() => {
                          const p = monthTotal - (d.monthExpenseTotal ?? 0);
                          return <p className={`text-[11px] font-black tabular-nums ${p >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{p >= 0 ? '' : '-'}{pkrSh(Math.abs(p))}</p>;
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ────── CENTRE: MAIN CONTENT ────── */}
          <div className="flex-1 min-w-0 space-y-3">

            {/* mobile quick actions */}
            {actions.length > 0 && (
              <div className="flex gap-2 overflow-x-auto scrollbar-none pb-0.5 lg:hidden">
                {actions.map(a => (
                  <button key={a.to} onClick={() => navigate(a.to)}
                    className="flex items-center gap-2 px-3.5 py-2 bg-white ring-1 ring-slate-200 rounded-xl text-xs font-black text-slate-700 whitespace-nowrap shadow-sm shrink-0 hover:bg-slate-50 transition">
                    <div className={`w-5 h-5 ${a.color} rounded-md flex items-center justify-center shrink-0`}>
                      <a.icon size={11} className="text-white" />
                    </div>
                    {a.label}
                  </button>
                ))}
              </div>
            )}

            {/* ══ AАJ KА KAAM ══ */}
            <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden">

              {/* card header */}
              <div className="flex items-center justify-between px-4 py-3 bg-slate-950">
                <div className="flex items-center gap-2.5">
                  <div className="w-1 h-5 bg-blue-500 rounded-full" />
                  <h2 className="text-sm font-black text-white">Aaj Ka Kaam</h2>
                  {briefing && (
                    <div className="flex items-center gap-1">
                      {briefing.dueToday > 0    && <span className="text-[10px] font-black bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">{briefing.dueToday} due</span>}
                      {briefing.overdueTotal > 0 && <span className="text-[10px] font-black bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded">{briefing.overdueTotal} late</span>}
                      {pDueCount > 0             && <span className="text-[10px] font-black bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">{pDueCount} wada</span>}
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-slate-500">{today}</span>
              </div>

              {!briefing ? <RowSkeleton rows={6} /> : (
                <>
                  {/* DUE TODAY */}
                  {briefing.dueTodayAccounts.length > 0 ? (
                    <div>
                      <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border-b border-blue-100">
                        <Clock size={12} className="text-blue-600 shrink-0" />
                        <p className="text-xs font-black text-blue-700">{briefing.dueToday} log aaj milenge</p>
                        {briefing.dueTomorrow > 0 && <span className="text-[10px] text-slate-400 ml-auto">+{briefing.dueTomorrow} kal</span>}
                      </div>
                      {briefing.dueTodayAccounts.slice(0, 20).map((acct, i) => (
                        <div key={acct.id} className={`flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition ${i > 0 ? 'border-t border-slate-50' : ''}`}>
                          <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-sm font-black text-blue-700 shrink-0 select-none">
                            {acct.customerName[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate leading-tight">{acct.customerName}</p>
                            <p className="text-[11px] text-slate-400 leading-tight">{acct.customerPhone}</p>
                          </div>
                          <p className="text-sm font-black text-blue-700 tabular-nums shrink-0 mr-2">{pkr(acct.monthly)}</p>
                          <a href={wa(acct.customerPhone, `Assalam-o-Alaikum ${acct.customerName}! Aaj ka installment ${pkr(acct.monthly)} due hai. Jazak'Allah!`)}
                            target="_blank" rel="noopener noreferrer"
                            className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-black rounded-lg transition shadow-sm shadow-emerald-200">
                            <PhoneCall size={10} /> WA
                          </a>
                        </div>
                      ))}
                      {briefing.dueTodayAccounts.length > 20 && (
                        <button onClick={() => navigate('/installments')}
                          className="w-full py-2 text-xs text-blue-600 font-black border-t border-slate-50 hover:bg-blue-50 transition">
                          +{briefing.dueTodayAccounts.length - 20} aur log dekho
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-slate-50">
                      <Clock size={13} className="text-slate-300 shrink-0" />
                      <p className="text-xs text-slate-400">Aaj koi due nahi</p>
                    </div>
                  )}

                  {/* OVERDUE */}
                  {briefing.urgentAccounts.length > 0 && (
                    <div className="border-t-4 border-red-500">
                      <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border-b border-red-100">
                        <AlertTriangle size={12} className="text-red-600 shrink-0" />
                        <p className="text-xs font-black text-red-700">{briefing.overdueTotal} log late — foran call karo</p>
                      </div>
                      {briefing.urgentAccounts.map((acct, i) => {
                        const sev = acct.daysOverdue >= 30 ? 'bg-red-100 text-red-700' : acct.daysOverdue >= 14 ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700';
                        return (
                          <div key={acct.id} className={`flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition ${i > 0 ? 'border-t border-slate-50' : ''}`}>
                            <div className="w-9 h-9 bg-red-100 rounded-full flex items-center justify-center text-sm font-black text-red-600 shrink-0 select-none">
                              {acct.customerName[0]?.toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-900 truncate leading-tight">{acct.customerName}</p>
                              <p className="text-[11px] text-slate-400 leading-tight">{acct.customerPhone}</p>
                            </div>
                            <div className="text-right mr-2 shrink-0">
                              <p className="text-sm font-black text-slate-900 tabular-nums">{pkr(acct.monthly)}</p>
                              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${sev}`}>{acct.daysOverdue}d</span>
                            </div>
                            <a href={wa(acct.customerPhone, `Assalam-o-Alaikum ${acct.customerName}! Aapka installment ${acct.daysOverdue} din se due hai. ${pkr(acct.monthly)} jald jama karwain.`)}
                              target="_blank" rel="noopener noreferrer"
                              className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-black rounded-lg transition shadow-sm shadow-emerald-200">
                              <PhoneCall size={10} /> WA
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* PROMISES */}
                  {pDueCount > 0 && promises.length > 0 && (
                    <div className="border-t-4 border-amber-400">
                      <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-100">
                        <Bell size={12} className="text-amber-600 shrink-0" />
                        <p className="text-xs font-black text-amber-700">{pDueCount} waday aaj due hain</p>
                      </div>
                      {promises.slice(0, 5).map((p, i) => (
                        <div key={p.id} className={`flex items-center gap-3 px-4 py-2.5 ${i > 0 ? 'border-t border-slate-50' : ''}`}>
                          <div className="w-9 h-9 bg-amber-100 rounded-full flex items-center justify-center text-sm font-black text-amber-600 shrink-0 select-none">
                            {p.customerName[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate leading-tight">{p.customerName}</p>
                            <p className="text-[11px] text-slate-400 leading-tight truncate">{p.productName}{p.note ? ` · ${p.note}` : ''}</p>
                          </div>
                          <span className="shrink-0 text-[10px] font-black bg-amber-100 text-amber-700 px-2 py-1 rounded-lg">Wada</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ALL CLEAR */}
                  {briefing.dueToday === 0 && briefing.overdueTotal === 0 && pDueCount === 0 && (
                    <div className="flex flex-col items-center gap-3 py-10">
                      <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center ring-4 ring-emerald-50">
                        <CheckCircle size={26} className="text-emerald-600" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-black text-slate-800">Aaj sab clear hai!</p>
                        <p className="text-xs text-slate-400 mt-0.5">Koi due, overdue, ya wada pending nahi</p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ══ DAILY TARGET ══ */}
            {isOwner && shop?.settings?.dailyTarget && (() => {
              const target = shop.settings!.dailyTarget!;
              const pct    = Math.min(Math.round((todayTotal / target) * 100), 100);
              const over   = todayTotal > target;
              const bar    = over ? 'bg-emerald-500' : pct >= 70 ? 'bg-blue-500' : 'bg-amber-400';
              return (
                <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm px-4 py-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Target size={13} className="text-blue-600" />
                      <p className="text-xs font-black text-slate-800">Roz Ka Target</p>
                    </div>
                    <span className={`text-xs font-black ${over ? 'text-emerald-600' : 'text-blue-600'}`}>{pct}%{over ? ' ✓' : ''}</span>
                  </div>
                  <div className="flex items-baseline gap-2 mb-1.5">
                    <span className="text-lg font-black text-slate-900 tabular-nums">{pkr(todayTotal)}</span>
                    <span className="text-xs text-slate-400">/ {pkr(target)}</span>
                  </div>
                  <div className="bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div className={`h-full rounded-full ${bar} transition-all duration-700`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className={`text-[11px] font-bold mt-1 ${over ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {over ? `+${pkr(todayTotal - target)} target se zyada!` : `${pkr(target - todayTotal)} aur chahiye`}
                  </p>
                </div>
              );
            })()}

            {/* ══ RECENT INSTALLMENTS ══ */}
            <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <h2 className="text-xs font-black text-slate-800">Nayi Installments</h2>
                <button onClick={() => navigate('/installments')} className="flex items-center gap-1 text-xs text-blue-600 font-black hover:underline">
                  Sab <ArrowRight size={11} />
                </button>
              </div>
              {isLoading ? <RowSkeleton rows={4} /> : !d?.recentInstallments.length ? (
                <div className="py-8 text-center">
                  <p className="text-xs text-slate-400">Koi nahi.{' '}
                    <button onClick={() => navigate('/installments')} className="text-blue-600 font-black hover:underline">Banao</button>
                  </p>
                </div>
              ) : (
                d.recentInstallments.map((inst, i) => {
                  const statusCls: Record<string, string> = {
                    ACTIVE: 'bg-emerald-100 text-emerald-700',
                    COMPLETED: 'bg-blue-100 text-blue-700',
                    DEFAULTED: 'bg-red-100 text-red-700',
                    CANCELLED: 'bg-slate-100 text-slate-500',
                  };
                  return (
                    <div key={inst.id} onClick={() => navigate('/installments')}
                      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 transition ${i > 0 ? 'border-t border-slate-50' : ''}`}>
                      <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-xs font-black text-slate-600 shrink-0 select-none">
                        {inst.customerName[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate leading-tight">{inst.customerName}</p>
                        <p className="text-[10px] text-slate-400 truncate">{inst.productName}</p>
                      </div>
                      <div className="text-right shrink-0 mr-2">
                        <p className="text-xs font-black text-slate-900 tabular-nums">{pkr(Number(inst.remaining))}</p>
                        <p className="text-[10px] text-slate-400">baaki</p>
                      </div>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${statusCls[inst.status] ?? 'bg-slate-100 text-slate-500'}`}>
                        {inst.status.charAt(0) + inst.status.slice(1).toLowerCase()}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

          </div>{/* end centre col */}

          {/* ────── RIGHT SIDEBAR ────── */}
          <div className="w-full lg:w-64 xl:w-72 shrink-0 space-y-3">
            <div className="lg:sticky lg:top-[60px] space-y-3">

              {/* Field Cash (owner) */}
              {isOwner && staffCash.length > 0 && (
                <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50 border-b border-amber-100">
                    <div className="flex items-center gap-2">
                      <Wallet size={12} className="text-amber-600" />
                      <p className="text-xs font-black text-amber-800">Cash in Field</p>
                    </div>
                    <p className="text-sm font-black text-amber-700 tabular-nums">{pkr(fieldTotal)}</p>
                  </div>
                  {staffCash.map((s, i) => (
                    <div key={s.staffId} className={`flex items-center gap-2.5 px-4 py-2.5 ${i > 0 ? 'border-t border-slate-50' : ''}`}>
                      <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center text-[11px] font-black text-slate-600 shrink-0 select-none">
                        {s.staffName[0]?.toUpperCase()}
                      </div>
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

              {/* Completing Soon */}
              {isOwner && d && d.completingSoon.length > 0 && (
                <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-emerald-50 border-b border-emerald-100">
                    <div className="flex items-center gap-2">
                      <TrendingDown size={12} className="text-emerald-600" />
                      <p className="text-xs font-black text-emerald-800">Khatam Hone Wale</p>
                    </div>
                    <span className="text-[10px] font-black bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded">{d.completingSoon.length}</span>
                  </div>
                  {d.completingSoon.map((c, i) => {
                    const pill = c.paymentsLeft === 1 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700';
                    const waLink = wa(c.customerPhone, `Assalam-o-Alaikum ${c.customerName}! Sirf ${c.paymentsLeft} installment baaki hai.`);
                    return (
                      <div key={c.id} className={`flex items-center gap-2.5 px-4 py-2.5 ${i > 0 ? 'border-t border-slate-50' : ''}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-bold text-slate-900 truncate">{c.customerName}</p>
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded shrink-0 ${pill}`}>{c.paymentsLeft}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 truncate">{c.productName}</p>
                        </div>
                        <a href={waLink} target="_blank" rel="noopener noreferrer"
                          className="shrink-0 text-[10px] font-black text-white bg-emerald-500 hover:bg-emerald-600 px-2 py-1 rounded-lg transition">WA</a>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Low Stock */}
              {lowStock.length > 0 && (
                <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50 border-b border-amber-100">
                    <div className="flex items-center gap-2">
                      <Package size={12} className="text-amber-600" />
                      <p className="text-xs font-black text-amber-800">Kam Stock</p>
                    </div>
                    <button onClick={() => navigate('/products')} className="text-[10px] text-amber-700 font-black hover:underline">Manage →</button>
                  </div>
                  <div className="px-4 py-2.5 flex flex-wrap gap-1.5">
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
                <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-pink-50 border-b border-pink-100">
                    <Gift size={12} className="text-pink-500" />
                    <p className="text-xs font-black text-pink-700">{birthdays.length} Birthday is hafte</p>
                  </div>
                  {birthdays.map((c, i) => {
                    const [, mm, dd] = c.dob.split('-');
                    const bday  = new Date(`${new Date().getFullYear()}-${mm}-${dd}`);
                    const todayD = new Date(); todayD.setHours(0,0,0,0);
                    const isToday = bday.toDateString() === todayD.toDateString();
                    const waLink  = wa(c.phone, `Assalamu Alaikum ${c.name}! Aaj aap ka birthday hai — bohat mubarak ho!`);
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
                        <a href={waLink} target="_blank" rel="noopener noreferrer"
                          className="shrink-0 text-[10px] font-black text-white bg-green-500 hover:bg-green-600 px-2 py-1 rounded-lg transition">WA</a>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Mobile: Is Mahine */}
              {isOwner && d && (
                <div className="lg:hidden bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-black text-slate-700">Is Mahine</p>
                    <button onClick={() => navigate('/reports')} className="text-[11px] text-blue-600 font-black hover:underline flex items-center gap-0.5">Detail <ArrowRight size={10}/></button>
                  </div>
                  <p className="text-2xl font-black text-slate-900 tabular-nums">{pkrSh(monthTotal)}</p>
                  {(d.monthInstTarget ?? 0) > 0 && (() => {
                    const pct = Math.min(100, Math.round((d.monthCollections / d.monthInstTarget!) * 100));
                    const bar = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-blue-500' : 'bg-amber-400';
                    return (
                      <div className="mt-2">
                        <div className="flex justify-between mb-1">
                          <p className="text-[10px] text-slate-400">Target {pkrSh(d.monthInstTarget!)}</p>
                          <p className="text-[10px] font-black text-slate-600">{pct}%</p>
                        </div>
                        <div className="bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })()}
                  {(d.monthExpenseTotal ?? 0) > 0 && (
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <div className="bg-slate-50 rounded-xl px-3 py-2">
                        <p className="text-[10px] text-slate-400">Kharcha</p>
                        <p className="text-sm font-black text-red-500 tabular-nums">{pkrSh(d.monthExpenseTotal ?? 0)}</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl px-3 py-2">
                        <p className="text-[10px] text-slate-400">Net Faida</p>
                        {(() => {
                          const profit = monthTotal - (d.monthExpenseTotal ?? 0);
                          return <p className={`text-sm font-black tabular-nums ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{profit >= 0 ? '' : '-'}{pkrSh(Math.abs(profit))}</p>;
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Add new shortcut (desktop) */}
              <button onClick={() => navigate('/installments')}
                className="hidden lg:flex w-full items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl transition shadow-sm shadow-blue-200">
                <Plus size={13} /> Naya Installment
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
                <div>
                  <p className="text-white font-black text-sm">Cash Jama Karein</p>
                  <p className="text-slate-400 text-xs mt-0.5">Owner ko hand over karo</p>
                </div>
                <button onClick={() => setShowHandover(false)} className="text-slate-400 hover:text-white transition"><X size={16} /></button>
              </div>
              <div className="p-5 space-y-3">
                <div className="bg-slate-50 rounded-xl px-3 py-2.5 ring-1 ring-slate-200">
                  <p className="text-[10px] text-slate-400">System ka hisaab</p>
                  <p className="text-2xl font-black text-slate-900 tabular-nums">{pkr(bal)}</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Actual Amount *</label>
                  <input type="number" value={handoverAmt} onChange={e => setHandoverAmt(e.target.value)} autoFocus
                    className="w-full border border-slate-200 rounded-xl px-3 py-3 text-xl font-black tabular-nums focus:outline-none focus:border-emerald-400 transition" />
                  {handoverAmt && amt !== bal && (
                    <p className={`text-xs mt-1.5 font-black ${diff < 0 ? 'text-red-500' : 'text-amber-500'}`}>
                      {pkr(Math.abs(diff))} {diff < 0 ? 'kam' : 'zyada'}
                    </p>
                  )}
                </div>
                <textarea value={handoverNote} onChange={e => setHandoverNote(e.target.value)} rows={2} placeholder="Note…"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-emerald-400 transition" />
              </div>
              <div className="flex gap-2 px-5 pb-5">
                <button onClick={() => setShowHandover(false)} className="flex-1 py-2.5 text-sm font-bold border border-slate-200 rounded-xl hover:bg-slate-50 transition">Wapas</button>
                <button disabled={!handoverAmt || amt <= 0 || submitHandover.isPending} onClick={() => submitHandover.mutate()}
                  className="flex-1 py-2.5 text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl transition flex items-center justify-center gap-1.5">
                  {submitHandover.isPending ? <span className="animate-pulse">Jama ho raha…</span> : <><Send size={13} /> Jama Karein</>}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {receiveTarget && <CashReceiveModal target={receiveTarget} onClose={() => setReceiveTarget(null)} />}
    </div>
  );
}
