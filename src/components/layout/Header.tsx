import { useAuthStore } from '../../store/authStore';
import { User as UserIcon, Menu, Sun, Moon } from 'lucide-react';
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
  const { profile } = useAuthStore();

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
    <header className={cn(
      "h-16 w-full flex items-center justify-between px-4 sm:px-6 z-20 border-b sticky top-0 transition-colors duration-300",
      isDarkMode ? "bg-[#1E1E2D] border-gray-800 shadow-lg shadow-black/20" : "bg-[#F7F4EC] border-[#E9E2D0] shadow-md transition-shadow duration-300"
    )}>
      <div className="flex items-center h-full gap-4">
        <button 
          onClick={onToggleSidebar}
          className={cn(
             "p-2 rounded-xl transition-all lg:hidden flex items-center justify-center",
             isDarkMode ? "text-gray-400 hover:text-white hover:bg-[#5F6F52]" : "text-[#7C755E] hover:text-white hover:bg-[#5F6F52]"
          )}
        >
          <Menu className="w-5 h-5 sm:w-6 h-6" />
        </button>

        <button 
          onClick={onToggleCollapse}
          className={cn(
            "p-2 rounded-xl transition-all hidden lg:flex items-center justify-center",
            isDarkMode ? "text-gray-400 hover:text-white hover:bg-[#5F6F52]" : "text-[#7C755E] hover:text-white hover:bg-[#5F6F52]"
          )}
          title={isCollapsed ? "توسيع القائمة" : "طي القائمة"}
        >
          <Menu className={cn("w-6 h-6 transition-transform", isCollapsed && "rotate-180")} />
        </button>
        
        <div className="flex items-center gap-3 h-full">
          <div className={cn(
            "flex items-center justify-center overflow-hidden transition-all duration-300 rounded-full shrink-0",
            settings?.appLogo ? "w-9 h-9 sm:w-10 h-10" : "w-9 h-9 sm:w-10 h-10 bg-[#5F6F52] shadow-lg shadow-[#5F6F52]/20 border border-[#5F6F52]/30"
          )}>
            {settings?.appLogo ? (
              <img src={settings.appLogo} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <span className="text-white font-black text-xl italic uppercase">Z</span>
            )}
          </div>
          <div className="flex flex-col justify-center leading-none mt-0.5">
            <span className={cn(
              "text-[14px] sm:text-base md:text-xl font-black tracking-wide uppercase transition-colors whitespace-nowrap",
              isDarkMode ? "text-[#10B981]" : "text-[#3D2B1F]"
            )}>
              {settings?.app_name || 'لوحة التحكم'}
            </span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center h-full gap-2 sm:gap-4">
        {/* Notifications */}
        <div className="flex items-center justify-center">
          <NotificationBell />
        </div>

        {/* Dark Mode Toggle */}
        <button
          onClick={onToggleDarkMode}
          className={cn(
            "p-2 sm:p-2.5 rounded-xl transition-all duration-300 group flex items-center justify-center",
            isDarkMode 
              ? "text-gray-400 hover:text-[#5F6F52] hover:bg-[#2B2B40]" 
              : "text-[#7C755E] hover:text-[#5F6F52] hover:bg-[#FAF5E9]"
          )}
          title={isDarkMode ? "الوضع الفاتح" : "الوضع الداكن"}
        >
          {isDarkMode ? (
            <Sun className="w-5 h-5 group-hover:rotate-45 transition-transform" />
          ) : (
            <Moon className="w-5 h-5 group-hover:-rotate-12 transition-transform" />
          )}
        </button>

        <Link to="/profile" className={cn(
          "flex items-center gap-2 sm:gap-3 text-sm p-1 pr-2 sm:pr-3 rounded-full transition-all group border border-transparent hover:border-[#5F6F52]",
          isDarkMode ? "text-gray-300 hover:bg-[#2B2B40] hover:text-white" : "text-[#7C755E] hover:bg-[#FAF5E9] hover:text-[#3D3929]"
        )}>
          <div className="hidden md:flex flex-col items-end justify-center leading-none">
            <span className={cn(
              "font-bold text-[13px] group-hover:text-[#5F6F52] transition-colors uppercase whitespace-nowrap",
              isDarkMode ? "text-white" : "text-[#3D3929]"
            )}>{profile?.full_name?.split(' ')[0] || 'المشرف'}</span>
            <span className="text-[9px] text-[#7C755E] mt-0.5 font-bold whitespace-nowrap">{profile?.user_type === 'admin' ? 'مدير النظام' : 'صلاحية محدودة'}</span>
          </div>
          <div className="w-8 h-8 sm:w-9 h-9 bg-[#5F6F52] rounded-full flex items-center justify-center overflow-hidden border border-[#5F6F52] group-hover:border-[#5F6F52] transition-all shrink-0 shadow-sm">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <UserIcon className="w-4 h-4 sm:w-5 h-5 text-white" />
            )}
          </div>
        </Link>
      </div>
    </header>
  );
}
