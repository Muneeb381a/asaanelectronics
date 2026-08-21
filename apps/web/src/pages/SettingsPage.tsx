import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Monitor, Smartphone, Tablet, AlertTriangle, Trash2, LogOut, Shield,
  Users, TrendingUp, Package, BookOpen, Plus, CreditCard, KeyRound, Eye, EyeOff, Target,
  MessageSquare, Pencil, Check, X, Settings, Store, Wallet, Lock, ChevronRight,
  BadgeCheck, Zap,
} from 'lucide-react';
import { sellersApi, type PaymentAccount, type PaymentAccountType } from '../api/sellers.api.ts';
import { whatsappTemplatesApi, type WhatsappTemplate, TEMPLATE_VARS } from '../api/whatsappTemplates.api.ts';
import { authApi } from '../api/auth.api.ts';
import { getErrorMessage } from '../utils/error.ts';
import { fmtDate } from '../utils/dateFormat.ts';
import { sessionsApi, type Session } from '../api/sessions.api.ts';
import { billingApi, type BillingUsage, type UsageStat } from '../api/billing.api.ts';
import { useAuthStore } from '../store/auth.store.ts';
import { useNavigate } from 'react-router-dom';
import { RowSkeleton, BlockSkeleton } from '../components/ui/Skeleton.tsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.tsx';

// ── Form input style ──────────────────────────────────────────────────────────
const inp = 'w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition bg-white placeholder:text-slate-400';

// ── Section card wrapper ──────────────────────────────────────────────────────
function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

