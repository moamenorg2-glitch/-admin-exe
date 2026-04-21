import { supabase } from '../lib/supabase';
import { Database } from '../types/database.types';
import { supabaseAdmin, isAdminKeyAvailable } from '../lib/supabaseAdmin';
import { formatToE164 } from '../utils/phoneUtils';
import { getApiUrl } from '../utils/apiUtils';

export type Profile = Database['public']['Tables']['profiles']['Row'];


export const userService = {
  async fetchUsers(page: number, pageSize: number, filters: any) {
    let query = supabase
      .from('profiles')
      .select(`
        *,
        vendor_details:vendor_details(*),
        driver_details:driver_details(
          *,
          active_orders:order_delivery_team(
            master_order:master_orders!fk_order_delivery_team_master_order(status, id)
          )
        )
      `, { count: 'exact' });

    if (filters.type && filters.type !== 'all' && filters.type !== 'All') {
      query = query.eq('user_type', filters.type);
    }
    
    // إخفاء المستخدين المحذوفين منطقياً
    query = query.neq('status', 'محذوف');

    if (filters.search) {
      query = query.or(`full_name.ilike.%${filters.search}%,primary_phone.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) throw error;
    return { users: data, count };
  },

  async updateProfile(userId: string, profileData: Partial<Profile>) {
    const { error } = await supabase
      .from('profiles')
      .update(profileData)
      .eq('user_id', userId);
    if (error) throw error;
  },

  async updateUserStatus(userId: string, status: string) {
    const { error } = await supabase
      .from('profiles')
      .update({ status })
      .eq('user_id', userId);
    if (error) throw error;
  },

  async createUser(data: any) {
    const formattedPhone = formatToE164(data.primary_phone);
    const email = data.email?.toLowerCase();

    if (isAdminKeyAvailable) {
      // 1. Cleanup logic (requires Admin Key)
      try {
        let query = supabaseAdmin.from('profiles').select('user_id').or(`email.eq.${email},primary_phone.eq.${formattedPhone}`);
        const { data: existingProfiles } = await query;
        if (existingProfiles && existingProfiles.length > 0) {
          for (const profile of existingProfiles) {
            const timestamp = Date.now();
            const cleanupEmail = `archived.user.${timestamp}@cleanup.com`;
            await supabaseAdmin.auth.admin.updateUserById(profile.user_id, { email: cleanupEmail }).catch(() => null);
          }
        }
      } catch (e) { console.warn(e); }

      // 2. Create via Admin UI
      let { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email || undefined,
        phone: formattedPhone,
        password: data.password,
        email_confirm: true,
        phone_confirm: true,
        user_metadata: { full_name: data.full_name, user_type: data.user_type }
      });

      if (authError && authError.message.includes("already been registered")) {
        console.log("Email conflict detected, searching for user to archive...");
        
        // 1. Try finding by profile
        const { data: profiles } = await supabaseAdmin.from('profiles')
          .select('user_id')
          .or(`email.eq.${email},primary_phone.eq.${formattedPhone}`);
          
        let targetId = profiles?.[0]?.user_id;

        // 2. If profile not found, search Auth directly
        if (!targetId) {
          const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
          const existingUser = (authUsers?.users || []).find((u: any) => 
            u.email?.toLowerCase() === email || u.phone === formattedPhone
          );
          if (existingUser) targetId = existingUser.id;
        }

        if (targetId) {
          const timestamp = Date.now();
          const cleanupEmail = `archived.${timestamp}@cleanup.com`;
          const cleanupPhone = `999${timestamp}`.substring(0, 15);

          // Archive in Auth
          await supabaseAdmin.auth.admin.updateUserById(targetId, {
            email: cleanupEmail,
            phone: cleanupPhone,
            user_metadata: { archived: true }
          }).catch(() => null);

          // Archive in Profile (if it exists)
          await supabaseAdmin.from('profiles').update({
            email: cleanupEmail,
            primary_phone: cleanupPhone,
            status: 'محذوف'
          }).eq('user_id', targetId);
          
          // Retry
          const retry = await supabaseAdmin.auth.admin.createUser({
            email: email || undefined,
            phone: formattedPhone,
            password: data.password,
            email_confirm: true,
            phone_confirm: true,
            user_metadata: { full_name: data.full_name, user_type: data.user_type }
          });
          authData = retry.data;
          authError = retry.error;
        }
      }

      if (authError) throw authError;
      const userId = authData.user.id;

      await supabaseAdmin.from('profiles').upsert({
        user_id: userId,
        email: email || null,
        full_name: data.full_name,
        user_type: data.user_type,
        primary_phone: formattedPhone,
        status: 'نشط'
      });

      if (data.user_type === 'customer') {
        await supabaseAdmin.from('customer_details').upsert({
          user_id: userId,
          phone: formattedPhone
        });
      } else if (data.user_type === 'admin') {
        const { data: perm } = await supabaseAdmin.from('permissions').select('id').eq('module', 'all_access').single();
        if (perm) {
          await (supabaseAdmin.from('user_permissions' as any) as any).upsert({
            user_id: userId,
            permission_id: perm.id,
            granted_by: (await supabase.auth.getUser()).data.user?.id || userId
          });
        }
      }

      await supabaseAdmin.from('wallets').upsert({ user_id: userId });

      return { success: true, user_id: userId };
    } else {
      throw new Error(`تعذر إنشاء المستخدم. المفتاح السري Service Role Key غير متوفر في التطبيق، وهذا المتطلب أساسي لعمل التطبيق المستقل بدون خادم.`);
    }
  },

  async updateUser(userId: string, data: any) {
    const formattedPhone = formatToE164(data.primary_phone);

    if (isAdminKeyAvailable) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        email: data.email || undefined,
        phone: formattedPhone,
        password: data.password || undefined,
        user_metadata: {
          full_name: data.full_name,
          user_type: data.user_type,
          avatar_url: data.avatar_url,
        }
      });

      if (authError) throw authError;

      await supabaseAdmin.from('profiles').update({
        full_name: data.full_name,
        user_type: data.user_type,
        avatar_url: data.avatar_url,
        primary_phone: formattedPhone
      }).eq('user_id', userId);

      if (data.user_type === 'customer' && data.city) {
        await supabaseAdmin.from('customer_details')
          .update({
            phone: formattedPhone,
            city: data.city,
            district: data.district,
            street_name: data.street_name,
            building_number: data.building_number,
            floor_number: data.floor_number,
            apartment_num: data.apartment_number,
            landmark: data.landmark,
          })
          .eq('user_id', userId);
      }

      return { success: true };
    } else {
      throw new Error(`تعذر التحديث. المفتاح السري Service Role Key غير متوفر في التطبيق، وهذا متطلب أساسي لعمل التطبيق المستقل.`);
    }
  },

  async deleteUser(userId: string) {
    if (isAdminKeyAvailable) {
      try {
        // حذف البيانات المرتبطة أولاً بشكل تسلسلي لتجنب مشاكل Foreign Keys
        await supabaseAdmin.from('notifications').delete().eq('user_id', userId);
        await supabaseAdmin.from('search_history').delete().eq('user_id', userId);
        await (supabaseAdmin.from('favorites' as any) as any).delete().eq('user_id', userId);
        await (supabaseAdmin.from('push_subscriptions' as any) as any).delete().eq('user_id', userId);
        await supabaseAdmin.from('user_permissions' as any).delete().eq('user_id', userId);
        await supabaseAdmin.from('chat_messages').delete().eq('sender_id', userId);
        await supabaseAdmin.from('promotion_usage').delete().eq('user_id', userId);
        await supabaseAdmin.from('support_tickets').delete().eq('user_id', userId);
        await supabaseAdmin.from('support_tickets').update({ assigned_to: null } as any).eq('assigned_to', userId);
        await supabaseAdmin.from('audit_logs').update({ admin_id: null } as any).eq('admin_id', userId);

        const { data: userOrders } = await supabaseAdmin.from('master_orders').select('id').eq('customer_id', userId);
        if (userOrders && userOrders.length > 0) {
            const orderIds = userOrders.map(o => o.id);
            await supabaseAdmin.from('reviews').delete().in('order_id', orderIds);
            await supabaseAdmin.from('order_delivery_team').delete().in('master_order_id', orderIds);
            await supabaseAdmin.from('sub_orders').delete().in('master_order_id', orderIds);
            await supabaseAdmin.from('master_orders').delete().in('id', orderIds);
        }

        await supabaseAdmin.from('wallets_transaction').delete().eq('wallet_id', userId);
        await supabaseAdmin.from('wallets').delete().eq('user_id', userId);
        await supabaseAdmin.from('customer_details').delete().eq('user_id', userId);
        await supabaseAdmin.from('order_delivery_team').delete().eq('driver_id', userId);
        await supabaseAdmin.from('order_status_history').delete().eq('driver_id', userId);
        await supabaseAdmin.from('driver_details').delete().eq('user_id', userId);
        await supabaseAdmin.from('products').delete().eq('vendor_id', userId);
        await supabaseAdmin.from('menu_sections').delete().eq('vendor_id', userId);
        await supabaseAdmin.from('modifier_groups').delete().eq('vendor_id', userId);
        await supabaseAdmin.from('sub_orders').delete().eq('vendor_id', userId);
        await supabaseAdmin.from('vendor_details').delete().eq('user_id', userId);
        await supabaseAdmin.from('profiles').delete().eq('user_id', userId);
        
        // أخيراً حذف المستخدم من نظام المصادقة
        await supabaseAdmin.auth.admin.deleteUser(userId);
        
        return { success: true };
      } catch (adminErr: any) {
        throw adminErr;
      }
    } else {
      throw new Error("لا يمكن حذف المستخدم محلياً لعدم توفر متغيّر VITE_SUPABASE_SERVICE_ROLE_KEY في التطبيق.");
    }
  }
};
