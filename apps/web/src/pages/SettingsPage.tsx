import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Monitor, Smartphone, Tablet, AlertTriangle, Trash2, LogOut, Shield,
  Users, TrendingUp, BookOpen, Plus, CreditCard, KeyRound, Eye, EyeOff, Target,
  MessageSquare, Pencil, Check, X, Settings, Store, Wallet, Lock, ChevronRight,
  BadgeCheck, Zap, Package,
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

// ── Shared styles ─────────────────────────────────────────────────────────────
const inp = 'w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition bg-white placeholder:text-slate-400 text-slate-900';

// ── Card + header primitives ──────────────────────────────────────────────────
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden ${className}`}>{children}</div>;
}

function CardHeader({ icon: Icon, iconBg = 'bg-slate-50', iconColor = 'text-slate-500', title, subtitle, action }: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  iconBg?: string; iconColor?: string;
  title: string; subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-100">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ring-1 ring-slate-100 ${iconBg}`}>
          <Icon size={16} className={iconColor}/>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-900 leading-tight">{title}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5 leading-tight">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button role="switch" aria-checked={checked} onClick={() => onChange(!checked)} disabled={disabled}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-200 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${checked ? 'bg-emerald-500' : 'bg-slate-200'}`}>
      <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`}/>
    </button>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
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

function DeviceIcon({ type }: { type: string | null }) {
  const cls = 'shrink-0 text-slate-400';
  if (type === 'mobile') return <Smartphone size={16} className={cls}/>;
  if (type === 'tablet') return <Tablet      size={16} className={cls}/>;
  return <Monitor size={16} className={cls}/>;
}

const PLAN_BADGE: Record<string, { bg: string; text: string }> = {
  TRIAL:      { bg: 'bg-amber-50  border border-amber-200',  text: 'text-amber-700'  },
  BASIC:      { bg: 'bg-blue-50   border border-blue-200',   text: 'text-blue-700'   },
  PRO:        { bg: 'bg-purple-50 border border-purple-200', text: 'text-purple-700' },
  ENTERPRISE: { bg: 'bg-indigo-50 border border-indigo-200', text: 'text-indigo-700' },
};

// ──────────────────────────────────────────────────────────────────────────────
// SECTION: SHOP
// ──────────────────────────────────────────────────────────────────────────────

