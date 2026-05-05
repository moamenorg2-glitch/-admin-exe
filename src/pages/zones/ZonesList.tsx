import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Filter, Map, Edit, Plus, Zap, CheckCircle, XCircle, X, MapPin } from 'lucide-react';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';
import { locationService } from '../../services/locationService';
import { handleGlobalError } from '../../utils/errorHandler';

interface ZoneFormData {
  name_ar: string;
  name_en: string;
  city_id: string;
  base_delivery_fee: number;
  base_distance_km: number;
  extra_fee_per_km: number;
  driver_payout_fixed: number;
  driver_commission_pct: number;
  additional_vendor_fee: number;
  is_active: boolean;
  is_surge_active: boolean;
  surge_multiplier: number;
  surge_threshold_orders: number;
  max_orders_capacity: number;
  max_weight_kg: number;
  zone_buffer_minutes: number;
  opening_time: string;
  closing_time: string;
  announcement_msg_ar: string;
  allowed_vehicles: string[];
  payment_methods: string[];
}

const initialFormData: ZoneFormData = {
  name_ar: '',
  name_en: '',
  city_id: '',
  base_delivery_fee: 0,
  base_distance_km: 0,
  extra_fee_per_km: 0,
  driver_payout_fixed: 0,
  driver_commission_pct: 0,
  additional_vendor_fee: 0,
  is_active: true,
  is_surge_active: false,
  surge_multiplier: 1,
  surge_threshold_orders: 0,
  max_orders_capacity: 0,
  max_weight_kg: 0,
  zone_buffer_minutes: 0,
  opening_time: '00:00',
  closing_time: '23:59',
  announcement_msg_ar: '',
  allowed_vehicles: ['motorcycle', 'car', 'bicycle'],
  payment_methods: ['cash', 'wallet', 'card'],
};

