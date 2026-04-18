import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { X, Tag, Calendar, Users, ShoppingBag, Clock, AlertCircle } from 'lucide-react';
import { fetchPromotionDetails, fetchPromotionUsage } from './api';

interface PromotionDetailsProps {
  id: string;
  onClose: () => void;
}

export default function PromotionDetails({ id, onClose }: PromotionDetailsProps) {
  const { data: promotion, isLoading: isLoadingDetails } = useQuery({
    queryKey: ['promotion-details', id],
    queryFn: () => fetchPromotionDetails(id),
  });

  const { data: usage, isLoading: isLoadingUsage } = useQuery({
    queryKey: ['promotion-usage', id],
    queryFn: () => fetchPromotionUsage(id),
  });

  if (isLoadingDetails || isLoadingUsage) {
    return (
      <div className="fixed inset-0 z-50 overflow-hidden bg-gray-500 bg-opacity-75 flex justify-end">
        <div className="w-full max-w-2xl bg-white h-full shadow-xl flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        </div>
      </div>
    );
  }

  if (!promotion) return null;

  const totalDiscount = usage?.reduce((sum, u) => sum + (u.discount_amount || 0), 0) || 0;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-gray-500 bg-opacity-75 flex justify-end">
      <div className="w-full max-w-2xl bg-white h-full shadow-xl flex flex-col animate-in slide-in-from-left">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-white">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Tag className="w-5 h-5 text-emerald-600" />
            تفاصيل العرض: {promotion.code}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-gray-50">
          
          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <div className="text-sm font-medium text-gray-500 mb-1">مرات الاستخدام</div>
              <div className="text-2xl font-bold text-gray-900">{usage?.length || 0}</div>
              {promotion.usage_limit && (
                <div className="text-xs text-gray-500 mt-1">من أصل {promotion.usage_limit}</div>
              )}
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <div className="text-sm font-medium text-gray-500 mb-1">إجمالي الخصم الممنوح</div>
              <div className="text-2xl font-bold text-green-600">{totalDiscount.toFixed(2)} ج.م</div>
            </div>
          </div>

          {/* Basic Info */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 font-medium text-gray-900">
              البيانات الأساسية
            </div>
            <div className="p-4 grid grid-cols-2 gap-y-4 gap-x-6">
              <div>
                <div className="text-xs text-gray-500">العنوان</div>
                <div className="font-medium">{promotion.title_ar}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">النوع</div>
                <div className="font-medium">
                  {promotion.type === 'percentage' ? 'نسبة مئوية' : 
                   promotion.type === 'fixed' ? 'مبلغ ثابت' : 
                   promotion.type === 'free_shipping' ? 'توصيل مجاني' : 'اشتر X واحصل على Y'}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">القيمة</div>
                <div className="font-medium">
                  {promotion.type === 'percentage' ? `${promotion.value}%` : `${promotion.value} ج.م`}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">الحد الأدنى للطلب</div>
                <div className="font-medium">{promotion.min_order_value} ج.م</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">تاريخ البدء</div>
                <div className="font-medium">{format(new Date(promotion.start_date), 'yyyy/MM/dd HH:mm')}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">تاريخ الانتهاء</div>
                <div className="font-medium">{format(new Date(promotion.end_date), 'yyyy/MM/dd HH:mm')}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">الحالة</div>
                <div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    promotion.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {promotion.is_active ? 'نشط' : 'غير نشط'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Conditions */}
          {promotion.conditions?.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 font-medium text-gray-900 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-gray-500" />
                الشروط ({promotion.conditions.length})
              </div>
              <div className="divide-y divide-gray-200">
                {promotion.conditions.map((c: any) => (
                  <div key={c.id} className="p-4 text-sm">
                    <span className="font-medium text-gray-700">{c.condition_type}</span>{' '}
                    <span className="text-gray-500">{c.operator}</span>{' '}
                    <span className="font-mono bg-gray-100 px-1 rounded">{JSON.stringify(c.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Usage History */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-500" />
              سجل الاستخدام
            </div>
            {usage?.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-sm">لم يتم استخدام هذا العرض بعد</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead className="bg-gray-50/50 border-b border-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">التاريخ</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">المستخدم</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">الخصم</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 bg-white">
                    {usage?.map((u: any) => (
                      <tr key={u.id}>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {format(new Date(u.created_at), 'yyyy/MM/dd HH:mm')}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <div>{u.user?.full_name || 'مستخدم غير معروف'}</div>
                          <div className="text-xs text-gray-500" dir="ltr">{u.user?.primary_phone}</div>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-green-600">
                          {u.discount_amount} ج.م
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
