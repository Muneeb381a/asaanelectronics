import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  TrendingUp, TrendingDown, CreditCard, AlertTriangle,
  Calendar, Package, ArrowRight, BarChart3,
  MapPin, Users, ShieldCheck, Zap, ShoppingCart, Receipt, Bell, Target, Gift,
  Clock, PhoneCall, Banknote, XOctagon,
  Wallet, CheckCircle, Send, X, Landmark,
} from 'lucide-react';
import { useAuthStore } from '../store/auth.store.ts';
import { statsApi } from '../api/stats.api.ts';
import { recoveryApi } from '../api/recovery.api.ts';
import { sellersApi } from '../api/sellers.api.ts';
import { customersApi } from '../api/customers.api.ts';
import { handoversApi, type StaffBalance } from '../api/handovers.api.ts';
import { RowSkeleton } from '../components/ui/Skeleton.tsx';
import { fmtDate } from '../utils/dateFormat.ts';

function pkr(v: number) {
  return 'PKR ' + v.toLocaleString('en-PK', { maximumFractionDigits: 0 });
}

function pkrShort(v: number): string {
  if (v >= 100_000) return `${(v / 100_000).toFixed(v % 100_000 === 0 ? 0 : 1)}L`;
  if (v >= 1_000)   return `${(v / 1_000).toFixed(v % 1_000 === 0 ? 0 : 1)}K`;
  return String(v);
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE:    'bg-emerald-100 text-emerald-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
  DEFAULTED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-slate-100 text-slate-500',
};

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-0.5 h-8">
      {data.map((v, i) => {
        const pct = Math.max((v / max) * 100, v > 0 ? 6 : 0);
        const isLast = i === data.length - 1;
        return (
          <div key={i} className={`flex-1 rounded-sm ${isLast ? 'bg-blue-500' : 'bg-blue-200'}`} style={{ height: `${pct}%` }} />
        );
      })}
    </div>
  );
}

function CashflowBar({ data }: { data: Array<{ date: string; expected: number }> }) {
  if (!data.length) return <p className="text-xs text-slate-400 py-4 text-center">Agli 30 dinon mein koi payment due nahi</p>;
  const max = Math.max(...data.map((d) => d.expected), 1);
  const total = data.reduce((s, d) => s + d.expected, 0);
  return (
    <div>
      <p className="text-2xl font-black text-slate-900 tabular-nums">PKR {pkrShort(total)}</p>
      <p className="text-xs text-slate-400 mb-3">agli 30 dinon mein milne wala</p>
      <div className="flex items-end gap-0.5 h-14 overflow-hidden">
        {data.map((d) => (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5 group relative">
            <div
              className="w-full bg-blue-400 rounded-t-sm hover:bg-blue-600 transition-colors cursor-default"
              style={{ height: `${Math.max((d.expected / max) * 100, 6)}%` }}
              title={`${d.date}: PKR ${d.expected.toLocaleString()}`}
            />
          </div>
        ))}
      </div>
      <p className="text-[10px] text-slate-400 mt-1">{data[0]?.date} → {data[data.length - 1]?.date}</p>
    </div>
  );
}

function HeroSkeleton() {
  return (
    <div className="bg-slate-900 rounded-3xl p-6 animate-pulse">
      <div className="grid grid-cols-2 gap-6 mb-5">
        <div>
          <div className="h-3 bg-slate-700 rounded w-16 mb-3" />
          <div className="h-10 bg-slate-700 rounded w-28" />
          <div className="h-3 bg-slate-800 rounded w-20 mt-2" />
        </div>
        <div>
          <div className="h-3 bg-slate-700 rounded w-16 mb-3" />
          <div className="h-10 bg-slate-700 rounded w-28" />
          <div className="h-3 bg-slate-800 rounded w-20 mt-2" />
        </div>
      </div>
      <div className="h-px bg-slate-700 mb-4" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-16 bg-slate-800 rounded-2xl" />
        <div className="h-16 bg-slate-800 rounded-2xl" />
      </div>
    </div>
  );
}

function CashReceiveModal({ target, onClose }: { target: StaffBalance; onClose: () => void }) {
  const qc = useQueryClient();
  const systemBalance = Number(target.pendingBalance);
  const prefill = target.pendingHandover
    ? target.pendingHandover.handedAmount
    : String(systemBalance);

  const [amount, setAmount] = useState(prefill);
  const [note,   setNote]   = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      handoversApi.directReceive({ staffId: target.staffId, amount: Number(amount), note: note.trim() || undefined }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['handover-pending-balances'] });
      void qc.invalidateQueries({ queryKey: ['handover-balances'] });
      void qc.invalidateQueries({ queryKey: ['handovers'] });
      toast.success(`${target.staffName} se PKR ${Number(amount).toLocaleString()} receive ho gaya`);
      onClose();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Kuch masla ho gaya'),
  });

  const diff    = Number(amount) - systemBalance;
  const hasDiff = Math.abs(diff) >= 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-black text-slate-900">Cash Li</h2>
            <p className="text-xs text-slate-400 mt-0.5">{target.staffName} se receive karo</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
          <p className="text-[11px] text-blue-400 font-bold uppercase tracking-wide mb-0.5">System Balance (Cash)</p>
          <p className="text-2xl font-black text-blue-700 tabular-nums">{pkr(systemBalance)}</p>
        </div>

        {target.pendingHandover && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
            <p className="text-[11px] text-amber-500 font-bold uppercase tracking-wide mb-0.5">Staff ne submit kiya</p>
            <p className="text-2xl font-black text-amber-700 tabular-nums">{pkr(Number(target.pendingHandover.handedAmount))}</p>
            {target.pendingHandover.note && (
              <p className="text-xs text-slate-400 mt-1 italic">"{target.pendingHandover.note}"</p>
            )}
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1.5">
            Aap ne gina hua amount (PKR) <span className="text-red-500">*</span>
          </label>
          <input
            type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
            min="0"
            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50 transition tabular-nums"
          />
          {amount && hasDiff && (
            <p className={`text-xs mt-1 font-bold ${diff < 0 ? 'text-red-500' : 'text-amber-600'}`}>
              {diff < 0
                ? `PKR ${Math.abs(diff).toLocaleString()} system se kam — note zaroor likhein`
                : `PKR ${diff.toLocaleString()} system se zyada`}
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1.5">
            Note {hasDiff && <span className="text-amber-500">(farq ki wajah likhein)</span>}
          </label>
          <textarea
            value={note} onChange={(e) => setNote(e.target.value)}
            rows={2} placeholder="e.g. PKR 3000 kal dega, ya ATM se transfer hua"
            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50 transition resize-none"
          />
        </div>

        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2.5 text-sm font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!amount || Number(amount) < 0 || mutation.isPending}
            className="flex-1 py-2.5 text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {mutation.isPending ? 'Processing…' : <><CheckCircle size={14} /> Cash Li</>}
          </button>
        </div>
      </div>
    </div>
  );
}

type DashTab = 'aaj' | 'mahine' | 'portfolio' | 'reports';

