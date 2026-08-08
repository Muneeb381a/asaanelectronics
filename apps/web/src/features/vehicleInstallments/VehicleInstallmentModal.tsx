import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  X, Car, User, CreditCard, History, Printer, Trash2,
  AlertTriangle, Ban, ChevronDown,
} from 'lucide-react';
import { useAuthStore } from '../../store/auth.store.ts';
import {
  vehicleInstallmentsApi,
  type VehicleInstallment, type RecordVehiclePaymentInput,
  type LetterStatus, type BiometricStatus,
} from '../../api/vehicleInstallments.api.ts';
import { sellersApi } from '../../api/sellers.api.ts';
import { staffApi } from '../../api/staff.api.ts';
import { getErrorMessage } from '../../utils/error.ts';
import { fmtDate } from '../../utils/dateFormat.ts';
import { openVehiclePaymentReceipt } from '../../utils/vehicleDeed.ts';
import ConfirmDialog from '../../components/ui/ConfirmDialog.tsx';

const VEHICLE_TYPE_ICONS: Record<string, string> = {
  BIKE: '🏍️', RICKSHAW: '🛺', LOADER_RICKSHAW: '🚛',
  ELECTRIC_BIKE: '⚡🏍️', ELECTRIC_RICKSHAW: '⚡🛺',
};
const METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash', BANK: 'Bank', JAZZCASH: 'JazzCash', EASYPAISA: 'Easypaisa', OTHER: 'Other',
};

const pkr = (n: number | string) =>
  'PKR ' + Number(n).toLocaleString('en-PK', { minimumFractionDigits: 0 });

const LETTER_LABELS: Record<LetterStatus, string> = {
  NONE:          'None',
  FIRST_NOTICE:  '1st Notice',
  SECOND_NOTICE: '2nd Notice',
  LEGAL_NOTICE:  'Legal Notice',
  FILED:         'Case Filed',
};
const LETTER_COLORS: Record<LetterStatus, string> = {
  NONE:          'bg-gray-100 text-gray-500',
  FIRST_NOTICE:  'bg-amber-100 text-amber-700',
  SECOND_NOTICE: 'bg-orange-100 text-orange-700',
  LEGAL_NOTICE:  'bg-red-100 text-red-700',
  FILED:         'bg-red-600 text-white',
};

const BIOMETRIC_LABELS: Record<BiometricStatus, string> = {
  PENDING:      'Pending',
  SELLER_DONE:  'Seller Done',
  BUYER_DONE:   'Buyer Done',
  COMPLETED:    'Completed ✓',
  NOT_REQUIRED: 'N/A',
};
const BIOMETRIC_COLORS: Record<BiometricStatus, string> = {
  PENDING:      'bg-gray-100 text-gray-500',
  SELLER_DONE:  'bg-blue-100 text-blue-700',
  BUYER_DONE:   'bg-indigo-100 text-indigo-700',
  COMPLETED:    'bg-green-100 text-green-700',
  NOT_REQUIRED: 'bg-slate-100 text-slate-500',
};

function LetterStatusBadge({ status }: { status: LetterStatus }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${LETTER_COLORS[status]}`}>
      {LETTER_LABELS[status]}
    </span>
  );
}

function BiometricStatusBadge({ status }: { status: BiometricStatus }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${BIOMETRIC_COLORS[status]}`}>
      {BIOMETRIC_LABELS[status]}
    </span>
  );
}

function calcNextDueDate(inst: VehicleInstallment): Date | null {
  if (inst.status !== 'ACTIVE') return null;
  const down = Number(inst.downPayment);
  const rem  = Number(inst.remaining);
  const mon  = Number(inst.monthly);
  const tot  = Number(inst.totalAmount);
  if (mon <= 0) return null;
  const paid       = (tot - down) - rem;
  const periodsPaid = Math.max(0, Math.floor(paid / mon + 0.001));
  const base = new Date(inst.startDate);
  const dueDay = inst.paymentDueDay ?? 10;
  const year   = base.getFullYear();
  const month  = base.getMonth() + periodsPaid + 1;
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(dueDay, lastDay));
}

type Tab = 'details' | 'payment' | 'vehicle';

interface Props {
  installmentId: string;
  onClose: () => void;
  onUpdated?: () => void;
}

