import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Search, Plus, Key, X, Edit, Trash2, UserCog } from 'lucide-react';
import toast from 'react-hot-toast';
import { navigation } from '../../constants';
import { cn } from '../../lib/utils';
import { handleGlobalError } from '../../utils/errorHandler';
import UserPermissionsModal from '../../components/permissions/UserPermissionsModal';

interface Permission {
  id: string;
  name: string;
  name_ar: string;
  description: string | null;
  module: string;
  manager_id?: string | null;
}

export default function PermissionsList() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPermission, setEditingPermission] = useState<Permission | null>(null);
  const [formData, setFormData] = useState({
    module: '',
    manager_id: '',
    is_super_admin: false
  });
  const [permissionToDelete, setPermissionToDelete] = useState<string | null>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['permissions', searchQuery],
    queryFn: async () => {
      try {
        let query = supabase
          .from('permissions')
          .select('*')
          .order('module', { ascending: true });

        if (searchQuery) {
          query = query.or(`name.ilike.%${searchQuery}%,name_ar.ilike.%${searchQuery}%`);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data as Permission[];
      } catch (error) {
        handleGlobalError(error, 'PermissionsList.fetchPermissions');
        throw error;
      }
    },
  });

  const { data: managers } = useQuery({
    queryKey: ['managers'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .eq('user_type', 'admin');
        if (error) throw error;
        return data;
      } catch (error) {
        handleGlobalError(error, 'PermissionsList.fetchManagers');
        throw error;
      }
    },
  });

  const createMutation = useMutation({
    mutationFn: async (newPermission: any) => {
      const { data, error } = await supabase
        .from('permissions')
        .insert([newPermission])
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions'] }).catch((err) => handleGlobalError(err, 'PermissionsList.invalidatePermissions'));
      toast.success('تم إضافة الصلاحية بنجاح');
      closeModal();
    },
    onError: (error: any) => {
      handleGlobalError(error, 'PermissionsList.createPermission');
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { data, error } = await supabase
        .from('permissions')
        .update(updates)
        .eq('id', id)
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions'] }).catch((err) => handleGlobalError(err, 'PermissionsList.invalidatePermissions'));
      toast.success('تم تحديث الصلاحية بنجاح');
      closeModal();
    },
    onError: (error: any) => {
      handleGlobalError(error, 'PermissionsList.updatePermission');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('permissions')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions'] }).catch((err) => handleGlobalError(err, 'PermissionsList.invalidatePermissions'));
      toast.success('تم حذف الصلاحية بنجاح');
      setPermissionToDelete(null);
    },
    onError: (error: any) => {
      handleGlobalError(error, 'PermissionsList.deletePermission');
    }
  });

  const openModal = (permission: Permission | null = null) => {
    if (permission) {
      setEditingPermission(permission);
      setFormData({
        module: permission.module,
        manager_id: permission.manager_id || '',
        is_super_admin: permission.module === 'all_access'
      });
    } else {
      setEditingPermission(null);
      setFormData({
        module: '',
        manager_id: '',
        is_super_admin: true // Default to Super Admin during development
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingPermission(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isSuper = formData.is_super_admin;
    const dataToSubmit = {
      manager_id: formData.manager_id,
      module: isSuper ? 'all_access' : formData.module,
      name: isSuper ? 'super_admin' : formData.module.toLowerCase().replace(/\s+/g, '_'),
      name_ar: isSuper ? 'سوبر أدمن' : formData.module,
      description: isSuper ? 'صلاحية الوصول الكامل لكافة قوائم النظام' : `صلاحية الوصول إلى وحدة ${formData.module}`
    };
    if (editingPermission) {
      updateMutation.mutate({ id: editingPermission.id, ...dataToSubmit });
    } else {
      createMutation.mutate(dataToSubmit);
    }
  };

  const handleDelete = (id: string) => {
    setPermissionToDelete(id);
  };

  return (
    <div className="space-y-8 pb-12" dir="rtl">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-emerald-100 rounded-2xl shadow-sm">
            <Key className="w-7 h-7 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">إدارة الصلاحيات</h2>
            <p className="mt-1 text-gray-500 font-medium">إدارة وتخصيص صلاحيات الوصول لمستخدمي النظام.</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
          <div className="relative group flex-1 sm:w-72">
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
            </div>
            <input
              type="text"
              placeholder="بحث باسم الصلاحية..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pr-12 pl-4 py-3 bg-white border border-gray-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium transition-all"
            />
          </div>

          <button 
            onClick={() => setIsUserModalOpen(true)}
            className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-sm font-bold rounded-2xl shadow-sm text-emerald-700 bg-emerald-100 hover:bg-emerald-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <UserCog className="w-5 h-5 ml-2" />
            تعيين صلاحيات لمستخدم
          </button>

          <button 
            onClick={() => openModal()}
            className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-sm font-bold rounded-2xl shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-5 h-5 ml-2" />
            إضافة صلاحية
          </button>
        </div>
      </div>

      <div className="bg-white shadow-sm overflow-hidden sm:rounded-3xl border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th scope="col" className="px-8 py-5 text-right text-xs font-bold text-gray-500 uppercase tracking-widest">
                  الصلاحية
                </th>
                <th scope="col" className="px-8 py-5 text-right text-xs font-bold text-gray-500 uppercase tracking-widest">
                  الاسم التقني
                </th>
                <th scope="col" className="px-8 py-5 text-right text-xs font-bold text-gray-500 uppercase tracking-widest">
                  الوحدة (Module)
                </th>
                <th scope="col" className="px-8 py-5 text-right text-xs font-bold text-gray-500 uppercase tracking-widest">
                  المدير (Manager)
                </th>
                <th scope="col" className="px-8 py-5 text-right text-xs font-bold text-gray-500 uppercase tracking-widest">
                  الوصف
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
              ) : data?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-12 text-center text-gray-500 font-medium">
                    لا توجد صلاحيات مضافة حالياً
                  </td>
                </tr>
              ) : (
                data?.map((permission) => (
                  <tr key={permission.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-8 py-5 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="p-2.5 bg-emerald-50 rounded-xl mr-1 group-hover:scale-110 transition-transform">
                          <Key className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div className="mr-3">
                          <span className="text-sm font-bold text-gray-900">{permission.name_ar}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <span className="text-xs font-mono font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100">
                        {permission.name}
                      </span>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <span className={cn(
                        "inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold border",
                        permission.module === 'all_access' 
                          ? "bg-purple-100 text-purple-700 border-purple-200" 
                          : "bg-gray-100 text-gray-700 border-gray-200"
                      )}>
                        {permission.module === 'all_access' ? 'سوبر أدمن' : permission.module}
                      </span>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <div className="text-sm font-bold text-gray-600">
                        {managers?.find(m => m.user_id === permission.manager_id)?.full_name || '-'}
                      </div>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <div className="text-sm text-gray-500 max-w-xs truncate font-medium">
                        {permission.description || '-'}
                      </div>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-3">
                        <button 
                          onClick={() => openModal(permission)}
                          className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl text-xs font-bold transition-all border border-emerald-100"
                        >
                          <Edit className="w-4 h-4" />
                          <span>تعديل</span>
                        </button>
                        <button 
                          onClick={() => handleDelete(permission.id)}
                          className="p-2.5 text-red-600 hover:bg-red-50 rounded-xl transition-all border border-red-100"
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
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-[#111827B3]  transition-opacity" onClick={closeModal}></div>
          <div className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg flex flex-col overflow-hidden border border-gray-100">
            <div className="px-8 pt-8 pb-6 flex-shrink-0 border-b border-gray-50">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-100 rounded-2xl">
                    <Key className="w-6 h-6 text-emerald-600" />
                  </div>
                  <h3 className="text-2xl font-black text-gray-900">
                    {editingPermission ? 'تعديل صلاحية' : 'إضافة صلاحية جديدة'}
                  </h3>
                </div>
                <button 
                  onClick={closeModal} 
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="p-5 bg-emerald-50 rounded-[2rem] border border-emerald-100 flex items-center gap-4 group cursor-pointer hover:bg-emerald-50 transition-all">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    id="is_super_admin"
                    className="w-6 h-6 text-emerald-600 border-gray-300 rounded-lg focus:ring-emerald-500 transition-all cursor-pointer"
                    checked={formData.is_super_admin}
                    onChange={(e) => setFormData({ ...formData, is_super_admin: e.target.checked })}
                  />
                </div>
                <label htmlFor="is_super_admin" className="text-base font-black text-emerald-900 cursor-pointer select-none">
                  صلاحية سوبر أدمن (الوصول الكامل)
                </label>
              </div>

              {!formData.is_super_admin && (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 mr-1">الوحدة (Module)</label>
                  <select
                    required
                    className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-bold appearance-none transition-all"
                    value={formData.module || ''}
                    onChange={(e) => setFormData({ ...formData, module: e.target.value })}
                  >
                    <option value="">اختر وحدة</option>
                    {navigation.map((item) => (
                      <option key={item.name} value={item.name}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 mr-1">المدير (Manager)</label>
                <select
                  className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-bold appearance-none transition-all"
                  value={formData.manager_id || ''}
                  onChange={(e) => setFormData({ ...formData, manager_id: e.target.value })}
                >
                  <option value="">اختر مديراً</option>
                  {managers?.map((manager: any) => (
                    <option key={manager.user_id} value={manager.user_id}>
                      {manager.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col sm:flex-row-reverse gap-3 pt-4">
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 inline-flex justify-center items-center px-8 py-4 bg-emerald-600 text-white text-base font-black rounded-2xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all disabled:opacity-50 transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  {editingPermission ? 'تحديث الصلاحية' : 'إضافة الصلاحية'}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 inline-flex justify-center items-center px-8 py-4 bg-white border border-gray-200 text-base font-bold text-gray-700 rounded-2xl hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {permissionToDelete && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-[#111827B3] " onClick={() => setPermissionToDelete(null)}></div>
          <div className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden border border-gray-100 text-right p-8">
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6">
                <Trash2 className="w-10 h-10 text-red-600" />
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-2">تأكيد الحذف</h3>
              <p className="text-gray-500 font-medium mb-8">
                هل أنت متأكد من حذف هذه الصلاحية؟ لا يمكن التراجع عن هذا الإجراء.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => deleteMutation.mutate(permissionToDelete)}
                disabled={deleteMutation.isPending}
                className="w-full py-4 bg-red-600 text-white rounded-2xl text-base font-black hover:bg-red-700 transition-all shadow-lg shadow-red-100 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'جاري الحذف...' : 'تأكيد الحذف'}
              </button>
              <button 
                onClick={() => setPermissionToDelete(null)}
                disabled={deleteMutation.isPending}
                className="w-full py-4 bg-white border border-gray-200 text-gray-700 rounded-2xl text-base font-bold hover:bg-gray-50 transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Permissions Modal */}
      {isUserModalOpen && (
        <UserPermissionsModal onClose={() => setIsUserModalOpen(false)} />
      )}
    </div>
  );
}
