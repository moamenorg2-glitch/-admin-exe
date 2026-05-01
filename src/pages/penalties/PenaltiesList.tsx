import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Search, Filter, AlertTriangle, ShieldAlert, History, User, DollarSign, Clock } from 'lucide-react';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import toast from 'react-hot-toast';
import PenaltyFormModal from '../../components/penalties/PenaltyFormModal';
import PenaltyDetailsModal from '../../components/penalties/PenaltyDetailsModal';

export default function PenaltiesList() {
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [selectedPenalty, setSelectedPenalty] = useState<any>(null);
  const pageSize = 15;
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['penalties', page, searchQuery, categoryFilter],
    queryFn: async () => {
      let query = supabase
        .from('admin_penalties')
        .select(`
          *,
          profiles:target_user_id (full_name, user_type, primary_phone)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (searchQuery) {
        query = query.or(`official_reason.ilike.%${searchQuery}%`);
      }

      if (categoryFilter !== 'All') {
        query = query.eq('penalty_category', categoryFilter);
      }

      const { data, count, error } = await query;
      if (error) throw error;
      return { penalties: data as any[], count };
    },
  });

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'سلوك غير لائق': return 'سلوك غير لائق';
      case 'تأخير متكرر': return 'تأخير متكرر';
      case 'تلاعب باللوكيشن': return 'تلاعب باللوكيشن';
      default: return category;
    }
  };

  const getUserTypeLabel = (type: string) => {
    switch (type) {
      case 'customer': return 'عميل';
      case 'driver': return 'سائق';
      case 'vendor': return 'تاجر';
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-100 rounded-lg">
            <ShieldAlert className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">الجزاءات والعقوبات</h2>
            <p className="text-sm text-gray-500">إدارة العقوبات المالية والتعليقات الإدارية.</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="relative">
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="بحث بالسبب..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full sm:w-64 pr-10 border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm border py-2 px-3"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="block w-full sm:w-48 border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm border py-2 pl-3"
          >
            <option value="All">جميع الفئات</option>
            <option value="سلوك غير لائق">سلوك غير لائق</option>
            <option value="تأخير متكرر">تأخير متكرر</option>
            <option value="تلاعب باللوكيشن">تلاعب باللوكيشن</option>
          </select>
          
          <button 
            onClick={() => setIsFormModalOpen(true)}
            className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            <AlertTriangle className="w-4 h-4 ml-2" />
            إضافة جزاء جديد
          </button>
        </div>
      </div>

      <div className="bg-white shadow-sm overflow-hidden sm:rounded-2xl border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                  المستخدم المستهدف
                </th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                  فئة الجزاء
                </th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                  المبلغ / التعليق
                </th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                  السبب الرسمي
                </th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                  التاريخ
                </th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                  إجراءات
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-50">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex justify-center items-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                    </div>
                  </td>
                </tr>
              ) : data?.penalties?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    لا توجد سجلات جزاءات حالياً
                  </td>
                </tr>
              ) : (
                data?.penalties?.map((penalty) => (
                  <tr key={penalty.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200">
                          {penalty.profiles?.avatar_url ? (
                            <img src={penalty.profiles.avatar_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <User className="h-4 w-4 text-gray-500" />
                          )}
                        </div>
                        <div className="mr-3">
                          <div className="text-sm font-medium text-gray-900">{penalty.profiles?.full_name}</div>
                          <div className="text-xs text-gray-500">{getUserTypeLabel(penalty.profiles?.user_type)} - {penalty.profiles?.primary_phone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        {getCategoryLabel(penalty.penalty_category)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-red-600">
                        {penalty.penalty_amount > 0 ? `-${penalty.penalty_amount.toFixed(2)} ج.م` : 'لا يوجد'}
                      </div>
                      {penalty.is_account_suspended && (
                        <div className="text-xs text-red-500 font-medium">
                          تعليق حساب ({penalty.suspension_days} يوم)
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 line-clamp-2 max-w-xs">
                        {penalty.official_reason}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>{format(new Date(penalty.created_at), 'PPp', { locale: ar })}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button 
                        onClick={() => setSelectedPenalty(penalty)}
                        className="text-gray-400 hover:text-emerald-600 transition-colors"
                        title="عرض التفاصيل"
                      >
                        <History className="w-5 h-5" />
                      </button>
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
                  عرض <span className="font-medium">{page * pageSize + 1}</span> إلى <span className="font-medium">{Math.min((page + 1) * pageSize, data.count)}</span> من أصل <span className="font-medium">{data.count}</span> سجل
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

      {isFormModalOpen && (
        <PenaltyFormModal onClose={() => setIsFormModalOpen(false)} />
      )}

      {selectedPenalty && (
        <PenaltyDetailsModal 
          penalty={selectedPenalty} 
          onClose={() => setSelectedPenalty(null)} 
        />
      )}
    </div>
  );
}
