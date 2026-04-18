import { supabase } from '../../lib/supabase';
import { PromotionFormValues } from './types';

export const fetchPromotions = async (page: number, pageSize: number, searchQuery: string, statusFilter: string) => {
  let query = supabase
    .from('promotions')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (searchQuery) {
    query = query.or(`code.ilike.%${searchQuery}%,title_ar.ilike.%${searchQuery}%`);
  }

  if (statusFilter !== 'All') {
    query = query.eq('is_active', statusFilter === 'Active');
  }

  const { data, count, error } = await query;
  if (error) throw error;
  return { promotions: data, count };
};

export const fetchPromotionDetails = async (id: string) => {
  const { data: promotion, error: promoError } = await supabase
    .from('promotions')
    .select('*')
    .eq('id', id)
    .single();

  if (promoError) throw promoError;

  const relatedResults = await Promise.all([
    supabase.from('promotion_conditions').select('*').eq('promotion_id', id),
    supabase.from('promotion_rewards').select('*').eq('promotion_id', id),
    supabase.from('promotion_time_slots').select('*').eq('promotion_id', id),
    supabase.from('promotion_exclusions').select('*').eq('promotion_id', id),
  ]);

  for (const result of relatedResults) {
    if (result.error) throw result.error;
  }

  const [conditions, rewards, timeSlots, exclusions] = relatedResults;

  let owner_type = 'platform';
  if (promotion.vendor_ids && promotion.vendor_ids.length > 0) {
    owner_type = 'vendor';
  }

  let buy_product_id = '';
  let buy_product_quantity = 0;
  let get_product_id = '';
  let get_product_quantity = 1;
  if (promotion.type === 'buy_x_get_y') {
    if (promotion.product_ids && promotion.product_ids.length > 0) {
      buy_product_id = promotion.product_ids[0];
    }
    
    // Extract buy_product_quantity from conditions
    const quantityCondition = conditions.data?.find(c => c.condition_type === 'quantity');
    if (quantityCondition && quantityCondition.value && (quantityCondition.value as any).quantity) {
      buy_product_quantity = (quantityCondition.value as any).quantity;
    }

    const freeProductReward = rewards.data?.find(r => r.reward_type === 'free_product');
    if (freeProductReward && freeProductReward.value) {
      const val = freeProductReward.value as any;
      if (val.product_id) get_product_id = val.product_id;
      if (val.qty) get_product_quantity = val.qty;
    }
  }

  return {
    ...promotion,
    owner_type,
    buy_product_id,
    buy_product_quantity,
    get_product_id,
    get_product_quantity,
    conditions: conditions.data || [],
    rewards: rewards.data || [],
    time_slots: timeSlots.data || [],
    exclusions: exclusions.data || [],
  };
};

