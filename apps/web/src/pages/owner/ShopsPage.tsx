import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Store, UserPlus, Phone, MapPin, Trash2, Crown, ShieldOff, ShieldCheck,
  CreditCard, Calendar, Search, AlertTriangle, Clock, KeyRound, Eye, EyeOff,
  TrendingUp, Users, BarChart3, X, ChevronRight, StickyNote, Banknote,
  Activity, FileText, Plus, Package,
} from 'lucide-react';
import { ownerApi, type Shop, type CreateShopInput, type CreateShopOwnerInput, type Plan, type ShopDetail, type AdminPaymentLog, type PlatformStats, type SuperAdminAuditLog } from '../../api/owner.api.ts';
import { authApi } from '../../api/auth.api.ts';
import { getErrorMessage } from '../../utils/error.ts';
import { CardSkeleton } from '../../components/ui/Skeleton.tsx';
import { fmtDate } from '../../utils/dateFormat.ts';
import ConfirmDialog from '../../components/ui/ConfirmDialog.tsx';

// ── helpers ──────────────────────────────────────────────────────────────────

type ShopStatus = 'active' | 'suspended' | 'expired';

function shopStatus(shop: Shop): ShopStatus {
  if (!shop.isActive) return 'suspended';
  const now = Date.now();
  if (shop.plan === 'TRIAL' && shop.trialEndsAt && new Date(shop.trialEndsAt).getTime() < now) return 'expired';
  if (shop.planExpiresAt && new Date(shop.planExpiresAt).getTime() < now) return 'expired';
  return 'active';
}

function daysLabel(shop: Shop): { text: string; urgent: boolean } | null {
  const now = Date.now();
  if (shop.plan === 'TRIAL' && shop.trialEndsAt) {
    const days = Math.ceil((new Date(shop.trialEndsAt).getTime() - now) / 86_400_000);
    if (days < 0) return { text: 'Trial expired', urgent: true };
    if (days === 0) return { text: 'Trial expires today', urgent: true };
    return { text: `Trial: ${days}d left`, urgent: days <= 3 };
  }
  if (shop.planExpiresAt) {
    const days = Math.ceil((new Date(shop.planExpiresAt).getTime() - now) / 86_400_000);
    if (days < 0) return { text: 'Plan expired', urgent: true };
    if (days === 0) return { text: 'Expires today', urgent: true };
    return { text: `Expires ${fmtDate(shop.planExpiresAt)}`, urgent: days <= 7 };
  }
  return null;
}

// ── plan styles ───────────────────────────────────────────────────────────────

const PLAN_STYLES: Record<string, string> = {
  TRIAL:      'bg-amber-50 text-amber-600 border-amber-200',
  BASIC:      'bg-blue-50 text-blue-600 border-blue-200',
  PRO:        'bg-purple-50 text-purple-600 border-purple-200',
  ENTERPRISE: 'bg-indigo-50 text-indigo-600 border-indigo-200',
};

const PLAN_LABELS: Record<Plan, string> = {
  TRIAL:      'Trial (14 days free)',
  BASIC:      'Basic — Rs 2,999/mo',
  PRO:        'Pro — Rs 7,999/mo',
  ENTERPRISE: 'Enterprise — Custom',
};

const STATUS_META: Record<ShopStatus, { label: string; cls: string; icon: React.ReactNode }> = {
  active:    { label: 'Active',     cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: <ShieldCheck size={10} /> },
  suspended: { label: 'Suspended',  cls: 'bg-red-100 text-red-600 border-red-200',             icon: <ShieldOff size={10} /> },
  expired:   { label: 'Expired',    cls: 'bg-orange-100 text-orange-700 border-orange-200',    icon: <AlertTriangle size={10} /> },
};

// ── shared field ─────────────────────────────────────────────────────────────

function Field({ label, value, onChange, type = 'text', placeholder = '' }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition" />
    </div>
  );
}

// ── modals ────────────────────────────────────────────────────────────────────

