import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  TrendingUp, TrendingDown, CreditCard, AlertTriangle,
  Calendar, Package, ArrowRight, BarChart3,
  MapPin, Users, ShieldCheck, Zap, Plus, ShoppingCart, Receipt, Bell, Target, Gift,
  ClipboardList, Clock, PhoneCall, Banknote, XOctagon,
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

// Compact format for scannability: 1,25,000 → 1.25L  |  45,000 → 45K
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
  ACTIVE:    'bg-green-100 text-green-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
  DEFAULTED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
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
  if (!data.length) return <p className="text-xs text-gray-400 py-4 text-center">Agli 30 dinon mein koi payment due nahi</p>;
  const max = Math.max(...data.map((d) => d.expected), 1);
  const total = data.reduce((s, d) => s + d.expected, 0);
  return (
    <div>
      <p className="text-2xl font-extrabold text-gray-900">PKR {pkrShort(total)}</p>
      <p className="text-xs text-gray-400 mb-3">agli 30 dinon mein milne wala</p>
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
      <p className="text-[10px] text-gray-400 mt-1">{data[0]?.date} → {data[data.length - 1]?.date}</p>
    </div>
  );
}

// Labeled section break — visually groups related cards
function SectionDivider({ icon, title, sub }: { icon: React.ReactNode; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500 shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-700 leading-none">{title}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
      <div className="h-px w-16 bg-gray-200 shrink-0" />
    </div>
  );
}

function HeroSkeleton() {
  return (
    <div className="bg-gray-900 rounded-2xl p-5 animate-pulse">
      <div className="grid grid-cols-2 gap-5 mb-4">
        <div>
          <div className="h-3 bg-gray-700 rounded w-16 mb-2" />
          <div className="h-9 bg-gray-700 rounded w-28" />
          <div className="h-3 bg-gray-800 rounded w-20 mt-2" />
        </div>
        <div>
          <div className="h-3 bg-gray-700 rounded w-16 mb-2" />
          <div className="h-9 bg-gray-700 rounded w-28" />
          <div className="h-3 bg-gray-800 rounded w-20 mt-2" />
        </div>
      </div>
      <div className="h-px bg-gray-700 mb-3" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-14 bg-gray-800 rounded-xl" />
        <div className="h-14 bg-gray-800 rounded-xl" />
      </div>
    </div>
  );
}

