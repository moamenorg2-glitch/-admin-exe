import { useState, useEffect, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { X, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { navigation } from '../../constants';
import { useAuthStore } from '../../store/authStore';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

interface SidebarProps {
  isOpen: boolean;
  isCollapsed: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, isCollapsed, onClose }: SidebarProps) {
  const { profile } = useAuthStore();
  const location = useLocation();
  const queryClient = useQueryClient();
  const isSuperAdmin = profile?.email === 'moamen.org2@gmail.com';
  const isAdmin = profile?.user_type === 'admin';

  const [openGroups, setOpenGroups] = useState<string[]>([]);

  const { data: permissions } = useQuery({
    queryKey: ['permissions', profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id || isSuperAdmin) return null;
      const { data, error } = await (supabase as any)
        .from('user_permissions')
        .select('permissions(module)')
        .eq('user_id', profile.user_id);
      if (error) throw error;
      
      // Also get permissions where the user is the manager (legacy/fallback)
      const { data: managerData } = await (supabase as any)
        .from('permissions')
        .select('module')
        .eq('manager_id', profile.user_id);
        
      const userModules = data.map((up: any) => up.permissions?.module).filter(Boolean);
      const managerModules = managerData?.map((p: any) => p.module) || [];
      
      return [...new Set([...userModules, ...managerModules])];
    },
    enabled: !!profile?.user_id && !isSuperAdmin,
  });

  // Only super admin or those with 'all_access' permission get full access
  const hasFullAccess = isSuperAdmin || permissions?.includes('all_access');

  const { data: counts } = useQuery({
    queryKey: ['sidebar-counts'],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      const [ticketsRes, chatsRes, disputesRes, ordersRes, usersRes, vendorsRes, driversRes] = await Promise.all([
        supabase.from('support_tickets').select('*', { count: 'exact', head: true }).in('status', ['Open', 'In_Progress']),
        supabase.from('chat_rooms').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('dispute_resolution').select('*', { count: 'exact', head: true }).eq('status', 'Under_Review'),
        supabase.from('master_orders').select('*', { count: 'exact', head: true }).eq('status', 'Pending'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('user_type', 'customer').gt('created_at', todayISO),
        supabase.from('vendor_details').select('*', { count: 'exact', head: true }).gt('created_at', todayISO),
        supabase.from('driver_details').select('*', { count: 'exact', head: true }).gt('created_at', todayISO)
      ]);

      if (ticketsRes.error) throw ticketsRes.error;
      if (chatsRes.error) throw chatsRes.error;
      if (disputesRes.error) throw disputesRes.error;
      if (ordersRes.error) throw ordersRes.error;

      return {
        'الدعم الفني': ticketsRes.count || 0,
        'محادثات الدعم': chatsRes.count || 0,
        'فض النزاعات': disputesRes.count || 0,
        'الطلبات': ordersRes.count || 0,
        'العملاء': usersRes.count || 0,
        'التجار': vendorsRes.count || 0,
        'السائقين': driversRes.count || 0
      };
    },
    refetchInterval: 30000, 
    enabled: !!profile?.user_id,
  });

  useEffect(() => {
    const channel = supabase
      .channel('sidebar-counts-realtime-enhanced-v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => {
        queryClient.invalidateQueries({ queryKey: ['sidebar-counts'] }).catch(console.error);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_rooms' }, () => {
        queryClient.invalidateQueries({ queryKey: ['sidebar-counts'] }).catch(console.error);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dispute_resolution' }, () => {
        queryClient.invalidateQueries({ queryKey: ['sidebar-counts'] }).catch(console.error);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'master_orders' }, () => {
        queryClient.invalidateQueries({ queryKey: ['sidebar-counts'] }).catch(console.error);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profiles' }, () => {
        queryClient.invalidateQueries({ queryKey: ['sidebar-counts'] }).catch(console.error);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vendor_details' }, () => {
        queryClient.invalidateQueries({ queryKey: ['sidebar-counts'] }).catch(console.error);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'driver_details' }, () => {
        queryClient.invalidateQueries({ queryKey: ['sidebar-counts'] }).catch(console.error);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch(err => {
        console.error('Error removing sidebar counts channel:', err);
      });
    };
  }, [queryClient]);

  const filteredNavigation = hasFullAccess 
    ? navigation 
    : navigation.filter(item => item.name === 'الرئيسية' || permissions?.includes(item.name));

  // Group navigation items
  const groupedNavigation = filteredNavigation.reduce((acc, item) => {
    const group = item.group || 'أخرى';
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(item);
    return acc;
  }, {} as Record<string, typeof navigation>);

  // Open the group that contains the current active route
  useEffect(() => {
    if (isCollapsed) return;
    const currentItem = filteredNavigation.find(item => item.href === location.pathname);
    if (currentItem && currentItem.group) {
      setOpenGroups(prev => prev.includes(currentItem.group!) ? prev : [...prev, currentItem.group!]);
    }
  }, [location.pathname, filteredNavigation, isCollapsed]);

  // Calculate group-level counts
  const groupCounts = useMemo(() => {
    if (!counts || !groupedNavigation) return {};
    const gc: Record<string, number> = {};
    Object.entries(groupedNavigation).forEach(([group, items]) => {
      gc[group] = items.reduce((sum, item) => sum + ((counts as any)[item.name] || 0), 0);
    });
    return gc;
  }, [counts, groupedNavigation]);

  const toggleGroup = (group: string) => {
    if (isCollapsed) return;
    setOpenGroups(prev => 
      prev.includes(group) 
        ? prev.filter(g => g !== group)
        : [...prev, group]
    );
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-gray-600 bg-opacity-75 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={cn(
        "fixed inset-y-0 right-0 z-30 bg-[#1E1E2D] flex flex-col h-full transition-all duration-300 ease-in-out lg:relative lg:translate-x-0",
        isOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0",
        isCollapsed ? "w-20" : "w-56"
      )}>
        <div className="h-16 flex items-center justify-between border-b border-gray-800/50 px-6 flex-shrink-0 lg:hidden">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-emerald-500/20 rotate-3">
              Z
            </div>
            <h1 className="text-lg font-black text-white uppercase tracking-tight">
              زاجل
            </h1>
          </div>
          <button onClick={onClose} className="lg:hidden p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-2 custom-scrollbar">
          {Object.entries(groupedNavigation).map(([group, items]) => (
            <div key={`nav-group-${group}`} className="space-y-1">
              {group === 'الرئيسية' ? (
                items.map((item) => (
                  <NavLink
                    key={`nav-item-${item.href}`}
                    to={item.href}
                    title={isCollapsed ? item.name : undefined}
                    onClick={() => window.innerWidth < 1024 && onClose()}
                    className={({ isActive }) =>
                      cn(
                        isActive
                          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                          : 'text-gray-400 hover:bg-emerald-500/10 hover:text-white',
                        'group flex items-center px-3 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 mb-1',
                        isCollapsed && 'justify-center px-0 mx-2'
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <div className="relative flex-shrink-0 flex items-center justify-center">
                          <item.icon
                            className={cn(
                              'h-5 w-5 transition-transform duration-300 group-hover:scale-110',
                              !isCollapsed && 'ml-3',
                              isActive ? 'text-white' : 'text-gray-500 group-hover:text-emerald-400'
                            )}
                            aria-hidden="true"
                          />
                          {counts && (counts as any)[item.name] > 0 && (
                            <span className={cn(
                              "absolute -top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-lg bg-red-500 px-1 text-[10px] font-black text-white shadow-lg shadow-red-500/20 border-2 border-[#1E1E2D]",
                              isCollapsed ? "-right-2" : "right-1"
                            )}>
                              {(counts as any)[item.name]}
                            </span>
                          )}
                        </div>
                        {!isCollapsed && (
                          <div className="flex items-center justify-between flex-1">
                            <span className="tracking-tight">{item.name}</span>
                          </div>
                        )}
                      </>
                    )}
                  </NavLink>
                ))
              ) : (
                <>
                  {!isCollapsed ? (
                    <button
                      onClick={() => toggleGroup(group)}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm font-bold text-gray-400 hover:text-white hover:bg-[#2B2B40] rounded-lg transition-colors group/header"
                    >
                      <div className="flex items-center gap-2">
                        <span>{group}</span>
                        {groupCounts[group] > 0 && (
                          <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white shadow-lg shadow-red-500/20">
                            {groupCounts[group]}
                          </span>
                        )}
                      </div>
                      <ChevronDown 
                        className={cn(
                          "w-4 h-4 transition-transform duration-200",
                          openGroups.includes(group) ? "transform rotate-180" : ""
                        )} 
                      />
                    </button>
                  ) : (
                    <div className="h-px bg-gray-800 my-4 mx-2" />
                  )}
                  
                  <div 
                    className={cn(
                      "space-y-1 overflow-hidden transition-all duration-200 ease-in-out",
                      !isCollapsed && openGroups.includes(group) ? "max-h-96 opacity-100 mt-1" : "max-h-0 opacity-0",
                      isCollapsed && "max-h-none opacity-100"
                    )}
                  >
                    {items.map((item) => (
                      <NavLink
                        key={`nav-sub-item-${item.href}`}
                        to={item.href}
                        title={isCollapsed ? item.name : undefined}
                        onClick={() => window.innerWidth < 1024 && onClose()}
                        className={({ isActive }) =>
                          cn(
                            isActive
                              ? 'bg-emerald-600/10 text-emerald-500 font-bold'
                              : 'text-gray-400 hover:bg-emerald-500/5 hover:text-white',
                            'group flex items-center px-4 py-2 text-sm rounded-xl transition-all duration-300',
                            !isCollapsed && 'mr-4 mb-0.5',
                            isCollapsed && 'justify-center px-0 mb-1'
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <div className="relative flex-shrink-0 flex items-center justify-center">
                              <item.icon
                                className={cn(
                                  'h-4 w-4 transition-transform duration-300 group-hover:scale-110',
                                  !isCollapsed && 'ml-3',
                                  isActive ? 'text-emerald-500' : 'text-gray-500 group-hover:text-emerald-400'
                                )}
                                aria-hidden="true"
                              />
                              {counts && (counts as any)[item.name] > 0 && (
                                <span className={cn(
                                  "absolute -top-2 flex h-[16px] min-w-[16px] items-center justify-center rounded-md bg-red-500 px-1 text-[9px] font-black text-white shadow-lg shadow-red-500/20 border-2 border-[#1E1E2D]",
                                  isCollapsed ? "-right-2" : "right-1"
                                )}>
                                  {(counts as any)[item.name]}
                                </span>
                              )}
                            </div>
                            {!isCollapsed && (
                              <div className="flex items-center justify-between flex-1">
                                <span className="tracking-tight">{item.name}</span>
                              </div>
                            )}
                          </>
                        )}
                      </NavLink>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
