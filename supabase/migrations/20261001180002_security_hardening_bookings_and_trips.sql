-- ============================================================================
-- SECURITY HARDENING: RPC FUNCTIONS & EXECUTION PRIVILEGES
-- ============================================================================

-- 6. BOOKINGS, TRIPS & TRACKING RPCs
-- ----------------------------------------------------------------------------
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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF p_passenger_id <> auth.uid() AND NOT is_admin() THEN
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
  IF auth.uid() IS NULL THEN
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

  IF v_passenger_id <> auth.uid() AND v_driver_id <> current_driver_id() AND NOT is_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Only booking passenger, trip driver, or admin can cancel';
  END IF;

  UPDATE booking_segments SET status = 'cancelled' WHERE booking_id = p_booking_id AND status IN ('held','confirmed');
  UPDATE bookings SET status = 'cancelled', cancelled_at = now(), cancel_reason = p_reason WHERE id = p_booking_id;
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
  IF auth.uid() IS NULL THEN
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

  IF v_passenger_id <> auth.uid() AND v_driver_id <> current_driver_id() AND NOT is_admin() THEN
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
  IF auth.uid() IS NULL THEN
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

  IF v_passenger_id <> auth.uid() AND v_driver_id <> current_driver_id() AND NOT is_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Only booking passenger, driver, or admin can create trip shares';
  END IF;

  SELECT * INTO v_share
    FROM trip_shares
   WHERE booking_id = p_booking_id
     AND expires_at > now()
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_share.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'id', v_share.id,
      'share_token', v_share.share_token,
      'expires_at', v_share.expires_at
    );
  END IF;

  INSERT INTO trip_shares (booking_id, expires_at)
  VALUES (p_booking_id, now() + (p_hours_valid || ' hours')::interval)
  RETURNING * INTO v_share;

  RETURN jsonb_build_object(
    'id', v_share.id,
    'share_token', v_share.share_token,
    'expires_at', v_share.expires_at
  );
END;
$$;

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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF p_driver_id <> current_driver_id() AND NOT is_admin() THEN
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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT driver_id INTO v_driver_id FROM trips WHERE id = p_trip_id;
  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'Trip not found: %', p_trip_id;
  END IF;

  IF v_driver_id <> current_driver_id() AND NOT is_admin() THEN
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

