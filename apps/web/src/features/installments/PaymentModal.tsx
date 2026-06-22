import { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Loader2, Upload, X, CheckCircle2, Printer, MessageCircle, Pencil } from 'lucide-react';
import ConfirmDialog from '../../components/ui/ConfirmDialog.tsx';
import { useAuthStore } from '../../store/auth.store.ts';
import { installmentsApi, type Installment } from '../../api/installments.api.ts';
import { paymentsApi, type PaymentMethod } from '../../api/payments.api.ts';
import { staffApi } from '../../api/staff.api.ts';
import { sellersApi } from '../../api/sellers.api.ts';
import { fmtDate } from '../../utils/dateFormat.ts';
import { api } from '../../api/client.ts';
import { RowSkeleton } from '../../components/ui/Skeleton.tsx';
import { getErrorMessage } from '../../utils/error.ts';
import { openBill, type BillData } from '../../utils/bill.ts';
import {
  installmentWhatsappUrl,
  type InstallmentReceiptData,
} from '../../utils/receipt.ts';

const METHODS: PaymentMethod[] = ['CASH', 'BANK', 'JAZZCASH', 'EASYPAISA', 'OTHER'];

function pkr(v: string | number) {
  return 'PKR ' + Number(v).toLocaleString('en-PK', { maximumFractionDigits: 0 });
}

interface Props {
  inst: Installment;
  onClose: () => void;
  /** Extra query keys to invalidate on success (e.g. customer-installments) */
  extraInvalidate?: string[][];
}

