import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../utils/error.ts';
import { fmtDate, fmtMonthYear } from '../utils/dateFormat.ts';
import { X, CreditCard, TrendingUp, MessageCircle, ShieldCheck, ShieldX, Clock, MapPin, Printer, StickyNote, Trash2, Send, Users, ChevronUp, ChevronDown, ArrowUpDown, AlertOctagon } from 'lucide-react';
import { customersApi, type Customer, type CustomerDoc, type RiskLabel, type LifecycleStage, type VerificationStatus } from '../api/customers.api.ts';
import type { CreateCustomerInput } from '@assaan/shared';
import { installmentsApi, type Installment, type InstallmentStatus } from '../api/installments.api.ts';
import { staffApi, type StaffMember } from '../api/staff.api.ts';
import { verificationsApi } from '../api/verifications.api.ts';
import { customerNotesApi, type CustomerNote } from '../api/customerNotes.api.ts';
import CustomerForm from '../features/customers/CustomerForm.tsx';
import CnicCustomerLookup from '../features/customers/CnicCustomerLookup.tsx';
import InstallmentForm from '../features/installments/InstallmentForm.tsx';
import PaymentModal from '../features/installments/PaymentModal.tsx';
import { useDebounce } from '../hooks/useDebounce.ts';
import { sellersApi } from '../api/sellers.api.ts';
import { openWhatsApp, reminderMessage, balanceStatementMessage } from '../utils/whatsapp.ts';
import { useAuthStore } from '../store/auth.store.ts';
import CustomerAgreementPrint from '../components/CustomerAgreementPrint.tsx';
import CustomerStatementPrint from '../components/CustomerStatementPrint.tsx';
import { openCustomerHistoryReport } from '../utils/receipt.ts';
import { TableSkeleton, CardSkeleton, RowSkeleton, EmptyState } from '../components/ui/Skeleton.tsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.tsx';

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
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);
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
                      onClick={() => setDeleteNoteId(n.id)}
                      className="text-gray-300 hover:text-red-500 transition shrink-0 opacity-0 group-hover:opacity-100">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-amber-600 mt-1.5">
                  {n.authorName ?? 'Unknown'} · {fmtDate(n.createdAt)}
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

      <ConfirmDialog
        open={deleteNoteId !== null}
        title="Note Delete Karo?"
        description="Ye note hamesha ke liye delete ho jaega."
        confirmLabel="Delete Karo"
        variant="danger"
        isPending={deleteMutation.isPending}
        onConfirm={() => { if (deleteNoteId) deleteMutation.mutate(deleteNoteId); setDeleteNoteId(null); }}
        onCancel={() => setDeleteNoteId(null)}
      />

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
  const [confirmOpen, setConfirmOpen] = useState(false);
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
    <>
      <button
        onClick={() => setConfirmOpen(true)}
        disabled={isPending}
        className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-red-200 text-xs text-red-600 hover:bg-red-50 transition disabled:opacity-50">
        {isPending ? 'Resetting…' : 'Re-submit for Verification'}
      </button>
      <ConfirmDialog
        open={confirmOpen}
        title="Verification Reset Karo?"
        description="Customer ka verification status Pending ho jaega. AVO ko dobara assign karna hoga."
        confirmLabel="Reset Karo"
        variant="warning"
        isPending={isPending}
        onConfirm={() => { mutate(); setConfirmOpen(false); }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}