function SectionHeader({ icon: Icon, title, subtitle, action }: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-slate-50 rounded-xl flex items-center justify-center shrink-0 ring-1 ring-slate-100">
          <Icon size={15} className="text-slate-600"/>
        </div>
        <div>
          <p className="text-sm font-black text-slate-900">{title}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

// ── Device icon ───────────────────────────────────────────────────────────────
function DeviceIcon({ type }: { type: string | null }) {
  const cls = 'shrink-0 text-slate-400';
  if (type === 'mobile') return <Smartphone size={16} className={cls}/>;
  if (type === 'tablet') return <Tablet      size={16} className={cls}/>;
  return <Monitor size={16} className={cls}/>;
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

// ── Plan badge ────────────────────────────────────────────────────────────────
const PLAN_BADGE: Record<string, string> = {
  TRIAL:      'bg-amber-100 text-amber-700 border-amber-200',
  BASIC:      'bg-blue-100 text-blue-700 border-blue-200',
  PRO:        'bg-purple-100 text-purple-700 border-purple-200',
  ENTERPRISE: 'bg-indigo-100 text-indigo-700 border-indigo-200',
};

// ── Usage bar ─────────────────────────────────────────────────────────────────
function UsageBar({ stat, label, icon: Icon, color }: {
  stat: UsageStat; label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
}) {
  const pct = stat.unlimited ? 30 : stat.pct;
  const barColor =
    stat.unlimited ? 'bg-emerald-400' :
    pct >= 90      ? 'bg-red-400'     :
    pct >= 70      ? 'bg-amber-400'   : color;

  return (
    <div className="flex items-center gap-4">
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-slate-50 ring-1 ring-slate-100`}>
        <Icon size={13} className="text-slate-500"/>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-slate-600">{label}</span>
          <span className="text-xs font-black text-slate-800 tabular-nums">
            {stat.unlimited ? `${stat.used} / ∞` : `${stat.used} / ${stat.limit}`}
          </span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }}/>
        </div>
      </div>
    </div>
  );
}

// ── Toggle switch ─────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
        checked ? 'bg-emerald-500' : 'bg-slate-200'
      }`}
    >
      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`}/>
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// TAB: SHOP INFO + BILLING + MURABAHA
// ──────────────────────────────────────────────────────────────────────────────

function ShopTab({ shop, isLoading, usage }: {
  shop: ReturnType<typeof sellersApi.getMe> extends Promise<infer T> ? T : never | undefined;
  isLoading: boolean;
  usage: BillingUsage | undefined;
}) {
  const qc = useQueryClient();
  const [shopName, setShopName] = useState('');
  const [phone,    setPhone]    = useState('');
  const [address,  setAddress]  = useState('');

  useEffect(() => {
    if (shop) {
      setShopName(shop.shopName);
      setPhone(shop.phone);
      setAddress(shop.address ?? '');
    }
  }, [shop]);

  const mutation = useMutation({
    mutationFn: () => sellersApi.update({ shopName, phone, address: address || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shop-me'] }); toast.success('Shop info save ho gaya'); },
    onError: (e) => toast.error(getErrorMessage(e, 'Save nahi hua')),
  });

  const dirty = shop && (shopName !== shop.shopName || phone !== shop.phone || address !== (shop.address ?? ''));

  const toggleMurabaha = useMutation({
    mutationFn: (val: boolean) => sellersApi.update({ murabahaMode: val }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shop-me'] }); toast.success(shop?.murabahaMode ? 'Murabaha mode band' : 'Murabaha mode chalu'); },
    onError: () => toast.error('Update nahi hua'),
  });

  return (
    <div className="space-y-4">

      {/* Shop info */}
      <SectionCard>
        <SectionHeader icon={Store} title="Shop Information" subtitle="Naam, phone, aur address"/>
        <div className="p-5 space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <BlockSkeleton key={i} className="h-10 rounded-xl"/>)}
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Shop Name</label>
                <input value={shopName} onChange={(e) => setShopName(e.target.value)} className={inp} placeholder="Shop ka naam"/>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Phone Number</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inp} placeholder="03001234567"/>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Address</label>
                <textarea value={address} onChange={(e) => setAddress(e.target.value)}
                  rows={2} className={`${inp} resize-none`} placeholder="Shop address (optional)"/>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={() => mutation.mutate()}
                  disabled={!dirty || mutation.isPending || !shopName || !phone}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-black rounded-xl transition shadow-sm shadow-blue-600/20">
                  {mutation.isPending ? 'Saving…' : 'Save Changes'}
                </button>
                {dirty && (
                  <button onClick={() => { setShopName(shop!.shopName); setPhone(shop!.phone); setAddress(shop!.address ?? ''); }}
                    className="text-sm text-slate-400 hover:text-slate-600 transition font-medium">
                    Discard
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </SectionCard>

      {/* Subscription & Usage */}
      {usage && (
        <SectionCard>
          <SectionHeader icon={BadgeCheck} title="Subscription & Usage" subtitle="Plan, limits, aur expiry"/>
          <div className="p-5 space-y-5">
            {/* Plan row */}
            <div className="flex items-center justify-between">
              <div>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black border ${PLAN_BADGE[usage.plan] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                  {usage.planLabel}
                </span>
                {(usage.trialExpired || usage.planExpired) && (
                  <span className="ml-2 inline-flex px-2.5 py-1 rounded-full text-xs font-black bg-red-100 text-red-600 border border-red-200">
                    Expired
                  </span>
                )}
              </div>
              <div className="text-right">
                {usage.priceMonthly === 0  && <p className="text-xs font-bold text-emerald-600">Free</p>}
                {usage.priceMonthly > 0    && <p className="text-sm font-black text-slate-900">Rs {usage.priceMonthly.toLocaleString()}<span className="text-slate-400 font-normal text-xs">/mo</span></p>}
                {usage.priceMonthly === -1 && <p className="text-xs text-slate-400">Custom pricing</p>}
              </div>
            </div>

            {/* Expiry */}
            {usage.plan === 'TRIAL' && usage.trialEndsAt && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 rounded-xl border border-amber-100">
                <AlertTriangle size={13} className="text-amber-500 shrink-0"/>
                <p className="text-xs text-amber-700">
                  Trial ends: <span className="font-black">{fmtDate(usage.trialEndsAt)}</span>
                  {usage.trialDaysLeft !== null && usage.trialDaysLeft > 0 && (
                    <span className="ml-1">({usage.trialDaysLeft}d left)</span>
                  )}
                </p>
              </div>
            )}
            {usage.plan !== 'TRIAL' && usage.planExpiresAt && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <BadgeCheck size={13} className="text-slate-400 shrink-0"/>
                <p className="text-xs text-slate-600">Plan expires: <span className="font-black">{fmtDate(usage.planExpiresAt)}</span></p>
              </div>
            )}

            {/* Usage bars */}
            <div className="space-y-4 pt-1">
              <UsageBar stat={usage.limits.customers}    label="Customers"    icon={Users}      color="bg-blue-400"/>
              <UsageBar stat={usage.limits.staff}        label="Staff"        icon={Package}    color="bg-violet-400"/>
              <UsageBar stat={usage.limits.installments} label="Installments" icon={TrendingUp} color="bg-emerald-400"/>
            </div>

            <a href="/billing" className="flex items-center justify-between px-4 py-3 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-xl transition group">
              <span className="text-sm font-bold text-blue-700">Manage Billing</span>
              <ChevronRight size={14} className="text-blue-400 group-hover:translate-x-0.5 transition-transform"/>
            </a>
          </div>
        </SectionCard>
      )}

      {/* Murabaha Mode */}
      {shop?.id && (
        <SectionCard>
          <div className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0 ring-1 ring-emerald-100">
                  <BookOpen size={14} className="text-emerald-600"/>
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900">Murabaha Mode</p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-xs">
                    Cost price + profit markup alag alag dikhata hai — Shariah-compliant structure for installment agreements.
                  </p>
                </div>
              </div>
              <Toggle
                checked={shop.murabahaMode ?? false}
                onChange={(v) => toggleMurabaha.mutate(v)}
                disabled={toggleMurabaha.isPending}
              />
            </div>
            {shop.murabahaMode && (
              <div className="mt-4 px-3 py-2.5 bg-emerald-50 border border-emerald-100 rounded-xl">
                <p className="text-xs text-emerald-700 font-medium">
                  Naye installments mein Cash Price + Profit Markup alag alag dikhega.
                </p>
              </div>
            )}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// TAB: TARGETS
// ──────────────────────────────────────────────────────────────────────────────

function TargetsTab({ shop }: { shop: Awaited<ReturnType<typeof sellersApi.getMe>> | undefined }) {
  const qc = useQueryClient();
  const [dailyTarget,    setDailyTarget]    = useState('');
  const [weeklyTarget,   setWeeklyTarget]   = useState('');
  const [monthlyTarget,  setMonthlyTarget]  = useState('');
  const [commissionRate, setCommissionRate] = useState('');
  const [budgets, setBudgets]               = useState<Partial<Record<string, string>>>({});

  useEffect(() => {
    if (shop) {
      setDailyTarget(String(shop.settings?.dailyTarget ?? ''));
      setWeeklyTarget(String(shop.settings?.weeklyTarget ?? ''));
      setMonthlyTarget(String(shop.settings?.monthlyTarget ?? ''));
      setCommissionRate(String(shop.settings?.commissionRate ?? ''));
      const eb = shop.settings?.expenseBudgets ?? {};
      setBudgets(Object.fromEntries(Object.entries(eb).map(([k, v]) => [k, String(v ?? '')])));
    }
  }, [shop]);

  const targetMutation = useMutation({
    mutationFn: () => {
      const expenseBudgets = Object.fromEntries(
        Object.entries(budgets).filter(([, v]) => v && Number(v) > 0).map(([k, v]) => [k, Number(v)])
      ) as Record<string, number>;
      return sellersApi.update({
        settings: {
          dailyTarget:    dailyTarget    ? Number(dailyTarget)    : undefined,
          weeklyTarget:   weeklyTarget   ? Number(weeklyTarget)   : undefined,
          monthlyTarget:  monthlyTarget  ? Number(monthlyTarget)  : undefined,
          commissionRate: commissionRate ? Number(commissionRate) : undefined,
          expenseBudgets: Object.keys(expenseBudgets).length ? expenseBudgets : undefined,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shop-me'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Targets save ho gaye');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Save nahi hua')),
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

  const BUDGET_CATS = [
    { key: 'RENT',        label: 'Kiraya (Rent)' },
    { key: 'SALARY',      label: 'Tankhwa (Salary)' },
    { key: 'UTILITY',     label: 'Bijli / Gas' },
    { key: 'PURCHASE',    label: 'Maal Khareedna' },
    { key: 'MAINTENANCE', label: 'Maintenance' },
    { key: 'TRANSPORT',   label: 'Transport' },
    { key: 'OTHER',       label: 'Other' },
  ] as const;

  return (
    <div className="space-y-4">

      {/* Collection targets */}
      <SectionCard>
        <SectionHeader icon={Target} title="Collection Targets" subtitle="Dashboard pe live progress dikhta hai"/>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Daily',   value: dailyTarget,   set: setDailyTarget,   placeholder: '50,000' },
              { label: 'Weekly',  value: weeklyTarget,  set: setWeeklyTarget,  placeholder: '3,00,000' },
              { label: 'Monthly', value: monthlyTarget, set: setMonthlyTarget, placeholder: '12,00,000' },
            ].map(({ label, value, set, placeholder }) => (
              <div key={label}>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">{label} (PKR)</label>
                <input type="number" value={value} onChange={(e) => set(e.target.value)}
                  placeholder={placeholder} className={inp}/>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-slate-100">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Staff Commission Rate (%)</label>
            <div className="flex items-center gap-3">
              <input type="number" value={commissionRate} onChange={(e) => setCommissionRate(e.target.value)}
                placeholder="e.g. 0.5" step="0.1" min="0" max="100" className={`${inp} max-w-36`}/>
              <p className="text-xs text-slate-400 flex-1">
                {commissionRate && Number(commissionRate) > 0
                  ? `Staff ko har payment ka ${commissionRate}% milta hai`
                  : 'Commission nahi — field sheet mein column nahi dikhega'}
              </p>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Expense budgets */}
      <SectionCard>
        <SectionHeader icon={Wallet} title="Monthly Expense Budgets" subtitle="Category wise monthly limit set karo"/>
        <div className="p-5">
          <p className="text-xs text-slate-400 mb-4">Jab kharcha limit se zyada ho jaega to alerts milenge dashboard pe.</p>
          <div className="grid grid-cols-2 gap-3">
            {BUDGET_CATS.map(({ key, label }) => (
              <div key={key}>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">{label}</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rs</span>
                  <input
                    type="number" value={budgets[key] ?? ''}
                    onChange={(e) => setBudgets((b) => ({ ...b, [key]: e.target.value }))}
                    placeholder="No limit" min="0"
                    className={`${inp} pl-8`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => targetMutation.mutate()}
          disabled={!targetDirty || targetMutation.isPending}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-black rounded-xl transition shadow-sm shadow-blue-600/20">
          {targetMutation.isPending ? 'Saving…' : 'Save Targets'}
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
            className="text-sm text-slate-400 hover:text-slate-600 transition font-medium">
            Discard
          </button>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// TAB: PAYMENT ACCOUNTS
// ──────────────────────────────────────────────────────────────────────────────

const ACCOUNT_TYPES: { value: PaymentAccountType; label: string; bg: string; text: string }[] = [
  { value: 'BANK',      label: 'Bank',      bg: 'bg-blue-50',   text: 'text-blue-700'   },
  { value: 'JAZZCASH',  label: 'JazzCash',  bg: 'bg-red-50',    text: 'text-red-700'    },
  { value: 'EASYPAISA', label: 'EasyPaisa', bg: 'bg-green-50',  text: 'text-green-700'  },
  { value: 'SADAPAY',   label: 'SadaPay',   bg: 'bg-purple-50', text: 'text-purple-700' },
  { value: 'NAYAPAY',   label: 'NayaPay',   bg: 'bg-orange-50', text: 'text-orange-700' },
  { value: 'OTHER',     label: 'Other',     bg: 'bg-slate-50',  text: 'text-slate-600'  },
];

function TypeBadge({ type }: { type: PaymentAccountType }) {
  const t = ACCOUNT_TYPES.find((a) => a.value === type);
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-lg text-[11px] font-black ${t?.bg ?? 'bg-slate-50'} ${t?.text ?? 'text-slate-600'}`}>
      {t?.label ?? type}
    </span>
  );
}

