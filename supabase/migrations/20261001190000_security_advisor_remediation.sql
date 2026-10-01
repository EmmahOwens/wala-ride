-- ============================================================================
-- MIGRATION: 20261001190000_security_advisor_remediation.sql
-- Remediates Supabase Security Advisor notices:
-- 1. Security Definer Views -> security_invoker = true
-- 2. Mutable search paths on functions
-- 3. Anonymous execution of internal triggers & service procedures
-- 4. Over-privileged SECURITY DEFINER helpers converted to SECURITY INVOKER
-- 5. Service-role & Admin contextual execution guards on authenticated RPCs
-- ============================================================================

-- 1. FIX SECURITY DEFINER VIEWS
ALTER VIEW public.push_subscriptions SET (security_invoker = true);
ALTER VIEW public.v_payment_webhook_audit SET (security_invoker = true);

-- 2. FIX FUNCTION SEARCH PATHS
ALTER FUNCTION public.calculate_straight_line_distance_km(numeric, numeric, numeric, numeric) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.make_geog_point(numeric, numeric) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.sync_geog_column() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.sync_vehicle_columns() SET search_path = public, pg_temp;

-- 3. REVOKE DEFAULT PRIVILEGES ON FUNCTIONS FROM PUBLIC & ANON
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;

-- Revoke execute on internal trigger functions
REVOKE EXECUTE ON FUNCTION public.enforce_trip_quota() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_trial_subscription_on_driver_created() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_driver_total_trips() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_driver_rating_average() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_geog_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_vehicle_columns() FROM PUBLIC, anon, authenticated;

