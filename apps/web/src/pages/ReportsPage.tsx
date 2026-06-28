import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { statsApi, type Reports } from '../api/stats.api.ts';
import { verificationsApi, type AvoStat } from '../api/verifications.api.ts';
import { reportsApi, type AreaRow, type AgingBucket, type HeatmapDay, type ForecastMonth } from '../api/reports.api.ts';
import { customersApi } from '../api/customers.api.ts';
import { openWhatsApp, reminderMessage } from '../utils/whatsapp.ts';
import { sellersApi } from '../api/sellers.api.ts';
import { useAuthStore } from '../store/auth.store.ts';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Clock, MessageCircle, BarChart3, Send, UserCheck, MapPin, Activity, Gift, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import ConfirmDialog from '../components/ui/ConfirmDialog.tsx';

function pkr(v: number) {
  return 'PKR ' + v.toLocaleString('en-PK', { maximumFractionDigits: 0 });
}

// ── SVG collection rate ring ──────────────────────────────────────────────────
function RateRing({ rate }: { rate: number }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(rate, 100) / 100) * circ;
  const color = rate >= 80 ? '#16a34a' : rate >= 60 ? '#d97706' : '#dc2626';
  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx="70" cy="70" r={r} fill="none" stroke="#f3f4f6" strokeWidth="14" />
      <circle cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="14"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform="rotate(-90 70 70)"
        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
      />
      <text x="70" y="63" textAnchor="middle" fill="#111827"
        style={{ font: 'bold 26px system-ui' }}>{rate}%</text>
      <text x="70" y="82" textAnchor="middle" fill="#9ca3af"
        style={{ font: '11px system-ui' }}>collected</text>
    </svg>
  );
}

