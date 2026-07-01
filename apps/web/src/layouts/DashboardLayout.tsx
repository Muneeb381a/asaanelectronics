import { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard, Package, Users, CreditCard, LogOut, ChevronRight, BarChart3,
  Bell, AlertTriangle, UserCog, ClipboardCheck, Settings, BookOpen, ShieldCheck, RotateCcw, Receipt, Wallet, PhoneCall, Search, Menu, TrendingUp, ShoppingCart, FileDown, Smartphone, Building2,
  ArrowLeftRight, AlertOctagon, Shield,
} from 'lucide-react';
import { useAuthStore } from '../store/auth.store.ts';
import { authApi } from '../api/auth.api.ts';
import { statsApi } from '../api/stats.api.ts';
import { profileApi } from '../api/profile.api.ts';
import ProfileModal from '../components/ProfileModal.tsx';
import GlobalSearch from '../components/GlobalSearch.tsx';

const allNavItems = [
  { to: '/dashboard',    label: 'Dashboard',    icon: LayoutDashboard, end: true      as boolean | undefined, perm: '' as string | string[] },
  { to: '/reports',      label: 'Analytics',    icon: BarChart3,       end: undefined as boolean | undefined, perm: 'canViewReports' as string | string[] },
  { to: '/products',     label: 'Products',     icon: Package,         end: undefined as boolean | undefined, perm: 'canManageProducts' as string | string[] },
  { to: '/customers',    label: 'Customers',    icon: Users,           end: undefined as boolean | undefined, perm: ['canAddCustomer', 'canAddInstallment', 'canRecordPayment'] as string | string[] },
  { to: '/installments', label: 'Installments', icon: CreditCard,      end: undefined as boolean | undefined, perm: ['canAddInstallment', 'canRecordPayment'] as string | string[] },
  { to: '/cash-sales',  label: 'Cash Sales',  icon: ShoppingCart,    end: undefined as boolean | undefined, perm: 'canMakeCashSales' as string | string[] },
  { to: '/expenses',    label: 'Expenses',    icon: Receipt,         end: undefined as boolean | undefined, perm: 'canRecordExpense' as string | string[] },
  { to: '/returns',     label: 'Returns',     icon: RotateCcw,       end: undefined as boolean | undefined, perm: 'canManageReturns' as string | string[] },
  { to: '/imei',        label: 'IMEI',        icon: Smartphone,      end: undefined as boolean | undefined, perm: '__owner__' as string | string[] },
  { to: '/suppliers',   label: 'Suppliers',   icon: Building2,       end: undefined as boolean | undefined, perm: '__owner__' as string | string[] },
];

