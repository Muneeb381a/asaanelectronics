import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Receipt, Plus, Trash2, Pencil, X, Loader2, ChevronLeft, ChevronRight, Search,
  Home, Users, Zap, ShoppingCart, Wrench, Truck, MoreHorizontal, RefreshCw, Bell,
} from 'lucide-react';
import { expensesApi, type ExpenseCategory, type Expense, type RecurringSuggestion } from '../api/expenses.api.ts';
import { sellersApi } from '../api/sellers.api.ts';
import { getErrorMessage } from '../utils/error.ts';
import { fmtDate, fmtMonthYear } from '../utils/dateFormat.ts';
import { useAuthStore } from '../store/auth.store.ts';
import ConfirmDialog from '../components/ui/ConfirmDialog.tsx';

// ── Category meta ──────────────────────────────────────────────────────────────

const CAT: Record<ExpenseCategory, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  RENT:        { label: 'Rent',        icon: Home,           color: 'text-blue-600',    bg: 'bg-blue-50'    },
  SALARY:      { label: 'Salary',      icon: Users,          color: 'text-violet-600',  bg: 'bg-violet-50'  },
  UTILITY:     { label: 'Utility',     icon: Zap,            color: 'text-amber-600',   bg: 'bg-amber-50'   },
  PURCHASE:    { label: 'Purchase',    icon: ShoppingCart,   color: 'text-emerald-600', bg: 'bg-emerald-50' },
  MAINTENANCE: { label: 'Maintenance', icon: Wrench,         color: 'text-orange-600',  bg: 'bg-orange-50'  },
  TRANSPORT:   { label: 'Transport',   icon: Truck,          color: 'text-cyan-600',    bg: 'bg-cyan-50'    },
  OTHER:       { label: 'Other',       icon: MoreHorizontal, color: 'text-gray-600',    bg: 'bg-gray-100'   },
};

const CATS = Object.keys(CAT) as ExpenseCategory[];

// ── Helpers ────────────────────────────────────────────────────────────────────

function pkr(v: number) { return 'PKR ' + v.toLocaleString('en-PK', { maximumFractionDigits: 0 }); }

function monthBounds() {
  const now  = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { from, to };
}

// ── Add / Edit Expense Modal ───────────────────────────────────────────────────

