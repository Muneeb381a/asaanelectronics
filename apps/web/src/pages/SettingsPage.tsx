import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Monitor, Smartphone, Tablet, AlertTriangle, Trash2, LogOut, Shield,
  Users, TrendingUp, BookOpen, Plus, CreditCard, KeyRound, Eye, EyeOff, Target,
  MessageSquare, Pencil, Check, X, Settings, Store, Wallet, Lock, ChevronRight,
  BadgeCheck, Zap, Package, Globe, Save, RotateCcw, Percent, CalendarClock, Sparkles,
} from 'lucide-react';
import { setTimezone as applyTimezone } from '../utils/dateFormat.ts';
import { sellersApi, type PaymentAccount, type PaymentAccountType, type Seller, type SellerSettings } from '../api/sellers.api.ts';
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

/* ─────────────────────────────────────────────────────────────────────────────
   Primitives
──────────────────────────────────────────────────────────────────────────── */

const inp = 'w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition bg-white placeholder:text-slate-400 text-slate-900';
const btnPrimary = 'inline-flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition shadow-sm shadow-blue-600/20';
const btnGhost   = 'inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition';

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm ${className}`}>{children}</section>;
}

function CardHeader({ icon: Icon, tone = 'slate', title, subtitle, action }: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone?: 'slate' | 'blue' | 'emerald' | 'amber' | 'rose' | 'violet' | 'green' | 'purple';
  title: string; subtitle?: string; action?: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-600', blue: 'bg-blue-50 text-blue-600', emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600', rose: 'bg-rose-50 text-rose-500', violet: 'bg-violet-50 text-violet-600',
    green: 'bg-green-50 text-green-600', purple: 'bg-purple-50 text-purple-600',
  };
  return (
    <header className="flex items-center justify-between gap-4 px-5 sm:px-6 py-4 border-b border-slate-100">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${tones[tone]}`}><Icon size={16} /></div>
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-slate-900 leading-tight">{title}</h2>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5 leading-snug">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

function Field({ label, hint, required, children, className = '' }: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-slate-400 mt-1 leading-snug">{hint}</p>}
    </div>
  );
}

