import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, MapPin, Plus, Edit, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '../../lib/utils';
import { locationService, City } from '../../services/locationService';
import { handleGlobalError } from '../../utils/errorHandler';

export default function CitiesList() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCity, setEditingCity] = useState<City | null>(null);
  const [formData, setFormData] = useState({
    name_ar: '',
    name_en: '',
    zoom_level: 10,
    is_active: true
  });
  const [cityToDelete, setCityToDelete] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['cities', searchQuery],
    queryFn: async () => {
      try {
        return await locationService.fetchCities(searchQuery);
      } catch (error) {
        handleGlobalError(error, 'Fetch Cities');
        throw error;
      }
    },
  });

  const createMutation = useMutation({
    mutationFn: async (newCity: any) => {
      await locationService.createCity(newCity);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cities'] }).catch(console.error);
      toast.success('تم إضافة المدينة بنجاح');
      closeModal();
    },
    onError: (error: any) => {
      handleGlobalError(error, 'Create City');
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      await locationService.updateCity(id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cities'] }).catch(console.error);
      toast.success('تم تحديث المدينة بنجاح');
      closeModal();
    },
    onError: (error: any) => {
      handleGlobalError(error, 'Update City');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await locationService.deleteCity(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cities'] }).catch(console.error);
      toast.success('تم حذف المدينة بنجاح');
      setCityToDelete(null);
    },
    onError: (error: any) => {
      handleGlobalError(error, 'Delete City');
    }
  });

  const openModal = (city: City | null = null) => {
    if (city) {
      setEditingCity(city);
      setFormData({
        name_ar: city.name_ar,
        name_en: city.name_en,
        zoom_level: city.zoom_level,
        is_active: city.is_active
      });
    } else {
      setEditingCity(null);
      setFormData({
        name_ar: '',
        name_en: '',
        zoom_level: 10,
        is_active: true
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCity(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCity) {
      updateMutation.mutate({ id: editingCity.id, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: string) => {
    setCityToDelete(id);
  };

  return (
    <div className="space-y-8 pb-12" dir="rtl">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-emerald-100 rounded-2xl shadow-sm">
            <MapPin className="w-7 h-7 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">إدارة المدن</h2>
            <p className="mt-1 text-gray-500 font-medium">إدارة المدن والمناطق الجغرافية التي تغطيها الخدمة.</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
          <div className="relative group flex-1 sm:w-72">
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
            </div>
            <input
              type="text"
              placeholder="بحث باسم المدينة..."
              value={searchQuery || ''}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pr-12 pl-4 py-3 bg-white border border-gray-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium transition-all"
            />
          </div>

          <button 
            onClick={() => openModal()}
            className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-sm font-bold rounded-2xl shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all"
          >
            <Plus className="ml-2 h-5 w-5" />
            إضافة مدينة
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <div className="col-span-full py-12 text-center text-gray-500 font-medium">جاري التحميل...</div>
        ) : data?.length === 0 ? (
          <div className="col-span-full py-12 text-center text-gray-500 font-medium">لا يوجد مدن مضافة حالياً</div>
        ) : (
          data?.map((city) => (
            <div key={city.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-all group">
              <div className="flex justify-between items-start">
                <div className="flex items-center">
                  <div className="h-12 w-12 bg-emerald-50 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform">
                    <MapPin className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div className="mr-4">
                    <h3 className="text-xl font-bold text-gray-900">{city.name_ar}</h3>
                    <p className="text-sm text-gray-500 font-medium">{city.name_en}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => openModal(city)}
                    className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                    title="تعديل"
                  >
                    <Edit className="h-5 w-5" />
                  </button>
                  <button 
                    onClick={() => handleDelete(city.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                    title="حذف"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-gray-50 flex justify-between items-center">
                <span className={cn(
                  "inline-flex items-center px-3 py-1 rounded-full text-xs font-bold",
                  city.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                )}>
                  {city.is_active ? "نشطة" : "غير نشطة"}
                </span>
                <span className="text-sm text-gray-400 font-bold">
                  Zoom: {city.zoom_level}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#000000B3] ">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-extrabold text-gray-900">
                {editingCity ? 'تعديل مدينة' : 'إضافة مدينة جديدة'}
              </h2>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">اسم المدينة (عربي)</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-medium"
                  value={formData.name_ar || ''}
                  onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">اسم المدينة (English)</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-medium"
                  value={formData.name_en || ''}
                  onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">مستوى الزووم الافتراضي</label>
                <input
                  type="number"
                  required
                  min="1"
                  max="20"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-medium"
                  value={formData.zoom_level || 10}
                  onChange={(e) => setFormData({ ...formData, zoom_level: parseInt(e.target.value) })}
                />
              </div>
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <input
                  type="checkbox"
                  id="is_active"
                  className="w-5 h-5 text-emerald-600 border-gray-300 rounded-lg focus:ring-emerald-500 transition-all"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
                <label htmlFor="is_active" className="text-sm font-bold text-gray-700 cursor-pointer">تفعيل المدينة</label>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 bg-emerald-600 text-white px-4 py-3 rounded-2xl font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {editingCity ? 'تحديث' : 'إضافة'}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 bg-gray-100 text-gray-700 px-4 py-3 rounded-2xl font-bold hover:bg-gray-200 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {cityToDelete && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-[#000000B3] ">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm overflow-hidden text-right relative z-[10000]">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-xl font-extrabold text-gray-900">تأكيد الحذف</h3>
              <button onClick={() => setCityToDelete(null)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-gray-600 font-medium">هل أنت متأكد من حذف هذه المدينة؟ لا يمكن التراجع عن هذا الإجراء.</p>
            </div>
            <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button 
                onClick={() => deleteMutation.mutate(cityToDelete)}
                disabled={deleteMutation.isPending}
                className="flex-1 bg-red-600 text-white py-3 rounded-2xl font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'جاري الحذف...' : 'تأكيد الحذف'}
              </button>
              <button 
                onClick={() => setCityToDelete(null)}
                disabled={deleteMutation.isPending}
                className="flex-1 bg-white border border-gray-200 text-gray-700 py-3 rounded-2xl font-bold hover:bg-gray-50 transition-colors disabled:opacity-50"
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
