import { useQuery } from '@tanstack/react-query';
import { statsApi, type Reports } from '../api/stats.api.ts';
import { verificationsApi, type AvoStat } from '../api/verifications.api.ts';
import { openWhatsApp, reminderMessage } from '../utils/whatsapp.ts';
import { sellersApi } from '../api/sellers.api.ts';
import { useAuthStore } from '../store/auth.store.ts';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Clock, MessageCircle, BarChart3, Send, UserCheck } from 'lucide-react';

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
        const pct = Math.max((d.total / max) * 100, d.total > 0 ? 2 : 0);
        const isLast = d.month === last.month;
        return (
          <div key={d.month} className="flex-1 flex flex-col items-center gap-1 group relative">
            {d.total > 0 && (
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none z-10">
                {pkr(d.total)}
              </div>
            )}
            <div className="w-full flex-1 flex items-end">
              <div
                className={`w-full rounded-t-md transition-all duration-500 ${isLast ? 'bg-blue-600' : 'bg-blue-100 group-hover:bg-blue-400'}`}
                style={{ height: `${pct}%`, minHeight: d.total > 0 ? '4px' : '0' }}
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

// ── Skeleton loader ───────────────────────────────────────────────────────────
function Skeleton({ className }: { className: string }) {
  return <div className={`bg-gray-100 rounded-xl animate-pulse ${className}`} />;
}

export default function ReportsPage() {
  const user = useAuthStore((s) => s.user);
  const isOwner    = user?.role === 'SELLER_OWNER';
  const canReports = isOwner || !!user?.permissions?.canViewReports;

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
            onClick={() => {
              if (!confirm(`Send WhatsApp reminder to all ${topDebtors.length} debtors?`)) return;
              topDebtors.forEach((d, i) => {
                setTimeout(() => openWhatsApp(d.phone, reminderMessage({
                  shopName: shopData.shopName,
                  customerName: d.name,
                  productName: d.count > 1 ? `${d.count} active plans` : 'your installment',
                  monthly: 0,
                  remaining: d.remaining,
                })), i * 600);
              });
            }}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl transition shadow-sm"
          >
            <Send size={14} />
            Remind All ({topDebtors.length})
          </button>
        )}
      </div>

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
            <p className="text-sm font-semibold text-gray-900">Monthly Collections</p>
            <p className="text-xs text-gray-400 mt-0.5">Payments received per month (last 12 months)</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="w-3 h-3 bg-blue-100 rounded-sm inline-block" /> Previous
            <span className="w-3 h-3 bg-blue-600 rounded-sm inline-block ml-2" /> Current
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

    </div>
  );
}
