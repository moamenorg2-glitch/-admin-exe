import { useAuthStore } from '../../store/authStore';
import { LogOut, User as UserIcon, Menu, Sun, Moon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import NotificationBell from './NotificationBell';
import { cn } from '../../lib/utils';

interface HeaderProps {
  onToggleSidebar: () => void;
  onToggleCollapse: () => void;
  isCollapsed: boolean;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export default function Header({ 
  onToggleSidebar, 
  onToggleCollapse, 
  isCollapsed,
  isDarkMode,
  onToggleDarkMode
}: HeaderProps) {
  const { profile, signOut } = useAuthStore();

  const { data: settings } = useQuery({
    queryKey: ['system-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('appLogo, app_name')
        .single();
      if (error) throw error;
      return data;
    }
  });

  return (
    <header className="h-16 bg-[#1E1E2D] shadow-sm flex items-center justify-between px-6 z-20 border-b border-gray-800/50 backdrop-blur-sm sticky top-0">
      <div className="flex items-center gap-4">
        <button 
          onClick={onToggleSidebar}
          className="p-2 text-gray-400 hover:text-white hover:bg-emerald-500/10 rounded-xl transition-all lg:hidden"
        >
          <Menu className="w-6 h-6" />
        </button>

        <button 
          onClick={onToggleCollapse}
          className="p-2 text-gray-400 hover:text-white hover:bg-emerald-500/10 rounded-xl transition-all hidden lg:block"
          title={isCollapsed ? "توسيع القائمة" : "طي القائمة"}
        >
          <Menu className={cn("w-6 h-6 transition-transform", isCollapsed && "rotate-180")} />
        </button>
        
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-emerald-500/20 rotate-3">
            Z
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-lg font-black text-white tracking-tight uppercase">
              زاجل إكسبريس
            </span>
            <span className="text-[10px] text-emerald-500 font-black uppercase tracking-[0.2em] opacity-80">
              {settings?.app_name || 'Admin Panel'}
            </span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <NotificationBell />

        {/* Dark Mode Toggle */}
        <button
          onClick={onToggleDarkMode}
          className="p-2.5 text-gray-400 hover:text-emerald-500 hover:bg-[#2B2B40] rounded-xl transition-all duration-300 group"
          title={isDarkMode ? "الوضع الفاتح" : "الوضع الداكن"}
        >
          {isDarkMode ? (
            <Sun className="w-5 h-5 group-hover:rotate-45 transition-transform" />
          ) : (
            <Moon className="w-5 h-5 group-hover:-rotate-12 transition-transform" />
          )}
        </button>

        <Link to="/profile" className="flex items-center gap-3 text-sm text-gray-300 hover:bg-[#2B2B40] hover:text-white p-1 pr-3 rounded-xl transition-all group border border-transparent hover:border-emerald-500/30">
          <div className="flex flex-col items-end leading-none">
            <span className="font-bold text-[13px] text-white group-hover:text-emerald-400 transition-colors uppercase">{profile?.full_name?.split(' ')[0] || 'المشرف'}</span>
            <span className="text-[9px] text-gray-500 mt-0.5 font-bold">{profile?.user_type === 'admin' ? 'مدير النظام' : 'صلاحية محدودة'}</span>
          </div>
          <div className="w-9 h-9 bg-emerald-500/10 rounded-xl flex items-center justify-center overflow-hidden border border-emerald-500/20 group-hover:border-emerald-500/50 transition-all">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <UserIcon className="w-5 h-5 text-emerald-500" />
            )}
          </div>
        </Link>
        
        <button
          onClick={signOut}
          className="p-2.5 text-gray-400 hover:text-white hover:bg-red-500 rounded-xl transition-all group"
          title="تسجيل الخروج"
        >
          <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
        </button>
      </div>
    </header>
  );
}
