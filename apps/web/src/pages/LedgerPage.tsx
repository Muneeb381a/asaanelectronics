import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Wallet, TrendingUp, TrendingDown, BookOpen, Calendar, BarChart3,
  Plus, Trash2, ArrowUpCircle, ArrowDownCircle, X,
  ShieldCheck, AlertTriangle, CheckCircle2, RefreshCw, Clock,
} from 'lucide-react';
import { ledgerApi } from '../api/ledger.api.ts';
import { getErrorMessage } from '../utils/error.ts';
import { fmtDateTime } from '../utils/dateFormat.ts';
import { expensesApi, type ExpenseCategory } from '../api/expenses.api.ts';
import { accountingApi } from '../api/accounting.api.ts';
import { reconciliationApi, type Anomaly } from '../api/reconciliation.api.ts';
import { RowSkeleton } from '../components/ui/Skeleton.tsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.tsx';

/* ── types & constants ── */
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

const TABS: { id: Tab; label: string; icon: typeof Wallet }[] = [
  { id: 'balance',   label: 'Wallet',    icon: Wallet },
  { id: 'cashbook',  label: 'Cash Book', icon: BookOpen },
  { id: 'daily',     label: 'Daily',     icon: Calendar },
  { id: 'pl',        label: 'P & L',     icon: BarChart3 },
  { id: 'expenses',  label: 'Expenses',  icon: TrendingDown },
  { id: 'journal',   label: 'Journal',   icon: TrendingUp },
  { id: 'accounts',  label: 'Accounts',  icon: BarChart3 },
  { id: 'reconcile', label: 'Reconcile', icon: ShieldCheck },
];

