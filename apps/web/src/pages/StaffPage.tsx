import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Trash2, Shield, Eye, EyeOff, Snowflake, LockOpen, Check, X as XIcon, TrendingUp, Wallet, AlertTriangle, CheckCircle, Clock, ChevronDown, ChevronUp, LogIn, LogOut, CalendarCheck, RotateCcw, Banknote, Percent, DollarSign, Pencil, BadgeCheck, BarChart2, CreditCard, ShoppingCart, ArrowDownCircle, Landmark, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { staffApi, PERM_LABELS, PERM_GROUPS, type StaffMember, type StaffPermissions, type CollectionEntry } from '../api/staff.api.ts';
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

function StaffCard({ member }: { member: StaffMember }) {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isOwner = user?.role === 'SELLER_OWNER';
  const perms = member.permissions ?? DEFAULT_CUSTOM_PERMS;
  const staffType = detectStaffType(perms);
  const initials = member.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const frozen = isMemberFrozen(member);
  const [showFreeze,  setShowFreeze]  = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

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

      {showFreeze   && <FreezeModal member={member} onClose={() => setShowFreeze(false)} />}
      {showProfile  && <ProfileEditModal member={member} onClose={() => setShowProfile(false)} />}

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
    <div className={`rounded-2xl p-4 mb-4 border ${allClear ? 'bg-green-50 border-green-100' : 'bg-amber-50 border-amber-200'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1">Cash in Hand</p>
          <p className={`text-2xl font-bold ${allClear ? 'text-green-700' : 'text-amber-700'}`}>
            {pkr(cashAmt)}
          </p>
          {balance && (
            <p className="text-[11px] text-gray-400 mt-1">
              Collected: {pkr(Number(balance.totalCollected))} &nbsp;·&nbsp; Confirmed: {pkr(Number(balance.totalConfirmed))}
            </p>
          )}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${allClear ? 'bg-green-100' : 'bg-amber-100'}`}>
          <Banknote size={20} className={allClear ? 'text-green-600' : 'text-amber-600'} />
        </div>
      </div>

      {allClear ? (
        <p className="mt-3 text-xs text-green-600 font-medium flex items-center gap-1.5">
          <CheckCircle size={12} /> Sab clear — koi pending cash nahi
        </p>
      ) : pending ? (
        <div className="mt-3 bg-white/70 rounded-xl px-3 py-2.5 border border-amber-200">
          <p className="text-[11px] font-semibold text-amber-700 flex items-center gap-1.5 mb-0.5">
            <Clock size={11} /> Handover pending confirmation
          </p>
          <p className="text-xs text-gray-600">
            {pkr(Number(pending.handedAmount))} submitted on{' '}
            {new Date(pending.createdAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </p>
          {pending.note && <p className="text-[10px] text-gray-400 italic mt-0.5">"{pending.note}"</p>}
          <p className="text-[10px] text-amber-600 mt-1">Owner ka confirmation milne ka wait karo</p>
        </div>
      ) : (
        <button
          onClick={onSubmit}
          className="mt-3 w-full py-2.5 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition flex items-center justify-center gap-2">
          <Wallet size={14} /> Cash Handover Submit Karo
        </button>
      )}
    </div>
  );
}

// ── Owner: all-staff balance grid ─────────────────────────────────────────────
function StaffBalanceGrid({ balances, onSelectStaff }: { balances: StaffBalance[]; onSelectStaff: (id: string) => void }) {
  const nonZero = balances.filter((b) => Number(b.pendingBalance) >= 1);
  if (balances.length === 0) return null;

  return (
    <div className="mb-5">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Staff Cash Balances</p>
      <div className="space-y-2">
        {balances.map((b) => {
          const bal     = Number(b.pendingBalance);
          const allClear = bal < 1;
          return (
            <button
              key={b.staffId}
              onClick={() => onSelectStaff(b.staffId)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition hover:shadow-sm
                         active:scale-[0.98]
                         ${allClear ? 'bg-white border-gray-100 hover:border-gray-200' : 'bg-amber-50 border-amber-200 hover:border-amber-300'}"
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${allClear ? 'bg-gray-100 text-gray-500' : 'bg-amber-100 text-amber-700'}`}>
                {b.staffName.slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{b.staffName}</p>
                {b.pendingHandover ? (
                  <p className="text-[10px] text-amber-600 flex items-center gap-1">
                    <Clock size={9} /> Handover awaiting review
                  </p>
                ) : allClear ? (
                  <p className="text-[10px] text-green-600 flex items-center gap-1">
                    <CheckCircle size={9} /> All clear
                  </p>
                ) : (
                  <p className="text-[10px] text-gray-400">No handover submitted yet</p>
                )}
              </div>
              <span className={`text-sm font-bold shrink-0 ${allClear ? 'text-gray-400' : 'text-amber-700'}`}>
                {pkr(bal)}
              </span>
            </button>
          );
        })}
        {nonZero.length === 0 && (
          <p className="text-xs text-green-600 text-center py-2 flex items-center justify-center gap-1.5">
            <CheckCircle size={12} /> Sab staff ka cash clear hai
          </p>
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

  const [showSubmit,     setShowSubmit]     = useState(false);
  const [confirmTarget,  setConfirmTarget]  = useState<Handover | null>(null);
  const [expanded,       setExpanded]       = useState(false);
  const [filterStaffId,  setFilterStaffId]  = useState<string | undefined>(undefined);

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
    <div className="mt-8 pt-6 border-t border-gray-100">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wallet size={16} className="text-green-600" />
          <h2 className="text-sm font-semibold text-gray-900">Cash Handovers</h2>
          {pending.length > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
              {pending.length} pending
            </span>
          )}
        </div>
        {isStaff && !hasPendingHandover && (
          <button
            onClick={() => setShowSubmit(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-xl transition">
            <Wallet size={12} /> Submit Handover
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
        />
      )}

      {/* ── Filter chip (owner filtered to one staff) ── */}
      {isOwner && filterStaffId && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-gray-500">
            Showing: {allBalances.find((b) => b.staffId === filterStaffId)?.staffName ?? filterStaffId}
          </span>
          <button
            onClick={() => setFilterStaffId(undefined)}
            className="text-[10px] text-blue-500 hover:underline">
            Clear filter
          </button>
        </div>
      )}

      {/* ── Handover list ── */}
      {isLoading ? (
        <RowSkeleton rows={3} />
      ) : handovers.length === 0 ? (
        <div className="text-center py-6 border border-dashed border-gray-200 rounded-xl text-gray-400">
          <Wallet size={22} className="mx-auto mb-1.5 opacity-30" />
          <p className="text-xs">{filterStaffId ? 'Is staff ka koi handover nahi' : 'Koi handover nahi abhi tak'}</p>
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
                <div key={h.id} className={`border rounded-xl p-3 bg-white ${h.status === 'DISPUTED' ? 'border-red-200 bg-red-50/30' : h.status === 'PENDING' ? 'border-amber-200' : 'border-gray-100'}`}>
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isOwner && <p className="text-sm font-semibold text-gray-900">{h.staffName}</p>}
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>
                          {badge.icon} {badge.label}
                        </span>
                        <p className="text-xs text-gray-400">
                          {new Date(h.handoverDate).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-sm font-bold text-gray-900">{pkr(Number(h.handedAmount))}</span>
                        {h.confirmedAmount && (
                          <span className={`text-xs ${shortfall != null && shortfall < 0 ? 'text-red-500' : 'text-green-600'}`}>
                            → confirmed {pkr(Number(h.confirmedAmount))}
                            {shortfall != null && Math.abs(shortfall) >= 1 && (
                              <span className="ml-1">({shortfall < 0 ? '-' : '+'}{pkr(Math.abs(shortfall))})</span>
                            )}
                          </span>
                        )}
                      </div>
                      {h.note && <p className="text-xs text-gray-400 mt-0.5 italic truncate">"{h.note}"</p>}
                      {h.ownerNote && <p className="text-xs text-red-500 mt-0.5 italic truncate">Owner: "{h.ownerNote}"</p>}
                    </div>

                    <div className="flex flex-col gap-1 shrink-0">
                      {/* Owner: review PENDING */}
                      {isOwner && h.status === 'PENDING' && (
                        <button
                          onClick={() => setConfirmTarget(h)}
                          className="px-2.5 py-1 text-xs font-semibold text-green-700 border border-green-200 rounded-lg hover:bg-green-50 transition">
                          Review
                        </button>
                      )}
                      {/* Owner: reopen DISPUTED */}
                      {isOwner && h.status === 'DISPUTED' && (
                        <button
                          onClick={() => reopenMutation.mutate(h.id)}
                          disabled={reopenMutation.isPending}
                          title="Reopen as Pending"
                          className="px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-50 transition flex items-center gap-1 disabled:opacity-50">
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
              className="mt-2 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition">
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {expanded ? 'Kam dikhao' : `${handovers.length - 8} aur dikhao`}
            </button>
          )}
        </>
      )}

      {showSubmit && <SubmitHandoverModal onClose={() => setShowSubmit(false)} />}
      {confirmTarget && <ConfirmHandoverModal handover={confirmTarget} onClose={() => setConfirmTarget(null)} />}
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
  return d.toISOString().slice(0, 10);
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

export default function StaffPage() {
  const { user } = useAuthStore();
  const isOwner = user?.role === 'SELLER_OWNER';
  const [showAdd, setShowAdd] = useState(false);

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['staff'],
    queryFn: staffApi.list,
  });

  return (
    <div className="px-4 py-5 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Staff</h1>
          <p className="text-sm text-gray-400 mt-0.5">{staff.length} member{staff.length !== 1 ? 's' : ''}</p>
        </div>
        {isOwner && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition shadow-sm shadow-blue-200"
          >
            <UserPlus size={15} />
            Add Staff
          </button>
        )}
      </div>

      {isLoading ? (
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
          {staff.map((m) => <StaffCard key={m.id} member={m} />)}
        </div>
      )}

      <HandoversSection />

      <AttendanceSection isOwner={isOwner} />

      {isOwner && <CommissionSection />}

      {isOwner && <SalarySection />}

      {isOwner && <CollectionsSection />}

      {showAdd && <AddStaffModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}
