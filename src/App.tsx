import { useEffect, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { ErrorBoundary } from './components/ErrorBoundary';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

// Check for missing Supabase configuration at startup
const isMissingSupabase = !import.meta.env.VITE_SUPABASE_ANON_KEY;

const MissingConfigWarning = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <div className="bg-white p-8 rounded-2xl shadow-xl max-w-lg w-full text-center border-2 border-red-500">
      <h1 className="text-2xl font-bold text-red-600 mb-4">تنقل ناقص (Missing Configuration)</h1>
      <p className="text-gray-700 mb-4">
        لم يتم العثور على مفتاح <strong>VITE_SUPABASE_ANON_KEY</strong> أثناء عملية البناء من GitHub Actions.
      </p>
      <p className="text-gray-600 text-sm bg-red-50 p-4 rounded-xl border border-red-100 text-right" dir="rtl">
        لحل هذه المشكلة:<br/>
        1. اذهب إلى إعدادات المستودع في GitHub (Settings &gt; Secrets and variables &gt; Actions).<br/>
        2. تأكد من إضافة <code>VITE_SUPABASE_ANON_KEY</code> و <code>VITE_SUPABASE_URL</code> بالقيم الصحيحة من لوحة تحكم Supabase.<br/>
        3. قم بإعادة تشغيل مسار العمل (Re-run Workflow) وسيتم إنشاء تطبيق أندرويد يعمل بشكل صحيح.
      </p>
    </div>
  </div>
);

const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const OrdersList = lazy(() => import('./pages/orders/OrdersList'));
const UsersList = lazy(() => import('./pages/users/UsersList'));
const VendorsList = lazy(() => import('./pages/vendors/VendorsList'));
const DriversList = lazy(() => import('./pages/drivers/DriversList'));
const PromotionsList = lazy(() => import('./pages/promotions/PromotionsList'));
const FinanceDashboard = lazy(() => import('./pages/finance/FinanceDashboard'));
const ZonesList = lazy(() => import('./pages/zones/ZonesList'));
const LiveMap = lazy(() => import('./pages/zones/LiveMap'));
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
  <div className="min-h-screen flex flex-col items-center justify-center bg-[#F3F6F9] dark:bg-[#151521]">
    <div className="relative w-20 h-20 mb-4">
      <div className="absolute inset-0 border-4 border-emerald-100 dark:border-emerald-900 rounded-full"></div>
      <div className="absolute inset-0 border-4 border-emerald-600 rounded-full border-t-transparent animate-spin"></div>
    </div>
    <div className="flex flex-col items-center gap-2">
      <h2 className="text-lg font-black text-slate-800 dark:text-white" dir="rtl">زاجل إكسبريس</h2>
      <p className="text-xs text-slate-400 font-medium animate-pulse">جاري تحميل البيانات...</p>
    </div>
  </div>
);

export default function App() {
  const { checkUser, isLoading } = useAuthStore();

  useEffect(() => {
    // Only check user if Supabase is properly configured
    if (!isMissingSupabase) {
      checkUser().catch(err => {
        console.error('Initial checkUser failed:', err);
      });
    }
  }, [checkUser]);

  if (isMissingSupabase) {
    return <MissingConfigWarning />;
  }

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
            <Route path="/users" element={<UsersList fixedRole="customer" />} />
            <Route path="/admins" element={<UsersList fixedRole="admin" />} />
            <Route path="/vendors" element={<VendorsList />} />
            <Route path="/drivers" element={<DriversList />} />
            <Route path="/promotions" element={<PromotionsList />} />
            <Route path="/finance" element={<FinanceDashboard />} />
            <Route path="/finance/transactions" element={<TransactionsList />} />
            <Route path="/map" element={<LiveMap />} />
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











