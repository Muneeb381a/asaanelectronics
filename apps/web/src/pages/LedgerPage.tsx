import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Wallet, TrendingUp, TrendingDown, BookOpen, Calendar, BarChart3,
  Plus, Trash2, ArrowUpCircle, ArrowDownCircle, X,
  ShieldCheck, AlertTriangle, CheckCircle2, RefreshCw, Clock, Loader2,
} from 'lucide-react';
import { ledgerApi } from '../api/ledger.api.ts';
import { getErrorMessage } from '../utils/error.ts';
import { fmtDateTime } from '../utils/dateFormat.ts';
import { expensesApi, type ExpenseCategory } from '../api/expenses.api.ts';
import { accountingApi } from '../api/accounting.api.ts';
import { reconciliationApi, type Anomaly } from '../api/reconciliation.api.ts';
import { RowSkeleton } from '../components/ui/Skeleton.tsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.tsx';

type Tab = 'balance' | 'cashbook' | 'daily' | 'pl' | 'expenses' | 'journal' | 'accounts' | 'reconcile';

const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'RENT',        label: 'Rent' },
  { value: 'SALARY',      label: 'Salary' },
  { value: 'UTILITY',     label: 'Utility Bills' },
  { value: 'PURCHASE',    label: 'Stock Purchase' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'TRANSPORT',   label: 'Transport' },
  { value: 'OTHER',       label: 'Other' },
];

