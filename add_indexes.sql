-- ==============================================================================
-- Zajel Express - Comprehensive Database Performance Optimization (Indexes)
-- ==============================================================================
-- قم بتشغيل هذا السكربت بالكامل في شاشة SQL Editor داخل لوحة البدأ لـ Supabase
-- لتسريع النظام بالكامل للمسؤولين، السائقين، المتاجر، والعملاء.
-- ==============================================================================

-- -------------------------------------------------------------
-- 1. Profiles (المستخدمين)
-- -------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_user_type ON public.profiles (user_type);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles (status);
CREATE INDEX IF NOT EXISTS idx_profiles_primary_phone ON public.profiles (primary_phone);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (email);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles (created_at DESC);

-- -------------------------------------------------------------
-- 2. Master Orders (الطلبات الرئيسية)
-- -------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_master_orders_customer_id ON public.master_orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_master_orders_status ON public.master_orders (status);
CREATE INDEX IF NOT EXISTS idx_master_orders_payment_status ON public.master_orders (payment_status);
CREATE INDEX IF NOT EXISTS idx_master_orders_created_at ON public.master_orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_master_orders_order_number ON public.master_orders (order_number);

-- -------------------------------------------------------------
-- 3. Sub Orders (شحنات المتاجر في الطلب الرئيسي)
-- -------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_sub_orders_master_order_id ON public.sub_orders (master_order_id);
CREATE INDEX IF NOT EXISTS idx_sub_orders_vendor_id ON public.sub_orders (vendor_id);
CREATE INDEX IF NOT EXISTS idx_sub_orders_sub_status ON public.sub_orders (sub_status);

-- -------------------------------------------------------------
-- 4. Driver Details & Assignments (السائقين والتسليمات)
-- -------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_driver_details_zone_id ON public.driver_details (zone_id);
CREATE INDEX IF NOT EXISTS idx_driver_details_availability ON public.driver_details (is_online, is_busy);
-- order_delivery_team
CREATE INDEX IF NOT EXISTS idx_order_delivery_team_master_order_id ON public.order_delivery_team (master_order_id);
CREATE INDEX IF NOT EXISTS idx_order_delivery_team_driver_id ON public.order_delivery_team (driver_id);

-- -------------------------------------------------------------
-- 5. Vendor Details, Products, Categories (المتاجر والمنتجات)
-- -------------------------------------------------------------
-- vendor_details
CREATE INDEX IF NOT EXISTS idx_vendor_details_zone_id ON public.vendor_details (zone_id);
CREATE INDEX IF NOT EXISTS idx_vendor_details_category_id ON public.vendor_details (category_id);
CREATE INDEX IF NOT EXISTS idx_vendor_details_is_open ON public.vendor_details (is_open);
-- products
CREATE INDEX IF NOT EXISTS idx_products_vendor_id ON public.products (vendor_id);
CREATE INDEX IF NOT EXISTS idx_products_section_id ON public.products (section_id); -- For menu sections
CREATE INDEX IF NOT EXISTS idx_products_is_available ON public.products (is_available);
-- menu_sections
CREATE INDEX IF NOT EXISTS idx_menu_sections_vendor_id ON public.menu_sections (vendor_id);

-- -------------------------------------------------------------
-- 6. Customer Details (عناوين العملاء)
-- -------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_customer_details_user_id ON public.customer_details (user_id);
CREATE INDEX IF NOT EXISTS idx_customer_details_phone ON public.customer_details (phone);

-- -------------------------------------------------------------
-- 7. Wallets & Transactions (المحافظ والعمليات المالية)
-- -------------------------------------------------------------
-- wallets
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON public.wallets (user_id);
-- wallets_transaction
CREATE INDEX IF NOT EXISTS idx_wallets_transaction_wallet_id ON public.wallets_transaction (wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallets_transaction_transaction_type ON public.wallets_transaction (transaction_type);
CREATE INDEX IF NOT EXISTS idx_wallets_transaction_created_at ON public.wallets_transaction (created_at DESC);

-- -------------------------------------------------------------
-- 8. Customer Support & Disputes (الدعم الفني والنزاعات)
-- -------------------------------------------------------------
-- support_tickets
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON public.support_tickets (user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_order_id ON public.support_tickets (order_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets (status);
-- dispute_resolution
CREATE INDEX IF NOT EXISTS idx_dispute_resolution_ticket_id ON public.dispute_resolution (ticket_id);
CREATE INDEX IF NOT EXISTS idx_dispute_resolution_order_id ON public.dispute_resolution (order_id);
CREATE INDEX IF NOT EXISTS idx_dispute_resolution_status ON public.dispute_resolution (status);

-- -------------------------------------------------------------
-- 9. Chat (الدردشات الفورية)
-- -------------------------------------------------------------
-- chat_rooms
CREATE INDEX IF NOT EXISTS idx_chat_rooms_order_id ON public.chat_rooms (order_id);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_room_type ON public.chat_rooms (room_type);
-- chat_messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id ON public.chat_messages (room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id ON public.chat_messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages (created_at DESC);

-- -------------------------------------------------------------
-- 10. Audit Logs & System (سجل الحركات والإشعارات)
-- -------------------------------------------------------------
-- audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id ON public.audit_logs (record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON public.audit_logs (action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON public.audit_logs (table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
-- notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications (is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications (created_at DESC);

-- -------------------------------------------------------------
-- 11. Promotions (العروض والخصومات)
-- -------------------------------------------------------------
-- promotions
CREATE INDEX IF NOT EXISTS idx_promotions_date_range ON public.promotions (start_date, end_date);
-- promotion_usage
CREATE INDEX IF NOT EXISTS idx_promotion_usage_promo_id ON public.promotion_usage (promotion_id);
CREATE INDEX IF NOT EXISTS idx_promotion_usage_user_id ON public.promotion_usage (user_id);

-- -------------------------------------------------------------
-- 12. Reviews (التقييمات)
-- -------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_reviews_order_id ON public.reviews (order_id);

