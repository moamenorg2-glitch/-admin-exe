import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Search, Filter, Bell, CheckCircle, Clock, Send, Eye } from 'lucide-react';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import toast from 'react-hot-toast';

export default function NotificationsList() {
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [readFilter, setReadFilter] = useState<'All' | 'Read' | 'Unread'>('All');
  const pageSize = 20;
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', page, searchQuery, readFilter],
    queryFn: async () => {
      let query = supabase
        .from('notifications')
        .select(`
          *,
          profiles:user_id (full_name, user_type)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`);
      }

      if (readFilter !== 'All') {
        query = query.eq('is_read', readFilter === 'Read');
      }

      const { data, count, error } = await query;
      if (error) throw error;
      return { notifications: data as any[], count };
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم تحديد الإشعار كمقروء');
      queryClient.invalidateQueries({ queryKey: ['notifications'] }).catch(console.error);
    },
    onError: (error) => {
      console.error('Error marking notification as read:', error);
      toast.error('حدث خطأ أثناء تحديث حالة الإشعار');
    }
  });

  const getUserTypeLabel = (type: string) => {
    switch (type) {
      case 'customer': return 'عميل';
      case 'driver': return 'سائق';
      case 'vendor': return 'تاجر';
      case 'admin': return 'مسؤول';
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900">سجل الإشعارات</h2>
        
        {/* Filters, Search & Actions */}
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="relative">
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="بحث بالعنوان أو المحتوى..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full sm:w-64 pr-10 border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm border py-2 px-3"
            />
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <Filter className="h-4 w-4 text-gray-400" />
            </div>
            <select
              value={readFilter}
              onChange={(e) => setReadFilter(e.target.value as any)}
              className="block w-full sm:w-48 pr-10 border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm border py-2 pl-3"
            >
              <option value="All">جميع الحالات</option>
              <option value="Read">مقروء</option>
              <option value="Unread">غير مقروء</option>
            </select>
          </div>

          <button 
            onClick={() => toast('سيتم تفعيل شاشة إرسال الإشعارات قريباً')}
            className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
          >
            <Send className="w-4 h-4 ml-2" />
            إرسال إشعار جديد
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white shadow-sm overflow-hidden sm:rounded-2xl border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                  الإشعار
                </th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                  المستلم
                </th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                  تاريخ الإرسال
                </th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                  الحالة
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-50">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex justify-center items-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                    </div>
                  </td>
                </tr>
              ) : data?.notifications?.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    لا توجد إشعارات تطابق معايير البحث
                  </td>
                </tr>
              ) : (
                data?.notifications?.map((notification) => (
                  <tr key={notification.id} className={cn("hover:bg-gray-50 transition-colors", !notification.is_read && "bg-emerald-50")}>
                    <td className="px-6 py-4">
                      <div className="flex items-start">
                        <div className={cn(
                          "flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center mt-1",
                          notification.is_read ? "bg-gray-100" : "bg-emerald-100"
                        )}>
                          <Bell className={cn("h-5 w-5", notification.is_read ? "text-gray-500" : "text-emerald-600")} />
                        </div>
                        <div className="mr-4">
                          <div className={cn("text-sm", notification.is_read ? "font-medium text-gray-900" : "font-bold text-gray-900")}>
                            {notification.title}
                          </div>
                          <div className="text-sm text-gray-500 mt-1 line-clamp-2">{notification.content}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {notification.profiles ? (
                        <>
                          <div className="text-sm font-medium text-gray-900">{notification.profiles.full_name}</div>
                          <div className="text-xs text-gray-500">{getUserTypeLabel(notification.profiles.user_type)}</div>
                        </>
                      ) : (
                        <span className="text-sm text-gray-500">إشعار عام</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>{format(new Date(notification.created_at), 'PPp', { locale: ar })}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {notification.is_read ? (
                        <span className="inline-flex items-center text-sm text-green-600">
                          <CheckCircle className="w-4 h-4 ml-1" />
                          مقروء
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center text-sm text-emerald-600 font-medium">
                            غير مقروء
                          </span>
                          <button 
                            onClick={() => markAsReadMutation.mutate(notification.id)}
                            disabled={markAsReadMutation.isPending}
                            className="text-gray-400 hover:text-emerald-600 transition-colors"
                            title="تحديد كمقروء"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {data?.count && data.count > pageSize && (
          <div className="bg-white px-4 py-3 border-t border-gray-200 flex items-center justify-between sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                السابق
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={(page + 1) * pageSize >= data.count}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                التالي
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  عرض <span className="font-medium">{page * pageSize + 1}</span> إلى <span className="font-medium">{Math.min((page + 1) * pageSize, data.count)}</span> من أصل <span className="font-medium">{data.count}</span> إشعار
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    السابق
                  </button>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={(page + 1) * pageSize >= data.count}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    التالي
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
