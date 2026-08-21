import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Receipt, Plus, Trash2, Pencil, X, Loader2, ChevronLeft, ChevronRight, Search,
  Home, Users, Zap, ShoppingCart, Wrench, Truck, MoreHorizontal, RefreshCw, Bell,
  Lock, Unlock, AlertTriangle, TrendingDown, CalendarDays, SlidersHorizontal,
} from 'lucide-react';
import { expensesApi, type ExpenseCategory, type Expense, type RecurringSuggestion, type FinancialPeriod } from '../api/expenses.api.ts';
import { sellersApi } from '../api/sellers.api.ts';
import { getErrorMessage } from '../utils/error.ts';
import { fmtDate, fmtMonthYear } from '../utils/dateFormat.ts';
import { useAuthStore } from '../store/auth.store.ts';
import ConfirmDialog from '../components/ui/ConfirmDialog.tsx';

// ── Category meta ──────────────────────────────────────────────────────────────

const CAT: Record<ExpenseCategory, {
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  bar: string;
  accent: string;
  text: string;
}> = {
  RENT:        { label:'Kiraya',     icon:Home,           color:'text-blue-600',    bg:'bg-blue-50',    bar:'bg-blue-500',    accent:'bg-blue-500/15 border-blue-500/30',   text:'text-blue-600'   },
  SALARY:      { label:'Tankhwa',    icon:Users,          color:'text-violet-600',  bg:'bg-violet-50',  bar:'bg-violet-500',  accent:'bg-violet-500/15 border-violet-500/30', text:'text-violet-600' },
  UTILITY:     { label:'Bijli/Gas',  icon:Zap,            color:'text-amber-600',   bg:'bg-amber-50',   bar:'bg-amber-500',   accent:'bg-amber-500/15 border-amber-500/30',  text:'text-amber-600'  },
  PURCHASE:    { label:'Maal/Purchase', icon:ShoppingCart, color:'text-emerald-600', bg:'bg-emerald-50', bar:'bg-emerald-500', accent:'bg-emerald-500/15 border-emerald-500/30', text:'text-emerald-600'},
  MAINTENANCE: { label:'Repair',     icon:Wrench,         color:'text-orange-600',  bg:'bg-orange-50',  bar:'bg-orange-500',  accent:'bg-orange-500/15 border-orange-500/30', text:'text-orange-600' },
  TRANSPORT:   { label:'Transport',  icon:Truck,          color:'text-cyan-600',    bg:'bg-cyan-50',    bar:'bg-cyan-500',    accent:'bg-cyan-500/15 border-cyan-500/30',    text:'text-cyan-600'   },
  OTHER:       { label:'Other',      icon:MoreHorizontal, color:'text-slate-600',   bg:'bg-slate-100',  bar:'bg-slate-400',   accent:'bg-slate-500/10 border-slate-400/30',  text:'text-slate-600'  },
};

const CATS = Object.keys(CAT) as ExpenseCategory[];

// ── Helpers ────────────────────────────────────────────────────────────────────

function pkr(v: number) {
  return 'Rs ' + v.toLocaleString('en-PK', { maximumFractionDigits: 0 });
}

function monthBounds() {
  const now  = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { from, to };
}

function navigateMonth(from: string, dir: 1 | -1): { from: string; to: string } {
  const d = new Date(from + 'T12:00:00');
  d.setMonth(d.getMonth() + dir);
  const y = d.getFullYear();
  const m = d.getMonth();
  return {
    from: `${y}-${String(m + 1).padStart(2, '0')}-01`,
    to:   new Date(y, m + 1, 0).toISOString().slice(0, 10),
  };
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const inp = 'w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition bg-white placeholder:text-slate-400 text-slate-900';

// ── Toggle ─────────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all ${checked ? 'bg-blue-500' : 'bg-slate-200'}`}>
      <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-4' : 'translate-x-0'}`}/>
    </button>
  );
}

