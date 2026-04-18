import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Search, Filter, Package, Edit, Plus, CheckCircle, XCircle, Store, X, Settings2, LayoutGrid } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ImageManager } from '../../components/ImageManager';
import MenuSectionsManager from '../../components/products/MenuSectionsManager';
import ModifiersManager from '../../components/products/ModifiersManager';
import toast from 'react-hot-toast';

interface ProductFormData {
  id?: string;
  name_ar: string;
  base_price: number;
  vendor_id: string;
  section_id?: string;
  image_url: string;
  is_available: boolean;
}

export default function ProductsList() {
  console.log('ProductsList render');
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Available' | 'Unavailable'>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSectionsManagerOpen, setIsSectionsManagerOpen] = useState(false);
  const [isModifiersManagerOpen, setIsModifiersManagerOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);
  const [selectedProductForModifiers, setSelectedProductForModifiers] = useState<{ id: string, vendorId: string } | null>(null);
  const [editingProduct, setEditingProduct] = useState<ProductFormData | null>(null);
  const [formData, setFormData] = useState<ProductFormData>({
    name_ar: '',
    base_price: 0,
    vendor_id: '',
    image_url: '',
    is_available: true,
  });

  const pageSize = 20;
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['products', page, searchQuery, statusFilter, selectedVendor],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select(`
          *,
          vendor_details:vendor_id (brand_name),
          menu_sections:section_id (name_ar)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (searchQuery) {
        query = query.ilike('name_ar', `%${searchQuery}%`);
      }

      if (statusFilter !== 'All') {
        query = query.eq('is_available', statusFilter === 'Available');
      }

      if (selectedVendor) {
        query = query.eq('vendor_id', selectedVendor);
      }

      const { data, count, error } = await query;
      if (error) throw error;
      return { products: data as any[], count };
    },
  });

  const { data: vendors } = useQuery({
    queryKey: ['vendors-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendor_details')
        .select('user_id, brand_name')
        .order('brand_name');
      if (error) throw error;
      return data;
    }
  });

  const { data: sections } = useQuery({
    queryKey: ['sections-list', formData.vendor_id],
    enabled: !!formData.vendor_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_sections')
        .select('id, name_ar')
        .eq('vendor_id', formData.vendor_id)
        .order('sort_order');
      if (error) throw error;
      return data;
    }
  });

  const upsertProductMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      if (data.id) {
        const { error } = await supabase
          .from('products')
          .update({
            name_ar: data.name_ar,
            base_price: data.base_price,
            vendor_id: data.vendor_id,
            section_id: data.section_id || null,
            image_url: data.image_url,
            is_available: data.is_available,
          })
          .eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('products')
          .insert([{
            name_ar: data.name_ar,
            base_price: data.base_price,
            vendor_id: data.vendor_id,
            section_id: data.section_id || null,
            image_url: data.image_url,
            is_available: data.is_available,
          }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingProduct ? 'تم تحديث المنتج بنجاح' : 'تم إضافة المنتج بنجاح');
      setIsModalOpen(false);
      setEditingProduct(null);
      setFormData({
        name_ar: '',
        base_price: 0,
        vendor_id: '',
        image_url: '',
        is_available: true,
      });
      queryClient.invalidateQueries({ queryKey: ['products'] }).catch(console.error);
    },
    onError: (error) => {
      console.error('Error upserting product:', error);
      toast.error('حدث خطأ أثناء حفظ المنتج');
    }
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: boolean }) => {
      const { error } = await supabase
        .from('products')
        .update({ is_available: !currentStatus })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم تحديث حالة المنتج بنجاح');
      queryClient.invalidateQueries({ queryKey: ['products'] }).catch(console.error);
    },
    onError: (error) => {
      console.error('Error updating product status:', error);
      toast.error('حدث خطأ أثناء تحديث حالة المنتج');
    }
  });

  const handleEdit = (product: any) => {
    setEditingProduct(product);
    setFormData({
      id: product.id,
      name_ar: product.name_ar,
      base_price: product.base_price,
      vendor_id: product.vendor_id,
      section_id: product.section_id,
      image_url: product.image_url || '',
      is_available: product.is_available,
    });
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setEditingProduct(null);
    setFormData({
      name_ar: '',
      base_price: 0,
      vendor_id: selectedVendor || '',
      image_url: '',
      is_available: true,
    });
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-8 pb-12" dir="rtl">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-emerald-100 rounded-2xl shadow-sm">
            <Package className="w-7 h-7 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">إدارة المنتجات</h2>
            <p className="mt-1 text-gray-500 font-medium">إضافة وتعديل المنتجات المتاحة في المتجر.</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
          <div className="flex items-center gap-2">
            <select
              value={selectedVendor || ''}
              onChange={(e) => setSelectedVendor(e.target.value)}
              className="px-4 py-3 bg-white border border-gray-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-emerald-500 text-sm font-bold appearance-none transition-all"
            >
              <option value="">تصفية حسب المتجر...</option>
              {vendors?.map((v) => (
                <option key={v.user_id} value={v.user_id}>{v.brand_name}</option>
              ))}
            </select>
            {selectedVendor && (
              <button
                onClick={() => setIsSectionsManagerOpen(true)}
                className="inline-flex items-center justify-center px-4 py-3 bg-amber-50 text-amber-600 border border-amber-100 rounded-2xl text-sm font-bold hover:bg-amber-100 transition-all"
              >
                <LayoutGrid className="w-4 h-4 ml-2" />
                إدارة الفئات
              </button>
            )}
          </div>

          <div className="relative group flex-1 sm:w-72">
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
            </div>
            <input
              type="text"
              placeholder="بحث باسم المنتج..."
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
              <option value="Available">متاح</option>
              <option value="Unavailable">غير متاح</option>
            </select>
          </div>

          <button 
            onClick={handleAdd}
            className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-sm font-bold rounded-2xl shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-5 h-5 ml-2" />
            إضافة منتج
          </button>
        </div>
      </div>

      <div className="bg-white shadow-sm overflow-hidden sm:rounded-3xl border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-50/50 border-b border-gray-100">
              <tr>
                <th scope="col" className="px-8 py-5 text-right text-xs font-bold text-gray-500 uppercase tracking-widest">
                  المنتج
                </th>
                <th scope="col" className="px-8 py-5 text-right text-xs font-bold text-gray-500 uppercase tracking-widest">
                  المتجر
                </th>
                <th scope="col" className="px-8 py-5 text-right text-xs font-bold text-gray-500 uppercase tracking-widest">
                  السعر الأساسي
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
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index} className="animate-pulse">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gray-200 rounded-xl"></div>
                        <div className="h-4 bg-gray-200 rounded w-32"></div>
                      </div>
                    </td>
                    <td className="px-8 py-5"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                    <td className="px-8 py-5"><div className="h-4 bg-gray-200 rounded w-16"></div></td>
                    <td className="px-8 py-5"><div className="h-6 bg-gray-200 rounded-full w-20"></div></td>
                    <td className="px-8 py-5"><div className="h-8 bg-gray-200 rounded-2xl w-24 mx-auto"></div></td>
                  </tr>
                ))
              ) : data?.products?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-12 text-center text-gray-500 font-medium">
                    لا توجد منتجات تطابق معايير البحث
                  </td>
                </tr>
              ) : (
                data?.products?.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-8 py-5 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-14 w-14 bg-gray-50 rounded-2xl overflow-hidden border border-gray-100 group-hover:scale-105 transition-transform">
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.name_ar} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center">
                              <Package className="h-6 w-6 text-gray-400" />
                            </div>
                          )}
                        </div>
                        <div className="mr-4">
                          <div className="text-sm font-bold text-gray-900">{product.name_ar}</div>
                          <div className="text-xs text-gray-400 font-medium mt-0.5">
                            {product.menu_sections?.name_ar || 'بدون قسم'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
                        <Store className="w-4 h-4 text-emerald-500" />
                        <span>{product.vendor_details?.brand_name || 'غير معروف'}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <div className="text-sm font-black text-gray-900">
                        {product.base_price.toLocaleString()} ج.م
                      </div>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <span className={cn(
                        "inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold border",
                        product.is_available ? "bg-green-100 text-green-700 border-green-200" : "bg-red-100 text-red-700 border-red-200"
                      )}>
                        {product.is_available ? 'متاح' : 'غير متاح'}
                      </span>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-3">
                        <button 
                          onClick={() => {
                            setSelectedProductForModifiers({ id: product.id, vendorId: product.vendor_id });
                            setIsModifiersManagerOpen(true);
                          }}
                          className="p-2.5 text-amber-600 hover:bg-amber-50 border border-amber-100 rounded-xl transition-all"
                          title="إدارة الإضافات"
                        >
                          <Settings2 className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => toggleStatusMutation.mutate({ id: product.id, currentStatus: product.is_available })}
                          disabled={toggleStatusMutation.isPending}
                          className={cn(
                            "p-2.5 rounded-xl transition-all border",
                            product.is_available 
                              ? "text-red-600 hover:bg-red-50 border-red-100" 
                              : "text-green-600 hover:bg-green-50 border-green-100"
                          )}
                          title={product.is_available ? "تعطيل" : "تفعيل"}
                        >
                          {product.is_available ? <XCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                        </button>
                        <button 
                          onClick={() => handleEdit(product)}
                          className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl text-xs font-bold transition-all border border-emerald-100"
                        >
                          <Edit className="w-4 h-4" />
                          <span>تعديل</span>
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
          <div className="bg-gray-50/30 px-8 py-5 border-t border-gray-100 flex items-center justify-between">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="relative inline-flex items-center px-4 py-2 border border-gray-200 text-sm font-bold rounded-xl text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 transition-all"
              >
                السابق
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={(page + 1) * pageSize >= data.count}
                className="relative inline-flex items-center px-4 py-2 border border-gray-200 text-sm font-bold rounded-xl text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 transition-all"
              >
                التالي
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">
                  عرض <span className="font-bold text-gray-900">{page * pageSize + 1}</span> إلى <span className="font-bold text-gray-900">{Math.min((page + 1) * pageSize, data.count)}</span> من أصل <span className="font-bold text-gray-900">{data.count}</span> منتج
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-xl shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="relative inline-flex items-center px-4 py-2 rounded-r-xl border border-gray-200 bg-white text-sm font-bold text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-all"
                  >
                    السابق
                  </button>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={(page + 1) * pageSize >= data.count}
                    className="relative inline-flex items-center px-4 py-2 rounded-l-xl border border-gray-200 bg-white text-sm font-bold text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-all"
                  >
                    التالي
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modifiers Manager Modal */}
      {isModifiersManagerOpen && selectedProductForModifiers && (
        <ModifiersManager
          productId={selectedProductForModifiers.id}
          vendorId={selectedProductForModifiers.vendorId}
          onClose={() => {
            setIsModifiersManagerOpen(false);
            setSelectedProductForModifiers(null);
          }}
        />
      )}

      {/* Sections Manager Modal */}
      {isSectionsManagerOpen && selectedVendor && (
        <MenuSectionsManager
          vendorId={selectedVendor}
          onClose={() => setIsSectionsManagerOpen(false)}
        />
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100">
            <div className="px-8 pt-8 pb-6 flex-shrink-0 border-b border-gray-50">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-100 rounded-2xl">
                    <Package className="w-6 h-6 text-emerald-600" />
                  </div>
                  <h3 className="text-2xl font-black text-gray-900">
                    {editingProduct ? 'تعديل منتج' : 'إضافة منتج جديد'}
                  </h3>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)} 
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-8 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 mr-1">اسم المنتج (بالعربية)</label>
                  <input
                    type="text"
                    value={formData.name_ar || ''}
                    onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                    placeholder="مثال: بيتزا مارجريتا"
                    className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 mr-1">السعر الأساسي</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={formData.base_price || 0}
                      onChange={(e) => setFormData({ ...formData, base_price: Number(e.target.value) })}
                      className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-black transition-all"
                    />
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 font-bold">ج.م</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 mr-1">المتجر</label>
                  <select
                    value={formData.vendor_id || ''}
                    onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value, section_id: '' })}
                    className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-bold appearance-none transition-all"
                  >
                    <option value="">اختر المتجر</option>
                    {vendors?.map((v) => (
                      <option key={v.user_id} value={v.user_id}>{v.brand_name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 mr-1">القسم (اختياري)</label>
                  <select
                    value={formData.section_id || ''}
                    onChange={(e) => setFormData({ ...formData, section_id: e.target.value })}
                    disabled={!formData.vendor_id}
                    className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-bold appearance-none transition-all disabled:opacity-50"
                  >
                    <option value="">بدون قسم</option>
                    {sections?.map((s) => (
                      <option key={s.id} value={s.id}>{s.name_ar}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 mr-1">الحالة</label>
                  <select
                    value={formData.is_available ? 'true' : 'false'}
                    onChange={(e) => setFormData({ ...formData, is_available: e.target.value === 'true' })}
                    className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-bold appearance-none transition-all"
                  >
                    <option value="true">متاح</option>
                    <option value="false">غير متاح</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-gray-50">
                <label className="text-lg font-black text-gray-900 block">صورة المنتج</label>
                <div className="bg-gray-50 p-6 rounded-[2rem] border-2 border-dashed border-gray-200">
                  <ImageManager
                    bucket="products"
                    path={`${formData.vendor_id}/${formData.id || 'new'}/${Math.random().toString(36).substring(7)}.jpg`}
                    currentImageUrl={formData.image_url}
                    onImageChanged={(newUrl) => setFormData({ ...formData, image_url: newUrl })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 mr-1">أو أدخل رابط الصورة مباشرة</label>
                  <input
                    type="text"
                    value={formData.image_url || ''}
                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                    placeholder="https://example.com/image.jpg"
                    className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium transition-all"
                    dir="ltr"
                  />
                  {!formData.id && <p className="text-xs text-emerald-600 font-bold mt-2 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    يجب حفظ المنتج أولاً لتمكين رفع الصورة
                  </p>}
                </div>
              </div>
            </div>

            <div className="px-8 py-6 bg-gray-50/50 border-t border-gray-50 flex flex-col sm:flex-row-reverse gap-3">
              <button
                type="button"
                onClick={() => upsertProductMutation.mutate(formData)}
                disabled={upsertProductMutation.isPending || !formData.name_ar || !formData.vendor_id}
                className="flex-1 inline-flex justify-center items-center px-8 py-4 bg-emerald-600 text-white text-base font-black rounded-2xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all disabled:opacity-50 transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {upsertProductMutation.isPending ? 'جاري الحفظ...' : 'حفظ المنتج'}
              </button>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 inline-flex justify-center items-center px-8 py-4 bg-white border border-gray-200 text-base font-bold text-gray-700 rounded-2xl hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all"
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
