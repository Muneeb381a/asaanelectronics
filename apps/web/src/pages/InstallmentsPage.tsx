import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/auth.store.ts';
import { FileText, MessageCircle, Download, Trash2, MoreVertical, CreditCard } from 'lucide-react';
import { TableSkeleton, RowSkeleton, EmptyState } from '../components/ui/Skeleton.tsx';
import { installmentsApi, type Installment, type InstallmentStatus } from '../api/installments.api.ts';
import { paymentsApi, type PaymentMethod } from '../api/payments.api.ts';
import InstallmentForm from '../features/installments/InstallmentForm.tsx';
import RecoveryDrawer from '../features/installments/RecoveryDrawer.tsx';
import { useDebounce } from '../hooks/useDebounce.ts';
import { sellersApi } from '../api/sellers.api.ts';
import { openBill } from '../utils/bill.ts';
import { openWhatsApp, reminderMessage } from '../utils/whatsapp.ts';

function calcNextDueDate(inst: Installment): Date | null {
  if (inst.status !== 'ACTIVE') return null;
  const down = Number(inst.downPayment);
  const rem  = Number(inst.remaining);
  const mon  = Number(inst.monthly);
  const tot  = Number(inst.totalAmount);
  if (mon <= 0) return null;
  const paidAmount = (tot - down) - rem;
  const monthsPaid = Math.max(0, Math.floor(paidAmount / mon + 0.001));
  const d = new Date(inst.startDate);
  d.setMonth(d.getMonth() + monthsPaid + 1);
  return d;
}

