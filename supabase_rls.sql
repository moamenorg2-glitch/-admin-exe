-- ===============================================================
-- Zajel Express - Supabase RLS Security Policies
-- ===============================================================

-- 1. Helper Function: Check if user is Admin (Using the signature and logic you provided)
CREATE OR REPLACE FUNCTION is_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_user_id AND user_type = 'admin');
$$;

-- Parameterless version for RLS convenience
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN is_admin(auth.uid()) OR (auth.jwt() ->> 'email' = 'moamen.org2@gmail.com');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Audit Logging Trigger Function
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
  old_data jsonb := null;
  new_data jsonb := null;
  rec_id uuid;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    old_data := to_jsonb(OLD);
    IF (OLD ? 'user_id') THEN rec_id := (OLD->>'user_id')::uuid;
    ELSIF (OLD ? 'id') THEN rec_id := (OLD->>'id')::uuid;
    END IF;
  ELSIF (TG_OP = 'INSERT') THEN
    new_data := to_jsonb(NEW);
    IF (NEW ? 'user_id') THEN rec_id := (NEW->>'user_id')::uuid;
    ELSIF (NEW ? 'id') THEN rec_id := (NEW->>'id')::uuid;
    END IF;
  ELSE
    old_data := to_jsonb(OLD);
    new_data := to_jsonb(NEW);
    IF (NEW ? 'user_id') THEN rec_id := (NEW->>'user_id')::uuid;
    ELSIF (NEW ? 'id') THEN rec_id := (NEW->>'id')::uuid;
    END IF;
  END IF;

  INSERT INTO public.audit_logs (
    admin_id,
    action_type,
    table_name,
    record_id,
    old_value,
    new_value
  ) VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    rec_id,
    old_data,
    new_data
  );
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply triggers to tables
DROP TRIGGER IF EXISTS audit_profiles_trigger ON public.profiles;
CREATE TRIGGER audit_profiles_trigger AFTER INSERT OR UPDATE OR DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_orders_trigger ON public.master_orders;
CREATE TRIGGER audit_orders_trigger AFTER INSERT OR UPDATE OR DELETE ON public.master_orders FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_vendors_trigger ON public.vendor_details;
CREATE TRIGGER audit_vendors_trigger AFTER INSERT OR UPDATE OR DELETE ON public.vendor_details FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_drivers_trigger ON public.driver_details;
CREATE TRIGGER audit_drivers_trigger AFTER INSERT OR UPDATE OR DELETE ON public.driver_details FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_wallets_trigger ON public.wallets;
CREATE TRIGGER audit_wallets_trigger AFTER INSERT OR UPDATE OR DELETE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- 2. Helper Function: Check if user is Driver
CREATE OR REPLACE FUNCTION public.is_driver()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND user_type = 'driver'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Helper Function: Check if user is Vendor
CREATE OR REPLACE FUNCTION public.is_vendor()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND user_type = 'vendor'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===============================================================
-- Table: profiles
-- ===============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "Admins can manage all profiles"
ON public.profiles FOR ALL
USING (is_admin());

-- ===============================================================
-- Table: master_orders
-- ===============================================================
ALTER TABLE public.master_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view their own orders"
ON public.master_orders FOR SELECT
USING (auth.uid() = customer_id OR is_admin());

CREATE POLICY "Admins can manage all orders"
ON public.master_orders FOR ALL
USING (is_admin());

-- ===============================================================
-- Table: sub_orders
-- ===============================================================
ALTER TABLE public.sub_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors can view their own sub-orders"
ON public.sub_orders FOR SELECT
USING (auth.uid() = vendor_id OR is_admin());

CREATE POLICY "Admins can manage all sub-orders"
ON public.sub_orders FOR ALL
USING (is_admin());

-- ===============================================================
-- Table: driver_details
-- ===============================================================
ALTER TABLE public.driver_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers can view their own details"
ON public.driver_details FOR SELECT
USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "Admins can manage all driver details"
ON public.driver_details FOR ALL
USING (is_admin());

