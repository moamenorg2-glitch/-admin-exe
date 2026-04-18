import { supabase } from '../lib/supabase';
import { Database } from '../types/database.types';
import { supabaseAdmin, isAdminKeyAvailable } from '../lib/supabaseAdmin';
import { formatToE164 } from '../utils/phoneUtils';

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

      return { success: true, user_id: userId };
    } else {
      // FALLBACK: Use Server API
      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email || undefined,
          phone: formattedPhone,
          password: data.password,
          full_name: data.full_name,
          user_type: data.user_type,
          metadata: {
            customer_details: data.user_type === 'customer' ? { loyalty_points: 0, total_orders: 0 } : undefined
          }
        })
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const err = await response.json();
          throw new Error(err.message || err.error || 'Failed to create user');
        } else {
          const text = await response.text();
          console.error("Non-JSON error response from API:", text);
          throw new Error(`خطأ في نظام الإدارة (HTTP ${response.status}). يرجى التأكد من إعداد VITE_SUPABASE_SERVICE_ROLE_KEY في إعدادات التطبيق.`);
        }
      }
      
      return response.json();
    }
  },

  async updateUser(userId: string, data: any) {
    if (!isAdminKeyAvailable) throw new Error("Service Role Key is missing. Cannot update users directly.");
    const formattedPhone = formatToE164(data.primary_phone);

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
  },

  async deleteUser(userId: string) {
    if (!isAdminKeyAvailable) throw new Error("Service Role Key is missing.");
    
    try {
      // 1. First delete simple dependent records that don't have mission-critical data
      // Delete customer details
      await supabaseAdmin.from('customer_details').delete().eq('user_id', userId);
      
      // Delete notifications
      await supabaseAdmin.from('notifications').delete().eq('user_id', userId);

      // Delete push subscriptions
      await (supabaseAdmin.from('push_subscriptions' as any) as any).delete().eq('user_id', userId);

      // Delete search history
      await supabaseAdmin.from('search_history').delete().eq('user_id', userId);

      // Delete favorites
      await (supabaseAdmin.from('favorites' as any) as any).delete().eq('user_id', userId);

      // 2. Check if user has orders or wallet transactions before total deletion
      // If we delete the auth user, the profile must be deleted. 
      // If profile has orders, it will fail due to FK constraints.
      
      // We try to delete the auth user. If it fails due to DB constraints, 
      // we Fallback to "Soft Disable/Delete" by changing status.
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      
      if (error) {
        // التحقق من كافة رسائل الخطأ التي تشير لوجود سجلات مرتبطة
        const isConstraintError = 
          error.message.includes('foreign key constraint') || 
          error.message.includes('violates foreign key') || 
          error.message.includes('Database error deleting user') ||
          error.message.includes('conflict');

        if (isConstraintError) {
          const timestamp = Date.now();
          const deletedEmail = `deleted.${timestamp}.${userId}@zajel.com`;
          const deletedPhone = `000${timestamp}`.substring(0, 15);

          await supabaseAdmin.from('profiles').update({ 
            status: 'محذوف',
            full_name: 'مستخدم مؤرشف',
            primary_phone: deletedPhone,
            email: deletedEmail
          }).eq('user_id', userId);
          
          // تحديث بيانات الـ Auth لتحرير البريد والاتف الأصلي
          await supabaseAdmin.auth.admin.updateUserById(userId, {
            email: deletedEmail,
            phone: deletedPhone,
            user_metadata: { is_deleted: true }
          });
          
          return { success: true, message: 'تم أرشفة المستخدم بنجاح وتحرير البريد الإلكتروني' };
        }
        throw error;
      }
      
      return { success: true };
    } catch (err: any) {
      if (err.message?.includes('Database error deleting user')) {
        const timestamp = Date.now();
        const deletedEmail = `deleted.${timestamp}.${userId}@zajel.com`;
        await supabaseAdmin.from('profiles').update({ 
          status: 'محذوف',
          email: deletedEmail
        }).eq('user_id', userId);
        
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          email: deletedEmail
        });
        
        return { success: true, message: 'تم أرشفة المستخدم' };
      }
      console.error('Error in deleteUser:', err);
      throw err;
    }
  }
};