function PaymentsTab({ isOwner }: { isOwner: boolean }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [type,          setType]          = useState<PaymentAccountType>('BANK');
  const [accountTitle,  setAccountTitle]  = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankName,      setBankName]      = useState('');

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
      qc.invalidateQueries({ queryKey: ['payment-accounts'] });
      toast.success('Account add ho gaya');
      setShowForm(false);
      setAccountTitle(''); setAccountNumber(''); setBankName(''); setType('BANK');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Add nahi hua')),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => sellersApi.removePaymentAccount(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payment-accounts'] }); toast.success('Account remove hua'); },
    onError: () => toast.error('Remove nahi hua'),
  });

  const canSubmit = accountTitle.trim() && accountNumber.trim();

  return (
    <div className="space-y-4">
      <SectionCard>
        <SectionHeader
          icon={CreditCard}
          title="Payment Accounts"
          subtitle="Customers ko bills pe ye accounts dikhte hain"
          action={isOwner ? (
            <button
              onClick={() => setShowForm((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-black text-blue-600 hover:text-blue-700 border border-blue-200 hover:bg-blue-50 px-3 py-1.5 rounded-xl transition">
              <Plus size={12}/> Add Account
            </button>
          ) : undefined}
        />

        <div className="p-5 space-y-4">
          {/* Add form */}
          {showForm && isOwner && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Type</label>
                <div className="flex flex-wrap gap-1.5">
                  {ACCOUNT_TYPES.map((t) => (
                    <button key={t.value} onClick={() => setType(t.value)}
                      className={`px-3 py-1.5 text-xs rounded-xl border font-black transition ${
                        type === t.value
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'border-slate-200 text-slate-600 hover:border-blue-300 bg-white'
                      }`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Account Title *</label>
                <input value={accountTitle} onChange={(e) => setAccountTitle(e.target.value)} placeholder="e.g. Muhammad Ali" className={inp}/>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                  {type === 'BANK' ? 'Account Number' : 'Phone Number'} *
                </label>
                <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder={type === 'BANK' ? '0123456789012345' : '03001234567'} className={inp}/>
              </div>
              {type === 'BANK' && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Bank Name</label>
                  <input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. HBL, Meezan, UBL" className={inp}/>
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 text-sm font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-100 transition">
                  Cancel
                </button>
                <button onClick={() => addMutation.mutate()} disabled={!canSubmit || addMutation.isPending}
                  className="flex-1 py-2.5 text-sm font-black text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition disabled:opacity-40 shadow-sm shadow-blue-600/20">
                  {addMutation.isPending ? 'Adding…' : 'Add Account'}
                </button>
              </div>
            </div>
          )}

          {/* List */}
          {isLoading ? (
            <RowSkeleton rows={2}/>
          ) : accounts.length === 0 ? (
            <div className="text-center py-10 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
              <CreditCard size={28} className="mx-auto mb-2 opacity-25"/>
              <p className="text-xs font-medium">Koi payment account nahi</p>
              {isOwner && <p className="text-xs mt-1 opacity-70">Upar "Add Account" dabao</p>}
            </div>
          ) : (
            <div className="space-y-2">
              {accounts.map((acc: PaymentAccount) => (
                <div key={acc.id} className="flex items-center gap-3 px-4 py-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                  <TypeBadge type={acc.type}/>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{acc.accountTitle}</p>
                    <p className="text-xs text-slate-400 truncate tabular-nums">
                      {acc.accountNumber}{acc.bankName && ` · ${acc.bankName}`}
                    </p>
                  </div>
                  {isOwner && (
                    <button
                      onClick={() => setRemoveConfirm({ open: true, id: acc.id })}
                      disabled={removeMutation.isPending}
                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition disabled:opacity-40 shrink-0">
                      <Trash2 size={13}/>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionCard>

      <ConfirmDialog
        open={removeConfirm.open}
        title="Account Remove Karo?"
        description="Ye payment account remove ho jaega aur installment bills mein dikhna band ho jaega."
        confirmLabel="Remove Karo"
        variant="danger"
        isPending={removeMutation.isPending}
        onConfirm={() => { if (removeConfirm.id) removeMutation.mutate(removeConfirm.id); setRemoveConfirm({ open: false, id: null }); }}
        onCancel={() => setRemoveConfirm({ open: false, id: null })}
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// TAB: WHATSAPP TEMPLATES
// ──────────────────────────────────────────────────────────────────────────────

function TemplatesTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId,   setEditId]   = useState<string | null>(null);
  const [name,     setName]     = useState('');
  const [body,     setBody]     = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['whatsapp-templates'],
    queryFn: whatsappTemplatesApi.list,
    staleTime: 60_000,
  });

  function insertVar(v: string) { setBody((b) => b + v); }
  function startEdit(t: WhatsappTemplate) { setEditId(t.id); setName(t.name); setBody(t.body); setShowForm(false); }
  function cancelForm() { setShowForm(false); setEditId(null); setName(''); setBody(''); }

  const createMutation = useMutation({
    mutationFn: () => whatsappTemplatesApi.create({ name: name.trim(), body: body.trim() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['whatsapp-templates'] }); toast.success('Template save hua'); cancelForm(); },
    onError: (e) => toast.error(getErrorMessage(e, 'Save nahi hua')),
  });

  const updateMutation = useMutation({
    mutationFn: () => whatsappTemplatesApi.update(editId!, { name: name.trim(), body: body.trim() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['whatsapp-templates'] }); toast.success('Template update hua'); cancelForm(); },
    onError: (e) => toast.error(getErrorMessage(e, 'Update nahi hua')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => whatsappTemplatesApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['whatsapp-templates'] }); toast.success('Template delete hua'); },
    onError: () => toast.error('Delete nahi hua'),
  });

  const canSubmit = name.trim().length > 0 && body.trim().length > 0;
  const isEditing = editId !== null;

  return (
    <div className="space-y-4">
      <SectionCard>
        <SectionHeader
          icon={MessageSquare}
          title="WhatsApp Templates"
          subtitle="Quick reminder messages with variables"
          action={!showForm && !isEditing ? (
            <button
              onClick={() => { cancelForm(); setShowForm(true); }}
              className="flex items-center gap-1.5 text-xs font-black text-emerald-700 hover:text-emerald-800 border border-emerald-200 hover:bg-emerald-50 px-3 py-1.5 rounded-xl transition">
              <Plus size={12}/> Add Template
            </button>
          ) : undefined}
        />

        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-400">
            Variables jaise <code className="bg-slate-100 px-1.5 py-0.5 rounded-lg text-[10px] font-mono text-slate-700">{'{{customer_name}}'}</code> use karo — WhatsApp reminder mein auto fill honge.
          </p>

          {/* Form */}
          {(showForm || isEditing) && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Template Name *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Overdue Reminder" className={inp}/>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Message Body *</label>
                <textarea
                  value={body} onChange={(e) => setBody(e.target.value)} rows={5}
                  placeholder="Assalam o Alaikum {{customer_name}}! Aapka {{amount_due}} installment due hai..."
                  className={`${inp} resize-none font-mono text-xs leading-relaxed`}
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="text-[10px] text-slate-400 w-full font-semibold">Variable insert karo:</span>
                  {TEMPLATE_VARS.map((v) => (
                    <button key={v.key} type="button" onClick={() => insertVar(v.key)}
                      className="px-2 py-1 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition font-mono font-bold">
                      {v.key}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={cancelForm}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-100 transition">
                  <X size={13}/> Cancel
                </button>
                <button
                  onClick={() => isEditing ? updateMutation.mutate() : createMutation.mutate()}
                  disabled={!canSubmit || createMutation.isPending || updateMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-black text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition disabled:opacity-40 shadow-sm shadow-emerald-600/20">
                  <Check size={13}/>
                  {(createMutation.isPending || updateMutation.isPending) ? 'Saving…' : isEditing ? 'Update' : 'Save Template'}
                </button>
              </div>
            </div>
          )}

          {/* List */}
          {isLoading ? <RowSkeleton rows={2}/> : templates.length === 0 && !showForm ? (
            <div className="text-center py-10 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
              <MessageSquare size={28} className="mx-auto mb-2 opacity-25"/>
              <p className="text-xs font-medium">Koi template nahi</p>
              <p className="text-xs mt-1 opacity-70">Add Template dabao</p>
            </div>
          ) : (
            <div className="space-y-2">
              {templates.map((t: WhatsappTemplate) => (
                <div key={t.id}
                  className={`p-4 border rounded-2xl transition-colors ${
                    editId === t.id ? 'border-emerald-200 bg-emerald-50' : 'border-slate-100 bg-slate-50'
                  }`}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-slate-900">{t.name}</p>
                      <p className="text-xs text-slate-500 mt-1.5 whitespace-pre-wrap break-words font-mono leading-relaxed line-clamp-3">
                        {t.body}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => startEdit(t)} title="Edit"
                        className="p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition">
                        <Pencil size={13}/>
                      </button>
                      <button onClick={() => setDeleteConfirm({ open: true, id: t.id })} title="Delete"
                        disabled={deleteMutation.isPending}
                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition disabled:opacity-40">
                        <Trash2 size={13}/>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionCard>

      <ConfirmDialog
        open={deleteConfirm.open}
        title="Template Delete Karo?"
        description="Ye WhatsApp template permanently delete ho jaega."
        confirmLabel="Delete"
        variant="danger"
        isPending={deleteMutation.isPending}
        onConfirm={() => { if (deleteConfirm.id) deleteMutation.mutate(deleteConfirm.id); setDeleteConfirm({ open: false, id: null }); }}
        onCancel={() => setDeleteConfirm({ open: false, id: null })}
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// TAB: SECURITY (password + sessions)
// ──────────────────────────────────────────────────────────────────────────────

function SecurityTab() {
  const qc = useQueryClient();
  const { clearAuth } = useAuthStore();
  const navigate = useNavigate();

  // Password
  const [current, setCurrent]         = useState('');
  const [next, setNext]               = useState('');
  const [confirm, setConfirm]         = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext]       = useState(false);

  const pwMutation = useMutation({
    mutationFn: () => authApi.changePassword({ currentPassword: current, newPassword: next }),
    onSuccess: () => { toast.success('Password change ho gaya'); setCurrent(''); setNext(''); setConfirm(''); },
    onError: (e) => toast.error(getErrorMessage(e, 'Password change nahi hua')),
  });

  const mismatch  = next.length > 0 && confirm.length > 0 && next !== confirm;
  const canSubmit = current.length > 0 && next.length >= 8 && next === confirm && !pwMutation.isPending;

  // Sessions
  const [revokeAllConfirm, setRevokeAllConfirm] = useState(false);
  const [revokeSessionConfirm, setRevokeSessionConfirm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  const { data: sessions = [], isLoading: sessionsLoading, refetch } = useQuery({
    queryKey: ['sessions'],
    queryFn: sessionsApi.list,
    staleTime: 30_000,
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => sessionsApi.revoke(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sessions'] }); toast.success('Session revoke hua'); },
    onError: () => toast.error('Revoke nahi hua'),
  });

  const revokeAllMutation = useMutation({
    mutationFn: () => sessionsApi.revokeAll(),
    onSuccess: () => {
      toast.success('Tamam sessions revoke — dobara login karo');
      clearAuth();
      localStorage.removeItem('refresh_token');
      void navigate('/login');
    },
    onError: () => toast.error('Failed'),
  });

  const suspiciousCount = sessions.filter((s) => s.isSuspicious).length;

  return (
    <div className="space-y-4">

      {/* Change Password */}
      <SectionCard>
        <SectionHeader icon={KeyRound} title="Password Change Karo" subtitle="Purana daalo, naya set karo"/>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Purana Password</label>
            <div className="relative">
              <input type={showCurrent ? 'text' : 'password'} value={current}
                onChange={(e) => setCurrent(e.target.value)} className={inp} placeholder="Current password"/>
              <button type="button" onClick={() => setShowCurrent((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition p-0.5">
                {showCurrent ? <EyeOff size={14}/> : <Eye size={14}/>}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Naya Password</label>
            <div className="relative">
              <input type={showNext ? 'text' : 'password'} value={next}
                onChange={(e) => setNext(e.target.value)} className={inp} placeholder="Kam se kam 8 characters"/>
              <button type="button" onClick={() => setShowNext((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition p-0.5">
                {showNext ? <EyeOff size={14}/> : <Eye size={14}/>}
              </button>
            </div>
            {next.length > 0 && next.length < 8 && (
              <p className="text-xs text-red-500 mt-1.5 font-medium">Kam se kam 8 characters chahiye</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Confirm Naya Password</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
              className={`${inp} ${mismatch ? 'border-red-300 focus:border-red-400 focus:ring-red-50' : ''}`}
              placeholder="Dobara likhein"/>
            {mismatch && <p className="text-xs text-red-500 mt-1.5 font-medium">Passwords match nahi ho rahe</p>}
          </div>
          <button onClick={() => pwMutation.mutate()} disabled={!canSubmit}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-black rounded-xl transition shadow-sm shadow-blue-600/20">
            {pwMutation.isPending ? 'Saving…' : 'Password Change Karo'}
          </button>
        </div>
      </SectionCard>

      {/* Active Sessions */}
      <SectionCard>
        <SectionHeader
          icon={Shield}
          title={`Active Sessions${sessions.length > 0 ? ` (${sessions.length})` : ''}`}
          subtitle={suspiciousCount > 0 ? `${suspiciousCount} suspicious session detected` : 'Logged-in devices'}
          action={sessions.length > 1 ? (
            <button
              onClick={() => setRevokeAllConfirm(true)}
              disabled={revokeAllMutation.isPending}
              className="flex items-center gap-1.5 text-xs font-black text-red-500 hover:text-red-700 border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-xl transition disabled:opacity-50">
              <LogOut size={12}/> Revoke All
            </button>
          ) : undefined}
        />

        <div className="p-5 space-y-2">
          {suspiciousCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 border border-amber-100 rounded-xl mb-3">
              <AlertTriangle size={13} className="text-amber-500 shrink-0"/>
              <p className="text-xs font-bold text-amber-700">{suspiciousCount} suspicious session{suspiciousCount > 1 ? 's' : ''} detected</p>
            </div>
          )}

          {sessionsLoading ? <RowSkeleton rows={2}/> : sessions.length === 0 ? (
            <div className="text-center py-10 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
              <Shield size={28} className="mx-auto mb-2 opacity-25"/>
              <p className="text-xs font-medium">No active sessions</p>
            </div>
          ) : (
            sessions.map((session: Session) => (
              <div key={session.id}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition ${
                  session.isSuspicious
                    ? 'border-amber-200 bg-amber-50'
                    : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                }`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  session.isSuspicious ? 'bg-amber-100' : 'bg-white ring-1 ring-slate-200'
                }`}>
                  <DeviceIcon type={session.deviceType}/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {session.deviceName ?? 'Unknown device'}
                    </p>
                    {session.isSuspicious && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-black rounded-full">
                        <AlertTriangle size={9}/> Suspicious
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
                    {session.ip ?? 'IP unknown'} · {timeAgo(session.lastActiveAt)} · {fmtDate(session.createdAt)}
                  </p>
                </div>
                <button
                  onClick={() => setRevokeSessionConfirm({ open: true, id: session.id })}
                  disabled={revokeMutation.isPending}
                  className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition disabled:opacity-40 shrink-0">
                  <Trash2 size={13}/>
                </button>
              </div>
            ))
          )}

          <button onClick={() => void refetch()} className="text-xs text-slate-400 hover:text-slate-600 transition font-medium pt-1 block">
            Refresh
          </button>
        </div>
      </SectionCard>

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

// ──────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ──────────────────────────────────────────────────────────────────────────────

type TabKey = 'shop' | 'targets' | 'payments' | 'templates' | 'security';

interface TabDef {
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  ownerOnly?: boolean;
}

const TABS: TabDef[] = [
  { key: 'shop',      label: 'Shop',       icon: Store,          ownerOnly: false },
  { key: 'targets',   label: 'Targets',    icon: Target,         ownerOnly: true  },
  { key: 'payments',  label: 'Payments',   icon: CreditCard,     ownerOnly: false },
  { key: 'templates', label: 'Templates',  icon: MessageSquare,  ownerOnly: true  },
  { key: 'security',  label: 'Security',   icon: Lock,           ownerOnly: false },
];

export default function SettingsPage() {
  const user    = useAuthStore((s) => s.user);
  const isOwner = user?.role === 'SELLER_OWNER';

  const [activeTab, setActiveTab] = useState<TabKey>('shop');

  const { data: shop, isLoading } = useQuery({ queryKey: ['shop-me'], queryFn: sellersApi.getMe });
  const { data: usage } = useQuery({ queryKey: ['billing-usage'], queryFn: billingApi.getUsage, staleTime: 60_000 });

  const visibleTabs = TABS.filter((t) => !t.ownerOnly || isOwner);

  // If current tab became hidden (e.g. non-owner), reset to shop
  useEffect(() => {
    if (!visibleTabs.find((t) => t.key === activeTab)) {
      setActiveTab('shop');
    }
  }, [isOwner]);

  return (
    <>
      {/* ── Dark sticky header ── */}
      <div className="sticky top-0 z-10 bg-slate-950">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-slate-800 rounded-xl flex items-center justify-center ring-1 ring-white/10">
              <Settings size={16} className="text-slate-300"/>
            </div>
            <div>
              <h1 className="text-lg font-black text-white leading-tight">Settings</h1>
              <p className="text-slate-500 text-xs mt-0.5">{shop?.shopName ?? 'Shop configuration'}</p>
            </div>
          </div>

          {/* Tab nav */}
          <div className="flex gap-1 mt-4 overflow-x-auto scrollbar-none pb-0.5">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all shrink-0 ${
                    active
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <Icon size={12} className={active ? 'text-blue-600' : ''}/>
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5">
        {activeTab === 'shop'      && <ShopTab shop={shop as any} isLoading={isLoading} usage={usage}/>}
        {activeTab === 'targets'   && isOwner && <TargetsTab shop={shop as any}/>}
        {activeTab === 'payments'  && <PaymentsTab isOwner={isOwner}/>}
        {activeTab === 'templates' && isOwner && <TemplatesTab/>}
        {activeTab === 'security'  && <SecurityTab/>}
      </div>

      {/* ── Quick links at bottom ── */}
      {activeTab === 'shop' && isOwner && (
        <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Staff',       icon: Users,       to: '/staff',   color: 'text-violet-600 bg-violet-50' },
              { label: 'Billing',     icon: Wallet,      to: '/billing', color: 'text-blue-600 bg-blue-50'     },
              { label: 'Audit Log',   icon: Zap,         to: '/audit',   color: 'text-amber-600 bg-amber-50'   },
              { label: 'Exports',     icon: TrendingUp,  to: '/exports', color: 'text-emerald-600 bg-emerald-50'},
            ].map(({ label, icon: Icon, to, color }) => (
              <a key={to} href={to}
                className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm hover:shadow-md transition group">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color} group-hover:scale-110 transition-transform`}>
                  <Icon size={15}/>
                </div>
                <span className="text-xs font-black text-slate-700">{label}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