// ── Bar chart (no deps) ───────────────────────────────────────────────────────
function BarChart({ data }: { data: Reports['monthlyCollections'] }) {
  const max = Math.max(...data.map((d) => d.total), 1);
  const last = data[data.length - 1];
  return (
    <div className="flex items-end gap-1.5 h-40">
      {data.map((d) => {
        const isLast = d.month === last.month;
        return (
          <div key={d.month} className="flex-1 flex flex-col items-center gap-1 group relative">
            {d.total > 0 && (
              <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] font-medium px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none z-10 space-y-0.5">
                <div>{pkr(d.total)}</div>
                {d.cashSales > 0 && <div className="text-emerald-300">Cash: {pkr(d.cashSales)}</div>}
                {d.installments > 0 && <div className="text-blue-300">Inst: {pkr(d.installments)}</div>}
              </div>
            )}
            <div className="w-full flex-1 flex flex-col items-stretch justify-end">
              {d.cashSales > 0 && (
                <div
                  className="w-full bg-emerald-400 group-hover:bg-emerald-500 transition-all duration-500"
                  style={{ height: `${Math.max((d.cashSales / max) * 100, 2)}%` }}
                />
              )}
              <div
                className={`w-full rounded-t-md transition-all duration-500 ${isLast ? 'bg-blue-600' : 'bg-blue-100 group-hover:bg-blue-400'}`}
                style={{ height: `${Math.max((d.installments / max) * 100, d.installments > 0 ? 2 : 0)}%`, minHeight: d.total > 0 && d.cashSales === 0 ? '4px' : '0' }}
              />
            </div>
            <span className="text-[9px] text-gray-400 leading-none">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Horizontal bar (for top products) ────────────────────────────────────────
function HBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ── Aging bucket card ─────────────────────────────────────────────────────────
function AgingCard({
  label, count, sublabel, bg, text, icon: Icon,
}: {
  label: string; count: number; sublabel: string;
  bg: string; text: string; icon: typeof CheckCircle;
}) {
  return (
    <div className={`${bg} rounded-2xl p-5 flex flex-col gap-2`}>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-semibold ${text}`}>{label}</span>
        <Icon size={16} className={text} />
      </div>
      <p className={`text-3xl font-extrabold ${text}`}>{count}</p>
      <p className="text-xs text-gray-500">{sublabel}</p>
    </div>
  );
}

// ── 3-Month Forecast ──────────────────────────────────────────────────────────
function ForecastSection({ months }: { months: ForecastMonth[] }) {
  if (!months.length) return null;
  const maxAmount = Math.max(...months.map((m) => m.expectedAmount), 1);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <CalendarDays size={16} className="text-indigo-600" />
        <h2 className="text-sm font-semibold text-gray-900">3-Month Collection Forecast</h2>
        <span className="text-xs text-gray-400 ml-1">if all pay on time</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {months.map((m, i) => {
          const barPct  = maxAmount > 0 ? (m.expectedAmount / maxAmount) * 100 : 0;
          const opacity = i === 0 ? 'bg-indigo-600' : i === 1 ? 'bg-indigo-400' : 'bg-indigo-200';
          return (
            <div key={m.month} className="flex flex-col gap-2">
              <div className="bg-gray-50 rounded-xl p-3 flex-1">
                <p className="text-xs font-medium text-gray-500 mb-1">{m.monthName.split(' ')[0]}</p>
                <p className="text-lg font-bold text-gray-900">
                  {pkr(m.expectedAmount)}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {m.installmentCount} installment{m.installmentCount !== 1 ? 's' : ''}
                </p>
                {m.dailyAmount > 0 && (
                  <div className="mt-1.5 flex gap-1 text-[10px]">
                    <span className="text-indigo-600">{pkr(m.monthlyAmount)} monthly</span>
                    <span className="text-gray-300">·</span>
                    <span className="text-emerald-600">{pkr(m.dailyAmount)} daily</span>
                  </div>
                )}
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${opacity}`}
                  style={{ width: `${barPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-gray-400 mt-3">
        Based on {months[0]?.installmentCount ?? 0} active installments · amounts decrease as plans complete
      </p>
    </div>
  );
}

// ── Skeleton loader ───────────────────────────────────────────────────────────
function Skeleton({ className }: { className: string }) {
  return <div className={`bg-gray-100 rounded-xl animate-pulse ${className}`} />;
}

const MONTH_NAMES_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// ── Collections Calendar Heatmap ──────────────────────────────────────────────
function CollectionsHeatmap({
  days, year, month,
}: { days: HeatmapDay[]; year: number; month: number }) {
  if (!days.length) return null;

  const maxTotal = Math.max(...days.map((d) => d.total), 1);

  // intensity: 0 = no data, 1-4 tiers
  function intensity(total: number) {
    if (total === 0) return 0;
    const pct = total / maxTotal;
    if (pct < 0.25) return 1;
    if (pct < 0.5)  return 2;
    if (pct < 0.75) return 3;
    return 4;
  }

  const cellBg = ['bg-gray-100', 'bg-emerald-100', 'bg-emerald-300', 'bg-emerald-500', 'bg-emerald-700'];
  const cellText = ['text-gray-400', 'text-emerald-700', 'text-emerald-800', 'text-white', 'text-white'];

  // first weekday of month
  const firstDow = new Date(year, month - 1, 1).getDay();
  const cells: (HeatmapDay | null)[] = [
    ...Array(firstDow).fill(null),
    ...days,
  ];
  // pad to multiple of 7
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (HeatmapDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[340px]">
        {/* day-of-week header */}
        <div className="grid grid-cols-7 mb-1">
          {DAY_LABELS.map((d) => (
            <div key={d} className="text-[10px] text-center text-gray-400 font-medium py-1">{d}</div>
          ))}
        </div>
        {/* weeks */}
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1 mb-1">
            {week.map((cell, di) => {
              if (!cell) return <div key={di} />;
              const iv = intensity(cell.total);
              return (
                <div
                  key={di}
                  title={cell.total > 0 ? `${cell.day}: ${pkr(cell.total)} (${cell.count} payments)` : `${cell.day}: no collections`}
                  className={`aspect-square rounded-md flex flex-col items-center justify-center cursor-default transition-transform hover:scale-105 ${cellBg[iv]}`}
                >
                  <span className={`text-[10px] font-bold leading-none ${cellText[iv]}`}>{cell.day}</span>
                  {cell.total > 0 && (
                    <span className={`text-[8px] leading-none mt-0.5 ${cellText[iv]} opacity-80`}>
                      {cell.count}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        {/* legend */}
        <div className="flex items-center gap-2 mt-3 justify-end">
          <span className="text-[10px] text-gray-400">Less</span>
          {cellBg.map((bg, i) => (
            <div key={i} className={`w-3 h-3 rounded-sm ${bg}`} />
          ))}
          <span className="text-[10px] text-gray-400">More</span>
        </div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const user = useAuthStore((s) => s.user);
  const isOwner    = user?.role === 'SELLER_OWNER';
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
    const isCurrentMonth = hmYear === now.getFullYear() && hmMonth === now.getMonth() + 1;
    if (isCurrentMonth) return;
    if (hmMonth === 12) { setHmYear((y) => y + 1); setHmMonth(1); }
    else setHmMonth((m) => m + 1);
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports'],
    queryFn:  statsApi.getReports,
    staleTime: 60_000,
    enabled:  canReports,
    retry:    false,
  });
  const { data: shopData } = useQuery({ queryKey: ['shop-me'], queryFn: sellersApi.getMe });
  const { data: avoStats = [] } = useQuery({
    queryKey: ['avo-stats'],
    queryFn:  verificationsApi.avoStats,
    staleTime: 60_000,
    enabled:  isOwner,
  });

  const { data: areaRows = [] } = useQuery<AreaRow[]>({
    queryKey: ['area-report'],
    queryFn:  reportsApi.getAreaReport,
    staleTime: 2 * 60_000,
    enabled:  canReports,
  });

  const { data: referralRows = [] } = useQuery({
    queryKey: ['referral-leaderboard'],
    queryFn: customersApi.getReferralLeaderboard,
    staleTime: 5 * 60_000,
    enabled: canReports,
  });

  const { data: agingRows = [] } = useQuery<AgingBucket[]>({
    queryKey: ['aging-report'],
    queryFn:  reportsApi.getAgingReport,
    staleTime: 3 * 60_000,
    enabled:  canReports,
  });

  const { data: heatmapDays = [] } = useQuery<HeatmapDay[]>({
    queryKey: ['collections-heatmap', hmYear, hmMonth],
    queryFn:  () => reportsApi.getCollectionsHeatmap(hmYear, hmMonth),
    staleTime: 5 * 60_000,
    enabled:  canReports,
  });

  const { data: forecastMonths = [] } = useQuery<ForecastMonth[]>({
    queryKey: ['forecast'],
    queryFn:  reportsApi.getForecast,
    staleTime: 10 * 60_000,
    enabled:  canReports,
  });

  if (!canReports) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-64 text-center">
        <BarChart3 size={36} className="text-gray-200 mb-3" />
        <p className="text-sm font-semibold text-gray-500">Access restricted</p>
        <p className="text-xs text-gray-400 mt-1">Your account doesn't have permission to view analytics.</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-64 text-center">
        <BarChart3 size={36} className="text-gray-200 mb-3" />
        <p className="text-sm font-semibold text-gray-500">Failed to load analytics</p>
        <p className="text-xs text-gray-400 mt-1">Please refresh the page and try again.</p>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-52" />
          <Skeleton className="h-52" />
          <Skeleton className="h-52" />
        </div>
        <Skeleton className="h-64" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const { monthlyCollections, collectionRate, agingBuckets, topDebtors, topProducts } = data;
  const maxProduct = Math.max(...topProducts.map((p) => p.count), 1);

  const thisMonth  = monthlyCollections[monthlyCollections.length - 1]?.total ?? 0;
  const lastMonth  = monthlyCollections[monthlyCollections.length - 2]?.total ?? 0;
  const momChange  = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : null;
  const totalOverdue = agingBuckets.days1_30 + agingBuckets.days31_60 + agingBuckets.days60plus;

  return (
    <div className="px-4 py-5 sm:p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <BarChart3 size={20} className="text-blue-600" />
            Analytics & Reports
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Last 12 months · All figures in PKR</p>
        </div>
        {shopData && topDebtors.length > 0 && (
          <button
            onClick={() => setRemindAllConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl transition shadow-sm"
          >
            <Send size={14} />
            Remind All ({topDebtors.length})
          </button>
        )}
      </div>

      {/* 3-Month Forecast */}
      {forecastMonths.length > 0 && <ForecastSection months={forecastMonths} />}

      {/* Row 1: Collection rate + summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        {/* Collection rate ring */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Collection Rate</p>
          <RateRing rate={collectionRate.rate} />
          <div className="text-center">
            <p className="text-xs text-gray-400">
              {pkr(collectionRate.totalCollected)} collected
            </p>
            <p className="text-xs text-gray-300">of {pkr(collectionRate.totalBilled)} total billed</p>
          </div>
        </div>

        {/* This month */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">This Month</p>
            <p className="text-3xl font-extrabold text-gray-900 mt-2">{pkr(thisMonth)}</p>
          </div>
          {momChange !== null && (
            <div className={`inline-flex items-center gap-1 text-xs font-semibold mt-4 ${momChange >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {momChange >= 0
                ? <TrendingUp size={14} />
                : <TrendingDown size={14} />}
              {Math.abs(momChange)}% vs last month
            </div>
          )}
          <p className="text-xs text-gray-400 mt-1">Last month: {pkr(lastMonth)}</p>
        </div>

        {/* Overdue summary */}
        <div className={`rounded-2xl p-6 shadow-sm flex flex-col justify-between ${totalOverdue > 0 ? 'bg-red-50 border border-red-100' : 'bg-emerald-50 border border-emerald-100'}`}>
          <div>
            <p className={`text-xs font-semibold uppercase tracking-widest mb-1 ${totalOverdue > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
              Overdue Installments
            </p>
            <p className={`text-3xl font-extrabold mt-2 ${totalOverdue > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
              {totalOverdue}
            </p>
          </div>
          {totalOverdue > 0
            ? <p className="text-xs text-red-400 mt-4 flex items-center gap-1"><AlertTriangle size={12} /> Requires follow-up</p>
            : <p className="text-xs text-emerald-500 mt-4 flex items-center gap-1"><CheckCircle size={12} /> All plans on track</p>}
          <p className="text-xs text-gray-400 mt-1">{agingBuckets.current} plans on schedule</p>
        </div>
      </div>

      {/* Row 2: Monthly bar chart */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm font-semibold text-gray-900">Monthly Revenue</p>
            <p className="text-xs text-gray-400 mt-0.5">Installment payments + cash sales (last 12 months)</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-600 rounded-sm inline-block" /> Installments</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-400 rounded-sm inline-block" /> Cash Sales</span>
          </div>
        </div>
        {monthlyCollections.every((m) => m.total === 0) ? (
          <div className="h-40 flex items-center justify-center text-sm text-gray-300">
            No payment data yet
          </div>
        ) : (
          <BarChart data={monthlyCollections} />
        )}
      </div>

      {/* Row 3: Aging buckets + Top products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Aging buckets */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <p className="text-sm font-semibold text-gray-900 mb-1">Installment Aging</p>
          <p className="text-xs text-gray-400 mb-5">Active plans bucketed by days past due date</p>
          <div className="grid grid-cols-2 gap-3">
            <AgingCard
              label="On Schedule" count={agingBuckets.current}
              sublabel="Due date not reached"
              bg="bg-emerald-50" text="text-emerald-600" icon={CheckCircle}
            />
            <AgingCard
              label="1–30 Days Late" count={agingBuckets.days1_30}
              sublabel="Early overdue"
              bg="bg-amber-50" text="text-amber-600" icon={Clock}
            />
            <AgingCard
              label="31–60 Days Late" count={agingBuckets.days31_60}
              sublabel="Action needed"
              bg="bg-orange-50" text="text-orange-600" icon={AlertTriangle}
            />
            <AgingCard
              label="60+ Days Late" count={agingBuckets.days60plus}
              sublabel="Critical overdue"
              bg="bg-red-50" text="text-red-600" icon={AlertTriangle}
            />
          </div>
        </div>

        {/* Top products */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <p className="text-sm font-semibold text-gray-900 mb-1">Top Products</p>
          <p className="text-xs text-gray-400 mb-5">By number of installments created</p>
          {topProducts.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm text-gray-300">No data</div>
          ) : (
            <div className="space-y-4">
              {topProducts.map((p, i) => (
                <div key={p.name} className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-sm font-medium text-gray-800 truncate" title={p.name}>{p.name}</p>
                      <span className="text-xs text-gray-400 shrink-0 ml-2">{p.count} plans</span>
                    </div>
                    <HBar value={p.count} max={maxProduct} color="bg-blue-500" />
                  </div>
                  <p className="text-xs font-semibold text-gray-700 shrink-0 w-24 text-right">{pkr(p.totalAmount)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Row 4: Top debtors */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-50">
          <p className="text-sm font-semibold text-gray-900">Top Debtors</p>
          <p className="text-xs text-gray-400 mt-0.5">Active installments ranked by total remaining balance</p>
        </div>
        {topDebtors.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-300">No active installments</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {topDebtors.map((d, i) => (
              <div key={d.phone + i} className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50 transition">
                <span className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate" title={d.name}>{d.name}</p>
                  <p className="text-xs text-gray-400">{d.phone} · {d.count} active plan{d.count !== 1 ? 's' : ''}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-orange-600">{pkr(d.remaining)}</p>
                  <p className="text-xs text-gray-400">remaining</p>
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
                    className="w-8 h-8 rounded-lg bg-green-50 hover:bg-green-100 flex items-center justify-center text-green-600 transition shrink-0"
                  >
                    <MessageCircle size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Row 5: AVO Performance (owner only) */}
      {isOwner && avoStats.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-50 flex items-center gap-2">
            <UserCheck size={16} className="text-blue-500" />
            <div>
              <p className="text-sm font-semibold text-gray-900">AVO Performance</p>
              <p className="text-xs text-gray-400 mt-0.5">Verification officers — approval rate and default risk</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Officer</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Total</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Approved</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Rejected</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Approval Rate</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Defaults</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {avoStats.map((a: AvoStat) => {
                  const rate = a.total > 0 ? Math.round((a.approved / a.total) * 100) : 0;
                  const defaultRate = a.approved > 0 ? Math.round((a.defaults / a.approved) * 100) : 0;
                  return (
                    <tr key={a.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-3 font-medium text-gray-900">{a.name}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{a.total}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-emerald-600 font-semibold">{a.approved}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-red-500 font-semibold">{a.rejected}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                          rate >= 70 ? 'bg-emerald-100 text-emerald-700' :
                          rate >= 50 ? 'bg-amber-100 text-amber-700' :
                                       'bg-red-100 text-red-600'
                        }`}>{rate}%</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {a.defaults > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-500">
                            <AlertTriangle size={11} />{a.defaults} ({defaultRate}%)
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
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

      {/* Row 6: Area-wise collections */}
      {areaRows.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-50 flex items-center gap-2">
            <MapPin size={16} className="text-blue-500" />
            <div>
              <p className="text-sm font-semibold text-gray-900">Area-wise Collections</p>
              <p className="text-xs text-gray-400 mt-0.5">Customers and recovery grouped by delivery area</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Area</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Customers</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Active</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Overdue</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Overdue Amt</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Collected</th>
                  <th className="text-right px-6 py-3 font-medium text-gray-500">Remaining</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {areaRows.map((row) => {
                  const overdueAmt = Number(row.overdueAmount);
                  const collected  = Number(row.totalCollected);
                  const remaining  = Number(row.remaining);
                  return (
                    <tr key={row.area} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-3 font-medium text-gray-900 flex items-center gap-1.5">
                        <MapPin size={12} className="text-gray-300 shrink-0" />
                        {row.area}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">{row.customers}</td>
                      <td className="px-4 py-3 text-center text-blue-600 font-semibold">{row.active}</td>
                      <td className="px-4 py-3 text-center">
                        {row.overdue > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-500">
                            <AlertTriangle size={11} />{row.overdue}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {overdueAmt > 0 ? (
                          <span className="text-xs font-semibold text-red-500">{pkr(overdueAmt)}</span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-semibold">{pkr(collected)}</td>
                      <td className="px-6 py-3 text-right text-orange-600 font-semibold">{pkr(remaining)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-100">
                <tr>
                  <td className="px-6 py-3 text-xs font-bold text-gray-700">Total</td>
                  <td className="px-4 py-3 text-center text-xs font-bold text-gray-700">
                    {areaRows.reduce((s, r) => s + r.customers, 0)}
                  </td>
                  <td className="px-4 py-3 text-center text-xs font-bold text-blue-700">
                    {areaRows.reduce((s, r) => s + r.active, 0)}
                  </td>
                  <td className="px-4 py-3 text-center text-xs font-bold text-red-600">
                    {areaRows.reduce((s, r) => s + r.overdue, 0)}
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-red-600">
                    {pkr(areaRows.reduce((s, r) => s + Number(r.overdueAmount), 0))}
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-emerald-700">
                    {pkr(areaRows.reduce((s, r) => s + Number(r.totalCollected), 0))}
                  </td>
                  <td className="px-6 py-3 text-right text-xs font-bold text-orange-700">
                    {pkr(areaRows.reduce((s, r) => s + Number(r.remaining), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Overdue Aging Analysis */}
      {agingRows.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden mt-6">
          <div className="px-6 py-5 border-b border-gray-50 flex items-center gap-2">
            <Activity size={16} className="text-red-500" />
            <div>
              <p className="text-sm font-semibold text-gray-900">Overdue Aging Analysis (DPD)</p>
              <p className="text-xs text-gray-400">Days Past Due — active installments grouped by how overdue they are</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
            {(['current', '1-7', '8-30', '31-90', '90+'] as const).map((bucket) => {
              const row = agingRows.find((r) => r.bucket === bucket);
              const count = row?.count ?? 0;
              const amt   = Number(row?.totalOutstanding ?? 0);
              const isCurrent  = bucket === 'current';
              const isVeryLate = bucket === '90+';
              const textColor  = isCurrent ? 'text-green-600' : isVeryLate ? 'text-red-600' : 'text-orange-500';
              const labelColor = isCurrent ? 'text-green-700' : isVeryLate ? 'text-red-700' : 'text-orange-600';
              const bgColor    = isCurrent ? 'bg-green-50'   : isVeryLate ? 'bg-red-50'    : 'bg-orange-50';
              const label = isCurrent ? 'Current' : `${bucket} days`;
              return (
                <div key={bucket} className={`px-5 py-4 text-center ${bgColor}`}>
                  <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${labelColor}`}>{label}</p>
                  <p className={`text-xl font-extrabold ${textColor}`}>{count}</p>
                  <p className="text-xs text-gray-500 mt-0.5 font-medium">{pkr(amt)}</p>
                  <p className="text-[10px] text-gray-400">installments</p>
                </div>
              );
            })}
          </div>
          {agingRows.some((r) => r.bucket !== 'current' && r.count > 0) && (
            <div className="px-6 py-3 bg-red-50 border-t border-red-100">
              <p className="text-xs text-red-600 font-medium">
                ⚠ {agingRows.filter((r) => r.bucket !== 'current').reduce((s, r) => s + r.count, 0)} overdue installments —&nbsp;
                {pkr(agingRows.filter((r) => r.bucket !== 'current').reduce((s, r) => s + Number(r.totalOutstanding), 0))} outstanding
              </p>
            </div>
          )}
        </div>
      )}

      {referralRows.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden mt-6">
          <div className="px-6 py-5 border-b border-gray-50 flex items-center gap-2">
            <Gift size={16} className="text-pink-500" />
            <div>
              <p className="text-sm font-semibold text-gray-900">Referral Leaderboard</p>
              <p className="text-xs text-gray-400">Customers who brought the most new customers to the shop</p>
            </div>
          </div>
          <div className="divide-y divide-gray-50">
            {referralRows.slice(0, 10).map((r, i) => (
              <div key={r.id} className="flex items-center gap-3 px-6 py-3">
                <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold shrink-0 ${
                  i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-gray-100 text-gray-600' : i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-gray-50 text-gray-400'
                }`}>
                  {i + 1}
                </span>
                {r.photoUrl
                  ? <img src={r.photoUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                  : <div className="w-8 h-8 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center text-xs font-bold shrink-0">{r.name[0]}</div>
                }
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{r.name}</p>
                  {r.area && <p className="text-xs text-gray-400">{r.area}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-pink-600">{r.referralCount} referral{r.referralCount !== 1 ? 's' : ''}</p>
                  {r.activeCount > 0 && <p className="text-[10px] text-emerald-600">{r.activeCount} active</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Collections Heatmap Calendar */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden mt-6">
        <div className="px-6 py-5 border-b border-gray-50 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-emerald-500" />
            <div>
              <p className="text-sm font-semibold text-gray-900">Collections Heatmap</p>
              <p className="text-xs text-gray-400">Daily payment activity — darker = more collected</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={prevMonth}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="text-sm font-semibold text-gray-700 min-w-[110px] text-center">
              {MONTH_NAMES_SHORT[hmMonth - 1]} {hmYear}
            </span>
            <button
              onClick={nextMonth}
              disabled={hmYear === now.getFullYear() && hmMonth === now.getMonth() + 1}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
        <div className="px-6 py-5">
          {heatmapDays.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-4 mb-5">
                <div className="bg-emerald-50 rounded-xl px-4 py-3 min-w-[120px]">
                  <p className="text-xs text-emerald-600 font-medium">Total Collected</p>
                  <p className="text-lg font-extrabold text-emerald-700">
                    {pkr(heatmapDays.reduce((s, d) => s + d.total, 0))}
                  </p>
                </div>
                <div className="bg-blue-50 rounded-xl px-4 py-3 min-w-[120px]">
                  <p className="text-xs text-blue-600 font-medium">Payment Days</p>
                  <p className="text-lg font-extrabold text-blue-700">
                    {heatmapDays.filter((d) => d.count > 0).length}
                  </p>
                </div>
                <div className="bg-purple-50 rounded-xl px-4 py-3 min-w-[120px]">
                  <p className="text-xs text-purple-600 font-medium">Total Payments</p>
                  <p className="text-lg font-extrabold text-purple-700">
                    {heatmapDays.reduce((s, d) => s + d.count, 0)}
                  </p>
                </div>
                <div className="bg-orange-50 rounded-xl px-4 py-3 min-w-[120px]">
                  <p className="text-xs text-orange-600 font-medium">Best Day</p>
                  <p className="text-lg font-extrabold text-orange-700">
                    {(() => {
                      const best = heatmapDays.reduce((a, b) => b.total > a.total ? b : a, heatmapDays[0]!);
                      return best.total > 0 ? `${best.day} ${MONTH_NAMES_SHORT[hmMonth - 1]}` : '—';
                    })()}
                  </p>
                </div>
              </div>
              <CollectionsHeatmap days={heatmapDays} year={hmYear} month={hmMonth} />
            </>
          ) : (
            <div className="py-10 text-center text-gray-400 text-sm">No collections in this month</div>
          )}
        </div>
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
                shopName: shopData.shopName,
                customerName: d.name,
                productName: d.count > 1 ? `${d.count} active plans` : 'your installment',
                monthly: 0,
                remaining: d.remaining,
              })), i * 600);
            });
          }
          setRemindAllConfirm(false);
        }}
        onCancel={() => setRemindAllConfirm(false)}
      />
    </div>
  );
}
