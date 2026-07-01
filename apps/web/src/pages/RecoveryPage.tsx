import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  PhoneCall, MapPin, HandCoins, XCircle, AlertOctagon,
  Plus, Trash2, Loader2, ChevronRight, ChevronLeft, Clock, LayoutList, Map as MapIcon,
  CalendarClock, AlertTriangle, CalendarCheck,
} from 'lucide-react';
import { installmentsApi, type Installment } from '../api/installments.api.ts';
import { getErrorMessage } from '../utils/error.ts';
import { recoveryApi, type RecoveryActionType, type RecoveryAction, type PromiseDue } from '../api/recovery.api.ts';
import ConfirmDialog from '../components/ui/ConfirmDialog.tsx';
import { fmtDate } from '../utils/dateFormat.ts';

// ── Helpers ────────────────────────────────────────────────────────────────────

function pkr(v: string | number) { return 'PKR ' + Number(v).toLocaleString('en-PK', { maximumFractionDigits: 0 }); }

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
              autoFocus
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
  const [removeConfirm, setRemoveConfirm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  const { data: actions = [], isLoading } = useQuery({
    queryKey: ['recovery', inst.id],
    queryFn: () => recoveryApi.list(inst.id),
    staleTime: 30_000,
  });

  const { mutate: remove, isPending: isRemoving } = useMutation({
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
                  <button onClick={() => setRemoveConfirm({ open: true, id: a.id })}
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

      <ConfirmDialog
        open={removeConfirm.open}
        title="Action Remove Karo?"
        description="Ye recovery action log se hamesha ke liye delete ho jaegi."
        confirmLabel="Remove Karo"
        variant="danger"
        isPending={isRemoving}
        onConfirm={() => { if (removeConfirm.id) remove(removeConfirm.id); setRemoveConfirm({ open: false, id: null }); }}
        onCancel={() => setRemoveConfirm({ open: false, id: null })}
      />
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

// ── Promise Tracker ─────────────────────────────────────────────────────────────

function PromiseRow({ p, onOpenInstallment }: { p: PromiseDue; onOpenInstallment: (id: string) => void }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const pd = new Date(p.promiseDate);
  pd.setHours(0, 0, 0, 0);
  const diff = Math.round((pd.getTime() - today.getTime()) / 86_400_000);
  const isBroken  = diff < 0;
  const isToday   = diff === 0;

  const diffLabel = isBroken
    ? `${Math.abs(diff)} day${Math.abs(diff) !== 1 ? 's' : ''} ago`
    : isToday
    ? 'Today'
    : `in ${diff} day${diff !== 1 ? 's' : ''}`;

  return (
    <button
      onClick={() => onOpenInstallment(p.installmentId)}
      className="w-full flex items-start gap-3 px-4 py-3 rounded-xl text-left transition hover:bg-gray-50 border border-transparent"
    >
      <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${isBroken ? 'bg-red-500' : isToday ? 'bg-orange-400' : 'bg-blue-400'}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{p.customerName}</p>
        <p className="text-xs text-gray-400 truncate">{p.productName} · {p.customerPhone}</p>
        {p.note && <p className="text-[11px] text-gray-500 truncate mt-0.5">"{p.note}"</p>}
        {p.actorName && <p className="text-[11px] text-violet-500 mt-0.5">by {p.actorName}</p>}
      </div>
      <div className="text-right shrink-0">
        <p className={`text-xs font-bold ${isBroken ? 'text-red-600' : isToday ? 'text-orange-600' : 'text-blue-600'}`}>{diffLabel}</p>
        <p className="text-[11px] text-gray-400">{fmtDate(p.promiseDate)}</p>
        {p.remaining && <p className="text-[11px] text-gray-500 mt-0.5">PKR {Number(p.remaining).toLocaleString('en-PK', { maximumFractionDigits: 0 })}</p>}
      </div>
    </button>
  );
}

function PromiseTracker({ onOpenInstallment }: { onOpenInstallment: (id: string) => void }) {
  const { data: promises = [], isLoading } = useQuery({
    queryKey: ['promises-all'],
    queryFn: recoveryApi.allPromises,
    staleTime: 2 * 60_000,
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const broken   = promises.filter((p) => new Date(p.promiseDate) < today);
  const dueToday = promises.filter((p) => {
    const d = new Date(p.promiseDate);
    d.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
  });
  const upcoming = promises.filter((p) => new Date(p.promiseDate) > today);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-400">
        <Loader2 size={18} className="animate-spin" />
      </div>
    );
  }

  if (promises.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-2">
        <CalendarCheck size={32} className="opacity-30" />
        <p className="text-sm">No promises logged</p>
        <p className="text-xs text-gray-300">Log a Promise-to-Pay action to track here</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-1">
      {broken.length > 0 && (
        <>
          <div className="flex items-center gap-1.5 px-2 py-1.5 mt-1">
            <AlertTriangle size={11} className="text-red-500 shrink-0" />
            <p className="text-[11px] font-bold text-red-600 uppercase tracking-wider">Broken Promises ({broken.length})</p>
          </div>
          {broken.map((p) => <PromiseRow key={p.id} p={p} onOpenInstallment={onOpenInstallment} />)}
        </>
      )}
      {dueToday.length > 0 && (
        <>
          <div className="flex items-center gap-1.5 px-2 py-1.5 mt-2">
            <Clock size={11} className="text-orange-500 shrink-0" />
            <p className="text-[11px] font-bold text-orange-600 uppercase tracking-wider">Due Today ({dueToday.length})</p>
          </div>
          {dueToday.map((p) => <PromiseRow key={p.id} p={p} onOpenInstallment={onOpenInstallment} />)}
        </>
      )}
      {upcoming.length > 0 && (
        <>
          <div className="flex items-center gap-1.5 px-2 py-1.5 mt-2">
            <CalendarClock size={11} className="text-blue-500 shrink-0" />
            <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Upcoming 7 Days ({upcoming.length})</p>
          </div>
          {upcoming.map((p) => <PromiseRow key={p.id} p={p} onOpenInstallment={onOpenInstallment} />)}
        </>
      )}
    </div>
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
  const [search,        setSearch]     = useState('');
  const [debouncedSearch, setDebounced] = useState('');
  const [sortBy,        setSortBy]     = useState<SortKey>('default');
  const [groupMode,     setGroupMode]  = useState<'status' | 'area'>('status');
  const [selected,      setSelected]   = useState<Installment | null>(null);
  const [leftTab,       setLeftTab]    = useState<'list' | 'promises'>('list');

  const { data: promisesData = [] } = useQuery({
    queryKey: ['promises-all'],
    queryFn: recoveryApi.allPromises,
    staleTime: 2 * 60_000,
  });
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const brokenCount = promisesData.filter((p) => new Date(p.promiseDate) < today).length;
  const todayCount  = promisesData.filter((p) => { const d = new Date(p.promiseDate); d.setHours(0,0,0,0); return d.getTime() === today.getTime(); }).length;
  const promiseBadge = brokenCount + todayCount;

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ['installments-recovery', debouncedSearch],
    queryFn: () => installmentsApi.list({ status: 'ACTIVE', limit: 200, search: debouncedSearch || undefined }),
    staleTime: 60_000,
  });

  const installments = data?.data  ?? [];
  const totalOnServer = data?.total ?? 0;
  const isTruncated  = totalOnServer > installments.length;

  const overdueList  = sortList(installments.filter((i) => i.isOverdue),  sortBy);
  const currentList  = sortList(installments.filter((i) => !i.isOverdue), sortBy);
  const areaGroups   = groupByArea(sortList(installments, sortBy));

  const totalOverdueRemaining = overdueList.reduce((s, i) => s + Number(i.remaining), 0);
  const totalActiveRemaining  = currentList.reduce((s, i) => s + Number(i.remaining), 0);

  async function openInstallmentById(id: string) {
    const found = installments.find((i) => i.id === id);
    if (found) { setSelected(found); setLeftTab('list'); return; }
    try {
      const inst = await installmentsApi.getOne(id);
      setSelected(inst);
      setLeftTab('list');
    } catch { /* installment not in current view — ignore */ }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Page header */}
      <div className="px-4 py-4 sm:px-8 sm:py-6 border-b border-gray-100 bg-white">
        <h1 className="text-xl font-bold text-gray-900">Recovery Management</h1>
        <p className="text-sm text-gray-500 mt-0.5">Track follow-up actions on active installments</p>

        {/* Stats strip */}
        {!isLoading && installments.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
              <p className="text-xs font-semibold text-red-500 uppercase tracking-wide">Overdue</p>
              <p className="text-lg font-extrabold text-red-700 leading-tight">{overdueList.length}</p>
              <p className="text-[11px] text-red-400 mt-0.5 truncate">{pkr(totalOverdueRemaining)} remaining</p>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5">
              <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide">On Track</p>
              <p className="text-lg font-extrabold text-blue-700 leading-tight">{currentList.length}</p>
              <p className="text-[11px] text-blue-400 mt-0.5 truncate">{pkr(totalActiveRemaining)} remaining</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Active</p>
              <p className="text-lg font-extrabold text-gray-800 leading-tight">{installments.length}</p>
              <p className="text-[11px] text-gray-400 mt-0.5 truncate">{pkr(totalOverdueRemaining + totalActiveRemaining)} remaining</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left — installment list (hidden on mobile when an item is selected) */}
        <aside className={`${selected ? 'hidden md:flex' : 'flex'} w-full md:w-80 border-r border-gray-100 bg-white flex-col shrink-0`}>
          {/* Tab bar */}
          <div className="flex border-b border-gray-100 shrink-0">
            <button
              onClick={() => setLeftTab('list')}
              className={`flex-1 py-2.5 text-xs font-semibold transition ${leftTab === 'list' ? 'text-blue-600 border-b-2 border-blue-600 -mb-px' : 'text-gray-400 hover:text-gray-600'}`}>
              Installments
            </button>
            <button
              onClick={() => setLeftTab('promises')}
              className={`flex-1 py-2.5 text-xs font-semibold transition flex items-center justify-center gap-1.5 ${leftTab === 'promises' ? 'text-orange-600 border-b-2 border-orange-500 -mb-px' : 'text-gray-400 hover:text-gray-600'}`}>
              Promises
              {promiseBadge > 0 && (
                <span className="bg-orange-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">{promiseBadge}</span>
              )}
            </button>
          </div>

          {leftTab === 'promises' ? (
            <PromiseTracker onOpenInstallment={openInstallmentById} />
          ) : (
          <>
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
            ) : installments.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-12">
                {debouncedSearch ? `No results for "${debouncedSearch}"` : 'No active installments'}
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

          {isTruncated && !isLoading && (
            <div className="px-3 py-2 bg-amber-50 border-t border-amber-100 text-center">
              <p className="text-[10px] text-amber-600 font-medium">
                Showing {installments.length} of {totalOnServer} — use search to narrow down
              </p>
            </div>
          )}

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
          </>
          )}
        </aside>

        {/* Right — recovery panel (full screen on mobile when selected) */}
        <main className={`${selected ? 'flex' : 'hidden md:flex'} flex-1 overflow-hidden bg-white flex-col`}>
          {selected ? (
            <>
              {/* Mobile back button */}
              <div className="md:hidden flex items-center gap-2 px-4 py-3 border-b border-gray-100 shrink-0">
                <button
                  onClick={() => setSelected(null)}
                  className="flex items-center gap-1.5 text-sm text-blue-600 font-medium"
                >
                  <ChevronLeft size={16} />
                  Back to list
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <RecoveryPanel key={selected.id} inst={selected} />
              </div>
            </>
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
