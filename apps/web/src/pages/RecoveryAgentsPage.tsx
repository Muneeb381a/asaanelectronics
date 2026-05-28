import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Users, Calendar, Image, Phone } from 'lucide-react';
import { recoveryAgentsApi, type AgentStat, type AgentCollection } from '../api/recovery-agents.api.ts';
import { RowSkeleton } from '../components/ui/Skeleton.tsx';

function pkr(v: number) {
  return 'PKR ' + v.toLocaleString('en-PK', { maximumFractionDigits: 0 });
}

const METHOD_COLORS: Record<string, string> = {
  CASH:      'bg-green-100 text-green-700',
  BANK:      'bg-blue-100 text-blue-700',
  JAZZCASH:  'bg-red-100 text-red-700',
  EASYPAISA: 'bg-teal-100 text-teal-700',
  OTHER:     'bg-gray-100 text-gray-600',
};

function StatCard({ label, value, sub, color = 'blue' }: {
  label: string; value: string; sub?: string; color?: 'blue' | 'green' | 'violet' | 'orange';
}) {
  const bg: Record<string, string> = {
    blue:   'bg-blue-50',
    green:  'bg-green-50',
    violet: 'bg-violet-50',
    orange: 'bg-orange-50',
  };
  const text: Record<string, string> = {
    blue:   'text-blue-700',
    green:  'text-green-700',
    violet: 'text-violet-700',
    orange: 'text-orange-700',
  };
  return (
    <div className={`${bg[color]} rounded-xl px-4 py-3`}>
      <p className="text-[11px] text-gray-400 font-medium mb-1">{label}</p>
      <p className={`text-base font-bold ${text[color]}`}>{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function AgentCard({ stat, onDrill }: { stat: AgentStat; onDrill: () => void }) {
  const initials = stat.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <button
      onClick={onDrill}
      className="bg-white border border-gray-100 rounded-2xl p-5 text-left hover:border-blue-200 hover:shadow-md transition-all group w-full"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 truncate">{stat.name}</p>
          <p className="text-xs text-gray-400">{stat.collectionCount} total collections</p>
        </div>
        <ArrowLeft size={14} className="ml-auto text-gray-300 group-hover:text-blue-500 rotate-180 transition" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Total Recovered" value={pkr(stat.totalCollected)} color="green" />
        <StatCard label="This Month" value={pkr(stat.thisMonthTotal)} sub={`${stat.thisMonthCount} collections`} color="blue" />
      </div>

      {stat.lastCollectedAt && (
        <p className="text-[11px] text-gray-400 mt-3 flex items-center gap-1.5">
          <Calendar size={11} />
          Last: {new Date(stat.lastCollectedAt).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
        </p>
      )}
    </button>
  );
}

function CollectionRow({ c }: { c: AgentCollection }) {
  return (
    <div className="flex items-start gap-4 py-3.5 px-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-gray-900">{c.customerName}</p>
          {c.customerPhone && (
            <a href={`tel:${c.customerPhone}`} className="flex items-center gap-1 text-[11px] text-blue-500 hover:underline">
              <Phone size={10} />{c.customerPhone}
            </a>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-0.5">{c.productName}</p>
        {c.note && <p className="text-[11px] text-gray-400 italic mt-0.5">{c.note}</p>}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-bold text-gray-900">PKR {Number(c.amount).toLocaleString('en-PK', { maximumFractionDigits: 0 })}</p>
        <div className="flex items-center justify-end gap-1.5 mt-1">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${METHOD_COLORS[c.method] ?? METHOD_COLORS.OTHER}`}>
            {c.method}
          </span>
          <span className="text-[10px] text-gray-400">
            {new Date(c.paidOn).toLocaleDateString('en-PK', { day: '2-digit', month: 'short' })}
          </span>
          {c.proofImageUrl && (
            <a href={c.proofImageUrl} target="_blank" rel="noreferrer"
              className="text-blue-400 hover:text-blue-600 transition">
              <Image size={13} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function AgentDrillDown({ stat, onBack }: { stat: AgentStat; onBack: () => void }) {
  const [page, setPage] = useState(1);
  const LIMIT = 25;

  const { data, isLoading } = useQuery({
    queryKey: ['recovery-agent-collections', stat.userId, page],
    queryFn:  () => recoveryAgentsApi.collections(stat.userId, page, LIMIT),
  });

  const initials = stat.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div>
      {/* Back + header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="p-2 rounded-xl hover:bg-gray-100 transition text-gray-500">
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold">
            {initials}
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">{stat.name}</h2>
            <p className="text-xs text-gray-400">Recovery Agent</p>
          </div>
        </div>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Recovered"    value={pkr(stat.totalCollected)} color="green" />
        <StatCard label="Total Collections"  value={String(stat.collectionCount)} color="violet" />
        <StatCard label="This Month"         value={pkr(stat.thisMonthTotal)} sub={`${stat.thisMonthCount} payments`} color="blue" />
        <StatCard label="Last Active"
          value={stat.lastCollectedAt
            ? new Date(stat.lastCollectedAt).toLocaleDateString('en-PK', { day: '2-digit', month: 'short' })
            : '—'}
          color="orange" />
      </div>

      {/* Collections list */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700">All Collections</p>
          {data && <p className="text-xs text-gray-400">{data.total} records</p>}
        </div>

        {isLoading ? (
          <div className="p-4"><RowSkeleton rows={5} /></div>
        ) : !data?.data.length ? (
          <p className="text-sm text-gray-400 text-center py-12">No collections recorded yet.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {data.data.map((c) => <CollectionRow key={c.id} c={c} />)}
          </div>
        )}

        {data && data.total > LIMIT && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, data.total)} of {data.total}
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                Prev
              </button>
              <button
                disabled={page * LIMIT >= data.total}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RecoveryAgentsPage() {
  const [selected, setSelected] = useState<AgentStat | null>(null);

  const { data: stats = [], isLoading } = useQuery({
    queryKey: ['recovery-agents-stats'],
    queryFn:  recoveryAgentsApi.stats,
  });

  if (selected) {
    return (
      <div className="px-4 py-5 sm:p-6 max-w-4xl mx-auto">
        <AgentDrillDown stat={selected} onBack={() => setSelected(null)} />
      </div>
    );
  }

  const totalAgents     = stats.length;
  const totalRecovered  = stats.reduce((s, a) => s + a.totalCollected, 0);
  const thisMonthTotal  = stats.reduce((s, a) => s + a.thisMonthTotal, 0);
  const totalCount      = stats.reduce((s, a) => s + a.collectionCount, 0);

  return (
    <div className="px-4 py-5 sm:p-6 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Recovery Agents</h1>
        <p className="text-sm text-gray-500 mt-0.5">Track performance — who collected how much, from whom, and how</p>
      </div>

      {/* Top summary */}
      {!isLoading && stats.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard label="Active Agents"    value={String(totalAgents)}   color="violet" />
          <StatCard label="Total Recovered"  value={pkr(totalRecovered)}   color="green"  />
          <StatCard label="This Month"       value={pkr(thisMonthTotal)}   color="blue"   />
          <StatCard label="Total Collections" value={String(totalCount)}   color="orange" />
        </div>
      )}

      {/* Agent cards */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3">
              <RowSkeleton rows={3} />
            </div>
          ))}
        </div>
      ) : stats.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center">
          <div className="w-12 h-12 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users size={22} className="text-violet-400" />
          </div>
          <p className="text-sm font-semibold text-gray-700 mb-1">No agents yet</p>
          <p className="text-xs text-gray-400 max-w-xs mx-auto">
            Add staff members and assign them to collect payments. Their performance will appear here.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.map((s) => (
            <AgentCard key={s.userId} stat={s} onDrill={() => setSelected(s)} />
          ))}
        </div>
      )}
    </div>
  );
}
