import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Receipt, Plus, Trash2, X, Loader2, ChevronLeft, ChevronRight,
  Home, Users, Zap, ShoppingCart, Wrench, Truck, MoreHorizontal,
} from 'lucide-react';
import { expensesApi, type ExpenseCategory, type Expense } from '../api/expenses.api.ts';
import { getErrorMessage } from '../utils/error.ts';

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
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
}
function monthBounds() {
  const now  = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { from, to };
}

// ── Add Expense Modal ──────────────────────────────────────────────────────────

function AddModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [category, setCategory] = useState<ExpenseCategory>('RENT');
  const [amount,   setAmount]   = useState('');
  const [desc,     setDesc]     = useState('');
  const [date,     setDate]     = useState(new Date().toISOString().slice(0, 10));

  const { mutate, isPending } = useMutation({
    mutationFn: () => {
      const amt = Number(amount);
      if (!amt || amt <= 0) throw new Error('Enter a valid amount');
      return expensesApi.create({ category, amount: amt, description: desc || undefined, date });
    },
    onSuccess: () => {
      toast.success('Expense recorded');
      qc.invalidateQueries({ queryKey: ['expenses'] });
      onClose();
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Failed to record expense')),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-gray-900">Record Expense</h2>
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
        </div>

        <button onClick={() => mutate()} disabled={!amount || isPending}
          className="w-full mt-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold rounded-xl text-sm transition flex items-center justify-center gap-2">
          {isPending ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : 'Record Expense'}
        </button>
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

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd]   = useState(false);
  const [filterCat, setFilter]  = useState<ExpenseCategory | 'ALL'>('ALL');
  const bounds = monthBounds();
  const [from, setFrom] = useState(bounds.from);
  const [to,   setTo]   = useState(bounds.to);

  const { data: expenses = [], isLoading, isError } = useQuery({
    queryKey: ['expenses', from, to],
    queryFn:  () => expensesApi.list(from, to),
  });

  const deleteMutation = useMutation({
    mutationFn: expensesApi.remove,
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['expenses'] }); toast.success('Expense removed'); },
    onError:    () => toast.error('Failed to remove expense'),
  });

  const filtered = filterCat === 'ALL' ? expenses : expenses.filter((e) => e.category === filterCat);
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
            {new Date(from + 'T12:00:00').toLocaleDateString('en-PK', { month: 'long', year: 'numeric' })}
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
        </div>

        {/* Right: list */}
        <div className="md:col-span-2">
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
                      <button
                        onClick={() => { if (confirm('Remove this expense?')) deleteMutation.mutate(e.id); }}
                        disabled={deleteMutation.isPending}
                        className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition disabled:opacity-40 shrink-0">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {showAdd && <AddModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}
