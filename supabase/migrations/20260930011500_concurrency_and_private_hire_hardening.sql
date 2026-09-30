-- Migration: 20260930011500_concurrency_and_private_hire_hardening.sql
-- Hardens book_segment concurrency, enforces private vehicle exclusive capacity, and schedules stale hold expiry via pg_cron.

-- 1. Hardened book_segment with advisory locking, interval occupancy, and private hire exclusivity
create or replace function public.book_segment(
  p_trip_id uuid,
  p_passenger_id uuid,
  p_origin_trip_stop_id uuid,
  p_destination_trip_stop_id uuid,
  p_seat_count int,
  p_fare_ugx int,
  p_booking_type booking_type_enum default 'seat',
  p_hold_minutes int default 15
) returns table (booking_id uuid, booking_segment_id uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
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
begin
  -- Concurrency control: acquire transaction-level advisory lock per trip
  perform pg_advisory_xact_lock(hashtext(p_trip_id::text));

  -- Resolve origin and destination sequence numbers
  select sequence into v_origin_seq from trip_stops where id = p_origin_trip_stop_id and trip_id = p_trip_id;
  select sequence into v_dest_seq from trip_stops where id = p_destination_trip_stop_id and trip_id = p_trip_id;

  if v_origin_seq is null or v_dest_seq is null then
    raise exception 'STOP_NOT_ON_TRIP';
  end if;
  if v_origin_seq >= v_dest_seq then
    raise exception 'INVALID_STOP_ORDER';
  end if;

  -- Lock trip row and retrieve snapshot seating capacity
  select seats_total into v_seats_total from trips where id = p_trip_id for update;
  if v_seats_total is null then
    raise exception 'TRIP_NOT_FOUND';
  end if;

  select max(sequence) into v_max_seq from trip_stops where trip_id = p_trip_id;

  -- Lazily expire any holds that lapsed before computing occupancy
  update booking_segments bs
     set status = 'expired'
   where bs.trip_id = p_trip_id and bs.status = 'held' and bs.expires_at < now();

  -- Check if there is an active private-hire / whole-vehicle booking on this trip
  if exists (
    select 1 from bookings b
    join booking_segments bs on bs.booking_id = b.id
    where b.trip_id = p_trip_id
      and b.booking_type = 'private_vehicle'
      and bs.status in ('held', 'confirmed')
  ) then
    raise exception 'SEATS_UNAVAILABLE';
  end if;

  -- If this booking is for the whole vehicle (private hire):
  if p_booking_type = 'private_vehicle' then
    -- Private hire must span the full route template from start to finish
    if v_origin_seq <> 1 or v_dest_seq <> v_max_seq then
      raise exception 'PRIVATE_HIRE_MUST_SPAN_FULL_TRIP';
    end if;

    -- Ensure no seats are already held or confirmed anywhere on the trip
    select coalesce(sum(bs.seat_count), 0) into v_total_occupied_trip
    from booking_segments bs
    where bs.trip_id = p_trip_id
      and bs.status in ('held', 'confirmed');

    if v_total_occupied_trip > 0 then
      raise exception 'PRIVATE_HIRE_NOT_AVAILABLE';
    end if;

    v_actual_seats := v_seats_total;
  else
    v_actual_seats := p_seat_count;

    -- Compute interval overlap occupancy across the requested sequence range
    select coalesce(max(occupied), 0) into v_max_occupied
    from (
      select gap.seq, coalesce(sum(bs.seat_count), 0) as occupied
      from generate_series(v_origin_seq, v_dest_seq - 1) as gap(seq)
      left join booking_segments bs
        on bs.trip_id = p_trip_id
       and bs.status in ('held', 'confirmed')
       and bs.origin_sequence <= gap.seq
       and bs.destination_sequence > gap.seq
      group by gap.seq
    ) occ;

    if v_max_occupied + v_actual_seats > v_seats_total then
      raise exception 'SEATS_UNAVAILABLE';
    end if;
  end if;

  v_expires_at := now() + (p_hold_minutes || ' minutes')::interval;

  insert into bookings (passenger_id, trip_id, booking_type, status, total_seats, total_fare_ugx)
  values (p_passenger_id, p_trip_id, p_booking_type, 'held', v_actual_seats, p_fare_ugx)
  returning id into v_booking_id;

  insert into booking_segments (
    booking_id, trip_id, origin_trip_stop_id, destination_trip_stop_id,
    origin_sequence, destination_sequence, seat_count, fare_ugx, status, expires_at
  ) values (
    v_booking_id, p_trip_id, p_origin_trip_stop_id, p_destination_trip_stop_id,
    v_origin_seq, v_dest_seq, v_actual_seats, p_fare_ugx, 'held', v_expires_at
  ) returning id into v_segment_id;

  return query select v_booking_id, v_segment_id, v_expires_at;
end;
$$;

-- 2. Enhanced admin_manage_route supporting overview_polyline & bounding_box
create or replace function public.admin_manage_route(
  p_action text,
  p_id uuid default null,
  p_name text default null,
  p_origin_town_id uuid default null,
  p_destination_town_id uuid default null,
  p_distance_km numeric default null,
  p_duration_mins integer default null,
  p_status text default 'active',
  p_stops jsonb default '[]'::jsonb,
  p_overview_polyline text default null,
  p_bounding_box jsonb default null
) returns jsonb
language plpgsql
security definer
set search_path = public as $$
declare
  v_id uuid;
  v_stop record;
  v_result jsonb;
begin
  if p_action = 'create' then
    if p_origin_town_id is null or p_destination_town_id is null then
      raise exception 'Origin and Destination towns are required';
    end if;

    insert into routes (
      name, origin_town_id, destination_town_id, distance_km, estimated_duration_minutes, status, overview_polyline, bounding_box
    ) values (
      trim(p_name), p_origin_town_id, p_destination_town_id, p_distance_km, p_duration_mins, coalesce(p_status, 'active'), p_overview_polyline, p_bounding_box
    ) returning id into v_id;

  elsif p_action = 'update' then
    if p_id is null then
      raise exception 'Route ID required for update';
    end if;

    update routes
    set name = coalesce(trim(p_name), name),
        origin_town_id = coalesce(p_origin_town_id, origin_town_id),
        destination_town_id = coalesce(p_destination_town_id, destination_town_id),
        distance_km = coalesce(p_distance_km, distance_km),
        estimated_duration_minutes = coalesce(p_duration_mins, estimated_duration_minutes),
        status = coalesce(p_status, status),
        overview_polyline = coalesce(p_overview_polyline, overview_polyline),
        bounding_box = coalesce(p_bounding_box, bounding_box),
        updated_at = now()
    where id = p_id
    returning id into v_id;

  else
    raise exception 'Unknown route action: %', p_action;
  end if;

  if jsonb_array_length(p_stops) > 0 then
    delete from route_stops where route_id = v_id;

    for v_stop in select * from jsonb_to_recordset(p_stops) as x(
      town_id uuid,
      pickup_point_id uuid,
      sequence integer,
      distance_from_origin_km numeric,
      estimated_minutes_from_origin integer,
      pickup_allowed boolean,
      dropoff_allowed boolean
    ) loop
      insert into route_stops (
        route_id, town_id, pickup_point_id, sequence,
        distance_from_origin_km, estimated_minutes_from_origin,
        pickup_allowed, dropoff_allowed
      ) values (
        v_id, v_stop.town_id, v_stop.pickup_point_id, v_stop.sequence,
        v_stop.distance_from_origin_km, v_stop.estimated_minutes_from_origin,
        coalesce(v_stop.pickup_allowed, true), coalesce(v_stop.dropoff_allowed, true)
      );
    end loop;
  end if;

  select jsonb_build_object(
    'id', r.id,
    'name', r.name,
    'origin_town_id', r.origin_town_id,
    'destination_town_id', r.destination_town_id,
    'distance_km', r.distance_km,
    'estimated_duration_minutes', r.estimated_duration_minutes,
    'status', r.status,
    'overview_polyline', r.overview_polyline,
    'stops_count', (select count(*)::integer from route_stops where route_id = r.id)
  ) into v_result
  from routes r
  where r.id = v_id;

  return v_result;
end;
$$;

-- 3. Scheduled hold expiry via pg_cron (runs every minute)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.unschedule('expire_stale_holds_job');
    exception when others then
      -- job may not have existed yet
    end;
    perform cron.schedule('expire_stale_holds_job', '* * * * *', 'SELECT public.expire_stale_holds();');
  end if;
end $$;
