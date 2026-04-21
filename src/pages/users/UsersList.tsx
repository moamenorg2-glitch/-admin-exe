import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Search, Filter, Shield, User, Store, Car, Edit, Ban, CheckCircle, Plus, X, Loader2, Download, Eye, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { exportToCSV } from '../../utils/export';
import { userService } from '../../services/userService';
import { uploadService } from '../../services/uploadService';
import { handleGlobalError } from '../../utils/errorHandler';
import { getApiUrl } from '../../utils/apiUtils';

type UserType = 'admin' | 'customer' | 'driver' | 'vendor' | 'All';

const userTypeIcons: Record<string, any> = {
  admin: Shield,
  customer: User,
  driver: Car,
  vendor: Store,
};

const userTypeNames: Record<string, string> = {
  admin: 'مسؤول',
  customer: 'عميل',
  driver: 'سائق',
  vendor: 'تاجر',
};

interface UsersListProps {
  fixedRole?: UserType;
}

export default function UsersList({ fixedRole }: UsersListProps) {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [typeFilter, setTypeFilter] = useState<UserType>(fixedRole || 'customer');
  
  // Update state if prop changes
  useEffect(() => {
    if (fixedRole) {
      setTypeFilter(fixedRole);
    }
  }, [fixedRole]);

  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    primary_phone: '',
    email: '',
    password: '',
    // Customer Details (Address)
    city: '',
    district: '',
    street_name: '',
    building_number: '',
    floor_number: '',
    apartment_number: '',
    landmark: '',
    vendor_address: '',
    tax_registration_number: '',
    avatar_url: '',
  });

  const pageSize = 20;
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, typeFilter, searchQuery],
    queryFn: async () => {
      try {
        return await userService.fetchUsers(page, pageSize, {
          type: typeFilter === 'All' ? undefined : typeFilter,
          search: searchQuery
        });
      } catch (error) {
        handleGlobalError(error, 'Fetch Users');
        throw error;
      }
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: string }) => {
      const newStatus = currentStatus === 'نشط' || currentStatus === 'active' ? 'محظور' : 'نشط';
      await userService.updateUserStatus(id, newStatus);
    },
    onSuccess: () => {
      toast.success('تم تحديث حالة المستخدم بنجاح');
      queryClient.invalidateQueries({ queryKey: ['users'] }).catch(console.error);
    },
    // Removed redundant onError: handleGlobalError is called by mutationCache in main.tsx
  });

  const createCustomerMutation = useMutation({
    mutationFn: async ({ data, file }: { data: typeof formData, file: File | null }) => {
      setIsSubmitting(true);
      try {
        const response = await userService.createUser({
          ...data,
          user_type: typeFilter === 'admin' ? 'admin' : 'customer'
        });
        
        if (file && response.user_id) {
          try {
            const uploadData = await uploadService.uploadFile(
              file, 
              'profiles', 
              `${response.user_id}/${Date.now()}_${file.name}`
            );
            await userService.updateProfile(response.user_id, { avatar_url: uploadData.publicUrl });
          } catch (error) {
            console.error('Failed to upload avatar:', error);
            toast.error('تم إضافة المستخدم ولكن فشل رفع الصورة');
          }
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    onSuccess: () => {
      toast.success(typeFilter === 'admin' ? 'تم إضافة المسؤول بنجاح مع صلاحيات كاملة' : 'تم إضافة العميل بنجاح');
      setIsCreateModalOpen(false);
      setFormData({
        full_name: '',
        primary_phone: '',
        email: '',
        password: '',
        city: '',
        district: '',
        street_name: '',
        building_number: '',
        floor_number: '',
        apartment_number: '',
        landmark: '',
        vendor_address: '',
        tax_registration_number: '',
        avatar_url: ''
      });
      setSelectedFile(null);
      queryClient.invalidateQueries({ queryKey: ['users'] }).catch(console.error);
    },
    // Removed redundant onError: handleGlobalError is called by mutationCache in main.tsx
  });

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    createCustomerMutation.mutate({ data: formData, file: selectedFile });
  };

  const updateUserMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      setIsSubmitting(true);
      try {
        let avatarUrl = data.avatar_url;
        if (selectedFile) {
          const uploadData = await uploadService.uploadFile(
            selectedFile, 
            'profiles', 
            `${selectedUser.user_id}/${Date.now()}_${selectedFile.name}`
          );
          avatarUrl = uploadData.publicUrl;
        }

        await userService.updateUser(selectedUser.user_id, {
          ...data,
          avatar_url: avatarUrl,
          user_type: selectedUser.user_type
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    onSuccess: () => {
      toast.success('تم تحديث بيانات المستخدم بنجاح');
      setIsEditModalOpen(false);
      setSelectedUser(null);
      setSelectedFile(null);
      queryClient.invalidateQueries({ queryKey: ['users'] }).catch(console.error);
    },
    // Removed redundant onError: handleGlobalError is called by mutationCache in main.tsx
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await userService.deleteUser(userId);
    },
    onSuccess: () => {
      toast.success('تم حذف المستخدم بنجاح');
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['users'] }).catch(console.error);
    },
    // Removed redundant onError: handleGlobalError is called by mutationCache in main.tsx
  });

  const handleEditClick = (user: any) => {
    setSelectedUser(user);
    const details = Array.isArray(user.customer_details) ? user.customer_details[0] : user.customer_details;
    const vendorDetails = Array.isArray(user.vendor_details) ? user.vendor_details[0] : user.vendor_details;
    setFormData({
      full_name: user.full_name,
      primary_phone: user.primary_phone,
      email: user.email || '',
      password: '',
      city: details?.city || '',
      district: details?.district || '',
      street_name: details?.street_name || '',
      building_number: details?.building_number || '',
      floor_number: details?.floor_number || '',
      apartment_number: details?.apartment_number || '',
      landmark: details?.landmark || '',
      vendor_address: vendorDetails?.landmark || '',
      tax_registration_number: vendorDetails?.tax_registration_number || '',
      avatar_url: user.avatar_url || ''
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateUserMutation.mutate(formData);
  };

  const getPageTitle = () => {
    switch (typeFilter) {
      case 'customer': return 'إدارة العملاء';
      case 'driver': return 'إدارة السائقين';
      case 'vendor': return 'إدارة التجار';
      case 'admin': return 'إدارة المسؤولين';
      default: return 'إدارة المستخدمين';
    }
  };

  const handleAddUserClick = () => {
    setFormData({
      full_name: '',
      primary_phone: '',
      email: '',
      password: '',
      city: '',
      district: '',
      street_name: '',
      building_number: '',
      floor_number: '',
      apartment_number: '',
      landmark: '',
      vendor_address: '',
      tax_registration_number: '',
      avatar_url: ''
    });
    setIsCreateModalOpen(true);
  };

  const handleExport = () => {
    const users = data?.users;
    if (!users || users.length === 0) {
      toast.error('لا توجد بيانات للتصدير');
      return;
    }

    const exportData = users.map(user => ({
      'الاسم': user.full_name,
      'رقم الهاتف': user.primary_phone,
      'البريد الإلكتروني': user.email || 'غير متوفر',
      'نوع المستخدم': userTypeNames[user.user_type] || user.user_type,
      'الحالة': user.status === 'active' ? 'نشط' : user.status === 'blocked' ? 'محظور' : 'قيد الانتظار',
      'تاريخ التسجيل': format(new Date(user.created_at), 'yyyy/MM/dd', { locale: ar }),
    }));

    exportToCSV(exportData, 'users_list');
  };
  
  const handleViewClick = (user: any) => {
    setSelectedUser(user);
    setIsViewModalOpen(true);
  };

  const handleDeleteClick = (user: any) => {
    setUserToDelete(user);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (userToDelete) {
      deleteUserMutation.mutate(userToDelete.user_id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-gray-900">{getPageTitle()}</h2>
          {(typeFilter === 'customer' || typeFilter === 'driver' || typeFilter === 'vendor' || typeFilter === 'admin' || typeFilter === 'All') && (
            <button
              onClick={() => {
                if (typeFilter === 'customer' || typeFilter === 'admin' || typeFilter === 'All') handleAddUserClick();
                else if (typeFilter === 'driver') navigate('/drivers');
                else if (typeFilter === 'vendor') navigate('/vendors');
              }}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>
                {(typeFilter === 'customer' || typeFilter === 'All') ? 'إضافة عميل جديد' : 
                 typeFilter === 'admin' ? 'إضافة مسؤول جديد' :
                 typeFilter === 'driver' ? 'إضافة سائق جديد' : 
                 'إضافة متجر جديد'}
              </span>
            </button>
          )}
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

          {!fixedRole && (
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <Filter className="h-4 w-4 text-gray-400" />
              </div>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as UserType)}
                className="block w-full sm:w-48 pr-10 border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm border py-2 pl-3"
              >
                <option value="customer">العملاء فقط</option>
                <option value="All">جميع المستخدمين</option>
                <option value="admin">المسؤولين</option>
                <option value="driver">السائقين</option>
                <option value="vendor">التجار</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white shadow-sm overflow-hidden sm:rounded-2xl border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-50/50 border-b border-gray-100">
              <tr>
                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                  المستخدم
                </th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                  النوع
                </th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                  تاريخ التسجيل
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
                  <tr key={`users-skeleton-${index}`} className="animate-pulse">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                        <div>
                          <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
                          <div className="h-3 bg-gray-200 rounded w-24"></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4"><div className="h-6 bg-gray-200 rounded-full w-20"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                    <td className="px-6 py-4"><div className="h-6 bg-gray-200 rounded-full w-16"></div></td>
                    <td className="px-6 py-4"><div className="h-8 bg-gray-200 rounded-2xl w-24 mx-auto"></div></td>
                  </tr>
                ))
              ) : data?.users?.length === 0 ? (
                <tr key="users-empty">
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    لا يوجد مستخدمين يطابقون معايير البحث
                  </td>
                </tr>
              ) : (
                data?.users?.map((user, idx) => {
                  const Icon = userTypeIcons[user.user_type] || User;
                  return (
                    <tr key={user.user_id || `user-${idx}`} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden">
                            {user.avatar_url ? (
                              <img src={user.avatar_url} alt="" className="h-10 w-10 object-cover" />
                            ) : (
                              <Icon className="h-5 w-5 text-gray-400" />
                            )}
                          </div>
                          <div className="mr-4">
                            <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
                            <div className="flex items-center gap-2">
                              <div className="text-sm text-gray-500" dir="ltr">{user.primary_phone}</div>
                              {user.user_type === 'driver' && (() => {
                                const activeMasterOrderIds = new Set(
                                  (user as any).driver_details?.[0]?.active_orders
                                    ?.filter((ao: any) => ao.sub_order && !['Delivered', 'Cancelled'].includes(ao.sub_order.sub_status))
                                    .map((ao: any) => ao.sub_order.master_order_id)
                                );
                                const activeCount = activeMasterOrderIds.size;
                                return (
                                  <span className={cn(
                                    "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                                    activeCount > 0
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-gray-100 text-gray-600"
                                  )}>
                                    {activeCount} طلب نشط
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-900">
                          <Icon className="w-4 h-4 ml-1.5 text-gray-400" />
                          {userTypeNames[user.user_type] || user.user_type}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(user.created_at), 'PP', { locale: ar })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={cn(
                          "px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full",
                          user.status === 'نشط' || user.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        )}>
                          {user.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => toggleStatusMutation.mutate({ id: user.user_id, currentStatus: user.status })}
                            disabled={toggleStatusMutation.isPending}
                            className={cn(
                              "p-2 rounded-md transition-colors inline-flex items-center gap-1",
                              user.status === 'نشط' || user.status === 'active'
                                ? "text-red-600 hover:text-red-900 bg-red-50" 
                                : "text-green-600 hover:text-green-900 bg-green-50"
                            )}
                            title={user.status === 'نشط' || user.status === 'active' ? "حظر" : "تفعيل"}
                          >
                            {user.status === 'نشط' || user.status === 'active' ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                          </button>
                          <button 
                            onClick={() => handleViewClick(user)}
                            className="text-blue-600 hover:text-blue-900 bg-blue-50 p-2 rounded-md transition-colors inline-flex items-center gap-1"
                          >
                            <Eye className="w-4 h-4" />
                            <span>عرض</span>
                          </button>
                          <button 
                            onClick={() => handleEditClick(user)}
                            className="text-emerald-600 hover:text-emerald-900 bg-emerald-50 p-2 rounded-md transition-colors inline-flex items-center gap-1"
                          >
                            <Edit className="w-4 h-4" />
                            <span>تعديل</span>
                          </button>
                          <button 
                            onClick={() => handleDeleteClick(user)}
                            className="text-red-600 hover:text-red-900 bg-red-50 p-2 rounded-md transition-colors inline-flex items-center gap-1"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>حذف</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
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
                  عرض <span className="font-medium">{page * pageSize + 1}</span> إلى <span className="font-medium">{Math.min((page + 1) * pageSize, data.count)}</span> من أصل <span className="font-medium">{data.count}</span> مستخدم
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

      {/* Create Customer Modal */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-shrink-0">
                <h3 className="text-xl font-bold text-gray-900">
                  {typeFilter === 'admin' ? 'إضافة مسؤول جديد' : 'إضافة عميل جديد'}
                </h3>
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
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">الاسم الكامل</label>
                  <input
                    required
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    placeholder="أدخل اسم العميل"
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

                {typeFilter === 'customer' && (
                  <div className="space-y-4 pt-4 border-t border-gray-100">
                    <h4 className="font-bold text-gray-900">تفاصيل العنوان</h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">المدينة</label>
                        <input
                          type="text"
                          value={formData.city}
                          onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                          placeholder="القاهرة"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">الحي / المنطقة</label>
                        <input
                          type="text"
                          value={formData.district}
                          onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                          placeholder="المعادي"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-700">اسم الشارع</label>
                      <input
                        type="text"
                        value={formData.street_name}
                        onChange={(e) => setFormData({ ...formData, street_name: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                        placeholder="شارع 9"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">رقم المبنى</label>
                        <input
                          type="text"
                          value={formData.building_number}
                          onChange={(e) => setFormData({ ...formData, building_number: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                          placeholder="12"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">الطابق</label>
                        <input
                          type="text"
                          value={formData.floor_number}
                          onChange={(e) => setFormData({ ...formData, floor_number: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                          placeholder="3"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">رقم الشقة</label>
                        <input
                          type="text"
                          value={formData.apartment_number}
                          onChange={(e) => setFormData({ ...formData, apartment_number: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                          placeholder="301"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-700">علامة مميزة</label>
                      <input
                        type="text"
                        value={formData.landmark}
                        onChange={(e) => setFormData({ ...formData, landmark: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                        placeholder="بجوار صيدلية..."
                      />
                    </div>
                  </div>
                )}

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

      {/* Edit User Modal */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-shrink-0">
                <h3 className="text-xl font-bold text-gray-900">تعديل بيانات المستخدم</h3>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">الاسم الكامل</label>
                  <input
                    required
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    placeholder="أدخل الاسم"
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

                {selectedUser?.user_type === 'customer' && (
                  <div className="space-y-4 pt-4 border-t border-gray-100">
                    <h4 className="font-bold text-gray-900">تفاصيل العنوان</h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">المدينة</label>
                        <input
                          type="text"
                          value={formData.city}
                          onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                          placeholder="القاهرة"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">الحي / المنطقة</label>
                        <input
                          type="text"
                          value={formData.district}
                          onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                          placeholder="المعادي"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-700">اسم الشارع</label>
                      <input
                        type="text"
                        value={formData.street_name}
                        onChange={(e) => setFormData({ ...formData, street_name: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                        placeholder="شارع 9"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">رقم المبنى</label>
                        <input
                          type="text"
                          value={formData.building_number}
                          onChange={(e) => setFormData({ ...formData, building_number: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                          placeholder="12"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">الطابق</label>
                        <input
                          type="text"
                          value={formData.floor_number}
                          onChange={(e) => setFormData({ ...formData, floor_number: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                          placeholder="3"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">رقم الشقة</label>
                        <input
                          type="text"
                          value={formData.apartment_number}
                          onChange={(e) => setFormData({ ...formData, apartment_number: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                          placeholder="301"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-700">علامة مميزة</label>
                      <input
                        type="text"
                        value={formData.landmark}
                        onChange={(e) => setFormData({ ...formData, landmark: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                        placeholder="بجوار صيدلية..."
                      />
                    </div>
                  </div>
                )}

                {selectedUser?.user_type === 'vendor' && (
                  <div className="space-y-4 pt-4 border-t border-gray-100">
                    <h4 className="font-bold text-gray-900">بيانات المتجر</h4>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-700">العنوان بالتفصيل</label>
                      <input
                        type="text"
                        value={formData.vendor_address}
                        onChange={(e) => setFormData({ ...formData, vendor_address: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                        placeholder="أدخل عنوان المتجر"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-700">الرقم الضريبي</label>
                      <input
                        type="text"
                        value={formData.tax_registration_number}
                        onChange={(e) => setFormData({ ...formData, tax_registration_number: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                        placeholder="أدخل الرقم الضريبي"
                      />
                    </div>
                  </div>
                )}

                <div className="pt-4 flex gap-3">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-emerald-600 text-white py-2 rounded-lg font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'حفظ التغييرات'}
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

      {/* View User Modal */}
      <AnimatePresence>
        {isViewModalOpen && selectedUser && (
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
                  تفاصيل المستخدم
                </h3>
                <button
                  onClick={() => setIsViewModalOpen(false)}
                  className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 space-y-6">
                {/* Basic Info */}
                <div className="bg-gray-50 p-4 rounded-xl space-y-4">
                  <h4 className="font-bold text-gray-900 border-b pb-2">البيانات الأساسية</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-gray-500 block">الاسم الكامل</span>
                      <span className="font-medium">{selectedUser.full_name}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500 block">رقم الهاتف</span>
                      <span className="font-medium" dir="ltr">{selectedUser.primary_phone}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500 block">البريد الإلكتروني</span>
                      <span className="font-medium">{selectedUser.email || 'غير متوفر'}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500 block">نوع المستخدم</span>
                      <span className="font-medium">{userTypeNames[selectedUser.user_type] || selectedUser.user_type}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500 block">الحالة</span>
                      <span className={`font-medium ${selectedUser.status === 'active' || selectedUser.status === 'نشط' ? 'text-green-600' : 'text-red-600'}`}>
                        {selectedUser.status === 'active' || selectedUser.status === 'نشط' ? 'نشط' : 'محظور'}
                      </span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500 block">تاريخ التسجيل</span>
                      <span className="font-medium">{format(new Date(selectedUser.created_at), 'PPP', { locale: ar })}</span>
                    </div>
                  </div>
                </div>

                {/* Customer Details */}
                {selectedUser.user_type === 'customer' && selectedUser.customer_details && selectedUser.customer_details.length > 0 && (
                  <div className="bg-blue-50 p-4 rounded-xl space-y-4">
                    <h4 className="font-bold text-gray-900 border-b pb-2">تفاصيل العميل (العنوان)</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <span className="text-sm text-gray-500 block">المدينة</span>
                        <span className="font-medium">{selectedUser.customer_details[0].city || 'غير متوفر'}</span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500 block">الحي / المنطقة</span>
                        <span className="font-medium">{selectedUser.customer_details[0].district || 'غير متوفر'}</span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500 block">اسم الشارع</span>
                        <span className="font-medium">{selectedUser.customer_details[0].street_name || 'غير متوفر'}</span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500 block">رقم المبنى</span>
                        <span className="font-medium">{selectedUser.customer_details[0].building_number || 'غير متوفر'}</span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500 block">الطابق</span>
                        <span className="font-medium">{selectedUser.customer_details[0].floor_number || 'غير متوفر'}</span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500 block">رقم الشقة</span>
                        <span className="font-medium">{selectedUser.customer_details[0].apartment_number || 'غير متوفر'}</span>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-sm text-gray-500 block">علامة مميزة</span>
                        <span className="font-medium">{selectedUser.customer_details[0].landmark || 'غير متوفر'}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Vendor Details */}
                {selectedUser.user_type === 'vendor' && selectedUser.vendor_details && selectedUser.vendor_details.length > 0 && (
                  <div className="bg-emerald-50 p-4 rounded-xl space-y-4">
                    <h4 className="font-bold text-gray-900 border-b border-emerald-200 pb-2">تفاصيل التاجر</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <span className="text-sm text-gray-500 block">اسم المتجر</span>
                        <span className="font-medium">{selectedUser.vendor_details[0].brand_name || 'غير متوفر'}</span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500 block">نسبة العمولة</span>
                        <span className="font-medium">{selectedUser.vendor_details[0].commission_rate}%</span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500 block">الحد الأدنى للطلب</span>
                        <span className="font-medium">{selectedUser.vendor_details[0].min_order_value} ج.م</span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500 block">متوسط وقت التحضير</span>
                        <span className="font-medium">{selectedUser.vendor_details[0].preparation_time_avg} دقيقة</span>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-sm text-gray-500 block">العنوان</span>
                        <span className="font-medium">{selectedUser.vendor_details[0].landmark || 'غير متوفر'}</span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500 block">الرقم الضريبي</span>
                        <span className="font-medium">{selectedUser.vendor_details[0].tax_registration_number || 'غير متوفر'}</span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500 block">حالة المتجر</span>
                        <span className={`font-medium ${selectedUser.vendor_details[0].is_open ? 'text-green-600' : 'text-red-600'}`}>
                          {selectedUser.vendor_details[0].is_open ? 'مفتوح' : 'مغلق'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Driver Details */}
                {selectedUser.user_type === 'driver' && selectedUser.driver_details && selectedUser.driver_details.length > 0 && (
                  <div className="bg-green-50 p-4 rounded-xl space-y-4">
                    <h4 className="font-bold text-gray-900 border-b border-green-200 pb-2">تفاصيل السائق</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <span className="text-sm text-gray-500 block">نوع المركبة</span>
                        <span className="font-medium">{selectedUser.driver_details[0].vehicle_type || 'غير متوفر'}</span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500 block">موديل المركبة</span>
                        <span className="font-medium">{selectedUser.driver_details[0].vehicle_model || 'غير متوفر'}</span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500 block">رقم اللوحة</span>
                        <span className="font-medium">{selectedUser.driver_details[0].license_plate || 'غير متوفر'}</span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500 block">الرقم القومي</span>
                        <span className="font-medium">{selectedUser.driver_details[0].national_id || 'غير متوفر'}</span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500 block">حالة الاتصال</span>
                        <span className={`font-medium ${selectedUser.driver_details[0].is_online ? 'text-green-600' : 'text-gray-500'}`}>
                          {selectedUser.driver_details[0].is_online ? 'متصل' : 'غير متصل'}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500 block">حالة العمل</span>
                        <span className={`font-medium ${selectedUser.driver_details[0].is_busy ? 'text-emerald-600' : 'text-green-600'}`}>
                          {selectedUser.driver_details[0].is_busy ? 'مشغول' : 'متاح'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
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
                <h3 className="text-xl font-bold">تأكيد الحذف</h3>
              </div>
              
              <p className="text-gray-600">
                هل أنت متأكد من رغبتك في حذف المستخدم <span className="font-bold text-gray-900">{userToDelete?.full_name}</span>؟
                هذا الإجراء لا يمكن التراجع عنه وسيتم حذف جميع البيانات المرتبطة به.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={confirmDelete}
                  disabled={deleteUserMutation.isPending}
                  className="flex-1 bg-red-600 text-white py-2 rounded-lg font-bold hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deleteUserMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'تأكيد الحذف'}
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
