import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Monitor, Smartphone, Tablet, AlertTriangle, Trash2, LogOut, Shield,
  Users, TrendingUp, Package, BookOpen, Plus, CreditCard, KeyRound, Eye, EyeOff, Target,
} from 'lucide-react';
import { sellersApi, type PaymentAccount, type PaymentAccountType } from '../api/sellers.api.ts';
import { authApi } from '../api/auth.api.ts';
import { getErrorMessage } from '../utils/error.ts';
import { fmtDate } from '../utils/dateFormat.ts';
import { sessionsApi, type Session } from '../api/sessions.api.ts';
import { billingApi, type BillingUsage, type UsageStat } from '../api/billing.api.ts';
import { useAuthStore } from '../store/auth.store.ts';
import { useNavigate } from 'react-router-dom';
import { RowSkeleton, BlockSkeleton } from '../components/ui/Skeleton.tsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.tsx';

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
    ? fmtDate(usage.planExpiresAt)
    : null;
  const trialEnd = usage.trialEndsAt
    ? fmtDate(usage.trialEndsAt)
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

// ── Payment accounts ──────────────────────────────────────────────────────────
const ACCOUNT_TYPES: { value: PaymentAccountType; label: string; color: string }[] = [
  { value: 'BANK',      label: 'Bank',       color: 'bg-blue-100 text-blue-700' },
  { value: 'JAZZCASH',  label: 'JazzCash',   color: 'bg-red-100 text-red-700' },
  { value: 'EASYPAISA', label: 'EasyPaisa',  color: 'bg-green-100 text-green-700' },
  { value: 'SADAPAY',   label: 'SadaPay',    color: 'bg-purple-100 text-purple-700' },
  { value: 'NAYAPAY',   label: 'NayaPay',    color: 'bg-orange-100 text-orange-700' },
  { value: 'OTHER',     label: 'Other',      color: 'bg-gray-100 text-gray-600' },
];

