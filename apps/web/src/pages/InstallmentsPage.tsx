import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/auth.store.ts';
import { FileText, MessageCircle, Download, MoreVertical, CreditCard, Loader2, X, Upload, ChevronUp, ChevronDown, ArrowUpDown, Printer, Layers, Link2, Copy, CheckCheck, AlertOctagon } from 'lucide-react';
import ImportInstallmentsModal from '../components/ImportInstallmentsModal.tsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.tsx';
import EditInstallmentModal from '../components/EditInstallmentModal.tsx';
import { TableSkeleton, RowSkeleton, EmptyState } from '../components/ui/Skeleton.tsx';
import { installmentsApi, type Installment, type InstallmentStatus } from '../api/installments.api.ts';
import InstallmentForm from '../features/installments/InstallmentForm.tsx';
import CnicInstallmentFlow from '../features/installments/CnicInstallmentFlow.tsx';
import RecoveryDrawer from '../features/installments/RecoveryDrawer.tsx';
import PaymentModal from '../features/installments/PaymentModal.tsx';
import { useDebounce } from '../hooks/useDebounce.ts';
import { sellersApi, type PaymentAccount } from '../api/sellers.api.ts';
import { paymentsApi, type PaymentMethod } from '../api/payments.api.ts';
import { repossessionsApi } from '../api/repossessions.api.ts';
import { openBill, openLegalNotice } from '../utils/bill.ts';
import { getErrorMessage } from '../utils/error.ts';
import { fmtDate } from '../utils/dateFormat.ts';
import { openWhatsApp, reminderMessage } from '../utils/whatsapp.ts';
import { whatsappTemplatesApi, applyTemplate } from '../api/whatsappTemplates.api.ts';

function calcNextDueDate(inst: Installment): Date | null {
  if (inst.status !== 'ACTIVE') return null;
  const down = Number(inst.downPayment);
  const rem  = Number(inst.remaining);
  const mon  = Number(inst.monthly);
  const tot  = Number(inst.totalAmount);
  if (mon <= 0) return null;
  const paidAmount  = (tot - down) - rem;
  const periodsPaid = Math.max(0, Math.floor(paidAmount / mon + 0.001));
  const base = new Date(inst.startDate);
  if (inst.paymentFrequency === 'daily') {
    base.setDate(base.getDate() + periodsPaid + 1);
    return base;
  }
  const dueDay  = inst.paymentDueDay ?? 10;
  const year    = base.getFullYear();
  const month   = base.getMonth() + periodsPaid + 1;
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(dueDay, lastDay));
}

function buildCSV(rows: Installment[]) {
  const header = ['Invoice', 'Customer', 'Phone', 'Area', 'Product', 'IMEI', 'Total (PKR)', 'Down Payment', 'Per Period', 'Remaining', 'Frequency', 'Duration', 'Status', 'Start Date', 'Next Due'];
  const body = rows.map((i) => {
    const next = calcNextDueDate(i);
    const isDaily = i.paymentFrequency === 'daily';
    return [
      i.invoiceNumber ?? '',
      i.customerName, i.customerPhone, i.customerArea ?? '',
      i.productName, i.imeiNumber ?? '',
      i.totalAmount, i.downPayment, i.monthly, i.remaining,
      isDaily ? 'Daily' : 'Monthly',
      isDaily ? `${i.months} days` : `${i.months} months`,
      i.status,
      fmtDate(i.startDate),
      next ? fmtDate(next) : '',
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });
  return [header.join(','), ...body].join('\n');
}

const STATUS_STYLES: Record<InstallmentStatus, string> = {
  PENDING:   'bg-amber-100 text-amber-700',
  ACTIVE:    'bg-green-100 text-green-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
  DEFAULTED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
  CLOSED:    'bg-slate-100 text-slate-500',
};

const STATUS_FILTERS = [
  { label: 'All',       value: '' },
  { label: 'Pending',   value: 'PENDING' },
  { label: 'Active',    value: 'ACTIVE' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Defaulted', value: 'DEFAULTED' },
  { label: 'Cancelled', value: 'CANCELLED' },
  { label: 'Closed',    value: 'CLOSED' },
];

function pkr(v: string | number) {
  return 'PKR ' + Number(v).toLocaleString('en-PK', { maximumFractionDigits: 0 });
}

function Badge({ status, paused }: { status: InstallmentStatus; paused?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status]}`}>
        {status.charAt(0) + status.slice(1).toLowerCase()}
      </span>
      {paused && (
        <span className="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-600">
          Paused
        </span>
      )}
    </span>
  );
}

// ── WhatsApp Template Picker ──────────────────────────────────────────────────
function TemplatePickerModal({ inst, shopName, onClose }: {
  inst: Installment;
  shopName: string;
  onClose: () => void;
}) {
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['whatsapp-templates'],
    queryFn: whatsappTemplatesApi.list,
    staleTime: 60_000,
  });
  const [selected, setSelected] = useState<string | null>(null);

  const vars = {
    customer_name:     inst.customerName,
    shop_name:         shopName,
    product_name:      inst.productName,
    amount_due:        inst.monthly,
    remaining_balance: inst.remaining,
    phone:             inst.customerPhone,
  };

  function sendDefault() {
    openWhatsApp(inst.customerPhone, reminderMessage({
      shopName, customerName: inst.customerName,
      productName: inst.productName, monthly: inst.monthly,
      remaining: inst.remaining, paymentFrequency: inst.paymentFrequency,
    }));
    onClose();
  }

  function sendTemplate() {
    const t = templates.find((t) => t.id === selected);
    if (!t) return;
    openWhatsApp(inst.customerPhone, applyTemplate(t.body, vars));
    onClose();
  }

  if (!isLoading && templates.length === 0) {
    sendDefault();
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4 pb-4 sm:pb-0"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full sm:max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">WhatsApp Reminder</h2>
            <p className="text-xs text-gray-400">{inst.customerName} · {inst.customerPhone}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 max-h-80 overflow-y-auto space-y-2">
          {isLoading ? (
            <div className="flex items-center gap-2 py-4 text-gray-400 text-xs justify-center">
              <Loader2 size={14} className="animate-spin" /> Loading templates…
            </div>
          ) : (
            <>
              <button
                onClick={() => setSelected(null)}
                className={`w-full text-left p-3 rounded-xl border transition ${
                  selected === null ? 'border-green-400 bg-green-50' : 'border-gray-100 hover:border-gray-200'
                }`}
              >
                <p className="text-xs font-semibold text-gray-700 mb-1">Default Message</p>
                <p className="text-xs text-gray-500 line-clamp-2">
                  {reminderMessage({
                    shopName, customerName: inst.customerName,
                    productName: inst.productName, monthly: inst.monthly,
                    remaining: inst.remaining, paymentFrequency: inst.paymentFrequency,
                  })}
                </p>
              </button>
              {templates.map((t) => {
                const preview = applyTemplate(t.body, vars);
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelected(t.id)}
                    className={`w-full text-left p-3 rounded-xl border transition ${
                      selected === t.id ? 'border-green-400 bg-green-50' : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <p className="text-xs font-semibold text-gray-700 mb-1">{t.name}</p>
                    <p className="text-xs text-gray-500 line-clamp-2 whitespace-pre-wrap">{preview}</p>
                  </button>
                );
              })}
            </>
          )}
        </div>

        <div className="px-4 pb-4 pt-2 flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">
            Cancel
          </button>
          <button
            onClick={selected ? sendTemplate : sendDefault}
            className="flex-1 py-2.5 text-sm font-semibold bg-green-600 text-white rounded-xl hover:bg-green-700 transition flex items-center justify-center gap-1.5">
            <MessageCircle size={13} /> Send
          </button>
        </div>
      </div>
    </div>
  );
}

