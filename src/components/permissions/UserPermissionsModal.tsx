import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { X, Shield, Search, User, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '../../lib/utils';

interface UserPermissionsModalProps {
  onClose: () => void;
}

export default function UserPermissionsModal({ onClose }: UserPermissionsModalProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  // Search admins/support users
  const { data: users, isLoading: isSearching } = useQuery({
    queryKey: ['admin-users-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 3) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, primary_phone, user_type, avatar_url')
        .in('user_type', ['admin'])
        .or(`full_name.ilike.%${searchQuery}%,primary_phone.ilike.%${searchQuery}%`)
        .limit(5);
      
      if (error) throw error;
      return data;
    },
    enabled: searchQuery.length >= 3,
  });

  // Fetch all available permissions
  const { data: permissions } = useQuery({
    queryKey: ['available-permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('permissions')
        .select('*')
        .order('module');
      if (error) throw error;
      return data;
    }
  });

  // Fetch user's current permissions when a user is selected
  const { isLoading: isLoadingUserPerms } = useQuery({
    queryKey: ['user-permissions', selectedUser?.user_id],
    queryFn: async () => {
      if (!selectedUser) return [];
      const { data, error } = await (supabase as any)
        .from('user_permissions')
        .select('permission_id')
        .eq('user_id', selectedUser.user_id);
      
      if (error) throw error;
      
      const permIds = data.map(p => p.permission_id);
      setSelectedPermissions(permIds);
      return permIds;
    },
    enabled: !!selectedUser,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUser) throw new Error('يجب اختيار مستخدم');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('غير مصرح لك بالقيام بهذه العملية');

      // 1. Delete existing permissions for this user
      const { error: deleteError } = await (supabase as any)
        .from('user_permissions')
        .delete()
        .eq('user_id', selectedUser.user_id);

      if (deleteError) throw deleteError;

      // 2. Insert new permissions
      if (selectedPermissions.length > 0) {
        const newPerms = selectedPermissions.map(permId => ({
          user_id: selectedUser.user_id,
          permission_id: permId,
          granted_by: user.id
        }));

        const { error: insertError } = await (supabase as any)
          .from('user_permissions')
          .insert(newPerms);

        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      toast.success('تم تحديث صلاحيات المستخدم بنجاح');
      queryClient.invalidateQueries({ queryKey: ['user-permissions'] }).catch(console.error);
      onClose();
    },
    onError: (error: any) => {
      console.error('Error updating permissions:', error);
      toast.error(error.message || 'حدث خطأ أثناء تحديث الصلاحيات');
    }
  });

  const togglePermission = (permId: string) => {
    setSelectedPermissions(prev => 
      prev.includes(permId) 
        ? prev.filter(id => id !== permId)
        : [...prev, permId]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#000000B3] " dir="rtl">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-xl">
              <Shield className="w-5 h-5 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">تعيين صلاحيات مستخدم</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* User Selection */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">المستخدم (مدير) *</label>
            {!selectedUser ? (
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث بالاسم أو رقم الهاتف (3 أحرف على الأقل)..."
                  className="block w-full pr-10 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
                
                {/* Search Results */}
                {searchQuery.length >= 3 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                    {isSearching ? (
                      <div className="p-4 text-center text-sm text-gray-500">جاري البحث...</div>
                    ) : users && users.length > 0 ? (
                      <ul className="divide-y divide-gray-100">
                        {users.map((user) => (
                          <li 
                            key={user.user_id}
                            onClick={() => setSelectedUser(user)}
                            className="p-3 hover:bg-gray-50 cursor-pointer flex items-center gap-3 transition-colors"
                          >
                            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden border border-gray-200">
                              {user.avatar_url ? (
                                <img src={user.avatar_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <User className="w-4 h-4 text-gray-500" />
                              )}
                            </div>
                            <div>
                              <div className="text-sm font-bold text-gray-900">{user.full_name}</div>
                              <div className="text-xs text-gray-500">{user.primary_phone} - {user.user_type === 'admin' ? 'مدير' : user.user_type}</div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="p-4 text-center text-sm text-gray-500">لا توجد نتائج</div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center overflow-hidden border border-emerald-200">
                    {selectedUser.avatar_url ? (
                      <img src={selectedUser.avatar_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <User className="w-5 h-5 text-emerald-600" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-900">{selectedUser.full_name}</div>
                    <div className="text-xs text-gray-500">{selectedUser.primary_phone} - {selectedUser.user_type === 'admin' ? 'مدير' : selectedUser.user_type}</div>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setSelectedUser(null);
                    setSearchQuery('');
                    setSelectedPermissions([]);
                  }}
                  className="text-sm text-red-600 hover:text-red-700 font-medium"
                >
                  تغيير
                </button>
              </div>
            )}
          </div>

          {/* Permissions List */}
          {selectedUser && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-3">الصلاحيات المتاحة</label>
              {isLoadingUserPerms ? (
                <div className="text-center py-8 text-gray-500">جاري تحميل الصلاحيات...</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {permissions?.map((perm) => {
                    const isSelected = selectedPermissions.includes(perm.id);
                    return (
                      <div 
                        key={perm.id}
                        onClick={() => togglePermission(perm.id)}
                        className={cn(
                          "flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all",
                          isSelected 
                            ? "border-emerald-500 bg-emerald-50" 
                            : "border-gray-100 bg-white hover:border-emerald-200"
                        )}
                      >
                        <div className={cn(
                          "w-5 h-5 rounded flex items-center justify-center mt-0.5 flex-shrink-0 transition-colors",
                          isSelected ? "bg-emerald-500 text-white" : "border-2 border-gray-300"
                        )}>
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </div>
                        <div>
                          <div className={cn(
                            "text-sm font-bold",
                            isSelected ? "text-emerald-900" : "text-gray-900"
                          )}>
                            {perm.name_ar}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {perm.module === 'all_access' ? 'سوبر أدمن' : perm.module}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-gray-600 font-bold hover:bg-gray-200 rounded-xl transition-all"
          >
            إلغاء
          </button>
          <button
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending || !selectedUser}
            className="px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 active:scale-95 disabled:opacity-50"
          >
            {submitMutation.isPending ? 'جاري الحفظ...' : 'حفظ الصلاحيات'}
          </button>
        </div>
      </div>
    </div>
  );
}
