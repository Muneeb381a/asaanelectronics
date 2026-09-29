import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { XCircle, Plus, Loader2 } from 'lucide-react';
import { recoveryApi, type RecoveryActionType } from '../api/recovery.api.ts';
import { getErrorMessage } from '../utils/error.ts';
import { ACTION_META, ACTION_TYPES } from '../utils/collectionStage.tsx';

// Shared "log a recovery action" modal — used by RecoveryPage (overdue list)
// and the agent-portfolio views (Staff Portfolio tab, staff's own dashboard
// card) so an agent can record a call/visit/promise from wherever they see
// their assigned customer, not only from the dedicated Recovery page.
export default function RecoveryLogModal({ installmentId, onClose }: { installmentId: string; onClose: () => void }) {
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
      qc.invalidateQueries({ queryKey: ['promises-all'] });
      qc.invalidateQueries({ queryKey: ['promises-due'] });
      qc.invalidateQueries({ queryKey: ['overdue-stage'] });
      qc.invalidateQueries({ queryKey: ['installments-recovery'] });
      qc.invalidateQueries({ queryKey: ['agent-portfolio'] });
      qc.invalidateQueries({ queryKey: ['my-assignments'] });
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
