import { z } from 'zod';

export const promotionConditionSchema = z.object({
  id: z.string().optional(),
  condition_type: z.enum(['product', 'category', 'cart_total', 'quantity', 'vendor', 'customer_group', 'day_of_week', 'time_range']),
  operator: z.string(),
  value: z.any(),
});

export const promotionRewardSchema = z.object({
  id: z.string().optional(),
  reward_type: z.enum(['percentage_discount', 'fixed_discount', 'free_product', 'buy_x_get_y', 'free_shipping']),
  value: z.any(),
  applies_to: z.enum(['order', 'product', 'category', 'vendor', 'delivery']),
  target_id: z.string().uuid().nullable().optional(),
  max_quantity: z.number().nullable().optional(),
});

export const promotionTimeSlotSchema = z.object({
  id: z.string().optional(),
  day_of_week: z.number().min(0).max(6).nullable().optional(),
  start_time: z.string().nullable().optional(),
  end_time: z.string().nullable().optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
});

export const promotionExclusionSchema = z.object({
  id: z.string().optional(),
  entity_type: z.enum(['product', 'category', 'vendor']),
  entity_id: z.string().min(1, 'يجب اختيار الكيان المستثنى'),
});

export const promotionSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(1, 'كود العرض مطلوب'),
  title_ar: z.string().min(1, 'العنوان بالعربية مطلوب'),
  title_en: z.string().optional(),
  description: z.string().optional(),
  type: z.enum(['percentage', 'fixed', 'free_shipping', 'buy_x_get_y']),
  value: z.number().min(0),
  min_order_value: z.number().min(0),
  max_discount: z.number().nullable().optional(),
  start_date: z.string().min(1, 'تاريخ البدء مطلوب'),
  end_date: z.string().min(1, 'تاريخ الانتهاء مطلوب'),
  usage_limit: z.number().nullable().optional(),
  per_user_limit: z.number().nullable().optional(),
  applicable_to: z.array(z.string()),
  is_active: z.boolean(),
  priority: z.number(),
  stackable: z.boolean(),
  max_discount_per_order: z.number().nullable().optional(),
  usage_per_order: z.number(),
  
  // Relations
  conditions: z.array(promotionConditionSchema),
  rewards: z.array(promotionRewardSchema),
  time_slots: z.array(promotionTimeSlotSchema),
  exclusions: z.array(promotionExclusionSchema),
  
  // UI specific fields for applicable_to
  vendor_ids: z.array(z.string()).optional(),
  category_ids: z.array(z.string()).optional(),
  product_ids: z.array(z.string()).optional(),
  
  // New UI specific fields
  owner_type: z.enum(['platform', 'vendor']).optional(),
  buy_product_id: z.string().nullable().optional(),
  buy_product_quantity: z.number().nullable().optional(),
  get_product_id: z.string().nullable().optional(),
  get_product_quantity: z.number().nullable().optional(),
});

export type PromotionCondition = z.infer<typeof promotionConditionSchema>;
export type PromotionReward = z.infer<typeof promotionRewardSchema>;
export type PromotionTimeSlot = z.infer<typeof promotionTimeSlotSchema>;
export type PromotionExclusion = z.infer<typeof promotionExclusionSchema>;
export type PromotionFormValues = z.infer<typeof promotionSchema>;