export default function PaymentModal({ inst, onClose, extraInvalidate = [] }: Props) {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.role === 'SELLER_OWNER';
  const [amount, setAmount] = useState(String(Number(inst.monthly)));
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [note, setNote] = useState('');
  const [collectedBy, setCollectedBy] = useState('');
  const [proofImageUrl, setProofImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState<'pay' | 'history'>('pay');
  const [receiptData, setReceiptData] = useState<InstallmentReceiptData | null>(null);
  const [billPayload, setBillPayload] = useState<BillData | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Edit payment state
  const [editId, setEditId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editMethod, setEditMethod] = useState<PaymentMethod>('CASH');
  const [editNote, setEditNote] = useState('');

  // Delete confirmation state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: seller } = useQuery({
    queryKey: ['seller-me'],
    queryFn: sellersApi.getMe,
    staleTime: 10 * 60_000,
    retry: false,
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: staffApi.list,
    enabled: isOwner,
  });

  const { data: history, isLoading: histLoading } = useQuery({
    queryKey: ['payments', inst.id],
    queryFn: () => paymentsApi.list(inst.id),
    enabled: tab === 'history',
  });

  async function handleProofFile(file: File) {
    if (!file.type.startsWith('image/')) { toast.error('Only image files allowed'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'assaan/payments');
      const res = await api.post<{ data: { url: string } }>('/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setProofImageUrl(res.data.data.url);
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  }

  const mutation = useMutation({
    mutationFn: () => paymentsApi.record({
      installmentId: inst.id,
      amount: Number(amount),
      method,
      note: note.trim() || undefined,
      collectedBy: isOwner ? (collectedBy || undefined) : (user?.id ?? undefined),
      proofImageUrl: proofImageUrl || undefined,
    }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['installment-single', inst.id] });
      const prevSingle = qc.getQueryData<Installment>(['installment-single', inst.id]);
      type ListCache = { data: Installment[]; total: number; page: number; limit: number };
      const prevLists = qc.getQueriesData<ListCache>({ queryKey: ['installments'], exact: false });
      const oldRemaining = Number(prevSingle?.remaining ?? inst.remaining);
      const newRemaining = Math.max(0, oldRemaining - Number(amount));
      const willComplete = newRemaining <= 0.001;
      qc.setQueryData<Installment>(['installment-single', inst.id], (old) =>
        old ? { ...old, remaining: String(newRemaining), ...(willComplete && { status: 'COMPLETED' as const }) } : old,
      );
      qc.setQueriesData<ListCache>({ queryKey: ['installments'], exact: false }, (cached) => {
        if (!cached?.data) return cached;
        return {
          ...cached,
          data: cached.data.map((i) =>
            i.id === inst.id
              ? { ...i, remaining: String(newRemaining), ...(willComplete && { status: 'COMPLETED' as const }) }
              : i
          ),
        };
      });
      return { prevSingle, prevLists, oldRemaining };
    },
    onError: (e, _vars, context) => {
      if (context?.prevSingle !== undefined) qc.setQueryData(['installment-single', inst.id], context.prevSingle);
      if (context?.prevLists) for (const [key, data] of context.prevLists) qc.setQueryData(key, data);
      toast.error(getErrorMessage(e, 'Payment failed'));
    },
    onSuccess: (data, _vars, context) => {
      // Confirm with real server values (overwrite optimistic)
      type ListCache = { data: typeof inst[]; total: number; page: number; limit: number };
      qc.setQueriesData<ListCache>(
        { queryKey: ['installments'], exact: false },
        (cached) => {
          if (!cached?.data) return cached;
          return {
            ...cached,
            data: cached.data.map((i) =>
              i.id === inst.id
                ? { ...i, remaining: String(data.remaining), ...(data.completed && { status: 'COMPLETED' as const }) }
                : i
            ),
          };
        },
      );
      qc.setQueryData<Installment>(['installment-single', inst.id], (old) =>
        old ? { ...old, remaining: String(data.remaining), ...(data.completed && { status: 'COMPLETED' as const }) } : old,
      );
      void qc.invalidateQueries({ queryKey: ['payments', inst.id] });
      void qc.invalidateQueries({ queryKey: ['recovery-agents-stats'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      for (const key of extraInvalidate) void qc.invalidateQueries({ queryKey: key });
      toast.success(data.completed ? 'Installment fully paid!' : 'Payment recorded');

      // Use pre-mutation remaining so receipt calculation is accurate
      const oldRemaining = context?.oldRemaining ?? Number(inst.remaining);
      // Calculate installment progress
      const totalInstallments = freshInst.months;
      const monthly = Number(freshInst.monthly);
      const totalMinusDP = Number(freshInst.totalAmount) - Number(freshInst.downPayment);
      // Before this payment, how many were fully paid?
      const paidAmountBefore = totalMinusDP - oldRemaining;
      const paidFullBefore = Math.max(0, Math.floor(paidAmountBefore / monthly + 0.001));
      const currentMonth = paidFullBefore + 1; // this payment is installment #currentMonth
      // After this payment, how many are fully paid?
      const paidAmountAfter = totalMinusDP - data.remaining;
      const paidInstallments = data.completed
        ? totalInstallments
        : Math.floor(paidAmountAfter / monthly + 0.001);

      // Which period's due date does this payment cover?
      const isDaily = freshInst.paymentFrequency === 'daily';
      const periodDueD = new Date(freshInst.startDate);
      if (isDaily) periodDueD.setDate(periodDueD.getDate() + currentMonth);
      else periodDueD.setMonth(periodDueD.getMonth() + currentMonth);
      const periodDueDateStr = [
        periodDueD.getFullYear(),
        String(periodDueD.getMonth() + 1).padStart(2, '0'),
        String(periodDueD.getDate()).padStart(2, '0'),
      ].join('-');
      const daysLate = Math.max(
        0,
        Math.floor((new Date(data.payment.paidOn).getTime() - periodDueD.getTime()) / 86_400_000),
      );

      const receiptPayload: InstallmentReceiptData = {
        shopName:          seller?.shopName ?? 'Receipt',
        shopPhone:         seller?.phone,
        customerName:      freshInst.customerName,
        customerPhone:     freshInst.customerPhone,
        productName:       freshInst.productName,
        invoiceNumber:     freshInst.invoiceNumber,
        amountPaid:        Number(data.payment.amount),
        remaining:         data.remaining,
        monthly,
        method:            data.payment.method,
        paidOn:            data.payment.paidOn,
        note:              data.payment.note,
        paymentFrequency:  freshInst.paymentFrequency,
        completed:         data.completed,
        paidInstallments,
        totalInstallments,
        currentMonth,
        periodDueDate: periodDueDateStr,
        daysLate,
      };

      const bd: BillData = {
        shop:             { shopName: seller?.shopName ?? '', phone: seller?.phone ?? '', address: seller?.address },
        customer:         { name: freshInst.customerName, phone: freshInst.customerPhone, area: freshInst.customerArea },
        product:          freshInst.productName,
        totalAmount:      freshInst.totalAmount,
        downPayment:      freshInst.downPayment,
        monthly:          freshInst.monthly,
        months:           freshInst.months,
        remaining:        data.remaining,
        status:           data.completed ? 'COMPLETED' : freshInst.status,
        startDate:        freshInst.startDate,
        installmentId:    freshInst.id,
        invoiceNumber:    freshInst.invoiceNumber,
        imeiNumber:       freshInst.imeiNumber,
        cashPrice:        freshInst.cashPrice,
        profitMarkup:     freshInst.profitMarkup,
        murabahaMode:     seller?.murabahaMode,
        paymentFrequency: freshInst.paymentFrequency,
        paymentSummary:   { currentMonth, paidMonths: paidInstallments, totalMonths: totalInstallments },
      };

      setReceiptData(receiptPayload);
      setBillPayload(bd);
      void openBill(bd);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => paymentsApi.remove(id),
    onSuccess: () => {
      // Refresh single installment (gets corrected remaining) + payments list
      void qc.invalidateQueries({ queryKey: ['installment-single', inst.id] });
      void qc.invalidateQueries({ queryKey: ['payments', inst.id] });
      // Mark list stale but don't force immediate refetch (lazy refresh on next visit)
      void qc.invalidateQueries({ queryKey: ['installments'], exact: false, refetchType: 'none' });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      for (const key of extraInvalidate) void qc.invalidateQueries({ queryKey: key });
      setDeleteConfirmId(null);
      toast.success('Payment deleted');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Failed to delete')),
  });

  const editMutation = useMutation({
    mutationFn: () => paymentsApi.patch(editId!, {
      amount: Number(editAmount),
      method: editMethod,
      note:   editNote.trim() || undefined,
    }),
    onSuccess: (data) => {
      // Update list cache instantly with corrected remaining
      type ListCache = { data: typeof inst[]; total: number; page: number; limit: number };
      qc.setQueriesData<ListCache>(
        { queryKey: ['installments'], exact: false },
        (cached) => {
          if (!cached?.data) return cached;
          return {
            ...cached,
            data: cached.data.map((i) =>
              i.id === inst.id
                ? { ...i, remaining: String(data.remaining), ...(data.completed && { status: 'COMPLETED' as const }) }
                : i
            ),
          };
        },
      );
      void qc.invalidateQueries({ queryKey: ['installment-single', inst.id] });
      void qc.invalidateQueries({ queryKey: ['payments', inst.id] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      for (const key of extraInvalidate) void qc.invalidateQueries({ queryKey: key });
      setEditId(null);
      toast.success('Payment updated');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Failed to update')),
  });

  // fetch latest remaining from server so it's accurate even if we came from the drawer
  const { data: freshInst } = useQuery({
    queryKey: ['installment-single', inst.id],
    queryFn: () => installmentsApi.getOne(inst.id),
    initialData: inst,
  });

  const remaining = Number(freshInst.remaining);
  const amountNum = Number(amount);
  const amountInvalid = !amount || amountNum <= 0 || amountNum > remaining + 0.01;

  const historyWithPeriods = useMemo(() => {
    if (!history) return [];
    const mo = Number(freshInst.monthly);
    const hIsDaily = freshInst.paymentFrequency === 'daily';
    const sd = new Date(freshInst.startDate);
    const sorted = [...history].sort(
      (a, b) => new Date(a.paidOn).getTime() - new Date(b.paidOn).getTime(),
    );
    let cumulative = 0;
    const enriched = sorted.map((p) => {
      const periodNum = mo > 0 ? Math.max(1, Math.floor(cumulative / mo + 0.001) + 1) : undefined;
      const periodDue = periodNum !== undefined
        ? (() => {
            const d = new Date(sd);
            if (hIsDaily) d.setDate(d.getDate() + periodNum);
            else d.setMonth(d.getMonth() + periodNum);
            return d;
          })()
        : undefined;
      const late = periodDue
        ? Math.max(0, Math.floor((new Date(p.paidOn).getTime() - periodDue.getTime()) / 86_400_000))
        : 0;
      cumulative += Number(p.amount);
      return { ...p, periodNum, periodDue, late };
    });
    return enriched.reverse();
  }, [history, freshInst.monthly, freshInst.paymentFrequency, freshInst.startDate]);

  return (
    <div
      className="fixed inset-0 z-70 flex flex-col sm:items-center sm:justify-center bg-black/50 backdrop-blur-sm sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex-1 sm:flex-none flex flex-col w-full sm:max-w-md sm:max-h-[90vh] bg-white sm:rounded-2xl sm:shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <div className="min-w-0 flex-1 mr-3">
            <h2 className="text-sm font-semibold text-gray-900 truncate">{freshInst.customerName}</h2>
            <p className="text-xs text-gray-400 truncate">
              {freshInst.productName} · Remaining: <span className="font-medium text-orange-500">{pkr(freshInst.remaining)}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 border-b border-gray-100 shrink-0">
          {(['pay', 'history'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-2 text-sm capitalize transition border-b-2 -mb-px ${
                tab === t ? 'border-blue-600 text-blue-600 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {t === 'pay' ? 'Record Payment' : 'History'}
            </button>
          ))}
        </div>

        {/* Receipt screen — shown after successful payment */}
        {receiptData && (
          <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 size={24} className="text-emerald-600" />
            </div>
            <div className="text-center">
              <p className="font-bold text-gray-900 text-base">
                {receiptData.completed ? 'Fully Paid!' : 'Payment Recorded'}
              </p>
              <p className="text-sm text-gray-500 mt-0.5">
                PKR {receiptData.amountPaid.toLocaleString()} · {receiptData.method}
              </p>
              {!receiptData.completed && (
                <p className="text-xs text-orange-500 mt-1">
                  Remaining: PKR {receiptData.remaining.toLocaleString()}
                </p>
              )}
            </div>

            {/* Installment progress cards */}
            {receiptData.totalInstallments !== undefined && (
              <div className="w-full grid grid-cols-3 gap-2">
                <div className="flex flex-col items-center bg-emerald-50 rounded-xl py-2.5 px-1">
                  <p className="text-[10px] text-gray-400 mb-0.5">Paid</p>
                  <p className="text-lg font-bold text-emerald-700">{receiptData.paidInstallments}</p>
                  <p className="text-[10px] text-emerald-600">of {receiptData.totalInstallments}</p>
                </div>
                <div className="flex flex-col items-center bg-blue-50 rounded-xl py-2.5 px-1">
                  <p className="text-[10px] text-gray-400 mb-0.5">
                    {receiptData.paymentFrequency === 'daily' ? 'This Day' : 'This Month'}
                  </p>
                  <p className="text-lg font-bold text-blue-700">#{receiptData.currentMonth}</p>
                  {receiptData.periodDueDate ? (
                    <p className="text-[9px] text-blue-400">Due: {fmtDate(receiptData.periodDueDate)}</p>
                  ) : (
                    <p className="text-[10px] text-blue-500">installment</p>
                  )}
                  {!!receiptData.daysLate && receiptData.daysLate > 0 && (
                    <p className="text-[9px] text-red-500 font-semibold">{receiptData.daysLate}d late</p>
                  )}
                </div>
                <div className="flex flex-col items-center bg-orange-50 rounded-xl py-2.5 px-1">
                  <p className="text-[10px] text-gray-400 mb-0.5">Pending</p>
                  <p className="text-lg font-bold text-orange-600">
                    {(receiptData.totalInstallments ?? 0) - (receiptData.paidInstallments ?? 0)}
                  </p>
                  <p className="text-[10px] text-orange-500">remaining</p>
                </div>
              </div>
            )}

            {/* Dates row — both dates clearly labeled */}
            {receiptData.periodDueDate && (
              <div className="w-full grid grid-cols-2 gap-2">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-2.5">
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-blue-400 mb-0.5">📅 Qist ki tarikh</p>
                  <p className="text-xs font-bold text-blue-800">{fmtDate(receiptData.periodDueDate)}</p>
                  <p className="text-[9px] text-blue-400 mt-0.5">jis din ki qist thi</p>
                </div>
                <div className="bg-green-50 border border-green-100 rounded-xl p-2.5">
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-green-400 mb-0.5">📆 Payment ki tarikh</p>
                  <p className="text-xs font-bold text-green-800">{fmtDate(receiptData.paidOn)}</p>
                  <p className={`text-[9px] mt-0.5 font-semibold ${(receiptData.daysLate ?? 0) > 0 ? 'text-red-500' : 'text-green-500'}`}>
                    {(receiptData.daysLate ?? 0) > 0 ? `⚠️ ${receiptData.daysLate} din late` : '✓ On time'}
                  </p>
                </div>
              </div>
            )}

            {/* Progress bar */}
            {receiptData.totalInstallments !== undefined && receiptData.totalInstallments > 0 && (
              <div className="w-full">
                <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                  <span>{receiptData.paidInstallments} paid</span>
                  <span>{Math.round(((receiptData.paidInstallments ?? 0) / receiptData.totalInstallments) * 100)}%</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${Math.round(((receiptData.paidInstallments ?? 0) / receiptData.totalInstallments) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3 w-full">
              <button
                onClick={() => { if (billPayload) void openBill(billPayload); }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
              >
                <Printer size={15} /> Print
              </button>
              <a
                href={installmentWhatsappUrl(receiptData)}
                target="_blank"
                rel="noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white rounded-xl text-sm font-semibold transition"
              >
                <MessageCircle size={15} /> WhatsApp
              </a>
            </div>
            <button
              onClick={onClose}
              className="w-full py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition"
            >
              Done
            </button>
          </div>
        )}

        {/* Body */}
        {!receiptData && <div className="flex-1 overflow-y-auto px-4 py-4">
          {tab === 'pay' ? (
            <div className="space-y-4">
              {mutation.error instanceof Error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600">
                  {mutation.error.message}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Amount (PKR)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min={1}
                  max={remaining}
                  step={1}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  {freshInst.paymentFrequency === 'daily' ? 'Daily' : 'Monthly'}: {pkr(freshInst.monthly)} · Max: {pkr(remaining)}
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Method</label>
                <div className="flex flex-wrap gap-1.5">
                  {METHODS.map((m) => (
                    <button key={m} onClick={() => setMethod(m)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                        method === m
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'text-gray-600 border-gray-200 hover:border-blue-300'
                      }`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Note (optional)</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Receipt #123"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {!isOwner && (
                <div className="flex items-center gap-2 bg-violet-50 border border-violet-100 rounded-lg px-3 py-2 text-xs text-violet-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                  This payment will be recorded under your name
                </div>
              )}

              {isOwner && staff.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Collected by (optional)</label>
                  <select
                    value={collectedBy}
                    onChange={(e) => setCollectedBy(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="">— Owner collected —</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Proof / Receipt (optional)</label>
                <input ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleProofFile(f); }} />
                {proofImageUrl ? (
                  <div className="relative inline-block">
                    <img src={proofImageUrl} alt="proof" loading="lazy" className="h-20 w-auto rounded-lg border border-gray-200 object-cover" />
                    <button type="button" onClick={() => setProofImageUrl('')}
                      className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5">
                      <X size={11} />
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-200 rounded-lg text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600 transition disabled:opacity-50">
                    {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                    {uploading ? 'Uploading…' : 'Upload receipt image'}
                  </button>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={onClose}
                  className="flex-1 px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">
                  Cancel
                </button>
                <button
                  onClick={() => mutation.mutate()}
                  disabled={amountInvalid || mutation.isPending || uploading}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition disabled:opacity-50">
                  {mutation.isPending ? 'Recording…' : 'Record Payment'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              {histLoading ? (
                <RowSkeleton rows={3} />
              ) : !history?.length ? (
                <p className="text-sm text-gray-400 text-center py-6">No payments recorded yet.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {historyWithPeriods.map((p) => {
                    const isEditing = editId === p.id;
                    const maxEditAmount = Number(p.amount) + Number(freshInst.remaining);
                    const editAmountNum = Number(editAmount);
                    const editInvalid = !editAmount || editAmountNum <= 0 || editAmountNum > maxEditAmount;

                    if (isEditing) {
                      return (
                        <div key={p.id} className="py-3 space-y-2.5 bg-blue-50/50 -mx-4 px-4 border-x border-blue-100">
                          <p className="text-xs font-medium text-blue-700">Payment edit karo</p>
                          <div>
                            <label className="text-[11px] text-gray-500 mb-1 block">Amount (PKR)</label>
                            <input
                              type="number" value={editAmount} min={1} max={maxEditAmount}
                              onChange={(e) => setEditAmount(e.target.value)}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <p className="text-[11px] text-gray-400 mt-0.5">Max: PKR {maxEditAmount.toLocaleString()}</p>
                          </div>
                          <div>
                            <label className="text-[11px] text-gray-500 mb-1 block">Method</label>
                            <div className="flex flex-wrap gap-1">
                              {METHODS.map((m) => (
                                <button key={m} type="button" onClick={() => setEditMethod(m)}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                                    editMethod === m
                                      ? 'bg-blue-600 text-white border-blue-600'
                                      : 'text-gray-600 border-gray-200 hover:border-blue-300'
                                  }`}>
                                  {m}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="text-[11px] text-gray-500 mb-1 block">Note</label>
                            <input
                              type="text" value={editNote} placeholder="optional"
                              onChange={(e) => setEditNote(e.target.value)}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => setEditId(null)}
                              className="flex-1 py-2 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
                              Cancel
                            </button>
                            <button
                              onClick={() => editMutation.mutate()}
                              disabled={editInvalid || editMutation.isPending}
                              className="flex-1 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50">
                              {editMutation.isPending ? 'Saving…' : 'Save'}
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={p.id} className="py-3 flex items-start justify-between group gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm font-medium text-gray-900">{pkr(p.amount)}</p>
                            {p.periodNum !== undefined && (
                              <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">
                                {freshInst.paymentFrequency === 'daily' ? 'Din' : 'Month'} #{p.periodNum}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400">
                            {p.method} · {fmtDate(p.paidOn)}
                            {p.note && ` · ${p.note}`}
                          </p>
                          {p.periodDue && (
                            <p className="text-[10px] text-gray-400">
                              Due: {fmtDate(p.periodDue)}
                              {p.late > 0 && <span className="text-red-500 ml-1">{p.late}d late</span>}
                            </p>
                          )}
                          {p.collectorName && (
                            <p className="text-[11px] text-violet-600 font-medium mt-0.5">by {p.collectorName}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {p.proofImageUrl && (
                            <a href={p.proofImageUrl} target="_blank" rel="noreferrer"
                              className="text-[11px] text-blue-500 hover:underline mr-1">Receipt</a>
                          )}
                          {isOwner && (
                            <>
                              <button
                                onClick={() => {
                                  setEditId(p.id);
                                  setEditAmount(String(Number(p.amount)));
                                  setEditMethod(p.method);
                                  setEditNote(p.note ?? '');
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded transition">
                                <Pencil size={12} />
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(p.id)}
                                disabled={deleteMutation.isPending}
                                className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition disabled:opacity-40">
                                <X size={12} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <ConfirmDialog
                open={deleteConfirmId !== null}
                title="Payment Delete Karo?"
                description="Ye payment hamesha ke liye delete ho jaegi aur remaining balance wapas ho jaega."
                confirmLabel="Delete Karo"
                variant="danger"
                isPending={deleteMutation.isPending}
                onConfirm={() => { if (deleteConfirmId) deleteMutation.mutate(deleteConfirmId); }}
                onCancel={() => setDeleteConfirmId(null)}
              />
            </div>
          )}
        </div>}
      </div>
    </div>
  );
}
