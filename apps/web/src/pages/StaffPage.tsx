import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Trash2, Shield, Eye, EyeOff, Snowflake, LockOpen, Check, X as XIcon, TrendingUp, Wallet, AlertTriangle, CheckCircle, Clock, ChevronDown, ChevronUp, LogIn, LogOut, CalendarCheck, RotateCcw, Banknote, Percent, DollarSign, Pencil, BadgeCheck, BarChart2, CreditCard, ShoppingCart, ArrowDownCircle, Landmark, Briefcase, UserCheck, UserMinus, Calculator, MinusCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { staffApi, PERM_LABELS, PERM_GROUPS, type StaffMember, type StaffPermissions, type CollectionEntry, type StaffBriefingRow } from '../api/staff.api.ts';
import { agentPortfolioApi, type PortfolioRow } from '../api/agentPortfolio.api.ts';
import { attendanceApi } from '../api/attendance.api.ts';
import { handoversApi, type Handover, type StaffBalance } from '../api/handovers.api.ts';
import { getErrorMessage } from '../utils/error.ts';
import { useAuthStore } from '../store/auth.store.ts';
import { CardSkeleton, EmptyState, RowSkeleton } from '../components/ui/Skeleton.tsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.tsx';

type StaffType = 'ACCOUNT' | 'AVO' | 'MANAGER' | 'CASHIER' | 'CUSTOM';

const PRESET_PERMS: Record<Exclude<StaffType, 'CUSTOM'>, StaffPermissions> = {
  // Account staff: day-to-day customer & installment operations — no financial reports
  ACCOUNT: { canAddCustomer: true,  canEditCustomer: true,  canAddInstallment: true,  canRecordPayment: true,  canViewReports: false, canManageProducts: false, canVerifyCustomers: false, canRecordExpense: false, canManageReturns: false, canSearchCnic: false, canMakeCashSales: false, canViewAllInstallments: true  },
  // AVO: verification-only — cannot add/edit customers or see financials
  AVO:     { canAddCustomer: false, canEditCustomer: false, canAddInstallment: false, canRecordPayment: false, canViewReports: false, canManageProducts: false, canVerifyCustomers: true,  canRecordExpense: false, canManageReturns: false, canSearchCnic: true,  canMakeCashSales: false, canViewAllInstallments: false },
  // Manager: full access including reports and expenses
  MANAGER: { canAddCustomer: true,  canEditCustomer: true,  canAddInstallment: true,  canRecordPayment: true,  canViewReports: true,  canManageProducts: true,  canVerifyCustomers: true,  canRecordExpense: true,  canManageReturns: true,  canSearchCnic: true,  canMakeCashSales: true,  canViewAllInstallments: true  },
  // Cashier: records payments and cash sales only — no customer/installment mgmt, no reports
  CASHIER: { canAddCustomer: false, canEditCustomer: false, canAddInstallment: false, canRecordPayment: true,  canViewReports: false, canManageProducts: false, canVerifyCustomers: false, canRecordExpense: false, canManageReturns: false, canSearchCnic: false, canMakeCashSales: true,  canViewAllInstallments: false },
};

const DEFAULT_CUSTOM_PERMS: StaffPermissions = {
  canAddCustomer: true, canEditCustomer: true, canAddInstallment: true,
  canRecordPayment: true, canViewReports: false, canManageProducts: false,
  canVerifyCustomers: false, canRecordExpense: false, canManageReturns: false,
  canSearchCnic: false, canMakeCashSales: false, canViewAllInstallments: false,
};

const STAFF_TYPES: { value: StaffType; label: string; desc: string }[] = [
  { value: 'ACCOUNT', label: 'Account Staff', desc: 'Customers, installments & payments' },
  { value: 'AVO',     label: 'AVO',           desc: 'Area Verification Officer' },
  { value: 'MANAGER', label: 'Manager',       desc: 'Full access including reports' },
  { value: 'CASHIER', label: 'Cashier',       desc: 'Record payments & cash sales only' },
  { value: 'CUSTOM',  label: 'Custom',        desc: 'Set permissions manually' },
];

const BADGE_STYLES: Record<string, string> = {
  AVO:     'bg-purple-100 text-purple-700',
  ACCOUNT: 'bg-blue-100 text-blue-700',
  MANAGER: 'bg-green-100 text-green-700',
  CASHIER: 'bg-orange-100 text-orange-700',
  CUSTOM:  'bg-gray-100 text-gray-600',
};

const BADGE_LABELS: Record<string, string> = {
  AVO: 'AVO', ACCOUNT: 'Account', MANAGER: 'Manager', CASHIER: 'Cashier', CUSTOM: 'Custom',
};

function detectStaffType(perms: StaffPermissions): string {
  for (const [type, preset] of Object.entries(PRESET_PERMS)) {
    if ((Object.keys(preset) as (keyof StaffPermissions)[]).every((k) => preset[k] === perms[k])) {
      return type;
    }
  }
  return 'CUSTOM';
}

function AddStaffModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [staffType, setStaffType] = useState<StaffType>('ACCOUNT');
  const [customPerms, setCustomPerms] = useState<StaffPermissions>({ ...DEFAULT_CUSTOM_PERMS });
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState('');

  const getPermissions = (): StaffPermissions =>
    staffType === 'CUSTOM' ? customPerms : PRESET_PERMS[staffType];

  const handleTypeChange = (type: StaffType) => {
    setStaffType(type);
    if (type === 'CUSTOM') setCustomPerms({ ...DEFAULT_CUSTOM_PERMS });
  };

  const { mutate, isPending } = useMutation({
    mutationFn: () => staffApi.create({ ...form, permissions: getPermissions() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff'] }); onClose(); },
    onError: (e) => setErr(getErrorMessage(e, 'Failed to add staff')),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-auto p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Add Staff Member</h2>

        {/* Staff type selector */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {STAFF_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => handleTypeChange(t.value)}
              className={`text-left p-3 rounded-xl border-2 transition ${
                staffType === t.value ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-gray-200'
              } ${t.value === 'CUSTOM' ? 'col-span-2' : ''}`}
            >
              <p className={`text-xs font-semibold ${staffType === t.value ? 'text-blue-700' : 'text-gray-800'}`}>
                {t.label}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">{t.desc}</p>
            </button>
          ))}
        </div>

        {/* Permissions preview / editor */}
        <div className="mb-4 border border-gray-100 rounded-xl p-3 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {staffType === 'CUSTOM' ? 'Set Permissions' : 'Included Permissions'}
          </p>
          {PERM_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{group.label}</p>
              <div className="space-y-1.5">
                {group.keys.map((key) => {
                  const active = staffType === 'CUSTOM' ? customPerms[key] : PRESET_PERMS[staffType as Exclude<StaffType, 'CUSTOM'>][key];
                  const isSensitive = group.label.includes('Sensitive');
                  return (
                    <div key={key} className="flex items-center justify-between">
                      <span className={`text-xs ${active ? (isSensitive ? 'text-orange-700 font-medium' : 'text-gray-700') : 'text-gray-400'}`}>
                        {PERM_LABELS[key]}
                      </span>
                      {staffType === 'CUSTOM' ? (
                        <button
                          type="button"
                          onClick={() => setCustomPerms((p) => ({ ...p, [key]: !p[key] }))}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                            customPerms[key] ? (isSensitive ? 'bg-orange-500' : 'bg-blue-600') : 'bg-gray-200'
                          }`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                            customPerms[key] ? 'translate-x-4.5' : 'translate-x-0.5'
                          }`} />
                        </button>
                      ) : (
                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${
                          active ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-300'
                        }`}>
                          {active ? <Check size={11} strokeWidth={2.5} /> : <XIcon size={11} strokeWidth={2.5} />}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          {(['name', 'email', 'password'] as const).map((key) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {key === 'name' ? 'Full Name' : key === 'email' ? 'Email' : 'Password'}
              </label>
              {key === 'password' ? (
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm pr-9 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button type="button" onClick={() => setShowPw((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              ) : (
                <input
                  type={key === 'email' ? 'email' : 'text'}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>
          ))}
        </div>

        {err && <p className="text-xs text-red-500 mt-3">{err}</p>}

        <div className="flex gap-2 mt-5">
          <button onClick={onClose}
            className="flex-1 border border-gray-200 rounded-xl py-2 text-sm text-gray-600 hover:bg-gray-50 transition">
            Cancel
          </button>
          <button
            onClick={() => mutate()}
            disabled={isPending || !form.name || !form.email || !form.password}
            className="flex-1 bg-blue-600 text-white rounded-xl py-2 text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
            {isPending ? 'Adding…' : 'Add Staff'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PermissionToggle({ member, permKey }: { member: StaffMember; permKey: keyof StaffPermissions }) {
  const qc    = useQueryClient();
  const perms = member.permissions ?? DEFAULT_CUSTOM_PERMS;
  const value = perms[permKey];

  const { mutate } = useMutation({
    mutationFn: (newVal: boolean) =>
      staffApi.updatePermissions(member.id, { [permKey]: newVal }),

    onMutate: (newVal) => {
      // Fire abort signal without awaiting — cache updates instantly on next line
      qc.cancelQueries({ queryKey: ['staff'] });
      const prev = qc.getQueryData<StaffMember[]>(['staff']);
      qc.setQueryData<StaffMember[]>(['staff'], (old) =>
        old?.map((m) =>
          m.id === member.id
            ? { ...m, permissions: { ...(m.permissions ?? DEFAULT_CUSTOM_PERMS), [permKey]: newVal } }
            : m
        ) ?? []
      );
      return { prev };
    },

    onSuccess: (updated) => {
      qc.setQueryData<StaffMember[]>(['staff'], (old) =>
        old?.map((m) => (m.id === updated.id ? updated : m)) ?? []
      );
      toast.success('Permission updated');
    },

    onError: (_, __, ctx) => {
      if (ctx?.prev) qc.setQueryData(['staff'], ctx.prev);
      toast.error('Failed to update permission');
    },
  });

  return (
    <button
      onClick={() => mutate(!value)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
        value ? 'bg-blue-600' : 'bg-gray-200'
      }`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
        value ? 'translate-x-4.5' : 'translate-x-0.5'
      }`} />
    </button>
  );
}

const FREEZE_OPTIONS: { label: string; value: number | 'permanent'; desc: string }[] = [
  { label: '1 Month',   value: 1,           desc: 'Unfreeze after 30 days' },
  { label: '2 Months',  value: 2,           desc: 'Unfreeze after 60 days' },
  { label: '3 Months',  value: 3,           desc: 'Unfreeze after 90 days' },
  { label: 'Permanent', value: 'permanent', desc: 'Manual unfreeze required' },
];

function isMemberFrozen(member: StaffMember): boolean {
  if (!member.frozenUntil) return false;
  return new Date(member.frozenUntil) > new Date();
}

function frozenLabel(member: StaffMember): string {
  if (!member.frozenUntil) return '';
  const until = new Date(member.frozenUntil);
  if (until.getFullYear() >= 2099) return 'Permanently frozen';
  const days = Math.ceil((until.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return days <= 0 ? '' : `Frozen · ${days}d remaining`;
}

function FreezeModal({ member, onClose }: { member: StaffMember; onClose: () => void }) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<number | 'permanent'>(1);
  const [err, setErr] = useState('');

  const { mutate, isPending } = useMutation({
    mutationFn: () => staffApi.freeze(member.id, selected),
    onSuccess: (updated) => {
      qc.setQueryData<StaffMember[]>(['staff'], (old) =>
        old?.map((m) => (m.id === updated.id ? updated : m)) ?? []
      );
      onClose();
    },
    onError: (e) => setErr(getErrorMessage(e, 'Failed to freeze account')),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs mx-auto p-6">
        <div className="flex items-center gap-2 mb-1">
          <Snowflake size={16} className="text-blue-500" />
          <h2 className="text-sm font-semibold text-gray-900">Freeze Account</h2>
        </div>
        <p className="text-xs text-gray-400 mb-4">{member.name} — select freeze duration</p>

        <div className="space-y-2 mb-5">
          {FREEZE_OPTIONS.map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => setSelected(opt.value)}
              className={`w-full text-left px-3 py-2.5 rounded-xl border-2 transition ${
                selected === opt.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-100 hover:border-gray-200'
              }`}
            >
              <p className={`text-xs font-semibold ${selected === opt.value ? 'text-blue-700' : 'text-gray-800'}`}>
                {opt.label}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">{opt.desc}</p>
            </button>
          ))}
        </div>

        {err && <p className="text-xs text-red-500 mb-3">{err}</p>}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 rounded-xl py-2 text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={() => mutate()}
            disabled={isPending}
            className="flex-1 bg-blue-600 text-white rounded-xl py-2 text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
          >
            {isPending ? 'Freezing…' : 'Freeze'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProfileEditModal({ member, onClose }: { member: StaffMember; onClose: () => void }) {
  const qc = useQueryClient();
  const [commRate, setCommRate]   = useState(member.commissionRate ? String(Number(member.commissionRate)) : '');
  const [salary,   setSalary]     = useState(member.monthlySalary  ? String(Number(member.monthlySalary))  : '');

  const { mutate, isPending } = useMutation({
    mutationFn: () => staffApi.updateProfile(member.id, {
      commissionRate: commRate !== '' ? Number(commRate) : null,
      monthlySalary:  salary   !== '' ? Number(salary)   : null,
    }),
    onSuccess: (updated) => {
      qc.setQueryData<StaffMember[]>(['staff'], (old) => old?.map((m) => m.id === updated.id ? updated : m) ?? []);
      toast.success('Profile updated');
      onClose();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900">{member.name}</h3>
            <p className="text-xs text-gray-400">Commission Rate & Salary</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XIcon size={16} /></button>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">
            Commission Rate (%) — leave blank to use shop-wide rate
          </label>
          <div className="relative">
            <Percent size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="number" value={commRate} onChange={(e) => setCommRate(e.target.value)} min="0" max="100" step="0.5"
              placeholder="e.g. 2.5"
              className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 transition" />
          </div>
          {commRate && <p className="text-[10px] text-blue-500 mt-1">{member.name} ko har payment pe {commRate}% commission milegi</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">Monthly Salary (PKR)</label>
          <div className="relative">
            <DollarSign size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="number" value={salary} onChange={(e) => setSalary(e.target.value)} min="0"
              placeholder="e.g. 25000"
              className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 transition" />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">Cancel</button>
          <button onClick={() => mutate()} disabled={isPending}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition disabled:opacity-50">
            {isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StaffCard({ member, balance }: { member: StaffMember; balance?: import('../api/handovers.api.ts').StaffBalance }) {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isOwner = user?.role === 'SELLER_OWNER';
  const perms = member.permissions ?? DEFAULT_CUSTOM_PERMS;
  const staffType = detectStaffType(perms);
  const initials = member.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const frozen = isMemberFrozen(member);
  const [showFreeze,    setShowFreeze]    = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState(false);
  const [showProfile,   setShowProfile]   = useState(false);
  const [showReceive,   setShowReceive]   = useState(false);

  const pendingCash = balance ? Number(balance.pendingBalance) : 0;

  const { mutate: remove, isPending: isRemoving } = useMutation({
    mutationFn: () => staffApi.remove(member.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }),
  });

  const { mutate: unfreeze, isPending: isUnfreezing } = useMutation({
    mutationFn: () => staffApi.unfreeze(member.id),
    onSuccess: (updated) => {
      qc.setQueryData<StaffMember[]>(['staff'], (old) =>
        old?.map((m) => (m.id === updated.id ? updated : m)) ?? []
      );
    },
  });

  return (
    <>
      <div className={`bg-white rounded-2xl border shadow-sm p-5 transition ${frozen ? 'border-blue-200 bg-blue-50/30' : 'border-gray-100'}`}>
        {/* Frozen banner */}
        {frozen && (
          <div className="flex items-center gap-1.5 bg-blue-100 text-blue-700 rounded-xl px-3 py-1.5 mb-3 text-xs font-medium">
            <Snowflake size={12} />
            <span>{frozenLabel(member)}</span>
          </div>
        )}

        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${frozen ? 'bg-blue-400' : 'bg-linear-to-br from-indigo-500 to-purple-600'}`}>
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-gray-900">{member.name}</p>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${BADGE_STYLES[staffType] ?? BADGE_STYLES.CUSTOM}`}>
                  {BADGE_LABELS[staffType] ?? 'Custom'}
                </span>
              </div>
              <p className="text-xs text-gray-400">{member.email}</p>
            </div>
          </div>

          {isOwner && (
            <div className="flex items-center gap-1">
              {frozen ? (
                <button
                  onClick={() => unfreeze()}
                  disabled={isUnfreezing}
                  title="Unfreeze account"
                  className="text-blue-400 hover:text-blue-600 transition p-1 rounded-lg hover:bg-blue-50 disabled:opacity-50"
                >
                  <LockOpen size={14} />
                </button>
              ) : (
                <button
                  onClick={() => setShowFreeze(true)}
                  title="Freeze account"
                  className="text-gray-300 hover:text-blue-500 transition p-1 rounded-lg hover:bg-blue-50"
                >
                  <Snowflake size={14} />
                </button>
              )}
              <button
                onClick={() => setRemoveConfirm(true)}
                className="text-gray-300 hover:text-red-500 transition p-1 rounded-lg hover:bg-red-50"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>

        <div className="border-t border-gray-50 pt-3 space-y-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Shield size={12} className="text-gray-400" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Permissions</p>
          </div>
          {PERM_GROUPS.map((group) => {
            const isSensitive = group.label.includes('Sensitive');
            return (
              <div key={group.label}>
                <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1.5 ${isSensitive ? 'text-orange-400' : 'text-gray-400'}`}>
                  {group.label}
                </p>
                <div className="space-y-1.5">
                  {group.keys.map((key) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className={`text-xs ${perms[key] ? (isSensitive ? 'text-orange-700 font-medium' : 'text-gray-700') : 'text-gray-400'}`}>
                        {PERM_LABELS[key]}
                      </span>
                      {isOwner ? (
                        <PermissionToggle member={member} permKey={key} />
                      ) : (
                        <div className={`relative inline-flex h-5 w-9 items-center rounded-full cursor-default ${perms[key] ? (isSensitive ? 'bg-orange-500' : 'bg-blue-600') : 'bg-gray-200'}`}>
                          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${perms[key] ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Rate & Salary footer — owner only */}
        {isOwner && (
          <div className="border-t border-gray-50 mt-3 pt-3 flex items-center justify-between gap-2">
            <div className="flex gap-3 text-[11px] text-gray-500">
              <span className="flex items-center gap-1">
                <Percent size={10} className="text-blue-400" />
                {member.commissionRate ? `${Number(member.commissionRate)}% comm` : 'Shop rate'}
              </span>
              <span className="flex items-center gap-1">
                <DollarSign size={10} className="text-emerald-500" />
                {member.monthlySalary
                  ? `PKR ${Number(member.monthlySalary).toLocaleString('en-PK', { maximumFractionDigits: 0 })}/mo`
                  : 'No salary set'}
              </span>
            </div>
            <button onClick={() => setShowProfile(true)}
              className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-blue-500 transition">
              <Pencil size={10} /> Edit
            </button>
          </div>
        )}
      </div>

      {/* Cash in Hand — owner only, shown when employee has unclaimed cash */}
      {isOwner && balance && pendingCash >= 1 && (
        <div className="mt-3" style={{ borderLeft: `3px solid ${balance.pendingHandover ? '#F59E0B' : '#10B981'}` }}>
          <div className={`rounded-r-xl px-3 py-3 ${balance.pendingHandover ? 'bg-amber-50' : 'bg-emerald-50'}`}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Haath Mein Cash</p>
                <p className={`text-lg font-black leading-none ${balance.pendingHandover ? 'text-amber-700' : 'text-emerald-700'}`}
                  style={{ fontFamily: "'Syne', sans-serif" }}>
                  {pkr(pendingCash)}
                </p>
              </div>
              <button
                onClick={() => setShowReceive(true)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-2 text-white text-xs font-bold rounded-xl transition shadow-sm ${
                  balance.pendingHandover
                    ? 'bg-amber-500 hover:bg-amber-600'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                <Banknote size={12} /> {balance.pendingHandover ? 'Confirm' : 'Cash Li'}
              </button>
            </div>
            {balance.pendingHandover && (
              <p className="text-[10px] text-amber-600 mt-2 flex items-center gap-1">
                <Clock size={9} /> Staff ne {pkr(Number(balance.pendingHandover.handedAmount))} submit kiya
              </p>
            )}
          </div>
        </div>
      )}

      {showFreeze   && <FreezeModal member={member} onClose={() => setShowFreeze(false)} />}
      {showProfile  && <ProfileEditModal member={member} onClose={() => setShowProfile(false)} />}
      {showReceive  && balance && (
        <DirectReceiveModal
          target={balance}
          onClose={() => setShowReceive(false)}
        />
      )}

      <ConfirmDialog
        open={removeConfirm}
        title={`${member.name} ko Remove Karo?`}
        description="Is staff member ka account delete ho jaega aur wo login nahi kar sakey ga."
        confirmLabel="Remove Karo"
        variant="danger"
        isPending={isRemoving}
        onConfirm={() => { remove(); setRemoveConfirm(false); }}
        onCancel={() => setRemoveConfirm(false)}
      />
    </>
  );
}

function pkr(v: number) {
  return 'PKR ' + v.toLocaleString('en-PK', { maximumFractionDigits: 0 });
}

// ── Direct Receive Modal (owner initiates cash receive without waiting for staff) ──

function DirectReceiveModal({ target, onClose }: { target: StaffBalance; onClose: () => void }) {
  const qc = useQueryClient();
  const systemBalance = Number(target.pendingBalance);
  const prefill = target.pendingHandover ? target.pendingHandover.handedAmount : String(systemBalance);

  const [amount, setAmount] = useState(prefill);
  const [note,   setNote]   = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      handoversApi.directReceive({ staffId: target.staffId, amount: Number(amount), note: note.trim() || undefined }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['handovers'] });
      void qc.invalidateQueries({ queryKey: ['handover-balances'] });
      void qc.invalidateQueries({ queryKey: ['handover-pending-balances'] });
      toast.success(`${target.staffName} se PKR ${Number(amount).toLocaleString()} receive ho gaya`);
      onClose();
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e, 'Kuch masla ho gaya')),
  });

  const diff    = Number(amount) - systemBalance;
  const hasDiff = Math.abs(diff) >= 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Cash Li</h2>
            <p className="text-xs text-gray-400 mt-0.5">{target.staffName} se receive karo</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XIcon size={16} /></button>
        </div>

        {/* System balance */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
          <p className="text-[11px] text-blue-400 font-semibold uppercase tracking-wide mb-0.5">System Balance (Cash)</p>
          <p className="text-xl font-black text-blue-700">{pkr(systemBalance)}</p>
        </div>

        {/* Staff's pending claim */}
        {target.pendingHandover && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
            <p className="text-[11px] text-amber-500 font-semibold uppercase tracking-wide mb-0.5">Staff ne submit kiya</p>
            <p className="text-xl font-black text-amber-700">{pkr(Number(target.pendingHandover.handedAmount))}</p>
            {target.pendingHandover.note && (
              <p className="text-xs text-gray-400 mt-1 italic">"{target.pendingHandover.note}"</p>
            )}
          </div>
        )}

        {/* Actual amount */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">
            Aap ne gina hua amount (PKR) <span className="text-red-500">*</span>
          </label>
          <input
            type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
            min="0"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50 transition"
          />
          {amount && hasDiff && (
            <p className={`text-xs mt-1 font-medium ${diff < 0 ? 'text-red-500' : 'text-amber-600'}`}>
              {diff < 0
                ? `PKR ${Math.abs(diff).toLocaleString()} system se kam — note zaroor likhein`
                : `PKR ${diff.toLocaleString()} system se zyada`}
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">
            Note {hasDiff && <span className="text-amber-500">(farq ki wajah)</span>}
          </label>
          <textarea
            value={note} onChange={(e) => setNote(e.target.value)}
            rows={2} placeholder="e.g. PKR 2000 kal dega, ya bank transfer hua"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50 transition resize-none"
          />
        </div>

        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!amount || Number(amount) < 0 || mutation.isPending}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {mutation.isPending ? 'Processing…' : <><CheckCircle size={14} /> Cash Li</>}
          </button>
        </div>
      </div>
    </div>
  );
}

const STATUS_BADGE: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  PENDING:   { label: 'Pending',   cls: 'bg-amber-100 text-amber-700',  icon: <Clock size={10} /> },
  CONFIRMED: { label: 'Confirmed', cls: 'bg-green-100 text-green-700',  icon: <CheckCircle size={10} /> },
  DISPUTED:  { label: 'Disputed',  cls: 'bg-red-100 text-red-700',      icon: <AlertTriangle size={10} /> },
};

// ── Staff "Cash in Hand" balance card ─────────────────────────────────────────
function CashInHandCard({ balance, onSubmit }: { balance: StaffBalance | null | undefined; onSubmit: () => void }) {
  const pending  = balance?.pendingHandover ?? null;
  const cashAmt  = Number(balance?.pendingBalance ?? 0);
  const allClear = cashAmt < 1;

  return (
    <div className={`rounded-2xl overflow-hidden mb-5 border ${allClear ? 'border-emerald-200' : 'border-amber-200'}`}
      style={{ background: allClear ? 'linear-gradient(135deg,#f0fdf4,#dcfce7)' : 'linear-gradient(135deg,#fffbeb,#fef3c7)' }}>
      <div className={`h-1 ${allClear ? 'bg-emerald-400' : 'bg-amber-400'}`} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Haath Mein Cash</p>
            <p className={`text-3xl font-black leading-none ${allClear ? 'text-emerald-700' : 'text-amber-700'}`}
              style={{ fontFamily: "'Syne', sans-serif" }}>
              {pkr(cashAmt)}
            </p>
            {balance && (
              <p className="text-[11px] text-gray-400 mt-2">
                Collected: {pkr(Number(balance.totalCollected))} · Confirmed: {pkr(Number(balance.totalConfirmed))}
              </p>
            )}
          </div>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${allClear ? 'bg-emerald-100' : 'bg-amber-100'}`}>
            <Banknote size={22} className={allClear ? 'text-emerald-600' : 'text-amber-600'} />
          </div>
        </div>

        {allClear ? (
          <div className="flex items-center gap-2 bg-emerald-100 rounded-xl px-3 py-2.5">
            <CheckCircle size={14} className="text-emerald-600 shrink-0" />
            <p className="text-xs font-semibold text-emerald-700">Sab clear — koi pending cash nahi</p>
          </div>
        ) : pending ? (
          <div className="bg-white/80 rounded-xl p-3.5 border border-amber-200">
            <div className="flex items-center gap-2 mb-1.5">
              <Clock size={13} className="text-amber-500 shrink-0" />
              <p className="text-xs font-bold text-amber-700">Handover submit ho gaya — owner confirm karega</p>
            </div>
            <p className="text-[11px] text-gray-600">
              {pkr(Number(pending.handedAmount))} ·{' '}
              {new Date(pending.createdAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </p>
            {pending.note && <p className="text-[10px] text-gray-400 italic mt-1">"{pending.note}"</p>}
          </div>
        ) : (
          <button
            onClick={onSubmit}
            className="w-full py-3 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 active:scale-[0.98] rounded-xl transition flex items-center justify-center gap-2 shadow-sm">
            <Wallet size={15} /> Cash Handover Submit Karo
          </button>
        )}
      </div>
    </div>
  );
}

// ── Owner: all-staff balance grid ─────────────────────────────────────────────
function StaffBalanceGrid({
  balances,
  onSelectStaff,
  onReceive,
}: {
  balances: StaffBalance[];
  onSelectStaff: (id: string) => void;
  onReceive: (b: StaffBalance) => void;
}) {
  if (balances.length === 0) return null;

  const totalPending  = balances.reduce((s, b) => s + Number(b.pendingBalance), 0);
  const pendingCount  = balances.filter((b) => b.pendingHandover).length;
  const allClearCount = balances.filter((b) => Number(b.pendingBalance) < 1).length;

  return (
    <div className="mb-6">
      {/* KPI summary row */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
          <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wide mb-1.5">Pending Cash</p>
          <p className="text-xl font-black text-amber-700 leading-none"
            style={{ fontFamily: "'Syne', sans-serif" }}>
            {totalPending >= 100000
              ? `${(totalPending / 100000).toFixed(1)}L`
              : totalPending >= 1000
              ? `${(totalPending / 1000).toFixed(totalPending % 1000 === 0 ? 0 : 1)}K`
              : String(Math.round(totalPending))}
          </p>
        </div>
        <div className={`border rounded-2xl px-4 py-3 ${pendingCount > 0 ? 'bg-orange-50 border-orange-100' : 'bg-gray-50 border-gray-100'}`}>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Confirm Baki</p>
          <p className={`text-xl font-black leading-none ${pendingCount > 0 ? 'text-orange-600' : 'text-gray-300'}`}
            style={{ fontFamily: "'Syne', sans-serif" }}>
            {pendingCount}
          </p>
        </div>
        <div className={`border rounded-2xl px-4 py-3 ${allClearCount === balances.length ? 'bg-emerald-50 border-emerald-100' : 'bg-gray-50 border-gray-100'}`}>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Clear</p>
          <p className={`text-xl font-black leading-none ${allClearCount === balances.length ? 'text-emerald-600' : 'text-gray-500'}`}
            style={{ fontFamily: "'Syne', sans-serif" }}>
            {allClearCount}<span className="text-sm font-semibold text-gray-300">/{balances.length}</span>
          </p>
        </div>
      </div>

      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2.5 px-0.5">Staff</p>
      <div className="space-y-2">
        {balances.map((b) => {
          const bal         = Number(b.pendingBalance);
          const allClear    = bal < 1;
          const hasHandover = !!b.pendingHandover;

          return (
            <div
              key={b.staffId}
              className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow transition px-3 py-3"
              style={{ borderLeft: `4px solid ${hasHandover ? '#F59E0B' : allClear ? '#34D399' : '#60A5FA'}` }}
            >
              <button
                onClick={() => onSelectStaff(b.staffId)}
                className="flex items-center gap-3 flex-1 min-w-0 text-left"
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${
                  hasHandover ? 'bg-amber-100 text-amber-700'
                  : allClear  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-blue-100 text-blue-700'
                }`}>
                  {b.staffName.slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{b.staffName}</p>
                  {hasHandover ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700">
                      <Clock size={9} /> Submit kia — confirm karein
                    </span>
                  ) : allClear ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                      <CheckCircle size={9} /> Sab clear
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-400">Handover nahi kia</span>
                  )}
                </div>
                <span className={`text-sm font-black shrink-0 ${allClear ? 'text-gray-300' : hasHandover ? 'text-amber-700' : 'text-gray-900'}`}
                  style={{ fontFamily: "'Syne', sans-serif" }}>
                  {pkr(bal)}
                </span>
              </button>

              {!allClear && (
                <button
                  onClick={() => onReceive(b)}
                  className={`shrink-0 text-xs font-bold px-3 py-2 rounded-xl transition ${
                    hasHandover
                      ? 'bg-amber-500 text-white hover:bg-amber-600'
                      : 'bg-emerald-500 text-white hover:bg-emerald-600'
                  }`}
                >
                  {hasHandover ? 'Confirm' : 'Cash Li'}
                </button>
              )}
            </div>
          );
        })}

        {balances.every((b) => Number(b.pendingBalance) < 1) && (
          <div className="flex items-center justify-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl py-3">
            <CheckCircle size={14} className="text-emerald-500" />
            <p className="text-xs font-semibold text-emerald-600">Sab staff ka cash clear hai</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Submit Handover Modal (staff use) ─────────────────────────────────────────
function SubmitHandoverModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState('');
  const [note, setNote]     = useState('');

  const { data: todayData } = useQuery({
    queryKey: ['handover-collected-today'],
    queryFn: () => handoversApi.collectedToday(),
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: () => handoversApi.create({ handedAmount: Number(amount), note: note || undefined }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['handovers'] });
      void qc.invalidateQueries({ queryKey: ['handover-my-balance'] });
      toast.success('Handover submit ho gaya! Owner ka wait karo.');
      onClose();
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Submit failed')),
  });

  const collected = todayData?.collected ?? 0;
  const diff      = Number(amount) - collected;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Cash Handover Submit</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XIcon size={16} /></button>
        </div>

        {collected > 0 && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm">
            <p className="text-xs text-gray-500 mb-0.5">Aaj ka collected cash (system)</p>
            <p className="text-lg font-bold text-blue-700">{pkr(collected)}</p>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            Kitna cash de rahe ho? (PKR) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 15000"
            min="1"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition"
          />
          {amount && collected > 0 && (
            <p className={`text-xs mt-1 font-medium ${Math.abs(diff) < 1 ? 'text-green-600' : diff < 0 ? 'text-red-500' : 'text-amber-600'}`}>
              {Math.abs(diff) < 1
                ? '✓ System total se match kar raha hai'
                : diff < 0
                ? `PKR ${Math.abs(diff).toLocaleString()} system total se kam`
                : `PKR ${diff.toLocaleString()} system total se zyada`}
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Note (optional)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="e.g. 2 payments card se the, baqi cash"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition resize-none"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose}
            className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!amount || Number(amount) <= 0 || mutation.isPending}
            className="flex-1 py-2.5 text-sm font-semibold bg-green-600 text-white rounded-xl hover:bg-green-700 transition disabled:opacity-50">
            {mutation.isPending ? 'Submit ho raha hai…' : 'Submit Karo'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Confirm Handover Modal (owner use) ────────────────────────────────────────
function ConfirmHandoverModal({ handover, onClose }: { handover: Handover; onClose: () => void }) {
  const qc = useQueryClient();
  const [confirmedAmount, setConfirmedAmount] = useState(handover.handedAmount);
  const [ownerNote, setOwnerNote]             = useState('');

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['handovers'] });
    void qc.invalidateQueries({ queryKey: ['handover-balances'] });
  };

  const confirmMutation = useMutation({
    mutationFn: () => handoversApi.confirm(handover.id, {
      confirmedAmount: Number(confirmedAmount),
      ownerNote: ownerNote || undefined,
    }),
    onSuccess: () => { invalidate(); toast.success('Handover confirm ho gaya'); onClose(); },
    onError: (e) => toast.error(getErrorMessage(e, 'Failed')),
  });

  const disputeMutation = useMutation({
    mutationFn: () => handoversApi.dispute(handover.id, ownerNote || undefined),
    onSuccess: () => { invalidate(); toast.success('Dispute mark ho gaya'); onClose(); },
    onError: (e) => toast.error(getErrorMessage(e, 'Failed')),
  });

  const diff = Number(confirmedAmount) - Number(handover.handedAmount);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Handover Review</h2>
            <p className="text-xs text-gray-400">{handover.staffName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XIcon size={16} /></button>
        </div>

        <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-400 mb-0.5">Staff ne submit kiya</p>
          <p className="font-bold text-gray-900 text-xl">{pkr(Number(handover.handedAmount))}</p>
          {handover.note && <p className="text-xs text-gray-500 mt-1 italic">"{handover.note}"</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            Aap ne gina hua amount (PKR) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={confirmedAmount}
            onChange={(e) => setConfirmedAmount(e.target.value)}
            min="0"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition"
          />
          {Math.abs(diff) >= 1 && (
            <p className={`text-xs mt-1 font-medium ${diff < 0 ? 'text-red-500' : 'text-amber-600'}`}>
              {diff < 0
                ? `PKR ${Math.abs(diff).toLocaleString()} kam — dispute karne par consider karein`
                : `PKR ${diff.toLocaleString()} zyada submit se`}
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Owner note (optional)</label>
          <textarea
            value={ownerNote}
            onChange={(e) => setOwnerNote(e.target.value)}
            rows={2}
            placeholder="Koi discrepancy ya note"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition resize-none"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => disputeMutation.mutate()}
            disabled={disputeMutation.isPending || confirmMutation.isPending}
            className="flex-1 py-2.5 text-sm font-medium text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition disabled:opacity-50">
            {disputeMutation.isPending ? '…' : 'Dispute'}
          </button>
          <button
            onClick={() => confirmMutation.mutate()}
            disabled={!confirmedAmount || Number(confirmedAmount) < 0 || confirmMutation.isPending || disputeMutation.isPending}
            className="flex-1 py-2.5 text-sm font-semibold bg-green-600 text-white rounded-xl hover:bg-green-700 transition disabled:opacity-50">
            {confirmMutation.isPending ? 'Confirm ho raha…' : 'Confirm Receipt'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Handovers section (both staff + owner views) ──────────────────────────────
function HandoversSection() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isOwner = user?.role === 'SELLER_OWNER';
  const isStaff = user?.role === 'SELLER_STAFF';

  const [showSubmit,          setShowSubmit]          = useState(false);
  const [confirmTarget,       setConfirmTarget]       = useState<Handover | null>(null);
  const [directReceiveTarget, setDirectReceiveTarget] = useState<StaffBalance | null>(null);
  const [expanded,            setExpanded]            = useState(false);
  const [filterStaffId,       setFilterStaffId]       = useState<string | undefined>(undefined);

  const { data: handovers = [], isLoading } = useQuery({
    queryKey: ['handovers', filterStaffId],
    queryFn: () => handoversApi.list({ staffId: filterStaffId }),
    staleTime: 30_000,
  });

  // Staff: own balance card
  const { data: myBalance } = useQuery({
    queryKey: ['handover-my-balance'],
    queryFn: () => handoversApi.myBalance(),
    staleTime: 30_000,
    enabled: isStaff,
  });

  // Owner: all-staff balances grid
  const { data: allBalances = [] } = useQuery({
    queryKey: ['handover-balances'],
    queryFn: () => handoversApi.pendingBalances(),
    staleTime: 30_000,
    enabled: isOwner,
  });

  const reopenMutation = useMutation({
    mutationFn: (id: string) => handoversApi.reopen(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['handovers'] });
      void qc.invalidateQueries({ queryKey: ['handover-balances'] });
      toast.success('Handover reopen ho gaya');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Reopen failed')),
  });

  const pending   = handovers.filter((h) => h.status === 'PENDING');
  const displayed = expanded ? handovers : handovers.slice(0, 8);

  // Staff: if they already have a pending handover, block submit
  const hasPendingHandover = isStaff && !!myBalance?.pendingHandover;

  return (
    <div className="py-1">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-2xl flex items-center justify-center shrink-0">
            <Wallet size={18} className="text-emerald-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Cash Handover</h2>
            <p className="text-[11px] mt-0.5">
              {pending.length > 0
                ? <span className="text-amber-600 font-semibold">{pending.length} pending confirmation</span>
                : <span className="text-gray-400">Sab handovers track karen</span>}
            </p>
          </div>
        </div>
        {isStaff && !hasPendingHandover && (
          <button
            onClick={() => setShowSubmit(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] rounded-xl transition shadow-sm">
            <Wallet size={14} /> Submit
          </button>
        )}
      </div>

      {/* ── Staff: cash in hand card ── */}
      {isStaff && (
        <CashInHandCard
          balance={myBalance}
          onSubmit={() => setShowSubmit(true)}
        />
      )}

      {/* ── Owner: staff balance grid ── */}
      {isOwner && (
        <StaffBalanceGrid
          balances={allBalances}
          onSelectStaff={(id) => setFilterStaffId((prev) => prev === id ? undefined : id)}
          onReceive={(b) => setDirectReceiveTarget(b)}
        />
      )}

      {/* ── Filter chip (owner filtered to one staff) ── */}
      {isOwner && filterStaffId && (
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-full px-3 py-1.5">
            <span className="text-xs font-semibold text-blue-700">
              {allBalances.find((b) => b.staffId === filterStaffId)?.staffName ?? filterStaffId}
            </span>
            <button
              onClick={() => setFilterStaffId(undefined)}
              className="text-blue-400 hover:text-blue-700 transition">
              <XIcon size={12} />
            </button>
          </div>
          <span className="text-[10px] text-gray-400">ka handover history</span>
        </div>
      )}

      {/* ── Handover list ── */}
      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2.5 px-0.5">Handover History</p>
      {isLoading ? (
        <RowSkeleton rows={3} />
      ) : handovers.length === 0 ? (
        <div className="text-center py-10 bg-gray-50 border border-dashed border-gray-200 rounded-2xl">
          <Wallet size={28} className="mx-auto mb-2 text-gray-300" />
          <p className="text-sm font-semibold text-gray-400">{filterStaffId ? 'Is staff ka koi handover nahi' : 'Koi handover nahi abhi tak'}</p>
          <p className="text-xs text-gray-300 mt-1">Handovers yahan track honge</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {displayed.map((h) => {
              const badge    = STATUS_BADGE[h.status] ?? STATUS_BADGE.PENDING;
              const shortfall = h.confirmedAmount != null
                ? Number(h.confirmedAmount) - Number(h.handedAmount)
                : null;
              return (
                <div key={h.id}
                  className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
                  style={{ borderLeft: `4px solid ${h.status === 'DISPUTED' ? '#EF4444' : h.status === 'PENDING' ? '#F59E0B' : '#10B981'}` }}>
                  <div className="flex items-start gap-3 p-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        {isOwner && <p className="text-sm font-bold text-gray-900">{h.staffName}</p>}
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.cls}`}>
                          {badge.icon} {badge.label}
                        </span>
                        <p className="text-[10px] text-gray-400">
                          {new Date(h.handoverDate).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-base font-black text-gray-900"
                          style={{ fontFamily: "'Syne', sans-serif" }}>
                          {pkr(Number(h.handedAmount))}
                        </span>
                        {h.confirmedAmount && (
                          <span className={`text-xs font-semibold ${shortfall != null && shortfall < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                            → {pkr(Number(h.confirmedAmount))}
                            {shortfall != null && Math.abs(shortfall) >= 1 && (
                              <span className="ml-1 text-[10px]">({shortfall < 0 ? '-' : '+'}{pkr(Math.abs(shortfall))})</span>
                            )}
                          </span>
                        )}
                      </div>
                      {h.note && <p className="text-[11px] text-gray-400 mt-1 italic truncate">"{h.note}"</p>}
                      {h.ownerNote && <p className="text-[11px] text-red-500 mt-0.5 italic truncate">Owner: "{h.ownerNote}"</p>}
                    </div>

                    <div className="flex flex-col gap-1.5 shrink-0">
                      {isOwner && h.status === 'PENDING' && (
                        <button
                          onClick={() => setConfirmTarget(h)}
                          className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition">
                          Review
                        </button>
                      )}
                      {isOwner && h.status === 'DISPUTED' && (
                        <button
                          onClick={() => reopenMutation.mutate(h.id)}
                          disabled={reopenMutation.isPending}
                          title="Reopen as Pending"
                          className="px-3 py-1.5 text-xs font-bold text-amber-700 border border-amber-200 rounded-xl hover:bg-amber-50 transition flex items-center gap-1.5 disabled:opacity-50">
                          <RotateCcw size={10} /> Reopen
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {handovers.length > 8 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-3 w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-xl transition">
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {expanded ? 'Kam dikhao' : `${handovers.length - 8} aur dikhao`}
            </button>
          )}
        </>
      )}

      {showSubmit && <SubmitHandoverModal onClose={() => setShowSubmit(false)} />}
      {confirmTarget && <ConfirmHandoverModal handover={confirmTarget} onClose={() => setConfirmTarget(null)} />}
      {directReceiveTarget && (
        <DirectReceiveModal target={directReceiveTarget} onClose={() => setDirectReceiveTarget(null)} />
      )}
    </div>
  );
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true });
}
function formatDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function AttendanceSection({ isOwner }: { isOwner: boolean }) {
  const qc = useQueryClient();
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  const { data: status, refetch: refetchStatus } = useQuery({
    queryKey: ['attendance-status'],
    queryFn:  attendanceApi.getStatus,
    staleTime: 30_000,
  });

  const { data: records = [] } = useQuery({
    queryKey: ['attendance-monthly', year, month],
    queryFn:  () => attendanceApi.getByMonth(year, month),
    staleTime: 2 * 60_000,
    enabled: isOwner,
  });

  const { data: summary = [] } = useQuery({
    queryKey: ['attendance-summary', year, month],
    queryFn:  () => attendanceApi.getSummary(year, month),
    staleTime: 2 * 60_000,
    enabled: isOwner,
  });

  const clockInMut = useMutation({
    mutationFn: attendanceApi.clockIn,
    onSuccess: () => {
      toast.success('Clocked in!');
      void refetchStatus();
      void qc.invalidateQueries({ queryKey: ['attendance-monthly'] });
      void qc.invalidateQueries({ queryKey: ['attendance-summary'] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const clockOutMut = useMutation({
    mutationFn: () => attendanceApi.clockOut(),
    onSuccess: () => {
      toast.success('Clocked out!');
      void refetchStatus();
      void qc.invalidateQueries({ queryKey: ['attendance-monthly'] });
      void qc.invalidateQueries({ queryKey: ['attendance-summary'] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  function prevMonth() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (isCurrentMonth) return;
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  }

  const isClockedIn = status?.isClockedIn ?? false;

  return (
    <div className="mt-8">
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-50 flex items-center gap-2">
          <CalendarCheck size={16} className="text-teal-500" />
          <div>
            <p className="text-sm font-semibold text-gray-900">Attendance</p>
            <p className="text-xs text-gray-400">Clock in/out and track working hours</p>
          </div>
        </div>

        {/* Clock-in/out widget */}
        <div className="px-6 py-5 border-b border-gray-50">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[180px]">
              <p className="text-xs text-gray-500 mb-0.5">Today's Status</p>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isClockedIn ? 'bg-green-500' : status?.clockIn ? 'bg-gray-300' : 'bg-red-400'}`} />
                <span className="text-sm font-semibold text-gray-800">
                  {isClockedIn ? 'On Duty' : status?.clockIn ? 'Shifted Out' : 'Not Clocked In'}
                </span>
              </div>
              {status?.clockIn && (
                <p className="text-xs text-gray-400 mt-1">
                  In: {formatTime(status.clockIn)}
                  {status.clockOut && ` · Out: ${formatTime(status.clockOut)}`}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              {!isClockedIn && (
                <button
                  onClick={() => clockInMut.mutate()}
                  disabled={clockInMut.isPending || (!!status?.clockOut)}
                  className="flex items-center gap-1.5 bg-teal-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-teal-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <LogIn size={14} />
                  {clockInMut.isPending ? 'Clocking In…' : 'Clock In'}
                </button>
              )}
              {isClockedIn && (
                <button
                  onClick={() => clockOutMut.mutate()}
                  disabled={clockOutMut.isPending}
                  className="flex items-center gap-1.5 bg-red-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-red-600 transition disabled:opacity-40"
                >
                  <LogOut size={14} />
                  {clockOutMut.isPending ? 'Clocking Out…' : 'Clock Out'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Owner: monthly summary + records */}
        {isOwner && (
          <div className="px-6 py-5">
            {/* Month navigator */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-gray-700">Monthly Overview</p>
              <div className="flex items-center gap-1">
                <button onClick={prevMonth} className="p-1 rounded hover:bg-gray-100 text-gray-400">
                  <ChevronDown size={14} className="rotate-90" />
                </button>
                <span className="text-xs font-medium text-gray-600 w-24 text-center">{MONTH_NAMES[month - 1]} {year}</span>
                <button onClick={nextMonth} disabled={isCurrentMonth} className="p-1 rounded hover:bg-gray-100 text-gray-400 disabled:opacity-30">
                  <ChevronUp size={14} className="rotate-90" />
                </button>
              </div>
            </div>

            {/* Staff summary cards */}
            {summary.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
                {summary.map((s) => (
                  <div key={s.userId} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <p className="text-xs font-semibold text-gray-700 mb-2 truncate">{s.userName}</p>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex-1 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${s.attendancePct >= 80 ? 'bg-teal-500' : s.attendancePct >= 60 ? 'bg-orange-400' : 'bg-red-400'}`}
                          style={{ width: `${s.attendancePct}%` }}
                        />
                      </div>
                      <span className={`text-xs font-bold ${s.attendancePct >= 80 ? 'text-teal-600' : s.attendancePct >= 60 ? 'text-orange-500' : 'text-red-500'}`}>
                        {s.attendancePct}%
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-500">
                      <span>{s.daysPresent}/{s.workingDays} days</span>
                      <span>{s.totalHours}h {s.totalMinutes}m total</span>
                    </div>
                    {s.avgHoursPerDay > 0 && (
                      <p className="text-[10px] text-gray-400 mt-0.5">Avg {s.avgHoursPerDay}h/day</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Detailed records table */}
            {records.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-gray-500 font-medium">Staff</th>
                      <th className="px-4 py-2.5 text-left text-gray-500 font-medium">Date</th>
                      <th className="px-4 py-2.5 text-center text-gray-500 font-medium">Clock In</th>
                      <th className="px-4 py-2.5 text-center text-gray-500 font-medium">Clock Out</th>
                      <th className="px-4 py-2.5 text-right text-gray-500 font-medium">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {records.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-800">{r.userName}</td>
                        <td className="px-4 py-2.5 text-gray-500">{r.date}</td>
                        <td className="px-4 py-2.5 text-center text-gray-700">{formatTime(r.clockIn)}</td>
                        <td className="px-4 py-2.5 text-center">
                          {r.clockOut ? (
                            <span className="text-gray-700">{formatTime(r.clockOut)}</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-teal-600 font-semibold">
                              <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />On duty
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {r.durationMin !== null ? (
                            <span className="text-gray-700">{formatDuration(r.durationMin)}</span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {records.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">No attendance records for this month</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CommissionSection() {
  const qc  = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [payTarget, setPayTarget] = useState<{ userId: string; userName: string; commission: number } | null>(null);
  const [payNote, setPayNote]     = useState('');
  const [payAmount, setPayAmount] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['staff-commissions', month],
    queryFn: () => staffApi.commissions(month),
    staleTime: 60_000,
  });

  const payMutation = useMutation({
    mutationFn: () => staffApi.payCommission({ staffId: payTarget!.userId, month, amount: Number(payAmount), note: payNote || undefined }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['staff-commissions', month] });
      toast.success('Commission de di!');
      setPayTarget(null); setPayNote(''); setPayAmount('');
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const undoMutation = useMutation({
    mutationFn: (staffId: string) => staffApi.deleteCommissionPayment(staffId, month),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['staff-commissions', month] });
      toast.success('Commission payment wapas liya');
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  return (
    <div className="mt-8 pt-6 border-t border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-blue-600" />
          <h2 className="text-sm font-semibold text-gray-900">Commission</h2>
          {data?.commissionRate
            ? <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Shop rate: {data.commissionRate}%</span>
            : <span className="text-xs text-gray-400">(Settings mein rate set karein)</span>
          }
        </div>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
          className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {isLoading ? (
        <div className="space-y-2">{[0, 1].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : !data?.staff.length ? (
        <p className="text-sm text-gray-400 text-center py-4">Is mahine koi payment collection record nahi</p>
      ) : (
        <div className="space-y-2">
          {data.staff.map((row) => (
            <div key={row.userId} className={`rounded-xl border px-4 py-3 ${row.paid ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-gray-100'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900">{row.userName}</p>
                    <span className="text-[10px] text-gray-400">{row.commissionRate}% rate · {row.payments} payments · {pkr(row.collected)} collected</span>
                  </div>
                  <p className="text-lg font-black text-gray-900 mt-0.5">{pkr(row.commission)}</p>
                  {row.paid && (
                    <p className="text-[11px] text-emerald-700 mt-0.5 flex items-center gap-1">
                      <BadgeCheck size={11} />
                      {pkr(row.paid.amount)} diya — {new Date(row.paid.paidAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}
                      {row.paid.note && <span className="text-emerald-600 italic"> · {row.paid.note}</span>}
                    </p>
                  )}
                </div>
                <div className="shrink-0 flex flex-col gap-1.5 items-end">
                  {row.paid ? (
                    <button onClick={() => undoMutation.mutate(row.userId)} disabled={undoMutation.isPending}
                      className="text-[10px] text-gray-400 hover:text-red-500 transition flex items-center gap-1 disabled:opacity-50">
                      <RotateCcw size={9} /> Undo
                    </button>
                  ) : row.commission > 0 ? (
                    <button
                      onClick={() => { setPayTarget(row); setPayAmount(String(row.commission)); }}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition flex items-center gap-1.5">
                      <BadgeCheck size={12} /> De Di
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pay commission modal */}
      {payTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Commission De Dein</h3>
                <p className="text-xs text-gray-400">{payTarget.userName} · {month}</p>
              </div>
              <button onClick={() => setPayTarget(null)} className="text-gray-400 hover:text-gray-600"><XIcon size={16} /></button>
            </div>

            <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
              <p className="text-[10px] text-gray-400 mb-0.5">Calculated commission</p>
              <p className="text-xl font-black text-emerald-700">{pkr(payTarget.commission)}</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Amount paid (PKR) *</label>
              <input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} min="0"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400 transition" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Note (optional)</label>
              <input type="text" value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="e.g. Cash mein diya"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400 transition" />
            </div>

            <div className="flex gap-2">
              <button onClick={() => setPayTarget(null)} className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">Cancel</button>
              <button onClick={() => payMutation.mutate()} disabled={!payAmount || Number(payAmount) <= 0 || payMutation.isPending}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition disabled:opacity-50">
                {payMutation.isPending ? 'Saving…' : 'Record Karein'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SalarySection() {
  const qc  = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [payTarget, setPayTarget] = useState<{ id: string; name: string; monthlySalary: number | null } | null>(null);
  const [payNote, setPayNote]     = useState('');
  const [payAmount, setPayAmount] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['staff-salaries', month],
    queryFn: () => staffApi.salaries(month),
    staleTime: 60_000,
  });

  const payMutation = useMutation({
    mutationFn: () => staffApi.paySalary({ staffId: payTarget!.id, month, amount: Number(payAmount), note: payNote || undefined }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['staff-salaries', month] });
      toast.success('Salary de di!');
      setPayTarget(null); setPayNote(''); setPayAmount('');
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const undoMutation = useMutation({
    mutationFn: (staffId: string) => staffApi.deleteSalaryPayment(staffId, month),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['staff-salaries', month] });
      toast.success('Salary payment wapas liya');
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const totalDue  = data?.staff.reduce((s, r) => s + (r.monthlySalary ?? 0), 0) ?? 0;
  const totalPaid = data?.staff.reduce((s, r) => s + (r.paid?.amount ?? 0), 0) ?? 0;

  return (
    <div className="mt-8 pt-6 border-t border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <DollarSign size={16} className="text-emerald-600" />
          <h2 className="text-sm font-semibold text-gray-900">Salary</h2>
          {totalDue > 0 && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${totalPaid >= totalDue ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              {pkr(totalPaid)} / {pkr(totalDue)}
            </span>
          )}
        </div>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
          className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {isLoading ? (
        <div className="space-y-2">{[0, 1].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : !data?.staff.length ? (
        <p className="text-sm text-gray-400 text-center py-4">Koi staff nahi</p>
      ) : (
        <div className="space-y-2">
          {data.staff.map((row) => (
            <div key={row.id} className={`rounded-xl border px-4 py-3 ${row.paid ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-gray-100'}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{row.name}</p>
                  {row.monthlySalary ? (
                    <p className="text-xs text-gray-400 mt-0.5">Monthly: {pkr(row.monthlySalary)}</p>
                  ) : (
                    <p className="text-xs text-gray-400 mt-0.5 italic">Salary set nahi — Staff card mein edit karein</p>
                  )}
                  {row.paid && (
                    <p className="text-[11px] text-emerald-700 mt-0.5 flex items-center gap-1">
                      <BadgeCheck size={11} />
                      {pkr(row.paid.amount)} diya — {new Date(row.paid.paidAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}
                      {row.paid.note && <span className="italic"> · {row.paid.note}</span>}
                    </p>
                  )}
                </div>
                <div className="shrink-0 flex flex-col gap-1.5 items-end">
                  {row.paid ? (
                    <button onClick={() => undoMutation.mutate(row.id)} disabled={undoMutation.isPending}
                      className="text-[10px] text-gray-400 hover:text-red-500 transition flex items-center gap-1 disabled:opacity-50">
                      <RotateCcw size={9} /> Undo
                    </button>
                  ) : (
                    <button
                      onClick={() => { setPayTarget(row); setPayAmount(row.monthlySalary ? String(row.monthlySalary) : ''); }}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition flex items-center gap-1.5">
                      <BadgeCheck size={12} /> De Dein
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pay salary modal */}
      {payTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Salary De Dein</h3>
                <p className="text-xs text-gray-400">{payTarget.name} · {month}</p>
              </div>
              <button onClick={() => setPayTarget(null)} className="text-gray-400 hover:text-gray-600"><XIcon size={16} /></button>
            </div>

            {payTarget.monthlySalary && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                <p className="text-[10px] text-gray-400 mb-0.5">Monthly salary</p>
                <p className="text-xl font-black text-blue-700">{pkr(payTarget.monthlySalary)}</p>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Amount paid (PKR) *</label>
              <input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} min="0"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 transition" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Note (optional)</label>
              <input type="text" value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="e.g. Bank transfer"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 transition" />
            </div>

            <div className="flex gap-2">
              <button onClick={() => setPayTarget(null)} className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">Cancel</button>
              <button onClick={() => payMutation.mutate()} disabled={!payAmount || Number(payAmount) <= 0 || payMutation.isPending}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition disabled:opacity-50">
                {payMutation.isPending ? 'Saving…' : 'Record Karein'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pkrShort(v: number): string {
  if (v >= 100_000) return `${(v / 100_000).toFixed(v % 100_000 === 0 ? 0 : 1)}L`;
  if (v >= 1_000)   return `${(v / 1_000).toFixed(v % 1_000 === 0 ? 0 : 1)}K`;
  return String(Math.round(v));
}

function fmtDay(d: string | Date) {
  return new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
}

const METHOD_LABEL: Record<string, string> = {
  CASH: 'Cash', BANK: 'Bank', JAZZCASH: 'JazzCash', EASYPAISA: 'EasyPaisa', OTHER: 'Other',
};

const METHOD_COLOR: Record<string, string> = {
  CASH: 'bg-emerald-100 text-emerald-700',
  BANK: 'bg-blue-100 text-blue-700',
  JAZZCASH: 'bg-red-100 text-red-700',
  EASYPAISA: 'bg-green-100 text-green-700',
  OTHER: 'bg-gray-100 text-gray-600',
};

function isoDate(d: Date) {
  const y  = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${dy}`;
}

// ── Collections Section ────────────────────────────────────────────────────────

type Preset = 'today' | 'week' | 'month' | 'custom';

function EntryRow({ entry }: { entry: CollectionEntry }) {
  const isInstallment = entry.type === 'INSTALLMENT';
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${isInstallment ? 'bg-blue-50' : 'bg-amber-50'}`}>
        {isInstallment
          ? <CreditCard size={13} className="text-blue-500" />
          : <ShoppingCart size={13} className="text-amber-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-800 truncate">
          {isInstallment ? entry.customerName : (entry.customerName ?? 'Walk-in')}
        </p>
        <p className="text-[10px] text-gray-400 mt-0.5">
          {isInstallment
            ? (entry.customerPhone || '—')
            : `Cash Sale — ${entry.productName}`}
          {entry.note ? ` · ${entry.note}` : ''}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs font-bold text-gray-900">{pkr(entry.amount)}</p>
        <div className="flex items-center gap-1 justify-end mt-0.5">
          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${METHOD_COLOR[entry.method] ?? METHOD_COLOR.OTHER}`}>
            {METHOD_LABEL[entry.method] ?? entry.method}
          </span>
          <span className="text-[9px] text-gray-400">{fmtDay(entry.date)}</span>
        </div>
      </div>
    </div>
  );
}

function StaffCollectionCard({ row }: { row: { userId: string; userName: string; summary: { installments: { count: number; total: number; cashTotal: number; nonCashTotal: number }; cashSales: { count: number; total: number; cashTotal: number; nonCashTotal: number }; grandTotal: number; needsHandover: number }; entries: CollectionEntry[] } }) {
  const [open, setOpen] = useState(false);
  const { summary } = row;
  const initials = row.userName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
          <span className="text-sm font-bold text-blue-700">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900">{row.userName}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {summary.installments.count > 0 && `${summary.installments.count} payment${summary.installments.count !== 1 ? 's' : ''}`}
            {summary.installments.count > 0 && summary.cashSales.count > 0 && ' · '}
            {summary.cashSales.count > 0 && `${summary.cashSales.count} cash sale${summary.cashSales.count !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-black text-gray-900">{pkrShort(summary.grandTotal)}</p>
          <p className="text-[10px] text-gray-400">Total collected</p>
        </div>
      </div>

      {/* Summary pills */}
      <div className="grid grid-cols-2 gap-2 px-4 pb-3">
        {/* Needs handover */}
        <div className={`rounded-xl px-3 py-2 ${summary.needsHandover > 0 ? 'bg-orange-50 border border-orange-100' : 'bg-gray-50'}`}>
          <div className="flex items-center gap-1.5 mb-0.5">
            <ArrowDownCircle size={11} className={summary.needsHandover > 0 ? 'text-orange-500' : 'text-gray-400'} />
            <p className="text-[10px] font-semibold text-gray-500">Haath Mein Cash</p>
          </div>
          <p className={`text-sm font-black ${summary.needsHandover > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
            {pkrShort(summary.needsHandover)}
          </p>
          <p className="text-[9px] text-gray-400 mt-0.5">Handover dena baqi</p>
        </div>

        {/* Already transferred */}
        {(() => {
          const nonCash = summary.installments.nonCashTotal + summary.cashSales.nonCashTotal;
          return (
            <div className={`rounded-xl px-3 py-2 ${nonCash > 0 ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50'}`}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <Landmark size={11} className={nonCash > 0 ? 'text-blue-500' : 'text-gray-400'} />
                <p className="text-[10px] font-semibold text-gray-500">Bank / Digital</p>
              </div>
              <p className={`text-sm font-black ${nonCash > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                {pkrShort(nonCash)}
              </p>
              <p className="text-[9px] text-gray-400 mt-0.5">Bank mein — handover nahi chahiye</p>
            </div>
          );
        })()}
      </div>

      {/* Expand / collapse */}
      {row.entries.length > 0 && (
        <>
          <button
            onClick={() => setOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 py-2.5 border-t border-gray-50 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition"
          >
            <span>{open ? 'Chhupao' : `${row.entries.length} entries dikhao`}</span>
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {open && (
            <div className="px-4 pb-3">
              {row.entries.map((e) => <EntryRow key={e.id} entry={e} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CollectionsSection() {
  const today     = isoDate(new Date());
  const weekStart = isoDate(new Date(Date.now() - 6 * 86400_000));
  const monthStart = isoDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  const [preset, setPreset]     = useState<Preset>('today');
  const [customFrom, setCustomFrom] = useState(today);
  const [customTo,   setCustomTo]   = useState(today);

  const from = preset === 'today'  ? today
              : preset === 'week'  ? weekStart
              : preset === 'month' ? monthStart
              : customFrom;
  const to   = preset === 'custom' ? customTo : today;

  const { data, isLoading } = useQuery({
    queryKey: ['staff-collections', from, to],
    queryFn:  () => staffApi.collections(from, to),
    staleTime: 60_000,
  });

  const PRESETS: { key: Preset; label: string }[] = [
    { key: 'today', label: 'Aaj' },
    { key: 'week',  label: 'Is Hafta' },
    { key: 'month', label: 'Is Mahine' },
    { key: 'custom', label: 'Custom' },
  ];

  const totalCollected = data?.staff.reduce((s, r) => s + r.summary.grandTotal, 0) ?? 0;
  const totalHandover  = data?.staff.reduce((s, r) => s + r.summary.needsHandover, 0) ?? 0;

  return (
    <div className="mt-8 pt-6 border-t border-gray-100">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart2 size={16} className="text-indigo-600" />
          <h2 className="text-sm font-semibold text-gray-900">Collection Report</h2>
        </div>
        {/* Preset tabs */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPreset(p.key)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                preset === p.key
                  ? 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom date inputs */}
      {preset === 'custom' && (
        <div className="flex gap-2 mb-4">
          <div className="flex-1">
            <label className="block text-[10px] font-semibold text-gray-400 mb-1">From</label>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-400 transition" />
          </div>
          <div className="flex-1">
            <label className="block text-[10px] font-semibold text-gray-400 mb-1">To</label>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-400 transition" />
          </div>
        </div>
      )}

      {/* Summary bar */}
      {!isLoading && (data?.staff.length ?? 0) > 0 && (
        <div className="flex items-center gap-3 mb-4 bg-indigo-50 border border-indigo-100 rounded-2xl px-4 py-3">
          <div className="flex-1">
            <p className="text-[10px] text-indigo-400 font-semibold uppercase tracking-wide">Total Collected</p>
            <p className="text-xl font-black text-indigo-700">{pkr(totalCollected)}</p>
          </div>
          <div className="w-px h-10 bg-indigo-200" />
          <div className="flex-1">
            <p className="text-[10px] text-orange-400 font-semibold uppercase tracking-wide">Haath Mein</p>
            <p className="text-xl font-black text-orange-600">{pkr(totalHandover)}</p>
          </div>
          <div className="w-px h-10 bg-indigo-200" />
          <div className="flex-1">
            <p className="text-[10px] text-blue-400 font-semibold uppercase tracking-wide">Bank/Digital</p>
            <p className="text-xl font-black text-blue-600">{pkr(totalCollected - totalHandover)}</p>
          </div>
        </div>
      )}

      {/* Staff cards */}
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : !data?.staff.length ? (
        <div className="text-center py-8 text-gray-400">
          <BarChart2 size={28} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm font-medium">Is period mein koi collection nahi</p>
          <p className="text-xs mt-0.5">Koi aur date range try karein</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.staff.map((row) => (
            <StaffCollectionCard key={row.userId} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Portfolio Section ─────────────────────────────────────────────────────────

function AssignCustomerModal({
  staff,
  onClose,
}: {
  staff: StaffMember[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [agentId, setAgentId] = useState('');
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [notes, setNotes] = useState('');

  const { data: customers } = useQuery({
    queryKey: ['customers-portfolio-search', customerQuery],
    queryFn: () =>
      fetch(`/api/customers?search=${encodeURIComponent(customerQuery)}&limit=10`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      }).then((r) => r.json()).then((j) => j.data as { data: { id: string; name: string; phone: string }[] }),
    enabled: customerQuery.length > 1,
    staleTime: 10_000,
  });

  const mut = useMutation({
    mutationFn: () => agentPortfolioApi.assign({ customerId, agentId, notes: notes || undefined }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['agent-portfolio'] });
      toast.success('Customer assign ho gaya!');
      onClose();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">Customer Assign Karo</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XIcon size={16} /></button>
        </div>

        {/* Agent select */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">Field Agent *</label>
          <select value={agentId} onChange={(e) => setAgentId(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400">
            <option value="">— Select karo —</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        {/* Customer search */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">Customer *</label>
          <input
            value={customerQuery}
            onChange={(e) => { setCustomerQuery(e.target.value); setCustomerId(''); }}
            placeholder="Naam ya phone se dhundho…"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
          />
          {customers?.data && customers.data.length > 0 && !customerId && (
            <div className="mt-1 border border-gray-200 rounded-xl overflow-hidden shadow-lg">
              {customers.data.map((c) => (
                <button key={c.id} type="button"
                  onClick={() => { setCustomerId(c.id); setCustomerQuery(`${c.name} · ${c.phone}`); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b last:border-b-0">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-gray-400 ml-2">{c.phone}</span>
                </button>
              ))}
            </div>
          )}
          {customerId && (
            <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
              <Check size={11} /> Customer select ho gaya
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">Notes (optional)</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Koi khaas baat…"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
        </div>

        <button
          onClick={() => mut.mutate()}
          disabled={!agentId || !customerId || mut.isPending}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition">
          {mut.isPending ? 'Assigning…' : 'Assign Karo'}
        </button>
      </div>
    </div>
  );
}

function AgentDeductionsModal({
  staffId, staffName, month,
  onClose,
}: {
  staffId: string; staffName: string; month: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [type, setType] = useState<'ADVANCE' | 'DAMAGE' | 'OTHER'>('ADVANCE');
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');

  const { data: deductions = [], isLoading } = useQuery({
    queryKey: ['agent-deductions', staffId, month],
    queryFn: () => agentPortfolioApi.listDeductions(staffId, month),
    staleTime: 30_000,
  });

  const addMut = useMutation({
    mutationFn: () => agentPortfolioApi.addDeduction({
      staffId, month, type, amount: Number(amount), description: desc,
    }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['agent-deductions', staffId, month] });
      void qc.invalidateQueries({ queryKey: ['agent-salary-summary'] });
      toast.success('Deduction add ho gayi');
      setAmount(''); setDesc('');
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => agentPortfolioApi.deleteDeduction(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['agent-deductions', staffId, month] });
      void qc.invalidateQueries({ queryKey: ['agent-salary-summary'] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const total = deductions.reduce((s, d) => s + Number(d.amount), 0);

  const typeLabels: Record<string, string> = {
    UNCOLLECTED: 'Nahi Nikala', ADVANCE: 'Advance', DAMAGE: 'Nuqsan', OTHER: 'Aur',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900">{staffName} ki Deductions</h3>
            <p className="text-xs text-gray-400">{month}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XIcon size={16} /></button>
        </div>

        {total > 0 && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
            <p className="text-xs text-gray-400">Total deductions</p>
            <p className="text-lg font-black text-red-600" style={{ fontFamily: "'Syne', sans-serif" }}>
              − {pkr(total)}
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="h-16 bg-gray-100 rounded-xl animate-pulse" />
        ) : deductions.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-2">Koi deduction nahi</p>
        ) : (
          <div className="space-y-2">
            {deductions.map((d) => (
              <div key={d.id} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-700 truncate">{d.description}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {typeLabels[d.type] ?? d.type}
                    {d.customer_name && <span> · {d.customer_name}</span>}
                  </p>
                </div>
                <span className="text-xs font-black text-red-600 shrink-0" style={{ fontFamily: "'Syne', sans-serif" }}>
                  −{pkr(Number(d.amount))}
                </span>
                <button onClick={() => delMut.mutate(d.id)} disabled={delMut.isPending}
                  className="text-gray-300 hover:text-red-400 transition">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-gray-100 pt-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500">Manual Deduction Add Karo</p>
          <div className="flex gap-2">
            {(['ADVANCE', 'DAMAGE', 'OTHER'] as const).map((t) => (
              <button key={t} onClick={() => setType(t)}
                className={`flex-1 py-1.5 text-[11px] font-semibold rounded-lg border transition ${
                  type === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300'
                }`}>
                {typeLabels[t]}
              </button>
            ))}
          </div>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount (PKR)"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
          <input value={desc} onChange={(e) => setDesc(e.target.value)}
            placeholder="Wajah / description"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
          <button onClick={() => addMut.mutate()}
            disabled={!amount || !desc || addMut.isPending}
            className="w-full py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition">
            {addMut.isPending ? 'Adding…' : '+ Deduction Lagao'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PortfolioSection({ staff }: { staff: StaffMember[] }) {
  const qc = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [view, setView] = useState<'assignments' | 'salary'>('assignments');
  const [filterAgent, setFilterAgent] = useState('');
  const [showAssign, setShowAssign] = useState(false);
  const [deductionTarget, setDeductionTarget] = useState<{ id: string; name: string } | null>(null);

  const { data: portfolio = [], isLoading: loadingPortfolio } = useQuery({
    queryKey: ['agent-portfolio', filterAgent],
    queryFn: () => agentPortfolioApi.list(filterAgent || undefined),
    staleTime: 30_000,
  });

  const { data: salaryData, isLoading: loadingSalary } = useQuery({
    queryKey: ['agent-salary-summary', month],
    queryFn: () => agentPortfolioApi.salarySummary(month),
    staleTime: 30_000,
    enabled: view === 'salary',
  });

  const unassignMut = useMutation({
    mutationFn: (id: string) => agentPortfolioApi.unassign(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['agent-portfolio'] });
      toast.success('Unassign ho gaya');
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const calcMut = useMutation({
    mutationFn: () => agentPortfolioApi.calculateUncollected(month),
    onSuccess: (d) => {
      void qc.invalidateQueries({ queryKey: ['agent-salary-summary', month] });
      toast.success(`${d.created} naye deductions calculate hue`);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  // Group portfolio by agent
  const byAgent = new Map<string, { agentId: string; agentName: string; rows: PortfolioRow[] }>();
  for (const row of portfolio) {
    if (!byAgent.has(row.agent_id)) {
      byAgent.set(row.agent_id, { agentId: row.agent_id, agentName: row.agent_name, rows: [] });
    }
    byAgent.get(row.agent_id)!.rows.push(row);
  }

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      {/* Sub-tabs */}
      <div className="flex gap-1 mb-5">
        {([['assignments', 'Assignments', <UserCheck size={13} />], ['salary', 'Salary Review', <Calculator size={13} />]] as const).map(([key, label, icon]) => (
          <button key={key} onClick={() => setView(key as typeof view)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl border transition ${
              view === key
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300'
            }`}>
            {icon}{label}
          </button>
        ))}
      </div>

      {/* ── ASSIGNMENTS view ── */}
      {view === 'assignments' && (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <select value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm text-gray-600 focus:outline-none focus:border-blue-400">
                <option value="">Sab agents</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <span className="text-xs text-gray-400">{portfolio.length} assignments</span>
            </div>
            <button onClick={() => setShowAssign(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition">
              <UserCheck size={13} /> Assign Karo
            </button>
          </div>

          {loadingPortfolio ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}</div>
          ) : portfolio.length === 0 ? (
            <div className="text-center py-12">
              <Briefcase size={32} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm font-semibold text-gray-500">Koi assignment nahi</p>
              <p className="text-xs text-gray-400 mt-1">Oopar "Assign Karo" button se customer assign karein</p>
            </div>
          ) : (
            <div className="space-y-4">
              {[...byAgent.values()].map((agent) => (
                <div key={agent.agentId} className="rounded-2xl border border-gray-100 overflow-hidden"
                  style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
                  <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-black flex items-center justify-center">
                        {agent.agentName.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-semibold text-gray-800">{agent.agentName}</span>
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                        {agent.rows.length} customer{agent.rows.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {agent.rows.map((row) => (
                      <div key={row.id} className="flex items-center gap-3 px-5 py-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800">{row.customer_name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {row.customer_phone ?? '—'}
                            {row.installment_amount && (
                              <span className="ml-2 text-indigo-600 font-semibold">
                                {pkr(Number(row.installment_amount))}/mo
                              </span>
                            )}
                            {row.installment_status && row.installment_status !== 'ACTIVE' && (
                              <span className="ml-2 text-amber-500">{row.installment_status}</span>
                            )}
                          </p>
                        </div>
                        <button
                          onClick={() => unassignMut.mutate(row.id)}
                          disabled={unassignMut.isPending}
                          className="text-gray-300 hover:text-red-400 transition disabled:opacity-50">
                          <UserMinus size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── SALARY REVIEW view ── */}
      {view === 'salary' && (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calculator size={15} className="text-indigo-600" />
              <h2 className="text-sm font-semibold text-gray-800">Monthly Salary Review</h2>
            </div>
            <div className="flex items-center gap-2">
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button
                onClick={() => calcMut.mutate()}
                disabled={calcMut.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition disabled:opacity-50">
                {calcMut.isPending ? 'Calculate ho raha…' : <><Calculator size={11} /> Auto-Calculate</>}
              </button>
            </div>
          </div>

          <div className="mb-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5 text-xs text-amber-700">
            <strong>Auto-Calculate</strong> — jo agents assigned customers se installment nahi nikaal sake unki salary se wo amount automatically deduct ho jati hai.
          </div>

          {loadingSalary ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}</div>
          ) : !salaryData?.staff.length ? (
            <p className="text-sm text-gray-400 text-center py-8">Koi staff nahi</p>
          ) : (
            <div className="space-y-3">
              {salaryData.staff.map((row) => (
                <div key={row.id} className="rounded-2xl border border-gray-100 px-5 py-4"
                  style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-bold text-gray-900">{row.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {row.portfolioSize} customers assigned
                      </p>
                    </div>
                    <button
                      onClick={() => setDeductionTarget({ id: row.id, name: row.name })}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition">
                      <MinusCircle size={11} /> Deductions
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center bg-gray-50 rounded-xl px-2 py-2">
                      <p className="text-[10px] text-gray-400 mb-0.5">Base Salary</p>
                      <p className="text-sm font-black text-gray-700" style={{ fontFamily: "'Syne', sans-serif" }}>
                        {row.baseSalary > 0 ? pkr(row.baseSalary) : '—'}
                      </p>
                    </div>
                    <div className="text-center bg-red-50 rounded-xl px-2 py-2">
                      <p className="text-[10px] text-gray-400 mb-0.5">Deductions ({row.deductionCount})</p>
                      <p className="text-sm font-black text-red-600" style={{ fontFamily: "'Syne', sans-serif" }}>
                        {row.deductions > 0 ? `−${pkr(row.deductions)}` : '—'}
                      </p>
                    </div>
                    <div className={`text-center rounded-xl px-2 py-2 ${row.netSalary > 0 ? 'bg-emerald-50' : 'bg-gray-50'}`}>
                      <p className="text-[10px] text-gray-400 mb-0.5">Net Salary</p>
                      <p className={`text-sm font-black ${row.netSalary > 0 ? 'text-emerald-700' : 'text-gray-400'}`}
                        style={{ fontFamily: "'Syne', sans-serif" }}>
                        {row.netSalary > 0 ? pkr(row.netSalary) : '—'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showAssign && <AssignCustomerModal staff={staff} onClose={() => setShowAssign(false)} />}
      {deductionTarget && (
        <AgentDeductionsModal
          staffId={deductionTarget.id}
          staffName={deductionTarget.name}
          month={month}
          onClose={() => setDeductionTarget(null)}
        />
      )}
    </div>
  );
}

// ── Staff Briefing ────────────────────────────────────────────────────────────

function SetTargetModal({ staff, currentRow, onClose }: { staff: StaffMember; currentRow?: StaffBriefingRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [daily,   setDaily]   = useState(currentRow?.dailyTarget   ? String(currentRow.dailyTarget)   : '');
  const [monthly, setMonthly] = useState(currentRow?.monthlyTarget ? String(currentRow.monthlyTarget) : '');

  const mutation = useMutation({
    mutationFn: () => staffApi.setTarget(staff.id, {
      daily:   daily   ? Number(daily)   : undefined,
      monthly: monthly ? Number(monthly) : undefined,
    }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['staff-briefing'] });
      toast.success(`${staff.name} ka target set ho gaya`);
      onClose();
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e, 'Target set nahi hua')),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Target Set Karo</h2>
            <p className="text-xs text-gray-400 mt-0.5">{staff.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XIcon size={16} /></button>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Daily Target (PKR)</label>
          <input
            type="number" min="0" value={daily} onChange={(e) => setDaily(e.target.value)}
            placeholder="e.g. 30000"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Monthly Target (PKR)</label>
          <input
            type="number" min="0" value={monthly} onChange={(e) => setMonthly(e.target.value)}
            placeholder="e.g. 600000"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition"
          />
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose}
            className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-1.5">
            {mutation.isPending ? 'Saving…' : <><Check size={14} /> Save Target</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function BriefingCard({ row, staff, onSetTarget }: { row: StaffBriefingRow; staff?: StaffMember; onSetTarget: () => void }) {
  const dailyPct   = row.dailyTarget   > 0 ? Math.min(100, Math.round(row.todayCollected  / row.dailyTarget   * 100)) : null;
  const monthlyPct = row.monthlyTarget > 0 ? Math.min(100, Math.round(row.monthCollected  / row.monthlyTarget * 100)) : null;
  const hitDaily   = dailyPct   !== null && dailyPct   >= 100;
  const hitMonthly = monthlyPct !== null && monthlyPct >= 100;

  const isFrozen = staff?.frozenUntil && new Date(staff.frozenUntil) > new Date();

  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-5 space-y-4 ${isFrozen ? 'border-red-100 opacity-60' : 'border-gray-100'}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-gray-900 text-sm">{row.name}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {row.todayCount} payment{row.todayCount !== 1 ? 's' : ''} aaj · {row.monthCount} is mahine
          </p>
          {isFrozen && <span className="text-[10px] font-bold text-red-500 uppercase tracking-wide">Frozen</span>}
        </div>
        <button
          onClick={onSetTarget}
          className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition"
        >
          <TrendingUp size={11} /> Target
        </button>
      </div>

      {/* Today progress */}
      <div>
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-xs font-semibold text-gray-600">Aaj</span>
          <span className={`text-xs font-bold ${hitDaily ? 'text-emerald-600' : 'text-gray-700'}`}>
            {pkr(row.todayCollected)}{row.dailyTarget > 0 ? ` / ${pkr(row.dailyTarget)}` : ''}
          </span>
        </div>
        {dailyPct !== null ? (
          <>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${hitDaily ? 'bg-emerald-500' : 'bg-blue-500'}`}
                style={{ width: `${dailyPct}%` }}
              />
            </div>
            <p className={`text-[11px] mt-1 font-semibold ${hitDaily ? 'text-emerald-600' : 'text-gray-400'}`}>
              {hitDaily
                ? '✓ Daily target poora!'
                : `${dailyPct}% — ${pkr(row.dailyTarget - row.todayCollected)} baqi`}
            </p>
          </>
        ) : (
          <p className="text-[11px] text-gray-300 italic">Daily target set nahi</p>
        )}
      </div>

      {/* This month progress */}
      <div>
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-xs font-semibold text-gray-600">Is Mahine</span>
          <span className={`text-xs font-bold ${hitMonthly ? 'text-emerald-600' : 'text-gray-700'}`}>
            {pkr(row.monthCollected)}{row.monthlyTarget > 0 ? ` / ${pkr(row.monthlyTarget)}` : ''}
          </span>
        </div>
        {monthlyPct !== null ? (
          <>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${hitMonthly ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                style={{ width: `${monthlyPct}%` }}
              />
            </div>
            <p className={`text-[11px] mt-1 font-semibold ${hitMonthly ? 'text-emerald-600' : 'text-gray-400'}`}>
              {hitMonthly
                ? '✓ Monthly target poora!'
                : `${monthlyPct}% — ${pkr(row.monthlyTarget - row.monthCollected)} baqi`}
            </p>
          </>
        ) : (
          <p className="text-[11px] text-gray-300 italic">Monthly target set nahi</p>
        )}
      </div>
    </div>
  );
}

function BriefingSection({ staff }: { staff: StaffMember[] }) {
  const qc = useQueryClient();
  const [targetStaff, setTargetStaff] = useState<StaffMember | null>(null);

  const { data: briefing = [], isLoading } = useQuery<StaffBriefingRow[]>({
    queryKey: ['staff-briefing'],
    queryFn:  staffApi.getBriefing,
    staleTime: 2 * 60_000,
    refetchInterval: 5 * 60_000,
  });

  const staffMap = new Map(staff.map((s) => [s.id, s]));

  // Aggregate totals
  const totalToday  = briefing.reduce((s, r) => s + r.todayCollected,  0);
  const totalMonth  = briefing.reduce((s, r) => s + r.monthCollected,  0);
  const hitDailyCount   = briefing.filter((r) => r.dailyTarget   > 0 && r.todayCollected  >= r.dailyTarget).length;
  const hitMonthlyCount = briefing.filter((r) => r.monthlyTarget > 0 && r.monthCollected  >= r.monthlyTarget).length;
  const withDailyTarget = briefing.filter((r) => r.dailyTarget > 0).length;
  const withMonthlyTarget = briefing.filter((r) => r.monthlyTarget > 0).length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-bold text-gray-900">Aaj ka Briefing</h2>
          <p className="text-xs text-gray-400 mt-0.5">Har agent ka collection aur target progress</p>
        </div>
        <button
          onClick={() => void qc.invalidateQueries({ queryKey: ['staff-briefing'] })}
          className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition"
        >
          <RotateCcw size={12} /> Refresh
        </button>
      </div>

      {/* Summary strip */}
      {!isLoading && briefing.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Aaj Total', value: pkr(totalToday), color: 'bg-blue-50 border-blue-200 text-blue-700' },
            { label: 'Is Mahine',  value: pkr(totalMonth),  color: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
            { label: 'Daily ✓',   value: `${hitDailyCount}/${withDailyTarget}`,    color: hitDailyCount === withDailyTarget && withDailyTarget > 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-600' },
            { label: 'Monthly ✓', value: `${hitMonthlyCount}/${withMonthlyTarget}`, color: hitMonthlyCount === withMonthlyTarget && withMonthlyTarget > 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className={`rounded-xl border px-4 py-3 ${color}`}>
              <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{label}</p>
              <p className="text-lg font-black mt-0.5 tabular-nums">{value}</p>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => <CardSkeleton key={i} className="h-52" />)}
        </div>
      ) : briefing.length === 0 ? (
        <EmptyState icon={<TrendingUp size={28} />} title="No staff members" description="Add staff to track their daily briefing" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {briefing.map((row) => (
            <BriefingCard
              key={row.id}
              row={row}
              staff={staffMap.get(row.id)}
              onSetTarget={() => setTargetStaff(staffMap.get(row.id) ?? null)}
            />
          ))}
        </div>
      )}

      {targetStaff && (
        <SetTargetModal
          staff={targetStaff}
          currentRow={briefing.find((r) => r.id === targetStaff.id)}
          onClose={() => setTargetStaff(null)}
        />
      )}
    </div>
  );
}

type PageTab = 'team' | 'agent' | 'haazri' | 'finance' | 'collections' | 'portfolio' | 'briefing';

export default function StaffPage() {
  const { user } = useAuthStore();
  const isOwner  = user?.role === 'SELLER_OWNER';
  const [showAdd,    setShowAdd]    = useState(false);
  const [activeTab,  setActiveTab]  = useState<PageTab>('team');

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['staff'],
    queryFn: staffApi.list,
  });

  const { data: balances = [] } = useQuery({
    queryKey: ['handover-balances'],
    queryFn: handoversApi.pendingBalances,
    staleTime: 30_000,
    enabled: isOwner,
  });

  const balanceMap   = new Map(balances.map((b) => [b.staffId, b]));
  const pendingCount = balances.filter((b) => b.pendingHandover).length;

  const tabs: { key: PageTab; label: string; icon: React.ReactNode; ownerOnly?: boolean }[] = [
    { key: 'team',        label: 'Team',       icon: <Shield size={14} /> },
    { key: 'agent',       label: 'Agent',      icon: <Wallet size={14} /> },
    { key: 'haazri',      label: 'Haazri',     icon: <CalendarCheck size={14} /> },
    ...(isOwner ? [
      { key: 'briefing' as PageTab,    label: 'Briefing',   icon: <TrendingUp size={14} />, ownerOnly: true },
      { key: 'finance' as PageTab,     label: 'Finance',    icon: <Banknote size={14} />, ownerOnly: true },
      { key: 'collections' as PageTab, label: 'Collections', icon: <BarChart2 size={14} />, ownerOnly: true },
      { key: 'portfolio' as PageTab,   label: 'Portfolio',  icon: <Briefcase size={14} />, ownerOnly: true },
    ] : []),
  ];

  return (
    <div className="max-w-5xl mx-auto" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" />

      {/* ── Sticky header + tabs ── */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-4 pt-5 pb-0 sm:px-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Staff</h1>
            <p className="text-xs text-gray-400 mt-0.5">{staff.length} member{staff.length !== 1 ? 's' : ''}</p>
          </div>
          {isOwner && activeTab === 'team' && (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 active:scale-95 transition shadow-sm shadow-blue-200"
            >
              <UserPlus size={14} /> Add Staff
            </button>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 overflow-x-auto scrollbar-none -mb-px">
          {tabs.map((t) => {
            const active = activeTab === t.key;
            const hasBadge = t.key === 'agent' && pendingCount > 0;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-all shrink-0 ${
                  active
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-400 hover:text-gray-700'
                }`}
              >
                {t.icon}
                {t.label}
                {hasBadge && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="px-4 py-5 sm:px-6 space-y-5">

        {/* TEAM */}
        {activeTab === 'team' && (
          isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => <CardSkeleton key={i} className="h-64" />)}
            </div>
          ) : staff.length === 0 ? (
            <EmptyState
              icon={<Shield size={32} />}
              title="No staff members yet"
              description={isOwner ? 'Add your first employee to get started' : undefined}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {staff.map((m) => <StaffCard key={m.id} member={m} balance={balanceMap.get(m.id)} />)}
            </div>
          )
        )}

        {/* AGENT — Cash Handover */}
        {activeTab === 'agent' && <HandoversSection />}

        {/* HAAZRI */}
        {activeTab === 'haazri' && <AttendanceSection isOwner={isOwner} />}

        {/* FINANCE */}
        {activeTab === 'finance' && isOwner && (
          <>
            <CommissionSection />
            <SalarySection />
          </>
        )}

        {/* COLLECTIONS */}
        {activeTab === 'collections' && isOwner && <CollectionsSection />}

        {/* PORTFOLIO */}
        {activeTab === 'portfolio' && isOwner && <PortfolioSection staff={staff} />}

        {/* BRIEFING */}
        {activeTab === 'briefing' && isOwner && <BriefingSection staff={staff} />}

      </div>

      {showAdd && <AddStaffModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}
