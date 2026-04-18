export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
    Tables: {
      profiles: {
        Row: {
          user_id: string
          full_name: string
          user_type: 'admin' | 'customer' | 'driver' | 'vendor'
          primary_phone: string
          email: string | null
          avatar_url: string | null
          status: string
          language: string
          fcm_token: string | null
          is_verified: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          full_name: string
          user_type: 'admin' | 'customer' | 'driver' | 'vendor'
          primary_phone: string
          email?: string | null
          avatar_url?: string | null
          status?: string
          language?: string
          fcm_token?: string | null
          is_verified?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: any[]
        Update: {
          user_id?: string
          full_name?: string
          user_type?: 'admin' | 'customer' | 'driver' | 'vendor'
          primary_phone?: string
          email?: string | null
          avatar_url?: string | null
          status?: string
          language?: string
          fcm_token?: string | null
          is_verified?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      master_orders: {
        Row: {
          id: string
          order_number: number
          customer_id: string | null
          address_id: string | null
          status: 'Pending' | 'Active' | 'OnTheWay' | 'Completed' | 'Cancelled' | 'Rejected'
          payment_method: string | null
          payment_status: 'Unpaid' | 'Paid' | 'Refunded'
          items_total: number
          total_tax: number
          service_fee: number
          delivery_fee: number
          distance_fee: number
          driver_tip: number
          grand_total: number
          total_distance: number | null
          notes: string | null
          created_at: string
          updated_at: string
          farthest_vendor_id: string | null
          platform_discount: number
          delivery_discount: number
        }
        Insert: {
          id?: string
          order_number?: number
          customer_id?: string | null
          address_id?: string | null
          status?: 'Pending' | 'Active' | 'OnTheWay' | 'Completed' | 'Cancelled' | 'Rejected'
          payment_method?: string | null
          payment_status?: 'Unpaid' | 'Paid' | 'Refunded'
          items_total?: number
          total_tax?: number
          service_fee?: number
          delivery_fee?: number
          distance_fee?: number
          driver_tip?: number
          grand_total?: number
          total_distance?: number | null
          notes?: string | null
          created_at?: string
          updated_at?: string
          farthest_vendor_id?: string | null
          platform_discount?: number
          delivery_discount?: number
        }
        Relationships: any[]
        Update: {
          id?: string
          order_number?: number
          customer_id?: string | null
          address_id?: string | null
          status?: 'Pending' | 'Active' | 'OnTheWay' | 'Completed' | 'Cancelled' | 'Rejected'
          payment_method?: string | null
          payment_status?: 'Unpaid' | 'Paid' | 'Refunded'
          items_total?: number
          total_tax?: number
          service_fee?: number
          delivery_fee?: number
          distance_fee?: number
          driver_tip?: number
          grand_total?: number
          total_distance?: number | null
          notes?: string | null
          created_at?: string
          updated_at?: string
          farthest_vendor_id?: string | null
          platform_discount?: number
          delivery_discount?: number
        }
      }
      vendor_details: {
        Row: {
          user_id: string
          brand_name: string
          category_id: string | null
          tax_registration_number: string | null
          landmark: string | null
          is_open: boolean
          commission_rate: number | null
          preparation_time_avg: number | null
          min_order_value: number | null
          is_featured: boolean
          created_at: string
          updated_at: string
          location_gps: any | null
          zone_id: string
        }
        Insert: {
          user_id: string
          brand_name: string
          category_id?: string | null
          tax_registration_number?: string | null
          landmark?: string | null
          is_open?: boolean
          commission_rate?: number | null
          preparation_time_avg?: number | null
          min_order_value?: number | null
          is_featured?: boolean
          created_at?: string
          updated_at?: string
          location_gps?: any | null
          zone_id: string
        }
        Relationships: any[]
        Update: {
          user_id?: string
          brand_name?: string
          category_id?: string | null
          tax_registration_number?: string | null
          landmark?: string | null
          is_open?: boolean
          commission_rate?: number | null
          preparation_time_avg?: number | null
          min_order_value?: number | null
          is_featured?: boolean
          created_at?: string
          updated_at?: string
          location_gps?: any | null
          zone_id?: string
        }
      }
      driver_details: {
        Row: {
          user_id: string
          vehicle_type: string | null
          vehicle_model: string | null
          license_plate: string | null
          national_id: string | null
          is_online: boolean
          is_busy: boolean
          driver_rating: number | null
          identity_img: string | null
          license_img: string | null
          criminal_record_img: string | null
          created_at: string
          updated_at: string
          zone_id: string
        }
        Insert: {
          user_id: string
          vehicle_type?: string | null
          vehicle_model?: string | null
          license_plate?: string | null
          national_id?: string | null
          is_online?: boolean
          is_busy?: boolean
          driver_rating?: number | null
          identity_img?: string | null
          license_img?: string | null
          criminal_record_img?: string | null
          created_at?: string
          updated_at?: string
          zone_id: string
        }
        Relationships: any[]
        Update: {
          user_id?: string
          vehicle_type?: string | null
          vehicle_model?: string | null
          license_plate?: string | null
          national_id?: string | null
          is_online?: boolean
          is_busy?: boolean
          driver_rating?: number | null
          identity_img?: string | null
          license_img?: string | null
          criminal_record_img?: string | null
          created_at?: string
          updated_at?: string
          zone_id?: string
        }
      }
      customer_details: {
        Row: {
          id: string
          user_id: string | null
          phone: string
          address_label: string | null
          city: string | null
          district: string | null
          street_name: string | null
          building_number: string | null
          floor_number: string | null
          apartment_num: string | null
          landmark: string | null
          location_gps: any | null
          is_default: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          phone: string
          address_label?: string | null
          city?: string | null
          district?: string | null
          street_name?: string | null
          building_number?: string | null
          floor_number?: string | null
          apartment_num?: string | null
          landmark?: string | null
          location_gps?: any | null
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: any[]
        Update: {
          id?: string
          user_id?: string | null
          phone?: string
          address_label?: string | null
          city?: string | null
          district?: string | null
          street_name?: string | null
          building_number?: string | null
          floor_number?: string | null
          apartment_num?: string | null
          landmark?: string | null
          location_gps?: any | null
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      promotions: {
        Row: {
          id: string
          code: string
          title_ar: string
          title_en: string
          description: string | null
          type: string
          value: number
          min_order_value: number
          max_discount: number | null
          start_date: string
          end_date: string
          usage_limit: number | null
          per_user_limit: number
          applicable_to: string[]
          vendor_ids: string[]
          category_ids: string[]
          product_ids: string[]
          is_active: boolean
          priority: number
          stackable: boolean
          max_discount_per_order: number | null
          usage_per_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          title_ar: string
          title_en: string
          description?: string | null
          type: string
          value: number
          min_order_value?: number
          max_discount?: number | null
          start_date: string
          end_date: string
          usage_limit?: number | null
          per_user_limit?: number
          applicable_to?: string[]
          vendor_ids?: string[]
          category_ids?: string[]
          product_ids?: string[]
          is_active?: boolean
          priority?: number
          stackable?: boolean
          max_discount_per_order?: number | null
          usage_per_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: any[]
        Update: {
          id?: string
          code?: string
          title_ar?: string
          title_en?: string
          description?: string | null
          type?: string
          value?: number
          min_order_value?: number
          max_discount?: number | null
          start_date?: string
          end_date?: string
          usage_limit?: number | null
          per_user_limit?: number
          applicable_to?: string[]
          vendor_ids?: string[]
          category_ids?: string[]
          product_ids?: string[]
          is_active?: boolean
          priority?: number
          stackable?: boolean
          max_discount_per_order?: number | null
          usage_per_order?: number
          created_at?: string
          updated_at?: string
        }
      }
      wallets: {
        Row: {
          user_id: string
          current_balance: number
          locked_balance: number
          currency: string
          is_frozen: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          current_balance?: number
          locked_balance?: number
          currency?: string
          is_frozen?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: any[]
        Update: {
          user_id?: string
          current_balance?: number
          locked_balance?: number
          currency?: string
          is_frozen?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      zones: {
        Row: {
          zone_id: string
          name_ar: string
          name_en: string
          city_id: string | null
          boundary: any | null
          centroid: any | null
          default_zoom_level: number | null
          z_index: number | null
          base_delivery_fee: number | null
          base_distance_km: number | null
          extra_fee_per_km: number | null
          max_delivery_distance: number | null
          min_order_value: number | null
          driver_payout_fixed: number | null
          driver_payout_per_km: number | null
          driver_commission_pct: number | null
          surge_multiplier: number | null
          surge_threshold_orders: number | null
          is_surge_active: boolean
          is_active: boolean
          max_orders_capacity: number | null
          opening_time: string | null
          closing_time: string | null
          zone_buffer_minutes: number | null
          allowed_vehicles: string[] | null
          max_weight_kg: number | null
          payment_methods: string[] | null
          announcement_msg_ar: string | null
          metadata: Json | null
          created_at: string
          updated_at: string
          additional_vendor_fee: number | null
        }
        Insert: {
          zone_id?: string
          name_ar: string
          name_en: string
          city_id?: string | null
          boundary?: any | null
          centroid?: any | null
          default_zoom_level?: number | null
          z_index?: number | null
          base_delivery_fee?: number | null
          base_distance_km?: number | null
          extra_fee_per_km?: number | null
          max_delivery_distance?: number | null
          min_order_value?: number | null
          driver_payout_fixed?: number | null
          driver_payout_per_km?: number | null
          driver_commission_pct?: number | null
          surge_multiplier?: number | null
          surge_threshold_orders?: number | null
          is_surge_active?: boolean
          is_active?: boolean
          max_orders_capacity?: number | null
          opening_time?: string | null
          closing_time?: string | null
          zone_buffer_minutes?: number | null
          allowed_vehicles?: string[] | null
          max_weight_kg?: number | null
          payment_methods?: string[] | null
          announcement_msg_ar?: string | null
          metadata?: Json | null
          created_at?: string
          updated_at?: string
          additional_vendor_fee?: number | null
        }
        Relationships: any[]
        Update: {
          zone_id?: string
          name_ar?: string
          name_en?: string
          city_id?: string | null
          boundary?: any | null
          centroid?: any | null
          default_zoom_level?: number | null
          z_index?: number | null
          base_delivery_fee?: number | null
          base_distance_km?: number | null
          extra_fee_per_km?: number | null
          max_delivery_distance?: number | null
          min_order_value?: number | null
          driver_payout_fixed?: number | null
          driver_payout_per_km?: number | null
          driver_commission_pct?: number | null
          surge_multiplier?: number | null
          surge_threshold_orders?: number | null
          is_surge_active?: boolean
          is_active?: boolean
          max_orders_capacity?: number | null
          opening_time?: string | null
          closing_time?: string | null
          zone_buffer_minutes?: number | null
          allowed_vehicles?: string[] | null
          max_weight_kg?: number | null
          payment_methods?: string[] | null
          announcement_msg_ar?: string | null
          metadata?: Json | null
          created_at?: string
          updated_at?: string
          additional_vendor_fee?: number | null
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string | null
          title: string
          content: string
          is_read: boolean
          created_at: string
          updated_at: string
          data: Json | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          title: string
          content: string
          is_read?: boolean
          created_at?: string
          updated_at?: string
          data?: Json | null
        }
        Relationships: any[]
        Update: {
          id?: string
          user_id?: string | null
          title?: string
          content?: string
          is_read?: boolean
          created_at?: string
          updated_at?: string
          data?: Json | null
        }
      }
      performance_reports: {
        Row: {
          id: string
          report_type: string
          period_start: string
          period_end: string
          generated_at: string
          generated_by: string | null
          data: Json
          summary: string | null
          file_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          report_type: string
          period_start: string
          period_end: string
          generated_at?: string
          generated_by?: string | null
          data: Json
          summary?: string | null
          file_url?: string | null
          created_at?: string
        }
        Relationships: any[]
        Update: {
          id?: string
          report_type?: string
          period_start?: string
          period_end?: string
          generated_at?: string
          generated_by?: string | null
          data?: Json
          summary?: string | null
          file_url?: string | null
          created_at?: string
        }
      }
      system_settings: {
        Row: {
          id: number
          app_name: string
          support_contact: string
          driver_max_debt: number
          cancel_penalty: number
          min_app_version: string
          is_under_maintenance: boolean
          created_at: string
          updated_at: string
          tax_rate: number
          appLogo: string | null
          deposit_instructions: string | null
        }
        Insert: {
          id?: number
          app_name: string
          support_contact: string
          driver_max_debt: number
          cancel_penalty: number
          min_app_version: string
          is_under_maintenance?: boolean
          created_at?: string
          updated_at?: string
          tax_rate?: number
          appLogo?: string | null
          deposit_instructions?: string | null
        }
        Relationships: any[]
        Update: {
          id?: number
          app_name?: string
          support_contact?: string
          driver_max_debt?: number
          cancel_penalty?: number
          min_app_version?: string
          is_under_maintenance?: boolean
          created_at?: string
          updated_at?: string
          tax_rate?: number
          appLogo?: string | null
          deposit_instructions?: string | null
        }
      }
      audit_logs: {
        Row: {
          id: string
          admin_id: string | null
          action_type: string
          table_name: string
          record_id: string
          old_value: Json | null
          new_value: Json | null
          ip_address: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          admin_id?: string | null
          action_type: string
          table_name: string
          record_id: string
          old_value?: Json | null
          new_value?: Json | null
          ip_address?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: any[]
        Update: {
          id?: string
          admin_id?: string | null
          action_type?: string
          table_name?: string
          record_id?: string
          old_value?: Json | null
          new_value?: Json | null
          ip_address?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      vendor_categories: {
        Row: {
          id: string
          name_ar: string
          name_en: string
          icon_url: string | null
          sort_order: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name_ar: string
          name_en: string
          icon_url?: string | null
          sort_order?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: any[]
        Update: {
          id?: string
          name_ar?: string
          name_en?: string
          icon_url?: string | null
          sort_order?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      cities: {
        Row: {
          id: string
          name_ar: string
          name_en: string
          center_lat: number | null
          center_lng: number | null
          zoom_level: number | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name_ar: string
          name_en: string
          center_lat?: number | null
          center_lng?: number | null
          zoom_level?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: any[]
        Update: {
          id?: string
          name_ar?: string
          name_en?: string
          center_lat?: number | null
          center_lng?: number | null
          zoom_level?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      permissions: {
        Row: {
          id: string
          name: string
          name_ar: string
          description: string | null
          module: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          name_ar: string
          description?: string | null
          module: string
          created_at?: string
        }
        Relationships: any[]
        Update: {
          id?: string
          name?: string
          name_ar?: string
          description?: string | null
          module?: string
          created_at?: string
        }
      }
      support_tickets: {
        Row: {
          id: string
          ticket_number: string
          order_id: string | null
          user_id: string | null
          is_chat_enabled: boolean
          subject: string
          description: string | null
          priority: string
          status: string
          assigned_to: string | null
          resolved_at: string | null
          created_at: string
          updated_at: string
          chat_room_id: string | null
        }
        Insert: {
          id?: string
          ticket_number: string
          order_id?: string | null
          user_id?: string | null
          is_chat_enabled?: boolean
          subject: string
          description?: string | null
          priority?: string
          status?: string
          assigned_to?: string | null
          resolved_at?: string | null
          created_at?: string
          updated_at?: string
          chat_room_id?: string | null
        }
        Relationships: any[]
        Update: {
          id?: string
          ticket_number?: string
          order_id?: string | null
          user_id?: string | null
          is_chat_enabled?: boolean
          subject?: string
          description?: string | null
          priority?: string
          status?: string
          assigned_to?: string | null
          resolved_at?: string | null
          created_at?: string
          updated_at?: string
          chat_room_id?: string | null
        }
      }
      products: {
        Row: {
          id: string
          section_id: string | null
          vendor_id: string | null
          name_ar: string
          base_price: number
          image_url: string | null
          is_available: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          section_id?: string | null
          vendor_id?: string | null
          name_ar: string
          base_price: number
          image_url?: string | null
          is_available?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: any[]
        Update: {
          id?: string
          section_id?: string | null
          vendor_id?: string | null
          name_ar?: string
          base_price?: number
          image_url?: string | null
          is_available?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      menu_sections: {
        Row: {
          id: string
          vendor_id: string | null
          name_ar: string
          is_active: boolean
          sort_order: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          vendor_id?: string | null
          name_ar: string
          is_active?: boolean
          sort_order?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: any[]
        Update: {
          id?: string
          vendor_id?: string | null
          name_ar?: string
          is_active?: boolean
          sort_order?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      dispute_resolution: {
        Row: {
          id: string
          ticket_id: string | null
          order_id: string | null
          evidence_urls: Json | null
          arbitrator_id: string | null
          ruling_type: string | null
          refund_amount: number | null
          deducted_from: string | null
          status: string
          wallet_tx_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          ticket_id?: string | null
          order_id?: string | null
          evidence_urls?: Json | null
          arbitrator_id?: string | null
          ruling_type?: string | null
          refund_amount?: number | null
          deducted_from?: string | null
          status?: string
          wallet_tx_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: any[]
        Update: {
          id?: string
          ticket_id?: string | null
          order_id?: string | null
          evidence_urls?: Json | null
          arbitrator_id?: string | null
          ruling_type?: string | null
          refund_amount?: number | null
          deducted_from?: string | null
          status?: string
          wallet_tx_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      wallets_transaction: {
        Row: {
          transaction_id: string
          wallet_id: string
          amount: number
          balance_after: number
          transaction_type: string
          reference_id: string | null
          description_ar: string | null
          created_at: string
          updated_at: string
          proof_url: string | null
          requested_amount: number | null
        }
        Insert: {
          transaction_id?: string
          wallet_id: string
          amount: number
          balance_after: number
          transaction_type: string
          reference_id?: string | null
          description_ar?: string | null
          created_at?: string
          updated_at?: string
          proof_url?: string | null
          requested_amount?: number | null
        }
        Relationships: any[]
        Update: {
          transaction_id?: string
          wallet_id?: string
          amount?: number
          balance_after?: number
          transaction_type?: string
          reference_id?: string | null
          description_ar?: string | null
          created_at?: string
          updated_at?: string
          proof_url?: string | null
          requested_amount?: number | null
        }
      }
      admin_penalties: {
        Row: {
          id: string
          target_user_id: string | null
          penalty_category: string
          penalty_amount: number | null
          is_account_suspended: boolean
          suspension_days: number | null
          official_reason: string | null
          wallet_tx_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          target_user_id?: string | null
          penalty_category: string
          penalty_amount?: number | null
          is_account_suspended?: boolean
          suspension_days?: number | null
          official_reason?: string | null
          wallet_tx_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: any[]
        Update: {
          id?: string
          target_user_id?: string | null
          penalty_category?: string
          penalty_amount?: number | null
          is_account_suspended?: boolean
          suspension_days?: number | null
          official_reason?: string | null
          wallet_tx_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      chat_rooms: {
        Row: {
          id: string
          order_id: string | null
          room_type: string
          participant_ids: Json | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_id?: string | null
          room_type: string
          participant_ids?: Json | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: any[]
        Update: {
          id?: string
          order_id?: string | null
          room_type?: string
          participant_ids?: Json | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      reviews: {
        Row: {
          id: string
          order_id: string | null
          vendor_rating: number | null
          driver_rating: number | null
          comment: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_id?: string | null
          vendor_rating?: number | null
          driver_rating?: number | null
          comment?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: any[]
        Update: {
          id?: string
          order_id?: string | null
          vendor_rating?: number | null
          driver_rating?: number | null
          comment?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      search_history: {
        Row: {
          id: string
          user_id: string | null
          search_query: string
          filters: Json | null
          result_count: number | null
          clicked_item_id: string | null
          clicked_item_type: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          search_query: string
          filters?: Json | null
          result_count?: number | null
          clicked_item_id?: string | null
          clicked_item_type?: string | null
          created_at?: string
        }
        Relationships: any[]
        Update: {
          id?: string
          user_id?: string | null
          search_query?: string
          filters?: Json | null
          result_count?: number | null
          clicked_item_id?: string | null
          clicked_item_type?: string | null
          created_at?: string
        }
      }
      chat_messages: {
        Row: {
          id: string
          room_id: string | null
          sender_id: string | null
          message_type: string
          message_content: string
          is_read: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          room_id?: string | null
          sender_id?: string | null
          message_type: string
          message_content: string
          is_read?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: any[]
        Update: {
          id?: string
          room_id?: string | null
          sender_id?: string | null
          message_type?: string
          message_content?: string
          is_read?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      sub_orders: {
        Row: {
          id: string
          master_order_id: string | null
          vendor_id: string | null
          sub_total: number
          sub_tax: number
          vendor_commission: number
          sub_status: string
          created_at: string
          updated_at: string
          preparation_time_override: number
        }
        Insert: {
          id?: string
          master_order_id?: string | null
          vendor_id?: string | null
          sub_total?: number
          sub_tax?: number
          vendor_commission?: number
          sub_status?: string
          created_at?: string
          updated_at?: string
          preparation_time_override?: number
        }
        Relationships: any[]
        Update: {
          id?: string
          master_order_id?: string | null
          vendor_id?: string | null
          sub_total?: number
          sub_tax?: number
          vendor_commission?: number
          sub_status?: string
          created_at?: string
          updated_at?: string
          preparation_time_override?: number
        }
      }
      order_delivery_team: {
        Row: {
          id: string
          driver_id: string | null
          is_lead: boolean
          delivery_share: number | null
          tip_share: number | null
          created_at: string
          updated_at: string
          master_order_id: string
        }
        Insert: {
          id?: string
          driver_id?: string | null
          is_lead?: boolean
          delivery_share?: number | null
          tip_share?: number | null
          created_at?: string
          updated_at?: string
          master_order_id: string
        }
        Relationships: any[]
        Update: {
          id?: string
          driver_id?: string | null
          is_lead?: boolean
          delivery_share?: number | null
          tip_share?: number | null
          created_at?: string
          updated_at?: string
          master_order_id?: string
        }
      }
      order_status_history: {
        Row: {
          id: string
          sub_order_id: string | null
          driver_id: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          sub_order_id?: string | null
          driver_id?: string | null
          status: string
          created_at?: string
          updated_at?: string
        }
        Relationships: any[]
        Update: {
          id?: string
          sub_order_id?: string | null
          driver_id?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      promotion_conditions: {
        Row: {
          id: string
          promotion_id: string
          condition_type: string
          operator: string
          value: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          promotion_id: string
          condition_type: string
          operator: string
          value: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: any[]
        Update: {
          id?: string
          promotion_id?: string
          condition_type?: string
          operator?: string
          value?: Json
          created_at?: string
          updated_at?: string
        }
      }
      promotion_rewards: {
        Row: {
          id: string
          promotion_id: string
          reward_type: string
          value: Json
          applies_to: string | null
          target_id: string | null
          max_quantity: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          promotion_id: string
          reward_type: string
          value: Json
          applies_to?: string | null
          target_id?: string | null
          max_quantity?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: any[]
        Update: {
          id?: string
          promotion_id?: string
          reward_type?: string
          value?: Json
          applies_to?: string | null
          target_id?: string | null
          max_quantity?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      promotion_time_slots: {
        Row: {
          id: string
          promotion_id: string
          day_of_week: number | null
          start_time: string | null
          end_time: string | null
          start_date: string | null
          end_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          promotion_id: string
          day_of_week?: number | null
          start_time?: string | null
          end_time?: string | null
          start_date?: string | null
          end_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: any[]
        Update: {
          id?: string
          promotion_id?: string
          day_of_week?: number | null
          start_time?: string | null
          end_time?: string | null
          start_date?: string | null
          end_date?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      promotion_exclusions: {
        Row: {
          id: string
          promotion_id: string
          entity_type: string
          entity_id: string
          created_at: string
        }
        Insert: {
          id?: string
          promotion_id: string
          entity_type: string
          entity_id: string
          created_at?: string
        }
        Relationships: any[]
        Update: {
          id?: string
          promotion_id?: string
          entity_type?: string
          entity_id?: string
          created_at?: string
        }
      }
      modifier_groups: {
        Row: {
          id: string
          vendor_id: string | null
          section_id: string | null
          product_id: string | null
          title_ar: string
          min_selection: number
          max_selection: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          vendor_id?: string | null
          section_id?: string | null
          product_id?: string | null
          title_ar: string
          min_selection?: number
          max_selection?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: any[]
        Update: {
          id?: string
          vendor_id?: string | null
          section_id?: string | null
          product_id?: string | null
          title_ar?: string
          min_selection?: number
          max_selection?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      modifier_options: {
        Row: {
          id: string
          group_id: string | null
          name_ar: string
          price: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          group_id?: string | null
          name_ar: string
          price?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: any[]
        Update: {
          id?: string
          group_id?: string | null
          name_ar?: string
          price?: number
          created_at?: string
          updated_at?: string
        }
      }
      promotion_usage: {
        Row: {
          id: string
          promotion_id: string | null
          user_id: string | null
          order_id: string | null
          discount_amount: number
          used_at: string
        }
        Insert: {
          id?: string
          promotion_id?: string | null
          user_id?: string | null
          order_id?: string | null
          discount_amount: number
          used_at?: string
        }
        Relationships: any[]
        Update: {
          id?: string
          promotion_id?: string | null
          user_id?: string | null
          order_id?: string | null
          discount_amount?: number
          used_at?: string
        }
      }
    }
  }
}
