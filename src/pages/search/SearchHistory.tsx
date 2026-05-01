import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Search, User, Clock, Tag } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function SearchHistory() {
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const pageSize = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['search-history', page, searchQuery],
    queryFn: async () => {
      let query = supabase
        .from('search_history')
        .select(`
          *,
          profile:profiles(full_name, primary_phone)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (searchQuery) {
        query = query.ilike('search_query', `%${searchQuery}%`);
      }

      const { data, count, error } = await query;
      if (error) throw error;

      return { history: data as any[], count };
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900">سجل البحث</h2>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="relative">
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="بحث في سجل البحث..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full sm:w-64 pr-10 border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm border py-2 px-3"
            />
          </div>
        </div>
      </div>

      <div className="bg-white shadow-sm overflow-hidden sm:rounded-2xl border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                  المستخدم
                </th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                  كلمة البحث
                </th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                  النتائج
                </th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                  العنصر المختار
                </th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                  التاريخ
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-50">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex justify-center items-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                    </div>
                  </td>
                </tr>
              ) : data?.history?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    لا يوجد سجل بحث يطابق معايير البحث
                  </td>
                </tr>
              ) : (
                data?.history?.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden border border-gray-200">
                          {item.profile?.avatar_url ? (
                            <img src={item.profile.avatar_url} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <User className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                        <div className="mr-3">
                          <div className="text-sm font-medium text-gray-900">{item.profile?.full_name || 'زائر'}</div>
                          <div className="text-xs text-gray-500" dir="ltr">{item.profile?.primary_phone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm font-medium text-gray-900">
                        <Search className="w-4 h-4 ml-2 text-gray-400" />
                        {item.search_query}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.result_count || 0} نتيجة
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {item.clicked_item_id ? (
                        <div className="flex items-center text-sm text-indigo-600">
                          <Tag className="w-3 h-3 ml-1" />
                          {item.clicked_item_type === 'vendor' ? 'متجر' : 'منتج'}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">لم يتم اختيار عنصر</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <Clock className="w-3 h-3 ml-1 text-gray-400" />
                        {format(new Date(item.created_at), 'PPp', { locale: ar })}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
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
                  عرض <span className="font-medium">{page * pageSize + 1}</span> إلى <span className="font-medium">{Math.min((page + 1) * pageSize, data.count)}</span> من أصل <span className="font-medium">{data.count}</span> سجل
                </p>
              </div>
              <div className="flex gap-2">
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
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  التالي
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
