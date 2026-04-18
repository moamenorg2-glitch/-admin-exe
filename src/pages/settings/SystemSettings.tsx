import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Settings, AlertTriangle, Smartphone, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import { settingsService, SystemSettings as ISystemSettings } from '../../services/settingsService';
import { handleGlobalError } from '../../utils/errorHandler';
import { ImageManager } from '../../components/ImageManager';

export default function SystemSettings() {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<ISystemSettings | null>(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['system_settings'],
    queryFn: async () => {
      try {
        const data = await settingsService.fetchSettings();
        if (data && !formData) {
          setFormData(data);
        }
        return data;
      } catch (error) {
        handleGlobalError(error, 'Fetch System Settings');
        throw error;
      }
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: ISystemSettings) => {
      await settingsService.updateSettings(newSettings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system_settings'] }).catch((err) => {
        console.error('Critical: Error invalidating system_settings query:', err);
      });
      toast.success('تم حفظ الإعدادات بنجاح');
      setIsEditing(false);
    },
    onError: (error: any) => {
      handleGlobalError(error, 'Update System Settings');
    },
  });

  const handleSave = () => {
    if (formData) {
      updateSettingsMutation.mutate(formData);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev: any) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? parseFloat(value) : value,
    }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  const currentData = isEditing ? formData : settings;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900">إعدادات النظام</h2>
        
        <div className="flex gap-3">
          {isEditing ? (
            <>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setFormData(settings);
                }}
                className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
              >
                إلغاء
              </button>
              <button
                onClick={handleSave}
                disabled={updateSettingsMutation.isPending}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50"
              >
                <Save className="w-4 h-4 ml-2" />
                {updateSettingsMutation.isPending ? 'جاري الحفظ...' : 'حفظ التغييرات'}
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
            >
              <Settings className="w-4 h-4 ml-2" />
              تعديل الإعدادات
            </button>
          )}
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg border border-gray-200">
        <div className="px-4 py-5 sm:p-6 space-y-8">
          
          {/* General Settings */}
          <div>
            <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center gap-2 mb-4 border-b pb-2">
              <Settings className="w-5 h-5 text-gray-400" />
              الإعدادات العامة
            </h3>
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">اسم التطبيق</label>
                <div className="mt-1">
                  <input
                    type="text"
                    name="app_name"
                    value={currentData?.app_name || ''}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className="shadow-sm focus:ring-emerald-500 focus:border-emerald-500 block w-full sm:text-sm border-gray-300 rounded-md disabled:bg-gray-50 disabled:text-gray-500 border py-2 px-3"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">رقم/بريد الدعم الفني</label>
                <div className="mt-1">
                  <input
                    type="text"
                    name="support_contact"
                    value={currentData?.support_contact || ''}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className="shadow-sm focus:ring-emerald-500 focus:border-emerald-500 block w-full sm:text-sm border-gray-300 rounded-md disabled:bg-gray-50 disabled:text-gray-500 border py-2 px-3"
                  />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">شعار التطبيق (App Logo)</label>
                <div className="mt-2">
                  <ImageManager
                    bucket="system"
                    path={`settings/app-logo-${Date.now()}.png`}
                    currentImageUrl={currentData?.appLogo || ''}
                    onImageChanged={(newUrl) => setFormData((prev: any) => ({ ...prev, appLogo: newUrl }))}
                    disabled={!isEditing}
                  />
                  <div className="mt-2">
                    <input
                      type="text"
                      name="appLogo"
                      value={currentData?.appLogo || ''}
                      onChange={handleChange}
                      disabled={!isEditing}
                      placeholder="أو أدخل رابط الصورة مباشرة"
                      className="shadow-sm focus:ring-emerald-500 focus:border-emerald-500 block w-full sm:text-sm border-gray-300 rounded-md disabled:bg-gray-50 disabled:text-gray-500 border py-2 px-3"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Financial Settings */}
          <div>
            <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center gap-2 mb-4 border-b pb-2">
              <DollarSign className="w-5 h-5 text-gray-400" />
              الإعدادات المالية
            </h3>
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">الحد الأقصى لمديونية السائق (ج.م)</label>
                <div className="mt-1">
                  <input
                    type="number"
                    name="driver_max_debt"
                    value={currentData?.driver_max_debt || 0}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className="shadow-sm focus:ring-emerald-500 focus:border-emerald-500 block w-full sm:text-sm border-gray-300 rounded-md disabled:bg-gray-50 disabled:text-gray-500 border py-2 px-3"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">غرامة الإلغاء (ج.م)</label>
                <div className="mt-1">
                  <input
                    type="number"
                    name="cancel_penalty"
                    value={currentData?.cancel_penalty || 0}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className="shadow-sm focus:ring-emerald-500 focus:border-emerald-500 block w-full sm:text-sm border-gray-300 rounded-md disabled:bg-gray-50 disabled:text-gray-500 border py-2 px-3"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">نسبة الضريبة (%)</label>
                <div className="mt-1">
                  <input
                    type="number"
                    name="tax_rate"
                    value={currentData?.tax_rate || 0}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className="shadow-sm focus:ring-emerald-500 focus:border-emerald-500 block w-full sm:text-sm border-gray-300 rounded-md disabled:bg-gray-50 disabled:text-gray-500 border py-2 px-3"
                  />
                </div>
              </div>
              <div className="sm:col-span-3">
                <label className="block text-sm font-medium text-gray-700">تعليمات الإيداع البنكي / المحافظ</label>
                <div className="mt-1">
                  <textarea
                    name="deposit_instructions"
                    rows={4}
                    value={currentData?.deposit_instructions || ''}
                    onChange={handleChange as any}
                    disabled={!isEditing}
                    className="shadow-sm focus:ring-emerald-500 focus:border-emerald-500 block w-full sm:text-sm border-gray-300 rounded-md disabled:bg-gray-50 disabled:text-gray-500 border py-2 px-3"
                    placeholder="أدخل تعليمات الإيداع البنكي أو أرقام المحافظ الإلكترونية هنا..."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* App & System Settings */}
          <div>
            <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center gap-2 mb-4 border-b pb-2">
              <Smartphone className="w-5 h-5 text-gray-400" />
              إعدادات التطبيق والنظام
            </h3>
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">الحد الأدنى لإصدار التطبيق</label>
                <div className="mt-1">
                  <input
                    type="text"
                    name="min_app_version"
                    value={currentData?.min_app_version || ''}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="مثال: 1.0.0"
                    className="shadow-sm focus:ring-emerald-500 focus:border-emerald-500 block w-full sm:text-sm border-gray-300 rounded-md disabled:bg-gray-50 disabled:text-gray-500 border py-2 px-3"
                  />
                </div>
              </div>
              
              <div className="flex items-center mt-6">
                <div className="flex items-center h-5">
                  <input
                    id="is_under_maintenance"
                    name="is_under_maintenance"
                    type="checkbox"
                    checked={currentData?.is_under_maintenance || false}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className="focus:ring-emerald-500 h-4 w-4 text-emerald-600 border-gray-300 rounded disabled:opacity-50"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="is_under_maintenance" className="font-medium text-gray-700 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    وضع الصيانة (إيقاف التطبيق مؤقتاً)
                  </label>
                  <p className="text-gray-500">عند تفعيل هذا الخيار، سيظهر للمستخدمين رسالة صيانة ولن يتمكنوا من استخدام التطبيق.</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
