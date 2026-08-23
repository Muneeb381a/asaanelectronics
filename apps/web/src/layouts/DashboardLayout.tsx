import { useState, useRef, useEffect, useCallback } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard, Package, Users, CreditCard, LogOut, BarChart3,
  Bell, AlertTriangle, UserCog, ClipboardCheck, Settings, BookOpen, ShieldCheck,
  RotateCcw, Receipt, Wallet, PhoneCall, Search, Menu, X, TrendingUp, ShoppingCart,
  FileDown, Building2, ArrowLeftRight, AlertOctagon, Shield, Megaphone, CalendarDays,
  ClipboardList,
} from 'lucide-react';
import { useAuthStore } from '../store/auth.store.ts';
import { authApi } from '../api/auth.api.ts';
import { statsApi } from '../api/stats.api.ts';
import { profileApi } from '../api/profile.api.ts';
import { billingApi } from '../api/billing.api.ts';
import { broadcastsApi, type Broadcast } from '../api/broadcasts.api.ts';
import ProfileModal from '../components/ProfileModal.tsx';
import GlobalSearch from '../components/GlobalSearch.tsx';

// ── Nav item definitions ───────────────────────────────────────────────────────

type NavGroup = 'core' | 'finance' | 'catalog' | 'customers' | 'operations' | 'reporting' | 'system';

interface NavItemDef {
  to:     string;
  label:  string;
  icon:   React.ComponentType<{ size?: number; className?: string }>;
  end?:   boolean;
  perm:   string | string[];
  group:  NavGroup;
}

const ALL_NAV: NavItemDef[] = [
  { to: '/dashboard',        label: 'Dashboard',        icon: LayoutDashboard, end: true, perm: '',                                                       group: 'core'       },
  { to: '/reports',          label: 'Analytics',        icon: BarChart3,                  perm: 'canViewReports',                                         group: 'finance'    },
  { to: '/ledger',           label: 'Accounting',       icon: BookOpen,                   perm: '__owner__',                                              group: 'finance'    },
  { to: '/expenses',         label: 'Expenses',         icon: Receipt,                    perm: 'canRecordExpense',                                       group: 'finance'    },
  { to: '/cashflow',         label: 'Cash Flow',        icon: CalendarDays,               perm: '__owner__',                                              group: 'finance'    },
  { to: '/products',         label: 'Products',         icon: Package,                    perm: 'canManageProducts',                                      group: 'catalog'    },
  { to: '/suppliers',        label: 'Suppliers',        icon: Building2,                  perm: '__owner__',                                              group: 'catalog'    },
  { to: '/imei',             label: 'Serials / IMEI',   icon: Package,                    perm: '__owner__',                                              group: 'catalog'    },
  { to: '/customers',        label: 'Customers',        icon: Users,                      perm: ['canAddCustomer','canAddInstallment','canRecordPayment'], group: 'customers'  },
  { to: '/installments',     label: 'Installments',     icon: CreditCard,                 perm: ['canAddInstallment','canRecordPayment'],                  group: 'customers'  },
  { to: '/cash-sales',       label: 'Cash Sales',       icon: ShoppingCart,               perm: 'canMakeCashSales',                                       group: 'customers'  },
  { to: '/guarantors',       label: 'Guarantors',       icon: Shield,                     perm: '__owner__',                                              group: 'customers'  },
  { to: '/recovery',         label: 'Recovery',         icon: PhoneCall,                  perm: '__owner__',                                              group: 'operations' },
  { to: '/recovery-agents',  label: 'Agents',           icon: TrendingUp,                 perm: '__owner__',                                              group: 'operations' },
  { to: '/returns',          label: 'Returns',          icon: RotateCcw,                  perm: 'canManageReturns',                                       group: 'operations' },
  { to: '/trade-ins',        label: 'Trade-Ins',        icon: ArrowLeftRight,             perm: '__owner__',                                              group: 'operations' },
  { to: '/repossessions',    label: 'Repossessions',    icon: AlertOctagon,               perm: '__owner__',                                              group: 'operations' },
  { to: '/collection-sheet', label: 'Field Sheet',      icon: ClipboardList,              perm: '__owner__',                                              group: 'reporting'  },
  { to: '/exports',          label: 'Exports',          icon: FileDown,                   perm: '__owner__',                                              group: 'reporting'  },
  { to: '/staff',            label: 'Staff',            icon: UserCog,                    perm: '__owner__',                                              group: 'system'     },
  { to: '/billing',          label: 'Billing',          icon: Wallet,                     perm: '__owner__',                                              group: 'system'     },
  { to: '/audit',            label: 'Audit Log',        icon: ShieldCheck,                perm: '__owner__',                                              group: 'system'     },
  { to: '/settings',         label: 'Settings',         icon: Settings,                   perm: '__owner__',                                              group: 'system'     },
  { to: '/verifications',    label: 'Verifications',    icon: ClipboardCheck,             perm: 'canVerifyCustomers',                                     group: 'system'     },
];

