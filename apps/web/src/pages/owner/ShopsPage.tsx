import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Store, UserPlus, Phone, MapPin, Trash2, Crown, ShieldOff, ShieldCheck,
  CreditCard, Calendar, Search, AlertTriangle, Clock, KeyRound, Eye, EyeOff,
} from 'lucide-react';
import { ownerApi, type Shop, type CreateShopInput, type CreateShopOwnerInput, type Plan } from '../../api/owner.api.ts';
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

function ShopCard({ shop, onAddOwner, onDelete, onToggleStatus, onChangePlan }: {
  shop: Shop;
  onAddOwner: () => void;
  onDelete: () => void;
  onToggleStatus: () => void;
  onChangePlan: () => void;
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

  const { data: shops = [], isLoading, isError } = useQuery({
    queryKey: ['owner-shops'],
    queryFn: ownerApi.listShops,
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

      {/* Stats */}
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
    </div>
  );
}
