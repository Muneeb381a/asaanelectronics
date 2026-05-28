import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Monitor, Smartphone, Tablet, AlertTriangle, Trash2, LogOut, Shield,
  Users, TrendingUp, Package, BookOpen,
} from 'lucide-react';
import { sellersApi } from '../api/sellers.api.ts';
import { getErrorMessage } from '../utils/error.ts';
import { sessionsApi, type Session } from '../api/sessions.api.ts';
import { billingApi, type BillingUsage, type UsageStat } from '../api/billing.api.ts';
import { useAuthStore } from '../store/auth.store.ts';
import { useNavigate } from 'react-router-dom';
import { RowSkeleton, BlockSkeleton } from '../components/ui/Skeleton.tsx';

const inp = 'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition';

// ── Device icon ───────────────────────────────────────────────────────────────
function DeviceIcon({ type }: { type: string | null }) {
  const cls = 'shrink-0 text-gray-400';
  if (type === 'mobile')  return <Smartphone size={18} className={cls} />;
  if (type === 'tablet')  return <Tablet      size={18} className={cls} />;
  return <Monitor size={18} className={cls} />;
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'Unknown';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'Active now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Plan badge colours ────────────────────────────────────────────────────────
const PLAN_BADGE: Record<string, string> = {
  TRIAL:      'bg-amber-100 text-amber-700',
  BASIC:      'bg-blue-100 text-blue-700',
  PRO:        'bg-purple-100 text-purple-700',
  ENTERPRISE: 'bg-indigo-100 text-indigo-700',
};

// ── Usage bar ─────────────────────────────────────────────────────────────────
function UsageBar({ stat, label, icon }: { stat: UsageStat; label: string; icon: React.ReactNode }) {
  const pct = stat.unlimited ? 0 : stat.pct;
  const barColor =
    stat.unlimited ? 'bg-emerald-400' :
    pct >= 90      ? 'bg-red-400'     :
    pct >= 70      ? 'bg-amber-400'   : 'bg-blue-400';

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="flex items-center gap-1.5 text-xs text-gray-600">
          {icon}
          {label}
        </span>
        <span className="text-xs font-semibold text-gray-800">
          {stat.unlimited ? `${stat.used} / ∞` : `${stat.used} / ${stat.limit}`}
        </span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: stat.unlimited ? '30%' : `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Billing section ───────────────────────────────────────────────────────────
function BillingSection({ usage }: { usage: BillingUsage }) {
  const expiry = usage.planExpiresAt
    ? new Date(usage.planExpiresAt).toLocaleDateString('en-PK', { day: '2-digit', month: 'long', year: 'numeric' })
    : null;
  const trialEnd = usage.trialEndsAt
    ? new Date(usage.trialEndsAt).toLocaleDateString('en-PK', { day: '2-digit', month: 'long', year: 'numeric' })
    : null;

  return (
    <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-4">
      {/* Plan header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Subscription</p>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${PLAN_BADGE[usage.plan] ?? 'bg-gray-100 text-gray-600'}`}>
              {usage.planLabel}
            </span>
            {(usage.trialExpired || usage.planExpired) && (
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-600">
                Expired
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          {usage.priceMonthly === 0 && <p className="text-xs text-gray-500">Free</p>}
          {usage.priceMonthly > 0 && (
            <p className="text-xs font-semibold text-gray-800">
              Rs {usage.priceMonthly.toLocaleString()}<span className="text-gray-400 font-normal">/mo</span>
            </p>
          )}
          {usage.priceMonthly === -1 && <p className="text-xs text-gray-500">Custom pricing</p>}
        </div>
      </div>

      {/* Expiry info */}
      {usage.plan === 'TRIAL' && trialEnd && (
        <p className="text-xs text-gray-500">
          Trial ends: <span className="font-medium text-gray-700">{trialEnd}</span>
          {usage.trialDaysLeft !== null && usage.trialDaysLeft > 0 && (
            <span className="ml-1 text-amber-600 font-medium">({usage.trialDaysLeft}d left)</span>
          )}
        </p>
      )}
      {usage.plan !== 'TRIAL' && expiry && (
        <p className="text-xs text-gray-500">
          Plan expires: <span className="font-medium text-gray-700">{expiry}</span>
        </p>
      )}

      {/* Usage bars */}
      <div className="space-y-3 pt-1">
        <UsageBar stat={usage.limits.customers}    label="Customers"    icon={<Users size={11} />} />
        <UsageBar stat={usage.limits.staff}        label="Staff"        icon={<Package size={11} />} />
        <UsageBar stat={usage.limits.installments} label="Installments" icon={<TrendingUp size={11} />} />
      </div>
    </div>
  );
}

// ── Murabaha Mode toggle ──────────────────────────────────────────────────────
function MurabahaToggle({ murabahaMode, sellerId }: { murabahaMode: boolean; sellerId?: string }) {
  const qc = useQueryClient();

  const toggleMutation = useMutation({
    mutationFn: (val: boolean) => sellersApi.update({ murabahaMode: val }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['shop-me'] });
      toast.success(murabahaMode ? 'Murabaha mode disabled' : 'Murabaha mode enabled');
    },
    onError: () => toast.error('Failed to update setting'),
  });

  if (!sellerId) return null;

  return (
    <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <BookOpen size={16} className="text-emerald-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-gray-900">Murabaha Mode</p>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
              Discloses cost price + profit markup separately on all installment agreements —
              Shariah-compliant structure where profit is disclosed upfront.
            </p>
          </div>
        </div>
        <button
          role="switch"
          aria-checked={murabahaMode}
          onClick={() => toggleMutation.mutate(!murabahaMode)}
          disabled={toggleMutation.isPending}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 disabled:opacity-50 focus:outline-none ${
            murabahaMode ? 'bg-emerald-500' : 'bg-gray-200'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
              murabahaMode ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
      {murabahaMode && (
        <p className="mt-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
          New installments will show Cash Price + Profit Markup breakdown instead of a single Total Amount.
        </p>
      )}
    </div>
  );
}

