import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Trash2, Shield, Eye, EyeOff } from 'lucide-react';
import { staffApi, PERM_LABELS, type StaffMember, type StaffPermissions } from '../api/staff.api.ts';
import { getErrorMessage } from '../utils/error.ts';
import { useAuthStore } from '../store/auth.store.ts';
import { CardSkeleton, EmptyState } from '../components/ui/Skeleton.tsx';

type StaffType = 'ACCOUNT' | 'AVO' | 'MANAGER' | 'CASHIER' | 'CUSTOM';

const PRESET_PERMS: Record<Exclude<StaffType, 'CUSTOM'>, StaffPermissions> = {
  ACCOUNT: { canAddCustomer: true,  canEditCustomer: true,  canAddInstallment: true,  canRecordPayment: true,  canViewReports: true,  canManageProducts: true,  canVerifyCustomers: false },
  AVO:     { canAddCustomer: false, canEditCustomer: false, canAddInstallment: false, canRecordPayment: false, canViewReports: false, canManageProducts: false, canVerifyCustomers: true  },
  MANAGER: { canAddCustomer: true,  canEditCustomer: true,  canAddInstallment: true,  canRecordPayment: true,  canViewReports: true,  canManageProducts: true,  canVerifyCustomers: true  },
  CASHIER: { canAddCustomer: false, canEditCustomer: false, canAddInstallment: false, canRecordPayment: true,  canViewReports: true,  canManageProducts: false, canVerifyCustomers: false },
};

const DEFAULT_CUSTOM_PERMS: StaffPermissions = {
  canAddCustomer: true, canEditCustomer: true, canAddInstallment: true,
  canRecordPayment: true, canViewReports: true, canManageProducts: true, canVerifyCustomers: false,
};

const STAFF_TYPES: { value: StaffType; label: string; desc: string }[] = [
  { value: 'ACCOUNT', label: 'Account Staff', desc: 'Customers, installments & payments' },
  { value: 'AVO',     label: 'AVO',           desc: 'Area Verification Officer' },
  { value: 'MANAGER', label: 'Manager',       desc: 'Full access to all features' },
  { value: 'CASHIER', label: 'Cashier',       desc: 'Payments & reports only' },
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

        {/* Custom permissions */}
        {staffType === 'CUSTOM' && (
          <div className="mb-4 border border-gray-100 rounded-xl p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Permissions</p>
            {(Object.keys(PERM_LABELS) as (keyof StaffPermissions)[]).map((key) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-xs text-gray-600">{PERM_LABELS[key]}</span>
                <button
                  type="button"
                  onClick={() => setCustomPerms((p) => ({ ...p, [key]: !p[key] }))}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    customPerms[key] ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                    customPerms[key] ? 'translate-x-4.5' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
            ))}
          </div>
        )}

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
  const qc = useQueryClient();
  const perms = member.permissions ?? DEFAULT_CUSTOM_PERMS;
  const value = perms[permKey];

  const { mutate, isPending } = useMutation({
    mutationFn: () => staffApi.updatePermissions(member.id, { [permKey]: !value }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }),
  });

  return (
    <button
      onClick={() => mutate()}
      disabled={isPending}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
        value ? 'bg-blue-600' : 'bg-gray-200'
      } disabled:opacity-60`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
        value ? 'translate-x-4.5' : 'translate-x-0.5'
      }`} />
    </button>
  );
}

function StaffCard({ member }: { member: StaffMember }) {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isOwner = user?.role === 'SELLER_OWNER';
  const perms = member.permissions ?? DEFAULT_CUSTOM_PERMS;
  const staffType = detectStaffType(perms);
  const initials = member.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  const { mutate: remove } = useMutation({
    mutationFn: () => staffApi.remove(member.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }),
  });

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
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
          <button
            onClick={() => { if (confirm(`Remove ${member.name}?`)) remove(); }}
            className="text-gray-300 hover:text-red-500 transition p-1 rounded-lg hover:bg-red-50"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <div className="border-t border-gray-50 pt-3 space-y-2.5">
        <div className="flex items-center gap-1.5 mb-2">
          <Shield size={12} className="text-gray-400" />
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Permissions</p>
        </div>
        {(Object.keys(PERM_LABELS) as (keyof StaffPermissions)[]).map((key) => (
          <div key={key} className="flex items-center justify-between">
            <span className="text-xs text-gray-600">{PERM_LABELS[key]}</span>
            {isOwner ? (
              <PermissionToggle member={member} permKey={key} />
            ) : (
              <span className={`text-xs font-medium ${perms[key] ? 'text-green-600' : 'text-gray-400'}`}>
                {perms[key] ? 'Yes' : 'No'}
              </span>
            )}
          </div>
        ))}
      </div>
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

      {showAdd && <AddStaffModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}
