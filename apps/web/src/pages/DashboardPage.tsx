import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, CreditCard, AlertTriangle,
  Calendar, Package, ArrowRight, BarChart3,
  MapPin, Users, ShieldCheck, Zap, Plus, ShoppingCart, Receipt, Bell, Target, Gift,
  ClipboardList, Clock, PhoneCall, Banknote, XOctagon,
} from 'lucide-react';
import { useAuthStore } from '../store/auth.store.ts';
import { statsApi } from '../api/stats.api.ts';
import { recoveryApi } from '../api/recovery.api.ts';
import { sellersApi } from '../api/sellers.api.ts';
import { customersApi } from '../api/customers.api.ts';
import { RowSkeleton, BlockSkeleton } from '../components/ui/Skeleton.tsx';
import { fmtDate } from '../utils/dateFormat.ts';

function pkr(v: number) {
  return 'PKR ' + v.toLocaleString('en-PK', { maximumFractionDigits: 0 });
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

// Mini sparkline — 6 bars, no labels
function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-0.5 h-8">
      {data.map((v, i) => {
        const pct = Math.max((v / max) * 100, v > 0 ? 6 : 0);
        const isLast = i === data.length - 1;
        return (
          <div
            key={i}
            className={`flex-1 rounded-sm ${isLast ? 'bg-blue-500' : 'bg-blue-200'}`}
            style={{ height: `${pct}%` }}
          />
        );
      })}
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <BlockSkeleton className="w-9 h-9 rounded-xl mb-3" />
      <BlockSkeleton className="h-3 w-20 rounded mb-2" />
      <BlockSkeleton className="h-7 w-28 rounded" />
    </div>
  );
}

