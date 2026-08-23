import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  X, Send, CheckCircle, PhoneCall, Wallet,
  Clock, ChevronRight, Plus,
  TrendingDown, Gift, Package, Bell,
  Users, ArrowUpRight, CheckSquare,
} from 'lucide-react';
import { useAuthStore } from '../store/auth.store.ts';
import { statsApi } from '../api/stats.api.ts';
import { installmentsApi } from '../api/installments.api.ts';
import { recoveryApi } from '../api/recovery.api.ts';
import { sellersApi } from '../api/sellers.api.ts';
import { customersApi } from '../api/customers.api.ts';
import { handoversApi, type StaffBalance } from '../api/handovers.api.ts';
import { RowSkeleton } from '../components/ui/Skeleton.tsx';
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

/* ─── CashReceiveModal ───────────────────────────────────────────────────── */
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
        <div className="bg-[#0F1629] px-5 py-4 flex items-center justify-between">
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
            <label className="block text-xs font-bold mb-1" style={{ color: 'var(--ink-dim)' }}>Gini hui raqam *</label>
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

/* ════════════════════════════════════════════════════════════════════════════
   DASHBOARD
════════════════════════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const user      = useAuthStore(s => s.user);
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
    queryKey: ['handover-my-balance'],
    queryFn:  () => handoversApi.myBalance(),
    enabled: !isOwner, staleTime: 30_000, refetchInterval: 120_000,
  });
  const { data: pendingBals = [] } = useQuery<StaffBalance[]>({
    queryKey: ['handover-pending-balances'],
    queryFn:  handoversApi.pendingBalances,
    enabled: isOwner, staleTime: 30_000, refetchInterval: 120_000,
  });
  const submitHandover = useMutation({
    mutationFn: () => handoversApi.create({ handedAmount: Number(handoverAmt), note: handoverNote.trim() || undefined }),
    onSuccess: () => {
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
  const { data: staffToday = [] } = useQuery({
    queryKey: ['staff-today-collections'],
    queryFn:  statsApi.getStaffTodayCollections,
    enabled: isOwner,
    staleTime: 60_000, refetchInterval: 3 * 60_000,
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
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Masla ho gaya'),
  });
  const { data: shop } = useQuery({
    queryKey: ['shop-me'], queryFn: sellersApi.getMe,
    staleTime: 5 * 60_000, enabled: isOwner,
  });
  const { data: birthdays = [] } = useQuery({
    queryKey: ['upcoming-birthdays'], queryFn: customersApi.getUpcomingBirthdays,
    staleTime: 60 * 60_000,
  });

  /* ── derived ── */
  const d              = dash?.stats;
  const today          = fmtDate(new Date());
  const todayTotal     = (d?.todayCollections ?? 0) + (d?.todayCashSales ?? 0);
  const monthTotal     = (d?.monthCollections ?? 0) + (d?.monthCashSales ?? 0);
  const lowStock       = d?.lowStockItems ?? [];
  const completingSoon = d?.completingSoon ?? [];
  const staffCash      = pendingBals.filter(s => Number(s.pendingBalance) > 0);
  const fieldTotal     = staffCash.reduce((a, s) => a + Number(s.pendingBalance), 0);
  const netFaida       = monthTotal - (d?.monthExpenseTotal ?? 0);
  const dailyTarget    = shop?.settings?.dailyTarget;
  const dailyPct       = dailyTarget ? Math.min(100, Math.round((todayTotal / dailyTarget) * 100)) : 0;
  const bOverdue       = briefing?.overdueTotal   ?? 0;
  const bDueToday      = briefing?.dueToday       ?? 0;
  const bPending       = isOwner ? (briefing?.pendingApprovalCount ?? 0) : 0;
  const totalWork      = bOverdue + bDueToday + pDueCount + bPending;
  const allClear       = !!briefing && totalWork === 0;
  const kpiOverdue     = d?.overdueCount ?? 0;

  /* staff today — max for progress bar */
  const staffTodayMax = staffToday.length > 0 ? Math.max(...staffToday.map(s => s.total)) : 0;

  return (
    <div style={{ background: '#F8FAFF', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", minHeight: '100vh' }}>

      {/* Fonts */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      <style>{`
        :root { --ink: #0F172A; --ink-dim: #64748B; --surface: #FFFFFF; --accent: #6366F1; }
        @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --ink: #E2E8F0; --ink-dim: #7C8DB5; --surface: #131A2E; --accent: #818CF8; } }
        :root[data-theme="dark"] { --ink: #E2E8F0; --ink-dim: #7C8DB5; --surface: #131A2E; --accent: #818CF8; }
        body { background: #F8FAFF; }
      `}</style>

      {/* ══ PAGE HEADER ═════════════════════════════════════════════════════ */}
      <div className="px-5 sm:px-8 pt-6 pb-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[1.75rem] font-black leading-tight" style={{ color: '#1A1A2E', fontFamily: "'Syne', sans-serif" }}>
            Dashboard
          </h1>
          <p className="text-[13px] font-medium mt-0.5" style={{ color: '#94A3B8' }}>
            {greet()}, {firstName} · {today}
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          {!isOwner && myBal && Number(myBal.pendingBalance) > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
              style={{ background: myBal.pendingHandover ? '#FFFBEB' : '#ECFDF5', border: `1px solid ${myBal.pendingHandover ? '#FDE68A' : '#A7F3D0'}` }}>
              <Wallet size={12} style={{ color: myBal.pendingHandover ? '#D97706' : '#059669' }}/>
              <span className="text-xs font-black" style={{ color: myBal.pendingHandover ? '#D97706' : '#059669' }}>
                {pkrSh(Number(myBal.pendingBalance))} haath mein
              </span>
            </div>
          )}
          {!isOwner && myBal && Number(myBal.pendingBalance) > 0 && !myBal.pendingHandover && (
            <button onClick={() => { setHandoverAmt(String(Number(myBal.pendingBalance))); setShowHandover(true); }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black text-white"
              style={{ background: '#10B981' }}>
              <Send size={11}/> Jama Karo
            </button>
          )}
          {!isOwner && myBal?.pendingHandover && (
            <span className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black"
              style={{ background: '#FFFBEB', border: '1px solid #FDE68A', color: '#D97706' }}>
              <Clock size={10}/> Pending
            </span>
          )}
          {(isOwner || perms?.canAddInstallment) && (
            <button onClick={() => navigate('/installments')}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-black text-white"
              style={{ background: '#6366F1', boxShadow: '0 4px 14px rgba(99,102,241,0.35)' }}>
              <Plus size={14}/> Naya Plan
            </button>
          )}
        </div>
      </div>

      {/* ══ BODY ════════════════════════════════════════════════════════════ */}
      <div className="px-5 sm:px-8 pb-10">
        <div className="lg:grid lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_320px] gap-5 items-start">

          {/* LEFT COLUMN */}
          <div className="space-y-5">

            {/* ── TODAY'S SALES CARD (matches Figma "Today's Sales") ── */}
            {isOwner && (
              <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid #F0F0F5' }}>
                {/* Card header */}
                <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid #F5F5FA' }}>
                  <div>
                    <h2 className="text-[17px] font-black" style={{ color: '#1A1A2E' }}>Aaj Ki Sales</h2>
                    <p className="text-[12px] font-medium mt-0.5" style={{ color: '#94A3B8' }}>Sales Summary</p>
                  </div>
                  <button onClick={() => navigate('/installments')}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold border transition hover:bg-slate-50"
                    style={{ color: '#64748B', borderColor: '#E2E8F0' }}>
                    <ArrowUpRight size={14}/> Detail
                  </button>
                </div>

                {/* 4 KPI sub-cards — exactly like Figma */}
                {isLoading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-6">
                    {[0,1,2,3].map(i => <div key={i} className="h-28 rounded-2xl animate-pulse" style={{ background: '#F5F5FA' }}/>)}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-6">

                    {/* Aaj Aya — pink like Figma "Total Sales" */}
                    <div className="rounded-2xl p-4" style={{ background: '#FFF0F3' }}>
                      <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ background: '#FFB5C8' }}>
                        <ArrowUpRight size={17} style={{ color: '#E11D48' }}/>
                      </div>
                      <p className="text-[1.3rem] font-black tabular-nums leading-none" style={{ color: '#1A1A2E', fontFamily: "'Syne', sans-serif" }}>
                        {pkrSh(todayTotal)}
                      </p>
                      <p className="text-xs font-semibold mt-1.5" style={{ color: '#64748B' }}>Aaj Aya</p>
                      {dailyTarget && dailyPct > 0 && (
                        <p className="text-[11px] font-bold mt-1" style={{ color: '#10B981' }}>+{dailyPct}% target ka</p>
                      )}
                    </div>

                    {/* Is Mahine — orange like Figma "Total Order" */}
                    <div className="rounded-2xl p-4" style={{ background: '#FFF7ED' }}>
                      <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ background: '#FDBA74' }}>
                        <TrendingDown size={17} style={{ color: '#C2410C', transform: 'rotate(180deg)' }}/>
                      </div>
                      <p className="text-[1.3rem] font-black tabular-nums leading-none" style={{ color: '#1A1A2E', fontFamily: "'Syne', sans-serif" }}>
                        {pkrSh(monthTotal)}
                      </p>
                      <p className="text-xs font-semibold mt-1.5" style={{ color: '#64748B' }}>Is Mahine</p>
                      <p className="text-[11px] font-bold mt-1" style={{ color: netFaida >= 0 ? '#10B981' : '#EF4444' }}>
                        {netFaida >= 0 ? '+' : ''}{pkrSh(netFaida)} net
                      </p>
                    </div>

                    {/* Active Plans — green like Figma "Product Sold" */}
                    <div className="rounded-2xl p-4" style={{ background: '#F0FDF4' }}>
                      <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ background: '#86EFAC' }}>
                        <CheckCircle size={17} style={{ color: '#16A34A' }}/>
                      </div>
                      <p className="text-[1.3rem] font-black tabular-nums leading-none" style={{ color: '#1A1A2E', fontFamily: "'Syne', sans-serif" }}>
                        {d?.activeCount ?? 0}
                      </p>
                      <p className="text-xs font-semibold mt-1.5" style={{ color: '#64748B' }}>Active Plans</p>
                      <p className="text-[11px] font-bold mt-1" style={{ color: '#10B981' }}>
                        {d?.newThisMonthCount ?? 0} naye is mahine
                      </p>
                    </div>

                    {/* Overdue — purple like Figma "New Customers" */}
                    <button className="rounded-2xl p-4 text-left w-full" onClick={() => navigate('/installments')}
                      style={{ background: kpiOverdue > 0 ? '#FEF2F2' : '#F5F3FF' }}>
                      <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
                        style={{ background: kpiOverdue > 0 ? '#FCA5A5' : '#C4B5FD' }}>
                        <Users size={17} style={{ color: kpiOverdue > 0 ? '#DC2626' : '#7C3AED' }}/>
                      </div>
                      <p className="text-[1.3rem] font-black tabular-nums leading-none" style={{ color: kpiOverdue > 0 ? '#DC2626' : '#1A1A2E', fontFamily: "'Syne', sans-serif" }}>
                        {kpiOverdue > 0 ? kpiOverdue : '✓'}
                      </p>
                      <p className="text-xs font-semibold mt-1.5" style={{ color: '#64748B' }}>Overdue</p>
                      <p className="text-[11px] font-bold mt-1" style={{ color: kpiOverdue > 0 ? '#EF4444' : '#10B981' }}>
                        {kpiOverdue > 0 ? `${pkrSh(d?.overdueAmount ?? 0)} baaki` : 'Sab clear hai'}
                      </p>
                    </button>

                  </div>
                )}

                {/* Daily progress bar if target set */}
                {isOwner && dailyTarget && !isLoading && (
                  <div className="px-6 pb-5">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[11px] font-semibold" style={{ color: '#94A3B8' }}>Daily Target Progress</p>
                      <p className="text-[11px] font-black" style={{ color: '#6366F1' }}>{dailyPct}%</p>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: '#E0E7FF' }}>
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, dailyPct)}%`, background: 'linear-gradient(90deg, #6366F1, #818CF8)', transition: 'width 0.8s ease' }}/>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* non-owner cash card */}
            {!isOwner && myBal && Number(myBal.pendingBalance) > 0 && (
              <div className="rounded-2xl p-5 flex items-center gap-4"
                style={{ background: '#FFFFFF', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: `1px solid ${myBal.pendingHandover ? '#FDE68A' : '#A7F3D0'}` }}>
                <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: myBal.pendingHandover ? '#FEF3C7' : '#D1FAE5' }}>
                  <Wallet size={22} style={{ color: myBal.pendingHandover ? '#D97706' : '#059669' }}/>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold" style={{ color: '#94A3B8' }}>{myBal.pendingHandover ? 'Handover Pending' : 'Cash Haath Mein'}</p>
                  <p className="text-2xl font-black tabular-nums" style={{ color: '#1A1A2E', fontFamily: "'Syne', sans-serif" }}>{pkr(Number(myBal.pendingBalance))}</p>
                </div>
                {!myBal.pendingHandover && (
                  <button onClick={() => { setHandoverAmt(String(Number(myBal.pendingBalance))); setShowHandover(true); }}
                    className="px-4 py-2.5 rounded-xl text-sm font-black text-white shrink-0"
                    style={{ background: '#10B981' }}>
                    <Send size={13} className="inline mr-1.5"/> Jama
                  </button>
                )}
              </div>
            )}

            {/* AAJ KA KAAM */}
            <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid #F0F0F5' }}>
              <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: '1px solid #F5F5FA' }}>
                <div>
                  <h2 className="text-[17px] font-black" style={{ color: '#1A1A2E' }}>Aaj Ka Kaam</h2>
                  <p className="text-[12px] font-medium mt-0.5" style={{ color: '#94A3B8' }}>
                    {!briefing ? 'Load ho raha…' : allClear ? 'Sab clear — Mashaallah!' : `${totalWork} cheez pending`}
                  </p>
                </div>
                {briefing && totalWork > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {bPending  > 0 && <span className="text-[10px] font-black px-2 py-1 rounded-lg" style={{ background: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE' }}>{bPending} approve</span>}
                    {bOverdue  > 0 && <span className="text-[10px] font-black px-2 py-1 rounded-lg" style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>{bOverdue} late</span>}
                    {bDueToday > 0 && <span className="text-[10px] font-black px-2 py-1 rounded-lg" style={{ background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' }}>{bDueToday} aaj</span>}
                    {pDueCount > 0 && <span className="text-[10px] font-black px-2 py-1 rounded-lg" style={{ background: '#FFFBEB', color: '#D97706', border: '1px solid #FDE68A' }}>{pDueCount} wada</span>}
                  </div>
                )}
              </div>

              {!briefing ? <RowSkeleton rows={5}/> : (
                <>
                  {/* PENDING APPROVALS — owner only */}
                  {isOwner && briefing.pendingApprovals && briefing.pendingApprovals.length > 0 && (
                    <>
                      <div className="px-5 py-2.5 flex items-center gap-2"
                        style={{ background: '#F5F3FF', borderBottom: '1px solid #EDE9FE' }}>
                        <div className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0"/>
                        <span className="text-[11px] font-black text-violet-700 uppercase tracking-wider">Approve Karein ({briefing.pendingApprovalCount})</span>
                      </div>
                      {briefing.pendingApprovals.map((p, i) => (
                        <div key={p.id}
                          className={`flex items-center gap-3 pl-5 pr-4 py-3.5 hover:bg-violet-50/40 transition ${i > 0 ? 'border-t' : ''}`}
                          style={{ borderColor: '#F5F3FF', borderLeft: '3px solid #C4B5FD' }}>
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0"
                            style={{ background: '#EDE9FE', color: '#7C3AED' }}>
                            {p.customerName[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate" style={{ color: '#0F172A' }}>{p.customerName}</p>
                            <p className="text-[11px] truncate" style={{ color: '#64748B' }}>{p.productName} · {pkr(p.totalAmount)}</p>
                          </div>
                          <button
                            disabled={approveMut.isPending && approveMut.variables === p.id}
                            onClick={() => approveMut.mutate(p.id)}
                            className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-black text-white transition disabled:opacity-50"
                            style={{ background: '#7C3AED' }}>
                            <CheckSquare size={11}/>
                            {approveMut.isPending && approveMut.variables === p.id ? '…' : 'Approve'}
                          </button>
                        </div>
                      ))}
                    </>
                  )}

                  {briefing.urgentAccounts.length > 0 && (
                    <>
                      <div className="px-5 py-2.5 flex items-center gap-2" style={{ background: '#FEF2F2', borderBottom: '1px solid #FEE2E2' }}>
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"/>
                        <span className="text-[11px] font-black text-red-600 uppercase tracking-wider">Overdue ({briefing.overdueTotal})</span>
                      </div>
                      {briefing.urgentAccounts.map((acct, i) => (
                        <div key={acct.id}
                          className={`flex items-center gap-3 pl-5 pr-4 py-3.5 hover:bg-red-50/40 transition ${i > 0 ? 'border-t' : ''}`}
                          style={{ borderColor: '#FEF2F2', borderLeft: '3px solid #FCA5A5' }}>
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0"
                            style={{ background: '#FEE2E2', color: '#DC2626' }}>
                            {acct.customerName[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate" style={{ color: '#0F172A' }}>{acct.customerName}</p>
                            <p className="text-[11px]" style={{ color: '#64748B' }}>{acct.customerPhone}</p>
                          </div>
                          <div className="text-right shrink-0 mr-2">
                            <p className="text-sm font-black tabular-nums" style={{ color: '#0F172A' }}>{pkr(acct.monthly)}</p>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                              style={{ background: '#FEE2E2', color: acct.daysOverdue >= 30 ? '#991B1B' : '#B45309' }}>
                              {acct.daysOverdue}d late
                            </span>
                          </div>
                          <a href={waLink(acct.customerPhone, `Assalam-o-Alaikum ${acct.customerName}! Installment ${acct.daysOverdue} din se due hai. ${pkr(acct.monthly)} jama karwain.`)}
                            target="_blank" rel="noopener noreferrer"
                            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl text-white"
                            style={{ background: '#25D366' }}>
                            <PhoneCall size={13}/>
                          </a>
                        </div>
                      ))}
                    </>
                  )}

                  {briefing.dueTodayAccounts.length > 0 && (
                    <>
                      <div className="px-5 py-2.5 flex items-center justify-between"
                        style={{ background: '#EFF6FF', borderTop: '1px solid #DBEAFE', borderBottom: '1px solid #DBEAFE' }}>
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"/>
                          <span className="text-[11px] font-black text-blue-600 uppercase tracking-wider">Aaj Ka Qist ({briefing.dueToday})</span>
                        </div>
                        {(briefing.dueTomorrow ?? 0) > 0 && (
                          <span className="text-[10px] font-medium" style={{ color: '#64748B' }}>+{briefing.dueTomorrow} kal</span>
                        )}
                      </div>
                      {briefing.dueTodayAccounts.slice(0, 20).map((acct, i) => (
                        <div key={acct.id}
                          className={`flex items-center gap-3 pl-5 pr-4 py-3.5 hover:bg-blue-50/40 transition ${i > 0 ? 'border-t' : ''}`}
                          style={{ borderColor: '#EFF6FF', borderLeft: '3px solid #93C5FD' }}>
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0"
                            style={{ background: '#DBEAFE', color: '#2563EB' }}>
                            {acct.customerName[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate" style={{ color: '#0F172A' }}>{acct.customerName}</p>
                            <p className="text-[11px]" style={{ color: '#64748B' }}>{acct.customerPhone}</p>
                          </div>
                          <p className="text-sm font-black tabular-nums shrink-0 mr-2" style={{ color: '#2563EB' }}>{pkr(acct.monthly)}</p>
                          <a href={waLink(acct.customerPhone, `Assalam-o-Alaikum ${acct.customerName}! Aaj ka installment ${pkr(acct.monthly)} due hai. Jazak'Allah!`)}
                            target="_blank" rel="noopener noreferrer"
                            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl text-white"
                            style={{ background: '#25D366' }}>
                            <PhoneCall size={13}/>
                          </a>
                        </div>
                      ))}
                      {briefing.dueTodayAccounts.length > 20 && (
                        <button onClick={() => navigate('/installments')}
                          className="w-full py-2.5 text-xs font-black flex items-center justify-center gap-1 hover:bg-blue-50 transition"
                          style={{ borderTop: '1px solid #EFF6FF', color: '#2563EB' }}>
                          +{briefing.dueTodayAccounts.length - 20} aur <ChevronRight size={11}/>
                        </button>
                      )}
                    </>
                  )}

                  {pDueCount > 0 && promises.length > 0 && (
                    <>
                      <div className="px-5 py-2.5 flex items-center gap-2"
                        style={{ background: '#FFFBEB', borderTop: '1px solid #FEF3C7', borderBottom: '1px solid #FEF3C7' }}>
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"/>
                        <span className="text-[11px] font-black text-amber-600 uppercase tracking-wider">Waday ({pDueCount})</span>
                      </div>
                      {promises.slice(0, 5).map((p, i) => (
                        <div key={p.id}
                          className={`flex items-center gap-3 pl-5 pr-4 py-3.5 ${i > 0 ? 'border-t' : ''}`}
                          style={{ borderColor: '#FFFBEB', borderLeft: '3px solid #FCD34D' }}>
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0"
                            style={{ background: '#FEF3C7', color: '#D97706' }}>
                            {p.customerName[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate" style={{ color: '#0F172A' }}>{p.customerName}</p>
                            <p className="text-[11px] truncate" style={{ color: '#64748B' }}>{p.productName}{p.note ? ` · ${p.note}` : ''}</p>
                          </div>
                          <span className="shrink-0 flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg"
                            style={{ background: '#FEF3C7', color: '#D97706', border: '1px solid #FDE68A' }}>
                            <Bell size={9}/> Wada
                          </span>
                        </div>
                      ))}
                    </>
                  )}

                  {allClear && (
                    <div className="py-14 flex flex-col items-center text-center">
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                        style={{ background: '#ECFDF5', border: '1px solid #A7F3D0' }}>
                        <CheckCircle size={30} style={{ color: '#10B981' }}/>
                      </div>
                      <p className="text-base font-black" style={{ color: '#0F172A' }}>Sab Clear Hai!</p>
                      <p className="text-xs mt-1.5 leading-relaxed" style={{ color: '#64748B', maxWidth: '200px' }}>
                        Koi due, overdue ya wada nahi. Mashaallah!
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* OVERDUE AGING BUCKETS */}
            {isOwner && d?.agingBuckets && (d.agingBuckets.days0_7 > 0 || d.agingBuckets.days8_30 > 0 || d.agingBuckets.days31_90 > 0 || d.agingBuckets.days90plus > 0) && (
              <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid #F0F0F5' }}>
                <div className="px-6 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid #F5F5FA' }}>
                  <Clock size={14} style={{ color: '#DC2626' }} />
                  <h2 className="text-[15px] font-black" style={{ color: '#1A1A2E' }}>Overdue Breakdown</h2>
                  <span className="ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
                    {(d.agingBuckets.days0_7 + d.agingBuckets.days8_30 + d.agingBuckets.days31_90 + d.agingBuckets.days90plus)} total
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 divide-x divide-gray-50">
                  {[
                    { label: '1–7 din', value: d.agingBuckets.days0_7,   bg: '#FFFBEB', color: '#D97706', border: '#FDE68A' },
                    { label: '8–30 din', value: d.agingBuckets.days8_30,  bg: '#FFF7ED', color: '#C2410C', border: '#FDBA74' },
                    { label: '31–90 din', value: d.agingBuckets.days31_90, bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' },
                    { label: '90+ din', value: d.agingBuckets.days90plus, bg: '#FFF1F2', color: '#9F1239', border: '#FDA4AF' },
                  ].map((b) => (
                    <div key={b.label} className="flex flex-col items-center py-5 px-3"
                      style={{ background: b.value > 0 ? b.bg : '#FAFAFA' }}>
                      <p className="text-[1.5rem] font-black tabular-nums leading-none"
                        style={{ color: b.value > 0 ? b.color : '#CBD5E1', fontFamily: "'Syne', sans-serif" }}>
                        {b.value}
                      </p>
                      <p className="text-[11px] font-semibold mt-1.5" style={{ color: b.value > 0 ? b.color : '#94A3B8' }}>{b.label}</p>
                    </div>
                  ))}
                </div>
                {d.agingBuckets.days31_90 + d.agingBuckets.days90plus > 0 && (
                  <div className="px-5 py-3 flex items-center gap-2 border-t border-red-50">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 animate-pulse"/>
                    <p className="text-[11px] font-semibold" style={{ color: '#DC2626' }}>
                      {d.agingBuckets.days31_90 + d.agingBuckets.days90plus} accounts 30+ din se overdue — fori action zaruri hai
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* STAFF COLLECTIONS — "Top Products" table style from Figma */}
            {isOwner && (
              <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid #F0F0F5' }}>
                <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid #F5F5FA' }}>
                  <div>
                    <h2 className="text-[17px] font-black" style={{ color: '#1A1A2E' }}>Staff Collections</h2>
                    <p className="text-[12px] font-medium mt-0.5" style={{ color: '#94A3B8' }}>
                      {staffToday.some(s => s.total > 0)
                        ? `${staffToday.reduce((a, s) => a + s.count, 0)} payments aaj`
                        : 'Employee-wise aaj ki breakdown'}
                    </p>
                  </div>
                  <button onClick={() => navigate('/installments')}
                    className="text-[12px] font-black flex items-center gap-0.5 hover:underline" style={{ color: '#6366F1' }}>
                    Sab <ChevronRight size={12}/>
                  </button>
                </div>


                {isLoading ? <RowSkeleton rows={3}/> : staffToday.length === 0 ? (
                  <div className="py-10 text-center">
                    <p className="text-sm" style={{ color: '#94A3B8' }}>Aaj abhi koi collection nahi hui</p>
                  </div>
                ) : (
                  <>
                    {staffToday.map((staff, i) => {
                      const pct = staffTodayMax > 0 ? Math.round((staff.total / staffTodayMax) * 100) : 0;
                      const pal = ['#6366F1', '#10B981', '#F59E0B', '#3B82F6', '#EC4899', '#0891B2'];
                      const col = pal[i % pal.length];
                      const has = staff.total > 0;
                      return (
                        <div key={staff.staffId}
                          className={`flex items-center gap-3 px-6 py-3.5 ${i > 0 ? 'border-t' : ''}`}
                          style={{ borderColor: '#F5F5FA' }}>
                          <span className="text-sm font-black w-7 shrink-0" style={{ color: '#CBD5E1' }}>
                            {String(i + 1).padStart(2, '0')}
                          </span>
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                            style={{ background: has ? col : '#F1F5F9', color: has ? '#fff' : '#94A3B8' }}>
                            {staff.staffName[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate" style={{ color: '#1A1A2E' }}>{staff.staffName}</p>
                            <div className="h-1.5 rounded-full overflow-hidden mt-1.5" style={{ background: '#F1F5F9' }}>
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: col, transition: 'width 0.7s' }}/>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-black tabular-nums" style={{ color: has ? '#1A1A2E' : '#CBD5E1', fontFamily: "'Syne', sans-serif" }}>
                              {has ? pkrSh(staff.total) : '—'}
                            </p>
                            <p className="text-[10px] font-bold mt-0.5" style={{ color: has ? col : '#CBD5E1' }}>
                              {has ? `${staff.count} collection${staff.count !== 1 ? 's' : ''}` : 'koi nahi'}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    {staffToday.some(s => s.total > 0) && (
                      <div className="flex items-center justify-between px-6 py-3.5" style={{ background: '#FAFBFF', borderTop: '1px solid #F5F5FA' }}>
                        <p className="text-xs font-bold" style={{ color: '#64748B' }}>Kul Aaj Ki Collection</p>
                        <p className="font-black tabular-nums" style={{ color: '#1A1A2E', fontFamily: "'Syne', sans-serif", fontSize: '1rem' }}>
                          {pkr(staffToday.reduce((a, s) => a + s.total, 0))}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* RECENT INSTALLMENTS */}
            <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid #F0F0F5' }}>
              <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid #F5F5FA' }}>
                <div>
                  <h2 className="text-[17px] font-black" style={{ color: '#1A1A2E' }}>Recent Installments</h2>
                  <p className="text-[12px] font-medium mt-0.5" style={{ color: '#94A3B8' }}>Latest added accounts</p>
                </div>
                <button onClick={() => navigate('/installments')}
                  className="text-[12px] font-black flex items-center gap-0.5 hover:underline" style={{ color: '#6366F1' }}>
                  Sab <ChevronRight size={12}/>
                </button>
              </div>
              {isLoading ? <RowSkeleton rows={5}/> : !d?.recentInstallments.length ? (
                <div className="py-10 text-center">
                  <p className="text-xs" style={{ color: '#64748B' }}>
                    Koi installment nahi.{' '}
                    <button onClick={() => navigate('/installments')} className="font-black" style={{ color: '#6366F1' }}>Banao</button>
                  </p>
                </div>
              ) : (
                d.recentInstallments.map((inst, i) => {
                  const sc: Record<string, { bg: string; color: string; label: string }> = {
                    ACTIVE:    { bg: '#EFF6FF', color: '#2563EB', label: 'Active' },
                    COMPLETED: { bg: '#ECFDF5', color: '#059669', label: 'Khatam' },
                    DEFAULTED: { bg: '#FEF2F2', color: '#DC2626', label: 'Overdue' },
                    CANCELLED: { bg: '#F8FAFC', color: '#94A3B8', label: 'Cancel' },
                  };
                  const s = sc[inst.status] ?? { bg: '#F8FAFC', color: '#94A3B8', label: inst.status };
                  return (
                    <div key={inst.id} onClick={() => navigate('/installments')}
                      className={`flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-slate-50/70 transition ${i > 0 ? 'border-t' : ''}`}
                      style={{ borderColor: '#F8FAFC' }}>
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0"
                        style={{ background: '#EEF2FF', color: '#6366F1' }}>
                        {inst.customerName[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate" style={{ color: '#0F172A' }}>{inst.customerName}</p>
                        <p className="text-[11px] truncate" style={{ color: '#64748B' }}>{inst.productName}</p>
                      </div>
                      <div className="text-right shrink-0 mr-3">
                        <p className="text-sm font-black tabular-nums" style={{ color: '#0F172A' }}>{pkr(Number(inst.remaining))}</p>
                        <p className="text-[10px]" style={{ color: '#64748B' }}>baaki</p>
                      </div>
                      <span className="text-[10px] font-black px-2.5 py-1 rounded-full shrink-0"
                        style={{ background: s.bg, color: s.color }}>{s.label}</span>
                    </div>
                  );
                })
              )}
            </div>

          </div>{/* end left */}

          {/* RIGHT SIDEBAR */}
          <div className="mt-5 lg:mt-0">
            <div className="lg:sticky lg:top-[73px] space-y-4 lg:max-h-[calc(100vh-89px)] lg:overflow-y-auto lg:pb-4">

              {/* PORTFOLIO */}
              {isOwner && (
                <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid #F0F0F5' }}>
                  <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F5F5FA' }}>
                    <div>
                      <h3 className="text-[15px] font-black" style={{ color: '#1A1A2E' }}>Portfolio</h3>
                      <p className="text-[11px] font-medium mt-0.5" style={{ color: '#94A3B8' }}>Overall summary</p>
                    </div>
                    <button onClick={() => navigate('/installments')}
                      className="text-[11px] font-black flex items-center gap-0.5 hover:underline" style={{ color: '#6366F1' }}>
                      Sab <ArrowUpRight size={10}/>
                    </button>
                  </div>
                  {isLoading ? <RowSkeleton rows={5}/> : (
                    ([
                      { label: 'Active Plans',      value: d?.activeCount ?? 0,            sub: `${d?.monthlyActiveCount ?? 0} mahana · ${d?.dailyActiveCount ?? 0} roz`, color: '#2563EB' },
                      { label: 'Overdue',           value: d?.overdueCount ?? 0,            sub: (d?.overdueAmount ?? 0) > 0 ? pkrSh(d!.overdueAmount) + ' baaki' : 'sab clear', color: (d?.overdueCount ?? 0) > 0 ? '#DC2626' : '#10B981', click: () => navigate('/installments') },
                      { label: 'Khatam Hone Wale', value: completingSoon.length,           sub: '1–3 qist baaki', color: completingSoon.length > 0 ? '#D97706' : '#CBD5E1' },
                      { label: 'Naye Is Mahine',   value: d?.newThisMonthCount ?? 0,       sub: pkrSh(d?.newThisMonthValue ?? 0), color: '#6366F1' },
                      { label: 'Khatam Is Mahine', value: d?.completedThisMonthCount ?? 0, sub: pkrSh(d?.completedThisMonthValue ?? 0), color: (d?.completedThisMonthCount ?? 0) > 0 ? '#059669' : '#CBD5E1' },
                    ] as Array<{ label: string; value: number; sub: string; color: string; click?: () => void }>).map((row, i) => (
                      <div key={row.label} onClick={row.click}
                        className={`flex items-center justify-between px-5 py-3.5 ${row.click ? 'cursor-pointer hover:bg-[#FAFBFF] transition' : ''} ${i > 0 ? 'border-t' : ''}`}
                        style={{ borderColor: '#F5F5FA' }}>
                        <p className="text-xs font-semibold" style={{ color: '#64748B' }}>{row.label}</p>
                        <div className="text-right">
                          <p className="text-base font-black tabular-nums" style={{ color: row.color, fontFamily: "'Syne', sans-serif" }}>{row.value}</p>
                          <p className="text-[10px]" style={{ color: '#94A3B8' }}>{row.sub}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* CASH IN FIELD */}
              {isOwner && staffCash.length > 0 && (
                <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid #F0F0F5' }}>
                  <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F5F5FA' }}>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: '#FEF3C7' }}>
                        <Wallet size={14} style={{ color: '#D97706' }}/>
                      </div>
                      <div>
                        <h3 className="text-[15px] font-black" style={{ color: '#1A1A2E' }}>Cash in Field</h3>
                        <p className="text-[11px] font-medium" style={{ color: '#94A3B8' }}>Staff ke paas</p>
                      </div>
                    </div>
                    <span className="font-black tabular-nums text-sm" style={{ color: '#D97706', fontFamily: "'Syne', sans-serif" }}>{pkrSh(fieldTotal)}</span>
                  </div>
                  {staffCash.map((s, i) => (
                    <div key={s.staffId} className={`flex items-center gap-2.5 px-5 py-3 ${i > 0 ? 'border-t' : ''}`} style={{ borderColor: '#F5F5FA' }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black shrink-0"
                        style={{ background: '#FEF3C7', color: '#D97706' }}>
                        {s.staffName[0]?.toUpperCase()}
                      </div>
                      <p className="text-xs font-bold flex-1 truncate" style={{ color: '#1A1A2E' }}>{s.staffName}</p>
                      <p className="text-xs font-black tabular-nums mr-1.5" style={{ color: '#1A1A2E' }}>{pkrSh(Number(s.pendingBalance))}</p>
                      <button onClick={() => setReceiveTarget(s)}
                        className="text-[11px] font-black px-2.5 py-1.5 rounded-xl"
                        style={{ background: s.pendingHandover ? '#FEF3C7' : '#D1FAE5', color: s.pendingHandover ? '#D97706' : '#059669', border: `1px solid ${s.pendingHandover ? '#FDE68A' : '#A7F3D0'}` }}>
                        {s.pendingHandover ? 'Confirm' : 'Li'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* KHATAM HONE WALE */}
              {isOwner && completingSoon.length > 0 && (
                <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid #F0F0F5' }}>
                  <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F5F5FA' }}>
                    <div>
                      <h3 className="text-[15px] font-black" style={{ color: '#1A1A2E' }}>Khatam Hone Wale</h3>
                      <p className="text-[11px] font-medium mt-0.5" style={{ color: '#94A3B8' }}>1–3 qist baaki</p>
                    </div>
                    <span className="text-[10px] font-black px-2.5 py-1 rounded-xl" style={{ background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0' }}>
                      {completingSoon.length}
                    </span>
                  </div>
                  {completingSoon.map((c, i) => (
                    <div key={c.id} className={`flex items-center gap-2.5 px-5 py-3 ${i > 0 ? 'border-t' : ''}`} style={{ borderColor: '#F5F5FA' }}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold truncate" style={{ color: '#1A1A2E' }}>{c.customerName}</p>
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-lg shrink-0"
                            style={{ background: c.paymentsLeft === 1 ? '#FEE2E2' : '#FEF3C7', color: c.paymentsLeft === 1 ? '#DC2626' : '#D97706', border: `1px solid ${c.paymentsLeft === 1 ? '#FECACA' : '#FDE68A'}` }}>
                            {c.paymentsLeft}x
                          </span>
                        </div>
                        <p className="text-[10px] truncate mt-0.5" style={{ color: '#94A3B8' }}>{c.productName}</p>
                      </div>
                      <a href={waLink(c.customerPhone, `Assalam-o-Alaikum ${c.customerName}! Sirf ${c.paymentsLeft} installment baaki hai. Shukriya!`)}
                        target="_blank" rel="noopener noreferrer"
                        className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl text-white font-black text-[10px]"
                        style={{ background: '#25D366' }}>
                        WA
                      </a>
                    </div>
                  ))}
                </div>
              )}

              {/* LOW STOCK */}
              {lowStock.length > 0 && (
                <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid #F0F0F5' }}>
                  <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F5F5FA' }}>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: '#FEF3C7' }}>
                        <Package size={14} style={{ color: '#D97706' }}/>
                      </div>
                      <div>
                        <h3 className="text-[15px] font-black" style={{ color: '#1A1A2E' }}>Kam Stock</h3>
                        <p className="text-[11px] font-medium" style={{ color: '#94A3B8' }}>{lowStock.length} items</p>
                      </div>
                    </div>
                    <button onClick={() => navigate('/products')} className="text-[11px] font-black hover:underline" style={{ color: '#6366F1' }}>Manage →</button>
                  </div>
                  <div className="px-5 py-3 flex flex-wrap gap-1.5">
                    {lowStock.map(p => (
                      <span key={p.id} className="text-[11px] font-black px-2.5 py-1 rounded-xl"
                        style={{ background: p.stock === 0 ? '#FEE2E2' : '#FEF3C7', color: p.stock === 0 ? '#DC2626' : '#D97706', border: `1px solid ${p.stock === 0 ? '#FECACA' : '#FDE68A'}` }}>
                        {p.name} ({p.stock})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* BIRTHDAYS */}
              {birthdays.length > 0 && (
                <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid #F0F0F5' }}>
                  <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F5F5FA' }}>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: '#FCE7F3' }}>
                        <Gift size={14} style={{ color: '#DB2777' }}/>
                      </div>
                      <div>
                        <h3 className="text-[15px] font-black" style={{ color: '#1A1A2E' }}>Birthdays</h3>
                        <p className="text-[11px] font-medium" style={{ color: '#94A3B8' }}>{birthdays.length} is hafte</p>
                      </div>
                    </div>
                  </div>
                  {birthdays.map((c, i) => {
                    const [, mm, dd] = c.dob.split('-');
                    const bday = new Date(`${new Date().getFullYear()}-${mm}-${dd}`);
                    const todayD = new Date(); todayD.setHours(0,0,0,0);
                    const isToday = bday.toDateString() === todayD.toDateString();
                    return (
                      <div key={c.id} className={`flex items-center gap-2.5 px-5 py-3 ${i > 0 ? 'border-t' : ''}`} style={{ borderColor: '#F5F5FA' }}>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0"
                          style={{ background: '#FCE7F3', color: '#DB2777' }}>
                          {c.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-bold truncate" style={{ color: '#1A1A2E' }}>{c.name}</p>
                            {isToday && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-lg" style={{ background: '#FCE7F3', color: '#DB2777', border: '1px solid #FBCFE8' }}>Aaj!</span>}
                          </div>
                          {c.area && <p className="text-[10px] mt-0.5" style={{ color: '#94A3B8' }}>{c.area}</p>}
                        </div>
                        <a href={waLink(c.phone, `Assalamu Alaikum ${c.name}! Aaj aap ka birthday hai — bohat mubarak ho!`)}
                          target="_blank" rel="noopener noreferrer"
                          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl text-white font-black text-[10px]"
                          style={{ background: '#25D366' }}>
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

      {/* HANDOVER MODAL */}
      {showHandover && !isOwner && (() => {
        const bal  = Number(myBal?.pendingBalance ?? 0);
        const amt  = Number(handoverAmt);
        const diff = amt - bal;
        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="px-5 py-4 flex items-center justify-between" style={{ background: '#0F172A' }}>
                <div>
                  <p className="text-white font-black text-sm">Cash Jama Karein</p>
                  <p className="text-slate-400 text-xs mt-0.5">Owner ko hand over karo</p>
                </div>
                <button onClick={() => setShowHandover(false)} className="text-slate-400 hover:text-white transition"><X size={16}/></button>
              </div>
              <div className="p-5 space-y-3">
                <div className="rounded-xl px-4 py-3" style={{ background: '#EEF2FF', border: '1px solid #E0E7FF' }}>
                  <p className="text-[10px] font-medium" style={{ color: '#64748B' }}>System ka hisaab</p>
                  <p className="text-2xl font-black tabular-nums" style={{ color: '#0F172A', fontFamily: "'Syne', sans-serif" }}>{pkr(bal)}</p>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: '#64748B' }}>Actual Amount *</label>
                  <input type="number" value={handoverAmt} onChange={e => setHandoverAmt(e.target.value)} autoFocus
                    className="w-full border rounded-xl px-4 py-3 text-xl font-black tabular-nums focus:outline-none focus:border-indigo-400 transition"
                    style={{ borderColor: '#E2E8F0' }}/>
                  {handoverAmt && amt !== bal && (
                    <p className={`text-xs mt-1.5 font-black ${diff < 0 ? 'text-red-500' : 'text-amber-500'}`}>
                      {pkr(Math.abs(diff))} {diff < 0 ? 'kam' : 'zyada'}
                    </p>
                  )}
                </div>
                <textarea value={handoverNote} onChange={e => setHandoverNote(e.target.value)} rows={2} placeholder="Note (optional)…"
                  className="w-full border rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:border-indigo-400 transition"
                  style={{ borderColor: '#E2E8F0' }}/>
              </div>
              <div className="flex gap-2 px-5 pb-5">
                <button onClick={() => setShowHandover(false)} className="flex-1 py-2.5 text-sm font-bold border rounded-xl hover:bg-slate-50 transition"
                  style={{ borderColor: '#E2E8F0' }}>Wapas</button>
                <button disabled={!handoverAmt || amt <= 0 || submitHandover.isPending} onClick={() => submitHandover.mutate()}
                  className="flex-1 py-2.5 text-sm font-black text-white rounded-xl disabled:opacity-50 transition flex items-center justify-center gap-1.5"
                  style={{ background: '#10B981' }}>
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
