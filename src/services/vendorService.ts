import { supabase } from '../lib/supabase';
import { Database } from '../types/database.types';
import { supabaseAdmin, isAdminKeyAvailable } from '../lib/supabaseAdmin';
import { formatToE164 } from '../utils/phoneUtils';

export type Vendor = Database['public']['Tables']['vendor_details']['Row'];

export const vendorService = {
  async fetchVendors(page: number, pageSize: number, filters: any) {
    let query = (supabase as any)
      .from('vendor_details')
      .select(`
        *,
        profile:profiles!vendor_details_user_id_fkey(full_name, primary_phone, avatar_url, email, status),
        category:vendor_categories!vendor_details_category_id_fkey(name_ar),
        zone:zones!vendor_details_zone_id_fkey(name_ar)
      `, { count: 'exact' });

    if (filters.search) {
      query = query.or(`brand_name.ilike.%${filters.search}%,tax_registration_number.ilike.%${filters.search}%`);
    }
    if (filters.category_id && filters.category_id !== 'all') {
      query = query.eq('category_id', filters.category_id);
    }
    if (filters.zone_id && filters.zone_id !== 'all') {
      query = query.eq('zone_id', filters.zone_id);
    }
    if (filters.statusFilter && filters.statusFilter !== 'All') {
      query = query.eq('is_open', filters.statusFilter === 'Open');
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) throw error;
    return { vendors: data, count };
  },

  async updateVendorStatus(vendorId: string, isOpen: boolean) {
    const { error } = await supabase
      .from('vendor_details')
      .update({ is_open: isOpen })
      .eq('user_id', vendorId);
    if (error) throw error;
  },

  async deleteVendor(userId: string) {
    if (isAdminKeyAvailable) {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) throw error;
      return { success: true };
    }
    
    const response = await fetch('/api/admin/delete-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete vendor');
    }
    return response.json();
  },

  async createVendor(formData: any, avatarUrl: string) {
    const formattedPhone = formatToE164(formData.primary_phone);
    
    if (isAdminKeyAvailable) {
      // Create user via admin client
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: formData.email || undefined,
        phone: formattedPhone,
        password: formData.password,
        email_confirm: true,
        phone_confirm: true,
        user_metadata: {
          full_name: formData.brand_name,
          user_type: 'vendor',
          avatar_url: avatarUrl,
        }
      });

      if (authError) throw authError;
      const userId = authData.user.id;

      // Upsert profile
      await supabaseAdmin.from('profiles').upsert({
        user_id: userId,
        email: formData.email || null,
        full_name: formData.brand_name,
        user_type: 'vendor',
        avatar_url: avatarUrl,
        primary_phone: formattedPhone,
        status: 'نشط'
      });

      // Upsert vendor details
      const { error: vendorError } = await supabaseAdmin.from('vendor_details').upsert({
        user_id: userId,
        brand_name: formData.brand_name,
        category_id: formData.category_id,
        zone_id: formData.zone_id,
        commission_rate: formData.commission_rate,
        min_order_value: formData.min_order_value,
        landmark: formData.address,
        preparation_time_avg: formData.preparation_time_avg,
        tax_registration_number: formData.tax_registration_number,
        is_open: true,
        is_featured: false
      });

      if (vendorError) throw vendorError;

      // Create Wallet
      await supabaseAdmin.from("wallets").upsert({ user_id: userId });

      return { ...authData, user_id: userId };
    }

    const response = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: formData.email || undefined,
        phone: formattedPhone,
        password: formData.password,
        full_name: formData.brand_name,
        avatar_url: avatarUrl,
        user_type: 'vendor',
        metadata: {
          vendor_details: {
            brand_name: formData.brand_name,
            category_id: formData.category_id,
            zone_id: formData.zone_id,
            commission_rate: formData.commission_rate,
            min_order_value: formData.min_order_value,
            landmark: formData.address,
            preparation_time_avg: formData.preparation_time_avg,
            tax_registration_number: formData.tax_registration_number,
            is_open: true,
            is_featured: false
          }
        }
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || err.error || 'Failed to create vendor');
    }
    return response.json();
  },

  async updateVendor(userId: string, data: any) {
    const formattedPhone = formatToE164(data.primary_phone);

    if (isAdminKeyAvailable) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        email: data.email || undefined,
        phone: formattedPhone,
        password: data.password || undefined,
        user_metadata: {
          full_name: data.brand_name,
          user_type: 'vendor',
          avatar_url: data.avatar_url,
        }
      });

      if (authError) throw authError;

      await supabaseAdmin.from('profiles').update({
        full_name: data.brand_name,
        avatar_url: data.avatar_url,
        primary_phone: formattedPhone
      }).eq('user_id', userId);

      const { error: vendorError } = await supabaseAdmin.from('vendor_details').update({
        brand_name: data.brand_name,
        category_id: data.category_id,
        zone_id: data.zone_id,
        commission_rate: data.commission_rate,
        min_order_value: data.min_order_value,
        landmark: data.address,
        preparation_time_avg: data.preparation_time_avg,
        tax_registration_number: data.tax_registration_number,
      }).eq('user_id', userId);

      if (vendorError) throw vendorError;
      return { success: true };
    }

    const response = await fetch('/api/admin/update-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        email: data.email || undefined,
        phone: formattedPhone,
        password: data.password || undefined,
        full_name: data.brand_name,
        avatar_url: data.avatar_url,
        user_type: 'vendor',
        metadata: {
          vendor_details: {
            brand_name: data.brand_name,
            category_id: data.category_id,
            zone_id: data.zone_id,
            commission_rate: data.commission_rate,
            min_order_value: data.min_order_value,
            landmark: data.address,
            preparation_time_avg: data.preparation_time_avg,
            tax_registration_number: data.tax_registration_number,
          }
        }
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || err.error || 'Failed to update vendor');
    }
    return response.json();
  }
};
