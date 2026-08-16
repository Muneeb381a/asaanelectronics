import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  CreditCard, Package, ArrowRight, BarChart3,
  Users, Zap, ShoppingCart, Bell, Target, Gift,
  Clock, PhoneCall, Wallet, CheckCircle, Send, X,
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
  if (v >= 1_000)   return `${(v / 1_000).toFixed(v % 1_000 === 0 ? 0 : 1)}K`;
  return String(v);
}
function greeting() {
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

function HeroSkeleton() {
  return (
    <div className="bg-[#0D1117] px-4 sm:px-6 lg:px-8 py-5 animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {[0,1,2,3].map(i => (
          <div key={i}>
            <div className="h-2 bg-slate-700 rounded w-14 mb-2.5" />
            <div className="h-8 bg-slate-700 rounded w-20" />
            <div className="h-2 bg-slate-800 rounded w-16 mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}

function CashReceiveModal({ target, onClose }: { target: StaffBalance; onClose: () => void }) {
  const qc            = useQueryClient();
  const systemBalance = Number(target.pendingBalance);
  const prefill       = target.pendingHandover ? target.pendingHandover.handedAmount : String(systemBalance);
  const [amount, setAmount] = useState(prefill);
  const [note, setNote]     = useState('');

  const mutation = useMutation({
    mutationFn: () => handoversApi.directReceive({ staffId: target.staffId, amount: Number(amount), note: note.trim() || undefined }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['handover-pending-balances'] });
      void qc.invalidateQueries({ queryKey: ['handover-balances'] });
      void qc.invalidateQueries({ queryKey: ['handovers'] });
      toast.success(`${target.staffName} se ${pkr(Number(amount))} receive ho gaya`);
      onClose();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Masla ho gaya'),
  });

  const diff    = Number(amount) - systemBalance;
  const hasDiff = Math.abs(diff) >= 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-black text-slate-900">Cash Li</h2>
            <p className="text-xs text-slate-400 mt-0.5">{target.staffName} se receive karo</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
          <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wide mb-0.5">System Balance</p>
          <p className="text-2xl font-black text-blue-700 tabular-nums">{pkr(systemBalance)}</p>
        </div>
        {target.pendingHandover && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
            <p className="text-[10px] text-amber-500 font-bold uppercase tracking-wide mb-0.5">Staff ne submit kiya</p>
            <p className="text-2xl font-black text-amber-700 tabular-nums">{pkr(Number(target.pendingHandover.handedAmount))}</p>
            {target.pendingHandover.note && <p className="text-xs text-slate-400 mt-1 italic">&ldquo;{target.pendingHandover.note}&rdquo;</p>}
          </div>
        )}
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1.5">Ginا hua amount (PKR) *</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} min="0"
            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50 transition tabular-nums" />
          {amount && hasDiff && (
            <p className={`text-xs mt-1 font-bold ${diff < 0 ? 'text-red-500' : 'text-amber-600'}`}>
              {diff < 0 ? `${pkr(Math.abs(diff))} system se kam` : `${pkr(diff)} system se zyada`}
            </p>
          )}
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1.5">Note</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-emerald-400 transition resize-none" />
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={!amount || Number(amount) < 0 || mutation.isPending}
            className="flex-1 py-2.5 text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-1.5">
            {mutation.isPending ? 'Processing…' : <><CheckCircle size={14} /> Cash Li</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const user     = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const isOwner  = user?.role === 'SELLER_OWNER';
  const qc       = useQueryClient();
  const perms    = user?.permissions as Record<string, boolean> | null | undefined;

  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [handoverAmount, setHandoverAmount]       = useState('');
  const [handoverNote, setHandoverNote]           = useState('');
  const [receiveTarget, setReceiveTarget]         = useState<StaffBalance | null>(null);

  const { data: myBalance } = useQuery({
    queryKey: ['handover-my-balance'],
    queryFn:  () => handoversApi.myBalance(),
    enabled:  !isOwner,
    staleTime: 30_000, refetchInterval: 120_000,
  });
  const { data: pendingBalances = [] } = useQuery({
    queryKey: ['handover-pending-balances'],
    queryFn:  handoversApi.pendingBalances,
    enabled:  isOwner,
    staleTime: 30_000, refetchInterval: 120_000,
  });
  const submitHandover = useMutation({
    mutationFn: () => handoversApi.create({ handedAmount: Number(handoverAmount), note: handoverNote.trim() || undefined }),
    onSuccess: () => {
      setShowHandoverModal(false); setHandoverAmount(''); setHandoverNote('');
      void qc.invalidateQueries({ queryKey: ['handover-my-balance'] });
    },
  });

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard'], queryFn: statsApi.getDashboard,
    staleTime: 60_000, gcTime: 5 * 60_000, refetchInterval: 5 * 60_000,
  });
  const { data: briefing } = useQuery({
    queryKey: ['daily-briefing'], queryFn: statsApi.getDailyBriefing,
    staleTime: 60_000, gcTime: 5 * 60_000, refetchInterval: 5 * 60_000,
  });
  const promisesDueCount = dashboard?.stats?.promisesDueCount ?? 0;
  const { data: promises = [] } = useQuery({
    queryKey: ['promises-due'], queryFn: recoveryApi.promisesDue,
    enabled: promisesDueCount > 0, staleTime: 60_000,
  });
  const { data: shop } = useQuery({
    queryKey: ['shop-me'], queryFn: sellersApi.getMe,
    staleTime: 5 * 60_000, enabled: isOwner,
  });
  const { data: birthdays = [] } = useQuery({
    queryKey: ['upcoming-birthdays'], queryFn: customersApi.getUpcomingBirthdays,
    staleTime: 60 * 60_000,
  });

  const data       = dashboard?.stats;
  const today      = fmtDate(new Date());
  const todayTotal = (data?.todayCollections ?? 0) + (data?.todayCashSales ?? 0);
  const monthTotal = (data?.monthCollections ?? 0) + (data?.monthCashSales ?? 0);
  const lowStock   = data?.lowStockItems ?? [];

  const staffWithCash  = pendingBalances.filter((s) => Number(s.pendingBalance) > 0);
  const totalFieldCash = staffWithCash.reduce((s, x) => s + Number(x.pendingBalance), 0);

  /* ── Quick actions list ── */
  const quickActions = [
    isOwner || perms?.canAddInstallment ? { label: 'Installment', icon: CreditCard,   cls: 'text-blue-600',    to: '/installments' } : null,
    isOwner || perms?.canAddCustomer    ? { label: 'Customer',    icon: Users,        cls: 'text-violet-600',  to: '/customers'    } : null,
    isOwner || perms?.canMakeCashSales  ? { label: 'Cash Sale',   icon: ShoppingCart, cls: 'text-emerald-600', to: '/cash-sales'   } : null,
    isOwner || perms?.canRecordExpense  ? { label: 'Expense',     icon: Zap,          cls: 'text-rose-600',    to: '/expenses'     } : null,
    isOwner || perms?.canManageProducts ? { label: 'Product',     icon: Package,      cls: 'text-amber-600',   to: '/products'     } : null,
  ].filter(Boolean) as { label: string; icon: React.ElementType; cls: string; to: string }[];

  /* ── Sidebar widgets ── */
  const CashInFieldWidget = isOwner && staffWithCash.length > 0 ? (
    <div className="bg-white rounded-2xl ring-1 ring-amber-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-amber-50 border-b border-amber-100">
        <div className="flex items-center gap-2">
          <Wallet size={14} className="text-amber-600" />
          <p className="text-xs font-black text-amber-800">Cash in Field</p>
        </div>
        <p className="text-sm font-black text-amber-700 tabular-nums">{pkr(totalFieldCash)}</p>
      </div>
      <div className="divide-y divide-slate-50">
        {staffWithCash.map((s) => (
          <div key={s.staffId} className="flex items-center gap-3 px-4 py-2.5">
            <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center text-[11px] font-black text-slate-600 shrink-0">
              {s.staffName[0]?.toUpperCase()}
            </div>
            <p className="text-xs font-bold text-slate-800 flex-1 truncate">{s.staffName}</p>
            <p className="text-xs font-black text-slate-900 tabular-nums shrink-0">{pkr(Number(s.pendingBalance))}</p>
            <button onClick={() => setReceiveTarget(s)}
              className={`shrink-0 text-[11px] font-black px-2.5 py-1 rounded-lg transition ${
                s.pendingHandover ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
              }`}>
              {s.pendingHandover ? 'Confirm' : 'Li'}
            </button>
          </div>
        ))}
      </div>
    </div>
  ) : null;

  const LowStockWidget = lowStock.length > 0 ? (
    <div className="bg-white rounded-2xl ring-1 ring-amber-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50 border-b border-amber-100">
        <div className="flex items-center gap-2">
          <Package size={13} className="text-amber-600" />
          <p className="text-xs font-black text-amber-800">Kam Stock ({lowStock.length})</p>
        </div>
        <button onClick={() => navigate('/products')} className="text-[11px] text-amber-700 font-black hover:underline flex items-center gap-0.5">
          Manage <ArrowRight size={10}/>
        </button>
      </div>
      <div className="px-4 py-3 flex flex-wrap gap-1.5">
        {lowStock.map((p) => (
          <span key={p.id} className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-black ${
            p.stock === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
          }`}>
            {p.name}
            <span className="opacity-60">{p.stock === 0 ? '✕' : `${p.stock}`}</span>
          </span>
        ))}
      </div>
    </div>
  ) : null;

  const BirthdayWidget = birthdays.length > 0 ? (
    <div className="bg-white rounded-2xl ring-1 ring-pink-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-pink-50 border-b border-pink-100">
        <Gift size={13} className="text-pink-500" />
        <p className="text-xs font-black text-pink-700">{birthdays.length} Birthday is hafte</p>
      </div>
      <div className="divide-y divide-slate-50">
        {birthdays.map((c) => {
          const [, mm, dd] = c.dob.split('-');
          const thisYear   = new Date().getFullYear();
          const bday       = new Date(`${thisYear}-${mm}-${dd}`);
          const todayD     = new Date(); todayD.setHours(0, 0, 0, 0);
          const isToday    = bday.toDateString() === todayD.toDateString();
          const phone      = c.phone.replace(/^0/, '92');
          const msg        = encodeURIComponent(`Assalamu Alaikum ${c.name}! Aaj aap ka birthday hai — bohat bohat mubarak ho!`);
          return (
            <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
              {c.photoUrl
                ? <img src={c.photoUrl} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                : <div className="w-7 h-7 rounded-full bg-pink-100 flex items-center justify-center shrink-0 text-pink-600 text-[11px] font-black">{c.name[0]}</div>}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">{c.name}</p>
                {c.area && <p className="text-[10px] text-slate-400 truncate">{c.area}</p>}
              </div>
              {isToday && <span className="text-[10px] font-black bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded shrink-0">Aaj!</span>}
              <a href={`https://wa.me/${phone}?text=${msg}`} target="_blank" rel="noopener noreferrer"
                className="shrink-0 text-[11px] font-black text-white bg-green-500 hover:bg-green-600 px-2.5 py-1 rounded-lg transition">WA</a>
            </div>
          );
        })}
      </div>
    </div>
  ) : null;

  const CompletingSoonWidget = isOwner && data && data.completingSoon.length > 0 ? (
    <div className="bg-white ring-1 ring-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <CheckCircle size={13} className="text-emerald-600" />
          <p className="text-xs font-black text-slate-700">Khatam Hone Wale</p>
        </div>
        <span className="text-[10px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{data.completingSoon.length}</span>
      </div>
      <div className="divide-y divide-slate-50">
        {data.completingSoon.map((c) => {
          const pillCls = c.paymentsLeft === 1 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700';
          const wa = `https://wa.me/92${c.customerPhone.replace(/^0/, '').replace(/\D/g, '')}?text=${encodeURIComponent(
            `Assalam-o-Alaikum ${c.customerName}! Sirf ${c.paymentsLeft} installment aur baaki hai.`
          )}`;
          return (
            <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <p className="text-xs font-bold text-slate-900 truncate">{c.customerName}</p>
                  <span className={`shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded-full ${pillCls}`}>{c.paymentsLeft} baaki</span>
                </div>
                <p className="text-[10px] text-slate-400 truncate">{c.productName}</p>
              </div>
              <a href={wa} target="_blank" rel="noopener noreferrer"
                className="shrink-0 text-[11px] font-black text-white bg-emerald-500 hover:bg-emerald-600 px-2.5 py-1 rounded-lg transition">WA</a>
            </div>
          );
        })}
      </div>
    </div>
  ) : null;

  return (
    <div className="min-h-screen bg-slate-100">

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
        <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-3.5">
          <div>
            <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">{today}</p>
            <h1 className="text-base sm:text-lg font-black text-slate-900 leading-tight mt-0.5">
              {greeting()}, <span className="text-blue-600">{user?.name.split(' ')[0]}</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {!isOwner && myBalance && Number(myBalance.pendingBalance) > 0 && !myBalance.pendingHandover && (
              <button onClick={() => { setHandoverAmount(String(Number(myBalance.pendingBalance))); setShowHandoverModal(true); }}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition shadow-sm">
                <Send size={12} /> Jama Karo
              </button>
            )}
            {isOwner && (
              <button onClick={() => navigate('/reports')}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black transition shadow-sm">
                <BarChart3 size={13} /> Reports
              </button>
            )}
          </div>
        </div>

        {/* Quick actions strip */}
        {quickActions.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none px-4 sm:px-6 lg:px-8 pb-3 pt-0">
            {quickActions.map((a) => (
              <button key={a.to} onClick={() => navigate(a.to)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 ring-1 ring-slate-200 rounded-xl text-[11px] font-black text-slate-700 whitespace-nowrap transition shrink-0">
                <a.icon size={12} className={a.cls} /> {a.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Hero band ── */}
      {isOwner && (isLoading ? <HeroSkeleton /> : (
        <div className="bg-[#0D1117] px-4 sm:px-6 lg:px-8 py-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-0 lg:divide-x lg:divide-white/10">
            <div className="lg:pr-8">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Aaj Aya</p>
              <p className="text-3xl xl:text-4xl font-black text-white tabular-nums leading-none">{pkrShort(todayTotal)}</p>
              <p className="text-[11px] text-slate-500 mt-1 tabular-nums">{pkr(todayTotal)}</p>
              <div className="flex gap-1.5 mt-2.5">
                <div className="bg-white/[0.07] rounded-lg px-2 py-1">
                  <p className="text-[9px] text-slate-500 uppercase">Inst</p>
                  <p className="text-[11px] font-black text-slate-300">{pkrShort(data?.todayCollections ?? 0)}</p>
                </div>
                <div className="bg-white/[0.07] rounded-lg px-2 py-1">
                  <p className="text-[9px] text-slate-500 uppercase">Sale</p>
                  <p className="text-[11px] font-black text-slate-300">{pkrShort(data?.todayCashSales ?? 0)}</p>
                </div>
              </div>
            </div>
            <div className="lg:px-8">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Is Mahine</p>
              <p className="text-3xl xl:text-4xl font-black text-white tabular-nums leading-none">{pkrShort(monthTotal)}</p>
              <p className="text-[11px] text-slate-500 mt-1 tabular-nums">{pkr(monthTotal)}</p>
              {isOwner && data && (data.monthInstTarget ?? 0) > 0 && (() => {
                const pct = Math.min(100, Math.round((data.monthCollections / data.monthInstTarget!) * 100));
                return (
                  <div className="mt-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[9px] text-slate-600">Target: {pkrShort(data.monthInstTarget!)}</p>
                      <p className="text-[9px] text-slate-500">{pct}%</p>
                    </div>
                    <div className="bg-white/10 rounded-full h-1 overflow-hidden">
                      <div className={`h-full rounded-full ${pct >= 80 ? 'bg-emerald-400' : pct >= 50 ? 'bg-blue-400' : 'bg-amber-400'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })()}
            </div>
            <div className="lg:px-8">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Active Plans</p>
              <p className="text-3xl xl:text-4xl font-black text-white tabular-nums leading-none">{data?.activeCount ?? 0}</p>
              <p className="text-[11px] text-slate-500 mt-1">chal rahe plans</p>
              <div className="flex gap-1.5 mt-2.5 text-[10px]">
                <span className="bg-white/[0.07] text-slate-400 px-2 py-1 rounded-lg">{data?.monthlyActiveCount ?? 0} monthly</span>
                <span className="bg-white/[0.07] text-slate-400 px-2 py-1 rounded-lg">{data?.dailyActiveCount ?? 0} daily</span>
              </div>
            </div>
            <div className="lg:pl-8 cursor-pointer" onClick={() => navigate('/installments')}>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Overdue</p>
              <p className={`text-3xl xl:text-4xl font-black tabular-nums leading-none ${(data?.overdueCount ?? 0) > 0 ? 'text-red-400' : 'text-slate-600'}`}>
                {data?.overdueCount ?? 0}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">{(data?.overdueAmount ?? 0) > 0 ? pkr(data!.overdueAmount) : 'koi nahi'}</p>
              {(data?.overdueCount ?? 0) > 0 && (
                <p className="text-[10px] text-red-400 mt-2.5 font-black">dekho &rarr;</p>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* ── Page body ── */}
      <div className="px-4 sm:px-6 lg:px-8 py-4 lg:py-5">
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-5 items-start">

          {/* ════ MAIN COLUMN ════ */}
          <div className="w-full lg:flex-1 lg:min-w-0 space-y-4">

            {/* Staff pending handover banner */}
            {!isOwner && myBalance && Number(myBalance.pendingBalance) > 0 && (
              myBalance.pendingHandover ? (
                <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3.5">
                  <CheckCircle size={18} className="text-amber-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-amber-800">Handover Submitted</p>
                    <p className="text-xs text-amber-600">{pkr(Number(myBalance.pendingBalance))} &mdash; owner ki confirmation pending</p>
                  </div>
                  <span className="text-[10px] font-black bg-amber-200 text-amber-700 px-2 py-1 rounded-lg uppercase shrink-0">PENDING</span>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-linear-to-r from-emerald-600 to-emerald-500 rounded-2xl px-4 py-4 shadow-md shadow-emerald-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                      <Wallet size={20} className="text-white" />
                    </div>
                    <div>
                      <p className="text-[10px] text-emerald-100 font-bold uppercase tracking-widest">Cash in Hand</p>
                      <p className="text-2xl font-black text-white tabular-nums">{pkr(Number(myBalance.pendingBalance))}</p>
                    </div>
                  </div>
                  <button onClick={() => { setHandoverAmount(String(Number(myBalance.pendingBalance))); setShowHandoverModal(true); }}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-white text-emerald-700 font-black text-sm rounded-xl hover:bg-emerald-50 transition shrink-0">
                    <Send size={14} /> Jama Karein
                  </button>
                </div>
              )
            )}

            {/* Mobile: cash in field */}
            <div className="lg:hidden">{CashInFieldWidget}</div>

            {/* ════ AАJ KА KAAM — MAIN ACTION CARD ════ */}
            <div className="bg-white ring-1 ring-slate-200 rounded-2xl shadow-sm overflow-hidden">

              {/* Card header with counts */}
              <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50/80 border-b border-slate-100">
                <h2 className="text-sm font-black text-slate-900">Aaj Ka Kaam</h2>
                <div className="flex items-center gap-2">
                  {briefing && (
                    <>
                      {briefing.dueToday > 0 && (
                        <span className="text-[10px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{briefing.dueToday} due</span>
                      )}
                      {briefing.overdueTotal > 0 && (
                        <span className="text-[10px] font-black bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">{briefing.overdueTotal} late</span>
                      )}
                      {promisesDueCount > 0 && (
                        <span className="text-[10px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{promisesDueCount} waday</span>
                      )}
                    </>
                  )}
                </div>
              </div>

              {!briefing ? (
                <RowSkeleton rows={5} />
              ) : (
                <>
                  {/* Due today */}
                  {briefing.dueTodayAccounts.length > 0 ? (
                    <div>
                      <div className="flex items-center gap-2 px-5 py-2 bg-blue-50/50 border-b border-blue-100/50">
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0" />
                        <p className="text-[11px] font-black text-blue-700">
                          {briefing.dueToday} log aaj milenge
                        </p>
                        {briefing.dueTomorrow > 0 && (
                          <span className="ml-auto text-[10px] text-slate-400">+{briefing.dueTomorrow} kal</span>
                        )}
                      </div>
                      <div className="divide-y divide-slate-50">
                        {briefing.dueTodayAccounts.slice(0, 12).map((acct) => {
                          const wa = `https://wa.me/92${acct.customerPhone.replace(/^0/, '').replace(/\D/g, '')}?text=${encodeURIComponent(
                            `Assalam-o-Alaikum ${acct.customerName}, aapka aaj ka installment ${pkr(acct.monthly)} due hai.`
                          )}`;
                          return (
                            <div key={acct.id} className="flex items-center gap-3 px-5 py-3">
                              <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center text-xs font-black text-blue-600 shrink-0">
                                {acct.customerName[0]?.toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-900 truncate">{acct.customerName}</p>
                                <p className="text-[11px] text-slate-400">{acct.customerPhone}</p>
                              </div>
                              <p className="text-sm font-black text-blue-700 tabular-nums shrink-0">{pkr(acct.monthly)}</p>
                              <a href={wa} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-black transition shrink-0">
                                <PhoneCall size={11} /> WA
                              </a>
                            </div>
                          );
                        })}
                        {briefing.dueTodayAccounts.length > 12 && (
                          <div className="px-5 py-2.5 border-t border-slate-50 text-center">
                            <button onClick={() => navigate('/installments')} className="text-xs text-blue-600 font-black hover:underline">
                              +{briefing.dueTodayAccounts.length - 12} aur log &rarr;
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-50">
                      <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center shrink-0">
                        <Clock size={13} className="text-slate-400" />
                      </div>
                      <p className="text-sm text-slate-400">Aaj koi due nahi</p>
                    </div>
                  )}

                  {/* Overdue */}
                  {briefing.urgentAccounts.length > 0 && (
                    <div className="border-t border-slate-100">
                      <div className="flex items-center gap-2 px-5 py-2 bg-rose-50/50 border-b border-rose-100/50">
                        <div className="w-1.5 h-1.5 bg-rose-500 rounded-full shrink-0" />
                        <p className="text-[11px] font-black text-rose-700">{briefing.overdueTotal} log late hain &mdash; foran call karo</p>
                      </div>
                      <div className="divide-y divide-slate-50">
                        {briefing.urgentAccounts.map((acct) => {
                          const wa = `https://wa.me/92${acct.customerPhone.replace(/^0/, '').replace(/\D/g, '')}?text=${encodeURIComponent(
                            `Assalam-o-Alaikum ${acct.customerName}, aapka installment ${acct.daysOverdue} din se overdue hai. ${pkr(acct.monthly)} jald send karein.`
                          )}`;
                          return (
                            <div key={acct.id} className="flex items-center gap-3 px-5 py-3">
                              <div className="w-8 h-8 bg-rose-50 rounded-full flex items-center justify-center text-xs font-black text-rose-500 shrink-0">
                                {acct.customerName[0]?.toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-900 truncate">{acct.customerName}</p>
                                <p className="text-[11px] text-slate-400">{acct.customerPhone}</p>
                              </div>
                              <div className="shrink-0 text-right mr-1">
                                <p className="text-sm font-black text-slate-900 tabular-nums">{pkr(acct.monthly)}</p>
                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                                  acct.daysOverdue >= 30 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                }`}>{acct.daysOverdue} din late</span>
                              </div>
                              <a href={wa} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-black transition shrink-0">
                                <PhoneCall size={11} /> WA
                              </a>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Promises */}
                  {promisesDueCount > 0 && promises.length > 0 && (
                    <div className="border-t border-slate-100">
                      <div className="flex items-center gap-2 px-5 py-2 bg-amber-50/50 border-b border-amber-100/50">
                        <div className="w-1.5 h-1.5 bg-amber-500 rounded-full shrink-0" />
                        <p className="text-[11px] font-black text-amber-700">{promisesDueCount} waday due hain</p>
                      </div>
                      <div className="divide-y divide-slate-50">
                        {promises.slice(0, 6).map((p) => (
                          <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                            <Bell size={14} className="text-amber-400 shrink-0" />
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

                  {/* All clear */}
                  {briefing.dueToday === 0 && briefing.overdueTotal === 0 && promisesDueCount === 0 && (
                    <div className="py-10 flex flex-col items-center gap-2.5 text-center">
                      <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center">
                        <CheckCircle size={26} className="text-emerald-500" />
                      </div>
                      <p className="text-sm font-black text-slate-700">Aaj sab clear hai!</p>
                      <p className="text-xs text-slate-400">Koi due, koi overdue, koi wada pending nahi</p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Daily target */}
            {isOwner && shop?.settings?.dailyTarget && (() => {
              const target = shop.settings!.dailyTarget!;
              const pct    = Math.min(Math.round((todayTotal / target) * 100), 100);
              const over   = todayTotal > target;
              return (
                <div className="bg-white ring-1 ring-slate-200 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <Target size={14} className="text-blue-600" />
                      <p className="text-sm font-black text-slate-900">Roz Ka Target</p>
                    </div>
                    <span className={`text-sm font-black ${over ? 'text-emerald-600' : 'text-blue-600'}`}>{pct}%{over ? ' ✓' : ''}</span>
                  </div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-xl font-black text-slate-900 tabular-nums">{pkr(todayTotal)}</span>
                    <span className="text-xs text-slate-400">of {pkr(target)}</span>
                  </div>
                  <div className="bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${over ? 'bg-emerald-500' : pct >= 70 ? 'bg-blue-500' : 'bg-amber-400'}`}
                      style={{ width: `${pct}%` }} />
                  </div>
                  <p className={`text-xs font-bold mt-1.5 ${over ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {over ? `+${pkr(todayTotal - target)} zyada!` : `${pkr(target - todayTotal)} aur chahiye`}
                  </p>
                </div>
              );
            })()}

            {/* Mobile sidebar widgets */}
            <div className="lg:hidden space-y-4">
              {LowStockWidget}
              {BirthdayWidget}
              {CompletingSoonWidget}
            </div>

            {/* Recent installments */}
            <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
                <h2 className="text-sm font-black text-slate-900">Nayi Installments</h2>
                <button onClick={() => navigate('/installments')} className="flex items-center gap-1 text-xs text-blue-600 font-black hover:underline">
                  Sab dekho <ArrowRight size={12} />
                </button>
              </div>
              {isLoading ? <RowSkeleton rows={4} /> : !data?.recentInstallments.length ? (
                <div className="p-8 text-center text-sm text-slate-400">
                  Koi installment nahi.{' '}
                  <button onClick={() => navigate('/installments')} className="text-blue-600 hover:underline font-black">Banao</button>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {data.recentInstallments.map((inst) => (
                    <div key={inst.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/60 transition cursor-pointer"
                      onClick={() => navigate('/installments')}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{inst.customerName}</p>
                        <p className="text-xs text-slate-400 truncate">{inst.productName}</p>
                      </div>
                      <div className="flex items-center gap-3 ml-4 shrink-0">
                        <div className="text-right">
                          <p className="text-sm font-black text-slate-900 tabular-nums">{pkr(Number(inst.remaining))}</p>
                          <p className="text-[10px] text-slate-400">baaki</p>
                        </div>
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-black ${STATUS_STYLES[inst.status]}`}>
                          {inst.status.charAt(0) + inst.status.slice(1).toLowerCase()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>{/* end main col */}

          {/* ════ SIDEBAR ════ */}
          <div className="hidden lg:flex flex-col gap-4 w-72 xl:w-80 shrink-0">
            <div className="sticky top-[112px] space-y-4">
              {CashInFieldWidget}

              {/* Is Mahine summary */}
              {isOwner && data && (
                <div className="bg-white ring-1 ring-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                    <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Is Mahine</p>
                    <button onClick={() => navigate('/reports')} className="text-[11px] text-blue-600 font-black hover:underline flex items-center gap-0.5">
                      Detail <ArrowRight size={10}/>
                    </button>
                  </div>
                  <div className="p-4 space-y-3">
                    <div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-xl font-black text-slate-900 tabular-nums">{pkrShort(monthTotal)}</span>
                        {data.monthInstTarget > 0 && <span className="text-[11px] text-slate-400">of {pkrShort(data.monthInstTarget)}</span>}
                      </div>
                      {data.monthInstTarget > 0 && (() => {
                        const pct = Math.min(100, Math.round((data.monthCollections / data.monthInstTarget) * 100));
                        return (
                          <>
                            <div className="bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
                              <div className={`h-full rounded-full ${pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-blue-500' : 'bg-amber-400'}`} style={{ width: `${pct}%` }} />
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">{pct}% target achieve</p>
                          </>
                        );
                      })()}
                    </div>
                    {(() => {
                      const expenses = data.monthExpenseTotal ?? 0;
                      const profit   = monthTotal - expenses;
                      return (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div className="bg-slate-50 rounded-xl px-3 py-2">
                            <p className="text-[10px] text-slate-400">Kharcha</p>
                            <p className="text-sm font-black text-rose-500 tabular-nums">{pkrShort(expenses)}</p>
                          </div>
                          <div className="bg-slate-50 rounded-xl px-3 py-2">
                            <p className="text-[10px] text-slate-400">Net Faida</p>
                            <p className={`text-sm font-black tabular-nums ${profit >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                              {profit >= 0 ? '' : '-'}{pkrShort(Math.abs(profit))}
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {CompletingSoonWidget}
              {LowStockWidget}
              {BirthdayWidget}
            </div>
          </div>

        </div>
      </div>

      {/* Staff handover modal */}
      {showHandoverModal && !isOwner && (() => {
        const balance = Number(myBalance?.pendingBalance ?? 0);
        const amt     = Number(handoverAmount);
        const diff    = amt - balance;
        return (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-black text-slate-900">Cash Jama Karein</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Owner ko cash hand-off ka record</p>
                </div>
                <button onClick={() => setShowHandoverModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition">
                  <X size={16} className="text-slate-500" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div className="bg-slate-50 ring-1 ring-slate-200 rounded-xl p-3">
                  <p className="text-[11px] text-slate-400">System ka hisaab</p>
                  <p className="text-2xl font-black text-slate-900 mt-0.5 tabular-nums">{pkr(balance)}</p>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-600 mb-1.5">Actual Amount (PKR) *</label>
                  <input type="number" value={handoverAmount} onChange={(e) => setHandoverAmount(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-3 text-lg font-black focus:outline-none focus:border-emerald-400 transition tabular-nums"
                    placeholder="0" autoFocus />
                  {handoverAmount && amt !== balance && (
                    <p className={`text-xs mt-1.5 font-black ${diff < 0 ? 'text-rose-500' : 'text-amber-500'}`}>
                      System se {pkr(Math.abs(diff))} {diff < 0 ? 'kam' : 'zyada'}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-600 mb-1.5">Note (optional)</label>
                  <textarea value={handoverNote} onChange={(e) => setHandoverNote(e.target.value)} rows={2}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-emerald-400 transition" />
                </div>
              </div>
              <div className="flex gap-2 px-5 pb-5">
                <button onClick={() => setShowHandoverModal(false)}
                  className="flex-1 py-2.5 text-sm font-black text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition">Cancel</button>
                <button disabled={!handoverAmount || amt <= 0 || submitHandover.isPending} onClick={() => submitHandover.mutate()}
                  className="flex-1 py-2.5 text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl transition flex items-center justify-center gap-1.5">
                  {submitHandover.isPending ? <span className="animate-pulse">Jama ho raha…</span> : <><Send size={13} /> Jama Karein</>}
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
