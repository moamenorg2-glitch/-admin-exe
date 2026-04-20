import { supabase } from '../lib/supabase';
import { Database } from '../types/database.types';
import { supabaseAdmin, isAdminKeyAvailable } from '../lib/supabaseAdmin';
import { formatToE164 } from '../utils/phoneUtils';
import { getApiUrl } from '../utils/apiUtils';

export type Driver = Database['public']['Tables']['driver_details']['Row'];

export const driverService = {
  async fetchDrivers(page: number, pageSize: number, filters: any) {
    let query = (supabase
      .from('driver_details')
      .select(`
        *,
        profile:profiles!driver_details_user_id_fkey(full_name, primary_phone, avatar_url, email, status),
        zone:zones!driver_details_zone_id_fkey(name_ar),
        location:driver_location(location),
        active_orders:order_delivery_team(
          master_order:master_orders!fk_order_delivery_team_master_order(status, id)
        )
      `, { count: 'exact' }) as any);

    if (filters.search) {
      query = query.or(`vehicle_model.ilike.%${filters.search}%,license_plate.ilike.%${filters.search}%,national_id.ilike.%${filters.search}%`);
    }
    if (filters.zone_id && filters.zone_id !== 'all') {
      query = query.eq('zone_id', filters.zone_id);
    }
    if (filters.status && filters.status !== 'all') {
      if (filters.status === 'online') query = query.eq('is_online', true);
      if (filters.status === 'offline') query = query.eq('is_online', false);
      if (filters.status === 'busy') query = query.eq('is_busy', true);
      if (filters.status === 'available') query = query.eq('is_busy', false).eq('is_online', true);
    }

    // استبعاد المناديب المحذوفين منطقياً
    query = query.neq('profiles.status', 'محذوف');

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) throw error;
    return { drivers: data, count };
  },

  async updateDriverStatus(driverId: string, isOnline: boolean) {
    const { error } = await supabase
      .from('driver_details')
      .update({ is_online: isOnline })
      .eq('user_id', driverId);
    if (error) throw error;
  },

  async updateDriverBusyStatus(driverId: string, isBusy: boolean) {
    const { error } = await supabase
      .from('driver_details')
      .update({ is_busy: isBusy })
      .eq('user_id', driverId);
    if (error) throw error;
  },

  async deleteDriver(userId: string) {
    if (!isAdminKeyAvailable) throw new Error("Service Role Key is missing. Cannot delete driver directly.");

    try {
      // 1. Delete simple dependent records for drivers
      await (supabaseAdmin.from('driver_location' as any) as any).delete().eq('user_id', userId);
      await supabaseAdmin.from('order_status_history').delete().eq('driver_id', userId);
      await supabaseAdmin.from('driver_details').delete().eq('user_id', userId);
      await (supabaseAdmin.from('user_permissions' as any) as any).delete().eq('user_id', userId);
      await supabaseAdmin.from('notifications').delete().eq('user_id', userId);

      // 2. Try to delete auth user
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      
      if (error) {
        const isConstraintError = 
          error.message.includes('foreign key constraint') || 
          error.message.includes('violates foreign key') || 
          error.message.includes('Database error deleting user') ||
          error.message.includes('conflict');

        if (isConstraintError) {
          const timestamp = Date.now();
          const deletedEmail = `deleted.drv.${timestamp}.${userId}@zajel.com`;
          const deletedPhone = `999${timestamp}`.substring(0, 15);

          await supabaseAdmin.from('profiles').update({ 
            status: 'محذوف',
            full_name: 'مندوب مؤرشف',
            primary_phone: deletedPhone,
            email: deletedEmail
          }).eq('user_id', userId);

          // تحديث Auth لتحرير البيانات
          await supabaseAdmin.auth.admin.updateUserById(userId, {
            email: deletedEmail,
            phone: deletedPhone
          });
          
          return { success: true, message: 'تم أرشفة المندوب بنجاح وتحرير البيانات' };
        }
        throw error;
      }
      
      return { success: true };
    } catch (err: any) {
      if (err.message?.includes('Database error deleting user')) {
        const timestamp = Date.now();
        const deletedEmail = `deleted.drv.${timestamp}.${userId}@zajel.com`;
        
        await supabaseAdmin.from('profiles').update({ 
          status: 'محذوف',
          email: deletedEmail
        }).eq('user_id', userId);

        await supabaseAdmin.auth.admin.updateUserById(userId, {
          email: deletedEmail
        });

        return { success: true, message: 'تم أرشفة بيانات المندوب بنجاح' };
      }
      console.error('Error in deleteDriver:', err);
      throw err;
    }
  },

  async createDriver(formData: any, avatarUrl: string) {
    const formattedPhone = formatToE164(formData.primary_phone);
    const email = formData.email?.toLowerCase();

    if (isAdminKeyAvailable) {
      // 1. Cleanup existing user if they were deleted/archived incompletely
      try {
        // Find profile by email or phone
        let query = supabaseAdmin.from('profiles').select('user_id, status').or(`email.eq.${email},primary_phone.eq.${formattedPhone}`);
        const { data: existingProfiles } = await query;
        
        if (existingProfiles && existingProfiles.length > 0) {
          for (const profile of existingProfiles) {
            // If the profile exists and is marked as 'محذوف' or has been manually handled, ensure Auth is cleared
            const timestamp = Date.now();
            const cleanupEmail = `archived.${timestamp}.${profile.user_id}@cleanup.com`;
            const cleanupPhone = `999${timestamp}`.substring(0, 15);

            // Update Auth for the OLD user to free up the credentials
            await supabaseAdmin.auth.admin.updateUserById(profile.user_id, {
              email: cleanupEmail,
              phone: cleanupPhone,
              user_metadata: { archived: true }
            }).catch(() => null);

            // Update Profile for the OLD user
            await supabaseAdmin.from('profiles').update({
              email: cleanupEmail,
              primary_phone: cleanupPhone,
              status: 'محذوف'
            }).eq('user_id', profile.user_id);
          }
        }
      } catch (cleanupErr) {
        console.warn('Pre-creation cleanup failed (non-critical):', cleanupErr);
      }
      
      // 2. Create the new Auth user
      let { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email || undefined,
        phone: formattedPhone,
        password: formData.password,
        email_confirm: true,
        phone_confirm: true,
        user_metadata: {
          full_name: formData.full_name,
          user_type: 'driver',
          avatar_url: avatarUrl,
        }
      });

      if (authError && authError.message.includes("already been registered")) {
        console.log("Driver email conflict, searching for user...");
        
        // Find and archive existing profile to free up credentials
        let targetId;
        const { data: conflicts } = await supabaseAdmin.from('profiles')
          .select('user_id')
          .or(`email.eq.${email},primary_phone.eq.${formattedPhone}`);
          
        if (conflicts && conflicts.length > 0) {
          targetId = conflicts[0].user_id;
        } else {
          // Fallback: Check Auth directly if profile is missing
          const { data: authList } = await supabaseAdmin.auth.admin.listUsers();
          const existing = (authList?.users || []).find((u: any) => 
            u.email?.toLowerCase() === email || u.phone === formattedPhone
          );
          if (existing) targetId = existing.id;
        }

        if (targetId) {
          const timestamp = Date.now();
          const cleanupEmail = `archived.dr.${timestamp}@cleanup.com`;
          const cleanupPhone = `998${timestamp}`.substring(0, 15);

          await supabaseAdmin.auth.admin.updateUserById(targetId, {
            email: cleanupEmail,
            phone: cleanupPhone,
            user_metadata: { archived: true }
          }).catch(() => null);

          await supabaseAdmin.from('profiles').update({
            email: cleanupEmail,
            primary_phone: cleanupPhone,
            status: 'محذوف'
          }).eq('user_id', targetId);
          
          // Retry
          const retry = await supabaseAdmin.auth.admin.createUser({
            email: email || undefined,
            phone: formattedPhone,
            password: formData.password,
            email_confirm: true,
            phone_confirm: true,
            user_metadata: {
              full_name: formData.full_name,
              user_type: 'driver',
              avatar_url: avatarUrl,
            }
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
        full_name: formData.full_name,
        user_type: 'driver',
        avatar_url: avatarUrl,
        primary_phone: formattedPhone,
        status: 'نشط'
      });

      const { error: driverError } = await supabaseAdmin.from('driver_details').upsert({
        user_id: userId,
        vehicle_type: formData.vehicle_type,
        vehicle_model: formData.vehicle_model,
        license_plate: formData.license_plate,
        national_id: formData.national_id,
        zone_id: formData.zone_id,
        is_online: false,
        is_busy: false,
        driver_rating: 5.0
      });

      if (driverError) throw driverError;
      
      // Create Wallet
      await supabaseAdmin.from("wallets").upsert({ user_id: userId });

      return { ...authData, user_id: userId };
    } else {
      const response = await fetch(getApiUrl('/api/admin/create-user'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email || undefined,
          phone: formattedPhone,
          password: formData.password,
          full_name: formData.full_name,
          avatar_url: avatarUrl,
          user_type: 'driver',
          metadata: {
            driver_details: {
              vehicle_type: formData.vehicle_type,
              vehicle_model: formData.vehicle_model,
              license_plate: formData.license_plate,
              national_id: formData.national_id,
              zone_id: formData.zone_id,
              is_online: false,
              is_busy: false,
              driver_rating: 5.0
            }
          }
        })
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const err = await response.json();
          throw new Error(err.message || err.error || 'Failed to create driver');
        } else {
          const text = await response.text();
          console.error("Non-JSON error response:", text);
          throw new Error(`خطأ في الخادم (Server Error): ${response.status} ${response.statusText}. تأكد من أن الخادم يعمل بشكل صحيح.`);
        }
      }
      return response.json();
    }
  },

  async updateDriver(userId: string, data: any) {
    const formattedPhone = formatToE164(data.primary_phone);

    if (isAdminKeyAvailable) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        email: data.email || undefined,
        phone: formattedPhone,
        password: data.password || undefined,
        user_metadata: {
          full_name: data.full_name,
          user_type: 'driver',
          avatar_url: data.avatar_url,
        }
      });

      if (authError) throw authError;

      await supabaseAdmin.from('profiles').update({
        full_name: data.full_name,
        avatar_url: data.avatar_url,
        primary_phone: formattedPhone
      }).eq('user_id', userId);

      const { error: driverError } = await supabaseAdmin.from('driver_details').update({
        vehicle_type: data.vehicle_type,
        vehicle_model: data.vehicle_model,
        license_plate: data.license_plate,
        national_id: data.national_id,
        zone_id: data.zone_id
      }).eq('user_id', userId);

      if (driverError) throw driverError;
      return { success: true };
    }

    const response = await fetch(getApiUrl('/api/admin/update-user'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        email: data.email || undefined,
        phone: formattedPhone,
        password: data.password || undefined,
        full_name: data.full_name,
        avatar_url: data.avatar_url,
        user_type: 'driver',
        metadata: {
          driver_details: {
            vehicle_type: data.vehicle_type,
            vehicle_model: data.vehicle_model,
            license_plate: data.license_plate,
            national_id: data.national_id,
            zone_id: data.zone_id
          }
        }
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || err.error || 'Failed to update driver');
    }
    return response.json();
  }
};
