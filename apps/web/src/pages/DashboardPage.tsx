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

const STATUS: Record<string, { bg: string; text: string; label: string }> = {
  ACTIVE:    { bg: 'bg-blue-50',    text: 'text-blue-700',    label: 'Active'  },
  COMPLETED: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Khatam'  },
  DEFAULTED: { bg: 'bg-red-50',     text: 'text-red-700',     label: 'Overdue' },
  CANCELLED: { bg: 'bg-slate-100',  text: 'text-slate-500',   label: 'Cancel'  },
};

/* ─── KPI card ───────────────────────────────────────────────────────────── */
type KCS = 'default' | 'danger' | 'success' | 'warning';
const kcsMap: Record<KCS, { card: string; val: string; label: string; bar: string; track: string }> = {
  default: { card: 'bg-white border-slate-200',       val: 'text-[#0F1629]',  label: 'text-[#8892A4]', bar: 'bg-[#2563EB]',  track: 'bg-slate-100' },
  danger:  { card: 'bg-red-50 border-red-200',        val: 'text-red-700',    label: 'text-red-400',   bar: 'bg-red-500',    track: 'bg-red-100'   },
  success: { card: 'bg-emerald-50 border-emerald-200',val: 'text-emerald-700',label: 'text-emerald-500',bar: 'bg-emerald-500',track: 'bg-emerald-100'},
  warning: { card: 'bg-amber-50 border-amber-200',    val: 'text-amber-800',  label: 'text-amber-500', bar: 'bg-amber-400',  track: 'bg-amber-100' },
};