function ShopFormModal({ onClose, onSubmit, isPending }: {
  onClose: () => void; onSubmit: (d: CreateShopInput) => void; isPending: boolean;
}) {
  const [form, setForm] = useState<CreateShopInput>({ shopName: '', phone: '', address: '', plan: 'TRIAL' });
  const set = (k: keyof CreateShopInput, v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="space-y-4">
      <Field label="Shop name" value={form.shopName} onChange={(v) => set('shopName', v)} placeholder="e.g. City Electronics" />
      <Field label="Phone" value={form.phone} onChange={(v) => set('phone', v)} placeholder="03XX-XXXXXXX" />
      <Field label="Address (optional)" value={form.address ?? ''} onChange={(v) => set('address', v)} placeholder="City, Area" />
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">Plan</label>
        <div className="flex gap-2 flex-wrap">
          {(['TRIAL', 'BASIC', 'PRO', 'ENTERPRISE'] as Plan[]).map((p) => (
            <button key={p} onClick={() => set('plan', p)}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition min-w-15 ${
                form.plan === p ? PLAN_STYLES[p] : 'border-gray-200 text-gray-400 hover:border-gray-300'
              }`}>
              {p === 'TRIAL' ? 'Trial' : p === 'BASIC' ? 'Basic' : p === 'PRO' ? 'Pro' : 'Enterprise'}
            </button>
          ))}
        </div>
        {form.plan === 'TRIAL' && <p className="text-xs text-gray-400 mt-1">14-day free trial</p>}
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={onClose}
          className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">Cancel</button>
        <button onClick={() => onSubmit({ ...form, address: form.address || undefined })}
          disabled={!form.shopName || !form.phone || isPending}
          className="flex-1 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition disabled:opacity-50">
          {isPending ? 'Creating…' : 'Create Shop'}
        </button>
      </div>
    </div>
  );
}

function OwnerFormModal({ shop, onClose, onSubmit, isPending }: {
  shop: Shop; onClose: () => void; onSubmit: (d: CreateShopOwnerInput) => void; isPending: boolean;
}) {
  const [form, setForm] = useState<CreateShopOwnerInput>({ name: '', email: '', password: '' });
  const set = (k: keyof CreateShopOwnerInput, v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl">
        <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
          <Store size={16} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">{shop.shopName}</p>
          <p className="text-xs text-gray-500">{shop.phone}</p>
        </div>
      </div>
      <Field label="Full name" value={form.name} onChange={(v) => set('name', v)} placeholder="Owner's full name" />
      <Field label="Email" value={form.email} onChange={(v) => set('email', v)} type="email" placeholder="owner@example.com" />
      <Field label="Password" value={form.password} onChange={(v) => set('password', v)} type="password" placeholder="Min 8 characters" />
      <div className="flex gap-2 pt-1">
        <button onClick={onClose}
          className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">Cancel</button>
        <button onClick={() => onSubmit(form)}
          disabled={!form.name || !form.email || form.password.length < 8 || isPending}
          className="flex-1 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition disabled:opacity-50">
          {isPending ? 'Creating…' : 'Create Owner'}
        </button>
      </div>
    </div>
  );
}

function PlanChangeModal({ shop, onClose, onSubmit, isPending }: {
  shop: Shop; onClose: () => void;
  onSubmit: (plan: Plan, expiresAt?: string) => void;
  isPending: boolean;
}) {
  const [plan, setPlan] = useState<Plan>(shop.plan);
  const [expiresAt, setExpiresAt] = useState(shop.planExpiresAt ? shop.planExpiresAt.slice(0, 10) : '');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl">
        <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
          <Store size={16} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">{shop.shopName}</p>
          <p className="text-xs text-gray-500">Current plan: <span className="font-medium">{shop.plan}</span></p>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2">New Plan</label>
        <div className="space-y-2">
          {(['TRIAL', 'BASIC', 'PRO', 'ENTERPRISE'] as Plan[]).map((p) => (
            <button key={p} onClick={() => setPlan(p)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm transition ${
                plan === p ? `${PLAN_STYLES[p]} font-semibold` : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}>
              <span>{p}</span>
              <span className="text-xs font-normal opacity-70">{PLAN_LABELS[p]}</span>
            </button>
          ))}
        </div>
      </div>
      {plan !== 'TRIAL' && (
        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1.5">
            <Calendar size={11} /> Plan expiry date
          </label>
          <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
            min={new Date().toISOString().slice(0, 10)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition" />
          <p className="text-xs text-gray-400 mt-1">Leave blank for no expiry</p>
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <button onClick={onClose}
          className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">Cancel</button>
        <button onClick={() => onSubmit(plan, expiresAt || undefined)} disabled={isPending}
          className="flex-1 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition disabled:opacity-50">
          {isPending ? 'Updating…' : 'Update Plan'}
        </button>
      </div>
    </div>
  );
}

// ── change-password modal ─────────────────────────────────────────────────────

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent]     = useState('');
  const [next, setNext]           = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext]       = useState(false);

  const mutation = useMutation({
    mutationFn: () => authApi.changePassword({ currentPassword: current, newPassword: next }),
    onSuccess: () => { toast.success('Password change ho gaya'); onClose(); },
    onError:   (e) => toast.error(getErrorMessage(e, 'Password change nahi hua')),
  });

  const inp = 'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition';
  const mismatch = next.length > 0 && confirm.length > 0 && next !== confirm;
  const canSubmit = current.length > 0 && next.length >= 8 && next === confirm && !mutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center">
            <KeyRound size={16} className="text-indigo-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Password Change Karo</h2>
            <p className="text-xs text-gray-400">Naya password min 8 characters ka hona chahiye</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Purana Password</label>
            <div className="relative">
              <input type={showCurrent ? 'text' : 'password'} value={current}
                onChange={(e) => setCurrent(e.target.value)} className={inp} placeholder="Current password" />
              <button type="button" onClick={() => setShowCurrent((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Naya Password</label>
            <div className="relative">
              <input type={showNext ? 'text' : 'password'} value={next}
                onChange={(e) => setNext(e.target.value)} className={inp} placeholder="Min 8 characters" />
              <button type="button" onClick={() => setShowNext((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showNext ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {next.length > 0 && next.length < 8 && (
              <p className="text-xs text-red-500 mt-1">Kam se kam 8 characters chahiye</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Naya Password Confirm Karo</label>
            <input type="password" value={confirm}
              onChange={(e) => setConfirm(e.target.value)} className={`${inp} ${mismatch ? 'border-red-300 focus:border-red-400 focus:ring-red-50' : ''}`}
              placeholder="Dobara likhein" />
            {mismatch && <p className="text-xs text-red-500 mt-1">Passwords match nahi ho rahe</p>}
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={onClose}
              className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">
              Cancel
            </button>
            <button onClick={() => mutation.mutate()} disabled={!canSubmit}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition disabled:opacity-50">
              {mutation.isPending ? 'Saving…' : 'Change Karo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── shop card ─────────────────────────────────────────────────────────────────

function ShopCard({ shop, onAddOwner, onDelete, onToggleStatus, onChangePlan, onViewDetails }: {
  shop: Shop;
  onAddOwner: () => void;
  onDelete: () => void;
  onToggleStatus: () => void;
  onChangePlan: () => void;
  onViewDetails: () => void;
}) {
  const status = shopStatus(shop);
  const meta   = STATUS_META[status];
  const expiry = daysLabel(shop);

  return (
    <div className={`rounded-2xl border flex flex-col gap-0 overflow-hidden transition-shadow hover:shadow-md ${
      status === 'suspended' ? 'bg-gray-50 border-gray-200' :
      status === 'expired'   ? 'bg-orange-50/40 border-orange-100' :
      'bg-white border-gray-100 shadow-sm'
    }`}>
      {/* Top colour bar */}
      <div className={`h-1 w-full ${
        status === 'suspended' ? 'bg-gray-300' :
        status === 'expired'   ? 'bg-orange-400' :
        'bg-indigo-500'
      }`} />

      <div className="p-5 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              status === 'active' ? 'bg-indigo-50' : status === 'expired' ? 'bg-orange-100' : 'bg-gray-100'
            }`}>
              <Store size={18} className={
                status === 'active' ? 'text-indigo-600' : status === 'expired' ? 'text-orange-500' : 'text-gray-400'
              } />
            </div>
            <div className="min-w-0">
              <p className={`font-semibold text-sm leading-tight truncate ${status === 'suspended' ? 'text-gray-400' : 'text-gray-900'}`}>
                {shop.shopName}
              </p>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold border ${PLAN_STYLES[shop.plan]}`}>
                  {shop.plan}
                </span>
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold border ${meta.cls}`}>
                  {meta.icon} {meta.label}
                </span>
              </div>
            </div>
          </div>

          {/* Action icons */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button onClick={onViewDetails} title="View details"
              className="p-2 text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition">
              <ChevronRight size={14} />
            </button>
            <button onClick={onChangePlan} title="Change plan"
              className="p-2 text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition">
              <CreditCard size={14} />
            </button>
            <button onClick={onToggleStatus}
              title={status === 'suspended' ? 'Activate shop' : 'Suspend shop'}
              className={`p-2 rounded-lg transition ${
                status === 'suspended'
                  ? 'text-emerald-500 hover:bg-emerald-50'
                  : 'text-gray-300 hover:text-amber-500 hover:bg-amber-50'
              }`}>
              {status === 'suspended' ? <ShieldCheck size={14} /> : <ShieldOff size={14} />}
            </button>
            <button onClick={onDelete} title="Delete shop"
              className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Phone size={11} className="text-gray-300 shrink-0" />
            {shop.phone}
          </div>
          {shop.address && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <MapPin size={11} className="text-gray-300 shrink-0" />
              {shop.address}
            </div>
          )}
          {expiry && (
            <div className={`flex items-center gap-1.5 text-xs font-medium ${expiry.urgent ? 'text-red-500' : 'text-gray-400'}`}>
              <Clock size={11} className="shrink-0" />
              {expiry.text}
            </div>
          )}
        </div>

        {/* Owner */}
        <div className="pt-3 border-t border-gray-100">
          {shop.ownerName ? (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {shop.ownerName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-900 truncate">{shop.ownerName}</p>
                <p className="text-[10px] text-gray-400 truncate">{shop.ownerEmail}</p>
              </div>
              <Crown size={12} className="text-amber-400 ml-auto shrink-0" />
            </div>
          ) : (
            <button onClick={onAddOwner}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-indigo-200 text-indigo-500 hover:bg-indigo-50 text-xs font-medium transition">
              <UserPlus size={13} />
              Add owner
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── filter bar ────────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'active' | 'suspended' | 'expired';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all',       label: 'All'       },
  { key: 'active',    label: 'Active'    },
  { key: 'suspended', label: 'Suspended' },
  { key: 'expired',   label: 'Expired'   },
];

// ── platform dashboard (A1) ──────────────────────────────────────────────────

function PlatformDashboard({ stats }: { stats: PlatformStats }) {
  const fmtPKR = (n: number) =>
    n >= 1_000_000
      ? `PKR ${(n / 1_000_000).toFixed(2)}M`
      : n >= 1_000
        ? `PKR ${(n / 1_000).toFixed(0)}K`
        : `PKR ${n}`;

  const hasUrgent = stats.trialExpiring7.length + stats.planExpiring7.length > 0;

  return (
    <div className="mb-6 space-y-4">
      {/* Revenue */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'MRR (expected)',       value: fmtPKR(stats.mrr),                    color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
          { label: 'Revenue this month',   value: fmtPKR(stats.revenueThisMonth),       color: 'text-indigo-600',  bg: 'bg-indigo-50 border-indigo-100'   },
          { label: 'Total collected ever', value: fmtPKR(stats.totalRevenueCollected),  color: 'text-gray-800',    bg: 'bg-white border-gray-100'          },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} border rounded-2xl p-4`}>
            <p className="text-xs text-gray-400 font-medium flex items-center gap-1.5">
              <TrendingUp size={11} /> {s.label}
            </p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Shop counts */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {[
          { label: 'Total',     value: stats.totalShops,     color: 'text-gray-900'    },
          { label: 'Active',    value: stats.activeShops,    color: 'text-emerald-600' },
          { label: 'Trial',     value: stats.trialShops,     color: 'text-amber-600'   },
          { label: 'Paid',      value: stats.paidShops,      color: 'text-indigo-600'  },
          { label: 'Suspended', value: stats.suspendedShops, color: 'text-red-500'     },
          { label: 'Expired',   value: stats.expiredShops,   color: 'text-orange-600'  },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-xl p-3 text-center">
            <p className="text-[10px] text-gray-400 font-medium">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Platform totals + expiry alert */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <p className="text-xs text-gray-400 font-medium flex items-center gap-1.5"><Users size={11} /> Total customers</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalCustomers.toLocaleString()}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <p className="text-xs text-gray-400 font-medium flex items-center gap-1.5"><Package size={11} /> Total installments</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalInstallments.toLocaleString()}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <p className="text-xs text-gray-400 font-medium flex items-center gap-1.5"><BarChart3 size={11} /> New this month</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{stats.newThisMonth}</p>
        </div>
        <div className={`border rounded-2xl p-4 ${hasUrgent ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-100'}`}>
          <p className={`text-xs font-medium flex items-center gap-1.5 ${hasUrgent ? 'text-red-600' : 'text-emerald-600'}`}>
            <AlertTriangle size={11} /> Expiry alerts
          </p>
          {hasUrgent ? (
            <p className="text-xl font-bold text-red-600 mt-1">
              {stats.trialExpiring7.length + stats.planExpiring7.length} urgent
            </p>
          ) : (
            <p className="text-xl font-bold text-emerald-600 mt-1">All clear</p>
          )}
          <p className="text-[10px] text-gray-400 mt-0.5">Within 7 days</p>
        </div>
      </div>

      {/* Expiry warning list */}
      {(stats.trialExpiring7.length > 0 || stats.planExpiring7.length > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-xs font-semibold text-amber-700 mb-3 flex items-center gap-1.5">
            <AlertTriangle size={12} /> Urgent — expiring within 7 days
          </p>
          <div className="space-y-2">
            {stats.trialExpiring7.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-xs">
                <span className="font-medium text-gray-800">{s.shopName}</span>
                <span className="text-amber-700 font-semibold bg-amber-100 px-2 py-0.5 rounded-lg">
                  Trial ends {fmtDate(s.trialEndsAt!)}
                </span>
              </div>
            ))}
            {stats.planExpiring7.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-xs">
                <span className="font-medium text-gray-800">{s.shopName}</span>
                <span className="text-red-700 font-semibold bg-red-100 px-2 py-0.5 rounded-lg">
                  Plan ends {fmtDate(s.planExpiresAt!)}
                </span>
              </div>
            ))}
          </div>
          {stats.planExpiring14.length > 0 && (
            <p className="text-[11px] text-amber-600 mt-2.5">
              +{stats.planExpiring14.length} more expiring within 14 days
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── shop detail panel (A3 + A4 + A7) ─────────────────────────────────────────

function UsageBar({ used, limit, label }: { used: number; limit: number; label: string }) {
  const pct = limit <= 0 ? 0 : Math.min(100, (used / limit) * 100);
  const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-indigo-500';
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-600">{label}</span>
        <span className={`font-semibold ${pct >= 90 ? 'text-red-500' : 'text-gray-700'}`}>
          {used} / {limit <= 0 ? '∞' : limit}
        </span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const PAYMENT_METHODS = ['BANK', 'JAZZCASH', 'EASYPAISA', 'CASH', 'OTHER'];

function ShopDetailPanel({ shopId, onClose }: { shopId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('BANK');
  const [payRef, setPayRef]       = useState('');
  const [payMonth, setPayMonth]   = useState('');
  const [payNote, setPayNote]     = useState('');
  const [showPayForm, setShowPayForm] = useState(false);
  const [noteText, setNoteText]   = useState('');

  const { data: detail, isLoading } = useQuery({
    queryKey: ['owner-shop-detail', shopId],
    queryFn: () => ownerApi.getShopUsage(shopId),
    staleTime: 30_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['owner-shop-detail', shopId] });

  const addLogMutation = useMutation({
    mutationFn: () =>
      ownerApi.addPaymentLog(shopId, {
        amount: Number(payAmount), method: payMethod,
        reference: payRef || undefined, forMonth: payMonth || undefined, note: payNote || undefined,
      }),
    onSuccess: () => {
      invalidate();
      setPayAmount(''); setPayRef(''); setPayMonth(''); setPayNote('');
      setShowPayForm(false);
      toast.success('Payment logged');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const deleteLogMutation = useMutation({
    mutationFn: (logId: string) => ownerApi.deletePaymentLog(logId),
    onSuccess: () => { invalidate(); toast.success('Log deleted'); },
    onError:   (e) => toast.error(getErrorMessage(e)),
  });

  const addNoteMutation = useMutation({
    mutationFn: () => ownerApi.addShopNote(shopId, noteText),
    onSuccess: () => { invalidate(); setNoteText(''); toast.success('Note saved'); },
    onError:   (e) => toast.error(getErrorMessage(e)),
  });

  const deleteNoteMutation = useMutation({
    mutationFn: ({ noteId }: { noteId: string }) => ownerApi.deleteShopNote(shopId, noteId),
    onSuccess: () => { invalidate(); toast.success('Note deleted'); },
    onError:   (e) => toast.error(getErrorMessage(e)),
  });

  const fmtPKR = (n: number | string) => `PKR ${Number(n).toLocaleString()}`;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center">
            <Store size={16} className="text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 truncate">
              {detail?.shop.shopName ?? '…'}
            </p>
            <p className="text-xs text-gray-400">{detail?.shop.phone ?? ''}</p>
          </div>
          <button onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : detail ? (
            <>
              {/* Plan + status badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex px-2.5 py-1 rounded-xl text-xs font-semibold border ${PLAN_STYLES[detail.shop.plan]}`}>
                  {detail.shop.plan}
                </span>
                {detail.limits?.label && (
                  <span className="text-xs text-gray-500 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-xl">
                    {detail.limits.label}
                  </span>
                )}
                {!detail.shop.isActive && (
                  <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-xl">
                    Suspended
                  </span>
                )}
              </div>

              {/* Revenue + activity */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                  <p className="text-xs text-gray-500 flex items-center gap-1"><TrendingUp size={10}/> Total revenue</p>
                  <p className="text-base font-bold text-emerald-700 mt-0.5">{fmtPKR(detail.usage.totalRevenue)}</p>
                </div>
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                  <p className="text-xs text-gray-500 flex items-center gap-1"><Activity size={10}/> Payments/month</p>
                  <p className="text-base font-bold text-indigo-700 mt-0.5">{detail.usage.paymentsThisMonth}</p>
                </div>
                {detail.usage.lastActivity && (
                  <div className="col-span-2 flex items-center gap-1.5 text-xs text-gray-400">
                    <Clock size={11} />
                    Last activity: {fmtDate(String(detail.usage.lastActivity))}
                  </div>
                )}
              </div>

              {/* Usage bars */}
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                  <BarChart3 size={12} /> Plan Usage
                </p>
                <UsageBar used={detail.usage.customers}    limit={detail.limits?.customers ?? -1}    label="Customers" />
                <UsageBar used={detail.usage.installments} limit={detail.limits?.installments ?? -1} label="Installments" />
                <UsageBar used={detail.usage.staff}        limit={detail.limits?.staff ?? -1}        label="Staff" />
              </div>

              {/* Payment logs (A4) */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                    <Banknote size={14} className="text-gray-400" /> Payment Logs
                  </p>
                  <button onClick={() => setShowPayForm((v) => !v)}
                    className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700">
                    <Plus size={13} /> Add
                  </button>
                </div>

                {showPayForm && (
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 space-y-3 mb-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Amount (PKR)*</label>
                        <input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)}
                          placeholder="5000" min="1"
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Method</label>
                        <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
                          {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
                        </select>
                      </div>
                    </div>
                    <input value={payRef} onChange={(e) => setPayRef(e.target.value)}
                      placeholder="Transaction reference (optional)"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                    <div className="grid grid-cols-2 gap-2">
                      <input value={payMonth} onChange={(e) => setPayMonth(e.target.value)}
                        placeholder="For month (e.g. Jul 2026)"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                      <input value={payNote} onChange={(e) => setPayNote(e.target.value)}
                        placeholder="Internal note"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setShowPayForm(false)}
                        className="flex-1 py-2 text-sm border border-gray-200 text-gray-600 rounded-xl hover:bg-white transition">
                        Cancel
                      </button>
                      <button
                        onClick={() => addLogMutation.mutate()}
                        disabled={!payAmount || Number(payAmount) <= 0 || addLogMutation.isPending}
                        className="flex-1 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition disabled:opacity-50">
                        {addLogMutation.isPending ? 'Saving…' : 'Save Log'}
                      </button>
                    </div>
                  </div>
                )}

                {detail.paymentLogs.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-3">No payment logs yet</p>
                ) : (
                  <div className="space-y-2">
                    {detail.paymentLogs.map((log) => (
                      <div key={log.id} className="flex items-start justify-between bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900">{fmtPKR(log.amount)}</p>
                          <p className="text-xs text-gray-400">
                            {log.method}
                            {log.forMonth ? ` · ${log.forMonth}` : ''}
                            {log.reference ? ` · ${log.reference}` : ''}
                          </p>
                          {log.note && <p className="text-xs text-gray-400 italic">{log.note}</p>}
                          <p className="text-[10px] text-gray-300 mt-0.5">{fmtDate(log.createdAt)}</p>
                        </div>
                        <button onClick={() => deleteLogMutation.mutate(log.id)}
                          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition ml-2 mt-0.5 shrink-0">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Internal notes (A7) */}
              <div>
                <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5 mb-3">
                  <StickyNote size={14} className="text-gray-400" /> Internal Notes
                </p>

                <div className="flex gap-2 mb-3">
                  <input value={noteText} onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add a note about this shop…"
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                  <button
                    onClick={() => addNoteMutation.mutate()}
                    disabled={!noteText.trim() || addNoteMutation.isPending}
                    className="px-3 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition disabled:opacity-50">
                    {addNoteMutation.isPending ? '…' : 'Add'}
                  </button>
                </div>

                {detail.notes.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-3">No notes yet</p>
                ) : (
                  <div className="space-y-2">
                    {detail.notes.map((note) => (
                      <div key={note.id}
                        className="flex items-start justify-between bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800">{note.content}</p>
                          <p className="text-[10px] text-gray-400 mt-1">{fmtDate(note.createdAt)}</p>
                        </div>
                        <button onClick={() => deleteNoteMutation.mutate({ noteId: note.id })}
                          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition ml-2 mt-0.5 shrink-0">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center text-sm text-red-500 py-8">Failed to load shop details.</div>
          )}
        </div>
      </div>
    </>
  );
}

// ── admin audit log panel (A10) ───────────────────────────────────────────────

const ACTION_META: Record<string, { label: string; color: string }> = {
  SHOP_CREATED:        { label: 'Shop Created',       color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  SHOP_DELETED:        { label: 'Shop Deleted',        color: 'text-red-600    bg-red-50    border-red-200'       },
  SHOP_ACTIVATED:      { label: 'Shop Activated',      color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  SHOP_SUSPENDED:      { label: 'Shop Suspended',      color: 'text-orange-600 bg-orange-50 border-orange-200'   },
  SHOP_OWNER_CREATED:  { label: 'Owner Added',         color: 'text-indigo-600 bg-indigo-50 border-indigo-200'   },
  PLAN_CHANGED:        { label: 'Plan Changed',        color: 'text-purple-600 bg-purple-50 border-purple-200'   },
  PAYMENT_LOG_ADDED:   { label: 'Payment Logged',      color: 'text-blue-600   bg-blue-50   border-blue-200'     },
  PAYMENT_LOG_DELETED: { label: 'Payment Log Deleted', color: 'text-gray-600   bg-gray-50   border-gray-200'     },
  NOTE_ADDED:          { label: 'Note Added',          color: 'text-amber-700  bg-amber-50  border-amber-200'    },
  NOTE_DELETED:        { label: 'Note Deleted',        color: 'text-gray-600   bg-gray-50   border-gray-200'     },
};

function AdminAuditPanel({ onClose, filterShopId }: { onClose: () => void; filterShopId?: string | null }) {
  const [shopFilter, setShopFilter] = useState(filterShopId ?? '');

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['admin-audit-logs', shopFilter],
    queryFn: () => ownerApi.listAdminAuditLogs(shopFilter || undefined, 200),
    staleTime: 30_000,
  });

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="w-9 h-9 bg-purple-50 rounded-xl flex items-center justify-center">
            <FileText size={16} className="text-purple-600" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-gray-900">Admin Audit Log</p>
            <p className="text-xs text-gray-400">Super-admin ke actions ka record</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition">
            <X size={16} />
          </button>
        </div>

        {/* Shop filter */}
        <div className="px-5 py-3 border-b border-gray-100 shrink-0">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
            <input value={shopFilter} onChange={(e) => setShopFilter(e.target.value)}
              placeholder="Filter by shop ID (leave blank for all)…"
              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="space-y-3">
              {[1,2,3,4,5].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : logs.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-10">No audit logs yet</p>
          ) : (
            <div className="space-y-2">
              {logs.map((log: SuperAdminAuditLog) => {
                const meta = ACTION_META[log.action] ?? { label: log.action, color: 'text-gray-600 bg-gray-50 border-gray-200' };
                return (
                  <div key={log.id} className="border border-gray-100 rounded-xl px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex px-2 py-0.5 rounded-lg text-[10px] font-bold border ${meta.color}`}>
                            {meta.label}
                          </span>
                          {log.shopName && (
                            <span className="text-xs text-gray-600 font-medium truncate">{log.shopName}</span>
                          )}
                        </div>
                        {log.note && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{log.note}</p>}
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-[10px] text-gray-400">{fmtDate(log.createdAt)}</span>
                          {log.actorName && (
                            <span className="text-[10px] text-gray-400">by {log.actorName}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

type Modal = { type: 'shop' } | { type: 'owner'; shop: Shop } | { type: 'plan'; shop: Shop } | null;

export default function ShopsPage() {
  const qc = useQueryClient();
  const [modal, setModal]           = useState<Modal>(null);
  const [filter, setFilter]         = useState<FilterTab>('all');
  const [search, setSearch]         = useState('');
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; shop: Shop | null }>({ open: false, shop: null });
  const [statusConfirm, setStatusConfirm] = useState<{ open: boolean; shop: Shop | null }>({ open: false, shop: null });
  const [detailShopId, setDetailShopId] = useState<string | null>(null);
  const [showAuditLog, setShowAuditLog] = useState(false);

  const { data: shops = [], isLoading, isError } = useQuery({
    queryKey: ['owner-shops'],
    queryFn: ownerApi.listShops,
  });

  const { data: platformStats } = useQuery({
    queryKey: ['owner-stats'],
    queryFn: ownerApi.getPlatformStats,
    staleTime: 60_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['owner-shops'] });

  const createShopMutation = useMutation({
    mutationFn: ownerApi.createShop,
    onSuccess: () => { invalidate(); setModal(null); toast.success('Shop created'); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const createOwnerMutation = useMutation({
    mutationFn: ({ shopId, data }: { shopId: string; data: CreateShopOwnerInput }) =>
      ownerApi.createShopOwner(shopId, data),
    onSuccess: () => { invalidate(); setModal(null); toast.success('Shop owner created'); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const deleteShopMutation = useMutation({
    mutationFn: ownerApi.deleteShop,
    onSuccess: () => { invalidate(); toast.success('Shop deleted'); setDeleteConfirm({ open: false, shop: null }); },
    onError: (e) => { toast.error(getErrorMessage(e)); setDeleteConfirm({ open: false, shop: null }); },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      ownerApi.toggleShopStatus(id, isActive),
    onSuccess: (_, vars) => {
      invalidate();
      toast.success(vars.isActive ? 'Shop activated' : 'Shop suspended');
      setStatusConfirm({ open: false, shop: null });
    },
    onError: (e) => { toast.error(getErrorMessage(e)); setStatusConfirm({ open: false, shop: null }); },
  });

  const changePlanMutation = useMutation({
    mutationFn: ({ id, plan, expiresAt }: { id: string; plan: Plan; expiresAt?: string }) =>
      ownerApi.changePlan(id, plan, expiresAt),
    onSuccess: () => { invalidate(); setModal(null); toast.success('Plan updated'); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  // counts per filter
  const counts = useMemo(() => ({
    all:       shops.length,
    active:    shops.filter((s) => shopStatus(s) === 'active').length,
    suspended: shops.filter((s) => shopStatus(s) === 'suspended').length,
    expired:   shops.filter((s) => shopStatus(s) === 'expired').length,
  }), [shops]);

  const filtered = useMemo(() => {
    let list = shops;
    if (filter !== 'all') list = list.filter((s) => shopStatus(s) === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) =>
        s.shopName.toLowerCase().includes(q) ||
        s.phone.includes(q) ||
        (s.ownerName?.toLowerCase().includes(q) ?? false),
      );
    }
    return list;
  }, [shops, filter, search]);

  const pendingToggle = statusConfirm.shop;
  const willActivate  = pendingToggle ? !pendingToggle.isActive : false;

  return (
    <div className="px-4 py-5 sm:p-6 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shops</h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage all registered shops</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAuditLog(true)} title="Admin audit log"
            className="p-2.5 border border-gray-200 rounded-xl text-gray-500 hover:text-purple-600 hover:border-purple-300 hover:bg-purple-50 transition">
            <FileText size={16} />
          </button>
          <button onClick={() => setShowChangePwd(true)} title="Change password"
            className="p-2.5 border border-gray-200 rounded-xl text-gray-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition">
            <KeyRound size={16} />
          </button>
          <button onClick={() => setModal({ type: 'shop' })}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition shadow-sm shadow-indigo-200">
            + New shop
          </button>
        </div>
      </div>

      {/* A1: Platform dashboard */}
      {platformStats && <PlatformDashboard stats={platformStats} />}

      {/* Quick filter stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total',     value: counts.all,       color: 'text-gray-900',    bg: 'bg-gray-50',    border: 'border-gray-100' },
          { label: 'Active',    value: counts.active,    color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
          { label: 'Suspended', value: counts.suspended, color: 'text-red-500',     bg: 'bg-red-50',     border: 'border-red-100' },
          { label: 'Expired',   value: counts.expired,   color: 'text-orange-600',  bg: 'bg-orange-50',  border: 'border-orange-100' },
        ].map((s) => (
          <button
            key={s.label}
            onClick={() => setFilter((s.label === 'Total' ? 'all' : s.label.toLowerCase()) as FilterTab)}
            className={`${s.bg} border ${s.border} rounded-2xl p-4 text-left transition hover:shadow-sm ${
              filter === s.label.toLowerCase() ? 'ring-2 ring-indigo-400' : ''
            }`}
          >
            <p className="text-xs text-gray-500 font-medium">{s.label}</p>
            <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </button>
        ))}
      </div>

      {/* Search + Filter tabs */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search shops…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {FILTER_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                filter === t.key
                  ? t.key === 'active'    ? 'bg-emerald-600 text-white border-emerald-600'
                  : t.key === 'suspended' ? 'bg-red-500 text-white border-red-500'
                  : t.key === 'expired'   ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
              }`}
            >
              {t.label}
              <span className={`ml-1.5 font-mono ${filter === t.key ? 'opacity-80' : 'text-gray-400'}`}>
                {counts[t.key]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
        </div>
      ) : isError ? (
        <div className="text-center py-16 text-sm text-red-500">Failed to load shops.</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Store size={28} className="text-indigo-400" />
          </div>
          <p className="text-gray-500 font-medium">
            {shops.length === 0 ? 'No shops yet' : `No ${filter === 'all' ? '' : filter + ' '}shops found`}
          </p>
          {shops.length === 0 && (
            <>
              <p className="text-sm text-gray-400 mt-1">Create your first shop to get started.</p>
              <button onClick={() => setModal({ type: 'shop' })}
                className="mt-4 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition">
                + New shop
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((shop) => (
            <ShopCard
              key={shop.id}
              shop={shop}
              onAddOwner={() => setModal({ type: 'owner', shop })}
              onChangePlan={() => setModal({ type: 'plan', shop })}
              onDelete={() => setDeleteConfirm({ open: true, shop })}
              onToggleStatus={() => setStatusConfirm({ open: true, shop })}
              onViewDetails={() => setDetailShopId(shop.id)}
            />
          ))}
        </div>
      )}

      {/* Form modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-base font-bold text-gray-900 mb-5">
              {modal.type === 'shop' ? 'Create new shop' : modal.type === 'owner' ? 'Add shop owner' : 'Change plan'}
            </h2>
            {modal.type === 'shop' ? (
              <ShopFormModal
                onClose={() => setModal(null)}
                onSubmit={(d) => createShopMutation.mutate(d)}
                isPending={createShopMutation.isPending}
              />
            ) : modal.type === 'owner' ? (
              <OwnerFormModal
                shop={modal.shop}
                onClose={() => setModal(null)}
                onSubmit={(d) => createOwnerMutation.mutate({ shopId: modal.shop.id, data: d })}
                isPending={createOwnerMutation.isPending}
              />
            ) : (
              <PlanChangeModal
                shop={modal.shop}
                onClose={() => setModal(null)}
                onSubmit={(plan, expiresAt) => changePlanMutation.mutate({ id: modal.shop.id, plan, expiresAt })}
                isPending={changePlanMutation.isPending}
              />
            )}
          </div>
        </div>
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteConfirm.open}
        title="Shop Permanently Delete Karo?"
        description={`"${deleteConfirm.shop?.shopName ?? ''}" aur iska sara data — customers, installments, payments, products, staff accounts — permanently delete ho jaega. Ye action undo nahi ho sakta.`}
        confirmLabel="Haan, Delete Karo"
        variant="danger"
        isPending={deleteShopMutation.isPending}
        onConfirm={() => { if (deleteConfirm.shop) deleteShopMutation.mutate(deleteConfirm.shop.id); }}
        onCancel={() => setDeleteConfirm({ open: false, shop: null })}
      />

      {/* Suspend / Activate confirm */}
      <ConfirmDialog
        open={statusConfirm.open}
        title={willActivate ? 'Shop Activate Karo?' : 'Shop Suspend Karo?'}
        description={
          willActivate
            ? `"${pendingToggle?.shopName}" ko wapas activate kar diya jaega. Owner login kar sakenge.`
            : `"${pendingToggle?.shopName}" suspend ho jaegi. Owner aur staff login nahi kar sakenge.`
        }
        confirmLabel={willActivate ? 'Activate Karo' : 'Suspend Karo'}
        variant={willActivate ? 'info' : 'warning'}
        isPending={toggleStatusMutation.isPending}
        onConfirm={() => {
          if (pendingToggle) toggleStatusMutation.mutate({ id: pendingToggle.id, isActive: !pendingToggle.isActive });
        }}
        onCancel={() => setStatusConfirm({ open: false, shop: null })}
      />

      {/* Change password modal */}
      {showChangePwd && <ChangePasswordModal onClose={() => setShowChangePwd(false)} />}

      {/* A3 + A4 + A7: Shop detail slide-over */}
      {detailShopId && (
        <ShopDetailPanel
          shopId={detailShopId}
          onClose={() => setDetailShopId(null)}
        />
      )}

      {/* A10: Admin audit log panel */}
      {showAuditLog && (
        <AdminAuditPanel
          onClose={() => setShowAuditLog(false)}
        />
      )}
    </div>
  );
}