function fmt(n: number) {
  return `PKR ${n.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

// ── Wallet Balance ────────────────────────────────────────────────────────────
function LedgerError() {
  return <p className="py-10 text-center text-sm text-red-500">Failed to load data. Please try again.</p>;
}

function BalanceTab() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['ledger-balance'], queryFn: ledgerApi.balance, staleTime: 30_000 });

  if (isLoading) return <RowSkeleton rows={3} />;
  if (isError) return <LedgerError />;

  const balance = data?.balance ?? 0;
  const credits = data?.credits ?? 0;
  const debits  = data?.debits  ?? 0;

  return (
    <div className="max-w-xl mx-auto mt-6 space-y-4">
      {/* Main balance card */}
      <div className={`rounded-2xl p-8 text-white text-center ${balance >= 0 ? 'bg-linear-to-br from-blue-600 to-indigo-700' : 'bg-linear-to-br from-red-500 to-rose-700'}`}>
        <p className="text-sm font-medium opacity-80 mb-1">Shop Wallet Balance</p>
        <p className="text-4xl font-bold tracking-tight">{fmt(balance)}</p>
        <p className="text-sm opacity-70 mt-2">All time · money in minus money out</p>
      </div>

      {/* Credit / Debit split */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-green-100 rounded-xl flex items-center justify-center">
              <ArrowUpCircle size={16} className="text-green-600" />
            </div>
            <p className="text-sm font-medium text-gray-600">Total In</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{fmt(credits)}</p>
          <p className="text-xs text-gray-400 mt-1">Payments received</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center">
              <ArrowDownCircle size={16} className="text-red-500" />
            </div>
            <p className="text-sm font-medium text-gray-600">Total Out</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{fmt(debits)}</p>
          <p className="text-xs text-gray-400 mt-1">Expenses paid</p>
        </div>
      </div>
    </div>
  );
}

// ── Cash Book ─────────────────────────────────────────────────────────────────
function CashBookTab() {
  const [from, setFrom] = useState(monthStart());
  const [to,   setTo]   = useState(today());

  const { data: entries = [], isLoading, isError } = useQuery({
    queryKey: ['ledger-cashbook', from, to],
    queryFn: () => ledgerApi.cashBook(from, to, 200),
    staleTime: 30_000,
  });

  const totalIn  = entries.filter((e) => e.type === 'CREDIT').reduce((s, e) => s + Number(e.amount), 0);
  const totalOut = entries.filter((e) => e.type === 'DEBIT').reduce((s,  e) => s + Number(e.amount), 0);

  return (
    <div>
      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </label>
        <div className="ml-auto flex gap-4 text-sm font-medium">
          <span className="text-green-600">+{fmt(totalIn)}</span>
          <span className="text-red-500">-{fmt(totalOut)}</span>
          <span className={`font-bold ${totalIn - totalOut >= 0 ? 'text-blue-700' : 'text-red-600'}`}>= {fmt(totalIn - totalOut)}</span>
        </div>
      </div>

      {isLoading ? <RowSkeleton rows={3} /> : isError ? <LedgerError /> : entries.length === 0 ? (
        <EmptyState message="No transactions in this period" />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs font-semibold uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Description</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {entries.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{e.date.slice(0, 10)}</td>
                  <td className="px-4 py-3 text-gray-900 max-w-xs truncate">{e.description}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                      {e.category}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${e.type === 'CREDIT' ? 'text-green-600' : 'text-red-500'}`}>
                    {e.type === 'CREDIT' ? '+' : '-'}{fmt(Number(e.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Daily Closing ─────────────────────────────────────────────────────────────
function DailyTab() {
  const [date, setDate] = useState(today());

  const { data, isLoading, isError } = useQuery({
    queryKey: ['ledger-daily', date],
    queryFn: () => ledgerApi.daily(date),
    staleTime: 30_000,
  });

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </label>
      </div>

      {isLoading ? <RowSkeleton rows={3} /> : isError ? <LedgerError /> : !data ? null : (
        <div className="space-y-4">
          {/* Summary strip */}
          <div className="grid grid-cols-3 gap-4">
            <SummaryCard label="Money In" value={data.credits} color="green" />
            <SummaryCard label="Money Out" value={data.debits} color="red" />
            <SummaryCard label="Net" value={data.net} color={data.net >= 0 ? 'blue' : 'red'} />
          </div>

          <p className="text-xs text-gray-400">{data.txCount} transaction{data.txCount !== 1 ? 's' : ''} on {data.date}</p>

          {data.entries.length === 0 ? (
            <EmptyState message="No transactions on this date" />
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs font-semibold uppercase tracking-wide">
                    <th className="px-4 py-3 text-left">Description</th>
                    <th className="px-4 py-3 text-left">Category</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.entries.map((e) => (
                    <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-900 max-w-xs truncate">{e.description}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          {e.category}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${e.type === 'CREDIT' ? 'text-green-600' : 'text-red-500'}`}>
                        {e.type === 'CREDIT' ? '+' : '-'}{fmt(Number(e.amount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Profit & Loss ─────────────────────────────────────────────────────────────
function PLTab() {
  const now = new Date();
  const [from, setFrom] = useState(`${now.getFullYear()}-01-01`);
  const [to,   setTo]   = useState(today());

  const { data, isLoading, isError } = useQuery({
    queryKey: ['ledger-pl', from, to],
    queryFn: () => ledgerApi.pl(from, to),
    staleTime: 30_000,
  });

  return (
    <div>
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </label>
      </div>

      {isLoading ? <RowSkeleton rows={3} /> : isError ? <LedgerError /> : !data ? null : (
        <div className="space-y-5">
          {/* Top KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard label="Revenue" value={data.revenue} color="green" />
            <SummaryCard label="Expenses" value={data.expenses} color="red" />
            <SummaryCard label="Net Profit" value={data.profit} color={data.profit >= 0 ? 'blue' : 'red'} />
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-xs text-gray-500 mb-1">Margin</p>
              <p className={`text-2xl font-bold ${data.margin >= 0 ? 'text-blue-700' : 'text-red-600'}`}>{data.margin}%</p>
            </div>
          </div>

          {/* Monthly breakdown */}
          {data.monthly.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
              <div className="px-5 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-900">Monthly Breakdown</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs font-semibold uppercase tracking-wide">
                    <th className="px-4 py-3 text-left">Month</th>
                    <th className="px-4 py-3 text-right">Revenue</th>
                    <th className="px-4 py-3 text-right">Expenses</th>
                    <th className="px-4 py-3 text-right">Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.monthly.map((m) => (
                    <tr key={m.month} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{m.label}</td>
                      <td className="px-4 py-3 text-right text-green-600">{fmt(m.revenue)}</td>
                      <td className="px-4 py-3 text-right text-red-500">{fmt(m.expenses)}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${m.profit >= 0 ? 'text-blue-700' : 'text-red-600'}`}>{fmt(m.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Expense by category */}
          {data.byCategory.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-900">Expenses by Category</p>
              </div>
              <div className="p-4 space-y-3">
                {data.byCategory.map((c) => {
                  const pct = data.expenses > 0 ? (c.total / data.expenses) * 100 : 0;
                  return (
                    <div key={c.category}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-700">{c.category}</span>
                        <span className="font-medium text-gray-900">{fmt(c.total)} <span className="text-gray-400 font-normal">({pct.toFixed(0)}%)</span></span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-red-400 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Expenses Management ───────────────────────────────────────────────────────
function ExpensesTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [from, setFrom] = useState(monthStart());
  const [to,   setTo]   = useState(today());

  const [form, setForm] = useState<{
    category: ExpenseCategory; amount: string; description: string; date: string;
  }>({ category: 'OTHER', amount: '', description: '', date: today() });

  const { data: expenses = [], isLoading, isError } = useQuery({
    queryKey: ['expenses', from, to],
    queryFn: () => expensesApi.list(from, to),
    staleTime: 30_000,
  });

  const invalidateLedger = () => {
    void qc.invalidateQueries({ queryKey: ['expenses'] });
    void qc.invalidateQueries({ queryKey: ['ledger-balance'] });
    void qc.invalidateQueries({ queryKey: ['ledger-cashbook'] });
    void qc.invalidateQueries({ queryKey: ['ledger-daily'] });
    void qc.invalidateQueries({ queryKey: ['ledger-pl'] });
  };

  const createMutation = useMutation({
    mutationFn: () => expensesApi.create({
      category: form.category,
      amount: Number(form.amount),
      description: form.description || undefined,
      date: form.date || undefined,
    }),
    onSuccess: () => {
      invalidateLedger();
      setShowForm(false);
      setForm({ category: 'OTHER', amount: '', description: '', date: today() });
      toast.success('Expense saved');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Failed to save expense')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => expensesApi.remove(id),
    onSuccess: () => { invalidateLedger(); toast.success('Expense deleted'); },
    onError: () => toast.error('Failed to delete expense'),
  });

  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            To
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </label>
          {expenses.length > 0 && (
            <span className="text-sm font-semibold text-red-500">{fmt(totalExpenses)} total</span>
          )}
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={15} /> Add Expense
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-5 relative">
          <button onClick={() => setShowForm(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
          <p className="text-sm font-semibold text-gray-900 mb-4">New Expense</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as ExpenseCategory }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Amount (PKR)</label>
              <input
                type="number" min="1" placeholder="e.g. 5000" autoFocus
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date</label>
              <input
                type="date" value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Description (optional)</label>
              <input
                type="text" placeholder="e.g. Shop rent for May"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 rounded-xl transition-colors">
              Cancel
            </button>
            <button
              onClick={() => createMutation.mutate()}
              disabled={!form.amount || Number(form.amount) <= 0 || createMutation.isPending}
              className="px-5 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
            >
              {createMutation.isPending ? <><Loader2 size={14} className='animate-spin' /> Saving…</> : 'Save Expense'}
            </button>
          </div>
        </div>
      )}

      {isLoading ? <RowSkeleton rows={3} /> : isError ? <LedgerError /> : expenses.length === 0 ? (
        <EmptyState message="No expenses in this period" />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs font-semibold uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">Description</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {expenses.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{e.date.slice(0, 10)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">
                      {e.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{e.description ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-red-500">{fmt(Number(e.amount))}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setDeleteConfirm({ open: true, id: e.id })}
                      disabled={deleteMutation.isPending}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={deleteConfirm.open}
        title="Expense Delete Karo?"
        description="Ye expense ledger se delete ho jaegi aur balance update ho jaega."
        confirmLabel="Delete Karo"
        variant="danger"
        isPending={deleteMutation.isPending}
        onConfirm={() => { if (deleteConfirm.id) deleteMutation.mutate(deleteConfirm.id); setDeleteConfirm({ open: false, id: null }); }}
        onCancel={() => setDeleteConfirm({ open: false, id: null })}
      />
    </div>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────
function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    green: 'text-green-600',
    red:   'text-red-500',
    blue:  'text-blue-700',
  };
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${colorMap[color] ?? 'text-gray-900'}`}>{fmt(value)}</p>
    </div>
  );
}


function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-16 text-gray-400">
      <BookOpen size={32} className="mx-auto mb-3 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ── Journal Entries ───────────────────────────────────────────────────────────
function JournalTab() {
  const [from, setFrom] = useState(monthStart());
  const [to,   setTo]   = useState(today());
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['accounting-journal', from, to, page],
    queryFn: () => accountingApi.listJournal({ from, to, page, limit }),
    staleTime: 30_000,
  });

  const entries = data?.data ?? [];
  const total   = data?.total ?? 0;
  const pages   = Math.ceil(total / limit);

  return (
    <div>
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          From
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          To
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </label>
        {total > 0 && <span className="ml-auto text-xs text-gray-400">{total} entries</span>}
      </div>

      {isLoading ? <RowSkeleton rows={4} /> : isError ? <LedgerError /> : entries.length === 0 ? (
        <EmptyState message="No journal entries in this period" />
      ) : (
        <div className="space-y-3">
          {entries.map((je) => (
            <div key={je.id} className="bg-white border border-gray-100 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-900">{je.memo}</p>
                <div className="flex items-center gap-2">
                  {je.refType && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">{je.refType}</span>
                  )}
                  <span className="text-xs text-gray-400">{fmtDateTime(je.postedAt)}</span>
                </div>
              </div>
              <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 text-left">
                    <th className="pb-1 font-medium">Account</th>
                    <th className="pb-1 font-medium text-right">Debit</th>
                    <th className="pb-1 font-medium text-right">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {je.lines.map((ln, i) => (
                    <tr key={i} className="border-t border-gray-50">
                      <td className="py-1 text-gray-700">{ln.accountCode} — {ln.accountName}</td>
                      <td className="py-1 text-right font-mono text-blue-700">{Number(ln.debit) > 0 ? fmt(Number(ln.debit)) : ''}</td>
                      <td className="py-1 text-right font-mono text-green-600">{Number(ln.credit) > 0 ? fmt(Number(ln.credit)) : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          ))}
          {pages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors">Previous</button>
              <span className="text-sm text-gray-500 px-2">Page {page} of {pages}</span>
              <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages}
                className="px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors">Next</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Trial Balance / Accounts ───────────────────────────────────────────────────
function AccountsTab() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['accounting-balances'],
    queryFn: () => accountingApi.getBalances(),
    staleTime: 30_000,
  });

  if (isLoading) return <RowSkeleton rows={6} />;
  if (isError) return <LedgerError />;
  if (!data) return null;

  const groups: Record<string, typeof data.accounts> = {};
  for (const a of data.accounts) {
    (groups[a.type] ??= []).push(a);
  }
  const typeOrder = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];
  const typeLabel: Record<string, string> = {
    ASSET: 'Assets', LIABILITY: 'Liabilities', EQUITY: 'Equity',
    REVENUE: 'Revenue', EXPENSE: 'Expenses',
  };

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="Cash"        value={data.cash}        color="blue" />
        <SummaryCard label="Receivables" value={data.receivables} color="green" />
        <SummaryCard label="Revenue"     value={data.revenue}     color="green" />
        <SummaryCard label="Net P&L"     value={data.netPL}       color={data.netPL >= 0 ? 'blue' : 'red'} />
      </div>

      {/* Account groups */}
      {typeOrder.filter((t) => groups[t]?.length).map((type) => (
        <div key={type} className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900">{typeLabel[type]}</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs font-semibold uppercase tracking-wide">
                <th className="px-4 py-2 text-left">Code</th>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-right">Debit</th>
                <th className="px-4 py-2 text-right">Credit</th>
                <th className="px-4 py-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {groups[type]!.map((a) => (
                <tr key={a.code} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5 text-gray-400 font-mono text-xs">{a.code}</td>
                  <td className="px-4 py-2.5 text-gray-700">{a.name}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-blue-700">{a.debit > 0 ? fmt(a.debit) : '—'}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-green-600">{a.credit > 0 ? fmt(a.credit) : '—'}</td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${a.balance < 0 ? 'text-red-500' : 'text-gray-900'}`}>{fmt(a.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

// ── Reconciliation ────────────────────────────────────────────────────────────
const ANOMALY_META: Record<Anomaly['type'], { label: string; icon: typeof CheckCircle2 }> = {
  LEDGER_PAYMENT_MISMATCH:     { label: 'Ledger ↔ Payments',      icon: AlertTriangle },
  INSTALLMENT_REMAINING_DRIFT: { label: 'Installment Drift',       icon: AlertTriangle },
  JOURNAL_IMBALANCE:           { label: 'Journal Imbalance',       icon: AlertTriangle },
};

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function ReconcileTab() {
  const qc = useQueryClient();

  const { data: latest, isLoading, isError } = useQuery({
    queryKey: ['recon-latest'],
    queryFn:  reconciliationApi.latest,
    staleTime: 60_000,
  });

  const { data: history = [] } = useQuery({
    queryKey: ['recon-history'],
    queryFn:  reconciliationApi.history,
    staleTime: 60_000,
  });

  const runMutation = useMutation({
    mutationFn: reconciliationApi.run,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['recon-latest'] });
      void qc.invalidateQueries({ queryKey: ['recon-history'] });
      toast.success('Reconciliation complete');
    },
    onError: () => toast.error('Reconciliation failed'),
  });

  const pkr = (v: string | null) =>
    v ? 'PKR ' + Number(v).toLocaleString('en-PK', { maximumFractionDigits: 0 }) : '—';

  if (isLoading) return <RowSkeleton rows={4} />;
  if (isError) return <LedgerError />;

  return (
    <div className="space-y-5">

      {/* ── Run Now header ── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <ShieldCheck size={16} className="text-indigo-600" />
            Automated Reconciliation
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Runs daily at 00:01 · detects ledger mismatches, installment drift, journal imbalance</p>
        </div>
        <button
          onClick={() => runMutation.mutate()}
          disabled={runMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
        >
          <RefreshCw size={14} className={runMutation.isPending ? 'animate-spin' : ''} />
          {runMutation.isPending ? 'Running…' : 'Run Now'}
        </button>
      </div>

      {/* ── Latest run result ── */}
      {latest ? (
        <div className={`rounded-2xl border p-5 ${latest.status === 'OK' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              {latest.status === 'OK'
                ? <CheckCircle2 size={22} className="text-emerald-600 shrink-0" />
                : <AlertTriangle size={22} className="text-red-500 shrink-0" />
              }
              <div>
                <p className={`font-bold text-sm ${latest.status === 'OK' ? 'text-emerald-800' : 'text-red-800'}`}>
                  {latest.status === 'OK' ? 'All checks passed — books are balanced' : `${latest.anomalyCount} anomal${latest.anomalyCount === 1 ? 'y' : 'ies'} detected`}
                </p>
                <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                  <Clock size={10} />
                  {timeAgo(latest.runAt)} · {latest.trigger === 'MANUAL' ? 'Manual run' : 'Scheduled'}
                </p>
              </div>
            </div>
            {/* Summary numbers */}
            <div className="text-right text-xs text-gray-500 space-y-0.5">
              <div>Ledger credits: <span className="font-semibold text-gray-900">{pkr(latest.ledgerTotal)}</span></div>
              <div>Payments total: <span className="font-semibold text-gray-900">{pkr(latest.paymentsTotal)}</span></div>
              {Number(latest.diff ?? 0) > 0 && (
                <div className="text-red-600 font-semibold">Gap: {pkr(latest.diff)}</div>
              )}
            </div>
          </div>

          {/* Anomaly list */}
          {latest.anomalies.length > 0 && (
            <div className="space-y-2">
              {latest.anomalies.map((a, i) => {
                const meta = ANOMALY_META[a.type];
                return (
                  <div key={i} className={`rounded-xl px-4 py-3 border ${a.severity === 'HIGH' ? 'bg-red-100 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-bold uppercase tracking-wide ${a.severity === 'HIGH' ? 'text-red-700' : 'text-amber-700'}`}>
                        {a.severity} · {meta.label}
                      </span>
                      <span className={`text-xs font-semibold ${a.severity === 'HIGH' ? 'text-red-600' : 'text-amber-600'}`}>
                        Δ PKR {Number(a.diff).toLocaleString('en-PK', { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <p className="text-xs text-gray-700 leading-snug">{a.detail}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-2xl border border-gray-100">
          <ShieldCheck size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium text-gray-500">No reconciliation run yet</p>
          <p className="text-xs mt-1">Click "Run Now" to check your books</p>
        </div>
      )}

      {/* ── History ── */}
      {history.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900">Run History</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs font-semibold uppercase tracking-wide">
                <th className="px-4 py-2.5 text-left">Date</th>
                <th className="px-4 py-2.5 text-left">Trigger</th>
                <th className="px-4 py-2.5 text-center">Status</th>
                <th className="px-4 py-2.5 text-right">Anomalies</th>
                <th className="px-4 py-2.5 text-right">Gap</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {history.map((h) => (
                <tr key={h.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5 text-gray-700 text-xs">
                    {fmtDateTime(h.runAt)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs text-gray-400">{h.trigger}</span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {h.status === 'OK'
                      ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full"><CheckCircle2 size={10} />OK</span>
                      : <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded-full"><AlertTriangle size={10} />{h.anomalyCount}</span>
                    }
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs text-gray-500">{h.anomalyCount}</td>
                  <td className={`px-4 py-2.5 text-right text-xs font-mono font-semibold ${Number(h.diff ?? 0) > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                    {Number(h.diff ?? 0) > 0 ? `PKR ${Number(h.diff).toLocaleString()}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
const TABS: { id: Tab; label: string; icon: typeof Wallet }[] = [
  { id: 'balance',  label: 'Wallet',     icon: Wallet },
  { id: 'cashbook', label: 'Cash Book',  icon: BookOpen },
  { id: 'daily',    label: 'Daily',      icon: Calendar },
  { id: 'pl',       label: 'P & L',      icon: BarChart3 },
  { id: 'expenses', label: 'Expenses',   icon: TrendingDown },
  { id: 'journal',   label: 'Journal',    icon: TrendingUp },
  { id: 'accounts',  label: 'Accounts',   icon: BarChart3 },
  { id: 'reconcile', label: 'Reconcile',  icon: ShieldCheck },
];

export default function LedgerPage() {
  const [tab, setTab] = useState<Tab>('balance');

  return (
    <div className="px-4 py-5 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Accounting</h1>
        <p className="text-sm text-gray-500 mt-0.5">Ledger · Cash book · Expenses · Profit & Loss</p>
      </div>

      {/* Tabs */}
      <div className="overflow-x-auto mb-6">
      <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>
      </div>

      {/* Tab content */}
      {tab === 'balance'  && <BalanceTab />}
      {tab === 'cashbook' && <CashBookTab />}
      {tab === 'daily'    && <DailyTab />}
      {tab === 'pl'       && <PLTab />}
      {tab === 'expenses' && <ExpensesTab />}
      {tab === 'journal'  && <JournalTab />}
      {tab === 'accounts'  && <AccountsTab />}
      {tab === 'reconcile' && <ReconcileTab />}
    </div>
  );
}
