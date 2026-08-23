import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { statsApi, type Reports } from '../api/stats.api.ts';
import { verificationsApi, type AvoStat } from '../api/verifications.api.ts';
import { reportsApi, type AreaRow, type AgingBucket, type HeatmapDay, type ForecastMonth, type CohortRow } from '../api/reports.api.ts';
import { customersApi } from '../api/customers.api.ts';
import { openWhatsApp, reminderMessage } from '../utils/whatsapp.ts';
import { sellersApi } from '../api/sellers.api.ts';
import { useAuthStore } from '../store/auth.store.ts';
import {
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Clock, MessageCircle,
  BarChart3, Send, UserCheck, MapPin, Activity, Gift, CalendarDays,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import ConfirmDialog from '../components/ui/ConfirmDialog.tsx';

function pkr(v: number) {
  return 'PKR ' + v.toLocaleString('en-PK', { maximumFractionDigits: 0 });
}

// ── Collection rate ring ───────────────────────────────────────────────────────

function RateRing({ rate }: { rate: number }) {
  const r     = 54;
  const circ  = 2 * Math.PI * r;
  const offset = circ - (Math.min(rate, 100) / 100) * circ;
  const color  = rate >= 80 ? '#10b981' : rate >= 60 ? '#f59e0b' : '#ef4444';
  const track  = rate >= 80 ? '#d1fae5' : rate >= 60 ? '#fef3c7' : '#fee2e2';
  return (
    <svg width="148" height="148" viewBox="0 0 148 148">
      <circle cx="74" cy="74" r={r} fill="none" stroke={track} strokeWidth="12"/>
      <circle cx="74" cy="74" r={r} fill="none" stroke={color} strokeWidth="12"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform="rotate(-90 74 74)"
        style={{ transition: 'stroke-dashoffset 0.9s ease' }}
      />
      <text x="74" y="67" textAnchor="middle" fill="#111827" style={{ font: 'bold 28px system-ui' }}>{rate}%</text>
      <text x="74" y="86" textAnchor="middle" fill="#9ca3af" style={{ font: '11px system-ui' }}>collected</text>
    </svg>
  );
}

// ── Monthly bar chart ─────────────────────────────────────────────────────────

function BarChart({ data }: { data: Reports['monthlyCollections'] }) {
  const max  = Math.max(...data.map((d) => d.total), 1);
  const last = data[data.length - 1];
  return (
    <div className="flex items-end gap-1.5 h-52">
      {data.map((d) => {
        const isLast = d.month === last.month;
        return (
          <div key={d.month} className="flex-1 flex flex-col items-center gap-1 group relative">
            {d.total > 0 && (
              <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-medium px-2 py-1 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none z-10 space-y-0.5 shadow-lg">
                <div className="font-semibold">{pkr(d.total)}</div>
                {d.cashSales > 0    && <div className="text-emerald-300">Cash: {pkr(d.cashSales)}</div>}
                {d.installments > 0 && <div className="text-blue-300">Inst: {pkr(d.installments)}</div>}
              </div>
            )}
            <div className="w-full flex-1 flex flex-col items-stretch justify-end rounded-t-lg overflow-hidden">
              {d.cashSales > 0 && (
                <div
                  className="w-full bg-linear-to-b from-emerald-400 to-emerald-500 group-hover:from-emerald-300 group-hover:to-emerald-400 transition-all duration-500"
                  style={{ height: `${Math.max((d.cashSales / max) * 100, 2)}%` }}
                />
              )}
              <div
                className={`w-full transition-all duration-500 ${
                  isLast
                    ? 'bg-linear-to-b from-blue-500 to-blue-700'
                    : 'bg-blue-100 group-hover:bg-linear-to-b group-hover:from-blue-400 group-hover:to-blue-600'
                }`}
                style={{
                  height: `${Math.max((d.installments / max) * 100, d.installments > 0 ? 2 : 0)}%`,
                  minHeight: d.total > 0 && d.cashSales === 0 ? '4px' : '0',
                }}
              />
            </div>
            <span className="text-[9px] text-slate-400 leading-none font-medium">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Horizontal bar ────────────────────────────────────────────────────────────

function HBar({ value, max, pct }: { value: number; max: number; pct?: boolean }) {
  const p = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
      <div
        className="h-full rounded-full bg-linear-to-r from-blue-500 to-blue-400 transition-all duration-700"
        style={{ width: `${p}%` }}
      />
      {pct}
    </div>
  );
}

// ── Aging card ────────────────────────────────────────────────────────────────

function AgingCard({
  label, count, sublabel, bg, text, border, icon: Icon,
}: {
  label: string; count: number; sublabel: string;
  bg: string; text: string; border: string; icon: typeof CheckCircle;
}) {
  return (
    <div className={`${bg} ${border} border rounded-2xl p-5 flex flex-col gap-2`}>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-bold ${text}`}>{label}</span>
        <Icon size={15} className={text}/>
      </div>
      <p className={`text-3xl font-black ${text}`}>{count}</p>
      <p className="text-xs text-slate-500">{sublabel}</p>
    </div>
  );
}

// ── Forecast section ──────────────────────────────────────────────────────────

function ForecastSection({ months }: { months: ForecastMonth[] }) {
  if (!months.length) return null;
  const maxAmt = Math.max(...months.map((m) => m.expectedAmount), 1);
  const shades = ['from-indigo-600 to-indigo-500', 'from-indigo-400 to-indigo-300', 'from-indigo-200 to-indigo-100'];
  const textC  = ['text-indigo-700', 'text-indigo-600', 'text-indigo-400'];

  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2.5">
        <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center">
          <CalendarDays size={15} className="text-indigo-600"/>
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900">3-Month Collection Forecast</p>
          <p className="text-xs text-slate-400">If all active plans pay on time</p>
        </div>
      </div>
      <div className="p-5 grid grid-cols-3 gap-4">
        {months.map((m, i) => {
          const barPct = maxAmt > 0 ? (m.expectedAmount / maxAmt) * 100 : 0;
          return (
            <div key={m.month} className="flex flex-col gap-3">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <p className="text-xs font-semibold text-slate-400 mb-1">{m.monthName.split(' ')[0]} {m.monthName.split(' ')[1]}</p>
                <p className={`text-xl font-black ${textC[i]}`}>{pkr(m.expectedAmount)}</p>
                <p className="text-xs text-slate-400 mt-1">{m.installmentCount} installment{m.installmentCount !== 1 ? 's' : ''}</p>
                {m.dailyAmount > 0 && (
                  <div className="mt-2 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px]">
                    <span className="text-indigo-600 font-semibold">{pkr(m.monthlyAmount)}/mo</span>
                    <span className="text-emerald-600 font-semibold">{pkr(m.dailyAmount)}/day</span>
                  </div>
                )}
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full bg-linear-to-r ${shades[i]} transition-all duration-700`}
                  style={{ width: `${barPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className: string }) {
  return <div className={`bg-slate-200 rounded-xl animate-pulse ${className}`}/>;
}

// ── Heatmap ───────────────────────────────────────────────────────────────────

const MONTH_NAMES_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_LABELS        = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function CollectionsHeatmap({ days, year, month }: { days: HeatmapDay[]; year: number; month: number }) {
  if (!days.length) return null;
  const maxTotal = Math.max(...days.map((d) => d.total), 1);

  function intensity(total: number) {
    if (total === 0) return 0;
    const pct = total / maxTotal;
    if (pct < 0.25) return 1;
    if (pct < 0.5)  return 2;
    if (pct < 0.75) return 3;
    return 4;
  }

  const cellBg   = ['bg-slate-100', 'bg-emerald-100', 'bg-emerald-300', 'bg-emerald-500', 'bg-emerald-700'];
  const cellText = ['text-slate-400', 'text-emerald-700', 'text-emerald-800', 'text-white', 'text-white'];

  const firstDow = new Date(year, month - 1, 1).getDay();
  const cells: (HeatmapDay | null)[] = [...Array(firstDow).fill(null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (HeatmapDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[340px]">
        <div className="grid grid-cols-7 mb-1">
          {DAY_LABELS.map((d) => (
            <div key={d} className="text-[10px] text-center text-slate-400 font-semibold py-1">{d}</div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1 mb-1">
            {week.map((cell, di) => {
              if (!cell) return <div key={di}/>;
              const iv = intensity(cell.total);
              return (
                <div key={di}
                  title={cell.total > 0 ? `${cell.day}: ${pkr(cell.total)} (${cell.count} payments)` : `${cell.day}: no collections`}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center cursor-default transition-transform hover:scale-110 ${cellBg[iv]}`}
                >
                  <span className={`text-[10px] font-bold leading-none ${cellText[iv]}`}>{cell.day}</span>
                  {cell.total > 0 && (
                    <span className={`text-[8px] leading-none mt-0.5 ${cellText[iv]} opacity-75`}>{cell.count}</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        <div className="flex items-center gap-2 mt-3 justify-end">
          <span className="text-[10px] text-slate-400">Less</span>
          {cellBg.map((bg, i) => (
            <div key={i} className={`w-3.5 h-3.5 rounded-md ${bg}`}/>
          ))}
          <span className="text-[10px] text-slate-400">More</span>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const user      = useAuthStore((s) => s.user);
  const isOwner   = user?.role === 'SELLER_OWNER';
  const canReports = isOwner || !!user?.permissions?.canViewReports;

  const [remindAllConfirm, setRemindAllConfirm] = useState(false);

  const now = new Date();
  const [hmYear,  setHmYear]  = useState(now.getFullYear());
  const [hmMonth, setHmMonth] = useState(now.getMonth() + 1);

  function prevMonth() {
    if (hmMonth === 1) { setHmYear((y) => y - 1); setHmMonth(12); }
    else setHmMonth((m) => m - 1);
  }
  function nextMonth() {
    if (hmYear === now.getFullYear() && hmMonth === now.getMonth() + 1) return;
    if (hmMonth === 12) { setHmYear((y) => y + 1); setHmMonth(1); }
    else setHmMonth((m) => m + 1);
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports'],
    queryFn:  statsApi.getReports,
    staleTime: 60_000,
    enabled:  canReports,
    retry: false,
  });
  const { data: shopData }     = useQuery({ queryKey: ['shop-me'],   queryFn: sellersApi.getMe });
  const { data: avoStats = [] } = useQuery({
    queryKey: ['avo-stats'],
    queryFn:  verificationsApi.avoStats,
    staleTime: 60_000,
    enabled: isOwner,
  });
  const { data: areaRows = [] }     = useQuery<AreaRow[]>({
    queryKey: ['area-report'],
    queryFn:  reportsApi.getAreaReport,
    staleTime: 2 * 60_000,
    enabled: canReports,
  });
  const { data: referralRows = [] } = useQuery({
    queryKey: ['referral-leaderboard'],
    queryFn:  customersApi.getReferralLeaderboard,
    staleTime: 5 * 60_000,
    enabled: canReports,
  });
  const { data: agingRows = [] }    = useQuery<AgingBucket[]>({
    queryKey: ['aging-report'],
    queryFn:  reportsApi.getAgingReport,
    staleTime: 3 * 60_000,
    enabled: canReports,
  });
  const { data: heatmapDays = [] }  = useQuery<HeatmapDay[]>({
    queryKey: ['collections-heatmap', hmYear, hmMonth],
    queryFn:  () => reportsApi.getCollectionsHeatmap(hmYear, hmMonth),
    staleTime: 5 * 60_000,
    enabled: canReports,
  });
  const { data: forecastMonths = [] } = useQuery<ForecastMonth[]>({
    queryKey: ['forecast'],
    queryFn:  reportsApi.getForecast,
    staleTime: 10 * 60_000,
    enabled: canReports,
  });
  const { data: cohortRows = [] } = useQuery<CohortRow[]>({
    queryKey: ['cohort-analysis'],
    queryFn:  reportsApi.getCohortAnalysis,
    staleTime: 15 * 60_000,
    enabled: canReports,
  });

  // ── Access denied ──
  if (!canReports) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-64 text-center">
        <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
          <BarChart3 size={26} className="text-slate-300"/>
        </div>
        <p className="text-sm font-bold text-slate-600">Access restricted</p>
        <p className="text-xs text-slate-400 mt-1">Your account doesn't have permission to view analytics.</p>
      </div>
    );
  }

  // ── Error ──
  if (isError) {
    return (
      <>
        <div className="bg-slate-950 px-4 sm:px-6 lg:px-8 py-5">
          <h1 className="text-xl font-black text-white flex items-center gap-2.5">
            <BarChart3 size={20} className="text-blue-400"/>
            Analytics
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">Last 12 months · All figures in PKR</p>
        </div>
        <div className="p-8 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
            <BarChart3 size={26} className="text-red-300"/>
          </div>
          <p className="text-sm font-bold text-slate-600">Failed to load analytics</p>
          <p className="text-xs text-slate-400 mt-1">Please refresh the page and try again.</p>
        </div>
      </>
    );
  }

  // ── Loading ──
  if (isLoading || !data) {
    return (
      <>
        <div className="bg-slate-950 px-4 sm:px-6 lg:px-8 py-5">
          <h1 className="text-xl font-black text-white flex items-center gap-2.5">
            <BarChart3 size={20} className="text-blue-400"/>
            Analytics
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">Last 12 months · All figures in PKR</p>
          <div className="flex flex-wrap gap-2 mt-4">
            {[100, 140, 90, 130].map((w) => (
              <div key={w} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3" style={{ width: w }}>
                <div className="w-12 h-2 bg-white/10 rounded mb-2 animate-pulse"/>
                <div className="w-16 h-5 bg-white/10 rounded animate-pulse"/>
              </div>
            ))}
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Skeleton className="h-52"/>
            <Skeleton className="h-52"/>
            <Skeleton className="h-52"/>
          </div>
          <Skeleton className="h-72"/>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Skeleton className="h-64"/>
            <Skeleton className="h-64"/>
          </div>
        </div>
      </>
    );
  }

  const { monthlyCollections, collectionRate, agingBuckets, topDebtors, topProducts } = data;
  const maxProduct   = Math.max(...topProducts.map((p) => p.count), 1);
  const thisMonth    = monthlyCollections[monthlyCollections.length - 1]?.total ?? 0;
  const lastMonth    = monthlyCollections[monthlyCollections.length - 2]?.total ?? 0;
  const momChange    = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : null;
  const totalOverdue = agingBuckets.days8_30 + agingBuckets.days31_90 + agingBuckets.days90plus;

  const rateColor =
    collectionRate.rate >= 80 ? 'text-emerald-400' :
    collectionRate.rate >= 60 ? 'text-amber-400'   : 'text-red-400';
  const rateBg =
    collectionRate.rate >= 80 ? 'bg-emerald-500/10 border-emerald-500/20' :
    collectionRate.rate >= 60 ? 'bg-amber-500/10   border-amber-500/20'   :
                                'bg-red-500/10     border-red-500/20';

  return (
    <>
      {/* ── Dark hero header ── */}
      <div className="bg-slate-950 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-black text-white flex items-center gap-2.5">
                <BarChart3 size={20} className="text-blue-400"/>
                Analytics
              </h1>
              <p className="text-slate-500 text-sm mt-0.5">Last 12 months · All figures in PKR</p>
            </div>
            {shopData && topDebtors.length > 0 && (
              <button
                onClick={() => setRemindAllConfirm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-xl transition shadow-sm shadow-green-900/30 shrink-0"
              >
                <Send size={14}/>
                Remind All ({topDebtors.length})
              </button>
            )}
          </div>

          {/* KPI chips */}
          <div className="flex flex-wrap gap-2.5 mt-4">
            {/* Collection rate */}
            <div className={`px-4 py-2.5 rounded-xl border ${rateBg}`}>
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">Collection Rate</p>
              <p className={`text-2xl font-black leading-none mt-0.5 ${rateColor}`}>{collectionRate.rate}%</p>
            </div>

            {/* This month */}
            <div className="px-4 py-2.5 rounded-xl border bg-blue-500/10 border-blue-500/20">
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">This Month</p>
              <p className="text-2xl font-black text-blue-400 leading-none mt-0.5">{pkr(thisMonth)}</p>
              {momChange !== null && (
                <p className={`text-[10px] font-bold mt-0.5 flex items-center gap-0.5 ${momChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {momChange >= 0 ? <TrendingUp size={10}/> : <TrendingDown size={10}/>}
                  {momChange >= 0 ? '+' : ''}{momChange}% vs last month
                </p>
              )}
            </div>

            {/* Overdue */}
            <div className={`px-4 py-2.5 rounded-xl border ${totalOverdue > 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">Overdue</p>
              <p className={`text-2xl font-black leading-none mt-0.5 ${totalOverdue > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {totalOverdue}
              </p>
            </div>

            {/* Active plans */}
            <div className="px-4 py-2.5 rounded-xl border bg-white/5 border-white/10">
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">Active Plans</p>
              <p className="text-2xl font-black text-white leading-none mt-0.5">{agingBuckets.current}</p>
            </div>

            {/* Forecast */}
            {forecastMonths[0] && (
              <div className="px-4 py-2.5 rounded-xl border bg-indigo-500/10 border-indigo-500/20">
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">Next Month</p>
                <p className="text-2xl font-black text-indigo-400 leading-none mt-0.5">
                  {pkr(forecastMonths[0].expectedAmount)}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Page content ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">

        {/* Forecast */}
        {forecastMonths.length > 0 && <ForecastSection months={forecastMonths}/>}

        {/* Row 1: Collection ring + This month + Overdue */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          {/* Collection rate ring */}
          <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm p-6 flex flex-col items-center justify-center gap-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Collection Rate</p>
            <RateRing rate={collectionRate.rate}/>
            <div className="text-center space-y-0.5">
              <p className="text-xs font-semibold text-slate-600">{pkr(collectionRate.totalCollected)} collected</p>
              <p className="text-xs text-slate-400">of {pkr(collectionRate.totalBilled)} billed</p>
            </div>
          </div>

          {/* This month */}
          <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm p-6 flex flex-col justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">This Month</p>
              <p className="text-3xl font-black text-slate-900">{pkr(thisMonth)}</p>
            </div>
            <div className="mt-4 space-y-1.5">
              {momChange !== null && (
                <div className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg ${
                  momChange >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                }`}>
                  {momChange >= 0 ? <TrendingUp size={13}/> : <TrendingDown size={13}/>}
                  {Math.abs(momChange)}% vs last month
                </div>
              )}
              <p className="text-xs text-slate-400">Last month: {pkr(lastMonth)}</p>
            </div>
          </div>

          {/* Overdue */}
          <div className={`rounded-2xl ring-1 shadow-sm p-6 flex flex-col justify-between ${
            totalOverdue > 0
              ? 'bg-red-50 ring-red-200'
              : 'bg-emerald-50 ring-emerald-200'
          }`}>
            <div>
              <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${totalOverdue > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                Overdue Installments
              </p>
              <p className={`text-3xl font-black ${totalOverdue > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                {totalOverdue}
              </p>
            </div>
            <div className="mt-4 space-y-1">
              {totalOverdue > 0
                ? <p className="text-xs text-red-400 flex items-center gap-1.5"><AlertTriangle size={12}/> Requires follow-up</p>
                : <p className="text-xs text-emerald-500 flex items-center gap-1.5"><CheckCircle size={12}/> All plans on track</p>
              }
              <p className="text-xs text-slate-400">{agingBuckets.current} plans on schedule</p>
            </div>
          </div>
        </div>

        {/* Monthly revenue chart */}
        <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6 gap-4">
            <div>
              <p className="text-sm font-bold text-slate-900">Monthly Revenue</p>
              <p className="text-xs text-slate-400 mt-0.5">Installment payments + cash sales · last 12 months</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-linear-to-b from-blue-500 to-blue-700 inline-block"/>
                Installments
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-linear-to-b from-emerald-400 to-emerald-500 inline-block"/>
                Cash Sales
              </span>
            </div>
          </div>
          {monthlyCollections.every((m) => m.total === 0) ? (
            <div className="h-52 flex items-center justify-center text-sm text-slate-300">No payment data yet</div>
          ) : (
            <BarChart data={monthlyCollections}/>
          )}
        </div>

        {/* Aging + Top products */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Aging */}
          <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm p-6">
            <p className="text-sm font-bold text-slate-900 mb-0.5">Installment Aging</p>
            <p className="text-xs text-slate-400 mb-5">Active plans bucketed by days past due date</p>
            <div className="grid grid-cols-2 gap-3">
              <AgingCard label="On Schedule"    count={agingBuckets.current}    sublabel="Due date not reached" bg="bg-emerald-50" border="border-emerald-200" text="text-emerald-600" icon={CheckCircle}/>
              <AgingCard label="1–30 Days Late" count={agingBuckets.days8_30}   sublabel="Early overdue"        bg="bg-amber-50"   border="border-amber-200"   text="text-amber-600"   icon={Clock}/>
              <AgingCard label="31–90 Days"     count={agingBuckets.days31_90}  sublabel="Action needed"        bg="bg-orange-50"  border="border-orange-200"  text="text-orange-600"  icon={AlertTriangle}/>
              <AgingCard label="90+ Days"       count={agingBuckets.days90plus} sublabel="Critical overdue"     bg="bg-red-50"     border="border-red-200"     text="text-red-600"     icon={AlertTriangle}/>
            </div>
          </div>

          {/* Top products */}
          <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm p-6">
            <p className="text-sm font-bold text-slate-900 mb-0.5">Top Products</p>
            <p className="text-xs text-slate-400 mb-5">By number of installment plans created</p>
            {topProducts.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-sm text-slate-300">No data</div>
            ) : (
              <div className="space-y-4">
                {topProducts.map((p, i) => (
                  <div key={p.name} className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-lg text-[11px] font-black flex items-center justify-center shrink-0 ${
                      i === 0 ? 'bg-blue-100 text-blue-700' :
                      i === 1 ? 'bg-slate-100 text-slate-600' :
                      i === 2 ? 'bg-orange-100 text-orange-600' :
                                'bg-slate-50 text-slate-400'
                    }`}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-sm font-semibold text-slate-800 truncate" title={p.name}>{p.name}</p>
                        <span className="text-xs text-slate-400 shrink-0 ml-2">{p.count}</span>
                      </div>
                      <HBar value={p.count} max={maxProduct}/>
                    </div>
                    <p className="text-xs font-bold text-slate-700 shrink-0 w-24 text-right tabular-nums">{pkr(p.totalAmount)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Top debtors */}
        <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-900">Top Debtors</p>
              <p className="text-xs text-slate-400 mt-0.5">Active installments ranked by remaining balance</p>
            </div>
            {shopData && topDebtors.length > 0 && (
              <button
                onClick={() => setRemindAllConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-bold rounded-xl transition border border-green-200"
              >
                <Send size={12}/>
                Remind All
              </button>
            )}
          </div>
          {topDebtors.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-300">No active installments</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {topDebtors.map((d, i) => (
                <div key={d.phone + i} className="px-6 py-3.5 flex items-center gap-4 hover:bg-slate-50/60 transition">
                  <span className={`w-7 h-7 rounded-xl text-xs font-black flex items-center justify-center shrink-0 ${
                    i === 0 ? 'bg-amber-100 text-amber-700' :
                    i === 1 ? 'bg-slate-100 text-slate-600' :
                    i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-slate-50 text-slate-400'
                  }`}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{d.name}</p>
                    <p className="text-xs text-slate-400">{d.phone} · {d.count} plan{d.count !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-orange-600 tabular-nums">{pkr(d.remaining)}</p>
                    <p className="text-[10px] text-slate-400">remaining</p>
                  </div>
                  {shopData && (
                    <button
                      onClick={() => openWhatsApp(d.phone, reminderMessage({
                        shopName:     shopData.shopName,
                        customerName: d.name,
                        productName:  d.count > 1 ? `${d.count} active plans` : 'your installment',
                        monthly:      0,
                        remaining:    d.remaining,
                      }))}
                      title="Send WhatsApp reminder"
                      className="w-8 h-8 rounded-xl bg-green-50 hover:bg-green-100 flex items-center justify-center text-green-600 transition shrink-0 border border-green-200"
                    >
                      <MessageCircle size={14}/>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AVO Performance */}
        {isOwner && avoStats.length > 0 && (
          <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2.5">
              <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center">
                <UserCheck size={15} className="text-blue-500"/>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">AVO Performance</p>
                <p className="text-xs text-slate-400">Verification officers — approval rate and default risk</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-6 py-3 text-xs font-bold text-slate-500">Officer</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-slate-500">Total</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-slate-500">Approved</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-slate-500">Rejected</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-slate-500">Rate</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-slate-500">Defaults</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {avoStats.map((a: AvoStat) => {
                    const rate        = a.total > 0 ? Math.round((a.approved / a.total) * 100) : 0;
                    const defaultRate = a.approved > 0 ? Math.round((a.defaults / a.approved) * 100) : 0;
                    return (
                      <tr key={a.id} className="hover:bg-slate-50/60 transition">
                        <td className="px-6 py-3 font-semibold text-slate-900">{a.name}</td>
                        <td className="px-4 py-3 text-center text-slate-500 tabular-nums">{a.total}</td>
                        <td className="px-4 py-3 text-center tabular-nums"><span className="font-bold text-emerald-600">{a.approved}</span></td>
                        <td className="px-4 py-3 text-center tabular-nums"><span className="font-bold text-red-500">{a.rejected}</span></td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-lg text-xs font-bold ${
                            rate >= 70 ? 'bg-emerald-100 text-emerald-700' :
                            rate >= 50 ? 'bg-amber-100 text-amber-700' :
                                         'bg-red-100 text-red-600'
                          }`}>{rate}%</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {a.defaults > 0 ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-red-500">
                              <AlertTriangle size={11}/>{a.defaults} ({defaultRate}%)
                            </span>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Area-wise collections */}
        {areaRows.length > 0 && (
          <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2.5">
              <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center">
                <MapPin size={15} className="text-blue-500"/>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Area-wise Collections</p>
                <p className="text-xs text-slate-400">Customers and recovery grouped by delivery area</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-6 py-3 text-xs font-bold text-slate-500">Area</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-slate-500">Customers</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-slate-500">Active</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-slate-500">Overdue</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-slate-500">Overdue Amt</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-slate-500">Collected</th>
                    <th className="text-right px-6 py-3 text-xs font-bold text-slate-500">Remaining</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {areaRows.map((row) => {
                    const overdueAmt = Number(row.overdueAmount);
                    const collected  = Number(row.totalCollected);
                    const remaining  = Number(row.remaining);
                    return (
                      <tr key={row.area} className="hover:bg-slate-50/60 transition">
                        <td className="px-6 py-3 font-semibold text-slate-900">
                          <span className="flex items-center gap-1.5">
                            <MapPin size={11} className="text-slate-300 shrink-0"/>
                            {row.area}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-slate-500 tabular-nums">{row.customers}</td>
                        <td className="px-4 py-3 text-center font-bold text-blue-600 tabular-nums">{row.active}</td>
                        <td className="px-4 py-3 text-center">
                          {row.overdue > 0 ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-red-500">
                              <AlertTriangle size={11}/>{row.overdue}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {overdueAmt > 0 ? <span className="text-xs font-bold text-red-500">{pkr(overdueAmt)}</span> : <span className="text-xs text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600 tabular-nums text-xs">{pkr(collected)}</td>
                        <td className="px-6 py-3 text-right font-bold text-orange-600 tabular-nums text-xs">{pkr(remaining)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200">
                  <tr>
                    <td className="px-6 py-3 text-xs font-black text-slate-700">Total</td>
                    <td className="px-4 py-3 text-center text-xs font-black text-slate-700 tabular-nums">{areaRows.reduce((s,r) => s+r.customers, 0)}</td>
                    <td className="px-4 py-3 text-center text-xs font-black text-blue-700 tabular-nums">{areaRows.reduce((s,r) => s+r.active, 0)}</td>
                    <td className="px-4 py-3 text-center text-xs font-black text-red-600 tabular-nums">{areaRows.reduce((s,r) => s+r.overdue, 0)}</td>
                    <td className="px-4 py-3 text-right text-xs font-black text-red-600 tabular-nums">{pkr(areaRows.reduce((s,r) => s+Number(r.overdueAmount), 0))}</td>
                    <td className="px-4 py-3 text-right text-xs font-black text-emerald-700 tabular-nums">{pkr(areaRows.reduce((s,r) => s+Number(r.totalCollected), 0))}</td>
                    <td className="px-6 py-3 text-right text-xs font-black text-orange-700 tabular-nums">{pkr(areaRows.reduce((s,r) => s+Number(r.remaining), 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Overdue aging analysis */}
        {agingRows.length > 0 && (
          <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2.5">
              <div className="w-8 h-8 bg-red-50 rounded-xl flex items-center justify-center">
                <Activity size={15} className="text-red-500"/>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Overdue Aging Analysis (DPD)</p>
                <p className="text-xs text-slate-400">Days Past Due — installments grouped by how overdue they are</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
              {(['current', '1-7', '8-30', '31-90', '90+'] as const).map((bucket) => {
                const row = agingRows.find((r) => r.bucket === bucket);
                const count = row?.count ?? 0;
                const amt   = Number(row?.totalOutstanding ?? 0);
                const isCurrent  = bucket === 'current';
                const isVeryLate = bucket === '90+';
                const textColor  = isCurrent ? 'text-emerald-600' : isVeryLate ? 'text-red-600'  : 'text-orange-500';
                const bgColor    = isCurrent ? 'bg-emerald-50'    : isVeryLate ? 'bg-red-50'     : 'bg-orange-50';
                const labelColor = isCurrent ? 'text-emerald-700' : isVeryLate ? 'text-red-700'  : 'text-orange-600';
                return (
                  <div key={bucket} className={`px-5 py-4 text-center ${bgColor}`}>
                    <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${labelColor}`}>
                      {isCurrent ? 'Current' : `${bucket} days`}
                    </p>
                    <p className={`text-2xl font-black ${textColor} tabular-nums`}>{count}</p>
                    <p className="text-xs text-slate-500 mt-0.5 font-semibold tabular-nums">{pkr(amt)}</p>
                    <p className="text-[10px] text-slate-400">installments</p>
                  </div>
                );
              })}
            </div>
            {agingRows.some((r) => r.bucket !== 'current' && r.count > 0) && (
              <div className="px-6 py-3 bg-red-50 border-t border-red-100 flex items-center gap-2">
                <AlertTriangle size={13} className="text-red-500 shrink-0"/>
                <p className="text-xs text-red-600 font-semibold">
                  {agingRows.filter((r) => r.bucket !== 'current').reduce((s,r) => s+r.count, 0)} overdue installments —{' '}
                  {pkr(agingRows.filter((r) => r.bucket !== 'current').reduce((s,r) => s+Number(r.totalOutstanding), 0))} outstanding
                </p>
              </div>
            )}
          </div>
        )}

        {/* Referral leaderboard */}
        {referralRows.length > 0 && (
          <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2.5">
              <div className="w-8 h-8 bg-pink-50 rounded-xl flex items-center justify-center">
                <Gift size={15} className="text-pink-500"/>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Referral Leaderboard</p>
                <p className="text-xs text-slate-400">Customers who brought the most new customers</p>
              </div>
            </div>
            <div className="divide-y divide-slate-50">
              {referralRows.slice(0, 10).map((r, i) => (
                <div key={r.id} className="flex items-center gap-3 px-6 py-3 hover:bg-slate-50/60 transition">
                  <span className={`w-7 h-7 flex items-center justify-center rounded-xl text-xs font-black shrink-0 ${
                    i === 0 ? 'bg-amber-100 text-amber-700' :
                    i === 1 ? 'bg-slate-100 text-slate-600' :
                    i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-slate-50 text-slate-400'
                  }`}>{i + 1}</span>
                  {r.photoUrl
                    ? <img src={r.photoUrl} alt="" className="w-9 h-9 rounded-full object-cover shrink-0 ring-2 ring-white"/>
                    : <div className="w-9 h-9 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center text-sm font-bold shrink-0">{r.name[0]}</div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{r.name}</p>
                    {r.area && <p className="text-xs text-slate-400">{r.area}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-pink-600">{r.referralCount} referral{r.referralCount !== 1 ? 's' : ''}</p>
                    {r.activeCount > 0 && <p className="text-[10px] text-emerald-600">{r.activeCount} active</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Collections heatmap */}
        <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-emerald-50 rounded-xl flex items-center justify-center">
                <CalendarDays size={15} className="text-emerald-600"/>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Collections Heatmap</p>
                <p className="text-xs text-slate-400">Daily payment activity — darker = more collected</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-100 transition text-slate-500">
                <ChevronLeft size={15}/>
              </button>
              <span className="text-sm font-bold text-slate-700 min-w-[110px] text-center">
                {MONTH_NAMES_SHORT[hmMonth - 1]} {hmYear}
              </span>
              <button
                onClick={nextMonth}
                disabled={hmYear === now.getFullYear() && hmMonth === now.getMonth() + 1}
                className="p-1.5 rounded-lg hover:bg-slate-100 transition text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight size={15}/>
              </button>
            </div>
          </div>
          <div className="p-6">
            {heatmapDays.length > 0 ? (
              <>
                <div className="flex flex-wrap gap-3 mb-5">
                  {[
                    { label: 'Total Collected', value: pkr(heatmapDays.reduce((s,d) => s+d.total, 0)), color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
                    { label: 'Payment Days',    value: String(heatmapDays.filter((d) => d.count > 0).length), color: 'bg-blue-50 border-blue-200 text-blue-700' },
                    { label: 'Total Payments',  value: String(heatmapDays.reduce((s,d) => s+d.count, 0)),     color: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
                    {
                      label: 'Best Day',
                      value: (() => {
                        const best = heatmapDays.reduce((a,b) => b.total > a.total ? b : a, heatmapDays[0]!);
                        return best.total > 0 ? `${best.day} ${MONTH_NAMES_SHORT[hmMonth - 1]}` : '—';
                      })(),
                      color: 'bg-orange-50 border-orange-200 text-orange-700',
                    },
                  ].map(({ label, value, color }) => (
                    <div key={label} className={`px-4 py-3 rounded-xl border ${color} min-w-[120px]`}>
                      <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{label}</p>
                      <p className="text-lg font-black mt-0.5 tabular-nums">{value}</p>
                    </div>
                  ))}
                </div>
                <CollectionsHeatmap days={heatmapDays} year={hmYear} month={hmMonth}/>
              </>
            ) : (
              <div className="py-12 text-center text-slate-400 text-sm">No collections in this month</div>
            )}
          </div>
        </div>

        {/* ── Cohort Analysis ── */}
        {cohortRows.length > 0 && (
          <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm p-6">
            <div className="mb-5">
              <p className="text-sm font-bold text-slate-900">Cohort Analysis</p>
              <p className="text-xs text-slate-400 mt-0.5">Plans grouped by start month — completion vs default rate</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left text-xs font-bold text-slate-500 uppercase tracking-wide pb-3 pr-4">Month</th>
                    <th className="text-right text-xs font-bold text-slate-500 uppercase tracking-wide pb-3 px-3">New</th>
                    <th className="text-right text-xs font-bold text-emerald-600 uppercase tracking-wide pb-3 px-3">Completed</th>
                    <th className="text-right text-xs font-bold text-blue-600 uppercase tracking-wide pb-3 px-3">Active</th>
                    <th className="text-right text-xs font-bold text-red-500 uppercase tracking-wide pb-3 px-3">Defaulted</th>
                    <th className="text-right text-xs font-bold text-slate-500 uppercase tracking-wide pb-3 px-3">Completion</th>
                    <th className="text-right text-xs font-bold text-slate-500 uppercase tracking-wide pb-3 pl-3">Default Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {cohortRows.map((row) => (
                    <tr key={row.cohortMonth} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 pr-4 font-semibold text-slate-700 whitespace-nowrap">{row.cohortLabel}</td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900">{row.total}</td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-600">{row.completed}</td>
                      <td className="py-3 px-3 text-right font-bold text-blue-600">{row.active}</td>
                      <td className="py-3 px-3 text-right font-bold text-red-500">{row.defaulted}</td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-500 transition-all"
                              style={{ width: `${row.completionRate}%` }}
                            />
                          </div>
                          <span className={`font-bold text-xs w-9 text-right ${row.completionRate >= 60 ? 'text-emerald-600' : row.completionRate >= 30 ? 'text-amber-600' : 'text-slate-500'}`}>
                            {row.completionRate}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 pl-3 text-right">
                        <span className={`font-bold text-xs ${row.defaultRate >= 20 ? 'text-red-500' : row.defaultRate >= 10 ? 'text-amber-500' : 'text-slate-400'}`}>
                          {row.defaultRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Aggregate footer */}
            {(() => {
              const totals = cohortRows.reduce((acc, r) => ({
                total: acc.total + r.total,
                completed: acc.completed + r.completed,
                active: acc.active + r.active,
                defaulted: acc.defaulted + r.defaulted,
              }), { total: 0, completed: 0, active: 0, defaulted: 0 });
              const overallCompletion = totals.total > 0 ? Math.round((totals.completed / totals.total) * 100) : 0;
              const overallDefault    = totals.total > 0 ? Math.round((totals.defaulted  / totals.total) * 100) : 0;
              return (
                <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-4 text-xs text-slate-500">
                  <span>Total plans: <strong className="text-slate-800">{totals.total}</strong></span>
                  <span>Overall completion: <strong className="text-emerald-600">{overallCompletion}%</strong></span>
                  <span>Overall default rate: <strong className={overallDefault >= 15 ? 'text-red-500' : 'text-slate-600'}>{overallDefault}%</strong></span>
                </div>
              );
            })()}
          </div>
        )}

      </div>

      <ConfirmDialog
        open={remindAllConfirm}
        title={`${data?.topDebtors?.length ?? 0} customers ko reminder bhejo?`}
        description="Tamam debtors ko ek ke baad ek WhatsApp reminder khula jaega. Confirm karne ke baad browser tabs khulenge."
        confirmLabel="Remind All Bhejo"
        cancelLabel="Cancel"
        variant="warning"
        onConfirm={() => {
          if (shopData && data?.topDebtors) {
            data.topDebtors.forEach((d, i) => {
              setTimeout(() => openWhatsApp(d.phone, reminderMessage({
                shopName:     shopData.shopName,
                customerName: d.name,
                productName:  d.count > 1 ? `${d.count} active plans` : 'your installment',
                monthly:      0,
                remaining:    d.remaining,
              })), i * 600);
            });
          }
          setRemindAllConfirm(false);
        }}
        onCancel={() => setRemindAllConfirm(false)}
      />
    </>
  );
}
