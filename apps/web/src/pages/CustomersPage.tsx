import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../utils/error.ts';
import { X, CreditCard, TrendingUp, MessageCircle, ShieldCheck, ShieldX, Clock, MapPin, Printer, StickyNote, Trash2, Send, Users } from 'lucide-react';
import { customersApi, type Customer, type RiskLabel, type LifecycleStage, type VerificationStatus } from '../api/customers.api.ts';
import type { CreateCustomerInput } from '@assaan/shared';
import { installmentsApi, type Installment, type InstallmentStatus } from '../api/installments.api.ts';
import { staffApi, type StaffMember } from '../api/staff.api.ts';
import { verificationsApi } from '../api/verifications.api.ts';
import { customerNotesApi, type CustomerNote } from '../api/customerNotes.api.ts';
import CustomerForm from '../features/customers/CustomerForm.tsx';
import CnicCustomerLookup from '../features/customers/CnicCustomerLookup.tsx';
import InstallmentForm from '../features/installments/InstallmentForm.tsx';
import { useDebounce } from '../hooks/useDebounce.ts';
import { sellersApi } from '../api/sellers.api.ts';
import { openWhatsApp, reminderMessage } from '../utils/whatsapp.ts';
import { useAuthStore } from '../store/auth.store.ts';
import CustomerAgreementPrint from '../components/CustomerAgreementPrint.tsx';
import CustomerStatementPrint from '../components/CustomerStatementPrint.tsx';
import { TableSkeleton, CardSkeleton, RowSkeleton, EmptyState } from '../components/ui/Skeleton.tsx';

const VSTATUS: Record<VerificationStatus, { label: string; cls: string; icon: React.ReactNode }> = {
  PENDING:      { label: 'Pending',    cls: 'bg-amber-100 text-amber-700', icon: <Clock size={10} /> },
  UNDER_REVIEW: { label: 'In Review',  cls: 'bg-blue-100 text-blue-700',   icon: <Clock size={10} /> },
  APPROVED:     { label: 'Verified',   cls: 'bg-green-100 text-green-700', icon: <ShieldCheck size={10} /> },
  REJECTED:     { label: 'Rejected',   cls: 'bg-red-100 text-red-700',     icon: <ShieldX size={10} /> },
};

function VerifBadge({ status }: { status: VerificationStatus }) {
  const s = VSTATUS[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.cls}`}>
      {s.icon}{s.label}
    </span>
  );
}

function AssignAvoModal({ customer, avos, onClose }: { customer: Customer; avos: StaffMember[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [avoId, setAvoId] = useState('');
  const eligibleAvos = avos.filter(
    (a) => a.permissions?.canVerifyCustomers && a.id !== customer.createdByUserId,
  );

  const { mutate, isPending } = useMutation({
    mutationFn: () => verificationsApi.assignAvo(customer.id, avoId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast.success('AVO assigned');
      onClose();
    },
    onError: (e: any) => toast.error(getErrorMessage(e)),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Assign AVO</h3>
        <p className="text-xs text-gray-400 mb-4">Customer: <span className="font-medium text-gray-700">{customer.name}</span></p>
        {eligibleAvos.length === 0 ? (
          <p className="text-xs text-amber-600 bg-amber-50 rounded-xl p-3">No AVO-enabled staff available. Enable <strong>canVerifyCustomers</strong> on a staff member first.</p>
        ) : (
          <div className="space-y-2 mb-4">
            {eligibleAvos.map((a) => (
              <label key={a.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition ${avoId === a.id ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-gray-200'}`}>
                <input type="radio" name="avo" value={a.id} checked={avoId === a.id} onChange={() => setAvoId(a.id)} className="accent-blue-600" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{a.name}</p>
                  <p className="text-xs text-gray-400">{a.email}</p>
                </div>
              </label>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm text-gray-600 hover:bg-gray-50 transition">Cancel</button>
          <button onClick={() => mutate()} disabled={!avoId || isPending}
            className="flex-1 bg-blue-600 text-white rounded-xl py-2 text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
            {isPending ? 'Assigning…' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  );
}