function OwnerDirectVerifyModal({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [notes, setNotes] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { mutate, isPending } = useMutation({
    mutationFn: () => verificationsApi.ownerVerify(customer.id, { status, notes: notes.trim() || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['verif-report', customer.id] });
      qc.invalidateQueries({ queryKey: ['customers-lifecycle-counts'] });
      toast.success(status === 'APPROVED' ? 'Customer verified' : 'Customer rejected');
      onClose();
    },
    onError: (e: any) => toast.error(getErrorMessage(e)),
  });

  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={18} className="text-blue-600" />
            <h3 className="text-sm font-semibold text-gray-900">Direct Verify</h3>
          </div>
          <p className="text-xs text-gray-400 mb-5">Customer: <span className="font-medium text-gray-700">{customer.name}</span></p>

          <p className="text-xs font-medium text-gray-700 mb-2">Verification Decision</p>
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setStatus('APPROVED')}
              className={`flex-1 py-2.5 rounded-xl border-2 text-xs font-semibold transition ${
                status === 'APPROVED'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              <ShieldCheck size={14} className="inline mr-1.5 -mt-0.5" />
              Approve
            </button>
            <button
              onClick={() => setStatus('REJECTED')}
              className={`flex-1 py-2.5 rounded-xl border-2 text-xs font-semibold transition ${
                status === 'REJECTED'
                  ? 'border-red-500 bg-red-50 text-red-700'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              <ShieldX size={14} className="inline mr-1.5 -mt-0.5" />
              Reject
            </button>
          </div>

          <label className="block text-xs font-medium text-gray-700 mb-1.5">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Add a note about this decision…"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent mb-5"
          />

          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm text-gray-600 hover:bg-gray-50 transition">
              Cancel
            </button>
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={isPending}
              className={`flex-1 rounded-xl py-2 text-sm font-medium transition disabled:opacity-50 ${
                status === 'APPROVED'
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              {isPending ? 'Saving…' : status === 'APPROVED' ? 'Approve Customer' : 'Reject Customer'}
            </button>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title={status === 'APPROVED' ? 'Customer Approve Karo?' : 'Customer Reject Karo?'}
        description={
          status === 'APPROVED'
            ? `${customer.name} ko directly verified mark kar diya jaega. AVO assignment ki zaroorat nahi hogi.`
            : `${customer.name} ko rejected mark kar diya jaega. Aap baad mein re-verify bhi kar sakte hain.`
        }
        confirmLabel={status === 'APPROVED' ? 'Approve Karo' : 'Reject Karo'}
        variant={status === 'APPROVED' ? 'info' : 'danger'}
        isPending={isPending}
        onConfirm={() => { mutate(); setConfirmOpen(false); }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}

// ── Standard document definitions (derived from Customer URL fields) ───────────

type UrlKey = keyof Pick<Customer,
  'cnicFrontUrl' | 'cnicBackUrl' | 'photoUrl' | 'blankChequeUrl' |
  'guarantorCnicFrontUrl' | 'guarantorCnicBackUrl' |
  'guarantor2CnicFrontUrl' | 'guarantor2CnicBackUrl'
>;

const STANDARD_DOCS: { key: UrlKey; label: string; alwaysShow?: boolean }[] = [
  { key: 'cnicFrontUrl',           label: 'CNIC Front',             alwaysShow: true },
  { key: 'cnicBackUrl',            label: 'CNIC Back',              alwaysShow: true },
  { key: 'photoUrl',               label: 'Customer Photo',         alwaysShow: true },
  { key: 'blankChequeUrl',         label: 'Blank Cheque',           alwaysShow: true },
  { key: 'guarantorCnicFrontUrl',  label: 'Guarantor 1 CNIC Front' },
  { key: 'guarantorCnicBackUrl',   label: 'Guarantor 1 CNIC Back'  },
  { key: 'guarantor2CnicFrontUrl', label: 'Guarantor 2 CNIC Front' },
  { key: 'guarantor2CnicBackUrl',  label: 'Guarantor 2 CNIC Back'  },
];

const DOC_TYPES = [
  { type: 'SALARY_SLIP',          label: 'Salary Slip' },
  { type: 'UTILITY_BILL',         label: 'Utility Bill' },
  { type: 'EMPLOYMENT_LETTER',    label: 'Employment Letter' },
  { type: 'INCOME_TAX',           label: 'Income Tax Return' },
  { type: 'OTHER',                label: 'Other' },
] as const;

const STATUS_META: Record<string, { label: string; cls: string }> = {
  PENDING:  { label: 'Pending',  cls: 'bg-amber-100 text-amber-700' },
  RECEIVED: { label: 'Received', cls: 'bg-blue-100 text-blue-700'   },
  VERIFIED: { label: 'Verified', cls: 'bg-green-100 text-green-700' },
};

function DocsTab({ customer, canEdit, isOwner }: { customer: Customer; canEdit: boolean; isOwner: boolean }) {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [addType, setAddType] = useState<string>('SALARY_SLIP');
  const [addLabel, setAddLabel] = useState('');
  const [addStatus, setAddStatus] = useState<string>('RECEIVED');
  const [addNotes, setAddNotes] = useState('');

  const { data: physicalDocs = [], isLoading } = useQuery({
    queryKey: ['customer-docs', customer.id],
    queryFn: () => customersApi.listDocs(customer.id),
    staleTime: 60_000,
  });

  const addMutation = useMutation({
    mutationFn: () => customersApi.addDoc(customer.id, {
      docType:  addType,
      label:    addLabel.trim() || (DOC_TYPES.find((d) => d.type === addType)?.label ?? addType),
      status:   addStatus,
      notes:    addNotes.trim() || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer-docs', customer.id] });
      toast.success('Document added');
      setShowAdd(false);
      setAddLabel('');
      setAddNotes('');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Failed to add')),
  });

  const patchMutation = useMutation({
    mutationFn: ({ docId, status }: { docId: string; status: string }) =>
      customersApi.updateDoc(customer.id, docId, { status: status as CustomerDoc['status'] }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer-docs', customer.id] }),
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const removeMutation = useMutation({
    mutationFn: (docId: string) => customersApi.removeDoc(customer.id, docId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customer-docs', customer.id] }); toast.success('Removed'); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  // Standard docs: check if URL exists on customer object
  const stdDocs = STANDARD_DOCS.filter((d) => {
    if (d.alwaysShow) return true;
    // Only show guarantor docs if that guarantor's name is set
    if (d.key.startsWith('guarantor2')) return !!customer.guarantor2Name;
    if (d.key.startsWith('guarantor'))  return !!customer.guarantorName;
    return true;
  });
  const stdPresent  = stdDocs.filter((d) => !!customer[d.key]).length;
  const physPresent = physicalDocs.filter((d) => d.status !== 'PENDING').length;
  const totalDone   = stdPresent + physPresent;
  const totalAll    = stdDocs.length + physicalDocs.length;
  const pct         = totalAll > 0 ? Math.round((totalDone / totalAll) * 100) : 100;

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
      {/* Progress summary */}
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-600">Document Completeness</p>
          <span className={`text-xs font-bold ${pct === 100 ? 'text-green-600' : pct >= 70 ? 'text-amber-600' : 'text-red-600'}`}>{totalDone}/{totalAll} · {pct}%</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-green-500' : pct >= 70 ? 'bg-amber-500' : 'bg-red-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Standard docs */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Standard Documents</p>
        <div className="space-y-1.5">
          {stdDocs.map((d) => {
            const url = customer[d.key];
            return (
              <div key={d.key} className="flex items-center gap-3 px-3 py-2.5 bg-white border border-gray-100 rounded-xl">
                <span className={`w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold shrink-0 ${url ? 'bg-green-100 text-green-600' : 'bg-red-50 text-red-400'}`}>
                  {url ? '✓' : '✗'}
                </span>
                <span className="flex-1 text-sm text-gray-700">{d.label}</span>
                {url ? (
                  <a href={url} target="_blank" rel="noreferrer"
                    className="text-xs text-blue-500 hover:underline shrink-0">View</a>
                ) : (
                  <span className="text-xs text-gray-300 shrink-0">Missing</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Physical docs */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Physical Documents</p>
          {canEdit && (
            <button
              onClick={() => setShowAdd((v) => !v)}
              className="text-xs text-blue-600 hover:underline font-semibold"
            >
              {showAdd ? 'Cancel' : '+ Add'}
            </button>
          )}
        </div>

        {showAdd && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Type</label>
                <select value={addType} onChange={(e) => setAddType(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400">
                  {DOC_TYPES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Status</label>
                <select value={addStatus} onChange={(e) => setAddStatus(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400">
                  <option value="RECEIVED">Received</option>
                  <option value="PENDING">Pending</option>
                  <option value="VERIFIED">Verified</option>
                </select>
              </div>
            </div>
            {addType === 'OTHER' && (
              <input type="text" value={addLabel} onChange={(e) => setAddLabel(e.target.value)}
                placeholder="Custom document name"
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400" />
            )}
            <input type="text" value={addNotes} onChange={(e) => setAddNotes(e.target.value)}
              placeholder="Notes (optional)"
              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <button
              onClick={() => addMutation.mutate()}
              disabled={addMutation.isPending || (addType === 'OTHER' && !addLabel.trim())}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition disabled:opacity-40"
            >
              {addMutation.isPending ? 'Adding…' : 'Add Document'}
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">{[1,2].map((i) => <div key={i} className="h-10 bg-gray-50 rounded-xl animate-pulse" />)}</div>
        ) : physicalDocs.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">Koi physical document track nahi hai</p>
        ) : (
          <div className="space-y-1.5">
            {physicalDocs.map((doc) => {
              const sm = STATUS_META[doc.status] ?? STATUS_META['RECEIVED']!;
              return (
                <div key={doc.id} className="flex items-start gap-3 px-3 py-2.5 bg-white border border-gray-100 rounded-xl">
                  <span className={`mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${sm.cls}`}>{sm.label}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{doc.label}</p>
                    {doc.notes && <p className="text-[10px] text-gray-400 truncate">{doc.notes}</p>}
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1 shrink-0">
                      {doc.status !== 'VERIFIED' && (
                        <button
                          onClick={() => patchMutation.mutate({ docId: doc.id, status: doc.status === 'PENDING' ? 'RECEIVED' : 'VERIFIED' })}
                          title={doc.status === 'PENDING' ? 'Mark Received' : 'Mark Verified'}
                          className="p-1 text-gray-300 hover:text-green-500 hover:bg-green-50 rounded-lg transition"
                        >
                          <ShieldCheck size={12} />
                        </button>
                      )}
                      {isOwner && (
                        <button
                          onClick={() => removeMutation.mutate(doc.id)}
                          disabled={removeMutation.isPending}
                          className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function CustomerHistoryDrawer({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const [showPrint, setShowPrint] = useState(false);
  const [showStatement, setShowStatement] = useState(false);
  const [showNewInstallment, setShowNewInstallment] = useState(false);
  const [showDirectVerifyDrawer, setShowDirectVerifyDrawer] = useState(false);
  const [payInst, setPayInst] = useState<Installment | null>(null);
  const [activeTab, setActiveTab] = useState<'history' | 'notes' | 'docs'>('history');
  const [visible, setVisible] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [localTags, setLocalTags] = useState<string[]>(customer.tags ?? []);
  const drawerUser = useAuthStore((s) => s.user);
  const isOwnerInDrawer = drawerUser?.role === 'SELLER_OWNER';
  const drawerPerms = drawerUser?.permissions as Record<string, boolean> | null | undefined;
  const canAddInstallmentInDrawer  = isOwnerInDrawer || !!drawerPerms?.canAddInstallment;
  const canRecordPaymentInDrawer   = isOwnerInDrawer || !!drawerPerms?.canRecordPayment;
  const [showBlacklistModal, setShowBlacklistModal] = useState(false);
  const [blacklistReason, setBlacklistReason] = useState('');
  const [isBlacklisted, setIsBlacklisted] = useState(customer.isBlacklisted ?? false);

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

  const blacklistMutation = useMutation({
    mutationFn: () => customersApi.blacklist(customer.id, blacklistReason),
    onSuccess: () => {
      setIsBlacklisted(true);
      setShowBlacklistModal(false);
      setBlacklistReason('');
      qcDrawer.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer blacklisted');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const removeBlacklistMutation = useMutation({
    mutationFn: () => customersApi.removeBlacklist(customer.id),
    onSuccess: () => {
      setIsBlacklisted(false);
      qcDrawer.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Blacklist removed');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

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

  const tagMutation = useMutation({
    mutationFn: (tags: string[]) => customersApi.update(customer.id, { tags }),
    onSuccess: () => qcDrawer.invalidateQueries({ queryKey: ['customers'] }),
    onError: () => toast.error('Failed to update tags'),
  });

  function addTag(raw: string) {
    const tag = raw.trim().toLowerCase().replace(/[^a-z0-9؀-ۿ\-_]/g, '').slice(0, 30);
    if (!tag || localTags.includes(tag) || localTags.length >= 10) return;
    const next = [...localTags, tag];
    setLocalTags(next);
    tagMutation.mutate(next);
  }

  function removeTag(tag: string) {
    const next = localTags.filter((t) => t !== tag);
    setLocalTags(next);
    tagMutation.mutate(next);
  }

  const installments = data?.data ?? [];
  const totalBusiness  = installments.reduce((s, i) => s + Number(i.totalAmount), 0);
  const totalPaid      = installments.reduce((s, i) => s + (Number(i.totalAmount) - Number(i.remaining)), 0);
  const totalRemaining = installments.reduce((s, i) => s + Number(i.remaining), 0);
  const activeCount    = installments.filter((i) => i.status === 'ACTIVE').length;
  const completedCount = installments.filter((i) => i.status === 'COMPLETED').length;
  const defaultedCount = installments.filter((i) => i.status === 'DEFAULTED').length;

  type LoyaltyGrade = { label: string; cls: string };
  function loyaltyGrade(): LoyaltyGrade | null {
    if (defaultedCount >= 2) return { label: 'High Risk', cls: 'text-red-600 bg-red-50 border-red-200' };
    if (defaultedCount === 1) return { label: 'Caution', cls: 'text-orange-600 bg-orange-50 border-orange-200' };
    if (completedCount >= 3)  return { label: 'Gold Customer', cls: 'text-amber-600 bg-amber-50 border-amber-200' };
    if (completedCount >= 1)  return { label: 'Loyal Customer', cls: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
    return null;
  }
  const grade = loyaltyGrade();

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
                {customer.fileNumber && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 border border-indigo-200 font-mono">#{customer.fileNumber}</span>
                )}
                {customer.customerType === 'dukaan-dar' && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 border border-orange-200">Dukaan-Dar</span>
                )}
                {isBlacklisted && (
                  <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">
                    <AlertOctagon size={9} /> DO NOT SELL
                  </span>
                )}
                <LifecycleBadge stage={customer.lifecycleStage ?? 'LEAD'} />
                <RiskBadge score={customer.riskScore ?? 0} label={customer.riskLabel ?? 'GOOD'} />
              </div>
              <p className="text-xs text-gray-400">{customer.phone} · {customer.cnicMasked}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <button
              onClick={() => setShowStatement(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition"
            >
              <Printer size={13} />
              Statement
            </button>
            <button
              onClick={() => openCustomerHistoryReport({
                shopName: shopData?.shopName ?? 'Our Shop',
                shopPhone: shopData?.phone,
                customer: {
                  name: customer.name,
                  phone: customer.phone,
                  cnicMasked: customer.cnicMasked,
                  address: customer.address,
                  area: customer.area,
                  occupation: customer.occupation,
                  employer: customer.employer,
                  guarantorName: customer.guarantorName,
                  guarantorPhone: customer.guarantorPhone,
                  guarantorRelation: customer.guarantorRelation,
                  guarantor2Name: customer.guarantor2Name,
                  guarantor2Phone: customer.guarantor2Phone,
                  createdAt: customer.createdAt,
                },
                installments: installments.map((i) => ({
                  invoiceNumber: i.invoiceNumber,
                  productName: i.productName,
                  imeiNumber: i.imeiNumber,
                  totalAmount: i.totalAmount,
                  downPayment: i.downPayment,
                  remaining: i.remaining,
                  monthly: i.monthly,
                  months: i.months,
                  startDate: i.startDate,
                  status: i.status,
                  paymentFrequency: i.paymentFrequency,
                })),
                printedAt: new Date().toISOString(),
              })}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 text-xs text-indigo-600 hover:bg-indigo-50 transition disabled:opacity-40"
              title="Print Full History Report"
            >
              <Printer size={13} />
              History
            </button>
            <button
              onClick={() => setShowPrint(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition"
              title="Print Agreement"
            >
              <Printer size={13} />
              Agreement
            </button>
            {shopData && (activeCount > 0 || defaultedCount > 0) && (
              <button
                onClick={() => openWhatsApp(
                  customer.phone,
                  balanceStatementMessage({
                    shopName: shopData.shopName,
                    customerName: customer.name,
                    installments: installments
                      .filter((i) => i.status === 'ACTIVE' || i.status === 'DEFAULTED')
                      .map((i) => ({
                        productName:      i.productName,
                        remaining:        i.remaining,
                        monthly:          i.monthly,
                        status:           i.status,
                        paymentFrequency: i.paymentFrequency,
                      })),
                  })
                )}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-green-200 text-xs text-green-700 hover:bg-green-50 transition"
                title="Send balance statement on WhatsApp"
              >
                <MessageCircle size={13} />
                Balance
              </button>
            )}
            {isOwnerInDrawer && (
              isBlacklisted ? (
                <button
                  onClick={() => removeBlacklistMutation.mutate()}
                  disabled={removeBlacklistMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-green-300 text-xs text-green-700 hover:bg-green-50 transition disabled:opacity-50"
                >
                  <AlertOctagon size={13} />
                  Remove Blacklist
                </button>
              ) : (
                <button
                  onClick={() => setShowBlacklistModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-xs text-red-600 hover:bg-red-50 transition"
                >
                  <AlertOctagon size={13} />
                  Blacklist
                </button>
              )
            )}
            <button onClick={handleClose} className="p-1.5 text-gray-400 hover:text-gray-700 transition rounded-lg hover:bg-gray-100">
              <X size={18} />
            </button>
          </div>

          {/* Blacklist reason modal */}
          {showBlacklistModal && (
            <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
                <h3 className="font-semibold text-gray-800 mb-1">Blacklist Customer</h3>
                <p className="text-xs text-gray-500 mb-4">This customer will be blocked from new installments. Reason is required.</p>
                <textarea
                  value={blacklistReason}
                  onChange={(e) => setBlacklistReason(e.target.value)}
                  placeholder="Reason for blacklisting (e.g. Defaulted PKR 50,000 — absconding)"
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300 mb-4"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowBlacklistModal(false); setBlacklistReason(''); }}
                    className="flex-1 border border-gray-200 rounded-xl py-2 text-sm text-gray-600 hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => blacklistMutation.mutate()}
                    disabled={!blacklistReason.trim() || blacklistMutation.isPending}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl py-2 text-sm font-medium transition disabled:opacity-50"
                  >
                    {blacklistMutation.isPending ? 'Saving…' : 'Blacklist Customer'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-6 shrink-0">
          {([
            { key: 'history', label: 'History' },
            { key: 'notes',   label: 'Notes' },
            { key: 'docs',    label: 'Documents' },
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
        ) : activeTab === 'docs' ? (
          <DocsTab
            customer={customer}
            canEdit={isOwnerInDrawer || !!drawerPerms?.canEditCustomer}
            isOwner={isOwnerInDrawer}
          />
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

        {/* Tags */}
        <div className="px-6 py-3 border-b border-gray-50 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            {localTags.map((t) => (
              <span key={t} className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                #{t}
                <button onClick={() => removeTag(t)} className="text-blue-400 hover:text-red-500 transition ml-0.5"><X size={10} /></button>
              </span>
            ))}
            <form onSubmit={(e) => { e.preventDefault(); addTag(tagInput); setTagInput(''); }} className="flex items-center gap-1">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="+ add tag"
                maxLength={30}
                className="text-xs border-0 outline-none bg-transparent text-gray-500 placeholder:text-gray-300 w-20 focus:w-32 transition-all"
              />
            </form>
          </div>
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

        {/* Owner direct-verify panel */}
        {isOwnerInDrawer && customer.verificationStatus !== 'APPROVED' && (
          <div className="px-6 py-3 border-b border-gray-50 shrink-0">
            <button
              onClick={() => setShowDirectVerifyDrawer(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-emerald-300 text-emerald-700 text-xs font-medium hover:bg-emerald-50 transition"
            >
              <ShieldCheck size={14} />
              Direct Verify (Owner)
            </button>
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
                          Started {fmtMonthYear(inst.startDate)}
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

                    {inst.status === 'ACTIVE' && (
                      <div className="mt-3 flex gap-2">
                        {canRecordPaymentInDrawer && (
                          <button
                            onClick={() => setPayInst(inst)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition">
                            <CreditCard size={12} />
                            Record Payment
                          </button>
                        )}
                        {shopData && (
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
                            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-green-200 text-green-600 hover:bg-green-50 text-xs font-medium transition">
                            <MessageCircle size={12} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer stats */}
        {installments.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 shrink-0 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <TrendingUp size={13} className="text-blue-500" />
                Lifetime value: <span className="font-bold text-gray-900 ml-0.5">{pkr(totalBusiness)}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                {completedCount > 0 && (
                  <span className="text-emerald-600 font-medium">{completedCount} completed</span>
                )}
                {defaultedCount > 0 && (
                  <span className="text-red-500 font-medium">{defaultedCount} defaulted</span>
                )}
              </div>
            </div>
            {grade && (
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${grade.cls}`}>
                {grade.label}
              </div>
            )}
            {completedCount >= 1 && defaultedCount === 0 && (
              <p className="text-xs text-blue-600 font-medium">
                Naya deal offer karo — repeat customer hai
              </p>
            )}
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

    {/* Payment modal */}
    {payInst && (
      <PaymentModal
        inst={payInst}
        onClose={() => setPayInst(null)}
        extraInvalidate={[['customer-installments', customer.id]]}
      />
    )}

    {/* New Installment modal */}
    {showNewInstallment && (
      <div className="fixed inset-0 z-60 flex flex-col sm:items-center sm:justify-center bg-black/50 backdrop-blur-sm sm:p-4">
        <div className="flex-1 sm:flex-none flex flex-col w-full sm:max-w-lg sm:max-h-[calc(100vh-2rem)] bg-white sm:rounded-2xl sm:shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {customer.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-gray-900 leading-tight">New Installment</h2>
                <p className="text-xs text-gray-400 truncate">{customer.name}</p>
              </div>
            </div>
            <button onClick={() => setShowNewInstallment(false)}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition shrink-0">
              <X size={16} />
            </button>
          </div>
          {createInstallmentMutation.error instanceof Error && (
            <div className="mx-4 mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 shrink-0">
              <p className="text-sm text-red-600">{createInstallmentMutation.error.message}</p>
            </div>
          )}
          <div className="flex-1 overflow-y-auto px-4 py-4">
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

    {showDirectVerifyDrawer && (
      <OwnerDirectVerifyModal
        customer={customer}
        onClose={() => setShowDirectVerifyDrawer(false)}
      />
    )}
    </>
  );
}

