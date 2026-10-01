-- ============================================================================
-- SECURITY HARDENING: RPC FUNCTIONS & EXECUTION PRIVILEGES
-- Enforces strict caller authentication, authorization, and tenant isolation
-- across all database procedures, preventing unauthorized viewing or modification
-- of another user's personal, financial, booking, and administrative data.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. REVOKE PUBLIC EXECUTE ON INTERNAL / WEBHOOK / SERVICE FUNCTIONS
-- ----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.process_payment_webhook(uuid, text, text, jsonb, boolean, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_payment_webhook(uuid, text, text, jsonb, boolean, timestamptz, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.process_payment_callback(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_payment_callback(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.activate_subscription(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_subscription(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.credit_lead_topup(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_lead_topup(uuid, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.record_webhook_attempt(uuid, text, text, jsonb, text, boolean, text, jsonb, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_webhook_attempt(uuid, text, text, jsonb, text, boolean, text, jsonb, text, text, text) TO service_role;


-- ----------------------------------------------------------------------------
-- 2. ADMIN-ONLY MANAGEMENT PROCEDURES
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_manage_route(
  p_action               text,
  p_id                   uuid DEFAULT NULL::uuid,
  p_name                 text DEFAULT NULL::text,
  p_origin_town_id       uuid DEFAULT NULL::uuid,
  p_destination_town_id  uuid DEFAULT NULL::uuid,
  p_distance_km          numeric DEFAULT NULL::numeric,
  p_duration_mins        integer DEFAULT NULL::integer,
  p_status               text DEFAULT 'active'::text,
  p_stops                jsonb DEFAULT '[]'::jsonb,
  p_overview_polyline    text DEFAULT NULL::text,
  p_bounding_box         jsonb DEFAULT NULL::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
  v_stop record;
  v_result jsonb;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Admin privileges required';
  END IF;

  IF p_action = 'create' THEN
    IF p_origin_town_id IS NULL OR p_destination_town_id IS NULL THEN
      RAISE EXCEPTION 'Origin and Destination towns are required';
    END IF;

    INSERT INTO routes (
      name, origin_town_id, destination_town_id, distance_km, estimated_duration_minutes, status, overview_polyline, bounding_box
    ) VALUES (
      trim(p_name), p_origin_town_id, p_destination_town_id, p_distance_km, p_duration_mins, coalesce(p_status, 'active'), p_overview_polyline, p_bounding_box
    ) RETURNING id INTO v_id;

  ELSIF p_action = 'update' THEN
    IF p_id IS NULL THEN
      RAISE EXCEPTION 'Route ID required for update';
    END IF;

    UPDATE routes
    SET name = coalesce(trim(p_name), name),
        origin_town_id = coalesce(p_origin_town_id, origin_town_id),
        destination_town_id = coalesce(p_destination_town_id, destination_town_id),
        distance_km = coalesce(p_distance_km, distance_km),
        estimated_duration_minutes = coalesce(p_duration_mins, estimated_duration_minutes),
        status = coalesce(p_status, status),
        overview_polyline = coalesce(p_overview_polyline, overview_polyline),
        bounding_box = coalesce(p_bounding_box, bounding_box),
        updated_at = now()
    WHERE id = p_id
    RETURNING id INTO v_id;

  ELSE
    RAISE EXCEPTION 'Unknown route action: %', p_action;
  END IF;

  IF jsonb_array_length(p_stops) > 0 THEN
    DELETE FROM route_stops WHERE route_id = v_id;

    FOR v_stop IN SELECT * FROM jsonb_to_recordset(p_stops) AS x(
      town_id uuid,
      pickup_point_id uuid,
      sequence integer,
      distance_from_origin_km numeric,
      estimated_minutes_from_origin integer,
      pickup_allowed boolean,
      dropoff_allowed boolean
    ) LOOP
      INSERT INTO route_stops (
        route_id, town_id, pickup_point_id, sequence,
        distance_from_origin_km, estimated_minutes_from_origin,
        pickup_allowed, dropoff_allowed
      ) VALUES (
        v_id, v_stop.town_id, v_stop.pickup_point_id, v_stop.sequence,
        v_stop.distance_from_origin_km, v_stop.estimated_minutes_from_origin,
        coalesce(v_stop.pickup_allowed, true), coalesce(v_stop.dropoff_allowed, true)
      );
    END LOOP;
  END IF;

  SELECT jsonb_build_object(
    'id', r.id,
    'name', r.name,
    'origin_town_id', r.origin_town_id,
    'destination_town_id', r.destination_town_id,
    'distance_km', r.distance_km,
    'estimated_duration_minutes', r.estimated_duration_minutes,
    'status', r.status,
    'overview_polyline', r.overview_polyline,
    'stops_count', (SELECT count(*)::integer FROM route_stops WHERE route_id = r.id)
  ) INTO v_result
  FROM routes r
  WHERE r.id = v_id;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_manage_town(
  p_action     text,
  p_id         uuid DEFAULT NULL::uuid,
  p_name       text DEFAULT NULL::text,
  p_region     text DEFAULT NULL::text,
  p_lat        numeric DEFAULT NULL::numeric,
  p_lng        numeric DEFAULT NULL::numeric,
  p_is_active  boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id UUID;
  v_result JSONB;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Admin privileges required';
  END IF;

  IF p_action = 'create' THEN
    IF p_name IS NULL OR trim(p_name) = '' THEN
      RAISE EXCEPTION 'Town name is required';
    END IF;

    INSERT INTO towns (name, region, lat, lng, is_active)
    VALUES (trim(p_name), trim(p_region), p_lat, p_lng, coalesce(p_is_active, true))
    RETURNING id INTO v_id;

  ELSIF p_action = 'update' THEN
    IF p_id IS NULL THEN
      RAISE EXCEPTION 'Town ID is required for update';
    END IF;

    UPDATE towns
    SET name = coalesce(trim(p_name), name),
        region = coalesce(trim(p_region), region),
        lat = coalesce(p_lat, lat),
        lng = coalesce(p_lng, lng),
        is_active = coalesce(p_is_active, is_active)
    WHERE id = p_id
    RETURNING id INTO v_id;

  ELSIF p_action = 'toggle_active' THEN
    UPDATE towns
    SET is_active = NOT is_active
    WHERE id = p_id
    RETURNING id INTO v_id;

  ELSE
    RAISE EXCEPTION 'Unknown town action: %', p_action;
  END IF;

  SELECT jsonb_build_object(
    'id', t.id,
    'name', t.name,
    'region', t.region,
    'lat', t.lat,
    'lng', t.lng,
    'is_active', t.is_active
  ) INTO v_result
  FROM towns t WHERE t.id = v_id;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_suspend_driver(
  p_driver_id uuid,
  p_reason text,
  p_admin_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin_id uuid;
  v_driver public.driver_profiles%ROWTYPE;
  v_cancelled_trips_count integer := 0;
  v_cancelled_bookings_count integer := 0;
  v_affected_trip record;
  v_booking record;
  v_log_id uuid;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Admin privileges required';
  END IF;

  v_admin_id := auth.uid();

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'SUSPENSION_REASON_REQUIRED';
  END IF;

  -- Freeze driver account
  UPDATE public.driver_profiles
  SET verification_status = 'suspended'::public.verification_status_enum,
      online_status = false,
      updated_at = now()
  WHERE id = p_driver_id
  RETURNING * INTO v_driver;

  IF v_driver.id IS NULL THEN
    RAISE EXCEPTION 'DRIVER_NOT_FOUND: %', p_driver_id;
  END IF;

  -- Find active/scheduled trips and cancel them
  FOR v_affected_trip IN
    SELECT id, route_id, departs_at
    FROM public.trips
    WHERE driver_id = p_driver_id
      AND status IN ('scheduled', 'boarding', 'in_progress')
  LOOP
    UPDATE public.trips
    SET status = 'cancelled',
        notes = coalesce(notes, '') || ' [Cancelled due to driver suspension: ' || trim(p_reason) || ']',
        updated_at = now()
    WHERE id = v_affected_trip.id;

    v_cancelled_trips_count := v_cancelled_trips_count + 1;

    -- Cancel all passenger bookings on this trip
    FOR v_booking IN
      SELECT b.id, b.passenger_id, b.booking_reference
      FROM public.bookings b
      WHERE b.trip_id = v_affected_trip.id
        AND b.status IN ('held', 'confirmed')
    LOOP
      UPDATE public.bookings
      SET status = 'cancelled',
          cancel_reason = 'Trip cancelled due to driver suspension: ' || trim(p_reason),
          cancelled_at = now()
      WHERE id = v_booking.id;

      v_cancelled_bookings_count := v_cancelled_bookings_count + 1;

      INSERT INTO public.notifications (user_id, channel, type, title, body, data)
      VALUES (
        v_booking.passenger_id,
        'in_app'::notification_channel_enum,
        'booking_cancelled_driver_suspended',
        'Important: Trip #' || coalesce(v_booking.booking_reference, '') || ' Cancelled',
        'Your scheduled trip has been cancelled due to driver unavailability. Please search and book another ride.',
        jsonb_build_object(
          'booking_id', v_booking.id,
          'booking_reference', v_booking.booking_reference,
          'trip_id', v_affected_trip.id,
          'reason', p_reason
        )
      );
    END LOOP;
  END LOOP;

  -- Insert audit log
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_admin_id,
    'driver_suspended',
    'driver',
    p_driver_id,
    jsonb_build_object(
      'reason', trim(p_reason),
      'cancelled_trips_count', v_cancelled_trips_count,
      'cancelled_bookings_count', v_cancelled_bookings_count,
      'admin_id', v_admin_id
    )
  ) RETURNING id INTO v_log_id;

  -- Notify the driver
  INSERT INTO public.notifications (user_id, channel, type, title, body, data)
  VALUES (
    v_driver.user_id,
    'in_app'::notification_channel_enum,
    'driver_suspended',
    'Your Driver Account Has Been Suspended',
    'Your driver account has been suspended by operations. Reason: ' || trim(p_reason) || '. Contact support for dispute resolution.',
    jsonb_build_object('reason', p_reason, 'driver_id', p_driver_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'driver_id', p_driver_id,
    'status', 'suspended',
    'reason', trim(p_reason),
    'cancelled_trips_count', v_cancelled_trips_count,
    'cancelled_bookings_count', v_cancelled_bookings_count,
    'audit_log_id', v_log_id,
    'suspended_at', now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_unsuspend_driver(
  p_driver_id uuid,
  p_notes text DEFAULT NULL::text,
  p_admin_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin_id uuid;
  v_driver public.driver_profiles%ROWTYPE;
  v_restored_trips_count integer := 0;
  v_log_id uuid;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Admin privileges required';
  END IF;

  v_admin_id := auth.uid();

  UPDATE public.driver_profiles
  SET verification_status = 'verified'::public.verification_status_enum,
      updated_at = now()
  WHERE id = p_driver_id
  RETURNING * INTO v_driver;

  IF v_driver.id IS NULL THEN
    RAISE EXCEPTION 'DRIVER_NOT_FOUND: %', p_driver_id;
  END IF;

  WITH restored AS (
    UPDATE public.trips
    SET status = 'scheduled',
        updated_at = now()
    WHERE driver_id = p_driver_id
      AND status = 'cancelled'
      AND departs_at > now()
    RETURNING id
  )
  SELECT count(*) INTO v_restored_trips_count FROM restored;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_admin_id,
    'driver_unsuspended',
    'driver',
    p_driver_id,
    jsonb_build_object(
      'notes', p_notes,
      'restored_trips_count', v_restored_trips_count,
      'admin_id', v_admin_id
    )
  ) RETURNING id INTO v_log_id;

  INSERT INTO public.notifications (user_id, channel, type, title, body, data)
  VALUES (
    v_driver.user_id,
    'in_app'::notification_channel_enum,
    'driver_unsuspended',
    'Account Reactivated',
    'Your driver account suspension has been lifted. You can now publish trips.',
    jsonb_build_object('driver_id', p_driver_id, 'notes', p_notes)
  );

  RETURN jsonb_build_object(
    'success', true,
    'driver_id', p_driver_id,
    'status', 'verified',
    'restored_trips_count', v_restored_trips_count,
    'audit_log_id', v_log_id,
    'notes', p_notes,
    'unsuspended_at', now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_verify_driver(
  p_driver_id uuid,
  p_status text,
  p_notes text DEFAULT NULL::text,
  p_admin_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin_id uuid;
  v_new_status public.verification_status_enum;
  v_driver public.driver_profiles%ROWTYPE;
  v_log_id uuid;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Admin privileges required';
  END IF;

  v_admin_id := auth.uid();

  IF p_status NOT IN ('verified', 'rejected', 'pending', 'suspended') THEN
    RAISE EXCEPTION 'INVALID_STATUS: %', p_status;
  END IF;

  v_new_status := p_status::public.verification_status_enum;

  UPDATE public.driver_profiles
  SET verification_status = v_new_status,
      updated_at = now()
  WHERE id = p_driver_id
  RETURNING * INTO v_driver;

  IF v_driver.id IS NULL THEN
    RAISE EXCEPTION 'DRIVER_NOT_FOUND: %', p_driver_id;
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_admin_id,
    'driver_status_' || p_status,
    'driver',
    p_driver_id,
    jsonb_build_object(
      'new_status', p_status,
      'notes', p_notes,
      'admin_id', v_admin_id
    )
  ) RETURNING id INTO v_log_id;

  INSERT INTO public.notifications (user_id, channel, type, title, body, data)
  VALUES (
    v_driver.user_id,
    'in_app'::notification_channel_enum,
    'driver_verification_update',
    CASE 
      WHEN p_status = 'verified' THEN 'Driver Account Verified!'
      WHEN p_status = 'rejected' THEN 'Driver Verification Rejected'
      ELSE 'Driver Verification Status Updated'
    END,
    coalesce(p_notes, 'Your driver verification status is now ' || p_status || '.'),
    jsonb_build_object('status', p_status, 'driver_id', p_driver_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'driver_id', v_driver.id,
    'verification_status', v_driver.verification_status,
    'audit_log_id', v_log_id,
    'notes', p_notes,
    'updated_at', v_driver.updated_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_verify_vehicle(
  p_vehicle_id uuid,
  p_status text,
  p_notes text DEFAULT NULL::text,
  p_admin_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin_id uuid;
  v_vehicle public.vehicles%ROWTYPE;
  v_log_id uuid;
  v_new_status public.vehicle_status_enum;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Admin privileges required';
  END IF;

  v_admin_id := auth.uid();

  IF p_status NOT IN ('active', 'maintenance', 'inactive', 'pending_verification', 'rejected') THEN
    RAISE EXCEPTION 'INVALID_VEHICLE_STATUS: %', p_status;
  END IF;

  v_new_status := p_status::public.vehicle_status_enum;

  UPDATE public.vehicles
  SET status = v_new_status,
      updated_at = now()
  WHERE id = p_vehicle_id
  RETURNING * INTO v_vehicle;

  IF v_vehicle.id IS NULL THEN
    RAISE EXCEPTION 'VEHICLE_NOT_FOUND: %', p_vehicle_id;
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_admin_id,
    'vehicle_status_' || p_status,
    'vehicle',
    p_vehicle_id,
    jsonb_build_object(
      'new_status', p_status,
      'notes', p_notes,
      'admin_id', v_admin_id
    )
  ) RETURNING id INTO v_log_id;

  RETURN jsonb_build_object(
    'success', true,
    'vehicle_id', v_vehicle.id,
    'status', v_vehicle.status,
    'audit_log_id', v_log_id,
    'notes', p_notes,
    'updated_at', v_vehicle.updated_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_incidents()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT is_admin() AND NOT is_support() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Operations staff privileges required';
  END IF;

  SELECT coalesce(jsonb_agg(item ORDER BY item.created_at DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT 
      i.id,
      i.kind,
      i.status,
      i.lat,
      i.lng,
      i.description,
      i.created_at,
      i.resolved_at,
      i.trip_id,
      i.booking_id,
      jsonb_build_object(
        'id', rep.id,
        'name', trim(coalesce(rep.first_name, '') || ' ' || coalesce(rep.last_name, '')),
        'phone', rep.phone
      ) AS reporter,
      CASE WHEN t.id IS NOT NULL THEN jsonb_build_object(
        'id', t.id,
        'status', t.status,
        'departs_at', t.departs_at,
        'route_name', r.name,
        'driver_name', trim(coalesce(du.first_name, '') || ' ' || coalesce(du.last_name, '')),
        'driver_phone', du.phone,
        'vehicle_plate', v.license_plate,
        'vehicle_model', v.make || ' ' || v.model
      ) ELSE NULL END AS trip,
      CASE WHEN b.id IS NOT NULL THEN jsonb_build_object(
        'reference', b.booking_reference,
        'seats', b.total_seats
      ) ELSE NULL END AS booking,
      CASE WHEN h.id IS NOT NULL THEN jsonb_build_object(
        'id', h.id,
        'name', trim(coalesce(h.first_name, '') || ' ' || coalesce(h.last_name, ''))
      ) ELSE NULL END AS handler
    FROM incidents i
    LEFT JOIN profiles rep ON rep.id = i.reported_by
    LEFT JOIN trips t ON t.id = i.trip_id
    LEFT JOIN routes r ON r.id = t.route_id
    LEFT JOIN driver_profiles dp ON dp.id = t.driver_id
    LEFT JOIN profiles du ON du.id = dp.user_id
    LEFT JOIN vehicles v ON v.id = t.vehicle_id
    LEFT JOIN bookings b ON b.id = i.booking_id
    LEFT JOIN profiles h ON h.id = i.handled_by
    ORDER BY i.created_at DESC
  ) item;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_support_tickets(
  p_status   text DEFAULT NULL::text,
  p_category text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT is_admin() AND NOT is_support() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Operations staff privileges required';
  END IF;

  SELECT coalesce(jsonb_agg(item ORDER BY item.updated_at DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT 
      st.id,
      st.user_id,
      st.subject,
      st.description,
      st.category,
      st.priority,
      st.status,
      st.assigned_to,
      st.trip_id,
      st.booking_id,
      st.created_at,
      st.updated_at,
      st.resolved_at,
      jsonb_build_object(
        'id', u.id,
        'name', trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')),
        'phone', u.phone,
        'email', u.email
      ) AS customer,
      CASE WHEN a.id IS NOT NULL THEN jsonb_build_object(
        'id', a.id,
        'name', trim(coalesce(a.first_name, '') || ' ' || coalesce(a.last_name, ''))
      ) ELSE NULL END AS assigned_agent,
      CASE WHEN b.id IS NOT NULL THEN jsonb_build_object(
        'id', b.id,
        'reference', b.booking_reference,
        'total_seats', b.total_seats,
        'total_fare_ugx', b.total_fare_ugx
      ) ELSE NULL END AS booking,
      CASE WHEN t.id IS NOT NULL THEN jsonb_build_object(
        'id', t.id,
        'status', t.status,
        'departs_at', t.departs_at,
        'route_name', r.name
      ) ELSE NULL END AS trip,
      (SELECT count(*)::integer FROM support_messages sm WHERE sm.ticket_id = st.id) AS messages_count,
      (SELECT sm.message FROM support_messages sm WHERE sm.ticket_id = st.id ORDER BY sm.created_at DESC LIMIT 1) AS last_message,
      (SELECT sm.created_at FROM support_messages sm WHERE sm.ticket_id = st.id ORDER BY sm.created_at DESC LIMIT 1) AS last_message_at
    FROM support_tickets st
    LEFT JOIN profiles u ON u.id = st.user_id
    LEFT JOIN profiles a ON a.id = st.assigned_to
    LEFT JOIN bookings b ON b.id = st.booking_id
    LEFT JOIN trips t ON t.id = st.trip_id
    LEFT JOIN routes r ON r.id = t.route_id
    WHERE (p_status IS NULL OR p_status = 'all' OR st.status = p_status)
      AND (p_category IS NULL OR p_category = 'all' OR st.category = p_category)
    ORDER BY st.updated_at DESC
  ) item;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_webhook_logs(p_limit integer DEFAULT 10)
RETURNS SETOF webhook_verification_log
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Admin privileges required';
  END IF;

  RETURN QUERY
  SELECT * FROM public.webhook_verification_log
  ORDER BY processed_at DESC
  LIMIT p_limit;
END;
$$;


-- ----------------------------------------------------------------------------
-- 3. USER DATA & NOTIFICATION RPCs
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_notifications(
  p_user_id uuid DEFAULT NULL::uuid,
  p_limit   integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_result JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  v_user_id := coalesce(p_user_id, auth.uid());
  IF v_user_id <> auth.uid() AND NOT is_admin() AND NOT is_support() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Cannot view notifications of another user';
  END IF;

  SELECT coalesce(jsonb_agg(n ORDER BY n.created_at DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT 
      id,
      user_id,
      channel,
      type,
      title,
      body,
      data,
      read_at,
      created_at
    FROM notifications
    WHERE user_id = v_user_id
    ORDER BY created_at DESC
    LIMIT coalesce(p_limit, 20)
  ) n;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_notification_by_id(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT to_jsonb(n) INTO v_result
  FROM notifications n
  WHERE n.id = p_id
    AND (n.user_id = auth.uid() OR is_admin() OR is_support());

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(p_user_id uuid DEFAULT NULL::uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  v_user_id := coalesce(p_user_id, auth.uid());
  IF v_user_id <> auth.uid() AND NOT is_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Cannot update notifications of another user';
  END IF;

  UPDATE notifications
  SET read_at = now()
  WHERE user_id = v_user_id AND read_at IS NULL;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  UPDATE notifications
  SET read_at = now()
  WHERE id = p_notification_id
    AND (user_id = auth.uid() OR is_admin());

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_emergency_contact_rpc(
  p_user_id      uuid,
  p_name         text,
  p_phone        text,
  p_relationship text DEFAULT 'Family'::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
  v_user_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  v_user_id := coalesce(p_user_id, auth.uid());
  IF v_user_id <> auth.uid() AND NOT is_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Cannot add emergency contacts for another user';
  END IF;

  INSERT INTO emergency_contacts (user_id, name, phone, relationship)
  VALUES (v_user_id, trim(p_name), trim(p_phone), coalesce(trim(p_relationship), 'Family'))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


-- ----------------------------------------------------------------------------
