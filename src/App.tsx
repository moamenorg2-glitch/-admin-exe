import { useEffect, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { ErrorBoundary } from './components/ErrorBoundary';
import ProtectedRoute from './components/auth/ProtectedRoute';

const Login = lazy(() => import('./pages/Login'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const OrdersList = lazy(() => import('./pages/orders/OrdersList')); // Main Orders List
const UsersList = lazy(() => import('./pages/users/UsersList'));
const VendorsList = lazy(() => import('./pages/vendors/VendorsList'));
const DriversList = lazy(() => import('./pages/drivers/DriversList'));
const PromotionsList = lazy(() => import('./pages/promotions/PromotionsList'));
const FinanceDashboard = lazy(() => import('./pages/finance/FinanceDashboard'));
const ZonesList = lazy(() => import('./pages/zones/ZonesList'));
const NotificationsList = lazy(() => import('./pages/notifications/NotificationsList'));
const ReportsDashboard = lazy(() => import('./pages/reports/ReportsDashboard'));
const SystemSettings = lazy(() => import('./pages/settings/SystemSettings'));
const SupportTickets = lazy(() => import('./pages/support/SupportTickets'));
const SupportChats = lazy(() => import('./pages/support/SupportChats'));
const ReviewsList = lazy(() => import('./pages/reviews/ReviewsList'));
const SearchHistory = lazy(() => import('./pages/search/SearchHistory'));
const ProductsList = lazy(() => import('./pages/products/ProductsList'));
const AuditLogs = lazy(() => import('./pages/audit/AuditLogs'));
const CitiesList = lazy(() => import('./pages/cities/CitiesList'));
const CategoriesList = lazy(() => import('./pages/categories/CategoriesList'));
const PermissionsList = lazy(() => import('./pages/permissions/PermissionsList'));
const DisputesList = lazy(() => import('./pages/disputes/DisputesList'));
const PenaltiesList = lazy(() => import('./pages/penalties/PenaltiesList'));
const TransactionsList = lazy(() => import('./pages/finance/TransactionsList'));
const AdminProfile = lazy(() => import('./pages/profile/AdminProfile'));
const CustomerDashboard = lazy(() => import('./pages/customer/Dashboard'));
const MerchantDashboard = lazy(() => import('./pages/merchant/Dashboard'));
const DriverDashboard = lazy(() => import('./pages/driver/Dashboard'));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
  </div>
);

export default function App() {
  const { checkUser, isLoading } = useAuthStore();

  useEffect(() => {
    checkUser().catch(err => {
      console.error('Initial checkUser failed:', err);
    });
  }, [checkUser]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <HashRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/auth-callback" element={<AuthCallback />} />
          
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/orders" element={<OrdersList />} />
            <Route path="/users" element={<UsersList />} />
            <Route path="/vendors" element={<VendorsList />} />
            <Route path="/drivers" element={<DriversList />} />
            <Route path="/promotions" element={<PromotionsList />} />
            <Route path="/finance" element={<FinanceDashboard />} />
            <Route path="/finance/transactions" element={<TransactionsList />} />
            <Route path="/zones" element={<ZonesList />} />
            <Route path="/notifications" element={<NotificationsList />} />
            <Route path="/reports" element={<ReportsDashboard />} />
            <Route path="/settings" element={<SystemSettings />} />
            <Route path="/support" element={<SupportTickets />} />
            <Route path="/support/chats" element={<SupportChats />} />
            <Route path="/reviews" element={<ReviewsList />} />
            <Route path="/search-history" element={<SearchHistory />} />
            <Route path="/products" element={<ProductsList />} />
            <Route path="/disputes" element={<DisputesList />} />
            <Route path="/penalties" element={<PenaltiesList />} />
            <Route path="/audit" element={<AuditLogs />} />
            <Route path="/cities" element={<CitiesList />} />
            <Route path="/categories" element={<CategoriesList />} />
            <Route path="/permissions" element={<PermissionsList />} />
            <Route path="/profile" element={<AdminProfile />} />
            <Route path="/customer" element={<CustomerDashboard />} />
            <Route path="/merchant" element={<MerchantDashboard />} />
            <Route path="/driver" element={<DriverDashboard />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </HashRouter>
  );
}