// ── Cash Receive Modal (owner use: receive cash directly from a staff member) ──

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
            <h2 className="text-base font-semibold text-gray-900">Cash Li</h2>
            <p className="text-xs text-gray-400 mt-0.5">{target.staffName} se receive karo</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>

        {/* System balance reference */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
          <p className="text-[11px] text-blue-400 font-semibold uppercase tracking-wide mb-0.5">System Balance (Cash)</p>
          <p className="text-xl font-black text-blue-700">{pkr(systemBalance)}</p>
        </div>

        {/* Staff's pending handover claim, if any */}
        {target.pendingHandover && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
            <p className="text-[11px] text-amber-500 font-semibold uppercase tracking-wide mb-0.5">Staff ne submit kiya</p>
            <p className="text-xl font-black text-amber-700">{pkr(Number(target.pendingHandover.handedAmount))}</p>
            {target.pendingHandover.note && (
              <p className="text-xs text-gray-400 mt-1 italic">"{target.pendingHandover.note}"</p>
            )}
          </div>
        )}

        {/* Amount input */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">
            Aap ne gina hua amount (PKR) <span className="text-red-500">*</span>
          </label>
          <input
            type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
            min="0"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50 transition"
          />
          {amount && hasDiff && (
            <p className={`text-xs mt-1 font-medium ${diff < 0 ? 'text-red-500' : 'text-amber-600'}`}>
              {diff < 0
                ? `PKR ${Math.abs(diff).toLocaleString()} system se kam — note zaroor likhein`
                : `PKR ${diff.toLocaleString()} system se zyada`}
            </p>
          )}
        </div>

        {/* Note */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">
            Note {hasDiff && <span className="text-amber-500">(farq ki wajah likhein)</span>}
          </label>
          <textarea
            value={note} onChange={(e) => setNote(e.target.value)}
            rows={2} placeholder="e.g. PKR 3000 kal dega, ya ATM se transfer hua"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50 transition resize-none"
          />
        </div>

        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!amount || Number(amount) < 0 || mutation.isPending}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-1.5"
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

      {/* ── Sticky header + tab bar ── */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="px-4 pt-4 pb-0 sm:px-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[11px] text-gray-400">{today}</p>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">
                {greeting()}, {user?.name.split(' ')[0]}
              </h1>
            </div>
            {isOwner && (
              <button
                onClick={() => navigate('/reports')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl text-xs font-semibold transition"
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
                className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-all shrink-0 ${
                  activeTab === t.key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-400 hover:text-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 py-4 sm:px-6 space-y-4">

      {/* ── Quick actions strip ──────────────────────────────────── */}
      {(() => {
        const perms = user?.permissions as Record<string, boolean> | null | undefined;
        const actions = [
          isOwner || perms?.canAddInstallment
            ? { label: 'New Installment', icon: CreditCard,   color: 'text-blue-600',    bg: 'bg-blue-50',    to: '/installments' }
            : null,
          isOwner || perms?.canAddCustomer
            ? { label: 'Add Customer',    icon: Users,        color: 'text-violet-600',  bg: 'bg-violet-50',  to: '/customers' }
            : null,
          isOwner || perms?.canMakeCashSales
            ? { label: 'Cash Sale',       icon: ShoppingCart, color: 'text-emerald-600', bg: 'bg-emerald-50', to: '/cash-sales' }
            : null,
          isOwner || perms?.canRecordExpense
            ? { label: 'Add Expense',     icon: Receipt,      color: 'text-orange-600',  bg: 'bg-orange-50',  to: '/expenses' }
            : null,
          isOwner || perms?.canManageProducts
            ? { label: 'Add Product',     icon: Package,      color: 'text-amber-600',   bg: 'bg-amber-50',   to: '/products' }
            : null,
        ].filter(Boolean) as { label: string; icon: React.ElementType; color: string; bg: string; to: string }[];

        if (!actions.length) return null;
        return (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
            {actions.map((a) => (
              <button
                key={a.to}
                onClick={() => navigate(a.to)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-100 bg-white hover:shadow-sm transition shrink-0 text-left"
              >
                <div className={`w-7 h-7 ${a.bg} rounded-lg flex items-center justify-center shrink-0`}>
                  <a.icon size={14} className={a.color} />
                </div>
                <span className="text-xs font-semibold text-gray-700 whitespace-nowrap">{a.label}</span>
                <Plus size={10} className="text-gray-300 ml-0.5" />
              </button>
            ))}
          </div>
        );
      })()}

      {/* ── Staff: Cash in Hand ──────────────────────────────────── */}
      {!isOwner && (() => {
        if (!myBalance) return null;
        const balance = Number(myBalance.pendingBalance);
        if (balance <= 0) return null;
        if (myBalance.pendingHandover) {
          return (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                <CheckCircle size={18} className="text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-amber-800">Handover Submitted</p>
                <p className="text-xs text-amber-600 mt-0.5">{pkr(balance)} — Owner ki confirmation ka intezaar hai</p>
              </div>
              <span className="shrink-0 text-[10px] font-bold bg-amber-200 text-amber-700 px-2 py-1 rounded-lg tracking-wide">PENDING</span>
            </div>
          );
        }
        return (
          <div className="bg-linear-to-r from-emerald-600 to-emerald-500 rounded-2xl p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                <Wallet size={20} className="text-white" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-emerald-100 uppercase tracking-wide">Cash in Hand</p>
                <p className="text-2xl font-black text-white">{pkr(balance)}</p>
                <p className="text-[11px] text-emerald-100 mt-0.5">Abhi tak jama nahi hua</p>
              </div>
            </div>
            <button
              onClick={() => { setHandoverAmount(String(balance)); setShowHandoverModal(true); }}
              className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 bg-white text-emerald-700 font-bold text-sm rounded-xl hover:bg-emerald-50 transition"
            >
              <Send size={14} /> Jama Karein
            </button>
          </div>
        );
      })()}

      {/* ── HERO: Money Snapshot (owner only) ───────────────────── */}
      {isOwner && (isLoading ? <HeroSkeleton /> : (
        <div className="bg-linear-to-br from-gray-900 to-gray-800 rounded-2xl p-5 text-white shadow-md">
          <div className="grid grid-cols-2 gap-5 mb-4">
            {/* Today */}
            <div>
              <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-widest mb-1">Aaj Aya</p>
              <p className="text-4xl font-black text-white leading-none">
                {pkrShort(todayTotal)}
              </p>
              <p className="text-[10px] text-gray-500 mt-1">{pkr(todayTotal)}</p>
              <div className="flex gap-3 mt-2">
                <span className="text-[10px] text-gray-400">Inst: <span className={`font-medium ${(data?.todayCollections ?? 0) > 0 ? 'text-gray-300' : 'text-gray-600'}`}>{pkrShort(data?.todayCollections ?? 0)}</span></span>
                <span className="text-[10px] text-gray-400">Sale: <span className={`font-medium ${(data?.todayCashSales ?? 0) > 0 ? 'text-gray-300' : 'text-gray-600'}`}>{pkrShort(data?.todayCashSales ?? 0)}</span></span>
              </div>
            </div>
            {/* This Month */}
            <div>
              <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-widest mb-1">Is Mahine</p>
              <p className="text-4xl font-black text-white leading-none">
                {pkrShort(monthTotal)}
              </p>
              <p className="text-[10px] text-gray-500 mt-1">{pkr(monthTotal)}</p>
              <div className="flex gap-3 mt-2">
                <span className="text-[10px] text-gray-400">Inst: <span className={`font-medium ${(data?.monthCollections ?? 0) > 0 ? 'text-gray-300' : 'text-gray-600'}`}>{pkrShort(data?.monthCollections ?? 0)}</span></span>
                <span className="text-[10px] text-gray-400">Sale: <span className={`font-medium ${(data?.monthCashSales ?? 0) > 0 ? 'text-gray-300' : 'text-gray-600'}`}>{pkrShort(data?.monthCashSales ?? 0)}</span></span>
              </div>
              {momChange !== null && (
                <div className="flex items-center gap-1 mt-1.5">
                  {momChange >= 0
                    ? <TrendingUp size={11} className="text-emerald-400" />
                    : <TrendingDown size={11} className="text-red-400" />}
                  <span className={`text-[10px] font-semibold ${momChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {Math.abs(momChange)}% {momChange >= 0 ? 'zyada' : 'kam'} pichle mahine se
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Active + Overdue badges */}
          <div className="flex items-center gap-3 pt-4 border-t border-white/10">
            <div className="flex items-center gap-2 bg-white/8 rounded-xl px-3 py-2 flex-1">
              <CreditCard size={14} className="text-emerald-400 shrink-0" />
              <div>
                <p className="text-lg font-black text-white leading-none">{data?.activeCount ?? 0}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Active Plans</p>
              </div>
            </div>
            <div
              className={`flex items-center gap-2 rounded-xl px-3 py-2 flex-1 cursor-pointer transition ${(data?.overdueCount ?? 0) > 0 ? 'bg-red-500/20 hover:bg-red-500/30' : 'bg-white/8'}`}
              onClick={() => navigate('/installments')}
            >
              <AlertTriangle size={14} className={`shrink-0 ${(data?.overdueCount ?? 0) > 0 ? 'text-red-400' : 'text-gray-600'}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-lg font-black leading-none ${(data?.overdueCount ?? 0) > 0 ? 'text-red-400' : 'text-gray-500'}`}>
                  {data?.overdueCount ?? 0}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">Overdue</p>
              </div>
              {(data?.overdueAmount ?? 0) > 0 && (
                <p className="text-[10px] text-red-400/80 font-bold shrink-0">{pkrShort(data!.overdueAmount)}</p>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* ── Is Mahine tab ─── */}
      {activeTab === 'mahine' && (<>

      {/* ── Owner: This Month's Installment Target vs Received ─── */}
      {isOwner && data && (() => {
        const target   = data.monthInstTarget;
        const received = data.monthCollections;
        const pct      = Math.min(100, target > 0 ? Math.round((received / target) * 100) : received > 0 ? 100 : 0);
        const gap      = target - received;
        const isAhead  = target > 0 ? received >= target : false;
        const barColor = pct >= 90 ? 'bg-emerald-400' : pct >= 60 ? 'bg-amber-400' : 'bg-red-400';
        const now      = new Date();
        const daysInMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const dayOfMonth    = now.getDate();
        const timePct       = Math.round((dayOfMonth / daysInMonth) * 100);
        return (
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                  <Target size={18} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Is Mahine Ki Target</p>
                  <p className="text-[10px] text-gray-400">Installment collection — {now.toLocaleDateString('en-PK', { month: 'long', year: 'numeric' })}</p>
                </div>
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                target === 0 ? 'bg-gray-100 text-gray-500'
                : isAhead ? 'bg-emerald-100 text-emerald-700'
                : 'bg-orange-100 text-orange-700'
              }`}>
                {target === 0 ? 'N/A' : `${pct}%`}
              </span>
            </div>

            {target === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">
                Is mahine koi installment due nahi — ya active plans nahi hain
              </p>
            ) : (
              <>
                {/* Numbers row */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-gray-50 rounded-xl px-4 py-3">
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Expected</p>
                    <p className="text-lg font-black text-gray-800 leading-none">{pkrShort(target)}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{pkr(target)}</p>
                  </div>
                  <div className={`rounded-xl px-4 py-3 ${isAhead ? 'bg-emerald-50' : 'bg-blue-50'}`}>
                    <p className={`text-[10px] font-semibold uppercase tracking-wide mb-0.5 ${isAhead ? 'text-emerald-500' : 'text-blue-400'}`}>Installments Aaye</p>
                    <p className={`text-lg font-black leading-none ${isAhead ? 'text-emerald-700' : 'text-blue-700'}`}>{pkrShort(received)}</p>
                    <p className={`text-[10px] mt-0.5 ${isAhead ? 'text-emerald-400' : 'text-blue-400'}`}>{pkr(received)}</p>
                  </div>
                </div>

                {/* Progress bar — collection vs target */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-gray-400">
                    <span>Collection progress</span>
                    <span className="font-semibold">{pct}% of target</span>
                  </div>
                  <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`absolute left-0 top-0 h-full rounded-full transition-all duration-700 ${barColor}`}
                      style={{ width: `${pct}%` }}
                    />
                    {/* Time elapsed marker */}
                    <div
                      className="absolute top-0 h-full w-px bg-gray-400/60"
                      style={{ left: `${timePct}%` }}
                      title={`Mahine ka ${timePct}% guzar gaya`}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-semibold ${isAhead ? 'text-emerald-600' : 'text-orange-600'}`}>
                      {isAhead
                        ? `+${pkrShort(received - target)} target se zyada`
                        : `${pkrShort(gap)} abhi baaki hai`}
                    </span>
                    <span className="text-[10px] text-gray-400">{timePct}% mahina guzra</span>
                  </div>
                </div>
              </>
            )}
          </div>
        );
      })()}

      </>)}
      {/* ── Portfolio tab: receivables ─── */}
      {activeTab === 'portfolio' && (<>

      {/* ── Owner: Total Outstanding Receivables ────────────────── */}
      {isOwner && reports && (() => {
        const outstanding = reports.collectionRate.totalOutstanding;
        const billed      = reports.collectionRate.totalBilled;
        const collected   = reports.collectionRate.totalCollected;
        const pct         = billed > 0 ? Math.round((collected / billed) * 100) : 0;
        return (
          <div className="bg-linear-to-br from-indigo-600 to-indigo-500 rounded-2xl p-5 text-white shadow-md">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                  <Landmark size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-indigo-200 uppercase tracking-widest">Total Receivables</p>
                  <p className="text-[10px] text-indigo-300">Sare active plans ka outstanding</p>
                </div>
              </div>
              <button onClick={() => navigate('/installments')} className="text-[11px] text-indigo-200 hover:text-white font-medium flex items-center gap-1">
                Plans <ArrowRight size={11} />
              </button>
            </div>
            <p className="text-4xl font-black text-white leading-none">{pkrShort(outstanding)}</p>
            <p className="text-[11px] text-indigo-300 mt-1">{pkr(outstanding)} — customers ne dena hai</p>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex-1 bg-white/15 rounded-full h-2 overflow-hidden">
                <div className="h-full bg-white rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs font-bold text-indigo-200 shrink-0">{pct}% wapas aya</span>
            </div>
            <div className="flex gap-4 mt-3">
              <div>
                <p className="text-[10px] text-indigo-300">Total Dia</p>
                <p className="text-xs font-bold text-white">{pkrShort(billed)}</p>
              </div>
              <div>
                <p className="text-[10px] text-indigo-300">Wapas Aya</p>
                <p className="text-xs font-bold text-emerald-300">{pkrShort(collected)}</p>
              </div>
              <div>
                <p className="text-[10px] text-indigo-300">Baaki</p>
                <p className="text-xs font-bold text-amber-300">{pkrShort(outstanding)}</p>
              </div>
            </div>
          </div>
        );
      })()}

      </>)}
      {/* ── Is Mahine tab: P&L ─── */}
      {activeTab === 'mahine' && (<>

      {/* ── Owner: Monthly P&L ──────────────────────────────────── */}
      {isOwner && data && (() => {
        const income   = monthTotal;
        const expenses = data.monthExpenseTotal ?? 0;
        const profit   = income - expenses;
        const isProfit = profit >= 0;
        return (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-3 border-b border-gray-50">
              <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center">
                <BarChart3 size={14} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-700">Is Mahine Ka Hisaab</p>
                <p className="text-[10px] text-gray-400">Income vs Kharcha — net faida/nuqsan</p>
              </div>
            </div>
            <div className="grid grid-cols-3 divide-x divide-gray-100">
              <div className="px-4 py-3 text-center">
                <p className="text-[10px] text-gray-400 mb-0.5">Income</p>
                <p className={`text-base font-black ${income > 0 ? 'text-gray-900' : 'text-gray-400'}`}>{income > 0 ? pkrShort(income) : '—'}</p>
                <p className="text-[9px] text-gray-400">inst + cash sale</p>
              </div>
              <div className="px-4 py-3 text-center">
                <p className="text-[10px] text-gray-400 mb-0.5">Kharcha</p>
                <p className={`text-base font-black ${expenses > 0 ? 'text-red-600' : 'text-gray-400'}`}>{expenses > 0 ? pkrShort(expenses) : '—'}</p>
                <p className="text-[9px] text-gray-400">is mahine expenses</p>
              </div>
              <div className="px-4 py-3 text-center">
                <p className="text-[10px] text-gray-400 mb-0.5">Net {isProfit ? 'Faida' : 'Nuqsan'}</p>
                <p className={`text-base font-black ${income === 0 && expenses === 0 ? 'text-gray-400' : isProfit ? 'text-emerald-600' : 'text-red-500'}`}>
                  {income === 0 && expenses === 0 ? '—' : pkrShort(Math.abs(profit))}
                </p>
                <p className={`text-[9px] ${income === 0 && expenses === 0 ? 'text-gray-300' : isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                  {income === 0 && expenses === 0 ? 'Koi data nahi' : isProfit ? 'Alhamdulillah' : 'Dhyan dein'}
                </p>
              </div>
            </div>
            {(income > 0 || expenses > 0) && (
              <div className="px-4 pb-3">
                <div className="bg-gray-100 rounded-full h-1.5 overflow-hidden flex">
                  <div className="h-full bg-emerald-400 rounded-l-full" style={{ width: `${Math.min((income / Math.max(income, expenses, 1)) * 100, 100)}%` }} />
                  <div className="h-full bg-red-400" style={{ width: `${Math.min((expenses / Math.max(income, expenses, 1)) * 100, 100)}%` }} />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[9px] text-emerald-500 font-medium">Income</span>
                  <span className="text-[9px] text-red-400 font-medium">Expenses</span>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      </>)}

      {/* ── Owner: Cash in Field ─────────────────────────────────── */}
      {isOwner && (() => {
        const staffWithCash = pendingBalances.filter((s) => Number(s.pendingBalance) > 0);
        if (!staffWithCash.length) return null;
        const totalCash = staffWithCash.reduce((sum, s) => sum + Number(s.pendingBalance), 0);
        return (
          <div className="bg-white border border-orange-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-3 pb-2.5 border-b border-orange-50 bg-orange-50/50">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Wallet size={13} className="text-orange-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-orange-700">Cash in Field</p>
                  <p className="text-[10px] text-orange-400">Employees k paas — abhi shop nahi aya</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-black text-orange-700">{pkr(totalCash)}</span>
                <button onClick={() => navigate('/staff')} className="flex items-center gap-1 text-xs text-orange-600 hover:underline font-medium">
                  Review <ArrowRight size={12} />
                </button>
              </div>
            </div>
            <div className="divide-y divide-gray-50">
              {staffWithCash.map((s) => (
                <div key={s.staffId} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center text-[11px] font-bold text-gray-500 shrink-0">
                    {s.staffName[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800">{s.staffName}</p>
                    {s.pendingHandover
                      ? <p className="text-[10px] text-amber-600 font-medium">Handover submit kia — confirm karein</p>
                      : <p className="text-[10px] text-gray-400">Field mein — abhi jama nahi kia</p>
                    }
                  </div>
                  <p className="text-sm font-bold text-gray-900 shrink-0">{pkr(Number(s.pendingBalance))}</p>
                  <button
                    onClick={() => setReceiveTarget(s)}
                    className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-xl transition ${
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

      {/* ═══════ AAJ TAB ═══════ */}
      {activeTab === 'aaj' && (<>
      <SectionDivider icon={<ClipboardList size={14} />} title="Aaj Ka Kaam" sub="Ye cheezein aaj handle karni hain" />

      {/* Daily Briefing — urgency hierarchy: 2 big + 3 small */}
      {briefing && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          {/* Top row: Due Today + Overdue (most actionable) */}
          <div className="grid grid-cols-2 divide-x divide-gray-100 border-b border-gray-100">
            {/* Aaj Due — clickable to expand names */}
            <button
              className="flex items-center gap-3 p-4 text-left hover:bg-blue-50/50 transition w-full"
              onClick={() => briefing.dueToday > 0 && setShowDueToday((v) => !v)}
            >
              <div className={`w-11 h-11 ${briefing.dueToday > 0 ? 'bg-blue-50' : 'bg-gray-50'} rounded-xl flex items-center justify-center shrink-0`}>
                <Clock size={22} className={briefing.dueToday > 0 ? 'text-blue-600' : 'text-gray-400'} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-3xl font-black leading-none ${briefing.dueToday > 0 ? 'text-blue-700' : 'text-gray-400'}`}>{briefing.dueToday}</p>
                <p className="text-xs font-bold text-gray-700 mt-1">Aaj Due Hain</p>
                <p className="text-[10px] text-blue-400">{briefing.dueToday > 0 ? (showDueToday ? 'Chhupao ▲' : 'Naam dekho ▼') : 'Koi due nahi — acha!'}</p>
              </div>
            </button>
            {/* Late */}
            <div className="flex items-center gap-3 p-4">
              <div className={`w-11 h-11 ${briefing.overdueTotal > 0 ? 'bg-red-50' : 'bg-gray-50'} rounded-xl flex items-center justify-center shrink-0`}>
                <AlertTriangle size={22} className={briefing.overdueTotal > 0 ? 'text-red-500' : 'text-gray-400'} />
              </div>
              <div>
                <p className={`text-3xl font-black leading-none ${briefing.overdueTotal > 0 ? 'text-red-600' : 'text-gray-400'}`}>{briefing.overdueTotal}</p>
                <p className="text-xs font-bold text-gray-700 mt-1">Late Hain</p>
                <p className="text-[10px] text-gray-400">{briefing.overdueTotal > 0 ? 'Call karo — foran' : 'Sab time pe — Alhamdulillah'}</p>
              </div>
            </div>
          </div>
          {/* Bottom row: Promises + Collected + Defaulted (secondary info) */}
          <div className="grid grid-cols-3 divide-x divide-gray-100">
            {[
              {
                label: 'Waday',
                sub: 'Aaj follow karein',
                value: briefing.promisesToday,
                icon: PhoneCall,
                bg: briefing.promisesToday > 0 ? 'bg-amber-50' : 'bg-gray-50',
                col: briefing.promisesToday > 0 ? 'text-amber-600' : 'text-gray-400',
                valCls: briefing.promisesToday > 0 ? 'text-amber-700' : 'text-gray-300',
              },
              {
                label: 'Aaj Mila',
                sub: 'Cash + installments',
                value: `${pkrShort(todayTotal)}`,
                icon: Banknote,
                bg: 'bg-emerald-50',
                col: 'text-emerald-600',
                valCls: 'text-emerald-700',
              },
              {
                label: 'Default',
                sub: 'Serious mamla',
                value: briefing.defaultedCount,
                icon: XOctagon,
                bg: briefing.defaultedCount > 0 ? 'bg-red-50' : 'bg-gray-50',
                col: briefing.defaultedCount > 0 ? 'text-red-500' : 'text-gray-400',
                valCls: briefing.defaultedCount > 0 ? 'text-red-600' : 'text-gray-300',
              },
            ].map(({ label, sub, value, icon: Icon, bg, col, valCls }) => (
              <div key={label} className="flex flex-col items-center gap-1 py-3 px-2 text-center">
                <div className={`w-7 h-7 ${bg} rounded-lg flex items-center justify-center`}>
                  <Icon size={13} className={col} />
                </div>
                <p className={`text-lg font-extrabold leading-none ${valCls}`}>{value}</p>
                <p className="text-[11px] font-semibold text-gray-600">{label}</p>
                <p className="text-[9px] text-gray-400 leading-tight">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Aaj Due — expanded list */}
      {briefing && showDueToday && briefing.dueTodayAccounts.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-3 pb-2.5 border-b border-blue-100">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center">
                <Clock size={13} className="text-blue-600" />
              </div>
              <p className="text-xs font-bold text-blue-700">Aaj due hain — {briefing.dueTodayAccounts.length} log</p>
            </div>
            <button onClick={() => setShowDueToday(false)} className="text-blue-400 hover:text-blue-600">
              <X size={14} />
            </button>
          </div>
          <div className="divide-y divide-blue-100">
            {briefing.dueTodayAccounts.map((acct) => {
              const wa = `https://wa.me/92${acct.customerPhone.replace(/^0/, '').replace(/\D/g, '')}?text=${encodeURIComponent(
                `Assalam-o-Alaikum ${acct.customerName}, aapka aaj ka installment PKR ${acct.monthly.toLocaleString('en-PK')} due hai. Meherbani farma ke payment karein. Shukriya.`
              )}`;
              return (
                <div key={acct.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center text-[11px] font-bold text-blue-600 shrink-0">
                    {acct.customerName[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900 truncate">{acct.customerName}</p>
                    <p className="text-[10px] text-gray-400">{acct.customerPhone}</p>
                  </div>
                  <p className="text-sm font-bold text-blue-700 shrink-0">{pkr(acct.monthly)}</p>
                  <a href={wa} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-semibold transition shrink-0">
                    <PhoneCall size={11} /> WA
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Focus Today — overdue accounts to call */}
      {briefing && briefing.urgentAccounts.length > 0 && (
        <div className="bg-white border border-red-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-3 pb-2.5 border-b border-red-50 bg-red-50/40">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-red-100 rounded-lg flex items-center justify-center">
                <PhoneCall size={14} className="text-red-500" />
              </div>
              <div>
                <p className="text-xs font-bold text-red-700">Inhe Call Karein</p>
                <p className="text-[10px] text-red-400">Sabse zyada late installments — foran contact karein</p>
              </div>
            </div>
            {briefing.dueTomorrow > 0 && (
              <span className="text-[10px] bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full shrink-0">
                +{briefing.dueTomorrow} kal due
              </span>
            )}
          </div>
          <div className="divide-y divide-gray-50">
            {briefing.urgentAccounts.map((acct) => {
              const wa = `https://wa.me/92${acct.customerPhone.replace(/^0/, '').replace(/\D/g, '')}?text=${encodeURIComponent(
                `Assalam-o-Alaikum ${acct.customerName}, aapka installment PKR ${acct.monthly.toLocaleString('en-PK')} ka payment ${acct.daysOverdue} din se overdue hai. Meherbani farma ke jald settlement karein. Shukriya.`
              )}`;
              return (
                <div key={acct.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{acct.customerName}</p>
                    <p className="text-[11px] text-gray-400">{acct.customerPhone}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-gray-900">{pkr(acct.monthly)}</p>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      acct.daysOverdue >= 30 ? 'bg-red-100 text-red-700' :
                      acct.daysOverdue >= 7  ? 'bg-amber-100 text-amber-700' :
                                               'bg-orange-100 text-orange-600'
                    }`}>
                      {acct.daysOverdue} din late
                    </span>
                  </div>
                  <a href={wa} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-semibold transition shrink-0">
                    <PhoneCall size={11} /> WhatsApp
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Promises due for follow-up */}
      {promisesDueCount > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-indigo-600" />
              <div>
                <p className="text-sm font-bold text-indigo-700">
                  {promisesDueCount} Waday — Aaj Follow Karein
                </p>
                <p className="text-[10px] text-indigo-400">In logo ne kal payment ka wada kia tha</p>
              </div>
            </div>
            <button onClick={() => navigate('/installments')} className="flex items-center gap-1 text-xs text-indigo-700 hover:underline font-medium">
              View all <ArrowRight size={12} />
            </button>
          </div>
          {promisesLoading ? (
            <div className="space-y-2">{[0, 1].map((i) => <div key={i} className="h-10 bg-indigo-100 rounded-xl animate-pulse" />)}</div>
          ) : (
            <div className="space-y-1.5">
              {promises.slice(0, 6).map((p) => {
                const pd = new Date(p.promiseDate);
                const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);
                const isOverdue = pd < todayMidnight;
                return (
                  <div key={p.id} className="flex items-center justify-between bg-white rounded-xl px-3 py-2.5 border border-indigo-100">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">{p.customerName}</p>
                      <p className="text-[10px] text-gray-400 truncate">{p.productName}{p.note ? ` · ${p.note}` : ''}</p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${isOverdue ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600'}`}>
                        {isOverdue ? 'Overdue' : 'Today'}
                      </span>
                      <p className="text-[10px] text-gray-400 mt-0.5">{fmtDate(pd)}</p>
                    </div>
                  </div>
                );
              })}
              {promises.length > 6 && <p className="text-[10px] text-indigo-400 text-center pt-1">+{promises.length - 6} more</p>}
            </div>
          )}
        </div>
      )}

      {/* Daily target progress */}
      {isOwner && shop?.settings?.dailyTarget && (() => {
        const target = shop.settings!.dailyTarget!;
        const pct    = Math.min(Math.round((todayTotal / target) * 100), 100);
        const over   = todayTotal > target;
        const barCls = over ? 'bg-emerald-500' : pct >= 75 ? 'bg-blue-500' : pct >= 40 ? 'bg-amber-400' : 'bg-gray-300';
        const txtCls = over ? 'text-emerald-600' : 'text-blue-600';
        return (
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Target size={14} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-700">Roz Ka Target</p>
                  <p className="text-[10px] text-gray-400">Aaj kahan ho target ke mukable</p>
                </div>
              </div>
              <span className={`text-sm font-black ${txtCls}`}>{pct}%{over ? ' ✓' : ''}</span>
            </div>
            <div className="flex items-baseline gap-1.5 mb-2">
              <span className="text-2xl font-extrabold text-gray-900">{pkr(todayTotal)}</span>
              <span className="text-xs text-gray-400">of {pkr(target)}</span>
            </div>
            <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${barCls}`} style={{ width: `${pct}%` }} />
            </div>
            {over
              ? <p className="text-[10px] text-emerald-600 font-semibold mt-1.5">+{pkr(todayTotal - target)} target se zyada — Masha'Allah!</p>
              : <p className="text-[10px] text-gray-400 mt-1.5">{pkr(target - todayTotal)} aur chahiye target tak</p>
            }
          </div>
        );
      })()}

      </>)}
      {/* ═══════ PORTFOLIO TAB ═══════ */}
      {activeTab === 'portfolio' && (<>
      <SectionDivider icon={<BarChart3 size={14} />} title="Portfolio Ki Sehat" sub="Sare plans aur collections ka overview" />

      {/* Monthly vs Daily split */}
      {data && (data.monthlyActiveCount > 0 || data.dailyActiveCount > 0) && (() => {
        const total = data.monthlyActiveCount + data.dailyActiveCount;
        const mPct  = total > 0 ? Math.round((data.monthlyActiveCount / total) * 100) : 0;
        const dPct  = 100 - mPct;
        return (
          <div className="grid grid-cols-2 gap-4">
            <div
              className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate('/installments?freq=monthly')}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center">
                  <Calendar size={16} className="text-blue-600" />
                </div>
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wide">Monthly</span>
              </div>
              <p className="text-3xl font-black text-gray-900">{data.monthlyActiveCount}</p>
              <p className="text-xs text-gray-400 mt-0.5">mahana plans</p>
              <p className="text-xs font-bold text-blue-700 mt-2">{pkr(data.monthlyActiveRemaining)}</p>
              <p className="text-[10px] text-gray-400">baaki hai</p>
              <div className="mt-3 bg-gray-100 rounded-full h-1 overflow-hidden">
                <div className="h-full bg-blue-400 rounded-full" style={{ width: `${mPct}%` }} />
              </div>
              <p className="text-[10px] text-gray-400 mt-1">{mPct}% of all active</p>
            </div>

            <div
              className="bg-white rounded-2xl border border-violet-100 p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate('/installments?freq=daily')}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 bg-violet-50 rounded-xl flex items-center justify-center">
                  <Clock size={16} className="text-violet-600" />
                </div>
                <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wide">Daily</span>
              </div>
              <p className="text-3xl font-black text-gray-900">{data.dailyActiveCount}</p>
              <p className="text-xs text-gray-400 mt-0.5">rozana plans</p>
              <p className="text-xs font-bold text-violet-700 mt-2">{pkr(data.dailyActiveRemaining)}</p>
              <p className="text-[10px] text-gray-400">baaki hai</p>
              <div className="mt-3 bg-gray-100 rounded-full h-1 overflow-hidden">
                <div className="h-full bg-violet-400 rounded-full" style={{ width: `${dPct}%` }} />
              </div>
              <p className="text-[10px] text-gray-400 mt-1">{dPct}% of all active</p>
            </div>
          </div>
        );
      })()}

      {/* Collection Rate + Aging + Sparkline */}
      {reports && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">

          {/* Collection Rate — with plain-language status */}
          <div className="md:col-span-2 bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-start justify-between mb-1">
              <div>
                <p className="text-xs font-bold text-gray-600">Collection Rate</p>
                <p className="text-[10px] text-gray-400">Jitna billing tha, utna kitna wapas aya</p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-1 rounded-lg shrink-0 ml-2 ${
                rate >= 80 ? 'bg-emerald-100 text-emerald-700' :
                rate >= 60 ? 'bg-amber-100 text-amber-700' :
                'bg-red-100 text-red-600'
              }`}>
                {rate >= 80 ? '👍 Bohot Acha' : rate >= 60 ? '⚠️ Theek Hai' : '❌ Kharaab'}
              </span>
            </div>
            <p className={`text-5xl font-extrabold mt-3 ${rateColor}`}>{rate}%</p>
            <div className="mt-3 bg-gray-100 rounded-full h-2 overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${rateBar}`} style={{ width: `${rate}%` }} />
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {pkr(reports.collectionRate.totalCollected)} mila · {pkr(reports.collectionRate.totalBilled)} total
            </p>
          </div>

          {/* Payments Ka Haal (Aging DPD) */}
          <div className="md:col-span-2 bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="mb-3">
              <p className="text-xs font-bold text-gray-600">Payments Ka Haal</p>
              <p className="text-[10px] text-gray-400">Kitne log time pe de rahe hain</p>
            </div>
            <div className="space-y-2.5">
              {[
                { label: 'Waqt pe', sub: 'On schedule', n: aging?.current ?? 0, dot: 'bg-emerald-500', text: 'text-emerald-700', bar: 'bg-emerald-400' },
                { label: '1–7 din late', sub: 'Yaad dilao', n: aging?.days0_7 ?? 0, dot: 'bg-amber-400', text: 'text-amber-700', bar: 'bg-amber-400' },
                { label: '8–30 din late', sub: 'Call karein', n: aging?.days8_30 ?? 0, dot: 'bg-orange-500', text: 'text-orange-700', bar: 'bg-orange-400' },
                { label: '31–90 din late', sub: 'Serious', n: aging?.days31_90 ?? 0, dot: 'bg-red-500', text: 'text-red-700', bar: 'bg-red-500' },
                { label: '90+ din late', sub: 'Recovery mein', n: aging?.days90plus ?? 0, dot: 'bg-red-800', text: 'text-red-800', bar: 'bg-red-800' },
              ].map(({ label, sub, n, dot, text, bar }) => {
                const total = (aging?.current ?? 0) + (aging?.days0_7 ?? 0) + (aging?.days8_30 ?? 0) + (aging?.days31_90 ?? 0) + (aging?.days90plus ?? 0);
                const pct = total > 0 ? Math.round((n / total) * 100) : 0;
                return (
                  <div key={label} className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                    <div className="w-24 shrink-0">
                      <p className="text-[11px] font-semibold text-gray-700 leading-none">{label}</p>
                      <p className="text-[9px] text-gray-400">{sub}</p>
                    </div>
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className={`text-xs font-bold w-5 text-right shrink-0 ${n > 0 ? text : 'text-gray-300'}`}>{n}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 6-Month Trend */}
          <div className="md:col-span-1 bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <p className="text-xs font-bold text-gray-600">6 Mahine</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Collection trend</p>
            </div>
            <div className="flex-1 flex flex-col justify-end gap-2 mt-3">
              {spark6.length > 0 ? <Sparkline data={spark6} /> : (
                <div className="h-8 flex items-end gap-0.5">
                  {Array.from({ length: 6 }).map((_, i) => <div key={i} className="flex-1 bg-gray-100 rounded-sm h-1" />)}
                </div>
              )}
            </div>
            {momChange !== null && (
              <p className={`text-xs font-semibold mt-2 flex items-center gap-0.5 ${momChange >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {momChange >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {Math.abs(momChange)}% pichle mahine se
              </p>
            )}
          </div>
        </div>
      )}

      </>)}
      {/* ═══════ IS MAHINE TAB: new/completed ═══════ */}
      {activeTab === 'mahine' && isOwner && data && (data.newThisMonthCount > 0 || data.completedThisMonthCount > 0) && (
        <SectionDivider icon={<Calendar size={14} />} title="Is Mahine Ka Haal" sub="Naye plans aur poore hue accounts" />
      )}

      {/* New Business + Completed */}
      {activeTab === 'mahine' && isOwner && data && (data.newThisMonthCount > 0 || data.completedThisMonthCount > 0) && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white border border-indigo-100 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center">
                <TrendingUp size={16} className="text-indigo-600" />
              </div>
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wide">Naye Plans</span>
            </div>
            <p className="text-3xl font-black text-gray-900">{data.newThisMonthCount}</p>
            <p className="text-xs text-gray-400 mt-0.5">is mahine shuru hue</p>
            <p className="text-xs font-bold text-indigo-700 mt-2">{pkr(data.newThisMonthValue)}</p>
            <p className="text-[10px] text-gray-400">total value</p>
          </div>

          <div className="bg-white border border-emerald-100 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 bg-emerald-50 rounded-xl flex items-center justify-center">
                <CheckCircle size={16} className="text-emerald-600" />
              </div>
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide">Poore Hue</span>
            </div>
            <p className="text-3xl font-black text-gray-900">{data.completedThisMonthCount}</p>
            <p className="text-xs text-gray-400 mt-0.5">plans mukammal hue</p>
            <p className="text-xs font-bold text-emerald-700 mt-2">{pkr(data.completedThisMonthValue)}</p>
            <p className="text-[10px] text-gray-400">total wapas aya</p>
          </div>
        </div>
      )}

      {/* ── Completing Soon ──────────────────────────────────────── */}
      {activeTab === 'aaj' && isOwner && data && data.completingSoon.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-3 pb-2.5 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-emerald-50 rounded-lg flex items-center justify-center">
                <CheckCircle size={13} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-700">Khatam Hone Wale Plans</p>
                <p className="text-[10px] text-gray-400">1–3 installment baaki — naya deal ka waqt</p>
              </div>
            </div>
            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
              {data.completingSoon.length} plans
            </span>
          </div>
          <div className="divide-y divide-gray-50">
            {data.completingSoon.map((c) => {
              const pillCls = c.paymentsLeft === 1
                ? 'bg-red-100 text-red-700'
                : c.paymentsLeft === 2
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-emerald-100 text-emerald-700';
              const wa = `https://wa.me/92${c.customerPhone.replace(/^0/, '').replace(/\D/g, '')}?text=${encodeURIComponent(
                `Assalam-o-Alaikum ${c.customerName}! Aapka ${c.productName} ka installment sirf ${c.paymentsLeft} baar aur dena hai (PKR ${c.remaining.toLocaleString('en-PK')} baaki). Jazak'Allah acha record rakhne ke liye! Koi naya product chahiye ho to zaroor batain.`
              )}`;
              return (
                <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-xs font-semibold text-gray-900 truncate">{c.customerName}</p>
                      <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${pillCls}`}>
                        {c.paymentsLeft} baaki
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 truncate">{c.productName}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-gray-900">{pkr(c.remaining)}</p>
                    <p className="text-[9px] text-gray-400">baaki total</p>
                  </div>
                  <a href={wa} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-semibold transition shrink-0">
                    <PhoneCall size={11} /> WA
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Alerts ──────────────────────────────────────────────── */}

      {/* Low stock */}
      {activeTab === 'aaj' && lowStock.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Package size={16} className="text-amber-600" />
              <div>
                <p className="text-sm font-bold text-amber-700">{lowStock.length} cheez kam ho gayi</p>
                <p className="text-[10px] text-amber-500">Stock check karein aur order karein</p>
              </div>
            </div>
            <button onClick={() => navigate('/products')} className="flex items-center gap-1 text-xs text-amber-700 hover:underline font-medium">
              Manage <ArrowRight size={12} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStock.map((p) => (
              <span
                key={p.id}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                  p.stock === 0 ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-amber-100 text-amber-700 border border-amber-200'
                }`}
              >
                {p.name}
                <span className={`px-1 py-0.5 rounded text-[10px] font-bold ${p.stock === 0 ? 'bg-red-200' : 'bg-amber-200'}`}>
                  {p.stock === 0 ? 'KHATAM' : `${p.stock}/${p.minStock}`}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Birthdays */}
      {activeTab === 'aaj' && birthdays.length > 0 && (
        <div className="bg-pink-50 border border-pink-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Gift size={16} className="text-pink-600" />
              <div>
                <p className="text-sm font-bold text-pink-700">{birthdays.length} customer ka birthday is hafte</p>
                <p className="text-[10px] text-pink-400">WhatsApp bhej ke rishta mazboot karein</p>
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            {birthdays.map((c) => {
              const [, mm, dd] = c.dob.split('-');
              const thisYear = new Date().getFullYear();
              const bday = new Date(`${thisYear}-${mm}-${dd}`);
              const todayD = new Date(); todayD.setHours(0, 0, 0, 0);
              const isToday = bday.toDateString() === todayD.toDateString();
              const phone = c.phone.replace(/^0/, '92');
              const msg = encodeURIComponent(`Assalamu Alaikum ${c.name}! 🎉 Aaj aap ka birthday hai — bohat bohat mubarak ho! Duaon mein yaad rakhna.`);
              return (
                <div key={c.id} className="flex items-center justify-between bg-white rounded-xl px-3 py-2.5 border border-pink-100">
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    {c.photoUrl
                      ? <img src={c.photoUrl} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                      : <div className="w-7 h-7 rounded-full bg-pink-100 flex items-center justify-center shrink-0 text-pink-600 text-xs font-bold">{c.name[0]}</div>
                    }
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">{c.name}</p>
                      {c.area && <p className="text-[10px] text-gray-400 truncate">{c.area}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {isToday && <span className="text-[10px] font-bold bg-pink-100 text-pink-600 px-1.5 py-0.5 rounded-md">Aaj!</span>}
                    <button
                      onClick={() => window.open(`https://wa.me/${phone}?text=${msg}`, '_blank')}
                      className="text-[11px] font-medium text-white bg-green-500 hover:bg-green-600 px-2.5 py-1 rounded-lg transition"
                    >
                      WhatsApp
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════ REPORTS TAB ═══════ */}
      {activeTab === 'reports' && isOwner && hasAnalytics && (
        <SectionDivider icon={<BarChart3 size={14} />} title="Tafseeli Report" sub="Gehri nazar — weekly check karein" />
      )}

      {/* Top Debtors */}
      {activeTab === 'reports' && isOwner && reports && reports.topDebtors.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-3 pb-2.5 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-red-50 rounded-lg flex items-center justify-center">
                <AlertTriangle size={13} className="text-red-500" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-700">Sabse Zyada Baaki</p>
                <p className="text-[10px] text-gray-400">In logo ka sabse zyada amount pending hai</p>
              </div>
            </div>
            <button onClick={() => navigate('/installments')} className="flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium">
              View all <ArrowRight size={12} />
            </button>
          </div>
          <div className="divide-y divide-gray-50">
            {reports.topDebtors.slice(0, 6).map((d) => {
              const wa = `https://wa.me/92${d.phone.replace(/^0/, '').replace(/\D/g, '')}?text=${encodeURIComponent(
                `Assalam-o-Alaikum ${d.name}, aapka installment ka PKR ${d.remaining.toLocaleString('en-PK')} baaki hai. Meherbani farma ke jald settlement karein. Shukriya.`
              )}`;
              const maxRemaining = reports.topDebtors[0]?.remaining ?? 1;
              const pct = Math.round((d.remaining / maxRemaining) * 100);
              return (
                <div key={d.name + d.phone} className="px-4 py-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">{d.name}</p>
                      <p className="text-[10px] text-gray-400">{d.count} plan{d.count !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <p className="text-sm font-bold text-red-600">{pkr(d.remaining)}</p>
                      <a href={wa} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-semibold transition">
                        <PhoneCall size={10} /> WA
                      </a>
                    </div>
                  </div>
                  <div className="bg-gray-100 rounded-full h-1 overflow-hidden">
                    <div className="h-full bg-red-400 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top Products */}
      {activeTab === 'reports' && isOwner && reports && reports.topProducts.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-3 pb-2.5 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-amber-50 rounded-lg flex items-center justify-center">
                <Package size={13} className="text-amber-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-700">Sabse Zyada Bikne Wale</p>
                <p className="text-[10px] text-gray-400">Ye products sabse zyada installment pe gaye</p>
              </div>
            </div>
            <button onClick={() => navigate('/products')} className="flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium">
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
                      <span className="text-[10px] font-bold text-gray-300 w-4 shrink-0">#{i + 1}</span>
                      <span className="text-xs font-semibold text-gray-800 truncate">{p.name}</span>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <span className="text-xs font-bold text-gray-900">{p.count} bikay</span>
                      <span className="text-[10px] text-gray-400 ml-2">{pkr(p.totalAmount)}</span>
                    </div>
                  </div>
                  <div className="bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Advanced analytics widgets */}
      {activeTab === 'reports' && advanced && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Cashflow Forecast */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
                <Zap size={14} className="text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-600">Aane Wala Paisa</p>
                <p className="text-[10px] text-gray-400">Agli 30 din mein milne ki umeed</p>
              </div>
            </div>
            <div className="mt-3">
              <CashflowBar data={advanced.cashflowForecast} />
            </div>
          </div>

          {/* Recovery Efficiency */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center">
                <ShieldCheck size={14} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-600">Recovery Rate</p>
                <p className="text-[10px] text-gray-400">Overdue amount mein se kitna wapas aya</p>
              </div>
            </div>
            {advanced.recovery.overdueCount === 0 ? (
              <p className="text-xs text-emerald-600 font-semibold py-4 text-center">Koi overdue nahi — Alhamdulillah!</p>
            ) : (
              <>
                <p className={`text-4xl font-extrabold mt-3 ${
                  advanced.recovery.efficiency >= 70 ? 'text-emerald-600'
                  : advanced.recovery.efficiency >= 40 ? 'text-amber-600'
                  : 'text-red-500'
                }`}>{advanced.recovery.efficiency}%</p>
                <div className="mt-2 bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      advanced.recovery.efficiency >= 70 ? 'bg-emerald-500'
                      : advanced.recovery.efficiency >= 40 ? 'bg-amber-400'
                      : 'bg-red-500'
                    }`}
                    style={{ width: `${advanced.recovery.efficiency}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-xs text-gray-400">
                  <span>{pkr(advanced.recovery.totalCollected)} wapas aya</span>
                  <span>{advanced.recovery.overdueCount} accounts</span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">of {pkr(advanced.recovery.totalDue)} overdue tha</p>
              </>
            )}
          </div>

          {/* Staff Productivity */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 bg-violet-50 rounded-lg flex items-center justify-center">
                <Users size={14} className="text-violet-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-600">Staff Performance</p>
                <p className="text-[10px] text-gray-400">Pichle 30 din mein kisne kitna kaam kia</p>
              </div>
            </div>
            {!advanced.staffProductivity.length ? (
              <p className="text-xs text-gray-400 py-4 text-center">Is mahine koi payment record nahi</p>
            ) : (
              <div className="space-y-2 mt-3">
                {advanced.staffProductivity.map((s) => {
                  const maxCount = advanced.staffProductivity[0]?.count ?? 1;
                  return (
                    <div key={s.userId}>
                      <div className="flex items-center justify-between text-xs mb-0.5">
                        <span className="font-semibold text-gray-700 truncate max-w-35">{s.name}</span>
                        <span className="text-gray-400 shrink-0 ml-2">{s.count} payments · {pkr(s.total)}</span>
                      </div>
                      <div className="bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div className="h-full rounded-full bg-violet-400" style={{ width: `${(s.count / maxCount) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-[10px] text-gray-300 mt-3">Payment audit logs se — approximate figures</p>
          </div>

          {/* Area Heatmap */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 bg-rose-50 rounded-lg flex items-center justify-center">
                <MapPin size={14} className="text-rose-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-600">Area ke Hisab se</p>
                <p className="text-[10px] text-gray-400">Konse ilaqe mein zyada problem hai</p>
              </div>
            </div>
            {!advanced.areaHeatmap.length ? (
              <p className="text-xs text-gray-400 py-4 text-center">Koi overdue customers nahi</p>
            ) : (
              <div className="space-y-2 mt-3">
                {advanced.areaHeatmap.map((a) => {
                  const maxTotal = advanced.areaHeatmap[0] ? advanced.areaHeatmap[0].overdueCount + advanced.areaHeatmap[0].defaultedCount : 1;
                  return (
                    <div key={a.city}>
                      <div className="flex items-center justify-between text-xs mb-0.5">
                        <span className="font-semibold text-gray-700 truncate max-w-35">{a.city}</span>
                        <span className="text-gray-400 shrink-0 ml-2">
                          {a.overdueCount > 0 && <span className="text-amber-600">{a.overdueCount} late</span>}
                          {a.overdueCount > 0 && a.defaultedCount > 0 && <span className="mx-1 text-gray-300">·</span>}
                          {a.defaultedCount > 0 && <span className="text-red-500">{a.defaultedCount} default</span>}
                        </span>
                      </div>
                      <div className="bg-gray-100 rounded-full h-1.5 overflow-hidden flex">
                        <div className="h-full bg-amber-400" style={{ width: `${(a.overdueCount / maxTotal) * 100}%` }} />
                        <div className="h-full bg-red-500"  style={{ width: `${(a.defaultedCount / maxTotal) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-[10px] text-gray-300 mt-3">Address ke akhri word se — approximate hai</p>
          </div>

        </div>
      )}

      {/* Recent Installments — owner only */}
      {activeTab === 'reports' && isOwner && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <div>
              <h2 className="font-bold text-gray-900 text-sm">Nayi Installments</h2>
              <p className="text-[10px] text-gray-400 mt-0.5">Haal hi mein shuru hue plans</p>
            </div>
            <button onClick={() => navigate('/installments')} className="flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium">
              Sab dekho <ArrowRight size={13} />
            </button>
          </div>

          {isLoading ? (
            <RowSkeleton rows={4} />
          ) : !data?.recentInstallments.length ? (
            <div className="p-8 text-center text-sm text-gray-400">
              Koi installment nahi.{' '}
              <button onClick={() => navigate('/installments')} className="text-blue-600 hover:underline">Banao</button>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {data.recentInstallments.map((inst) => (
                <div key={inst.id}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition cursor-pointer"
                  onClick={() => navigate('/installments')}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{inst.customerName}</p>
                    <p className="text-xs text-gray-400 truncate">{inst.productName}</p>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">{pkr(Number(inst.remaining))}</p>
                      <p className="text-xs text-gray-400">baaki</p>
                    </div>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[inst.status]}`}>
                      {inst.status.charAt(0) + inst.status.slice(1).toLowerCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Cash Handover Modal (staff) ──────────────────────────── */}
      {showHandoverModal && !isOwner && (() => {
        const balance = Number(myBalance?.pendingBalance ?? 0);
        const amt     = Number(handoverAmount);
        const diff    = amt - balance;
        return (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div>
                  <h3 className="font-bold text-gray-900">Cash Jama Karein</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Owner ko cash hand-off ka record</p>
                </div>
                <button onClick={() => setShowHandoverModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
                  <X size={18} className="text-gray-500" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                  <p className="text-[11px] text-gray-400 font-medium">System ka hisaab (collected − confirmed)</p>
                  <p className="text-xl font-black text-gray-900 mt-0.5">{pkr(balance)}</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Actual Amount (PKR) *</label>
                  <input
                    type="number"
                    value={handoverAmount}
                    onChange={(e) => setHandoverAmount(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-3 text-lg font-bold focus:outline-none focus:border-emerald-400 transition"
                    placeholder="0"
                    autoFocus
                  />
                  {handoverAmount && amt !== balance && (
                    <p className={`text-[11px] mt-1.5 font-semibold ${diff < 0 ? 'text-red-500' : 'text-amber-500'}`}>
                      System se {pkr(Math.abs(diff))} {diff < 0 ? 'kam' : 'zyada'}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Note (optional)</label>
                  <textarea
                    value={handoverNote}
                    onChange={(e) => setHandoverNote(e.target.value)}
                    rows={2}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-emerald-400 transition"
                    placeholder="Koi additional info..."
                  />
                </div>
              </div>

              <div className="flex gap-2 px-5 pb-5">
                <button
                  onClick={() => setShowHandoverModal(false)}
                  className="flex-1 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  disabled={!handoverAmount || amt <= 0 || submitHandover.isPending}
                  onClick={() => submitHandover.mutate()}
                  className="flex-1 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl transition flex items-center justify-center gap-1.5"
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

      </div>{/* closes px-4 py-4 content div */}

      {/* Owner: Cash Receive Modal */}
      {receiveTarget && (
        <CashReceiveModal target={receiveTarget} onClose={() => setReceiveTarget(null)} />
      )}

    </div>
  );
}