-- Revoke execute on service role / worker cron functions from public and regular users
REVOKE EXECUTE ON FUNCTION public.check_subscription_expiry() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.dispatch_booking_confirmation_sms() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.dispatch_trip_departure_reminder_sms() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.escalate_unacknowledged_sos_incidents() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_stale_holds() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_pending_notifications(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prune_stale_trip_locations(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_notification_status(uuid, text, text, text, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.write_audit_log(uuid, text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_sample_booking_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_payment_webhook(uuid, text, text, jsonb, boolean, timestamptz, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.credit_lead_topup(uuid, integer) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.check_subscription_expiry() TO service_role;
GRANT EXECUTE ON FUNCTION public.dispatch_booking_confirmation_sms() TO service_role;
GRANT EXECUTE ON FUNCTION public.dispatch_trip_departure_reminder_sms() TO service_role;
GRANT EXECUTE ON FUNCTION public.escalate_unacknowledged_sos_incidents() TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_stale_holds() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_pending_notifications(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.prune_stale_trip_locations(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_notification_status(uuid, text, text, text, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.write_audit_log(uuid, text, text, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_sample_booking_id() TO service_role;
GRANT EXECUTE ON FUNCTION public.process_payment_webhook(uuid, text, text, jsonb, boolean, timestamptz, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.credit_lead_topup(uuid, integer) TO service_role;

-- Revoke anon on request_seat_alert
REVOKE EXECUTE ON FUNCTION public.request_seat_alert(uuid, uuid, uuid, date, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_seat_alert(uuid, uuid, uuid, date, integer) TO authenticated, service_role;

-- 4. CONVERT SAFE LOOKUP HELPERS TO SECURITY INVOKER
ALTER FUNCTION public.current_driver_id() SECURITY INVOKER;
ALTER FUNCTION public.is_driver() SECURITY INVOKER;
ALTER FUNCTION public.find_nearest_pickup_points(numeric, numeric, integer, numeric) SECURITY INVOKER;
ALTER FUNCTION public.find_nearest_town(numeric, numeric) SECURITY INVOKER;
ALTER FUNCTION public.get_notification_by_id(uuid) SECURITY INVOKER;
ALTER FUNCTION public.mark_notification_read(uuid) SECURITY INVOKER;
ALTER FUNCTION public.mark_all_notifications_read(uuid) SECURITY INVOKER;
ALTER FUNCTION public.get_user_notifications(uuid, integer) SECURITY INVOKER;
ALTER FUNCTION public.add_emergency_contact_rpc(uuid, text, text, text) SECURITY INVOKER;
ALTER FUNCTION public.admin_manage_route(text, text, text, boolean, integer, uuid) SECURITY INVOKER;
ALTER FUNCTION public.admin_manage_town(text, text, numeric, numeric, uuid) SECURITY INVOKER;
ALTER FUNCTION public.admin_suspend_driver(uuid, text, uuid) SECURITY INVOKER;
ALTER FUNCTION public.admin_unsuspend_driver(uuid, text, uuid) SECURITY INVOKER;
ALTER FUNCTION public.admin_verify_driver(uuid, uuid) SECURITY INVOKER;
ALTER FUNCTION public.admin_verify_vehicle(uuid, uuid) SECURITY INVOKER;
ALTER FUNCTION public.get_admin_incidents(text, text, integer) SECURITY INVOKER;
ALTER FUNCTION public.get_admin_support_tickets(text, text, integer) SECURITY INVOKER;
ALTER FUNCTION public.get_admin_webhook_logs(integer, text) SECURITY INVOKER;
ALTER FUNCTION public.get_demand_analytics(date, date) SECURITY INVOKER;
ALTER FUNCTION public.resolve_incident(uuid, text, uuid) SECURITY INVOKER;
ALTER FUNCTION public.update_ticket_status_rpc(uuid, text, uuid, uuid) SECURITY INVOKER;
ALTER FUNCTION public.assign_user_role(uuid, user_role_enum) SECURITY INVOKER;
ALTER FUNCTION public.get_driver_payment_history(uuid) SECURITY INVOKER;
ALTER FUNCTION public.get_driver_radar_leads(uuid) SECURITY INVOKER;
ALTER FUNCTION public.get_driver_subscription_summary(uuid) SECURITY INVOKER;
ALTER FUNCTION public.get_incident_by_id(uuid) SECURITY INVOKER;
ALTER FUNCTION public.get_payment_by_id(uuid) SECURITY INVOKER;
ALTER FUNCTION public.submit_driver_application(uuid, text, text, text, text, text, integer, text, text) SECURITY INVOKER;
ALTER FUNCTION public.submit_trip_rating(uuid, uuid, uuid, integer, text, text[]) SECURITY INVOKER;

-- 5. UPDATE CORE WORKFLOW RPCS WITH RESILIENT AUTH GUARDS
CREATE OR REPLACE FUNCTION public.publish_trip(
  p_driver_id      uuid,
  p_vehicle_id     uuid,
  p_route_id       uuid,
  p_departs_at     timestamp with time zone,
  p_base_fare_ugx  integer,
  p_notes          text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_seats int;
  v_operator_id uuid;
  v_trip_id uuid;
  v_duration int;
  r_stop record;
BEGIN
  IF auth.uid() IS NULL AND NOT is_admin() THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF auth.uid() IS NOT NULL AND p_driver_id <> current_driver_id() AND NOT is_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Cannot publish trips for another driver';
  END IF;

  SELECT coalesce(seat_capacity, capacity_seats) INTO v_seats FROM vehicles WHERE id = p_vehicle_id;
  IF v_seats IS NULL THEN
    RAISE EXCEPTION 'VEHICLE_NOT_FOUND';
  END IF;

  SELECT operator_id INTO v_operator_id FROM driver_profiles WHERE id = p_driver_id;
  IF v_operator_id IS NULL THEN
    SELECT get_or_create_driver_operator(user_id) INTO v_operator_id FROM driver_profiles WHERE id = p_driver_id;
  END IF;

  SELECT estimated_duration_minutes INTO v_duration FROM routes WHERE id = p_route_id;

  INSERT INTO trips (
    operator_id, driver_id, vehicle_id, route_id,
    departs_at, estimated_arrives_at, seats_total,
    base_fare_ugx, notes, status, published_at
  ) VALUES (
    v_operator_id, p_driver_id, p_vehicle_id, p_route_id,
    p_departs_at, p_departs_at + (coalesce(v_duration, 240) || ' minutes')::interval,
    v_seats, p_base_fare_ugx, p_notes, 'scheduled', now()
  ) RETURNING id INTO v_trip_id;

  FOR r_stop IN (
    SELECT * FROM route_stops WHERE route_id = p_route_id ORDER BY sequence
  ) LOOP
    INSERT INTO trip_stops (
      trip_id,
      route_stop_id,
      pickup_point_id,
      sequence,
      scheduled_arrival,
      scheduled_departure,
      fare_from_origin_ugx
    ) VALUES (
      v_trip_id,
      r_stop.id,
      r_stop.pickup_point_id,
      r_stop.sequence,
      p_departs_at + (coalesce(r_stop.estimated_minutes_from_origin, 0) || ' minutes')::interval,
      p_departs_at + (coalesce(r_stop.estimated_minutes_from_origin, 0) || ' minutes')::interval,
      CASE
        WHEN r_stop.sequence = 1 THEN 0
        ELSE p_base_fare_ugx
      END
    );
  END LOOP;

  RETURN v_trip_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.book_segment(
  p_trip_id                  uuid,
  p_passenger_id             uuid,
  p_origin_trip_stop_id      uuid,
  p_destination_trip_stop_id uuid,
  p_seat_count               integer,
  p_fare_ugx                 integer,
  p_booking_type             booking_type_enum DEFAULT 'seat'::booking_type_enum,
  p_hold_minutes             integer DEFAULT 15
)
RETURNS TABLE(booking_id uuid, booking_segment_id uuid, expires_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_origin_seq int;
  v_dest_seq int;
  v_max_seq int;
  v_seats_total int;
  v_max_occupied int;
  v_total_occupied_trip int;
  v_actual_seats int;
  v_booking_id uuid;
  v_segment_id uuid;
  v_expires_at timestamptz;
BEGIN
  IF auth.uid() IS NULL AND NOT is_admin() THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF auth.uid() IS NOT NULL AND p_passenger_id <> auth.uid() AND NOT is_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Cannot book seats on behalf of another user';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_trip_id::text));

  SELECT sequence INTO v_origin_seq FROM trip_stops WHERE id = p_origin_trip_stop_id AND trip_id = p_trip_id;
  SELECT sequence INTO v_dest_seq FROM trip_stops WHERE id = p_destination_trip_stop_id AND trip_id = p_trip_id;

  IF v_origin_seq IS NULL OR v_dest_seq IS NULL THEN
    RAISE EXCEPTION 'STOP_NOT_ON_TRIP';
  END IF;
  IF v_origin_seq >= v_dest_seq THEN
    RAISE EXCEPTION 'INVALID_STOP_ORDER';
  END IF;

  SELECT seats_total INTO v_seats_total FROM trips WHERE id = p_trip_id FOR UPDATE;
  IF v_seats_total IS NULL THEN
    RAISE EXCEPTION 'TRIP_NOT_FOUND';
  END IF;

  SELECT max(sequence) INTO v_max_seq FROM trip_stops WHERE trip_id = p_trip_id;

  UPDATE booking_segments bs
     SET status = 'expired'
   WHERE bs.trip_id = p_trip_id AND bs.status = 'held' AND bs.expires_at < now();

  IF EXISTS (
    SELECT 1 FROM bookings b
    JOIN booking_segments bs ON bs.booking_id = b.id
    WHERE b.trip_id = p_trip_id
      AND b.booking_type = 'private_vehicle'
      AND bs.status IN ('held', 'confirmed')
  ) THEN
    RAISE EXCEPTION 'SEATS_UNAVAILABLE';
  END IF;

  IF p_booking_type = 'private_vehicle' THEN
    IF v_origin_seq <> 1 OR v_dest_seq <> v_max_seq THEN
      RAISE EXCEPTION 'PRIVATE_HIRE_MUST_SPAN_FULL_TRIP';
    END IF;

    SELECT coalesce(sum(bs.seat_count), 0) INTO v_total_occupied_trip
    FROM booking_segments bs
    WHERE bs.trip_id = p_trip_id
      AND bs.status IN ('held', 'confirmed');

    IF v_total_occupied_trip > 0 THEN
      RAISE EXCEPTION 'PRIVATE_HIRE_NOT_AVAILABLE';
    END IF;

    v_actual_seats := v_seats_total;
  ELSE
    v_actual_seats := p_seat_count;

    SELECT coalesce(max(occupied), 0) INTO v_max_occupied
    FROM (
      SELECT gap.seq, coalesce(sum(bs.seat_count), 0) AS occupied
      FROM generate_series(v_origin_seq, v_dest_seq - 1) AS gap(seq)
      LEFT JOIN booking_segments bs
        ON bs.trip_id = p_trip_id
       AND bs.status IN ('held', 'confirmed')
       AND bs.origin_sequence <= gap.seq
       AND bs.destination_sequence > gap.seq
      GROUP BY gap.seq
    ) occ;

    IF v_max_occupied + v_actual_seats > v_seats_total THEN
      RAISE EXCEPTION 'SEATS_UNAVAILABLE';
    END IF;
  END IF;

  v_expires_at := now() + (p_hold_minutes || ' minutes')::interval;

  INSERT INTO bookings (passenger_id, trip_id, booking_type, status, total_seats, total_fare_ugx)
  VALUES (p_passenger_id, p_trip_id, p_booking_type, 'held', v_actual_seats, p_fare_ugx)
  RETURNING id INTO v_booking_id;

  INSERT INTO booking_segments (
    booking_id, trip_id, origin_trip_stop_id, destination_trip_stop_id,
    origin_sequence, destination_sequence, seat_count, fare_ugx, status, expires_at
  ) VALUES (
    v_booking_id, p_trip_id, p_origin_trip_stop_id, p_destination_trip_stop_id,
    v_origin_seq, v_dest_seq, v_actual_seats, p_fare_ugx, 'held', v_expires_at
  ) RETURNING id INTO v_segment_id;

  RETURN QUERY SELECT v_booking_id, v_segment_id, v_expires_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_booking(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_passenger_id uuid;
  v_driver_id uuid;
  v_confirmed int;
BEGIN
  IF auth.uid() IS NULL AND NOT is_admin() THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT b.passenger_id, t.driver_id
  INTO v_passenger_id, v_driver_id
  FROM bookings b
  JOIN trips t ON t.id = b.trip_id
  WHERE b.id = p_booking_id;

  IF v_passenger_id IS NULL THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND';
  END IF;

  IF auth.uid() IS NOT NULL AND v_passenger_id <> auth.uid() AND v_driver_id <> current_driver_id() AND NOT is_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Only booking passenger, trip driver, or admin can confirm';
  END IF;

  UPDATE booking_segments
     SET status = 'confirmed'
   WHERE booking_id = p_booking_id AND status = 'held' AND expires_at > now();
  GET DIAGNOSTICS v_confirmed = ROW_COUNT;

  IF v_confirmed = 0 THEN
    RAISE EXCEPTION 'HOLD_EXPIRED_OR_NOT_FOUND';
  END IF;

  UPDATE bookings SET status = 'confirmed', confirmed_at = now() WHERE id = p_booking_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_booking(p_booking_id uuid, p_reason text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_passenger_id uuid;
  v_driver_id uuid;
BEGIN
  IF auth.uid() IS NULL AND NOT is_admin() THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT b.passenger_id, t.driver_id
  INTO v_passenger_id, v_driver_id
  FROM bookings b
  JOIN trips t ON t.id = b.trip_id
  WHERE b.id = p_booking_id;

  IF v_passenger_id IS NULL THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND';
  END IF;

  IF auth.uid() IS NOT NULL AND v_passenger_id <> auth.uid() AND v_driver_id <> current_driver_id() AND NOT is_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Only booking passenger, trip driver, or admin can cancel';
  END IF;

  UPDATE booking_segments SET status = 'cancelled' WHERE booking_id = p_booking_id AND status IN ('held','confirmed');
  UPDATE bookings SET status = 'cancelled', cancelled_at = now(), cancel_reason = p_reason WHERE id = p_booking_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_trip_share(p_booking_id uuid, p_hours_valid integer DEFAULT 48)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_passenger_id uuid;
  v_driver_id uuid;
  v_share trip_shares%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL AND NOT is_admin() THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT b.passenger_id, t.driver_id
  INTO v_passenger_id, v_driver_id
  FROM bookings b
  JOIN trips t ON t.id = b.trip_id
  WHERE b.id = p_booking_id;

  IF v_passenger_id IS NULL THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND';
  END IF;

  IF auth.uid() IS NOT NULL AND v_passenger_id <> auth.uid() AND v_driver_id <> current_driver_id() AND NOT is_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Only booking passenger, driver, or admin can create trip shares';
  END IF;

  SELECT * INTO v_share
    FROM trip_shares
   WHERE booking_id = p_booking_id
     AND expires_at > now()
   ORDER BY expires_at DESC
   LIMIT 1;

  IF v_share.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'id', v_share.id,
      'share_token', v_share.share_token,
      'expires_at', v_share.expires_at
    );
  END IF;

  INSERT INTO trip_shares (booking_id, share_token, expires_at)
  VALUES (p_booking_id, encode(gen_random_bytes(16), 'hex'), now() + (coalesce(p_hours_valid, 48) || ' hours')::interval)
  RETURNING * INTO v_share;

  RETURN jsonb_build_object(
    'id', v_share.id,
    'share_token', v_share.share_token,
    'expires_at', v_share.expires_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_trip_location(
  p_trip_id   uuid,
  p_lat       numeric,
  p_lng       numeric,
  p_speed     numeric DEFAULT NULL::numeric,
  p_heading   numeric DEFAULT NULL::numeric,
  p_accuracy  numeric DEFAULT NULL::numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_driver_id uuid;
  v_inserted_id bigint;
BEGIN
  IF auth.uid() IS NULL AND NOT is_admin() THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT driver_id INTO v_driver_id FROM trips WHERE id = p_trip_id;
  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'Trip not found: %', p_trip_id;
  END IF;

  IF auth.uid() IS NOT NULL AND v_driver_id <> current_driver_id() AND NOT is_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Cannot record locations for another driver trip';
  END IF;

  INSERT INTO trip_locations (trip_id, driver_id, lat, lng, speed, heading, accuracy, recorded_at)
  VALUES (p_trip_id, v_driver_id, p_lat, p_lng, p_speed, p_heading, p_accuracy, now())
  RETURNING id INTO v_inserted_id;

  RETURN jsonb_build_object(
    'id', v_inserted_id,
    'trip_id', p_trip_id,
    'lat', p_lat,
    'lng', p_lng,
    'speed', p_speed,
    'recorded_at', now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.request_seat_alert(
  p_passenger_id        uuid,
  p_origin_town_id      uuid,
  p_destination_town_id uuid,
  p_travel_date         date,
  p_seats_needed        integer DEFAULT 1
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_alert_id uuid;
  v_user_id uuid;
BEGIN
  IF auth.uid() IS NULL AND NOT is_admin() THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  v_user_id := coalesce(p_passenger_id, auth.uid());
  IF auth.uid() IS NOT NULL AND v_user_id <> auth.uid() AND NOT is_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Cannot create trip alerts for another user';
  END IF;

  INSERT INTO search_events (origin_town_id, destination_town_id, travel_date, seats_needed, result_count, user_id)
  VALUES (p_origin_town_id, p_destination_town_id, p_travel_date, p_seats_needed, 0, v_user_id);

  INSERT INTO trip_alerts (passenger_id, origin_town_id, destination_town_id, travel_date, seats_needed, status)
  VALUES (v_user_id, p_origin_town_id, p_destination_town_id, p_travel_date, p_seats_needed, 'open')
  RETURNING id INTO v_alert_id;

  RETURN v_alert_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_trip_alert(
  p_passenger_id uuid,
  p_origin_town_id uuid,
  p_destination_town_id uuid,
  p_travel_date date,
  p_seats_needed integer DEFAULT 1
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_alert_id uuid;
  v_user_id uuid;
BEGIN
  IF auth.uid() IS NULL AND NOT is_admin() THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  v_user_id := coalesce(p_passenger_id, auth.uid());
  IF auth.uid() IS NOT NULL AND v_user_id <> auth.uid() AND NOT is_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Cannot create trip alerts for another user';
  END IF;

  INSERT INTO search_events (origin_town_id, destination_town_id, travel_date, seats_needed, result_count, user_id)
  VALUES (p_origin_town_id, p_destination_town_id, p_travel_date, p_seats_needed, 0, v_user_id);

  INSERT INTO trip_alerts (passenger_id, origin_town_id, destination_town_id, travel_date, seats_needed, status)
  VALUES (v_user_id, p_origin_town_id, p_destination_town_id, p_travel_date, p_seats_needed, 'open')
  RETURNING id INTO v_alert_id;

  RETURN v_alert_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reveal_lead(
  p_driver_id     uuid,
  p_trip_alert_id uuid
)
RETURNS TABLE (
  passenger_phone text,
  passenger_name  text,
  alert_id        uuid
)
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
  IF auth.uid() IS NULL AND NOT is_admin() THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF auth.uid() IS NOT NULL AND p_driver_id <> current_driver_id() AND NOT is_admin() THEN
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
  IF auth.uid() IS NULL AND NOT is_admin() THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF auth.uid() IS NOT NULL AND p_driver_id <> current_driver_id() AND NOT is_admin() THEN
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
  IF auth.uid() IS NULL AND NOT is_admin() THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF auth.uid() IS NOT NULL AND p_driver_id <> current_driver_id() AND NOT is_admin() THEN
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
  IF auth.uid() IS NULL AND NOT is_admin() THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF auth.uid() IS NOT NULL AND p_driver_id <> current_driver_id() AND NOT is_admin() THEN
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
    applied
  ) VALUES (
    p_driver_id,
    p_plan_id,
    p_purpose,
    v_amount,
    v_method,
    'pending',
    p_network,
    v_ref,
    false
  ) RETURNING id INTO v_payment_id;

  RETURN jsonb_build_object(
    'payment_id', v_payment_id,
    'provider_ref', v_ref,
    'amount_ugx', v_amount,
    'method', v_method,
    'phone_number', p_phone_number,
    'status', 'pending',
    'instructions', 'Enter your PIN on your phone to complete the transaction (' || p_network || ' prompt sent).'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_support_ticket(
  p_subject text,
  p_description text,
  p_category text DEFAULT 'general'::text,
  p_priority text DEFAULT 'normal'::text,
  p_trip_id uuid DEFAULT NULL::uuid,
  p_booking_id uuid DEFAULT NULL::uuid,
  p_user_id uuid DEFAULT NULL::uuid
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
  IF auth.uid() IS NULL AND NOT is_admin() AND NOT is_support() THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  v_user_id := coalesce(p_user_id, auth.uid());
  IF auth.uid() IS NOT NULL AND v_user_id <> auth.uid() AND NOT is_admin() AND NOT is_support() THEN
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
    coalesce(substr(p_description, 1, 100), 'Ticket created'),
    jsonb_build_object('ticket_id', v_ticket_id, 'user_id', v_user_id, 'priority', p_priority)
  FROM user_roles ur
  WHERE ur.role IN ('admin', 'support_agent');

  SELECT jsonb_build_object(
    'id', st.id,
    'user_id', st.user_id,
    'subject', st.subject,
    'description', st.description,
    'category', st.category,
    'priority', st.priority,
    'status', st.status,
    'created_at', st.created_at
  ) INTO v_result
  FROM support_tickets st
  WHERE st.id = v_ticket_id;

  RETURN v_result;
END;
$$;

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
  IF auth.uid() IS NULL AND NOT is_admin() AND NOT is_support() THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT st.user_id INTO v_user_id
  FROM support_tickets st
  WHERE st.id = p_ticket_id;

  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF auth.uid() IS NOT NULL AND v_user_id <> auth.uid() AND NOT is_admin() AND NOT is_support() THEN
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
      'name', trim(coalesce(u.first_name, '') || ' ' || coalesce(last_name, '')),
      'phone', u.phone,
      'email', u.email
    )
  ) INTO v_ticket
  FROM support_tickets st
  LEFT JOIN profiles u ON u.id = st.user_id
  WHERE st.id = p_ticket_id;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', sm.id,
      'ticket_id', sm.ticket_id,
      'sender_id', sm.sender_id,
      'message', sm.message,
      'attachment_url', sm.attachment_url,
      'created_at', sm.created_at,
      'sender_name', trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')),
      'is_staff', (
        SELECT 1 FROM user_roles ur WHERE ur.user_id = sm.sender_id AND ur.role IN ('admin', 'support_agent') LIMIT 1
      ) IS NOT NULL
    ) ORDER BY sm.created_at ASC
  ), '[]'::jsonb) INTO v_messages
  FROM support_messages sm
  LEFT JOIN profiles p ON p.id = sm.sender_id
  WHERE sm.ticket_id = p_ticket_id;

  RETURN jsonb_build_object(
    'ticket', v_ticket,
    'messages', v_messages
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.send_ticket_reply(
  p_ticket_id uuid,
  p_message text,
  p_sender_id uuid DEFAULT NULL::uuid,
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
  IF auth.uid() IS NULL AND NOT is_admin() AND NOT is_support() THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  v_sender_id := coalesce(auth.uid(), p_sender_id);

  IF p_message IS NULL OR trim(p_message) = '' THEN
    RAISE EXCEPTION 'Message content cannot be empty';
  END IF;

  SELECT user_id, subject INTO v_customer_id, v_subject
  FROM support_tickets WHERE id = p_ticket_id;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Ticket % not found', p_ticket_id;
  END IF;

  IF v_sender_id IS NULL THEN
    v_sender_id := v_customer_id;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = v_sender_id AND role IN ('admin', 'support_agent')
    ) INTO v_is_staff;

    IF NOT v_is_staff AND v_sender_id <> v_customer_id THEN
      RAISE EXCEPTION 'UNAUTHORIZED: You can only reply to your own support tickets';
    END IF;
  ELSE
    v_is_staff := true;
  END IF;

  INSERT INTO support_messages (ticket_id, sender_id, message, attachment_url)
  VALUES (p_ticket_id, v_sender_id, trim(p_message), p_attachment_url)
  RETURNING id INTO v_msg_id;

  IF v_is_staff THEN
    UPDATE support_tickets
    SET status = 'in_progress', updated_at = now()
    WHERE id = p_ticket_id AND status = 'open';

    INSERT INTO notifications (user_id, channel, type, title, body, data)
    VALUES (
      v_customer_id,
      'in_app'::notification_channel_enum,
      'ticket_reply',
      'New reply on your support ticket',
      coalesce(substr(p_message, 1, 100), 'Staff replied to your ticket'),
      jsonb_build_object('ticket_id', p_ticket_id, 'message_id', v_msg_id)
    );
  ELSE
    UPDATE support_tickets
    SET status = 'open', updated_at = now()
    WHERE id = p_ticket_id AND status = 'resolved';

    INSERT INTO notifications (user_id, channel, type, title, body, data)
    SELECT 
      ur.user_id, 
      'in_app'::notification_channel_enum, 
      'ticket_customer_reply',
      'Customer replied to ticket #' || substr(p_ticket_id::text, 1, 8),
      coalesce(substr(p_message, 1, 100), 'Customer sent a reply'),
      jsonb_build_object('ticket_id', p_ticket_id, 'message_id', v_msg_id)
    FROM user_roles ur
    WHERE ur.role IN ('admin', 'support_agent');
  END IF;

  SELECT trim(coalesce(first_name, '') || ' ' || coalesce(last_name, ''))
  INTO v_sender_name
  FROM profiles WHERE id = v_sender_id;

  RETURN jsonb_build_object(
    'id', v_msg_id,
    'ticket_id', p_ticket_id,
    'sender_id', v_sender_id,
    'sender_name', coalesce(v_sender_name, 'Support Agent'),
    'message', trim(p_message),
    'is_staff', v_is_staff,
    'created_at', now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_trip_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_start date;
  v_max_trips int;
  v_used int;
  v_extra int;
BEGIN
  -- Only count/enforce quota when a trip is being published/scheduled.
  IF new.status != 'scheduled' THEN
    RETURN new;
  END IF;

  -- Ignore if status did not change or if updating already scheduled trip
  IF tg_op = 'UPDATE' AND old.status = 'scheduled' THEN
    RETURN new;
  END IF;

  -- Do not block admin / service_role operations (system tests, admin overrides, or restorations)
  IF is_admin() THEN
    RETURN new;
  END IF;

  SELECT ds.starts_at::date, sp.max_trips_per_period
    INTO v_period_start, v_max_trips
  FROM driver_subscriptions ds
  JOIN subscription_plans sp ON sp.id = ds.plan_id
  WHERE ds.driver_id = new.driver_id
    AND ds.status IN ('active','trialing','grace')
    AND (ds.ends_at >= now() OR ds.status = 'grace')
  ORDER BY ds.starts_at DESC LIMIT 1;

  IF v_max_trips IS NULL THEN
    RAISE EXCEPTION 'NO_ACTIVE_SUBSCRIPTION';
  END IF;

  INSERT INTO subscription_usage (driver_id, period_start, trips_posted)
  VALUES (new.driver_id, v_period_start, 0)
  ON CONFLICT (driver_id, period_start) DO NOTHING;

  SELECT trips_posted, extra_trips INTO v_used, v_extra
  FROM subscription_usage WHERE driver_id = new.driver_id AND period_start = v_period_start
  FOR UPDATE;

  IF v_used >= v_max_trips + coalesce(v_extra, 0) THEN
    RAISE EXCEPTION 'TRIP_QUOTA_REACHED';
  END IF;

  UPDATE subscription_usage SET trips_posted = trips_posted + 1
   WHERE driver_id = new.driver_id AND period_start = v_period_start;

  RETURN new;
END;
$$;
