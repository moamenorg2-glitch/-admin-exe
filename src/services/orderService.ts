import { startOfDay, endOfDay, startOfWeek, startOfMonth } from 'date-fns';
import { supabase } from '../lib/supabase';
import { Database } from '../types/database.types';
import { financeService } from './financeService';
import { logAuditAction } from '../utils/auditLogger';

export type Order = Database['public']['Tables']['master_orders']['Row'];

export const orderService = {
  async fetchOrders(page: number, pageSize: number, filters: any) {
    let query = supabase
      .from('master_orders')
      .select(`
        *,
        customer:profiles!master_orders_customer_id_fkey(full_name, primary_phone, avatar_url),
        address:customer_details!master_orders_address_id_fkey(*),
        sub_orders:sub_orders(
          *,
          vendor:vendor_details!sub_orders_vendor_id_fkey(
            brand_name, 
            preparation_time_avg, 
            user_id,
            landmark,
            location_gps,
            profiles:profiles!vendor_details_user_id_fkey(primary_phone)
          ),
          order_status_history:order_status_history(*),
          order_items:order_items(
            *,
            variant:product_variants(variant_name)
          )
        ),
        delivery_team:order_delivery_team(
          id,
          driver_id,
          is_lead,
          driver:driver_details!order_delivery_team_driver_id_fkey(
            user:profiles!driver_details_user_id_fkey(full_name, primary_phone),
            active_orders:order_delivery_team(
              master_order:master_orders!fk_order_delivery_team_master_order(status, id)
            ),
            driver_location:driver_location(location)
          )
        )
      `, { count: 'exact' });

    if (filters.selectedStatuses && filters.selectedStatuses.length > 0) {
      query = query.in('status', filters.selectedStatuses);
    }

    if (filters.dateRange && filters.dateRange !== 'all') {
      let startDate, endDate;
      const today = new Date();
      
      if (filters.dateRange === 'today') {
        startDate = startOfDay(today);
        endDate = endOfDay(today);
      } else if (filters.dateRange === 'week') {
        startDate = startOfWeek(today, { weekStartsOn: 6 });
        endDate = endOfDay(today);
      } else if (filters.dateRange === 'month') {
        startDate = startOfMonth(today);
        endDate = endOfDay(today);
      } else if (filters.dateRange === 'custom' && filters.customDateRange?.start && filters.customDateRange?.end) {
        startDate = startOfDay(new Date(filters.customDateRange.start));
        endDate = endOfDay(new Date(filters.customDateRange.end));
      }

      if (startDate && endDate) {
        query = query.gte('created_at', startDate.toISOString())
                     .lte('created_at', endDate.toISOString());
      }
    }

    if (filters.searchQuery) {
      const orderNum = parseInt(filters.searchQuery);
      if (!isNaN(orderNum)) {
        query = query.eq('order_number', orderNum);
      }
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) throw error;

    let filteredData = data as any[];

    // Client-side filtering for text search on related fields
    if (filters.searchQuery && isNaN(parseInt(filters.searchQuery))) {
      const lowerQuery = filters.searchQuery.toLowerCase();
      filteredData = filteredData.filter(order => 
        order.customer?.full_name?.toLowerCase().includes(lowerQuery) ||
        order.customer?.primary_phone?.includes(lowerQuery) ||
        order.sub_orders?.some((so: any) => so.vendor?.brand_name?.toLowerCase().includes(lowerQuery))
      );
    }

    return { data: filteredData, count: count || filteredData.length };
  },

  async updateOrderStatus(orderId: string, status: 'Pending' | 'Active' | 'OnTheWay' | 'Completed' | 'Cancelled' | 'Rejected') {
    const { error } = await supabase
      .from('master_orders')
      .update({ status })
      .eq('id', orderId);
    if (error) throw error;

    await logAuditAction('UPDATE', 'master_orders', orderId, null, { status });

    // Record history for all sub-orders
    try {
      const { data: subOrders } = await supabase
        .from('sub_orders')
        .select('id')
        .eq('master_order_id', orderId);

      const { data: deliveryTeam } = await supabase
        .from('order_delivery_team')
        .select('driver_id')
        .eq('master_order_id', orderId);

      if (subOrders) {
        const historyEntries = (subOrders as any[]).flatMap((so: any) => {
          const drivers = (deliveryTeam as any[]) || [];
          if (drivers.length === 0) return [{ sub_order_id: so.id, status }];
          return drivers.map((dt: any) => ({
            sub_order_id: so.id,
            driver_id: dt.driver_id,
            status
          }));
        });

        if (historyEntries.length > 0) {
          await supabase.from('order_status_history').insert(historyEntries);
        }
      }
    } catch (err) {
      console.error('Error recording status history:', err);
    }

    // Update sub-orders status to match master order
    let subStatus = 'Pending';
    switch (status) {
      case 'Active': subStatus = 'Preparing'; break;
      case 'OnTheWay': subStatus = 'PickedUp'; break;
      case 'Completed': subStatus = 'Delivered'; break;
      case 'Cancelled':
      case 'Rejected': subStatus = 'Cancelled'; break;
      default: subStatus = 'Pending';
    }

    await supabase
      .from('sub_orders')
      .update({ sub_status: subStatus })
      .eq('master_order_id', orderId)
      .neq('sub_status', 'Cancelled')
      .neq('sub_status', 'Rejected');

    if (['Completed', 'Cancelled', 'Rejected'].includes(status)) {
      try {
        // Fetch all drivers associated with this master order
        const { data: deliveryTeam } = await supabase
          .from('order_delivery_team')
          .select('driver_id')
          .eq('master_order_id', orderId);
          
        if (deliveryTeam && (deliveryTeam as any[]).length > 0) {
          const driverIds = (deliveryTeam as any[]).map((dt: any) => dt.driver_id).filter(Boolean);
          const uniqueDriverIds = Array.from(new Set(driverIds)) as string[];
          
          for (const driverId of uniqueDriverIds) {
            // Check if driver has other active orders
            const { data: otherOrders } = await supabase
              .from('order_delivery_team')
              .select(`
                master_order_id,
                master_orders!fk_order_delivery_team_master_order(status)
              `)
              .eq('driver_id', driverId)
              .neq('master_order_id', orderId);
            
            const activeOrders = (otherOrders as any[])?.filter((o: any) => 
              o.master_orders && !['Completed', 'Cancelled', 'Rejected'].includes((o.master_orders as any).status)
            ) || [];

            if (activeOrders.length === 0) {
              await supabase
                .from('driver_details')
                .update({ is_busy: false })
                .eq('user_id', driverId);
            }
          }
        }
      } catch (err) {
        console.error('Error freeing drivers:', err);
      }
    }
  },

  async updateSubOrderStatus(subOrderId: string, status: 'Pending' | 'Preparing' | 'Ready' | 'PickedUp' | 'Delivered' | 'Cancelled' | 'Rejected') {
    const { data: subOrder, error: fetchError } = await supabase
      .from('sub_orders')
      .select('master_order_id, sub_total, sub_tax')
      .eq('id', subOrderId)
      .single();
    if (fetchError) throw fetchError;

    const { error: updateError } = await supabase
      .from('sub_orders')
      .update({ sub_status: status })
      .eq('id', subOrderId);
    if (updateError) throw updateError;

    await logAuditAction('UPDATE', 'sub_orders', subOrderId, null, { sub_status: status });

    // If cancelled or rejected, deduct the sub-order amount from the master order
    if ((status === 'Cancelled' || status === 'Rejected') && subOrder) {
      try {
        const { data: masterOrder, error: masterFetchError } = await supabase
          .from('master_orders')
          .select('id, customer_id, payment_status, grand_total')
          .eq('id', (subOrder as any).master_order_id)
          .single();

        if (!masterFetchError && masterOrder) {
          const oldGrandTotal = Number(masterOrder.grand_total || 0);
          
          // Recalculate everything including delivery fees
          await this.recalculateOrderTotals(masterOrder.id);

          // Fetch new grand total to calculate exact refund
          const { data: updatedMaster } = await supabase
            .from('master_orders')
            .select('grand_total')
            .eq('id', masterOrder.id)
            .single();
            
          const newGrandTotal = Number(updatedMaster?.grand_total || 0);
          const refundAmount = oldGrandTotal - newGrandTotal;

          // If paid, refund the amount to the customer's wallet
          if (masterOrder.payment_status === 'Paid' && refundAmount > 0) {
            await financeService.adjustWalletBalance(
              masterOrder.customer_id,
              refundAmount,
              'refund',
              `استرجاع مبلغ لطلب فرعي ملغي`,
              masterOrder.id
            );
          }
        }
      } catch (err) {
        console.error('Error deducting cancelled sub-order amount:', err);
      }
    }

    // Record history for this sub-order
    try {
      const { data: drivers } = await supabase
        .from('order_delivery_team')
        .select('driver_id')
        .eq('master_order_id', (subOrder as any).master_order_id);

      const historyStatus = status === 'Delivered' ? 'Completed' : status;
      
      if (drivers && (drivers as any[]).length > 0) {
        const entries = (drivers as any[]).map((d: any) => ({
          sub_order_id: subOrderId,
          driver_id: d.driver_id,
          status: historyStatus
        }));
        await supabase.from('order_status_history').insert(entries);
      } else {
        await supabase.from('order_status_history').insert({
          sub_order_id: subOrderId,
          status: historyStatus
        });
      }
    } catch (err) {
      console.error('Error recording sub-order status history:', err);
    }

    // If delivered, check if all sub-orders of the master order are delivered
    if (status === 'Delivered' && subOrder) {
      const { data: allSubOrders, error: allFetchError } = await supabase
        .from('sub_orders')
        .select('sub_status')
        .eq('master_order_id', (subOrder as any).master_order_id);
      
      if (allFetchError) throw allFetchError;

      const allDelivered = (allSubOrders as any[]).every((so: any) => so.sub_status === 'Delivered');
      if (allDelivered) {
        // Automatically complete the master order
        await this.updateOrderStatus((subOrder as any).master_order_id, 'Completed');
      }
    }
  },

  async assignDriver(masterOrderId: string, driverId: string) {
    console.log(`Assigning driver ${driverId} to master order ${masterOrderId}`);
    
    // Check if already assigned to this master order to prevent duplicates
    const { data: existing, error: checkError } = await supabase
      .from('order_delivery_team')
      .select('id')
      .eq('master_order_id', masterOrderId)
      .eq('driver_id', driverId)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking existing assignment:', checkError);
      throw checkError;
    }

    if (existing) {
      console.log('Driver already assigned to this order');
      throw new Error('هذا المندوب معين بالفعل لهذا الطلب');
    }

    const { error } = await supabase
      .from('order_delivery_team')
      .insert({
        master_order_id: masterOrderId,
        driver_id: driverId,
        is_lead: true
      });
    
    if (error) {
      console.error('Error inserting into order_delivery_team:', error);
      console.error('Details:', { masterOrderId, driverId });
      throw error;
    }

    // Mark driver as busy
    const { error: updateError } = await supabase
      .from('driver_details')
      .update({ is_busy: true })
      .eq('user_id', driverId);
      
    if (updateError) {
      console.error('Error updating driver busy status:', updateError);
      // We don't throw here as the assignment was successful
    }

    await logAuditAction('UPDATE', 'order_delivery_team', masterOrderId, null, { driver_id: driverId, action: 'assign_driver' });
  },

  async removeDriver(teamId: string, driverId: string) {
    console.log(`Removing driver ${driverId} from team entry ${teamId}`);
    
    const { error: deleteError } = await supabase
      .from('order_delivery_team')
      .delete()
      .eq('id', teamId);
    
    if (deleteError) {
      console.error('Error deleting from order_delivery_team:', deleteError);
      throw deleteError;
    }

    // Check if driver has other active orders before marking as not busy
    try {
      const { data: otherOrders } = await supabase
        .from('order_delivery_team')
        .select(`
          master_order_id,
          master_orders!fk_order_delivery_team_master_order(status)
        `)
        .eq('driver_id', driverId);
      
      const activeOrders = (otherOrders as any[])?.filter((o: any) => 
        o.master_orders && !['Completed', 'Cancelled', 'Rejected'].includes((o.master_orders as any).status)
      ) || [];

      if (activeOrders.length === 0) {
        const { error: updateError } = await supabase
          .from('driver_details')
          .update({ is_busy: false })
          .eq('user_id', driverId);
          
        if (updateError) {
          console.error('Error updating driver busy status to false:', updateError);
        }
      }
    } catch (err) {
      console.error('Error checking for other active orders:', err);
    }

    await logAuditAction('DELETE', 'order_delivery_team', teamId, { driver_id: driverId, action: 'remove_driver' });
  },

  async updatePrepTime(subOrderId: string, prepTime: number) {
    const { error } = await supabase
      .from('sub_orders')
      .update({ preparation_time_override: prepTime })
      .eq('id', subOrderId);
    if (error) throw error;

    await logAuditAction('UPDATE', 'sub_orders', subOrderId, null, { preparation_time_override: prepTime });
  },

  async cancelOrder(orderId: string, reason: string, customerId: string, grandTotal: number, paymentStatus: string, currentNotes: string) {
    // We use updateOrderStatus to handle driver freeing logic
    await this.updateOrderStatus(orderId, 'Cancelled');
    
    const { error: updateError } = await supabase
      .from('master_orders')
      .update({ 
        notes: currentNotes ? `${currentNotes}\nسبب الإلغاء: ${reason}` : `سبب الإلغاء: ${reason}` 
      })
      .eq('id', orderId);
    if (updateError) throw updateError;

    if (paymentStatus === 'Paid') {
      try {
        await financeService.adjustWalletBalance(
          customerId,
          grandTotal,
          'refund',
          `استرجاع مبلغ الطلب - ${reason}`,
          orderId
        );
        await supabase.from('master_orders').update({ payment_status: 'Refunded' }).eq('id', orderId);
      } catch (walletError) {
        console.error('Wallet transaction failed:', walletError);
      }
    }
  },

  async recalculateOrderTotals(masterOrderId: string) {
    // 1. Fetch all sub-orders and their items in one go
    const { data: subOrders, error: subOrdersError } = await (supabase as any)
      .from('sub_orders')
      .select(`
        id,
        sub_status,
        items:order_items(
          id,
          unit_price_snapshot,
          requested_qty,
          selected_modifiers,
          total_line_price
        )
      `)
      .eq('master_order_id', masterOrderId);

    if (subOrdersError) throw subOrdersError;
    if (!subOrders) return;

    let masterItemsTotal = 0;
    let masterTotalTax = 0;
    const { data: settings } = await supabase.from('system_settings').select('tax_rate').single();
    const taxRate = settings?.tax_rate || 0;

    // Separate updates for items and sub-orders to batch them if possible
    // Note: Supabase JS client doesn't support complex batch updates of different rows with different values easily in one call 
    // without a custom RPC, but we can at least minimize logic overhead.
    
    for (const subOrder of (subOrders as any[])) {
      if (subOrder.sub_status === 'Cancelled' || subOrder.sub_status === 'Rejected') continue;

      let subTotal = 0;
      const itemUpdates = [];

      for (const item of (subOrder.items as any[])) {
        let itemTotal = Number(item.unit_price_snapshot || 0) * Number(item.requested_qty || 0);
        
        if (item.selected_modifiers && typeof item.selected_modifiers === 'object') {
          Object.values(item.selected_modifiers).forEach((m: any) => {
            if (m?.price) itemTotal += Number(m.price) * Number(item.requested_qty || 0);
          });
        }
        
        subTotal += itemTotal;
        if (item.total_line_price !== itemTotal) {
          itemUpdates.push({ id: item.id, total_line_price: itemTotal });
        }
      }

      // Batch update items for this sub-order if any changed
      if (itemUpdates.length > 0) {
        await Promise.all(itemUpdates.map(update => 
          (supabase as any).from('order_items').update({ total_line_price: update.total_line_price }).eq('id', update.id)
        ));
      }

      const subTax = subTotal * (taxRate / 100);
      await supabase
        .from('sub_orders')
        .update({ sub_total: subTotal, sub_tax: subTax })
        .eq('id', subOrder.id);

      masterItemsTotal += subTotal;
      masterTotalTax += subTax;
    }

    // Update master order logic remains similar but with cleaner variables
    const { data: masterOrder, error: masterError } = await supabase
      .from('master_orders')
      .select('service_fee, delivery_fee, distance_fee, driver_tip, platform_discount, delivery_discount, farthest_vendor_id')
      .eq('id', masterOrderId)
      .single();

    if (masterError) throw masterError;

    let newDeliveryFee = Number(masterOrder.delivery_fee || 0);
    const activeSubOrdersCount = subOrders.filter(so => so.sub_status !== 'Cancelled' && so.sub_status !== 'Rejected').length;

    if (activeSubOrdersCount > 0 && masterOrder.farthest_vendor_id) {
      const { data: vendor } = await supabase
        .from('vendor_details')
        .select('zone_id')
        .eq('user_id', masterOrder.farthest_vendor_id)
        .single();
        
      if (vendor?.zone_id) {
        const { data: zone } = await supabase
          .from('zones')
          .select('base_delivery_fee, additional_vendor_fee')
          .eq('zone_id', vendor.zone_id)
          .single();
          
        if (zone) {
          const baseFee = Number(zone.base_delivery_fee || 0);
          const additionalFee = Number(zone.additional_vendor_fee || 0);
          newDeliveryFee = baseFee + (additionalFee * (activeSubOrdersCount - 1));
        }
      }
    } else if (activeSubOrdersCount === 0) {
      newDeliveryFee = 0;
    }

    const grandTotal = 
      masterItemsTotal + 
      masterTotalTax + 
      Number(masterOrder.service_fee || 0) + 
      newDeliveryFee + 
      Number(masterOrder.distance_fee || 0) + 
      Number(masterOrder.driver_tip || 0) - 
      Number(masterOrder.platform_discount || 0) - 
      Number(masterOrder.delivery_discount || 0);

    await supabase
      .from('master_orders')
      .update({
        items_total: masterItemsTotal,
        total_tax: masterTotalTax,
        delivery_fee: newDeliveryFee,
        grand_total: Math.max(0, grandTotal)
      })
      .eq('id', masterOrderId);
  },

  async removeSubOrder(subOrderId: string, masterOrderId: string) {
    await (supabase as any).from('order_items').delete().eq('sub_order_id', subOrderId);
    const { error } = await supabase.from('sub_orders').delete().eq('id', subOrderId);
    if (error) throw error;
    await this.recalculateOrderTotals(masterOrderId);
  },

  async removeOrderItem(itemId: string, masterOrderId: string) {
    const { error } = await (supabase as any).from('order_items').delete().eq('id', itemId);
    if (error) throw error;
    await this.recalculateOrderTotals(masterOrderId);
  },

  async updateOrderItemQuantity(itemId: string, newQty: number, masterOrderId: string) {
    if (newQty <= 0) {
      return this.removeOrderItem(itemId, masterOrderId);
    }
    const { error } = await (supabase as any).from('order_items').update({ requested_qty: newQty }).eq('id', itemId);
    if (error) throw error;
    await this.recalculateOrderTotals(masterOrderId);
  },

  async updateOrderItemModifiers(itemId: string, modifiers: any, masterOrderId: string) {
    const { error } = await (supabase as any)
      .from('order_items')
      .update({ selected_modifiers: modifiers })
      .eq('id', itemId);
    if (error) throw error;
    await this.recalculateOrderTotals(masterOrderId);
  },

  async addOrderItem(subOrderId: string, productId: string, masterOrderId: string) {
    // Fetch product details
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('name_ar, base_price')
      .eq('id', productId)
      .single();
      
    if (productError) throw productError;

    const newItem = {
      sub_order_id: subOrderId,
      product_id: productId,
      product_name_snapshot: product.name_ar,
      unit_price_snapshot: product.base_price,
      requested_qty: 1,
      total_line_price: product.base_price
    };

    const { error } = await (supabase as any).from('order_items').insert(newItem);
    if (error) throw error;

    await this.recalculateOrderTotals(masterOrderId);
  },

  async updateOrderAddress(orderId: string, addressData: any) {
    const { data: order } = await supabase.from('master_orders').select('address_id').eq('id', orderId).single();
    if (order?.address_id) {
      const { error } = await (supabase as any).from('customer_details').update(addressData).eq('id', order.address_id);
      if (error) throw error;
    }
  },

  async updateCustomerPhone(customerId: string, phone: string) {
    const { error } = await supabase.from('profiles').update({ primary_phone: phone }).eq('user_id', customerId);
    if (error) throw error;
  }
};