/* ── helpers ── */
const fmt = (n: number) => `PKR ${n.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtSh = (n: number) => {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 10_00_000) return `${sign}${(abs / 10_00_000).toFixed(1)}M`;
  if (abs >= 1_00_000)  return `${sign}${(abs / 1_00_000).toFixed(abs % 1_00_000 === 0 ? 0 : 1)}L`;
  if (abs >= 1_000)     return `${sign}${(abs / 1_000).toFixed(abs % 1_000 === 0 ? 0 : 1)}K`;
  return fmt(n);
};
const today      = () => new Date().toISOString().slice(0, 10);
const monthStart = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; };

const CATEGORY_COLORS: Record<string, string> = {
  RENT:        'bg-rose-100 text-rose-700',
  SALARY:      'bg-blue-100 text-blue-700',
  UTILITY:     'bg-amber-100 text-amber-700',
  PURCHASE:    'bg-violet-100 text-violet-700',
  MAINTENANCE: 'bg-orange-100 text-orange-700',
  TRANSPORT:   'bg-teal-100 text-teal-700',
  OTHER:       'bg-slate-100 text-slate-600',
};

/* ── shared UI ── */
function LedgerError() {
  return <p className="py-10 text-center text-sm text-red-500">Data load nahi hua. Dobara try karo.</p>;
}
function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-14 text-slate-400">
      <BookOpen size={28} className="mx-auto mb-3 opacity-30"/>
      <p className="text-sm">{message}</p>
    </div>
  );
}

function DateRow({ from, to, onFrom, onTo, extra }: { from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void; extra?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4 flex-wrap">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-slate-500">From</span>
        <input type="date" value={from} onChange={e => onFrom(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 bg-white focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"/>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-slate-500">To</span>
        <input type="date" value={to} onChange={e => onTo(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 bg-white focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"/>
      </div>
      {extra}
    </div>
  );
}

function KpiTile({ label, value, cls, border }: { label: string; value: string; cls: string; border: string }) {
  return (
    <div className={`bg-white rounded-xl ring-1 ring-slate-200 px-4 py-3.5 border-l-[3px] ${border}`}>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
      <p className={`text-xl font-black tabular-nums leading-none mt-1.5 ${cls}`}>{value}</p>
    </div>
  );
}

/* ══════════════════════════════════════
   TABS
══════════════════════════════════════ */

/* ── Wallet Balance ── */
function BalanceTab() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['ledger-balance'], queryFn: ledgerApi.balance, staleTime: 30_000,
  });

  if (isLoading) return <RowSkeleton rows={3}/>;
  if (isError)   return <LedgerError/>;

  const balance = data?.balance ?? 0;
  const credits = data?.credits ?? 0;
  const debits  = data?.debits  ?? 0;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Main balance */}
      <div className={`rounded-2xl p-8 text-center ${balance >= 0 ? 'bg-linear-to-br from-blue-600 to-indigo-700' : 'bg-linear-to-br from-red-500 to-rose-700'}`}>
        <p className="text-sm font-bold text-white/70 mb-1">Shop Wallet Balance</p>
        <p className="text-5xl font-black text-white tracking-tight tabular-nums">{fmtSh(balance)}</p>
        <p className="text-xs text-white/50 mt-2 tabular-nums">{fmt(balance)}</p>
        <p className="text-xs text-white/60 mt-1">Tamam waqt · paise aye minus paise gaye</p>
      </div>

      {/* Credit/Debit */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl ring-1 ring-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center">
              <ArrowUpCircle size={16} className="text-emerald-600"/>
            </div>
            <p className="text-sm font-black text-slate-700">Total Aya</p>
          </div>
          <p className="text-3xl font-black text-emerald-600 tabular-nums leading-none">{fmtSh(credits)}</p>
          <p className="text-xs text-slate-400 mt-1.5 tabular-nums">{fmt(credits)}</p>
        </div>
        <div className="bg-white rounded-2xl ring-1 ring-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center">
              <ArrowDownCircle size={16} className="text-red-500"/>
            </div>
            <p className="text-sm font-black text-slate-700">Total Gaya</p>
          </div>
          <p className="text-3xl font-black text-red-500 tabular-nums leading-none">{fmtSh(debits)}</p>
          <p className="text-xs text-slate-400 mt-1.5 tabular-nums">{fmt(debits)}</p>
        </div>
      </div>
    </div>
  );
}

/* ── Cash Book ── */
function CashBookTab() {
  const [from, setFrom] = useState(monthStart());
  const [to,   setTo]   = useState(today());

  const { data: entries = [], isLoading, isError } = useQuery({
    queryKey: ['ledger-cashbook', from, to],
    queryFn:  () => ledgerApi.cashBook(from, to, 200),
    staleTime: 30_000,
  });

  const totalIn  = entries.filter(e => e.type === 'CREDIT').reduce((s, e) => s + Number(e.amount), 0);
  const totalOut = entries.filter(e => e.type === 'DEBIT').reduce((s, e) => s + Number(e.amount), 0);
  const net      = totalIn - totalOut;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <DateRow from={from} to={to} onFrom={setFrom} onTo={setTo}
          extra={
            <div className="ml-auto flex gap-2 text-sm">
              <span className="font-black text-emerald-600 tabular-nums">+{fmtSh(totalIn)}</span>
              <span className="text-slate-300">·</span>
              <span className="font-black text-red-500 tabular-nums">-{fmtSh(totalOut)}</span>
              <span className="text-slate-300">·</span>
              <span className={`font-black tabular-nums ${net >= 0 ? 'text-blue-700' : 'text-red-600'}`}>{net >= 0 ? '+' : ''}{fmtSh(net)}</span>
            </div>
          }/>
      </div>
      {isLoading ? <RowSkeleton rows={5}/> : isError ? <LedgerError/> : entries.length === 0 ? (
        <EmptyState message="Is period mein koi transaction nahi"/>
      ) : (
        <div className="bg-white rounded-2xl ring-1 ring-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {entries.map(e => (
                  <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap tabular-nums">{e.date.slice(0, 10)}</td>
                    <td className="px-4 py-3 text-sm text-slate-800 max-w-xs truncate">{e.description}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded ${CATEGORY_COLORS[e.category] ?? 'bg-slate-100 text-slate-500'}`}>
                        {e.category}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right font-black text-sm whitespace-nowrap tabular-nums ${e.type === 'CREDIT' ? 'text-emerald-600' : 'text-red-500'}`}>
                      {e.type === 'CREDIT' ? '+' : '-'}{fmtSh(Number(e.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Daily Closing ── */
function DailyTab() {
  const [date, setDate] = useState(today());

  const { data, isLoading, isError } = useQuery({
    queryKey: ['ledger-daily', date],
    queryFn:  () => ledgerApi.daily(date),
    staleTime: 30_000,
  });

  return (
    <div>
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500">Date</span>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 bg-white focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"/>
        </div>
      </div>

      {isLoading ? <RowSkeleton rows={4}/> : isError ? <LedgerError/> : !data ? null : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <KpiTile label="Aya"    value={fmtSh(data.credits)}                           cls="text-emerald-600"  border="border-emerald-500"/>
            <KpiTile label="Gaya"   value={fmtSh(data.debits)}                            cls="text-red-500"      border="border-red-500"/>
            <KpiTile label="Net"    value={(data.net >= 0 ? '+' : '') + fmtSh(data.net)}  cls={data.net >= 0 ? 'text-blue-700' : 'text-red-600'} border={data.net >= 0 ? 'border-blue-500' : 'border-red-500'}/>
          </div>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{data.txCount} transaction{data.txCount !== 1 ? 's' : ''} on {data.date}</p>
          {data.entries.length === 0 ? <EmptyState message="Is din koi transaction nahi"/> : (
            <div className="bg-white rounded-2xl ring-1 ring-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</th>
                      <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                      <th className="px-4 py-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {data.entries.map(e => (
                      <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-sm text-slate-800 max-w-xs truncate">{e.description}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded ${CATEGORY_COLORS[e.category] ?? 'bg-slate-100 text-slate-500'}`}>{e.category}</span>
                        </td>
                        <td className={`px-4 py-3 text-right font-black whitespace-nowrap tabular-nums ${e.type === 'CREDIT' ? 'text-emerald-600' : 'text-red-500'}`}>
                          {e.type === 'CREDIT' ? '+' : '-'}{fmtSh(Number(e.amount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Profit & Loss ── */
function PLTab() {
  const now = new Date();
  const [from, setFrom] = useState(`${now.getFullYear()}-01-01`);
  const [to,   setTo]   = useState(today());

  const { data, isLoading, isError } = useQuery({
    queryKey: ['ledger-pl', from, to],
    queryFn:  () => ledgerApi.pl(from, to),
    staleTime: 30_000,
  });

  return (
    <div>
      <DateRow from={from} to={to} onFrom={setFrom} onTo={setTo}/>

      {isLoading ? <RowSkeleton rows={4}/> : isError ? <LedgerError/> : !data ? null : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiTile label="Revenue"    value={fmtSh(data.revenue)}  cls="text-emerald-600"                                      border="border-emerald-500"/>
            <KpiTile label="Expenses"   value={fmtSh(data.expenses)} cls="text-red-500"                                          border="border-red-500"/>
            <KpiTile label="Net Profit" value={fmtSh(data.profit)}   cls={data.profit >= 0 ? 'text-blue-700' : 'text-red-600'}   border={data.profit >= 0 ? 'border-blue-500' : 'border-red-500'}/>
            <KpiTile label="Margin"     value={`${data.margin}%`}    cls={data.margin >= 0 ? 'text-violet-700' : 'text-red-600'} border="border-violet-400"/>
          </div>

          {data.monthly.length > 0 && (
            <div className="bg-white rounded-2xl ring-1 ring-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <BarChart3 size={13} className="text-slate-500"/>
                <p className="text-sm font-black text-slate-900">Monthly Breakdown</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Month</th>
                      <th className="px-4 py-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Revenue</th>
                      <th className="px-4 py-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Expenses</th>
                      <th className="px-4 py-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {data.monthly.map(m => (
                      <tr key={m.month} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-black text-slate-900">{m.label}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600 tabular-nums">{fmtSh(m.revenue)}</td>
                        <td className="px-4 py-3 text-right font-bold text-red-500 tabular-nums">{fmtSh(m.expenses)}</td>
                        <td className={`px-4 py-3 text-right font-black tabular-nums ${m.profit >= 0 ? 'text-blue-700' : 'text-red-600'}`}>{fmtSh(m.profit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.byCategory.length > 0 && (
            <div className="bg-white rounded-2xl ring-1 ring-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <TrendingDown size={13} className="text-slate-500"/>
                <p className="text-sm font-black text-slate-900">Category ke hisaab se Kharcha</p>
              </div>
              <div className="p-4 space-y-3">
                {data.byCategory.map(c => {
                  const pct = data.expenses > 0 ? (c.total / data.expenses) * 100 : 0;
                  return (
                    <div key={c.category}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded ${CATEGORY_COLORS[c.category] ?? 'bg-slate-100 text-slate-500'}`}>{c.category}</span>
                        <span className="font-black text-slate-900 tabular-nums">{fmtSh(c.total)} <span className="text-slate-400 font-bold">({pct.toFixed(0)}%)</span></span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-rose-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }}/>
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

/* ── Expenses ── */
function ExpensesTab() {
  const qc = useQueryClient();
  const [showForm,      setShowForm]      = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [from, setFrom] = useState(monthStart());
  const [to,   setTo]   = useState(today());

  const [form, setForm] = useState<{
    category: ExpenseCategory; amount: string; description: string; date: string;
  }>({ category: 'OTHER', amount: '', description: '', date: today() });

  const { data: expenses = [], isLoading, isError } = useQuery({
    queryKey: ['expenses', from, to],
    queryFn:  () => expensesApi.list(from, to),
    staleTime: 30_000,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['expenses'] });
    void qc.invalidateQueries({ queryKey: ['ledger-balance'] });
    void qc.invalidateQueries({ queryKey: ['ledger-cashbook'] });
    void qc.invalidateQueries({ queryKey: ['ledger-daily'] });
    void qc.invalidateQueries({ queryKey: ['ledger-pl'] });
  };

  const createMutation = useMutation({
    mutationFn: () => expensesApi.create({
      category:    form.category,
      amount:      Number(form.amount),
      description: form.description || undefined,
      date:        form.date        || undefined,
    }),
    onSuccess: () => {
      invalidate();
      setShowForm(false);
      setForm({ category: 'OTHER', amount: '', description: '', date: today() });
      toast.success('Expense save ho gaya');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Save nahi hua')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => expensesApi.remove(id),
    onSuccess: () => { invalidate(); toast.success('Expense delete ho gaya'); },
    onError:   () => toast.error('Delete nahi hua'),
  });

  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <DateRow from={from} to={to} onFrom={setFrom} onTo={setTo}
          extra={expenses.length > 0 ? <span className="text-sm font-black text-red-500 tabular-nums ml-2">{fmtSh(totalExpenses)} total</span> : undefined}/>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition shadow-sm">
          <Plus size={13}/> Naya Kharcha
        </button>
      </div>

      {/* Add form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-slate-950">
              <div>
                <p className="text-white font-black text-sm">Naya Kharcha</p>
                <p className="text-slate-400 text-xs mt-0.5">Expense record karo</p>
              </div>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white transition p-1"><X size={16}/></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-600 mb-1.5">Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as ExpenseCategory }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition bg-white">
                    {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-600 mb-1.5">Amount (PKR) *</label>
                  <input type="number" min="1" placeholder="e.g. 5000" autoFocus value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-black tabular-nums focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition"/>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-600 mb-1.5">Date</label>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-blue-400 transition"/>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-600 mb-1.5">Description <span className="font-normal text-slate-400">(optional)</span></label>
                  <input type="text" placeholder="e.g. May ka rent" value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 transition"/>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 text-sm font-black border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition">
                  Cancel
                </button>
                <button onClick={() => createMutation.mutate()} disabled={!form.amount || Number(form.amount) <= 0 || createMutation.isPending}
                  className="flex-1 py-2.5 text-sm font-black text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl transition flex items-center justify-center gap-1.5">
                  {createMutation.isPending ? <span className="animate-pulse">Saving…</span> : <><CheckCircle2 size={13}/> Save Karo</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isLoading ? <RowSkeleton rows={5}/> : isError ? <LedgerError/> : expenses.length === 0 ? (
        <EmptyState message="Is period mein koi expense nahi"/>
      ) : (
        <div className="bg-white rounded-2xl ring-1 ring-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
                  <th className="px-4 py-3"/>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {expenses.map(e => (
                  <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap tabular-nums">{e.date.slice(0, 10)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded ${CATEGORY_COLORS[e.category] ?? 'bg-slate-100 text-slate-500'}`}>
                        {e.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 max-w-xs truncate">{e.description ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-black text-red-500 tabular-nums">{fmtSh(Number(e.amount))}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setDeleteConfirm({ open: true, id: e.id })} disabled={deleteMutation.isPending}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                        <Trash2 size={14}/>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteConfirm.open}
        title="Expense Delete Karo?"
        description="Ye expense ledger se delete ho jaegi aur balance update ho jaega."
        confirmLabel="Delete Karo" variant="danger"
        isPending={deleteMutation.isPending}
        onConfirm={() => { if (deleteConfirm.id) deleteMutation.mutate(deleteConfirm.id); setDeleteConfirm({ open: false, id: null }); }}
        onCancel={() => setDeleteConfirm({ open: false, id: null })}
      />
    </div>
  );
}

/* ── Journal Entries ── */
function JournalTab() {
  const [from, setFrom] = useState(monthStart());
  const [to,   setTo]   = useState(today());
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['accounting-journal', from, to, page],
    queryFn:  () => accountingApi.listJournal({ from, to, page, limit }),
    staleTime: 30_000,
  });

  const entries = data?.data ?? [];
  const total   = data?.total ?? 0;
  const pages   = Math.ceil(total / limit);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <DateRow from={from} to={to} onFrom={v => { setFrom(v); setPage(1); }} onTo={v => { setTo(v); setPage(1); }}
          extra={total > 0 ? <span className="text-xs text-slate-400 ml-auto">{total} entries</span> : undefined}/>
      </div>

      {isLoading ? <RowSkeleton rows={5}/> : isError ? <LedgerError/> : entries.length === 0 ? (
        <EmptyState message="Is period mein koi journal entry nahi"/>
      ) : (
        <div className="space-y-3">
          {entries.map(je => (
            <div key={je.id} className="bg-white rounded-2xl ring-1 ring-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
                <p className="text-sm font-black text-slate-900 truncate">{je.memo}</p>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {je.refType && (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">{je.refType}</span>
                  )}
                  <span className="text-[10px] text-slate-400 whitespace-nowrap">{fmtDateTime(je.postedAt)}</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-400">
                      <th className="px-4 py-2 text-left font-black">Account</th>
                      <th className="px-4 py-2 text-right font-black">Debit</th>
                      <th className="px-4 py-2 text-right font-black">Credit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {je.lines.map((ln, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-2 text-slate-700">{ln.accountCode} — {ln.accountName}</td>
                        <td className="px-4 py-2 text-right font-mono font-black text-blue-700 tabular-nums">{Number(ln.debit)  > 0 ? fmtSh(Number(ln.debit))  : ''}</td>
                        <td className="px-4 py-2 text-right font-mono font-black text-emerald-600 tabular-nums">{Number(ln.credit) > 0 ? fmtSh(Number(ln.credit)) : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {pages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-4 py-2 text-xs font-black border border-slate-200 rounded-xl text-slate-600 hover:bg-white disabled:opacity-40 transition">Pehla</button>
              <span className="text-xs text-slate-500">{page} / {pages}</span>
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                className="px-4 py-2 text-xs font-black border border-slate-200 rounded-xl text-slate-600 hover:bg-white disabled:opacity-40 transition">Agla</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Trial Balance / Accounts ── */
function AccountsTab() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['accounting-balances'],
    queryFn:  () => accountingApi.getBalances(),
    staleTime: 30_000,
  });

  if (isLoading) return <RowSkeleton rows={6}/>;
  if (isError)   return <LedgerError/>;
  if (!data)     return null;

  const groups: Record<string, typeof data.accounts> = {};
  for (const a of data.accounts) (groups[a.type] ??= []).push(a);

  const typeOrder = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];
  const typeLabel: Record<string, string> = {
    ASSET: 'Assets', LIABILITY: 'Liabilities', EQUITY: 'Equity', REVENUE: 'Revenue', EXPENSE: 'Expenses',
  };
  const typeBorder: Record<string, string> = {
    ASSET: 'border-blue-500', LIABILITY: 'border-red-500', EQUITY: 'border-violet-400',
    REVENUE: 'border-emerald-500', EXPENSE: 'border-rose-500',
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile label="Cash"        value={fmtSh(data.cash)}        cls="text-blue-700"                                       border="border-blue-500"/>
        <KpiTile label="Receivables" value={fmtSh(data.receivables)} cls="text-emerald-600"                                   border="border-emerald-500"/>
        <KpiTile label="Revenue"     value={fmtSh(data.revenue)}     cls="text-emerald-600"                                   border="border-violet-400"/>
        <KpiTile label="Net P&L"     value={fmtSh(data.netPL)}       cls={data.netPL >= 0 ? 'text-blue-700' : 'text-red-600'} border={data.netPL >= 0 ? 'border-blue-500' : 'border-red-500'}/>
      </div>

      {typeOrder.filter(t => groups[t]?.length).map(type => (
        <div key={type} className="bg-white rounded-2xl ring-1 ring-slate-200 overflow-hidden">
          <div className={`px-4 py-3 border-b border-slate-100 border-l-4 ${typeBorder[type]}`}>
            <p className="text-sm font-black text-slate-900">{typeLabel[type]}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-2.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Code</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Name</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Debit</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Credit</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {groups[type]!.map(a => (
                  <tr key={a.code} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5 text-slate-400 font-mono text-xs">{a.code}</td>
                    <td className="px-4 py-2.5 text-slate-700 text-sm">{a.name}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs font-black text-blue-700 tabular-nums">{a.debit > 0 ? fmtSh(a.debit) : '—'}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs font-black text-emerald-600 tabular-nums">{a.credit > 0 ? fmtSh(a.credit) : '—'}</td>
                    <td className={`px-4 py-2.5 text-right font-black text-sm tabular-nums ${a.balance < 0 ? 'text-red-500' : 'text-slate-900'}`}>{fmtSh(a.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Reconciliation ── */
const ANOMALY_META: Record<Anomaly['type'], { label: string }> = {
  LEDGER_PAYMENT_MISMATCH:     { label: 'Ledger ↔ Payments' },
  INSTALLMENT_REMAINING_DRIFT: { label: 'Installment Drift' },
  JOURNAL_IMBALANCE:           { label: 'Journal Imbalance' },
};
const timeAgo = (iso: string) => {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1)  return 'abhi abhi';
  if (mins < 60) return `${mins}m pehle`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h pehle`;
  return `${Math.floor(hrs / 24)}d pehle`;
};

function ReconcileTab() {
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: latest, isLoading, isError } = useQuery({
    queryKey: ['recon-latest'],  queryFn: reconciliationApi.latest, staleTime: 60_000,
  });
  const { data: history = [] } = useQuery({
    queryKey: ['recon-history'], queryFn: reconciliationApi.history, staleTime: 60_000,
  });

  const runMutation = useMutation({
    mutationFn: reconciliationApi.run,
    onSuccess:  () => { void qc.invalidateQueries({ queryKey: ['recon-latest'] }); void qc.invalidateQueries({ queryKey: ['recon-history'] }); toast.success('Reconciliation complete — books checked'); },
    onError:    (e) => toast.error(getErrorMessage(e, 'Reconciliation failed')),
  });

  const pkrFmt = (v: string | null) => v ? fmtSh(Number(v)) : '—';

  if (isLoading) return <RowSkeleton rows={4}/>;
  if (isError)   return <LedgerError/>;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-100 rounded-2xl px-4 py-3 text-sm text-indigo-700">
        <ShieldCheck size={16} className="shrink-0 mt-0.5"/>
        <p className="text-xs">Reconciliation sirf <strong>check</strong> karta hai — koi data delete ya change nahi hota. Ledger, payments, aur journal entries ko compare karta hai aur gaps report karta hai.</p>
      </div>

      <div className="flex items-center justify-between bg-white rounded-2xl ring-1 ring-slate-200 px-4 py-3.5">
        <div>
          <p className="text-sm font-black text-slate-900 flex items-center gap-2">
            <ShieldCheck size={14} className="text-indigo-600"/> Automated Reconciliation
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Daily 00:01 par run hota hai · ledger mismatches, drift, journal imbalance detect karta hai</p>
        </div>
        <button onClick={() => setConfirmOpen(true)} disabled={runMutation.isPending}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition">
          <RefreshCw size={13} className={runMutation.isPending ? 'animate-spin' : ''}/>
          {runMutation.isPending ? 'Running…' : 'Run Now'}
        </button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Reconciliation Run Karo?"
        description="Aapke ledger, payments, aur journal entries scan kiye jaenge aur koi mismatch report kiya jaega. Koi data delete ya modify nahi hoga — ye sirf ek read-only audit check hai."
        confirmLabel="Haan, Check Karo" variant="info"
        isPending={runMutation.isPending}
        onConfirm={() => { setConfirmOpen(false); runMutation.mutate(); }}
        onCancel={() => setConfirmOpen(false)}
      />

      {latest ? (
        <div className={`rounded-2xl border p-5 ${latest.status === 'OK' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              {latest.status === 'OK'
                ? <CheckCircle2 size={22} className="text-emerald-600 shrink-0"/>
                : <AlertTriangle size={22} className="text-red-500 shrink-0"/>
              }
              <div>
                <p className={`font-black text-sm ${latest.status === 'OK' ? 'text-emerald-800' : 'text-red-800'}`}>
                  {latest.status === 'OK' ? 'Sab checks pass — books balanced hain' : `${latest.anomalyCount} anomal${latest.anomalyCount === 1 ? 'y' : 'ies'} mili`}
                </p>
                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                  <Clock size={10}/> {timeAgo(latest.runAt)} · {latest.trigger === 'MANUAL' ? 'Manual run' : 'Scheduled'}
                </p>
              </div>
            </div>
            <div className="text-right text-xs text-slate-500 space-y-0.5 shrink-0 ml-3">
              <div>Ledger: <span className="font-black text-slate-900 tabular-nums">{pkrFmt(latest.ledgerTotal)}</span></div>
              <div>Payments: <span className="font-black text-slate-900 tabular-nums">{pkrFmt(latest.paymentsTotal)}</span></div>
              {Number(latest.diff ?? 0) > 0 && <div className="text-red-600 font-black">Gap: {pkrFmt(latest.diff)}</div>}
            </div>
          </div>
          {latest.anomalies.length > 0 && (
            <div className="space-y-2">
              {latest.anomalies.map((a, i) => (
                <div key={i} className={`rounded-xl px-4 py-3 border ${a.severity === 'HIGH' ? 'bg-red-100 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[10px] font-black uppercase tracking-wide ${a.severity === 'HIGH' ? 'text-red-700' : 'text-amber-700'}`}>
                      {a.severity} · {ANOMALY_META[a.type]?.label ?? a.type}
                    </span>
                    <span className={`text-xs font-black tabular-nums ${a.severity === 'HIGH' ? 'text-red-600' : 'text-amber-600'}`}>
                      Δ {fmtSh(Number(a.diff))}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-snug">{a.detail}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12 text-slate-400 bg-white rounded-2xl ring-1 ring-slate-200">
          <ShieldCheck size={28} className="mx-auto mb-3 opacity-30"/>
          <p className="text-sm font-black text-slate-500">Koi run nahi hua abhi</p>
          <p className="text-xs mt-1">"Run Now" par click karo books check karne ke liye</p>
        </div>
      )}

      {history.length > 0 && (
        <div className="bg-white rounded-2xl ring-1 ring-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <Clock size={13} className="text-slate-500"/>
            <p className="text-sm font-black text-slate-900">Run History</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-2.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Trigger</th>
                  <th className="px-4 py-2.5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Anomalies</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Gap</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {history.map(h => (
                  <tr key={h.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5 text-xs text-slate-600 tabular-nums">{fmtDateTime(h.runAt)}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-400">{h.trigger}</td>
                    <td className="px-4 py-2.5 text-center">
                      {h.status === 'OK'
                        ? <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full"><CheckCircle2 size={9}/>OK</span>
                        : <span className="inline-flex items-center gap-1 text-[10px] font-black text-red-700 bg-red-50 px-2 py-0.5 rounded-full"><AlertTriangle size={9}/>{h.anomalyCount}</span>
                      }
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-slate-500 tabular-nums">{h.anomalyCount}</td>
                    <td className={`px-4 py-2.5 text-right text-xs font-black tabular-nums ${Number(h.diff ?? 0) > 0 ? 'text-red-500' : 'text-slate-300'}`}>
                      {Number(h.diff ?? 0) > 0 ? fmtSh(Number(h.diff)) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══ MAIN PAGE ══ */
export default function LedgerPage() {
  const [tab, setTab] = useState<Tab>('balance');

  const { data: balanceData } = useQuery({
    queryKey: ['ledger-balance'], queryFn: ledgerApi.balance, staleTime: 30_000,
  });
  const balance = balanceData?.balance ?? 0;

  return (
    <div className="bg-[#F0F2F8]">

      {/* Dark header */}
      <div className="bg-slate-950 shadow-lg shadow-slate-950/20">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen size={15} className="text-blue-400"/>
              <h1 className="text-[15px] font-black text-white">Accounting</h1>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Ledger · Cash Book · P&L · Expenses</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Wallet Balance</p>
            <p className={`text-xl font-black tabular-nums mt-0.5 ${balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {balanceData ? fmtSh(balance) : '---'}
            </p>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="px-4 sm:px-6 py-2.5 flex gap-1 overflow-x-auto scrollbar-none">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap transition shrink-0 ${
                tab === id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
              }`}>
              <Icon size={12}/> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-3 sm:px-5 lg:px-6 py-4 max-w-5xl mx-auto">
        {tab === 'balance'   && <BalanceTab/>}
        {tab === 'cashbook'  && <CashBookTab/>}
        {tab === 'daily'     && <DailyTab/>}
        {tab === 'pl'        && <PLTab/>}
        {tab === 'expenses'  && <ExpensesTab/>}
        {tab === 'journal'   && <JournalTab/>}
        {tab === 'accounts'  && <AccountsTab/>}
        {tab === 'reconcile' && <ReconcileTab/>}
      </div>
    </div>
  );
}
