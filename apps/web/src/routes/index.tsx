import { createBrowserRouter, Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuthStore } from '../store/auth.store.ts';
import { usePortalStore } from '../store/portal.store.ts';
import DashboardLayout from '../layouts/DashboardLayout.tsx';
import OwnerLayout from '../layouts/OwnerLayout.tsx';
import LandingPage from '../pages/LandingPage.tsx';
import LoginPage from '../pages/LoginPage.tsx';
import RegisterPage from '../pages/RegisterPage.tsx';
import SetupPage from '../pages/SetupPage.tsx';
import ForgotPasswordPage from '../pages/ForgotPasswordPage.tsx';
import OnboardingPage from '../pages/OnboardingPage.tsx';
import DashboardPage from '../pages/DashboardPage.tsx';
import ProductsPage from '../pages/ProductsPage.tsx';
import CustomersPage from '../pages/CustomersPage.tsx';
import InstallmentsPage from '../pages/InstallmentsPage.tsx';
import ShopsPage from '../pages/owner/ShopsPage.tsx';
import ContactPage from '../pages/ContactPage.tsx';
import ReportsPage from '../pages/ReportsPage.tsx';
import StaffPage from '../pages/StaffPage.tsx';
import VerificationQueuePage from '../pages/VerificationQueuePage.tsx';
import SettingsPage from '../pages/SettingsPage.tsx';
import LedgerPage from '../pages/LedgerPage.tsx';
import AuditLogPage from '../pages/AuditLogPage.tsx';
import ReturnsPage from '../pages/ReturnsPage.tsx';
import ExpensesPage from '../pages/ExpensesPage.tsx';
import BillingPage from '../pages/BillingPage.tsx';
import RecoveryPage from '../pages/RecoveryPage.tsx';
import RecoveryAgentsPage from '../pages/RecoveryAgentsPage.tsx';
import CashSalesPage from '../pages/CashSalesPage.tsx';
import ExportsPage from '../pages/ExportsPage.tsx';
import PortalLoginPage from '../pages/portal/PortalLoginPage.tsx';
import PortalDashboardPage from '../pages/portal/PortalDashboardPage.tsx';

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

// Guards routes that only SELLER_OWNER should access
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
  { path: '/',                element: <LandingPage /> },
  { path: '/contact',         element: <ContactPage /> },
  { path: '/setup',           element: <GuestRoute><SetupPage /></GuestRoute> },
  { path: '/login',           element: <GuestRoute><LoginPage /></GuestRoute> },
  { path: '/register',        element: <GuestRoute><RegisterPage /></GuestRoute> },
  { path: '/forgot-password', element: <GuestRoute><ForgotPasswordPage /></GuestRoute> },
  { path: '/onboarding',      element: <OnboardingRoute><OnboardingPage /></OnboardingRoute> },
  {
    element: <OwnerRoute><OwnerLayout /></OwnerRoute>,
    children: [
      { path: '/owner', element: <ShopsPage /> },
    ],
  },
  {
    element: <ProtectedRoute><DashboardLayout /></ProtectedRoute>,
    children: [
      { path: '/dashboard',      element: <PermGuard perm="canAddCustomer"><DashboardPage /></PermGuard> },
      { path: '/reports',        element: <PermGuard perm="canViewReports"><ReportsPage /></PermGuard> },
      { path: '/products',       element: <PermGuard perm="canManageProducts"><ProductsPage /></PermGuard> },
      { path: '/customers',      element: <PermGuard perm={['canAddCustomer', 'canAddInstallment', 'canRecordPayment']}><CustomersPage /></PermGuard> },
      { path: '/installments',   element: <PermGuard perm={['canAddInstallment', 'canRecordPayment']}><InstallmentsPage /></PermGuard> },
      { path: '/cash-sales',     element: <PermGuard perm="canMakeCashSales"><CashSalesPage /></PermGuard> },
      { path: '/returns',        element: <SellerOwnerGuard><ReturnsPage /></SellerOwnerGuard> },
      { path: '/expenses',       element: <SellerOwnerGuard><ExpensesPage /></SellerOwnerGuard> },
      { path: '/ledger',         element: <SellerOwnerGuard><LedgerPage /></SellerOwnerGuard> },
      { path: '/audit',          element: <SellerOwnerGuard><AuditLogPage /></SellerOwnerGuard> },
      { path: '/staff',          element: <SellerOwnerGuard><StaffPage /></SellerOwnerGuard> },
      { path: '/billing',        element: <SellerOwnerGuard><BillingPage /></SellerOwnerGuard> },
      { path: '/recovery',       element: <SellerOwnerGuard><RecoveryPage /></SellerOwnerGuard> },
      { path: '/recovery-agents',element: <SellerOwnerGuard><RecoveryAgentsPage /></SellerOwnerGuard> },
      { path: '/exports',         element: <SellerOwnerGuard><ExportsPage /></SellerOwnerGuard> },
      { path: '/settings',       element: <SellerOwnerGuard><SettingsPage /></SellerOwnerGuard> },
      { path: '/verifications',  element: <VerificationQueuePage /> },
    ],
  },
  { path: '/portal',           element: <PortalGuestRoute><PortalLoginPage /></PortalGuestRoute> },
  { path: '/portal/dashboard', element: <PortalAuthRoute><PortalDashboardPage /></PortalAuthRoute> },
  { path: '*', element: <Navigate to="/" replace /> },
]);