function exportCSV(rows: Installment[]) {
  const header = ['Customer', 'Phone', 'Product', 'Total (PKR)', 'Down Payment', 'Monthly', 'Remaining', 'Status', 'Start Date', 'Next Due'];
  const body = rows.map((i) => {
    const next = calcNextDueDate(i);
    return [
      i.customerName, i.customerPhone, i.productName,
      i.totalAmount, i.downPayment, i.monthly, i.remaining, i.status,
      new Date(i.startDate).toLocaleDateString('en-PK'),
      next ? next.toLocaleDateString('en-PK') : '',
    ].map((v) => `"${v}"`).join(',');
  });
  const csv = [header.join(','), ...body].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `installments-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
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

const METHODS: PaymentMethod[] = ['CASH', 'BANK', 'JAZZCASH', 'EASYPAISA', 'OTHER'];

function pkr(v: string | number) {
  return 'PKR ' + Number(v).toLocaleString('en-PK', { maximumFractionDigits: 0 });
}

function Badge({ status }: { status: InstallmentStatus }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status]}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

function PaymentModal({ inst, onClose }: { inst: Installment; onClose: () => void }) {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.role === 'SELLER_OWNER';
  const [amount, setAmount] = useState(String(Number(inst.monthly)));
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [note, setNote] = useState('');
  const [tab, setTab] = useState<'pay' | 'history'>('pay');

  const { data: history, isLoading: histLoading } = useQuery({
    queryKey: ['payments', inst.id],
    queryFn: () => paymentsApi.list(inst.id),
    enabled: tab === 'history',
  });

  const mutation = useMutation({
    mutationFn: () => paymentsApi.record({
      installmentId: inst.id,
      amount: Number(amount),
      method,
      note: note.trim() || undefined,
    }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['installments'] });
      qc.invalidateQueries({ queryKey: ['payments', inst.id] });
      toast.success(data.completed ? 'Installment fully paid!' : 'Payment recorded');
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Payment failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => paymentsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['installments'] });
      qc.invalidateQueries({ queryKey: ['payments', inst.id] });
      toast.success('Payment deleted');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to delete'),
  });

  const remaining = Number(inst.remaining);
  const amountNum = Number(amount);
  const amountInvalid = !amount || amountNum <= 0 || amountNum > remaining + 0.01;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{inst.customerName}</h2>
            <p className="text-xs text-gray-400">{inst.productName} · Remaining: {pkr(inst.remaining)}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-gray-100">
          {(['pay', 'history'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-sm capitalize transition border-b-2 -mb-px ${
                tab === t ? 'border-blue-600 text-blue-600 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {t === 'pay' ? 'Record Payment' : 'History'}
            </button>
          ))}
        </div>

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
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">Monthly: {pkr(inst.monthly)} · Max: {pkr(inst.remaining)}</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Method</label>
              <div className="flex flex-wrap gap-1.5">
                {METHODS.map((m) => (
                  <button key={m} onClick={() => setMethod(m)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition ${
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
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={onClose}
                className="flex-1 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
                Cancel
              </button>
              <button
                onClick={() => mutation.mutate()}
                disabled={amountInvalid || mutation.isPending}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50">
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
                  <div key={p.id} className="py-2.5 flex items-center justify-between group">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{pkr(p.amount)}</p>
                      <p className="text-xs text-gray-400">
                        {p.method} · {new Date(p.paidOn).toLocaleDateString('en-PK')}
                        {p.note && ` · ${p.note}`}
                      </p>
                    </div>
                    {isOwner && (
                      <button
                        onClick={() => { if (confirm('Delete this payment? This will restore the remaining balance.')) deleteMutation.mutate(p.id); }}
                        disabled={deleteMutation.isPending}
                        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition disabled:opacity-40">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function RescheduleModal({ inst, onClose }: { inst: Installment; onClose: () => void }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<'months' | 'monthly'>('months');
  const [value, setValue] = useState('');

  const remaining = Number(inst.remaining);

  const preview = useMemo(() => {
    const n = Number(value);
    if (!n || n <= 0) return null;
    if (mode === 'months')  return { months: n,                    monthly: remaining / n };
    if (mode === 'monthly') return { months: Math.ceil(remaining / n), monthly: n };
    return null;
  }, [value, mode, remaining]);

  const mutation = useMutation({
    mutationFn: () => installmentsApi.reschedule(inst.id, mode === 'months'
      ? { newMonths: Number(value) }
      : { newMonthly: Number(value) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['installments'] });
      toast.success('Installment rescheduled');
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
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
          <p className="text-gray-400 text-xs mt-1">Current: {pkr(Number(inst.monthly))} / month · {inst.months} months</p>
        </div>

        <div className="flex gap-1 mb-4 border-b border-gray-100">
          {(['months', 'monthly'] as const).map((m) => (
            <button key={m} onClick={() => { setMode(m); setValue(''); }}
              className={`px-3 py-1.5 text-sm capitalize transition border-b-2 -mb-px ${
                mode === m ? 'border-blue-600 text-blue-600 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {m === 'months' ? 'New Duration' : 'New Monthly'}
            </button>
          ))}
        </div>

        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            {mode === 'months' ? 'New number of months' : 'New monthly amount (PKR)'}
          </label>
          <input
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={mode === 'months' ? 'e.g. 12' : 'e.g. 5000'}
            min={1}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {preview && (
          <div className="bg-gray-50 rounded-xl px-4 py-3 mb-4 grid grid-cols-2 gap-3 text-center">
            <div>
              <p className="text-xs text-gray-400">New monthly</p>
              <p className="font-bold text-gray-900 text-sm">{pkr(preview.monthly)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">New duration</p>
              <p className="font-bold text-gray-900 text-sm">{preview.months} months</p>
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
            {mutation.isPending ? 'Saving…' : 'Confirm Reschedule'}
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
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [payInst, setPayInst] = useState<Installment | null>(null);
  const [rescheduleInst, setRescheduleInst] = useState<Installment | null>(null);
  const [recoveryInst, setRecoveryInst] = useState<Installment | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const { data: shopData } = useQuery({ queryKey: ['shop-me'], queryFn: sellersApi.getMe });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['installments', statusFilter, debouncedSearch],
    queryFn: () => installmentsApi.list({ status: statusFilter || undefined, search: debouncedSearch || undefined }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['installments'] });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element).closest('[data-menu]')) setOpenMenu(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const createMutation = useMutation({
    mutationFn: installmentsApi.create,
    onSuccess: () => { invalidate(); setShowForm(false); toast.success('Installment created'); },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to create installment'),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => installmentsApi.approve(id),
    onSuccess: () => { invalidate(); toast.success('Installment approved'); },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to approve'),
  });

  const closeMutation = useMutation({
    mutationFn: (id: string) => installmentsApi.close(id),
    onSuccess: () => { invalidate(); toast.success('Installment closed'); },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to close'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => installmentsApi.cancel(id),
    onSuccess: () => { invalidate(); toast.success('Installment cancelled'); },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to cancel'),
  });

  const defaultMutation = useMutation({
    mutationFn: (id: string) => installmentsApi.markDefault(id),
    onSuccess: () => { invalidate(); toast.success('Marked as defaulted'); },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Installments</h1>
          <p className="text-sm text-gray-500 mt-0.5">{data?.total ?? 0} total</p>
        </div>
        <div className="flex gap-2">
          {data && data.data.length > 0 && (
            <button onClick={() => exportCSV(data.data)}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm rounded-lg transition">
              <Download size={14} /> Export CSV
            </button>
          )}
          <button onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition">
            + New installment
          </button>
        </div>
      </div>

      {/* Filter row */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by customer name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
        />
        <div className="flex gap-1">
          {STATUS_FILTERS.map((f) => (
            <button key={f.value}
              onClick={() => setStatusFilter(f.value)}
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
        {isLoading ? (
          <TableSkeleton rows={5} cols={7} />
        ) : isError ? (
          <div className="p-8 text-center text-sm text-red-500">Failed to load installments.</div>
        ) : !data?.data.length ? (
          <EmptyState
            icon={<CreditCard size={32} />}
            title="No installments found"
            action={
              <button onClick={() => setShowForm(true)}
                className="px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-xl hover:bg-blue-700 transition">
                Create one
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Customer</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Product</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Monthly</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Remaining</th>
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
                      <p className="text-xs text-gray-400">{inst.customerPhone}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{inst.productName}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{pkr(inst.totalAmount)}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{pkr(inst.monthly)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={Number(inst.remaining) > 0 ? 'text-orange-600 font-medium' : 'text-green-600 font-medium'}>
                        {pkr(inst.remaining)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {(() => {
                        const d = calcNextDueDate(inst);
                        if (!d) return <span className="text-gray-300">—</span>;
                        const isOverdue = d < new Date();
                        return (
                          <span className={isOverdue ? 'text-red-600 font-medium' : 'text-gray-600'}>
                            {d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                            {isOverdue && <span className="ml-1 text-[10px] bg-red-100 text-red-600 px-1 rounded">overdue</span>}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge status={inst.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Primary CTA */}
                        {inst.status === 'PENDING' && isOwner && (
                          <button
                            onClick={() => { if (confirm('Approve this installment?')) approveMutation.mutate(inst.id); }}
                            className="px-2.5 py-1 bg-green-600 text-white text-xs rounded-lg font-medium hover:bg-green-700 transition">
                            Approve
                          </button>
                        )}
                        {inst.status === 'ACTIVE' && (
                          <button
                            onClick={() => setPayInst(inst)}
                            className="px-2.5 py-1 bg-blue-600 text-white text-xs rounded-lg font-medium hover:bg-blue-700 transition">
                            Pay
                          </button>
                        )}
                        {/* Icon buttons */}
                        <button
                          onClick={() => shopData && void openBill({
                            shop: shopData,
                            customer: { name: inst.customerName, phone: inst.customerPhone },
                            product: inst.productName,
                            totalAmount: inst.totalAmount,
                            downPayment: inst.downPayment,
                            monthly: inst.monthly,
                            months: inst.months,
                            remaining: inst.remaining,
                            status: inst.status,
                            startDate: inst.startDate,
                            installmentId: inst.id,
                            invoiceNumber: inst.invoiceNumber,
                          })}
                          title="Bill"
                          className="p-1 text-gray-400 hover:text-indigo-600 transition rounded">
                          <FileText size={14} />
                        </button>
                        {inst.status === 'ACTIVE' && shopData && (
                          <button
                            onClick={() => openWhatsApp(
                              inst.customerPhone,
                              reminderMessage({
                                shopName: shopData.shopName,
                                customerName: inst.customerName,
                                productName: inst.productName,
                                monthly: inst.monthly,
                                remaining: inst.remaining,
                              })
                            )}
                            title="WhatsApp reminder"
                            className="p-1 text-gray-400 hover:text-green-600 transition rounded">
                            <MessageCircle size={14} />
                          </button>
                        )}
                        {/* ⋮ dropdown */}
                        <div data-menu className="relative">
                          <button
                            onClick={() => setOpenMenu(openMenu === inst.id ? null : inst.id)}
                            className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 transition">
                            <MoreVertical size={15} />
                          </button>
                          {openMenu === inst.id && (
                            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-20 min-w-37.5 py-1 overflow-hidden">
                              {inst.status !== 'ACTIVE' && inst.status !== 'PENDING' && (
                                <button
                                  onClick={() => { setOpenMenu(null); setPayInst(inst); }}
                                  className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition">
                                  History
                                </button>
                              )}
                              {(inst.status === 'ACTIVE' || inst.status === 'DEFAULTED') && isOwner && (
                                <button
                                  onClick={() => { setOpenMenu(null); setRescheduleInst(inst); }}
                                  className="w-full text-left px-3 py-2 text-xs text-indigo-600 hover:bg-indigo-50 transition">
                                  Reschedule
                                </button>
                              )}
                              {(inst.status === 'ACTIVE' || inst.status === 'DEFAULTED') && (
                                <button
                                  onClick={() => { setOpenMenu(null); setRecoveryInst(inst); }}
                                  className="w-full text-left px-3 py-2 text-xs text-violet-600 hover:bg-violet-50 transition">
                                  Recovery
                                </button>
                              )}
                              {inst.status === 'ACTIVE' && isOwner && (
                                <button
                                  onClick={() => { setOpenMenu(null); if (confirm('Mark as defaulted?')) defaultMutation.mutate(inst.id); }}
                                  className="w-full text-left px-3 py-2 text-xs text-orange-600 hover:bg-orange-50 transition">
                                  Mark Default
                                </button>
                              )}
                              {(inst.status === 'COMPLETED' || inst.status === 'DEFAULTED') && isOwner && (
                                <button
                                  onClick={() => { setOpenMenu(null); if (confirm('Archive this installment as closed?')) closeMutation.mutate(inst.id); }}
                                  className="w-full text-left px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 transition">
                                  Close
                                </button>
                              )}
                              {(inst.status === 'PENDING' || inst.status === 'ACTIVE') && isOwner && (
                                <button
                                  onClick={() => { setOpenMenu(null); if (confirm('Cancel this installment?')) cancelMutation.mutate(inst.id); }}
                                  className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition">
                                  Cancel
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}
        >
          <div className="bg-white rounded-xl shadow-lg w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-gray-900 mb-5">New installment</h2>
            {createMutation.error instanceof Error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <p className="text-sm text-red-600">{createMutation.error.message}</p>
              </div>
            )}
            <InstallmentForm
              isPending={createMutation.isPending}
              onCancel={() => setShowForm(false)}
              onSubmit={(data) => createMutation.mutate(data)}
            />
          </div>
        </div>
      )}

      {/* Payment modal */}
      {payInst && <PaymentModal inst={payInst} onClose={() => setPayInst(null)} />}

      {/* Reschedule modal */}
      {rescheduleInst && <RescheduleModal inst={rescheduleInst} onClose={() => setRescheduleInst(null)} />}

      {/* Recovery drawer */}
      {recoveryInst && <RecoveryDrawer inst={recoveryInst} onClose={() => setRecoveryInst(null)} />}
    </div>
  );
}