// ── Staff CNIC-only view ──────────────────────────────────────────────────────
function StaffCnicView({
  qc,
  createMutation,
  updateMutation,
}: {
  qc: ReturnType<typeof useQueryClient>;
  createMutation: ReturnType<typeof useMutation<Customer, Error, Parameters<typeof customersApi.create>[0]>>;
  updateMutation: ReturnType<typeof useMutation<Customer, Error, { id: string; data: Parameters<typeof customersApi.update>[1] }>>;
}) {
  void updateMutation; // reserved for future edit-customer support
  const user    = useAuthStore((s) => s.user);
  const perms   = user?.permissions as Record<string, boolean> | null | undefined;
  const canPay  = user?.role === 'SELLER_OWNER' || !!perms?.canRecordPayment;
  const canAdd  = user?.role === 'SELLER_OWNER' || !!perms?.canAddInstallment;

  const [found,        setFound]        = useState<import('../api/customers.api.ts').CustomerLookupResult | null>(null);
  const [payInstFull,  setPayInstFull]  = useState<Installment | null>(null);
  const [loadingPayId, setLoadingPayId] = useState<string | null>(null);
  const [showNewInst,  setShowNewInst]  = useState(false);
  const [showDrawer,   setShowDrawer]   = useState(false);
  const [modal,        setModal]        = useState<Modal>(null);

  const { data: shopData }    = useQuery({ queryKey: ['shop-me'], queryFn: sellersApi.getMe });
  const { data: fullCustomer } = useQuery({
    queryKey: ['customer-detail', found?.id],
    queryFn:  () => customersApi.getOne(found!.id),
    enabled:  !!found && showDrawer,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['customers'] });

  async function handlePay(instId: string) {
    setLoadingPayId(instId);
    try {
      const full = await installmentsApi.getOne(instId);
      setPayInstFull(full);
    } catch {
      toast.error('Failed to load installment');
    } finally {
      setLoadingPayId(null);
    }
  }

  const activeInst  = found?.installments.filter((i) => i.status === 'ACTIVE')  ?? [];
  const pendingInst = found?.installments.filter((i) => i.status === 'PENDING') ?? [];

  return (
    <div className="px-4 py-5 sm:p-6 max-w-lg mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Customer Search</h1>
        <p className="text-sm text-gray-500 mt-1">CNIC enter karo aur customer dhundo</p>
      </div>

      <CnicCustomerLookup
        onFound={(c) => { setFound(c); setShowDrawer(false); }}
        onAddNew={canAdd ? (prefillCnic) => setModal({ mode: 'add', prefillCnic }) : undefined}
      />

      {/* ── Customer found: compact card + installments ─────────────────── */}
      {found && (
        <div className="mt-5 space-y-3">

          {/* Customer header */}
          <div className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            {found.photoUrl ? (
              <img src={found.photoUrl} alt="" loading="lazy"
                className="w-10 h-10 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold shrink-0">
                {found.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-900 truncate">{found.name}</p>
              <p className="text-xs text-gray-400">{found.phone} · {found.cnicMasked}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {canAdd && (
                <button
                  onClick={() => setShowNewInst(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition">
                  <CreditCard size={11} />
                  New Installment
                </button>
              )}
              <button
                onClick={() => setShowDrawer(true)}
                className="px-3 py-1.5 border border-gray-200 text-gray-500 hover:bg-gray-50 text-xs rounded-lg transition">
                Full History
              </button>
            </div>
          </div>

          {/* Active installments */}
          {activeInst.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">
                Active Installments — {activeInst.length}
              </p>
              {activeInst.map((inst) => {
                const paid = Number(inst.totalAmount) - Number(inst.remaining);
                const pct  = Math.round((paid / Number(inst.totalAmount)) * 100);
                return (
                  <div key={inst.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{inst.productName}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {inst.months} months · Started {fmtMonthYear(inst.startDate)}
                        </p>
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 shrink-0">Active</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                      <div>
                        <p className="text-gray-400">Monthly</p>
                        <p className="font-semibold text-gray-800">PKR {Number(inst.monthly).toLocaleString('en-PK', { maximumFractionDigits: 0 })}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Remaining</p>
                        <p className="font-semibold text-orange-500">PKR {Number(inst.remaining).toLocaleString('en-PK', { maximumFractionDigits: 0 })}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Paid</p>
                        <p className="font-semibold text-emerald-600">{pct}%</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>

                    {canPay && (
                      <button
                        onClick={() => handlePay(inst.id)}
                        disabled={loadingPayId === inst.id}
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition">
                        {loadingPayId === inst.id
                          ? <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Loading…</>
                          : <><CreditCard size={14} />Record Payment</>
                        }
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pending installments */}
          {pendingInst.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">Pending Approval</p>
              {pendingInst.map((inst) => (
                <div key={inst.id} className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900">{inst.productName}</p>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Pending</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    PKR {Number(inst.monthly).toLocaleString('en-PK', { maximumFractionDigits: 0 })}/month · {inst.months} months
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* No active installments */}
          {activeInst.length === 0 && pendingInst.length === 0 && (
            <div className="text-center py-8 text-sm text-gray-400 bg-white border border-gray-100 rounded-2xl">
              No active installments for this customer.
            </div>
          )}
        </div>
      )}

      {/* Full history drawer */}
      {showDrawer && fullCustomer && (
        <CustomerHistoryDrawer customer={fullCustomer} onClose={() => setShowDrawer(false)} />
      )}

      {/* Payment modal */}
      {payInstFull && (
        <PaymentModal
          inst={payInstFull}
          onClose={() => { setPayInstFull(null); qc.invalidateQueries({ queryKey: ['cnic-lookup-staff'] }); }}
        />
      )}

      {/* New installment modal */}
      {showNewInst && found && (
        <div className="fixed inset-0 z-60 flex flex-col sm:items-center sm:justify-center bg-black/50 backdrop-blur-sm sm:p-4">
          <div className="flex-1 sm:flex-none flex flex-col w-full sm:max-w-lg sm:max-h-[calc(100vh-2rem)] bg-white sm:rounded-2xl sm:shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">New Installment</h2>
                <p className="text-xs text-gray-400">{found.name}</p>
              </div>
              <button onClick={() => setShowNewInst(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <InstallmentForm
                lockedCustomerId={found.id}
                lockedCustomerName={found.name}
                isPending={false}
                onCancel={() => setShowNewInst(false)}
                onSubmit={(data) => {
                  installmentsApi.create(data).then(() => {
                    toast.success('Installment created');
                    setShowNewInst(false);
                    qc.invalidateQueries({ queryKey: ['cnic-lookup-staff'] });
                  }).catch((e) => toast.error(getErrorMessage(e, 'Failed to create installment')));
                }}
                murabahaMode={shopData?.murabahaMode ?? false}
              />
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit customer modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[calc(100vh-2rem)]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <h2 className="text-base font-semibold text-gray-900">Register New Customer</h2>
              <button onClick={() => setModal(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
                <X size={16} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-5">
              <CustomerForm
                onSubmit={(data) => {
                  createMutation.mutate(data as CreateCustomerInput, {
                    onSuccess: () => { invalidate(); setModal(null); toast.success('Customer registered'); },
                  });
                }}
                isPending={createMutation.isPending}
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
  const userPerms = user?.permissions as Record<string, boolean> | null | undefined;
  const canAssignAvo = isOwner || !!userPerms?.canVerifyCustomers;
  const location = useLocation();
  const [modal, setModal] = useState<Modal>(null);
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);
  const [assignAvoFor, setAssignAvoFor] = useState<Customer | null>(null);
  const [directVerifyFor, setDirectVerifyFor] = useState<Customer | null>(null);
  const [search,    setSearch]    = useState('');
  const [lifecycle, setLifecycle] = useState('');
  const [verifFilter, setVerifFilter] = useState('');
  const [tagFilter,   setTagFilter]   = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [closeFormConfirm, setCloseFormConfirm] = useState(false);
  const debouncedSearch = useDebounce(search, 350);
  const [committedSearch, setCommittedSearch] = useState('');

  useEffect(() => {
    if (debouncedSearch.replace(/-/g, '').length < 10) {
      setCommittedSearch(debouncedSearch);
    }
  }, [debouncedSearch]);

  function submitSearch() {
    setCommittedSearch(search.trim());
    setPage(1);
  }

  // Global search: open customer drawer directly when navigated here with openCustomerId state
  const openCustomerId = (location.state as { openCustomerId?: string } | null)?.openCustomerId;
  useEffect(() => {
    if (!openCustomerId) return;
    customersApi.getOne(openCustomerId)
      .then((c) => setHistoryCustomer(c))
      .catch(() => {});
    // Clear the state so pressing Back doesn't re-open the drawer
    window.history.replaceState({}, '');
  }, [openCustomerId]);

  useEffect(() => { setPage(1); }, [committedSearch, lifecycle, verifFilter, tagFilter, sortBy, sortDir, limit]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['customers', committedSearch, lifecycle, verifFilter, tagFilter, page, limit, sortBy, sortDir],
    queryFn: () => customersApi.list({
      search: committedSearch || undefined,
      lifecycle: lifecycle || undefined,
      verificationStatus: verifFilter || undefined,
      tag: tagFilter || undefined,
      page,
      limit,
      sortBy,
      sortDir,
    }),
    placeholderData: keepPreviousData,
  });

  const { data: lifecycleCounts = {} } = useQuery({
    queryKey: ['customers-lifecycle-counts'],
    queryFn:  customersApi.lifecycleCounts,
    staleTime: 30 * 60_000,
  });

  const { data: staffList = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: staffApi.list,
    enabled: canAssignAvo,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['customers'] });

  function safeCloseModal() {
    setCloseFormConfirm(true);
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
    setDeleteConfirm({ open: true, id });
  };

  // ── Staff CNIC-only view (staff without canAddCustomer/canEditCustomer) ────────
  const perms = user?.permissions as Record<string, boolean> | null | undefined;
  const canManageCustomers = isOwner || !!perms?.canAddCustomer || !!perms?.canEditCustomer;
  if (!canManageCustomers) {
    return <StaffCnicView qc={qc} createMutation={createMutation} updateMutation={updateMutation} />;
  }

  const SortIcon = ({ col }: { col: string }) => {
    if (sortBy !== col) return <ArrowUpDown size={13} className="text-gray-300 ml-1" />;
    return sortDir === 'asc'
      ? <ChevronUp size={13} className="text-blue-500 ml-1" />
      : <ChevronDown size={13} className="text-blue-500 ml-1" />;
  };
  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(col); setSortDir('desc'); }
  };

  // ── Full view (owner + permitted staff) ───────────────────────────────────────
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
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Name, phone, or CNIC…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitSearch(); }}
              className={`w-52 sm:w-64 pl-3 ${search ? 'pr-7' : 'pr-3'} py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition`}
            />
            {search && (
              <button
                onClick={() => { setSearch(''); setCommittedSearch(''); setPage(1); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                title="Clear"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={submitSearch}
            className="shrink-0 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
          >
            Search
          </button>
        </div>
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

      {/* Tag filter — only show when customers have tags */}
      {data?.data.some((c) => c.tags?.length > 0) || tagFilter ? (
        <div className="flex items-center gap-2 flex-wrap">
          {tagFilter && (
            <button
              onClick={() => setTagFilter('')}
              className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-blue-600 text-white"
            >
              #{tagFilter} <X size={11} className="ml-0.5" />
            </button>
          )}
          {!tagFilter && (
            <span className="text-xs text-gray-400">Filter by tag:</span>
          )}
          {Array.from(new Set(data?.data.flatMap((c) => c.tags ?? []) ?? [])).sort().map((t) => (
            <button
              key={t}
              onClick={() => setTagFilter(t === tagFilter ? '' : t)}
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition ${
                tagFilter === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              #{t}
            </button>
          ))}
        </div>
      ) : null}

      <div className="bg-white rounded-2xl border border-gray-100">
        {isLoading ? (
          <>
            <div className="md:hidden p-4 space-y-3">
              <CardSkeleton /><CardSkeleton /><CardSkeleton />
            </div>
            <div className="hidden md:block">
              <TableSkeleton rows={5} cols={6} />
            </div>
          </>
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
          <>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {data.data.map((c) => (
                <div key={c.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold shrink-0 mt-0.5">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          onClick={() => setHistoryCustomer(c)}
                          className="font-semibold text-gray-900 hover:text-blue-600 transition text-sm text-left"
                        >
                          {c.name}
                        </button>
                        {c.fileNumber && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 border border-indigo-200 font-mono">#{c.fileNumber}</span>
                        )}
                        {c.customerType === 'dukaan-dar' && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 border border-orange-200">DD</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <LifecycleBadge stage={c.lifecycleStage ?? 'LEAD'} />
                        <RiskBadge score={c.riskScore ?? 0} label={c.riskLabel ?? 'GOOD'} />
                        <VerifBadge status={c.verificationStatus ?? 'PENDING'} />
                      </div>
                      <p className="text-xs text-gray-500 mt-1.5">
                        {c.phone}
                        {c.area ? <span className="text-gray-300 mx-1">·</span> : null}
                        {c.area && <span>{c.area}</span>}
                      </p>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">{c.cnicMasked}</p>
                      {c.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {c.tags.map((t) => (
                            <span key={t} className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-medium">#{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {canAssignAvo && c.verificationStatus !== 'APPROVED' && (
                    <div className="flex items-center gap-3 mt-2">
                      {c.verificationStatus === 'PENDING' && !c.assignedAvoId && (
                        <button onClick={() => setAssignAvoFor(c)}
                          className="text-[10px] text-blue-500 hover:underline">Assign AVO</button>
                      )}
                      {c.verificationStatus === 'UNDER_REVIEW' && (
                        <button onClick={() => setAssignAvoFor(c)}
                          className="text-[10px] text-indigo-500 hover:underline">Reassign AVO</button>
                      )}
                      {isOwner && (
                        <button onClick={() => setDirectVerifyFor(c)}
                          className="text-[10px] text-emerald-600 hover:underline font-semibold">Direct Verify</button>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => setHistoryCustomer(c)}
                      className="flex-1 py-2 rounded-xl border border-indigo-200 text-indigo-600 text-xs font-medium hover:bg-indigo-50 transition">
                      History
                    </button>
                    <button
                      onClick={() => setModal({ mode: 'edit', customer: c })}
                      className="flex-1 py-2 rounded-xl border border-blue-200 text-blue-600 text-xs font-medium hover:bg-blue-50 transition">
                      Edit
                    </button>
                    {isOwner && (
                      <button
                        onClick={() => handleDelete(c.id)}
                        disabled={deleteMutation.isPending}
                        className="flex-1 py-2 rounded-xl border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 transition disabled:opacity-40">
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">
                      <button onClick={() => toggleSort('name')} className="flex items-center hover:text-gray-800 transition">
                        Name<SortIcon col="name" />
                      </button>
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">CNIC</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Phone</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Credit</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Verification</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">
                      <button onClick={() => toggleSort('createdAt')} className="flex items-center hover:text-gray-800 transition">
                        Added<SortIcon col="createdAt" />
                      </button>
                    </th>
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
                          {c.fileNumber && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 border border-indigo-200 whitespace-nowrap font-mono">#{c.fileNumber}</span>
                          )}
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
                          {c.tags?.slice(0, 2).map((t) => (
                            <span key={t} className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-medium cursor-pointer" onClick={() => setTagFilter(t)}>#{t}</span>
                          ))}
                          {(c.tags?.length ?? 0) > 2 && (
                            <span className="text-[10px] text-gray-400">+{c.tags.length - 2}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <VerifBadge status={c.verificationStatus ?? 'PENDING'} />
                          {canAssignAvo && c.verificationStatus !== 'APPROVED' && (<>
                            {c.verificationStatus === 'PENDING' && !c.assignedAvoId && (
                              <button onClick={() => setAssignAvoFor(c)}
                                className="text-[10px] text-blue-500 hover:underline">Assign AVO</button>
                            )}
                            {c.verificationStatus === 'UNDER_REVIEW' && (
                              <button onClick={() => setAssignAvoFor(c)}
                                className="text-[10px] text-indigo-500 hover:underline">Reassign</button>
                            )}
                            {isOwner && (
                              <button onClick={() => setDirectVerifyFor(c)}
                                className="text-[10px] text-emerald-600 hover:underline font-semibold">Direct Verify</button>
                            )}
                          </>)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {fmtDate(c.createdAt)}
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
          </>
        )}
      </div>

      {/* Pagination */}
      {data && data.total > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 px-1">
          {/* Left: count info + per-page selector */}
          <div className="flex items-center gap-3">
            <p className="text-xs text-gray-400">
              {data.total === 0 ? '0' : `${(page - 1) * limit + 1}–${Math.min(page * limit, data.total)}`} of <span className="font-semibold text-gray-600">{data.total}</span> customers
            </p>
            <select
              value={limit}
              onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 bg-white outline-none focus:border-blue-400 transition cursor-pointer"
            >
              {[15, 25, 50].map((n) => (
                <option key={n} value={n}>{n} per page</option>
              ))}
            </select>
          </div>

          {/* Right: page navigation */}
          {data.total > limit && (() => {
            const totalPages = Math.ceil(data.total / limit);
            const pages: (number | '...')[] = [];
            if (totalPages <= 7) {
              for (let i = 1; i <= totalPages; i++) pages.push(i);
            } else {
              pages.push(1);
              if (page > 3) pages.push('...');
              for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
              if (page < totalPages - 2) pages.push('...');
              pages.push(totalPages);
            }
            return (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition disabled:opacity-30 disabled:cursor-not-allowed"
                >«</button>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition disabled:opacity-30 disabled:cursor-not-allowed"
                >Prev</button>
                {pages.map((p, i) =>
                  p === '...'
                    ? <span key={`e${i}`} className="px-2 text-xs text-gray-400">…</span>
                    : <button
                        key={p}
                        onClick={() => setPage(p as number)}
                        className={`min-w-[32px] px-2 py-1.5 text-xs rounded-lg border transition font-medium ${
                          page === p
                            ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >{p}</button>
                )}
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * limit >= data.total}
                  className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition disabled:opacity-30 disabled:cursor-not-allowed"
                >Next</button>
                <button
                  onClick={() => setPage(Math.ceil(data.total / limit))}
                  disabled={page * limit >= data.total}
                  className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition disabled:opacity-30 disabled:cursor-not-allowed"
                >»</button>
              </div>
            );
          })()}
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

      {directVerifyFor && (
        <OwnerDirectVerifyModal
          customer={directVerifyFor}
          onClose={() => setDirectVerifyFor(null)}
        />
      )}

      <ConfirmDialog
        open={deleteConfirm.open}
        title="Customer Delete Karo?"
        description="Customer ke saath uske tamam installments bhi delete ho jaen ge. Ye action undo nahi ho sakta."
        confirmLabel="Delete Karo"
        variant="danger"
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteConfirm.id) deleteMutation.mutate(deleteConfirm.id);
          setDeleteConfirm({ open: false, id: null });
        }}
        onCancel={() => setDeleteConfirm({ open: false, id: null })}
      />

      <ConfirmDialog
        open={closeFormConfirm}
        title="Form Band Karo?"
        description="Bhari hui details delete ho jaen gi. Kya aap waqai form band karna chahte hain?"
        confirmLabel="Haan, Band Karo"
        cancelLabel="Wapis Jao"
        variant="warning"
        onConfirm={() => { setCloseFormConfirm(false); setModal(null); }}
        onCancel={() => setCloseFormConfirm(false)}
      />
    </div>
  );
}
