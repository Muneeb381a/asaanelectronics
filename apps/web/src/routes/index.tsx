import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuthStore } from '../store/auth.store.ts';
import { usePortalStore } from '../store/portal.store.ts';
import DashboardLayout from '../layouts/DashboardLayout.tsx';
import OwnerLayout from '../layouts/OwnerLayout.tsx';

// ── Lazy page imports ─────────────────────────────────────────────────────────
// Each page becomes its own JS chunk, loaded only when first navigated to.
const LandingPage           = lazy(() => import('../pages/LandingPage.tsx'));
const LoginPage             = lazy(() => import('../pages/LoginPage.tsx'));
const RegisterPage          = lazy(() => import('../pages/RegisterPage.tsx'));
const SetupPage             = lazy(() => import('../pages/SetupPage.tsx'));
const ForgotPasswordPage    = lazy(() => import('../pages/ForgotPasswordPage.tsx'));
const OnboardingPage        = lazy(() => import('../pages/OnboardingPage.tsx'));
const ContactPage           = lazy(() => import('../pages/ContactPage.tsx'));
const DashboardPage         = lazy(() => import('../pages/DashboardPage.tsx'));
const ProductsPage          = lazy(() => import('../pages/ProductsPage.tsx'));
const CustomersPage         = lazy(() => import('../pages/CustomersPage.tsx'));
const InstallmentsPage      = lazy(() => import('../pages/InstallmentsPage.tsx'));
const ReportsPage           = lazy(() => import('../pages/ReportsPage.tsx'));
const StaffPage             = lazy(() => import('../pages/StaffPage.tsx'));
const VerificationQueuePage = lazy(() => import('../pages/VerificationQueuePage.tsx'));
const SettingsPage          = lazy(() => import('../pages/SettingsPage.tsx'));
const LedgerPage            = lazy(() => import('../pages/LedgerPage.tsx'));
const AuditLogPage          = lazy(() => import('../pages/AuditLogPage.tsx'));
const ReturnsPage           = lazy(() => import('../pages/ReturnsPage.tsx'));
const ExpensesPage          = lazy(() => import('../pages/ExpensesPage.tsx'));
const BillingPage           = lazy(() => import('../pages/BillingPage.tsx'));
const RecoveryPage          = lazy(() => import('../pages/RecoveryPage.tsx'));
const RecoveryAgentsPage    = lazy(() => import('../pages/RecoveryAgentsPage.tsx'));
const CashSalesPage         = lazy(() => import('../pages/CashSalesPage.tsx'));
const ExportsPage           = lazy(() => import('../pages/ExportsPage.tsx'));
const ShopsPage             = lazy(() => import('../pages/owner/ShopsPage.tsx'));
const PortalLoginPage       = lazy(() => import('../pages/portal/PortalLoginPage.tsx'));
const PortalDashboardPage   = lazy(() => import('../pages/portal/PortalDashboardPage.tsx'));
const ImeiPage              = lazy(() => import('../pages/ImeiPage.tsx'));
const DueSheetPage          = lazy(() => import('../pages/DueSheetPage.tsx'));
const SuppliersPage         = lazy(() => import('../pages/SuppliersPage.tsx'));
const TradeInsPage          = lazy(() => import('../pages/TradeInsPage.tsx'));
const RepossessionsPage     = lazy(() => import('../pages/RepossessionsPage.tsx'));
const GuarantorsPage        = lazy(() => import('../pages/GuarantorsPage.tsx'));
const CashFlowPage          = lazy(() => import('../pages/CashFlowPage.tsx'));
const CollectionSheetPage   = lazy(() => import('../pages/CollectionSheetPage.tsx'));
const AgreementPage         = lazy(() => import('../pages/AgreementPage.tsx'));

// ── Fallback loader ────────────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function S({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

