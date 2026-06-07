import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Loader2, Upload, X, CheckCircle2, Printer, MessageCircle } from 'lucide-react';
import { useAuthStore } from '../../store/auth.store.ts';
import { installmentsApi, type Installment } from '../../api/installments.api.ts';
import { paymentsApi, type PaymentMethod } from '../../api/payments.api.ts';
import { staffApi } from '../../api/staff.api.ts';
import { sellersApi } from '../../api/sellers.api.ts';
import { api } from '../../api/client.ts';
import { RowSkeleton } from '../../components/ui/Skeleton.tsx';
import { getErrorMessage } from '../../utils/error.ts';
import {
  printInstallmentReceipt,
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
  const fileRef = useRef<HTMLInputElement>(null);

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
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['installments'] });
      qc.invalidateQueries({ queryKey: ['payments', inst.id] });
      qc.invalidateQueries({ queryKey: ['recovery-agents-stats'] });
      for (const key of extraInvalidate) qc.invalidateQueries({ queryKey: key });
      toast.success(data.completed ? 'Installment fully paid!' : 'Payment recorded');
      setReceiptData({
        shopName:          seller?.shopName ?? 'Receipt',
        shopPhone:         seller?.phone,
        customerName:      freshInst.customerName,
        productName:       freshInst.productName,
        invoiceNumber:     freshInst.invoiceNumber,
        amountPaid:        Number(data.payment.amount),
        remaining:         data.remaining,
        monthly:           Number(freshInst.monthly),
        method:            data.payment.method,
        paidOn:            data.payment.paidOn,
        note:              data.payment.note,
        paymentFrequency:  freshInst.paymentFrequency,
        completed:         data.completed,
      });
      printInstallmentReceipt({
        shopName:         seller?.shopName ?? 'Receipt',
        shopPhone:        seller?.phone,
        customerName:     freshInst.customerName,
        productName:      freshInst.productName,
        invoiceNumber:    freshInst.invoiceNumber,
        amountPaid:       Number(data.payment.amount),
        remaining:        data.remaining,
        monthly:          Number(freshInst.monthly),
        method:           data.payment.method,
        paidOn:           data.payment.paidOn,
        note:             data.payment.note,
        paymentFrequency: freshInst.paymentFrequency,
        completed:        data.completed,
      });
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Payment failed')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => paymentsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['installments'] });
      qc.invalidateQueries({ queryKey: ['payments', inst.id] });
      for (const key of extraInvalidate) qc.invalidateQueries({ queryKey: key });
      toast.success('Payment deleted');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Failed to delete')),
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

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col sm:items-center sm:justify-center bg-black/50 backdrop-blur-sm sm:p-4"
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
          <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col items-center gap-4">
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
            <div className="flex gap-3 w-full">
              <button
                onClick={() => printInstallmentReceipt(receiptData)}
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
                  {history.map((p) => (
                    <div key={p.id} className="py-3 flex items-start justify-between group gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900">{pkr(p.amount)}</p>
                        <p className="text-xs text-gray-400">
                          {p.method} · {new Date(p.paidOn).toLocaleDateString('en-PK')}
                          {p.note && ` · ${p.note}`}
                        </p>
                        {p.collectorName && (
                          <p className="text-[11px] text-violet-600 font-medium mt-0.5">by {p.collectorName}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {p.proofImageUrl && (
                          <a href={p.proofImageUrl} target="_blank" rel="noreferrer"
                            className="text-[11px] text-blue-500 hover:underline">Receipt</a>
                        )}
                        {isOwner && (
                          <button
                            onClick={() => { if (confirm('Delete this payment?')) deleteMutation.mutate(p.id); }}
                            disabled={deleteMutation.isPending}
                            className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition disabled:opacity-40">
                            <X size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>}
      </div>
    </div>
  );
}