export default function ZonesList() {
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<any>(null);
  const [formData, setFormData] = useState<ZoneFormData>(initialFormData);
  
  const pageSize = 20;
  const queryClient = useQueryClient();

  const { data: cities } = useQuery({
    queryKey: ['cities-all'],
    queryFn: async () => {
      try {
        return await locationService.fetchCities();
      } catch (error) {
        handleGlobalError(error, 'Fetch Cities for Zones');
        throw error;
      }
    }
  });

  const { data, isLoading } = useQuery({
    queryKey: ['zones', page, searchQuery, statusFilter],
    queryFn: async () => {
      try {
        return await locationService.fetchZones(page, pageSize, {
          search: searchQuery,
          status: statusFilter
        });
      } catch (error) {
        handleGlobalError(error, 'Fetch Zones');
        throw error;
      }
    },
  });

  const upsertZoneMutation = useMutation({
    mutationFn: async (data: ZoneFormData) => {
      await locationService.upsertZone(editingZone ? { ...data, zone_id: editingZone.zone_id } : data);
    },
    onSuccess: () => {
      toast.success(editingZone ? 'تم تحديث المنطقة بنجاح' : 'تم إضافة المنطقة بنجاح');
      setIsModalOpen(false);
      setEditingZone(null);
      setFormData(initialFormData);
      queryClient.invalidateQueries({ queryKey: ['zones'] }).catch(console.error);
    },
    onError: (error) => {
      handleGlobalError(error, 'Upsert Zone');
    }
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: boolean }) => {
      await locationService.updateZoneStatus(id, !currentStatus);
    },
    onSuccess: () => {
      toast.success('تم تحديث حالة المنطقة بنجاح');
      queryClient.invalidateQueries({ queryKey: ['zones'] }).catch(console.error);
    },
    onError: (error) => {
      handleGlobalError(error, 'Toggle Zone Status');
    }
  });

  const handleEdit = (zone: any) => {
    if (!zone) return;
    setEditingZone(zone);
    setFormData({
      name_ar: zone.name_ar || '',
      name_en: zone.name_en || '',
      city_id: zone.city_id || '',
      base_delivery_fee: Number(zone.base_delivery_fee) || 0,
      base_distance_km: Number(zone.base_distance_km) || 0,
      extra_fee_per_km: Number(zone.extra_fee_per_km) || 0,
      driver_payout_fixed: Number(zone.driver_payout_fixed) || 0,
      driver_commission_pct: Number(zone.driver_commission_pct) || 0,
      additional_vendor_fee: Number(zone.additional_vendor_fee) || 0,
      is_active: !!zone.is_active,
      is_surge_active: !!zone.is_surge_active,
      surge_multiplier: Number(zone.surge_multiplier) || 1,
      surge_threshold_orders: Number(zone.surge_threshold_orders) || 0,
      max_orders_capacity: Number(zone.max_orders_capacity) || 0,
      max_weight_kg: Number(zone.max_weight_kg) || 0,
      zone_buffer_minutes: Number(zone.zone_buffer_minutes) || 0,
      opening_time: zone.opening_time || '00:00',
      closing_time: zone.closing_time || '23:59',
      announcement_msg_ar: zone.announcement_msg_ar || '',
      allowed_vehicles: Array.isArray(zone.allowed_vehicles) ? zone.allowed_vehicles : ['motorcycle', 'car', 'bicycle'],
      payment_methods: Array.isArray(zone.payment_methods) ? zone.payment_methods : ['cash', 'wallet', 'card'],
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await upsertZoneMutation.mutateAsync(formData).catch(console.error);
    } catch (error) {
      // Error is handled by mutation's onError
    }
  };

  return (
    <div className="space-y-8 pb-12" dir="rtl">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-emerald-100 rounded-2xl shadow-sm">
            <Map className="w-7 h-7 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">المناطق والتوصيل</h2>
            <p className="mt-1 text-gray-500 font-medium">إدارة النطاق الجغرافي ورسوم التوصيل لكل منطقة.</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
          <div className="relative group flex-1 sm:w-72">
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
            </div>
            <input
              type="text"
              placeholder="بحث باسم المنطقة..."
              value={searchQuery || ''}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pr-12 pl-4 py-3 bg-white border border-gray-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium transition-all"
            />
          </div>

          <div className="relative flex-1 sm:w-56">
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
              <Filter className="h-5 w-5 text-gray-400" />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="block w-full pr-12 pl-4 py-3 bg-white border border-gray-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-bold appearance-none transition-all"
            >
              <option value="All">جميع الحالات</option>
              <option value="Active">نشط</option>
              <option value="Inactive">غير نشط</option>
            </select>
          </div>

          <button 
            onClick={() => {
              setEditingZone(null);
              setFormData(initialFormData);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-sm font-bold rounded-2xl shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all"
          >
            <Plus className="ml-2 h-5 w-5" />
            إضافة منطقة
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white shadow-sm overflow-hidden sm:rounded-3xl border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th scope="col" className="px-8 py-5 text-right text-xs font-bold text-gray-500 uppercase tracking-widest">
                  المنطقة
                </th>
                <th scope="col" className="px-8 py-5 text-right text-xs font-bold text-gray-500 uppercase tracking-widest">
                  رسوم التوصيل
                </th>
                <th scope="col" className="px-8 py-5 text-right text-xs font-bold text-gray-500 uppercase tracking-widest">
                  عمولة السائق
                </th>
                <th scope="col" className="px-8 py-5 text-right text-xs font-bold text-gray-500 uppercase tracking-widest">
                  حالة التسعير (Surge)
                </th>
                <th scope="col" className="px-8 py-5 text-right text-xs font-bold text-gray-500 uppercase tracking-widest">
                  الحالة
                </th>
                <th scope="col" className="px-8 py-5 text-center text-xs font-bold text-gray-500 uppercase tracking-widest">
                  إجراءات
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-50">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-8 py-12 text-center text-gray-500 font-medium">
                    <div className="flex justify-center items-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                    </div>
                  </td>
                </tr>
              ) : data?.zones?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-12 text-center text-gray-500 font-medium">
                    لا توجد مناطق تطابق معايير البحث
                  </td>
                </tr>
              ) : (
                data?.zones?.map((zone) => (
                  <tr key={zone.zone_id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-8 py-5 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-12 w-12 bg-emerald-50 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform">
                          <MapPin className="h-6 w-6 text-emerald-600" />
                        </div>
                        <div className="mr-4">
                          <div className="text-sm font-bold text-gray-900">{zone.name_ar}</div>
                          <div className="text-xs text-gray-400 font-medium mt-0.5">{zone.cities?.name_ar || 'مدينة غير محددة'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-emerald-600">أساسي: {zone.base_delivery_fee} ج.م</span>
                        <span className="text-xs text-gray-400 font-medium mt-0.5">إضافي: {zone.extra_fee_per_km} ج.م/كم</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-700">ثابت: {zone.driver_payout_fixed} ج.م</span>
                        <span className="text-xs text-gray-400 font-medium mt-0.5">نسبة: {zone.driver_commission_pct}%</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      {zone.is_surge_active ? (
                        <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-200">
                          <Zap className="w-3 h-3 ml-1" />
                          نشط ({zone.surge_multiplier}x)
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-100 text-gray-600 border border-gray-200">
                          غير نشط
                        </span>
                      )}
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <span className={cn(
                        "inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold border",
                        zone.is_active ? "bg-green-100 text-green-700 border-green-200" : "bg-red-100 text-red-700 border-red-200"
                      )}>
                        {zone.is_active ? 'نشطة' : 'غير نشطة'}
                      </span>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-3">
                        <button 
                          onClick={() => toggleStatusMutation.mutate({ id: zone.zone_id, currentStatus: zone.is_active })}
                          disabled={toggleStatusMutation.isPending}
                          className={cn(
                            "p-2 rounded-xl transition-all",
                            zone.is_active 
                              ? "text-gray-400 hover:text-red-600 hover:bg-red-50" 
                              : "text-gray-400 hover:text-emerald-600 hover:bg-emerald-50"
                          )}
                          title={zone.is_active ? "تعطيل" : "تفعيل"}
                        >
                          {zone.is_active ? <XCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                        </button>
                        <button 
                          onClick={() => handleEdit(zone)}
                          className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                          title="تعديل"
                        >
                          <Edit className="h-5 w-5" />
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
                  عرض <span className="font-medium">{page * pageSize + 1}</span> إلى <span className="font-medium">{Math.min((page + 1) * pageSize, data.count)}</span> من أصل <span className="font-medium">{data.count}</span> منطقة
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

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={() => setIsModalOpen(false)}></div>
          
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col z-10 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
              <h3 className="text-lg font-bold text-gray-900">
                {editingZone ? 'تعديل منطقة' : 'إضافة منطقة جديدة'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              <form id="zone-form" onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">الاسم بالعربية</label>
                    <input
                      type="text"
                      required
                      value={formData.name_ar || ''}
                      onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">الاسم بالإنجليزية</label>
                    <input
                      type="text"
                      required
                      value={formData.name_en || ''}
                      onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">المدينة</label>
                  <select
                    required
                    value={formData.city_id || ''}
                    onChange={(e) => setFormData({ ...formData, city_id: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-sm font-bold appearance-none"
                  >
                    <option value="">اختر المدينة</option>
                    {Array.isArray(cities) && cities.map((city) => (
                      <option key={city.id} value={city.id}>{city.name_ar}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">رسوم التوصيل</label>
                    <input
                      type="number"
                      required
                      value={formData.base_delivery_fee || 0}
                      onChange={(e) => setFormData({ ...formData, base_delivery_fee: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">المسافة (كم)</label>
                    <input
                      type="number"
                      required
                      value={formData.base_distance_km || 0}
                      onChange={(e) => setFormData({ ...formData, base_distance_km: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">رسوم إضافية/كم</label>
                    <input
                      type="number"
                      required
                      value={formData.extra_fee_per_km || 0}
                      onChange={(e) => setFormData({ ...formData, extra_fee_per_km: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">عمولة السائق (ثابتة)</label>
                    <input
                      type="number"
                      required
                      value={formData.driver_payout_fixed || 0}
                      onChange={(e) => setFormData({ ...formData, driver_payout_fixed: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">عمولة السائق (%)</label>
                    <input
                      type="number"
                      required
                      value={formData.driver_commission_pct || 0}
                      onChange={(e) => setFormData({ ...formData, driver_commission_pct: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">رسوم إضافية للتاجر</label>
                    <input
                      type="number"
                      required
                      value={formData.additional_vendor_fee || 0}
                      onChange={(e) => setFormData({ ...formData, additional_vendor_fee: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">السعة القصوى للطلبات</label>
                    <input
                      type="number"
                      required
                      value={formData.max_orders_capacity || 0}
                      onChange={(e) => setFormData({ ...formData, max_orders_capacity: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">الوزن الأقصى (كجم)</label>
                    <input
                      type="number"
                      required
                      value={formData.max_weight_kg || 0}
                      onChange={(e) => setFormData({ ...formData, max_weight_kg: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">وقت التجهيز (دقائق)</label>
                    <input
                      type="number"
                      required
                      value={formData.zone_buffer_minutes || 0}
                      onChange={(e) => setFormData({ ...formData, zone_buffer_minutes: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">وقت الفتح</label>
                    <input
                      type="time"
                      required
                      value={formData.opening_time || '00:00'}
                      onChange={(e) => setFormData({ ...formData, opening_time: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">وقت الإغلاق</label>
                    <input
                      type="time"
                      required
                      value={formData.closing_time || '23:59'}
                      onChange={(e) => setFormData({ ...formData, closing_time: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">رسالة الإعلان</label>
                  <textarea
                    value={formData.announcement_msg_ar || ''}
                    onChange={(e) => setFormData({ ...formData, announcement_msg_ar: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-sm"
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">المركبات المسموح بها</label>
                    <div className="space-y-1">
                      {['motorcycle', 'car', 'bicycle'].map(v => (
                        <label key={v} className="flex items-center gap-2">
                          <input type="checkbox" checked={formData.allowed_vehicles.includes(v)} onChange={(e) => {
                            const val = e.target.checked ? [...formData.allowed_vehicles, v] : formData.allowed_vehicles.filter(x => x !== v);
                            setFormData({...formData, allowed_vehicles: val});
                          }} />
                          <span className="text-xs text-gray-600">{v}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">طرق الدفع</label>
                    <div className="space-y-1">
                      {['cash', 'wallet', 'card'].map(p => (
                        <label key={p} className="flex items-center gap-2">
                          <input type="checkbox" checked={formData.payment_methods.includes(p)} onChange={(e) => {
                            const val = e.target.checked ? [...formData.payment_methods, p] : formData.payment_methods.filter(x => x !== p);
                            setFormData({...formData, payment_methods: val});
                          }} />
                          <span className="text-xs text-gray-600">{p}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
                  <label htmlFor="is_active" className="text-sm font-bold text-gray-700 cursor-pointer">تفعيل المنطقة</label>
                  <input
                    type="checkbox"
                    id="is_active"
                    className="w-5 h-5 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  />
                </div>

                <div className="p-3 bg-yellow-50 rounded-xl border border-yellow-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="is_surge_active" className="text-sm font-bold text-yellow-900 cursor-pointer">تفعيل زيادة الأسعار (Surge)</label>
                    <input
                      type="checkbox"
                      id="is_surge_active"
                      className="w-5 h-5 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500"
                      checked={formData.is_surge_active}
                      onChange={(e) => setFormData({ ...formData, is_surge_active: e.target.checked })}
                    />
                  </div>
                  {formData.is_surge_active && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-bold text-yellow-800 mb-1">مضاعف السعر</label>
                        <input
                          type="number"
                          step="0.1"
                          value={formData.surge_multiplier || 1}
                          onChange={(e) => setFormData({ ...formData, surge_multiplier: Number(e.target.value) })}
                          className="w-full px-3 py-2 bg-white border border-yellow-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-yellow-800 mb-1">حد الطلبات للتفعيل</label>
                        <input
                          type="number"
                          value={formData.surge_threshold_orders || 0}
                          onChange={(e) => setFormData({ ...formData, surge_threshold_orders: Number(e.target.value) })}
                          className="w-full px-3 py-2 bg-white border border-yellow-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={upsertZoneMutation.isPending}
                    className="flex-1 bg-emerald-600 text-white px-3 py-2 rounded-xl font-bold hover:bg-emerald-700 transition-colors text-sm disabled:opacity-50"
                  >
                    {upsertZoneMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 bg-gray-100 text-gray-700 px-3 py-2 rounded-xl font-bold hover:bg-gray-200 transition-colors text-sm"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
