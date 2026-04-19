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
          adminId: (await supabase.auth.getUser()).data.user?.id,
          metadata: {
            customer_details: data.user_type === 'customer' ? { phone: formattedPhone } : undefined
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
      
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        return response.json();
      } else {
        const text = await response.text();
        console.error("Unexpected non-JSON response from API:", text);
        throw new Error("تلقى المتصفح استجابة غير صالحة من الخادم. قد يكون الخادم في حالة إعادة تشغيل أو هناك خطأ في الإعدادات. يرجى المحاولة مرة أخرى.");
      }
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
    try {
      const response = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const err = await response.json();
          throw new Error(err.message || 'فشل في حذف المستخدم');
        } else {
          const text = await response.text();
          throw new Error(`خطأ في النظام: ${text}`);
        }
      }

      return { success: true };
    } catch (err: any) {
      console.error('Error in deleteUser:', err);
      // Fallback for direct UI access if API fails or for specific admins
      if (isAdminKeyAvailable) {
        try {
          await supabaseAdmin.from('profiles').delete().eq('user_id', userId);
          await supabaseAdmin.auth.admin.deleteUser(userId);
          return { success: true };
        } catch (adminErr: any) {
          throw adminErr;
        }
      }
      throw err;
    }
  }
};
