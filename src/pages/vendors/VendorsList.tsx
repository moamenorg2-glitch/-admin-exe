import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Search, Filter, Store, Edit, Star, CheckCircle, XCircle, Plus, X, Loader2, Download, Trash2, Ban } from 'lucide-react';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { exportToCSV } from '../../utils/export';
import { vendorService } from '../../services/vendorService';
import { userService } from '../../services/userService';
import { handleGlobalError } from '../../utils/errorHandler';
import { getApiUrl } from '../../utils/apiUtils';

export default function VendorsList() {
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Open' | 'Closed'>('All');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteVendorModalOpen, setIsDeleteVendorModalOpen] = useState(false);
  const [vendorToDelete, setVendorToDelete] = useState<any>(null);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    brand_name: '',
    primary_phone: '',
    email: '',
    password: '',
    category_id: '',
    zone_id: '',
    commission_rate: 10,
    min_order_value: 0,
    address: '',
    preparation_time_avg: 30,
    tax_registration_number: '',
    avatar_url: ''
  });

  const pageSize = 20;
  const queryClient = useQueryClient();

  const { data: categories } = useQuery({
    queryKey: ['vendor-categories-simple'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vendor_categories').select('id, name_ar');
      if (error) throw error;
      return data;
    }
  });

  const { data: zones } = useQuery({
    queryKey: ['zones-simple'],
    queryFn: async () => {
      const { data, error } = await supabase.from('zones').select('zone_id, name_ar').eq('is_active', true);
      if (error) throw error;
      return data;
    }
  });

  const { data, isLoading } = useQuery({
    queryKey: ['vendors', page, searchQuery, statusFilter],
    queryFn: async () => {
      try {
        return await vendorService.fetchVendors(page, pageSize, {
          search: searchQuery,
          statusFilter
        });
      } catch (error) {
        handleGlobalError(error, 'Fetch Vendors');
        throw error;
      }
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: boolean }) => {
      await vendorService.updateVendorStatus(id, !currentStatus);
    },
    onSuccess: () => {
      toast.success('تم تحديث حالة المتجر بنجاح');
      queryClient.invalidateQueries({ queryKey: ['vendors'] }).catch(console.error);
    },
    // Removed redundant onError: handleGlobalError is called by mutationCache in main.tsx
  });

  const toggleAccountStatusMutation = useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: string }) => {
      const newStatus = currentStatus === 'نشط' || currentStatus === 'active' ? 'محظور' : 'نشط';
      await userService.updateUserStatus(id, newStatus);
    },
    onSuccess: () => {
      toast.success('تم تحديث حالة حساب المتجر بنجاح');
      queryClient.invalidateQueries({ queryKey: ['vendors'] }).catch(console.error);
    },
  });

  const handleDeleteVendor = (vendor: any) => {
    setVendorToDelete(vendor);
    setIsDeleteVendorModalOpen(true);
  };

  const confirmDeleteVendor = () => {
    if (vendorToDelete) {
      deleteVendorMutation.mutate(vendorToDelete.user_id);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.category_id || !formData.zone_id) {
      toast.error('يرجى اختيار التصنيف والمنطقة');
      return;
    }
    if (!formData.password) {
      toast.error('يرجى إدخال كلمة المرور');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await vendorService.createVendor(formData, '');

      if (selectedFile && response.user_id) {
        const uploadFormData = new FormData();
        uploadFormData.append('file', selectedFile);
        uploadFormData.append('bucket', 'profiles');
        uploadFormData.append('path', `${response.user_id}/${Date.now()}_${selectedFile.name}`);
        
        const uploadRes = await fetch(getApiUrl('/api/admin/upload'), {
          method: 'POST',
          body: uploadFormData
        });
        
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          const avatarUrl = uploadData.publicUrl || uploadData.path;
          await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('user_id', response.user_id);
        }
      }

      toast.success('تم إضافة المتجر بنجاح');
      setIsCreateModalOpen(false);
      setFormData({
        brand_name: '',
        primary_phone: '',
        email: '',
        password: '',
        category_id: '',
        zone_id: '',
        commission_rate: 10,
        min_order_value: 0,
        address: '',
        preparation_time_avg: 30,
        tax_registration_number: '',
        avatar_url: ''
      });
      setSelectedFile(null);
      queryClient.invalidateQueries({ queryKey: ['vendors'] }).catch(console.error);
    } catch (error: any) {
      // Logic for specific handling can stay, but general handleGlobalError is at the root
      throw error; 
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateVendorMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      setIsSubmitting(true);
      try {
        await vendorService.updateVendor(selectedVendor.user_id, data);
      } finally {
        setIsSubmitting(false);
      }
    },
    onSuccess: () => {
      toast.success('تم تحديث بيانات المتجر بنجاح');
      setIsEditModalOpen(false);
      setSelectedVendor(null);
      setSelectedFile(null);
      queryClient.invalidateQueries({ queryKey: ['vendors'] }).catch(console.error);
    },
    // Removed redundant onError: handleGlobalError is called by mutationCache in main.tsx
  });

  const handleCreateClick = () => {
    setSelectedVendor(null);
    setFormData({
      brand_name: '',
      primary_phone: '',
      email: '',
      password: '',
      category_id: '',
      zone_id: '',
      commission_rate: 10,
      min_order_value: 0,
      address: '',
      preparation_time_avg: 30,
      tax_registration_number: '',
      avatar_url: ''
    });
    setIsCreateModalOpen(true);
  };

  const deleteVendorMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(getApiUrl('/api/admin/delete-user'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete vendor');
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success('تم حذف التاجر بنجاح');
      setIsDeleteVendorModalOpen(false);
      setVendorToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['vendors'] }).catch(console.error);
    },
    onError: (error: any) => {
      toast.error(error.message || 'حدث خطأ أثناء حذف التاجر');
    }
  });

  const handleEditClick = (vendor: any) => {
    setSelectedVendor(vendor);
    setFormData({
      brand_name: vendor.brand_name || '',
      primary_phone: (vendor.profile as any)?.primary_phone || '',
      email: (vendor.profile as any)?.email || '',
      password: '',
      category_id: vendor.category_id || '',
      zone_id: vendor.zone_id || '',
      commission_rate: vendor.commission_rate || 10,
      min_order_value: vendor.min_order_value || 0,
      address: vendor.landmark || '',
      preparation_time_avg: vendor.preparation_time_avg || 30,
      tax_registration_number: vendor.tax_registration_number || '',
      avatar_url: (vendor.profile as any)?.avatar_url || ''
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.category_id || !formData.zone_id) {
      toast.error('يرجى اختيار التصنيف والمنطقة');
      return;
    }

    let avatarUrl = formData.avatar_url;
    if (selectedFile && selectedVendor) {
      const uploadFormData = new FormData();
      uploadFormData.append('file', selectedFile);
      uploadFormData.append('bucket', 'profiles');
      uploadFormData.append('path', `${selectedVendor.user_id}/${Date.now()}_${selectedFile.name}`);
      
      try {
        const response = await fetch(getApiUrl('/api/admin/upload'), {
          method: 'POST',
          body: uploadFormData
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to upload image');
        }
        const data = await response.json();
        avatarUrl = data.publicUrl || data.path;
      } catch (error) {
        console.error('Upload error:', error);
        toast.error('حدث خطأ أثناء رفع الصورة');
        return;
      }
    }

    updateVendorMutation.mutate({ ...formData, avatar_url: avatarUrl });
  };

  const handleExport = () => {
    const vendors = data?.vendors;
    if (!vendors || vendors.length === 0) {
      toast.error('لا توجد بيانات للتصدير');
      return;
    }

    const exportData = vendors.map(vendor => ({
      'اسم المتجر': vendor.brand_name,
      'رقم الهاتف': vendor.profile?.primary_phone || 'غير متوفر',
      'التقييم': vendor.rating || 0,
      'المنطقة': vendor.zone?.name_ar || 'غير محدد',
      'التصنيف': vendor.category?.name_ar || 'غير محدد',
      'نسبة العمولة': `${vendor.commission_rate}%`,
      'الحد الأدنى للطلب': `${vendor.min_order_value} ج.م`,
      'متوسط وقت التحضير': `${vendor.preparation_time_avg} دقيقة`,
      'الحالة': vendor.is_active ? 'نشط' : 'غير نشط',
    }));

    exportToCSV(exportData, 'vendors_list');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-gray-900">إدارة التجار والمطاعم</h2>
          <button
            onClick={handleCreateClick}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة متجر جديد</span>
          </button>
        </div>
        
        {/* Filters & Search */}
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <button
            onClick={handleExport}
            className="flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>تصدير</span>
          </button>
          <div className="relative">
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="بحث باسم المتجر..."
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
              <option value="Open">مفتوح</option>
              <option value="Closed">مغلق</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white shadow-sm overflow-hidden sm:rounded-2xl border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-50/50 border-b border-gray-100">
              <tr>
                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                  المتجر
                </th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                  التصنيف
                </th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                  العمولة
                </th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                  الحد الأدنى للطلب
                </th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                  الحالة
                </th>
                <th scope="col" className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">
                  إجراءات
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-50">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={`vendors-skeleton-${index}`} className="animate-pulse">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                        <div>
                          <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
                          <div className="h-3 bg-gray-200 rounded w-24"></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-16"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-20"></div></td>
                    <td className="px-6 py-4"><div className="h-6 bg-gray-200 rounded-full w-20"></div></td>
                    <td className="px-6 py-4"><div className="h-8 bg-gray-200 rounded-2xl w-24 mx-auto"></div></td>
                  </tr>
                ))
              ) : data?.vendors?.length === 0 ? (
                <tr key="vendors-empty">
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    لا يوجد تجار يطابقون معايير البحث
                  </td>
                </tr>
              ) : (
                data?.vendors?.map((vendor, idx) => (
                  <tr key={vendor.user_id || `vendor-${idx}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center overflow-hidden">
                          {vendor.profile?.avatar_url ? (
                            <img src={vendor.profile.avatar_url} alt="" className="h-10 w-10 object-cover" />
                          ) : (
                            <Store className="h-5 w-5 text-emerald-600" />
                          )}
                        </div>
                        <div className="mr-4">
                          <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                            {vendor.brand_name}
                            {vendor.is_featured && <Star className="w-3 h-3 text-yellow-400 fill-current" />}
                          </div>
                          <div className="text-sm text-gray-500" dir="ltr">{(vendor.profile as any)?.primary_phone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {(vendor.category as any)?.name_ar || 'غير مصنف'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {vendor.commission_rate ? `${vendor.commission_rate}%` : 'غير محدد'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {vendor.min_order_value ? `${vendor.min_order_value} ج.م` : 'لا يوجد'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={cn(
                        "px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full",
                        vendor.is_open ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      )}>
                        {vendor.is_open ? 'مفتوح' : 'مغلق'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => toggleAccountStatusMutation.mutate({ id: vendor.user_id, currentStatus: vendor.profile?.status || 'نشط' })}
                          disabled={toggleAccountStatusMutation.isPending}
                          className={cn(
                            "p-2 rounded-md transition-colors inline-flex items-center gap-1",
                            vendor.profile?.status === 'نشط' || vendor.profile?.status === 'active'
                              ? "text-red-600 hover:text-red-900 bg-red-50" 
                              : "text-green-600 hover:text-green-900 bg-green-50"
                          )}
                          title={vendor.profile?.status === 'نشط' || vendor.profile?.status === 'active' ? "إيقاف الحساب" : "تفعيل الحساب"}
                        >
                          {vendor.profile?.status === 'نشط' || vendor.profile?.status === 'active' ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                        </button>
                        <button 
                          onClick={() => toggleStatusMutation.mutate({ id: vendor.user_id, currentStatus: vendor.is_open })}
                          disabled={toggleStatusMutation.isPending}
                          className={cn(
                            "p-2 rounded-md transition-colors inline-flex items-center gap-1",
                            vendor.is_open 
                              ? "text-orange-600 hover:text-orange-900 bg-orange-50" 
                              : "text-blue-600 hover:text-blue-900 bg-blue-50"
                          )}
                          title={vendor.is_open ? "إغلاق المتجر (لا يستقبل طلبات)" : "فتح المتجر"}
                        >
                          {vendor.is_open ? <XCircle className="w-4 h-4" /> : <Store className="w-4 h-4" />}
                        </button>
                        <button 
                          onClick={() => handleEditClick(vendor)}
                          className="text-emerald-600 hover:text-emerald-900 bg-emerald-50 p-2 rounded-md transition-colors inline-flex items-center gap-1"
                        >
                          <Edit className="w-4 h-4" />
                          <span>إدارة</span>
                        </button>
                        <button 
                          onClick={() => handleDeleteVendor(vendor)}
                          className="text-red-600 hover:text-red-900 bg-red-50 p-2 rounded-md transition-colors inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>حذف</span>
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
                  عرض <span className="font-medium">{page * pageSize + 1}</span> إلى <span className="font-medium">{Math.min((page + 1) * pageSize, data.count)}</span> من أصل <span className="font-medium">{data.count}</span> تاجر
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

      {/* Create Vendor Modal */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-shrink-0">
                <h3 className="text-xl font-bold text-gray-900">إضافة متجر جديد</h3>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">شعار المتجر</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">اسم المتجر / العلامة التجارية</label>
                    <input
                      required
                      type="text"
                      value={formData.brand_name}
                      onChange={(e) => setFormData({ ...formData, brand_name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                      placeholder="أدخل اسم المتجر"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">رقم الهاتف</label>
                    <input
                      required
                      type="tel"
                      value={formData.primary_phone}
                      onChange={(e) => setFormData({ ...formData, primary_phone: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                      placeholder="01xxxxxxxxx"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">التصنيف</label>
                    <select
                      required
                      value={formData.category_id}
                      onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    >
                      <option value="">اختر التصنيف</option>
                      {categories?.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name_ar}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">المنطقة</label>
                    <select
                      required
                      value={formData.zone_id}
                      onChange={(e) => setFormData({ ...formData, zone_id: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    >
                      <option value="">اختر المنطقة</option>
                      {zones?.map((zone) => (
                        <option key={zone.zone_id} value={zone.zone_id}>
                          {zone.name_ar}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">نسبة العمولة (%)</label>
                    <input
                      required
                      type="number"
                      min="0"
                      max="100"
                      value={formData.commission_rate}
                      onChange={(e) => setFormData({ ...formData, commission_rate: Number(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">الحد الأدنى للطلب (ج.م)</label>
                    <input
                      required
                      type="number"
                      min="0"
                      value={formData.min_order_value}
                      onChange={(e) => setFormData({ ...formData, min_order_value: Number(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">البريد الإلكتروني (اختياري)</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                      placeholder="example@mail.com"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">كلمة المرور (للدخول)</label>
                    <input
                      required
                      type="text"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                      placeholder="أدخل كلمة المرور"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">السجل التجاري</label>
                    <input
                      type="text"
                      value={formData.tax_registration_number}
                      onChange={(e) => setFormData({ ...formData, tax_registration_number: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                      placeholder="أدخل رقم السجل التجاري"
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-gray-100">
                  <h4 className="font-bold text-gray-900">تفاصيل المتجر الإضافية</h4>
                  
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">العنوان بالتفصيل</label>
                    <input
                      required
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                      placeholder="أدخل عنوان المتجر"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">متوسط وقت التحضير (بالدقائق)</label>
                    <input
                      required
                      type="number"
                      min="0"
                      value={formData.preparation_time_avg}
                      onChange={(e) => setFormData({ ...formData, preparation_time_avg: Number(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-emerald-600 text-white py-2 rounded-lg font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'حفظ البيانات'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-bold hover:bg-gray-200 transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Vendor Modal */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-shrink-0">
                <h3 className="text-xl font-bold text-gray-900">تعديل بيانات المتجر</h3>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">شعار المتجر</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">اسم العلامة التجارية</label>
                    <input
                      required
                      type="text"
                      value={formData.brand_name}
                      onChange={(e) => setFormData({ ...formData, brand_name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                      placeholder="أدخل اسم المتجر"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">رقم الهاتف</label>
                    <input
                      required
                      type="tel"
                      value={formData.primary_phone}
                      onChange={(e) => setFormData({ ...formData, primary_phone: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                      placeholder="01xxxxxxxxx"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">التصنيف</label>
                    <select
                      required
                      value={formData.category_id}
                      onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    >
                      <option value="">اختر التصنيف</option>
                      {categories?.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name_ar}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">المنطقة</label>
                    <select
                      required
                      value={formData.zone_id}
                      onChange={(e) => setFormData({ ...formData, zone_id: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    >
                      <option value="">اختر المنطقة</option>
                      {zones?.map((zone) => (
                        <option key={zone.zone_id} value={zone.zone_id}>
                          {zone.name_ar}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">نسبة العمولة (%)</label>
                    <input
                      required
                      type="number"
                      value={formData.commission_rate}
                      onChange={(e) => setFormData({ ...formData, commission_rate: Number(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                      min="0"
                      max="100"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">الحد الأدنى للطلب</label>
                    <input
                      required
                      type="number"
                      value={formData.min_order_value}
                      onChange={(e) => setFormData({ ...formData, min_order_value: Number(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                      min="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">كلمة المرور (للتغيير)</label>
                    <input
                      type="text"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                      placeholder="اتركها فارغة إذا لم ترد التغيير"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">السجل التجاري</label>
                    <input
                      type="text"
                      value={formData.tax_registration_number}
                      onChange={(e) => setFormData({ ...formData, tax_registration_number: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                      placeholder="أدخل رقم السجل التجاري"
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-gray-100">
                  <h4 className="font-bold text-gray-900">تفاصيل المتجر الإضافية</h4>
                  
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">العنوان بالتفصيل</label>
                    <input
                      required
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                      placeholder="أدخل عنوان المتجر"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">متوسط وقت التحضير (بالدقائق)</label>
                    <input
                      required
                      type="number"
                      min="0"
                      value={formData.preparation_time_avg}
                      onChange={(e) => setFormData({ ...formData, preparation_time_avg: Number(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-emerald-600 text-white py-2 rounded-lg font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'حفظ التعديلات'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-bold hover:bg-gray-200 transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Vendor Confirmation Modal */}
      <AnimatePresence>
        {isDeleteVendorModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-6"
            >
              <div className="flex items-center gap-4 text-red-600">
                <div className="p-3 bg-red-100 rounded-full">
                  <Trash2 className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold">تأكيد حذف التاجر</h3>
              </div>
              
              <p className="text-gray-600">
                هل أنت متأكد من رغبتك في حذف التاجر <span className="font-bold text-gray-900">{vendorToDelete?.brand_name}</span>؟
                هذا الإجراء سيؤدي إلى حذف حساب التاجر وجميع بيانات المتجر المرتبطة به.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={confirmDeleteVendor}
                  disabled={deleteVendorMutation.isPending}
                  className="flex-1 bg-red-600 text-white py-2 rounded-lg font-bold hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deleteVendorMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'تأكيد الحذف'}
                </button>
                <button
                  onClick={() => setIsDeleteVendorModalOpen(false)}
                  className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-bold hover:bg-gray-200 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
