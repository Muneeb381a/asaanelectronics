import { useState, type ElementType } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  CreditCard, Package, ArrowRight, BarChart3, Users, Zap,
  ShoppingCart, Bell, Target, Gift, Clock, PhoneCall,
  Wallet, CheckCircle, Send, X, TrendingUp,
} from 'lucide-react';
import { useAuthStore } from '../store/auth.store.ts';
import { statsApi } from '../api/stats.api.ts';
import { recoveryApi } from '../api/recovery.api.ts';
import { sellersApi } from '../api/sellers.api.ts';
import { customersApi } from '../api/customers.api.ts';
import { handoversApi, type StaffBalance } from '../api/handovers.api.ts';
import { RowSkeleton } from '../components/ui/Skeleton.tsx';
import { fmtDate } from '../utils/dateFormat.ts';

function pkr(v: number) {
  return 'PKR ' + v.toLocaleString('en-PK', { maximumFractionDigits: 0 });
}
function pkrShort(v: number) {
  if (v >= 100_000) return `${(v / 100_000).toFixed(v % 100_000 === 0 ? 0 : 1)}L`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(v % 1_000 === 0 ? 0 : 1)}K`;
  return String(v);
}
function greet() {
  const h = new Date().getHours();
  if (h < 12) return 'Subah Bakhair';
  if (h < 17) return 'Adaab';
  return 'Shaam Bakhair';
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE:    'bg-emerald-100 text-emerald-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
  DEFAULTED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-slate-100 text-slate-500',
};

/* ── skeleton while hero data loads ── */
function HeroSkeleton() {
  return (
    <div className="bg-[#080C14] px-4 sm:px-6 lg:px-8 py-6 animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {[0,1,2,3].map(i => (
          <div key={i} className="space-y-2">
            <div className="h-2 bg-white/10 rounded w-14" />
            <div className="h-9 bg-white/10 rounded w-20" />
            <div className="h-2 bg-white/5 rounded w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── cash handover confirm modal ── */
function CashReceiveModal({ target, onClose }: { target: StaffBalance; onClose: () => void }) {
  const qc  = useQueryClient();
  const sys = Number(target.pendingBalance);
  const [amt, setAmt]   = useState(target.pendingHandover ? target.pendingHandover.handedAmount : String(sys));
  const [note, setNote] = useState('');

  const mut = useMutation({
    mutationFn: () => handoversApi.directReceive({ staffId: target.staffId, amount: Number(amt), note: note.trim() || undefined }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['handover-pending-balances'] });
      void qc.invalidateQueries({ queryKey: ['handovers'] });
      toast.success(`${target.staffName} se ${pkr(Number(amt))} receive ho gaya`);
      onClose();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Masla ho gaya'),
  });

  const diff = Number(amt) - sys;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-black text-slate-900">Cash Receive</h2>
            <p className="text-xs text-slate-400 mt-0.5">{target.staffName}</p>
          </div>
          <button onClick={onClose}><X size={16} className="text-slate-400 hover:text-slate-700" /></button>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
          <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wide">System Balance</p>
          <p className="text-2xl font-black text-blue-700 tabular-nums">{pkr(sys)}</p>
        </div>
        {target.pendingHandover && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
            <p className="text-[10px] text-amber-500 font-bold uppercase tracking-wide">Staff ka submit</p>
            <p className="text-xl font-black text-amber-700 tabular-nums">{pkr(Number(target.pendingHandover.handedAmount))}</p>
          </div>
        )}
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1.5">Gina hua (PKR) *</label>
          <input type="number" value={amt} onChange={e => setAmt(e.target.value)} min="0"
            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-emerald-400 transition tabular-nums" />
          {Number(amt) !== sys && Math.abs(diff) >= 1 && (
            <p className={`text-xs mt-1 font-bold ${diff < 0 ? 'text-red-500' : 'text-amber-600'}`}>
              {diff < 0 ? `${pkr(Math.abs(diff))} kam` : `${pkr(diff)} zyada`}
            </p>
          )}
        </div>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Note (optional)"
          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm resize-none outline-none focus:border-emerald-400 transition" />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-bold border border-slate-200 rounded-xl hover:bg-slate-50 transition">Cancel</button>
          <button onClick={() => mut.mutate()} disabled={!amt || Number(amt) < 0 || mut.isPending}
            className="flex-1 py-2.5 text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-1.5">
            {mut.isPending ? 'Processing…' : <><CheckCircle size={14}/> Li</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════ MAIN PAGE ════════════════════════ */
export default function DashboardPage() {
  const user     = useAuthStore(s => s.user);
  const navigate = useNavigate();
  const isOwner  = user?.role === 'SELLER_OWNER';
  const qc       = useQueryClient();
  const perms    = user?.permissions as Record<string, boolean> | null | undefined;

  const [showHandover, setShowHandover]   = useState(false);
  const [handoverAmt, setHandoverAmt]     = useState('');
  const [handoverNote, setHandoverNote]   = useState('');
  const [receiveTarget, setReceiveTarget] = useState<StaffBalance | null>(null);

  /* queries */
  const { data: myBal } = useQuery<StaffBalance | null>({
    queryKey: ['handover-my-balance'], queryFn: () => handoversApi.myBalance(),
    enabled: !isOwner, staleTime: 30_000, refetchInterval: 120_000,
  });
  const { data: pendingBals = [] } = useQuery<StaffBalance[]>({
    queryKey: ['handover-pending-balances'], queryFn: handoversApi.pendingBalances,
    enabled: isOwner, staleTime: 30_000, refetchInterval: 120_000,
  });
  const submitHandover = useMutation({
    mutationFn: () => handoversApi.create({ handedAmount: Number(handoverAmt), note: handoverNote.trim() || undefined }),
    onSuccess: () => { setShowHandover(false); setHandoverAmt(''); setHandoverNote(''); void qc.invalidateQueries({ queryKey: ['handover-my-balance'] }); },
  });
  const { data: dash, isLoading } = useQuery({
    queryKey: ['dashboard'], queryFn: statsApi.getDashboard,
    staleTime: 60_000, gcTime: 5 * 60_000, refetchInterval: 5 * 60_000,
  });
  const { data: briefing } = useQuery({
    queryKey: ['daily-briefing'], queryFn: statsApi.getDailyBriefing,
    staleTime: 60_000, gcTime: 5 * 60_000, refetchInterval: 5 * 60_000,
  });
  const pDueCount = dash?.stats?.promisesDueCount ?? 0;
  const { data: promises = [] } = useQuery({
    queryKey: ['promises-due'], queryFn: recoveryApi.promisesDue,
    enabled: pDueCount > 0, staleTime: 60_000,
  });
  const { data: shop }      = useQuery({ queryKey: ['shop-me'],           queryFn: sellersApi.getMe,                staleTime: 5 * 60_000, enabled: isOwner });
  const { data: birthdays = [] } = useQuery({ queryKey: ['upcoming-birthdays'], queryFn: customersApi.getUpcomingBirthdays, staleTime: 60 * 60_000 });

  /* derived */
  const d          = dash?.stats;
  const today      = fmtDate(new Date());
  const todayTotal = (d?.todayCollections ?? 0) + (d?.todayCashSales ?? 0);
  const monthTotal = (d?.monthCollections ?? 0) + (d?.monthCashSales ?? 0);
  const lowStock   = d?.lowStockItems ?? [];
  const staffCash  = pendingBals.filter(s => Number(s.pendingBalance) > 0);
  const fieldTotal = staffCash.reduce((a, s) => a + Number(s.pendingBalance), 0);

  /* quick action buttons */
  const actions = [
    isOwner || perms?.canAddInstallment ? { label: 'Installment', icon: CreditCard,   cls: 'text-blue-600',    bg: 'bg-blue-50',    to: '/installments' } : null,
    isOwner || perms?.canAddCustomer    ? { label: 'Customer',    icon: Users,        cls: 'text-violet-600',  bg: 'bg-violet-50',  to: '/customers'    } : null,
    isOwner || perms?.canMakeCashSales  ? { label: 'Cash Sale',   icon: ShoppingCart, cls: 'text-emerald-600', bg: 'bg-emerald-50', to: '/cash-sales'   } : null,
    isOwner || perms?.canRecordExpense  ? { label: 'Expense',     icon: Zap,          cls: 'text-rose-600',    bg: 'bg-rose-50',    to: '/expenses'     } : null,
    isOwner || perms?.canManageProducts ? { label: 'Products',    icon: Package,      cls: 'text-amber-600',   bg: 'bg-amber-50',   to: '/products'     } : null,
  ].filter(Boolean) as { label: string; icon: ElementType; cls: string; bg: string; to: string }[];

  /* ── sidebar widgets ── */
  const FieldCashWidget = isOwner && staffCash.length > 0 ? (
    <div className="bg-white rounded-2xl ring-1 ring-amber-200/80 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50 border-b border-amber-100">
        <div className="flex items-center gap-2"><Wallet size={13} className="text-amber-600" /><p className="text-xs font-black text-amber-800">Cash in Field</p></div>
        <p className="text-sm font-black text-amber-700 tabular-nums">{pkr(fieldTotal)}</p>
      </div>
      {staffCash.map(s => (
        <div key={s.staffId} className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-50 last:border-0">
          <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center text-[11px] font-black text-slate-600 shrink-0">{s.staffName[0]?.toUpperCase()}</div>
          <p className="text-xs font-bold text-slate-800 flex-1 truncate">{s.staffName}</p>
          <p className="text-xs font-black tabular-nums text-slate-900 shrink-0">{pkr(Number(s.pendingBalance))}</p>
          <button onClick={() => setReceiveTarget(s)} className={`shrink-0 text-[11px] font-black px-2.5 py-1 rounded-lg transition ${s.pendingHandover ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}>
            {s.pendingHandover ? 'Confirm' : 'Li'}
          </button>
        </div>
      ))}
    </div>
  ) : null;

  const CompletingSoon = isOwner && d && d.completingSoon.length > 0 ? (
    <div className="bg-white rounded-2xl ring-1 ring-slate-200/80 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-100">
        <div className="flex items-center gap-2"><CheckCircle size={13} className="text-emerald-600" /><p className="text-xs font-black text-slate-700">Khatam Hone Wale</p></div>
        <span className="text-[10px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{d.completingSoon.length}</span>
      </div>
      {d.completingSoon.map(c => {
        const pill = c.paymentsLeft === 1 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700';
        const wa   = `https://wa.me/92${c.customerPhone.replace(/^0/,'').replace(/\D/g,'')}?text=${encodeURIComponent(`Assalam-o-Alaikum ${c.customerName}! Sirf ${c.paymentsLeft} installment aur baaki hai.`)}`;
        return (
          <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-50 last:border-0">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-bold text-slate-900 truncate">{c.customerName}</p>
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0 ${pill}`}>{c.paymentsLeft}</span>
              </div>
              <p className="text-[10px] text-slate-400 truncate">{c.productName}</p>
            </div>
            <a href={wa} target="_blank" rel="noopener noreferrer" className="shrink-0 text-[11px] font-black text-white bg-emerald-500 hover:bg-emerald-600 px-2.5 py-1 rounded-lg transition">WA</a>
          </div>
        );
      })}
    </div>
  ) : null;

  const LowStockWidget = lowStock.length > 0 ? (
    <div className="bg-white rounded-2xl ring-1 ring-amber-200/80 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50 border-b border-amber-100">
        <div className="flex items-center gap-2"><Package size={13} className="text-amber-600" /><p className="text-xs font-black text-amber-800">Kam Stock</p></div>
        <button onClick={() => navigate('/products')} className="text-[11px] text-amber-700 font-black hover:underline">Manage</button>
      </div>
      <div className="px-4 py-3 flex flex-wrap gap-1.5">
        {lowStock.map(p => (
          <span key={p.id} className={`text-[11px] font-black px-2 py-1 rounded-lg ${p.stock === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
            {p.name} {p.stock === 0 ? '(0)' : `(${p.stock})`}
          </span>
        ))}
      </div>
    </div>
  ) : null;

  const BirthdayWidget = birthdays.length > 0 ? (
    <div className="bg-white rounded-2xl ring-1 ring-pink-200/80 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-pink-50 border-b border-pink-100">
        <Gift size={13} className="text-pink-500" />
        <p className="text-xs font-black text-pink-700">{birthdays.length} Birthday is hafte</p>
      </div>
      {birthdays.map(c => {
        const [, mm, dd] = c.dob.split('-');
        const bday  = new Date(`${new Date().getFullYear()}-${mm}-${dd}`);
        const todayD = new Date(); todayD.setHours(0,0,0,0);
        const isToday = bday.toDateString() === todayD.toDateString();
        const wa    = `https://wa.me/${c.phone.replace(/^0/,'92')}?text=${encodeURIComponent(`Assalamu Alaikum ${c.name}! Aaj aap ka birthday hai — bohat bohat mubarak ho!`)}`;
        return (
          <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-50 last:border-0">
            <div className="w-7 h-7 rounded-full bg-pink-100 flex items-center justify-center text-[11px] font-black text-pink-600 shrink-0">{c.name[0]}</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">{c.name}</p>
              {c.area && <p className="text-[10px] text-slate-400">{c.area}</p>}
            </div>
            {isToday && <span className="text-[10px] font-black bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded shrink-0">Aaj!</span>}
            <a href={wa} target="_blank" rel="noopener noreferrer" className="shrink-0 text-[11px] font-black text-white bg-green-500 hover:bg-green-600 px-2.5 py-1 rounded-lg transition">WA</a>
          </div>
        );
      })}
    </div>
  ) : null;

  /* ════════════════════════ RENDER ════════════════════════ */
  return (
    <div className="min-h-screen bg-[#EAECF3]">

      {/* ─── STICKY HEADER ─── */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200 shadow-[0_1px_4px_rgba(15,23,42,0.06)]">
        <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-3">
          <div>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">{today}</p>
            <h1 className="text-base font-black text-slate-900 leading-tight mt-0.5">
              {greet()}, <span className="text-blue-600">{user?.name.split(' ')[0]}</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {!isOwner && myBal && Number(myBal.pendingBalance) > 0 && !myBal.pendingHandover && (
              <button onClick={() => { setHandoverAmt(String(Number(myBal.pendingBalance))); setShowHandover(true); }}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition shadow-sm shadow-emerald-200">
                <Send size={12}/> Jama Karo
              </button>
            )}
            {isOwner && (
              <button onClick={() => navigate('/reports')}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black transition shadow-sm">
                <BarChart3 size={13}/> Reports
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── HERO BAND ─── */}
      {isOwner && (isLoading ? <HeroSkeleton /> : (
        <div className="bg-[#080C14]">
          <div className="px-4 sm:px-6 lg:px-8 pt-5 pb-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-5 gap-x-4 lg:gap-0 lg:divide-x lg:divide-white/[0.07]">

              {/* Aaj Aya */}
              <div className="lg:pr-8">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.15em] mb-2">Aaj Aya</p>
                <p className="text-4xl xl:text-5xl font-black text-white tabular-nums leading-none">{pkrShort(todayTotal)}</p>
                <p className="text-[11px] text-slate-500 mt-1.5 tabular-nums">{pkr(todayTotal)}</p>
                <div className="flex gap-1.5 mt-3">
                  <div className="bg-white/[0.06] rounded-lg px-2 py-1.5">
                    <p className="text-[9px] text-slate-600 uppercase tracking-wide">Inst</p>
                    <p className="text-xs font-black text-slate-300 tabular-nums">{pkrShort(d?.todayCollections ?? 0)}</p>
                  </div>
                  <div className="bg-white/[0.06] rounded-lg px-2 py-1.5">
                    <p className="text-[9px] text-slate-600 uppercase tracking-wide">Sale</p>
                    <p className="text-xs font-black text-slate-300 tabular-nums">{pkrShort(d?.todayCashSales ?? 0)}</p>
                  </div>
                </div>
              </div>

              {/* Is Mahine */}
              <div className="lg:px-8">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.15em] mb-2">Is Mahine</p>
                <p className="text-4xl xl:text-5xl font-black text-white tabular-nums leading-none">{pkrShort(monthTotal)}</p>
                <p className="text-[11px] text-slate-500 mt-1.5 tabular-nums">{pkr(monthTotal)}</p>
                {d && (d.monthInstTarget ?? 0) > 0 && (() => {
                  const pct = Math.min(100, Math.round((d.monthCollections / d.monthInstTarget!) * 100));
                  const bar = pct >= 80 ? 'bg-emerald-400' : pct >= 50 ? 'bg-blue-400' : 'bg-amber-400';
                  return (
                    <div className="mt-3">
                      <div className="flex justify-between mb-1">
                        <p className="text-[9px] text-slate-600">Target {pkrShort(d.monthInstTarget!)}</p>
                        <p className="text-[9px] text-slate-500">{pct}%</p>
                      </div>
                      <div className="bg-white/[0.08] rounded-full h-1 overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-700 ${bar}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Active Plans */}
              <div className="lg:px-8">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.15em] mb-2">Active Plans</p>
                <p className="text-4xl xl:text-5xl font-black text-white tabular-nums leading-none">{d?.activeCount ?? 0}</p>
                <p className="text-[11px] text-slate-500 mt-1.5">chal rahe plans</p>
                <div className="flex gap-1.5 mt-3">
                  <span className="text-[9px] font-bold text-slate-500 bg-white/[0.06] px-2 py-1 rounded-lg">{d?.monthlyActiveCount ?? 0} monthly</span>
                  <span className="text-[9px] font-bold text-slate-500 bg-white/[0.06] px-2 py-1 rounded-lg">{d?.dailyActiveCount ?? 0} daily</span>
                </div>
              </div>

              {/* Overdue */}
              <div className="lg:pl-8 cursor-pointer group" onClick={() => navigate('/installments')}>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.15em] mb-2">Overdue</p>
                <p className={`text-4xl xl:text-5xl font-black tabular-nums leading-none transition ${(d?.overdueCount ?? 0) > 0 ? 'text-red-400 group-hover:text-red-300' : 'text-slate-600'}`}>
                  {d?.overdueCount ?? 0}
                </p>
                <p className="text-[11px] text-slate-500 mt-1.5 tabular-nums">
                  {(d?.overdueAmount ?? 0) > 0 ? pkr(d!.overdueAmount) : 'sab theek hai'}
                </p>
                {(d?.overdueCount ?? 0) > 0 && (
                  <p className="text-[10px] text-red-500 mt-3 font-black group-hover:underline">Dekho &rarr;</p>
                )}
              </div>
            </div>
          </div>

          {/* bottom accent line */}
          <div className="h-px bg-linear-to-r from-transparent via-white/10 to-transparent" />
        </div>
      ))}

      {/* ─── QUICK ACTIONS ─── */}
      {actions.length > 0 && (
        <div className="bg-white border-b border-slate-200/80">
          <div className="px-4 sm:px-6 lg:px-8 py-2.5 flex gap-2 overflow-x-auto scrollbar-none">
            {actions.map(a => (
              <button key={a.to} onClick={() => navigate(a.to)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 ring-1 ring-slate-200 text-xs font-black text-slate-700 whitespace-nowrap transition-all hover:shadow-sm shrink-0">
                <div className={`w-5 h-5 ${a.bg} rounded-md flex items-center justify-center`}>
                  <a.icon size={11} className={a.cls} />
                </div>
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── PAGE BODY ─── */}
      <div className="px-4 sm:px-6 lg:px-8 py-4 lg:py-5">
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-5 items-start">

          {/* ══════ MAIN COLUMN ══════ */}
          <div className="w-full lg:flex-1 lg:min-w-0 space-y-4">

            {/* staff pending balance banner */}
            {!isOwner && myBal && Number(myBal.pendingBalance) > 0 && (
              myBal.pendingHandover ? (
                <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3.5">
                  <CheckCircle size={18} className="text-amber-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-amber-800">Handover Pending Confirmation</p>
                    <p className="text-xs text-amber-600">{pkr(Number(myBal.pendingBalance))} — owner confirm kare ga</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-linear-to-br from-emerald-600 to-emerald-500 rounded-2xl px-4 py-4 shadow-lg shadow-emerald-200/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                      <Wallet size={20} className="text-white" />
                    </div>
                    <div>
                      <p className="text-[10px] text-emerald-100 font-bold uppercase tracking-widest">Cash in Hand</p>
                      <p className="text-2xl font-black text-white tabular-nums">{pkr(Number(myBal.pendingBalance))}</p>
                    </div>
                  </div>
                  <button onClick={() => { setHandoverAmt(String(Number(myBal.pendingBalance))); setShowHandover(true); }}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-white text-emerald-700 font-black text-sm rounded-xl hover:bg-emerald-50 transition shrink-0">
                    <Send size={13}/> Jama Karein
                  </button>
                </div>
              )
            )}

            {/* mobile: field cash */}
            <div className="lg:hidden">{FieldCashWidget}</div>

            {/* ══ AАJ KА KAAM — ACTION BOARD ══ */}
            <div className="bg-white rounded-2xl ring-1 ring-slate-200/80 shadow-[0_2px_12px_rgba(15,23,42,0.06)] overflow-hidden">

              {/* card header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-black text-slate-900">Aaj Ka Kaam</h2>
                  {briefing && (briefing.dueToday > 0 || briefing.overdueTotal > 0 || pDueCount > 0) && (
                    <div className="flex items-center gap-1.5">
                      {briefing.dueToday > 0    && <span className="text-[10px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{briefing.dueToday} due</span>}
                      {briefing.overdueTotal > 0 && <span className="text-[10px] font-black bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">{briefing.overdueTotal} late</span>}
                      {pDueCount > 0             && <span className="text-[10px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{pDueCount} waday</span>}
                    </div>
                  )}
                </div>
                <span className="text-[11px] text-slate-400 font-medium shrink-0">{today}</span>
              </div>

              {!briefing ? <RowSkeleton rows={5} /> : (
                <>
                  {/* ── DUE TODAY ── */}
                  {briefing.dueTodayAccounts.length > 0 ? (
                    <div className="border-l-4 border-blue-500 ml-0">
                      <div className="flex items-center justify-between px-5 py-2.5 bg-blue-50/40">
                        <div className="flex items-center gap-2">
                          <Clock size={13} className="text-blue-600" />
                          <p className="text-xs font-black text-blue-700">{briefing.dueToday} log aaj milenge</p>
                        </div>
                        {briefing.dueTomorrow > 0 && (
                          <span className="text-[10px] text-slate-400 font-medium">+{briefing.dueTomorrow} kal</span>
                        )}
                      </div>
                      <div className="divide-y divide-slate-50">
                        {briefing.dueTodayAccounts.slice(0, 15).map(acct => {
                          const wa = `https://wa.me/92${acct.customerPhone.replace(/^0/,'').replace(/\D/g,'')}?text=${encodeURIComponent(`Assalam-o-Alaikum ${acct.customerName}, aaj ka installment ${pkr(acct.monthly)} due hai. Jazak'Allah!`)}`;
                          return (
                            <div key={acct.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/60 transition">
                              <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-sm font-black text-blue-700 shrink-0">
                                {acct.customerName[0]?.toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-900 truncate">{acct.customerName}</p>
                                <p className="text-[11px] text-slate-400">{acct.customerPhone}</p>
                              </div>
                              <p className="text-sm font-black text-blue-700 tabular-nums shrink-0 mr-2">{pkr(acct.monthly)}</p>
                              <a href={wa} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black transition shrink-0 shadow-sm shadow-emerald-200">
                                <PhoneCall size={11}/> WA
                              </a>
                            </div>
                          );
                        })}
                        {briefing.dueTodayAccounts.length > 15 && (
                          <div className="px-5 py-2.5 text-center border-t border-slate-50">
                            <button onClick={() => navigate('/installments')} className="text-xs text-blue-600 font-black hover:underline">
                              +{briefing.dueTodayAccounts.length - 15} aur log &rarr;
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 px-5 py-3.5 border-l-4 border-slate-200 text-slate-400">
                      <Clock size={14} className="shrink-0" />
                      <p className="text-sm">Aaj koi due nahi</p>
                    </div>
                  )}

                  {/* ── OVERDUE ── */}
                  {briefing.urgentAccounts.length > 0 && (
                    <div className="border-l-4 border-rose-500 border-t border-slate-100">
                      <div className="flex items-center gap-2 px-5 py-2.5 bg-rose-50/40">
                        <TrendingUp size={13} className="text-rose-500 rotate-180" />
                        <p className="text-xs font-black text-rose-700">{briefing.overdueTotal} log late hain — foran call karo</p>
                      </div>
                      <div className="divide-y divide-slate-50">
                        {briefing.urgentAccounts.map(acct => {
                          const wa = `https://wa.me/92${acct.customerPhone.replace(/^0/,'').replace(/\D/g,'')}?text=${encodeURIComponent(`Assalam-o-Alaikum ${acct.customerName}, installment ${acct.daysOverdue} din se overdue hai. ${pkr(acct.monthly)} jald bhejein.`)}`;
                          return (
                            <div key={acct.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/60 transition">
                              <div className="w-9 h-9 bg-rose-100 rounded-full flex items-center justify-center text-sm font-black text-rose-600 shrink-0">
                                {acct.customerName[0]?.toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-900 truncate">{acct.customerName}</p>
                                <p className="text-[11px] text-slate-400">{acct.customerPhone}</p>
                              </div>
                              <div className="text-right mr-2 shrink-0">
                                <p className="text-sm font-black text-slate-900 tabular-nums">{pkr(acct.monthly)}</p>
                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${acct.daysOverdue >= 30 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                  {acct.daysOverdue} din
                                </span>
                              </div>
                              <a href={wa} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black transition shrink-0 shadow-sm shadow-emerald-200">
                                <PhoneCall size={11}/> WA
                              </a>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── PROMISES ── */}
                  {pDueCount > 0 && promises.length > 0 && (
                    <div className="border-l-4 border-amber-400 border-t border-slate-100">
                      <div className="flex items-center gap-2 px-5 py-2.5 bg-amber-50/40">
                        <Bell size={13} className="text-amber-600" />
                        <p className="text-xs font-black text-amber-700">{pDueCount} waday aaj due hain</p>
                      </div>
                      <div className="divide-y divide-slate-50">
                        {promises.slice(0, 5).map(p => (
                          <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                            <Bell size={13} className="text-amber-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-900 truncate">{p.customerName}</p>
                              <p className="text-[11px] text-slate-400 truncate">{p.productName}{p.note ? ` · ${p.note}` : ''}</p>
                            </div>
                            <span className="text-[10px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-lg shrink-0">Wada</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── ALL CLEAR ── */}
                  {briefing.dueToday === 0 && briefing.overdueTotal === 0 && pDueCount === 0 && (
                    <div className="py-10 flex flex-col items-center gap-3 text-center border-t border-slate-50">
                      <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center ring-4 ring-emerald-100">
                        <CheckCircle size={28} className="text-emerald-500" />
                      </div>
                      <div>
                        <p className="text-base font-black text-slate-800">Aaj sab clear hai!</p>
                        <p className="text-xs text-slate-400 mt-1">Koi due, koi overdue, koi wada pending nahi</p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* daily target */}
            {isOwner && shop?.settings?.dailyTarget && (() => {
              const target = shop.settings!.dailyTarget!;
              const pct    = Math.min(Math.round((todayTotal / target) * 100), 100);
              const over   = todayTotal > target;
              const bar    = over ? 'bg-emerald-500' : pct >= 70 ? 'bg-blue-500' : 'bg-amber-400';
              return (
                <div className="bg-white ring-1 ring-slate-200/80 rounded-2xl p-4 shadow-[0_2px_8px_rgba(15,23,42,0.05)]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Target size={14} className="text-blue-600"/>
                      <p className="text-sm font-black text-slate-900">Roz Ka Target</p>
                    </div>
                    <span className={`text-sm font-black ${over ? 'text-emerald-600' : 'text-blue-600'}`}>{pct}%{over ? ' ✓' : ''}</span>
                  </div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-xl font-black text-slate-900 tabular-nums">{pkr(todayTotal)}</span>
                    <span className="text-xs text-slate-400">of {pkr(target)}</span>
                  </div>
                  <div className="bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${bar}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className={`text-xs font-bold mt-1.5 ${over ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {over ? `+${pkr(todayTotal - target)} target se zyada!` : `${pkr(target - todayTotal)} aur chahiye`}
                  </p>
                </div>
              );
            })()}

            {/* mobile sidebar widgets */}
            <div className="lg:hidden space-y-4">
              {CompletingSoon}{LowStockWidget}{BirthdayWidget}
            </div>

            {/* recent installments */}
            <div className="bg-white rounded-2xl ring-1 ring-slate-200/80 shadow-[0_2px_8px_rgba(15,23,42,0.05)] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
                <h2 className="text-sm font-black text-slate-900">Nayi Installments</h2>
                <button onClick={() => navigate('/installments')} className="flex items-center gap-1 text-xs text-blue-600 font-black hover:underline">
                  Sab dekho <ArrowRight size={12}/>
                </button>
              </div>
              {isLoading ? <RowSkeleton rows={4}/> : !d?.recentInstallments.length ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-slate-400">Koi installment nahi.{' '}
                    <button onClick={() => navigate('/installments')} className="text-blue-600 font-black hover:underline">Banao</button>
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {d.recentInstallments.map(inst => (
                    <div key={inst.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/60 transition cursor-pointer"
                      onClick={() => navigate('/installments')}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-xs font-black text-slate-600 shrink-0">
                          {inst.customerName[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">{inst.customerName}</p>
                          <p className="text-xs text-slate-400 truncate">{inst.productName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 ml-4 shrink-0">
                        <div className="text-right">
                          <p className="text-sm font-black text-slate-900 tabular-nums">{pkr(Number(inst.remaining))}</p>
                          <p className="text-[10px] text-slate-400">baaki</p>
                        </div>
                        <span className={`text-xs font-black px-2.5 py-1 rounded-full ${STATUS_STYLES[inst.status]}`}>
                          {inst.status.charAt(0) + inst.status.slice(1).toLowerCase()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>{/* end main col */}

          {/* ══════ SIDEBAR ══════ */}
          <div className="hidden lg:flex flex-col gap-4 w-72 xl:w-80 shrink-0">
            <div className="sticky top-[108px] space-y-4">
              {FieldCashWidget}

              {/* is mahine summary */}
              {isOwner && d && (
                <div className="bg-white ring-1 ring-slate-200/80 rounded-2xl shadow-[0_2px_8px_rgba(15,23,42,0.05)] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Is Mahine</p>
                    <button onClick={() => navigate('/reports')} className="text-[11px] text-blue-600 font-black hover:underline flex items-center gap-0.5">
                      Detail <ArrowRight size={10}/>
                    </button>
                  </div>
                  <div className="p-4">
                    <div className="flex items-baseline justify-between mb-2">
                      <span className="text-2xl font-black text-slate-900 tabular-nums">{pkrShort(monthTotal)}</span>
                      {(d.monthInstTarget ?? 0) > 0 && <span className="text-xs text-slate-400">of {pkrShort(d.monthInstTarget!)}</span>}
                    </div>
                    {(d.monthInstTarget ?? 0) > 0 && (() => {
                      const pct = Math.min(100, Math.round((d.monthCollections / d.monthInstTarget!) * 100));
                      const bar = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-blue-500' : 'bg-amber-400';
                      return (
                        <>
                          <div className="bg-slate-100 rounded-full h-2 overflow-hidden mb-1">
                            <div className={`h-full rounded-full transition-all duration-700 ${bar}`} style={{ width: `${pct}%` }} />
                          </div>
                          <p className="text-[10px] text-slate-400">{pct}% target achieve</p>
                        </>
                      );
                    })()}
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <div className="bg-slate-50 rounded-xl px-3 py-2.5">
                        <p className="text-[10px] text-slate-400 mb-0.5">Kharcha</p>
                        <p className="text-sm font-black text-rose-500 tabular-nums">{pkrShort(d.monthExpenseTotal ?? 0)}</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl px-3 py-2.5">
                        <p className="text-[10px] text-slate-400 mb-0.5">Net Faida</p>
                        {(() => {
                          const p = monthTotal - (d.monthExpenseTotal ?? 0);
                          return <p className={`text-sm font-black tabular-nums ${p >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{p >= 0 ? '' : '-'}{pkrShort(Math.abs(p))}</p>;
                        })()}
                      </div>
                    </div>
                    {d.newThisMonthCount > 0 && (
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                        <p className="text-[10px] text-slate-400">{d.newThisMonthCount} naye plans</p>
                        <p className="text-[10px] font-black text-slate-600">{pkrShort(d.newThisMonthValue)}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {CompletingSoon}
              {LowStockWidget}
              {BirthdayWidget}
            </div>
          </div>

        </div>
      </div>

      {/* handover modal */}
      {showHandover && !isOwner && (() => {
        const bal  = Number(myBal?.pendingBalance ?? 0);
        const amt  = Number(handoverAmt);
        const diff = amt - bal;
        return (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-black text-slate-900">Cash Jama Karein</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Owner ko cash hand-off</p>
                </div>
                <button onClick={() => setShowHandover(false)}><X size={16} className="text-slate-400 hover:text-slate-700"/></button>
              </div>
              <div className="p-5 space-y-4">
                <div className="bg-slate-50 rounded-xl p-3 ring-1 ring-slate-200">
                  <p className="text-[11px] text-slate-400">System ka hisaab</p>
                  <p className="text-2xl font-black text-slate-900 tabular-nums">{pkr(bal)}</p>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-600 mb-1.5">Actual Amount (PKR) *</label>
                  <input type="number" value={handoverAmt} onChange={e => setHandoverAmt(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-3 text-lg font-black focus:outline-none focus:border-emerald-400 transition tabular-nums" autoFocus />
                  {handoverAmt && amt !== bal && (
                    <p className={`text-xs mt-1.5 font-black ${diff < 0 ? 'text-rose-500' : 'text-amber-500'}`}>
                      {pkr(Math.abs(diff))} {diff < 0 ? 'kam' : 'zyada'}
                    </p>
                  )}
                </div>
                <textarea value={handoverNote} onChange={e => setHandoverNote(e.target.value)} rows={2} placeholder="Note…"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-emerald-400 transition" />
              </div>
              <div className="flex gap-2 px-5 pb-5">
                <button onClick={() => setShowHandover(false)} className="flex-1 py-2.5 text-sm font-black text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition">Cancel</button>
                <button disabled={!handoverAmt || amt <= 0 || submitHandover.isPending} onClick={() => submitHandover.mutate()}
                  className="flex-1 py-2.5 text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl transition flex items-center justify-center gap-1.5">
                  {submitHandover.isPending ? <span className="animate-pulse">Jama ho raha…</span> : <><Send size={13}/> Jama Karein</>}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {receiveTarget && <CashReceiveModal target={receiveTarget} onClose={() => setReceiveTarget(null)} />}
    </div>
  );
}
