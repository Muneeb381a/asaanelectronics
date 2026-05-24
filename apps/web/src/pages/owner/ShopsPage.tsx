import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Store, UserPlus, Phone, MapPin, Trash2, Crown, ShieldOff, ShieldCheck, CreditCard, Calendar } from 'lucide-react';
import { ownerApi, type Shop, type CreateShopInput, type CreateShopOwnerInput, type Plan } from '../../api/owner.api.ts';
import { CardSkeleton } from '../../components/ui/Skeleton.tsx';

const PLAN_STYLES: Record<string, string> = {
  TRIAL:      'bg-amber-50 text-amber-600 border-amber-200',
  BASIC:      'bg-blue-50 text-blue-600 border-blue-200',
  PRO:        'bg-purple-50 text-purple-600 border-purple-200',
  ENTERPRISE: 'bg-indigo-50 text-indigo-600 border-indigo-200',
};

const PLAN_LABELS: Record<Plan, string> = {
  TRIAL: 'Trial (14 days free)',
  BASIC: 'Basic — Rs 2,999/mo',
  PRO:   'Pro — Rs 7,999/mo',
  ENTERPRISE: 'Enterprise — Custom',
};

type Modal = { type: 'shop' } | { type: 'owner'; shop: Shop } | { type: 'plan'; shop: Shop } | null;

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
          className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">
          Cancel
        </button>
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
          className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">
          Cancel
        </button>
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
  const [expiresAt, setExpiresAt] = useState(
    shop.planExpiresAt ? shop.planExpiresAt.slice(0, 10) : ''
  );

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
          className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">
          Cancel
        </button>
        <button
          onClick={() => onSubmit(plan, expiresAt || undefined)}
          disabled={isPending}
          className="flex-1 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition disabled:opacity-50">
          {isPending ? 'Updating…' : 'Update Plan'}
        </button>
      </div>
    </div>
  );
}

function ShopCard({ shop, onAddOwner, onDelete, onToggleStatus, onChangePlan }: {
  shop: Shop; onAddOwner: () => void; onDelete: () => void; onToggleStatus: () => void; onChangePlan: () => void;
}) {
  const suspended = !shop.isActive;
  return (
    <div className={`rounded-2xl border shadow-sm p-5 flex flex-col gap-4 transition-shadow hover:shadow-md ${suspended ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-100'}`}>
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${suspended ? 'bg-gray-100' : 'bg-indigo-50'}`}>
            <Store size={18} className={suspended ? 'text-gray-400' : 'text-indigo-600'} />
          </div>
          <div>
            <p className={`font-semibold text-sm leading-tight ${suspended ? 'text-gray-400' : 'text-gray-900'}`}>{shop.shopName}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${PLAN_STYLES[shop.plan]}`}>
                {shop.plan}
              </span>
              {suspended && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-600 border border-red-200">
                  <ShieldOff size={10} /> Suspended
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onChangePlan}
            title="Change plan"
            className="p-1.5 text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition">
            <CreditCard size={14} />
          </button>
          <button
            onClick={onToggleStatus}
            title={suspended ? 'Activate shop' : 'Suspend shop'}
            className={`p-1.5 rounded-lg transition ${suspended ? 'text-emerald-500 hover:bg-emerald-50' : 'text-gray-300 hover:text-amber-500 hover:bg-amber-50'}`}>
            {suspended ? <ShieldCheck size={14} /> : <ShieldOff size={14} />}
          </button>
          {!shop.ownerName && (
            <button onClick={onDelete}
              className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Phone size={12} className="text-gray-300 shrink-0" />
          {shop.phone}
        </div>
        {shop.address && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <MapPin size={12} className="text-gray-300 shrink-0" />
            {shop.address}
          </div>
        )}
      </div>

      {/* Owner */}
      <div className="pt-3 border-t border-gray-50">
        {shop.ownerName ? (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {shop.ownerName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-900 truncate">{shop.ownerName}</p>
              <p className="text-xs text-gray-400 truncate">{shop.ownerEmail}</p>
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
  );
}

export default function ShopsPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<Modal>(null);

  const { data: shops, isLoading, isError } = useQuery({
    queryKey: ['owner-shops'],
    queryFn: ownerApi.listShops,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['owner-shops'] });

  const createShopMutation = useMutation({
    mutationFn: ownerApi.createShop,
    onSuccess: () => { invalidate(); setModal(null); toast.success('Shop created'); },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const createOwnerMutation = useMutation({
    mutationFn: ({ shopId, data }: { shopId: string; data: CreateShopOwnerInput }) =>
      ownerApi.createShopOwner(shopId, data),
    onSuccess: () => { invalidate(); setModal(null); toast.success('Shop owner created'); },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const deleteShopMutation = useMutation({
    mutationFn: ownerApi.deleteShop,
    onSuccess: () => { invalidate(); toast.success('Shop deleted'); },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      ownerApi.toggleShopStatus(id, isActive),
    onSuccess: (_, vars) => {
      invalidate();
      toast.success(vars.isActive ? 'Shop activated' : 'Shop suspended');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const changePlanMutation = useMutation({
    mutationFn: ({ id, plan, expiresAt }: { id: string; plan: Plan; expiresAt?: string }) =>
      ownerApi.changePlan(id, plan, expiresAt),
    onSuccess: () => { invalidate(); setModal(null); toast.success('Plan updated'); },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const total = shops?.length ?? 0;
  const withOwner = shops?.filter((s) => s.ownerName).length ?? 0;
  const trialCount = shops?.filter((s) => s.plan === 'TRIAL').length ?? 0;
  const proCount = shops?.filter((s) => s.plan === 'PRO').length ?? 0;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shops</h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage all registered shops</p>
        </div>
        <button onClick={() => setModal({ type: 'shop' })}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition shadow-sm shadow-indigo-200">
          + New shop
        </button>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Total shops',    value: total,      color: 'text-gray-900', bg: 'bg-gray-50' },
          { label: 'With owner',     value: withOwner,  color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'On trial',       value: trialCount, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Pro plan',       value: proCount,   color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} rounded-2xl p-4`}>
            <p className="text-xs text-gray-500 font-medium">{s.label}</p>
            <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Shop cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
        </div>
      ) : isError ? (
        <div className="text-center py-16 text-sm text-red-500">Failed to load shops.</div>
      ) : !shops?.length ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Store size={28} className="text-indigo-400" />
          </div>
          <p className="text-gray-500 font-medium">No shops yet</p>
          <p className="text-sm text-gray-400 mt-1">Create your first shop to get started.</p>
          <button onClick={() => setModal({ type: 'shop' })}
            className="mt-4 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition">
            + New shop
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {shops.map((shop) => (
            <ShopCard
              key={shop.id}
              shop={shop}
              onAddOwner={() => setModal({ type: 'owner', shop })}
              onChangePlan={() => setModal({ type: 'plan', shop })}
              onDelete={() => { if (confirm('Delete this shop?')) deleteShopMutation.mutate(shop.id); }}
              onToggleStatus={() => {
                const action = shop.isActive ? 'suspend' : 'activate';
                if (confirm(`Are you sure you want to ${action} "${shop.shopName}"?`))
                  toggleStatusMutation.mutate({ id: shop.id, isActive: !shop.isActive });
              }}
            />
          ))}
        </div>
      )}

      {/* Modal */}
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
    </div>
  );
}