const RISK_STYLES: Record<RiskLabel, { label: string; scoreCls: string; badgeCls: string }> = {
  GOOD:      { label: 'Good',      scoreCls: 'text-emerald-700', badgeCls: 'bg-emerald-100 text-emerald-700' },
  AVERAGE:   { label: 'Average',   scoreCls: 'text-amber-700',   badgeCls: 'bg-amber-100   text-amber-700'   },
  RISKY:     { label: 'Risky',     scoreCls: 'text-orange-700',  badgeCls: 'bg-orange-100  text-orange-700'  },
  BLACKLIST: { label: 'Blacklist', scoreCls: 'text-red-700',     badgeCls: 'bg-red-100     text-red-700'     },
};

function RiskBadge({ score, label }: { score: number; label: RiskLabel }) {
  const s = RISK_STYLES[label];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${s.badgeCls}`}>
      {s.label}
      <span className={`font-mono font-bold ${s.scoreCls}`}>{100 - score}</span>
    </span>
  );
}

const LIFECYCLE_META: Record<LifecycleStage, { label: string; cls: string; dot: string }> = {
  LEAD:     { label: 'Lead',     cls: 'bg-slate-100  text-slate-600',  dot: 'bg-slate-400'  },
  VERIFIED: { label: 'Verified', cls: 'bg-blue-100   text-blue-700',   dot: 'bg-blue-500'   },
  ACTIVE:   { label: 'Active',   cls: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  AT_RISK:  { label: 'At Risk',  cls: 'bg-amber-100  text-amber-700',  dot: 'bg-amber-500'  },
  DEFAULT:  { label: 'Default',  cls: 'bg-red-100    text-red-700',    dot: 'bg-red-500'    },
  CLOSED:   { label: 'Closed',   cls: 'bg-gray-100   text-gray-600',   dot: 'bg-gray-400'   },
  REPEAT:   { label: 'Repeat',   cls: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500' },
};

const LIFECYCLE_ORDER: LifecycleStage[] = ['LEAD','VERIFIED','ACTIVE','AT_RISK','DEFAULT','CLOSED','REPEAT'];

function LifecycleBadge({ stage }: { stage: LifecycleStage }) {
  const m = LIFECYCLE_META[stage];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${m.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

function LifecycleFunnel({ counts, active, onSelect }: {
  counts: Record<string, number>;
  active: string;
  onSelect: (s: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 flex-wrap mb-5">
      {LIFECYCLE_ORDER.map((stage, i) => {
        const m = LIFECYCLE_META[stage];
        const n = counts[stage] ?? 0;
        const isActive = active === stage;
        return (
          <div key={stage} className="flex items-center gap-1">
            <button
              onClick={() => onSelect(isActive ? '' : stage)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                isActive
                  ? `${m.cls} border-current shadow-sm`
                  : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isActive ? m.dot : 'bg-gray-300'}`} />
              {m.label}
              <span className={`font-mono font-bold ml-0.5 ${isActive ? '' : 'text-gray-400'}`}>{n}</span>
            </button>
            {i < LIFECYCLE_ORDER.length - 1 && (
              <span className="text-gray-200 text-xs select-none">›</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

type Modal = { mode: 'add'; prefillCnic?: string } | { mode: 'edit'; customer: Customer } | null;

const STATUS_STYLES: Record<InstallmentStatus, string> = {
  PENDING:   'bg-amber-100 text-amber-700',
  ACTIVE:    'bg-green-100 text-green-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
  DEFAULTED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
  CLOSED:    'bg-slate-100 text-slate-500',
};

function pkr(v: string | number) {
  return 'PKR ' + Number(v).toLocaleString('en-PK', { maximumFractionDigits: 0 });
}

function NotesPanel({ customer }: { customer: Customer }) {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.role === 'SELLER_OWNER';
  const [draft, setDraft] = useState('');
  const [page, setPage] = useState(1);
  const LIMIT = 10;

  const { data: notesPage, isLoading } = useQuery({
    queryKey: ['customer-notes', customer.id, page],
    queryFn: () => customerNotesApi.list(customer.id, page, LIMIT),
  });

  const notes = notesPage?.data ?? [];
  const hasMore = notesPage ? notesPage.total > page * LIMIT : false;

  const addMutation = useMutation({
    mutationFn: () => customerNotesApi.add(customer.id, draft),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer-notes', customer.id] });
      setPage(1);
      setDraft('');
      toast.success('Note added');
    },
    onError: (e: any) => toast.error(getErrorMessage(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (noteId: string) => customerNotesApi.remove(customer.id, noteId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer-notes', customer.id] }),
    onError: (e: any) => toast.error(getErrorMessage(e)),
  });

  return (
    <div className="flex flex-col h-full">
      {/* Notes list */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {isLoading ? (
          <RowSkeleton rows={3} />
        ) : notes.length === 0 ? (
          <div className="text-center py-12">
            <StickyNote size={28} className="mx-auto mb-3 text-gray-200" />
            <p className="text-sm text-gray-400">No internal notes yet.</p>
            <p className="text-xs text-gray-300 mt-0.5">Staff notes are private — customers never see them.</p>
          </div>
        ) : (
          <>
            {notes.map((n: CustomerNote) => (
              <div key={n.id} className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 group">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-gray-800 leading-relaxed flex-1">{n.note}</p>
                  {isOwner && (
                    <button
                      onClick={() => { if (confirm('Delete this note?')) deleteMutation.mutate(n.id); }}
                      className="text-gray-300 hover:text-red-500 transition shrink-0 opacity-0 group-hover:opacity-100">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-amber-600 mt-1.5">
                  {n.authorName ?? 'Unknown'} · {new Date(n.createdAt).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
            ))}
            {hasMore && (
              <button onClick={() => setPage((p) => p + 1)}
                className="w-full text-xs text-blue-600 hover:underline py-2 font-medium">
                Load more ({notesPage!.total - page * LIMIT} remaining)
              </button>
            )}
          </>
        )}
      </div>

      {/* Add note input */}
      <div className="px-6 py-4 border-t border-gray-100 shrink-0">
        <div className="flex gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && draft.trim()) { e.preventDefault(); addMutation.mutate(); } }}
            rows={2}
            maxLength={500}
            placeholder="Add a private note… (Enter to save)"
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
          />
          <button
            onClick={() => addMutation.mutate()}
            disabled={!draft.trim() || addMutation.isPending}
            className="self-end px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition disabled:opacity-40">
            <Send size={14} />
          </button>
        </div>
        {draft.length > 400 && (
          <p className="text-[10px] text-gray-400 mt-1 text-right">{500 - draft.length} chars left</p>
        )}
      </div>
    </div>
  );
}

function RiskBreakdownPanel({ customerId, riskScore, riskLabel }: {
  customerId: string; riskScore: number; riskLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['risk-breakdown', customerId],
    queryFn: () => customersApi.getRiskBreakdown(customerId),
    enabled: open,
  });

  const color = riskLabel === 'GOOD' ? 'text-green-600' : riskLabel === 'AVERAGE' ? 'text-amber-600'
    : riskLabel === 'RISKY' ? 'text-orange-600' : 'text-red-600';

  return (
    <div className="px-6 py-3 border-b border-gray-50 shrink-0">
      <button onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700 transition">
        <span>Credit Score — <span className={color}>{100 - riskScore}/100 ({riskLabel})</span></span>
        <span className="text-gray-300">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          {isLoading ? (
            <div className="h-20 bg-gray-50 rounded-xl animate-pulse" />
          ) : data && (
            Object.entries(data.factors).map(([key, f]) => (
              <div key={key}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-gray-600">{f.label}</span>
                  <span className={f.score > 0 ? 'text-red-500 font-semibold' : 'text-green-500 font-semibold'}>
                    +{f.score}/{f.max}
                  </span>
                </div>
                <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${f.score === 0 ? 'bg-green-400' : f.score >= f.max * 0.75 ? 'bg-red-400' : 'bg-amber-400'}`}
                    style={{ width: `${(f.score / f.max) * 100}%` }} />
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ReVerifyButton({ customerId }: { customerId: string }) {
  const qc = useQueryClient();
  const { mutate, isPending } = useMutation({
    mutationFn: () => verificationsApi.reVerify(customerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['verif-report', customerId] });
      toast.success('Customer reset to Pending — assign an AVO to re-verify');
    },
    onError: (e: any) => toast.error(getErrorMessage(e)),
  });

  return (
    <button
      onClick={() => { if (confirm('Reset verification status to Pending? AVO will need to be re-assigned.')) mutate(); }}
      disabled={isPending}
      className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-red-200 text-xs text-red-600 hover:bg-red-50 transition disabled:opacity-50">
      {isPending ? 'Resetting…' : 'Re-submit for Verification'}
    </button>
  );
}

function CustomerHistoryDrawer({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const [showPrint, setShowPrint] = useState(false);
  const [showStatement, setShowStatement] = useState(false);
  const [showNewInstallment, setShowNewInstallment] = useState(false);
  const [activeTab, setActiveTab] = useState<'history' | 'notes'>('history');
  const [visible, setVisible] = useState(false);
  const drawerUser = useAuthStore((s) => s.user);
  const isOwnerInDrawer = drawerUser?.role === 'SELLER_OWNER';
  const canAddInstallmentInDrawer =
    isOwnerInDrawer ||
    !!(drawerUser?.permissions as Record<string, boolean> | null | undefined)?.canAddInstallment;

  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') handleClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 280);
  }
  const qcDrawer = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['customer-installments', customer.id],
    queryFn: () => installmentsApi.list({ customerId: customer.id, limit: 100 }),
  });
  const { data: shopData } = useQuery({ queryKey: ['shop-me'], queryFn: sellersApi.getMe });

  const createInstallmentMutation = useMutation({
    mutationFn: installmentsApi.create,
    onSuccess: () => {
      qcDrawer.invalidateQueries({ queryKey: ['customer-installments', customer.id] });
      qcDrawer.invalidateQueries({ queryKey: ['installments'] });
      setShowNewInstallment(false);
      toast.success('Installment created');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Failed to create installment')),
  });
  const { data: verifReport } = useQuery({
    queryKey: ['verif-report', customer.id],
    queryFn: () => verificationsApi.getReport(customer.id),
  });

  const installments = data?.data ?? [];
  const totalBusiness = installments.reduce((s, i) => s + Number(i.totalAmount), 0);
  const totalPaid     = installments.reduce((s, i) => s + (Number(i.totalAmount) - Number(i.remaining)), 0);
  const totalRemaining = installments.reduce((s, i) => s + Number(i.remaining), 0);
  const activeCount   = installments.filter((i) => i.status === 'ACTIVE').length;

  return (
    <>
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`} onClick={handleClose} />
      <div className={`relative w-full max-w-xl bg-white h-full flex flex-col shadow-2xl overflow-hidden transition-transform duration-300 ease-out ${visible ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white text-base font-bold shrink-0">
              {customer.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-bold text-gray-900">{customer.name}</h2>
                {customer.customerType === 'dukaan-dar' && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 border border-orange-200">Dukaan-Dar</span>
                )}
                <LifecycleBadge stage={customer.lifecycleStage ?? 'LEAD'} />
                <RiskBadge score={customer.riskScore ?? 0} label={customer.riskLabel ?? 'GOOD'} />
              </div>
              <p className="text-xs text-gray-400">{customer.phone} · {customer.cnicMasked}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <button
              onClick={() => setShowStatement(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition"
            >
              <Printer size={13} />
              Statement
            </button>
            <button
              onClick={() => setShowPrint(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition"
              title="Print Agreement"
            >
              <Printer size={13} />
              Agreement
            </button>
            <button onClick={handleClose} className="p-1.5 text-gray-400 hover:text-gray-700 transition rounded-lg hover:bg-gray-100">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-6 shrink-0">
          {([
            { key: 'history', label: 'History' },
            { key: 'notes',   label: 'Internal Notes' },
          ] as const).map(({ key, label }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
                activeTab === key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}>
              {key === 'notes' && <StickyNote size={13} className="inline mr-1.5 -mt-0.5" />}
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'notes' ? (
          <NotesPanel customer={customer} />
        ) : (<>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3 px-6 py-4 border-b border-gray-50 shrink-0">
          {[
            { label: 'Total Business', value: pkr(totalBusiness), color: 'text-gray-900' },
            { label: 'Total Paid',     value: pkr(totalPaid),     color: 'text-emerald-600' },
            { label: 'Remaining',      value: pkr(totalRemaining), color: totalRemaining > 0 ? 'text-orange-500' : 'text-gray-400' },
          ].map((s) => (
            <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-400 mb-0.5">{s.label}</p>
              <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Verification report */}
        {verifReport && (
          <div className="px-6 py-3 border-b border-gray-50 shrink-0">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Verification Report</p>
            <div className={`rounded-xl p-3 text-xs space-y-2 ${verifReport.status === 'APPROVED' ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'}`}>
              <div className="flex items-center justify-between">
                <span className={`font-bold ${verifReport.status === 'APPROVED' ? 'text-green-700' : 'text-red-700'}`}>
                  {verifReport.status === 'APPROVED' ? '✓ Approved' : '✗ Rejected'}
                </span>
                <span className="text-gray-400">by {verifReport.avo?.name ?? 'AVO'}</span>
              </div>
              {verifReport.latitude && verifReport.longitude && (
                <a
                  href={`https://maps.google.com/?q=${verifReport.latitude},${verifReport.longitude}`}
                  target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-blue-600 hover:underline"
                >
                  <MapPin size={11} />
                  View on map · ±{Math.round(Number(verifReport.locationAccuracy))}m accuracy
                </a>
              )}
              {verifReport.photoEvidenceUrl && (
                <a href={verifReport.photoEvidenceUrl} target="_blank" rel="noreferrer">
                  <img src={verifReport.photoEvidenceUrl} alt="evidence" loading="lazy"
                    className="w-full h-24 object-cover rounded-lg mt-1" />
                </a>
              )}
              {verifReport.notes && <p className="text-gray-600 italic">"{verifReport.notes}"</p>}
              {verifReport.status === 'REJECTED' && isOwnerInDrawer && (
                <ReVerifyButton customerId={customer.id} />
              )}
            </div>
          </div>
        )}

        {/* Risk Breakdown */}
        <RiskBreakdownPanel customerId={customer.id} riskScore={customer.riskScore} riskLabel={customer.riskLabel} />

        {/* Installments list */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-gray-700">
              Purchase History
              <span className="ml-2 text-xs font-normal text-gray-400">
                {installments.length} total · {activeCount} active
              </span>
            </p>
            {canAddInstallmentInDrawer && (
              <button
                onClick={() => setShowNewInstallment(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition"
              >
                <CreditCard size={12} />
                New Installment
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-3 px-6 py-4">
              <CardSkeleton /><CardSkeleton /><CardSkeleton />
            </div>
          ) : !installments.length ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <CreditCard size={20} className="text-gray-300" />
              </div>
              <p className="text-sm text-gray-400">No purchases yet for this customer.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {installments.map((inst: Installment) => {
                const paid = Number(inst.totalAmount) - Number(inst.remaining);
                const pct  = Math.round((paid / Number(inst.totalAmount)) * 100);
                return (
                  <div key={inst.id} className="bg-white border border-gray-100 rounded-2xl p-4 hover:border-gray-200 transition">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-gray-900 truncate" title={inst.productName}>{inst.productName}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Started {new Date(inst.startDate).toLocaleDateString('en-PK', { month: 'short', year: 'numeric' })}
                          {' · '}{inst.months} months
                        </p>
                      </div>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${STATUS_STYLES[inst.status]}`}>
                        {inst.status.charAt(0) + inst.status.slice(1).toLowerCase()}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                      <div>
                        <p className="text-gray-400">Total</p>
                        <p className="font-semibold text-gray-800">{pkr(inst.totalAmount)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Monthly</p>
                        <p className="font-semibold text-gray-800">{pkr(inst.monthly)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Remaining</p>
                        <p className={`font-semibold ${Number(inst.remaining) > 0 ? 'text-orange-500' : 'text-emerald-600'}`}>
                          {pkr(inst.remaining)}
                        </p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 shrink-0 w-8 text-right">{pct}%</span>
                    </div>

                    {inst.status === 'ACTIVE' && shopData && (
                      <button
                        onClick={() => openWhatsApp(
                          customer.phone,
                          reminderMessage({
                            shopName: shopData.shopName,
                            customerName: customer.name,
                            productName: inst.productName,
                            monthly: inst.monthly,
                            remaining: inst.remaining,
                            paymentFrequency: inst.paymentFrequency,
                          })
                        )}
                        className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-green-200 text-green-600 hover:bg-green-50 text-xs font-medium transition">
                        <MessageCircle size={12} />
                        Send reminder on WhatsApp
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer stats */}
        {installments.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 shrink-0">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <TrendingUp size={13} className="text-blue-500" />
              Lifetime business value: <span className="font-bold text-gray-900 ml-0.5">{pkr(totalBusiness)}</span>
            </div>
          </div>
        )}

        </>)}
      </div>
    </div>

    {showStatement && shopData && (
      <CustomerStatementPrint
        customer={customer}
        installments={installments}
        shopName={shopData.shopName}
        shopPhone={shopData.phone}
        onClose={() => setShowStatement(false)}
      />
    )}
    {showPrint && shopData && (
      <CustomerAgreementPrint
        customer={customer}
        shopName={shopData.shopName}
        shopAddress={shopData.address}
        shopPhone={shopData.phone}
        onClose={() => setShowPrint(false)}
      />
    )}

    {/* New Installment modal — full-screen on mobile, centered on desktop */}
    {showNewInstallment && (
      <div className="fixed inset-0 z-[60] flex flex-col sm:flex-row sm:items-center sm:justify-center bg-black/40 backdrop-blur-sm sm:px-4">
        <div className="bg-white flex flex-col w-full h-full sm:h-auto sm:max-h-[calc(100vh-2rem)] sm:rounded-2xl sm:max-w-lg sm:shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {customer.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-gray-900 leading-tight">New Installment</h2>
                <p className="text-xs text-gray-400 truncate">{customer.name}</p>
              </div>
            </div>
            <button
              onClick={() => setShowNewInstallment(false)}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition shrink-0"
            >
              <X size={16} />
            </button>
          </div>

          {/* Error */}
          {createInstallmentMutation.error instanceof Error && (
            <div className="mx-4 sm:mx-6 mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 shrink-0">
              <p className="text-sm text-red-600">{createInstallmentMutation.error.message}</p>
            </div>
          )}

          {/* Scrollable form body */}
          <div className="overflow-y-auto flex-1 px-4 sm:px-6 py-4">
            <InstallmentForm
              lockedCustomerId={customer.id}
              lockedCustomerName={customer.name}
              isPending={createInstallmentMutation.isPending}
              onCancel={() => setShowNewInstallment(false)}
              onSubmit={(data) => createInstallmentMutation.mutate(data)}
              murabahaMode={shopData?.murabahaMode ?? false}
            />
          </div>
        </div>
      </div>
    )}
    </>
  );
}

// ── Staff CNIC-only view (separate component to keep hooks clean) ──────────────
function StaffCnicView({
  qc,
  createMutation,
  updateMutation,
}: {
  qc: ReturnType<typeof useQueryClient>;
  createMutation: ReturnType<typeof useMutation<Customer, Error, Parameters<typeof customersApi.create>[0]>>;
  updateMutation: ReturnType<typeof useMutation<Customer, Error, { id: string; data: Parameters<typeof customersApi.update>[1] }>>;
}) {
  const [foundId, setFoundId]   = useState<string | null>(null);
  const [modal, setModal]       = useState<Modal>(null);

  const { data: fullCustomer, isLoading: loadingCustomer } = useQuery({
    queryKey: ['customer-detail', foundId],
    queryFn:  () => customersApi.getOne(foundId!),
    enabled:  !!foundId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['customers'] });

  return (
    <div className="px-4 py-5 sm:p-6 max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Customer Dhundain</h1>
        <p className="text-sm text-gray-500 mt-1">CNIC enter kar ke customer ko search karen</p>
      </div>

      <CnicCustomerLookup
        onFound={(c) => setFoundId(c.id)}
        onAddNew={(prefillCnic) => setModal({ mode: 'add', prefillCnic })}
      />

      {/* Loading full customer after CNIC match */}
      {foundId && loadingCustomer && (
        <div className="mt-4 text-center text-sm text-gray-400">Loading customer details…</div>
      )}

      {/* History drawer */}
      {fullCustomer && (
        <CustomerHistoryDrawer
          customer={fullCustomer}
          onClose={() => setFoundId(null)}
        />
      )}

      {/* Add customer modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[calc(100vh-2rem)]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <h2 className="text-base font-semibold text-gray-900">
                {modal.mode === 'add' ? 'Register New Customer' : 'Edit Customer'}
              </h2>
              <button onClick={() => setModal(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
                <X size={16} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-5">
              <CustomerForm
                customer={modal.mode === 'edit' ? modal.customer : undefined}
                onSubmit={(data) => {
                  if (modal.mode === 'add') {
                    createMutation.mutate(data as CreateCustomerInput, {
                      onSuccess: (created) => { invalidate(); setFoundId(created.id); setModal(null); },
                    });
                  } else {
                    updateMutation.mutate({ id: modal.customer.id, data }, {
                      onSuccess: () => { invalidate(); setModal(null); },
                    });
                  }
                }}
                isPending={createMutation.isPending || updateMutation.isPending}
                onCancel={() => setModal(null)}
                prefillCnic={'prefillCnic' in modal ? modal.prefillCnic : undefined}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CustomersPage() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.role === 'SELLER_OWNER';
  const [modal, setModal] = useState<Modal>(null);
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);
  const [assignAvoFor, setAssignAvoFor] = useState<Customer | null>(null);
  const [search,    setSearch]    = useState('');
  const [lifecycle, setLifecycle] = useState('');
  const [verifFilter, setVerifFilter] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => { setPage(1); }, [debouncedSearch, lifecycle, verifFilter]);

  const LIMIT = 20;
  const { data, isLoading, isError } = useQuery({
    queryKey: ['customers', debouncedSearch, lifecycle, verifFilter, page],
    queryFn: () => customersApi.list({
      search: debouncedSearch || undefined,
      lifecycle: lifecycle || undefined,
      verificationStatus: verifFilter || undefined,
      page,
      limit: LIMIT,
    }),
  });

  const { data: lifecycleCounts = {} } = useQuery({
    queryKey: ['customers-lifecycle-counts'],
    queryFn:  customersApi.lifecycleCounts,
    staleTime: 30_000,
  });

  const { data: staffList = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: staffApi.list,
    enabled: isOwner,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['customers'] });

  function safeCloseModal() {
    if (window.confirm('Form band karna chahte hain? Bhari hui details delete ho jaen gi.')) {
      setModal(null);
    }
  }

  const createMutation = useMutation({
    mutationFn: customersApi.create,
    onSuccess: () => { invalidate(); setModal(null); toast.success('Customer added'); },
    onError: (e) => toast.error(getErrorMessage(e, 'Failed to add customer')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof customersApi.update>[1] }) =>
      customersApi.update(id, data),
    onSuccess: () => { invalidate(); setModal(null); toast.success('Customer updated'); },
    onError: (e) => toast.error(getErrorMessage(e, 'Failed to update customer')),
  });

  const deleteMutation = useMutation({
    mutationFn: customersApi.remove,
    onSuccess: () => { invalidate(); toast.success('Customer deleted'); },
    onError: (e) => toast.error(getErrorMessage(e, 'Failed to delete customer')),
  });

  const handleDelete = (id: string) => {
    if (confirm('Delete this customer? This cannot be undone.')) deleteMutation.mutate(id);
  };

  // ── Staff CNIC-only view ──────────────────────────────────────────────────────
  if (!isOwner) {
    return <StaffCnicView qc={qc} createMutation={createMutation} updateMutation={updateMutation} />;
  }

  // ── Owner full view ───────────────────────────────────────────────────────────
  return (
    <div className="px-4 py-5 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500 mt-0.5">{data?.total ?? 0} registered</p>
        </div>
        <button onClick={() => setModal({ mode: 'add' })}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition">
          + Add customer
        </button>
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          type="text"
          placeholder="Search by name or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
        />
        <div className="flex items-center gap-1.5">
          {([
            { value: '',             label: 'All' },
            { value: 'PENDING',      label: 'Pending' },
            { value: 'UNDER_REVIEW', label: 'In Review' },
            { value: 'APPROVED',     label: 'Verified' },
            { value: 'REJECTED',     label: 'Rejected' },
          ]).map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setVerifFilter(value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                verifFilter === value
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <LifecycleFunnel
        counts={lifecycleCounts}
        active={lifecycle}
        onSelect={(s) => { setLifecycle(s); }}
      />

      <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
        {isLoading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : isError ? (
          <div className="p-8 text-center text-sm text-red-500">Failed to load customers.</div>
        ) : !data?.data.length ? (
          <EmptyState
            icon={<Users size={32} />}
            title="No customers yet"
            action={
              <button onClick={() => setModal({ mode: 'add' })}
                className="px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-xl hover:bg-blue-700 transition">
                Add your first customer
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">CNIC</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Credit</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Verification</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.data.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setHistoryCustomer(c)}
                        className="font-medium text-gray-900 hover:text-blue-600 text-left transition"
                      >
                        {c.name}
                      </button>
                      {c.customerType === 'dukaan-dar' && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 border border-orange-200 whitespace-nowrap">Dukaan-Dar</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{c.cnicMasked}</td>
                  <td className="px-4 py-3 text-gray-700">{c.phone}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <LifecycleBadge stage={c.lifecycleStage ?? 'LEAD'} />
                      <RiskBadge score={c.riskScore ?? 0} label={c.riskLabel ?? 'GOOD'} />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <VerifBadge status={c.verificationStatus ?? 'PENDING'} />
                      {isOwner && c.verificationStatus === 'PENDING' && !c.assignedAvoId && (
                        <button onClick={() => setAssignAvoFor(c)}
                          className="text-[10px] text-blue-500 hover:underline">Assign AVO</button>
                      )}
                      {isOwner && c.verificationStatus === 'UNDER_REVIEW' && (
                        <button onClick={() => setAssignAvoFor(c)}
                          className="text-[10px] text-indigo-500 hover:underline">Reassign</button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => setHistoryCustomer(c)}
                      className="text-indigo-500 hover:underline mr-3 text-xs">History</button>
                    <button onClick={() => setModal({ mode: 'edit', customer: c })}
                      className="text-blue-600 hover:underline mr-3 text-xs">Edit</button>
                    {isOwner && (
                      <button onClick={() => handleDelete(c.id)} disabled={deleteMutation.isPending}
                        className="px-2.5 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs transition disabled:opacity-40">Delete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && data.total > LIMIT && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <p className="text-gray-400 text-xs">
            {((page - 1) * LIMIT) + 1}–{Math.min(page * LIMIT, data.total)} of {data.total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition disabled:opacity-40 disabled:cursor-not-allowed text-xs"
            >
              Previous
            </button>
            <span className="text-gray-500 text-xs">Page {page} of {Math.ceil(data.total / LIMIT)}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page * LIMIT >= data.total}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition disabled:opacity-40 disabled:cursor-not-allowed text-xs"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Edit / Add modal */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={(e) => { if (e.target === e.currentTarget) safeCloseModal(); }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[92vh] overflow-y-auto">
            <h2 className="text-base font-semibold text-gray-900 mb-5">
              {modal.mode === 'add' ? 'Add Customer' : 'Edit Customer'}
            </h2>
            <CustomerForm
              customer={modal.mode === 'edit' ? modal.customer : undefined}
              isPending={createMutation.isPending || updateMutation.isPending}
              onCancel={safeCloseModal}
              onSubmit={(formData) => {
                if (modal.mode === 'add') {
                  createMutation.mutate(formData as Parameters<typeof customersApi.create>[0]);
                } else {
                  const { cnic, ...rest } = formData;
                  updateMutation.mutate({
                    id: modal.customer.id,
                    data: cnic ? { ...rest, cnic } : rest,
                  });
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Customer purchase history drawer */}
      {historyCustomer && (
        <CustomerHistoryDrawer
          customer={historyCustomer}
          onClose={() => setHistoryCustomer(null)}
        />
      )}

      {assignAvoFor && (
        <AssignAvoModal
          customer={assignAvoFor}
          avos={staffList}
          onClose={() => setAssignAvoFor(null)}
        />
      )}
    </div>
  );
}
