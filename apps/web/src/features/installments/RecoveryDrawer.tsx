import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X, Phone, MapPin, CalendarCheck, XCircle, AlertTriangle, Trash2, Plus,
} from 'lucide-react';
import { recoveryApi, type RecoveryAction, type RecoveryActionType } from '../../api/recovery.api.ts';
import type { Installment } from '../../api/installments.api.ts';
import { fmtDate, fmtDateTime } from '../../utils/dateFormat.ts';

// ── Config ────────────────────────────────────────────────────────────────────
type ActionConfig = {
  label: string;
  icon: typeof Phone;
  color: string;
  bg: string;
  ring: string;
  dot: string;
};

const ACTION_CONFIG: Record<RecoveryActionType, ActionConfig> = {
  CALLED:          { label: 'Called Customer',    icon: Phone,          color: 'text-blue-700',   bg: 'bg-blue-50',   ring: 'ring-blue-200',   dot: 'bg-blue-500' },
  VISITED:         { label: 'Visited Address',    icon: MapPin,         color: 'text-purple-700', bg: 'bg-purple-50', ring: 'ring-purple-200', dot: 'bg-purple-500' },
  PROMISE_TO_PAY:  { label: 'Promise to Pay',     icon: CalendarCheck,  color: 'text-green-700',  bg: 'bg-green-50',  ring: 'ring-green-200',  dot: 'bg-green-500' },
  REFUSED:         { label: 'Refused Payment',    icon: XCircle,        color: 'text-red-700',    bg: 'bg-red-50',    ring: 'ring-red-200',    dot: 'bg-red-500' },
  LEGAL_WARNING:   { label: 'Legal Warning Sent', icon: AlertTriangle,  color: 'text-amber-700',  bg: 'bg-amber-50',  ring: 'ring-amber-200',  dot: 'bg-amber-500' },
};