export const savePromotion = async (data: PromotionFormValues) => {
  const { conditions, rewards, time_slots, exclusions, owner_type, buy_product_id, buy_product_quantity, get_product_id, get_product_quantity, ...promoData } = data;
  
  let promotionId = promoData.id;

  // Handle owner_type
  if (owner_type === 'platform') {
    promoData.vendor_ids = [];
  }

  // Handle buy_x_get_y
  let finalRewards = [...rewards];
  let finalConditions = [...conditions];
  if (promoData.type === 'buy_x_get_y') {
    if (buy_product_id) {
      promoData.product_ids = [buy_product_id];
      if (!promoData.applicable_to.includes('products')) {
        promoData.applicable_to = [...promoData.applicable_to, 'products'];
      }
      
      // Add quantity condition
      if (buy_product_quantity && buy_product_quantity > 0) {
        finalConditions.push({
          condition_type: 'quantity',
          operator: '>=',
          value: { product_id: buy_product_id, quantity: buy_product_quantity }
        });
      }
    }
    if (get_product_id) {
      // Check if a free product reward already exists
      const existingRewardIndex = finalRewards.findIndex(r => r.reward_type === 'free_product');
      const qty = get_product_quantity || 1;
      if (existingRewardIndex >= 0) {
        finalRewards[existingRewardIndex].value = { product_id: get_product_id, qty };
      } else {
        finalRewards.push({
          reward_type: 'free_product',
          value: { product_id: get_product_id, qty },
          applies_to: 'order'
        });
      }
    }
  } else if (promoData.type === 'free_shipping') {
    promoData.value = 0;
    
    // Ensure the reward is set correctly
    const existingRewardIndex = finalRewards.findIndex(r => r.reward_type === 'free_shipping');
    if (existingRewardIndex >= 0) {
      finalRewards[existingRewardIndex].value = {};
      finalRewards[existingRewardIndex].applies_to = 'delivery';
      finalRewards[existingRewardIndex].target_id = null;
      finalRewards[existingRewardIndex].max_quantity = null;
    } else {
      finalRewards.push({
        reward_type: 'free_shipping',
        value: {},
        applies_to: 'delivery',
        target_id: null,
        max_quantity: null
      });
    }

    // Add min_order_value condition if provided
    if (promoData.min_order_value && promoData.min_order_value > 0) {
      const existingConditionIndex = finalConditions.findIndex(c => c.condition_type === 'cart_total');
      if (existingConditionIndex >= 0) {
        finalConditions[existingConditionIndex].operator = '>=';
        finalConditions[existingConditionIndex].value = { amount: promoData.min_order_value };
      } else {
        finalConditions.push({
          condition_type: 'cart_total',
          operator: '>=',
          value: { amount: promoData.min_order_value }
        });
      }
    }
  }

  // 1. Save Promotion
  if (promotionId) {
    const { error } = await supabase
      .from('promotions')
      .update(promoData)
      .eq('id', promotionId);
    if (error) throw error;
  } else {
    const { data: newPromo, error } = await supabase
      .from('promotions')
      .insert([promoData as any])
      .select('id')
      .single();
    if (error) throw error;
    promotionId = (newPromo as any).id;
  }

  // 2. Delete existing related records
  if (data.id) {
    const deleteResults = await Promise.all([
      supabase.from('promotion_conditions').delete().eq('promotion_id', promotionId),
      supabase.from('promotion_rewards').delete().eq('promotion_id', promotionId),
      supabase.from('promotion_time_slots').delete().eq('promotion_id', promotionId),
      supabase.from('promotion_exclusions').delete().eq('promotion_id', promotionId),
    ]);
    for (const result of deleteResults) {
      if (result.error) throw result.error;
    }
  }

  // 3. Insert new related records
  const insertPromises = [];

  if (finalConditions.length > 0) {
    const conditionsToInsert = finalConditions.map(c => {
      const { id, ...rest } = c;
      return { ...rest, promotion_id: promotionId };
    });
    insertPromises.push(supabase.from('promotion_conditions').insert(conditionsToInsert));
  }

  if (finalRewards.length > 0) {
    const rewardsToInsert = finalRewards.map(r => {
      const { id, ...rest } = r;
      return { ...rest, promotion_id: promotionId };
    });
    insertPromises.push(supabase.from('promotion_rewards').insert(rewardsToInsert));
  }

  if (time_slots.length > 0) {
    const timeSlotsToInsert = time_slots.map(t => {
      const { id, ...rest } = t;
      return { ...rest, promotion_id: promotionId };
    });
    insertPromises.push(supabase.from('promotion_time_slots').insert(timeSlotsToInsert));
  }

  if (exclusions.length > 0) {
    const exclusionsToInsert = exclusions.map(e => {
      const { id, ...rest } = e;
      return { ...rest, promotion_id: promotionId };
    });
    insertPromises.push(supabase.from('promotion_exclusions').insert(exclusionsToInsert));
  }

  const results = await Promise.all(insertPromises);
  
  for (const result of results) {
    if (result.error) throw result.error;
  }
  
  return promotionId;
};

export const deletePromotion = async (id: string) => {
  const { error } = await supabase.from('promotions').delete().eq('id', id);
  if (error) throw error;
};

export const togglePromotionStatus = async (id: string, currentStatus: boolean) => {
  const { error } = await supabase
    .from('promotions')
    .update({ is_active: !currentStatus })
    .eq('id', id);
  if (error) throw error;
};

export const fetchPromotionUsage = async (id: string) => {
  const { data, error } = await supabase
    .from('promotion_usage')
    .select(`
      id,
      used_at,
      discount_amount,
      order_id,
      user_id,
      user:profiles!promotion_usage_user_id_fkey (
        full_name,
        primary_phone
      )
    `)
    .eq('promotion_id', id)
    .order('used_at', { ascending: false });
    
  if (error) throw error;
  return data;
};