function MoneyInput({ value, onChange, placeholder, className = '' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">Rs</span>
      <input type="number" inputMode="numeric" min="0" value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} className={`${inp} pl-9 tabular-nums`} />
    </div>
  );
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button role="switch" aria-checked={checked} onClick={() => onChange(!checked)} disabled={disabled}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-200 disabled:opacity-40 ${checked ? 'bg-emerald-500' : 'bg-slate-200'}`}>
      <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

/** Sticky bar that appears only while a form has unsaved edits. */
function SaveBar({ dirty, pending, onSave, onDiscard, canSave = true }: {
  dirty: boolean; pending: boolean; onSave: () => void; onDiscard: () => void; canSave?: boolean;
}) {
  if (!dirty) return null;
  return (
    <div className="sticky bottom-3 z-10">
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-900 text-white rounded-2xl shadow-xl shadow-slate-900/20 animate-in slide-in-from-bottom-2 fade-in duration-200">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 animate-pulse" />
          <p className="text-sm font-medium truncate">Unsaved changes</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={onDiscard} disabled={pending} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition">
            <RotateCcw size={12} /> Discard
          </button>
          <button onClick={onSave} disabled={pending || !canSave} className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-500 hover:bg-blue-400 disabled:opacity-40 text-white text-xs font-bold rounded-lg transition">
            <Save size={12} /> {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyBox({ icon: Icon, title, hint }: { icon: React.ComponentType<{ size?: number; className?: string }>; title: string; hint?: string }) {
  return (
    <div className="py-12 flex flex-col items-center text-center border-2 border-dashed border-slate-200 rounded-2xl">
      <Icon size={28} className="mb-3 text-slate-300" />
      <p className="text-sm font-semibold text-slate-600">{title}</p>
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'Unknown';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'Active now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function DeviceIcon({ type }: { type: string | null }) {
  if (type === 'mobile') return <Smartphone size={16} />;
  if (type === 'tablet') return <Tablet size={16} />;
  return <Monitor size={16} />;
}

const PLAN_BADGE: Record<string, string> = {
  TRIAL:      'bg-amber-50 border-amber-200 text-amber-700',
  BASIC:      'bg-blue-50 border-blue-200 text-blue-700',
  PRO:        'bg-purple-50 border-purple-200 text-purple-700',
  ENTERPRISE: 'bg-indigo-50 border-indigo-200 text-indigo-700',
};

const TIMEZONES = [
  { value: 'Asia/Karachi',        label: 'Pakistan (PKT, UTC+5)' },
  { value: 'Asia/Kabul',          label: 'Afghanistan (UTC+4:30)' },
  { value: 'Asia/Dubai',          label: 'Gulf (UTC+4)' },
  { value: 'Asia/Riyadh',         label: 'Saudi Arabia (UTC+3)' },
  { value: 'Asia/Calcutta',       label: 'India (UTC+5:30)' },
  { value: 'Europe/London',       label: 'UK (UTC+0/+1)' },
  { value: 'America/New_York',    label: 'US Eastern (UTC-5/-4)' },
  { value: 'America/Los_Angeles', label: 'US Pacific (UTC-8/-7)' },
];

// The API replaces the whole settings JSON, so every partial save must merge into the current value.
function mergeSettings(shop: Seller | undefined, patch: Partial<SellerSettings>): SellerSettings {
  return { ...(shop?.settings ?? {}), ...patch };
}

/* ─────────────────────────────────────────────────────────────────────────────
   Shop tab — info, preferences, quick links
──────────────────────────────────────────────────────────────────────────── */

function ShopInfoCard({ shop, isLoading, onDirty }: { shop: Seller | undefined; isLoading: boolean; onDirty: (d: boolean) => void }) {
  const qc = useQueryClient();
  const [shopName, setShopName] = useState('');
  const [phone,    setPhone]    = useState('');
  const [address,  setAddress]  = useState('');

  const reset = () => { if (shop) { setShopName(shop.shopName); setPhone(shop.phone); setAddress(shop.address ?? ''); } };
  useEffect(reset, [shop]);

  const dirty = !!shop && (shopName !== shop.shopName || phone !== shop.phone || address !== (shop.address ?? ''));
  useEffect(() => onDirty(dirty), [dirty, onDirty]);

  const mutation = useMutation({
    mutationFn: () => sellersApi.update({ shopName: shopName.trim(), phone: phone.trim(), address: address.trim() || undefined }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['shop-me'] }); toast.success('Shop info save ho gaya'); },
    onError: (e) => toast.error(getErrorMessage(e, 'Save nahi hua')),
  });

  return (
    <Card>
      <CardHeader icon={Store} tone="blue" title="Shop Information" subtitle="Bills, receipts aur WhatsApp messages par yehi naam aur number jata hai" />
      <div className="p-5 sm:p-6">
        {isLoading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <BlockSkeleton key={i} className="h-11 rounded-xl" />)}</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Shop Name" required>
                <input value={shopName} onChange={(e) => setShopName(e.target.value)} className={inp} placeholder="e.g. Assaan Electronics" />
              </Field>
              <Field label="Phone Number" required hint="Customers is number par WhatsApp/call karenge">
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inp} placeholder="03001234567" inputMode="tel" />
              </Field>
            </div>
            <Field label="Address" hint="Agreement aur receipt par print hota hai">
              <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className={`${inp} resize-none`} placeholder="Shop address (optional)" />
            </Field>
            <SaveBar dirty={dirty} pending={mutation.isPending} canSave={!!shopName.trim() && !!phone.trim()} onSave={() => mutation.mutate()} onDiscard={reset} />
          </div>
        )}
      </div>
    </Card>
  );
}

function PreferencesCard({ shop }: { shop: Seller | undefined }) {
  const qc = useQueryClient();
  const currentTz = shop?.settings?.timezone ?? 'Asia/Karachi';

  const murabaha = useMutation({
    mutationFn: (val: boolean) => sellersApi.update({ murabahaMode: val }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['shop-me'] }); toast.success('Murabaha mode update hua'); },
    onError: (e) => toast.error(getErrorMessage(e, 'Update nahi hua')),
  });

  const tzMutation = useMutation({
    mutationFn: (tz: string) => sellersApi.update({ settings: mergeSettings(shop, { timezone: tz }) }),
    onSuccess: (_r, tz) => { applyTimezone(tz); void qc.invalidateQueries({ queryKey: ['shop-me'] }); toast.success('Timezone update hua'); },
    onError: (e) => toast.error(getErrorMessage(e, 'Update nahi hua')),
  });

  if (!shop) return null;
  return (
    <Card>
      <CardHeader icon={Sparkles} tone="emerald" title="Preferences" subtitle="Foran apply hote hain — save button ki zaroorat nahi" />
      <div className="divide-y divide-slate-100">
        <div className="flex items-start justify-between gap-6 px-5 sm:px-6 py-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center shrink-0 mt-0.5"><BookOpen size={14} /></div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">Murabaha Mode</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">Cost price aur profit markup alag-alag dikhte hain (Shariah-compliant structure).</p>
            </div>
          </div>
          <Toggle checked={shop.murabahaMode} onChange={(v) => murabaha.mutate(v)} disabled={murabaha.isPending} />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 sm:px-6 py-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-8 h-8 bg-violet-50 text-violet-600 rounded-lg flex items-center justify-center shrink-0 mt-0.5"><Globe size={14} /></div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">Time Zone</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">Tamam dates aur times isi ke hisaab se dikhte hain.</p>
            </div>
          </div>
          <select value={currentTz} disabled={tzMutation.isPending} onChange={(e) => tzMutation.mutate(e.target.value)}
            className={`${inp} sm:w-64`}>
            {TIMEZONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>
    </Card>
  );
}

function QuickLinks() {
  const links = [
    { label: 'Staff & Permissions', desc: 'Employees, roles', icon: Users,      to: '/staff'   },
    { label: 'Billing & Plan',      desc: 'Upgrade, invoices', icon: Wallet,    to: '/billing' },
    { label: 'Audit Log',           desc: 'Kis ne kya kiya',   icon: Zap,       to: '/audit'   },
    { label: 'Exports & Backup',    desc: 'CSV, PDF, backup',  icon: TrendingUp, to: '/exports' },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {links.map(({ label, desc, icon: Icon, to }) => (
        <Link key={to} to={to}
          className="group flex items-center gap-3 p-3.5 bg-white rounded-2xl ring-1 ring-slate-200 hover:ring-blue-300 hover:shadow-sm transition">
          <div className="w-9 h-9 rounded-xl bg-slate-100 group-hover:bg-blue-50 flex items-center justify-center shrink-0 transition">
            <Icon size={15} className="text-slate-500 group-hover:text-blue-600 transition" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-800 truncate">{label}</p>
            <p className="text-[11px] text-slate-400 truncate">{desc}</p>
          </div>
          <ChevronRight size={13} className="text-slate-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition shrink-0" />
        </Link>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Plan tab
──────────────────────────────────────────────────────────────────────────── */

function PlanCard({ usage }: { usage: BillingUsage | undefined }) {
  if (!usage) return <Card><div className="p-6"><RowSkeleton rows={3} /></div></Card>;
  const expired = usage.trialExpired || usage.planExpired;
  const bars = [
    { stat: usage.limits.customers,    label: 'Customers',    icon: Users,      color: 'bg-blue-500'    },
    { stat: usage.limits.staff,        label: 'Staff',        icon: Package,    color: 'bg-violet-500'  },
    { stat: usage.limits.installments, label: 'Installments', icon: TrendingUp, color: 'bg-emerald-500' },
  ] as const;

  return (
    <Card>
      <CardHeader icon={BadgeCheck} tone="purple" title="Plan & Usage" subtitle="Aap ka current plan aur limits"
        action={<Link to="/billing" className={btnPrimary}>Manage billing <ChevronRight size={14} /></Link>} />
      <div className="p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${PLAN_BADGE[usage.plan] ?? 'bg-slate-100 border-slate-200 text-slate-600'}`}>{usage.planLabel}</span>
            {expired && <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-50 border border-red-200 text-red-600">Expired</span>}
          </div>
          <p className="text-sm text-slate-700">
            {usage.priceMonthly === 0  && <span className="font-bold text-emerald-600">Free</span>}
            {usage.priceMonthly > 0    && <><span className="font-bold text-slate-900">Rs {usage.priceMonthly.toLocaleString()}</span><span className="text-xs text-slate-400"> / month</span></>}
            {usage.priceMonthly === -1 && <span className="text-xs text-slate-400">Custom pricing</span>}
          </p>
        </div>

        {usage.plan === 'TRIAL' && usage.trialEndsAt && (
          <div className="flex items-center gap-2.5 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-800">
            <AlertTriangle size={14} className="text-amber-500 shrink-0" />
            <span>Trial ends <b>{fmtDate(usage.trialEndsAt)}</b>{usage.trialDaysLeft !== null && usage.trialDaysLeft > 0 && ` — ${usage.trialDaysLeft} din baqi`}</span>
          </div>
        )}
        {usage.plan !== 'TRIAL' && usage.planExpiresAt && (
          <div className="flex items-center gap-2.5 px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-600">
            <CalendarClock size={14} className="text-slate-400 shrink-0" />
            <span>Plan renews / expires on <b>{fmtDate(usage.planExpiresAt)}</b></span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {bars.map(({ stat, label, icon: Icon, color }) => {
            const s = stat as UsageStat;
            const pct = s.unlimited ? 30 : s.pct;
            const bar = s.unlimited ? 'bg-emerald-400' : pct >= 90 ? 'bg-red-400' : pct >= 70 ? 'bg-amber-400' : color;
            return (
              <div key={label} className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <span className="flex items-center gap-2 text-xs font-semibold text-slate-600"><Icon size={13} className="text-slate-400" />{label}</span>
                  <span className="text-xs font-bold text-slate-800 tabular-nums">{s.used}/{s.unlimited ? '∞' : s.limit}</span>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${bar}`} style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
                {!s.unlimited && pct >= 90 && <p className="text-[11px] text-red-600 mt-2 font-medium">Limit ke qareeb — upgrade karein</p>}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Targets & Rules tab
──────────────────────────────────────────────────────────────────────────── */

const EXPENSE_CATS = [
  { key: 'RENT',        label: 'Kiraya',    sub: 'Rent'        },
  { key: 'SALARY',      label: 'Tankhwa',   sub: 'Salary'      },
  { key: 'UTILITY',     label: 'Bijli/Gas', sub: 'Utility'     },
  { key: 'PURCHASE',    label: 'Maal',      sub: 'Purchase'    },
  { key: 'MAINTENANCE', label: 'Repair',    sub: 'Maintenance' },
  { key: 'TRANSPORT',   label: 'Transport', sub: 'Transport'   },
  { key: 'OTHER',       label: 'Other',     sub: 'Other'       },
] as const;

type TargetsForm = {
  daily: string; weekly: string; monthly: string; commission: string;
  lateFeePerDay: string; lateFeeGrace: string; budgets: Record<string, string>;
};

function fromSettings(s: SellerSettings | null | undefined): TargetsForm {
  const v = (n: number | undefined) => (n === undefined || n === null ? '' : String(n));
  return {
    daily: v(s?.dailyTarget), weekly: v(s?.weeklyTarget), monthly: v(s?.monthlyTarget),
    commission: v(s?.commissionRate), lateFeePerDay: v(s?.lateFeePerDay), lateFeeGrace: v(s?.lateFeeGraceDays),
    budgets: Object.fromEntries(Object.entries(s?.expenseBudgets ?? {}).map(([k, n]) => [k, v(n as number | undefined)])),
  };
}

function TargetsTab({ shop, onDirty }: { shop: Seller | undefined; onDirty: (d: boolean) => void }) {
  const qc = useQueryClient();
  const initial = useMemo(() => fromSettings(shop?.settings), [shop]);
  const [f, setF] = useState<TargetsForm>(initial);
  useEffect(() => setF(initial), [initial]);
  const set = <K extends keyof TargetsForm>(k: K, v: TargetsForm[K]) => setF((p) => ({ ...p, [k]: v }));

  const dirty = !!shop && JSON.stringify(f) !== JSON.stringify(initial);
  useEffect(() => onDirty(dirty), [dirty, onDirty]);

  const mutation = useMutation({
    mutationFn: () => {
      const num = (s: string) => (s.trim() ? Number(s) : undefined);
      const expenseBudgets = Object.fromEntries(Object.entries(f.budgets).filter(([, v]) => v && Number(v) > 0).map(([k, v]) => [k, Number(v)]));
      return sellersApi.update({ settings: mergeSettings(shop, {
        dailyTarget: num(f.daily), weeklyTarget: num(f.weekly), monthlyTarget: num(f.monthly),
        commissionRate: num(f.commission), lateFeePerDay: num(f.lateFeePerDay), lateFeeGraceDays: num(f.lateFeeGrace),
        expenseBudgets: Object.keys(expenseBudgets).length ? expenseBudgets : undefined,
      }) });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['shop-me'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Targets save ho gaye');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Save nahi hua')),
  });

  const lateFee = Number(f.lateFeePerDay) || 0;
  const grace   = Number(f.lateFeeGrace) || 0;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader icon={Target} tone="blue" title="Collection Targets" subtitle="Dashboard par live progress in targets ke against dikhti hai" />
        <div className="p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Daily Target"><MoneyInput value={f.daily} onChange={(v) => set('daily', v)} placeholder="50,000" /></Field>
          <Field label="Weekly Target"><MoneyInput value={f.weekly} onChange={(v) => set('weekly', v)} placeholder="3,00,000" /></Field>
          <Field label="Monthly Target"><MoneyInput value={f.monthly} onChange={(v) => set('monthly', v)} placeholder="12,00,000" /></Field>
        </div>
      </Card>

      <Card>
        <CardHeader icon={Percent} tone="violet" title="Staff Commission" subtitle="Har collected payment par staff ka hissa" />
        <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="relative w-40">
            <input type="number" inputMode="decimal" value={f.commission} onChange={(e) => set('commission', e.target.value)}
              placeholder="0.5" step="0.1" min="0" max="100" className={`${inp} pr-9 tabular-nums`} />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">%</span>
          </div>
          <p className="text-xs text-slate-500 flex-1">
            {f.commission && Number(f.commission) > 0
              ? <>Staff ko har payment ka <b className="text-blue-600">{f.commission}%</b> milega — Field Sheet mein commission column dikhega. Per-staff rate Staff page se override ho sakta hai.</>
              : 'Khaali chhorne par commission off rahega.'}
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader icon={AlertTriangle} tone="amber" title="Late Fee / Jurmana" subtitle="Overdue installments par khud-ba-khud calculate hota hai" />
        <div className="p-5 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Late fee per day" hint="Har overdue din par itni raqam add hogi">
              <MoneyInput value={f.lateFeePerDay} onChange={(v) => set('lateFeePerDay', v)} placeholder="50" />
            </Field>
            <Field label="Grace period (days)" hint="Itne din tak koi fee nahi lagegi">
              <input type="number" inputMode="numeric" min="0" max="30" value={f.lateFeeGrace} onChange={(e) => set('lateFeeGrace', e.target.value)} placeholder="3" className={`${inp} tabular-nums`} />
            </Field>
          </div>
          <div className={`rounded-xl px-4 py-3 text-xs ${lateFee > 0 ? 'bg-amber-50 border border-amber-100 text-amber-800' : 'bg-slate-50 border border-slate-100 text-slate-500'}`}>
            {lateFee > 0
              ? <><b>Example:</b> customer 10 din late ho to fee = <b>Rs {(Math.max(0, 10 - grace) * lateFee).toLocaleString()}</b> ({Math.max(0, 10 - grace)} din × Rs {lateFee}{grace > 0 ? `, ${grace} din grace ke baad` : ''})</>
              : 'Late fee abhi off hai.'}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader icon={Wallet} tone="rose" title="Monthly Expense Budgets" subtitle="Category limit cross hone par Expenses page par warning aati hai" />
        <div className="p-5 sm:p-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {EXPENSE_CATS.map(({ key, label, sub }) => (
            <div key={key} className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5">
              <p className="text-xs font-bold text-slate-700 leading-tight">{label}</p>
              <p className="text-[10px] text-slate-400 mb-2">{sub}</p>
              <MoneyInput value={f.budgets[key] ?? ''} onChange={(v) => set('budgets', { ...f.budgets, [key]: v })} placeholder="No limit" />
            </div>
          ))}
        </div>
      </Card>

      <SaveBar dirty={dirty} pending={mutation.isPending} onSave={() => mutation.mutate()} onDiscard={() => setF(initial)} />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Payment accounts tab
──────────────────────────────────────────────────────────────────────────── */

const ACCOUNT_TYPES: { value: PaymentAccountType; label: string; cls: string }[] = [
  { value: 'BANK',      label: 'Bank',      cls: 'bg-blue-50 text-blue-700'     },
  { value: 'JAZZCASH',  label: 'JazzCash',  cls: 'bg-red-50 text-red-700'       },
  { value: 'EASYPAISA', label: 'EasyPaisa', cls: 'bg-green-50 text-green-700'   },
  { value: 'SADAPAY',   label: 'SadaPay',   cls: 'bg-purple-50 text-purple-700' },
  { value: 'NAYAPAY',   label: 'NayaPay',   cls: 'bg-orange-50 text-orange-700' },
  { value: 'OTHER',     label: 'Other',     cls: 'bg-slate-100 text-slate-600'  },
];

function TypeBadge({ type }: { type: PaymentAccountType }) {
  const t = ACCOUNT_TYPES.find((a) => a.value === type);
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold ${t?.cls ?? 'bg-slate-100 text-slate-600'}`}>{t?.label ?? type}</span>;
}

function PaymentsTab({ isOwner }: { isOwner: boolean }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [type, setType] = useState<PaymentAccountType>('BANK');
  const [accountTitle, setAccountTitle] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankName, setBankName] = useState('');

  const { data: accounts = [], isLoading } = useQuery({ queryKey: ['payment-accounts'], queryFn: sellersApi.listPaymentAccounts });

  const resetForm = () => { setShowForm(false); setAccountTitle(''); setAccountNumber(''); setBankName(''); setType('BANK'); };

  const addMutation = useMutation({
    mutationFn: () => sellersApi.addPaymentAccount({ type, accountTitle: accountTitle.trim(), accountNumber: accountNumber.trim(), bankName: type === 'BANK' && bankName.trim() ? bankName.trim() : undefined }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['payment-accounts'] }); toast.success('Account add ho gaya'); resetForm(); },
    onError: (e) => toast.error(getErrorMessage(e, 'Add nahi hua')),
  });
  const removeMutation = useMutation({
    mutationFn: (id: string) => sellersApi.removePaymentAccount(id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['payment-accounts'] }); toast.success('Account remove ho gaya'); },
    onError: (e) => toast.error(getErrorMessage(e, 'Remove nahi hua')),
    onSettled: () => setRemoveId(null),
  });

  const canSubmit = !!accountTitle.trim() && !!accountNumber.trim();

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader icon={CreditCard} tone="blue" title="Payment Accounts" subtitle="Ye accounts customer ke bill aur payment link par dikhte hain"
          action={isOwner && !showForm && <button onClick={() => setShowForm(true)} className={btnPrimary}><Plus size={13} /> Add account</button>} />
        <div className="p-5 sm:p-6 space-y-4">
          {showForm && isOwner && (
            <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
              <Field label="Account type">
                <div className="flex flex-wrap gap-2">
                  {ACCOUNT_TYPES.map((t) => (
                    <button key={t.value} onClick={() => setType(t.value)}
                      className={`px-3.5 py-1.5 text-xs rounded-xl border font-bold transition ${type === t.value ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:border-blue-300 bg-white'}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Account title" required>
                  <input value={accountTitle} onChange={(e) => setAccountTitle(e.target.value)} placeholder="e.g. Muhammad Ali" className={inp} />
                </Field>
                <Field label={type === 'BANK' ? 'Account / IBAN number' : 'Wallet phone number'} required>
                  <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder={type === 'BANK' ? 'PK00XXXX0000000000000000' : '03001234567'} className={`${inp} tabular-nums`} />
                </Field>
              </div>
              {type === 'BANK' && (
                <Field label="Bank name" className="sm:max-w-xs">
                  <input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. HBL, Meezan, UBL" className={inp} />
                </Field>
              )}
              <div className="flex gap-2.5 pt-1">
                <button onClick={resetForm} className={btnGhost}>Cancel</button>
                <button onClick={() => addMutation.mutate()} disabled={!canSubmit || addMutation.isPending} className={btnPrimary}>
                  {addMutation.isPending ? 'Adding…' : 'Add account'}
                </button>
              </div>
            </div>
          )}

          {isLoading ? <RowSkeleton rows={2} /> : accounts.length === 0 ? (
            <EmptyBox icon={CreditCard} title="Koi payment account nahi" hint={isOwner ? 'Bank ya wallet add karein taake customer bill par dikhe' : 'Owner ne abhi koi account add nahi kiya'} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {accounts.map((acc: PaymentAccount) => (
                <div key={acc.id} className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <TypeBadge type={acc.type} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{acc.accountTitle}</p>
                    <p className="text-xs text-slate-500 truncate tabular-nums">{acc.accountNumber}{acc.bankName && ` · ${acc.bankName}`}</p>
                  </div>
                  {isOwner && (
                    <button onClick={() => setRemoveId(acc.id)} disabled={removeMutation.isPending} title="Remove"
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition disabled:opacity-40 shrink-0">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <ConfirmDialog open={!!removeId} title="Account remove karein?" description="Ye account customer bills aur payment links se hat jayega."
        confirmLabel="Remove" isPending={removeMutation.isPending}
        onConfirm={() => { if (removeId) removeMutation.mutate(removeId); }} onCancel={() => setRemoveId(null)} />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   WhatsApp templates tab
──────────────────────────────────────────────────────────────────────────── */

function TemplatesTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: templates = [], isLoading } = useQuery({ queryKey: ['whatsapp-templates'], queryFn: whatsappTemplatesApi.list, staleTime: 60_000 });

  const startEdit = (t: WhatsappTemplate) => { setEditId(t.id); setName(t.name); setBody(t.body); setShowForm(true); };
  const cancelForm = () => { setShowForm(false); setEditId(null); setName(''); setBody(''); };
  const done = (msg: string) => { void qc.invalidateQueries({ queryKey: ['whatsapp-templates'] }); toast.success(msg); cancelForm(); };

  const createMutation = useMutation({ mutationFn: () => whatsappTemplatesApi.create({ name: name.trim(), body: body.trim() }), onSuccess: () => done('Template save ho gaya'), onError: (e) => toast.error(getErrorMessage(e, 'Save nahi hua')) });
  const updateMutation = useMutation({ mutationFn: () => whatsappTemplatesApi.update(editId!, { name: name.trim(), body: body.trim() }), onSuccess: () => done('Template update ho gaya'), onError: (e) => toast.error(getErrorMessage(e, 'Update nahi hua')) });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => whatsappTemplatesApi.remove(id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['whatsapp-templates'] }); toast.success('Template delete ho gaya'); },
    onError: (e) => toast.error(getErrorMessage(e, 'Delete nahi hua')),
    onSettled: () => setDeleteId(null),
  });

  const canSubmit = name.trim().length > 0 && body.trim().length > 0;
  const isEditing = editId !== null;
  const preview = body
    .replace(/\{\{customer_name\}\}/g, 'Ahmed Khan').replace(/\{\{shop_name\}\}/g, 'Assaan Electronics')
    .replace(/\{\{product_name\}\}/g, 'Samsung A15').replace(/\{\{amount_due\}\}/g, '5,000')
    .replace(/\{\{remaining_balance\}\}/g, '25,000').replace(/\{\{days_overdue\}\}/g, '7').replace(/\{\{phone\}\}/g, '0300 1234567');

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader icon={MessageSquare} tone="green" title="WhatsApp Templates" subtitle="Reminder bhejte waqt variables khud fill ho jate hain"
          action={!showForm && <button onClick={() => { cancelForm(); setShowForm(true); }} className={`${btnPrimary} bg-green-600 hover:bg-green-700 shadow-green-600/20`}><Plus size={13} /> New template</button>} />
        <div className="p-5 sm:p-6 space-y-4">
          {showForm && (
            <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">{isEditing ? 'Template edit' : 'New template'}</p>
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                <div className="lg:col-span-3 space-y-3">
                  <Field label="Name" required>
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Overdue Reminder" className={inp} />
                  </Field>
                  <Field label="Message" required hint="Variable par click karein to message mein add ho jayega">
                    <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5}
                      placeholder={'Assalam o Alaikum {{customer_name}}! Aap ki {{amount_due}} ki qist due hai...'}
                      className={`${inp} resize-none text-sm leading-relaxed`} />
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {TEMPLATE_VARS.map((v) => (
                        <button key={v.key} type="button" onClick={() => setBody((b) => `${b}${b && !b.endsWith(' ') ? ' ' : ''}${v.key}`)} title={v.label}
                          className="px-2 py-1 text-[11px] bg-white text-green-700 border border-green-200 rounded-lg font-mono hover:bg-green-50 transition">
                          {v.key}
                        </button>
                      ))}
                    </div>
                  </Field>
                </div>
                <div className="lg:col-span-2">
                  <p className="text-xs font-semibold text-slate-600 mb-1.5">Preview</p>
                  <div className="bg-[#e5ddd5] rounded-2xl p-3 min-h-[160px]">
                    <div className="bg-white rounded-xl rounded-tl-sm px-3 py-2 text-[13px] text-slate-800 whitespace-pre-wrap break-words shadow-sm leading-relaxed">
                      {preview || <span className="text-slate-400">Message yahan dikhega…</span>}
                      <span className="block text-[10px] text-slate-400 text-right mt-1">10:30 ✓✓</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-2.5">
                <button onClick={cancelForm} className={btnGhost}><X size={13} /> Cancel</button>
                <button onClick={() => (isEditing ? updateMutation.mutate() : createMutation.mutate())} disabled={!canSubmit || createMutation.isPending || updateMutation.isPending}
                  className={`${btnPrimary} bg-green-600 hover:bg-green-700 shadow-green-600/20`}>
                  <Check size={13} /> {(createMutation.isPending || updateMutation.isPending) ? 'Saving…' : isEditing ? 'Update' : 'Save template'}
                </button>
              </div>
            </div>
          )}

          {isLoading ? <RowSkeleton rows={2} /> : templates.length === 0 && !showForm ? (
            <EmptyBox icon={MessageSquare} title="Koi template nahi" hint="Ek reminder template banayein — Installments page se ek click mein bhejein" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {templates.map((t: WhatsappTemplate) => (
                <div key={t.id} className={`p-4 rounded-2xl border transition ${editId === t.id ? 'border-green-300 bg-green-50' : 'border-slate-100 bg-slate-50'}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm font-semibold text-slate-900 truncate">{t.name}</p>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => startEdit(t)} title="Edit" className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"><Pencil size={12} /></button>
                      <button onClick={() => setDeleteId(t.id)} title="Delete" disabled={deleteMutation.isPending} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition disabled:opacity-40"><Trash2 size={12} /></button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-3 whitespace-pre-wrap break-words">{t.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <ConfirmDialog open={!!deleteId} title="Template delete karein?" description="Ye WhatsApp template permanently delete ho jayega."
        confirmLabel="Delete" isPending={deleteMutation.isPending}
        onConfirm={() => { if (deleteId) deleteMutation.mutate(deleteId); }} onCancel={() => setDeleteId(null)} />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Security tab
──────────────────────────────────────────────────────────────────────────── */

function PasswordStrength({ value }: { value: string }) {
  const score = [value.length >= 8, /[A-Z]/.test(value), /[0-9]/.test(value), /[^A-Za-z0-9]/.test(value)].filter(Boolean).length;
  if (!value) return null;
  const labels = ['Bahut kamzor', 'Kamzor', 'Theek', 'Acha', 'Mazboot'];
  const colors = ['bg-red-400', 'bg-red-400', 'bg-amber-400', 'bg-emerald-400', 'bg-emerald-500'];
  return (
    <div className="mt-2">
      <div className="flex gap-1">{[0, 1, 2, 3].map((i) => <div key={i} className={`h-1 flex-1 rounded-full ${i < score ? colors[score] : 'bg-slate-200'}`} />)}</div>
      <p className="text-[11px] text-slate-400 mt-1">{labels[score]}{score < 3 && ' — capital letter, number aur symbol add karein'}</p>
    </div>
  );
}

function SecurityTab() {
  const qc = useQueryClient();
  const { clearAuth } = useAuthStore();
  const navigate = useNavigate();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);

  const pwMutation = useMutation({
    mutationFn: () => authApi.changePassword({ currentPassword: current, newPassword: next }),
    onSuccess: () => { toast.success('Password change ho gaya — baqi devices logout ho gaye'); setCurrent(''); setNext(''); setConfirm(''); void qc.invalidateQueries({ queryKey: ['sessions'] }); },
    onError: (e) => toast.error(getErrorMessage(e, 'Password change nahi hua')),
  });
  const mismatch = next.length > 0 && confirm.length > 0 && next !== confirm;
  const canSubmit = current.length > 0 && next.length >= 8 && next === confirm && !pwMutation.isPending;

  const [revokeAllConfirm, setRevokeAllConfirm] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const { data: sessions = [], isLoading: sessionsLoading, refetch, isFetching } = useQuery({ queryKey: ['sessions'], queryFn: sessionsApi.list, staleTime: 30_000 });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => sessionsApi.revoke(id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['sessions'] }); toast.success('Device logout ho gaya'); },
    onError: (e) => toast.error(getErrorMessage(e, 'Revoke nahi hua')),
    onSettled: () => setRevokeId(null),
  });
  const revokeAllMutation = useMutation({
    mutationFn: () => sessionsApi.revokeAll(),
    onSuccess: () => { toast.success('Tamam devices logout — dobara login karein'); clearAuth(); localStorage.removeItem('refresh_token'); void navigate('/login'); },
    onError: (e) => toast.error(getErrorMessage(e, 'Revoke nahi hua')),
  });

  const suspicious = sessions.filter((s: Session) => s.isSuspicious).length;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader icon={KeyRound} tone="slate" title="Change Password" subtitle="Kam az kam 8 characters; change ke baad doosre devices logout ho jate hain" />
        <div className="p-5 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Current password">
              <input type={showPw ? 'text' : 'password'} value={current} onChange={(e) => setCurrent(e.target.value)} className={inp} placeholder="••••••••" autoComplete="current-password" />
            </Field>
            <Field label="New password">
              <input type={showPw ? 'text' : 'password'} value={next} onChange={(e) => setNext(e.target.value)} className={inp} placeholder="Min 8 characters" autoComplete="new-password" />
              <PasswordStrength value={next} />
            </Field>
            <Field label="Confirm new password">
              <input type={showPw ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)}
                className={`${inp} ${mismatch ? 'border-red-300 focus:border-red-400 focus:ring-red-50' : ''}`} placeholder="Dobara likhein" autoComplete="new-password" />
              {mismatch && <p className="text-xs text-red-500 mt-1.5">Match nahi ho raha</p>}
            </Field>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={() => pwMutation.mutate()} disabled={!canSubmit} className={btnPrimary}>{pwMutation.isPending ? 'Saving…' : 'Change password'}</button>
            <button type="button" onClick={() => setShowPw((v) => !v)} className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition">
              {showPw ? <EyeOff size={13} /> : <Eye size={13} />} {showPw ? 'Hide' : 'Show'} passwords
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader icon={Shield} tone={suspicious > 0 ? 'amber' : 'slate'} title={`Logged-in Devices${sessions.length ? ` (${sessions.length})` : ''}`}
          subtitle={suspicious > 0 ? `${suspicious} suspicious session — foran check karein` : 'Jahan jahan aap ka account khula hua hai'}
          action={sessions.length > 1 && (
            <button onClick={() => setRevokeAllConfirm(true)} disabled={revokeAllMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-xl transition border border-red-200 disabled:opacity-50">
              <LogOut size={12} /> Logout all
            </button>
          )} />
        <div className="p-5 sm:p-6 space-y-3">
          {sessionsLoading ? <RowSkeleton rows={3} /> : sessions.length === 0 ? (
            <EmptyBox icon={Shield} title="Koi active session nahi" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sessions.map((s: Session) => (
                <div key={s.id} className={`flex items-center gap-3 p-4 rounded-2xl border ${s.isSuspicious ? 'border-amber-200 bg-amber-50' : 'border-slate-100 bg-slate-50'}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.isSuspicious ? 'bg-amber-100 text-amber-600' : 'bg-white ring-1 ring-slate-200 text-slate-500'}`}>
                    <DeviceIcon type={s.deviceType} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-semibold text-slate-900 truncate">{s.deviceName ?? 'Unknown device'}</p>
                      {s.isSuspicious && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded"><AlertTriangle size={9} /> Suspicious</span>}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">{s.ip ?? 'IP unknown'} · {timeAgo(s.lastActiveAt)} · since {fmtDate(s.createdAt)}</p>
                  </div>
                  <button onClick={() => setRevokeId(s.id)} disabled={revokeMutation.isPending} title="Logout this device"
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition disabled:opacity-40 shrink-0">
                    <LogOut size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => void refetch()} disabled={isFetching} className="text-xs text-slate-500 hover:text-slate-800 transition disabled:opacity-50">
            {isFetching ? 'Refreshing…' : '↻ Refresh list'}
          </button>
        </div>
      </Card>

      <ConfirmDialog open={revokeAllConfirm} title="Sab devices logout karein?" description="Aap is device samet har jagah se logout ho jayenge aur dobara login karna hoga."
        confirmLabel="Logout all" isPending={revokeAllMutation.isPending}
        onConfirm={() => { revokeAllMutation.mutate(); setRevokeAllConfirm(false); }} onCancel={() => setRevokeAllConfirm(false)} />
      <ConfirmDialog open={!!revokeId} title="Is device ko logout karein?" description="Us device par session khatam ho jayega."
        confirmLabel="Logout" isPending={revokeMutation.isPending}
        onConfirm={() => { if (revokeId) revokeMutation.mutate(revokeId); }} onCancel={() => setRevokeId(null)} />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Page shell
──────────────────────────────────────────────────────────────────────────── */

type TabKey = 'shop' | 'plan' | 'targets' | 'payments' | 'templates' | 'security';

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ size?: number; className?: string }>; ownerOnly?: boolean }[] = [
  { key: 'shop',      label: 'Shop',             icon: Store                          },
  { key: 'plan',      label: 'Plan & Usage',     icon: BadgeCheck                     },
  { key: 'targets',   label: 'Targets & Rules',  icon: Target,        ownerOnly: true },
  { key: 'payments',  label: 'Payment Accounts', icon: CreditCard                     },
  { key: 'templates', label: 'WhatsApp',         icon: MessageSquare, ownerOnly: true },
  { key: 'security',  label: 'Security',         icon: Lock                           },
];

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.role === 'SELLER_OWNER';
  const initials = user?.name?.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() ?? '?';

  const [active, setActive] = useState<TabKey>('shop');
  const [dirty, setDirtyMap] = useState<Partial<Record<TabKey, boolean>>>({});
  const markDirty = useMemo(() => ({
    shop:    (d: boolean) => setDirtyMap((m) => (m.shop === d ? m : { ...m, shop: d })),
    targets: (d: boolean) => setDirtyMap((m) => (m.targets === d ? m : { ...m, targets: d })),
  }), []);

  const { data: shop, isLoading } = useQuery({ queryKey: ['shop-me'], queryFn: sellersApi.getMe });
  const { data: usage } = useQuery({ queryKey: ['billing-usage'], queryFn: billingApi.getUsage, staleTime: 60_000 });

  const tabs = TABS.filter((t) => !t.ownerOnly || isOwner);
  useEffect(() => { if (!tabs.find((t) => t.key === active)) setActive('shop'); }, [isOwner]); // eslint-disable-line react-hooks/exhaustive-deps

  // Warn before the browser closes with unsaved edits.
  const anyDirty = Object.values(dirty).some(Boolean);
  useEffect(() => {
    if (!anyDirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [anyDirty]);

  return (
    <div className="flex flex-col min-h-full bg-[#F4F6FA]">
      {/* Header */}
      <div className="bg-slate-950 border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center shrink-0"><Settings size={16} className="text-white" /></div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-white leading-tight">Settings</h1>
            <p className="text-[11px] text-slate-400 leading-tight truncate">{shop?.shopName ?? 'Loading…'}{usage && <> · <span className="text-slate-300">{usage.planLabel}</span></>}</p>
          </div>
          <div className="hidden sm:flex items-center gap-2.5 shrink-0 px-3 py-1.5 bg-white/5 rounded-xl border border-white/10">
            <div className="w-6 h-6 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-bold">{initials}</div>
            <p className="text-xs font-medium text-slate-300">{user?.name}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200">
        <nav className="max-w-5xl mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto scrollbar-none" aria-label="Settings sections">
          {tabs.map((t) => {
            const Icon = t.icon; const isActive = active === t.key; const isDirty = !!dirty[t.key];
            return (
              <button key={t.key} onClick={() => setActive(t.key)} aria-current={isActive ? 'page' : undefined}
                className={`relative flex items-center gap-2 px-3.5 py-3.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition ${
                  isActive ? 'text-blue-600 border-blue-600' : 'text-slate-500 border-transparent hover:text-slate-800 hover:border-slate-300'
                }`}>
                <Icon size={15} />
                {t.label}
                {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Unsaved changes" />}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content — every tab stays mounted so edits survive switching */}
      <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-5 sm:py-8">
        <div hidden={active !== 'shop'} className="space-y-5">
          <ShopInfoCard shop={shop} isLoading={isLoading} onDirty={markDirty.shop} />
          <PreferencesCard shop={shop} />
          {isOwner && <QuickLinks />}
        </div>
        <div hidden={active !== 'plan'}><PlanCard usage={usage} /></div>
        {isOwner && <div hidden={active !== 'targets'}><TargetsTab shop={shop} onDirty={markDirty.targets} /></div>}
        <div hidden={active !== 'payments'}><PaymentsTab isOwner={isOwner} /></div>
        {isOwner && <div hidden={active !== 'templates'}><TemplatesTab /></div>}
        <div hidden={active !== 'security'}><SecurityTab /></div>
      </div>
    </div>
  );
}