// ── Add / Edit Modal ───────────────────────────────────────────────────────────

function AddModal({ onClose, expense, prefill }: {
  onClose: () => void;
  expense?: Expense;
  prefill?: Partial<{ category: ExpenseCategory; amount: string; description: string }>;
}) {
  const qc      = useQueryClient();
  const isEdit  = !!expense;
  const [category,     setCategory]     = useState<ExpenseCategory>(expense?.category ?? prefill?.category ?? 'RENT');
  const [amount,       setAmount]       = useState(expense ? String(Number(expense.amount)) : prefill?.amount ?? '');
  const [desc,         setDesc]         = useState(expense?.description ?? prefill?.description ?? '');
  const [date,         setDate]         = useState(expense ? expense.date.slice(0, 10) : new Date().toISOString().slice(0, 10));
  const [isRecurring,  setIsRecurring]  = useState(expense?.isRecurring ?? false);
  const [recurrenceDay,setRecurrenceDay]= useState(String(expense?.recurrenceDay ?? 1));

  const { mutate, isPending } = useMutation({
    mutationFn: () => {
      const amt = Number(amount);
      if (!amt || amt <= 0) throw new Error('Valid amount daalo');
      return isEdit
        ? expensesApi.update(expense.id, { category, amount: amt, description: desc || undefined, date, isRecurring, recurrenceDay: Number(recurrenceDay) })
        : expensesApi.create({ category, amount: amt, description: desc || undefined, date, isRecurring, recurrenceDay: Number(recurrenceDay) });
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Expense update hua' : 'Expense record hua');
      void qc.invalidateQueries({ queryKey: ['expenses'] });
      void qc.invalidateQueries({ queryKey: ['recurring-suggestions'] });
      onClose();
    },
    onError: (e) => toast.error(getErrorMessage(e, isEdit ? 'Update nahi hua' : 'Record nahi hua')),
  });

  const m = CAT[category];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Modal header */}
        <div className={`px-6 py-4 flex items-center justify-between ${m.bg} border-b border-black/5`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 bg-white/70 rounded-xl flex items-center justify-center ring-1 ring-white/50`}>
              <m.icon size={15} className={m.color}/>
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900">{isEdit ? 'Expense Edit Karo' : 'Naya Expense'}</h2>
              <p className="text-xs text-slate-500">{m.label} category selected</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-white/50 rounded-xl transition"><X size={15}/></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Category picker */}
          <div>
            <label className="block text-xs font-black text-slate-500 uppercase tracking-wide mb-2">Category</label>
            <div className="grid grid-cols-4 gap-2">
              {CATS.map((c) => {
                const meta = CAT[c]; const sel = category === c;
                return (
                  <button key={c} type="button" onClick={() => setCategory(c)}
                    className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition text-[10px] font-black ${
                      sel ? `${meta.bg} ${meta.color} border-current shadow-sm` : 'border-slate-100 text-slate-400 hover:border-slate-200 hover:bg-slate-50'
                    }`}>
                    <meta.icon size={16}/>
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount + Date row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-wide mb-1.5">Amount (PKR) *</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">Rs</span>
                <input type="number" min="1" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus
                  className={`${inp} pl-8`}/>
              </div>
            </div>
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-wide mb-1.5">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inp}/>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-black text-slate-500 uppercase tracking-wide mb-1.5">Notes (optional)</label>
            <input type="text" placeholder="e.g. June rent, HBL transfer" value={desc} onChange={(e) => setDesc(e.target.value)} className={inp}/>
          </div>

          {/* Recurring */}
          <div className="flex items-center justify-between gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex items-center gap-2.5">
              <RefreshCw size={13} className="text-slate-400 shrink-0"/>
              <div>
                <p className="text-xs font-black text-slate-700">Recurring expense</p>
                <p className="text-[10px] text-slate-400">Har mahine suggest karega</p>
              </div>
            </div>
            <Toggle checked={isRecurring} onChange={setIsRecurring}/>
          </div>
          {isRecurring && (
            <div className="flex items-center gap-3">
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-wide mb-1.5">Mahine ki tarikh</label>
                <input type="number" value={recurrenceDay} onChange={(e) => setRecurrenceDay(e.target.value)} min="1" max="31" placeholder="1"
                  className={`${inp} w-20 text-center`}/>
              </div>
              <p className="text-xs text-slate-400 mt-4">
                Har mahine <span className="font-black text-slate-700">{recurrenceDay || '1'}</span> tarikh ko suggest hoga
              </p>
            </div>
          )}
        </div>

        <div className="px-6 pb-6">
          <button onClick={() => mutate()} disabled={!amount || isPending}
            className={`w-full py-3 font-black text-sm rounded-xl transition flex items-center justify-center gap-2 ${
              amount ? `${m.bar} text-white shadow-sm hover:opacity-90` : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}>
            {isPending ? <><Loader2 size={14} className="animate-spin"/> Saving…</> : isEdit ? 'Save Changes' : 'Record Expense'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Recurring Suggestions ──────────────────────────────────────────────────────

function RecurringSuggestionsCard({ onAddExpense }: { onAddExpense: (s: RecurringSuggestion) => void }) {
  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ['recurring-suggestions'],
    queryFn:  expensesApi.getRecurringSuggestions,
    staleTime: 5 * 60_000,
  });

  if (isLoading || suggestions.length === 0) return null;
  const monthName = new Date().toLocaleString('en-PK', { month: 'long' });

  return (
    <div className="mx-4 sm:mx-6 mt-4">
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-7 h-7 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
            <Bell size={13} className="text-amber-600"/>
          </div>
          <p className="text-xs font-black text-amber-800">
            {suggestions.length} recurring expense{suggestions.length > 1 ? 's' : ''} — {monthName} mein log nahi hua
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {suggestions.map((s) => {
            const meta = CAT[s.category as ExpenseCategory];
            return (
              <div key={s.id} className="flex items-center gap-3 bg-white rounded-xl px-3 py-2.5 border border-amber-100">
                <div className={`w-8 h-8 ${meta.bg} rounded-xl flex items-center justify-center shrink-0`}>
                  <meta.icon size={13} className={meta.color}/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-slate-900 truncate">
                    {meta.label}{s.description ? ` — ${s.description}` : ''}
                  </p>
                  <p className="text-[10px] text-slate-400 tabular-nums">Rs {Number(s.amount).toLocaleString()} · Din {s.recurrenceDay}</p>
                </div>
                <button onClick={() => onAddExpense(s)}
                  className="shrink-0 px-3 py-1.5 text-[11px] font-black text-amber-700 border border-amber-300 rounded-lg hover:bg-amber-100 transition">
                  Add
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Category Breakdown ─────────────────────────────────────────────────────────

function CategoryBreakdown({ expenses }: { expenses: Expense[] }) {
  const byCategory = CATS.map((cat) => ({
    cat,
    total: expenses.filter((e) => e.category === cat).reduce((s, e) => s + Number(e.amount), 0),
  })).filter((c) => c.total > 0).sort((a, b) => b.total - a.total);

  if (!byCategory.length) return null;
  const max   = byCategory[0]!.total;
  const grand = byCategory.reduce((s, c) => s + c.total, 0);

  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2.5">
        <div className="w-7 h-7 bg-slate-50 rounded-lg flex items-center justify-center ring-1 ring-slate-100">
          <TrendingDown size={13} className="text-slate-500"/>
        </div>
        <p className="text-xs font-black text-slate-700 uppercase tracking-wide">Category Breakdown</p>
      </div>
      <div className="p-5 space-y-3.5">
        {byCategory.map(({ cat, total }) => {
          const m = CAT[cat];
          const pct = grand > 0 ? Math.round((total / grand) * 100) : 0;
          return (
            <div key={cat}>
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className={`w-7 h-7 ${m.bg} rounded-lg flex items-center justify-center shrink-0 ring-1 ring-black/5`}>
                  <m.icon size={12} className={m.color}/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-xs font-black text-slate-800 truncate">{m.label}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-slate-400 tabular-nums">{pct}%</span>
                      <span className="text-xs font-black text-slate-800 tabular-nums">{pkr(total)}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${m.bar}`}
                      style={{ width: `${(total / max) * 100}%` }}/>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Budget Progress ────────────────────────────────────────────────────────────

