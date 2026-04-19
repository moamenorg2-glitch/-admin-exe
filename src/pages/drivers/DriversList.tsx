import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Search, Filter, Car, Edit, Star, MapPin, Power, PowerOff, Plus, X, Loader2, Download, Eye, Trash2, User, Ban, CheckCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { exportToCSV } from '../../utils/export';
import { driverService } from '../../services/driverService';
import { userService } from '../../services/userService';
import { handleGlobalError } from '../../utils/errorHandler';

export default function DriversList() {
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Online' | 'Offline' | 'Busy'>('All');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [driverToDelete, setDriverToDelete] = useState<any>(null);
  const [selectedDriver, setSelectedDriver] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const [formData, setFormData] = useState({
    full_name: '',
    primary_phone: '',
    email: '',
    password: '',
    zone_id: '',
    vehicle_type: '',
    vehicle_model: '',
    license_plate: '',
    national_id: '',
    avatar_url: ''
  });

  const pageSize = 20;
  const queryClient = useQueryClient();

  const { data: zones } = useQuery({
    queryKey: ['zones-simple'],
    queryFn: async () => {
      const { data, error } = await supabase.from('zones').select('zone_id, name_ar').eq('is_active', true);
      if (error) throw error;
      return data;
    }
  });

  const { data, isLoading } = useQuery({
    queryKey: ['drivers', page, searchQuery, statusFilter],
    queryFn: async () => {
      try {
        return await driverService.fetchDrivers(page, pageSize, {
          search: searchQuery,
          status: statusFilter === 'All' ? undefined : statusFilter.toLowerCase() as any
        });
      } catch (error) {
        handleGlobalError(error, 'Fetch Drivers');
        throw error;
      }
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: boolean }) => {
      await driverService.updateDriverStatus(id, !currentStatus);
    },
    onSuccess: () => {
      toast.success('تم تحديث حالة السائق بنجاح');
      queryClient.invalidateQueries({ queryKey: ['drivers'] }).catch(console.error);
    },
    onError: (error) => {
      handleGlobalError(error, 'Update Driver Status');
    }
  });

  const toggleBusyMutation = useMutation({
    mutationFn: async ({ id, isBusy }: { id: string; isBusy: boolean }) => {
      await driverService.updateDriverBusyStatus(id, isBusy);
    },
    onSuccess: () => {
      toast.success('تم تحديث حالة السائق بنجاح');
      queryClient.invalidateQueries({ queryKey: ['drivers'] }).catch(console.error);
    },
    onError: (error) => {
      handleGlobalError(error, 'Update Driver Busy Status');
    }
  });

  const toggleAccountStatusMutation = useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: string }) => {
      const newStatus = currentStatus === 'نشط' || currentStatus === 'active' ? 'محظور' : 'نشط';
      await userService.updateUserStatus(id, newStatus);
    },
    onSuccess: () => {
      toast.success('تم تحديث حالة حساب السائق بنجاح');
      queryClient.invalidateQueries({ queryKey: ['drivers'] }).catch(console.error);
    },
  });

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.zone_id) {
      toast.error('يرجى اختيار المنطقة');
      return;
    }
    if (!formData.password) {
      toast.error('يرجى إدخال كلمة المرور');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await driverService.createDriver(formData, '');

      if (selectedFile && response.user_id) {
        const uploadFormData = new FormData();
        uploadFormData.append('file', selectedFile);
        uploadFormData.append('bucket', 'profiles');
        uploadFormData.append('path', `${response.user_id}/${Date.now()}_${selectedFile.name}`);
        
        const uploadRes = await fetch('/api/admin/upload', {
          method: 'POST',
          body: uploadFormData
        });
        
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          const avatarUrl = uploadData.publicUrl || uploadData.path;
          await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('user_id', response.user_id);
        }
      }

      toast.success('تم إضافة السائق بنجاح');
      setIsCreateModalOpen(false);
      setFormData({
        full_name: '',
        primary_phone: '',
        email: '',
        password: '',
        zone_id: '',
        vehicle_type: '',
        vehicle_model: '',
        license_plate: '',
        national_id: '',
        avatar_url: ''
      });
      setSelectedFile(null);
      queryClient.invalidateQueries({ queryKey: ['drivers'] }).catch(console.error);
    } catch (error: any) {
      handleGlobalError(error, 'Create Driver');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateDriverMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      setIsSubmitting(true);
      try {
        await driverService.updateDriver(selectedDriver.user_id, data);
      } finally {
        setIsSubmitting(false);
      }
    },
    onSuccess: () => {
      toast.success('تم تحديث بيانات السائق بنجاح');
      setIsEditModalOpen(false);
      setSelectedDriver(null);
      setSelectedFile(null);
      queryClient.invalidateQueries({ queryKey: ['drivers'] }).catch(console.error);
    },
    onError: (error: any) => {
      handleGlobalError(error, 'Update Driver');
    }
  });

  const deleteDriverMutation = useMutation({
    mutationFn: async (userId: string) => {
      await driverService.deleteDriver(userId);
    },
    onSuccess: () => {
      toast.success('تم حذف السائق بنجاح');
      setIsDeleteDialogOpen(false);
      setDriverToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['drivers'] }).catch(console.error);
    },
    onError: (error: any) => {
      handleGlobalError(error, 'Delete Driver');
    }
  });

  const handleCreateClick = () => {
    setSelectedDriver(null);
    setFormData({
      full_name: '',
      primary_phone: '',
      email: '',
      password: '',
      zone_id: '',
      vehicle_type: '',
      vehicle_model: '',
      license_plate: '',
      national_id: '',
      avatar_url: ''
    });
    setIsCreateModalOpen(true);
  };

  const handleDeleteClick = (driver: any) => {
    setDriverToDelete(driver);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (driverToDelete) {
      deleteDriverMutation.mutate(driverToDelete.user_id);
    }
  };

  const handleViewClick = (driver: any) => {
    setSelectedDriver(driver);
    setIsViewModalOpen(true);
  };

  const handleEditClick = (driver: any) => {
    setSelectedDriver(driver);
    setFormData({
      full_name: driver.profile?.full_name || '',
      primary_phone: driver.profile?.primary_phone || '',
      email: driver.profile?.email || '',
      password: '',
      zone_id: driver.zone_id || '',
      vehicle_type: driver.vehicle_type || '',
      vehicle_model: driver.vehicle_model || '',
      license_plate: driver.license_plate || '',
      national_id: driver.national_id || '',
      avatar_url: (driver.profile as any)?.avatar_url || ''
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.zone_id) {
      toast.error('يرجى اختيار المنطقة');
      return;
    }

    let avatarUrl = formData.avatar_url;
    if (selectedFile && selectedDriver) {
      const uploadFormData = new FormData();
      uploadFormData.append('file', selectedFile);
      uploadFormData.append('bucket', 'profiles');
      uploadFormData.append('path', `${selectedDriver.user_id}/${Date.now()}_${selectedFile.name}`);
      
      try {
        const response = await fetch('/api/admin/upload', {
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

    updateDriverMutation.mutate({ ...formData, avatar_url: avatarUrl });
  };

  const handleExport = () => {
    const drivers = data?.drivers;
    if (!drivers || drivers.length === 0) {
      toast.error('لا توجد بيانات للتصدير');
      return;
    }

    const exportData = drivers.map((driver: any) => ({
      'اسم السائق': driver.profile?.full_name || 'غير متوفر',
      'رقم الهاتف': driver.profile?.primary_phone || 'غير متوفر',
      'التقييم': driver.driver_rating || 0,
      'المنطقة': driver.zone?.name_ar || 'غير محدد',
      'نوع المركبة': driver.vehicle_type || 'غير محدد',
      'موديل المركبة': driver.vehicle_model || 'غير محدد',
      'رقم اللوحة': driver.license_plate || 'غير محدد',
      'الرقم القومي': driver.national_id || 'غير محدد',
      'الحالة': driver.is_online ? 'متصل' : 'غير متصل',
      'الطلبات النشطة': new Set(
        driver.active_orders
          ?.filter((ao: any) => ao.master_order && !['Completed', 'Cancelled'].includes(ao.master_order.status))
          .map((ao: any) => ao.master_order.id)
      ).size,
    }));

    exportToCSV(exportData, 'drivers_list');
  };

  const getStatusBadge = (isOnline: boolean, isBusy: boolean) => {
    if (!isOnline) return <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">غير متصل</span>;
    if (isBusy) return <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-emerald-100 text-emerald-800">مشغول</span>;
    return <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">متاح</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-gray-900">إدارة السائقين</h2>
          <button
            onClick={handleCreateClick}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة سائق جديد</span>
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
              placeholder="بحث بالاسم أو الهاتف..."
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
              <option value="Online">متاح</option>
              <option value="Busy">مشغول</option>
              <option value="Offline">غير متصل</option>
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
                  السائق
                </th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                  المنطقة
                </th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                  المركبة
                </th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                  التقييم
                </th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                  الطلبات النشطة
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
                  <tr key={`drivers-skeleton-${index}`} className="animate-pulse">
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
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-16"></div></td>
                    <td className="px-6 py-4"><div className="h-6 bg-gray-200 rounded-full w-20"></div></td>
                    <td className="px-6 py-4"><div className="h-6 bg-gray-200 rounded-full w-20"></div></td>
                    <td className="px-6 py-4"><div className="h-8 bg-gray-200 rounded-2xl w-24 mx-auto"></div></td>
                  </tr>
                ))
              ) : data?.drivers?.length === 0 ? (
                <tr key="drivers-empty">
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    لا يوجد سائقين يطابقون معايير البحث
                  </td>
                </tr>
              ) : (
                data?.drivers?.map((driver, idx) => (
                  <tr key={driver.user_id || `driver-${idx}`} className="hover:bg-gray-50 transition-colors even:bg-gray-100">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center overflow-hidden">
                          {(driver.profile as any)?.avatar_url ? (
                            <img src={(driver.profile as any).avatar_url} alt="" className="h-10 w-10 object-cover" />
                          ) : (
                            <Car className="h-5 w-5 text-indigo-600" />
                          )}
                        </div>
                        <div className="mr-4">
                          <div className="text-sm font-medium text-gray-900">
                            {(driver.profile as any)?.full_name || 'غير معروف'}
                          </div>
                          <div className="text-sm text-gray-500" dir="ltr">{(driver.profile as any)?.primary_phone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        <MapPin className="w-4 h-4 ml-1.5 text-gray-400" />
                        {(driver.zone as any)?.name_ar || 'غير محدد'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>{driver.vehicle_type || 'غير محدد'}</div>
                      <div className="text-xs text-gray-500">{driver.license_plate}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        <Star className="w-4 h-4 ml-1 text-yellow-400 fill-current" />
                        {driver.driver_rating ? Number(driver.driver_rating).toFixed(1) : 'جديد'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {(() => {
                        const activeMasterOrderIds = new Set(
                          (driver.active_orders as any)
                            ?.filter((ao: any) => ao.master_order && !['Completed', 'Cancelled'].includes(ao.master_order.status))
                            .map((ao: any) => ao.master_order.id)
                        );
                        const activeCount = activeMasterOrderIds.size;
                        return (
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "px-2.5 py-0.5 rounded-full text-xs font-bold",
                              activeCount > 0
                                ? "bg-amber-100 text-amber-700"
                                : "bg-gray-100 text-gray-600"
                            )}>
                              {activeCount} طلب
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(driver.is_online, driver.is_busy)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => toggleAccountStatusMutation.mutate({ id: driver.user_id, currentStatus: driver.profile?.status || 'نشط' })}
                          disabled={toggleAccountStatusMutation.isPending}
                          className={cn(
                            "p-2 rounded-md transition-colors inline-flex items-center gap-1",
                            driver.profile?.status === 'نشط' || driver.profile?.status === 'active'
                              ? "text-red-600 hover:text-red-900 bg-red-50" 
                              : "text-green-600 hover:text-green-900 bg-green-50"
                          )}
                          title={driver.profile?.status === 'نشط' || driver.profile?.status === 'active' ? "إيقاف الحساب" : "تفعيل الحساب"}
                        >
                          {driver.profile?.status === 'نشط' || driver.profile?.status === 'active' ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                        </button>
                        <button 
                          onClick={() => toggleStatusMutation.mutate({ id: driver.user_id, currentStatus: driver.is_online })}
                          disabled={toggleStatusMutation.isPending}
                          className={cn(
                            "p-2 rounded-md transition-colors inline-flex items-center gap-1",
                            driver.is_online 
                              ? "text-orange-600 hover:text-orange-900 bg-orange-50" 
                              : "text-blue-600 hover:text-blue-900 bg-blue-50"
                          )}
                          title={driver.is_online ? "إيقاف الدوام (أوفلاين)" : "تسجيل الدوام (أونلاين)"}
                        >
                          {driver.is_online ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                        </button>
                        {driver.is_online && driver.is_busy && (
                          <button
                            onClick={() => toggleBusyMutation.mutate({ id: driver.user_id, isBusy: false })}
                            disabled={toggleBusyMutation.isPending}
                            className="text-green-600 hover:text-green-900 bg-green-50 p-2 rounded-md transition-colors inline-flex items-center gap-1"
                            title="تعيين كمتاح"
                          >
                            <span className="text-xs font-bold">متاح</span>
                          </button>
                        )}
                        <button 
                          onClick={() => handleViewClick(driver)}
                          className="text-blue-600 hover:text-blue-900 bg-blue-50 p-2 rounded-md transition-colors inline-flex items-center gap-1"
                          title="عرض التفاصيل"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleEditClick(driver)}
                          className="text-emerald-600 hover:text-emerald-900 bg-emerald-50 p-2 rounded-md transition-colors inline-flex items-center gap-1"
                        >
                          <Edit className="w-4 h-4" />
                          <span>إدارة</span>
                        </button>
                        <button 
                          onClick={() => handleDeleteClick(driver)}
                          className="text-red-600 hover:text-red-900 bg-red-50 p-2 rounded-md transition-colors inline-flex items-center gap-1"
                          title="حذف السائق"
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
        {data?.count && data.count > pageSize && !searchQuery && (
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
                  عرض <span className="font-medium">{page * pageSize + 1}</span> إلى <span className="font-medium">{Math.min((page + 1) * pageSize, data.count)}</span> من أصل <span className="font-medium">{data.count}</span> سائق
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

      {/* Create Driver Modal */}
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
                <h3 className="text-xl font-bold text-gray-900">إضافة سائق جديد</h3>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">الصورة الشخصية</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">الاسم الكامل</label>
                    <input
                      required
                      type="text"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                      placeholder="أدخل اسم السائق"
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
                    <label className="text-sm font-medium text-gray-700">نوع المركبة</label>
                    <input
                      required
                      type="text"
                      value={formData.vehicle_type}
                      onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                      placeholder="مثال: دراجة نارية، سيارة"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">موديل المركبة</label>
                    <input
                      required
                      type="text"
                      value={formData.vehicle_model}
                      onChange={(e) => setFormData({ ...formData, vehicle_model: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                      placeholder="مثال: تويوتا كورولا 2022"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">رقم اللوحة</label>
                    <input
                      required
                      type="text"
                      value={formData.license_plate}
                      onChange={(e) => setFormData({ ...formData, license_plate: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                      placeholder="أدخل رقم اللوحة"
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
                    <label className="text-sm font-medium text-gray-700">الرقم القومي</label>
                    <input
                      required
                      type="text"
                      value={formData.national_id}
                      onChange={(e) => setFormData({ ...formData, national_id: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                      placeholder="أدخل الرقم القومي"
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

      {/* Edit Driver Modal */}
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
                <h3 className="text-xl font-bold text-gray-900">تعديل بيانات السائق</h3>
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
                    <label className="text-sm font-medium text-gray-700">صورة السائق</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">الاسم الكامل</label>
                    <input
                      required
                      type="text"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                      placeholder="أدخل اسم السائق"
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
                    <label className="text-sm font-medium text-gray-700">نوع المركبة</label>
                    <input
                      required
                      type="text"
                      value={formData.vehicle_type}
                      onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                      placeholder="مثال: دراجة نارية، سيارة"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">موديل المركبة</label>
                    <input
                      required
                      type="text"
                      value={formData.vehicle_model}
                      onChange={(e) => setFormData({ ...formData, vehicle_model: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                      placeholder="مثال: تويوتا كورولا 2022"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">رقم اللوحة</label>
                    <input
                      required
                      type="text"
                      value={formData.license_plate}
                      onChange={(e) => setFormData({ ...formData, license_plate: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                      placeholder="أدخل رقم اللوحة"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">الرقم القومي</label>
                    <input
                      required
                      type="text"
                      value={formData.national_id}
                      onChange={(e) => setFormData({ ...formData, national_id: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                      placeholder="أدخل الرقم القومي"
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

      {/* View Driver Modal */}
      <AnimatePresence>
        {isViewModalOpen && selectedDriver && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-shrink-0">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <User className="w-6 h-6 text-emerald-600" />
                  تفاصيل السائق
                </h3>
                <button
                  onClick={() => setIsViewModalOpen(false)}
                  className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 space-y-6">
                <div className="bg-gray-50 p-4 rounded-xl space-y-4">
                  <h4 className="font-bold text-gray-900 border-b pb-2">البيانات الأساسية</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-gray-500 block">الاسم الكامل</span>
                      <span className="font-medium">{selectedDriver.profile?.full_name}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500 block">رقم الهاتف</span>
                      <span className="font-medium" dir="ltr">{selectedDriver.profile?.primary_phone}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500 block">المنطقة</span>
                      <span className="font-medium">{selectedDriver.zone?.name_ar || 'غير محدد'}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500 block">التقييم</span>
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-400 fill-current" />
                        <span className="font-medium">{selectedDriver.driver_rating ? Number(selectedDriver.driver_rating).toFixed(1) : 'جديد'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-indigo-50 p-4 rounded-xl space-y-4">
                  <h4 className="font-bold text-gray-900 border-b border-indigo-200 pb-2">تفاصيل المركبة والوثائق</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-gray-500 block">نوع المركبة</span>
                      <span className="font-medium">{selectedDriver.vehicle_type || 'غير متوفر'}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500 block">موديل المركبة</span>
                      <span className="font-medium">{selectedDriver.vehicle_model || 'غير متوفر'}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500 block">رقم اللوحة</span>
                      <span className="font-medium">{selectedDriver.license_plate || 'غير متوفر'}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500 block">الرقم القومي</span>
                      <span className="font-medium">{selectedDriver.national_id || 'غير متوفر'}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 p-4 rounded-xl space-y-4">
                  <h4 className="font-bold text-gray-900 border-b border-green-200 pb-2">الحالة الحالية</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-gray-500 block">حالة الاتصال</span>
                      <span className={`font-medium ${selectedDriver.is_online ? 'text-green-600' : 'text-gray-500'}`}>
                        {selectedDriver.is_online ? 'متصل' : 'غير متصل'}
                      </span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500 block">حالة العمل</span>
                      <span className={`font-medium ${selectedDriver.is_busy ? 'text-emerald-600' : 'text-green-600'}`}>
                        {selectedDriver.is_busy ? 'مشغول' : 'متاح'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-gray-100 bg-gray-50 flex-shrink-0">
                <button
                  onClick={() => setIsViewModalOpen(false)}
                  className="w-full bg-gray-200 text-gray-800 py-2 rounded-lg font-bold hover:bg-gray-300 transition-colors"
                >
                  إغلاق
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteDialogOpen && (
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
                <h3 className="text-xl font-bold">تأكيد حذف السائق</h3>
              </div>
              
              <p className="text-gray-600">
                هل أنت متأكد من رغبتك في حذف السائق <span className="font-bold text-gray-900">{driverToDelete?.profile?.full_name}</span>؟
                هذا الإجراء لا يمكن التراجع عنه وسيتم حذف جميع البيانات المرتبطة به.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={confirmDelete}
                  disabled={deleteDriverMutation.isPending}
                  className="flex-1 bg-red-600 text-white py-2 rounded-lg font-bold hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deleteDriverMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'تأكيد الحذف'}
                </button>
                <button
                  onClick={() => setIsDeleteDialogOpen(false)}
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