const GROUP_LABELS: Record<NavGroup, string> = {
  core:       '',
  customers:  'Customers & Sales',
  operations: 'Operations',
  catalog:    'Catalog',
  finance:    'Finance',
  reporting:  'Reporting',
  system:     'System',
};

const GROUP_ORDER: NavGroup[] = ['core', 'customers', 'catalog', 'operations', 'finance', 'reporting', 'system'];

// ── Component ─────────────────────────────────────────────────────────────────

export default function DashboardLayout() {
  const { user, clearAuth, setPermissions } = useAuthStore();
  const isOwner = user?.role === 'SELLER_OWNER';
  const perms   = user?.permissions;
  const navigate = useNavigate();

  const [showProfile, setShowProfile] = useState(false);
  const [showBell,    setShowBell]    = useState(false);
  const [searchOpen,  setSearchOpen]  = useState(false);
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const bellRef       = useRef<HTMLDivElement>(null);
  const mobileBellRef = useRef<HTMLDivElement>(null);

  useQuery({
    queryKey: ['profile-perms'],
    queryFn: async () => {
      const profile = await profileApi.getMe();
      setPermissions(profile.permissions);
      return profile;
    },
    staleTime: 60_000,
    enabled: !isOwner,
  });

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: statsApi.get,
    staleTime: 60_000,
    enabled: isOwner || !!perms?.canViewReports,
  });

  const { data: billingUsage } = useQuery({
    queryKey: ['billing-usage'],
    queryFn: billingApi.getUsage,
    staleTime: 300_000,
    enabled: isOwner,
  });

  const { data: broadcasts = [] } = useQuery({
    queryKey: ['broadcasts'],
    queryFn: broadcastsApi.getActive,
    staleTime: 5 * 60_000,
    enabled: user?.role !== 'SUPER_ADMIN',
  });

  const getDismissed = useCallback(() => {
    try { return JSON.parse(localStorage.getItem('dismissed_broadcasts') ?? '[]') as string[]; }
    catch { return [] as string[]; }
  }, []);
  const [dismissed, setDismissed] = useState<string[]>(getDismissed);
  const dismissBroadcast = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    localStorage.setItem('dismissed_broadcasts', JSON.stringify(next));
  };
  const visibleBroadcasts = broadcasts.filter((b: Broadcast) => !dismissed.includes(b.id));

  const overdueCount         = stats?.overdueCount         ?? 0;
  const lowStockItems        = stats?.lowStockItems         ?? [];
  const promisesDue          = stats?.promisesDueCount      ?? 0;
  const guarantorRiskCount   = stats?.guarantorRiskCount    ?? 0;
  const budgetAlertsCount    = stats?.budgetAlertsCount     ?? 0;
  const pendingApprovalCount = isOwner ? (stats?.pendingApprovalCount ?? 0) : 0;
  const totalAlerts          = overdueCount + lowStockItems.length + promisesDue + guarantorRiskCount + budgetAlertsCount + pendingApprovalCount;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const inDesktop = bellRef.current?.contains(e.target as Node);
      const inMobile  = mobileBellRef.current?.contains(e.target as Node);
      if (!inDesktop && !inMobile) setShowBell(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const canSearch = isOwner || !!perms?.canSearchCnic;

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (canSearch) setSearchOpen((v) => !v);
      }
      if (e.key === 'Escape') { setMobileOpen(false); setShowBell(false); }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [canSearch]);

  useEffect(() => {
    if (mobileOpen) document.body.classList.add('mobile-menu-open');
    else            document.body.classList.remove('mobile-menu-open');
    return () => document.body.classList.remove('mobile-menu-open');
  }, [mobileOpen]);

  const { mutate: logout } = useMutation({
    mutationFn: () => authApi.logout(localStorage.getItem('refresh_token') ?? ''),
    onSettled:  () => { clearAuth(); void navigate('/login'); },
  });

  const initials = user?.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() ?? '?';

  // Build visible nav items
  const navItems = ALL_NAV.filter(({ perm }) => {
    if (!perm || perm === '') return true;
    if (perm === '__owner__') return isOwner;
    if (isOwner) return true;
    return Array.isArray(perm)
      ? perm.some((p) => !!perms?.[p as keyof typeof perms])
      : !!perms?.[perm as keyof typeof perms];
  });

  // Group nav items for sidebar sections
  const groupedNav = GROUP_ORDER
    .map((key) => ({
      key,
      label: GROUP_LABELS[key],
      items: navItems.filter((item) => item.group === key),
    }))
    .filter((g) => g.items.length > 0);

  // Bell dropdown content (shared between desktop + mobile)
  const bellDropdownContent = (
    <div className="max-h-64 overflow-y-auto">
      {totalAlerts === 0 && (
        <p className="text-xs text-gray-400 text-center py-5">No alerts right now</p>
      )}
      {pendingApprovalCount > 0 && (
        <button onClick={() => { navigate('/installments?status=PENDING'); setShowBell(false); }}
          className="w-full flex items-start gap-3 px-4 py-3 hover:bg-violet-50 transition text-left border-b border-gray-50">
          <ClipboardCheck size={14} className="text-violet-600 mt-0.5 shrink-0"/>
          <div>
            <p className="text-sm font-medium text-gray-900">{pendingApprovalCount} installment{pendingApprovalCount !== 1 ? 's' : ''} pending approval</p>
            <p className="text-xs text-gray-400">Staff ne banaya hai — approve karna zaruri hai</p>
          </div>
        </button>
      )}
      {overdueCount > 0 && (
        <button onClick={() => { navigate('/installments?status=ACTIVE'); setShowBell(false); }}
          className="w-full flex items-start gap-3 px-4 py-3 hover:bg-red-50 transition text-left border-b border-gray-50">
          <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0"/>
          <div>
            <p className="text-sm font-medium text-gray-900">{overdueCount} overdue installment{overdueCount !== 1 ? 's' : ''}</p>
            <p className="text-xs text-gray-400">Requires follow-up</p>
          </div>
        </button>
      )}
      {promisesDue > 0 && (
        <button onClick={() => { navigate('/installments'); setShowBell(false); }}
          className="w-full flex items-start gap-3 px-4 py-3 hover:bg-orange-50 transition text-left border-b border-gray-50">
          <AlertTriangle size={14} className="text-orange-500 mt-0.5 shrink-0"/>
          <div>
            <p className="text-sm font-medium text-gray-900">{promisesDue} promise{promisesDue !== 1 ? 's' : ''} due</p>
            <p className="text-xs text-gray-400">Customers promised to pay today</p>
          </div>
        </button>
      )}
      {guarantorRiskCount > 0 && (
        <button onClick={() => { navigate('/guarantors'); setShowBell(false); }}
          className="w-full flex items-start gap-3 px-4 py-3 hover:bg-rose-50 transition text-left border-b border-gray-50">
          <Shield size={14} className="text-rose-500 mt-0.5 shrink-0"/>
          <div>
            <p className="text-sm font-medium text-gray-900">{guarantorRiskCount} risky guarantor{guarantorRiskCount !== 1 ? 's' : ''}</p>
            <p className="text-xs text-gray-400">Guarantor ka apna installment overdue hai</p>
          </div>
        </button>
      )}
      {budgetAlertsCount > 0 && (
        <button onClick={() => { navigate('/expenses'); setShowBell(false); }}
          className="w-full flex items-start gap-3 px-4 py-3 hover:bg-orange-50 transition text-left border-b border-gray-50">
          <Wallet size={14} className="text-orange-500 mt-0.5 shrink-0"/>
          <div>
            <p className="text-sm font-medium text-gray-900">{budgetAlertsCount} budget {budgetAlertsCount !== 1 ? 'categories' : 'category'} exceeded</p>
            <p className="text-xs text-gray-400">Monthly expense limit reach ho gaya</p>
          </div>
        </button>
      )}
      {lowStockItems.map((p) => (
        <button key={p.id} onClick={() => { navigate('/products'); setShowBell(false); }}
          className="w-full flex items-start gap-3 px-4 py-3 hover:bg-amber-50 transition text-left border-b border-gray-50 last:border-0">
          <Package size={14} className="text-amber-500 mt-0.5 shrink-0"/>
          <div>
            <p className="text-sm font-medium text-gray-900">{p.name}</p>
            <p className="text-xs text-gray-400">{p.stock === 0 ? 'Out of stock' : `Only ${p.stock} left`}</p>
          </div>
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F0F2F8] flex">

      {/* Mobile backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden transition-opacity duration-300 ${mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      {/* ── Sidebar ── */}
      <aside className={`fixed lg:sticky lg:top-0 lg:h-screen inset-y-0 left-0 z-50 w-64 lg:w-60 bg-slate-950 flex flex-col transition-transform duration-300 ease-in-out shrink-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>

        {/* Brand */}
        <div className="px-4 py-4 border-b border-white/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-blue-600/30">
              <CreditCard size={16} className="text-white"/>
            </div>
            <div>
              <p className="font-bold text-white text-[13px] leading-tight">Assaan Electronics</p>
              <p className="text-[10px] text-slate-600 leading-tight mt-0.5">Installment Manager</p>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1.5 rounded-lg hover:bg-white/10 transition"
            aria-label="Close menu"
          >
            <X size={16} className="text-slate-400"/>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 min-h-0 px-2 py-4 overflow-y-auto space-y-5 scrollbar-thin">
          {groupedNav.map((group) => (
            <div key={group.key}>
              {group.label && (
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 px-3 mb-1.5 select-none">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map(({ to, label, icon: Icon, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `relative flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-[13px] font-medium transition-all ${
                        isActive
                          ? 'bg-blue-500/15 text-white'
                          : 'text-slate-500 hover:bg-white/6 hover:text-slate-300'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span className="absolute left-0 top-2 bottom-2 w-[3px] bg-blue-500 rounded-r-full"/>
                        )}
                        <Icon
                          size={15}
                          className={isActive ? 'text-blue-400 shrink-0' : 'text-slate-600 shrink-0'}
                        />
                        {label}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* ── Compact bottom bar ── */}
        <div className="shrink-0 border-t border-white/5 px-2 pt-2 space-y-0.5"
          style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}>

          {/* Row 1: CNIC search + Bell */}
          <div className="flex items-center gap-1">
            {canSearch && (
              <button
                onClick={() => { setSearchOpen(true); setMobileOpen(false); }}
                className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-white/6 transition group text-left min-w-0"
              >
                <Search size={12} className="text-slate-600 shrink-0 group-hover:text-slate-400 transition"/>
                <span className="text-[12px] text-slate-600 group-hover:text-slate-400 flex-1 truncate transition">CNIC khojo</span>
                <kbd className="hidden sm:block text-[9px] text-slate-700 font-mono bg-white/5 px-1 py-0.5 rounded shrink-0">⌃K</kbd>
              </button>
            )}

            {/* Bell */}
            <div className="relative" ref={bellRef}>
              <button
                onClick={() => setShowBell(v => !v)}
                className={`p-2 rounded-xl hover:bg-white/6 transition relative ${!canSearch ? 'flex-1 w-full' : ''}`}
                title="Notifications"
              >
                <Bell size={14} className="text-slate-600"/>
                {totalAlerts > 0 && (
                  <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-red-500 text-white text-[7px] font-black rounded-full flex items-center justify-center leading-none">
                    {totalAlerts > 9 ? '9+' : totalAlerts}
                  </span>
                )}
              </button>
              {showBell && (
                <div className="absolute bottom-full left-0 mb-2 w-64 bg-white border border-gray-200 rounded-2xl shadow-2xl shadow-black/25 overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                    <Bell size={13} className="text-gray-400"/>
                    <p className="text-xs font-semibold text-gray-700">
                      {totalAlerts === 0 ? 'All clear' : `${totalAlerts} alert${totalAlerts !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                  {bellDropdownContent}
                </div>
              )}
            </div>
          </div>

          {/* Row 2: User + Logout */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setShowProfile(true); setMobileOpen(false); }}
              className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-white/6 transition group text-left min-w-0"
            >
              <div className="w-6 h-6 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-slate-300 truncate leading-tight">{user?.name}</p>
                <p className="text-[10px] text-slate-600 truncate leading-tight">{isOwner ? 'Owner' : 'Staff'}</p>
              </div>
            </button>
            <button
              onClick={() => logout()}
              className="p-2 rounded-xl text-slate-600 hover:bg-white/6 hover:text-red-400 transition"
              title="Sign out"
            >
              <LogOut size={13}/>
            </button>
          </div>
        </div>
      </aside>

      {/* ── Content wrapper ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Mobile top bar */}
        <header
          className="lg:hidden sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm flex items-center gap-3 px-4 shrink-0"
          style={{ minHeight: '3.5rem', paddingTop: 'env(safe-area-inset-top)' }}
        >
          <button onClick={() => setMobileOpen(true)} className="p-2 rounded-xl hover:bg-gray-100 transition" aria-label="Open menu">
            <Menu size={20} className="text-gray-600"/>
          </button>
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
              <CreditCard size={11} className="text-white"/>
            </div>
            <p className="font-bold text-gray-900 text-sm tracking-tight truncate">Assaan Electronics</p>
          </div>
          {/* Bell — mobile */}
          <div className="relative" ref={mobileBellRef}>
            <button onClick={() => setShowBell((v) => !v)} className="p-2 rounded-xl hover:bg-gray-100 transition relative" aria-label="Notifications">
              <Bell size={18} className="text-gray-600"/>
              {totalAlerts > 0 && (
                <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-red-500 rounded-full text-white text-[8px] font-bold flex items-center justify-center">
                  {totalAlerts > 9 ? '9+' : totalAlerts}
                </span>
              )}
            </button>
            {showBell && (
              <div className="absolute right-0 top-full mt-1 w-80 max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-700">
                    {totalAlerts === 0 ? 'All clear' : `${totalAlerts} alert${totalAlerts !== 1 ? 's' : ''}`}
                  </p>
                </div>
                {bellDropdownContent}
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto flex flex-col">
          {/* Broadcasts */}
          {visibleBroadcasts.map((b: Broadcast) => {
            const styles: Record<string, string> = {
              info:        'bg-indigo-600 text-white',
              warning:     'bg-amber-500  text-white',
              maintenance: 'bg-red-600    text-white',
              success:     'bg-emerald-600 text-white',
            };
            return (
              <div key={b.id} className={`shrink-0 px-4 py-2.5 flex items-start justify-between gap-3 text-sm ${styles[b.type] ?? styles['info']}`}>
                <div className="flex items-start gap-2 min-w-0">
                  <Megaphone size={14} className="shrink-0 mt-0.5 opacity-80"/>
                  <div className="min-w-0">
                    <span className="font-semibold">{b.title}</span>
                    <span className="ml-2 opacity-90">{b.body}</span>
                  </div>
                </div>
                <button onClick={() => dismissBroadcast(b.id)} className="shrink-0 p-1 rounded-lg hover:bg-white/20 transition opacity-80 hover:opacity-100">
                  <X size={14}/>
                </button>
              </div>
            );
          })}

          {/* Grace period banner */}
          {billingUsage?.inGracePeriod && !billingUsage.hardBlocked && (
            <div className="shrink-0 bg-amber-500 text-white px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2">
                <AlertTriangle size={15} className="shrink-0"/>
                <span>
                  Aapka plan expire ho gaya hai —{' '}
                  <strong>
                    {billingUsage.graceDaysLeft === 0
                      ? 'aaj last day hai'
                      : `${billingUsage.graceDaysLeft} din bache hain`}
                  </strong>{' '}
                  grace period mein. Is ke baad access band ho jaega.
                </span>
              </div>
              <a href="/billing" className="shrink-0 bg-white text-amber-600 font-semibold text-xs px-3 py-1.5 rounded-lg hover:bg-amber-50 transition">
                Renew Karo
              </a>
            </div>
          )}

          {/* Hard block */}
          {billingUsage?.hardBlocked ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center max-w-sm">
                <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle size={28} className="text-red-500"/>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Access Band Ho Gaya</h2>
                <p className="text-sm text-gray-500 mb-6">
                  Aapka plan aur grace period dono expire ho chuke hain. Access dubara hasil karne ke liye
                  admin se contact karein ya plan renew karein.
                </p>
                <a href="/billing" className="inline-block px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition">
                  Billing Page
                </a>
              </div>
            </div>
          ) : (
            <Outlet/>
          )}
        </main>
      </div>

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)}/>}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)}/>
    </div>
  );
}
