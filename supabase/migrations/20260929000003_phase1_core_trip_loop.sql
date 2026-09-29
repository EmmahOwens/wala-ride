-- ============================================================================
-- MIGRATION: PHASE 1 CORE TRIP LOOP (ROUTES SEEDING, TRIP PUBLISHING & SEARCH)
-- ============================================================================

-- 1. Helper: Ensure driver has an individual operator record
create or replace function get_or_create_driver_operator(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_operator_id uuid;
  v_name text;
begin
  select operator_id into v_operator_id from driver_profiles where user_id = p_user_id and operator_id is not null;
  if v_operator_id is not null then
    return v_operator_id;
  end if;

  select id into v_operator_id from operators where owner_user_id = p_user_id limit 1;
  if v_operator_id is not null then
    update driver_profiles set operator_id = v_operator_id where user_id = p_user_id;
    return v_operator_id;
  end if;

  select coalesce(first_name || ' ' || last_name, 'Individual Operator') into v_name from profiles where id = p_user_id;
  if v_name is null or trim(v_name) = '' then
    v_name := 'Individual Driver';
  end if;

  insert into operators (name, type, owner_user_id, status, verification_status)
  values (v_name, 'individual', p_user_id, 'active', 'verified')
  returning id into v_operator_id;

  update driver_profiles set operator_id = v_operator_id where user_id = p_user_id;
  return v_operator_id;
end;
$$;

-- 2. Trigger: Automatically grant a 7-day Free Trial subscription to newly registered drivers
create or replace function grant_trial_subscription_on_driver_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into driver_subscriptions (driver_id, plan_id, status, starts_at, ends_at)
  values (
    new.id,
    '11111111-1111-1111-1111-111111111111',
    'trialing',
    now(),
    now() + interval '7 days'
  )
  on conflict do nothing;

  -- Ensure operator is assigned
  perform get_or_create_driver_operator(new.user_id);

  return new;
end;
$$;

drop trigger if exists trg_grant_trial_on_driver on driver_profiles;
create trigger trg_grant_trial_on_driver
  after insert on driver_profiles
  for each row execute function grant_trial_subscription_on_driver_created();

-- 3. SEED REUSABLE HIGHWAY CORRIDORS (ROUTES & ROUTE STOPS)
with 
  t as (select id, name from towns),
  p as (select id, name, town_id from pickup_points)
insert into routes (id, name, origin_town_id, destination_town_id, distance_km, estimated_duration_minutes, status)
values
  ('a1111111-1111-1111-1111-111111111111', 'Kampala – Masaka – Mbarara', 
   (select id from t where name = 'Kampala'), (select id from t where name = 'Mbarara'), 270, 270, 'active'),
  ('a2222222-2222-2222-2222-222222222222', 'Mbarara – Masaka – Kampala', 
   (select id from t where name = 'Mbarara'), (select id from t where name = 'Kampala'), 270, 270, 'active'),
  ('a3333333-3333-3333-3333-333333333333', 'Kampala – Jinja – Mbale', 
   (select id from t where name = 'Kampala'), (select id from t where name = 'Mbale'), 220, 240, 'active'),
  ('a4444444-4444-4444-4444-444444444444', 'Mbale – Jinja – Kampala', 
   (select id from t where name = 'Mbale'), (select id from t where name = 'Kampala'), 220, 240, 'active'),
  ('a5555555-5555-5555-5555-555555555555', 'Kampala – Gulu Direct Express', 
   (select id from t where name = 'Kampala'), (select id from t where name = 'Gulu'), 335, 360, 'active'),
  ('a6666666-6666-6666-6666-666666666666', 'Kampala – Jinja – Mbale – Soroti', 
   (select id from t where name = 'Kampala'), (select id from t where name = 'Soroti'), 325, 360, 'active')
on conflict (id) do update set
  name = excluded.name,
  distance_km = excluded.distance_km,
  estimated_duration_minutes = excluded.estimated_duration_minutes;

-- Seed Route Stops
with 
  t as (select id, name from towns),
  p as (select id, name, town_id from pickup_points)
insert into route_stops (route_id, town_id, pickup_point_id, sequence, distance_from_origin_km, estimated_minutes_from_origin)
values
  -- Route 1: Kampala -> Masaka -> Mbarara
  ('a1111111-1111-1111-1111-111111111111', (select id from t where name = 'Kampala'), (select id from p where name = 'Busega Roundabout Stage'), 1, 0, 0),
  ('a1111111-1111-1111-1111-111111111111', (select id from t where name = 'Masaka'), (select id from p where name = 'Nyendo Stage'), 2, 130, 130),
  ('a1111111-1111-1111-1111-111111111111', (select id from t where name = 'Mbarara'), (select id from p where name = 'Independence Park / High St Stage'), 3, 270, 270),

  -- Route 2: Mbarara -> Masaka -> Kampala
  ('a2222222-2222-2222-2222-222222222222', (select id from t where name = 'Mbarara'), (select id from p where name = 'Mbarara Bus & Taxi Park'), 1, 0, 0),
  ('a2222222-2222-2222-2222-222222222222', (select id from t where name = 'Masaka'), (select id from p where name = 'Masaka Main Taxi Park'), 2, 140, 140),
  ('a2222222-2222-2222-2222-222222222222', (select id from t where name = 'Kampala'), (select id from p where name = 'Qualicel Bus Terminal'), 3, 270, 270),

  -- Route 3: Kampala -> Jinja -> Mbale
  ('a3333333-3333-3333-3333-333333333333', (select id from t where name = 'Kampala'), (select id from p where name = 'Banda / Kireka Shell Stage'), 1, 0, 0),
  ('a3333333-3333-3333-3333-333333333333', (select id from t where name = 'Jinja'), (select id from p where name = 'Amber Court Roundabout'), 2, 80, 90),
  ('a3333333-3333-3333-3333-333333333333', (select id from t where name = 'Mbale'), (select id from p where name = 'Republic Street Clock Tower'), 3, 220, 240),

  -- Route 4: Mbale -> Jinja -> Kampala
  ('a4444444-4444-4444-4444-444444444444', (select id from t where name = 'Mbale'), (select id from p where name = 'Mbale Main Taxi Park'), 1, 0, 0),
  ('a4444444-4444-4444-4444-444444444444', (select id from t where name = 'Jinja'), (select id from p where name = 'Jinja Main Taxi & Bus Park'), 2, 140, 150),
  ('a4444444-4444-4444-4444-444444444444', (select id from t where name = 'Kampala'), (select id from p where name = 'Qualicel Bus Terminal'), 3, 220, 240),

  -- Route 5: Kampala -> Gulu
  ('a5555555-5555-5555-5555-555555555555', (select id from t where name = 'Kampala'), (select id from p where name = 'Bwaise Northern Bypass Stage'), 1, 0, 0),
  ('a5555555-5555-5555-5555-555555555555', (select id from t where name = 'Gulu'), (select id from p where name = 'Layibi Stage (Kampala Rd)'), 2, 335, 360),

  -- Route 6: Kampala -> Jinja -> Mbale -> Soroti
  ('a6666666-6666-6666-6666-666666666666', (select id from t where name = 'Kampala'), (select id from p where name = 'Banda / Kireka Shell Stage'), 1, 0, 0),
  ('a6666666-6666-6666-6666-666666666666', (select id from t where name = 'Jinja'), (select id from p where name = 'Amber Court Roundabout'), 2, 80, 90),
  ('a6666666-6666-6666-6666-666666666666', (select id from t where name = 'Mbale'), (select id from p where name = 'Mbale Main Taxi Park'), 3, 220, 240),
  ('a6666666-6666-6666-6666-666666666666', (select id from t where name = 'Soroti'), (select id from p where name = 'Soroti Main Bus Park'), 4, 325, 360)
on conflict (route_id, sequence) do update set
  town_id = excluded.town_id,
  pickup_point_id = excluded.pickup_point_id,
  distance_from_origin_km = excluded.distance_from_origin_km,
  estimated_minutes_from_origin = excluded.estimated_minutes_from_origin;

-- 4. RPC: publish_trip (Creates trip + populates trip_stops from route_stops atomically)
create or replace function publish_trip(
  p_driver_id uuid,
  p_vehicle_id uuid,
  p_route_id uuid,
  p_departs_at timestamptz,
  p_base_fare_ugx int,
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
  select capacity_seats into v_seats from vehicles where id = p_vehicle_id;
  if v_seats is null then
    raise exception 'VEHICLE_NOT_FOUND';
  end if;

  select operator_id into v_operator_id from driver_profiles where id = p_driver_id;
  if v_operator_id is null then
    -- assign default operator
    select get_or_create_driver_operator(user_id) into v_operator_id from driver_profiles where id = p_driver_id;
  end if;

  select estimated_duration_minutes into v_duration from routes where id = p_route_id;

  -- Insert trip
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
  for r_stop in (select * from route_stops where route_id = p_route_id order by sequence) loop
    insert into trip_stops (
      trip_id, route_stop_id, pickup_point_id, sequence,
      scheduled_departure, fare_from_origin_ugx, status
    ) values (
      v_trip_id, r_stop.id, r_stop.pickup_point_id, r_stop.sequence,
      p_departs_at + (coalesce(r_stop.estimated_minutes_from_origin, 0) || ' minutes')::interval,
      round(p_base_fare_ugx * coalesce(r_stop.distance_from_origin_km, 0) / nullif((select distance_km from routes where id = p_route_id), 0)),
      'pending'
    );
  end loop;

  return v_trip_id;
end;
$$;

-- 5. RPC: search_available_trips
-- Finds trips whose stop list covers origin_town -> dest_town, with origin < dest, and computes available seats
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
      v.license_plate as c_vehicle_plate
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
  )) >= p_required_seats
  order by c.c_departs_at asc;
end;
$$;