export default function VehicleInstallmentModal({ installmentId, onClose, onUpdated }: Props) {
  const isOwner = useAuthStore((s) => s.user?.role === 'SELLER_OWNER');
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('details');
  const [payAmt, setPayAmt]     = useState('');
  const [payMethod, setPayMethod] = useState<'CASH' | 'BANK' | 'JAZZCASH' | 'EASYPAISA' | 'OTHER'>('CASH');
  const [payNote, setPayNote]   = useState('');
  const [payCollector, setPayCollector] = useState('');
  const [confirmAction, setConfirmAction] = useState<null | 'default' | 'cancel' | { type: 'deletePayment'; paymentId: string }>(null);
  const [actionsOpen, setActionsOpen] = useState(false);

  const { data: inst, isLoading } = useQuery({
    queryKey: ['vehicle-installment', installmentId],
    queryFn: () => vehicleInstallmentsApi.getOne(installmentId),
    staleTime: 5_000,
  });

  const { data: seller } = useQuery({
    queryKey: ['seller-profile'],
    queryFn: sellersApi.getMe,
    staleTime: 300_000,
  });

  const { data: staffList = [] } = useQuery({
    queryKey: ['staff-list'],
    queryFn: () => staffApi.list(),
    staleTime: 300_000,
    enabled: isOwner,
  });

  const refetch = () => {
    qc.invalidateQueries({ queryKey: ['vehicle-installment', installmentId] });
    qc.invalidateQueries({ queryKey: ['vehicle-installments'] });
    qc.invalidateQueries({ queryKey: ['vehicle-installment-stats'] });
    onUpdated?.();
  };

  const payMut = useMutation({
    mutationFn: (body: RecordVehiclePaymentInput) =>
      vehicleInstallmentsApi.recordPayment(installmentId, body),
    onSuccess: (result) => {
      toast.success(result.completed ? 'Payment recorded — Installment COMPLETED!' : 'Payment recorded');
      setPayAmt(''); setPayNote(''); setPayCollector('');
      refetch();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const defaultMut = useMutation({
    mutationFn: () => vehicleInstallmentsApi.markDefault(installmentId),
    onSuccess: () => { toast.success('Marked as defaulted'); refetch(); setConfirmAction(null); },
    onError: (e) => { toast.error(getErrorMessage(e)); setConfirmAction(null); },
  });

  const cancelMut = useMutation({
    mutationFn: () => vehicleInstallmentsApi.cancel(installmentId),
    onSuccess: () => { toast.success('Installment cancelled — vehicle returned to stock'); refetch(); setConfirmAction(null); onClose(); },
    onError: (e) => { toast.error(getErrorMessage(e)); setConfirmAction(null); },
  });

  const delPayMut = useMutation({
    mutationFn: (paymentId: string) => vehicleInstallmentsApi.deletePayment(installmentId, paymentId),
    onSuccess: () => { toast.success('Payment reversed'); refetch(); setConfirmAction(null); },
    onError: (e) => { toast.error(getErrorMessage(e)); setConfirmAction(null); },
  });

  const fieldsMut = useMutation({
    mutationFn: (body: { letterStatus?: LetterStatus; biometricStatus?: BiometricStatus }) =>
      vehicleInstallmentsApi.updateFields(installmentId, body),
    onSuccess: () => { toast.success('Updated'); refetch(); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const handlePaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(payAmt);
    if (!amount || amount <= 0) return toast.error('Enter a valid amount');
    payMut.mutate({
      amount, method: payMethod, note: payNote || undefined,
      collectedBy: payCollector || undefined,
    });
  };

  if (isLoading || !inst) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-2xl p-8 shadow-xl">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  const remaining   = Number(inst.remaining);
  const total       = Number(inst.totalAmount);
  const down        = Number(inst.downPayment);
  const paid        = (total - down) - remaining;
  const pct         = total > 0 ? Math.min(100, Math.round(((down + paid) / total) * 100)) : 0;
  const nextDue     = calcNextDueDate(inst);
  const typeIcon    = VEHICLE_TYPE_ICONS[inst.vehicleType] ?? '🚗';

  const STATUS_BADGE: Record<string, string> = {
    ACTIVE:    'bg-green-100 text-green-700',
    PENDING:   'bg-amber-100 text-amber-700',
    COMPLETED: 'bg-blue-100 text-blue-700',
    DEFAULTED: 'bg-red-100 text-red-700',
    CANCELLED: 'bg-gray-100 text-gray-500',
    CLOSED:    'bg-slate-100 text-slate-500',
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'details', label: 'Details', icon: <User size={14} /> },
    { id: 'payment', label: 'Payments', icon: <CreditCard size={14} /> },
    { id: 'vehicle', label: 'Vehicle', icon: <Car size={14} /> },
  ];

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">{typeIcon}</span>
              <div>
                <div className="font-bold text-gray-900 text-sm leading-tight">{inst.brand} {inst.model} {inst.year ? `(${inst.year})` : ''}</div>
                <div className="text-xs text-gray-500">{inst.invoiceNumber ?? ''} · {inst.customerName}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${STATUS_BADGE[inst.status] ?? 'bg-gray-100'}`}>
                {inst.status}
              </span>
              {isOwner && inst.status === 'ACTIVE' && (
                <div className="relative">
                  <button onClick={() => setActionsOpen(a => !a)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition">
                    Actions <ChevronDown size={12} />
                  </button>
                  {actionsOpen && (
                    <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-lg border border-gray-100 z-10 py-1">
                      <button onClick={() => { setActionsOpen(false); setConfirmAction('default'); }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition">
                        <AlertTriangle size={13} /> Mark Default
                      </button>
                      <button onClick={() => { setActionsOpen(false); setConfirmAction('cancel'); }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition">
                        <Ban size={13} /> Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}
              <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"><X size={17} /></button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="px-5 py-3 bg-gradient-to-r from-slate-900 to-blue-900 shrink-0">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs text-blue-200 font-medium">Progress</span>
              <span className="text-xs text-white font-bold">{pct}%</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-400 to-green-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex justify-between mt-2 text-xs">
              <span className="text-blue-200">Down: <span className="text-white font-semibold">{pkr(down)}</span></span>
              <span className="text-amber-300">Remaining: <span className="text-white font-semibold">{pkr(remaining)}</span></span>
              <span className="text-blue-200">Total: <span className="text-white font-semibold">{pkr(total)}</span></span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100 shrink-0 px-5">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition -mb-px ${tab === t.id ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="overflow-y-auto flex-1 p-5">

            {/* ── DETAILS TAB ── */}
            {tab === 'details' && (
              <div className="space-y-4">
                {/* Customer */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Customer Info</div>
                  <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                    <div><span className="text-gray-500">Name:</span> <span className="font-semibold text-gray-900">{inst.customerName}</span></div>
                    <div><span className="text-gray-500">Phone:</span> <span className="font-semibold">{inst.customerPhone}</span></div>
                    {inst.customerArea && <div><span className="text-gray-500">Area:</span> <span className="font-semibold">{inst.customerArea}</span></div>}
                    {inst.customerCnicMasked && <div><span className="text-gray-500">CNIC:</span> <span className="font-mono text-xs">{inst.customerCnicMasked}</span></div>}
                    {inst.customerFatherName && <div><span className="text-gray-500">Father:</span> <span className="font-semibold">{inst.customerFatherName}</span></div>}
                    {inst.customerFileNumber && <div><span className="text-gray-500">File #:</span> <span className="font-mono text-xs">{inst.customerFileNumber}</span></div>}
                  </div>
                </div>

                {/* Guarantors */}
                {inst.guarantorName && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <div className="text-xs font-bold text-amber-600 uppercase tracking-wide mb-3">Guarantor 1</div>
                    <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                      <div><span className="text-gray-500">Name:</span> <span className="font-semibold">{inst.guarantorName}</span></div>
                      {inst.guarantorPhone && <div><span className="text-gray-500">Phone:</span> <span className="font-semibold">{inst.guarantorPhone}</span></div>}
                      {inst.guarantorCnic && <div><span className="text-gray-500">CNIC:</span> <span className="font-mono text-xs">{inst.guarantorCnic}</span></div>}
                      {inst.guarantorRelation && <div><span className="text-gray-500">Relation:</span> <span className="font-semibold">{inst.guarantorRelation}</span></div>}
                      {inst.guarantorAddress && <div className="col-span-2"><span className="text-gray-500">Address:</span> <span className="font-semibold">{inst.guarantorAddress}</span></div>}
                    </div>
                  </div>
                )}
                {inst.guarantor2Name && (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                    <div className="text-xs font-bold text-orange-600 uppercase tracking-wide mb-3">Guarantor 2</div>
                    <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                      <div><span className="text-gray-500">Name:</span> <span className="font-semibold">{inst.guarantor2Name}</span></div>
                      {inst.guarantor2Phone && <div><span className="text-gray-500">Phone:</span> <span className="font-semibold">{inst.guarantor2Phone}</span></div>}
                      {inst.guarantor2Cnic && <div><span className="text-gray-500">CNIC:</span> <span className="font-mono text-xs">{inst.guarantor2Cnic}</span></div>}
                      {inst.guarantor2Address && <div className="col-span-2"><span className="text-gray-500">Address:</span> <span className="font-semibold">{inst.guarantor2Address}</span></div>}
                    </div>
                  </div>
                )}

                {/* Finance Terms */}
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                  <div className="text-xs font-bold text-indigo-600 uppercase tracking-wide mb-3">Finance Terms</div>
                  <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                    <div><span className="text-gray-500">Total Amount:</span> <span className="font-bold text-gray-900">{pkr(total)}</span></div>
                    <div><span className="text-gray-500">Down Payment:</span> <span className="font-bold text-green-700">{pkr(down)}</span></div>
                    <div><span className="text-gray-500">Monthly Qist:</span> <span className="font-bold text-indigo-700">{pkr(inst.monthly)}</span></div>
                    <div><span className="text-gray-500">Duration:</span> <span className="font-bold">{inst.months} months</span></div>
                    <div><span className="text-gray-500">Remaining:</span> <span className="font-bold text-amber-700">{pkr(remaining)}</span></div>
                    <div><span className="text-gray-500">Frequency:</span> <span className="font-bold capitalize">{inst.paymentFrequency}</span></div>
                    <div><span className="text-gray-500">Start Date:</span> <span className="font-bold">{fmtDate(inst.startDate)}</span></div>
                    {nextDue && <div><span className="text-gray-500">Next Due:</span> <span className="font-bold text-red-700">{fmtDate(nextDue)}</span></div>}
                  </div>
                </div>

                {inst.notes && (
                  <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-600 border border-gray-200">
                    <span className="font-semibold text-gray-700">Notes: </span>{inst.notes}
                  </div>
                )}

                {/* ── Letter Status ── */}
                <div className="border border-red-200 bg-red-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-xs font-bold text-red-700 uppercase tracking-wide">Letter / Notice Status</div>
                      <div className="text-[10px] text-red-400 mt-0.5">Default notice tracking</div>
                    </div>
                    <LetterStatusBadge status={inst.letterStatus} />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(['NONE', 'FIRST_NOTICE', 'SECOND_NOTICE', 'LEGAL_NOTICE', 'FILED'] as LetterStatus[]).map((s) => (
                      <button key={s}
                        onClick={() => fieldsMut.mutate({ letterStatus: s })}
                        disabled={inst.letterStatus === s || fieldsMut.isPending}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition ${
                          inst.letterStatus === s
                            ? 'bg-red-600 text-white border-red-600'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-red-400 hover:text-red-600 disabled:opacity-50'
                        }`}>
                        {LETTER_LABELS[s]}
                      </button>
                    ))}
                  </div>
                  {inst.letterSentAt && inst.letterStatus !== 'NONE' && (
                    <div className="text-[10px] text-red-400 mt-2">Sent: {fmtDate(inst.letterSentAt)}</div>
                  )}
                </div>

                {/* ── Biometric Status ── */}
                <div className="border border-violet-200 bg-violet-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-xs font-bold text-violet-700 uppercase tracking-wide">Biometric / Transfer Status</div>
                      <div className="text-[10px] text-violet-400 mt-0.5">NADRA · e-Sahulat · Excise Punjab</div>
                    </div>
                    <BiometricStatusBadge status={inst.biometricStatus} />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(['PENDING', 'SELLER_DONE', 'BUYER_DONE', 'COMPLETED', 'NOT_REQUIRED'] as BiometricStatus[]).map((s) => (
                      <button key={s}
                        onClick={() => fieldsMut.mutate({ biometricStatus: s })}
                        disabled={inst.biometricStatus === s || fieldsMut.isPending}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition ${
                          inst.biometricStatus === s
                            ? 'bg-violet-600 text-white border-violet-600'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-violet-400 hover:text-violet-600 disabled:opacity-50'
                        }`}>
                        {BIOMETRIC_LABELS[s]}
                      </button>
                    ))}
                  </div>
                  {inst.biometricDoneAt && inst.biometricStatus === 'COMPLETED' && (
                    <div className="text-[10px] text-violet-400 mt-2">Completed: {fmtDate(inst.biometricDoneAt)}</div>
                  )}
                </div>
              </div>
            )}

            {/* ── PAYMENT TAB ── */}
            {tab === 'payment' && (
              <div className="space-y-4">
                {/* Record Payment Form */}
                {inst.status === 'ACTIVE' && (
                  <form onSubmit={handlePaySubmit} className="bg-gradient-to-br from-slate-900 to-blue-900 rounded-xl p-4 text-white">
                    <div className="text-xs font-bold uppercase tracking-wide text-blue-200 mb-3">Record Payment</div>
                    <div className="text-xs text-blue-300 mb-3">
                      Remaining: <span className="text-white font-bold text-lg">{pkr(remaining)}</span>
                      {nextDue && <span className="ml-3 text-amber-300">Due: {fmtDate(nextDue)}</span>}
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="text-xs text-blue-300 font-medium block mb-1">Amount (PKR)</label>
                        <input
                          type="number" value={payAmt} onChange={(e) => setPayAmt(e.target.value)}
                          placeholder={String(Number(inst.monthly))} min={1} max={remaining} required
                          className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-white placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-blue-300 font-medium block mb-1">Method</label>
                        <select value={payMethod} onChange={(e) => setPayMethod(e.target.value as typeof payMethod)}
                          className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                          {Object.entries(METHOD_LABELS).map(([k, v]) => <option key={k} value={k} className="text-gray-900">{v}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      {isOwner && staffList.length > 0 && (
                        <div>
                          <label className="text-xs text-blue-300 font-medium block mb-1">Collected By</label>
                          <select value={payCollector} onChange={(e) => setPayCollector(e.target.value)}
                            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                            <option value="" className="text-gray-900">Self</option>
                            {staffList.map((s: { id: string; name: string }) => <option key={s.id} value={s.id} className="text-gray-900">{s.name}</option>)}
                          </select>
                        </div>
                      )}
                      <div className={isOwner && staffList.length > 0 ? '' : 'col-span-2'}>
                        <label className="text-xs text-blue-300 font-medium block mb-1">Note (optional)</label>
                        <input value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="Any note..."
                          className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-white placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setPayAmt(String(Number(inst.monthly)))}
                        className="px-3 py-2 text-xs bg-white/10 hover:bg-white/20 rounded-lg text-white font-medium transition">
                        Fill Monthly
                      </button>
                      <button type="button" onClick={() => setPayAmt(String(remaining))}
                        className="px-3 py-2 text-xs bg-white/10 hover:bg-white/20 rounded-lg text-white font-medium transition">
                        Fill Remaining
                      </button>
                      <button type="submit" disabled={payMut.isPending}
                        className="flex-1 py-2 bg-green-500 hover:bg-green-600 text-white font-bold text-sm rounded-lg transition disabled:opacity-60">
                        {payMut.isPending ? 'Saving...' : 'Record Payment'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Payment History */}
                <div>
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <History size={12} /> Payment History ({inst.payments?.length ?? 0})
                  </div>
                  {!inst.payments?.length ? (
                    <div className="text-center py-8 text-gray-400 text-sm">No payments yet</div>
                  ) : (
                    <div className="space-y-2">
                      {inst.payments.map((p) => (
                        <div key={p.id} className="flex items-center justify-between gap-2 bg-gray-50 rounded-xl px-4 py-3 group hover:bg-gray-100 transition">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-gray-900">{pkr(Number(p.amount))}</span>
                              <span className="text-xs px-2 py-0.5 bg-white border border-gray-200 rounded-full text-gray-600">{METHOD_LABELS[p.method] ?? p.method}</span>
                              {(p.daysLate ?? 0) > 0 && <span className="text-xs text-red-600 font-medium">{p.daysLate}d late</span>}
                              {p.receiptNumber && <span className="text-xs text-indigo-500 font-mono">{p.receiptNumber}</span>}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {fmtDate(p.paidOn)}
                              {p.collectorName && <span> · by {p.collectorName}</span>}
                              {p.note && <span> · {p.note}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => openVehiclePaymentReceipt({
                                shopName:         seller?.shopName ?? '',
                                shopPhone:        seller?.phone,
                                customerName:     inst.customerName,
                                customerPhone:    inst.customerPhone,
                                customerPhotoUrl: inst.customerPhotoUrl,
                                vehicleLabel:     `${inst.brand} ${inst.model}${inst.year ? ` (${inst.year})` : ''}`,
                                vehicleType:      inst.vehicleType,
                                engineNumber:     inst.engineNumber,
                                chassisNumber:    inst.chassisNumber,
                                invoiceNumber:    inst.invoiceNumber,
                                receiptNumber:    p.receiptNumber,
                                amountPaid:       Number(p.amount),
                                method:           p.method,
                                paidOn:           p.paidOn,
                                note:             p.note,
                                collectorName:    p.collectorName,
                                daysLate:         p.daysLate,
                                totalAmount:      Number(inst.totalAmount),
                                remaining:        Number(inst.remaining),
                                monthly:          Number(inst.monthly),
                              })}
                              className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 rounded transition">
                              <Printer size={12} />
                            </button>
                            {isOwner && (
                              <button
                                onClick={() => setConfirmAction({ type: 'deletePayment', paymentId: p.id })}
                                className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition">
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── VEHICLE TAB ── */}
            {tab === 'vehicle' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-gradient-to-br from-slate-800 to-indigo-900 rounded-xl text-white">
                  <span className="text-4xl">{typeIcon}</span>
                  <div>
                    <div className="text-lg font-black">{inst.brand} {inst.model}</div>
                    <div className="text-sm text-blue-200">{inst.year ?? ''} · {inst.color ?? '—'} · {inst.vehicleCondition}</div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Vehicle Identifiers</div>
                  <div className="space-y-2 font-mono text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 w-24 shrink-0 font-sans font-medium text-xs">Engine #</span>
                      <span className="font-bold text-gray-900 bg-white border border-gray-200 rounded px-2 py-0.5 text-xs">{inst.engineNumber}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 w-24 shrink-0 font-sans font-medium text-xs">Chassis #</span>
                      <span className="font-bold text-gray-900 bg-white border border-gray-200 rounded px-2 py-0.5 text-xs">{inst.chassisNumber}</span>
                    </div>
                    {inst.registrationNumber && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 w-24 shrink-0 font-sans font-medium text-xs">Reg. #</span>
                        <span className="font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded px-2 py-0.5 text-xs">{inst.registrationNumber}</span>
                      </div>
                    )}
                  </div>
                </div>

                {inst.vehicleSellingPrice && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <div className="text-xs font-bold text-green-600 uppercase tracking-wide mb-1">Vehicle Selling Price</div>
                    <div className="text-xl font-black text-green-800">{pkr(Number(inst.vehicleSellingPrice))}</div>
                  </div>
                )}

                <button
                  onClick={() => {
                    /* TODO: open sale deed print */
                    toast.success('Sale deed coming soon');
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white font-semibold text-sm rounded-xl hover:bg-indigo-700 transition">
                  <Printer size={15} /> Print Sale Deed / Agreement
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirm Dialogs */}
      <ConfirmDialog
        open={confirmAction === 'default'}
        title="Mark as Defaulted"
        description="Mark this vehicle installment as defaulted? The vehicle remains in SOLD_INSTALLMENT status until manually returned."
        confirmLabel="Mark Default"
        variant="danger"
        onConfirm={() => defaultMut.mutate()}
        onCancel={() => setConfirmAction(null)}
      />
      <ConfirmDialog
        open={confirmAction === 'cancel'}
        title="Cancel Installment"
        description="Cancel this installment? The vehicle will be returned to AVAILABLE in stock."
        confirmLabel="Cancel Installment"
        variant="danger"
        onConfirm={() => cancelMut.mutate()}
        onCancel={() => setConfirmAction(null)}
      />
      <ConfirmDialog
        open={typeof confirmAction === 'object' && confirmAction !== null && confirmAction.type === 'deletePayment'}
        title="Reverse Payment"
        description="Reverse this payment? The amount will be added back to remaining balance."
        confirmLabel="Reverse"
        variant="danger"
        onConfirm={() => {
          if (typeof confirmAction === 'object' && confirmAction !== null && 'paymentId' in confirmAction) {
            delPayMut.mutate(confirmAction.paymentId);
          }
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </>
  );
}
