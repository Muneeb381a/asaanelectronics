import { PageHeader, Card, CardHead, StatCard, btn, shell, inputCls } from '../components/ui/Page';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Wrench, Plus, X, Trash2, Clock, CheckCircle2, PackageSearch, AlertTriangle,
  Smartphone, Wallet, CreditCard, Package,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../utils/error.ts';
import { fmtDate } from '../utils/dateFormat.ts';
import { repairJobsApi, type RepairJob, type RepairJobStatus, type PaymentMethod } from '../api/repairJobs.api.ts';
import { useAuthStore } from '../store/auth.store.ts';
import ConfirmDialog from '../components/ui/ConfirmDialog.tsx';
import { RowSkeleton } from '../components/ui/Skeleton.tsx';

const STATUSES: RepairJobStatus[] = ['RECEIVED', 'DIAGNOSING', 'AWAITING_PARTS', 'REPAIRING', 'REPAIRED', 'UNREPAIRABLE', 'RETURNED'];
const STATUS_LABELS: Record<RepairJobStatus, string> = {
  RECEIVED: 'Received', DIAGNOSING: 'Diagnosing', AWAITING_PARTS: 'Awaiting Parts',
  REPAIRING: 'Repairing', REPAIRED: 'Ready for Pickup', UNREPAIRABLE: 'Unrepairable', RETURNED: 'Returned',
};
const STATUS_COLORS: Record<RepairJobStatus, string> = {
  RECEIVED:       'bg-slate-100 text-slate-600',
  DIAGNOSING:     'bg-amber-100 text-amber-700',
  AWAITING_PARTS: 'bg-orange-100 text-orange-700',
  REPAIRING:      'bg-blue-100 text-blue-700',
  REPAIRED:       'bg-emerald-100 text-emerald-700',
  UNREPAIRABLE:   'bg-red-100 text-red-700',
  RETURNED:       'bg-gray-100 text-gray-500',
};
const NEXT_STATUS: Record<RepairJobStatus, RepairJobStatus | null> = {
  RECEIVED: 'DIAGNOSING', DIAGNOSING: 'REPAIRING', AWAITING_PARTS: 'REPAIRING',
  REPAIRING: 'REPAIRED', REPAIRED: 'RETURNED', UNREPAIRABLE: null, RETURNED: null,
};
const METHODS: PaymentMethod[] = ['CASH', 'BANK', 'JAZZCASH', 'EASYPAISA', 'OTHER'];
const METHOD_ICONS: Record<PaymentMethod, React.ReactNode> = {
  CASH: <Wallet size={11}/>, BANK: <CreditCard size={11}/>, JAZZCASH: <Smartphone size={11}/>,
  EASYPAISA: <Smartphone size={11}/>, OTHER: <Package size={11}/>,
};
const CLOSED = new Set<RepairJobStatus>(['RETURNED', 'UNREPAIRABLE']);

const pkr = (v: number) => 'PKR ' + v.toLocaleString('en-PK', { maximumFractionDigits: 0 });

function initForm() {
  return { customerName: '', customerPhone: '', deviceName: '', imeiNumber: '', issueDescription: '', estimatedCost: '', promisedAt: '' };
}