function CashflowBar({ data }: { data: Array<{ date: string; expected: number }> }) {
  if (!data.length) return <p className="text-xs text-gray-400 py-4 text-center">No payments due in next 30 days</p>;
  const max = Math.max(...data.map((d) => d.expected), 1);
  const total = data.reduce((s, d) => s + d.expected, 0);
  return (
    <div>
      <p className="text-2xl font-extrabold text-gray-900">PKR {total.toLocaleString('en-PK', { maximumFractionDigits: 0 })}</p>
      <p className="text-xs text-gray-400 mb-3">expected in next 30 days</p>
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

export default function DashboardPage() {
  const user    = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const isOwner = user?.role === 'SELLER_OWNER';

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

  // Derived values
  const thisMonth = reports?.monthlyCollections.at(-1)?.total ?? 0;
  const lastMonth = reports?.monthlyCollections.at(-2)?.total ?? 0;
  const momChange = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : null;
  const spark6    = reports?.monthlyCollections.slice(-6).map((m) => m.total) ?? [];

  const rate      = reports?.collectionRate.rate ?? 0;
  const rateColor = rate >= 80 ? 'text-emerald-600' : rate >= 60 ? 'text-amber-600' : 'text-red-500';
  const rateBar   = rate >= 80 ? 'bg-emerald-500' : rate >= 60 ? 'bg-amber-400' : 'bg-red-500';

  const aging = reports?.agingBuckets;

  const lowStock  = data?.lowStockItems ?? [];

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

  const todayTotal  = (data?.todayCollections ?? 0) + (data?.todayCashSales ?? 0);
  const monthTotal  = (data?.monthCollections ?? 0) + (data?.monthCashSales ?? 0);

  const statCards = [
    {
      label: "Today's Revenue",
      value: pkr(todayTotal),
      sub: data && (data.todayCashSales > 0 || data.todayCollections > 0)
        ? `Inst: ${pkr(data.todayCollections)} · Cash: ${pkr(data.todayCashSales)}`
        : undefined,
      icon: TrendingUp,
      light: 'bg-blue-50',
      text: 'text-blue-600',
    },
    {
      label: 'This Month',
      value: pkr(monthTotal),
      sub: data && (data.monthCashSales > 0 || data.monthCollections > 0)
        ? `Inst: ${pkr(data.monthCollections)} · Cash: ${pkr(data.monthCashSales)}`
        : undefined,
      icon: Calendar,
      light: 'bg-purple-50',
      text: 'text-purple-600',
    },
    {
      label: 'Active Plans',
      value: String(data?.activeCount ?? 0),
      icon: CreditCard,
      light: 'bg-emerald-50',
      text: 'text-emerald-600',
    },
    {
      label: 'Overdue',
      value: String(data?.overdueCount ?? 0),
      sub: (data?.overdueAmount ?? 0) > 0 ? `${pkr(data!.overdueAmount)} outstanding` : undefined,
      icon: AlertTriangle,
      light: (data?.overdueCount ?? 0) > 0 ? 'bg-red-50'  : 'bg-gray-50',
      text:  (data?.overdueCount ?? 0) > 0 ? 'text-red-500' : 'text-gray-400',
      to: '/installments',
    },
  ];

  return (
    <div className="px-4 py-5 sm:p-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400">{today}</p>
          <h1 className="text-2xl font-bold text-gray-900 mt-0.5">
            {greeting()}, {user?.name.split(' ')[0]}
          </h1>
        </div>
        <button
          onClick={() => navigate('/reports')}
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline font-medium mt-1"
        >
          <BarChart3 size={13} /> Full analytics
        </button>
      </div>

      {/* Quick actions strip */}
      {(() => {
        const perms = user?.permissions as Record<string, boolean> | null | undefined;
        const actions = [
          isOwner || perms?.canAddInstallment
            ? { label: 'New Installment', icon: CreditCard,  color: 'text-blue-600',    bg: 'bg-blue-50',    to: '/installments' }
            : null,
          isOwner || perms?.canAddCustomer
            ? { label: 'Add Customer',    icon: Users,       color: 'text-violet-600',  bg: 'bg-violet-50',  to: '/customers' }
            : null,
          isOwner || perms?.canMakeCashSales
            ? { label: 'Cash Sale',       icon: ShoppingCart,color: 'text-emerald-600', bg: 'bg-emerald-50', to: '/cash-sales' }
            : null,
          isOwner || perms?.canRecordExpense
            ? { label: 'Add Expense',     icon: Receipt,     color: 'text-orange-600',  bg: 'bg-orange-50',  to: '/expenses' }
            : null,
          isOwner || perms?.canManageProducts
            ? { label: 'Add Product',     icon: Package,     color: 'text-amber-600',   bg: 'bg-amber-50',   to: '/products' }
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

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {isLoading
          ? [0, 1, 2, 3].map((i) => <StatCardSkeleton key={i} />)
          : statCards.map((card) => (
            <div
              key={card.label}
              className={`bg-white rounded-2xl border border-gray-100 p-5 shadow-sm ${'to' in card && card.to ? 'cursor-pointer hover:shadow-md hover:border-gray-200 transition-shadow' : ''}`}
              onClick={'to' in card && card.to ? () => navigate(card.to!) : undefined}
            >
              <div className={`w-9 h-9 ${card.light} rounded-xl flex items-center justify-center mb-3`}>
                <card.icon size={18} className={card.text} />
              </div>
              <p className="text-xs text-gray-400 font-medium">{card.label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5">{card.value}</p>
              {'sub' in card && card.sub && (
                <p className="text-[10px] text-gray-400 mt-1 leading-tight">{card.sub}</p>
              )}
            </div>
          ))}
      </div>

      {/* Monthly vs Daily installment split */}
      {data && (data.monthlyActiveCount > 0 || data.dailyActiveCount > 0) && (() => {
        const total = data.monthlyActiveCount + data.dailyActiveCount;
        const mPct  = total > 0 ? Math.round((data.monthlyActiveCount / total) * 100) : 0;
        const dPct  = 100 - mPct;
        return (
          <div className="grid grid-cols-2 gap-4">
            {/* Monthly card */}
            <div
              className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate('/installments?freq=monthly')}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center">
                  <Calendar size={16} className="text-blue-600" />
                </div>
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wide">Monthly</span>
              </div>
              <p className="text-3xl font-black text-gray-900">{data.monthlyActiveCount}</p>
              <p className="text-xs text-gray-400 mt-0.5">active plans</p>
              <p className="text-xs font-semibold text-blue-700 mt-1">{pkr(data.monthlyActiveRemaining)}</p>
              <p className="text-[10px] text-gray-400">outstanding</p>
              <div className="mt-3 bg-gray-100 rounded-full h-1 overflow-hidden">
                <div className="h-full bg-blue-400 rounded-full" style={{ width: `${mPct}%` }} />
              </div>
              <p className="text-[10px] text-gray-400 mt-1">{mPct}% of all active</p>
            </div>

            {/* Daily card */}
            <div
              className="bg-white rounded-2xl border border-violet-100 p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate('/installments?freq=daily')}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-8 h-8 bg-violet-50 rounded-xl flex items-center justify-center">
                  <Clock size={16} className="text-violet-600" />
                </div>
                <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wide">Daily</span>
              </div>
              <p className="text-3xl font-black text-gray-900">{data.dailyActiveCount}</p>
              <p className="text-xs text-gray-400 mt-0.5">active plans</p>
              <p className="text-xs font-semibold text-violet-700 mt-1">{pkr(data.dailyActiveRemaining)}</p>
              <p className="text-[10px] text-gray-400">outstanding</p>
              <div className="mt-3 bg-gray-100 rounded-full h-1 overflow-hidden">
                <div className="h-full bg-violet-400 rounded-full" style={{ width: `${dPct}%` }} />
              </div>
              <p className="text-[10px] text-gray-400 mt-1">{dPct}% of all active</p>
            </div>
          </div>
        );
      })()}

      {/* Daily Briefing — today's priority numbers */}
      {briefing && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-gray-50">
            <div className="w-6 h-6 bg-indigo-50 rounded-lg flex items-center justify-center">
              <ClipboardList size={13} className="text-indigo-600" />
            </div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Today's Briefing</p>
          </div>
          <div className="grid grid-cols-5 divide-x divide-gray-100">
            {[
              {
                label: 'Due Today',
                value: briefing.dueToday,
                icon: Clock,
                bg: 'bg-blue-50',
                color: 'text-blue-600',
                urgent: briefing.dueToday > 0,
              },
              {
                label: 'Overdue',
                value: briefing.overdueTotal,
                icon: AlertTriangle,
                bg: briefing.overdueTotal > 0 ? 'bg-red-50'   : 'bg-gray-50',
                color: briefing.overdueTotal > 0 ? 'text-red-500' : 'text-gray-400',
                urgent: briefing.overdueTotal > 0,
              },
              {
                label: 'Promises',
                value: briefing.promisesToday,
                icon: PhoneCall,
                bg: briefing.promisesToday > 0 ? 'bg-amber-50' : 'bg-gray-50',
                color: briefing.promisesToday > 0 ? 'text-amber-600' : 'text-gray-400',
                urgent: false,
              },
              {
                label: 'Collected',
                value: `PKR ${briefing.collectedToday.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`,
                icon: Banknote,
                bg: 'bg-emerald-50',
                color: 'text-emerald-600',
                urgent: false,
              },
              {
                label: 'Defaulted',
                value: briefing.defaultedCount,
                icon: XOctagon,
                bg: briefing.defaultedCount > 0 ? 'bg-red-50'   : 'bg-gray-50',
                color: briefing.defaultedCount > 0 ? 'text-red-500' : 'text-gray-400',
                urgent: false,
              },
            ].map(({ label, value, icon: Icon, bg, color }) => (
              <div key={label} className="flex flex-col items-center gap-1 py-3 px-2 text-center">
                <div className={`w-7 h-7 ${bg} rounded-lg flex items-center justify-center`}>
                  <Icon size={14} className={color} />
                </div>
                <p className={`text-base font-extrabold ${color} leading-none`}>{value}</p>
                <p className="text-[10px] text-gray-400 leading-tight">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Focus Today — top overdue accounts needing action */}
      {briefing && briefing.urgentAccounts.length > 0 && (
        <div className="bg-white border border-red-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-red-50 bg-red-50/40">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-red-100 rounded-lg flex items-center justify-center">
                <AlertTriangle size={13} className="text-red-500" />
              </div>
              <p className="text-xs font-semibold text-red-600 uppercase tracking-widest">Focus Today</p>
            </div>
            {briefing.dueTomorrow > 0 && (
              <span className="text-[10px] bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">
                +{briefing.dueTomorrow} due tomorrow
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
                    <p className="text-sm font-bold text-gray-900">
                      PKR {acct.monthly.toLocaleString('en-PK', { maximumFractionDigits: 0 })}
                    </p>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      acct.daysOverdue >= 30 ? 'bg-red-100 text-red-700' :
                      acct.daysOverdue >= 7  ? 'bg-amber-100 text-amber-700' :
                                               'bg-orange-100 text-orange-600'
                    }`}>
                      {acct.daysOverdue}d overdue
                    </span>
                  </div>
                  <a href={wa} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-semibold transition shrink-0">
                    <PhoneCall size={11} />
                    WhatsApp
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Daily target progress — only shown when owner has set a target */}
      {isOwner && shop?.settings?.dailyTarget && (
        (() => {
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
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Daily Target</p>
                </div>
                <span className={`text-xs font-bold ${txtCls}`}>{pct}%{over ? ' ✓' : ''}</span>
              </div>
              <div className="flex items-baseline gap-1.5 mb-2">
                <span className="text-2xl font-extrabold text-gray-900">{pkr(todayTotal)}</span>
                <span className="text-xs text-gray-400">of {pkr(target)}</span>
              </div>
              <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${barCls}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {over && (
                <p className="text-[10px] text-emerald-600 font-semibold mt-1.5">
                  +{pkr(todayTotal - target)} above target
                </p>
              )}
            </div>
          );
        })()
      )}

      {/* Collection rate + Aging + Sparkline */}
      {reports && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">

          {/* Collection rate */}
          <div className="md:col-span-2 bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Collection Rate</p>
            <p className={`text-4xl font-extrabold ${rateColor}`}>{rate}%</p>
            <div className="mt-3 bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${rateBar}`}
                style={{ width: `${rate}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {pkr(reports.collectionRate.totalCollected)} collected of {pkr(reports.collectionRate.totalBilled)} billed
            </p>
          </div>

          {/* Aging buckets — DPD (Days Past Due) */}
          <div className="md:col-span-2 bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Installment Aging (DPD)</p>
            <div className="space-y-2">
              {[
                { label: 'On Schedule', n: aging?.current ?? 0,    dot: 'bg-emerald-500', text: 'text-emerald-700', bar: 'bg-emerald-400' },
                { label: '1–7 days',    n: aging?.days0_7 ?? 0,    dot: 'bg-amber-400',   text: 'text-amber-700',   bar: 'bg-amber-400' },
                { label: '8–30 days',   n: aging?.days8_30 ?? 0,   dot: 'bg-orange-500',  text: 'text-orange-700',  bar: 'bg-orange-400' },
                { label: '31–90 days',  n: aging?.days31_90 ?? 0,  dot: 'bg-red-500',     text: 'text-red-700',     bar: 'bg-red-500' },
                { label: '90+ days',    n: aging?.days90plus ?? 0, dot: 'bg-red-800',     text: 'text-red-800',     bar: 'bg-red-800' },
              ].map(({ label, n, dot, text, bar }) => {
                const total = (aging?.current ?? 0) + (aging?.days0_7 ?? 0) + (aging?.days8_30 ?? 0) + (aging?.days31_90 ?? 0) + (aging?.days90plus ?? 0);
                const pct = total > 0 ? Math.round((n / total) * 100) : 0;
                return (
                  <div key={label} className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                    <span className="text-xs text-gray-500 w-20 shrink-0">{label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className={`text-xs font-bold w-6 text-right ${n > 0 ? text : 'text-gray-300'}`}>{n}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 6-month sparkline */}
          <div className="md:col-span-1 bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">6-Month Trend</p>
            <div className="flex-1 flex flex-col justify-end gap-2 mt-3">
              {spark6.length > 0 ? <Sparkline data={spark6} /> : (
                <div className="h-8 flex items-end gap-0.5">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex-1 bg-gray-100 rounded-sm h-1" />
                  ))}
                </div>
              )}
            </div>
            {momChange !== null && (
              <p className={`text-xs font-semibold mt-2 flex items-center gap-0.5 ${momChange >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {momChange >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {Math.abs(momChange)}% vs last month
              </p>
            )}
          </div>
        </div>
      )}

      {/* Low stock alert */}
      {lowStock.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Package size={16} className="text-amber-600" />
              <p className="text-sm font-semibold text-amber-700">
                {lowStock.length} product{lowStock.length !== 1 ? 's' : ''} low on stock
              </p>
            </div>
            <button
              onClick={() => navigate('/products')}
              className="flex items-center gap-1 text-xs text-amber-700 hover:underline font-medium"
            >
              Manage <ArrowRight size={12} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStock.map((p) => (
              <span
                key={p.id}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                  p.stock === 0
                    ? 'bg-red-100 text-red-700 border border-red-200'
                    : 'bg-amber-100 text-amber-700 border border-amber-200'
                }`}
              >
                {p.name}
                <span className={`px-1 py-0.5 rounded text-[10px] font-bold ${p.stock === 0 ? 'bg-red-200' : 'bg-amber-200'}`}>
                  {p.stock === 0 ? 'OUT' : `${p.stock}/${p.minStock}`}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Promise-to-Pay follow-up alerts */}
      {promisesDueCount > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-indigo-600" />
              <p className="text-sm font-semibold text-indigo-700">
                {promisesDueCount} promise{promisesDueCount !== 1 ? 's' : ''} due for follow-up
              </p>
            </div>
            <button
              onClick={() => navigate('/installments')}
              className="flex items-center gap-1 text-xs text-indigo-700 hover:underline font-medium"
            >
              View all <ArrowRight size={12} />
            </button>
          </div>
          {promisesLoading ? (
            <div className="space-y-2">
              {[0, 1].map((i) => (
                <div key={i} className="h-10 bg-indigo-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-1.5">
              {promises.slice(0, 6).map((p) => {
                const pd = new Date(p.promiseDate);
                const todayMidnight = new Date();
                todayMidnight.setHours(0, 0, 0, 0);
                const isOverdue = pd < todayMidnight;
                return (
                  <div key={p.id} className="flex items-center justify-between bg-white rounded-xl px-3 py-2.5 border border-indigo-100">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">{p.customerName}</p>
                      <p className="text-[10px] text-gray-400 truncate">{p.productName}{p.note ? ` · ${p.note}` : ''}</p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                        isOverdue ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600'
                      }`}>
                        {isOverdue ? 'Overdue' : 'Today'}
                      </span>
                      <p className="text-[10px] text-gray-400 mt-0.5">{fmtDate(pd)}</p>
                    </div>
                  </div>
                );
              })}
              {promises.length > 6 && (
                <p className="text-[10px] text-indigo-400 text-center pt-1">+{promises.length - 6} more</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Upcoming Birthdays */}
      {birthdays.length > 0 && (
        <div className="bg-pink-50 border border-pink-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Gift size={16} className="text-pink-600" />
              <p className="text-sm font-semibold text-pink-700">
                {birthdays.length} customer birthday{birthdays.length !== 1 ? 's' : ''} this week
              </p>
            </div>
          </div>
          <div className="space-y-1.5">
            {birthdays.map((c) => {
              const [, mm, dd] = c.dob.split('-');
              const thisYear = new Date().getFullYear();
              const bday = new Date(`${thisYear}-${mm}-${dd}`);
              const today = new Date(); today.setHours(0, 0, 0, 0);
              const isToday = bday.toDateString() === today.toDateString();
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
                    {isToday && <span className="text-[10px] font-bold bg-pink-100 text-pink-600 px-1.5 py-0.5 rounded-md">Today!</span>}
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

      {/* Advanced widgets row */}
      {advanced && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Cashflow Forecast */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
                <Zap size={14} className="text-blue-600" />
              </div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Cashflow Forecast</p>
            </div>
            <CashflowBar data={advanced.cashflowForecast} />
          </div>

          {/* Recovery Efficiency */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center">
                <ShieldCheck size={14} className="text-emerald-600" />
              </div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Recovery Efficiency</p>
            </div>
            {advanced.recovery.overdueCount === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">No overdue or defaulted installments</p>
            ) : (
              <>
                <p className={`text-4xl font-extrabold ${
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
                  <span>PKR {advanced.recovery.totalCollected.toLocaleString('en-PK', { maximumFractionDigits: 0 })} recovered</span>
                  <span>{advanced.recovery.overdueCount} accounts</span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  of PKR {advanced.recovery.totalDue.toLocaleString('en-PK', { maximumFractionDigits: 0 })} total due
                </p>
              </>
            )}
          </div>

          {/* Staff Productivity */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-violet-50 rounded-lg flex items-center justify-center">
                <Users size={14} className="text-violet-600" />
              </div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Staff Productivity — 30 days</p>
            </div>
            {!advanced.staffProductivity.length ? (
              <p className="text-xs text-gray-400 py-4 text-center">No payments recorded this month</p>
            ) : (
              <div className="space-y-2">
                {advanced.staffProductivity.map((s) => {
                  const maxCount = advanced.staffProductivity[0]?.count ?? 1;
                  return (
                    <div key={s.userId}>
                      <div className="flex items-center justify-between text-xs mb-0.5">
                        <span className="font-medium text-gray-700 truncate max-w-35">{s.name}</span>
                        <span className="text-gray-400 shrink-0 ml-2">{s.count} payments · PKR {s.total.toLocaleString('en-PK', { maximumFractionDigits: 0 })}</span>
                      </div>
                      <div className="bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-violet-400"
                          style={{ width: `${(s.count / maxCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-[10px] text-gray-300 mt-3">Based on payment audit logs — figures are approximate</p>
          </div>

          {/* Area Heatmap */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-rose-50 rounded-lg flex items-center justify-center">
                <MapPin size={14} className="text-rose-600" />
              </div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Overdue by Area</p>
            </div>
            {!advanced.areaHeatmap.length ? (
              <p className="text-xs text-gray-400 py-4 text-center">No overdue customers</p>
            ) : (
              <div className="space-y-2">
                {advanced.areaHeatmap.map((a) => {
                  const maxTotal = advanced.areaHeatmap[0] ? advanced.areaHeatmap[0].overdueCount + advanced.areaHeatmap[0].defaultedCount : 1;
                  return (
                    <div key={a.city}>
                      <div className="flex items-center justify-between text-xs mb-0.5">
                        <span className="font-medium text-gray-700 truncate max-w-35">{a.city}</span>
                        <span className="text-gray-400 shrink-0 ml-2">
                          {a.overdueCount > 0 && <span className="text-amber-600">{a.overdueCount} late</span>}
                          {a.overdueCount > 0 && a.defaultedCount > 0 && <span className="mx-1 text-gray-300">·</span>}
                          {a.defaultedCount > 0 && <span className="text-red-500">{a.defaultedCount} defaulted</span>}
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
            <p className="text-[10px] text-gray-300 mt-3">Derived from last word in address field — accuracy varies</p>
          </div>

        </div>
      )}

      {/* Recent installments — owner only */}
      {isOwner && <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <h2 className="font-semibold text-gray-900 text-sm">Recent Installments</h2>
          <button onClick={() => navigate('/installments')}
            className="flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium">
            View all <ArrowRight size={13} />
          </button>
        </div>

        {isLoading ? (
          <RowSkeleton rows={4} />
        ) : !data?.recentInstallments.length ? (
          <div className="p-8 text-center text-sm text-gray-400">
            No installments yet.{' '}
            <button onClick={() => navigate('/installments')} className="text-blue-600 hover:underline">
              Create one
            </button>
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
                    <p className="text-xs text-gray-400">remaining</p>
                  </div>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[inst.status]}`}>
                    {inst.status.charAt(0) + inst.status.slice(1).toLowerCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>}

    </div>
  );
}
