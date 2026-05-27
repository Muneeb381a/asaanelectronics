import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  PhoneCall, MapPin, HandCoins, XCircle, AlertOctagon,
  Plus, Trash2, Loader2, ChevronRight, Clock, LayoutList, Map as MapIcon,
} from 'lucide-react';
import { installmentsApi, type Installment } from '../api/installments.api.ts';
import { getErrorMessage } from '../utils/error.ts';
import { recoveryApi, type RecoveryActionType, type RecoveryAction } from '../api/recovery.api.ts';

// ── Helpers ────────────────────────────────────────────────────────────────────

function pkr(v: string | number) { return 'PKR ' + Number(v).toLocaleString('en-PK', { maximumFractionDigits: 0 }); }
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysSince(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  return Math.floor(diff / 86_400_000);
}

// ── Action meta ────────────────────────────────────────────────────────────────

type ActionMeta = { label: string; icon: React.ElementType; color: string; bg: string };
const ACTION_META: Record<RecoveryActionType, ActionMeta> = {
  CALLED:          { label: 'Called',          icon: PhoneCall,     color: 'text-blue-600',   bg: 'bg-blue-50'   },
  VISITED:         { label: 'Visited',         icon: MapPin,        color: 'text-violet-600', bg: 'bg-violet-50' },
  PROMISE_TO_PAY:  { label: 'Promise to Pay',  icon: HandCoins,     color: 'text-emerald-600',bg: 'bg-emerald-50'},
  REFUSED:         { label: 'Refused',         icon: XCircle,       color: 'text-red-600',    bg: 'bg-red-50'    },
  LEGAL_WARNING:   { label: 'Legal Warning',   icon: AlertOctagon,  color: 'text-orange-600', bg: 'bg-orange-50' },
};
const ACTION_TYPES = Object.keys(ACTION_META) as RecoveryActionType[];

// ── Log Action Modal ───────────────────────────────────────────────────────────