CREATE OR REPLACE FUNCTION public.register_vehicle(
  p_driver_id       uuid,
  p_make            text,
  p_model           text,
  p_year            integer,
  p_license_plate   text,
  p_capacity_seats  integer,
  p_color           text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_operator_id uuid;
  v_vehicle record;
BEGIN
  IF auth.uid() IS NULL AND NOT is_admin() THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF auth.uid() IS NOT NULL AND p_driver_id <> current_driver_id() AND NOT is_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Cannot register vehicle for another driver';
  END IF;

  SELECT user_id, operator_id INTO v_user_id, v_operator_id FROM driver_profiles WHERE id = p_driver_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'DRIVER_NOT_FOUND';
  END IF;

  IF v_operator_id IS NULL THEN
    v_operator_id := get_or_create_driver_operator(v_user_id);
  END IF;

  INSERT INTO vehicles (
    operator_id,
    primary_driver_id,
    registration_number,
    license_plate,
    make,
    model,
    year,
    seat_capacity,
    capacity_seats,
    color,
    status
  ) VALUES (
    v_operator_id,
    p_driver_id,
    upper(trim(p_license_plate)),
    upper(trim(p_license_plate)),
    p_make,
    p_model,
    p_year,
    p_capacity_seats,
    p_capacity_seats,
    p_color,
    'pending_verification'
  )
  RETURNING * INTO v_vehicle;

  RETURN row_to_json(v_vehicle)::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION public.register_driver_profile(
  p_user_id         uuid,
  p_license_number  text DEFAULT NULL::text,
  p_license_class   text DEFAULT NULL::text,
  p_national_id     text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_driver record;
  v_user_id uuid;
  v_initial_status public.verification_status_enum;
BEGIN
  IF auth.uid() IS NULL AND NOT is_admin() THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  v_user_id := coalesce(p_user_id, auth.uid());
  IF auth.uid() IS NOT NULL AND v_user_id <> auth.uid() AND NOT is_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Cannot register driver profile for another user';
  END IF;

  -- Admin can register directly as verified, standard user starts as pending
  IF is_admin() THEN
    v_initial_status := 'verified'::public.verification_status_enum;
  ELSE
    v_initial_status := 'pending'::public.verification_status_enum;
  END IF;

  INSERT INTO driver_profiles (
    user_id,
    license_number,
    license_class,
    national_id,
    verification_status
  ) VALUES (
    v_user_id,
    p_license_number,
    p_license_class,
    p_national_id,
    v_initial_status
  )
  ON CONFLICT (user_id) DO UPDATE SET
    license_number = coalesce(excluded.license_number, driver_profiles.license_number),
    license_class = coalesce(excluded.license_class, driver_profiles.license_class),
    national_id = coalesce(excluded.national_id, driver_profiles.national_id),
    updated_at = now()
  RETURNING * INTO v_driver;

  RETURN row_to_json(v_driver)::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_trip_alert(
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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  v_user_id := coalesce(p_passenger_id, auth.uid());
  IF v_user_id <> auth.uid() AND NOT is_admin() THEN
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

CREATE OR REPLACE FUNCTION public.report_incident(
  p_trip_id       uuid DEFAULT NULL::uuid,
  p_booking_id    uuid DEFAULT NULL::uuid,
  p_kind          incident_kind_enum DEFAULT 'sos'::incident_kind_enum,
  p_lat           numeric DEFAULT NULL::numeric,
  p_lng           numeric DEFAULT NULL::numeric,
  p_description   text DEFAULT NULL::text,
  p_reported_by   uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_user_id             uuid;
  v_incident_id         uuid;
  v_trip_id             uuid;
  v_passenger_name      text := 'Passenger';
  v_share_token         text;
  v_share_url           text;
  v_contact             record;
  v_contacts_dispatched int := 0;
  v_admin_rec           record;
BEGIN
  IF auth.uid() IS NULL AND NOT is_admin() THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  v_user_id := coalesce(auth.uid(), p_reported_by);
  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id FROM profiles LIMIT 1;
  END IF;
  v_trip_id := p_trip_id;

  IF v_trip_id IS NULL AND p_booking_id IS NOT NULL THEN
    SELECT trip_id INTO v_trip_id FROM bookings WHERE id = p_booking_id;
  END IF;

  SELECT coalesce(first_name || ' ' || coalesce(last_name, ''), 'Passenger')
    INTO v_passenger_name
    FROM profiles WHERE id = v_user_id;

  INSERT INTO incidents (trip_id, booking_id, reported_by, kind, lat, lng, description, status, escalation_status)
  VALUES (v_trip_id, p_booking_id, v_user_id, p_kind, p_lat, p_lng, p_description, 'open', 'none')
  RETURNING id INTO v_incident_id;

  IF v_trip_id IS NOT NULL THEN
    INSERT INTO trip_events (trip_id, event_type, lat, lng, created_by, metadata)
    VALUES (
      v_trip_id,
      'INCIDENT_REPORTED',
      p_lat,
      p_lng,
      v_user_id,
      jsonb_build_object(
        'incident_id', v_incident_id,
        'kind', p_kind,
        'description', p_description,
        'reported_at', now()
      )
    );
  END IF;

  IF p_kind = 'sos' THEN
    IF p_booking_id IS NOT NULL THEN
      SELECT share_token INTO v_share_token
        FROM trip_shares
       WHERE booking_id = p_booking_id AND expires_at > now()
       ORDER BY created_at DESC LIMIT 1;

      IF v_share_token IS NULL THEN
        v_share_token := encode(extensions.gen_random_bytes(16), 'hex');
        INSERT INTO trip_shares (booking_id, share_token, expires_at)
        VALUES (p_booking_id, v_share_token, now() + interval '48 hours');
      END IF;
      v_share_url := 'https://walaride.com/?track=' || v_share_token;
    END IF;

    FOR v_contact IN
      SELECT name, phone FROM emergency_contacts WHERE user_id = v_user_id
    LOOP
      INSERT INTO notifications (user_id, channel, type, title, body, data)
      VALUES (
        v_user_id,
        'sms',
        'sos_emergency_contact',
        'EMERGENCY: ' || v_passenger_name || ' triggered SOS',
        'EMERGENCY: ' || v_passenger_name || ' pressed SOS on a Wala Ride trip. ' ||
        coalesce('Track live journey: ' || v_share_url, 'Contact operations immediately.'),
        jsonb_build_object(
          'incident_id', v_incident_id,
          'contact_name', v_contact.name,
          'contact_phone', v_contact.phone,
          'share_token', v_share_token,
          'lat', p_lat,
          'lng', p_lng
        )
      );
      v_contacts_dispatched := v_contacts_dispatched + 1;
    END LOOP;

    FOR v_admin_rec IN
      SELECT user_id FROM user_roles WHERE role = 'admin'
    LOOP
      INSERT INTO notifications (user_id, channel, type, title, body, data)
      VALUES (
        v_admin_rec.user_id,
        'in_app',
        'sos_admin_alert',
        '🚨 EMERGENCY SOS ALERT: ' || v_passenger_name,
        'Passenger pressed SOS emergency button on trip ' || coalesce(v_trip_id::text, 'N/A') || '. Immediate response required!',
        jsonb_build_object(
          'incident_id', v_incident_id,
          'trip_id', v_trip_id,
          'reporter_id', v_user_id,
          'reporter_name', v_passenger_name,
          'lat', p_lat,
          'lng', p_lng
        )
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'incident_id', v_incident_id,
    'status', 'open',
    'kind', p_kind,
    'created_at', now(),
    'emergency_contacts_notified', v_contacts_dispatched,
    'share_url', v_share_url
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_incident(
  p_incident_id  uuid,
  p_status       text DEFAULT 'resolved'::text,
  p_handler_id   uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_handler_id uuid;
BEGIN
  IF NOT is_admin() AND NOT is_support() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Staff privileges required to resolve incidents';
  END IF;

  v_handler_id := coalesce(p_handler_id, auth.uid());

  UPDATE incidents
     SET status = p_status,
         handled_by = coalesce(v_handler_id, handled_by),
         acknowledged_at = coalesce(acknowledged_at, now()),
         resolved_at = CASE WHEN p_status IN ('resolved', 'closed') THEN now() ELSE resolved_at END
   WHERE id = p_incident_id;

  RETURN jsonb_build_object(
    'incident_id', p_incident_id,
    'status', p_status,
    'handled_by', v_handler_id,
    'updated_at', now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_trip_rating(
  p_trip_id      uuid,
  p_booking_id   uuid,
  p_score        integer,
  p_comment      text DEFAULT NULL::text,
  p_reviewer_id  uuid DEFAULT NULL::uuid,
  p_reviewee_id  uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_reviewer_id uuid;
  v_reviewee_id uuid;
  v_rating_id uuid;
  v_is_participant boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  v_reviewer_id := auth.uid();

  -- Verify reviewer participation in trip/booking
  IF p_booking_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM bookings b
      JOIN trips t ON t.id = b.trip_id
      WHERE b.id = p_booking_id
        AND (b.passenger_id = v_reviewer_id OR t.driver_id = current_driver_id())
    ) INTO v_is_participant;
  ELSIF p_trip_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM trips t
      LEFT JOIN bookings b ON b.trip_id = t.id
      WHERE t.id = p_trip_id
        AND (b.passenger_id = v_reviewer_id OR t.driver_id = current_driver_id())
    ) INTO v_is_participant;
  END IF;

  IF NOT v_is_participant AND NOT is_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: You can only rate trips that you participated in';
  END IF;

  IF p_reviewee_id IS NOT NULL THEN
    v_reviewee_id := p_reviewee_id;
  ELSIF p_trip_id IS NOT NULL THEN
    SELECT dp.user_id INTO v_reviewee_id
      FROM trips t
      JOIN driver_profiles dp ON dp.id = t.driver_id
     WHERE t.id = p_trip_id;
  END IF;

  IF v_reviewee_id IS NULL THEN
    RAISE EXCEPTION 'REVIWEE_REQUIRED';
  END IF;

  INSERT INTO ratings (trip_id, booking_id, reviewer_id, reviewee_id, score, comment)
  VALUES (p_trip_id, p_booking_id, v_reviewer_id, v_reviewee_id, p_score, p_comment)
  RETURNING id INTO v_rating_id;

  RETURN jsonb_build_object(
    'rating_id', v_rating_id,
    'score', p_score,
    'created_at', now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_sample_booking_id()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_res jsonb;
BEGIN
  IF is_admin() THEN
    SELECT jsonb_build_object('id', id, 'booking_reference', booking_reference, 'trip_id', trip_id)
    INTO v_res FROM bookings ORDER BY created_at DESC LIMIT 1;
  ELSE
    SELECT jsonb_build_object('id', id, 'booking_reference', booking_reference, 'trip_id', trip_id)
    INTO v_res FROM bookings WHERE passenger_id = auth.uid() ORDER BY created_at DESC LIMIT 1;
  END IF;
  RETURN v_res;
END;
$$;