// ── Sessions section ──────────────────────────────────────────────────────────
function SessionsSection() {
  const qc = useQueryClient();
  const { clearAuth } = useAuthStore();
  const navigate = useNavigate();

  const { data: sessions = [], isLoading, refetch } = useQuery({
    queryKey: ['sessions'],
    queryFn: sessionsApi.list,
    staleTime: 30_000,
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => sessionsApi.revoke(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sessions'] });
      toast.success('Session revoked');
    },
    onError: () => toast.error('Failed to revoke session'),
  });

  const revokeAllMutation = useMutation({
    mutationFn: () => sessionsApi.revokeAll(),
    onSuccess: () => {
      toast.success('All sessions revoked — please log in again');
      clearAuth();
      localStorage.removeItem('refresh_token');
      void navigate('/login');
    },
    onError: () => toast.error('Failed'),
  });

  const suspiciousCount = sessions.filter((s) => s.isSuspicious).length;

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Shield size={15} className="text-gray-500" />
            Active Sessions
            {sessions.length > 0 && (
              <span className="text-xs font-normal text-gray-400">({sessions.length})</span>
            )}
          </h2>
          {suspiciousCount > 0 && (
            <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
              <AlertTriangle size={11} />
              {suspiciousCount} suspicious session{suspiciousCount > 1 ? 's' : ''} detected
            </p>
          )}
        </div>
        {sessions.length > 1 && (
          <button
            onClick={() => {
              if (confirm('Revoke ALL sessions? You will be logged out everywhere.'))
                revokeAllMutation.mutate();
            }}
            disabled={revokeAllMutation.isPending}
            className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-xl transition-colors disabled:opacity-50"
          >
            <LogOut size={12} />
            Revoke All
          </button>
        )}
      </div>

      {isLoading ? (
        <RowSkeleton rows={2} />
      ) : sessions.length === 0 ? (
        <div className="text-center py-8 text-gray-400 border border-dashed border-gray-200 rounded-xl">
          <Shield size={24} className="mx-auto mb-2 opacity-30" />
          <p className="text-xs">No active sessions</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((session: Session) => (
            <div
              key={session.id}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                session.isSuspicious
                  ? 'border-amber-200 bg-amber-50'
                  : 'border-gray-100 bg-white hover:border-gray-200'
              }`}
            >
              <DeviceIcon type={session.deviceType} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {session.deviceName ?? 'Unknown device'}
                  </p>
                  {session.isSuspicious && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                      <AlertTriangle size={10} />
                      Suspicious
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {session.ip ?? 'IP unknown'} · Last active {timeAgo(session.lastActiveAt)}
                  {' · '}Logged in {new Date(session.createdAt).toLocaleDateString('en-PK', {
                    day: '2-digit', month: 'short', year: 'numeric',
                  })}
                </p>
              </div>

              <button
                onClick={() => { if (confirm('Revoke this session? That device will be signed out.')) revokeMutation.mutate(session.id); }}
                disabled={revokeMutation.isPending}
                title="Revoke this session"
                className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => void refetch()}
        className="mt-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        Refresh
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const qc = useQueryClient();
  const { data: shop, isLoading } = useQuery({ queryKey: ['shop-me'], queryFn: sellersApi.getMe });
  const { data: usage } = useQuery({ queryKey: ['billing-usage'], queryFn: billingApi.getUsage, staleTime: 60_000 });

  const [shopName, setShopName] = useState('');
  const [phone, setPhone]       = useState('');
  const [address, setAddress]   = useState('');

  useEffect(() => {
    if (shop) {
      setShopName(shop.shopName);
      setPhone(shop.phone);
      setAddress(shop.address ?? '');
    }
  }, [shop]);

  const mutation = useMutation({
    mutationFn: () => sellersApi.update({ shopName, phone, address: address || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shop-me'] });
      toast.success('Shop settings saved');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Failed to save')),
  });

  const dirty = shop && (shopName !== shop.shopName || phone !== shop.phone || address !== (shop.address ?? ''));

  return (
    <div className="px-4 py-5 sm:p-6 max-w-lg">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Settings</h1>
      <p className="text-sm text-gray-400 mb-6">Shop info and security</p>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <BlockSkeleton key={i} className="h-11 rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Shop Name</label>
            <input value={shopName} onChange={(e) => setShopName(e.target.value)} className={inp} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Phone Number</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inp} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Address</label>
            <textarea value={address} onChange={(e) => setAddress(e.target.value)}
              rows={2} className={`${inp} resize-none`} placeholder="Shop address (optional)" />
          </div>

          <div className="pt-1 flex items-center gap-3">
            <button
              onClick={() => mutation.mutate()}
              disabled={!dirty || mutation.isPending || !shopName || !phone}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition">
              {mutation.isPending ? 'Saving…' : 'Save Changes'}
            </button>
            {dirty && (
              <button onClick={() => { setShopName(shop!.shopName); setPhone(shop!.phone); setAddress(shop!.address ?? ''); }}
                className="text-sm text-gray-400 hover:text-gray-600 transition">
                Discard
              </button>
            )}
          </div>

          {/* Billing / plan usage */}
          {usage && <BillingSection usage={usage} />}

          {/* Murabaha Mode toggle */}
          <MurabahaToggle murabahaMode={shop?.murabahaMode ?? false} sellerId={shop?.id} />
        </div>
      )}

      {/* Sessions */}
      <SessionsSection />
    </div>
  );
}
