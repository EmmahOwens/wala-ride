-- ============================================================================
-- MIGRATION: FIX VEHICLE COLUMNS SYNC & VEHICLE REGISTRATION RPC
-- ============================================================================

-- 1. Support both column naming conventions (registration_number / license_plate, seat_capacity / capacity_seats)
alter table vehicles add column if not exists license_plate text;
alter table vehicles add column if not exists capacity_seats integer;

update vehicles set license_plate = registration_number where license_plate is null;
update vehicles set capacity_seats = seat_capacity where capacity_seats is null;

create or replace function sync_vehicle_columns()
returns trigger
language plpgsql
as $$
begin
  if new.registration_number is null and new.license_plate is not null then
    new.registration_number := new.license_plate;
  end if;
  if new.license_plate is null and new.registration_number is not null then
    new.license_plate := new.registration_number;
  end if;

  if new.seat_capacity is null and new.capacity_seats is not null then
    new.seat_capacity := new.capacity_seats;
  end if;
  if new.capacity_seats is null and new.seat_capacity is not null then
    new.capacity_seats := new.seat_capacity;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_vehicle_columns on vehicles;
create trigger trg_sync_vehicle_columns
  before insert or update on vehicles
  for each row execute function sync_vehicle_columns();

-- 2. Helper RPC to register vehicle safely with security definer
create or replace function register_vehicle(
  p_driver_id uuid,
  p_make text,
  p_model text,
  p_year integer,
  p_license_plate text,
  p_capacity_seats integer,
  p_color text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_operator_id uuid;
  v_vehicle record;
begin
  select user_id, operator_id into v_user_id, v_operator_id from driver_profiles where id = p_driver_id;
  if v_user_id is null then
    raise exception 'DRIVER_NOT_FOUND';
  end if;

  if v_operator_id is null then
    v_operator_id := get_or_create_driver_operator(v_user_id);
  end if;

  insert into vehicles (
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
  ) values (
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
    'active'
  )
  returning * into v_vehicle;

  return row_to_json(v_vehicle)::jsonb;
end;
$$;

-- 3. Fix publish_trip to handle either capacity column name safely
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
      pickup_point_id,
      sequence,
      planned_arrival,
      planned_departure,
      fare_from_origin_ugx
    ) values (
      v_trip_id,
      r_stop.pickup_point_id,
      r_stop.sequence,
      p_departs_at + (coalesce(r_stop.planned_stop_order_offset_minutes, 0) || ' minutes')::interval,
      p_departs_at + (coalesce(r_stop.planned_stop_order_offset_minutes, 0) || ' minutes')::interval,
      case
        when r_stop.sequence = 1 then 0
        else p_base_fare_ugx
      end
    );
  end loop;

  return v_trip_id;
end;
$$;

-- 4. Fix search_available_trips to handle either license plate column safely
create or replace function search_available_trips(
  p_origin_town_id uuid,
  p_dest_town_id uuid,
  p_date date,
  p_required_seats int default 1
) returns table (
  trip_id uuid,
  driver_name text,
  driver_phone text,
  driver_rating numeric(3,2),
  vehicle_info text,
  vehicle_plate text,
  departs_at timestamptz,
  estimated_arrives_at timestamptz,
  seats_available int,
  seats_total int,
  fare_ugx int,
  origin_trip_stop_id uuid,
  origin_pickup_name text,
  origin_town_name text,
  dest_trip_stop_id uuid,
  dest_pickup_name text,
  dest_town_name text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidate_trips as (
    select
      t.id as c_trip_id,
      t.departs_at as c_departs_at,
      t.estimated_arrives_at as c_arrives_at,
      t.seats_total as c_seats_total,
      t.base_fare_ugx as c_base_fare,
      s1.id as s1_id,
      s1.sequence as s1_seq,
      p1.name as s1_pickup_name,
      town1.name as s1_town_name,
      s2.id as s2_id,
      s2.sequence as s2_seq,
      p2.name as s2_pickup_name,
      town2.name as s2_town_name,
      dp.rating_average as c_driver_rating,
      dp.user_id as c_driver_user_id,
      coalesce(prof.first_name || ' ' || prof.last_name, 'Wala Driver') as c_driver_name,
      coalesce(prof.phone, '') as c_driver_phone,
      coalesce(v.make || ' ' || v.model, 'Vehicle') as c_vehicle_info,
      coalesce(v.license_plate, v.registration_number) as c_vehicle_plate
    from trips t
    join trip_stops s1 on s1.trip_id = t.id
    join pickup_points p1 on p1.id = s1.pickup_point_id and p1.town_id = p_origin_town_id
    join towns town1 on town1.id = p1.town_id
    join trip_stops s2 on s2.trip_id = t.id
    join pickup_points p2 on p2.id = s2.pickup_point_id and p2.town_id = p_dest_town_id
    join towns town2 on town2.id = p2.town_id
    join driver_profiles dp on dp.id = t.driver_id
    join profiles prof on prof.id = dp.user_id
    join vehicles v on v.id = t.vehicle_id
    where t.status = 'scheduled'
      and s1.sequence < s2.sequence
      and t.departs_at::date = p_date
  )
  select
    c.c_trip_id as trip_id,
    c.c_driver_name as driver_name,
    c.c_driver_phone as driver_phone,
    c.c_driver_rating as driver_rating,
    c.c_vehicle_info as vehicle_info,
    c.c_vehicle_plate as vehicle_plate,
    c.c_departs_at as departs_at,
    c.c_arrives_at as estimated_arrives_at,
    (c.c_seats_total - coalesce(
      (select max(occupied) from (
        select coalesce(sum(bs.seat_count), 0) as occupied
        from generate_series(c.s1_seq, c.s2_seq - 1) as gap(seq)
        left join booking_segments bs
          on bs.trip_id = c.c_trip_id
         and bs.status in ('held', 'confirmed')
         and bs.origin_sequence <= gap.seq
         and bs.destination_sequence > gap.seq
        group by gap.seq
      ) occ), 0
    ))::int as seats_available,
    c.c_seats_total as seats_total,
    c.c_base_fare as fare_ugx,
    c.s1_id as origin_trip_stop_id,
    c.s1_pickup_name as origin_pickup_name,
    c.s1_town_name as origin_town_name,
    c.s2_id as dest_trip_stop_id,
    c.s2_pickup_name as dest_pickup_name,
    c.s2_town_name as dest_town_name
  from candidate_trips c
  where (c.c_seats_total - coalesce(
    (select max(occupied) from (
      select coalesce(sum(bs.seat_count), 0) as occupied
      from generate_series(c.s1_seq, c.s2_seq - 1) as gap(seq)
      left join booking_segments bs
        on bs.trip_id = c.c_trip_id
       and bs.status in ('held', 'confirmed')
       and bs.origin_sequence <= gap.seq
       and bs.destination_sequence > gap.seq
      group by gap.seq
    ) occ), 0
  )) >= p_required_seats;
end;
$$;
