import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  X, Send, CheckCircle, PhoneCall, Wallet,
  Clock, ChevronRight, Plus,
  TrendingDown, Gift, Package, Bell,
  Users, ArrowUpRight,
} from 'lucide-react';
import { useAuthStore } from '../store/auth.store.ts';
import { statsApi } from '../api/stats.api.ts';
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
  const daysLeft       = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate();
  const monthPct       = d?.monthInstTarget ? Math.min(100, Math.round((d.monthCollections / d.monthInstTarget) * 100)) : 0;
  const dailyTarget    = shop?.settings?.dailyTarget;
  const dailyPct       = dailyTarget ? Math.min(100, Math.round((todayTotal / dailyTarget) * 100)) : 0;
  const bOverdue       = briefing?.overdueTotal   ?? 0;
  const bDueToday      = briefing?.dueToday       ?? 0;
  const totalWork      = bOverdue + bDueToday + pDueCount;
  const allClear       = !!briefing && totalWork === 0;
  const kpiOverdue     = d?.overdueCount ?? 0;

  /* staff today — max for progress bar */
  const staffTodayMax = staffToday.length > 0 ? Math.max(...staffToday.map(s => s.total)) : 0;

  return (
    <div style={{ background: '#F0F3FF', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>

      {/* Google Fonts */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* CSS tokens */}
      <style>{`
        :root {
          --canvas:  #F0F3FF;
          --surface: #FFFFFF;
          --ink:     #1E2A4A;
          --ink-dim: #64748B;
          --accent:  #4F46E5;
        }
        @media (prefers-color-scheme: dark) {
          :root:not([data-theme="light"]) {
            --canvas:  #0C0F1E;
            --surface: #141827;
            --ink:     #E8ECFA;
            --ink-dim: #556080;
            --accent:  #6366F1;
          }
        }
        :root[data-theme="dark"] {
          --canvas:  #0C0F1E;
          --surface: #141827;
          --ink:     #E8ECFA;
          --ink-dim: #556080;
          --accent:  #6366F1;
        }
        body { background: var(--canvas); }
      `}</style>

      {/* ══ HERO HEADER ═════════════════════════════════════════════════════ */}
      <header className="relative overflow-hidden px-5 sm:px-8 pt-6 pb-10"
        style={{ background: 'linear-gradient(135deg, #1E2A4A 0%, #2D3A5F 55%, #1A2540 100%)' }}>
        {/* Background glows */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 85% 40%, rgba(99,102,241,0.18) 0%, transparent 55%)' }}/>
          <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 15% 85%, rgba(16,185,129,0.1) 0%, transparent 45%)' }}/>
        </div>

        <div className="relative z-10">
          {/* Top row */}
          <div className="flex items-start justify-between mb-7">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"/>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: 'rgba(147,197,253,0.7)' }}>{today}</p>
              </div>
              <h1 className="text-[1.6rem] font-black text-white leading-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
                {greet()}, <span style={{ color: '#93C5FD' }}>{firstName}</span>
              </h1>
              <p className="text-[13px] mt-1" style={{ color: 'rgba(147,197,253,0.5)' }}>Assaan Electronics — Sales Dashboard</p>
            </div>
            <div className="flex items-center gap-2 shrink-0 mt-1">
              {!isOwner && myBal && Number(myBal.pendingBalance) > 0 && !myBal.pendingHandover && (
                <button onClick={() => { setHandoverAmt(String(Number(myBal.pendingBalance))); setShowHandover(true); }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition"
                  style={{ background: '#34D399', color: '#064E3B' }}>
                  <Send size={11}/> Jama Karo
                </button>
              )}
              {!isOwner && myBal?.pendingHandover && (
                <span className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black"
                  style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)', color: '#FCD34D' }}>
                  <Clock size={10}/> Pending
                </span>
              )}
              {(isOwner || perms?.canAddInstallment) && (
                <button onClick={() => navigate('/installments')}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-black text-white transition"
                  style={{ background: '#4F46E5', boxShadow: '0 4px 12px rgba(79,70,229,0.4)' }}>
                  <Plus size={14}/> Naya
                </button>
              )}
            </div>
          </div>

          {/* KPI cards inside hero */}
          {isOwner && (
            isLoading ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[0,1,2,3].map(i => (
                  <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.07)' }}/>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {([
                  {
                    label: 'Aaj Aya', value: pkrSh(todayTotal),
                    sub: dailyTarget ? `${dailyPct}% daily target` : 'Aaj ki total',
                    progress: dailyTarget ? dailyPct : undefined,
                    color: '#34D399', bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.22)',
                  },
                  {
                    label: 'Is Mahine', value: pkrSh(monthTotal),
                    sub: d?.monthInstTarget ? `${monthPct}% · ${daysLeft}d left` : `Net ${netFaida >= 0 ? '+' : ''}${pkrSh(netFaida)}`,
                    progress: d?.monthInstTarget ? monthPct : undefined,
                    color: '#818CF8', bg: 'rgba(129,140,248,0.12)', border: 'rgba(129,140,248,0.22)',
                  },
                  {
                    label: 'Overdue', value: kpiOverdue > 0 ? String(kpiOverdue) : '✓',
                    sub: kpiOverdue > 0 ? `${pkrSh(d?.overdueAmount ?? 0)} baaki` : 'Koi overdue nahi',
                    color: kpiOverdue > 0 ? '#F87171' : '#34D399',
                    bg: kpiOverdue > 0 ? 'rgba(248,113,113,0.12)' : 'rgba(52,211,153,0.12)',
                    border: kpiOverdue > 0 ? 'rgba(248,113,113,0.25)' : 'rgba(52,211,153,0.22)',
                    onClick: () => navigate('/installments'),
                  },
                  {
                    label: 'Active Plans', value: d?.activeCount ?? 0,
                    sub: `${d?.monthlyActiveCount ?? 0} mahana · ${d?.dailyActiveCount ?? 0} roz`,
                    color: '#60A5FA', bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.22)',
                  },
                ] as Array<{ label: string; value: string | number; sub: string; progress?: number; color: string; bg: string; border: string; onClick?: () => void }>).map(card => (
                  <button key={card.label} onClick={card.onClick}
                    className={`rounded-2xl p-4 text-left w-full transition-all ${card.onClick ? 'cursor-pointer active:scale-[0.97]' : 'cursor-default'}`}
                    style={{ background: card.bg, border: `1px solid ${card.border}` }}>
                    <p className="text-[9px] font-extrabold uppercase tracking-[0.2em] mb-2" style={{ color: card.color, opacity: 0.85 }}>
                      {card.label}
                    </p>
                    <p className="font-black tabular-nums leading-none text-white"
                      style={{ fontFamily: "'Syne', sans-serif", fontSize: 'clamp(1.3rem,4vw,1.75rem)' }}>
                      {card.value}
                    </p>
                    {card.sub && (
                      <p className="text-[11px] mt-1.5 font-medium leading-snug" style={{ color: 'rgba(255,255,255,0.45)' }}>
                        {card.sub}
                      </p>
                    )}
                    {typeof card.progress === 'number' && (
                      <div className="h-1 rounded-full mt-3 overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${Math.min(100, card.progress)}%`, background: card.color }}/>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )
          )}

          {/* Non-owner cash banner */}
          {!isOwner && myBal && Number(myBal.pendingBalance) > 0 && (
            <div className="rounded-2xl p-4 flex items-center justify-between gap-4"
              style={{
                background: myBal.pendingHandover ? 'rgba(251,191,36,0.12)' : 'rgba(52,211,153,0.12)',
                border: `1px solid ${myBal.pendingHandover ? 'rgba(251,191,36,0.3)' : 'rgba(52,211,153,0.3)'}`,
              }}>
              <div className="flex items-center gap-3">
                <Wallet size={20} className={myBal.pendingHandover ? 'text-amber-300' : 'text-emerald-300'}/>
                <div>
                  <p className="text-xs font-bold" style={{ color: myBal.pendingHandover ? '#FCD34D' : '#6EE7B7' }}>
                    {myBal.pendingHandover ? 'Handover pending hai' : 'Aap ke paas cash'}
                  </p>
                  <p className="text-2xl font-black tabular-nums text-white" style={{ fontFamily: "'Syne', sans-serif" }}>
                    {pkr(Number(myBal.pendingBalance))}
                  </p>
                </div>
              </div>
              {!myBal.pendingHandover && (
                <button onClick={() => { setHandoverAmt(String(Number(myBal.pendingBalance))); setShowHandover(true); }}
                  className="px-4 py-2 rounded-xl text-sm font-black shrink-0 transition"
                  style={{ background: '#34D399', color: '#064E3B' }}>
                  <Send size={13} className="inline mr-1.5"/> Jama Karein
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* ══ PAGE BODY ═══════════════════════════════════════════════════════ */}
      <div className="px-4 sm:px-6 -mt-4 pb-8">
        <div className="lg:grid lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_340px] gap-4 items-start">

          {/* ── LEFT ────────────────────────────────────────────────── */}
          <div className="space-y-4">

            {/* ── STAFF TODAY COLLECTIONS ─────────────────────────── */}
            {isOwner && (
              <div className="rounded-2xl border overflow-hidden shadow-sm" style={{ background: 'var(--surface)', borderColor: '#E2E8F0' }}>
                <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#F1F5F9' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }}>
                      <Users size={15} className="text-white"/>
                    </div>
                    <div>
                      <h2 className="text-[14px] font-black leading-tight" style={{ color: 'var(--ink)' }}>Aaj Ki Collection</h2>
                      <p className="text-[11px] font-medium" style={{ color: 'var(--ink-dim)' }}>
                        {staffToday.some(s => s.total > 0)
                          ? `${staffToday.reduce((a, s) => a + s.count, 0)} payments · ${pkr(staffToday.reduce((a, s) => a + s.total, 0))} kul`
                          : 'Employee-wise breakdown'}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => navigate('/installments')}
                    className="text-[12px] font-extrabold flex items-center gap-0.5 shrink-0" style={{ color: '#4F46E5' }}>
                    Sab <ChevronRight size={12}/>
                  </button>
                </div>

                {isLoading ? (
                  <RowSkeleton rows={3}/>
                ) : staffToday.length === 0 ? (
                  <div className="py-10 flex flex-col items-center gap-2 text-center px-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: '#F0F3FF' }}>
                      <Users size={22} style={{ color: '#4F46E5' }}/>
                    </div>
                    <p className="text-xs font-semibold" style={{ color: 'var(--ink-dim)' }}>Aaj abhi koi collection nahi hui</p>
                  </div>
                ) : (
                  <>
                    <div className="divide-y" style={{ borderColor: '#F8FAFC' }}>
                      {staffToday.map((staff, i) => {
                        const pct    = staffTodayMax > 0 ? Math.round((staff.total / staffTodayMax) * 100) : 0;
                        const colors = ['#4F46E5', '#059669', '#D97706', '#7C3AED', '#DB2777', '#0891B2'];
                        const color  = colors[i % colors.length];
                        const hasCollected = staff.total > 0;
                        return (
                          <div key={staff.staffId} className="px-5 py-4">
                            <div className="flex items-center gap-3 mb-2.5">
                              <div className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-black shrink-0"
                                style={{ background: hasCollected ? color : '#F1F5F9', color: hasCollected ? '#fff' : 'var(--ink-dim)' }}>
                                {staff.staffName[0]?.toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold truncate" style={{ color: 'var(--ink)' }}>{staff.staffName}</p>
                                <p className="text-[11px] font-medium" style={{ color: hasCollected ? color : 'var(--ink-dim)' }}>
                                  {hasCollected ? `${staff.count} collection${staff.count !== 1 ? 's' : ''}` : 'Aaj koi collection nahi'}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="font-black tabular-nums leading-none"
                                  style={{ color: hasCollected ? 'var(--ink)' : 'var(--ink-dim)', fontFamily: "'Syne', sans-serif", fontSize: '1rem', opacity: hasCollected ? 1 : 0.4 }}>
                                  {hasCollected ? pkrSh(staff.total) : '—'}
                                </p>
                                {hasCollected && <p className="text-[10px] font-semibold" style={{ color }}>{pct}%</p>}
                              </div>
                            </div>
                            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#F1F5F9' }}>
                              <div className="h-full rounded-full transition-all duration-700"
                                style={{ width: hasCollected ? `${pct}%` : '0%', background: `linear-gradient(90deg,${color}99,${color})` }}/>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {staffToday.some(s => s.total > 0) && (
                      <div className="flex items-center justify-between px-5 py-3 border-t" style={{ background: '#F8FAFC', borderColor: '#F1F5F9' }}>
                        <p className="text-xs font-bold" style={{ color: 'var(--ink-dim)' }}>Kul Aaj Ki Collection</p>
                        <p className="text-sm font-black tabular-nums" style={{ color: 'var(--ink)', fontFamily: "'Syne', sans-serif" }}>
                          {pkr(staffToday.reduce((a, s) => a + s.total, 0))}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── AAJ KA KAAM ─────────────────────────────────────── */}
            <div className="rounded-2xl border overflow-hidden shadow-sm" style={{ background: 'var(--surface)', borderColor: '#E2E8F0' }}>
              <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#F1F5F9' }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: allClear ? 'linear-gradient(135deg,#10B981,#059669)' : 'linear-gradient(135deg,#EF4444,#DC2626)' }}>
                    {allClear ? <CheckCircle size={15} className="text-white"/> : <TrendingDown size={15} className="text-white"/>}
                  </div>
                  <div>
                    <h2 className="text-[14px] font-black" style={{ color: 'var(--ink)' }}>Aaj Ka Kaam</h2>
                    <p className="text-[11px] font-medium" style={{ color: 'var(--ink-dim)' }}>
                      {!briefing ? 'Load ho raha hai…' : allClear ? 'Sab clear — Mashaallah!' : `${totalWork} item${totalWork !== 1 ? 's' : ''} pending`}
                    </p>
                  </div>
                </div>
                {briefing && totalWork > 0 && (
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                    {bOverdue  > 0 && <span className="text-[10px] font-black px-2 py-1 rounded-lg" style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>{bOverdue} late</span>}
                    {bDueToday > 0 && <span className="text-[10px] font-black px-2 py-1 rounded-lg" style={{ background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' }}>{bDueToday} aaj</span>}
                    {pDueCount > 0 && <span className="text-[10px] font-black px-2 py-1 rounded-lg" style={{ background: '#FFFBEB', color: '#D97706', border: '1px solid #FDE68A' }}>{pDueCount} wada</span>}
                  </div>
                )}
              </div>

              {!briefing ? (
                <RowSkeleton rows={5}/>
              ) : (
                <>
                  {briefing.urgentAccounts.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 px-5 py-2.5" style={{ background: '#FEF2F2' }}>
                        <span className="w-2 h-2 rounded-full bg-red-500 shrink-0"/>
                        <span className="text-[11px] font-black text-red-600 uppercase tracking-wide">Overdue ({briefing.overdueTotal})</span>
                      </div>
                      {briefing.urgentAccounts.map((acct, i) => {
                        const sevColor = acct.daysOverdue >= 30 ? '#DC2626' : acct.daysOverdue >= 14 ? '#EA580C' : '#D97706';
                        return (
                          <div key={acct.id}
                            className={`flex items-center gap-3 px-5 py-3 hover:bg-red-50/40 transition ${i > 0 ? 'border-t' : ''}`}
                            style={{ borderColor: '#FEF2F2', borderLeft: '3px solid #F87171' }}>
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                              style={{ background: '#FEE2E2', color: '#DC2626' }}>
                              {acct.customerName[0]?.toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold truncate" style={{ color: 'var(--ink)' }}>{acct.customerName}</p>
                              <p className="text-[11px]" style={{ color: 'var(--ink-dim)' }}>{acct.customerPhone}</p>
                            </div>
                            <div className="text-right shrink-0 mr-2">
                              <p className="text-sm font-black tabular-nums" style={{ color: 'var(--ink)' }}>{pkr(acct.monthly)}</p>
                              <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md"
                                style={{ background: '#FEE2E2', color: sevColor }}>{acct.daysOverdue}d late</span>
                            </div>
                            <a href={waLink(acct.customerPhone, `Assalam-o-Alaikum ${acct.customerName}! Aapka installment ${acct.daysOverdue} din se due hai. ${pkr(acct.monthly)} jama karwain. Shukriya!`)}
                              target="_blank" rel="noopener noreferrer"
                              className="shrink-0 flex items-center gap-1 px-3 py-1.5 text-white text-[11px] font-black rounded-xl transition hover:opacity-90"
                              style={{ background: '#25D366' }}>
                              <PhoneCall size={10}/> WA
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {briefing.dueTodayAccounts.length > 0 && (
                    <div className="border-t" style={{ borderColor: '#F1F5F9' }}>
                      <div className="flex items-center justify-between px-5 py-2.5" style={{ background: '#EFF6FF' }}>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0"/>
                          <span className="text-[11px] font-black text-blue-600 uppercase tracking-wide">Aaj Ka Qist ({briefing.dueToday})</span>
                        </div>
                        {(briefing.dueTomorrow ?? 0) > 0 && (
                          <span className="text-[10px] font-medium" style={{ color: 'var(--ink-dim)' }}>+{briefing.dueTomorrow} kal</span>
                        )}
                      </div>
                      {briefing.dueTodayAccounts.slice(0, 20).map((acct, i) => (
                        <div key={acct.id}
                          className={`flex items-center gap-3 px-5 py-3 hover:bg-blue-50/40 transition ${i > 0 ? 'border-t' : ''}`}
                          style={{ borderColor: '#EFF6FF', borderLeft: '3px solid #60A5FA' }}>
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                            style={{ background: '#DBEAFE', color: '#2563EB' }}>
                            {acct.customerName[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate" style={{ color: 'var(--ink)' }}>{acct.customerName}</p>
                            <p className="text-[11px]" style={{ color: 'var(--ink-dim)' }}>{acct.customerPhone}</p>
                          </div>
                          <p className="text-sm font-black text-blue-700 tabular-nums shrink-0 mr-2">{pkr(acct.monthly)}</p>
                          <a href={waLink(acct.customerPhone, `Assalam-o-Alaikum ${acct.customerName}! Aaj ka installment ${pkr(acct.monthly)} due hai. Jazak'Allah!`)}
                            target="_blank" rel="noopener noreferrer"
                            className="shrink-0 flex items-center gap-1 px-3 py-1.5 text-white text-[11px] font-black rounded-xl transition hover:opacity-90"
                            style={{ background: '#25D366' }}>
                            <PhoneCall size={10}/> WA
                          </a>
                        </div>
                      ))}
                      {briefing.dueTodayAccounts.length > 20 && (
                        <button onClick={() => navigate('/installments')}
                          className="w-full py-2.5 text-xs font-black border-t flex items-center justify-center gap-1 hover:bg-blue-50 transition"
                          style={{ borderColor: '#EFF6FF', color: '#2563EB' }}>
                          +{briefing.dueTodayAccounts.length - 20} aur <ChevronRight size={11}/>
                        </button>
                      )}
                    </div>
                  )}

                  {pDueCount > 0 && promises.length > 0 && (
                    <div className="border-t" style={{ borderColor: '#F1F5F9' }}>
                      <div className="flex items-center gap-2 px-5 py-2.5" style={{ background: '#FFFBEB' }}>
                        <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0"/>
                        <span className="text-[11px] font-black text-amber-600 uppercase tracking-wide">Waday ({pDueCount})</span>
                      </div>
                      {promises.slice(0, 5).map((p, i) => (
                        <div key={p.id}
                          className={`flex items-center gap-3 px-5 py-3 ${i > 0 ? 'border-t' : ''}`}
                          style={{ borderColor: '#FFFBEB', borderLeft: '3px solid #FCD34D' }}>
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                            style={{ background: '#FEF3C7', color: '#D97706' }}>
                            {p.customerName[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate" style={{ color: 'var(--ink)' }}>{p.customerName}</p>
                            <p className="text-[11px] truncate" style={{ color: 'var(--ink-dim)' }}>{p.productName}{p.note ? ` · ${p.note}` : ''}</p>
                          </div>
                          <span className="shrink-0 flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-xl"
                            style={{ background: '#FEF3C7', color: '#D97706', border: '1px solid #FDE68A' }}>
                            <Bell size={9}/> Wada
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {allClear && (
                    <div className="py-12 flex flex-col items-center text-center">
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3"
                        style={{ background: 'linear-gradient(135deg, #ECFDF5, #D1FAE5)' }}>
                        <CheckCircle size={30} style={{ color: '#10B981' }}/>
                      </div>
                      <p className="text-[15px] font-black" style={{ color: 'var(--ink)' }}>Sab Clear Hai!</p>
                      <p className="text-xs mt-1.5 max-w-60 leading-relaxed" style={{ color: 'var(--ink-dim)' }}>
                        Koi due, overdue ya wada nahi. Mashaallah!
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ── RECENT INSTALLMENTS ──────────────────────────────── */}
            <div className="rounded-2xl border overflow-hidden shadow-sm" style={{ background: 'var(--surface)', borderColor: '#E2E8F0' }}>
              <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#F1F5F9' }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)' }}>
                    <ArrowUpRight size={15} className="text-white"/>
                  </div>
                  <div>
                    <h2 className="text-[14px] font-black" style={{ color: 'var(--ink)' }}>Recent Installments</h2>
                    <p className="text-[11px] font-medium" style={{ color: 'var(--ink-dim)' }}>Latest added accounts</p>
                  </div>
                </div>
                <button onClick={() => navigate('/installments')}
                  className="text-[12px] font-extrabold flex items-center gap-0.5" style={{ color: '#4F46E5' }}>
                  Sab <ChevronRight size={12}/>
                </button>
              </div>
              {isLoading ? (
                <RowSkeleton rows={5}/>
              ) : !d?.recentInstallments.length ? (
                <div className="py-10 text-center">
                  <p className="text-xs" style={{ color: 'var(--ink-dim)' }}>
                    Koi installment nahi.{' '}
                    <button onClick={() => navigate('/installments')} className="font-black" style={{ color: '#4F46E5' }}>Banao</button>
                  </p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: '#F8FAFC' }}>
                  {d.recentInstallments.map(inst => {
                    const statusMap: Record<string, { bg: string; text: string; label: string }> = {
                      ACTIVE:    { bg: '#EFF6FF', text: '#2563EB', label: 'Active' },
                      COMPLETED: { bg: '#ECFDF5', text: '#059669', label: 'Khatam' },
                      DEFAULTED: { bg: '#FEF2F2', text: '#DC2626', label: 'Overdue' },
                      CANCELLED: { bg: '#F8FAFC', text: '#94A3B8', label: 'Cancel' },
                    };
                    const sc = statusMap[inst.status] ?? { bg: '#F8FAFC', text: '#94A3B8', label: inst.status };
                    return (
                      <div key={inst.id} onClick={() => navigate('/installments')}
                        className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-slate-50/60 transition">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-black shrink-0"
                          style={{ background: '#F0F3FF', color: '#4F46E5' }}>
                          {inst.customerName[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate" style={{ color: 'var(--ink)' }}>{inst.customerName}</p>
                          <p className="text-[11px] truncate" style={{ color: 'var(--ink-dim)' }}>{inst.productName}</p>
                        </div>
                        <div className="text-right shrink-0 mr-3">
                          <p className="text-sm font-black tabular-nums" style={{ color: 'var(--ink)' }}>{pkr(Number(inst.remaining))}</p>
                          <p className="text-[10px]" style={{ color: 'var(--ink-dim)' }}>baaki</p>
                        </div>
                        <span className="text-[10px] font-black px-2.5 py-1 rounded-full shrink-0"
                          style={{ background: sc.bg, color: sc.text }}>
                          {sc.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>{/* end left */}

          {/* ── SIDEBAR ─────────────────────────────────────────────── */}
          <div className="mt-4 lg:mt-0">
            <div className="lg:sticky lg:top-4 space-y-4 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto lg:pb-4">

              {/* PORTFOLIO */}
              {isOwner && (
                <div className="rounded-2xl border overflow-hidden shadow-sm" style={{ background: 'var(--surface)', borderColor: '#E2E8F0' }}>
                  <div className="flex items-center justify-between px-4 py-3.5 border-b" style={{ borderColor: '#F1F5F9' }}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)' }}>
                        <ArrowUpRight size={12} className="text-white"/>
                      </div>
                      <h3 className="text-sm font-black" style={{ color: 'var(--ink)' }}>Portfolio</h3>
                    </div>
                    <button onClick={() => navigate('/installments')}
                      className="text-[11px] font-black flex items-center gap-0.5" style={{ color: '#4F46E5' }}>
                      Sab <ArrowUpRight size={10}/>
                    </button>
                  </div>
                  {isLoading ? <RowSkeleton rows={5}/> : (
                    <div className="divide-y" style={{ borderColor: '#F8FAFC' }}>
                      {([
                        { label: 'Active Plans',      value: d?.activeCount ?? 0,            sub: `${d?.monthlyActiveCount ?? 0} mahana`,       color: '#2563EB' },
                        { label: 'Overdue',           value: d?.overdueCount ?? 0,            sub: (d?.overdueAmount ?? 0) > 0 ? pkrSh(d!.overdueAmount) : 'sab clear', color: (d?.overdueCount ?? 0) > 0 ? '#DC2626' : '#34D399', click: () => navigate('/installments') },
                        { label: 'Khatam Hone Wale', value: completingSoon.length,           sub: '1–3 qist baaki',                             color: completingSoon.length > 0 ? '#D97706' : '#CBD5E1' },
                        { label: 'Naye (Is Mahine)', value: d?.newThisMonthCount ?? 0,       sub: pkrSh(d?.newThisMonthValue ?? 0),             color: '#4F46E5' },
                        { label: 'Khatam Is Mahine', value: d?.completedThisMonthCount ?? 0, sub: pkrSh(d?.completedThisMonthValue ?? 0),       color: (d?.completedThisMonthCount ?? 0) > 0 ? '#059669' : '#CBD5E1' },
                      ] as Array<{ label: string; value: number; sub: string; color: string; click?: () => void }>).map(row => (
                        <div key={row.label} onClick={row.click}
                          className={`flex items-center justify-between px-4 py-3 ${row.click ? 'cursor-pointer hover:bg-slate-50 transition' : ''}`}>
                          <p className="text-xs font-medium" style={{ color: 'var(--ink-dim)' }}>{row.label}</p>
                          <div className="text-right">
                            <p className="text-sm font-black tabular-nums" style={{ color: row.color }}>{row.value}</p>
                            <p className="text-[10px]" style={{ color: 'var(--ink-dim)' }}>{row.sub}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* CASH IN FIELD */}
              {isOwner && staffCash.length > 0 && (
                <div className="rounded-2xl overflow-hidden shadow-sm border" style={{ background: 'var(--surface)', borderColor: '#FDE68A' }}>
                  <div className="flex items-center justify-between px-4 py-3.5 border-b"
                    style={{ background: 'linear-gradient(135deg,#FFFBEB,#FEF3C7)', borderColor: '#FDE68A' }}>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#F59E0B' }}>
                        <Wallet size={12} className="text-white"/>
                      </div>
                      <span className="text-sm font-black text-amber-900">Cash in Field</span>
                    </div>
                    <span className="text-base font-black text-amber-700 tabular-nums" style={{ fontFamily: "'Syne', sans-serif" }}>
                      {pkrSh(fieldTotal)}
                    </span>
                  </div>
                  {staffCash.map((s, i) => (
                    <div key={s.staffId} className={`flex items-center gap-2.5 px-4 py-3 ${i > 0 ? 'border-t' : ''}`}
                      style={{ borderColor: '#FFFBEB' }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black shrink-0"
                        style={{ background: '#FEF3C7', color: '#D97706' }}>
                        {s.staffName[0]?.toUpperCase()}
                      </div>
                      <p className="text-xs font-bold flex-1 truncate" style={{ color: 'var(--ink)' }}>{s.staffName}</p>
                      <p className="text-xs font-black tabular-nums shrink-0 mr-1.5" style={{ color: 'var(--ink)' }}>
                        {pkrSh(Number(s.pendingBalance))}
                      </p>
                      <button onClick={() => setReceiveTarget(s)}
                        className="shrink-0 text-[11px] font-black px-2.5 py-1.5 rounded-xl transition"
                        style={{
                          background: s.pendingHandover ? '#FEF3C7' : '#D1FAE5',
                          color:      s.pendingHandover ? '#D97706' : '#059669',
                          border:     `1px solid ${s.pendingHandover ? '#FDE68A' : '#A7F3D0'}`,
                        }}>
                        {s.pendingHandover ? 'Confirm' : 'Li'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* KHATAM HONE WALE */}
              {isOwner && completingSoon.length > 0 && (
                <div className="rounded-2xl border overflow-hidden shadow-sm" style={{ background: 'var(--surface)', borderColor: '#E2E8F0' }}>
                  <div className="flex items-center justify-between px-4 py-3.5 border-b" style={{ borderColor: '#F1F5F9' }}>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#ECFDF5' }}>
                        <TrendingDown size={12} style={{ color: '#10B981' }}/>
                      </div>
                      <span className="text-sm font-black" style={{ color: 'var(--ink)' }}>Khatam Hone Wale</span>
                    </div>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-lg"
                      style={{ background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0' }}>
                      {completingSoon.length}
                    </span>
                  </div>
                  {completingSoon.map((c, i) => (
                    <div key={c.id} className={`flex items-center gap-2.5 px-4 py-3 ${i > 0 ? 'border-t' : ''}`}
                      style={{ borderColor: '#F8FAFC' }}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-xs font-bold truncate" style={{ color: 'var(--ink)' }}>{c.customerName}</p>
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md shrink-0"
                            style={{
                              background: c.paymentsLeft === 1 ? '#FEE2E2' : '#FEF3C7',
                              color:      c.paymentsLeft === 1 ? '#DC2626' : '#D97706',
                              border:     `1px solid ${c.paymentsLeft === 1 ? '#FECACA' : '#FDE68A'}`,
                            }}>
                            {c.paymentsLeft}x
                          </span>
                        </div>
                        <p className="text-[10px] truncate" style={{ color: 'var(--ink-dim)' }}>{c.productName}</p>
                      </div>
                      <a href={waLink(c.customerPhone, `Assalam-o-Alaikum ${c.customerName}! Sirf ${c.paymentsLeft} installment baaki hai. Shukriya!`)}
                        target="_blank" rel="noopener noreferrer"
                        className="shrink-0 text-[11px] font-black text-white px-2.5 py-1.5 rounded-xl transition hover:opacity-90"
                        style={{ background: '#25D366' }}>
                        WA
                      </a>
                    </div>
                  ))}
                </div>
              )}

              {/* LOW STOCK */}
              {lowStock.length > 0 && (
                <div className="rounded-2xl overflow-hidden shadow-sm border" style={{ background: 'var(--surface)', borderColor: '#FDE68A' }}>
                  <div className="flex items-center justify-between px-4 py-3.5 border-b"
                    style={{ background: 'linear-gradient(135deg,#FFFBEB,#FEF3C7)', borderColor: '#FDE68A' }}>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#F59E0B' }}>
                        <Package size={12} className="text-white"/>
                      </div>
                      <span className="text-sm font-black text-amber-900">Kam Stock</span>
                    </div>
                    <button onClick={() => navigate('/products')} className="text-[11px] font-black hover:underline" style={{ color: '#D97706' }}>Manage →</button>
                  </div>
                  <div className="px-4 py-3.5 flex flex-wrap gap-1.5">
                    {lowStock.map(p => (
                      <span key={p.id} className="text-[11px] font-black px-2.5 py-1 rounded-xl"
                        style={{
                          background: p.stock === 0 ? '#FEE2E2' : '#FEF3C7',
                          color:      p.stock === 0 ? '#DC2626' : '#D97706',
                          border:     `1px solid ${p.stock === 0 ? '#FECACA' : '#FDE68A'}`,
                        }}>
                        {p.name} ({p.stock})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* BIRTHDAYS */}
              {birthdays.length > 0 && (
                <div className="rounded-2xl overflow-hidden shadow-sm border" style={{ background: 'var(--surface)', borderColor: '#FBCFE8' }}>
                  <div className="flex items-center gap-2 px-4 py-3.5 border-b"
                    style={{ background: 'linear-gradient(135deg,#FDF2F8,#FCE7F3)', borderColor: '#FBCFE8' }}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#EC4899' }}>
                      <Gift size={12} className="text-white"/>
                    </div>
                    <span className="text-sm font-black text-pink-900">{birthdays.length} Birthday is hafte</span>
                  </div>
                  {birthdays.map((c, i) => {
                    const [, mm, dd] = c.dob.split('-');
                    const bday   = new Date(`${new Date().getFullYear()}-${mm}-${dd}`);
                    const todayD = new Date(); todayD.setHours(0,0,0,0);
                    const isToday = bday.toDateString() === todayD.toDateString();
                    return (
                      <div key={c.id} className={`flex items-center gap-2.5 px-4 py-3 ${i > 0 ? 'border-t' : ''}`}
                        style={{ borderColor: '#FDF2F8' }}>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-black shrink-0"
                          style={{ background: '#FCE7F3', color: '#DB2777' }}>
                          {c.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-bold truncate" style={{ color: 'var(--ink)' }}>{c.name}</p>
                            {isToday && (
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded shrink-0"
                                style={{ background: '#FCE7F3', color: '#DB2777', border: '1px solid #FBCFE8' }}>
                                Aaj!
                              </span>
                            )}
                          </div>
                          {c.area && <p className="text-[10px]" style={{ color: 'var(--ink-dim)' }}>{c.area}</p>}
                        </div>
                        <a href={waLink(c.phone, `Assalamu Alaikum ${c.name}! Aaj aap ka birthday hai — bohat mubarak ho!`)}
                          target="_blank" rel="noopener noreferrer"
                          className="shrink-0 text-[11px] font-black text-white px-2.5 py-1.5 rounded-xl transition hover:opacity-90"
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

      {/* ══ STAFF HANDOVER MODAL ════════════════════════════════════════════ */}
      {showHandover && !isOwner && (() => {
        const bal  = Number(myBal?.pendingBalance ?? 0);
        const amt  = Number(handoverAmt);
        const diff = amt - bal;
        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="px-5 py-4 flex items-center justify-between" style={{ background: '#1E2A4A' }}>
                <div>
                  <p className="text-white font-black text-sm">Cash Jama Karein</p>
                  <p className="text-blue-300 text-xs mt-0.5">Owner ko hand over karo</p>
                </div>
                <button onClick={() => setShowHandover(false)} className="text-blue-300 hover:text-white transition"><X size={16}/></button>
              </div>
              <div className="p-5 space-y-3">
                <div className="rounded-xl px-4 py-3" style={{ background: '#F0F3FF', border: '1px solid #E0E7FF' }}>
                  <p className="text-[10px] font-medium" style={{ color: 'var(--ink-dim)' }}>System ka hisaab</p>
                  <p className="text-2xl font-black tabular-nums" style={{ color: '#1E2A4A', fontFamily: "'Syne', sans-serif" }}>{pkr(bal)}</p>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--ink-dim)' }}>Actual Amount *</label>
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
