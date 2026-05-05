import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Search, Plus, Edit, Trash2, Store, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { ImageManager } from '../../components/ImageManager';

interface Category {
  id: string;
  name_ar: string;
  name_en: string;
  icon_url: string | null;
  sort_order: number | null;
}

export default function CategoriesList() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name_ar: '',
    name_en: '',
    icon_url: '',
    sort_order: 0
  });
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['vendor_categories', searchQuery],
    queryFn: async () => {
      let query = supabase
        .from('vendor_categories')
        .select('*')
        .order('sort_order', { ascending: true });

      if (searchQuery) {
        query = query.or(`name_ar.ilike.%${searchQuery}%,name_en.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Category[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (newCategory: any) => {
      const { data, error } = await supabase
        .from('vendor_categories')
        .insert([newCategory])
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor_categories'] }).catch(console.error);
      toast.success('تم إضافة التصنيف بنجاح');
      closeModal();
    },
    onError: (error: any) => {
      toast.error('خطأ في إضافة التصنيف: ' + error.message);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { data, error } = await supabase
        .from('vendor_categories')
        .update(updates)
        .eq('id', id)
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor_categories'] }).catch(console.error);
      toast.success('تم تحديث التصنيف بنجاح');
      closeModal();
    },
    onError: (error: any) => {
      toast.error('خطأ في تحديث التصنيف: ' + error.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('vendor_categories')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor_categories'] }).catch(console.error);
      toast.success('تم حذف التصنيف بنجاح');
      setCategoryToDelete(null);
    },
    onError: (error: any) => {
      toast.error('خطأ في حذف التصنيف: ' + error.message);
    }
  });

  const openModal = (category: Category | null = null) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name_ar: category.name_ar,
        name_en: category.name_en,
        icon_url: category.icon_url || '',
        sort_order: category.sort_order || 0
      });
    } else {
      setEditingCategory(null);
      setFormData({
        name_ar: '',
        name_en: '',
        icon_url: '',
        sort_order: 0
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCategory(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: string) => {
    setCategoryToDelete(id);
  };

  return (
    <div className="space-y-8 pb-12" dir="rtl">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-emerald-100 rounded-2xl shadow-sm">
            <Store className="w-7 h-7 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">تصنيفات المتاجر</h2>
            <p className="mt-1 text-gray-500 font-medium">إدارة تصنيفات المتاجر والمطاعم في التطبيق.</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
          <div className="relative group flex-1 sm:w-72">
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
            </div>
            <input
              type="text"
              placeholder="بحث باسم التصنيف..."
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
            إضافة تصنيف
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          <div className="col-span-full py-12 text-center text-gray-500 font-medium">جاري التحميل...</div>
        ) : data?.length === 0 ? (
          <div className="col-span-full py-12 text-center text-gray-500 font-medium">لا يوجد تصنيفات مضافة حالياً</div>
        ) : (
          data?.map((category) => (
            <div key={category.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-all group">
              <div className="flex flex-col items-center text-center">
                <div className="h-20 w-20 bg-emerald-50 rounded-full flex items-center justify-center mb-4 overflow-hidden group-hover:scale-105 transition-transform">
                  {category.icon_url ? (
                    <img src={category.icon_url} alt="" className="h-full w-full object-cover rounded-full" referrerPolicy="no-referrer" />
                  ) : (
                    <Store className="h-10 w-10 text-emerald-600" />
                  )}
                </div>
                <h3 className="text-xl font-bold text-gray-900">{category.name_ar}</h3>
                <p className="text-sm text-gray-500 font-medium mt-1">{category.name_en}</p>
                
                <div className="mt-6 flex gap-3 w-full">
                  <button 
                    onClick={() => openModal(category)}
                    className="flex-1 py-2 text-gray-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl border border-gray-200 hover:border-emerald-200 text-sm font-bold flex items-center justify-center gap-2 transition-all"
                  >
                    <Edit className="h-4 w-4" />
                    تعديل
                  </button>
                  <button 
                    onClick={() => handleDelete(category.id)}
                    className="flex-1 py-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-xl border border-gray-200 hover:border-red-200 text-sm font-bold flex items-center justify-center gap-2 transition-all"
                  >
                    <Trash2 className="h-4 w-4" />
                    حذف
                  </button>
                </div>
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
                {editingCategory ? 'تعديل تصنيف' : 'إضافة تصنيف جديد'}
              </h2>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">اسم التصنيف (عربي)</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-medium"
                  value={formData.name_ar || ''}
                  onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">اسم التصنيف (English)</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-medium"
                  value={formData.name_en || ''}
                  onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">أيقونة التصنيف</label>
                <div className="flex flex-col gap-3">
                  <ImageManager
                    bucket="categories"
                    path={`icons/${editingCategory?.id || 'new'}_${Date.now()}`}
                    currentImageUrl={formData.icon_url || ''}
                    onImageChanged={(newUrl) => setFormData({ ...formData, icon_url: newUrl })}
                  />
                  <input
                    type="url"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-medium text-left"
                    dir="ltr"
                    value={formData.icon_url || ''}
                    onChange={(e) => setFormData({ ...formData, icon_url: e.target.value })}
                    placeholder="https://example.com/icon.png أو ارفع صورة"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">ترتيب العرض</label>
                <input
                  type="number"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-medium"
                  value={formData.sort_order || 0}
                  onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) })}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 bg-emerald-600 text-white px-4 py-3 rounded-2xl font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {editingCategory ? 'تحديث' : 'إضافة'}
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
      {categoryToDelete && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-[#000000B3] ">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm overflow-hidden text-right relative z-[10000]">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-xl font-extrabold text-gray-900">تأكيد الحذف</h3>
              <button onClick={() => setCategoryToDelete(null)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-gray-600 font-medium">هل أنت متأكد من حذف هذا التصنيف؟ لا يمكن التراجع عن هذا الإجراء.</p>
            </div>
            <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button 
                onClick={() => deleteMutation.mutate(categoryToDelete)}
                disabled={deleteMutation.isPending}
                className="flex-1 bg-red-600 text-white py-3 rounded-2xl font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'جاري الحذف...' : 'تأكيد الحذف'}
              </button>
              <button 
                onClick={() => setCategoryToDelete(null)}
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
