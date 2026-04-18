import React, { useState, useEffect } from 'react';
import { Bell, Check, Trash2, Info, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { toast } from 'react-hot-toast';

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notifications', user.id] }).catch(console.error);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch(err => {
        console.error('Error removing notifications channel:', err);
      });
    };
  }, [user, queryClient]);

  const markAsRead = async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (error) {
      toast.error('فشل في تحديث الإشعار');
    } else {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] }).catch(console.error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (error) {
      toast.error('فشل في تحديث الإشعارات');
    } else {
      queryClient.invalidateQueries({ queryKey: ['notifications', user.id] }).catch(console.error);
      toast.success('تم تحديد الكل كمقروء');
    }
  };

  const deleteNotification = async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('فشل في حذف الإشعار');
    } else {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] }).catch(console.error);
    }
  };

  const getIcon = (type?: string) => {
    switch (type) {
      case 'success': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'warning': return <AlertCircle className="w-4 h-4 text-amber-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-400 hover:text-emerald-500 hover:bg-[#2B2B40] rounded-full transition-all duration-300"
        title="الإشعارات"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-[#1E1E2D]">
            {unreadCount > 9 ? '+9' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-30" 
              onClick={() => setIsOpen(false)} 
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute left-0 mt-2 w-80 bg-[#1E1E2D] border border-gray-800 rounded-xl shadow-2xl z-40 overflow-hidden"
            >
              <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-[#2B2B40]/30">
                <h3 className="text-sm font-bold text-white">الإشعارات</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-[10px] text-emerald-500 hover:text-emerald-400 font-medium transition-colors"
                  >
                    تحديد الكل كمقروء
                  </button>
                )}
              </div>

              <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                {isLoading ? (
                  <div className="p-8 text-center text-gray-500 text-sm">جاري التحميل...</div>
                ) : notifications.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 text-sm">لا توجد إشعارات حالياً</div>
                ) : (
                  <div className="divide-y divide-gray-800/50">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={cn(
                          "p-4 hover:bg-[#2B2B40]/50 transition-colors relative group",
                          !notification.is_read && "bg-emerald-500/5"
                        )}
                      >
                        <div className="flex gap-3">
                          <div className="mt-1">
                            {getIcon((notification.data as any)?.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              "text-sm font-medium text-gray-200 truncate",
                              !notification.is_read && "text-white"
                            )}>
                              {notification.title}
                            </p>
                            <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                              {notification.content}
                            </p>
                            <p className="text-[10px] text-gray-500 mt-2">
                              {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: ar })}
                            </p>
                          </div>
                        </div>
                        
                        <div className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!notification.is_read && (
                            <button
                              onClick={() => markAsRead(notification.id)}
                              className="p-1.5 text-emerald-500 hover:bg-emerald-500/10 rounded-md transition-colors"
                              title="تحديد كمقروء"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => deleteNotification(notification.id)}
                            className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-md transition-colors"
                            title="حذف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-3 border-t border-gray-800 bg-[#2B2B40]/30 text-center">
                <button className="text-xs text-gray-400 hover:text-white transition-colors">
                  عرض كل الإشعارات
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