export default function DashboardPage() {
  const user     = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const isOwner  = user?.role === 'SELLER_OWNER';
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab]                 = useState<DashTab>('aaj');
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [handoverAmount, setHandoverAmount]       = useState('');
  const [handoverNote, setHandoverNote]           = useState('');
  const [receiveTarget, setReceiveTarget]         = useState<StaffBalance | null>(null);
  const [showDueToday, setShowDueToday]           = useState(false);

  const { data: myBalance } = useQuery({
    queryKey: ['handover-my-balance'],
    queryFn:  () => handoversApi.myBalance(),
    enabled:  !isOwner,
    staleTime: 30_000,
    refetchInterval: 120_000,
  });

  const { data: pendingBalances = [] } = useQuery({
    queryKey: ['handover-pending-balances'],
    queryFn:  handoversApi.pendingBalances,
    enabled:  isOwner,
    staleTime: 30_000,
    refetchInterval: 120_000,
  });

  const submitHandover = useMutation({
    mutationFn: () => handoversApi.create({
      handedAmount: Number(handoverAmount),
      note: handoverNote.trim() || undefined,
    }),
    onSuccess: () => {
      setShowHandoverModal(false);
      setHandoverAmount('');
      setHandoverNote('');
      void queryClient.invalidateQueries({ queryKey: ['handover-my-balance'] });
    },
  });

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn:  statsApi.getDashboard,
    staleTime:       60_000,
    gcTime:          5 * 60_000,
    refetchInterval: 5 * 60_000,
  });

  const promisesDueCount = dashboard?.stats?.promisesDueCount ?? 0;

  const { data: promises = [], isLoading: promisesLoading } = useQuery({
    queryKey: ['promises-due'],
    queryFn:  recoveryApi.promisesDue,
    enabled:  promisesDueCount > 0,
    staleTime: 60_000,
    gcTime:    5 * 60_000,
  });

  const { data: shop } = useQuery({
    queryKey: ['shop-me'],
    queryFn:  sellersApi.getMe,
    staleTime: 5 * 60_000,
    gcTime:    10 * 60_000,
    enabled:   isOwner,
  });

  const data     = dashboard?.stats;
  const reports  = dashboard?.reports;
  const advanced = dashboard?.advanced;

  const today = fmtDate(new Date());

  const thisMonth = reports?.monthlyCollections.at(-1)?.total ?? 0;
  const lastMonth = reports?.monthlyCollections.at(-2)?.total ?? 0;
  const momChange = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : null;
  const spark6    = reports?.monthlyCollections.slice(-6).map((m) => m.total) ?? [];

  const rate      = reports?.collectionRate.rate ?? 0;
  const rateColor = rate >= 80 ? 'text-emerald-600' : rate >= 60 ? 'text-amber-600' : 'text-red-500';
  const rateBar   = rate >= 80 ? 'bg-emerald-500' : rate >= 60 ? 'bg-amber-400' : 'bg-red-500';

  const aging    = reports?.agingBuckets;
  const lowStock = data?.lowStockItems ?? [];

  const { data: birthdays = [] } = useQuery({
    queryKey: ['upcoming-birthdays'],
    queryFn:  customersApi.getUpcomingBirthdays,
    staleTime: 60 * 60_000,
    gcTime:    2 * 60 * 60_000,
  });

  const { data: briefing } = useQuery({
    queryKey:  ['daily-briefing'],
    queryFn:   statsApi.getDailyBriefing,
    staleTime: 60_000,
    gcTime:    5 * 60_000,
    refetchInterval: 5 * 60_000,
  });

  const todayTotal = (data?.todayCollections ?? 0) + (data?.todayCashSales ?? 0);
  const monthTotal = (data?.monthCollections ?? 0) + (data?.monthCashSales ?? 0);

  const hasAnalytics = !!(reports?.topDebtors.length || reports?.topProducts.length || advanced);

  const DASH_TABS: { key: DashTab; label: string }[] = [
    { key: 'aaj',       label: 'Aaj' },
    { key: 'mahine',    label: 'Is Mahine' },
    { key: 'portfolio', label: 'Portfolio' },
    ...(isOwner ? [{ key: 'reports' as DashTab, label: 'Reports' }] : []),
  ];

  return (
    <div className="max-w-5xl mx-auto">

      {/* ── Sticky header + tabs ── */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-slate-100">
        <div className="px-4 pt-4 pb-0 sm:px-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">{today}</p>
              <h1 className="text-xl font-black text-slate-900 leading-tight mt-0.5">
                {greeting()}, <span className="text-blue-600">{user?.name.split(' ')[0]}</span>
              </h1>
            </div>
            {isOwner && (
              <button
                onClick={() => navigate('/reports')}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black transition shadow-sm"
              >
                <BarChart3 size={13} /> Reports
              </button>
            )}
          </div>
          <div className="flex overflow-x-auto scrollbar-none -mb-px">
            {DASH_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-4 py-2.5 text-sm font-bold whitespace-nowrap border-b-2 transition-all shrink-0 ${
                  activeTab === t.key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-400 hover:text-slate-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 py-5 sm:px-6 space-y-4">

        {/* ── Quick Actions ── */}
        {(() => {
          const perms = user?.permissions as Record<string, boolean> | null | undefined;
          const actions = [
            isOwner || perms?.canAddInstallment
              ? { label: 'Installment', icon: CreditCard,   color: 'text-blue-600',    bg: 'bg-blue-50',    to: '/installments' }
              : null,
            isOwner || perms?.canAddCustomer
              ? { label: 'Customer',    icon: Users,        color: 'text-violet-600',  bg: 'bg-violet-50',  to: '/customers' }
              : null,
            isOwner || perms?.canMakeCashSales
              ? { label: 'Cash Sale',   icon: ShoppingCart, color: 'text-emerald-600', bg: 'bg-emerald-50', to: '/cash-sales' }
              : null,
            isOwner || perms?.canRecordExpense
              ? { label: 'Expense',     icon: Receipt,      color: 'text-rose-600',    bg: 'bg-rose-50',    to: '/expenses' }
              : null,
            isOwner || perms?.canManageProducts
              ? { label: 'Product',     icon: Package,      color: 'text-amber-600',   bg: 'bg-amber-50',   to: '/products' }
              : null,
          ].filter(Boolean) as { label: string; icon: React.ElementType; color: string; bg: string; to: string }[];

          if (!actions.length) return null;
          return (
            <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
              {actions.map((a) => (
                <button
                  key={a.to}
                  onClick={() => navigate(a.to)}
                  className="flex flex-col items-center gap-2 px-4 py-3.5 rounded-2xl bg-white ring-1 ring-slate-200 hover:ring-slate-300 hover:shadow-md shadow-sm transition-all shrink-0 min-w-[72px]"
                >
                  <div className={`w-10 h-10 ${a.bg} rounded-xl flex items-center justify-center`}>
                    <a.icon size={18} className={a.color} />
                  </div>
                  <span className="text-[11px] font-black text-slate-700 whitespace-nowrap">{a.label}</span>
                </button>
              ))}
            </div>
          );
        })()}

        {/* ── Staff: Cash in Hand ── */}
        {!isOwner && (() => {
          if (!myBalance) return null;
          const balance = Number(myBalance.pendingBalance);
          if (balance <= 0) return null;
          if (myBalance.pendingHandover) {
            return (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                  <CheckCircle size={20} className="text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-amber-800">Handover Submitted</p>
                  <p className="text-xs text-amber-600 mt-0.5">{pkr(balance)} — Owner ki confirmation ka intezaar hai</p>
                </div>
                <span className="shrink-0 text-[10px] font-black bg-amber-200 text-amber-700 px-2.5 py-1 rounded-lg tracking-wider uppercase">PENDING</span>
              </div>
            );
          }
          return (
            <div className="bg-linear-to-r from-emerald-600 to-emerald-500 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-md shadow-emerald-200">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                  <Wallet size={22} className="text-white" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-emerald-100 uppercase tracking-widest">Cash in Hand</p>
                  <p className="text-2xl font-black text-white tabular-nums">{pkr(balance)}</p>
                </div>
              </div>
              <button
                onClick={() => { setHandoverAmount(String(balance)); setShowHandoverModal(true); }}
                className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 bg-white text-emerald-700 font-black text-sm rounded-xl hover:bg-emerald-50 transition"
              >
                <Send size={14} /> Jama Karein
              </button>
            </div>
          );
        })()}

        {/* ── HERO: Money Snapshot (owner only) ── */}
        {isOwner && (isLoading ? <HeroSkeleton /> : (
          <div className="relative bg-slate-900 rounded-3xl p-6 text-white overflow-hidden shadow-xl shadow-slate-900/20">
            <div className="absolute -top-14 -right-14 w-52 h-52 rounded-full bg-blue-600/10 pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-indigo-600/8 pointer-events-none" />

            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Paisa Ka Haal</p>

            <div className="grid grid-cols-2 gap-6 mb-5">
              {/* Today */}
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Aaj Aya</p>
                <p className="text-4xl font-black text-white tabular-nums leading-none">{pkrShort(todayTotal)}</p>
                <p className="text-xs text-slate-500 mt-1 tabular-nums">{pkr(todayTotal)}</p>
                <div className="flex gap-2 mt-2.5">
                  <div className="bg-white/8 rounded-lg px-2 py-1">
                    <p className="text-[9px] text-slate-500 uppercase tracking-wide">Inst</p>
                    <p className="text-xs font-black text-slate-200 tabular-nums">{pkrShort(data?.todayCollections ?? 0)}</p>
                  </div>
                  <div className="bg-white/8 rounded-lg px-2 py-1">
                    <p className="text-[9px] text-slate-500 uppercase tracking-wide">Sale</p>
                    <p className="text-xs font-black text-slate-200 tabular-nums">{pkrShort(data?.todayCashSales ?? 0)}</p>
                  </div>
                </div>
              </div>
              {/* This Month */}
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Is Mahine</p>
                <p className="text-4xl font-black text-white tabular-nums leading-none">{pkrShort(monthTotal)}</p>
                <p className="text-xs text-slate-500 mt-1 tabular-nums">{pkr(monthTotal)}</p>
                {momChange !== null && (
                  <div className="flex items-center gap-1.5 mt-2.5 bg-white/8 rounded-lg px-2.5 py-1.5 w-fit">
                    {momChange >= 0
                      ? <TrendingUp size={11} className="text-emerald-400" />
                      : <TrendingDown size={11} className="text-red-400" />}
                    <span className={`text-[11px] font-black ${momChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {Math.abs(momChange)}% {momChange >= 0 ? 'zyada' : 'kam'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="h-px bg-white/10 mb-4" />

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/8 rounded-2xl px-4 py-3 flex items-center gap-3">
                <div className="w-9 h-9 bg-emerald-500/20 rounded-xl flex items-center justify-center shrink-0">
                  <CreditCard size={16} className="text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-black text-white tabular-nums leading-none">{data?.activeCount ?? 0}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Active Plans</p>
                </div>
              </div>
              <div
                className={`rounded-2xl px-4 py-3 flex items-center gap-3 cursor-pointer transition ${
                  (data?.overdueCount ?? 0) > 0 ? 'bg-red-500/20 hover:bg-red-500/30' : 'bg-white/8'
                }`}
                onClick={() => navigate('/installments')}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  (data?.overdueCount ?? 0) > 0 ? 'bg-red-500/30' : 'bg-white/10'
                }`}>
                  <AlertTriangle size={16} className={(data?.overdueCount ?? 0) > 0 ? 'text-red-400' : 'text-slate-500'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-2xl font-black tabular-nums leading-none ${
                    (data?.overdueCount ?? 0) > 0 ? 'text-red-400' : 'text-slate-500'
                  }`}>{data?.overdueCount ?? 0}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                    Overdue{(data?.overdueAmount ?? 0) > 0 ? ` · ${pkrShort(data!.overdueAmount)}` : ''}
                  </p>
                </div>
                <ArrowRight size={13} className="text-slate-600 shrink-0" />
              </div>
            </div>
          </div>
        ))}

        {/* ── Owner: Cash in Field ── */}
        {isOwner && (() => {
          const staffWithCash = pendingBalances.filter((s) => Number(s.pendingBalance) > 0);
          if (!staffWithCash.length) return null;
          const totalCash = staffWithCash.reduce((sum, s) => sum + Number(s.pendingBalance), 0);
          return (
            <div className="bg-white rounded-2xl shadow-sm ring-1 ring-amber-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-amber-50 border-b border-amber-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center">
                    <Wallet size={15} className="text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-amber-800">Cash in Field</p>
                    <p className="text-[11px] text-amber-500">Staff k paas — abhi jama nahi hua</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-base font-black text-amber-700 tabular-nums">{pkr(totalCash)}</p>
                  <button onClick={() => navigate('/staff')} className="flex items-center gap-1 text-xs text-amber-600 font-black hover:underline">
                    Review <ArrowRight size={12} />
                  </button>
                </div>
              </div>
              <div className="divide-y divide-slate-50">
                {staffWithCash.map((s) => (
                  <div key={s.staffId} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-xs font-black text-slate-600 shrink-0">
                      {s.staffName[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900">{s.staffName}</p>
                      {s.pendingHandover
                        ? <p className="text-[11px] text-amber-600 font-medium">Handover submit kia — confirm karein</p>
                        : <p className="text-[11px] text-slate-400">Field mein — abhi jama nahi kia</p>
                      }
                    </div>
                    <p className="text-sm font-black text-slate-900 shrink-0 tabular-nums">{pkr(Number(s.pendingBalance))}</p>
                    <button
                      onClick={() => setReceiveTarget(s)}
                      className={`shrink-0 text-xs font-black px-3 py-1.5 rounded-xl transition ${
                        s.pendingHandover
                          ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                          : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      }`}
                    >
                      {s.pendingHandover ? 'Confirm' : 'Cash Li'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ══════════════════════════════════════ AAJ TAB ══════════════════════════════════════ */}
        {activeTab === 'aaj' && (<>

        <div className="flex items-center gap-2.5 pt-1">
          <div className="w-1 h-5 bg-blue-600 rounded-full shrink-0" />
          <p className="text-sm font-black text-slate-900">Aaj Ka Kaam</p>
          <p className="text-[11px] text-slate-400">— ye cheezein aaj handle karni hain</p>
        </div>

        {/* Daily Briefing */}
        {briefing && (
          <div className="space-y-3">
            {/* Two big metric cards */}
            <div className="grid grid-cols-2 gap-3">
              <button
                className={`text-left p-5 rounded-2xl shadow-sm ring-1 transition-all ${
                  briefing.dueToday > 0
                    ? 'bg-blue-600 ring-blue-500/30 hover:bg-blue-700 shadow-blue-200'
                    : 'bg-white ring-slate-200 hover:ring-slate-300'
                }`}
                onClick={() => briefing.dueToday > 0 && setShowDueToday((v) => !v)}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${
                  briefing.dueToday > 0 ? 'bg-white/20' : 'bg-blue-50'
                }`}>
                  <Clock size={20} className={briefing.dueToday > 0 ? 'text-white' : 'text-blue-300'} />
                </div>
                <p className={`text-5xl font-black tabular-nums leading-none ${
                  briefing.dueToday > 0 ? 'text-white' : 'text-slate-300'
                }`}>{briefing.dueToday}</p>
                <p className={`text-sm font-black mt-2 ${briefing.dueToday > 0 ? 'text-blue-100' : 'text-slate-500'}`}>
                  Aaj Due Hain
                </p>
                <p className={`text-[11px] mt-0.5 ${briefing.dueToday > 0 ? 'text-blue-200' : 'text-slate-400'}`}>
                  {briefing.dueToday > 0 ? (showDueToday ? 'Chhupao ▲' : 'Naam dekho ▼') : 'Koi due nahi'}
                </p>
              </button>

              <div className={`p-5 rounded-2xl shadow-sm ring-1 ${
                briefing.overdueTotal > 0
                  ? 'bg-rose-600 ring-rose-500/30 shadow-rose-200'
                  : 'bg-white ring-slate-200'
              }`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${
                  briefing.overdueTotal > 0 ? 'bg-white/20' : 'bg-rose-50'
                }`}>
                  <AlertTriangle size={20} className={briefing.overdueTotal > 0 ? 'text-white' : 'text-rose-300'} />
                </div>
                <p className={`text-5xl font-black tabular-nums leading-none ${
                  briefing.overdueTotal > 0 ? 'text-white' : 'text-slate-300'
                }`}>{briefing.overdueTotal}</p>
                <p className={`text-sm font-black mt-2 ${briefing.overdueTotal > 0 ? 'text-rose-100' : 'text-slate-500'}`}>
                  Late Hain
                </p>
                <p className={`text-[11px] mt-0.5 ${briefing.overdueTotal > 0 ? 'text-rose-200' : 'text-slate-400'}`}>
                  {briefing.overdueTotal > 0 ? 'Call karo — foran' : 'Sab time pe'}
                </p>
              </div>
            </div>

            {/* Secondary 3-col row */}
            <div className="grid grid-cols-3 gap-2">
              {[
                {
                  label: 'Waday',
                  sub: 'Aaj follow karein',
                  value: String(briefing.promisesToday),
                  icon: PhoneCall,
                  active: briefing.promisesToday > 0,
                  col: 'text-amber-600',
                  val: 'text-amber-700',
                },
                {
                  label: 'Aaj Mila',
                  sub: 'Cash + inst',
                  value: pkrShort(todayTotal),
                  icon: Banknote,
                  active: todayTotal > 0,
                  col: 'text-emerald-600',
                  val: 'text-emerald-700',
                },
                {
                  label: 'Default',
                  sub: 'Serious mamla',
                  value: String(briefing.defaultedCount),
                  icon: XOctagon,
                  active: briefing.defaultedCount > 0,
                  col: 'text-red-500',
                  val: 'text-red-600',
                },
              ].map(({ label, sub, value, icon: Icon, active, col, val }) => (
                <div key={label} className="bg-white ring-1 ring-slate-200 rounded-2xl p-3 shadow-sm text-center">
                  <Icon size={16} className={`mx-auto mb-1.5 ${active ? col : 'text-slate-300'}`} />
                  <p className={`text-xl font-black tabular-nums leading-none ${active ? val : 'text-slate-300'}`}>{value}</p>
                  <p className="text-[11px] font-black text-slate-700 mt-1">{label}</p>
                  <p className="text-[9px] text-slate-400 mt-0.5 leading-tight">{sub}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Aaj Due expanded */}
        {briefing && showDueToday && briefing.dueTodayAccounts.length > 0 && (
          <div className="bg-blue-50 border border-blue-100 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-3 pb-2.5 border-b border-blue-100">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-blue-600" />
                <p className="text-xs font-black text-blue-700">Aaj due hain — {briefing.dueTodayAccounts.length} log</p>
              </div>
              <button onClick={() => setShowDueToday(false)} className="text-blue-400 hover:text-blue-600"><X size={14} /></button>
            </div>
            <div className="divide-y divide-blue-100">
              {briefing.dueTodayAccounts.map((acct) => {
                const wa = `https://wa.me/92${acct.customerPhone.replace(/^0/, '').replace(/\D/g, '')}?text=${encodeURIComponent(
                  `Assalam-o-Alaikum ${acct.customerName}, aapka aaj ka installment PKR ${acct.monthly.toLocaleString('en-PK')} due hai. Meherbani farma ke payment karein. Shukriya.`
                )}`;
                return (
                  <div key={acct.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-[11px] font-black text-blue-600 shrink-0">
                      {acct.customerName[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{acct.customerName}</p>
                      <p className="text-[10px] text-slate-400">{acct.customerPhone}</p>
                    </div>
                    <p className="text-sm font-black text-blue-700 tabular-nums shrink-0">{pkr(acct.monthly)}</p>
                    <a href={wa} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-black transition shrink-0">
                      <PhoneCall size={11} /> WA
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Call List */}
        {briefing && briefing.urgentAccounts.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-rose-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-rose-50 border-b border-rose-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-rose-100 rounded-xl flex items-center justify-center">
                  <PhoneCall size={15} className="text-rose-600" />
                </div>
                <div>
                  <p className="text-sm font-black text-rose-800">Inhe Call Karein</p>
                  <p className="text-[11px] text-rose-400">Sabse zyada late — foran contact karein</p>
                </div>
              </div>
              {briefing.dueTomorrow > 0 && (
                <span className="text-[11px] bg-amber-100 text-amber-700 font-black px-2.5 py-1 rounded-full shrink-0">
                  +{briefing.dueTomorrow} kal due
                </span>
              )}
            </div>
            <div className="divide-y divide-slate-50">
              {briefing.urgentAccounts.map((acct) => {
                const wa = `https://wa.me/92${acct.customerPhone.replace(/^0/, '').replace(/\D/g, '')}?text=${encodeURIComponent(
                  `Assalam-o-Alaikum ${acct.customerName}, aapka installment PKR ${acct.monthly.toLocaleString('en-PK')} ka payment ${acct.daysOverdue} din se overdue hai. Meherbani farma ke jald settlement karein. Shukriya.`
                )}`;
                return (
                  <div key={acct.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-8 h-8 bg-rose-50 rounded-full flex items-center justify-center text-xs font-black text-rose-500 shrink-0">
                      {acct.customerName[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{acct.customerName}</p>
                      <p className="text-[11px] text-slate-400">{acct.customerPhone}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-black text-slate-900 tabular-nums">{pkr(acct.monthly)}</p>
                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                        acct.daysOverdue >= 30 ? 'bg-red-100 text-red-700' :
                        acct.daysOverdue >= 7  ? 'bg-amber-100 text-amber-700' :
                                                 'bg-orange-100 text-orange-600'
                      }`}>{acct.daysOverdue} din late</span>
                    </div>
                    <a href={wa} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-black transition shrink-0">
                      <PhoneCall size={11} /> WA
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Promises */}
        {promisesDueCount > 0 && (
          <div className="bg-white ring-1 ring-indigo-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-indigo-50 border-b border-indigo-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <Bell size={15} className="text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-black text-indigo-800">{promisesDueCount} Waday — Follow Karein</p>
                  <p className="text-[11px] text-indigo-400">In logo ne kal payment ka wada kia tha</p>
                </div>
              </div>
              <button onClick={() => navigate('/installments')} className="flex items-center gap-1 text-xs text-indigo-700 font-black hover:underline">
                Sab <ArrowRight size={12} />
              </button>
            </div>
            {promisesLoading ? (
              <div className="p-4 space-y-2">{[0, 1].map((i) => <div key={i} className="h-10 bg-indigo-50 rounded-xl animate-pulse" />)}</div>
            ) : (
              <div className="divide-y divide-slate-50">
                {promises.slice(0, 6).map((p) => {
                  const pd = new Date(p.promiseDate);
                  const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);
                  const isOverdue = pd < todayMidnight;
                  return (
                    <div key={p.id} className="flex items-center justify-between px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{p.customerName}</p>
                        <p className="text-[10px] text-slate-400 truncate">{p.productName}{p.note ? ` · ${p.note}` : ''}</p>
                      </div>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg shrink-0 ml-3 ${
                        isOverdue ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600'
                      }`}>
                        {isOverdue ? 'Overdue' : 'Today'}
                      </span>
                    </div>
                  );
                })}
                {promises.length > 6 && <p className="text-[11px] text-indigo-400 text-center py-2">+{promises.length - 6} more</p>}
              </div>
            )}
          </div>
        )}

        {/* Daily Target */}
        {isOwner && shop?.settings?.dailyTarget && (() => {
          const target = shop.settings!.dailyTarget!;
          const pct    = Math.min(Math.round((todayTotal / target) * 100), 100);
          const over   = todayTotal > target;
          const barCls = over ? 'bg-emerald-500' : pct >= 75 ? 'bg-blue-500' : pct >= 40 ? 'bg-amber-400' : 'bg-slate-300';
          return (
            <div className="bg-white ring-1 ring-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
                    <Target size={17} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900">Roz Ka Target</p>
                    <p className="text-[11px] text-slate-400">Aaj kahan ho target ke mukable</p>
                  </div>
                </div>
                <span className={`text-lg font-black tabular-nums ${over ? 'text-emerald-600' : 'text-blue-600'}`}>
                  {pct}%{over ? ' ✓' : ''}
                </span>
              </div>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-3xl font-black text-slate-900 tabular-nums">{pkr(todayTotal)}</span>
                <span className="text-sm text-slate-400">of {pkr(target)}</span>
              </div>
              <div className="bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${barCls}`} style={{ width: `${pct}%` }} />
              </div>
              <p className={`text-xs font-bold mt-2 ${over ? 'text-emerald-600' : 'text-slate-400'}`}>
                {over ? `+${pkr(todayTotal - target)} target se zyada — Masha'Allah!` : `${pkr(target - todayTotal)} aur chahiye`}
              </p>
            </div>
          );
        })()}

        {/* Completing Soon */}
        {isOwner && data && data.completingSoon.length > 0 && (
          <div className="bg-white ring-1 ring-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-emerald-50 rounded-xl flex items-center justify-center">
                  <CheckCircle size={15} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900">Khatam Hone Wale Plans</p>
                  <p className="text-[11px] text-slate-400">1–3 installment baaki — naya deal ka waqt</p>
                </div>
              </div>
              <span className="text-[11px] font-black bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">
                {data.completingSoon.length} plans
              </span>
            </div>
            <div className="divide-y divide-slate-50">
              {data.completingSoon.map((c) => {
                const pillCls = c.paymentsLeft === 1 ? 'bg-red-100 text-red-700'
                  : c.paymentsLeft === 2 ? 'bg-amber-100 text-amber-700'
                  : 'bg-emerald-100 text-emerald-700';
                const wa = `https://wa.me/92${c.customerPhone.replace(/^0/, '').replace(/\D/g, '')}?text=${encodeURIComponent(
                  `Assalam-o-Alaikum ${c.customerName}! Aapka ${c.productName} ka installment sirf ${c.paymentsLeft} baar aur dena hai (PKR ${c.remaining.toLocaleString('en-PK')} baaki). Jazak'Allah acha record rakhne ke liye! Koi naya product chahiye ho to zaroor batain.`
                )}`;
                return (
                  <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-xs font-bold text-slate-900 truncate">{c.customerName}</p>
                        <span className={`shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded-full ${pillCls}`}>{c.paymentsLeft} baaki</span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">{c.productName}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-black text-slate-900 tabular-nums">{pkr(c.remaining)}</p>
                      <p className="text-[9px] text-slate-400">baaki total</p>
                    </div>
                    <a href={wa} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-black transition shrink-0">
                      <PhoneCall size={11} /> WA
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Low Stock */}
        {lowStock.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center">
                  <Package size={15} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-black text-amber-800">{lowStock.length} cheez kam ho gayi</p>
                  <p className="text-[11px] text-amber-500">Stock check karein aur order karein</p>
                </div>
              </div>
              <button onClick={() => navigate('/products')} className="flex items-center gap-1 text-xs text-amber-700 font-black hover:underline">
                Manage <ArrowRight size={12} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {lowStock.map((p) => (
                <span key={p.id} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-black ${
                  p.stock === 0 ? 'bg-red-100 text-red-700 ring-1 ring-red-200' : 'bg-amber-100 text-amber-700 ring-1 ring-amber-200'
                }`}>
                  {p.name}
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${p.stock === 0 ? 'bg-red-200' : 'bg-amber-200'}`}>
                    {p.stock === 0 ? 'KHATAM' : `${p.stock}/${p.minStock}`}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Birthdays */}
        {birthdays.length > 0 && (
          <div className="bg-pink-50 border border-pink-200 rounded-2xl p-4">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 bg-pink-100 rounded-xl flex items-center justify-center">
                <Gift size={15} className="text-pink-600" />
              </div>
              <div>
                <p className="text-sm font-black text-pink-800">{birthdays.length} customer ka birthday is hafte</p>
                <p className="text-[11px] text-pink-400">WhatsApp bhej ke rishta mazboot karein</p>
              </div>
            </div>
            <div className="space-y-2">
              {birthdays.map((c) => {
                const [, mm, dd] = c.dob.split('-');
                const thisYear = new Date().getFullYear();
                const bday = new Date(`${thisYear}-${mm}-${dd}`);
                const todayD = new Date(); todayD.setHours(0, 0, 0, 0);
                const isToday = bday.toDateString() === todayD.toDateString();
                const phone = c.phone.replace(/^0/, '92');
                const msg = encodeURIComponent(`Assalamu Alaikum ${c.name}! 🎉 Aaj aap ka birthday hai — bohat bohat mubarak ho! Duaon mein yaad rakhna.`);
                return (
                  <div key={c.id} className="flex items-center justify-between bg-white rounded-xl px-3 py-2.5 ring-1 ring-pink-100">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      {c.photoUrl
                        ? <img src={c.photoUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                        : <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center shrink-0 text-pink-600 text-xs font-black">{c.name[0]}</div>
                      }
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{c.name}</p>
                        {c.area && <p className="text-[10px] text-slate-400 truncate">{c.area}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      {isToday && <span className="text-[10px] font-black bg-pink-100 text-pink-700 px-2 py-0.5 rounded-lg">Aaj!</span>}
                      <button
                        onClick={() => window.open(`https://wa.me/${phone}?text=${msg}`, '_blank')}
                        className="text-[11px] font-black text-white bg-green-500 hover:bg-green-600 px-3 py-1.5 rounded-xl transition"
                      >WA</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        </>)}

        {/* ══════════════════════════════════════ IS MAHINE TAB ══════════════════════════════════════ */}
        {activeTab === 'mahine' && (<>

        {/* Monthly Target */}
        {isOwner && data && (() => {
          const target   = data.monthInstTarget;
          const received = data.monthCollections;
          const pct      = Math.min(100, target > 0 ? Math.round((received / target) * 100) : received > 0 ? 100 : 0);
          const gap      = target - received;
          const isAhead  = target > 0 ? received >= target : false;
          const barColor = pct >= 90 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-400' : 'bg-rose-500';
          const now      = new Date();
          const daysInMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
          const dayOfMonth    = now.getDate();
          const timePct       = Math.round((dayOfMonth / daysInMonth) * 100);
          return (
            <div className="bg-white ring-1 ring-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                    <Target size={17} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900">Is Mahine Ki Target</p>
                    <p className="text-[11px] text-slate-400">{now.toLocaleDateString('en-PK', { month: 'long', year: 'numeric' })}</p>
                  </div>
                </div>
                <span className={`text-sm font-black px-3 py-1.5 rounded-xl ${
                  target === 0 ? 'bg-slate-100 text-slate-500'
                  : isAhead ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-amber-100 text-amber-700'
                }`}>{target === 0 ? 'N/A' : `${pct}%`}</span>
              </div>
              {target === 0 ? (
                <p className="text-xs text-slate-400 text-center py-3">Is mahine koi installment due nahi</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-slate-50 rounded-xl px-4 py-3">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1">Expected</p>
                      <p className="text-xl font-black text-slate-800 tabular-nums">{pkrShort(target)}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 tabular-nums">{pkr(target)}</p>
                    </div>
                    <div className={`rounded-xl px-4 py-3 ${isAhead ? 'bg-emerald-50' : 'bg-blue-50'}`}>
                      <p className={`text-[11px] font-bold uppercase tracking-wide mb-1 ${isAhead ? 'text-emerald-500' : 'text-blue-400'}`}>Wapas Aya</p>
                      <p className={`text-xl font-black tabular-nums ${isAhead ? 'text-emerald-700' : 'text-blue-700'}`}>{pkrShort(received)}</p>
                      <p className={`text-[11px] mt-0.5 tabular-nums ${isAhead ? 'text-emerald-400' : 'text-blue-400'}`}>{pkr(received)}</p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`absolute left-0 top-0 h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${pct}%` }} />
                      <div className="absolute top-0 h-full w-0.5 bg-slate-400/50 rounded-full" style={{ left: `${timePct}%` }} title={`${timePct}% mahina guzra`} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-black ${isAhead ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {isAhead ? `+${pkrShort(received - target)} target se zyada` : `${pkrShort(gap)} abhi baaki`}
                      </span>
                      <span className="text-[11px] text-slate-400">{timePct}% mahina guzra</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {/* Monthly P&L */}
        {isOwner && data && (() => {
          const income   = monthTotal;
          const expenses = data.monthExpenseTotal ?? 0;
          const profit   = income - expenses;
          const isProfit = profit >= 0;
          return (
            <div className="bg-white ring-1 ring-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-2.5 px-4 pt-4 pb-3.5 border-b border-slate-50">
                <div className="w-8 h-8 bg-emerald-50 rounded-xl flex items-center justify-center">
                  <BarChart3 size={15} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900">Is Mahine Ka Hisaab</p>
                  <p className="text-[11px] text-slate-400">Income vs Kharcha — net faida/nuqsan</p>
                </div>
              </div>
              <div className="grid grid-cols-3 divide-x divide-slate-100">
                {[
                  { label: 'Income', val: income > 0 ? pkrShort(income) : '—', cls: income > 0 ? 'text-slate-900' : 'text-slate-300', sub: 'inst + cash' },
                  { label: 'Kharcha', val: expenses > 0 ? pkrShort(expenses) : '—', cls: expenses > 0 ? 'text-rose-600' : 'text-slate-300', sub: 'is mahine' },
                  {
                    label: `Net ${isProfit ? 'Faida' : 'Nuqsan'}`,
                    val: income === 0 && expenses === 0 ? '—' : pkrShort(Math.abs(profit)),
                    cls: income === 0 && expenses === 0 ? 'text-slate-300' : isProfit ? 'text-emerald-600' : 'text-rose-600',
                    sub: income === 0 && expenses === 0 ? 'koi data nahi' : isProfit ? 'Alhamdulillah' : 'Dhyan dein',
                  },
                ].map(({ label, val, cls, sub }) => (
                  <div key={label} className="px-4 py-4 text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">{label}</p>
                    <p className={`text-xl font-black tabular-nums ${cls}`}>{val}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>
                  </div>
                ))}
              </div>
              {(income > 0 || expenses > 0) && (
                <div className="px-4 pb-4">
                  <div className="bg-slate-100 rounded-full h-2 overflow-hidden flex">
                    <div className="h-full bg-emerald-400 transition-all duration-700" style={{ width: `${Math.min((income / Math.max(income, expenses, 1)) * 100, 100)}%` }} />
                    <div className="h-full bg-rose-400 transition-all duration-700" style={{ width: `${Math.min((expenses / Math.max(income, expenses, 1)) * 100, 100)}%` }} />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-emerald-500 font-bold">Income</span>
                    <span className="text-[10px] text-rose-400 font-bold">Expenses</span>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* New + Completed */}
        {isOwner && data && (data.newThisMonthCount > 0 || data.completedThisMonthCount > 0) && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white ring-1 ring-indigo-100 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center">
                  <TrendingUp size={17} className="text-indigo-600" />
                </div>
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-wider">Naye</span>
              </div>
              <p className="text-4xl font-black text-slate-900 tabular-nums">{data.newThisMonthCount}</p>
              <p className="text-xs text-slate-400 mt-0.5">plans is mahine</p>
              <p className="text-sm font-black text-indigo-700 mt-2 tabular-nums">{pkr(data.newThisMonthValue)}</p>
              <p className="text-[10px] text-slate-400">total value</p>
            </div>
            <div className="bg-white ring-1 ring-emerald-100 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center">
                  <CheckCircle size={17} className="text-emerald-600" />
                </div>
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">Poore</span>
              </div>
              <p className="text-4xl font-black text-slate-900 tabular-nums">{data.completedThisMonthCount}</p>
              <p className="text-xs text-slate-400 mt-0.5">plans mukammal</p>
              <p className="text-sm font-black text-emerald-700 mt-2 tabular-nums">{pkr(data.completedThisMonthValue)}</p>
              <p className="text-[10px] text-slate-400">wapas aya</p>
            </div>
          </div>
        )}

        </>)}

        {/* ══════════════════════════════════════ PORTFOLIO TAB ══════════════════════════════════════ */}
        {activeTab === 'portfolio' && (<>

        {/* Total Receivables Hero */}
        {isOwner && reports && (() => {
          const outstanding = reports.collectionRate.totalOutstanding;
          const billed      = reports.collectionRate.totalBilled;
          const collected   = reports.collectionRate.totalCollected;
          const pct         = billed > 0 ? Math.round((collected / billed) * 100) : 0;
          return (
            <div className="relative bg-indigo-600 rounded-3xl p-6 text-white overflow-hidden shadow-xl shadow-indigo-900/20">
              <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-white/5 pointer-events-none" />
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                    <Landmark size={17} className="text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest">Total Receivables</p>
                    <p className="text-[11px] text-indigo-300">Sare active plans ka outstanding</p>
                  </div>
                </div>
                <button onClick={() => navigate('/installments')} className="text-[11px] text-indigo-200 hover:text-white font-black flex items-center gap-1">
                  Plans <ArrowRight size={11} />
                </button>
              </div>
              <p className="text-5xl font-black text-white tabular-nums leading-none mt-2">{pkrShort(outstanding)}</p>
              <p className="text-xs text-indigo-300 mt-1.5 tabular-nums">{pkr(outstanding)} — customers ne dena hai</p>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex-1 bg-white/15 rounded-full h-2 overflow-hidden">
                  <div className="h-full bg-white rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs font-black text-indigo-200 shrink-0">{pct}% wapas aya</span>
              </div>
              <div className="flex gap-5 mt-4">
                <div>
                  <p className="text-[10px] text-indigo-300 uppercase tracking-wide">Total Dia</p>
                  <p className="text-sm font-black text-white tabular-nums">{pkrShort(billed)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-indigo-300 uppercase tracking-wide">Wapas Aya</p>
                  <p className="text-sm font-black text-emerald-300 tabular-nums">{pkrShort(collected)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-indigo-300 uppercase tracking-wide">Baaki</p>
                  <p className="text-sm font-black text-amber-300 tabular-nums">{pkrShort(outstanding)}</p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Monthly/Daily split */}
        {data && (data.monthlyActiveCount > 0 || data.dailyActiveCount > 0) && (() => {
          const total = data.monthlyActiveCount + data.dailyActiveCount;
          const mPct  = total > 0 ? Math.round((data.monthlyActiveCount / total) * 100) : 0;
          const dPct  = 100 - mPct;
          return (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white ring-1 ring-blue-100 rounded-2xl p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate('/installments?freq=monthly')}>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
                    <Calendar size={17} className="text-blue-600" />
                  </div>
                  <span className="text-[10px] font-black text-blue-400 uppercase tracking-wider">Monthly</span>
                </div>
                <p className="text-4xl font-black text-slate-900 tabular-nums">{data.monthlyActiveCount}</p>
                <p className="text-xs text-slate-400 mt-0.5">mahana plans</p>
                <p className="text-sm font-black text-blue-700 mt-2 tabular-nums">{pkr(data.monthlyActiveRemaining)}</p>
                <p className="text-[10px] text-slate-400">baaki hai</p>
                <div className="mt-3 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div className="h-full bg-blue-400 rounded-full" style={{ width: `${mPct}%` }} />
                </div>
              </div>
              <div className="bg-white ring-1 ring-violet-100 rounded-2xl p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate('/installments?freq=daily')}>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center">
                    <Clock size={17} className="text-violet-600" />
                  </div>
                  <span className="text-[10px] font-black text-violet-400 uppercase tracking-wider">Daily</span>
                </div>
                <p className="text-4xl font-black text-slate-900 tabular-nums">{data.dailyActiveCount}</p>
                <p className="text-xs text-slate-400 mt-0.5">rozana plans</p>
                <p className="text-sm font-black text-violet-700 mt-2 tabular-nums">{pkr(data.dailyActiveRemaining)}</p>
                <p className="text-[10px] text-slate-400">baaki hai</p>
                <div className="mt-3 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div className="h-full bg-violet-400 rounded-full" style={{ width: `${dPct}%` }} />
                </div>
              </div>
            </div>
          );
        })()}

        {/* Collection Rate + Aging + Sparkline */}
        {reports && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="md:col-span-2 bg-white ring-1 ring-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-black text-slate-900">Collection Rate</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Jitna billing tha, utna kitna wapas aya</p>
                </div>
                <span className={`text-[11px] font-black px-2.5 py-1 rounded-xl shrink-0 ml-2 ${
                  rate >= 80 ? 'bg-emerald-100 text-emerald-700' :
                  rate >= 60 ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-600'
                }`}>{rate >= 80 ? 'Bohot Acha' : rate >= 60 ? 'Theek Hai' : 'Kharaab'}</span>
              </div>
              <p className={`text-5xl font-black tabular-nums ${rateColor}`}>{rate}%</p>
              <div className="mt-3 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${rateBar}`} style={{ width: `${rate}%` }} />
              </div>
              <p className="text-xs text-slate-400 mt-2 tabular-nums">
                {pkr(reports.collectionRate.totalCollected)} mila · {pkr(reports.collectionRate.totalBilled)} total
              </p>
            </div>

            <div className="md:col-span-2 bg-white ring-1 ring-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="mb-4">
                <p className="text-sm font-black text-slate-900">Payments Ka Haal</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Kitne log time pe de rahe hain</p>
              </div>
              <div className="space-y-2.5">
                {[
                  { label: 'Waqt pe',       n: aging?.current    ?? 0, bar: 'bg-emerald-400', text: 'text-emerald-700' },
                  { label: '1–7 din late',  n: aging?.days0_7    ?? 0, bar: 'bg-amber-400',   text: 'text-amber-700'  },
                  { label: '8–30 din late', n: aging?.days8_30   ?? 0, bar: 'bg-orange-400',  text: 'text-orange-700' },
                  { label: '31–90 din',     n: aging?.days31_90  ?? 0, bar: 'bg-rose-500',    text: 'text-rose-700'   },
                  { label: '90+ din late',  n: aging?.days90plus ?? 0, bar: 'bg-red-800',     text: 'text-red-800'    },
                ].map(({ label, n, bar, text }) => {
                  const total = (aging?.current ?? 0) + (aging?.days0_7 ?? 0) + (aging?.days8_30 ?? 0) + (aging?.days31_90 ?? 0) + (aging?.days90plus ?? 0);
                  const pct = total > 0 ? Math.round((n / total) * 100) : 0;
                  return (
                    <div key={label} className="flex items-center gap-2">
                      <div className="w-20 shrink-0">
                        <p className="text-[11px] font-semibold text-slate-700 leading-tight">{label}</p>
                      </div>
                      <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className={`text-xs font-black w-5 text-right shrink-0 tabular-nums ${n > 0 ? text : 'text-slate-300'}`}>{n}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="md:col-span-1 bg-white ring-1 ring-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
              <div>
                <p className="text-sm font-black text-slate-900">6 Mahine</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Collection trend</p>
              </div>
              <div className="flex-1 flex flex-col justify-end gap-2 mt-4">
                {spark6.length > 0 ? <Sparkline data={spark6} /> : (
                  <div className="h-8 flex items-end gap-0.5">
                    {Array.from({ length: 6 }).map((_, i) => <div key={i} className="flex-1 bg-slate-100 rounded-sm h-1" />)}
                  </div>
                )}
              </div>
              {momChange !== null && (
                <p className={`text-xs font-black mt-2 flex items-center gap-1 ${momChange >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {momChange >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {Math.abs(momChange)}% pichle mahine se
                </p>
              )}
            </div>
          </div>
        )}

        </>)}

        {/* ══════════════════════════════════════ REPORTS TAB ══════════════════════════════════════ */}
        {activeTab === 'reports' && isOwner && (<>

        {hasAnalytics && (
          <div className="flex items-center gap-2.5">
            <div className="w-1 h-5 bg-violet-600 rounded-full shrink-0" />
            <p className="text-sm font-black text-slate-900">Tafseeli Report</p>
            <p className="text-[11px] text-slate-400">— gehri nazar, weekly check karein</p>
          </div>
        )}

        {reports && reports.topDebtors.length > 0 && (
          <div className="bg-white ring-1 ring-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-rose-50 rounded-xl flex items-center justify-center">
                  <AlertTriangle size={15} className="text-rose-500" />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900">Sabse Zyada Baaki</p>
                  <p className="text-[11px] text-slate-400">In logo ka sabse zyada amount pending hai</p>
                </div>
              </div>
              <button onClick={() => navigate('/installments')} className="flex items-center gap-1 text-xs text-blue-600 font-black hover:underline">
                View all <ArrowRight size={12} />
              </button>
            </div>
            <div className="divide-y divide-slate-50">
              {reports.topDebtors.slice(0, 6).map((d) => {
                const wa = `https://wa.me/92${d.phone.replace(/^0/, '').replace(/\D/g, '')}?text=${encodeURIComponent(
                  `Assalam-o-Alaikum ${d.name}, aapka installment ka PKR ${d.remaining.toLocaleString('en-PK')} baaki hai. Meherbani farma ke jald settlement karein. Shukriya.`
                )}`;
                const maxRemaining = reports.topDebtors[0]?.remaining ?? 1;
                const pct = Math.round((d.remaining / maxRemaining) * 100);
                return (
                  <div key={d.name + d.phone} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{d.name}</p>
                        <p className="text-[11px] text-slate-400">{d.count} plan{d.count !== 1 ? 's' : ''}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <p className="text-sm font-black text-rose-600 tabular-nums">{pkr(d.remaining)}</p>
                        <a href={wa} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black transition">
                          <PhoneCall size={10} /> WA
                        </a>
                      </div>
                    </div>
                    <div className="bg-slate-100 rounded-full h-1 overflow-hidden">
                      <div className="h-full bg-rose-400 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {reports && reports.topProducts.length > 0 && (
          <div className="bg-white ring-1 ring-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-amber-50 rounded-xl flex items-center justify-center">
                  <Package size={15} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900">Sabse Zyada Bikne Wale</p>
                  <p className="text-[11px] text-slate-400">Installment pe gaye products</p>
                </div>
              </div>
              <button onClick={() => navigate('/products')} className="flex items-center gap-1 text-xs text-blue-600 font-black hover:underline">
                Manage <ArrowRight size={12} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {reports.topProducts.map((p, i) => {
                const maxCount = reports.topProducts[0]?.count ?? 1;
                const pct = Math.round((p.count / maxCount) * 100);
                return (
                  <div key={p.name}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-black text-slate-300 w-4 shrink-0">#{i + 1}</span>
                        <span className="text-sm font-bold text-slate-800 truncate">{p.name}</span>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <span className="text-sm font-black text-slate-900 tabular-nums">{p.count} bikay</span>
                        <span className="text-[11px] text-slate-400 ml-2 tabular-nums">{pkr(p.totalAmount)}</span>
                      </div>
                    </div>
                    <div className="bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {advanced && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white ring-1 ring-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center">
                  <Zap size={15} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900">Aane Wala Paisa</p>
                  <p className="text-[11px] text-slate-400">Agli 30 din mein milne ki umeed</p>
                </div>
              </div>
              <CashflowBar data={advanced.cashflowForecast} />
            </div>

            <div className="bg-white ring-1 ring-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 bg-emerald-50 rounded-xl flex items-center justify-center">
                  <ShieldCheck size={15} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900">Recovery Rate</p>
                  <p className="text-[11px] text-slate-400">Overdue mein se kitna wapas aya</p>
                </div>
              </div>
              {advanced.recovery.overdueCount === 0 ? (
                <p className="text-sm text-emerald-600 font-black py-4 text-center">Koi overdue nahi — Alhamdulillah!</p>
              ) : (
                <>
                  <p className={`text-5xl font-black tabular-nums ${
                    advanced.recovery.efficiency >= 70 ? 'text-emerald-600'
                    : advanced.recovery.efficiency >= 40 ? 'text-amber-600'
                    : 'text-rose-500'
                  }`}>{advanced.recovery.efficiency}%</p>
                  <div className="mt-3 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${
                      advanced.recovery.efficiency >= 70 ? 'bg-emerald-500'
                      : advanced.recovery.efficiency >= 40 ? 'bg-amber-400'
                      : 'bg-rose-500'
                    }`} style={{ width: `${advanced.recovery.efficiency}%` }} />
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-slate-400">
                    <span className="tabular-nums">{pkr(advanced.recovery.totalCollected)} wapas aya</span>
                    <span>{advanced.recovery.overdueCount} accounts</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 tabular-nums">of {pkr(advanced.recovery.totalDue)} overdue tha</p>
                </>
              )}
            </div>

            <div className="bg-white ring-1 ring-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 bg-violet-50 rounded-xl flex items-center justify-center">
                  <Users size={15} className="text-violet-600" />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900">Staff Performance</p>
                  <p className="text-[11px] text-slate-400">Pichle 30 din mein kisne kitna kaam kia</p>
                </div>
              </div>
              {!advanced.staffProductivity.length ? (
                <p className="text-xs text-slate-400 py-4 text-center">Is mahine koi payment record nahi</p>
              ) : (
                <div className="space-y-2.5">
                  {advanced.staffProductivity.map((s) => {
                    const maxCount = advanced.staffProductivity[0]?.count ?? 1;
                    return (
                      <div key={s.userId}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-bold text-slate-700 truncate max-w-[140px]">{s.name}</span>
                          <span className="text-slate-400 shrink-0 ml-2 tabular-nums">{s.count} · {pkr(s.total)}</span>
                        </div>
                        <div className="bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div className="h-full rounded-full bg-violet-400" style={{ width: `${(s.count / maxCount) * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-white ring-1 ring-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 bg-rose-50 rounded-xl flex items-center justify-center">
                  <MapPin size={15} className="text-rose-600" />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900">Area ke Hisab se</p>
                  <p className="text-[11px] text-slate-400">Konse ilaqe mein zyada problem</p>
                </div>
              </div>
              {!advanced.areaHeatmap.length ? (
                <p className="text-xs text-slate-400 py-4 text-center">Koi overdue customers nahi</p>
              ) : (
                <div className="space-y-2.5">
                  {advanced.areaHeatmap.map((a) => {
                    const maxTotal = advanced.areaHeatmap[0] ? advanced.areaHeatmap[0].overdueCount + advanced.areaHeatmap[0].defaultedCount : 1;
                    return (
                      <div key={a.city}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-bold text-slate-700 truncate max-w-[140px]">{a.city}</span>
                          <span className="text-slate-400 shrink-0 ml-2">
                            {a.overdueCount > 0 && <span className="text-amber-600">{a.overdueCount} late</span>}
                            {a.overdueCount > 0 && a.defaultedCount > 0 && <span className="mx-1 text-slate-300">·</span>}
                            {a.defaultedCount > 0 && <span className="text-rose-500">{a.defaultedCount} default</span>}
                          </span>
                        </div>
                        <div className="bg-slate-100 rounded-full h-1.5 overflow-hidden flex">
                          <div className="h-full bg-amber-400" style={{ width: `${(a.overdueCount / maxTotal) * 100}%` }} />
                          <div className="h-full bg-rose-500" style={{ width: `${(a.defaultedCount / maxTotal) * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recent Installments */}
        <div className="bg-white ring-1 ring-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
            <div>
              <h2 className="text-sm font-black text-slate-900">Nayi Installments</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Haal hi mein shuru hue plans</p>
            </div>
            <button onClick={() => navigate('/installments')} className="flex items-center gap-1 text-xs text-blue-600 font-black hover:underline">
              Sab dekho <ArrowRight size={13} />
            </button>
          </div>
          {isLoading ? (
            <RowSkeleton rows={4} />
          ) : !data?.recentInstallments.length ? (
            <div className="p-8 text-center text-sm text-slate-400">
              Koi installment nahi.{' '}
              <button onClick={() => navigate('/installments')} className="text-blue-600 hover:underline font-black">Banao</button>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {data.recentInstallments.map((inst) => (
                <div key={inst.id}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/60 transition cursor-pointer"
                  onClick={() => navigate('/installments')}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{inst.customerName}</p>
                    <p className="text-xs text-slate-400 truncate">{inst.productName}</p>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <div className="text-right">
                      <p className="text-sm font-black text-slate-900 tabular-nums">{pkr(Number(inst.remaining))}</p>
                      <p className="text-[10px] text-slate-400">baaki</p>
                    </div>
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-black ${STATUS_STYLES[inst.status]}`}>
                      {inst.status.charAt(0) + inst.status.slice(1).toLowerCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        </>)}

        {/* ── Cash Handover Modal (staff) ── */}
        {showHandoverModal && !isOwner && (() => {
          const balance = Number(myBalance?.pendingBalance ?? 0);
          const amt     = Number(handoverAmount);
          const diff    = amt - balance;
          return (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-black text-slate-900">Cash Jama Karein</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Owner ko cash hand-off ka record</p>
                  </div>
                  <button onClick={() => setShowHandoverModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition">
                    <X size={18} className="text-slate-500" />
                  </button>
                </div>
                <div className="p-5 space-y-4">
                  <div className="bg-slate-50 ring-1 ring-slate-200 rounded-xl p-3">
                    <p className="text-[11px] text-slate-400 font-medium">System ka hisaab (collected − confirmed)</p>
                    <p className="text-2xl font-black text-slate-900 mt-0.5 tabular-nums">{pkr(balance)}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-600 mb-1.5">Actual Amount (PKR) *</label>
                    <input
                      type="number"
                      value={handoverAmount}
                      onChange={(e) => setHandoverAmount(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-3 text-lg font-black focus:outline-none focus:border-emerald-400 transition tabular-nums"
                      placeholder="0"
                      autoFocus
                    />
                    {handoverAmount && amt !== balance && (
                      <p className={`text-xs mt-1.5 font-black ${diff < 0 ? 'text-rose-500' : 'text-amber-500'}`}>
                        System se {pkr(Math.abs(diff))} {diff < 0 ? 'kam' : 'zyada'}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-600 mb-1.5">Note (optional)</label>
                    <textarea
                      value={handoverNote}
                      onChange={(e) => setHandoverNote(e.target.value)}
                      rows={2}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-emerald-400 transition"
                      placeholder="Koi additional info..."
                    />
                  </div>
                </div>
                <div className="flex gap-2 px-5 pb-5">
                  <button
                    onClick={() => setShowHandoverModal(false)}
                    className="flex-1 py-2.5 text-sm font-black text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition"
                  >Cancel</button>
                  <button
                    disabled={!handoverAmount || amt <= 0 || submitHandover.isPending}
                    onClick={() => submitHandover.mutate()}
                    className="flex-1 py-2.5 text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl transition flex items-center justify-center gap-1.5"
                  >
                    {submitHandover.isPending
                      ? <span className="animate-pulse">Jama ho raha hai...</span>
                      : <><Send size={13} /> Jama Karein</>
                    }
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      </div>

      {receiveTarget && (
        <CashReceiveModal target={receiveTarget} onClose={() => setReceiveTarget(null)} />
      )}

    </div>
  );
}