function TypeBadge({ type }: { type: PaymentAccountType }) {
  const t = ACCOUNT_TYPES.find((a) => a.value === type);
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${t?.color ?? 'bg-gray-100 text-gray-600'}`}>
      {t?.label ?? type}
    </span>
  );
}

function PaymentAccountsSection({ isOwner }: { isOwner: boolean }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [removeAccountConfirm, setRemoveAccountConfirm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [type, setType]               = useState<PaymentAccountType>('BANK');
  const [accountTitle, setAccountTitle] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankName, setBankName]         = useState('');

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['payment-accounts'],
    queryFn: sellersApi.listPaymentAccounts,
  });

  const addMutation = useMutation({
    mutationFn: () => sellersApi.addPaymentAccount({
      type,
      accountTitle: accountTitle.trim(),
      accountNumber: accountNumber.trim(),
      bankName: type === 'BANK' && bankName.trim() ? bankName.trim() : undefined,
    }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['payment-accounts'] });
      toast.success('Account added');
      setShowForm(false);
      setAccountTitle(''); setAccountNumber(''); setBankName(''); setType('BANK');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Failed to add')),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => sellersApi.removePaymentAccount(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['payment-accounts'] });
      toast.success('Account removed');
    },
    onError: () => toast.error('Failed to remove'),
  });

  const canSubmit = accountTitle.trim() && accountNumber.trim();

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <CreditCard size={15} className="text-gray-500" />
          Payment Accounts
        </h2>
        {isOwner && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg transition">
            <Plus size={12} /> Add Account
          </button>
        )}
      </div>
      <p className="text-xs text-gray-400 mb-3">
        Customers see these accounts on bills to pay you online.
      </p>

      {/* Add form */}
      {showForm && isOwner && (
        <div className="mb-4 p-4 bg-gray-50 border border-gray-100 rounded-xl space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Type</label>
            <div className="flex flex-wrap gap-1.5">
              {ACCOUNT_TYPES.map((t) => (
                <button key={t.value} onClick={() => setType(t.value)}
                  className={`px-3 py-1 text-xs rounded-lg border font-medium transition ${
                    type === t.value ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-blue-300'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Account Title <span className="text-red-500">*</span></label>
            <input value={accountTitle} onChange={(e) => setAccountTitle(e.target.value)}
              placeholder="e.g. Muhammad Ali"
              className={inp} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              {type === 'BANK' ? 'Account Number' : 'Phone Number'} <span className="text-red-500">*</span>
            </label>
            <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)}
              placeholder={type === 'BANK' ? 'e.g. 0123456789012345' : 'e.g. 03001234567'}
              className={inp} />
          </div>
          {type === 'BANK' && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Bank Name</label>
              <input value={bankName} onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g. HBL, Meezan, UBL"
                className={inp} />
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={() => setShowForm(false)}
              className="flex-1 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-100 transition">
              Cancel
            </button>
            <button
              onClick={() => addMutation.mutate()}
              disabled={!canSubmit || addMutation.isPending}
              className="flex-1 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition disabled:opacity-50">
              {addMutation.isPending ? 'Adding…' : 'Add Account'}
            </button>
          </div>
        </div>
      )}

      {/* Accounts list */}
      {isLoading ? (
        <RowSkeleton rows={2} />
      ) : accounts.length === 0 ? (
        <div className="text-center py-6 text-gray-400 border border-dashed border-gray-200 rounded-xl">
          <CreditCard size={22} className="mx-auto mb-1.5 opacity-30" />
          <p className="text-xs">No payment accounts added yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {accounts.map((acc: PaymentAccount) => (
            <div key={acc.id} className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl">
              <TypeBadge type={acc.type} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{acc.accountTitle}</p>
                <p className="text-xs text-gray-400">
                  {acc.accountNumber}
                  {acc.bankName && ` · ${acc.bankName}`}
                </p>
              </div>
              {isOwner && (
                <button
                  onClick={() => setRemoveAccountConfirm({ open: true, id: acc.id })}
                  disabled={removeMutation.isPending}
                  className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition disabled:opacity-40">
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={removeAccountConfirm.open}
        title="Account Remove Karo?"
        description="Ye payment account remove ho jaega aur installment bills mein dikhna band ho jaega."
        confirmLabel="Remove Karo"
        variant="danger"
        isPending={removeMutation.isPending}
        onConfirm={() => { if (removeAccountConfirm.id) removeMutation.mutate(removeAccountConfirm.id); setRemoveAccountConfirm({ open: false, id: null }); }}
        onCancel={() => setRemoveAccountConfirm({ open: false, id: null })}
      />
    </div>
  );
}

// ── Change Password section ───────────────────────────────────────────────────
function ChangePasswordSection() {
  const [current, setCurrent]     = useState('');
  const [next, setNext]           = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext]       = useState(false);

  const mutation = useMutation({
    mutationFn: () => authApi.changePassword({ currentPassword: current, newPassword: next }),
    onSuccess: () => {
      toast.success('Password change ho gaya');
      setCurrent(''); setNext(''); setConfirm('');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Password change nahi hua')),
  });

  const mismatch = next.length > 0 && confirm.length > 0 && next !== confirm;
  const canSubmit = current.length > 0 && next.length >= 8 && next === confirm && !mutation.isPending;

  return (
    <div className="mt-8">
      <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
        <KeyRound size={15} className="text-gray-500" />
        Password Change Karo
      </h2>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Purana Password</label>
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
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Naya Password</label>
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
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Naya Password Confirm</label>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
            className={`${inp} ${mismatch ? 'border-red-300 focus:border-red-400 focus:ring-red-50' : ''}`}
            placeholder="Dobara likhein" />
          {mismatch && <p className="text-xs text-red-500 mt-1">Passwords match nahi ho rahe</p>}
        </div>

        <button onClick={() => mutation.mutate()} disabled={!canSubmit}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition">
          {mutation.isPending ? 'Saving…' : 'Password Change Karo'}
        </button>
      </div>
    </div>
  );
}

// ── Sessions section ──────────────────────────────────────────────────────────
function SessionsSection() {
  const qc = useQueryClient();
  const { clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const [revokeAllConfirm, setRevokeAllConfirm] = useState(false);
  const [revokeSessionConfirm, setRevokeSessionConfirm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

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
            onClick={() => setRevokeAllConfirm(true)}
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
                  {' · '}Logged in {fmtDate(session.createdAt)}
                </p>
              </div>

              <button
                onClick={() => setRevokeSessionConfirm({ open: true, id: session.id })}
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

      <ConfirmDialog
        open={revokeAllConfirm}
        title="Tamam Sessions Revoke Karo?"
        description="Aap sab devices se logout ho jaenge aur dobara login karna hoga."
        confirmLabel="Revoke All"
        variant="danger"
        isPending={revokeAllMutation.isPending}
        onConfirm={() => { revokeAllMutation.mutate(); setRevokeAllConfirm(false); }}
        onCancel={() => setRevokeAllConfirm(false)}
      />

      <ConfirmDialog
        open={revokeSessionConfirm.open}
        title="Session Revoke Karo?"
        description="Is device ka session khatam ho jaega."
        confirmLabel="Revoke"
        variant="danger"
        isPending={revokeMutation.isPending}
        onConfirm={() => { if (revokeSessionConfirm.id) revokeMutation.mutate(revokeSessionConfirm.id); setRevokeSessionConfirm({ open: false, id: null }); }}
        onCancel={() => setRevokeSessionConfirm({ open: false, id: null })}
      />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.role === 'SELLER_OWNER';
  const { data: shop, isLoading } = useQuery({ queryKey: ['shop-me'], queryFn: sellersApi.getMe });
  const { data: usage } = useQuery({ queryKey: ['billing-usage'], queryFn: billingApi.getUsage, staleTime: 60_000 });

  const [shopName, setShopName] = useState('');
  const [phone, setPhone]       = useState('');
  const [address, setAddress]   = useState('');

  const [dailyTarget,     setDailyTarget]     = useState('');
  const [weeklyTarget,    setWeeklyTarget]    = useState('');
  const [monthlyTarget,   setMonthlyTarget]   = useState('');
  const [commissionRate,  setCommissionRate]  = useState('');
  const [budgets,         setBudgets]         = useState<Partial<Record<string, string>>>({});

  useEffect(() => {
    if (shop) {
      setShopName(shop.shopName);
      setPhone(shop.phone);
      setAddress(shop.address ?? '');
      setDailyTarget(String(shop.settings?.dailyTarget ?? ''));
      setWeeklyTarget(String(shop.settings?.weeklyTarget ?? ''));
      setMonthlyTarget(String(shop.settings?.monthlyTarget ?? ''));
      setCommissionRate(String(shop.settings?.commissionRate ?? ''));
      const eb = shop.settings?.expenseBudgets ?? {};
      setBudgets(Object.fromEntries(Object.entries(eb).map(([k, v]) => [k, String(v ?? '')])));
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

  const targetMutation = useMutation({
    mutationFn: () => {
      const expenseBudgets = Object.fromEntries(
        Object.entries(budgets).filter(([, v]) => v && Number(v) > 0).map(([k, v]) => [k, Number(v)])
      ) as Record<string, number>;
      return sellersApi.update({
        settings: {
          dailyTarget:     dailyTarget     ? Number(dailyTarget)     : undefined,
          weeklyTarget:    weeklyTarget    ? Number(weeklyTarget)    : undefined,
          monthlyTarget:   monthlyTarget   ? Number(monthlyTarget)   : undefined,
          commissionRate:  commissionRate  ? Number(commissionRate)  : undefined,
          expenseBudgets:  Object.keys(expenseBudgets).length ? expenseBudgets : undefined,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shop-me'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Settings saved');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Failed to save')),
  });

  const budgetDirty = JSON.stringify(budgets) !== JSON.stringify(
    Object.fromEntries(Object.entries(shop?.settings?.expenseBudgets ?? {}).map(([k, v]) => [k, String(v ?? '')]))
  );

  const targetDirty = shop && (
    dailyTarget    !== String(shop.settings?.dailyTarget    ?? '') ||
    weeklyTarget   !== String(shop.settings?.weeklyTarget   ?? '') ||
    monthlyTarget  !== String(shop.settings?.monthlyTarget  ?? '') ||
    commissionRate !== String(shop.settings?.commissionRate ?? '') ||
    budgetDirty
  );

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

      {/* Collection Targets */}
      {isOwner && (
        <div className="mt-8 pt-6 border-t border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <Target size={16} className="text-blue-600" />
            <h2 className="text-sm font-semibold text-gray-900">Collection Targets</h2>
          </div>
          <p className="text-xs text-gray-400 mb-4">Set PKR targets — dashboard will show live progress against these goals.</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Daily Target', value: dailyTarget, set: setDailyTarget, placeholder: 'e.g. 50000', suffix: 'PKR' },
              { label: 'Weekly Target', value: weeklyTarget, set: setWeeklyTarget, placeholder: 'e.g. 300000', suffix: 'PKR' },
              { label: 'Monthly Target', value: monthlyTarget, set: setMonthlyTarget, placeholder: 'e.g. 1200000', suffix: 'PKR' },
            ].map(({ label, value, set, placeholder, suffix }) => (
              <div key={label}>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">{label} ({suffix})</label>
                <input
                  type="number"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  placeholder={placeholder}
                  className={inp}
                />
              </div>
            ))}
          </div>
          <div className="mt-3">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Staff Commission Rate (%)</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={commissionRate}
                onChange={(e) => setCommissionRate(e.target.value)}
                placeholder="e.g. 0.5"
                step="0.1"
                min="0"
                max="100"
                className={`${inp} max-w-40`}
              />
              <p className="text-xs text-gray-400">
                {commissionRate && Number(commissionRate) > 0
                  ? `Staff earns ${commissionRate}% of every payment they collect`
                  : 'No commission — staff page will hide commission column'}
              </p>
            </div>
          </div>
          <div className="mt-5 pt-4 border-t border-gray-100">
            <label className="block text-xs font-semibold text-gray-700 mb-1">Monthly Expense Budgets (PKR)</label>
            <p className="text-xs text-gray-400 mb-3">Set a monthly limit per category — ExpensesPage will show how much has been spent vs. budget.</p>
            <div className="grid grid-cols-2 gap-2">
              {(['RENT','SALARY','UTILITY','PURCHASE','MAINTENANCE','TRANSPORT','OTHER'] as const).map((cat) => (
                <div key={cat}>
                  <label className="block text-[11px] font-medium text-gray-500 mb-1 capitalize">{cat.charAt(0) + cat.slice(1).toLowerCase()}</label>
                  <input
                    type="number"
                    value={budgets[cat] ?? ''}
                    onChange={(e) => setBudgets((b) => ({ ...b, [cat]: e.target.value }))}
                    placeholder="No limit"
                    min="0"
                    className={inp}
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={() => targetMutation.mutate()}
              disabled={!targetDirty || targetMutation.isPending}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition">
              {targetMutation.isPending ? 'Saving…' : 'Save'}
            </button>
            {targetDirty && (
              <button
                onClick={() => {
                  setDailyTarget(String(shop?.settings?.dailyTarget ?? ''));
                  setWeeklyTarget(String(shop?.settings?.weeklyTarget ?? ''));
                  setMonthlyTarget(String(shop?.settings?.monthlyTarget ?? ''));
                  setCommissionRate(String(shop?.settings?.commissionRate ?? ''));
                  const eb = shop?.settings?.expenseBudgets ?? {};
                  setBudgets(Object.fromEntries(Object.entries(eb).map(([k, v]) => [k, String(v ?? '')])));
                }}
                className="text-sm text-gray-400 hover:text-gray-600 transition">
                Discard
              </button>
            )}
          </div>
        </div>
      )}

      {/* Payment accounts */}
      <PaymentAccountsSection isOwner={isOwner} />

      {/* Change password */}
      <ChangePasswordSection />

      {/* Sessions */}
      <SessionsSection />
    </div>
  );
}
