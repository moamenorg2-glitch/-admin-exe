import { supabase } from '../lib/supabase';
import { Database } from '../types/database.types';
import { supabaseAdmin, isAdminKeyAvailable } from '../lib/supabaseAdmin';
import { formatToE164 } from '../utils/phoneUtils';
import { getApiUrl } from '../utils/apiUtils';

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

    const { data: vendors, count, error } = await query
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) throw error;

    // Enrich with order counts
    const enrichedVendors = await Promise.all((vendors || []).map(async (vendor: any) => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const { count: total } = await supabase
        .from('sub_orders')
        .select('*', { count: 'exact', head: true })
        .eq('vendor_id', vendor.user_id);
      
      const { count: today } = await supabase
        .from('sub_orders')
        .select('*', { count: 'exact', head: true })
        .eq('vendor_id', vendor.user_id)
        .gte('created_at', startOfDay.toISOString());

      // Get Today's status counts for the modal requirement
      const { count: completedToday } = await supabase
        .from('sub_orders')
        .select('*', { count: 'exact', head: true })
        .eq('vendor_id', vendor.user_id)
        .eq('sub_status', 'Delivered')
        .gte('created_at', startOfDay.toISOString());

      const { count: cancelledToday } = await supabase
        .from('sub_orders')
        .select('*', { count: 'exact', head: true })
        .eq('vendor_id', vendor.user_id)
        .eq('sub_status', 'Cancelled')
        .gte('created_at', startOfDay.toISOString());

      return { 
        ...vendor, 
        total_orders: total || 0, 
        today_orders: today || 0,
        completed_today: completedToday || 0,
        cancelled_today: cancelledToday || 0
      };
    }));

    return { vendors: enrichedVendors, count };
  },

  async updateVendorStatus(vendorId: string, isOpen: boolean) {
    const { error } = await supabase
      .from('vendor_details')
      .update({ is_open: isOpen })
      .eq('user_id', vendorId);
    if (error) throw error;
  },

  async deleteVendor(userId: string) {
    if (!isAdminKeyAvailable) throw new Error("Service Role Key is missing. Cannot delete vendor directly.");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw error;
    return { success: true };
  },

  async createVendor(formData: any, avatarUrl: string) {
    if (!isAdminKeyAvailable) throw new Error("Service Role Key is missing. Cannot create vendor directly.");
    const formattedPhone = formatToE164(formData.primary_phone);
    
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
  },

  async updateVendor(userId: string, data: any) {
    if (!isAdminKeyAvailable) throw new Error("Service Role Key is missing. Cannot update vendor directly.");
    const formattedPhone = formatToE164(data.primary_phone);

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
};