function LogModal({ installmentId, onClose }: { installmentId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [type, setType]           = useState<RecoveryActionType>('CALLED');
  const [note, setNote]           = useState('');
  const [promiseDate, setPromise] = useState('');

  const { mutate, isPending } = useMutation({
    mutationFn: () => recoveryApi.create({
      installmentId,
      type,
      note: note.trim() || undefined,
      promiseDate: (type === 'PROMISE_TO_PAY' && promiseDate) ? promiseDate : undefined,
    }),
    onSuccess: () => {
      toast.success('Action logged');
      qc.invalidateQueries({ queryKey: ['recovery', installmentId] });
      onClose();
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Failed to log action')),
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Log Recovery Action</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XCircle size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Action Type</label>
            <div className="grid grid-cols-2 gap-2">
              {ACTION_TYPES.map((t) => {
                const m = ACTION_META[t];
                const Icon = m.icon;
                return (
                  <button key={t} onClick={() => setType(t)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition ${
                      type === t
                        ? `${m.bg} ${m.color} border-transparent`
                        : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}>
                    <Icon size={14} />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {type === 'PROMISE_TO_PAY' && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Promise Date</label>
              <input
                type="date"
                value={promiseDate}
                onChange={(e) => setPromise(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Any additional details…"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
              Cancel
            </button>
            <button onClick={() => mutate()} disabled={isPending}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2">
              {isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Log Action
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Recovery Panel ─────────────────────────────────────────────────────────────

function RecoveryPanel({ inst }: { inst: Installment }) {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);

  const { data: actions = [], isLoading } = useQuery({
    queryKey: ['recovery', inst.id],
    queryFn: () => recoveryApi.list(inst.id),
    staleTime: 30_000,
  });

  const { mutate: remove } = useMutation({
    mutationFn: (id: string) => recoveryApi.remove(id),
    onSuccess: () => {
      toast.success('Action removed');
      qc.invalidateQueries({ queryKey: ['recovery', inst.id] });
    },
    onError: () => toast.error('Failed to remove action'),
  });

  const overdue = inst.isOverdue;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold text-gray-900">{inst.customerName}</p>
            <p className="text-xs text-gray-500">{inst.productName} · {pkr(inst.remaining)} remaining</p>
          </div>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition shrink-0">
            <Plus size={13} />
            Log Action
          </button>
        </div>
        {overdue && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-red-600 font-medium">
            <Clock size={12} />
            Overdue — {daysSince(new Date(new Date(inst.startDate).setMonth(new Date(inst.startDate).getMonth() + inst.months)).toISOString())} days past due
          </div>
        )}
      </div>

      {/* Actions list */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-gray-400">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : actions.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <PhoneCall size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No recovery actions logged yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(actions as RecoveryAction[]).map((a) => {
              const m = ACTION_META[a.type];
              const Icon = m.icon;
              return (
                <div key={a.id} className="flex gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition group">
                  <div className={`w-8 h-8 rounded-lg ${m.bg} flex items-center justify-center shrink-0`}>
                    <Icon size={14} className={m.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold ${m.color}`}>{m.label}</span>
                      {a.promiseDate && (
                        <span className="text-xs text-gray-400">· Promise: {fmtDate(a.promiseDate)}</span>
                      )}
                    </div>
                    {a.note && <p className="text-xs text-gray-600 mt-0.5 truncate">{a.note}</p>}
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {fmtDate(a.createdAt)} {a.actorName && `· ${a.actorName}`}
                    </p>
                  </div>
                  <button onClick={() => { if (confirm('Remove this action?')) remove(a.id); }}
                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && <LogModal installmentId={inst.id} onClose={() => setShowModal(false)} />}
    </div>
  );
}

// ── Installment Row ────────────────────────────────────────────────────────────

function InstallmentRow({
  inst, selectedId, onSelect,
}: { inst: Installment; selectedId: string | null; onSelect: (i: Installment) => void }) {
  const overdue = inst.isOverdue;
  return (
    <button
      onClick={() => onSelect(inst)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition ${
        selectedId === inst.id
          ? 'bg-blue-50 border border-blue-200'
          : 'hover:bg-gray-50 border border-transparent'
      }`}
    >
      <div className={`w-2 h-2 rounded-full shrink-0 ${overdue ? 'bg-red-500' : 'bg-emerald-400'}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{inst.customerName}</p>
        <p className="text-xs text-gray-400 truncate">{inst.productName} · {inst.customerPhone}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs font-semibold text-gray-700">{pkr(inst.remaining)}</p>
        {overdue && <p className="text-[10px] text-red-500 font-medium">Overdue</p>}
      </div>
      <ChevronRight size={14} className="text-gray-300 shrink-0" />
    </button>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

type SortKey = 'default' | 'remaining_desc' | 'remaining_asc' | 'name_asc';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'default',        label: 'Default' },
  { value: 'remaining_desc', label: 'Highest debt' },
  { value: 'remaining_asc',  label: 'Lowest debt' },
  { value: 'name_asc',       label: 'Name A–Z' },
];

function sortList(list: Installment[], key: SortKey): Installment[] {
  if (key === 'remaining_desc') return [...list].sort((a, b) => Number(b.remaining) - Number(a.remaining));
  if (key === 'remaining_asc')  return [...list].sort((a, b) => Number(a.remaining) - Number(b.remaining));
  if (key === 'name_asc')       return [...list].sort((a, b) => a.customerName.localeCompare(b.customerName));
  return list;
}

function groupByArea(list: Installment[]): { area: string; items: Installment[] }[] {
  const map = new Map<string, Installment[]>();
  for (const inst of list) {
    const key = inst.customerArea?.trim() || 'بغیر علاقہ / No Area';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(inst);
  }
  const NO_AREA = 'بغیر علاقہ / No Area';
  return Array.from(map.entries() as Iterable<[string, Installment[]]>)
    .sort((a, b) => {
      if (a[0] === NO_AREA) return 1;
      if (b[0] === NO_AREA) return -1;
      return a[0].localeCompare(b[0], 'ur');
    })
    .map((entry) => ({ area: entry[0], items: entry[1] }));
}

export default function RecoveryPage() {
  const [search,   setSearch]   = useState('');
  const [sortBy,   setSortBy]   = useState<SortKey>('default');
  const [groupMode, setGroupMode] = useState<'status' | 'area'>('status');
  const [selected, setSelected] = useState<Installment | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['installments-recovery'],
    queryFn: () => installmentsApi.list({ status: 'ACTIVE', limit: 200 }),
    staleTime: 60_000,
  });

  const installments = data?.data ?? [];

  const filtered = installments.filter((i) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      i.customerName.toLowerCase().includes(q) ||
      i.customerPhone.includes(search) ||
      i.productName.toLowerCase().includes(q) ||
      (i.customerArea ?? '').toLowerCase().includes(q)
    );
  });

  const overdueList  = sortList(filtered.filter((i) => i.isOverdue),  sortBy);
  const currentList  = sortList(filtered.filter((i) => !i.isOverdue), sortBy);
  const areaGroups   = groupByArea(sortList(filtered, sortBy));

  return (
    <div className="h-screen flex flex-col">
      {/* Page header */}
      <div className="px-8 py-6 border-b border-gray-100 bg-white">
        <h1 className="text-xl font-bold text-gray-900">Recovery Management</h1>
        <p className="text-sm text-gray-500 mt-0.5">Track follow-up actions on active installments</p>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left — installment list */}
        <aside className="w-80 border-r border-gray-100 bg-white flex flex-col shrink-0">
          <div className="p-4 border-b border-gray-100 space-y-2">
            <input
              type="text"
              placeholder="Search by name, phone, or area…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <button
                onClick={() => setGroupMode((m) => m === 'status' ? 'area' : 'status')}
                title={groupMode === 'status' ? 'Group by Area' : 'Group by Status'}
                className={`px-2.5 py-1.5 rounded-lg border text-xs flex items-center gap-1 transition ${
                  groupMode === 'area'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {groupMode === 'area' ? <MapIcon size={13} /> : <LayoutList size={13} />}
                {groupMode === 'area' ? 'Area' : 'Status'}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
            {isLoading ? (
              <div className="flex items-center justify-center h-32 text-gray-400">
                <Loader2 size={18} className="animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-12">
                {search ? `No results for "${search}"` : 'No active installments'}
              </p>
            ) : groupMode === 'area' ? (
              /* ── Area grouping ── */
              <>
                {areaGroups.map(({ area, items }) => {
                  const areaOverdue = items.filter((i) => i.isOverdue).length;
                  return (
                    <div key={area}>
                      <div className="flex items-center gap-1.5 px-2 py-1.5 mt-1">
                        <MapPin size={11} className="text-blue-500 shrink-0" />
                        <p className="text-[11px] font-bold text-gray-700 truncate">{area}</p>
                        <span className="text-[10px] text-gray-400 shrink-0">({items.length})</span>
                        {areaOverdue > 0 && (
                          <span className="ml-auto text-[10px] font-bold text-red-500 shrink-0">{areaOverdue} overdue</span>
                        )}
                      </div>
                      {items.map((i) => (
                        <InstallmentRow key={i.id} inst={i} selectedId={selected?.id ?? null} onSelect={setSelected} />
                      ))}
                    </div>
                  );
                })}
              </>
            ) : (
              /* ── Status grouping (default) ── */
              <>
                {overdueList.length > 0 && (
                  <>
                    <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider px-2 py-1">
                      Overdue ({overdueList.length})
                    </p>
                    {overdueList.map((i) => (
                      <InstallmentRow key={i.id} inst={i} selectedId={selected?.id ?? null} onSelect={setSelected} />
                    ))}
                    {currentList.length > 0 && (
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 py-1 pt-3">
                        Current ({currentList.length})
                      </p>
                    )}
                  </>
                )}
                {currentList.map((i) => (
                  <InstallmentRow key={i.id} inst={i} selectedId={selected?.id ?? null} onSelect={setSelected} />
                ))}
              </>
            )}
          </div>

          {/* Summary bar */}
          <div className="p-4 border-t border-gray-100 flex gap-4 text-center">
            <div className="flex-1">
              <p className="text-lg font-bold text-red-600">{overdueList.length}</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Overdue</p>
            </div>
            <div className="flex-1">
              <p className="text-lg font-bold text-gray-700">{currentList.length}</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Current</p>
            </div>
          </div>
        </aside>

        {/* Right — recovery panel */}
        <main className="flex-1 overflow-hidden bg-white">
          {selected ? (
            <RecoveryPanel key={selected.id} inst={selected} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
              <PhoneCall size={40} className="opacity-25" />
              <p className="text-sm">Select an installment to view recovery history</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