export default function RepairJobsPage() {
  const qc      = useQueryClient();
  const user    = useAuthStore((s) => s.user);
  const isOwner = user?.role === 'SELLER_OWNER';

  const [statusFilter, setStatusFilter] = useState<RepairJobStatus | 'ACTIVE' | 'ALL'>('ACTIVE');
  const [showModal,    setShowModal]    = useState(false);
  const [form,         setForm]         = useState(initForm);
  const [activeJob,    setActiveJob]    = useState<RepairJob | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['repair-jobs'],
    queryFn: () => repairJobsApi.list(),
    staleTime: 30_000,
  });

  const visible = jobs.filter((j) => {
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'ACTIVE') return !CLOSED.has(j.status);
    return j.status === statusFilter;
  });

  const activeCount   = jobs.filter((j) => !CLOSED.has(j.status)).length;
  const readyCount    = jobs.filter((j) => j.status === 'REPAIRED').length;
  const monthRevenue  = jobs
    .filter((j) => j.status === 'RETURNED' && j.returnedAt && new Date(j.returnedAt).getMonth() === new Date().getMonth())
    .reduce((a, j) => a + Number(j.actualCost ?? 0), 0);

  const createMutation = useMutation({
    mutationFn: repairJobsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['repair-jobs'] });
      toast.success('Repair job created');
      setShowModal(false);
      setForm(initForm());
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Failed to create job')),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof repairJobsApi.updateStatus>[1] }) =>
      repairJobsApi.updateStatus(id, body),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['repair-jobs'] });
      setActiveJob(updated);
      toast.success(`Status → ${STATUS_LABELS[updated.status]}`);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: repairJobsApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['repair-jobs'] });
      setConfirmDelete(null);
      setActiveJob(null);
      toast.success('Job deleted');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customerName.trim() || !form.customerPhone.trim() || !form.deviceName.trim() || !form.issueDescription.trim()) return;
    createMutation.mutate({
      customerName: form.customerName.trim(),
      customerPhone: form.customerPhone.trim(),
      deviceName: form.deviceName.trim(),
      imeiNumber: form.imeiNumber.trim() || undefined,
      issueDescription: form.issueDescription.trim(),
      estimatedCost: form.estimatedCost ? Number(form.estimatedCost) : undefined,
      promisedAt: form.promisedAt || undefined,
    });
  }

  return (
    <div className={shell.wide}>
      <PageHeader
        title="Repair Jobs"
        subtitle={`Service tracking — IMEI/warranty se alag${jobs.length > 0 ? ` · ${jobs.length} total` : ''}`}
        icon={Wrench}
        actions={<button onClick={() => setShowModal(true)} className={btn.success}><Plus size={14}/> Naya Repair Job</button>}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5">
        <StatCard label="Active jobs" icon={Clock} tone="amber" value={activeCount} sub="In progress" />
        <StatCard label="Ready for pickup" icon={CheckCircle2} tone="emerald" value={readyCount} sub="Customer ko inform karo" />
        <StatCard label="Is mahine revenue" icon={Wallet} tone="blue" value={pkr(monthRevenue)} sub="Returned jobs se" />
      </div>

      <Card padded className="mt-5">
        <div className="flex items-center gap-1.5 flex-wrap">
          {(['ACTIVE', 'ALL', ...STATUSES] as const).map((s) => {
            const label = s === 'ACTIVE' ? 'Active' : s === 'ALL' ? 'Sab' : STATUS_LABELS[s];
            const cnt = s === 'ACTIVE' ? activeCount : s === 'ALL' ? jobs.length : jobs.filter((j) => j.status === s).length;
            return (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  statusFilter === s ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {label}{cnt > 0 && <span className="tabular-nums"> ({cnt})</span>}
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="mt-5 overflow-hidden">
        <CardHead icon={Wrench} tone="blue" title="Jobs" subtitle={`${visible.length} showing`} />
        {isLoading ? (
          <RowSkeleton rows={6} />
        ) : visible.length === 0 ? (
          <div className="py-14 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center">
              <PackageSearch size={20} className="text-gray-300" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-600">Koi job nahi</p>
              <p className="text-xs text-gray-400 mt-1">"Naya Repair Job" par click karo</p>
            </div>
          </div>
        ) : (
          <div>
            {visible.map((j, i) => (
              <button key={j.id} onClick={() => setActiveJob(j)}
                className={`w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-gray-50 transition ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${STATUS_COLORS[j.status]}`}>
                  <Wrench size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900 truncate">{j.deviceName}</p>
                    <span className="text-[10px] font-mono text-gray-400">{j.jobNumber}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-gray-500 truncate">{j.customerName}</p>
                    <span className="text-gray-200">·</span>
                    <p className="text-xs text-gray-400 tabular-nums">{j.customerPhone}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[j.status]}`}>{STATUS_LABELS[j.status]}</span>
                  <p className="text-[10px] text-gray-400 mt-1">{fmtDate(j.createdAt)}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <div>
                <p className="text-gray-900 font-semibold text-sm">Naya Repair Job</p>
                <p className="text-gray-500 text-xs mt-0.5">Device aur customer details bharen</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-700 transition p-1"><X size={16} /></button>
            </div>
            <form id="repair-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Customer Name <span className="text-red-500">*</span></label>
                  <input autoFocus value={form.customerName} onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))} className={inputCls} required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Phone <span className="text-red-500">*</span></label>
                  <input type="tel" value={form.customerPhone} onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))} placeholder="03XXXXXXXXX" className={inputCls} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Device <span className="text-red-500">*</span></label>
                  <input value={form.deviceName} onChange={(e) => setForm((f) => ({ ...f, deviceName: e.target.value }))} placeholder="e.g. Samsung A35" className={inputCls} required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">IMEI <span className="font-normal text-slate-400">(optional)</span></label>
                  <input value={form.imeiNumber} onChange={(e) => setForm((f) => ({ ...f, imeiNumber: e.target.value.replace(/\D/g, '').slice(0, 15) }))} className={`${inputCls} font-mono`} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Issue <span className="text-red-500">*</span></label>
                <textarea value={form.issueDescription} onChange={(e) => setForm((f) => ({ ...f, issueDescription: e.target.value }))} rows={3} placeholder="Screen cracked, touch not working…" className={inputCls} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Estimated Cost <span className="font-normal text-slate-400">(optional)</span></label>
                  <input type="number" min={0} value={form.estimatedCost} onChange={(e) => setForm((f) => ({ ...f, estimatedCost: e.target.value }))} className={`${inputCls} tabular-nums`} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Promised Date <span className="font-normal text-slate-400">(optional)</span></label>
                  <input type="date" value={form.promisedAt} onChange={(e) => setForm((f) => ({ ...f, promisedAt: e.target.value }))} className={inputCls} />
                </div>
              </div>
            </form>
            <div className="px-5 py-4 border-t border-slate-100 flex gap-3 shrink-0">
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 text-sm font-bold rounded-xl hover:bg-slate-50 transition">Cancel</button>
              <button type="submit" form="repair-form" disabled={createMutation.isPending}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition flex items-center justify-center gap-1.5">
                {createMutation.isPending ? <span className="animate-pulse">Ho raha…</span> : <><CheckCircle2 size={14} /> Job Banao</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeJob && (
        <JobDrawer
          job={activeJob}
          isOwner={isOwner}
          onClose={() => setActiveJob(null)}
          onAdvance={(body) => statusMutation.mutate({ id: activeJob.id, body })}
          isPending={statusMutation.isPending}
          onDelete={() => setConfirmDelete(activeJob.id)}
        />
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Repair Job Delete Karo?"
        description="Ye job permanently delete ho jaegi. Agar payment collect ho chuki thi, wo ledger se bhi hat jaegi."
        confirmLabel="Delete Karo"
        variant="danger"
        isPending={deleteMutation.isPending}
        onConfirm={() => { if (confirmDelete) deleteMutation.mutate(confirmDelete); }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

function JobDrawer({ job, isOwner, onClose, onAdvance, isPending, onDelete }: {
  job: RepairJob;
  isOwner: boolean;
  onClose: () => void;
  onAdvance: (body: { status: RepairJobStatus; actualCost?: number; paymentMethod?: PaymentMethod; partsUsed?: string; notes?: string }) => void;
  isPending: boolean;
  onDelete: () => void;
}) {
  const [actualCost, setActualCost] = useState(job.actualCost ?? job.estimatedCost ?? '');
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [partsUsed, setPartsUsed] = useState(job.partsUsed ?? '');
  const next = NEXT_STATUS[job.status];
  const closed = CLOSED.has(job.status);
  const needsCostAndMethod = next === 'RETURNED';

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <p className="text-gray-900 font-semibold text-sm">{job.jobNumber}</p>
            <p className="text-gray-500 text-xs mt-0.5">{job.deviceName} · {job.customerName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition p-1"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_COLORS[job.status]}`}>{STATUS_LABELS[job.status]}</span>

          <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-sm">
            <p className="text-gray-700">{job.issueDescription}</p>
            {job.imeiNumber && <p className="text-xs text-gray-400 font-mono">IMEI: {job.imeiNumber}</p>}
            {job.estimatedCost && <p className="text-xs text-gray-500">Estimate: {pkr(Number(job.estimatedCost))}</p>}
            <p className="text-xs text-gray-400">Phone: {job.customerPhone}</p>
          </div>

          {!closed && next && (
            <div className="space-y-3">
              {needsCostAndMethod && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">Final Cost</label>
                    <input type="number" min={0} value={actualCost} onChange={(e) => setActualCost(e.target.value)} className={`${inputCls} tabular-nums font-bold`} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">Payment Method</label>
                    <div className="flex flex-wrap gap-1.5">
                      {METHODS.map((m) => (
                        <button key={m} type="button" onClick={() => setMethod(m)}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-bold transition ${
                            method === m ? 'bg-blue-100 text-blue-700 ring-2 ring-offset-1 ring-blue-400 border-transparent' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                          }`}>
                          {METHOD_ICONS[m]} {m}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Parts Used <span className="font-normal text-slate-400">(optional)</span></label>
                <input value={partsUsed} onChange={(e) => setPartsUsed(e.target.value)} placeholder="e.g. LCD screen, battery" className={inputCls} />
              </div>
            </div>
          )}

          {job.status === 'REPAIRED' && (
            <button type="button"
              onClick={() => onAdvance({ status: 'UNREPAIRABLE', notes: 'Marked unrepairable after diagnosis' })}
              className="text-xs text-red-500 hover:underline flex items-center gap-1">
              <AlertTriangle size={11} /> Mark as unrepairable instead
            </button>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex gap-3 shrink-0">
          {isOwner && (
            <button onClick={onDelete} className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition">
              <Trash2 size={16} />
            </button>
          )}
          {closed ? (
            <div className="flex-1 text-center text-xs text-gray-400 py-2.5">Job closed</div>
          ) : next ? (
            <button
              onClick={() => onAdvance({
                status: next,
                ...(needsCostAndMethod && { actualCost: Number(actualCost) || 0, paymentMethod: method }),
                ...(partsUsed.trim() && { partsUsed: partsUsed.trim() }),
              })}
              disabled={isPending}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition flex items-center justify-center gap-1.5">
              {isPending ? <span className="animate-pulse">Ho raha…</span> : <>Move to {STATUS_LABELS[next]}</>}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
