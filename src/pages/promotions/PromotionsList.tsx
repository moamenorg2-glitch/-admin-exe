import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Search, Filter, Tag, Edit, Plus, CheckCircle, XCircle, Trash2, Eye, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';
import { fetchPromotions, deletePromotion, togglePromotionStatus, fetchPromotionDetails } from './api';
import PromotionForm from './PromotionForm';
import PromotionDetails from './PromotionDetails';

export default function PromotionsList() {
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<any>(null);
  const [viewingPromotionId, setViewingPromotionId] = useState<string | null>(null);
  const [promotionToDelete, setPromotionToDelete] = useState<string | null>(null);

  const pageSize = 20;
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['promotions', page, searchQuery, statusFilter],
    queryFn: () => fetchPromotions(page, pageSize, searchQuery, statusFilter),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, currentStatus }: { id: string; currentStatus: boolean }) => togglePromotionStatus(id, currentStatus),
    onSuccess: () => {
      toast.success('تم تحديث حالة العرض بنجاح');
      queryClient.invalidateQueries({ queryKey: ['promotions'] }).catch(console.error);
    },
    onError: (error: any) => {
      console.error('Error updating promotion status:', error);
      toast.error('حدث خطأ أثناء تحديث حالة العرض');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deletePromotion,
    onSuccess: () => {
      toast.success('تم حذف العرض بنجاح');
      queryClient.invalidateQueries({ queryKey: ['promotions'] }).catch(console.error);
      setPromotionToDelete(null);
    },
    onError: (error: any) => {
      console.error('Error deleting promotion:', error);
      toast.error('حدث خطأ أثناء حذف العرض');
    }
  });

  const handleEdit = async (promotion: any) => {
    try {
      const fullDetails = await fetchPromotionDetails(promotion.id);
      setEditingPromotion(fullDetails);
      setIsFormOpen(true);
    } catch (error) {
      console.error('Error fetching promotion details:', error);
      toast.error('حدث خطأ أثناء جلب تفاصيل العرض');
    }
  };

  const handleDelete = (id: string) => {
    setPromotionToDelete(id);
  };

  const getPromotionTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      percentage: 'نسبة مئوية',
      fixed: 'مبلغ ثابت',
      free_shipping: 'توصيل مجاني',
      buy_x_get_y: 'اشتر X واحصل على Y',
    };
    return types[type] || type;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900">إدارة العروض الترويجية</h2>
        
        {/* Filters, Search & Actions */}
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="relative">
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="بحث بالكود أو العنوان..."
              value={searchQuery || ''}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full sm:w-64 pr-10 border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm border py-2 px-3"
            />
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <Filter className="h-4 w-4 text-gray-400" />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="block w-full sm:w-48 pr-10 border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm border py-2 pl-3"
            >
              <option value="All">جميع الحالات</option>
              <option value="Active">نشط</option>
              <option value="Inactive">غير نشط</option>
            </select>
          </div>

          <button 
            onClick={() => {
              setEditingPromotion(null);
              setIsFormOpen(true);
            }}
            className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
          >
            <Plus className="w-4 h-4 ml-2" />
            إضافة عرض
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white shadow-sm overflow-hidden sm:rounded-2xl border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-50/50 border-b border-gray-100">
              <tr>
                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">الكود والعنوان</th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">النوع والقيمة</th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">فترة الصلاحية</th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">الاستخدام</th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">الحالة</th>
                <th scope="col" className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">إجراءات</th>
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
              ) : data?.promotions?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    لا توجد عروض تطابق معايير البحث
                  </td>
                </tr>
              ) : (
                data?.promotions?.map((promo) => (
                  <tr key={promo.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center">
                          <Tag className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div className="mr-4">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-bold text-gray-900 uppercase" dir="ltr">{promo.code}</div>
                            <span className={cn(
                              "px-2 py-0.5 text-[10px] font-medium rounded-full",
                              promo.vendor_ids && promo.vendor_ids.length > 0 
                                ? "bg-purple-100 text-purple-800" 
                                : "bg-blue-100 text-blue-800"
                            )}>
                              {promo.vendor_ids && promo.vendor_ids.length > 0 ? 'متجر' : 'منصة'}
                            </span>
                          </div>
                          <div className="text-sm text-gray-500">{promo.title_ar}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>{getPromotionTypeLabel(promo.type)}</div>
                      <div className="text-xs font-medium text-gray-500">
                        {promo.type === 'percentage' ? `${promo.value}%` : 
                         promo.type === 'fixed' ? `${promo.value} ج.م` : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div>من: {format(new Date(promo.start_date), 'yyyy/MM/dd')}</div>
                      <div>إلى: {format(new Date(promo.end_date), 'yyyy/MM/dd')}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {promo.usage_limit ? `الحد: ${promo.usage_limit}` : 'غير محدود'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={cn(
                        "px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full",
                        promo.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      )}>
                        {promo.is_active ? 'نشط' : 'غير نشط'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => setViewingPromotionId(promo.id)}
                          className="text-blue-600 hover:text-blue-900 bg-blue-50 p-2 rounded-md transition-colors inline-flex items-center gap-1"
                          title="عرض التفاصيل"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => toggleStatusMutation.mutate({ id: promo.id, currentStatus: promo.is_active })}
                          disabled={toggleStatusMutation.isPending}
                          className={cn(
                            "p-2 rounded-md transition-colors inline-flex items-center gap-1",
                            promo.is_active 
                              ? "text-red-600 hover:text-red-900 bg-red-50" 
                              : "text-green-600 hover:text-green-900 bg-green-50"
                          )}
                          title={promo.is_active ? "تعطيل" : "تفعيل"}
                        >
                          {promo.is_active ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                        </button>
                        <button 
                          onClick={() => handleEdit(promo)}
                          className="text-emerald-600 hover:text-emerald-900 bg-emerald-50 p-2 rounded-md transition-colors inline-flex items-center gap-1"
                          title="تعديل"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(promo.id)}
                          disabled={deleteMutation.isPending}
                          className="text-red-600 hover:text-red-900 bg-red-50 p-2 rounded-md transition-colors inline-flex items-center gap-1"
                          title="حذف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
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
                  عرض <span className="font-medium">{page * pageSize + 1}</span> إلى <span className="font-medium">{Math.min((page + 1) * pageSize, data.count)}</span> من أصل <span className="font-medium">{data.count}</span> عرض
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

      {isFormOpen && (
        <PromotionForm 
          initialData={editingPromotion} 
          onClose={() => {
            setIsFormOpen(false);
            setEditingPromotion(null);
          }} 
        />
      )}

      {viewingPromotionId && (
        <PromotionDetails 
          id={viewingPromotionId} 
          onClose={() => setViewingPromotionId(null)} 
        />
      )}

      {/* Delete Confirmation Modal */}
      {promotionToDelete && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden text-right relative z-[10000]">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">تأكيد الحذف</h3>
              <button onClick={() => setPromotionToDelete(null)} className="p-1 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-gray-700">هل أنت متأكد من حذف هذا العرض؟ لا يمكن التراجع عن هذا الإجراء.</p>
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button 
                onClick={() => deleteMutation.mutate(promotionToDelete)}
                disabled={deleteMutation.isPending}
                className="flex-1 bg-red-600 text-white py-2 rounded-md text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'جاري الحذف...' : 'تأكيد الحذف'}
              </button>
              <button 
                onClick={() => setPromotionToDelete(null)}
                disabled={deleteMutation.isPending}
                className="flex-1 bg-white border border-gray-300 text-gray-700 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