function ShopSection({ shop, isLoading, usage }: {
  shop: Awaited<ReturnType<typeof sellersApi.getMe>> | undefined;
  isLoading: boolean;
  usage: BillingUsage | undefined;
}) {
  const qc = useQueryClient();
  const [shopName, setShopName] = useState('');
  const [phone,    setPhone]    = useState('');
  const [address,  setAddress]  = useState('');

  useEffect(() => {
    if (shop) { setShopName(shop.shopName); setPhone(shop.phone); setAddress(shop.address ?? ''); }
  }, [shop]);

  const mutation = useMutation({
    mutationFn: () => sellersApi.update({ shopName, phone, address: address || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shop-me'] }); toast.success('Shop info save ho gaya'); },
    onError: (e) => toast.error(getErrorMessage(e, 'Save nahi hua')),
  });

  const dirty = shop && (shopName !== shop.shopName || phone !== shop.phone || address !== (shop.address ?? ''));

  const toggleMurabaha = useMutation({
    mutationFn: (val: boolean) => sellersApi.update({ murabahaMode: val }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shop-me'] }); toast.success('Murabaha mode update hua'); },
    onError: () => toast.error('Update nahi hua'),
  });

  return (
    <div className="space-y-5">

      {/* Shop info */}
      <Card>
        <CardHeader icon={Store} iconBg="bg-blue-50" iconColor="text-blue-600" title="Shop Information" subtitle="Aapka naam, number aur pata"/>
        <div className="p-6">
          {isLoading ? (
            <div className="space-y-3">{[1,2,3].map(i=><BlockSkeleton key={i} className="h-11 rounded-xl"/>)}</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Shop Name *</label>
                  <input value={shopName} onChange={e=>setShopName(e.target.value)} className={inp} placeholder="e.g. Assaan Electronics"/>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Phone Number *</label>
                  <input value={phone} onChange={e=>setPhone(e.target.value)} className={inp} placeholder="03001234567"/>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Address</label>
                <textarea value={address} onChange={e=>setAddress(e.target.value)} rows={2}
                  className={`${inp} resize-none`} placeholder="Shop address (optional)"/>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <button onClick={()=>mutation.mutate()} disabled={!dirty||mutation.isPending||!shopName||!phone}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-black rounded-xl transition shadow-sm shadow-blue-600/20">
                  {mutation.isPending ? 'Saving…' : 'Save Changes'}
                </button>
                {dirty && (
                  <button onClick={()=>{setShopName(shop!.shopName);setPhone(shop!.phone);setAddress(shop!.address??'');}}
                    className="text-sm text-slate-400 hover:text-slate-700 transition">Discard</button>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Subscription */}
      {usage && (
        <Card>
          <CardHeader icon={BadgeCheck} iconBg="bg-purple-50" iconColor="text-purple-600" title="Subscription & Usage" subtitle="Plan aur limits"/>
          <div className="p-6 space-y-5">
            {/* Plan + price */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                {(() => { const b = PLAN_BADGE[usage.plan]; return b
                  ? <span className={`px-3 py-1 rounded-full text-xs font-black ${b.bg} ${b.text}`}>{usage.planLabel}</span>
                  : <span className="px-3 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-600">{usage.planLabel}</span>;
                })()}
                {(usage.trialExpired || usage.planExpired) && (
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-red-100 border border-red-200 text-red-600">Expired</span>
                )}
              </div>
              <div className="text-right">
                {usage.priceMonthly === 0   && <span className="text-xs font-black text-emerald-600">Free</span>}
                {usage.priceMonthly > 0     && <span className="text-sm font-black text-slate-900">Rs {usage.priceMonthly.toLocaleString()}<span className="text-xs text-slate-400 font-normal">/mo</span></span>}
                {usage.priceMonthly === -1  && <span className="text-xs text-slate-400">Custom pricing</span>}
              </div>
            </div>

            {/* Expiry banner */}
            {usage.plan === 'TRIAL' && usage.trialEndsAt && (
              <div className="flex items-center gap-2.5 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl">
                <AlertTriangle size={14} className="text-amber-500 shrink-0"/>
                <p className="text-xs text-amber-700">
                  Trial ends <span className="font-black">{fmtDate(usage.trialEndsAt)}</span>
                  {usage.trialDaysLeft !== null && usage.trialDaysLeft > 0 && <span className="ml-1 text-amber-500">({usage.trialDaysLeft}d left)</span>}
                </p>
              </div>
            )}
            {usage.plan !== 'TRIAL' && usage.planExpiresAt && (
              <div className="flex items-center gap-2.5 px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl">
                <BadgeCheck size={14} className="text-slate-400 shrink-0"/>
                <p className="text-xs text-slate-600">Plan expires: <span className="font-black">{fmtDate(usage.planExpiresAt)}</span></p>
              </div>
            )}

            {/* Usage bars */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {([
                { stat: usage.limits.customers,    label: 'Customers',    icon: Users,      color: 'bg-blue-500' },
                { stat: usage.limits.staff,        label: 'Staff',        icon: Package,    color: 'bg-violet-500' },
                { stat: usage.limits.installments, label: 'Installments', icon: TrendingUp, color: 'bg-emerald-500' },
              ] as const).map(({ stat, label, icon: Icon, color }) => {
                const pct = stat.unlimited ? 30 : (stat as UsageStat).pct;
                const bar = stat.unlimited ? 'bg-emerald-400' : pct >= 90 ? 'bg-red-400' : pct >= 70 ? 'bg-amber-400' : color;
                return (
                  <div key={label} className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Icon size={13} className="text-slate-400"/>
                        <span className="text-xs font-bold text-slate-600">{label}</span>
                      </div>
                      <span className="text-xs font-black text-slate-800 tabular-nums">
                        {(stat as UsageStat).unlimited ? `${(stat as UsageStat).used}/∞` : `${(stat as UsageStat).used}/${(stat as UsageStat).limit}`}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${bar}`} style={{ width: `${pct}%` }}/>
                    </div>
                  </div>
                );
              })}
            </div>

            <a href="/billing" className="flex items-center justify-between px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl transition group">
              <span className="text-sm font-black text-white">Billing Manage Karo</span>
              <ChevronRight size={15} className="text-blue-300 group-hover:translate-x-0.5 transition-transform"/>
            </a>
          </div>
        </Card>
      )}

      {/* Murabaha */}
      {shop?.id && (
        <Card>
          <CardHeader icon={BookOpen} iconBg="bg-emerald-50" iconColor="text-emerald-600" title="Preferences" subtitle="Islamic finance aur display settings"/>
          <div className="p-6">
            <div className="flex items-center justify-between gap-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                  <BookOpen size={13} className="text-emerald-600"/>
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900">Murabaha Mode</p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-sm">
                    Cost price + profit markup alag alag dikhata hai — Shariah-compliant structure.
                  </p>
                  {shop.murabahaMode && (
                    <span className="inline-block mt-2 px-2.5 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-lg">Active</span>
                  )}
                </div>
              </div>
              <Toggle checked={shop.murabahaMode ?? false} onChange={v=>toggleMurabaha.mutate(v)} disabled={toggleMurabaha.isPending}/>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// SECTION: TARGETS
// ──────────────────────────────────────────────────────────────────────────────

function TargetsSection({ shop }: { shop: Awaited<ReturnType<typeof sellersApi.getMe>> | undefined }) {
  const qc = useQueryClient();
  const [daily,      setDaily]      = useState('');
  const [weekly,     setWeekly]     = useState('');
  const [monthly,    setMonthly]    = useState('');
  const [commission, setCommission] = useState('');
  const [budgets, setBudgets]       = useState<Partial<Record<string,string>>>({});

  useEffect(() => {
    if (shop) {
      setDaily(String(shop.settings?.dailyTarget??''));
      setWeekly(String(shop.settings?.weeklyTarget??''));
      setMonthly(String(shop.settings?.monthlyTarget??''));
      setCommission(String(shop.settings?.commissionRate??''));
      const eb = shop.settings?.expenseBudgets??{};
      setBudgets(Object.fromEntries(Object.entries(eb).map(([k,v])=>[k,String(v??'')])));
    }
  }, [shop]);

  const mutation = useMutation({
    mutationFn: () => {
      const expenseBudgets = Object.fromEntries(
        Object.entries(budgets).filter(([,v])=>v&&Number(v)>0).map(([k,v])=>[k,Number(v)])
      ) as Record<string,number>;
      return sellersApi.update({ settings: {
        dailyTarget:    daily      ? Number(daily)      : undefined,
        weeklyTarget:   weekly     ? Number(weekly)     : undefined,
        monthlyTarget:  monthly    ? Number(monthly)    : undefined,
        commissionRate: commission ? Number(commission) : undefined,
        expenseBudgets: Object.keys(expenseBudgets).length ? expenseBudgets : undefined,
      }});
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey:['shop-me'] }); qc.invalidateQueries({ queryKey:['dashboard'] }); toast.success('Targets save ho gaye'); },
    onError: (e) => toast.error(getErrorMessage(e,'Save nahi hua')),
  });

  const budgetDirty = JSON.stringify(budgets) !== JSON.stringify(
    Object.fromEntries(Object.entries(shop?.settings?.expenseBudgets??{}).map(([k,v])=>[k,String(v??'')]))
  );
  const dirty = shop && (
    daily      !== String(shop.settings?.dailyTarget??'') ||
    weekly     !== String(shop.settings?.weeklyTarget??'') ||
    monthly    !== String(shop.settings?.monthlyTarget??'') ||
    commission !== String(shop.settings?.commissionRate??'') ||
    budgetDirty
  );

  const CATS = [
    { key:'RENT',        label:'Kiraya',       sub:'Rent'         },
    { key:'SALARY',      label:'Tankhwa',      sub:'Salary'       },
    { key:'UTILITY',     label:'Bijli/Gas',    sub:'Utility'      },
    { key:'PURCHASE',    label:'Maal',         sub:'Purchase'     },
    { key:'MAINTENANCE', label:'Repair',       sub:'Maintenance'  },
    { key:'TRANSPORT',   label:'Transport',    sub:'Transport'    },
    { key:'OTHER',       label:'Other',        sub:'Other'        },
  ] as const;

  return (
    <div className="space-y-5">

      {/* Collection targets */}
      <Card>
        <CardHeader icon={Target} iconBg="bg-blue-50" iconColor="text-blue-600" title="Collection Targets" subtitle="Dashboard pe live progress track hoti hai"/>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label:'Daily Target',   value:daily,   set:setDaily,   placeholder:'e.g. 50,000'    },
              { label:'Weekly Target',  value:weekly,  set:setWeekly,  placeholder:'e.g. 3,00,000'  },
              { label:'Monthly Target', value:monthly, set:setMonthly, placeholder:'e.g. 12,00,000' },
            ].map(({label,value,set,placeholder}) => (
              <div key={label}>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">{label} (PKR)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">Rs</span>
                  <input type="number" value={value} onChange={e=>set(e.target.value)} placeholder={placeholder}
                    className={`${inp} pl-8`}/>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-slate-100">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Staff Commission Rate (%)</label>
            <div className="flex items-center gap-4">
              <input type="number" value={commission} onChange={e=>setCommission(e.target.value)}
                placeholder="e.g. 0.5" step="0.1" min="0" max="100" className={`${inp} w-36`}/>
              <p className="text-xs text-slate-400 flex-1">
                {commission && Number(commission)>0
                  ? <span className="font-semibold text-blue-600">Staff ko har payment ka {commission}% milta hai</span>
                  : 'Commission nahi — field sheet mein column nahi dikhega'}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Expense budgets */}
      <Card>
        <CardHeader icon={Wallet} iconBg="bg-rose-50" iconColor="text-rose-500" title="Monthly Expense Budgets" subtitle="Category wise limit — alerts milenge jab limit cross ho"/>
        <div className="p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {CATS.map(({key,label,sub}) => (
              <div key={key} className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-0.5">{label}</label>
                <p className="text-[10px] text-slate-400 mb-2">{sub}</p>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">Rs</span>
                  <input type="number" value={budgets[key]??''} min="0"
                    onChange={e=>setBudgets(b=>({...b,[key]:e.target.value}))}
                    placeholder="No limit"
                    className="w-full pl-7 pr-2 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-white transition tabular-nums"/>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button onClick={()=>mutation.mutate()} disabled={!dirty||mutation.isPending}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-black rounded-xl transition shadow-sm shadow-blue-600/20">
          {mutation.isPending ? 'Saving…' : 'Save All Targets'}
        </button>
        {dirty && (
          <button onClick={()=>{
            setDaily(String(shop?.settings?.dailyTarget??''));
            setWeekly(String(shop?.settings?.weeklyTarget??''));
            setMonthly(String(shop?.settings?.monthlyTarget??''));
            setCommission(String(shop?.settings?.commissionRate??''));
            const eb=shop?.settings?.expenseBudgets??{};
            setBudgets(Object.fromEntries(Object.entries(eb).map(([k,v])=>[k,String(v??'')])));
          }} className="text-sm text-slate-400 hover:text-slate-700 transition">Discard</button>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// SECTION: PAYMENT ACCOUNTS
// ──────────────────────────────────────────────────────────────────────────────

const ACCOUNT_TYPES: { value:PaymentAccountType; label:string; bg:string; text:string }[] = [
  { value:'BANK',      label:'Bank',      bg:'bg-blue-50',   text:'text-blue-700'   },
  { value:'JAZZCASH',  label:'JazzCash',  bg:'bg-red-50',    text:'text-red-700'    },
  { value:'EASYPAISA', label:'EasyPaisa', bg:'bg-green-50',  text:'text-green-700'  },
  { value:'SADAPAY',   label:'SadaPay',   bg:'bg-purple-50', text:'text-purple-700' },
  { value:'NAYAPAY',   label:'NayaPay',   bg:'bg-orange-50', text:'text-orange-700' },
  { value:'OTHER',     label:'Other',     bg:'bg-slate-50',  text:'text-slate-600'  },
];

function TypeBadge({ type }: { type:PaymentAccountType }) {
  const t = ACCOUNT_TYPES.find(a=>a.value===type);
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-black ${t?.bg??'bg-slate-50'} ${t?.text??'text-slate-600'}`}>{t?.label??type}</span>;
}

function PaymentsSection({ isOwner }: { isOwner:boolean }) {
  const qc = useQueryClient();
  const [showForm, setShowForm]   = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState<{open:boolean;id:string|null}>({open:false,id:null});
  const [type,          setType]          = useState<PaymentAccountType>('BANK');
  const [accountTitle,  setAccountTitle]  = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankName,      setBankName]      = useState('');

  const { data: accounts=[], isLoading } = useQuery({ queryKey:['payment-accounts'], queryFn:sellersApi.listPaymentAccounts });

  const addMutation = useMutation({
    mutationFn: ()=>sellersApi.addPaymentAccount({ type, accountTitle:accountTitle.trim(), accountNumber:accountNumber.trim(), bankName:type==='BANK'&&bankName.trim()?bankName.trim():undefined }),
    onSuccess: ()=>{ qc.invalidateQueries({queryKey:['payment-accounts']}); toast.success('Account add hua'); setShowForm(false); setAccountTitle(''); setAccountNumber(''); setBankName(''); setType('BANK'); },
    onError: (e)=>toast.error(getErrorMessage(e,'Add nahi hua')),
  });

  const removeMutation = useMutation({
    mutationFn: (id:string)=>sellersApi.removePaymentAccount(id),
    onSuccess: ()=>{ qc.invalidateQueries({queryKey:['payment-accounts']}); toast.success('Account remove hua'); },
    onError: ()=>toast.error('Remove nahi hua'),
  });

  const canSubmit = accountTitle.trim() && accountNumber.trim();

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          icon={CreditCard} iconBg="bg-blue-50" iconColor="text-blue-600"
          title="Payment Accounts"
          subtitle="Customers ko bills pe ye accounts dikhte hain — online payment ke liye"
          action={isOwner && (
            <button onClick={()=>setShowForm(v=>!v)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl transition shadow-sm shadow-blue-600/20">
              <Plus size={12}/> Add Account
            </button>
          )}
        />

        <div className="p-6 space-y-4">
          {/* Add form */}
          {showForm && isOwner && (
            <div className="p-5 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl space-y-4">
              <p className="text-xs font-black text-slate-600 uppercase tracking-wide">New Account</p>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Account Type</label>
                <div className="flex flex-wrap gap-2">
                  {ACCOUNT_TYPES.map(t=>(
                    <button key={t.value} onClick={()=>setType(t.value)}
                      className={`px-3.5 py-1.5 text-xs rounded-xl border font-black transition ${type===t.value ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'border-slate-200 text-slate-600 hover:border-blue-300 bg-white'}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Account Title *</label>
                  <input value={accountTitle} onChange={e=>setAccountTitle(e.target.value)} placeholder="e.g. Muhammad Ali" className={inp}/>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">{type==='BANK'?'Account Number':'Phone Number'} *</label>
                  <input value={accountNumber} onChange={e=>setAccountNumber(e.target.value)}
                    placeholder={type==='BANK'?'0123456789012345':'03001234567'} className={inp}/>
                </div>
              </div>
              {type==='BANK' && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Bank Name</label>
                  <input value={bankName} onChange={e=>setBankName(e.target.value)} placeholder="e.g. HBL, Meezan, UBL" className={`${inp} max-w-xs`}/>
                </div>
              )}
              <div className="flex gap-2.5 pt-1">
                <button onClick={()=>setShowForm(false)}
                  className="px-4 py-2.5 text-sm font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-100 transition">Cancel</button>
                <button onClick={()=>addMutation.mutate()} disabled={!canSubmit||addMutation.isPending}
                  className="px-5 py-2.5 text-sm font-black text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition disabled:opacity-40 shadow-sm shadow-blue-600/20">
                  {addMutation.isPending ? 'Adding…' : 'Add Account'}
                </button>
              </div>
            </div>
          )}

          {/* List */}
          {isLoading ? <RowSkeleton rows={2}/> : accounts.length===0 ? (
            <div className="py-14 flex flex-col items-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
              <CreditCard size={32} className="mb-3 opacity-20"/>
              <p className="text-sm font-bold text-slate-500">Koi payment account nahi</p>
              <p className="text-xs text-slate-400 mt-1">{isOwner ? '"Add Account" dabao upar' : 'Owner ne abhi tak koi account add nahi kiya'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {accounts.map((acc:PaymentAccount)=>(
                <div key={acc.id} className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                  <TypeBadge type={acc.type}/>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{acc.accountTitle}</p>
                    <p className="text-xs text-slate-400 truncate tabular-nums">{acc.accountNumber}{acc.bankName&&` · ${acc.bankName}`}</p>
                  </div>
                  {isOwner && (
                    <button onClick={()=>setRemoveConfirm({open:true,id:acc.id})} disabled={removeMutation.isPending}
                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition disabled:opacity-40 opacity-0 group-hover:opacity-100 shrink-0">
                      <Trash2 size={13}/>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <ConfirmDialog
        open={removeConfirm.open} title="Account Remove Karo?"
        description="Ye payment account remove ho jaega aur installment bills mein nahi dikhega."
        confirmLabel="Remove Karo" variant="danger" isPending={removeMutation.isPending}
        onConfirm={()=>{ if(removeConfirm.id) removeMutation.mutate(removeConfirm.id); setRemoveConfirm({open:false,id:null}); }}
        onCancel={()=>setRemoveConfirm({open:false,id:null})}
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// SECTION: WHATSAPP TEMPLATES
// ──────────────────────────────────────────────────────────────────────────────

function TemplatesSection() {
  const qc = useQueryClient();
  const [showForm,  setShowForm]  = useState(false);
  const [editId,    setEditId]    = useState<string|null>(null);
  const [name,      setName]      = useState('');
  const [body,      setBody]      = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{open:boolean;id:string|null}>({open:false,id:null});

  const { data:templates=[], isLoading } = useQuery({ queryKey:['whatsapp-templates'], queryFn:whatsappTemplatesApi.list, staleTime:60_000 });

  function startEdit(t:WhatsappTemplate) { setEditId(t.id); setName(t.name); setBody(t.body); setShowForm(false); }
  function cancelForm() { setShowForm(false); setEditId(null); setName(''); setBody(''); }

  const createMutation = useMutation({
    mutationFn: ()=>whatsappTemplatesApi.create({name:name.trim(),body:body.trim()}),
    onSuccess: ()=>{ qc.invalidateQueries({queryKey:['whatsapp-templates']}); toast.success('Template save hua'); cancelForm(); },
    onError: (e)=>toast.error(getErrorMessage(e,'Save nahi hua')),
  });
  const updateMutation = useMutation({
    mutationFn: ()=>whatsappTemplatesApi.update(editId!,{name:name.trim(),body:body.trim()}),
    onSuccess: ()=>{ qc.invalidateQueries({queryKey:['whatsapp-templates']}); toast.success('Template update hua'); cancelForm(); },
    onError: (e)=>toast.error(getErrorMessage(e,'Update nahi hua')),
  });
  const deleteMutation = useMutation({
    mutationFn: (id:string)=>whatsappTemplatesApi.remove(id),
    onSuccess: ()=>{ qc.invalidateQueries({queryKey:['whatsapp-templates']}); toast.success('Template delete hua'); },
    onError: ()=>toast.error('Delete nahi hua'),
  });

  const canSubmit = name.trim().length>0 && body.trim().length>0;
  const isEditing = editId!==null;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          icon={MessageSquare} iconBg="bg-green-50" iconColor="text-green-600"
          title="WhatsApp Templates"
          subtitle="Reminder messages — variables auto fill honge"
          action={!showForm&&!isEditing && (
            <button onClick={()=>{cancelForm();setShowForm(true);}}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-black rounded-xl transition shadow-sm shadow-green-600/20">
              <Plus size={12}/> Add Template
            </button>
          )}
        />
        <div className="p-6 space-y-4">
          <div className="flex flex-wrap gap-1.5 items-center text-xs">
            <span className="text-slate-400 font-medium">Variables:</span>
            {TEMPLATE_VARS.map(v=>(
              <code key={v.key} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-lg font-mono text-[10px] border border-slate-200">{v.key}</code>
            ))}
          </div>

          {/* Form */}
          {(showForm||isEditing) && (
            <div className="p-5 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl space-y-4">
              <p className="text-xs font-black text-slate-600 uppercase tracking-wide">{isEditing?'Template Edit Karo':'New Template'}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Name *</label>
                  <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Overdue Reminder" className={inp}/>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                    Message Body *
                    <span className="ml-2 flex-1 flex flex-wrap gap-1 inline-flex">
                      {TEMPLATE_VARS.slice(0,4).map(v=>(
                        <button key={v.key} type="button" onClick={()=>setBody(b=>b+v.key)}
                          className="px-1.5 py-0.5 text-[9px] bg-green-50 text-green-700 border border-green-200 rounded font-mono font-bold hover:bg-green-100 transition">
                          +{v.key}
                        </button>
                      ))}
                    </span>
                  </label>
                  <textarea value={body} onChange={e=>setBody(e.target.value)} rows={4}
                    placeholder={`Assalam o Alaikum {{customer_name}}! Aapka {{amount_due}} due hai...`}
                    className={`${inp} resize-none font-mono text-xs leading-relaxed`}/>
                </div>
              </div>
              <div className="flex gap-2.5">
                <button onClick={cancelForm}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-100 transition">
                  <X size={13}/> Cancel
                </button>
                <button onClick={()=>isEditing?updateMutation.mutate():createMutation.mutate()}
                  disabled={!canSubmit||createMutation.isPending||updateMutation.isPending}
                  className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-black text-white bg-green-600 rounded-xl hover:bg-green-700 transition disabled:opacity-40 shadow-sm shadow-green-600/20">
                  <Check size={13}/>
                  {(createMutation.isPending||updateMutation.isPending)?'Saving…':isEditing?'Update':'Save Template'}
                </button>
              </div>
            </div>
          )}

          {/* List */}
          {isLoading ? <RowSkeleton rows={2}/> : templates.length===0&&!showForm ? (
            <div className="py-14 flex flex-col items-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
              <MessageSquare size={32} className="mb-3 opacity-20"/>
              <p className="text-sm font-bold text-slate-500">Koi template nahi</p>
              <p className="text-xs text-slate-400 mt-1">Add Template dabao upar</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {templates.map((t:WhatsappTemplate)=>(
                <div key={t.id} className={`p-4 rounded-2xl border group transition ${editId===t.id?'border-green-200 bg-green-50':'border-slate-100 bg-slate-50 hover:border-slate-200'}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm font-black text-slate-900">{t.name}</p>
                    <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={()=>startEdit(t)} className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition"><Pencil size={12}/></button>
                      <button onClick={()=>setDeleteConfirm({open:true,id:t.id})} disabled={deleteMutation.isPending}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition disabled:opacity-40"><Trash2 size={12}/></button>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono leading-relaxed line-clamp-3 whitespace-pre-wrap break-words">{t.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <ConfirmDialog open={deleteConfirm.open} title="Template Delete Karo?" description="Ye WhatsApp template permanently delete ho jaega."
        confirmLabel="Delete" variant="danger" isPending={deleteMutation.isPending}
        onConfirm={()=>{ if(deleteConfirm.id) deleteMutation.mutate(deleteConfirm.id); setDeleteConfirm({open:false,id:null}); }}
        onCancel={()=>setDeleteConfirm({open:false,id:null})}
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// SECTION: SECURITY
// ──────────────────────────────────────────────────────────────────────────────

function SecuritySection() {
  const qc = useQueryClient();
  const { clearAuth } = useAuthStore();
  const navigate = useNavigate();

  const [current, setCurrent]         = useState('');
  const [next,    setNext]            = useState('');
  const [confirm, setConfirm]         = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext,    setShowNext]    = useState(false);

  const pwMutation = useMutation({
    mutationFn: ()=>authApi.changePassword({currentPassword:current,newPassword:next}),
    onSuccess: ()=>{ toast.success('Password change ho gaya'); setCurrent(''); setNext(''); setConfirm(''); },
    onError: (e)=>toast.error(getErrorMessage(e,'Password change nahi hua')),
  });

  const mismatch  = next.length>0 && confirm.length>0 && next!==confirm;
  const canSubmit = current.length>0 && next.length>=8 && next===confirm && !pwMutation.isPending;

  const [revokeAllConfirm, setRevokeAllConfirm] = useState(false);
  const [revokeSessionConfirm, setRevokeSessionConfirm] = useState<{open:boolean;id:string|null}>({open:false,id:null});

  const { data:sessions=[], isLoading:sessionsLoading, refetch } = useQuery({ queryKey:['sessions'], queryFn:sessionsApi.list, staleTime:30_000 });

  const revokeMutation = useMutation({
    mutationFn: (id:string)=>sessionsApi.revoke(id),
    onSuccess: ()=>{ qc.invalidateQueries({queryKey:['sessions']}); toast.success('Session revoke hua'); },
    onError: ()=>toast.error('Revoke nahi hua'),
  });
  const revokeAllMutation = useMutation({
    mutationFn: ()=>sessionsApi.revokeAll(),
    onSuccess: ()=>{ toast.success('Tamam sessions revoke — dobara login karo'); clearAuth(); localStorage.removeItem('refresh_token'); void navigate('/login'); },
    onError: ()=>toast.error('Failed'),
  });

  const suspiciousCount = sessions.filter((s:Session)=>s.isSuspicious).length;

  return (
    <div className="space-y-5">

      {/* Change Password */}
      <Card>
        <CardHeader icon={KeyRound} iconBg="bg-slate-50" iconColor="text-slate-600" title="Password Change Karo" subtitle="Apna password update karo"/>
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Purana Password</label>
              <div className="relative">
                <input type={showCurrent?'text':'password'} value={current} onChange={e=>setCurrent(e.target.value)} className={inp} placeholder="Current password"/>
                <button type="button" onClick={()=>setShowCurrent(v=>!v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
                  {showCurrent?<EyeOff size={14}/>:<Eye size={14}/>}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Naya Password</label>
              <div className="relative">
                <input type={showNext?'text':'password'} value={next} onChange={e=>setNext(e.target.value)} className={inp} placeholder="Min 8 characters"/>
                <button type="button" onClick={()=>setShowNext(v=>!v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
                  {showNext?<EyeOff size={14}/>:<Eye size={14}/>}
                </button>
              </div>
              {next.length>0&&next.length<8&&<p className="text-xs text-red-500 mt-1.5 font-medium">Kam se kam 8 characters</p>}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Confirm Password</label>
              <input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)}
                className={`${inp} ${mismatch?'border-red-300 focus:border-red-400 focus:ring-red-50':''}`} placeholder="Dobara likhein"/>
              {mismatch&&<p className="text-xs text-red-500 mt-1.5 font-medium">Match nahi ho raha</p>}
            </div>
          </div>
          <div className="mt-4">
            <button onClick={()=>pwMutation.mutate()} disabled={!canSubmit}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-black rounded-xl transition shadow-sm shadow-blue-600/20">
              {pwMutation.isPending?'Saving…':'Password Change Karo'}
            </button>
          </div>
        </div>
      </Card>

      {/* Sessions */}
      <Card>
        <CardHeader
          icon={Shield} iconBg="bg-slate-50" iconColor="text-slate-600"
          title={`Active Sessions${sessions.length>0?` (${sessions.length})`:''}`}
          subtitle={suspiciousCount>0?`⚠️ ${suspiciousCount} suspicious session detected`:'Tamam logged-in devices'}
          action={sessions.length>1 && (
            <button onClick={()=>setRevokeAllConfirm(true)} disabled={revokeAllMutation.isPending}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-black rounded-xl transition border border-red-200 disabled:opacity-50">
              <LogOut size={12}/> Revoke All
            </button>
          )}
        />
        <div className="p-6 space-y-3">
          {suspiciousCount>0 && (
            <div className="flex items-center gap-2.5 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl">
              <AlertTriangle size={14} className="text-amber-500 shrink-0"/>
              <p className="text-xs font-bold text-amber-700">{suspiciousCount} suspicious session{suspiciousCount>1?'s':''} — foran revoke karo</p>
            </div>
          )}

          {sessionsLoading ? <RowSkeleton rows={3}/> : sessions.length===0 ? (
            <div className="py-10 flex flex-col items-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
              <Shield size={28} className="mb-2 opacity-20"/>
              <p className="text-xs font-medium">No active sessions</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sessions.map((session:Session)=>(
                <div key={session.id}
                  className={`flex items-center gap-3 p-4 rounded-2xl border transition group ${session.isSuspicious?'border-amber-200 bg-amber-50':'border-slate-100 bg-slate-50 hover:border-slate-200'}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${session.isSuspicious?'bg-amber-100':'bg-white ring-1 ring-slate-200'}`}>
                    <DeviceIcon type={session.deviceType}/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-bold text-slate-900 truncate">{session.deviceName??'Unknown device'}</p>
                      {session.isSuspicious && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-black rounded shrink-0">
                          <AlertTriangle size={8}/> Suspicious
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5 tabular-nums">{session.ip??'IP unknown'} · {timeAgo(session.lastActiveAt)}</p>
                    <p className="text-[10px] text-slate-400 tabular-nums">Login: {fmtDate(session.createdAt)}</p>
                  </div>
                  <button onClick={()=>setRevokeSessionConfirm({open:true,id:session.id})} disabled={revokeMutation.isPending}
                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition disabled:opacity-40 shrink-0 opacity-0 group-hover:opacity-100">
                    <Trash2 size={13}/>
                  </button>
                </div>
              ))}
            </div>
          )}
          <button onClick={()=>void refetch()} className="text-xs text-slate-400 hover:text-slate-600 transition font-medium">↻ Refresh</button>
        </div>
      </Card>

      <ConfirmDialog open={revokeAllConfirm} title="Tamam Sessions Revoke Karo?"
        description="Aap sab devices se logout ho jaenge aur dobara login karna hoga."
        confirmLabel="Revoke All" variant="danger" isPending={revokeAllMutation.isPending}
        onConfirm={()=>{revokeAllMutation.mutate();setRevokeAllConfirm(false);}}
        onCancel={()=>setRevokeAllConfirm(false)}
      />
      <ConfirmDialog open={revokeSessionConfirm.open} title="Session Revoke Karo?"
        description="Is device ka session khatam ho jaega."
        confirmLabel="Revoke" variant="danger" isPending={revokeMutation.isPending}
        onConfirm={()=>{ if(revokeSessionConfirm.id) revokeMutation.mutate(revokeSessionConfirm.id); setRevokeSessionConfirm({open:false,id:null}); }}
        onCancel={()=>setRevokeSessionConfirm({open:false,id:null})}
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// NAV CONFIG
// ──────────────────────────────────────────────────────────────────────────────

type SectionKey = 'shop' | 'targets' | 'payments' | 'templates' | 'security';

const NAV: { key:SectionKey; label:string; desc:string; icon:React.ComponentType<{size?:number;className?:string}>; ownerOnly?:boolean }[] = [
  { key:'shop',      label:'Shop',             desc:'Info, plan & preferences', icon:Store                   },
  { key:'targets',   label:'Targets',          desc:'Goals & expense budgets',  icon:Target,  ownerOnly:true },
  { key:'payments',  label:'Payment Accounts', desc:'Bank & wallets',           icon:CreditCard              },
  { key:'templates', label:'WA Templates',     desc:'Quick reminder messages',  icon:MessageSquare, ownerOnly:true },
  { key:'security',  label:'Security',         desc:'Password & sessions',      icon:Lock                    },
];

// ──────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ──────────────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const user    = useAuthStore(s=>s.user);
  const isOwner = user?.role === 'SELLER_OWNER';
  const initials = user?.name?.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()??'?';

  const [active, setActive] = useState<SectionKey>('shop');
  const { data:shop, isLoading } = useQuery({ queryKey:['shop-me'], queryFn:sellersApi.getMe });
  const { data:usage } = useQuery({ queryKey:['billing-usage'], queryFn:billingApi.getUsage, staleTime:60_000 });

  const visible = NAV.filter(n=>!n.ownerOnly||isOwner);

  useEffect(() => {
    if (!visible.find(n=>n.key===active)) setActive('shop');
  }, [isOwner]);

  return (
    <div className="flex flex-col min-h-full">

      {/* ── Compact sticky header (exactly h-16 = 64px) ── */}
      <div className="sticky top-0 z-20 bg-slate-950 border-b border-white/5 h-16 flex items-center shrink-0">
        <div className="flex items-center gap-3 px-4 sm:px-6 w-full min-w-0">
          <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
            <Settings size={15} className="text-white"/>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-black text-white leading-tight">Settings</h1>
            <p className="text-[11px] text-slate-500 leading-tight truncate">{shop?.shopName??'Loading…'}</p>
          </div>
          {/* User badge — desktop */}
          <div className="hidden sm:flex items-center gap-2.5 shrink-0 px-3 py-1.5 bg-white/5 rounded-xl border border-white/10">
            <div className="w-6 h-6 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-black shrink-0">
              {initials}
            </div>
            <p className="text-xs font-medium text-slate-300 leading-tight">{user?.name}</p>
          </div>
        </div>
      </div>

      {/* ── Mobile pill nav (hidden on lg+, sticky below header) ── */}
      <div className="lg:hidden sticky top-16 z-10 bg-white border-b border-slate-200 shrink-0">
        <div className="flex gap-2 px-4 py-2.5 overflow-x-auto scrollbar-none">
          {visible.map(n=>{
            const Icon=n.icon; const isActive=active===n.key;
            return (
              <button key={n.key} onClick={()=>setActive(n.key)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition shrink-0 ${
                  isActive ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}>
                <Icon size={11}/>{n.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Body: sidebar + content ── */}
      <div className="flex flex-1 min-h-0">

        {/* Left sidebar — desktop only */}
        <aside className="hidden lg:flex flex-col w-60 xl:w-72 bg-white border-r border-slate-200 shrink-0 sticky top-16 self-start" style={{ maxHeight:'calc(100vh - 4rem)', overflowY:'auto' }}>

          {/* Nav items */}
          <nav className="p-3 flex-1">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-3 py-2 select-none">Menu</p>
            <div className="space-y-0.5">
              {visible.map(n=>{
                const Icon=n.icon; const isActive=active===n.key;
                return (
                  <button key={n.key} onClick={()=>setActive(n.key)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all group ${
                      isActive ? 'bg-blue-600 shadow-sm shadow-blue-600/20' : 'hover:bg-slate-50'
                    }`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                      isActive ? 'bg-white/25' : 'bg-slate-100 group-hover:bg-slate-200'
                    }`}>
                      <Icon size={14} className={isActive?'text-white':'text-slate-500'}/>
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-black leading-tight truncate ${isActive?'text-white':'text-slate-800'}`}>{n.label}</p>
                      <p className={`text-[10px] leading-tight mt-0.5 truncate ${isActive?'text-blue-200':'text-slate-400'}`}>{n.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Quick links */}
          {isOwner && (
            <div className="border-t border-slate-100 p-3 space-y-0.5">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-3 py-2 select-none">Quick Links</p>
              {[
                { label:'Staff Management', icon:Users,   to:'/staff'   },
                { label:'Billing & Plans',  icon:Wallet,  to:'/billing' },
                { label:'Audit Log',        icon:Zap,     to:'/audit'   },
                { label:'Exports',          icon:TrendingUp, to:'/exports'},
              ].map(link=>(
                <a key={link.to} href={link.to}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition group">
                  <link.icon size={13} className="text-slate-400 group-hover:text-slate-600 shrink-0"/>
                  <span className="flex-1 text-sm font-medium">{link.label}</span>
                  <ChevronRight size={11} className="text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all"/>
                </a>
              ))}
            </div>
          )}
        </aside>

        {/* ── Main content ── */}
        <main className="flex-1 min-w-0 bg-[#F0F2F8] p-4 sm:p-6 lg:p-8">
          {active==='shop'      && <ShopSection      shop={shop as any} isLoading={isLoading} usage={usage}/>}
          {active==='targets'   && isOwner && <TargetsSection  shop={shop as any}/>}
          {active==='payments'  && <PaymentsSection  isOwner={isOwner}/>}
          {active==='templates' && isOwner && <TemplatesSection/>}
          {active==='security'  && <SecuritySection/>}
        </main>
      </div>
    </div>
  );
}