const ACTION_TYPES = Object.keys(ACTION_CONFIG) as RecoveryActionType[];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Timeline item ─────────────────────────────────────────────────────────────
function TimelineItem({ action, onDelete }: { action: RecoveryAction; onDelete: (id: string) => void }) {
  const cfg = ACTION_CONFIG[action.type];
  const Icon = cfg.icon;
  const isPromise = action.type === 'PROMISE_TO_PAY' && action.promiseDate;

  return (
    <div className="flex gap-3 group">
      {/* Dot + line */}
      <div className="flex flex-col items-center shrink-0">
        <div className={`w-8 h-8 rounded-full ${cfg.bg} ring-2 ${cfg.ring} flex items-center justify-center`}>
          <Icon size={14} className={cfg.color} />
        </div>
        <div className="w-px flex-1 bg-gray-100 mt-1" />
      </div>

      {/* Content */}
      <div className="pb-5 flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
            {action.actorName && (
              <span className="text-xs text-gray-400 ml-1.5">
                by {action.actorName} ({action.actorRole === 'SELLER_OWNER' ? 'Owner' : 'Staff'})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-gray-400" title={fmtDateTime(action.createdAt)}>
              {timeAgo(action.createdAt)}
            </span>
            <button
              onClick={() => onDelete(action.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-300 hover:text-red-500 rounded"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        {isPromise && (
          <div className="mt-1 inline-flex items-center gap-1 bg-green-50 border border-green-200 rounded-lg px-2 py-0.5">
            <CalendarCheck size={11} className="text-green-600" />
            <span className="text-xs text-green-700 font-medium">
              Will pay by {fmtDate(action.promiseDate!)}
            </span>
          </div>
        )}

        {action.note && (
          <p className="mt-1 text-sm text-gray-600 leading-snug">{action.note}</p>
        )}

        <p className="text-xs text-gray-300 mt-1">{fmtDateTime(action.createdAt)}</p>
      </div>
    </div>
  );
}

// ── Add action form ───────────────────────────────────────────────────────────
function AddActionForm({ installmentId, onSuccess }: { installmentId: string; onSuccess: () => void }) {
  const qc = useQueryClient();
  const [type, setType] = useState<RecoveryActionType>('CALLED');
  const [note, setNote] = useState('');
  const [promiseDate, setPromiseDate] = useState('');
  const [open, setOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: () => recoveryApi.create({
      installmentId,
      type,
      note: note.trim() || undefined,
      promiseDate: promiseDate || undefined,
    }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['recovery', installmentId] });
      setNote('');
      setPromiseDate('');
      setType('CALLED');
      setOpen(false);
      onSuccess();
    },
  });

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors"
      >
        <Plus size={15} /> Log recovery action
      </button>
    );
  }

  return (
    <div className="border border-gray-200 rounded-2xl p-4 space-y-3 bg-gray-50">
      {/* Action type buttons */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">Action type</p>
        <div className="flex flex-wrap gap-1.5">
          {ACTION_TYPES.map((t) => {
            const cfg = ACTION_CONFIG[t];
            const Icon = cfg.icon;
            return (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                  type === t
                    ? `${cfg.bg} ${cfg.color} border-current ring-1 ${cfg.ring}`
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                }`}
              >
                <Icon size={12} />
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Promise date (only for PROMISE_TO_PAY) */}
      {type === 'PROMISE_TO_PAY' && (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Promise date</label>
          <input
            type="date"
            value={promiseDate}
            onChange={(e) => setPromiseDate(e.target.value)}
            min={new Date().toISOString().slice(0, 10)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      )}

      {/* Note */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Note (optional)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder={
            type === 'CALLED'         ? 'e.g. No answer, tried 3 times' :
            type === 'VISITED'        ? 'e.g. Not home, neighbor confirmed address' :
            type === 'PROMISE_TO_PAY' ? 'e.g. Customer says salary on 5th' :
            type === 'REFUSED'        ? 'e.g. Claims product was defective' :
                                        'e.g. Registered post sent, tracking #123'
          }
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => { setOpen(false); setNote(''); setPromiseDate(''); }}
          className="flex-1 px-3 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-white transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || (type === 'PROMISE_TO_PAY' && !promiseDate)}
          className="flex-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition-colors"
        >
          {mutation.isPending ? 'Saving…' : 'Log Action'}
        </button>
      </div>
    </div>
  );
}

// ── Escalation tier ───────────────────────────────────────────────────────────
type Tier = { label: string; bg: string; text: string; border: string; suggestion: string };

function escalationTier(dpd: number): Tier {
  if (dpd <= 0)   return { label: 'On Schedule',  bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', suggestion: '' };
  if (dpd <= 7)   return { label: 'Level 1 — Call', bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   suggestion: 'Call the customer and remind them of the due amount.' };
  if (dpd <= 30)  return { label: 'Level 2 — Visit', bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200',  suggestion: 'Visit the customer's address and get a promise date in writing.' };
  if (dpd <= 90)  return { label: 'Level 3 — Written Notice', bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     suggestion: 'Send a formal written notice and record a REFUSED or PROMISE_TO_PAY action.' };
  return           { label: 'Level 4 — Legal',  bg: 'bg-red-100',   text: 'text-red-800',     border: 'border-red-300',     suggestion: 'Escalate to legal proceedings — log a Legal Warning Sent action.' };
}

function computeDPD(inst: Installment): number {
  if (inst.status !== 'ACTIVE') return 0;
  const now  = new Date();
  const start = new Date(inst.startDate);
  const isDaily = inst.paymentFrequency === 'daily';
  const mon  = Number(inst.monthly);
  const tot  = Number(inst.totalAmount);
  const down = Number(inst.downPayment);
  const rem  = Number(inst.remaining);
  if (mon <= 0 || !inst.isOverdue) return 0;
  const paidPeriods = Math.round(((tot - down) - rem) / mon);
  const nextPeriod  = paidPeriods + 1;
  let dueDate: Date;
  if (isDaily) {
    dueDate = new Date(start);
    dueDate.setDate(dueDate.getDate() + nextPeriod);
  } else {
    dueDate = new Date(start);
    dueDate.setMonth(dueDate.getMonth() + nextPeriod);
    if (inst.paymentDueDay) dueDate.setDate(inst.paymentDueDay);
  }
  return Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / 86_400_000));
}

// ── Main drawer ───────────────────────────────────────────────────────────────
export default function RecoveryDrawer({ inst, onClose }: { inst: Installment; onClose: () => void }) {
  const qc = useQueryClient();

  const { data: actions = [], isLoading } = useQuery({
    queryKey: ['recovery', inst.id],
    queryFn: () => recoveryApi.list(inst.id),
    staleTime: 30_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => recoveryApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['recovery', inst.id] }),
  });

  const remaining = Number(inst.remaining);
  const totalAmount = Number(inst.totalAmount);
  const progress = Math.round(((totalAmount - remaining) / totalAmount) * 100);
  const dpd  = computeDPD(inst);
  const tier = escalationTier(dpd);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900">{inst.customerName}</h2>
              <p className="text-xs text-gray-400 mt-0.5">{inst.productName} · {inst.customerPhone}</p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Progress */}
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>PKR {(totalAmount - remaining).toLocaleString()} paid</span>
              <span className="text-red-500 font-medium">PKR {remaining.toLocaleString()} remaining</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Escalation banner */}
          {dpd > 0 && (
            <div className={`rounded-xl border px-4 py-3 ${tier.bg} ${tier.border}`}>
              <div className="flex items-center justify-between mb-0.5">
                <span className={`text-xs font-bold uppercase tracking-wide ${tier.text}`}>{tier.label}</span>
                <span className={`text-xs font-bold ${tier.text}`}>{dpd} DPD</span>
              </div>
              {tier.suggestion && <p className="text-xs text-gray-600">{tier.suggestion}</p>}
            </div>
          )}
          {/* Add form */}
          <AddActionForm installmentId={inst.id} onSuccess={() => {}} />

          {/* Timeline */}
          {isLoading ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-xl" />)}
            </div>
          ) : actions.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <AlertTriangle size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No recovery actions yet</p>
              <p className="text-xs mt-1 text-gray-300">Log your first action above</p>
            </div>
          ) : (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Recovery Timeline · {actions.length} action{actions.length !== 1 ? 's' : ''}
              </p>
              <div>
                {actions.map((action) => (
                  <TimelineItem
                    key={action.id}
                    action={action}
                    onDelete={(id) => {
                      if (confirm('Delete this recovery action?')) deleteMutation.mutate(id);
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