export default function DashboardLayout() {
  const { user, clearAuth, setPermissions } = useAuthStore();
  const isOwner = user?.role === 'SELLER_OWNER';
  const perms = user?.permissions;
  const navigate = useNavigate();
  const [showProfile,  setShowProfile]  = useState(false);
  const [showBell,     setShowBell]     = useState(false);
  const [searchOpen,   setSearchOpen]   = useState(false);
  const [mobileOpen,   setMobileOpen]   = useState(false);
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

  const overdueCount       = stats?.overdueCount       ?? 0;
  const lowStockItems      = stats?.lowStockItems       ?? [];
  const promisesDue        = stats?.promisesDueCount    ?? 0;
  const guarantorRiskCount = stats?.guarantorRiskCount  ?? 0;
  const totalAlerts        = overdueCount + lowStockItems.length + promisesDue + guarantorRiskCount;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const inDesktop = bellRef.current?.contains(e.target as Node);
      const inMobile  = mobileBellRef.current?.contains(e.target as Node);
      if (!inDesktop && !inMobile) setShowBell(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
      if (e.key === 'Escape') {
        setMobileOpen(false);
        setShowBell(false);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const { mutate: logout } = useMutation({
    mutationFn: () => authApi.logout(localStorage.getItem('refresh_token') ?? ''),
    onSettled: () => { clearAuth(); void navigate('/login'); },
  });

  const initials = user?.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() ?? '?';

  const navItems = [
    ...(isOwner
      ? allNavItems
      : allNavItems.filter(({ perm }) => {
          if (!perm || perm === '') return true; // always show (e.g. Dashboard)
          return Array.isArray(perm)
            ? perm.some((p) => !!perms?.[p as keyof typeof perms])
            : !!perms?.[perm as keyof typeof perms];
        })
    ),
    ...(isOwner
      ? [
          { to: '/recovery',        label: 'Recovery',   icon: PhoneCall,   end: undefined },
          { to: '/recovery-agents', label: 'Agents',     icon: TrendingUp,  end: undefined },
          { to: '/ledger',    label: 'Accounting', icon: BookOpen,    end: undefined },
          { to: '/audit',     label: 'Audit Log',  icon: ShieldCheck, end: undefined },
          { to: '/staff',     label: 'Staff',      icon: UserCog,     end: undefined },
          { to: '/billing',   label: 'Billing',    icon: Wallet,      end: undefined },
          { to: '/exports',       label: 'Exports',       icon: FileDown,        end: undefined },
          { to: '/trade-ins',     label: 'Trade-Ins',     icon: ArrowLeftRight,  end: undefined },
          { to: '/repossessions', label: 'Repossessions', icon: AlertOctagon,    end: undefined },
          { to: '/guarantors',    label: 'Guarantors',    icon: Shield,          end: undefined },
          { to: '/settings',      label: 'Settings',      icon: Settings,        end: undefined },
        ]
      : perms?.canVerifyCustomers
        ? [{ to: '/verifications', label: 'Verifications', icon: ClipboardCheck, end: undefined }]
        : []
    ),
  ];

  const bellDropdownContent = (
    <div className="max-h-64 overflow-y-auto">
      {totalAlerts === 0 && (
        <p className="text-xs text-gray-400 text-center py-5">No alerts right now</p>
      )}
      {overdueCount > 0 && (
        <button
          onClick={() => { navigate('/installments?status=ACTIVE'); setShowBell(false); }}
          className="w-full flex items-start gap-3 px-4 py-3 hover:bg-red-50 transition text-left border-b border-gray-50"
        >
          <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-gray-900">{overdueCount} overdue installment{overdueCount !== 1 ? 's' : ''}</p>
            <p className="text-xs text-gray-400">Requires follow-up</p>
          </div>
        </button>
      )}
      {promisesDue > 0 && (
        <button
          onClick={() => { navigate('/installments'); setShowBell(false); }}
          className="w-full flex items-start gap-3 px-4 py-3 hover:bg-orange-50 transition text-left border-b border-gray-50"
        >
          <AlertTriangle size={14} className="text-orange-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-gray-900">{promisesDue} promise{promisesDue !== 1 ? 's' : ''} due</p>
            <p className="text-xs text-gray-400">Customers promised to pay today</p>
          </div>
        </button>
      )}
      {guarantorRiskCount > 0 && (
        <button
          onClick={() => { navigate('/guarantors'); setShowBell(false); }}
          className="w-full flex items-start gap-3 px-4 py-3 hover:bg-rose-50 transition text-left border-b border-gray-50"
        >
          <Shield size={14} className="text-rose-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-gray-900">{guarantorRiskCount} risky guarantor{guarantorRiskCount !== 1 ? 's' : ''}</p>
            <p className="text-xs text-gray-400">Guarantor ka apna installment overdue hai</p>
          </div>
        </button>
      )}
      {lowStockItems.map((p) => (
        <button
          key={p.id}
          onClick={() => { navigate('/products'); setShowBell(false); }}
          className="w-full flex items-start gap-3 px-4 py-3 hover:bg-amber-50 transition text-left border-b border-gray-50 last:border-0"
        >
          <Package size={14} className="text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-gray-900">{p.name}</p>
            <p className="text-xs text-gray-400">{p.stock === 0 ? 'Out of stock' : `Only ${p.stock} left`}</p>
          </div>
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — fixed overlay on mobile, static on desktop */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-72 lg:w-60 bg-white border-r border-gray-100 flex flex-col shadow-sm transition-transform duration-300 ease-in-out ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* Brand */}
        <div className="px-5 py-5 border-b border-gray-100">
          <p className="font-bold text-gray-900 tracking-tight">Assaan Electronics</p>
          <p className="text-xs text-gray-400 mt-0.5">Installment Manager</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`
              }>
              {({ isActive }) => (
                <>
                  <Icon size={17} className={isActive ? 'text-white' : 'text-gray-400'} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Global CNIC search */}
        {(isOwner || perms?.canSearchCnic) && (
          <div className="px-3 pb-1">
            <button
              onClick={() => { setSearchOpen(true); setMobileOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 hover:bg-indigo-50 border border-gray-100 hover:border-indigo-200 transition group text-left"
            >
              <Search size={15} className="text-gray-400 group-hover:text-indigo-500 transition shrink-0" />
              <span className="text-sm text-gray-400 group-hover:text-indigo-600 flex-1 transition">CNIC search…</span>
              <kbd className="hidden sm:block text-[9px] text-gray-300 group-hover:text-indigo-400 font-mono transition">⌃K</kbd>
            </button>
          </div>
        )}

        {/* Notification bell — desktop sidebar only */}
        <div className="px-3 pb-1 relative hidden lg:block" ref={bellRef}>
          <button
            onClick={() => setShowBell((v) => !v)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition text-left"
          >
            <div className="relative">
              <Bell size={17} className="text-gray-400" />
              {totalAlerts > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {totalAlerts > 9 ? '9+' : totalAlerts}
                </span>
              )}
            </div>
            <span className="text-sm font-medium text-gray-500">Notifications</span>
          </button>

          {showBell && (
            <div className="absolute bottom-full left-3 right-3 mb-1 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-700">
                  {totalAlerts === 0 ? 'All clear' : `${totalAlerts} alert${totalAlerts !== 1 ? 's' : ''}`}
                </p>
              </div>
              {bellDropdownContent}
            </div>
          )}
        </div>

        {/* User section */}
        <div className="p-3 border-t border-gray-100 space-y-1">
          <button onClick={() => { setShowProfile(true); setMobileOpen(false); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition group text-left">
            <div className="w-8 h-8 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            </div>
            <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500 transition" />
          </button>
          <button onClick={() => logout()}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-red-500 hover:bg-red-50 transition">
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Content wrapper */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm flex items-center gap-3 px-4 h-14 shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-xl hover:bg-gray-100 transition"
            aria-label="Open menu"
          >
            <Menu size={20} className="text-gray-600" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-sm tracking-tight">Assaan Electronics</p>
          </div>
          {/* Bell — mobile header */}
          <div className="relative" ref={mobileBellRef}>
            <button
              onClick={() => setShowBell((v) => !v)}
              className="p-2 rounded-xl hover:bg-gray-100 transition relative"
              aria-label="Notifications"
            >
              <Bell size={18} className="text-gray-600" />
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

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
