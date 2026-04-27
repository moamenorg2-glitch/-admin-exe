import { useAuthStore } from '../../store/authStore';
import { LogOut, User as UserIcon, Menu, Sun, Moon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import NotificationBell from './NotificationBell';

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
    <header className="h-16 bg-[#0a0a0c] shadow-sm flex items-center justify-between px-6 z-20 border-b border-white/5">
      <div className="flex items-center gap-4">
        <button 
          onClick={onToggleSidebar}
          className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-md transition-colors lg:hidden"
        >
          <Menu className="w-6 h-6" />
        </button>

        <button 
          onClick={onToggleCollapse}
          className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-md transition-colors hidden lg:block"
          title={isCollapsed ? "توسيع القائمة" : "طي القائمة"}
        >
          <Menu className="w-6 h-6" />
        </button>
        
        <div className="flex items-center gap-3">
          {settings?.appLogo ? (
            <img 
              src={settings.appLogo} 
              alt="Logo" 
              className="h-10 w-auto object-contain rounded-full"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-9 h-9 bg-emerald-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-sm shadow-emerald-500/20">
              Z
            </div>
          )}
          <div className="flex flex-col leading-tight">
            <span className="text-lg font-bold text-white tracking-tight">
              زاجل إكسبريس
            </span>
            <span className="text-[10px] text-emerald-500 font-semibold uppercase tracking-wider">
              {settings?.app_name || 'Zajel Express'}
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
          className="p-2 text-gray-400 hover:text-emerald-500 hover:bg-white/5 rounded-full transition-all duration-300"
          title={isDarkMode ? "الوضع الفاتح" : "الوضع الداكن"}
        >
          {isDarkMode ? (
            <Sun className="w-5 h-5" />
          ) : (
            <Moon className="w-5 h-5" />
          )}
        </button>

        <Link to="/profile" className="flex items-center gap-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white p-1.5 rounded-lg transition-colors">
          <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center overflow-hidden border border-gray-700">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <UserIcon className="w-4 h-4 text-gray-500" />
            )}
          </div>
          <span className="font-medium hidden sm:inline">{profile?.full_name || 'مسؤول النظام'}</span>
        </Link>
        
        <button
          onClick={signOut}
          className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-full transition-colors"
          title="تسجيل الخروج"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