function BulkReminderModal({ onClose }: { onClose: () => void }) {
  const { data: shopData } = useQuery({ queryKey: ['shop-me'], queryFn: sellersApi.getMe });
  const { data, isLoading } = useQuery({
    queryKey: ['installments-bulk-remind'],
    queryFn: () => installmentsApi.exportAll({ status: 'ACTIVE' }),
    staleTime: 5 * 60_000,
  });

  const now = new Date();
  const overdue = useMemo(() => {
    return (data?.data ?? []).filter((i) => {
      const d = calcNextDueDate(i);
      return d && d < now;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const [sent, setSent] = useState<Set<string>>(new Set());

  function send(inst: Installment, daysOverdue?: number) {
    if (!shopData) return;
    openWhatsApp(inst.customerPhone, reminderMessage({
      shopName: shopData.shopName,
      customerName: inst.customerName,
      productName: inst.productName,
      monthly: inst.monthly,
      remaining: inst.remaining,
      paymentFrequency: inst.paymentFrequency,
      daysOverdue,
    }));
    setSent((s) => new Set(s).add(inst.id));
  }

  function sendAll() {
    overdue.filter((i) => !sent.has(i.id)).forEach((inst, idx) => {
      const dueDate = calcNextDueDate(inst);
      const daysLate = dueDate ? Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / 86_400_000)) : 0;
      setTimeout(() => send(inst, daysLate), idx * 500);
    });
  }

  const unsent = overdue.filter((i) => !sent.has(i.id)).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-lg w-full max-w-lg p-6 max-h-[85vh] flex flex-col">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Overdue Reminders</h2>
            <p className="text-xs text-gray-400">
              {isLoading ? 'Loadingâ€¦' : `${overdue.length} customers with overdue payments`}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>

        {isLoading ? (
          <RowSkeleton rows={4} />
        ) : overdue.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">No overdue installments â€" all good!</p>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100 rounded-xl border border-gray-100 mb-4">
              {overdue.map((inst) => {
                const dueDate = calcNextDueDate(inst);
                const daysLate = dueDate ? Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / 86_400_000)) : 0;
                const isSent = sent.has(inst.id);
                return (
                  <div key={inst.id} className={`flex items-center justify-between px-4 py-3 ${isSent ? 'opacity-50' : ''}`}>
                    <div className="min-w-0 mr-3">
                      <p className="text-sm font-medium text-gray-900 truncate">{inst.customerName}</p>
                      <p className="text-xs text-gray-400">{inst.customerPhone} · {pkr(inst.monthly)}</p>
                      <p className="text-[11px] text-red-500 font-medium">{daysLate}d overdue</p>
                    </div>
                    <button
                      onClick={() => send(inst, daysLate)}
                      disabled={isSent}
                      className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium transition disabled:cursor-default ${
                        isSent
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : 'bg-green-600 text-white hover:bg-green-700'
                      }`}>
                      <MessageCircle size={12} />
                      {isSent ? 'Sent ✓' : 'Send'}
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button onClick={onClose}
                className="flex-1 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
                Close
              </button>
              <button
                onClick={sendAll}
                disabled={unsent === 0}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50">
                <MessageCircle size={14} />
                Send All ({unsent})
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── JazzCash payment link modal ───────────────────────────────────────────────
function JazzCashLinkModal({ inst, onClose }: { inst: Installment; onClose: () => void }) {
  const [result, setResult] = useState<{
    configured: boolean; redirectUrl: string | null; whatsappMsg: string; txnRefNo: string | null;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: statusData } = useQuery({
    queryKey: ['jazzcash-status'],
    queryFn: paymentsApi.jazzCashStatus,
    staleTime: 5 * 60_000,
  });

  const mutation = useMutation({
    mutationFn: () => paymentsApi.generateJazzCashLink({
      installmentId: inst.id,
      amount:        Number(inst.monthly),
      customerName:  inst.customerName,
      customerPhone: inst.customerPhone,
    }),
    onSuccess: (data) => setResult(data),
    onError:   () => toast.error('Failed to generate payment link'),
  });

  function copyLink() {
    if (result?.redirectUrl) {
      void navigator.clipboard.writeText(result.redirectUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function sendWhatsApp() {
    if (!result?.whatsappMsg) return;
    const phone = inst.customerPhone.replace(/\D/g, '');
    const num   = phone.startsWith('92') ? phone : `92${phone.replace(/^0/, '')}`;
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(result.whatsappMsg)}`, '_blank');
  }

  const isConfigured = statusData?.configured ?? false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Link2 size={16} className="text-green-600" /> JazzCash Payment Link</h2>
            <p className="text-xs text-gray-400 mt-0.5">{inst.customerName} · PKR {Number(inst.monthly).toLocaleString('en-PK')}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"><X size={16} /></button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {!isConfigured && !result && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
              <p className="font-semibold text-amber-800">JazzCash not configured</p>
              <p className="text-xs text-amber-700 mt-1">Add <code className="bg-amber-100 px-1 rounded">JAZZCASH_MERCHANT_ID</code>, <code className="bg-amber-100 px-1 rounded">JAZZCASH_PASSWORD</code>, and <code className="bg-amber-100 px-1 rounded">JAZZCASH_INTEGRITY_SALT</code> to your server <code>.env</code> to enable payment links.</p>
              <p className="text-xs text-amber-600 mt-2">You can still generate a WhatsApp payment request message.</p>
            </div>
          )}

          {!result && (
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-60 flex items-center justify-center gap-2">
              {mutation.isPending ? <><Loader2 size={15} className="animate-spin" /> Generating…</> : <><Link2 size={15} /> Generate Payment Link</>}
            </button>
          )}

          {result && (
            <>
              {result.configured && result.redirectUrl ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Payment Link</p>
                  <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
                    <p className="text-xs text-gray-700 truncate flex-1 font-mono">{result.redirectUrl}</p>
                    <button onClick={copyLink} className="shrink-0 text-gray-400 hover:text-blue-600 transition">
                      {copied ? <CheckCheck size={14} className="text-green-600" /> : <Copy size={14} />}
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400">Customer opens this link to pay via JazzCash. Expires in 2 hours.</p>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                  JazzCash is not configured — sending a WhatsApp request message instead.
                </div>
              )}

              <button
                onClick={sendWhatsApp}
                className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition">
                <MessageCircle size={15} /> Send via WhatsApp
              </button>
            </>
          )}
        </div>

        <div className="px-5 pb-5">
          <button onClick={onClose} className="w-full py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Repossess Device Modal ────────────────────────────────────────────────────
function RepossessModal({ inst, onClose }: { inst: Installment; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    repossessedDate: new Date().toISOString().slice(0, 10),
    deviceName:      inst.productName,
    imei:            inst.imeiNumber ?? '',
    condition:       'fair',
    reason:          '',
    amountRecovered: '',
    notes:           '',
  });

  const mut = useMutation({
    mutationFn: () => repossessionsApi.create({
      installmentId:   inst.id,
      repossessedDate: form.repossessedDate,
      deviceName:      form.deviceName,
      imei:            form.imei || undefined,
      condition:       form.condition as 'good' | 'fair' | 'poor',
      reason:          form.reason || undefined,
      amountRecovered: form.amountRecovered ? Number(form.amountRecovered) : undefined,
      notes:           form.notes || undefined,
    }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['installments'] });
      void qc.invalidateQueries({ queryKey: ['repossessions'] });
      void qc.invalidateQueries({ queryKey: ['repossession-stats'] });
      toast.success('Repossession recorded — installment closed');
      onClose();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <div className="flex items-center gap-2">
            <AlertOctagon size={18} className="text-red-600" />
            <h2 className="text-base font-semibold text-gray-900">Repossess Device</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="px-6 py-4 bg-red-50 border-b border-red-100">
          <p className="text-sm text-red-700 font-medium">{inst.customerName} · {inst.customerPhone}</p>
          <p className="text-xs text-red-500 mt-0.5">This will close the installment. Action cannot be undone.</p>
        </div>
        <div className="px-6 py-5 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Device Name *</label>
            <input value={form.deviceName} onChange={(e) => setForm((f) => ({ ...f, deviceName: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Date *</label>
              <input type="date" value={form.repossessedDate} onChange={(e) => setForm((f) => ({ ...f, repossessedDate: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Condition</label>
              <select value={form.condition} onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="poor">Poor</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">IMEI</label>
            <input value={form.imei} onChange={(e) => setForm((f) => ({ ...f, imei: e.target.value }))}
              placeholder="Auto-filled from installment"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Reason</label>
            <input value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              placeholder="Non-payment, customer request, etc."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Amount Recovered (PKR)</label>
            <input type="number" value={form.amountRecovered} onChange={(e) => setForm((f) => ({ ...f, amountRecovered: e.target.value }))}
              placeholder="0"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2} placeholder="Optional notes..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" />
          </div>
        </div>
        <div className="px-6 pb-5 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-xl border border-gray-200 transition">Cancel</button>
          <button
            onClick={() => mut.mutate()}
            disabled={mut.isPending || !form.deviceName || !form.repossessedDate}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 transition disabled:opacity-50"
          >
            {mut.isPending ? 'Recording…' : 'Repossess Device'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ScheduleModal({ inst, shopName, onClose }: { inst: Installment; shopName?: string; onClose: () => void }) {
  const isDaily      = inst.paymentFrequency === 'daily';
  const monthly      = Number(inst.monthly);
  const remaining    = Number(inst.remaining);
  const totalMinusDP = Number(inst.totalAmount) - Number(inst.downPayment);
  const totalPaid    = totalMinusDP - remaining;
  const periodsPaid  = Math.floor(totalPaid / monthly + 0.001);
  const periodsLeft  = inst.months - periodsPaid;
  const now          = new Date();

  const rows = Array.from({ length: inst.months }, (_, i) => {
    const base    = new Date(inst.startDate);
    let dueDate: Date;
    if (isDaily) {
      base.setDate(base.getDate() + i + 1);
      dueDate = base;
    } else {
      const dueDay  = inst.paymentDueDay ?? 10;
      const year    = base.getFullYear();
      const month   = base.getMonth() + i + 1;
      const lastDay = new Date(year, month + 1, 0).getDate();
      dueDate = new Date(year, month, Math.min(dueDay, lastDay));
    }

    const isPaid    = i < periodsPaid;
    const isCurrent = i === periodsPaid;
    const isOverdue = isCurrent && dueDate < now;

    let amount = monthly;
    if (!isPaid && i === inst.months - 1) {
      amount = remaining - monthly * (periodsLeft - 1);
      if (amount <= 0) amount = monthly;
    }

    return { period: i + 1, dueDate, isPaid, isCurrent, isOverdue, amount };
  });

  const unit = isDaily ? 'Day' : 'Month';

  const printSchedule = () => {
    const fmt = (d: Date) => d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
    const rowsHtml = rows.map(r => {
      const status = r.isPaid ? '✓ Paid' : r.isOverdue ? '⚠ Overdue' : r.isCurrent ? '→ Due Now' : 'Pending';
      const color  = r.isPaid ? '#15803d' : r.isOverdue ? '#dc2626' : r.isCurrent ? '#1d4ed8' : '#374151';
      const bg     = r.isPaid ? '#f0fdf4' : r.isOverdue ? '#fef2f2' : r.isCurrent ? '#eff6ff' : '#fff';
      return `<tr style="background:${bg}">
        <td style="padding:7px 12px;border-bottom:1px solid #f0f0f0;color:${color};font-weight:600">${r.period}</td>
        <td style="padding:7px 12px;border-bottom:1px solid #f0f0f0">${fmt(r.dueDate)}</td>
        <td style="padding:7px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600">PKR ${r.amount.toLocaleString('en-PK',{maximumFractionDigits:0})}</td>
        <td style="padding:7px 12px;border-bottom:1px solid #f0f0f0;color:${color};font-weight:600">${status}</td>
      </tr>`;
    }).join('');
    const win = window.open('', '_blank', 'width=750,height=900');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Payment Schedule</title>
      <style>
        body{font-family:system-ui,sans-serif;margin:0;padding:28px;color:#111;font-size:13px}
        .no-print{margin-bottom:16px;display:flex;gap:8px}
        @media print{.no-print{display:none!important}}
        h1{margin:0 0 2px;font-size:18px;font-weight:700}
        .sub{color:#6b7280;font-size:12px;margin-bottom:16px}
        .meta{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:20px}
        .meta-box{background:#f9fafb;border-radius:8px;padding:10px 14px;border:1px solid #e5e7eb}
        .meta-box .label{font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em}
        .meta-box .val{font-size:15px;font-weight:700;margin-top:2px}
        table{width:100%;border-collapse:collapse}
        th{text-align:left;padding:8px 12px;background:#f9fafb;border-bottom:2px solid #e5e7eb;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280}
        th:nth-child(3){text-align:right}
        .footer{margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:11px;display:flex;justify-content:space-between}
      </style></head><body>
      <div class="no-print">
        <button onclick="window.print()" style="padding:8px 18px;background:#2563eb;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">🖨 Print / Save PDF</button>
        <button onclick="window.close()" style="padding:8px 18px;background:#f3f4f6;color:#374151;border:none;border-radius:8px;font-size:13px;cursor:pointer">Close</button>
      </div>
      ${shopName ? `<h1>${shopName}</h1>` : '<h1>Payment Schedule</h1>'}
      <div class="sub">${inst.customerName} · ${inst.customerPhone} · ${inst.productName}${inst.invoiceNumber ? ` · Invoice #${inst.invoiceNumber}` : ''}</div>
      <div class="meta">
        <div class="meta-box"><div class="label">Total Amount</div><div class="val">PKR ${Number(inst.totalAmount).toLocaleString('en-PK',{maximumFractionDigits:0})}</div></div>
        <div class="meta-box"><div class="label">Down Payment</div><div class="val">PKR ${Number(inst.downPayment).toLocaleString('en-PK',{maximumFractionDigits:0})}</div></div>
        <div class="meta-box" style="background:${remaining>0?'#fffbeb':'#f0fdf4'};border-color:${remaining>0?'#fde68a':'#bbf7d0'}">
          <div class="label">Remaining</div>
          <div class="val" style="color:${remaining>0?'#92400e':'#15803d'}">PKR ${remaining.toLocaleString('en-PK',{maximumFractionDigits:0})}</div>
        </div>
      </div>
      <div class="meta" style="margin-top:-8px">
        <div class="meta-box"><div class="label">Per ${unit}</div><div class="val">PKR ${monthly.toLocaleString('en-PK',{maximumFractionDigits:0})}</div></div>
        <div class="meta-box" style="background:#f0fdf4;border-color:#bbf7d0"><div class="label">Periods Paid</div><div class="val" style="color:#15803d">${periodsPaid} / ${inst.months}</div></div>
        <div class="meta-box" style="background:#eff6ff;border-color:#bfdbfe"><div class="label">Start Date</div><div class="val" style="color:#1d4ed8;font-size:13px">${new Date(inst.startDate).toLocaleDateString('en-PK',{day:'2-digit',month:'short',year:'numeric'})}</div></div>
      </div>
      <table>
        <thead><tr><th>#</th><th>Due Date</th><th>Amount</th><th>Status</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <div class="footer">
        <span>Generated ${new Date().toLocaleDateString('en-PK',{day:'2-digit',month:'short',year:'numeric'})}</span>
        <span>Payments: ${periodsPaid} paid · ${periodsLeft} remaining</span>
      </div>
    </body></html>`);
    win.document.close();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 max-h-[85vh] flex flex-col">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Payment Schedule</h2>
            <p className="text-xs text-gray-400">{inst.customerName} · {inst.productName}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={printSchedule}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition font-medium"
              title="Print or save as PDF"
            >
              <Printer size={13} /> Print
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-green-50 rounded-xl px-3 py-2 text-center">
            <p className="text-[11px] text-gray-400">Paid</p>
            <p className="font-bold text-green-700">{periodsPaid}</p>
          </div>
          <div className="bg-orange-50 rounded-xl px-3 py-2 text-center">
            <p className="text-[11px] text-gray-400">Remaining</p>
            <p className="font-bold text-orange-700">{periodsLeft}</p>
          </div>
          <div className="bg-blue-50 rounded-xl px-3 py-2 text-center">
            <p className="text-[11px] text-gray-400">Total</p>
            <p className="font-bold text-blue-700">{inst.months}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-100 rounded-xl border border-gray-100">
          {rows.map((row) => (
            <div
              key={row.period}
              className={`flex items-center justify-between px-4 py-2.5 text-sm ${
                row.isPaid ? 'bg-white' : row.isOverdue ? 'bg-red-50' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`w-6 h-6 shrink-0 flex items-center justify-center rounded-full text-xs font-bold ${
                  row.isPaid    ? 'bg-green-100 text-green-700' :
                  row.isOverdue ? 'bg-red-100 text-red-700'     :
                  row.isCurrent ? 'bg-blue-100 text-blue-700'   :
                                  'bg-gray-100 text-gray-500'
                }`}>
                  {row.isPaid ? '✓' : row.period}
                </span>
                <div>
                  <p className={`${row.isPaid ? 'text-gray-400' : row.isOverdue ? 'text-red-700 font-medium' : 'text-gray-900'}`}>
                    {fmtDate(row.dueDate)}
                    {row.isOverdue  && <span className="ml-1.5 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">Overdue</span>}
                    {row.isCurrent && !row.isOverdue && <span className="ml-1.5 text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">Due now</span>}
                  </p>
                  <p className="text-[11px] text-gray-400">{unit} {row.period}</p>
                </div>
              </div>
              <p className={`font-medium text-sm ${row.isPaid ? 'text-green-600 line-through decoration-green-300' : 'text-gray-900'}`}>
                {pkr(row.amount)}
              </p>
            </div>
          ))}
        </div>

        <button onClick={onClose}
          className="mt-4 w-full px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
          Close
        </button>
      </div>
    </div>
  );
}

function RescheduleModal({ inst, onClose }: { inst: Installment; onClose: () => void }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<'months' | 'monthly'>('months');
  const [value, setValue] = useState('');

  const remaining  = Number(inst.remaining);
  const isDaily    = inst.paymentFrequency === 'daily';
  const roundStep  = isDaily ? 5 : 25;
  const unit       = isDaily ? 'day' : 'month';
  const unitPlural = isDaily ? 'days' : 'months';

  const preview = useMemo(() => {
    const n = Number(value);
    if (!n || n <= 0) return null;
    if (mode === 'months')  return { months: n, monthly: Math.round((remaining / n) / roundStep) * roundStep };
    if (mode === 'monthly') return { months: Math.ceil(remaining / n), monthly: n };
    return null;
  }, [value, mode, remaining, roundStep]);

  const mutation = useMutation({
    mutationFn: () => installmentsApi.reschedule(inst.id, mode === 'months'
      ? { newMonths: Number(value) }
      : { newMonthly: Number(value) }),
    onSuccess: (updated) => {
      // Patch only the fields that changed — avoids full list refetch
      type ListCache = { data: Installment[]; total: number; page: number; limit: number };
      qc.setQueriesData<ListCache>({ queryKey: ['installments'], exact: false }, (cached) => {
        if (!cached?.data) return cached;
        return {
          ...cached,
          data: cached.data.map((i) =>
            i.id === inst.id
              ? { ...i, monthly: updated.monthly, months: updated.months, status: updated.status }
              : i
          ),
        };
      });
      qc.setQueryData(['installment-single', inst.id], (old: Installment | undefined) =>
        old ? { ...old, monthly: updated.monthly, months: updated.months, status: updated.status } : old
      );
      toast.success('Installment rescheduled');
      onClose();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const isValid = !!preview && (mode === 'months' ? preview.months >= 1 : preview.monthly <= remaining);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Reschedule Plan</h2>
            <p className="text-xs text-gray-400">{inst.customerName} · {inst.productName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>

        <div className="bg-blue-50 rounded-xl px-4 py-3 mb-5 text-sm">
          <p className="text-gray-500 text-xs mb-0.5">Remaining balance</p>
          <p className="font-bold text-blue-700 text-base">{pkr(remaining)}</p>
          <p className="text-gray-400 text-xs mt-1">Current: {pkr(Number(inst.monthly))} / {inst.paymentFrequency === 'daily' ? 'day' : 'month'} · {inst.months} {inst.paymentFrequency === 'daily' ? 'days' : 'months'}</p>
        </div>

        <div className="flex gap-1 mb-4 border-b border-gray-100">
          {(['months', 'monthly'] as const).map((m) => (
            <button key={m} onClick={() => { setMode(m); setValue(''); }}
              className={`px-3 py-1.5 text-sm capitalize transition border-b-2 -mb-px ${
                mode === m ? 'border-blue-600 text-blue-600 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {m === 'months' ? `New Duration` : `New Per-${unit}`}
            </button>
          ))}
        </div>

        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            {mode === 'months' ? `New number of ${unitPlural}` : `New per-${unit} amount (PKR)`}
          </label>
          <input
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={mode === 'months' ? (isDaily ? 'e.g. 30' : 'e.g. 12') : 'e.g. 5000'}
            min={1}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {preview && (
          <div className="bg-gray-50 rounded-xl px-4 py-3 mb-4 grid grid-cols-2 gap-3 text-center">
            <div>
              <p className="text-xs text-gray-400">Per {unit}</p>
              <p className="font-bold text-gray-900 text-sm">{pkr(preview.monthly)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Duration</p>
              <p className="font-bold text-gray-900 text-sm">{preview.months} {unitPlural}</p>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!isValid || mutation.isPending}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50">
            {mutation.isPending ? <><Loader2 size={14} className='animate-spin' /> Savingâ€¦</> : 'Confirm Reschedule'}
          </button>
        </div>
      </div>
    </div>
  );
}

function WaiverModal({ inst, onClose }: { inst: Installment; onClose: () => void }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  const remaining = Number(inst.remaining);
  const parsed    = Number(amount);
  const isValid   = parsed > 0 && parsed <= remaining;
  const willClear = isValid && parsed >= remaining;

  const mutation = useMutation({
    mutationFn: () => installmentsApi.waiver(inst.id, { amount: parsed, reason: reason.trim() || undefined }),
    onSuccess: (updated) => {
      type ListCache = { data: Installment[]; total: number; page: number; limit: number };
      qc.setQueriesData<ListCache>({ queryKey: ['installments'], exact: false }, (cached) => {
        if (!cached?.data) return cached;
        return {
          ...cached,
          data: cached.data.map((i) =>
            i.id === inst.id ? { ...i, remaining: updated.remaining, status: updated.status } : i
          ),
        };
      });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(willClear ? 'Balance cleared — installment completed' : `PKR ${parsed.toLocaleString()} waived`);
      onClose();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Balance Waiver</h2>
            <p className="text-xs text-gray-400">{inst.customerName} · {inst.productName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>

        <div className="bg-amber-50 rounded-xl px-4 py-3 mb-5">
          <p className="text-xs text-amber-600 mb-0.5">Remaining balance</p>
          <p className="font-bold text-amber-700 text-base">{pkr(remaining)}</p>
        </div>

        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Waiver amount (PKR)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 500"
            min={1}
            max={remaining}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          {parsed > remaining && (
            <p className="text-xs text-red-500 mt-1">Cannot exceed remaining balance</p>
          )}
          {willClear && (
            <p className="text-xs text-emerald-600 font-medium mt-1">This will fully clear the balance and complete the installment.</p>
          )}
        </div>

        <div className="mb-5">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Reason (optional)</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. goodwill discount, settlement"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!isValid || mutation.isPending}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition disabled:opacity-50">
            {mutation.isPending ? <><Loader2 size={14} className="animate-spin inline mr-1" />Saving…</> : 'Apply Waiver'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PauseModal({ inst, onClose }: { inst: Installment; onClose: () => void }) {
  const qc = useQueryClient();
  const [months, setMonths] = useState(1);
  const [reason, setReason] = useState('');
  const isPaused = !!inst.pausedUntil;

  const pauseMutation = useMutation({
    mutationFn: () => installmentsApi.pause(inst.id, { months, reason: reason.trim() || undefined }),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['installments'] });
      qc.setQueryData(['installment-single', inst.id], updated);
      toast.success(`Installment paused until ${fmtDate(new Date(updated.pausedUntil!))}`);
      onClose();
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Failed to pause')),
  });

  const unpauseMutation = useMutation({
    mutationFn: () => installmentsApi.unpause(inst.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['installments'] });
      toast.success('Installment pause removed');
      onClose();
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Failed to remove pause')),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {isPaused ? 'Installment Paused' : 'Pause Installment'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {isPaused ? (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 space-y-1">
              <p className="text-sm font-semibold text-amber-800">Currently Paused</p>
              <p className="text-xs text-amber-700">
                Paused until <span className="font-semibold">{fmtDate(new Date(inst.pausedUntil!))}</span>
              </p>
              {inst.pauseReason && (
                <p className="text-xs text-amber-600">Reason: {inst.pauseReason}</p>
              )}
              <p className="text-xs text-amber-500 mt-2">
                Remove the pause to resume normal collection.
              </p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Pause duration</label>
                <div className="flex gap-2 flex-wrap">
                  {[1, 2, 3, 6].map((m) => (
                    <button
                      key={m}
                      onClick={() => setMonths(m)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                        months === m
                          ? 'bg-amber-500 text-white border-amber-500'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-amber-300'
                      }`}
                    >
                      {m} month{m !== 1 ? 's' : ''}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Reason <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Customer hospitalized, travelling abroad"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <p className="text-xs text-gray-400">
                Due dates will shift forward by {months} month{months !== 1 ? 's' : ''}. No payments expected during pause.
              </p>
            </>
          )}
        </div>

        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition">
            Cancel
          </button>
          {isPaused ? (
            <button
              onClick={() => unpauseMutation.mutate()}
              disabled={unpauseMutation.isPending}
              className="flex-1 px-4 py-2 rounded-xl bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition disabled:opacity-60"
            >
              {unpauseMutation.isPending ? 'Removing…' : 'Remove Pause'}
            </button>
          ) : (
            <button
              onClick={() => pauseMutation.mutate()}
              disabled={pauseMutation.isPending}
              className="flex-1 px-4 py-2 rounded-xl bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 transition disabled:opacity-60"
            >
              {pauseMutation.isPending ? 'Pausing…' : `Pause ${months} Month${months !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const METHODS: PaymentMethod[] = ['CASH', 'BANK', 'JAZZCASH', 'EASYPAISA', 'OTHER'];

function BatchReminderModal({ shopName, onClose }: { shopName: string; onClose: () => void }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [cursor, setCursor] = useState<number | null>(null);

  const { data: sheet = [], isLoading } = useQuery({
    queryKey: ['due-sheet'],
    queryFn:  installmentsApi.dueSheet,
    staleTime: 30_000,
  });

  const selected = sheet.filter((r) => checked[r.id]);
  const started  = cursor !== null;
  const done     = cursor !== null && cursor >= selected.length;

  const sendCurrent = () => {
    const idx = cursor ?? 0;
    const row = selected[idx];
    if (!row) return;
    openWhatsApp(row.customerPhone, reminderMessage({
      shopName,
      customerName: row.customerName,
      productName: row.productName,
      monthly: row.monthly,
      remaining: row.remaining,
      daysOverdue: row.daysOverdue,
    }));
    setCursor(idx + 1);
  };

  const startOrNext = () => {
    if (!started) setCursor(0);
    sendCurrent();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-0 sm:px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg flex flex-col" style={{ maxHeight: '90vh' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Batch Reminders</h2>
            <p className="text-xs text-gray-400">Send WhatsApp to overdue customers</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 px-5 py-3 space-y-1.5">
          {isLoading ? (
            <div className="space-y-2 py-4">
              {[0, 1, 2].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : sheet.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No overdue installments today</p>
          ) : (
            sheet.map((row) => {
              const isCurrent = cursor !== null && selected[cursor]?.id === row.id;
              const isSent    = cursor !== null && selected.findIndex((r) => r.id === row.id) < cursor;
              return (
                <label key={row.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                  isSent    ? 'border-emerald-200 bg-emerald-50 opacity-60' :
                  isCurrent ? 'border-blue-300 bg-blue-50' :
                  checked[row.id] ? 'border-gray-200 bg-white' : 'border-gray-100 opacity-50'
                }`}>
                  <input
                    type="checkbox"
                    disabled={started}
                    checked={!!checked[row.id]}
                    onChange={() => setChecked((p) => ({ ...p, [row.id]: !p[row.id] }))}
                    className="accent-green-600 w-4 h-4 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{row.customerName}</p>
                    <p className="text-xs text-gray-400">{row.customerPhone}
                      {row.daysOverdue > 0 && <span className="ml-1 text-red-500 font-medium">{row.daysOverdue}d late</span>}
                    </p>
                  </div>
                  {isSent && <span className="text-xs text-emerald-600 font-semibold shrink-0">✓ Sent</span>}
                  {isCurrent && <span className="text-xs text-blue-600 font-semibold shrink-0">← Next</span>}
                </label>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 shrink-0">
          {!started && (
            <div className="flex items-center justify-between mb-3">
              <button className="text-xs text-blue-600 hover:underline"
                onClick={() => setChecked(Object.fromEntries(sheet.map((r) => [r.id, true])))}>
                Select all ({sheet.length})
              </button>
              <span className="text-xs text-gray-400">{selected.length} selected</span>
            </div>
          )}
          {started && !done && (
            <p className="text-xs text-gray-500 mb-3 text-center">
              Sent {cursor} of {selected.length} · WhatsApp opened
            </p>
          )}
          {done && (
            <p className="text-xs text-emerald-600 font-semibold mb-3 text-center">
              ✓ All {selected.length} reminders sent!
            </p>
          )}
          {!done ? (
            <button
              onClick={startOrNext}
              disabled={!selected.length}
              className="w-full py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition flex items-center justify-center gap-2">
              <MessageCircle size={15} />
              {!started ? `Start Sending (${selected.length})` : `Send Next — ${selected[cursor!]?.customerName}`}
            </button>
          ) : (
            <button onClick={onClose}
              className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition">
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function BulkPaymentModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const { data: sheet = [], isLoading } = useQuery({
    queryKey: ['due-sheet'],
    queryFn:  installmentsApi.dueSheet,
    staleTime: 30_000,
  });

  const toggle = (id: string, monthly: number) => {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
    if (!amounts[id]) setAmounts((prev) => ({ ...prev, [id]: String(monthly) }));
  };

  const selected = sheet.filter((r) => checked[r.id]);
  const total    = selected.reduce((s, r) => s + (Number(amounts[r.id]) || r.monthly), 0);

  const mutation = useMutation({
    mutationFn: () => paymentsApi.recordBulk(
      selected.map((r) => ({
        installmentId: r.id,
        amount: Number(amounts[r.id]) || r.monthly,
        method,
      }))
    ),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['installments'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      if (result.failed.length > 0) {
        toast.error(`${result.succeeded} saved, ${result.failed.length} failed`);
      } else {
        toast.success(`${result.succeeded} payment${result.succeeded !== 1 ? 's' : ''} recorded`);
        onClose();
      }
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-0 sm:px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg flex flex-col" style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Bulk Collect</h2>
            <p className="text-xs text-gray-400">Today's overdue/due installments</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        {/* Method selector */}
        <div className="px-5 py-3 border-b border-gray-100 shrink-0">
          <div className="flex gap-1.5 flex-wrap">
            {METHODS.map((m) => (
              <button key={m} onClick={() => setMethod(m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${method === m ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 px-5 py-3 space-y-2">
          {isLoading ? (
            <div className="space-y-2 py-4">
              {[0, 1, 2].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : sheet.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No overdue installments today</p>
          ) : (
            sheet.map((row) => (
              <label key={row.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                checked[row.id] ? 'border-blue-300 bg-blue-50' : 'border-gray-100 hover:border-gray-200'
              }`}>
                <input
                  type="checkbox"
                  checked={!!checked[row.id]}
                  onChange={() => toggle(row.id, row.monthly)}
                  className="accent-blue-600 w-4 h-4 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{row.customerName}</p>
                  <p className="text-xs text-gray-400 truncate">{row.productName}
                    {row.daysOverdue > 0 && <span className="ml-1 text-red-500 font-medium">{row.daysOverdue}d late</span>}
                  </p>
                </div>
                {checked[row.id] ? (
                  <input
                    type="number"
                    value={amounts[row.id] ?? row.monthly}
                    onChange={(e) => setAmounts((prev) => ({ ...prev, [row.id]: e.target.value }))}
                    onClick={(e) => e.preventDefault()}
                    className="w-24 border border-blue-200 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min={1}
                  />
                ) : (
                  <span className="text-sm font-medium text-gray-600 shrink-0">PKR {row.monthly.toLocaleString('en-PK')}</span>
                )}
              </label>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-400">{selected.length} selected</span>
            <span className="text-sm font-bold text-gray-900">Total: PKR {total.toLocaleString('en-PK')}</span>
          </div>
          <button
            onClick={() => mutation.mutate()}
            disabled={!selected.length || mutation.isPending}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition">
            {mutation.isPending ? <><Loader2 size={14} className="animate-spin inline mr-1" />Processing…</> : `Record ${selected.length} Payment${selected.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InstallmentsPage() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.role === 'SELLER_OWNER';
  const staffPerms = user?.permissions as Record<string, boolean> | null | undefined;
  const canPay = isOwner || !!staffPerms?.canRecordPayment;
  const canCreate = isOwner || !!staffPerms?.canAddInstallment;
  const [showForm,   setShowForm]   = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showReminders, setShowReminders] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [frequencyFilter, setFrequencyFilter] = useState('');
  const [sortBy,  setSortBy]  = useState('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [search, setSearch] = useState('');

  function toggleSort(col: string) {
    if (sortBy === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(col); setSortDir('desc'); }
    setPage(1);
  }

  function SortIcon({ col }: { col: string }) {
    if (sortBy !== col) return <ArrowUpDown size={11} className="text-gray-300 shrink-0" />;
    return sortDir === 'asc'
      ? <ChevronUp size={11} className="text-blue-600 shrink-0" />
      : <ChevronDown size={11} className="text-blue-600 shrink-0" />;
  }
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search, 350);
  const [committedSearch, setCommittedSearch] = useState('');

  // Short queries (names, partial phones < 10 chars) auto-commit as you type.
  // Long digit strings (full phone / CNIC) require Enter or the Search button.
  useEffect(() => {
    if (debouncedSearch.replace(/-/g, '').length < 10) {
      setCommittedSearch(debouncedSearch);
    }
  }, [debouncedSearch]);

  function submitSearch() {
    setCommittedSearch(search.trim());
    setPage(1);
  }

  const [payInst, setPayInst] = useState<Installment | null>(null);
  const [rescheduleInst, setRescheduleInst] = useState<Installment | null>(null);
  const [waiverInst, setWaiverInst] = useState<Installment | null>(null);
  const [pauseInst, setPauseInst] = useState<Installment | null>(null);
  const [showBulk, setShowBulk] = useState(false);
  const [showBatchReminder, setShowBatchReminder] = useState(false);
  const [waPickerInst, setWaPickerInst] = useState<Installment | null>(null);
  const [recoveryInst, setRecoveryInst] = useState<Installment | null>(null);
  const [scheduleInst, setScheduleInst] = useState<Installment | null>(null);
  const [editInst, setEditInst] = useState<Installment | null>(null);
  const [jazzCashInst, setJazzCashInst] = useState<Installment | null>(null);
  const [repoInst, setRepoInst] = useState<Installment | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [approveConfirm, setApproveConfirm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [defaultConfirm, setDefaultConfirm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [closeConfirm,   setCloseConfirm]   = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [cancelConfirm,  setCancelConfirm]  = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [deleteConfirm,  setDeleteConfirm]  = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  const { data: shopData } = useQuery({ queryKey: ['shop-me'], queryFn: sellersApi.getMe });
  const { data: paymentAccountsData = [] } = useQuery<PaymentAccount[]>({ queryKey: ['payment-accounts'], queryFn: sellersApi.listPaymentAccounts, staleTime: 10 * 60_000 });

  const LIMIT = 20;

  // Staff must search first — don't load all installments by default
  const staffMustSearch = !isOwner && committedSearch.trim().length < 2;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['installments', statusFilter, frequencyFilter, committedSearch, page, sortBy, sortDir],
    queryFn: () => installmentsApi.list({ status: statusFilter || undefined, frequency: frequencyFilter || undefined, search: committedSearch || undefined, page, limit: LIMIT, sortBy, sortDir }),
    enabled: !staffMustSearch,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  // Full list invalidation — only used for create & bulk import (new items, unknown sort position)
  const invalidate = () => qc.invalidateQueries({ queryKey: ['installments'] });

  // Update a single installment in every cached list page + single-detail cache
  type ListCache = { data: Installment[]; total: number; page: number; limit: number };
  function patchListCache(updated: Installment) {
    qc.setQueriesData<ListCache>(
      { queryKey: ['installments'], exact: false },
      (cached) => {
        if (!cached?.data) return cached;
        return { ...cached, data: cached.data.map((i) => i.id === updated.id ? updated : i) };
      },
    );
    qc.setQueryData(['installment-single', updated.id], updated);
  }

  // Optimistic status change: cancel in-flight, snapshot, patch status, return context for rollback
  async function optimisticStatus(id: string, status: InstallmentStatus) {
    await qc.cancelQueries({ queryKey: ['installment-single', id] });
    const prevSingle = qc.getQueryData<Installment>(['installment-single', id]);
    const prevLists = qc.getQueriesData<ListCache>({ queryKey: ['installments'], exact: false });
    qc.setQueryData<Installment>(['installment-single', id], (old) => old ? { ...old, status } : old);
    qc.setQueriesData<ListCache>({ queryKey: ['installments'], exact: false }, (cached) => {
      if (!cached?.data) return cached;
      return { ...cached, data: cached.data.map((i) => i.id === id ? { ...i, status } : i) };
    });
    return { prevSingle, prevLists };
  }

  type OptCtx = Awaited<ReturnType<typeof optimisticStatus>>;
  function rollbackStatus(id: string, ctx: OptCtx | undefined) {
    if (ctx?.prevSingle !== undefined) qc.setQueryData(['installment-single', id], ctx.prevSingle);
    if (ctx?.prevLists) for (const [key, val] of ctx.prevLists) qc.setQueryData(key, val);
  }

  useEffect(() => {
    const close = () => { setOpenMenu(null); setMenuPos(null); };
    const onMouse = (e: MouseEvent) => {
      if (!(e.target as Element).closest('[data-menu]')) close();
    };
    document.addEventListener('mousedown', onMouse);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('mousedown', onMouse);
      window.removeEventListener('scroll', close, true);
    };
  }, []);

  const createMutation = useMutation({
    mutationFn: installmentsApi.create,
    // Full invalidation — new item needs correct sort position + total count update
    onSuccess: () => { void invalidate(); setShowForm(false); toast.success('Installment created'); },
    onError: (e) => toast.error(getErrorMessage(e, 'Failed to create installment')),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => installmentsApi.approve(id),
    onMutate: (id) => optimisticStatus(id, 'ACTIVE'),
    // API returns updated Installment — confirm with real server data
    onSuccess: (updated) => { patchListCache(updated); toast.success('Installment approved'); },
    onError: (e, id, ctx) => { rollbackStatus(id, ctx); toast.error(getErrorMessage(e, 'Failed to approve')); },
  });

  const closeMutation = useMutation({
    mutationFn: (id: string) => installmentsApi.close(id),
    onMutate: (id) => optimisticStatus(id, 'CLOSED'),
    onSuccess: (updated) => { patchListCache(updated); toast.success('Installment closed'); },
    onError: (e, id, ctx) => { rollbackStatus(id, ctx); toast.error(getErrorMessage(e, 'Failed to close')); },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => installmentsApi.cancel(id),
    onMutate: (id) => optimisticStatus(id, 'CANCELLED'),
    onSuccess: (updated) => { patchListCache(updated); toast.success('Installment cancelled'); },
    onError: (e, id, ctx) => { rollbackStatus(id, ctx); toast.error(getErrorMessage(e, 'Failed to cancel')); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => installmentsApi.remove(id),
    onSuccess: (_, id) => {
      // Remove from every cached list page + update total count
      qc.setQueriesData<ListCache>(
        { queryKey: ['installments'], exact: false },
        (cached) => {
          if (!cached?.data) return cached;
          return { ...cached, data: cached.data.filter((i) => i.id !== id), total: Math.max(0, cached.total - 1) };
        },
      );
      qc.removeQueries({ queryKey: ['installment-single', id] });
      toast.success('Installment deleted');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Failed to delete')),
  });

  const defaultMutation = useMutation({
    mutationFn: (id: string) => installmentsApi.markDefault(id),
    onMutate: (id) => optimisticStatus(id, 'DEFAULTED'),
    onSuccess: (updated) => { patchListCache(updated); toast.success('Marked as defaulted'); },
    onError: (e, id, ctx) => { rollbackStatus(id, ctx); toast.error(getErrorMessage(e)); },
  });

  return (
    <div className="px-4 py-5 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Installments</h1>
          <p className="text-sm text-gray-500 mt-0.5">{data?.total ?? 0} total</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowReminders(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm rounded-lg transition">
            <MessageCircle size={14} /> Reminders
          </button>
          <button
            disabled={isExporting}
            onClick={async () => {
              setIsExporting(true);
              try {
                const result = await installmentsApi.exportAll({
                  status: statusFilter || undefined,
                  frequency: frequencyFilter || undefined,
                  search: committedSearch || undefined,
                });
                const csv = buildCSV(result.data);
                const a = document.createElement('a');
                a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
                a.download = `installments-${new Date().toISOString().slice(0, 10)}.csv`;
                a.click();
              } finally {
                setIsExporting(false);
              }
            }}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm rounded-lg transition disabled:opacity-50">
            {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Export CSV
          </button>
          <button
            onClick={() => window.open('/due-sheet', '_blank')}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm rounded-lg transition"
            title="Print today's field collection sheet"
          >
            <Printer size={14} /> Field Sheet
          </button>
          {canPay && (
            <button
              onClick={() => setShowBulk(true)}
              className="flex items-center gap-1.5 px-3 py-2 border border-blue-200 text-blue-600 hover:bg-blue-50 text-sm rounded-lg transition font-medium"
              title="Record multiple payments at once"
            >
              <Layers size={14} /> Bulk Collect
            </button>
          )}
          <button
            onClick={() => setShowBatchReminder(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-green-200 text-green-700 hover:bg-green-50 text-sm rounded-lg transition font-medium"
            title="Send WhatsApp reminders to overdue customers"
          >
            <MessageCircle size={14} /> Reminders
          </button>
          {isOwner && (
            <button onClick={() => setShowImport(true)}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm rounded-lg transition">
              <Upload size={14} />
              Import
            </button>
          )}
          {canCreate && (
            <button onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition">
              + New installment
            </button>
          )}
        </div>
      </div>

      {/* Filter row */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              placeholder={isOwner ? 'Name, phone, or CNIC…' : 'Naam, phone ya CNIC…'}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              onKeyDown={(e) => { if (e.key === 'Enter') submitSearch(); }}
              className={`w-52 sm:w-64 pl-3 ${search ? 'pr-7' : 'pr-3'} py-2 border rounded-lg text-sm outline-none focus:ring-1 transition ${
                !isOwner && staffMustSearch
                  ? 'border-blue-300 ring-1 ring-blue-200 bg-blue-50/40'
                  : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
              }`}
              autoFocus={!isOwner}
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
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => { setFrequencyFilter(frequencyFilter === 'daily' ? '' : 'daily'); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
              frequencyFilter === 'daily'
                ? 'bg-orange-500 border-orange-500 text-white'
                : 'border-orange-200 text-orange-600 bg-orange-50 hover:bg-orange-100'
            }`}>
            Daily
          </button>
          <div className="w-px bg-gray-200 mx-1 self-stretch" />
          {STATUS_FILTERS.map((f) => (
            <button key={f.value}
              onClick={() => { setStatusFilter(f.value); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-sm transition ${
                statusFilter === f.value
                  ? 'bg-blue-600 text-white font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {staffMustSearch ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
              <CreditCard size={26} className="text-blue-400" />
            </div>
            <p className="text-sm font-semibold text-gray-700 mb-1">Customer search karo</p>
            <p className="text-xs text-gray-400">Naam ya phone number likhو, ya pura CNIC (13 ہندسے بغیر dashes) — installments dikhein gi</p>
          </div>
        ) : isLoading ? (
          <TableSkeleton rows={5} cols={7} />
        ) : isError ? (
          <div className="p-8 text-center text-sm text-red-500">Failed to load installments.</div>
        ) : !data?.data.length ? (
          <EmptyState
            icon={<CreditCard size={32} />}
            title="No installments found"
            action={canCreate ? (
              <button onClick={() => setShowForm(true)}
                className="px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-xl hover:bg-blue-700 transition">
                Create one
              </button>
            ) : undefined}
          />
        ) : (
          <>
            {/* ── Mobile card list (< md) ─────────────────────────────────── */}
            <div className="md:hidden divide-y divide-gray-100">
              {data.data.map((inst: Installment) => {
                const nextDue  = calcNextDueDate(inst);
                const overdue  = nextDue && nextDue < new Date();
                const isDaily  = inst.paymentFrequency === 'daily';
                const daysLate = overdue && nextDue
                  ? Math.floor((new Date().getTime() - nextDue.getTime()) / 86_400_000)
                  : 0;
                return (
                  <div key={inst.id} className="p-4">
                    {/* Row 1: name + status + ⋮ */}
                    <div className="flex items-start justify-between mb-1.5">
                      <div className="flex-1 min-w-0 mr-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-semibold text-gray-900 text-sm leading-snug">{inst.customerName}</p>
                          <Badge status={inst.status} paused={!!inst.pausedUntil} />
                          {isDaily && (
                            <span className="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700">Daily</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {inst.customerPhone}
                          {inst.customerArea ? ` · ${inst.customerArea}` : ''}
                        </p>
                      </div>
                      <button
                        data-menu
                        onClick={(e) => {
                          if (openMenu === inst.id) { setOpenMenu(null); setMenuPos(null); return; }
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                          setOpenMenu(inst.id);
                        }}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition shrink-0">
                        <MoreVertical size={16} />
                      </button>
                    </div>

                    {/* Row 2: product */}
                    <p className="text-xs text-gray-600 mb-3">
                      <span className="font-medium">{inst.productName}</span>
                      {inst.imeiNumber && (
                        <span className="text-gray-400 font-mono"> · IMEI: {inst.imeiNumber}</span>
                      )}
                    </p>

                    {/* Row 3: amount chips */}
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="bg-gray-50 rounded-xl px-2 py-2 text-center">
                        <p className="text-[10px] text-gray-400 mb-0.5">Total</p>
                        <p className="text-xs font-bold text-gray-900 leading-snug">{pkr(inst.totalAmount)}</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl px-2 py-2 text-center">
                        <p className="text-[10px] text-gray-400 mb-0.5">{isDaily ? 'Daily' : 'Monthly'}</p>
                        <p className="text-xs font-bold text-gray-900 leading-snug">{pkr(inst.monthly)}</p>
                      </div>
                      <div className={`rounded-xl px-2 py-2 text-center ${Number(inst.remaining) > 0 ? 'bg-orange-50' : 'bg-green-50'}`}>
                        <p className="text-[10px] text-gray-400 mb-0.5">Remaining</p>
                        <p className={`text-xs font-bold leading-snug ${Number(inst.remaining) > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                          {pkr(inst.remaining)}
                        </p>
                      </div>
                    </div>

                    {/* Row 4: next due banner */}
                    {nextDue && (
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl mb-3 text-xs font-medium ${overdue ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${overdue ? 'bg-red-500' : 'bg-blue-500'}`} />
                        <span>{overdue ? 'Overdue since' : 'Due'}: {fmtDate(nextDue)}</span>
                        {overdue && <span className="ml-auto font-semibold">{daysLate}d late</span>}
                      </div>
                    )}

                    {/* Row 5: action buttons */}
                    <div className="flex items-center gap-2">
                      {inst.status === 'PENDING' && isOwner && (
                        <button
                          onClick={() => setApproveConfirm({ open: true, id: inst.id })}
                          className="flex-1 py-2 bg-green-600 text-white text-xs rounded-xl font-medium hover:bg-green-700 transition">
                          Approve
                        </button>
                      )}
                      {inst.status === 'ACTIVE' && canPay && (
                        <button
                          onClick={() => setPayInst(inst)}
                          className="flex-1 py-2 bg-blue-600 text-white text-xs rounded-xl font-medium hover:bg-blue-700 transition">
                          Record Payment
                        </button>
                      )}
                      <button
                        onClick={() => shopData && void openBill({
                          shop: shopData,
                          customer: { name: inst.customerName, phone: inst.customerPhone, area: inst.customerArea },
                          product: inst.productName,
                          totalAmount: inst.totalAmount, downPayment: inst.downPayment,
                          monthly: inst.monthly, months: inst.months, remaining: inst.remaining,
                          status: inst.status, startDate: inst.startDate, installmentId: inst.id,
                          invoiceNumber: inst.invoiceNumber, imeiNumber: inst.imeiNumber,
                          cashPrice: inst.cashPrice, profitMarkup: inst.profitMarkup,
                          murabahaMode: shopData.murabahaMode, paymentFrequency: inst.paymentFrequency,
                          paymentAccounts: paymentAccountsData,
                        })}
                        className="p-2 text-gray-400 hover:text-indigo-600 transition rounded-xl border border-gray-100">
                        <FileText size={15} />
                      </button>
                      {inst.status === 'ACTIVE' && shopData && (
                        <button
                          onClick={() => setWaPickerInst(inst)}
                          className="p-2 text-gray-400 hover:text-green-600 transition rounded-xl border border-gray-100">
                          <MessageCircle size={15} />
                        </button>
                      )}
                      {inst.status === 'ACTIVE' && isOwner && (
                        <button
                          onClick={() => setJazzCashInst(inst)}
                          title="JazzCash payment link"
                          className="p-2 text-gray-400 hover:text-green-600 transition rounded-xl border border-gray-100">
                          <Link2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Desktop table (≥ md) ────────────────────────────────────── */}
            <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th onClick={() => toggleSort('customerName')}
                    className="text-left px-4 py-3 font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none whitespace-nowrap">
                    <span className="flex items-center gap-1">Customer <SortIcon col="customerName" /></span>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Product</th>
                  <th onClick={() => toggleSort('totalAmount')}
                    className="text-right px-4 py-3 font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none whitespace-nowrap">
                    <span className="flex items-center gap-1 justify-end">Total <SortIcon col="totalAmount" /></span>
                  </th>
                  <th onClick={() => toggleSort('monthly')}
                    className="text-right px-4 py-3 font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none whitespace-nowrap">
                    <span className="flex items-center gap-1 justify-end">Periodic <SortIcon col="monthly" /></span>
                  </th>
                  <th onClick={() => toggleSort('remaining')}
                    className="text-right px-4 py-3 font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none whitespace-nowrap">
                    <span className="flex items-center gap-1 justify-end">Remaining <SortIcon col="remaining" /></span>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Next Due</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.data.map((inst: Installment) => (
                  <tr key={inst.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{inst.customerName}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="text-xs text-gray-400">{inst.customerPhone}</p>
                        {inst.paymentFrequency === 'daily' && (
                          <span className="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700">Daily</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-700">{inst.productName}</p>
                      {inst.imeiNumber && (
                        <p className="text-[11px] text-gray-400 font-mono mt-0.5">IMEI: {inst.imeiNumber}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">{pkr(inst.totalAmount)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-medium text-gray-900">{pkr(inst.monthly)}</span>
                      <p className="text-[10px] text-gray-400">{inst.paymentFrequency === 'daily' ? '/day' : '/mo'}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={Number(inst.remaining) > 0 ? 'text-orange-600 font-medium' : 'text-green-600 font-medium'}>
                        {pkr(inst.remaining)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {(() => {
                        const d = calcNextDueDate(inst);
                        if (!d) return <span className="text-gray-300">—</span>;
                        const now2 = new Date();
                        const isOverdue = d < now2;
                        const daysLate = isOverdue ? Math.floor((now2.getTime() - d.getTime()) / 86_400_000) : 0;
                        return (
                          <span className={isOverdue ? 'text-red-600 font-medium' : 'text-gray-600'}>
                            {fmtDate(d)}
                            {isOverdue && (
                              <span className="ml-1 text-[10px] bg-red-100 text-red-600 px-1 rounded">
                                {daysLate}d late
                              </span>
                            )}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge status={inst.status} paused={!!inst.pausedUntil} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {inst.status === 'PENDING' && isOwner && (
                          <button
                            onClick={() => setApproveConfirm({ open: true, id: inst.id })}
                            className="px-2.5 py-1 bg-green-600 text-white text-xs rounded-lg font-medium hover:bg-green-700 transition">
                            Approve
                          </button>
                        )}
                        {inst.status === 'ACTIVE' && canPay && (
                          <button
                            onClick={() => setPayInst(inst)}
                            className="px-2.5 py-1 bg-blue-600 text-white text-xs rounded-lg font-medium hover:bg-blue-700 transition">
                            Pay
                          </button>
                        )}
                        <button
                          onClick={() => shopData && void openBill({
                            shop: shopData,
                            customer: { name: inst.customerName, phone: inst.customerPhone, area: inst.customerArea },
                            product: inst.productName,
                            totalAmount: inst.totalAmount, downPayment: inst.downPayment,
                            monthly: inst.monthly, months: inst.months, remaining: inst.remaining,
                            status: inst.status, startDate: inst.startDate, installmentId: inst.id,
                            invoiceNumber: inst.invoiceNumber, imeiNumber: inst.imeiNumber,
                            cashPrice: inst.cashPrice, profitMarkup: inst.profitMarkup,
                            murabahaMode: shopData.murabahaMode, paymentFrequency: inst.paymentFrequency,
                            paymentAccounts: paymentAccountsData,
                          })}
                          title="Bill"
                          className="p-2 text-gray-400 hover:text-indigo-600 transition rounded">
                          <FileText size={14} />
                        </button>
                        {inst.status === 'ACTIVE' && shopData && (
                          <button
                            onClick={() => setWaPickerInst(inst)}
                            title="WhatsApp reminder"
                            className="p-2 text-gray-400 hover:text-green-600 transition rounded">
                            <MessageCircle size={14} />
                          </button>
                        )}
                        {inst.status === 'ACTIVE' && isOwner && (
                          <button
                            onClick={() => setJazzCashInst(inst)}
                            title="JazzCash payment link"
                            className="p-2 text-gray-400 hover:text-green-600 transition rounded">
                            <Link2 size={14} />
                          </button>
                        )}
                        <button
                          data-menu
                          onClick={(e) => {
                            if (openMenu === inst.id) { setOpenMenu(null); setMenuPos(null); return; }
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                            setOpenMenu(inst.id);
                          }}
                          className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition">
                          <MoreVertical size={15} />
                        </button>
                      </div>
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
      {data && data.total > LIMIT && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">
            Showing {(page - 1) * LIMIT + 1}â€"{Math.min(page * LIMIT, data.total)} of {data.total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition disabled:opacity-40 disabled:cursor-not-allowed">
              Previous
            </button>
            <span className="text-sm text-gray-600 font-medium">
              {page} / {Math.ceil(data.total / LIMIT)}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page * LIMIT >= data.total}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition disabled:opacity-40 disabled:cursor-not-allowed">
              Next
            </button>
          </div>
        </div>
      )}

      {/* â‹® actions dropdown â€" portal so it escapes table overflow-hidden */}
      {(() => {
        const inst = data?.data.find((i) => i.id === openMenu);
        if (!openMenu || !inst || !menuPos) return null;
        const close = () => { setOpenMenu(null); setMenuPos(null); };
        return createPortal(
          <div
            data-menu
            style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 9999 }}
            className="bg-white border border-gray-100 rounded-xl shadow-xl w-44 py-1 overflow-hidden"
          >
            {inst.status !== 'CANCELLED' && inst.status !== 'CLOSED' && (
              <button onClick={() => { close(); setScheduleInst(inst); }}
                className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition">
                View Schedule
              </button>
            )}
            <button
              onClick={() => { close(); window.open(`/agreement/${inst.id}`, '_blank'); }}
              className="w-full text-left px-3 py-2 text-xs text-indigo-700 hover:bg-indigo-50 transition font-medium flex items-center gap-1.5"
            >
              <FileText size={11} className="shrink-0" /> Agreement (Iqrarnama)
            </button>
            {inst.status !== 'ACTIVE' && inst.status !== 'PENDING' && (
              <button onClick={() => { close(); setPayInst(inst); }}
                className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition">
                History
              </button>
            )}
            {(inst.status === 'ACTIVE' || inst.status === 'DEFAULTED') && isOwner && (
              <button onClick={() => { close(); setRescheduleInst(inst); }}
                className="w-full text-left px-3 py-2 text-xs text-indigo-600 hover:bg-indigo-50 transition">
                Reschedule
              </button>
            )}
            {(inst.status === 'ACTIVE' || inst.status === 'DEFAULTED') && isOwner && (
              <button onClick={() => { close(); setWaiverInst(inst); }}
                className="w-full text-left px-3 py-2 text-xs text-amber-600 hover:bg-amber-50 transition">
                Balance Waiver
              </button>
            )}
            {inst.status === 'ACTIVE' && isOwner && (
              <button onClick={() => { close(); setPauseInst(inst); }}
                className="w-full text-left px-3 py-2 text-xs text-orange-600 hover:bg-orange-50 transition">
                {inst.pausedUntil ? 'Manage Pause' : 'Pause Installment'}
              </button>
            )}
            {(inst.status === 'ACTIVE' || inst.status === 'DEFAULTED') && (
              <button onClick={() => { close(); setRecoveryInst(inst); }}
                className="w-full text-left px-3 py-2 text-xs text-violet-600 hover:bg-violet-50 transition">
                Recovery
              </button>
            )}
            {(inst.status === 'ACTIVE' || inst.status === 'DEFAULTED') && isOwner && (
              <button onClick={() => { close(); setRepoInst(inst); }}
                className="w-full text-left px-3 py-2 text-xs text-red-700 hover:bg-red-50 transition font-medium">
                Repossess Device
              </button>
            )}
            {(inst.status === 'ACTIVE' || inst.status === 'DEFAULTED') && isOwner && (() => {
              const dueDate  = calcNextDueDate(inst);
              const _now     = new Date();
              const daysLate = dueDate ? Math.max(0, Math.floor((_now.getTime() - dueDate.getTime()) / 86_400_000)) : (inst.status === 'DEFAULTED' ? 30 : 0);
              if (daysLate < 30 && inst.status !== 'DEFAULTED') return null;
              return (
                <button
                  onClick={() => {
                    close();
                    if (!shopData) return;
                    openLegalNotice({
                      shop: { shopName: shopData.shopName, phone: shopData.phone, address: shopData.address },
                      customer: { name: inst.customerName, phone: inst.customerPhone, area: inst.customerArea },
                      product: inst.productName,
                      imeiNumber: inst.imeiNumber,
                      totalAmount: inst.totalAmount,
                      downPayment: inst.downPayment,
                      remaining: inst.remaining,
                      invoiceNumber: inst.invoiceNumber,
                      startDate: inst.startDate,
                      daysOverdue: daysLate,
                    });
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition font-medium"
                >
                  Legal Notice (Print)
                </button>
              );
            })()}
            {inst.status === 'ACTIVE' && isOwner && (
              <button onClick={() => { close(); setDefaultConfirm({ open: true, id: inst.id }); }}
                className="w-full text-left px-3 py-2 text-xs text-orange-600 hover:bg-orange-50 transition">
                Mark Default
              </button>
            )}
            {(inst.status === 'COMPLETED' || inst.status === 'DEFAULTED') && isOwner && (
              <button onClick={() => { close(); setCloseConfirm({ open: true, id: inst.id }); }}
                className="w-full text-left px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 transition">
                Close
              </button>
            )}
            {isOwner && (
              <button onClick={() => { close(); setEditInst(inst); }}
                className="w-full text-left px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 transition">
                Edit
              </button>
            )}
            {(inst.status === 'PENDING' || inst.status === 'ACTIVE') && isOwner && (
              <button onClick={() => { close(); setCancelConfirm({ open: true, id: inst.id }); }}
                className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition">
                Cancel
              </button>
            )}
            {isOwner && (
              <button onClick={() => { close(); setDeleteConfirm({ open: true, id: inst.id }); }}
                className="w-full text-left px-3 py-2 text-xs text-red-700 hover:bg-red-50 transition font-medium">
                Delete
              </button>
            )}
          </div>,
          document.body,
        );
      })()}

      {/* Create modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex flex-col sm:items-center sm:justify-center bg-black/50 backdrop-blur-sm sm:p-4">
          <div className="flex-1 sm:flex-none flex flex-col w-full sm:max-w-lg sm:max-h-[calc(100vh-2rem)] bg-white sm:rounded-2xl sm:shadow-2xl overflow-hidden">
            {isOwner ? (
              <>
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
                  <h2 className="text-base font-semibold text-gray-900">New installment</h2>
                  <button onClick={() => setShowForm(false)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
                    <X size={16} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-4">
                  {createMutation.error instanceof Error && (
                    <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      <p className="text-sm text-red-600">{createMutation.error.message}</p>
                    </div>
                  )}
                  <InstallmentForm
                    isPending={createMutation.isPending}
                    onCancel={() => setShowForm(false)}
                    onSubmit={(data) => createMutation.mutate(data)}
                    murabahaMode={shopData?.murabahaMode ?? false}
                  />
                </div>
              </>
            ) : (
              <CnicInstallmentFlow
                isPending={createMutation.isPending}
                onClose={() => setShowForm(false)}
                onSubmit={(data) => createMutation.mutate(data)}
                murabahaMode={shopData?.murabahaMode ?? false}
                error={createMutation.error instanceof Error ? createMutation.error.message : null}
              />
            )}
          </div>
        </div>
      )}

      {/* Payment modal */}
      {payInst && <PaymentModal inst={payInst} onClose={() => setPayInst(null)} />}

      {/* Reschedule modal */}
      {rescheduleInst && <RescheduleModal inst={rescheduleInst} onClose={() => setRescheduleInst(null)} />}
      {waiverInst && <WaiverModal inst={waiverInst} onClose={() => setWaiverInst(null)} />}
      {pauseInst && <PauseModal inst={pauseInst} onClose={() => setPauseInst(null)} />}
      {showBulk && <BulkPaymentModal onClose={() => setShowBulk(false)} />}
      {showBatchReminder && <BatchReminderModal shopName={shopData?.shopName ?? 'Our Shop'} onClose={() => setShowBatchReminder(false)} />}
      {waPickerInst && shopData && (
        <TemplatePickerModal inst={waPickerInst} shopName={shopData.shopName} onClose={() => setWaPickerInst(null)} />
      )}

      {/* Recovery drawer */}
      {recoveryInst && <RecoveryDrawer inst={recoveryInst} onClose={() => setRecoveryInst(null)} />}

      {/* JazzCash payment link modal */}
      {jazzCashInst && <JazzCashLinkModal inst={jazzCashInst} onClose={() => setJazzCashInst(null)} />}

      {/* Repossess device modal */}
      {repoInst && <RepossessModal inst={repoInst} onClose={() => setRepoInst(null)} />}

      {/* Schedule modal */}
      {scheduleInst && <ScheduleModal inst={scheduleInst} shopName={shopData?.shopName} onClose={() => setScheduleInst(null)} />}

      {/* Bulk reminder modal */}
      {showReminders && <BulkReminderModal onClose={() => setShowReminders(false)} />}

      {/* Edit modal */}
      {editInst && (
        <EditInstallmentModal
          inst={editInst}
          onClose={() => setEditInst(null)}
          onSaved={() => { invalidate(); setEditInst(null); }}
        />
      )}

      {/* Import modal */}
      {showImport && (
        <ImportInstallmentsModal
          onClose={() => setShowImport(false)}
          onImported={() => {
            invalidate();
            void qc.invalidateQueries({ queryKey: ['customers'] });
            void qc.invalidateQueries({ queryKey: ['customers-lifecycle-counts'] });
            setShowImport(false);
          }}
        />
      )}

      <ConfirmDialog
        open={approveConfirm.open}
        title="Installment Approve Karo?"
        description="Approve karne ke baad customer active ho jaega aur payments shuru ho jaen gi."
        confirmLabel="Approve Karo"
        variant="info"
        isPending={approveMutation.isPending}
        onConfirm={() => { if (approveConfirm.id) approveMutation.mutate(approveConfirm.id); setApproveConfirm({ open: false, id: null }); }}
        onCancel={() => setApproveConfirm({ open: false, id: null })}
      />
      <ConfirmDialog
        open={defaultConfirm.open}
        title="Default Mark Karo?"
        description="Is installment ko defaulted mark kar diya jaega. Customer ko warning flag mil jaegi."
        confirmLabel="Default Mark Karo"
        variant="warning"
        isPending={defaultMutation.isPending}
        onConfirm={() => { if (defaultConfirm.id) defaultMutation.mutate(defaultConfirm.id); setDefaultConfirm({ open: false, id: null }); }}
        onCancel={() => setDefaultConfirm({ open: false, id: null })}
      />
      <ConfirmDialog
        open={closeConfirm.open}
        title="Installment Close Karo?"
        description="Is installment ko permanently archive kar diya jaega. Ye action undo nahi ho sakta."
        confirmLabel="Close Karo"
        variant="warning"
        isPending={closeMutation.isPending}
        onConfirm={() => { if (closeConfirm.id) closeMutation.mutate(closeConfirm.id); setCloseConfirm({ open: false, id: null }); }}
        onCancel={() => setCloseConfirm({ open: false, id: null })}
      />
      <ConfirmDialog
        open={cancelConfirm.open}
        title="Installment Cancel Karo?"
        description="Is installment ko cancel kar diya jaega. Customer ki baqi payments nahi li jaen gi."
        confirmLabel="Cancel Karo"
        variant="danger"
        isPending={cancelMutation.isPending}
        onConfirm={() => { if (cancelConfirm.id) cancelMutation.mutate(cancelConfirm.id); setCancelConfirm({ open: false, id: null }); }}
        onCancel={() => setCancelConfirm({ open: false, id: null })}
      />
      <ConfirmDialog
        open={deleteConfirm.open}
        title="Installment Delete Karo?"
        description="Ye installment aur uski tamam payment history hamesha ke liye delete ho jaegi. Ye action undo nahi ho sakta."
        confirmLabel="Delete Karo"
        variant="danger"
        isPending={deleteMutation.isPending}
        onConfirm={() => { if (deleteConfirm.id) deleteMutation.mutate(deleteConfirm.id); setDeleteConfirm({ open: false, id: null }); }}
        onCancel={() => setDeleteConfirm({ open: false, id: null })}
      />
    </div>
  );
}
