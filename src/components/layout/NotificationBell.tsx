import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bell, Check, Trash2, Info, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { AnimatePresence, motion } from 'framer-motion';
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

      {isOpen && typeof document !== 'undefined' && createPortal(
        <AnimatePresence mode="popLayout">
          {isOpen && (
            <motion.div
              key="notifications-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-[#000000B3] "
              onClick={() => setIsOpen(false)}
            />
          )}
          {isOpen && (
            <motion.div
              key="notifications-dropdown-content"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[95%] max-w-2xl bg-[#1E1E2D] border border-gray-800 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] z-[101] overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="p-6 border-b border-gray-800 flex items-center justify-between bg-[#2B2B40]/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500 rounded-xl">
                    <Bell className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">مركز الإشعارات</h3>
                    <p className="text-xs text-gray-400">لديك {unreadCount} إشعارات غير مقروءة</p>
                  </div>
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-emerald-500 hover:bg-emerald-500 px-4 py-2 rounded-xl font-bold transition-all"
                  >
                    تحديد الكل كمقروء
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                {isLoading ? (
                  <div className="p-12 text-center text-gray-500 text-sm">جاري التحميل...</div>
                ) : notifications.length === 0 ? (
                  <div className="p-12 flex flex-col items-center gap-4 text-center">
                    <div className="p-4 bg-gray-800 rounded-full">
                      <Bell className="w-8 h-8 text-gray-600" />
                    </div>
                    <p className="text-gray-500 text-sm">لا توجد إشعارات حالياً</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={cn(
                          "p-5 rounded-2xl transition-all relative group border border-transparent",
                          !notification.is_read ? "bg-emerald-500 border-emerald-500" : "hover:bg-[#FFFFFF80]"
                        )}
                      >
                        <div className="flex gap-4">
                          <div className={cn(
                            "mt-1 p-2.5 rounded-xl shrink-0",
                            !notification.is_read ? "bg-emerald-500" : "bg-gray-800"
                          )}>
                            {getIcon((notification.data as any)?.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-4 mb-1">
                              <p className={cn(
                                "text-base font-bold text-gray-200",
                                !notification.is_read && "text-white"
                              )}>
                                {notification.title}
                              </p>
                              <p className="text-[10px] text-gray-500 shrink-0">
                                {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: ar })}
                              </p>
                            </div>
                            <p className="text-sm text-gray-400 leading-relaxed">
                              {notification.content}
                            </p>
                          </div>
                        </div>
                        
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!notification.is_read && (
                            <button
                              onClick={() => markAsRead(notification.id)}
                              className="p-2 text-emerald-500 hover:bg-emerald-500 rounded-xl transition-all shadow-sm bg-[#1E1E2D]"
                              title="تحديد كمقروء"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => deleteNotification(notification.id)}
                            className="p-2 text-red-400 hover:bg-red-400 rounded-xl transition-all shadow-sm bg-[#1E1E2D]"
                            title="حذف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-gray-800 bg-[#2B2B40]/30 flex justify-between items-center">
                <button 
                  onClick={() => setIsOpen(false)}
                  className="text-xs font-bold text-gray-500 hover:text-white transition-colors"
                >
                  إغلاق
                </button>
                <button className="text-xs font-bold text-emerald-500 hover:text-emerald-400 transition-colors bg-emerald-500 px-4 py-2 rounded-lg">
                  عرض الأرشيف الكامل
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