function BudgetProgress({ expenses, budgets }: {
  expenses: Expense[];
  budgets: Partial<Record<ExpenseCategory, number>>;
}) {
  const cats = (Object.keys(budgets) as ExpenseCategory[]).filter((c) => (budgets[c] ?? 0) > 0);
  if (!cats.length) return null;

  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2.5">
        <div className="w-7 h-7 bg-slate-50 rounded-lg flex items-center justify-center ring-1 ring-slate-100">
          <SlidersHorizontal size={13} className="text-slate-500"/>
        </div>
        <p className="text-xs font-black text-slate-700 uppercase tracking-wide">Monthly Budgets</p>
      </div>
      <div className="p-5 space-y-4">
        {cats.map((cat) => {
          const budget    = budgets[cat]!;
          const spent     = expenses.filter((e) => e.category === cat).reduce((s, e) => s + Number(e.amount), 0);
          const pct       = Math.min(Math.round((spent / budget) * 100), 100);
          const over      = spent > budget;
          const m         = CAT[cat];
          const barColor  = over ? 'bg-red-500' : pct >= 80 ? 'bg-amber-400' : m.bar;
          return (
            <div key={cat}>
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className={`w-7 h-7 ${m.bg} rounded-lg flex items-center justify-center shrink-0 ring-1 ring-black/5`}>
                  <m.icon size={12} className={m.color}/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-slate-800">{m.label}</span>
                    <span className={`text-xs font-black tabular-nums ${over ? 'text-red-600' : 'text-slate-600'}`}>
                      {pct}%
                    </span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                      style={{ width: `${pct}%` }}/>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className={`text-[10px] font-medium tabular-nums ${over ? 'text-red-600' : 'text-slate-400'}`}>
                      {over ? `+${pkr(spent - budget)} over` : pkr(spent)}
                    </span>
                    <span className="text-[10px] text-slate-400 tabular-nums">/ {pkr(budget)}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Period Lock Panel ──────────────────────────────────────────────────────────

function PeriodLockPanel({ periods, viewedYear, viewedMonth, isOwner, onLock, onUnlock, isLocking, isUnlocking }: {
  periods: FinancialPeriod[];
  viewedYear: number; viewedMonth: number;
  isOwner: boolean;
  onLock: () => void;
  onUnlock: (year: number, month: number) => void;
  isLocking: boolean; isUnlocking: boolean;
}) {
  const isCurrentLocked = periods.some((p) => p.year === viewedYear && p.month === viewedMonth);

  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-slate-50 rounded-lg flex items-center justify-center ring-1 ring-slate-100">
            <Lock size={13} className="text-slate-500"/>
          </div>
          <p className="text-xs font-black text-slate-700 uppercase tracking-wide">Period Locks</p>
        </div>
        {isOwner && !isCurrentLocked && (
          <button onClick={onLock} disabled={isLocking}
            className="flex items-center gap-1.5 text-[11px] font-black text-amber-700 border border-amber-200 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-xl transition disabled:opacity-40">
            {isLocking ? <Loader2 size={10} className="animate-spin"/> : <Lock size={10}/>}
            Lock {MONTH_NAMES[viewedMonth - 1]}
          </button>
        )}
      </div>
      <div className="p-5">
        {periods.length === 0 ? (
          <p className="text-xs text-slate-400">Koi period lock nahi hai.</p>
        ) : (
          <div className="space-y-2">
            {periods.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-amber-50 border border-amber-100 rounded-xl">
                <div className="flex items-center gap-2">
                  <Lock size={11} className="text-amber-600 shrink-0"/>
                  <span className="text-xs font-black text-amber-900">{MONTH_NAMES[p.month - 1]} {p.year}</span>
                </div>
                {isOwner && (
                  <button onClick={() => onUnlock(p.year, p.month)} disabled={isUnlocking}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition disabled:opacity-40 font-medium">
                    <Unlock size={10}/> Unlock
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── KPI Card ───────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, accent = false }: {
  label: string; value: string; sub?: string; accent?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm p-4">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-xl font-black tabular-nums leading-tight ${accent ? 'text-red-600' : 'text-slate-900'}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const qc = useQueryClient();
  const { user }  = useAuthStore();
  const isOwner   = user?.role === 'SELLER_OWNER';
  const [showAdd,        setShowAdd]        = useState(false);
  const [addPrefill,     setAddPrefill]     = useState<Partial<{ category: ExpenseCategory; amount: string; description: string }> | undefined>();
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deleteConfirm,  setDeleteConfirm]  = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [filterCat, setFilter]   = useState<ExpenseCategory | 'ALL'>('ALL');
  const [search,    setSearch]   = useState('');
  const [showRange, setShowRange]= useState(false);

  const bounds = monthBounds();
  const [from, setFrom] = useState(bounds.from);
  const [to,   setTo]   = useState(bounds.to);

  const viewedYear  = parseInt(from.slice(0, 4));
  const viewedMonth = parseInt(from.slice(5, 7));

  const { data: expenses = [], isLoading, isError } = useQuery({
    queryKey: ['expenses', from, to],
    queryFn:  () => expensesApi.list(from, to),
  });

  const { data: lockedPeriods = [] } = useQuery({
    queryKey: ['financial-periods'],
    queryFn:  expensesApi.listPeriods,
    enabled:  isOwner,
    staleTime: 60_000,
  });

  const isViewedMonthLocked = lockedPeriods.some((p) => p.year === viewedYear && p.month === viewedMonth);

  function isExpenseLocked(expense: Expense) {
    const d = new Date(expense.date);
    return lockedPeriods.some((p) => p.year === d.getFullYear() && p.month === d.getMonth() + 1);
  }

  const lockMutation = useMutation({
    mutationFn: () => expensesApi.lockPeriod(viewedYear, viewedMonth),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['financial-periods'] }); toast.success(`${MONTH_NAMES[viewedMonth - 1]} ${viewedYear} lock ho gaya`); },
    onError:    () => toast.error('Lock nahi ho saka'),
  });

  const unlockMutation = useMutation({
    mutationFn: ({ year, month }: { year: number; month: number }) => expensesApi.unlockPeriod(year, month),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['financial-periods'] }); toast.success('Period unlock ho gaya'); },
    onError:    () => toast.error('Unlock nahi ho saka'),
  });

  const { data: shop } = useQuery({ queryKey: ['shop-me'], queryFn: sellersApi.getMe, staleTime: 5 * 60_000 });
  const budgets = (shop?.settings?.expenseBudgets ?? {}) as Partial<Record<ExpenseCategory, number>>;

  const deleteMutation = useMutation({
    mutationFn: expensesApi.remove,
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['expenses'] }); toast.success('Expense delete hua'); },
    onError:    (e) => toast.error(getErrorMessage(e, 'Delete nahi hua')),
  });

  const byCat    = filterCat === 'ALL' ? expenses : expenses.filter((e) => e.category === filterCat);
  const filtered = search.trim()
    ? byCat.filter((e) =>
        (e.description ?? '').toLowerCase().includes(search.toLowerCase()) ||
        CAT[e.category].label.toLowerCase().includes(search.toLowerCase())
      )
    : byCat;

  const totalSpent  = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalBudget = Object.values(budgets).reduce<number>((s, v) => s + (v ?? 0), 0);
  const budgetPct   = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : null;

  return (
    <div className="flex flex-col min-h-full">

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-20 bg-slate-950 border-b border-white/5 h-16 flex items-center px-4 sm:px-6 shrink-0 gap-3">

        {/* Title */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
            <Receipt size={15} className="text-white"/>
          </div>
          <div className="hidden sm:block">
            <h1 className="text-sm font-black text-white leading-tight">Kharajat</h1>
            <p className="text-[11px] text-slate-500 leading-tight">Expenses & outflows</p>
          </div>
        </div>

        {/* Month navigator */}
        <div className="flex items-center gap-1 bg-white/5 rounded-xl border border-white/10 px-1 py-1 shrink-0">
          <button onClick={() => { const n = navigateMonth(from, -1); setFrom(n.from); setTo(n.to); }}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/15 text-slate-400 hover:text-white transition">
            <ChevronLeft size={14}/>
          </button>
          <span className="text-xs font-black text-white px-2 min-w-[7rem] text-center tabular-nums">
            {fmtMonthYear(new Date(from + 'T12:00:00'))}
          </span>
          <button onClick={() => { const n = navigateMonth(from, 1); setFrom(n.from); setTo(n.to); }}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/15 text-slate-400 hover:text-white transition">
            <ChevronRight size={14}/>
          </button>
        </div>

        {/* Right: lock + buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {isViewedMonthLocked && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/15 rounded-lg border border-amber-500/20">
              <Lock size={10} className="text-amber-400"/>
              <span className="text-[10px] font-black text-amber-400">Locked</span>
            </div>
          )}
          <button onClick={() => setShowRange(v => !v)}
            className={`w-8 h-8 flex items-center justify-center rounded-xl transition ${showRange ? 'bg-white/20 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'}`}
            title="Custom date range">
            <CalendarDays size={14}/>
          </button>
          <button onClick={() => { setFrom(bounds.from); setTo(bounds.to); }}
            className="hidden md:flex text-[11px] text-slate-400 hover:text-white font-medium transition px-2">
            This month
          </button>
          <button onClick={() => setShowAdd(true)} disabled={isViewedMonthLocked}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-black rounded-xl transition shadow-sm shadow-blue-900/50">
            <Plus size={13}/> <span className="hidden sm:inline">Expense</span>
          </button>
        </div>
      </div>

      {/* Custom date range (collapsible) */}
      {showRange && (
        <div className="bg-slate-900 border-b border-white/5 px-4 sm:px-6 py-3 flex items-center gap-3 flex-wrap">
          <span className="text-xs text-slate-400 font-medium shrink-0">Custom range:</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="bg-slate-800 border border-white/10 text-white text-xs rounded-xl px-3 py-2 outline-none focus:border-blue-400"/>
          <span className="text-slate-600 text-xs">to</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="bg-slate-800 border border-white/10 text-white text-xs rounded-xl px-3 py-2 outline-none focus:border-blue-400"/>
        </div>
      )}

      {/* Page body */}
      <div className="flex-1 bg-[#F0F2F8]">

        {/* Lock banner */}
        {isViewedMonthLocked && (
          <div className="px-4 sm:px-6 pt-4">
            <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl">
              <Lock size={13} className="text-amber-600 shrink-0"/>
              <p className="text-sm text-amber-800 flex-1">
                <strong>{MONTH_NAMES[viewedMonth - 1]} {viewedYear}</strong> lock hai — is mahine mein changes nahi ho sakte.
                {isOwner && (
                  <button onClick={() => unlockMutation.mutate({ year: viewedYear, month: viewedMonth })}
                    disabled={unlockMutation.isPending}
                    className="ml-2 font-black underline hover:no-underline transition disabled:opacity-50">
                    {unlockMutation.isPending ? 'Unlocking…' : 'Unlock karo'}
                  </button>
                )}
              </p>
              <AlertTriangle size={13} className="text-amber-500 shrink-0"/>
            </div>
          </div>
        )}

        {/* Recurring suggestions */}
        <RecurringSuggestionsCard onAddExpense={(s) => {
          setAddPrefill({ category: s.category as ExpenseCategory, amount: String(Number(s.amount)), description: s.description ?? '' });
          setShowAdd(true);
        }}/>

        {/* KPI row */}
        <div className="px-4 sm:px-6 pt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Total Kharajat" value={pkr(totalSpent)} sub={`${expenses.length} transactions`} accent/>
          <KpiCard label="Is Filter Mein" value={filtered.length === expenses.length ? 'Sab' : `${filtered.length} items`} sub={filtered.length !== expenses.length ? pkr(filtered.reduce((s,e)=>s+Number(e.amount),0)) : undefined}/>
          {budgetPct !== null && (
            <KpiCard label="Budget Spent" value={`${budgetPct}%`} sub={`${pkr(totalSpent)} / ${pkr(totalBudget)}`} accent={budgetPct >= 90}/>
          )}
          {budgetPct !== null && totalBudget > totalSpent && (
            <KpiCard label="Budget Bacha" value={pkr(totalBudget - totalSpent)} sub="Abhi baaki hai"/>
          )}
          {budgetPct === null && (
            <div className="col-span-2 bg-white/50 rounded-2xl ring-1 ring-slate-200 p-4 flex items-center gap-3">
              <SlidersHorizontal size={16} className="text-slate-300 shrink-0"/>
              <p className="text-xs text-slate-400">
                Budget limits set karo <a href="/settings" className="text-blue-500 font-black hover:underline">Settings → Targets</a> mein
              </p>
            </div>
          )}
        </div>

        {/* Main 2-col grid */}
        <div className="px-4 sm:px-6 py-5 grid grid-cols-1 lg:grid-cols-[300px_1fr] xl:grid-cols-[340px_1fr] gap-5 items-start">

          {/* ── Left sidebar ── */}
          <div className="space-y-4">
            {isLoading
              ? <div className="h-48 bg-white rounded-2xl ring-1 ring-slate-200 animate-pulse"/>
              : <CategoryBreakdown expenses={expenses}/>
            }
            <BudgetProgress expenses={expenses} budgets={budgets}/>
            {isOwner && (
              <PeriodLockPanel
                periods={lockedPeriods}
                viewedYear={viewedYear}
                viewedMonth={viewedMonth}
                isOwner={isOwner}
                onLock={() => lockMutation.mutate()}
                onUnlock={(y, m) => unlockMutation.mutate({ year: y, month: m })}
                isLocking={lockMutation.isPending}
                isUnlocking={unlockMutation.isPending}
              />
            )}
          </div>

          {/* ── Right: list ── */}
          <div className="min-w-0 space-y-3">

            {/* Search + filter */}
            <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm p-4 space-y-3">
              <div className="relative">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Description ya category search karo…"
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 bg-white transition"/>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => setFilter('ALL')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition ${filterCat === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  Sab ({expenses.length})
                </button>
                {CATS.filter((c) => expenses.some((e) => e.category === c)).map((c) => {
                  const meta = CAT[c]; const active = filterCat === c;
                  const count = expenses.filter((e) => e.category === c).length;
                  return (
                    <button key={c} onClick={() => setFilter(c)}
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition ${active ? `${meta.bg} ${meta.color} ring-1 ring-current` : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                      <meta.icon size={10}/> {meta.label}
                      <span className="opacity-60">({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Expense list */}
            <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden">
              {isLoading ? (
                <div className="divide-y divide-slate-50">
                  {[1,2,3,4,5].map((i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                      <div className="w-10 h-10 bg-slate-100 rounded-xl animate-pulse shrink-0"/>
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3.5 bg-slate-100 rounded-full animate-pulse w-2/3"/>
                        <div className="h-2.5 bg-slate-50 rounded-full animate-pulse w-1/3"/>
                      </div>
                      <div className="h-4 bg-slate-100 rounded-full animate-pulse w-20"/>
                    </div>
                  ))}
                </div>
              ) : isError ? (
                <div className="flex flex-col items-center justify-center py-16 text-red-500">
                  <Receipt size={28} className="mb-3 opacity-50"/>
                  <p className="text-sm font-bold">Data load nahi hua</p>
                </div>
              ) : !filtered.length ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <Receipt size={32} className="mb-3 opacity-20"/>
                  <p className="text-sm font-bold text-slate-500">Koi expense nahi</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {search || filterCat !== 'ALL' ? 'Filter change karo' : 'Pehla expense record karo'}
                  </p>
                  {!search && filterCat === 'ALL' && !isViewedMonthLocked && (
                    <button onClick={() => setShowAdd(true)}
                      className="mt-3 px-4 py-2 bg-blue-600 text-white text-xs font-black rounded-xl hover:bg-blue-700 transition">
                      Add Expense
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {/* List header */}
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wide">
                      {filtered.length} entries
                    </p>
                    <p className="text-[10px] font-black text-red-500 uppercase tracking-wide tabular-nums">
                      {pkr(filtered.reduce((s, e) => s + Number(e.amount), 0))}
                    </p>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {filtered.map((e) => {
                      const meta   = CAT[e.category];
                      const locked = isExpenseLocked(e);
                      return (
                        <div key={e.id}
                          className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition group">
                          {/* Category icon */}
                          <div className={`w-10 h-10 ${meta.bg} rounded-xl flex items-center justify-center shrink-0 ring-1 ring-black/5`}>
                            <meta.icon size={15} className={meta.color}/>
                          </div>

                          {/* Description + meta */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-sm font-black text-slate-900 truncate">
                                {e.description ?? meta.label}
                              </p>
                              {e.isRecurring && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded border border-blue-100 shrink-0">
                                  <RefreshCw size={8}/> recurring
                                </span>
                              )}
                              {locked && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded border border-amber-100 shrink-0">
                                  <Lock size={8}/> locked
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {fmtDate(e.date)}
                              {e.description ? <span className="ml-1.5 text-slate-300">·</span> : ''}
                              {e.description && <span className="ml-1.5">{meta.label}</span>}
                            </p>
                          </div>

                          {/* Amount */}
                          <p className="text-sm font-black text-red-600 tabular-nums shrink-0">
                            {pkr(Number(e.amount))}
                          </p>

                          {/* Actions */}
                          {isOwner && (
                            <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-all">
                              <button onClick={() => setEditingExpense(e)} disabled={locked}
                                title={locked ? 'Period lock hai' : 'Edit'}
                                className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition disabled:opacity-20 disabled:cursor-not-allowed">
                                <Pencil size={13}/>
                              </button>
                              <button onClick={() => setDeleteConfirm({ open: true, id: e.id })}
                                disabled={deleteMutation.isPending || locked}
                                title={locked ? 'Period lock hai' : 'Delete'}
                                className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition disabled:opacity-20 disabled:cursor-not-allowed">
                                <Trash2 size={13}/>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showAdd && (
        <AddModal prefill={addPrefill} onClose={() => { setShowAdd(false); setAddPrefill(undefined); }}/>
      )}
      {editingExpense && (
        <AddModal expense={editingExpense} onClose={() => setEditingExpense(null)}/>
      )}
      <ConfirmDialog
        open={deleteConfirm.open}
        title="Expense Delete Karo?"
        description="Ye expense hamesha ke liye delete ho jaegi. Undo nahi ho sakta."
        confirmLabel="Delete Karo"
        variant="danger"
        isPending={deleteMutation.isPending}
        onConfirm={() => { if (deleteConfirm.id) deleteMutation.mutate(deleteConfirm.id); setDeleteConfirm({ open: false, id: null }); }}
        onCancel={() => setDeleteConfirm({ open: false, id: null })}
      />
    </div>
  );
}
