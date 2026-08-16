import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Users, Image, Phone, TrendingUp,
  ChevronRight, ChevronLeft, Activity, Clock,
} from 'lucide-react';
import { recoveryAgentsApi, type AgentStat, type AgentCollection } from '../api/recovery-agents.api.ts';
import { RowSkeleton } from '../components/ui/Skeleton.tsx';
import { fmtDateShort } from '../utils/dateFormat.ts';

/* ── helpers ── */
const pkr = (v: number) => 'PKR ' + v.toLocaleString('en-PK', { maximumFractionDigits: 0 });
const pkrSh = (v: number) => {
  if (v >= 10_00_000) return `${(v / 10_00_000).toFixed(1)}M`;
  if (v >= 1_00_000)  return `${(v / 1_00_000).toFixed(v % 1_00_000 === 0 ? 0 : 1)}L`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(v % 1_000 === 0 ? 0 : 1)}K`;
  return String(v);
};
const timeAgo = (iso: string) => {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1)   return 'abhi abhi';
  if (mins < 60)  return `${mins}m pehle`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h pehle`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'kal';
  return `${days} din pehle`;
};

const AVATAR_COLORS = [
  'bg-blue-600',  'bg-violet-600', 'bg-emerald-600', 'bg-rose-600',
  'bg-amber-600', 'bg-indigo-600', 'bg-teal-600',    'bg-pink-600',
];
const agentColor = (name: string) => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

const METHOD_COLORS: Record<string, string> = {
  CASH:      'bg-emerald-100 text-emerald-700',
  BANK:      'bg-blue-100 text-blue-700',
  JAZZCASH:  'bg-red-100 text-red-700',
  EASYPAISA: 'bg-teal-100 text-teal-700',
  OTHER:     'bg-slate-100 text-slate-500',
};