function KPICard({ label, value, sub, progress, cs = 'default', onClick }: {
  label: string; value: string | number; sub?: string;
  progress?: number; cs?: KCS; onClick?: () => void;
}) {
  const t = kcsMap[cs];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left w-full transition-all select-none ${t.card} ${onClick ? 'cursor-pointer hover:shadow-md active:scale-[0.97]' : 'cursor-default'}`}
    >
      <p className="text-[9px] font-extrabold uppercase tracking-[0.2em] mb-2" style={{ color: 'var(--ink-dim)' }}>{label}</p>
      <p className={`font-black tabular-nums leading-none ${t.val}`} style={{ fontSize: 'clamp(1.4rem,4vw,1.85rem)', fontFamily: "'Syne', sans-serif" }}>{value}</p>
      {sub && <p className={`text-[11px] mt-1.5 leading-snug font-medium ${t.label}`}>{sub}</p>}
      {typeof progress === 'number' && (
        <div className={`h-1 rounded-full mt-3 ${t.track} overflow-hidden`}>
          <div className={`h-full rounded-full transition-all duration-700 ${t.bar}`} style={{ width: `${Math.min(100, progress)}%` }} />
        </div>
      )}
    </button>
  );
}

/* ─── Section header ─────────────────────────────────────────────────────── */
function SectionHead({ title, sub, action, onAction }: {
  title: string; sub?: string;
  action?: string; onAction?: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-5 pt-5 pb-3.5">
      <div>
        <h2 className="text-[15px] font-black" style={{ color: 'var(--ink)' }}>{title}</h2>
        {sub && <p className="text-[11px] font-medium mt-0.5" style={{ color: 'var(--ink-dim)' }}>{sub}</p>}
      </div>
      {action && onAction && (
        <button onClick={onAction} className="flex items-center gap-0.5 text-[12px] font-extrabold text-[#2563EB] hover:underline shrink-0">
          {action} <ChevronRight size={12} />
        </button>
      )}
    </div>
  );
}

/* ─── Portfolio row ──────────────────────────────────────────────────────── */
function PRow({ label, value, sub, vc = '', onClick }: {
  label: string; value: string | number; sub?: string; vc?: string; onClick?: () => void;
}) {
  return (
    <div onClick={onClick}
      className={`flex items-center justify-between px-4 py-3 ${onClick ? 'cursor-pointer hover:bg-slate-50 transition' : ''}`}>
      <p className="text-xs font-medium" style={{ color: 'var(--ink-dim)' }}>{label}</p>
      <div className="text-right">
        <p className={`text-sm font-black tabular-nums ${vc || 'text-[var(--ink)]'}`}>{value}</p>
        {sub && <p className="text-[10px] mt-0.5 tabular-nums" style={{ color: 'var(--ink-dim)' }}>{sub}</p>}
      </div>
    </div>
  );
}

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
    <div className="flex flex-col" style={{ background: 'var(--canvas)' }}>

      {/* Google Fonts */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* CSS tokens */}
      <style>{`
        :root {
          --canvas:  #F4F7FF;
          --surface: #FFFFFF;
          --ink:     #0F1629;
          --ink-dim: #7A849A;
          --accent:  #2563EB;
        }
        @media (prefers-color-scheme: dark) {
          :root:not([data-theme="light"]) {
            --canvas:  #0A0E1A;
            --surface: #141826;
            --ink:     #E8ECFA;
            --ink-dim: #5C6580;
            --accent:  #3B82F6;
          }
        }
        :root[data-theme="dark"] {
          --canvas:  #0A0E1A;
          --surface: #141826;
          --ink:     #E8ECFA;
          --ink-dim: #5C6580;
          --accent:  #3B82F6;
        }
        body { background: var(--canvas); }
        .dash-font { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
      `}</style>

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-30 h-16 flex items-center px-4 sm:px-6 gap-3" style={{ background: 'var(--ink)' }}>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.22em] leading-none select-none" style={{ color: 'var(--ink-dim)' }}>{today}</p>
          <h1 className="text-sm font-black leading-tight mt-0.5 text-white" style={{ fontFamily: "'Syne', sans-serif" }}>
            {greet()}, <span style={{ color: '#60A5FA' }}>{firstName}</span>
          </h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!isOwner && myBal && Number(myBal.pendingBalance) > 0 && !myBal.pendingHandover && (
            <button onClick={() => { setHandoverAmt(String(Number(myBal.pendingBalance))); setShowHandover(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl transition">
              <Send size={11}/> Jama Karo
            </button>
          )}
          {!isOwner && myBal?.pendingHandover && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-black rounded-xl">
              <Clock size={10}/> Pending
            </span>
          )}
          {(isOwner || perms?.canAddInstallment) && (
            <button onClick={() => navigate('/installments')}
              className="flex items-center gap-1.5 px-4 py-2 text-white text-[13px] font-black rounded-xl transition shadow-sm"
              style={{ background: 'var(--accent)' }}>
              <Plus size={13}/> Naya Installment
            </button>
          )}
        </div>
      </header>

      {/* ══ STAFF CASH BANNER (non-owner) ══════════════════════════════════ */}
      {!isOwner && myBal && Number(myBal.pendingBalance) > 0 && (
        <div className={`shrink-0 border-b ${myBal.pendingHandover ? 'bg-amber-50 border-amber-200' : 'bg-emerald-600 border-emerald-700'}`}>
          <div className="flex items-center justify-between px-5 sm:px-6 py-3.5">
            <div className="flex items-center gap-3">
              <Wallet size={18} className={myBal.pendingHandover ? 'text-amber-600' : 'text-white/70'}/>
              <div>
                <p className={`text-xs font-bold ${myBal.pendingHandover ? 'text-amber-600' : 'text-emerald-100'}`}>
                  {myBal.pendingHandover ? 'Handover confirm hona baaki hai' : 'Aap ke paas cash'}
                </p>
                <p className={`text-2xl font-black tabular-nums ${myBal.pendingHandover ? 'text-amber-800' : 'text-white'}`}
                  style={{ fontFamily: "'Syne', sans-serif" }}>
                  {pkr(Number(myBal.pendingBalance))}
                </p>
              </div>
            </div>
            {!myBal.pendingHandover && (
              <button onClick={() => { setHandoverAmt(String(Number(myBal.pendingBalance))); setShowHandover(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-white text-emerald-700 font-black text-sm rounded-xl hover:bg-emerald-50 transition shrink-0">
                <Send size={13}/> Jama Karein
              </button>
            )}
          </div>
        </div>
      )}

      {/* ══ KPI STRIP (owner only) ══════════════════════════════════════════ */}
      {isOwner && (
        <div className="px-4 sm:px-6 pt-4 pb-2 shrink-0">
          {isLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[0,1,2,3].map(i => <div key={i} className="h-[88px] rounded-2xl animate-pulse" style={{ background: 'var(--surface)' }}/>)}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KPICard
                label="Aaj Aya"
                value={pkrSh(todayTotal)}
                sub={dailyTarget ? `${dailyPct}% target` : pkr(todayTotal)}
                progress={dailyTarget ? dailyPct : undefined}
              />
              <KPICard
                label="Is Mahine"
                value={pkrSh(monthTotal)}
                sub={d?.monthInstTarget ? `${monthPct}% · ${daysLeft}d baaki` : `Net ${netFaida >= 0 ? '+' : ''}${pkrSh(netFaida)}`}
                progress={d?.monthInstTarget ? monthPct : undefined}
              />
              <KPICard
                label="Overdue"
                value={kpiOverdue > 0 ? `${kpiOverdue} log` : 'Sab Clear ✓'}
                sub={kpiOverdue > 0 ? pkr(d!.overdueAmount) + ' baaki' : 'Koi overdue nahi'}
                cs={kpiOverdue > 0 ? 'danger' : 'success'}
                onClick={() => navigate('/installments')}
              />
              <KPICard
                label="Active Plans"
                value={d?.activeCount ?? 0}
                sub={`${d?.monthlyActiveCount ?? 0} mahana · ${d?.dailyActiveCount ?? 0} roz`}
              />
            </div>
          )}
        </div>
      )}

      {/* ══ PAGE BODY ═══════════════════════════════════════════════════════ */}
      <div className="px-3 sm:px-5 lg:px-6 py-3">
        <div className="lg:grid lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_340px] gap-4 items-start">

          {/* ── LEFT ────────────────────────────────────────────────── */}
          <div className="space-y-4">

            {/* ── STAFF TODAY COLLECTIONS ─────────────────────────── */}
            {isOwner && (
              <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--surface)', borderColor: '#E2E8F0' }}>
                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b" style={{ borderColor: '#F1F5F9' }}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#EFF6FF' }}>
                      <Users size={13} style={{ color: 'var(--accent)' }} />
                    </div>
                    <div>
                      <h2 className="text-[14px] font-black leading-tight" style={{ color: 'var(--ink)' }}>
                        Aaj Ki Collection — Employee Wise
                      </h2>
                      <p className="text-[11px] font-medium" style={{ color: 'var(--ink-dim)' }}>
                        {staffToday.length > 0
                          ? `${staffToday.reduce((a, s) => a + s.count, 0)} payments · ${pkr(staffToday.reduce((a, s) => a + s.total, 0))} kul`
                          : 'Aaj abhi koi payment record nahi hui'}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => navigate('/installments')}
                    className="flex items-center gap-0.5 text-[12px] font-extrabold shrink-0" style={{ color: 'var(--accent)' }}>
                    Sab <ChevronRight size={12} />
                  </button>
                </div>

                {/* Skeleton while loading */}
                {isLoading ? (
                  <RowSkeleton rows={3} />
                ) : staffToday.length === 0 ? (
                  <div className="py-8 flex flex-col items-center gap-2 text-center px-4">
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: '#F8FAFC' }}>
                      <Users size={20} style={{ color: 'var(--ink-dim)' }} />
                    </div>
                    <p className="text-xs font-semibold" style={{ color: 'var(--ink-dim)' }}>
                      Koi staff register nahi ya aaj koi collection nahi hui
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="divide-y" style={{ borderColor: '#F8FAFC' }}>
                      {staffToday.map((staff, i) => {
                        const pct    = staffTodayMax > 0 ? Math.round((staff.total / staffTodayMax) * 100) : 0;
                        const colors = ['#2563EB', '#059669', '#D97706', '#7C3AED', '#DB2777', '#0891B2'];
                        const color  = colors[i % colors.length];
                        const hasCollected = staff.total > 0;
                        return (
                          <div key={staff.staffId} className="px-5 py-3.5">
                            <div className="flex items-center gap-3 mb-2">
                              {/* Avatar */}
                              <div className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-black shrink-0 select-none"
                                style={{
                                  background: hasCollected ? color : '#F1F5F9',
                                  color:      hasCollected ? '#fff' : 'var(--ink-dim)',
                                }}>
                                {staff.staffName[0]?.toUpperCase()}
                              </div>

                              {/* Name + count */}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold truncate" style={{ color: 'var(--ink)' }}>{staff.staffName}</p>
                                <p className="text-[11px] font-medium" style={{ color: hasCollected ? color : 'var(--ink-dim)' }}>
                                  {hasCollected
                                    ? `${staff.count} payment${staff.count !== 1 ? 's' : ''} aaj`
                                    : 'Aaj koi collection nahi'}
                                </p>
                              </div>

                              {/* Amount */}
                              <div className="text-right shrink-0">
                                <p className="font-black tabular-nums leading-tight"
                                  style={{
                                    color:      hasCollected ? 'var(--ink)' : 'var(--ink-dim)',
                                    fontFamily: "'Syne', sans-serif",
                                    fontSize:   '1rem',
                                    opacity:    hasCollected ? 1 : 0.45,
                                  }}>
                                  {hasCollected ? pkrSh(staff.total) : '—'}
                                </p>
                                {hasCollected && (
                                  <p className="text-[10px] font-semibold" style={{ color }}>
                                    {pct}% share
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Progress bar — only for those who collected */}
                            <div className="h-1 rounded-full overflow-hidden" style={{ background: '#F1F5F9' }}>
                              <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{ width: hasCollected ? `${pct}%` : '0%', background: color }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Total footer */}
                    {staffToday.some(s => s.total > 0) && (
                      <div className="flex items-center justify-between px-5 py-3 border-t" style={{ background: '#F8FAFC', borderColor: '#F1F5F9' }}>
                        <p className="text-xs font-bold" style={{ color: 'var(--ink-dim)' }}>
                          Kul Aaj Ki Collection
                        </p>
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
            <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--surface)', borderColor: '#E2E8F0' }}>
              <div className="flex items-center justify-between px-5 pt-5 pb-3.5">
                <div>
                  <h2 className="text-[15px] font-black" style={{ color: 'var(--ink)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Aaj Ka Kaam</h2>
                  <p className="text-[11px] font-medium mt-0.5" style={{ color: 'var(--ink-dim)' }}>
                    {!briefing ? 'Load ho raha hai…' : allClear ? 'Sab clear hai' : `${totalWork} cheezein pending`}
                  </p>
                </div>
                {briefing && totalWork > 0 && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {bOverdue  > 0 && <span className="text-[10px] font-black px-2 py-0.5 bg-red-50   text-red-600   rounded-lg border border-red-100"  >{bOverdue}  late</span>}
                    {bDueToday > 0 && <span className="text-[10px] font-black px-2 py-0.5 bg-blue-50  text-blue-600  rounded-lg border border-blue-100" >{bDueToday} aaj</span>}
                    {pDueCount > 0 && <span className="text-[10px] font-black px-2 py-0.5 bg-amber-50 text-amber-600 rounded-lg border border-amber-100">{pDueCount} wada</span>}
                  </div>
                )}
              </div>

              {!briefing ? (
                <div className="border-t" style={{ borderColor: '#F1F5F9' }}><RowSkeleton rows={5}/></div>
              ) : (
                <>
                  {/* Overdue */}
                  {briefing.urgentAccounts.length > 0 && (
                    <div className="border-t" style={{ borderColor: '#F1F5F9' }}>
                      <div className="flex items-center gap-2 px-5 py-2.5">
                        <span className="w-2 h-2 rounded-full bg-red-500 shrink-0"/>
                        <span className="text-[11px] font-black text-red-600 uppercase tracking-wide">Overdue ({briefing.overdueTotal})</span>
                      </div>
                      {briefing.urgentAccounts.map((acct, i) => {
                        const sev = acct.daysOverdue >= 30
                          ? 'bg-red-100 text-red-700' : acct.daysOverdue >= 14
                          ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700';
                        return (
                          <div key={acct.id}
                            className={`flex items-center gap-3 pl-4 pr-5 py-3 border-l-[3px] border-red-400 hover:bg-red-50/40 transition ${i > 0 ? 'border-t border-slate-50' : ''}`}>
                            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-xs font-black text-red-600 shrink-0 select-none">
                              {acct.customerName[0]?.toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold truncate leading-tight" style={{ color: 'var(--ink)' }}>{acct.customerName}</p>
                              <p className="text-[11px]" style={{ color: 'var(--ink-dim)' }}>{acct.customerPhone}</p>
                            </div>
                            <div className="text-right shrink-0 mr-2">
                              <p className="text-sm font-black tabular-nums" style={{ color: 'var(--ink)' }}>{pkr(acct.monthly)}</p>
                              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${sev}`}>{acct.daysOverdue}d late</span>
                            </div>
                            <a href={waLink(acct.customerPhone,
                              `Assalam-o-Alaikum ${acct.customerName}! Aapka installment ${acct.daysOverdue} din se due hai. ${pkr(acct.monthly)} jama karwain. Shukriya!`)}
                              target="_blank" rel="noopener noreferrer"
                              className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-[#25D366] hover:bg-[#1fb859] text-white text-[11px] font-black rounded-xl transition">
                              <PhoneCall size={10}/> WA
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Due today */}
                  {briefing.dueTodayAccounts.length > 0 && (
                    <div className="border-t" style={{ borderColor: '#F1F5F9' }}>
                      <div className="flex items-center justify-between px-5 py-2.5">
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
                          className={`flex items-center gap-3 pl-4 pr-5 py-3 border-l-[3px] border-blue-400 hover:bg-blue-50/40 transition ${i > 0 ? 'border-t border-slate-50' : ''}`}>
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-black text-blue-700 shrink-0 select-none">
                            {acct.customerName[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate leading-tight" style={{ color: 'var(--ink)' }}>{acct.customerName}</p>
                            <p className="text-[11px]" style={{ color: 'var(--ink-dim)' }}>{acct.customerPhone}</p>
                          </div>
                          <p className="text-sm font-black text-blue-700 tabular-nums shrink-0 mr-2">{pkr(acct.monthly)}</p>
                          <a href={waLink(acct.customerPhone,
                            `Assalam-o-Alaikum ${acct.customerName}! Aaj ka installment ${pkr(acct.monthly)} due hai. Jazak'Allah!`)}
                            target="_blank" rel="noopener noreferrer"
                            className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-[#25D366] hover:bg-[#1fb859] text-white text-[11px] font-black rounded-xl transition">
                            <PhoneCall size={10}/> WA
                          </a>
                        </div>
                      ))}
                      {briefing.dueTodayAccounts.length > 20 && (
                        <button onClick={() => navigate('/installments')}
                          className="w-full py-2.5 text-xs font-black text-blue-600 border-t border-slate-50 hover:bg-blue-50 transition flex items-center justify-center gap-1">
                          +{briefing.dueTodayAccounts.length - 20} aur <ChevronRight size={11}/>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Promises */}
                  {pDueCount > 0 && promises.length > 0 && (
                    <div className="border-t" style={{ borderColor: '#F1F5F9' }}>
                      <div className="flex items-center gap-2 px-5 py-2.5">
                        <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0"/>
                        <span className="text-[11px] font-black text-amber-600 uppercase tracking-wide">Waday ({pDueCount})</span>
                      </div>
                      {promises.slice(0, 5).map((p, i) => (
                        <div key={p.id}
                          className={`flex items-center gap-3 pl-4 pr-5 py-3 border-l-[3px] border-amber-400 ${i > 0 ? 'border-t border-slate-50' : ''}`}>
                          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-xs font-black text-amber-600 shrink-0 select-none">
                            {p.customerName[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate leading-tight" style={{ color: 'var(--ink)' }}>{p.customerName}</p>
                            <p className="text-[11px] truncate" style={{ color: 'var(--ink-dim)' }}>{p.productName}{p.note ? ` · ${p.note}` : ''}</p>
                          </div>
                          <span className="shrink-0 flex items-center gap-1 text-[10px] font-black bg-amber-100 text-amber-700 px-2 py-1 rounded-xl border border-amber-200">
                            <Bell size={9}/> Wada
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* All clear */}
                  {allClear && (
                    <div className="border-t py-10 flex flex-col items-center text-center" style={{ borderColor: '#F1F5F9' }}>
                      <div className="w-14 h-14 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center mb-3">
                        <CheckCircle size={28} className="text-emerald-500"/>
                      </div>
                      <p className="text-[15px] font-black" style={{ color: 'var(--ink)' }}>Sab Clear Hai!</p>
                      <p className="text-xs mt-1.5 max-w-[15rem] leading-relaxed" style={{ color: 'var(--ink-dim)' }}>
                        Koi due, overdue ya wada nahi. Mashaallah!
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ── RECENT INSTALLMENTS ──────────────────────────────── */}
            <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--surface)', borderColor: '#E2E8F0' }}>
              <SectionHead title="Recent Installments" action="Sab" onAction={() => navigate('/installments')} />
              {isLoading ? (
                <div className="border-t" style={{ borderColor: '#F1F5F9' }}><RowSkeleton rows={5}/></div>
              ) : !d?.recentInstallments.length ? (
                <div className="py-10 text-center border-t" style={{ borderColor: '#F1F5F9' }}>
                  <p className="text-xs" style={{ color: 'var(--ink-dim)' }}>
                    Koi installment nahi.{' '}
                    <button onClick={() => navigate('/installments')} className="font-black" style={{ color: 'var(--accent)' }}>Banao</button>
                  </p>
                </div>
              ) : (
                <div className="divide-y border-t" style={{ borderColor: '#F1F5F9' }}>
                  {d.recentInstallments.map(inst => {
                    const s = STATUS[inst.status] ?? { bg: 'bg-slate-100', text: 'text-slate-500', label: inst.status };
                    return (
                      <div key={inst.id} onClick={() => navigate('/installments')}
                        className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-slate-50/60 transition">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 select-none"
                          style={{ background: '#F1F5F9', color: 'var(--ink-dim)' }}>
                          {inst.customerName[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate" style={{ color: 'var(--ink)' }}>{inst.customerName}</p>
                          <p className="text-[10px] truncate" style={{ color: 'var(--ink-dim)' }}>{inst.productName}</p>
                        </div>
                        <div className="text-right shrink-0 mr-2">
                          <p className="text-xs font-black tabular-nums" style={{ color: 'var(--ink)' }}>{pkr(Number(inst.remaining))}</p>
                          <p className="text-[10px]" style={{ color: 'var(--ink-dim)' }}>baaki</p>
                        </div>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${s.bg} ${s.text}`}>{s.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>{/* end left */}

          {/* ── SIDEBAR ─────────────────────────────────────────────── */}
          <div className="mt-4 lg:mt-0">
            <div className="lg:sticky lg:top-16 space-y-4 lg:max-h-[calc(100vh_-_4rem)] lg:overflow-y-auto lg:pb-4 lg:pr-0.5">

              {/* PORTFOLIO */}
              {isOwner && (
                <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--surface)', borderColor: '#E2E8F0' }}>
                  <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#F1F5F9' }}>
                    <h3 className="text-xs font-black uppercase tracking-wide" style={{ color: 'var(--ink)' }}>Portfolio</h3>
                    <button onClick={() => navigate('/installments')}
                      className="text-[11px] font-black flex items-center gap-0.5" style={{ color: 'var(--accent)' }}>
                      Sab <ArrowUpRight size={10}/>
                    </button>
                  </div>
                  {isLoading ? <RowSkeleton rows={5}/> : (
                    <div className="divide-y" style={{ borderColor: '#F8FAFC' }}>
                      <PRow label="Active Plans"        value={d?.activeCount ?? 0}            sub={`${d?.monthlyActiveCount ?? 0} mahana · ${d?.dailyActiveCount ?? 0} roz`} vc="text-blue-700"/>
                      <PRow label="Overdue"             value={d?.overdueCount ?? 0}            sub={(d?.overdueAmount ?? 0) > 0 ? pkr(d!.overdueAmount) : 'sab clear'} vc={(d?.overdueCount ?? 0) > 0 ? 'text-red-600' : 'text-slate-300'} onClick={() => navigate('/installments')}/>
                      <PRow label="Khatam Hone Wale"   value={completingSoon.length}           sub="1–3 qist baaki" vc={completingSoon.length > 0 ? 'text-amber-600' : 'text-slate-300'}/>
                      <PRow label="Naye (Is Mahine)"   value={d?.newThisMonthCount ?? 0}       sub={pkrSh(d?.newThisMonthValue ?? 0)}/>
                      <PRow label="Khatam (Is Mahine)" value={d?.completedThisMonthCount ?? 0} sub={pkrSh(d?.completedThisMonthValue ?? 0)} vc={(d?.completedThisMonthCount ?? 0) > 0 ? 'text-emerald-600' : 'text-slate-300'}/>
                    </div>
                  )}
                </div>
              )}

              {/* CASH IN FIELD */}
              {isOwner && staffCash.length > 0 && (
                <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid #FDE68A' }}>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-amber-100 bg-amber-50">
                    <div className="flex items-center gap-2">
                      <Wallet size={12} className="text-amber-600"/>
                      <span className="text-xs font-black text-amber-800">Cash in Field</span>
                    </div>
                    <span className="text-sm font-black text-amber-700 tabular-nums">{pkr(fieldTotal)}</span>
                  </div>
                  {staffCash.map((s, i) => (
                    <div key={s.staffId} className={`flex items-center gap-2.5 px-4 py-3 ${i > 0 ? 'border-t border-slate-50' : ''}`}>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 select-none"
                        style={{ background: '#F1F5F9', color: 'var(--ink-dim)' }}>
                        {s.staffName[0]?.toUpperCase()}
                      </div>
                      <p className="text-xs font-bold flex-1 truncate" style={{ color: 'var(--ink)' }}>{s.staffName}</p>
                      <p className="text-xs font-black tabular-nums shrink-0 mr-1" style={{ color: 'var(--ink)' }}>{pkr(Number(s.pendingBalance))}</p>
                      <button onClick={() => setReceiveTarget(s)}
                        className={`shrink-0 text-[11px] font-black px-2.5 py-1.5 rounded-xl transition border ${
                          s.pendingHandover
                            ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200'
                            : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200'
                        }`}>
                        {s.pendingHandover ? 'Confirm' : 'Li'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* KHATAM HONE WALE */}
              {isOwner && completingSoon.length > 0 && (
                <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--surface)', borderColor: '#E2E8F0' }}>
                  <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#F1F5F9' }}>
                    <div className="flex items-center gap-2">
                      <TrendingDown size={12} className="text-emerald-600"/>
                      <span className="text-xs font-black" style={{ color: 'var(--ink)' }}>Khatam Hone Wale</span>
                    </div>
                    <span className="text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-lg">{completingSoon.length}</span>
                  </div>
                  {completingSoon.map((c, i) => (
                    <div key={c.id} className={`flex items-center gap-2.5 px-4 py-3 ${i > 0 ? 'border-t border-slate-50' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-xs font-bold truncate" style={{ color: 'var(--ink)' }}>{c.customerName}</p>
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border shrink-0 ${c.paymentsLeft === 1 ? 'bg-red-50 text-red-700 border-red-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                            {c.paymentsLeft}x
                          </span>
                        </div>
                        <p className="text-[10px] truncate" style={{ color: 'var(--ink-dim)' }}>{c.productName}</p>
                      </div>
                      <a href={waLink(c.customerPhone, `Assalam-o-Alaikum ${c.customerName}! Sirf ${c.paymentsLeft} installment baaki hai. Shukriya!`)}
                        target="_blank" rel="noopener noreferrer"
                        className="shrink-0 text-[11px] font-black text-white bg-[#25D366] hover:bg-[#1fb859] px-2.5 py-1.5 rounded-xl transition">
                        WA
                      </a>
                    </div>
                  ))}
                </div>
              )}

              {/* LOW STOCK */}
              {lowStock.length > 0 && (
                <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid #FDE68A' }}>
                  <div className="flex items-center justify-between px-4 py-3 bg-amber-50 border-b border-amber-100">
                    <div className="flex items-center gap-2">
                      <Package size={12} className="text-amber-600"/>
                      <span className="text-xs font-black text-amber-800">Kam Stock</span>
                    </div>
                    <button onClick={() => navigate('/products')} className="text-[11px] text-amber-700 font-black hover:underline">Manage →</button>
                  </div>
                  <div className="px-4 py-3.5 flex flex-wrap gap-1.5">
                    {lowStock.map(p => (
                      <span key={p.id}
                        className={`text-[11px] font-black px-2.5 py-1 rounded-xl border ${p.stock === 0 ? 'bg-red-50 text-red-700 border-red-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                        {p.name} ({p.stock})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* BIRTHDAYS */}
              {birthdays.length > 0 && (
                <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid #FBCFE8' }}>
                  <div className="flex items-center gap-2 px-4 py-3 bg-pink-50 border-b border-pink-100">
                    <Gift size={12} className="text-pink-500"/>
                    <span className="text-xs font-black text-pink-700">{birthdays.length} Birthday is hafte</span>
                  </div>
                  {birthdays.map((c, i) => {
                    const [, mm, dd] = c.dob.split('-');
                    const bday   = new Date(`${new Date().getFullYear()}-${mm}-${dd}`);
                    const todayD = new Date(); todayD.setHours(0,0,0,0);
                    const isToday = bday.toDateString() === todayD.toDateString();
                    return (
                      <div key={c.id} className={`flex items-center gap-2.5 px-4 py-3 ${i > 0 ? 'border-t border-slate-50' : ''}`}>
                        <div className="w-7 h-7 bg-pink-100 rounded-full flex items-center justify-center text-[11px] font-black text-pink-600 shrink-0 select-none">
                          {c.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-bold truncate" style={{ color: 'var(--ink)' }}>{c.name}</p>
                            {isToday && <span className="text-[9px] font-black bg-pink-100 border border-pink-200 text-pink-700 px-1.5 py-0.5 rounded shrink-0">Aaj!</span>}
                          </div>
                          {c.area && <p className="text-[10px]" style={{ color: 'var(--ink-dim)' }}>{c.area}</p>}
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
              <div className="px-5 py-4 flex items-center justify-between" style={{ background: 'var(--ink)' }}>
                <div>
                  <p className="text-white font-black text-sm">Cash Jama Karein</p>
                  <p className="text-slate-400 text-xs mt-0.5">Owner ko hand over karo</p>
                </div>
                <button onClick={() => setShowHandover(false)} className="text-slate-400 hover:text-white transition"><X size={16}/></button>
              </div>
              <div className="p-5 space-y-3">
                <div className="rounded-xl px-4 py-3 ring-1 ring-slate-200" style={{ background: '#F8FAFC' }}>
                  <p className="text-[10px] font-medium" style={{ color: 'var(--ink-dim)' }}>System ka hisaab</p>
                  <p className="text-2xl font-black tabular-nums" style={{ color: 'var(--ink)', fontFamily: "'Syne', sans-serif" }}>{pkr(bal)}</p>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--ink-dim)' }}>Actual Amount *</label>
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
