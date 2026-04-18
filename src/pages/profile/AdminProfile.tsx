import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { User, Mail, Phone, Shield, Camera, Save, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { handleGlobalError } from '../../utils/errorHandler';

export default function AdminProfile() {
  const { profile, user, setProfile } = useAuthStore();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    full_name: '',
    primary_phone: '',
    avatar_url: '',
  });

  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        primary_phone: profile.primary_phone || '',
        avatar_url: profile.avatar_url || '',
      });
    }
  }, [profile]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      setIsUploading(true);
      
      // 1. Delete old avatar if it exists and is hosted on our Supabase storage
      if (formData.avatar_url && formData.avatar_url.includes('supabase.co/storage/v1/object/public/profiles/')) {
        const oldPath = formData.avatar_url.split('/profiles/')[1];
        if (oldPath) {
          await supabase.storage.from('profiles').remove([oldPath]);
        }
      }

      // 2. Upload new avatar
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        if (uploadError.message.includes('Bucket not found') || uploadError.message.includes('The resource was not found')) {
           throw new Error('حاوية التخزين "profiles" غير موجودة في Supabase. يرجى إنشاؤها أولاً.');
        }
        throw uploadError;
      }

      // 3. Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profiles')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, avatar_url: publicUrl }));
      toast.success('تم رفع الصورة بنجاح، لا تنس حفظ التغييرات');
    } catch (error: any) {
      handleGlobalError(error, 'رفع صورة الملف الشخصي');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!user) throw new Error('No user found');
      
      const { data: updatedProfile, error } = await supabase
        .from('profiles')
        .update({
          full_name: data.full_name,
          primary_phone: data.primary_phone,
          avatar_url: data.avatar_url,
        })
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return updatedProfile;
    },
    onSuccess: (data) => {
      setProfile(data);
      queryClient.invalidateQueries({ queryKey: ['profile'] }).catch(console.error);
      toast.success('تم تحديث الملف الشخصي بنجاح');
      setIsEditing(false);
    },
    onError: (error: any) => {
      handleGlobalError(error, 'تحديث الملف الشخصي');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(formData);
  };

  if (!profile || !user) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">الملف الشخصي</h1>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            تعديل البيانات
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header Background */}
        <div className="h-32 bg-gradient-to-r from-emerald-500 to-emerald-600"></div>
        
        <div className="px-8 pb-8">
          {/* Avatar */}
          <div className="relative flex justify-between items-end -mt-12 mb-8">
            <div className="relative">
              <div className="w-24 h-24 bg-white rounded-full p-1 shadow-md">
                {formData.avatar_url ? (
                  <img 
                    src={formData.avatar_url} 
                    alt="Profile" 
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-emerald-100 flex items-center justify-center">
                    <User className="w-10 h-10 text-emerald-600" />
                  </div>
                )}
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImageUpload} 
                accept="image/*" 
                className="hidden" 
              />
              {isEditing && (
                <button 
                  type="button"
                  disabled={isUploading}
                  className="absolute bottom-0 right-0 bg-gray-900 text-white p-1.5 rounded-full shadow-sm hover:bg-gray-800 transition-colors disabled:opacity-50"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                </button>
              )}
            </div>
            
            <div className="text-left">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 text-emerald-800">
                <Shield className="w-4 h-4" />
                {profile.user_type === 'Admin' ? 'مدير النظام' : profile.user_type}
              </span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  الاسم الكامل
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    disabled={!isEditing}
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="block w-full pr-10 border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm disabled:bg-gray-50 disabled:text-gray-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  البريد الإلكتروني
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    disabled
                    value={user.email || ''}
                    className="block w-full pr-10 border-gray-300 rounded-lg bg-gray-50 text-gray-500 sm:text-sm cursor-not-allowed"
                    title="لا يمكن تغيير البريد الإلكتروني من هنا"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">البريد الإلكتروني مرتبط بحساب الدخول ولا يمكن تغييره.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  رقم الهاتف
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="tel"
                    dir="ltr"
                    disabled={!isEditing}
                    value={formData.primary_phone}
                    onChange={(e) => setFormData({ ...formData, primary_phone: e.target.value })}
                    className="block w-full pr-10 text-left border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm disabled:bg-gray-50 disabled:text-gray-500"
                    required
                  />
                </div>
              </div>
            </div>

            {isEditing && (
              <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                <button
                  type="submit"
                  disabled={updateProfileMutation.isPending}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {updateProfileMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  حفظ التغييرات
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    // Reset form
                    setFormData({
                      full_name: profile.full_name || '',
                      primary_phone: profile.primary_phone || '',
                      avatar_url: profile.avatar_url || '',
                    });
                  }}
                  disabled={updateProfileMutation.isPending}
                  className="bg-white border border-gray-300 text-gray-700 px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
