import React, { useEffect, useState } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { promotionSchema, PromotionFormValues } from './types';
import { savePromotion } from './api';
import toast from 'react-hot-toast';
import { X, Plus, Trash2, Save, ArrowRight } from 'lucide-react';
import Select from 'react-select';

interface PromotionFormProps {
  initialData?: any;
  onClose: () => void;
}

export default function PromotionForm({ initialData, onClose }: PromotionFormProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'basic' | 'conditions' | 'rewards' | 'time_slots' | 'exclusions'>('basic');

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<PromotionFormValues>({
    resolver: zodResolver(promotionSchema),
    defaultValues: initialData || {
      code: '',
      title_ar: '',
      title_en: '',
      type: 'percentage',
      value: 0,
      min_order_value: 0,
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      is_active: true,
      priority: 0,
      stackable: false,
      usage_per_order: 1,
      applicable_to: ['all'],
      conditions: [],
      rewards: [],
      time_slots: [],
      exclusions: [],
      vendor_ids: [],
      category_ids: [],
      product_ids: [],
    }
  });

  const applicableTo = watch('applicable_to');
  const promoType = watch('type');
  const ownerType = watch('owner_type');
  const vendorIds = watch('vendor_ids');

  // Fetch reference data
  const { data: vendors } = useQuery({
    queryKey: ['vendors-ref'],
    queryFn: async () => {
      const { data } = await supabase.from('vendor_details').select('user_id, brand_name');
      return data?.map(v => ({ value: v.user_id, label: v.brand_name })) || [];
    }
  });

  const { data: categories } = useQuery({
    queryKey: ['categories-ref'],
    queryFn: async () => {
      const { data } = await supabase.from('vendor_categories').select('id, name_ar');
      return data?.map(c => ({ value: c.id, label: c.name_ar })) || [];
    }
  });

  const { data: products } = useQuery({
    queryKey: ['products-ref'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('id, name_ar, vendor_id, vendor:vendor_id(brand_name)');
      return data?.map((p) => ({ 
        value: p.id, 
        label: `${p.name_ar} (${(p.vendor as any)?.brand_name || 'بدون تاجر'})`,
        vendorId: p.vendor_id
      })) || [];
    }
  });

  const filteredProducts = React.useMemo(() => {
    if (!products) return [];
    if (ownerType === 'platform' || !vendorIds || vendorIds.length === 0) {
      return products;
    }
    return products.filter(p => vendorIds.includes(p.vendorId));
  }, [products, ownerType, vendorIds]);

  // Clear products if vendor changes
  useEffect(() => {
    if (ownerType === 'vendor' && vendorIds && vendorIds.length > 0 && products) {
      const currentProductIds = watch('product_ids') || [];
      const buyProductId = watch('buy_product_id');
      const getProductId = watch('get_product_id');

      const validProductIds = currentProductIds.filter(id => 
        products.find(p => p.value === id)?.vendorId === vendorIds[0]
      );

      if (validProductIds.length !== currentProductIds.length) {
        setValue('product_ids', validProductIds);
      }

      if (buyProductId && products.find(p => p.value === buyProductId)?.vendorId !== vendorIds[0]) {
        setValue('buy_product_id', undefined);
      }

      if (getProductId && products.find(p => p.value === getProductId)?.vendorId !== vendorIds[0]) {
        setValue('get_product_id', undefined);
      }
    }
  }, [vendorIds, ownerType, products, setValue]);

  const saveMutation = useMutation({
    mutationFn: savePromotion,
    onSuccess: () => {
      toast.success('تم حفظ العرض بنجاح');
      queryClient.invalidateQueries({ queryKey: ['promotions'] }).catch(console.error);
      onClose();
    },
    onError: (error: any) => {
      console.error('Save error:', error);
      toast.error(error.message || 'حدث خطأ أثناء حفظ العرض');
    }
  });

  const selectStyles = {
    control: (base: any) => ({
      ...base,
      backgroundColor: '#f9fafb', // bg-gray-50
      borderColor: '#d1d5db', // border-gray-300
      '&:hover': {
        borderColor: '#10b981', // emerald-500
      }
    }),
    singleValue: (base: any) => ({
      ...base,
      color: '#111827', // text-gray-900
    }),
    input: (base: any) => ({
      ...base,
      color: '#111827',
    }),
    option: (base: any, state: any) => ({
      ...base,
      color: state.isSelected ? 'white' : '#111827',
      backgroundColor: state.isSelected ? '#10b981' : state.isFocused ? '#ecfdf5' : 'white',
    }),
    placeholder: (base: any) => ({
      ...base,
      color: '#6b7280', // text-gray-500
    })
  };

  const selectStylesWhite = {
    control: (base: any) => ({
      ...base,
      backgroundColor: '#ffffff', // bg-white
      borderColor: '#d1d5db', // border-gray-300
      '&:hover': {
        borderColor: '#10b981', // emerald-500
      }
    }),
    singleValue: (base: any) => ({
      ...base,
      color: '#111827', // text-gray-900
    }),
    input: (base: any) => ({
      ...base,
      color: '#111827',
    }),
    option: (base: any, state: any) => ({
      ...base,
      color: state.isSelected ? 'white' : '#111827',
      backgroundColor: state.isSelected ? '#10b981' : state.isFocused ? '#ecfdf5' : 'white',
    }),
    placeholder: (base: any) => ({
      ...base,
      color: '#6b7280', // text-gray-500
    })
  };

  const onSubmit = (data: PromotionFormValues) => {
    saveMutation.mutate(data);
  };

  const onInvalid = (errors: any) => {
    console.error('Form validation errors keys:', Object.keys(errors));
    toast.error('يرجى التأكد من ملء جميع الحقول المطلوبة بشكل صحيح.');
  };

  // Field Arrays
  const { fields: conditions, append: appendCondition, remove: removeCondition } = useFieldArray({ control, name: 'conditions' });
  const { fields: rewards, append: appendReward, remove: removeReward } = useFieldArray({ control, name: 'rewards' });
  const { fields: timeSlots, append: appendTimeSlot, remove: removeTimeSlot } = useFieldArray({ control, name: 'time_slots' });
  const { fields: exclusions, append: appendExclusion, remove: removeExclusion } = useFieldArray({ control, name: 'exclusions' });

  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-gray-500 bg-opacity-75 flex justify-end">
      <div className="w-full max-w-4xl bg-white h-full shadow-xl flex flex-col animate-in slide-in-from-left">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
              <ArrowRight className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold text-gray-900">
              {initialData ? 'تعديل عرض ترويجي' : 'إضافة عرض ترويجي جديد'}
            </h2>
          </div>
          <button
            type="submit"
            form="promotion-form"
            disabled={isSubmitting || saveMutation.isPending}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none disabled:opacity-50"
          >
            <Save className="w-4 h-4 ml-2" />
            {isSubmitting || saveMutation.isPending ? 'جاري الحفظ...' : 'حفظ العرض'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
          <form id="promotion-form" onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-8 max-w-3xl mx-auto">
            
            {/* Basic Info Section */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 space-y-6">
              <h3 className="text-lg font-bold text-gray-900 border-b pb-2">المعلومات الأساسية</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">مصدر العرض *</label>
                    <select
                      {...register('owner_type')}
                      className="w-full bg-gray-50 border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 text-gray-900"
                    >
                      <option value="platform">عرض منصة</option>
                      <option value="vendor">عرض متجر</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">كود العرض *</label>
                    <input
                      {...register('code')}
                      className="w-full bg-gray-50 border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 uppercase text-gray-900"
                      placeholder="مثال: SUMMER2024"
                    />
                    {errors.code && <p className="mt-1 text-sm text-red-600">{errors.code.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">نوع العرض *</label>
                    <select
                      {...register('type')}
                      className="w-full bg-gray-50 border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 text-gray-900"
                    >
                      <option value="percentage">نسبة مئوية (%)</option>
                      <option value="fixed">مبلغ ثابت</option>
                      <option value="free_shipping">توصيل مجاني</option>
                      <option value="buy_x_get_y">اشتر X واحصل على Y</option>
                    </select>
                  </div>
                </div>

                {ownerType === 'vendor' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">المتجر *</label>
                    <Controller
                      name="vendor_ids"
                      control={control}
                      render={({ field }) => (
                        <Select
                          styles={selectStyles}
                          options={vendors}
                          value={vendors?.filter(v => field.value?.includes(v.value))}
                          onChange={(val: any) => field.onChange(val ? [val.value] : [])}
                          placeholder="اختر المتجر..."
                          className="react-select-container"
                          classNamePrefix="react-select"
                        />
                      )}
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">العنوان بالعربية *</label>
                    <input
                      {...register('title_ar')}
                      className="w-full bg-gray-50 border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 text-gray-900"
                    />
                    {errors.title_ar && <p className="mt-1 text-sm text-red-600">{errors.title_ar.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">العنوان بالإنجليزية</label>
                    <input
                      {...register('title_en')}
                      className="w-full bg-gray-50 border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 text-gray-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الوصف</label>
                  <textarea
                    {...register('description')}
                    rows={3}
                    className="w-full bg-gray-50 border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 text-gray-900"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {(promoType === 'percentage' || promoType === 'fixed') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">قيمة الخصم *</label>
                      <input
                        type="number"
                        step="0.01"
                        {...register('value', { setValueAs: v => v === '' ? 0 : Number(v) })}
                        className="w-full bg-gray-50 border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">الحد الأدنى للطلب</label>
                    <input
                      type="number"
                      step="0.01"
                      {...register('min_order_value', { setValueAs: v => v === '' ? 0 : Number(v) })}
                      className="w-full bg-gray-50 border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                  {promoType === 'percentage' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">الحد الأقصى للخصم</label>
                      <input
                        type="number"
                        step="0.01"
                        {...register('max_discount', { setValueAs: v => v === '' ? null : Number(v) })}
                        className="w-full bg-gray-50 border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    </div>
                  )}
                </div>

                {promoType === 'buy_x_get_y' && (
                    <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-100 space-y-4">
                      <div className="text-sm text-emerald-800 font-medium">
                        كيف يعمل عرض "اشترِ X واحصل على Y":
                        <ul className="list-disc list-inside mt-1 text-xs text-emerald-700">
                          <li>المنتج المطلوب (X): هو المنتج الذي يجب على العميل شراؤه.</li>
                          <li>الكمية المطلوبة (X): عدد القطع التي يجب شراؤها من المنتج X.</li>
                          <li>المنتج الهدية (Y): هو المنتج الذي سيحصل عليه العميل مجاناً.</li>
                          <li>الكمية (Y): عدد القطع المجانية التي سيحصل عليها العميل.</li>
                        </ul>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-emerald-800 mb-1">المنتج المطلوب (X) *</label>
                          <Controller
                            name="buy_product_id"
                            control={control}
                            render={({ field }) => (
                              <Select
                                styles={selectStyles}
                                options={filteredProducts}
                                value={filteredProducts?.find(p => p.value === field.value)}
                                onChange={(val: any) => field.onChange(val?.value)}
                                placeholder="اختر المنتج..."
                                className="react-select-container"
                                classNamePrefix="react-select"
                              />
                            )}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-emerald-800 mb-1">الكمية المطلوبة (X) *</label>
                          <input
                            type="number"
                            {...register('buy_product_quantity', { setValueAs: v => v === '' ? null : Number(v) })}
                            className="w-full bg-gray-50 border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500"
                            placeholder="الكمية"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-emerald-800 mb-1">المنتج الهدية (Y) *</label>
                          <Controller
                            name="get_product_id"
                            control={control}
                            render={({ field }) => (
                              <Select
                                styles={selectStyles}
                                options={filteredProducts}
                                value={filteredProducts?.find(p => p.value === field.value)}
                                onChange={(val: any) => field.onChange(val?.value)}
                                placeholder="اختر المنتج الهدية..."
                                className="react-select-container"
                                classNamePrefix="react-select"
                              />
                            )}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-emerald-800 mb-1">الكمية (Y) *</label>
                          <input
                            type="number"
                            {...register('get_product_quantity', { setValueAs: v => v === '' ? null : Number(v) })}
                            className="w-full bg-gray-50 border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500"
                            placeholder="الكمية"
                          />
                        </div>
                      </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ البدء *</label>
                    <input
                      type="datetime-local"
                      {...register('start_date')}
                      className="w-full bg-gray-50 border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ الانتهاء *</label>
                    <input
                      type="datetime-local"
                      {...register('end_date')}
                      className="w-full bg-gray-50 border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 text-gray-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">حد الاستخدام الكلي</label>
                    <input
                      type="number"
                      {...register('usage_limit', { setValueAs: v => v === '' ? null : Number(v) })}
                      placeholder="غير محدود"
                      className="w-full bg-gray-50 border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">حد الاستخدام لكل مستخدم</label>
                    <input
                      type="number"
                      {...register('per_user_limit', { setValueAs: v => v === '' ? null : Number(v) })}
                      placeholder="غير محدود"
                      className="w-full bg-gray-50 border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-6">
                  <h4 className="text-base font-medium text-gray-900 mb-4">نطاق التطبيق</h4>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">يُطبق على</label>
                    <div className="flex flex-wrap gap-4">
                      {['all', 'products', 'categories', 'vendors'].map((option) => (
                        <label key={option} className="inline-flex items-center">
                          <input
                            type="checkbox"
                            value={option}
                            {...register('applicable_to')}
                            className="form-checkbox h-4 w-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                          />
                          <span className="ml-2 mr-2 text-sm text-gray-700">
                            {option === 'all' ? 'الكل' : 
                             option === 'products' ? 'منتجات محددة' : 
                             option === 'categories' ? 'فئات محددة' : 'تجار محددين'}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {applicableTo?.includes('vendors') && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">التجار المشمولين</label>
                      <Controller
                        name="vendor_ids"
                        control={control}
                        render={({ field }) => (
                          <Select
                            styles={selectStyles}
                            isMulti
                            options={vendors}
                            value={vendors?.filter(v => field.value?.includes(v.value))}
                            onChange={(val) => field.onChange(val.map(v => v.value))}
                            placeholder="اختر التجار..."
                            className="react-select-container"
                            classNamePrefix="react-select"
                          />
                        )}
                      />
                    </div>
                  )}

                  {applicableTo?.includes('categories') && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">الفئات المشمولة</label>
                      <Controller
                        name="category_ids"
                        control={control}
                        render={({ field }) => (
                          <Select
                            styles={selectStyles}
                            isMulti
                            options={categories}
                            value={categories?.filter(c => field.value?.includes(c.value))}
                            onChange={(val) => field.onChange(val.map(c => c.value))}
                            placeholder="اختر الفئات..."
                            className="react-select-container"
                            classNamePrefix="react-select"
                          />
                        )}
                      />
                    </div>
                  )}

                  {applicableTo?.includes('products') && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">المنتجات المشمولة</label>
                      <Controller
                        name="product_ids"
                        control={control}
                        render={({ field }) => (
                          <Select
                            styles={selectStyles}
                            isMulti
                            options={filteredProducts}
                            value={filteredProducts?.filter(p => field.value?.includes(p.value))}
                            onChange={(val) => field.onChange(val.map(p => p.value))}
                            placeholder="اختر المنتجات..."
                            className="react-select-container"
                            classNamePrefix="react-select"
                          />
                        )}
                      />
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-200 pt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="is_active"
                      {...register('is_active')}
                      className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                    />
                    <label htmlFor="is_active" className="ml-2 mr-2 block text-sm text-gray-900">
                      تفعيل العرض
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="stackable"
                      {...register('stackable')}
                      className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                    />
                    <label htmlFor="stackable" className="ml-2 mr-2 block text-sm text-gray-900">
                      قابل للدمج مع عروض أخرى
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">الأولوية</label>
                    <input
                      type="number"
                      {...register('priority', { setValueAs: v => v === '' ? 0 : Number(v) })}
                      className="w-full bg-gray-50 border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

            {/* Advanced Settings Toggle */}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-emerald-600 hover:text-emerald-700 font-medium text-sm flex items-center gap-1"
              >
                {showAdvanced ? 'إخفاء الإعدادات المتقدمة' : 'عرض الإعدادات المتقدمة (شروط إضافية، مكافآت، أوقات محددة)'}
              </button>
            </div>

            {/* Advanced Sections */}
            {showAdvanced && (
              <div className="space-y-8 animate-in fade-in slide-in-from-top-4">
                {/* Conditions Section */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-medium text-gray-900">شروط تطبيق العرض</h3>
                  <button
                    type="button"
                    onClick={() => appendCondition({ condition_type: 'cart_total', operator: '>=', value: {} })}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-emerald-700 bg-emerald-100 hover:bg-emerald-200"
                  >
                    <Plus className="w-4 h-4 ml-1" />
                    إضافة شرط
                  </button>
                </div>

                {conditions.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    لا توجد شروط مضافة. سيتم تطبيق العرض على جميع الطلبات التي تستوفي الحد الأدنى.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {conditions.map((field, index) => (
                      <div key={field.id} className="flex items-start gap-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">نوع الشرط</label>
                            <select
                              {...register(`conditions.${index}.condition_type`)}
                              className="w-full bg-white border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                            >
                              <option value="cart_total">إجمالي السلة</option>
                              <option value="quantity">عدد المنتجات</option>
                              <option value="product">منتج محدد</option>
                              <option value="category">فئة محددة</option>
                              <option value="vendor">تاجر محدد</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">المعامل</label>
                            <select
                              {...register(`conditions.${index}.operator`)}
                              className="w-full bg-white border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                            >
                              <option value=">=">أكبر من أو يساوي</option>
                              <option value="<=">أصغر من أو يساوي</option>
                              <option value="==">يساوي</option>
                              <option value="IN">يحتوي على</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">القيمة (JSON)</label>
                            <Controller
                              name={`conditions.${index}.value`}
                              control={control}
                              render={({ field: { onChange, value } }) => (
                                <input
                                  type="text"
                                  value={typeof value === 'object' ? JSON.stringify(value) : value}
                                  onChange={(e) => {
                                    try {
                                      onChange(JSON.parse(e.target.value));
                                    } catch {
                                      onChange(e.target.value);
                                    }
                                  }}
                                  placeholder='{"amount": 100}'
                                  className="w-full bg-white border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 text-sm font-mono"
                                />
                              )}
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeCondition(index)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-md mt-6"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Rewards Section */}
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-medium text-gray-900">المكافآت الإضافية</h3>
                  <button
                    type="button"
                    onClick={() => appendReward({ reward_type: 'free_product', value: {}, applies_to: 'order' })}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-emerald-700 bg-emerald-100 hover:bg-emerald-200"
                  >
                    <Plus className="w-4 h-4 ml-1" />
                    إضافة مكافأة
                  </button>
                </div>

                {rewards.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    لا توجد مكافآت إضافية. سيتم تطبيق الخصم الأساسي فقط.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {rewards.map((field, index) => (
                      <div key={field.id} className="flex items-start gap-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">نوع المكافأة</label>
                            <select
                              {...register(`rewards.${index}.reward_type`)}
                              className="w-full bg-white border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                            >
                              <option value="free_product">منتج مجاني</option>
                              <option value="percentage_discount">خصم إضافي (%)</option>
                              <option value="fixed_discount">خصم إضافي (مبلغ)</option>
                              <option value="free_shipping">توصيل مجاني</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">تطبق على</label>
                            <select
                              {...register(`rewards.${index}.applies_to`)}
                              className="w-full bg-white border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                            >
                              <option value="order">الطلب كاملاً</option>
                              <option value="product">منتج محدد</option>
                              <option value="category">فئة محددة</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">القيمة (JSON)</label>
                            <Controller
                              name={`rewards.${index}.value`}
                              control={control}
                              render={({ field: { onChange, value } }) => (
                                <input
                                  type="text"
                                  value={typeof value === 'object' ? JSON.stringify(value) : value}
                                  onChange={(e) => {
                                    try {
                                      onChange(JSON.parse(e.target.value));
                                    } catch {
                                      onChange(e.target.value);
                                    }
                                  }}
                                  placeholder='{"product_id": "...", "qty": 1}'
                                  className="w-full bg-white border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 text-sm font-mono"
                                />
                              )}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">أقصى كمية</label>
                            <input
                              type="number"
                              {...register(`rewards.${index}.max_quantity`, { setValueAs: v => v === '' ? null : Number(v) })}
                              className="w-full bg-white border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeReward(index)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-md mt-6"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Time Slots Section */}
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-medium text-gray-900">أوقات التفعيل المحددة</h3>
                  <button
                    type="button"
                    onClick={() => appendTimeSlot({})}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-emerald-700 bg-emerald-100 hover:bg-emerald-200"
                  >
                    <Plus className="w-4 h-4 ml-1" />
                    إضافة فترة
                  </button>
                </div>

                {timeSlots.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    لا توجد فترات محددة. العرض متاح طوال فترة الصلاحية.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {timeSlots.map((field, index) => (
                      <div key={field.id} className="flex items-start gap-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">اليوم</label>
                            <select
                              {...register(`time_slots.${index}.day_of_week`, { setValueAs: v => v === '' ? null : Number(v) })}
                              className="w-full border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                            >
                              <option value="">كل الأيام</option>
                              <option value="0">الأحد</option>
                              <option value="1">الإثنين</option>
                              <option value="2">الثلاثاء</option>
                              <option value="3">الأربعاء</option>
                              <option value="4">الخميس</option>
                              <option value="5">الجمعة</option>
                              <option value="6">السبت</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">وقت البدء</label>
                            <input
                              type="time"
                              {...register(`time_slots.${index}.start_time`)}
                              className="w-full border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">وقت الانتهاء</label>
                            <input
                              type="time"
                              {...register(`time_slots.${index}.end_time`)}
                              className="w-full border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeTimeSlot(index)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-md mt-6"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Exclusions Section */}
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-medium text-gray-900">الاستثناءات</h3>
                  <button
                    type="button"
                    onClick={() => appendExclusion({ entity_type: 'product', entity_id: '' })}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-emerald-700 bg-emerald-100 hover:bg-emerald-200"
                  >
                    <Plus className="w-4 h-4 ml-1" />
                    إضافة استثناء
                  </button>
                </div>

                {exclusions.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    لا توجد استثناءات.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {exclusions.map((field, index) => {
                      const entityType = watch(`exclusions.${index}.entity_type`);
                      const options = entityType === 'product' ? filteredProducts : entityType === 'category' ? categories : vendors;
                      
                      return (
                        <div key={field.id} className="flex items-start gap-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">النوع</label>
                              <select
                                {...register(`exclusions.${index}.entity_type`)}
                                className="w-full bg-white border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                              >
                                <option value="product">منتج</option>
                                <option value="category">فئة</option>
                                <option value="vendor">تاجر</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">الكيان المستثنى</label>
                              <Controller
                                name={`exclusions.${index}.entity_id`}
                                control={control}
                                render={({ field: { onChange, value } }) => (
                                  <Select
                                    styles={selectStylesWhite}
                                    options={options}
                                    value={options?.find(o => o.value === value)}
                                    onChange={(val) => onChange(val?.value)}
                                    placeholder="اختر..."
                                    className="react-select-container text-sm"
                                    classNamePrefix="react-select"
                                  />
                                )}
                              />
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeExclusion(index)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-md mt-6"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            )}

          </form>
        </div>
      </div>
    </div>
  );
}