/* ══ CollectionRow ══ */
function CollectionRow({ c, i }: { c: AgentCollection; i: number }) {
  return (
    <div className={`flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition ${i > 0 ? 'border-t border-slate-50' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-bold text-slate-900 truncate">{c.customerName}</p>
          {c.customerPhone && (
            <a href={`tel:${c.customerPhone}`} className="flex items-center gap-1 text-[10px] font-bold text-blue-500 hover:underline shrink-0">
              <Phone size={9}/>{c.customerPhone}
            </a>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-0.5 truncate">{c.productName}</p>
        {c.note && <p className="text-[11px] text-slate-400 italic mt-0.5 truncate">{c.note}</p>}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-black text-slate-900 tabular-nums">{pkr(Number(c.amount))}</p>
        <div className="flex items-center justify-end gap-1.5 mt-1">
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-black ${METHOD_COLORS[c.method] ?? METHOD_COLORS.OTHER}`}>
            {c.method}
          </span>
          <span className="text-[10px] text-slate-400">{fmtDateShort(c.paidOn)}</span>
          {c.proofImageUrl && (
            <a href={c.proofImageUrl} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-600 transition">
              <Image size={12}/>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══ Agent Drill-Down ══ */
function AgentDrillDown({ stat, onBack }: { stat: AgentStat; onBack: () => void }) {
  const [page, setPage] = useState(1);
  const LIMIT = 25;

  const { data, isLoading } = useQuery({
    queryKey: ['recovery-agent-collections', stat.userId, page],
    queryFn:  () => recoveryAgentsApi.collections(stat.userId, page, LIMIT),
  });

  const initials = stat.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="bg-[#F0F2F8]">
      {/* Dark header */}
      <div className="bg-slate-950 shadow-lg shadow-slate-950/20">
        <div className="flex items-center gap-3 px-4 sm:px-6 py-3.5">
          <button onClick={onBack} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition shrink-0">
            <ArrowLeft size={16}/>
          </button>
          <div className={`w-9 h-9 rounded-full ${agentColor(stat.name)} flex items-center justify-center text-white text-sm font-black shrink-0 select-none`}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-black text-white truncate">{stat.name}</p>
            <p className="text-xs text-slate-500">Recovery Agent</p>
          </div>
          {stat.lastCollectedAt && (
            <div className="text-right shrink-0">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">Last Active</p>
              <p className="text-xs font-bold text-slate-300">{timeAgo(stat.lastCollectedAt)}</p>
            </div>
          )}
        </div>
      </div>

      {/* KPI strip */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100">
          <div className="px-5 py-3.5 border-l-[3px] border-emerald-500">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.18em]">Total Recovered</p>
            <p className="text-2xl font-black text-slate-900 tabular-nums leading-none mt-1">{pkrSh(stat.totalCollected)}</p>
            <p className="text-[10px] text-slate-400 mt-1">{pkr(stat.totalCollected)}</p>
          </div>
          <div className="px-5 py-3.5 border-l-[3px] border-blue-500">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.18em]">Is Mahine</p>
            <p className="text-2xl font-black text-slate-900 tabular-nums leading-none mt-1">{pkrSh(stat.thisMonthTotal)}</p>
            <p className="text-[10px] text-slate-400 mt-1">{stat.thisMonthCount} payments</p>
          </div>
          <div className="px-5 py-3.5 border-l-[3px] border-violet-400">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.18em]">Kul Collections</p>
            <p className="text-2xl font-black text-slate-900 tabular-nums leading-none mt-1">{stat.collectionCount}</p>
            <p className="text-[10px] text-slate-400 mt-1">tamam waqt mein</p>
          </div>
          <div className="px-5 py-3.5 border-l-[3px] border-slate-200">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.18em]">Last Active</p>
            <p className="text-base font-black text-slate-700 leading-none mt-1">
              {stat.lastCollectedAt ? fmtDateShort(stat.lastCollectedAt) : '—'}
            </p>
            <p className="text-[10px] text-slate-400 mt-1">{stat.lastCollectedAt ? timeAgo(stat.lastCollectedAt) : 'koi record nahi'}</p>
          </div>
        </div>
      </div>

      {/* Collections list */}
      <div className="px-3 sm:px-5 lg:px-6 py-4">
        <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-slate-500"/>
              <h2 className="text-sm font-black text-slate-900">Tamam Collections</h2>
            </div>
            {data && <span className="text-xs text-slate-400 tabular-nums">{data.total} records</span>}
          </div>

          {isLoading ? <RowSkeleton rows={6}/> : !data?.data.length ? (
            <div className="py-12 text-center">
              <Activity size={24} className="mx-auto mb-3 text-slate-200"/>
              <p className="text-sm text-slate-400">Koi collection record nahi</p>
            </div>
          ) : (
            <>
              <div>
                {data.data.map((c, i) => <CollectionRow key={c.id} c={c} i={i}/>)}
              </div>

              {data.total > LIMIT && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
                  <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                    className="flex items-center gap-1 text-xs font-black px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition">
                    <ChevronLeft size={13}/> Pehla
                  </button>
                  <span className="text-xs text-slate-500 tabular-nums">
                    {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, data.total)} / {data.total}
                  </span>
                  <button disabled={page * LIMIT >= data.total} onClick={() => setPage(p => p + 1)}
                    className="flex items-center gap-1 text-xs font-black px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition">
                    Agla <ChevronRight size={13}/>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══ Main Page ══ */
export default function RecoveryAgentsPage() {
  const [selected, setSelected] = useState<AgentStat | null>(null);

  const { data: stats = [], isLoading } = useQuery({
    queryKey: ['recovery-agents-stats'],
    queryFn:  recoveryAgentsApi.stats,
    staleTime: 60_000,
  });

  if (selected) return <AgentDrillDown stat={selected} onBack={() => setSelected(null)}/>;

  const totalAgents    = stats.length;
  const totalRecovered = stats.reduce((s, a) => s + a.totalCollected, 0);
  const thisMonthTotal = stats.reduce((s, a) => s + a.thisMonthTotal, 0);
  const totalCount     = stats.reduce((s, a) => s + a.collectionCount, 0);

  return (
    <div className="bg-[#F0F2F8]">

      {/* Dark header */}
      <div className="bg-slate-950 shadow-lg shadow-slate-950/20">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp size={15} className="text-violet-400"/>
              <h1 className="text-[15px] font-black text-white">Recovery Agents</h1>
              {totalAgents > 0 && (
                <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">{totalAgents} agents</span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Kaun kitna recover karta hai — performance tracker</p>
          </div>
          {totalRecovered > 0 && (
            <div className="text-right">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">Total Recovered</p>
              <p className="text-xl font-black text-emerald-400 tabular-nums">{pkrSh(totalRecovered)}</p>
            </div>
          )}
        </div>
      </div>

      {/* KPI strip */}
      {!isLoading && stats.length > 0 && (
        <div className="bg-white border-b border-slate-200 shadow-sm">
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100">
            <div className="px-5 py-3.5 border-l-[3px] border-violet-500">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.18em]">Active Agents</p>
              <p className="text-2xl font-black text-slate-900 tabular-nums leading-none mt-1">{totalAgents}</p>
              <p className="text-[10px] text-slate-400 mt-1">recovery team</p>
            </div>
            <div className="px-5 py-3.5 border-l-[3px] border-emerald-500">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.18em]">Total Recovered</p>
              <p className="text-2xl font-black text-slate-900 tabular-nums leading-none mt-1">{pkrSh(totalRecovered)}</p>
              <p className="text-[10px] text-slate-400 mt-1">{pkr(totalRecovered)}</p>
            </div>
            <div className="px-5 py-3.5 border-l-[3px] border-blue-500">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.18em]">Is Mahine</p>
              <p className="text-2xl font-black text-slate-900 tabular-nums leading-none mt-1">{pkrSh(thisMonthTotal)}</p>
              <p className="text-[10px] text-slate-400 mt-1">{pkr(thisMonthTotal)}</p>
            </div>
            <div className="px-5 py-3.5 border-l-[3px] border-amber-400">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.18em]">Kul Collections</p>
              <p className="text-2xl font-black text-slate-900 tabular-nums leading-none mt-1">{totalCount}</p>
              <p className="text-[10px] text-slate-400 mt-1">tamam payments</p>
            </div>
          </div>
        </div>
      )}

      {/* Agents list */}
      <div className="px-3 sm:px-5 lg:px-6 py-4">
        <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
            <Users size={14} className="text-slate-500"/>
            <h2 className="text-sm font-black text-slate-900">Agent Performance</h2>
          </div>

          {isLoading ? <RowSkeleton rows={4}/> : stats.length === 0 ? (
            <div className="py-14 flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 bg-violet-50 rounded-2xl flex items-center justify-center">
                <Users size={22} className="text-violet-300"/>
              </div>
              <div>
                <p className="text-sm font-black text-slate-600">Koi agent nahi</p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  Staff members add karo aur unhe payments collect karne dو — performance yahan dikhega.
                </p>
              </div>
            </div>
          ) : (
            <div>
              {stats.map((s, i) => {
                const initials = s.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
                const monthPct = s.totalCollected > 0 ? Math.min(100, Math.round((s.thisMonthTotal / s.totalCollected) * 100)) : 0;
                return (
                  <button key={s.userId} onClick={() => setSelected(s)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition text-left group ${i > 0 ? 'border-t border-slate-50' : ''}`}>
                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-full ${agentColor(s.name)} flex items-center justify-center text-white text-sm font-black shrink-0 select-none`}>
                      {initials}
                    </div>

                    {/* Name + last active */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-slate-900 truncate">{s.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Activity size={9}/> {s.collectionCount} collections
                        </span>
                        {s.lastCollectedAt && (
                          <>
                            <span className="text-slate-200">·</span>
                            <span className="text-[10px] text-slate-400 flex items-center gap-1">
                              <Clock size={9}/> {timeAgo(s.lastCollectedAt)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* This month */}
                    <div className="text-center shrink-0 hidden sm:block">
                      <p className="text-[10px] text-slate-400 font-bold">Is Mahine</p>
                      <p className="text-sm font-black text-blue-700 tabular-nums">{pkrSh(s.thisMonthTotal)}</p>
                      <p className="text-[10px] text-slate-400">{s.thisMonthCount} payments</p>
                    </div>

                    {/* Total + progress */}
                    <div className="text-right shrink-0 hidden md:block min-w-[100px]">
                      <p className="text-[10px] text-slate-400 font-bold">Total</p>
                      <p className="text-base font-black text-emerald-700 tabular-nums">{pkrSh(s.totalCollected)}</p>
                      <div className="flex items-center gap-1 mt-1 justify-end">
                        <div className="w-16 bg-slate-100 rounded-full h-1 overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${monthPct}%` }}/>
                        </div>
                        <span className="text-[9px] text-slate-400">{monthPct}%</span>
                      </div>
                    </div>

                    {/* Arrow */}
                    <ChevronRight size={15} className="text-slate-300 group-hover:text-slate-500 transition shrink-0"/>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Legend */}
        {stats.length > 0 && (
          <p className="text-center text-[10px] text-slate-400 mt-3">
            Kisi agent par click karo uski detailed collections dekhne ke liye
          </p>
        )}
      </div>
    </div>
  );
}
