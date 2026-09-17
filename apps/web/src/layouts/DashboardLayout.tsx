import { useState, useRef, useEffect, useCallback } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard, Package, Users, CreditCard, LogOut, BarChart3,
  Bell, AlertTriangle, UserCog, ClipboardCheck, Settings, BookOpen, ShieldCheck,
  RotateCcw, Receipt, Wallet, PhoneCall, Search, Menu, X, TrendingUp, ShoppingCart,
  FileDown, Building2, ArrowLeftRight, AlertOctagon, Shield, Megaphone, CalendarDays,
  ClipboardList, ChevronDown, UserCircle, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import { useAuthStore } from '../store/auth.store.ts';
import { authApi } from '../api/auth.api.ts';
import { statsApi } from '../api/stats.api.ts';
import { sellersApi } from '../api/sellers.api.ts';
import { setTimezone } from '../utils/dateFormat.ts';
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
  icon:   React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  end?:   boolean;
  perm:   string | string[];
  group:  NavGroup;
}

const ALL_NAV: NavItemDef[] = [
  { to: '/dashboard',        label: 'Dashboard',        icon: LayoutDashboard, end: true, perm: '',                                                       group: 'core'       },
  { to: '/reports',          label: 'Analytics',        icon: BarChart3,                  perm: 'canViewReports',                                         group: 'finance'    },
  { to: '/ledger',           label: 'Accounting',       icon: BookOpen,                   perm: '__owner__',                                              group: 'finance'    },
  { to: '/expenses',         label: 'Expenses',         icon: Receipt,                    perm: 'canRecordExpense',                                       group: 'finance'    },
  { to: '/cashflow',         label: 'Cash Flow',        icon: CalendarDays,               perm: 'canViewReports',                                              group: 'finance'    },
  { to: '/products',         label: 'Products',         icon: Package,                    perm: 'canManageProducts',                                      group: 'catalog'    },
  { to: '/stock-receive',    label: 'Stock Receive',    icon: Package,                    perm: 'canManageProducts',                                      group: 'catalog'    },
  { to: '/suppliers',        label: 'Suppliers',        icon: Building2,                  perm: 'canManageSuppliers',                                              group: 'catalog'    },
  { to: '/imei',             label: 'Serials / IMEI',   icon: Package,                    perm: 'canManageProducts',                                              group: 'catalog'    },
  { to: '/customers',        label: 'Customers',        icon: Users,                      perm: ['canAddCustomer','canAddInstallment','canRecordPayment'], group: 'customers'  },
  { to: '/installments',     label: 'Installments',     icon: CreditCard,                 perm: ['canAddInstallment','canRecordPayment'],                  group: 'customers'  },
  { to: '/cash-sales',       label: 'Cash Sales',       icon: ShoppingCart,               perm: 'canMakeCashSales',                                       group: 'customers'  },
  { to: '/guarantors',       label: 'Guarantors',       icon: Shield,                     perm: '__owner__',                                              group: 'customers'  },
  { to: '/recovery',         label: 'Recovery',         icon: PhoneCall,                  perm: 'canManageRecovery',                                              group: 'operations' },
  { to: '/recovery-agents',  label: 'Agents',           icon: TrendingUp,                 perm: '__owner__',                                              group: 'operations' },
  { to: '/returns',          label: 'Returns',          icon: RotateCcw,                  perm: 'canManageReturns',                                       group: 'operations' },
  { to: '/trade-ins',        label: 'Trade-Ins',        icon: ArrowLeftRight,             perm: 'canManageTradeIns',                                              group: 'operations' },
  { to: '/repossessions',    label: 'Repossessions',    icon: AlertOctagon,               perm: 'canManageTradeIns',                                              group: 'operations' },
  { to: '/collection-sheet', label: 'Field Sheet',      icon: ClipboardList,              perm: ['canRecordPayment','canManageRecovery'],                                              group: 'reporting'  },
  { to: '/exports',          label: 'Exports',          icon: FileDown,                   perm: 'canExportData',                                              group: 'reporting'  },
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
  // Desktop-only icon rail; remembered per browser.
  const [collapsed, setCollapsed] = useState<boolean>(() => { try { return localStorage.getItem('sidebar-collapsed') === '1'; } catch { return false; } });
  const toggleCollapsed = useCallback(() => setCollapsed((c) => { try { localStorage.setItem('sidebar-collapsed', c ? '0' : '1'); } catch { /* private mode */ } return !c; }), []);
  const bellRef     = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const location = useLocation();

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

  const { data: shopMe } = useQuery({
    queryKey: ['shop-me'],
    queryFn: sellersApi.getMe,
    staleTime: 5 * 60_000,
    enabled: !!user?.sellerId,
  });
  useEffect(() => {
    setTimezone(shopMe?.settings?.timezone ?? 'Asia/Karachi');
  }, [shopMe?.settings?.timezone]);

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

  // Counts shown inline on nav items so problems are visible without opening the bell.
  const navBadges: Record<string, { count: number; cls: string; dot: string }> = {};
  if (pendingApprovalCount > 0)  navBadges['/installments'] = { count: pendingApprovalCount,  cls: 'bg-violet-500/20 text-violet-300', dot: 'bg-violet-400' };
  else if (overdueCount > 0)     navBadges['/installments'] = { count: overdueCount,          cls: 'bg-red-500/20 text-red-300',       dot: 'bg-red-500'    };
  if (overdueCount > 0)          navBadges['/recovery']     = { count: overdueCount,          cls: 'bg-red-500/20 text-red-300',       dot: 'bg-red-500'    };
  if (promisesDue > 0)           navBadges['/collection-sheet'] = { count: promisesDue,       cls: 'bg-orange-500/20 text-orange-300', dot: 'bg-orange-400' };
  if (lowStockItems.length > 0)  navBadges['/products']     = { count: lowStockItems.length,  cls: 'bg-amber-500/20 text-amber-300',   dot: 'bg-amber-400'  };
  if (guarantorRiskCount > 0)    navBadges['/guarantors']   = { count: guarantorRiskCount,    cls: 'bg-rose-500/20 text-rose-300',     dot: 'bg-rose-400'   };
  if (budgetAlertsCount > 0)     navBadges['/expenses']     = { count: budgetAlertsCount,     cls: 'bg-orange-500/20 text-orange-300', dot: 'bg-orange-400' };

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!bellRef.current?.contains(e.target as Node)) setShowBell(false);
      if (!userMenuRef.current?.contains(e.target as Node)) setShowUserMenu(false);
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
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        toggleCollapsed();
      }
      if (e.key === 'Escape') { setMobileOpen(false); setShowBell(false); setShowUserMenu(false); }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [canSearch, toggleCollapsed]);

  useEffect(() => {
    if (mobileOpen) document.body.classList.add('mobile-menu-open');
    else            document.body.classList.remove('mobile-menu-open');
    return () => document.body.classList.remove('mobile-menu-open');
  }, [mobileOpen]);

  const qc = useQueryClient();
  const { mutate: logout } = useMutation({
    mutationFn: () => authApi.logout(localStorage.getItem('refresh_token') ?? ''),
    // Clear cache so the next login (possibly another shop) never sees stale tenant data.
    onSettled:  () => { clearAuth(); qc.clear(); void navigate('/login'); },
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

  const EXTRA_TITLES: Record<string, string> = { '/due-sheet': 'Due Sheet', '/agreement': 'Agreement', '/stock-receive': 'Stock Receive' };
  const pageTitle =
    ALL_NAV.find((n) => (n.end ? location.pathname === n.to : location.pathname.startsWith(n.to)))?.label
    ?? Object.entries(EXTRA_TITLES).find(([p]) => location.pathname.startsWith(p))?.[1]
    ?? 'Assaan Electronics';

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
    <div className="min-h-screen bg-canvas flex">

      {/* Mobile backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden transition-opacity duration-300 ${mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      {/* ── Sidebar ── */}
      <aside
        className={`fixed lg:sticky lg:top-0 lg:h-screen inset-y-0 left-0 z-50 bg-slate-950 flex flex-col shrink-0 transition-[transform,width] duration-300 ease-in-out w-72 ${collapsed ? 'lg:w-[72px]' : 'lg:w-64'} ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        aria-label="Main navigation"
      >
        {/* Brand */}
        <div className={`h-14 flex items-center gap-3 px-4 border-b border-white/[0.06] shrink-0 ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}>
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <CreditCard size={15} className="text-white"/>
          </div>
          <div className={`min-w-0 flex-1 ${collapsed ? 'lg:hidden' : ''}`}>
            <p className="font-semibold text-white text-[13px] leading-tight truncate">{shopMe?.shopName ?? 'Assaan Electronics'}</p>
            <p className="text-[10px] text-slate-500 leading-tight mt-0.5 truncate">
              {isOwner ? (billingUsage?.planLabel ? `${billingUsage.planLabel} plan` : 'Owner') : 'Staff account'}
            </p>
          </div>
          <button onClick={() => setMobileOpen(false)} className="lg:hidden p-1.5 rounded-lg hover:bg-white/10 transition" aria-label="Close menu">
            <X size={16} className="text-slate-400"/>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 min-h-0 px-3 py-4 overflow-y-auto overflow-x-hidden scrollbar-thin">
          {groupedNav.map((group, gi) => (
            <div key={group.key} className={gi > 0 ? 'mt-5' : ''}>
              {group.label && (
                <>
                  <p className={`text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 px-3 mb-2 select-none ${collapsed ? 'lg:hidden' : ''}`}>{group.label}</p>
                  <div className={`hidden ${collapsed ? 'lg:block' : ''} mx-2 mb-2 border-t border-white/[0.06]`}/>
                </>
              )}
              <div className="space-y-px">
                {group.items.map(({ to, label, icon: Icon, end }) => {
                  const badge = navBadges[to];
                  return (
                    <NavLink
                      key={to}
                      to={to}
                      end={end}
                      onClick={() => setMobileOpen(false)}
                      title={collapsed ? (badge ? `${label} (${badge.count})` : label) : undefined}
                      className={({ isActive }) =>
                        `group relative flex items-center gap-3 rounded-lg text-[13px] px-3 py-[7px] transition-colors ${collapsed ? 'lg:justify-center lg:px-0 lg:py-2.5' : ''} ${
                          isActive ? 'bg-white/10 text-white font-semibold' : 'text-slate-400 font-medium hover:bg-white/5 hover:text-slate-100'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span className="relative shrink-0">
                            <Icon size={16} strokeWidth={isActive ? 2.25 : 1.75} className={isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300 transition-colors'}/>
                            {badge && <span className={`hidden ${collapsed ? 'lg:block' : ''} absolute -top-1 -right-1 w-2 h-2 rounded-full ring-2 ring-slate-950 ${badge.dot}`}/>}
                          </span>
                          <span className={`flex-1 truncate ${collapsed ? 'lg:hidden' : ''}`}>{label}</span>
                          {badge && (
                            <span className={`${collapsed ? 'lg:hidden' : ''} min-w-[20px] text-center text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums ${badge.cls}`}>
                              {badge.count > 99 ? '99+' : badge.count}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* ── Content wrapper ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* ── Top bar ── */}
        <header
          className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-200 flex items-center gap-2 px-3 sm:px-5 shrink-0"
          style={{ minHeight: '3.5rem', paddingTop: 'env(safe-area-inset-top)' }}
        >
          <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition" aria-label="Open menu">
            <Menu size={20} className="text-gray-700"/>
          </button>
          <button
            onClick={toggleCollapsed}
            title={collapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
            className="hidden lg:inline-flex p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition"
          >
            {collapsed ? <PanelLeftOpen size={18}/> : <PanelLeftClose size={18}/>}
          </button>

          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-gray-900 truncate leading-tight">{pageTitle}</p>
            <p className="lg:hidden text-[11px] text-gray-400 truncate leading-tight">{shopMe?.shopName ?? 'Assaan Electronics'}</p>
          </div>

          {canSearch && (
            <>
              <button
                onClick={() => setSearchOpen(true)}
                className="hidden md:flex items-center gap-2 w-60 xl:w-72 px-3 py-2 bg-gray-100 hover:bg-gray-200/70 rounded-xl text-left text-sm text-gray-500 transition"
              >
                <Search size={15} className="text-gray-400 shrink-0"/>
                <span className="flex-1 truncate">Customer, CNIC ya phone…</span>
                <kbd className="text-[10px] text-gray-400 font-mono bg-white border border-gray-200 px-1.5 py-0.5 rounded">Ctrl K</kbd>
              </button>
              <button onClick={() => setSearchOpen(true)} className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition" aria-label="Search">
                <Search size={19} className="text-gray-700"/>
              </button>
            </>
          )}

          {/* Notifications */}
          <div className="relative" ref={bellRef}>
            <button onClick={() => { setShowBell((v) => !v); setShowUserMenu(false); }} className="p-2 rounded-lg hover:bg-gray-100 transition relative" aria-label="Notifications" title="Notifications">
              <Bell size={19} className="text-gray-700"/>
              {totalAlerts > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-red-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white">
                  {totalAlerts > 9 ? '9+' : totalAlerts}
                </span>
              )}
            </button>
            {showBell && (
              <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-1.5rem)] bg-white border border-gray-200 rounded-2xl shadow-xl shadow-black/10 overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-700">{totalAlerts === 0 ? 'All clear' : `${totalAlerts} alert${totalAlerts !== 1 ? 's' : ''}`}</p>
                  {totalAlerts > 0 && <span className="text-[10px] text-gray-400">Click to open</span>}
                </div>
                {bellDropdownContent}
              </div>
            )}
          </div>

          {/* User menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => { setShowUserMenu((v) => !v); setShowBell(false); }}
              className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-gray-100 transition"
              aria-haspopup="menu" aria-expanded={showUserMenu}
            >
              <div className="w-8 h-8 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[11px] font-bold shrink-0">
                {initials}
              </div>
              <div className="hidden sm:block text-left min-w-0 max-w-[140px]">
                <p className="text-[13px] font-semibold text-gray-900 truncate leading-tight">{user?.name}</p>
                <p className="text-[10px] text-gray-400 leading-tight">{isOwner ? 'Owner' : 'Staff'}</p>
              </div>
              <ChevronDown size={14} className={`hidden sm:block text-gray-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`}/>
            </button>
            {showUserMenu && (
              <div role="menu" className="absolute right-0 top-full mt-2 w-64 bg-white border border-gray-200 rounded-2xl shadow-xl shadow-black/10 overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">{initials}</div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{user?.name}</p>
                    <p className="text-[11px] text-gray-400 truncate">{user?.email ?? (isOwner ? 'Shop owner' : 'Staff member')}</p>
                  </div>
                </div>
                <div className="py-1.5">
                  <button role="menuitem" onClick={() => { setShowUserMenu(false); setShowProfile(true); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition text-left">
                    <UserCircle size={16} className="text-gray-400"/> My profile
                  </button>
                  {isOwner && (
                    <>
                      <button role="menuitem" onClick={() => { setShowUserMenu(false); navigate('/settings'); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition text-left">
                        <Settings size={16} className="text-gray-400"/> Settings
                      </button>
                      <button role="menuitem" onClick={() => { setShowUserMenu(false); navigate('/billing'); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition text-left">
                        <Wallet size={16} className="text-gray-400"/> Billing & plan
                        {billingUsage?.planLabel && <span className="ml-auto text-[10px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{billingUsage.planLabel}</span>}
                      </button>
                    </>
                  )}
                </div>
                <div className="border-t border-gray-100 py-1.5">
                  <button role="menuitem" onClick={() => { setShowUserMenu(false); logout(); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition text-left">
                    <LogOut size={16}/> Sign out
                  </button>
                </div>
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
              <NavLink to="/billing" className="shrink-0 bg-white text-amber-600 font-semibold text-xs px-3 py-1.5 rounded-lg hover:bg-amber-50 transition">
                Renew Karo
              </NavLink>
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
                <NavLink to="/billing" className="inline-block px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition">
                  Billing Page
                </NavLink>
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
