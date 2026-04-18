import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import DashboardLayout from '../layout/DashboardLayout';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { navigation } from '../../constants';

export default function ProtectedRoute() {
  const { user, isAdmin, isLoading, profile } = useAuthStore();
  const location = useLocation();
  const isSuperAdmin = profile?.email === 'moamen.org2@gmail.com';

  const { data: permissions, isLoading: isLoadingPermissions } = useQuery({
    queryKey: ['permissions', profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id || isSuperAdmin) return null;
      
      const [userPermsRes, managerPermsRes] = await Promise.all([
        (supabase as any)
          .from('user_permissions')
          .select('permissions(module)')
          .eq('user_id', profile.user_id),
        (supabase as any)
          .from('permissions')
          .select('module')
          .eq('manager_id', profile.user_id)
      ]);

      if (userPermsRes.error) throw userPermsRes.error;
      if (managerPermsRes.error) throw managerPermsRes.error;

      const userModules = (userPermsRes.data as any[]).map(up => up.permissions?.module).filter(Boolean);
      const managerModules = (managerPermsRes.data as any[]).map(p => p.module) || [];

      return [...new Set([...userModules, ...managerModules])];
    },
    enabled: !!profile?.user_id && !isSuperAdmin,
  });

  if (isLoading || isLoadingPermissions) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <Navigate to="/login" replace />;
  }

  // Check module permissions
  // Only super admin or those with 'all_access' permission get full access
  const hasFullAccess = isSuperAdmin || permissions?.includes('all_access');
  
  if (!hasFullAccess && location.pathname !== '/') {
    const currentNavItem = navigation.find(item => item.href === location.pathname);
    if (currentNavItem && !permissions?.includes(currentNavItem.name)) {
      return <Navigate to="/" replace />;
    }
  }

  return (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  );
}
