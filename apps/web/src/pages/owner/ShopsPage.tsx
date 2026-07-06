import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Store, UserPlus, Phone, MapPin, Trash2, Crown, ShieldOff, ShieldCheck,
  CreditCard, Calendar, Search, AlertTriangle, Clock, KeyRound, Eye, EyeOff,
  TrendingUp, TrendingDown, Users, BarChart3, X, ChevronRight, StickyNote, Banknote,
  Activity, FileText, Plus, Package, Monitor, Smartphone, Table2,
  ShieldAlert, LogOut, Wifi, CheckCircle2, XCircle, Mail, Megaphone, ToggleLeft, ToggleRight,
  ListChecks, Circle, Download,
} from 'lucide-react';
import { ownerApi, type Shop, type CreateShopInput, type CreateShopOwnerInput, type Plan, type PlatformStats, type SuperAdminAuditLog, type ShopSession, type ShopChurnScore, type ChurnRisk, type AdminBroadcast, type ShopOnboarding, type StuckSeverity } from '../../api/owner.api.ts';
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

function PlatformDashboard({ stats, onSendReminder, sendingId }: {
  stats: PlatformStats;
  onSendReminder?: (shopId: string) => void;
  sendingId?: string | null;
}) {
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
              <div key={s.id} className="flex items-center justify-between text-xs gap-2 flex-wrap">
                <span className="font-medium text-gray-800">{s.shopName}</span>
                <div className="flex items-center gap-2">
                  <span className="text-amber-700 font-semibold bg-amber-100 px-2 py-0.5 rounded-lg">
                    Trial ends {fmtDate(s.trialEndsAt!)}
                  </span>
                  {onSendReminder && (
                    <button
                      onClick={() => onSendReminder(s.id)}
                      disabled={sendingId === s.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600 font-semibold hover:bg-indigo-100 transition disabled:opacity-50">
                      {sendingId === s.id ? '…' : <><Mail size={10} /> Remind</>}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {stats.planExpiring7.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-xs gap-2 flex-wrap">
                <span className="font-medium text-gray-800">{s.shopName}</span>
                <div className="flex items-center gap-2">
                  <span className="text-red-700 font-semibold bg-red-100 px-2 py-0.5 rounded-lg">
                    Plan ends {fmtDate(s.planExpiresAt!)}
                  </span>
                  {onSendReminder && (
                    <button
                      onClick={() => onSendReminder(s.id)}
                      disabled={sendingId === s.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600 font-semibold hover:bg-indigo-100 transition disabled:opacity-50">
                      {sendingId === s.id ? '…' : <><Mail size={10} /> Remind</>}
                    </button>
                  )}
                </div>
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

type DetailTab = 'overview' | 'sessions';

function timeAgo(dateStr: string | null) {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 1)   return 'Just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function DeviceIcon({ type }: { type: string | null }) {
  if (type === 'mobile')  return <Smartphone size={14} className="text-indigo-500" />;
  if (type === 'tablet')  return <Table2    size={14} className="text-purple-500"  />;
  return                         <Monitor    size={14} className="text-gray-500"    />;
}

function ShopDetailPanel({ shopId, onClose, onSendReminder, sendingId }: {
  shopId: string;
  onClose: () => void;
  onSendReminder?: (shopId: string) => void;
  sendingId?: string | null;
}) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('BANK');
  const [payRef, setPayRef]       = useState('');
  const [payMonth, setPayMonth]   = useState('');
  const [payNote, setPayNote]     = useState('');
  const [showPayForm, setShowPayForm] = useState(false);
  const [noteText, setNoteText]   = useState('');
  const [killAllPending, setKillAllPending] = useState(false);

  const { data: detail, isLoading } = useQuery({
    queryKey: ['owner-shop-detail', shopId],
    queryFn: () => ownerApi.getShopUsage(shopId),
    staleTime: 30_000,
  });

  const { data: sessionsData, isLoading: sessionsLoading, refetch: refetchSessions } = useQuery({
    queryKey: ['owner-shop-sessions', shopId],
    queryFn: () => ownerApi.getShopSessions(shopId),
    staleTime: 15_000,
    enabled: activeTab === 'sessions',
  });

  const killSessionMutation = useMutation({
    mutationFn: (sessionId: string) => ownerApi.killSession(shopId, sessionId),
    onSuccess: () => { void refetchSessions(); toast.success('Session terminated'); },
    onError:   (e) => toast.error(getErrorMessage(e)),
  });

  const killAllMutation = useMutation({
    mutationFn: () => ownerApi.killAllSessions(shopId),
    onSuccess: (data) => {
      setKillAllPending(false);
      void refetchSessions();
      toast.success(`${data.killed} session${data.killed !== 1 ? 's' : ''} terminated`);
    },
    onError: (e) => { setKillAllPending(false); toast.error(getErrorMessage(e)); },
  });

  const sessions = sessionsData?.sessions ?? [];
  const suspiciousCount = sessions.filter((s: ShopSession) => s.isSuspicious).length;

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

        {/* Tab bar */}
        <div className="flex border-b border-gray-100 shrink-0 px-5">
          {([
            { key: 'overview' as const,  label: 'Overview',  icon: <BarChart3 size={13} /> },
            { key: 'sessions' as const,  label: 'Sessions',  icon: <Wifi size={13} />,
              badge: suspiciousCount > 0 ? suspiciousCount : sessions.length || undefined },
          ]).map((t) => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-3 text-xs font-semibold border-b-2 transition -mb-px ${
                activeTab === t.key
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}>
              {t.icon}
              {t.label}
              {t.badge !== undefined && (
                <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  suspiciousCount > 0 && t.key === 'sessions'
                    ? 'bg-red-100 text-red-600'
                    : 'bg-gray-100 text-gray-500'
                }`}>{t.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Overview tab */}
          {activeTab === 'overview' && isLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          )}
          {activeTab === 'overview' && !isLoading && detail ? (
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
                {onSendReminder && (
                  <button
                    onClick={() => onSendReminder(shopId)}
                    disabled={sendingId === shopId}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border bg-indigo-50 border-indigo-200 text-indigo-600 hover:bg-indigo-100 transition disabled:opacity-50 ml-auto">
                    {sendingId === shopId
                      ? <><span className="animate-spin">⟳</span> Sending…</>
                      : <><Mail size={11} /> Send Reminder</>
                    }
                  </button>
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
          ) : activeTab === 'overview' && !isLoading ? (
            <div className="text-center text-sm text-red-500 py-8">Failed to load shop details.</div>
          ) : null}

          {/* Sessions tab */}
          {activeTab === 'sessions' && (
            <div className="space-y-4">
              {/* Kill all banner */}
              <div className={`rounded-xl p-3 flex items-center justify-between gap-3 border ${
                suspiciousCount > 0
                  ? 'bg-red-50 border-red-200'
                  : 'bg-gray-50 border-gray-100'
              }`}>
                <div>
                  <p className="text-xs font-semibold text-gray-800">
                    {sessions.length} active session{sessions.length !== 1 ? 's' : ''}
                    {suspiciousCount > 0 && (
                      <span className="ml-2 text-red-600">
                        <ShieldAlert size={11} className="inline mr-1" />
                        {suspiciousCount} suspicious
                      </span>
                    )}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Last refreshed {timeAgo(new Date().toISOString())}</p>
                </div>
                {sessions.length > 0 && (
                  killAllPending ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Sure?</span>
                      <button onClick={() => killAllMutation.mutate()}
                        disabled={killAllMutation.isPending}
                        className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition disabled:opacity-50">
                        {killAllMutation.isPending ? '…' : 'Yes, Kill All'}
                      </button>
                      <button onClick={() => setKillAllPending(false)}
                        className="px-3 py-1.5 border border-gray-200 text-xs text-gray-600 rounded-lg hover:bg-gray-50 transition">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setKillAllPending(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-100 transition">
                      <LogOut size={12} /> Kill All
                    </button>
                  )
                )}
              </div>

              {/* Session cards */}
              {sessionsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Wifi size={20} className="text-gray-300" />
                  </div>
                  <p className="text-sm text-gray-400">No active sessions</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sessions.map((s: ShopSession) => (
                    <div key={s.sessionId}
                      className={`border rounded-xl p-3 transition ${
                        s.isSuspicious
                          ? 'border-red-200 bg-red-50/60'
                          : 'border-gray-100 bg-white'
                      }`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0">
                          {/* Device icon */}
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                            s.isSuspicious ? 'bg-red-100' : 'bg-gray-100'
                          }`}>
                            <DeviceIcon type={s.deviceType} />
                          </div>
                          <div className="min-w-0">
                            {/* User name + role */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-gray-900 truncate">
                                {s.userName ?? 'Unknown'}
                              </span>
                              <span className={`inline-flex px-1.5 py-0.5 rounded-md text-[10px] font-semibold border ${
                                s.userRole === 'SELLER_OWNER'
                                  ? 'bg-amber-50 text-amber-600 border-amber-200'
                                  : 'bg-gray-50 text-gray-500 border-gray-200'
                              }`}>
                                {s.userRole === 'SELLER_OWNER' ? 'Owner' : 'Staff'}
                              </span>
                              {s.isSuspicious && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-red-100 text-red-600 border border-red-200">
                                  <ShieldAlert size={9} /> Suspicious
                                </span>
                              )}
                            </div>
                            {/* Device name */}
                            <p className="text-xs text-gray-500 mt-0.5 truncate">
                              {s.deviceName ?? 'Unknown device'}
                            </p>
                            {/* IP + times */}
                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                              {s.ip && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-gray-400 font-mono bg-gray-100 px-2 py-0.5 rounded-lg">
                                  {s.ip}
                                </span>
                              )}
                              <span className="text-[11px] text-gray-400">
                                Active {timeAgo(s.lastActiveAt)}
                              </span>
                              <span className="text-[11px] text-gray-300">
                                Login {fmtDate(s.createdAt)}
                              </span>
                            </div>
                          </div>
                        </div>
                        {/* Kill button */}
                        <button
                          onClick={() => killSessionMutation.mutate(s.sessionId)}
                          disabled={killSessionMutation.isPending}
                          title="Terminate this session"
                          className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition shrink-0 mt-0.5">
                          <LogOut size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
  NOTE_ADDED:              { label: 'Note Added',          color: 'text-amber-700  bg-amber-50  border-amber-200'    },
  NOTE_DELETED:            { label: 'Note Deleted',        color: 'text-gray-600   bg-gray-50   border-gray-200'     },
  RENEWAL_REMINDER_SENT:   { label: 'Reminder Sent',       color: 'text-indigo-600 bg-indigo-50 border-indigo-200'   },
  BROADCAST_CREATED:       { label: 'Broadcast Created',   color: 'text-indigo-600 bg-indigo-50 border-indigo-200'   },
  BROADCAST_ACTIVATED:     { label: 'Broadcast On',        color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  BROADCAST_DEACTIVATED:   { label: 'Broadcast Off',       color: 'text-gray-600   bg-gray-50   border-gray-200'    },
  BROADCAST_DELETED:       { label: 'Broadcast Deleted',   color: 'text-red-600    bg-red-50    border-red-200'      },
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

// ── B5: Onboarding Panel ─────────────────────────────────────────────────────

const ONBOARDING_STEPS: { key: keyof import('../../api/owner.api.ts').OnboardingSteps; label: string; hint: string }[] = [
  { key: 'hasOwner',       label: 'Owner Added',       hint: 'Shop ka owner account' },
  { key: 'hasCustomer',    label: 'First Customer',    hint: 'Pehla customer add kiya' },
  { key: 'hasInstallment', label: 'First Installment', hint: 'Pehla installment banaya' },
  { key: 'hasPayment',     label: 'First Payment',     hint: 'Pehli payment record ki' },
];

const STUCK_META: Record<StuckSeverity, { label: string; cls: string; dot: string }> = {
  fresh:    { label: 'New',      cls: 'text-indigo-600 bg-indigo-50  border-indigo-200',  dot: 'bg-indigo-400'  },
  warming:  { label: 'Watch',    cls: 'text-amber-600  bg-amber-50   border-amber-200',   dot: 'bg-amber-400'   },
  stuck:    { label: 'Stuck',    cls: 'text-orange-600 bg-orange-50  border-orange-200',  dot: 'bg-orange-500'  },
  critical: { label: 'Critical', cls: 'text-red-600    bg-red-50     border-red-200',     dot: 'bg-red-500'     },
};

type OnboardFilter = 'all' | 'stuck' | 'complete';

function OnboardingPanel({ onClose, onViewShop, onSendReminder, sendingId }: {
  onClose: () => void;
  onViewShop: (id: string) => void;
  onSendReminder: (id: string) => void;
  sendingId: string | null;
}) {
  const [filter, setFilter] = useState<OnboardFilter>('stuck');

  const { data: shops = [], isLoading } = useQuery({
    queryKey: ['owner-onboarding'],
    queryFn: ownerApi.getOnboardingStatus,
    staleTime: 60_000,
  });

  const completeCount = shops.filter((s: ShopOnboarding) => s.isComplete).length;
  const stuckCount    = shops.filter((s: ShopOnboarding) => !s.isComplete).length;
  const criticalCount = shops.filter((s: ShopOnboarding) => s.stuckSeverity === 'critical' || s.stuckSeverity === 'stuck').length;

  const filtered = useMemo(() => {
    const list = filter === 'stuck'    ? shops.filter((s: ShopOnboarding) => !s.isComplete)
               : filter === 'complete' ? shops.filter((s: ShopOnboarding) => s.isComplete)
               : shops;
    return [...list].sort((a: ShopOnboarding, b: ShopOnboarding) => {
      // stuck shops first, sorted by severity (critical > stuck > warming > fresh), then age
      if (!a.isComplete && b.isComplete) return -1;
      if (a.isComplete && !b.isComplete) return 1;
      const sevOrder: Record<string, number> = { critical: 4, stuck: 3, warming: 2, fresh: 1 };
      const aOrd = a.stuckSeverity ? (sevOrder[a.stuckSeverity] ?? 0) : 0;
      const bOrd = b.stuckSeverity ? (sevOrder[b.stuckSeverity] ?? 0) : 0;
      if (aOrd !== bOrd) return bOrd - aOrd;
      return b.shopAgeDays - a.shopAgeDays;
    });
  }, [shops, filter]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center">
            <ListChecks size={16} className="text-emerald-600" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-gray-900">Onboarding Checklist</p>
            <p className="text-xs text-gray-400">
              {completeCount}/{shops.length} complete
              {criticalCount > 0 && <span className="ml-2 text-red-500 font-semibold">• {criticalCount} urgent</span>}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition">
            <X size={16} />
          </button>
        </div>

        {/* Summary tiles */}
        <div className="grid grid-cols-3 gap-px bg-gray-100 border-b border-gray-100 shrink-0">
          {([
            { key: 'complete' as OnboardFilter, label: 'Complete', value: completeCount, color: 'text-emerald-600' },
            { key: 'stuck'    as OnboardFilter, label: 'Needs Help', value: stuckCount, color: 'text-orange-600' },
            { key: 'all'      as OnboardFilter, label: 'Total', value: shops.length, color: 'text-gray-800' },
          ] as { key: OnboardFilter; label: string; value: number; color: string }[]).map((t) => (
            <button key={t.key} onClick={() => setFilter(t.key)}
              className={`flex flex-col items-center py-3 px-2 transition ${filter === t.key ? 'bg-white' : 'bg-gray-50 hover:bg-white'}`}>
              <p className={`text-2xl font-bold ${t.color}`}>{t.value}</p>
              <p className="text-[10px] text-gray-400 font-medium mt-0.5">{t.label}</p>
              {filter === t.key && <div className="w-5 h-0.5 mt-1.5 rounded-full bg-indigo-500" />}
            </button>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1.5 px-5 py-3 border-b border-gray-100 shrink-0">
          {([
            { key: 'stuck'    as OnboardFilter, label: `Needs Help (${stuckCount})` },
            { key: 'complete' as OnboardFilter, label: `Complete (${completeCount})` },
            { key: 'all'      as OnboardFilter, label: `All (${shops.length})` },
          ] as { key: OnboardFilter; label: string }[]).map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                filter === f.key
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
              }`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="space-y-3">
              {[1,2,3,4].map((i) => <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-14">
              <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 size={24} className="text-emerald-400" />
              </div>
              <p className="text-sm font-semibold text-gray-700">
                {filter === 'stuck' ? 'Sab shops onboard ho gayi hain!' : 'Koi shop nahi mili'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((s: ShopOnboarding) => {
                const sm = s.stuckSeverity ? STUCK_META[s.stuckSeverity] : null;
                const stuckStepLabel = s.stuckAt !== null ? ONBOARDING_STEPS[s.stuckAt]?.label : null;

                return (
                  <div key={s.shopId}
                    className={`rounded-xl border p-4 transition hover:shadow-sm ${
                      s.isComplete
                        ? 'border-gray-100 bg-white'
                        : s.stuckSeverity === 'critical' ? 'border-red-100 bg-red-50/40'
                        : s.stuckSeverity === 'stuck'    ? 'border-orange-100 bg-orange-50/30'
                        : 'border-gray-100 bg-white'
                    }`}>

                    {/* Top row: name + severity badge */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-gray-900 truncate">{s.shopName}</span>
                          <span className={`inline-flex px-1.5 py-0.5 rounded-md text-[10px] font-semibold border ${PLAN_STYLES[s.plan] ?? 'text-gray-500 bg-gray-50 border-gray-200'}`}>
                            {s.plan}
                          </span>
                        </div>
                        {s.ownerName && (
                          <p className="text-[11px] text-gray-400 mt-0.5 truncate">{s.ownerName}</p>
                        )}
                      </div>
                      {s.isComplete ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-xl text-[10px] font-bold border text-emerald-700 bg-emerald-50 border-emerald-200 shrink-0">
                          <CheckCircle2 size={10} /> Done
                        </span>
                      ) : sm ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-xl text-[10px] font-bold border shrink-0 ${sm.cls}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sm.dot}`} />
                          {sm.label}
                        </span>
                      ) : null}
                    </div>

                    {/* Progress bar */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
                        <span>{s.completedCount}/4 steps</span>
                        <span>{s.shopAgeDays}d old</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            s.isComplete ? 'bg-emerald-500' :
                            s.stuckSeverity === 'critical' ? 'bg-red-500' :
                            s.stuckSeverity === 'stuck'    ? 'bg-orange-500' :
                            'bg-indigo-500'
                          }`}
                          style={{ width: `${(s.completedCount / 4) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Step indicators */}
                    <div className="flex items-center gap-1 mb-3">
                      {ONBOARDING_STEPS.map((step, idx) => {
                        const done    = s.steps[step.key];
                        const current = !done && s.stuckAt === idx;
                        return (
                          <div key={step.key} className="flex-1 flex flex-col items-center gap-1">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition ${
                              done
                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                : current
                                  ? 'bg-white border-orange-400 text-orange-500 animate-pulse'
                                  : 'bg-gray-100 border-gray-200 text-gray-400'
                            }`}>
                              {done ? <CheckCircle2 size={12} /> : current ? <Circle size={10} /> : idx + 1}
                            </div>
                            <span className={`text-[9px] text-center leading-tight ${
                              done ? 'text-emerald-600 font-medium' :
                              current ? 'text-orange-500 font-semibold' :
                              'text-gray-400'
                            }`}>
                              {step.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Stuck callout */}
                    {!s.isComplete && stuckStepLabel && sm && (
                      <div className={`rounded-lg px-3 py-2 mb-3 text-xs border ${sm.cls}`}>
                        <span className="font-semibold">Stuck at:</span> {stuckStepLabel}
                        {s.shopAgeDays >= 2 && (
                          <span className="ml-1 opacity-80">— {s.shopAgeDays} din se</span>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { onClose(); onViewShop(s.shopId); }}
                        className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 transition">
                        Details <ChevronRight size={11} />
                      </button>
                      {s.ownerEmail && (
                        <button
                          onClick={() => onSendReminder(s.shopId)}
                          disabled={sendingId === s.shopId}
                          className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600 text-[11px] font-semibold hover:bg-indigo-100 transition disabled:opacity-50">
                          {sendingId === s.shopId ? '…' : <><Mail size={10} /> Remind</>}
                        </button>
                      )}
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

// ── B3: Broadcast Panel (admin) ───────────────────────────────────────────────

const BROADCAST_TYPE_META: Record<string, { label: string; cls: string; dot: string }> = {
  info:        { label: 'Info',        cls: 'text-indigo-700 bg-indigo-50 border-indigo-200', dot: 'bg-indigo-500' },
  warning:     { label: 'Warning',     cls: 'text-amber-700  bg-amber-50  border-amber-200',  dot: 'bg-amber-500'  },
  maintenance: { label: 'Maintenance', cls: 'text-red-600    bg-red-50    border-red-200',    dot: 'bg-red-500'    },
  success:     { label: 'Update',      cls: 'text-emerald-700 bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
};

const BROADCAST_TARGETS = [
  { value: 'ALL',        label: 'All shops'   },
  { value: 'TRIAL',      label: 'Trial only'  },
  { value: 'BASIC',      label: 'Basic only'  },
  { value: 'PRO',        label: 'Pro only'    },
  { value: 'ENTERPRISE', label: 'Enterprise only' },
];

function BroadcastPanel({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [title,      setTitle]      = useState('');
  const [message,    setMessage]    = useState('');
  const [targetPlan, setTargetPlan] = useState('ALL');
  const [type,       setType]       = useState('info');
  const [expiresAt,  setExpiresAt]  = useState('');
  const [showForm,   setShowForm]   = useState(false);

  const { data: broadcasts = [], isLoading } = useQuery({
    queryKey: ['owner-broadcasts'],
    queryFn: ownerApi.listBroadcasts,
    staleTime: 30_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['owner-broadcasts'] });

  const createMutation = useMutation({
    mutationFn: () => ownerApi.createBroadcast({ title, message, targetPlan, type, expiresAt: expiresAt || undefined }),
    onSuccess: () => {
      invalidate();
      setTitle(''); setMessage(''); setTargetPlan('ALL'); setType('info'); setExpiresAt('');
      setShowForm(false);
      toast.success('Announcement create ho gaya');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      ownerApi.updateBroadcast(id, { isActive }),
    onSuccess: () => { invalidate(); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ownerApi.deleteBroadcast(id),
    onSuccess: () => { invalidate(); toast.success('Announcement delete ho gaya'); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const activeBroadcasts   = broadcasts.filter((b: AdminBroadcast) => b.isActive);
  const inactiveBroadcasts = broadcasts.filter((b: AdminBroadcast) => !b.isActive);

  const now = new Date();
  const isExpired = (b: AdminBroadcast) => !!b.expiresAt && new Date(b.expiresAt) < now;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center">
            <Megaphone size={16} className="text-indigo-600" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-gray-900">Broadcast Announcements</p>
            <p className="text-xs text-gray-400">
              {activeBroadcasts.length} active • {broadcasts.length} total
            </p>
          </div>
          <button onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-xl hover:bg-indigo-700 transition">
            <Plus size={13} /> New
          </button>
          <button onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Create form */}
          {showForm && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 space-y-3">
              <p className="text-sm font-semibold text-indigo-800 flex items-center gap-1.5">
                <Megaphone size={13} /> Naya Announcement
              </p>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. System maintenance notice"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Message *</label>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)}
                  rows={3} placeholder="Announcement ka message likhein…"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Target</label>
                  <select value={targetPlan} onChange={(e) => setTargetPlan(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
                    {BROADCAST_TARGETS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                  <select value={type} onChange={(e) => setType(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
                    <option value="info">Info (blue)</option>
                    <option value="warning">Warning (amber)</option>
                    <option value="maintenance">Maintenance (red)</option>
                    <option value="success">Update (green)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Expiry (optional)</label>
                <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                <p className="text-[10px] text-gray-400 mt-0.5">Blank = banner tab tak dikhe jab tak manually band na karo</p>
              </div>

              <div className="flex gap-2">
                <button onClick={() => { setShowForm(false); }}
                  className="flex-1 py-2 text-sm border border-gray-200 text-gray-600 rounded-xl hover:bg-white transition">
                  Cancel
                </button>
                <button
                  onClick={() => createMutation.mutate()}
                  disabled={!title.trim() || !message.trim() || createMutation.isPending}
                  className="flex-1 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition disabled:opacity-50">
                  {createMutation.isPending ? 'Publishing…' : 'Publish'}
                </button>
              </div>
            </div>
          )}

          {/* Active broadcasts */}
          {isLoading ? (
            <div className="space-y-3">
              {[1,2,3].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : (
            <>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Active ({activeBroadcasts.length})
                </p>
                {activeBroadcasts.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6 bg-gray-50 rounded-xl">
                    Koi active announcement nahi
                  </p>
                ) : (
                  <div className="space-y-2">
                    {activeBroadcasts.map((b: AdminBroadcast) => {
                      const meta = BROADCAST_TYPE_META[b.type] ?? BROADCAST_TYPE_META['info'];
                      const expired = isExpired(b);
                      return (
                        <div key={b.id} className={`border rounded-xl p-3 ${expired ? 'opacity-60 bg-gray-50 border-gray-200' : 'bg-white border-gray-100'}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                              <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${meta.dot}`} />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-semibold text-gray-900 truncate">{b.title}</span>
                                  <span className={`inline-flex px-1.5 py-0.5 rounded-md text-[10px] font-semibold border ${meta.cls}`}>
                                    {meta.label}
                                  </span>
                                  <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md">
                                    {b.targetPlan === 'ALL' ? 'All shops' : b.targetPlan}
                                  </span>
                                  {expired && (
                                    <span className="text-[10px] text-red-500 font-semibold">Expired</span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed line-clamp-2">{b.body}</p>
                                {b.expiresAt && !expired && (
                                  <p className="text-[10px] text-gray-400 mt-1">
                                    Expires {fmtDate(b.expiresAt)}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => toggleMutation.mutate({ id: b.id, isActive: false })}
                                disabled={toggleMutation.isPending}
                                title="Deactivate"
                                className="p-1.5 text-emerald-500 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition">
                                <ToggleRight size={16} />
                              </button>
                              <button
                                onClick={() => deleteMutation.mutate(b.id)}
                                disabled={deleteMutation.isPending}
                                className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {inactiveBroadcasts.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    Inactive ({inactiveBroadcasts.length})
                  </p>
                  <div className="space-y-2">
                    {inactiveBroadcasts.map((b: AdminBroadcast) => {
                      const meta = BROADCAST_TYPE_META[b.type] ?? BROADCAST_TYPE_META['info'];
                      return (
                        <div key={b.id} className="border border-gray-100 bg-gray-50 rounded-xl p-3 opacity-70">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-gray-600 truncate">{b.title}</span>
                                <span className={`inline-flex px-1.5 py-0.5 rounded-md text-[10px] font-semibold border opacity-60 ${meta.cls}`}>
                                  {meta.label}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => toggleMutation.mutate({ id: b.id, isActive: true })}
                                disabled={toggleMutation.isPending}
                                title="Activate"
                                className="p-1.5 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition">
                                <ToggleLeft size={16} />
                              </button>
                              <button
                                onClick={() => deleteMutation.mutate(b.id)}
                                disabled={deleteMutation.isPending}
                                className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ── B1: Churn Risk Panel ──────────────────────────────────────────────────────

const RISK_META: Record<ChurnRisk, { label: string; cls: string; bar: string; icon: React.ReactNode }> = {
  healthy:  { label: 'Healthy',  cls: 'text-emerald-700 bg-emerald-50 border-emerald-200', bar: 'bg-emerald-500', icon: <CheckCircle2 size={11} /> },
  'at-risk':{ label: 'At-Risk',  cls: 'text-amber-700  bg-amber-50  border-amber-200',    bar: 'bg-amber-400',   icon: <AlertTriangle size={11} /> },
  churning: { label: 'Churning', cls: 'text-red-600    bg-red-50    border-red-200',       bar: 'bg-red-500',     icon: <XCircle size={11} /> },
};

const FACTOR_SEV: Record<string, string> = {
  positive: 'text-emerald-600',
  low:      'text-amber-600',
  medium:   'text-orange-600',
  high:     'text-red-600',
};

type ChurnFilter = 'all' | ChurnRisk;

function ChurnScoreBar({ score }: { score: number }) {
  const risk: ChurnRisk = score <= 20 ? 'healthy' : score <= 50 ? 'at-risk' : 'churning';
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden min-w-12">
        <div className={`h-full rounded-full transition-all ${RISK_META[risk].bar}`}
          style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs font-bold w-5 text-right ${
        risk === 'churning' ? 'text-red-600' : risk === 'at-risk' ? 'text-amber-600' : 'text-emerald-600'
      }`}>{score}</span>
    </div>
  );
}

function ChurnRiskPanel({ onClose, onViewShop }: {
  onClose: () => void;
  onViewShop: (shopId: string) => void;
}) {
  const [churnFilter, setChurnFilter] = useState<ChurnFilter>('churning');

  const { data: scores = [], isLoading } = useQuery({
    queryKey: ['owner-churn-scores'],
    queryFn: ownerApi.getChurnScores,
    staleTime: 120_000,
  });

  const summary = {
    healthy:  scores.filter((s) => s.risk === 'healthy').length,
    'at-risk':scores.filter((s) => s.risk === 'at-risk').length,
    churning: scores.filter((s) => s.risk === 'churning').length,
  };

  const filtered = useMemo(() => {
    const list = churnFilter === 'all'
      ? [...scores]
      : scores.filter((s) => s.risk === churnFilter);
    return list.sort((a, b) => b.score - a.score);
  }, [scores, churnFilter]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center">
            <TrendingDown size={16} className="text-red-500" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-gray-900">Churn Risk Analysis</p>
            <p className="text-xs text-gray-400">Shops jo band hone ke khatray mein hain</p>
          </div>
          <button onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition">
            <X size={16} />
          </button>
        </div>

        {/* Summary tiles */}
        <div className="grid grid-cols-3 gap-px bg-gray-100 border-b border-gray-100 shrink-0">
          {(['churning', 'at-risk', 'healthy'] as ChurnRisk[]).map((r) => (
            <button key={r} onClick={() => setChurnFilter(r)}
              className={`flex flex-col items-center py-3 px-2 transition ${
                churnFilter === r ? 'bg-white' : 'bg-gray-50 hover:bg-white'
              }`}>
              <p className={`text-2xl font-bold ${
                r === 'churning' ? 'text-red-600' : r === 'at-risk' ? 'text-amber-600' : 'text-emerald-600'
              }`}>{summary[r]}</p>
              <div className={`inline-flex items-center gap-1 mt-0.5 text-[10px] font-semibold ${
                r === 'churning' ? 'text-red-500' : r === 'at-risk' ? 'text-amber-600' : 'text-emerald-600'
              }`}>
                {RISK_META[r].icon} {RISK_META[r].label}
              </div>
              {churnFilter === r && <div className={`w-6 h-0.5 mt-1.5 rounded-full ${RISK_META[r].bar}`} />}
            </button>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1.5 px-5 py-3 border-b border-gray-100 shrink-0">
          {(['all', 'churning', 'at-risk', 'healthy'] as ChurnFilter[]).map((f) => (
            <button key={f} onClick={() => setChurnFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                churnFilter === f
                  ? f === 'churning' ? 'bg-red-600 text-white border-red-600'
                  : f === 'at-risk'  ? 'bg-amber-500 text-white border-amber-500'
                  : f === 'healthy'  ? 'bg-emerald-600 text-white border-emerald-600'
                  :                   'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
              }`}>
              {f === 'all' ? `All (${scores.length})` : RISK_META[f].label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="space-y-3">
              {[1,2,3,4].map((i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 size={24} className="text-emerald-400" />
              </div>
              <p className="text-sm font-semibold text-gray-700">
                {churnFilter === 'churning' ? 'Koi churn risk nahi' : 'Koi shop nahi mili'}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {churnFilter === 'churning' ? 'Sab shops theek hain!' : 'Filter change karke dekhein'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((s: ShopChurnScore) => {
                const rm = RISK_META[s.risk];
                const topFactors = s.factors
                  .filter((f) => f.severity !== 'positive')
                  .slice(0, 2);
                const positiveFactors = s.factors
                  .filter((f) => f.severity === 'positive')
                  .slice(0, 1);
                return (
                  <div key={s.shopId}
                    className={`rounded-xl border p-4 transition hover:shadow-sm ${
                      s.risk === 'churning' ? 'border-red-100 bg-red-50/40' :
                      s.risk === 'at-risk'  ? 'border-amber-100 bg-amber-50/30' :
                      'border-gray-100 bg-white'
                    }`}>
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-gray-900 truncate">{s.shopName}</span>
                          <span className={`inline-flex px-1.5 py-0.5 rounded-md text-[10px] font-semibold border ${PLAN_STYLES[s.plan] ?? 'text-gray-500 bg-gray-50 border-gray-200'}`}>
                            {s.plan}
                          </span>
                          {!s.isActive && (
                            <span className="inline-flex px-1.5 py-0.5 rounded-md text-[10px] font-semibold border text-red-600 bg-red-50 border-red-200">
                              Suspended
                            </span>
                          )}
                        </div>
                        {s.ownerName && (
                          <p className="text-[11px] text-gray-400 mt-0.5 truncate">{s.ownerName}</p>
                        )}
                      </div>
                      {/* Risk badge */}
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-xl text-[10px] font-bold border shrink-0 ${rm.cls}`}>
                        {rm.icon} {rm.label}
                      </span>
                    </div>

                    {/* Score bar */}
                    <div className="mt-3">
                      <ChurnScoreBar score={s.score} />
                    </div>

                    {/* Meta row */}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className="text-[11px] text-gray-400 flex items-center gap-1">
                        <Users size={10} /> {s.customerCount} customers
                      </span>
                      <span className="text-[11px] text-gray-400 flex items-center gap-1">
                        <Activity size={10} /> {s.paymentsThisMonth} payments/mo
                      </span>
                      {s.daysSinceActivity !== null && (
                        <span className={`text-[11px] flex items-center gap-1 ${s.daysSinceActivity > 30 ? 'text-red-400 font-semibold' : 'text-gray-400'}`}>
                          <Clock size={10} /> {s.daysSinceActivity}d ago
                        </span>
                      )}
                    </div>

                    {/* Factors */}
                    {(topFactors.length > 0 || positiveFactors.length > 0) && (
                      <div className="mt-2.5 space-y-1">
                        {topFactors.map((f) => (
                          <div key={f.key} className="flex items-start gap-1.5">
                            <span className={`text-[10px] font-bold mt-0.5 shrink-0 ${FACTOR_SEV[f.severity]}`}>
                              {f.severity === 'high' ? '●●' : f.severity === 'medium' ? '●' : '·'}
                            </span>
                            <span className="text-[11px] text-gray-600 leading-tight">{f.label}</span>
                          </div>
                        ))}
                        {positiveFactors.map((f) => (
                          <div key={f.key} className="flex items-start gap-1.5">
                            <span className="text-[10px] font-bold mt-0.5 shrink-0 text-emerald-500">✓</span>
                            <span className="text-[11px] text-emerald-600 leading-tight">{f.label}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* View details link */}
                    <button
                      onClick={() => { onClose(); onViewShop(s.shopId); }}
                      className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 transition">
                      Details dekhein <ChevronRight size={11} />
                    </button>
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [modal, setModal]           = useState<Modal>(null);
  const [filter, setFilter]         = useState<FilterTab>('all');
  const [search, setSearch]         = useState('');
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; shop: Shop | null }>({ open: false, shop: null });
  const [statusConfirm, setStatusConfirm] = useState<{ open: boolean; shop: Shop | null }>({ open: false, shop: null });
  const [detailShopId, setDetailShopId] = useState<string | null>(null);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [showChurnPanel, setShowChurnPanel] = useState(false);
  const [showBroadcastPanel, setShowBroadcastPanel] = useState(false);
  const [showOnboardingPanel, setShowOnboardingPanel] = useState(false);
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);

  useEffect(() => {
    const panel = searchParams.get('panel');
    if (!panel) return;
    if (panel === 'churn')       setShowChurnPanel(true);
    if (panel === 'onboarding')  setShowOnboardingPanel(true);
    if (panel === 'broadcasts')  setShowBroadcastPanel(true);
    if (panel === 'audit')       setShowAuditLog(true);
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

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

  const exportMutation = useMutation({
    mutationFn: ownerApi.exportShops,
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `shops-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Export download ho raha hai');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Export nahi hua')),
  });

  const sendReminderMutation = useMutation({
    mutationFn: (shopId: string) => ownerApi.sendRenewalReminder(shopId),
    onMutate: (shopId) => setSendingReminderId(shopId),
    onSuccess: (data) => {
      setSendingReminderId(null);
      toast.success(`Reminder email bhej diya — ${data.sentTo}`);
    },
    onError: (e) => { setSendingReminderId(null); toast.error(getErrorMessage(e, 'Email send nahi hua')); },
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
          <button onClick={() => setShowOnboardingPanel(true)} title="Onboarding checklist"
            className="p-2.5 border border-gray-200 rounded-xl text-gray-500 hover:text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50 transition">
            <ListChecks size={16} />
          </button>
          <button onClick={() => setShowBroadcastPanel(true)} title="Broadcast announcements"
            className="p-2.5 border border-gray-200 rounded-xl text-gray-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition">
            <Megaphone size={16} />
          </button>
          <button onClick={() => setShowChurnPanel(true)} title="Churn risk analysis"
            className="p-2.5 border border-gray-200 rounded-xl text-gray-500 hover:text-red-500 hover:border-red-300 hover:bg-red-50 transition">
            <TrendingDown size={16} />
          </button>
          <button onClick={() => setShowAuditLog(true)} title="Admin audit log"
            className="p-2.5 border border-gray-200 rounded-xl text-gray-500 hover:text-purple-600 hover:border-purple-300 hover:bg-purple-50 transition">
            <FileText size={16} />
          </button>
          <button
            onClick={() => exportMutation.mutate()}
            disabled={exportMutation.isPending}
            title="Export shops to CSV"
            className="p-2.5 border border-gray-200 rounded-xl text-gray-500 hover:text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50 transition disabled:opacity-50">
            {exportMutation.isPending
              ? <span className="block w-4 h-4 border-2 border-gray-300 border-t-emerald-500 rounded-full animate-spin" />
              : <Download size={16} />
            }
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

      {/* Admin tool quick-access strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          {
            label: 'Churn Risk',
            desc: 'Shops jo band hone wali hain',
            icon: TrendingDown,
            onClick: () => setShowChurnPanel(true),
            cls: 'border-red-100 hover:border-red-300 hover:bg-red-50',
            iconCls: 'text-red-500 bg-red-50',
          },
          {
            label: 'Onboarding',
            desc: 'Naye shops ka setup track karo',
            icon: ListChecks,
            onClick: () => setShowOnboardingPanel(true),
            cls: 'border-emerald-100 hover:border-emerald-300 hover:bg-emerald-50',
            iconCls: 'text-emerald-600 bg-emerald-50',
          },
          {
            label: 'Broadcasts',
            desc: 'Sab shops ko announcement bhejo',
            icon: Megaphone,
            onClick: () => setShowBroadcastPanel(true),
            cls: 'border-indigo-100 hover:border-indigo-300 hover:bg-indigo-50',
            iconCls: 'text-indigo-600 bg-indigo-50',
          },
          {
            label: 'Audit Log',
            desc: 'Admin actions ka record dekhein',
            icon: FileText,
            onClick: () => setShowAuditLog(true),
            cls: 'border-purple-100 hover:border-purple-300 hover:bg-purple-50',
            iconCls: 'text-purple-600 bg-purple-50',
          },
        ].map(({ label, desc, icon: Icon, onClick, cls, iconCls }) => (
          <button key={label} onClick={onClick}
            className={`flex items-center gap-3 p-3.5 rounded-2xl border bg-white text-left transition-all hover:shadow-sm ${cls}`}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconCls}`}>
              <Icon size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">{label}</p>
              <p className="text-[11px] text-gray-400 leading-tight mt-0.5">{desc}</p>
            </div>
          </button>
        ))}
      </div>

      {/* A1: Platform dashboard */}
      {platformStats && (
        <PlatformDashboard
          stats={platformStats}
          onSendReminder={(id) => sendReminderMutation.mutate(id)}
          sendingId={sendingReminderId}
        />
      )}

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
          onSendReminder={(id) => sendReminderMutation.mutate(id)}
          sendingId={sendingReminderId}
        />
      )}

      {/* A10: Admin audit log panel */}
      {showAuditLog && (
        <AdminAuditPanel
          onClose={() => setShowAuditLog(false)}
        />
      )}

      {/* B5: Onboarding Panel */}
      {showOnboardingPanel && (
        <OnboardingPanel
          onClose={() => setShowOnboardingPanel(false)}
          onViewShop={(id) => { setShowOnboardingPanel(false); setDetailShopId(id); }}
          onSendReminder={(id) => sendReminderMutation.mutate(id)}
          sendingId={sendingReminderId}
        />
      )}

      {/* B3: Broadcast Panel */}
      {showBroadcastPanel && (
        <BroadcastPanel onClose={() => setShowBroadcastPanel(false)} />
      )}

      {/* B1: Churn Risk Panel */}
      {showChurnPanel && (
        <ChurnRiskPanel
          onClose={() => setShowChurnPanel(false)}
          onViewShop={(shopId) => { setShowChurnPanel(false); setDetailShopId(shopId); }}
        />
      )}
    </div>
  );
}
