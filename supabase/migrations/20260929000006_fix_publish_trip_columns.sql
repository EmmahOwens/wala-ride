-- ============================================================================
-- MIGRATION: FIX PUBLISH TRIP TO USE SCHEDULED_ARRIVAL & ESTIMATED_MINUTES
-- ============================================================================

create or replace function publish_trip(
  p_driver_id uuid,
  p_vehicle_id uuid,
  p_route_id uuid,
  p_departs_at timestamptz,
  p_base_fare_ugx integer,
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seats int;
  v_operator_id uuid;
  v_trip_id uuid;
  v_duration int;
  r_stop record;
begin
  -- Validate driver and vehicle
  select coalesce(seat_capacity, capacity_seats) into v_seats from vehicles where id = p_vehicle_id;
  if v_seats is null then
    raise exception 'VEHICLE_NOT_FOUND';
  end if;

  select operator_id into v_operator_id from driver_profiles where id = p_driver_id;
  if v_operator_id is null then
    -- assign default operator
    select get_or_create_driver_operator(user_id) into v_operator_id from driver_profiles where id = p_driver_id;
  end if;

  select estimated_duration_minutes into v_duration from routes where id = p_route_id;

  -- Insert trip (triggers trg_enforce_trip_quota automatically)
  insert into trips (
    operator_id, driver_id, vehicle_id, route_id,
    departs_at, estimated_arrives_at, seats_total,
    base_fare_ugx, notes, status, published_at
  ) values (
    v_operator_id, p_driver_id, p_vehicle_id, p_route_id,
    p_departs_at, p_departs_at + (coalesce(v_duration, 240) || ' minutes')::interval,
    v_seats, p_base_fare_ugx, p_notes, 'scheduled', now()
  ) returning id into v_trip_id;

  -- Populate trip_stops from route_stops
  for r_stop in (
    select * from route_stops where route_id = p_route_id order by sequence
  ) loop
    insert into trip_stops (
      trip_id,
      route_stop_id,
      pickup_point_id,
      sequence,
      scheduled_arrival,
      scheduled_departure,
      fare_from_origin_ugx
    ) values (
      v_trip_id,
      r_stop.id,
      r_stop.pickup_point_id,
      r_stop.sequence,
      p_departs_at + (coalesce(r_stop.estimated_minutes_from_origin, 0) || ' minutes')::interval,
      p_departs_at + (coalesce(r_stop.estimated_minutes_from_origin, 0) || ' minutes')::interval,
      case
        when r_stop.sequence = 1 then 0
        else p_base_fare_ugx
      end
    );
  end loop;

  return v_trip_id;
end;
$$;