function AddModal({ onClose, expense, prefill }: { onClose: () => void; expense?: Expense; prefill?: Partial<{ category: ExpenseCategory; amount: string; description: string }> }) {
  const qc = useQueryClient();
  const isEdit = !!expense;
  const [category, setCategory] = useState<ExpenseCategory>(expense?.category ?? prefill?.category ?? 'RENT');
  const [amount,   setAmount]   = useState(expense ? String(Number(expense.amount)) : prefill?.amount ?? '');
  const [desc,     setDesc]     = useState(expense?.description ?? prefill?.description ?? '');
  const [date,     setDate]     = useState(expense ? expense.date.slice(0, 10) : new Date().toISOString().slice(0, 10));
  const [isRecurring,   setIsRecurring]   = useState(expense?.isRecurring ?? false);
  const [recurrenceDay, setRecurrenceDay] = useState(String(expense?.recurrenceDay ?? 1));

  const { mutate, isPending } = useMutation({
    mutationFn: () => {
      const amt = Number(amount);
      if (!amt || amt <= 0) throw new Error('Enter a valid amount');
      return isEdit
        ? expensesApi.update(expense.id, { category, amount: amt, description: desc || undefined, date, isRecurring, recurrenceDay: Number(recurrenceDay) })
        : expensesApi.create({ category, amount: amt, description: desc || undefined, date, isRecurring, recurrenceDay: Number(recurrenceDay) });
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Expense updated' : 'Expense recorded');
      void qc.invalidateQueries({ queryKey: ['expenses'] });
      void qc.invalidateQueries({ queryKey: ['recurring-suggestions'] });
      onClose();
    },
    onError: (e) => toast.error(getErrorMessage(e, isEdit ? 'Failed to update expense' : 'Failed to record expense')),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-gray-900">{isEdit ? 'Edit Expense' : 'Record Expense'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Category</label>
            <div className="grid grid-cols-4 gap-1.5">
              {CATS.map((c) => {
                const m = CAT[c];
                const selected = category === c;
                return (
                  <button key={c} type="button" onClick={() => setCategory(c)}
                    className={`flex flex-col items-center gap-1 py-2 rounded-xl border-2 transition text-[10px] font-semibold ${
                      selected ? `${m.bg} border-current ${m.color}` : 'border-gray-100 text-gray-400 hover:border-gray-200'
                    }`}>
                    <m.icon size={14} />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Amount (PKR)</label>
            <input type="number" min="1" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Notes (optional)</label>
            <input type="text" placeholder="e.g. June rent payment" value={desc} onChange={(e) => setDesc(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* Recurring toggle */}
          <div className="flex items-start justify-between gap-3 p-3 bg-gray-50 rounded-xl">
            <div className="flex items-start gap-2">
              <RefreshCw size={14} className="text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-gray-700">Recurring expense</p>
                <p className="text-[10px] text-gray-400">Auto-suggest this every month</p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isRecurring}
              onClick={() => setIsRecurring((v) => !v)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${isRecurring ? 'bg-blue-500' : 'bg-gray-200'}`}
            >
              <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${isRecurring ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
          </div>
          {isRecurring && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Day of month</label>
              <input
                type="number"
                value={recurrenceDay}
                onChange={(e) => setRecurrenceDay(e.target.value)}
                min="1" max="31"
                placeholder="1"
                className="w-24 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[10px] text-gray-400 mt-1">Suggested on day {recurrenceDay || '1'} of each month</p>
            </div>
          )}
        </div>

        <button onClick={() => mutate()} disabled={!amount || isPending}
          className="w-full mt-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold rounded-xl text-sm transition flex items-center justify-center gap-2">
          {isPending ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : isEdit ? 'Save Changes' : 'Record Expense'}
        </button>
      </div>
    </div>
  );
}

// ── Recurring suggestions ─────────────────────────────────────────────────────

function RecurringSuggestionsCard({ onAddExpense }: { onAddExpense: (s: RecurringSuggestion) => void }) {
  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ['recurring-suggestions'],
    queryFn:  expensesApi.getRecurringSuggestions,
    staleTime: 5 * 60_000,
  });

  if (isLoading || suggestions.length === 0) return null;

  const now = new Date();
  const monthName = now.toLocaleString('en-PK', { month: 'long' });

  return (
    <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
      <div className="flex items-center gap-2 mb-3">
        <Bell size={14} className="text-amber-600" />
        <p className="text-xs font-semibold text-amber-800">
          {suggestions.length} recurring expense{suggestions.length > 1 ? 's' : ''} not logged for {monthName}
        </p>
      </div>
      <div className="space-y-2">
        {suggestions.map((s) => {
          const m = CAT[s.category as ExpenseCategory];
          return (
            <div key={s.id} className="flex items-center gap-3 bg-white rounded-xl px-3 py-2.5 border border-amber-100">
              <div className={`w-7 h-7 ${m.bg} rounded-lg flex items-center justify-center shrink-0`}>
                <m.icon size={13} className={m.color} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-900">
                  {m.label}{s.description ? ` — ${s.description}` : ''}
                </p>
                <p className="text-[10px] text-gray-400">PKR {Number(s.amount).toLocaleString()} · Day {s.recurrenceDay}</p>
              </div>
              <button
                onClick={() => onAddExpense(s)}
                className="shrink-0 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-300 rounded-lg hover:bg-amber-100 transition">
                Add
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Category breakdown bar ─────────────────────────────────────────────────────

function CategoryBreakdown({ expenses }: { expenses: Expense[] }) {
  const byCategory = CATS.map((cat) => {
    const total = expenses.filter((e) => e.category === cat).reduce((s, e) => s + Number(e.amount), 0);
    return { cat, total };
  }).filter((c) => c.total > 0).sort((a, b) => b.total - a.total);

  if (!byCategory.length) return null;
  const max = byCategory[0]!.total;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">By Category</p>
      <div className="space-y-2.5">
        {byCategory.map(({ cat, total }) => {
          const m = CAT[cat];
          return (
            <div key={cat} className="flex items-center gap-3">
              <div className={`w-6 h-6 ${m.bg} rounded-lg flex items-center justify-center shrink-0`}>
                <m.icon size={12} className={m.color} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="font-medium text-gray-700">{m.label}</span>
                  <span className="text-gray-500">{pkr(total)}</span>
                </div>
                <div className="bg-gray-100 rounded-full h-1.5 overflow-hidden">
                  <div className={`h-full rounded-full ${m.bg.replace('50', '400').replace('100', '400')}`}
                    style={{ width: `${(total / max) * 100}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Budget progress ────────────────────────────────────────────────────────────

function BudgetProgress({ expenses, budgets }: { expenses: Expense[]; budgets: Partial<Record<ExpenseCategory, number>> }) {
  const cats = (Object.keys(budgets) as ExpenseCategory[]).filter((c) => (budgets[c] ?? 0) > 0);
  if (!cats.length) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Monthly Budget</p>
      <div className="space-y-3">
        {cats.map((cat) => {
          const budget  = budgets[cat]!;
          const spent   = expenses.filter((e) => e.category === cat).reduce((s, e) => s + Number(e.amount), 0);
          const pct     = Math.min(Math.round((spent / budget) * 100), 100);
          const over    = spent > budget;
          const m       = CAT[cat];
          const barColor = over ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500';
          return (
            <div key={cat}>
              <div className="flex items-center justify-between text-xs mb-1">
                <div className="flex items-center gap-1.5">
                  <div className={`w-5 h-5 ${m.bg} rounded-md flex items-center justify-center`}>
                    <m.icon size={11} className={m.color} />
                  </div>
                  <span className="font-medium text-gray-700">{m.label}</span>
                </div>
                <span className={`font-semibold ${over ? 'text-red-600' : 'text-gray-600'}`}>
                  {pkr(spent)} / {pkr(budget)}
                </span>
              </div>
              <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
              </div>
              {over && (
                <p className="text-[10px] text-red-500 mt-0.5">Over budget by {pkr(spent - budget)}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isOwner  = user?.role === 'SELLER_OWNER';
  const [showAdd,        setShowAdd]        = useState(false);
  const [addPrefill,     setAddPrefill]     = useState<Partial<{ category: ExpenseCategory; amount: string; description: string }> | undefined>();
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deleteConfirm, setDeleteConfirm]   = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [filterCat, setFilter]  = useState<ExpenseCategory | 'ALL'>('ALL');
  const [search,    setSearch]  = useState('');
  const bounds = monthBounds();
  const [from, setFrom] = useState(bounds.from);
  const [to,   setTo]   = useState(bounds.to);

  const { data: expenses = [], isLoading, isError } = useQuery({
    queryKey: ['expenses', from, to],
    queryFn:  () => expensesApi.list(from, to),
  });

  const { data: shop } = useQuery({ queryKey: ['shop-me'], queryFn: sellersApi.getMe, staleTime: 5 * 60_000 });
  const budgets = (shop?.settings?.expenseBudgets ?? {}) as Partial<Record<ExpenseCategory, number>>;

  const deleteMutation = useMutation({
    mutationFn: expensesApi.remove,
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['expenses'] }); toast.success('Expense removed'); },
    onError:    () => toast.error('Failed to remove expense'),
  });

  const byCat    = filterCat === 'ALL' ? expenses : expenses.filter((e) => e.category === filterCat);
  const filtered = search.trim()
    ? byCat.filter((e) =>
        (e.description ?? '').toLowerCase().includes(search.toLowerCase()) ||
        CAT[e.category].label.toLowerCase().includes(search.toLowerCase())
      )
    : byCat;
  const total    = filtered.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="px-4 py-5 sm:p-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Expenses</h1>
          <p className="text-sm text-gray-400 mt-0.5">Track business costs and outflows</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition">
          <Plus size={15} /> Add Expense
        </button>
      </div>

      {/* Recurring suggestions */}
      <RecurringSuggestionsCard onAddExpense={(s) => {
        setAddPrefill({ category: s.category as ExpenseCategory, amount: String(Number(s.amount)), description: s.description ?? '' });
        setShowAdd(true);
      }} />

      {/* Date range filter */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        {/* Month navigator */}
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-1 py-1">
          <button
            onClick={() => {
              const d = new Date(from);
              d.setMonth(d.getMonth() - 1);
              setFrom(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`);
              setTo(new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10));
            }}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition">
            <ChevronLeft size={15} />
          </button>
          <span className="text-sm font-semibold text-gray-700 px-2 min-w-28 text-center">
            {fmtMonthYear(new Date(from + 'T12:00:00'))}
          </span>
          <button
            onClick={() => {
              const d = new Date(from);
              d.setMonth(d.getMonth() + 1);
              setFrom(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`);
              setTo(new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10));
            }}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition">
            <ChevronRight size={15} />
          </button>
        </div>

        <button onClick={() => { setFrom(bounds.from); setTo(bounds.to); }}
          className="text-xs text-blue-600 hover:underline font-medium">This month</button>

        {/* Custom range */}
        <div className="flex items-center gap-2 text-sm ml-auto">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <span className="text-gray-400 text-xs">to</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

        {/* Left: breakdown + total */}
        <div className="space-y-4">
          {/* Total card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Total Expenses</p>
            <p className="text-2xl font-extrabold text-red-600">{pkr(total)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{filtered.length} transactions</p>
          </div>

          {isLoading
            ? <div className="h-48 bg-white rounded-2xl border border-gray-100 animate-pulse" />
            : <CategoryBreakdown expenses={expenses} />
          }
          <BudgetProgress expenses={expenses} budgets={budgets} />
        </div>

        {/* Right: list */}
        <div className="md:col-span-2">
          {/* Search */}
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by description or category…"
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 bg-white transition"
            />
          </div>

          {/* Category filter pills */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            <button onClick={() => setFilter('ALL')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition ${filterCat === 'ALL' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              All
            </button>
            {CATS.map((c) => {
              const m = CAT[c];
              const active = filterCat === c;
              return (
                <button key={c} onClick={() => setFilter(c)}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition ${active ? `${m.bg} ${m.color}` : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  <m.icon size={10} />{m.label}
                </button>
              );
            })}
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="space-y-px">
                {[1,2,3,4,5].map((i) => <div key={i} className="h-14 bg-gray-50 animate-pulse border-b border-gray-100" />)}
              </div>
            ) : isError ? (
              <div className="flex flex-col items-center justify-center py-12 text-red-500">
                <Receipt size={24} className="mb-2 opacity-50" />
                <p className="text-sm font-medium">Failed to load expenses</p>
              </div>
            ) : !filtered.length ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Receipt size={28} className="mb-3 opacity-40" />
                <p className="text-sm">No expenses recorded</p>
                <button onClick={() => setShowAdd(true)} className="mt-2 text-xs text-blue-600 hover:underline font-medium">
                  Add first expense
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {filtered.map((e) => {
                  const m = CAT[e.category];
                  return (
                    <div key={e.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition">
                      <div className={`w-8 h-8 ${m.bg} rounded-xl flex items-center justify-center shrink-0`}>
                        <m.icon size={14} className={m.color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {e.description ?? m.label}
                        </p>
                        <p className="text-xs text-gray-400">{fmtDate(e.date)} · {m.label}</p>
                      </div>
                      <p className="text-sm font-bold text-red-600 shrink-0">{pkr(Number(e.amount))}</p>
                      {isOwner && (
                        <>
                          <button
                            onClick={() => setEditingExpense(e)}
                            className="p-2 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition shrink-0">
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm({ open: true, id: e.id })}
                            disabled={deleteMutation.isPending}
                            className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition disabled:opacity-40 shrink-0">
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {showAdd          && <AddModal prefill={addPrefill} onClose={() => { setShowAdd(false); setAddPrefill(undefined); }} />}
      {editingExpense   && <AddModal expense={editingExpense} onClose={() => setEditingExpense(null)} />}

      <ConfirmDialog
        open={deleteConfirm.open}
        title="Expense Delete Karo?"
        description="Ye expense hamesha ke liye delete ho jaegi. Ye action undo nahi ho sakta."
        confirmLabel="Delete Karo"
        variant="danger"
        isPending={deleteMutation.isPending}
        onConfirm={() => { if (deleteConfirm.id) deleteMutation.mutate(deleteConfirm.id); setDeleteConfirm({ open: false, id: null }); }}
        onCancel={() => setDeleteConfirm({ open: false, id: null })}
      />
    </div>
  );
}