-- ===============================================================
-- Table: vendor_details
-- ===============================================================
ALTER TABLE public.vendor_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view vendor details"
ON public.vendor_details FOR SELECT
USING (true);

CREATE POLICY "Vendors can update their own details"
ON public.vendor_details FOR UPDATE
USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "Admins can manage all vendor details"
ON public.vendor_details FOR ALL
USING (is_admin());

-- ===============================================================
-- Table: wallets
-- ===============================================================
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own wallet"
ON public.wallets FOR SELECT
USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "Admins can manage all wallets"
ON public.wallets FOR ALL
USING (is_admin());

-- ===============================================================
-- Table: audit_logs
-- ===============================================================
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view audit logs"
ON public.audit_logs FOR SELECT
USING (is_admin());

CREATE POLICY "System can insert audit logs"
ON public.audit_logs FOR INSERT
WITH CHECK (true); -- Allow system-wide logging

-- ===============================================================
-- Table: system_settings
-- ===============================================================
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view system settings"
ON public.system_settings FOR SELECT
USING (true);

CREATE POLICY "Only admins can manage system settings"
ON public.system_settings FOR ALL
USING (is_admin());

-- ===============================================================
-- Table: zones & cities
-- ===============================================================
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view zones" ON public.zones FOR SELECT USING (true);
CREATE POLICY "Admins can manage zones" ON public.zones FOR ALL USING (is_admin());

CREATE POLICY "Public can view cities" ON public.cities FOR SELECT USING (true);
CREATE POLICY "Admins can manage cities" ON public.cities FOR ALL USING (is_admin());

-- ===============================================================
-- Table: chat_rooms & chat_messages
-- ===============================================================
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all chat rooms"
ON public.chat_rooms FOR ALL
USING (is_admin());

CREATE POLICY "Admins can manage all chat messages"
ON public.chat_messages FOR ALL
USING (is_admin());

CREATE POLICY "Users can view their own chat rooms"
ON public.chat_rooms FOR SELECT
USING (
  auth.uid()::text = ANY(ARRAY(SELECT jsonb_array_elements_text(participant_ids)))
  OR is_admin()
);

CREATE POLICY "Users can view messages in their rooms"
ON public.chat_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chat_rooms
    WHERE id = room_id
    AND (auth.uid()::text = ANY(ARRAY(SELECT jsonb_array_elements_text(participant_ids))) OR is_admin())
  )
);

CREATE POLICY "Users can insert messages in their rooms"
ON public.chat_messages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chat_rooms
    WHERE id = room_id
    AND (auth.uid()::text = ANY(ARRAY(SELECT jsonb_array_elements_text(participant_ids))) OR is_admin())
  )
  AND auth.uid() = sender_id
);

-- ===============================================================
-- Table: order_delivery_team
-- ===============================================================
ALTER TABLE public.order_delivery_team ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all delivery team entries"
ON public.order_delivery_team FOR ALL
USING (is_admin());

CREATE POLICY "Drivers can view their own delivery team entries"
ON public.order_delivery_team FOR SELECT
USING (driver_id = auth.uid() OR is_admin());

-- ===============================================================
-- Table: order_status_history
-- ===============================================================
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all order status history"
ON public.order_status_history FOR ALL
USING (is_admin());

CREATE POLICY "Users can view their own order status history"
ON public.order_status_history FOR SELECT
USING (
  is_admin() OR
  EXISTS (
    SELECT 1 FROM public.sub_orders so
    JOIN public.master_orders mo ON so.master_order_id = mo.id
    WHERE so.id = sub_order_id
    AND (mo.customer_id = auth.uid() OR so.vendor_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.order_delivery_team dt
      WHERE dt.master_order_id = mo.id AND dt.driver_id = auth.uid()
    ))
  )
);

-- ===============================================================
-- Table: notifications
-- ===============================================================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "Users can delete their own notifications"
ON public.notifications FOR DELETE
USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "Admins can manage all notifications"
ON public.notifications FOR ALL
USING (is_admin());

-- NOTE: This is a partial list. Apply similar logic to other tables:
-- products, menu_sections, chat_messages, support_tickets, etc.
-- Always ensure is_admin() has full access.
