-- ============================================================================
-- SECURITY HARDENING: RPC FUNCTIONS & EXECUTION PRIVILEGES
-- ============================================================================

-- 4. DRIVER SUBSCRIPTIONS, RADAR LEADS & PAYMENTS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_driver_payment_history(p_driver_id uuid)
RETURNS TABLE(
  payment_id    uuid,
  purpose       text,
  amount_ugx    integer,
  method        text,
  status        text,
  provider      text,
  provider_ref  text,
  plan_name     text,
  initiated_at  timestamp with time zone,
  completed_at  timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF p_driver_id <> current_driver_id() AND NOT is_admin() AND NOT is_support() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Cannot view payment history of another driver';
  END IF;

  RETURN QUERY
  SELECT
    p.id AS payment_id,
    p.purpose::text,
    p.amount_ugx,
    p.method::text,
    p.status::text,
    coalesce(p.provider, 'Mobile Money') AS provider,
    coalesce(p.provider_ref, p.id::text) AS provider_ref,
    coalesce(sp.name, 'Lead Top-up') AS plan_name,
    p.initiated_at,
    p.completed_at
  FROM payments p
  LEFT JOIN subscription_plans sp ON sp.id = p.plan_id
  WHERE p.driver_id = p_driver_id
  ORDER BY p.initiated_at DESC
  LIMIT 50;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_driver_subscription_summary(p_driver_id uuid)
RETURNS TABLE(
  subscription_id   uuid,
  plan_id           uuid,
  plan_name         text,
  price_ugx         integer,
  status            text,
  starts_at         timestamp with time zone,
  ends_at           timestamp with time zone,
  days_remaining    integer,
  trips_posted      integer,
  max_trips         integer,
  trips_remaining   integer,
  leads_viewed      integer,
  max_leads         integer,
  leads_remaining   integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sub record;
  v_trips_posted int := 0;
  v_leads_viewed int := 0;
  v_extra_trips int := 0;
  v_extra_leads int := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF p_driver_id <> current_driver_id() AND NOT is_admin() AND NOT is_support() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Cannot view subscription summary of another driver';
  END IF;

  SELECT
    ds.id AS sub_id,
    ds.plan_id,
    sp.name AS plan_name,
    sp.price_ugx,
    ds.status,
    ds.starts_at,
    ds.ends_at,
    sp.max_trips_per_period,
    sp.max_leads_per_period
  INTO v_sub
  FROM driver_subscriptions ds
  JOIN subscription_plans sp ON sp.id = ds.plan_id
  WHERE ds.driver_id = p_driver_id
    AND ds.status IN ('active', 'trialing', 'grace')
  ORDER BY ds.starts_at DESC LIMIT 1;

  IF v_sub.sub_id IS NULL THEN
    RETURN;
  END IF;

  SELECT
    coalesce(su.trips_posted, 0),
    coalesce(su.leads_viewed, 0),
    coalesce(su.extra_trips, 0),
    coalesce(su.extra_leads, 0)
  INTO v_trips_posted, v_leads_viewed, v_extra_trips, v_extra_leads
  FROM subscription_usage su
  WHERE su.driver_id = p_driver_id
    AND su.period_start = v_sub.starts_at::date;

  RETURN QUERY SELECT
    v_sub.sub_id AS subscription_id,
    v_sub.plan_id,
    v_sub.plan_name,
    v_sub.price_ugx,
    v_sub.status::text,
    v_sub.starts_at,
    v_sub.ends_at,
    greatest(0, extract(day FROM (v_sub.ends_at - now()))::int) AS days_remaining,
    coalesce(v_trips_posted, 0) AS trips_posted,
    v_sub.max_trips_per_period + coalesce(v_extra_trips, 0) AS max_trips,
    greatest(0, (v_sub.max_trips_per_period + coalesce(v_extra_trips, 0)) - coalesce(v_trips_posted, 0)) AS trips_remaining,
    coalesce(v_leads_viewed, 0) AS leads_viewed,
    v_sub.max_leads_per_period + coalesce(v_extra_leads, 0) AS max_leads,
    greatest(0, (v_sub.max_leads_per_period + coalesce(v_extra_leads, 0)) - coalesce(v_leads_viewed, 0)) AS leads_remaining;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_driver_radar_leads(p_driver_id uuid)
RETURNS TABLE(
  alert_id               uuid,
  passenger_id           uuid,
  origin_town_id         uuid,
  origin_town_name       text,
  destination_town_id    uuid,
  destination_town_name  text,
  travel_date            date,
  seats_needed           integer,
  created_at             timestamp with time zone,
  is_unlocked            boolean,
  passenger_name         text,
  passenger_phone        text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF p_driver_id <> current_driver_id() AND NOT is_admin() AND NOT is_support() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Cannot access radar leads for another driver';
  END IF;

  RETURN QUERY
  SELECT
    ta.id AS alert_id,
    ta.passenger_id,
    ta.origin_town_id,
    t1.name AS origin_town_name,
    ta.destination_town_id,
    t2.name AS destination_town_name,
    ta.travel_date,
    ta.seats_needed,
    ta.created_at,
    EXISTS(SELECT 1 FROM lead_views lv WHERE lv.driver_id = p_driver_id AND lv.trip_alert_id = ta.id) AS is_unlocked,
    CASE
      WHEN EXISTS(SELECT 1 FROM lead_views lv WHERE lv.driver_id = p_driver_id AND lv.trip_alert_id = ta.id)
        THEN coalesce(p.first_name || ' ' || p.last_name, 'Passenger')
      ELSE
        coalesce(left(p.first_name, 1) || '••• ' || left(p.last_name, 1) || '•••', 'Passenger Lead')
    END AS passenger_name,
    CASE
      WHEN EXISTS(SELECT 1 FROM lead_views lv WHERE lv.driver_id = p_driver_id AND lv.trip_alert_id = ta.id)
        THEN coalesce(p.phone, '')
      ELSE
        CASE
          WHEN p.phone IS NOT NULL AND length(p.phone) > 6
            THEN left(p.phone, 4) || ' ••• ••• ' || right(p.phone, 2)
          ELSE '+256 ••• ••• •••'
        END
    END AS passenger_phone
  FROM trip_alerts ta
  JOIN towns t1 ON t1.id = ta.origin_town_id
  JOIN towns t2 ON t2.id = ta.destination_town_id
  JOIN profiles p ON p.id = ta.passenger_id
  WHERE ta.status = 'open'
    AND ta.travel_date >= current_date
  ORDER BY ta.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.reveal_lead(p_driver_id uuid, p_trip_alert_id uuid)
RETURNS TABLE(passenger_phone text, passenger_name text, alert_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_period_start date;
  v_max_leads int;
  v_used int;
  v_extra int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF p_driver_id <> current_driver_id() AND NOT is_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Cannot unlock leads for another driver';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_driver_id::text || ':leads'));

  -- If already unlocked by this driver, return for free (idempotent)
  IF EXISTS (SELECT 1 FROM lead_views WHERE driver_id = p_driver_id AND trip_alert_id = p_trip_alert_id) THEN
    RETURN QUERY
      SELECT
        coalesce(p.phone, '') AS passenger_phone,
        coalesce(p.first_name || ' ' || p.last_name, 'Passenger') AS passenger_name,
        ta.id AS alert_id
      FROM trip_alerts ta
      JOIN profiles p ON p.id = ta.passenger_id
      WHERE ta.id = p_trip_alert_id;
    RETURN;
  END IF;

  SELECT ds.starts_at::date, sp.max_leads_per_period
    INTO v_period_start, v_max_leads
  FROM driver_subscriptions ds
  JOIN subscription_plans sp ON sp.id = ds.plan_id
  WHERE ds.driver_id = p_driver_id
    AND ds.status IN ('active','trialing','grace')
    AND (ds.ends_at >= now() OR ds.status = 'grace')
  ORDER BY ds.starts_at DESC LIMIT 1;

  IF v_max_leads IS NULL THEN
    RAISE EXCEPTION 'NO_ACTIVE_SUBSCRIPTION';
  END IF;

  INSERT INTO subscription_usage (driver_id, period_start, leads_viewed)
  VALUES (p_driver_id, v_period_start, 0)
  ON CONFLICT (driver_id, period_start) DO NOTHING;

  SELECT leads_viewed, extra_leads INTO v_used, v_extra
  FROM subscription_usage WHERE driver_id = p_driver_id AND period_start = v_period_start
  FOR UPDATE;

  IF v_used >= v_max_leads + coalesce(v_extra, 0) THEN
    RAISE EXCEPTION 'LEAD_LIMIT_REACHED';
  END IF;

  UPDATE subscription_usage SET leads_viewed = leads_viewed + 1
   WHERE driver_id = p_driver_id AND period_start = v_period_start;

  INSERT INTO lead_views (driver_id, trip_alert_id) VALUES (p_driver_id, p_trip_alert_id);

  RETURN QUERY
    SELECT
      coalesce(p.phone, '') AS passenger_phone,
      coalesce(p.first_name || ' ' || p.last_name, 'Passenger') AS passenger_name,
      ta.id AS alert_id
    FROM trip_alerts ta
    JOIN profiles p ON p.id = ta.passenger_id
    WHERE ta.id = p_trip_alert_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.initiate_momo_payment(
  p_driver_id     uuid,
  p_purpose       payment_purpose_enum,
  p_plan_id       uuid DEFAULT NULL::uuid,
  p_amount_ugx    integer DEFAULT NULL::integer,
  p_phone_number  text DEFAULT '+256700000000'::text,
  p_network       text DEFAULT 'MTN MoMo'::text,
  p_leads_count   integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_plan record;
  v_amount int;
  v_method payment_method_enum;
  v_ref text;
  v_payment_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF p_driver_id <> current_driver_id() AND NOT is_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Cannot initiate payment for another driver';
  END IF;

  -- Validate driver exists
  IF NOT EXISTS (SELECT 1 FROM driver_profiles WHERE id = p_driver_id) THEN
    RAISE EXCEPTION 'DRIVER_NOT_FOUND';
  END IF;

  IF lower(coalesce(p_network, '')) LIKE '%airtel%' THEN
    v_method := 'airtel';
  ELSE
    v_method := 'momo';
  END IF;

  IF p_purpose = 'subscription' THEN
    IF p_plan_id IS NULL THEN
      RAISE EXCEPTION 'PLAN_ID_REQUIRED_FOR_SUBSCRIPTION';
    END IF;
    SELECT * INTO v_plan FROM subscription_plans WHERE id = p_plan_id;
    IF v_plan.id IS NULL THEN
      RAISE EXCEPTION 'PLAN_NOT_FOUND';
    END IF;
    v_amount := v_plan.price_ugx;
  ELSE
    v_amount := coalesce(p_amount_ugx, 10000);
  END IF;

  v_ref := 'WALA-' || upper(v_method::text) || '-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  INSERT INTO payments (
    driver_id,
    plan_id,
    purpose,
    amount_ugx,
    method,
    status,
    provider,
    provider_ref,
    idempotency_key,
    applied,
    raw_callback
  ) VALUES (
    p_driver_id,
    p_plan_id,
    p_purpose,
    v_amount,
    v_method,
    'pending',
    p_network,
    v_ref,
    v_ref,
    false,
    jsonb_build_object(
      'phone_number', p_phone_number,
      'leads_count', p_leads_count,
      'initiated_from', 'web'
    )
  ) RETURNING id INTO v_payment_id;

  RETURN jsonb_build_object(
    'payment_id', v_payment_id,
    'provider_ref', v_ref,
    'amount_ugx', v_amount,
    'method', v_method,
    'status', 'pending',
    'phone_number', p_phone_number,
    'network', p_network,
    'instructions', 'USSD push prompt sent to ' || p_phone_number || '. Enter your Mobile Money PIN on your phone to complete payment.'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.simulate_subscription_payment(
  p_driver_id     uuid,
  p_plan_id       uuid,
  p_phone_number  text DEFAULT '+256700000000'::text,
  p_network       text DEFAULT 'MTN MoMo'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_plan record;
  v_payment_id uuid;
  v_method payment_method_enum;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF p_driver_id <> current_driver_id() AND NOT is_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Cannot simulate payment for another driver';
  END IF;

  SELECT * INTO v_plan FROM subscription_plans WHERE id = p_plan_id;
  IF v_plan.id IS NULL THEN
    RAISE EXCEPTION 'PLAN_NOT_FOUND';
  END IF;

  IF lower(coalesce(p_network, '')) LIKE '%airtel%' THEN
    v_method := 'airtel';
  ELSE
    v_method := 'momo';
  END IF;

  INSERT INTO payments (
    driver_id,
    plan_id,
    purpose,
    amount_ugx,
    method,
    status,
    provider,
    provider_ref,
    applied,
    completed_at
  ) VALUES (
    p_driver_id,
    p_plan_id,
    'subscription',
    v_plan.price_ugx,
    v_method,
    'successful',
    p_network,
    'SIM_' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
    false,
    now()
  ) RETURNING id INTO v_payment_id;

  PERFORM activate_subscription(v_payment_id);

  RETURN jsonb_build_object(
    'payment_id', v_payment_id,
    'status', 'successful',
    'plan_name', v_plan.name,
    'amount_ugx', v_plan.price_ugx,
    'network', p_network
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.simulate_lead_topup(
  p_driver_id    uuid,
  p_leads_count  integer DEFAULT 10,
  p_amount_ugx   integer DEFAULT 10000,
  p_network      text DEFAULT 'MTN MoMo'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_payment_id uuid;
  v_method payment_method_enum;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF p_driver_id <> current_driver_id() AND NOT is_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Cannot simulate topup for another driver';
  END IF;

  IF lower(coalesce(p_network, '')) LIKE '%airtel%' THEN
    v_method := 'airtel';
  ELSE
    v_method := 'momo';
  END IF;

  INSERT INTO payments (
    driver_id,
    purpose,
    amount_ugx,
    method,
    status,
    provider,
    provider_ref,
    applied,
    completed_at
  ) VALUES (
    p_driver_id,
    'lead_topup',
    p_amount_ugx,
    v_method,
    'successful',
    p_network,
    'SIM_LEAD_' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
    false,
    now()
  ) RETURNING id INTO v_payment_id;

  PERFORM credit_lead_topup(v_payment_id, p_leads_count);

  RETURN jsonb_build_object(
    'payment_id', v_payment_id,
    'status', 'successful',
    'leads_added', p_leads_count,
    'amount_ugx', p_amount_ugx
  );
END;
$$;


-- ----------------------------------------------------------------------------
-- 5. SUPPORT TICKETS & MESSAGING RPCs
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_ticket_details(p_ticket_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ticket JSONB;
  v_messages JSONB;
  v_user_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT st.user_id INTO v_user_id
  FROM support_tickets st
  WHERE st.id = p_ticket_id;

  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_user_id <> auth.uid() AND NOT is_admin() AND NOT is_support() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Cannot view support tickets of another user';
  END IF;

  SELECT jsonb_build_object(
    'id', st.id,
    'user_id', st.user_id,
    'subject', st.subject,
    'description', st.description,
    'category', st.category,
    'priority', st.priority,
    'status', st.status,
    'assigned_to', st.assigned_to,
    'trip_id', st.trip_id,
    'booking_id', st.booking_id,
    'created_at', st.created_at,
    'updated_at', st.updated_at,
    'resolved_at', st.resolved_at,
    'customer', jsonb_build_object(
      'id', u.id,
      'name', trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')),
      'phone', u.phone,
      'email', u.email
    ),
    'assigned_agent', CASE WHEN a.id IS NOT NULL THEN jsonb_build_object(
      'id', a.id,
      'name', trim(coalesce(a.first_name, '') || ' ' || coalesce(a.last_name, ''))
    ) ELSE NULL END,
    'booking', CASE WHEN b.id IS NOT NULL THEN jsonb_build_object(
      'id', b.id,
      'reference', b.booking_reference,
      'total_seats', b.total_seats,
      'status', b.status
    ) ELSE NULL END,
    'trip', CASE WHEN t.id IS NOT NULL THEN jsonb_build_object(
      'id', t.id,
      'status', t.status,
      'departs_at', t.departs_at,
      'route_name', r.name
    ) ELSE NULL END
  ) INTO v_ticket
  FROM support_tickets st
  LEFT JOIN profiles u ON u.id = st.user_id
  LEFT JOIN profiles a ON a.id = st.assigned_to
  LEFT JOIN bookings b ON b.id = st.booking_id
  LEFT JOIN trips t ON t.id = st.trip_id
  LEFT JOIN routes r ON r.id = t.route_id
  WHERE st.id = p_ticket_id;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', sm.id,
      'ticket_id', sm.ticket_id,
      'sender_id', sm.sender_id,
      'message', sm.message,
      'attachment_url', sm.attachment_url,
      'created_at', sm.created_at,
      'sender_name', trim(coalesce(sp.first_name, '') || ' ' || coalesce(sp.last_name, '')),
      'is_staff', EXISTS (
        SELECT 1 FROM user_roles ur WHERE ur.user_id = sm.sender_id AND ur.role IN ('admin', 'support_agent')
      )
    ) ORDER BY sm.created_at ASC
  ), '[]'::jsonb) INTO v_messages
  FROM support_messages sm
  LEFT JOIN profiles sp ON sp.id = sm.sender_id
  WHERE sm.ticket_id = p_ticket_id;

  RETURN jsonb_build_object(
    'ticket', v_ticket,
    'messages', v_messages
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_support_ticket(
  p_subject      text,
  p_description  text,
  p_category     text DEFAULT 'general'::text,
  p_priority     text DEFAULT 'normal'::text,
  p_trip_id      uuid DEFAULT NULL::uuid,
  p_booking_id   uuid DEFAULT NULL::uuid,
  p_user_id      uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_ticket_id UUID;
  v_result JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  v_user_id := coalesce(p_user_id, auth.uid());
  IF v_user_id <> auth.uid() AND NOT is_admin() AND NOT is_support() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Cannot create ticket for another user';
  END IF;

  IF p_subject IS NULL OR trim(p_subject) = '' THEN
    RAISE EXCEPTION 'Ticket subject is required';
  END IF;

  INSERT INTO support_tickets (
    user_id, subject, description, category, priority, trip_id, booking_id, status
  ) VALUES (
    v_user_id, trim(p_subject), p_description, coalesce(p_category, 'general'), coalesce(p_priority, 'normal'), p_trip_id, p_booking_id, 'open'
  ) RETURNING id INTO v_ticket_id;

  IF p_description IS NOT NULL AND trim(p_description) <> '' THEN
    INSERT INTO support_messages (ticket_id, sender_id, message)
    VALUES (v_ticket_id, v_user_id, trim(p_description));
  END IF;

  INSERT INTO notifications (user_id, channel, type, title, body, data)
  SELECT 
    ur.user_id, 
    'in_app'::notification_channel_enum, 
    'ticket_opened',
    'New Support Ticket: ' || trim(p_subject),
    coalesce(substring(p_description FROM 1 FOR 120), 'A new passenger support ticket was created.'),
    jsonb_build_object('ticket_id', v_ticket_id, 'category', p_category, 'priority', p_priority)
  FROM user_roles ur
  WHERE ur.role IN ('admin', 'support_agent')
  ON CONFLICT DO NOTHING;

  SELECT jsonb_build_object(
    'ticket_id', st.id,
    'subject', st.subject,
    'status', st.status,
    'category', st.category,
    'priority', st.priority,
    'created_at', st.created_at
  ) INTO v_result
  FROM support_tickets st
  WHERE st.id = v_ticket_id;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_ticket_reply(
  p_ticket_id      uuid,
  p_message        text,
  p_sender_id      uuid DEFAULT NULL::uuid,
  p_attachment_url text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sender_id UUID;
  v_msg_id UUID;
  v_is_staff BOOLEAN;
  v_customer_id UUID;
  v_subject TEXT;
  v_sender_name TEXT;
  v_result JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  v_sender_id := auth.uid();

  IF p_message IS NULL OR trim(p_message) = '' THEN
    RAISE EXCEPTION 'Message content cannot be empty';
  END IF;

  SELECT user_id, subject INTO v_customer_id, v_subject
  FROM support_tickets WHERE id = p_ticket_id;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Ticket % not found', p_ticket_id;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = v_sender_id AND role IN ('admin', 'support_agent')
  ) INTO v_is_staff;

  IF NOT v_is_staff AND v_sender_id <> v_customer_id THEN
    RAISE EXCEPTION 'UNAUTHORIZED: You can only reply to your own support tickets';
  END IF;

  INSERT INTO support_messages (ticket_id, sender_id, message, attachment_url)
  VALUES (p_ticket_id, v_sender_id, trim(p_message), p_attachment_url)
  RETURNING id INTO v_msg_id;

  SELECT trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')) INTO v_sender_name
  FROM profiles WHERE id = v_sender_id;

  IF v_is_staff THEN
    UPDATE support_tickets
    SET status = CASE WHEN status = 'open' THEN 'in_progress' ELSE status END,
        updated_at = now()
    WHERE id = p_ticket_id;

    INSERT INTO notifications (user_id, channel, type, title, body, data)
    VALUES (
      v_customer_id,
      'in_app'::notification_channel_enum,
      'support_reply',
      'Support replied to "' || coalesce(v_subject, 'Ticket') || '"',
      substring(p_message FROM 1 FOR 140),
      jsonb_build_object('ticket_id', p_ticket_id, 'sender_name', v_sender_name)
    );
  ELSE
    UPDATE support_tickets
    SET status = CASE WHEN status IN ('resolved', 'waiting_on_user') THEN 'open' ELSE status END,
        updated_at = now()
    WHERE id = p_ticket_id;

    INSERT INTO notifications (user_id, channel, type, title, body, data)
    SELECT 
      ur.user_id,
      'in_app'::notification_channel_enum,
      'ticket_reply',
      'Customer replied on "' || coalesce(v_subject, 'Ticket') || '"',
      substring(p_message FROM 1 FOR 140),
      jsonb_build_object('ticket_id', p_ticket_id, 'sender_name', v_sender_name)
    FROM user_roles ur
    WHERE ur.role IN ('admin', 'support_agent')
    LIMIT 3;
  END IF;

  SELECT jsonb_build_object(
    'id', sm.id,
    'ticket_id', sm.ticket_id,
    'sender_id', sm.sender_id,
    'message', sm.message,
    'attachment_url', sm.attachment_url,
    'created_at', sm.created_at,
    'sender_name', v_sender_name,
    'is_staff', v_is_staff
  ) INTO v_result
  FROM support_messages sm
  WHERE sm.id = v_msg_id;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_ticket_status_rpc(
  p_ticket_id       uuid,
  p_status          text,
  p_assigned_to     uuid DEFAULT NULL::uuid,
  p_resolution_note text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_customer_id UUID;
  v_subject TEXT;
  v_updater_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  v_updater_id := auth.uid();

  SELECT user_id, subject INTO v_customer_id, v_subject
  FROM support_tickets WHERE id = p_ticket_id;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Ticket % not found', p_ticket_id;
  END IF;

  IF NOT is_admin() AND NOT is_support() AND (v_customer_id <> v_updater_id OR p_status NOT IN ('closed', 'cancelled')) THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Only staff or ticket owner (close/cancel) can update status';
  END IF;

  UPDATE support_tickets
  SET status = p_status,
      assigned_to = coalesce(p_assigned_to, assigned_to),
      resolved_at = CASE WHEN p_status IN ('resolved', 'closed') THEN now() ELSE NULL END,
      updated_at = now()
  WHERE id = p_ticket_id;

  IF p_resolution_note IS NOT NULL AND trim(p_resolution_note) <> '' THEN
    INSERT INTO support_messages (ticket_id, sender_id, message)
    VALUES (p_ticket_id, v_updater_id, 'Status changed to ' || p_status || ': ' || trim(p_resolution_note));
  END IF;

  IF p_status IN ('resolved', 'closed') AND v_customer_id <> v_updater_id THEN
    INSERT INTO notifications (user_id, channel, type, title, body, data)
    VALUES (
      v_customer_id,
      'in_app'::notification_channel_enum,
      'ticket_resolved',
      'Ticket Resolved: ' || coalesce(v_subject, 'Your Support Request'),
      'Your support ticket has been marked as resolved by our operations team.',
      jsonb_build_object('ticket_id', p_ticket_id, 'status', p_status)
    );
  END IF;

  RETURN jsonb_build_object(
    'ticket_id', p_ticket_id,
    'status', p_status,
    'updated_at', now()
  );
END;
$$;


-- ----------------------------------------------------------------------------