// ── Route guards ──────────────────────────────────────────────────────────────
function ProtectedRoute({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'SUPER_ADMIN') return <Navigate to="/owner" replace />;
  if (!user.sellerId) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function PermGuard({ perm, children }: { perm: string | string[]; children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (user?.role === 'SELLER_OWNER') return <>{children}</>;
  const perms = user?.permissions as Record<string, boolean> | null | undefined;
  if (perms === undefined) return null;
  const allowed = Array.isArray(perm)
    ? perm.some((p) => !!perms?.[p])
    : !!perms?.[perm];
  if (!perms || !allowed) return <Navigate to="/verifications" replace />;
  return <>{children}</>;
}

function OwnerRoute({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'SUPER_ADMIN') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function SellerOwnerGuard({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (user?.role !== 'SELLER_OWNER') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function OnboardingRoute({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'SUPER_ADMIN') return <Navigate to="/owner" replace />;
  if (user.sellerId) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function GuestRoute({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <>{children}</>;
  if (user.role === 'SUPER_ADMIN') return <Navigate to="/owner" replace />;
  return <Navigate to="/dashboard" replace />;
}

function PortalAuthRoute({ children }: { children: ReactNode }) {
  const session = usePortalStore((s) => s.session);
  if (!session) return <Navigate to="/portal" replace />;
  return <>{children}</>;
}

function PortalGuestRoute({ children }: { children: ReactNode }) {
  const session = usePortalStore((s) => s.session);
  if (session) return <Navigate to="/portal/dashboard" replace />;
  return <>{children}</>;
}

export const router = createBrowserRouter([
  { path: '/',                element: <S><LandingPage /></S> },
  { path: '/contact',         element: <S><ContactPage /></S> },
  { path: '/setup',           element: <GuestRoute><S><SetupPage /></S></GuestRoute> },
  { path: '/login',           element: <GuestRoute><S><LoginPage /></S></GuestRoute> },
  { path: '/register',        element: <GuestRoute><S><RegisterPage /></S></GuestRoute> },
  { path: '/forgot-password', element: <GuestRoute><S><ForgotPasswordPage /></S></GuestRoute> },
  { path: '/onboarding',      element: <OnboardingRoute><S><OnboardingPage /></S></OnboardingRoute> },
  {
    element: <OwnerRoute><OwnerLayout /></OwnerRoute>,
    children: [
      { path: '/owner', element: <S><ShopsPage /></S> },
    ],
  },
  {
    element: <ProtectedRoute><DashboardLayout /></ProtectedRoute>,
    children: [
      { path: '/dashboard',        element: <S><DashboardPage /></S> },
      { path: '/reports',          element: <PermGuard perm="canViewReports"><S><ReportsPage /></S></PermGuard> },
      { path: '/products',         element: <PermGuard perm="canManageProducts"><S><ProductsPage /></S></PermGuard> },
      { path: '/customers',        element: <PermGuard perm={['canAddCustomer', 'canAddInstallment', 'canRecordPayment']}><S><CustomersPage /></S></PermGuard> },
      { path: '/installments',     element: <PermGuard perm={['canAddInstallment', 'canRecordPayment']}><S><InstallmentsPage /></S></PermGuard> },
      { path: '/cash-sales',       element: <PermGuard perm="canMakeCashSales"><S><CashSalesPage /></S></PermGuard> },
      { path: '/returns',          element: <PermGuard perm="canManageReturns"><S><ReturnsPage /></S></PermGuard> },
      { path: '/expenses',         element: <PermGuard perm="canRecordExpense"><S><ExpensesPage /></S></PermGuard> },
      { path: '/ledger',           element: <SellerOwnerGuard><S><LedgerPage /></S></SellerOwnerGuard> },
      { path: '/audit',            element: <SellerOwnerGuard><S><AuditLogPage /></S></SellerOwnerGuard> },
      { path: '/staff',            element: <SellerOwnerGuard><S><StaffPage /></S></SellerOwnerGuard> },
      { path: '/billing',          element: <SellerOwnerGuard><S><BillingPage /></S></SellerOwnerGuard> },
      { path: '/recovery',         element: <SellerOwnerGuard><S><RecoveryPage /></S></SellerOwnerGuard> },
      { path: '/recovery-agents',  element: <SellerOwnerGuard><S><RecoveryAgentsPage /></S></SellerOwnerGuard> },
      { path: '/exports',          element: <SellerOwnerGuard><S><ExportsPage /></S></SellerOwnerGuard> },
      { path: '/settings',         element: <SellerOwnerGuard><S><SettingsPage /></S></SellerOwnerGuard> },
      { path: '/imei',             element: <SellerOwnerGuard><S><ImeiPage /></S></SellerOwnerGuard> },
      { path: '/suppliers',         element: <SellerOwnerGuard><S><SuppliersPage /></S></SellerOwnerGuard> },
      { path: '/trade-ins',         element: <SellerOwnerGuard><S><TradeInsPage /></S></SellerOwnerGuard> },
      { path: '/repossessions',     element: <SellerOwnerGuard><S><RepossessionsPage /></S></SellerOwnerGuard> },
      { path: '/guarantors',        element: <SellerOwnerGuard><S><GuarantorsPage /></S></SellerOwnerGuard> },
      { path: '/cashflow',          element: <SellerOwnerGuard><S><CashFlowPage /></S></SellerOwnerGuard> },
      { path: '/collection-sheet',  element: <SellerOwnerGuard><S><CollectionSheetPage /></S></SellerOwnerGuard> },
{ path: '/verifications',    element: <S><VerificationQueuePage /></S> },
    ],
  },
  { path: '/due-sheet',          element: <ProtectedRoute><S><DueSheetPage /></S></ProtectedRoute> },
  { path: '/agreement/:id',     element: <ProtectedRoute><S><AgreementPage /></S></ProtectedRoute> },
  { path: '/portal',           element: <PortalGuestRoute><S><PortalLoginPage /></S></PortalGuestRoute> },
  { path: '/portal/dashboard', element: <PortalAuthRoute><S><PortalDashboardPage /></S></PortalAuthRoute> },
  { path: '*', element: <Navigate to="/" replace /> },
]);
