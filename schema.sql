-- ============================================================================
-- INTERCITY RIDE PLATFORM — CONSOLIDATED SCHEMA (V1)
-- Reconciles: original architecture + colleague's outline + gap fixes
-- Target: Postgres via Supabase
-- ============================================================================
-- KEY DECISIONS BAKED INTO THIS FILE (see PRD.md §9 for full rationale):
--   1. Seats are tracked by CAPACITY per trip segment, not by named seat
--      (no 1A/1B). Ugandan shared-taxi vehicles rarely assign seat numbers.
--      A "private_vehicle" booking is just a segment spanning the whole trip
--      with seat_count = trip.seats_total — no special-cased table needed.
--   2. Trips are driver-posted and SCHEDULED ONLY. No on-demand/"immediate"
--      dispatch model in V1.
--   3. Locations are two-level: towns (Kampala, Mbarara — used in search and
--      route origin/destination) and pickup_points (a stage, terminal, or
--      landmark within a town — used for actual boarding/alighting).
--   4. THE PLATFORM NEVER TOUCHES FARE MONEY. Passengers pay drivers directly
--      (cash or the driver's own mobile money number). The only money the
--      platform collects is the driver's subscription fee. This removes the
--      need for driver_earnings, driver_payouts, cash_collections and a
--      commission ledger entirely — `payments` exists only for subscriptions
--      and lead top-ups.
-- ============================================================================

create extension if not exists pgcrypto;

-- ============================================================================
-- ENUMS
-- ============================================================================
create type user_role_enum as enum ('passenger','driver','operator','admin','support_agent');
create type operator_type_enum as enum ('individual','fleet','company');
create type verification_status_enum as enum ('pending','verified','rejected');
create type vehicle_status_enum as enum ('active','maintenance','inactive');
create type pickup_point_kind_enum as enum ('terminal','stage','landmark','custom');
create type trip_status_enum as enum ('draft','scheduled','boarding','in_progress','completed','cancelled');
create type booking_type_enum as enum ('seat','private_vehicle');
create type segment_status_enum as enum ('held','confirmed','cancelled','expired','completed');
create type booking_status_enum as enum ('held','confirmed','cancelled','expired','completed');
create type payment_purpose_enum as enum ('subscription','lead_topup');
create type payment_method_enum as enum ('momo','airtel','card','manual');
create type payment_status_enum as enum ('pending','successful','failed','refunded');
create type subscription_status_enum as enum ('trialing','active','grace','expired','cancelled');
create type incident_kind_enum as enum ('sos','accident','breakdown','harassment','other');
create type notification_channel_enum as enum ('sms','push','in_app');

-- ============================================================================
-- DOMAIN 1 — IDENTITY
-- ============================================================================

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  phone text unique,
  email text,
  profile_photo_url text,
  account_status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table profiles is 'Public-facing user record, one per auth.users row. Auth/JWT stays in Supabase Auth; everything the app displays lives here.';

create table user_roles (
  user_id uuid not null references profiles(id) on delete cascade,
  role user_role_enum not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);
comment on table user_roles is 'Many-to-many role assignment so one person can be e.g. both driver and operator without a schema change.';

-- ============================================================================
-- DOMAIN 2 — OPERATORS & FLEET
-- ============================================================================

create table operators (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type operator_type_enum not null default 'individual',
  owner_user_id uuid references profiles(id),
  phone text,
  email text,
  description text,
  status text not null default 'active',
  verification_status verification_status_enum not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table operators is 'The entity that owns vehicles and employs/contracts drivers. A solo driver is their own operator (type=individual); a bus company is type=company with many drivers and vehicles.';

create table driver_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references profiles(id),
  operator_id uuid references operators(id),
  license_number text,
  license_class text,
  license_expiry date,
  national_id text,
  verification_status verification_status_enum not null default 'pending',
  online_status boolean not null default false,
  rating_average numeric(3,2) not null default 0,
  total_trips integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table driver_profiles is 'Driver-specific data layered on top of a profile. national_id is sensitive — never exposed to other users, admin/RLS only.';

create table driver_documents (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references driver_profiles(id) on delete cascade,
  document_type text not null,
  document_number text,
  file_path text not null,
  issue_date date,
  expiry_date date,
  verification_status verification_status_enum not null default 'pending',
  verified_by uuid references profiles(id),
  verified_at timestamptz,
  reject_reason text,
  created_at timestamptz not null default now()
);
comment on table driver_documents is 'Uploaded license/ID/insurance documents for admin review. file_path must point into a PRIVATE Supabase Storage bucket — see PRD §6 (RLS/security).';

create table vehicles (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references operators(id),
  primary_driver_id uuid references driver_profiles(id),
  registration_number text not null unique,
  make text,
  model text,
  year integer,
  color text,
  vehicle_type text,
  seat_capacity integer not null,
  photo_path text,
  insurance_expiry date,
  inspection_expiry date,
  status vehicle_status_enum not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table vehicles is 'A vehicle belongs to an operator and can be reassigned between drivers; primary_driver_id is just the default, not exclusive.';

create table vehicle_documents (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  document_type text not null,
  document_number text,
  file_path text not null,
  issue_date date,
  expiry_date date,
  verification_status verification_status_enum not null default 'pending',
  verified_by uuid references profiles(id),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table vehicle_documents is 'Logbook, insurance, inspection certificate uploads per vehicle.';

-- ============================================================================
-- DOMAIN 3 — GEOGRAPHY
-- ============================================================================

create table towns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  district text,
  region text,
  lat numeric(9,6),
  lng numeric(9,6),
  is_active boolean not null default true
);
comment on table towns is 'Top-level place used for search and as route origin/destination (e.g. Kampala, Mbarara, Soroti).';

create table pickup_points (
  id uuid primary key default gen_random_uuid(),
  town_id uuid not null references towns(id),
  name text not null,
  kind pickup_point_kind_enum not null default 'stage',
  lat numeric(9,6),
  lng numeric(9,6),
  description text,
  is_active boolean not null default true
);
comment on table pickup_points is 'A specific boarding/alighting point inside a town — a taxi stage, bus terminal, or named landmark. This is what actually appears on a trip''s stop list.';
create index idx_pickup_points_town on pickup_points (town_id);

-- ============================================================================
-- DOMAIN 4 — ROUTES (the reusable template)
-- ============================================================================

create table routes (
  id uuid primary key default gen_random_uuid(),
  name text,
  origin_town_id uuid not null references towns(id),
  destination_town_id uuid not null references towns(id),
  distance_km numeric(6,1),
  estimated_duration_minutes integer,
  status text not null default 'active',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table routes is 'A reusable geographical path, e.g. Kampala → Jinja → Iganga → Mbale. Many trips can be posted against one route.';
create index idx_routes_origin_dest on routes (origin_town_id, destination_town_id);

create table route_stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references routes(id) on delete cascade,
  town_id uuid not null references towns(id),
  pickup_point_id uuid references pickup_points(id),
  sequence integer not null,
  distance_from_origin_km numeric(6,1),
  estimated_minutes_from_origin integer,
  pickup_allowed boolean not null default true,
  dropoff_allowed boolean not null default true,
  unique (route_id, sequence)
);
comment on table route_stops is 'The template stop order for a route. A given trip''s actual stops (trip_stops) are copied from this at trip-creation time and can then diverge (delays, an added stop).';

-- ============================================================================
-- DOMAIN 5 — TRIPS (the central object)
-- ============================================================================

create table trips (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references operators(id),
  driver_id uuid not null references driver_profiles(id),
  vehicle_id uuid not null references vehicles(id),
  route_id uuid not null references routes(id),
  departs_at timestamptz not null,
  estimated_arrives_at timestamptz,
  actual_departs_at timestamptz,
  actual_arrives_at timestamptz,
  status trip_status_enum not null default 'scheduled',
  seats_total integer not null,
  base_fare_ugx integer not null,
  min_fare_ugx integer,
  max_fare_ugx integer,
  notes text,
  published_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table trips is 'A specific driver''s scheduled journey on a route. seats_total is a SNAPSHOT of the vehicle''s capacity at creation time, so a later vehicle change never retroactively alters an already-published trip.';
create index idx_trips_search on trips (route_id, departs_at) where status = 'scheduled';
create index idx_trips_driver on trips (driver_id, departs_at);

create table trip_stops (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  route_stop_id uuid references route_stops(id),
  pickup_point_id uuid not null references pickup_points(id),
  sequence integer not null,
  scheduled_arrival timestamptz,
  scheduled_departure timestamptz,
  actual_arrival timestamptz,
  actual_departure timestamptz,
  fare_from_origin_ugx integer,
  status text not null default 'pending',
  unique (trip_id, sequence)
);
comment on table trip_stops is 'The actual stop list for one trip, in order. This is what booking_segments reference — the "route" a passenger''s segment spans between two of these rows.';
create index idx_trip_stops_trip on trip_stops (trip_id, sequence);
create index idx_trip_stops_pickup on trip_stops (pickup_point_id, sequence);

-- ============================================================================
-- DOMAIN 6 — BOOKINGS
-- ============================================================================

create table bookings (
  id uuid primary key default gen_random_uuid(),
  booking_reference text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
  passenger_id uuid not null references profiles(id),
  trip_id uuid not null references trips(id),
  booking_type booking_type_enum not null default 'seat',
  status booking_status_enum not null default 'held',
  total_seats integer not null,
  total_fare_ugx integer not null,
  contact_phone text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  completed_at timestamptz
);
comment on table bookings is 'A passenger''s reservation. total_fare_ugx is shown to the passenger for their own record — it is paid directly to the driver, never processed by the platform.';
create index idx_bookings_passenger on bookings (passenger_id, created_at desc);
create index idx_bookings_trip on bookings (trip_id);

create table booking_segments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  trip_id uuid not null references trips(id),
  origin_trip_stop_id uuid not null references trip_stops(id),
  destination_trip_stop_id uuid not null references trip_stops(id),
  origin_sequence integer not null,
  destination_sequence integer not null,
  seat_count integer not null check (seat_count > 0),
  fare_ugx integer not null,
  status segment_status_enum not null default 'held',
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table booking_segments is 'The actual capacity-holding unit. A private_vehicle booking is just one segment spanning the full trip with seat_count = trip.seats_total — no separate table needed. origin_sequence/destination_sequence are cached from trip_stops for fast overlap checks in book_segment().';
create index idx_segments_trip_status on booking_segments (trip_id, status);

create table booking_passengers (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  full_name text not null,
  phone text,
  seat_count integer not null default 1,
  created_at timestamptz not null default now()
);
comment on table booking_passengers is 'Named travelers under one booking, for "myself plus 3 friends" style reservations.';

-- ============================================================================
-- DOMAIN 7 — DISCOVERY & THE DRIVER RADAR (subscription value driver)
-- ============================================================================

create table search_events (
  id uuid primary key default gen_random_uuid(),
  origin_town_id uuid references towns(id),
  destination_town_id uuid references towns(id),
  travel_date date,
  seats_needed integer,
  result_count integer not null default 0,
  user_id uuid references profiles(id),
  created_at timestamptz not null default now()
);
comment on table search_events is 'Every trip search, including empty ones. Powers admin demand analytics ("N searches for Soroti→Kampala Friday, 0 trips posted").';
create index idx_search_events_route_date on search_events (origin_town_id, destination_town_id, travel_date);

create table trip_alerts (
  id uuid primary key default gen_random_uuid(),
  passenger_id uuid not null references profiles(id),
  origin_town_id uuid not null references towns(id),
  destination_town_id uuid not null references towns(id),
  travel_date date not null,
  seats_needed integer not null default 1,
  status text not null default 'open',
  created_at timestamptz not null default now()
);
comment on table trip_alerts is 'A passenger opts in to be notified/visible when no trip matched their search. This is the "radar" a subscribed driver spends leads to see.';
create index idx_trip_alerts_match on trip_alerts (origin_town_id, destination_town_id, travel_date, status);

create table lead_views (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references driver_profiles(id),
  trip_alert_id uuid not null references trip_alerts(id),
  viewed_at timestamptz not null default now(),
  unique (driver_id, trip_alert_id)
);
comment on table lead_views is 'Records that a driver spent one subscription "lead" credit revealing a trip_alert''s passenger contact. Re-viewing the same alert is free (see reveal_lead()).';

-- ============================================================================
-- DOMAIN 8 — SUBSCRIPTIONS (the platform''s only revenue mechanism in V1)
-- ============================================================================

create table subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price_ugx integer not null,
  period_days integer not null,
  max_trips_per_period integer not null,
  max_leads_per_period integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
comment on table subscription_plans is 'Numeric caps live as columns (not EAV) because enforce_trip_quota() and reveal_lead() need to read them on every write — a hot path.';

create table subscription_features (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references subscription_plans(id) on delete cascade,
  feature_key text not null,
  feature_value text not null,
  unique (plan_id, feature_key)
);
comment on table subscription_features is 'Cosmetic/perk flags that do not need enforcement logic (e.g. verified_badge=true, priority_listing=true). Kept separate from the numeric caps above.';

create table driver_subscriptions (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references driver_profiles(id),
  plan_id uuid not null references subscription_plans(id),
  status subscription_status_enum not null default 'trialing',
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  payment_id uuid,
  created_at timestamptz not null default now()
);
comment on table driver_subscriptions is 'One row per subscription period. A renewal inserts a new row (see activate_subscription()) rather than mutating the old one, so history is preserved.';
create index idx_driver_subs_active on driver_subscriptions (driver_id, status, ends_at desc);

create table subscription_usage (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references driver_profiles(id),
  period_start date not null,
  trips_posted integer not null default 0,
  leads_viewed integer not null default 0,
  extra_trips integer not null default 0,
  extra_leads integer not null default 0,
  unique (driver_id, period_start)
);
comment on table subscription_usage is 'Per-period counters checked by enforce_trip_quota() and reveal_lead(). extra_* comes from top-up packs bought mid-period.';

-- ============================================================================
-- DOMAIN 9 — PAYMENTS (subscriptions and lead top-ups ONLY — never fares)
-- ============================================================================

create table payments (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references driver_profiles(id),
  plan_id uuid references subscription_plans(id),
  purpose payment_purpose_enum not null,
  amount_ugx integer not null,
  method payment_method_enum not null,
  status payment_status_enum not null default 'pending',
  provider text,
  provider_ref text,
  idempotency_key text unique,
  raw_callback jsonb,
  applied boolean not null default false,
  initiated_at timestamptz not null default now(),
  completed_at timestamptz
);
comment on table payments is 'Platform revenue only — driver subscription fees and lead top-ups. Passenger fares never appear here; they are paid to the driver directly. applied=true guards activate_subscription() against double-processing a retried webhook.';

alter table driver_subscriptions add constraint fk_driver_sub_payment foreign key (payment_id) references payments(id);

-- ============================================================================
-- DOMAIN 10 — TRUST & SAFETY
-- ============================================================================

create table ratings (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id),
  booking_id uuid references bookings(id),
  reviewer_id uuid not null references profiles(id),
  reviewee_id uuid not null references profiles(id),
  score integer not null check (score between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);
comment on table ratings is 'Works both directions: passenger→driver and driver→passenger.';

create table emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  name text not null,
  phone text not null,
  relationship text,
  created_at timestamptz not null default now()
);

create table trip_shares (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id),
  share_token text not null unique default replace(gen_random_uuid()::text,'-',''),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
comment on table trip_shares is 'Lets a passenger share a live trip-tracking link with a trusted contact without giving them app access.';

create table incidents (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id),
  booking_id uuid references bookings(id),
  reported_by uuid not null references profiles(id),
  kind incident_kind_enum not null,
  lat numeric(9,6),
  lng numeric(9,6),
  description text,
  status text not null default 'open',
  handled_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
comment on table incidents is 'SOS presses, accidents, breakdowns and harassment reports all live here (kind column) — merged from the colleague''s separate sos_events table since they share the same shape and workflow.';

-- ============================================================================
-- DOMAIN 11 — TRACKING & AUDIT TRAIL
-- ============================================================================

create table trip_locations (
  id bigserial primary key,
  trip_id uuid not null references trips(id),
  driver_id uuid not null references driver_profiles(id),
  lat numeric(9,6) not null,
  lng numeric(9,6) not null,
  speed numeric(5,1),
  heading numeric(5,1),
  accuracy numeric(6,1),
  recorded_at timestamptz not null default now()
);
comment on table trip_locations is 'High write volume — write every 15-30s from the driver app, not on every GPS tick. Purge rows older than a few days once a trip is completed. Consider moving this to a dedicated realtime store if volume grows.';
create index idx_trip_locations_trip on trip_locations (trip_id, recorded_at desc);

create table trip_events (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id),
  event_type text not null,
  pickup_point_id uuid references pickup_points(id),
  lat numeric(9,6),
  lng numeric(9,6),
  created_by uuid references profiles(id),
  metadata jsonb,
  created_at timestamptz not null default now()
);
comment on table trip_events is 'Audit trail of trip state changes: TRIP_PUBLISHED, DRIVER_STARTED, STOP_REACHED, TRIP_DELAYED, TRIP_COMPLETED, TRIP_CANCELLED, etc. Cheap and valuable for disputes.';

-- ============================================================================
-- DOMAIN 12 — COMMUNICATION
-- ============================================================================

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  channel notification_channel_enum not null,
  type text not null,
  title text,
  body text,
  data jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_notifications_user on notifications (user_id, created_at desc);

create table push_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  endpoint text not null,
  keys jsonb not null,
  user_agent text,
  created_at timestamptz not null default now()
);
comment on table push_notifications is 'Web push registration per user (also referred to as push subscriptions).';
create or replace view push_subscriptions as select * from push_notifications;

create table support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  trip_id uuid references trips(id),
  booking_id uuid references bookings(id),
  category text,
  subject text not null,
  description text,
  priority text not null default 'normal',
  status text not null default 'open',
  assigned_to uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references support_tickets(id) on delete cascade,
  sender_id uuid not null references profiles(id),
  message text not null,
  attachment_url text,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- DOMAIN 13 — MARKETING (optional, post-V1 — included for schema stability)
-- ============================================================================

create table promotions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text,
  description text,
  discount_type text,
  discount_value numeric,
  minimum_amount integer,
  maximum_discount integer,
  start_date date,
  end_date date,
  usage_limit integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table promotion_redemptions (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references promotions(id),
  user_id uuid not null references profiles(id),
  booking_id uuid references bookings(id),
  discount_amount integer,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- FUNCTIONS — ATOMIC SEGMENT BOOKING (the technically critical piece)
-- ============================================================================

-- book_segment: reserves seats on a trip between two of its stops, checking
-- capacity across every inter-stop gap the requested segment overlaps.
-- Uses an advisory lock per trip to serialize concurrent booking attempts,
-- since the overlap check can't be expressed as a single Postgres constraint.
create or replace function book_segment(
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
  v_seats_total int;
  v_max_occupied int;
  v_booking_id uuid;
  v_segment_id uuid;
  v_expires_at timestamptz;
begin
  perform pg_advisory_xact_lock(hashtext(p_trip_id::text));

  select sequence into v_origin_seq from trip_stops where id = p_origin_trip_stop_id and trip_id = p_trip_id;
  select sequence into v_dest_seq from trip_stops where id = p_destination_trip_stop_id and trip_id = p_trip_id;

  if v_origin_seq is null or v_dest_seq is null then
    raise exception 'STOP_NOT_ON_TRIP';
  end if;
  if v_origin_seq >= v_dest_seq then
    raise exception 'INVALID_STOP_ORDER';
  end if;

  select seats_total into v_seats_total from trips where id = p_trip_id for update;
  if v_seats_total is null then
    raise exception 'TRIP_NOT_FOUND';
  end if;

  -- lazily expire any holds that lapsed before we compute occupancy
  update booking_segments
     set status = 'expired'
   where trip_id = p_trip_id and status = 'held' and expires_at < now();

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

  if v_max_occupied + p_seat_count > v_seats_total then
    raise exception 'SEATS_UNAVAILABLE';
  end if;

  v_expires_at := now() + (p_hold_minutes || ' minutes')::interval;

  insert into bookings (passenger_id, trip_id, booking_type, status, total_seats, total_fare_ugx)
  values (p_passenger_id, p_trip_id, p_booking_type, 'held', p_seat_count, p_fare_ugx)
  returning id into v_booking_id;

  insert into booking_segments (
    booking_id, trip_id, origin_trip_stop_id, destination_trip_stop_id,
    origin_sequence, destination_sequence, seat_count, fare_ugx, status, expires_at
  ) values (
    v_booking_id, p_trip_id, p_origin_trip_stop_id, p_destination_trip_stop_id,
    v_origin_seq, v_dest_seq, p_seat_count, p_fare_ugx, 'held', v_expires_at
  ) returning id into v_segment_id;

  return query select v_booking_id, v_segment_id, v_expires_at;
end;
$$;
comment on function book_segment is 'A private_vehicle booking calls this with origin=first stop, destination=last stop, seat_count=trip.seats_total — no separate code path.';

create or replace function confirm_booking(p_booking_id uuid) returns void
language plpgsql
security definer
set search_path = public as $$
declare
  v_confirmed int;
begin
  update booking_segments
     set status = 'confirmed'
   where booking_id = p_booking_id and status = 'held' and expires_at > now();
  get diagnostics v_confirmed = row_count;

  if v_confirmed = 0 then
    raise exception 'HOLD_EXPIRED_OR_NOT_FOUND';
  end if;

  update bookings set status = 'confirmed', confirmed_at = now() where id = p_booking_id;
end;
$$;

create or replace function cancel_booking(p_booking_id uuid, p_reason text default null) returns void
language plpgsql
security definer
set search_path = public as $$
begin
  update booking_segments set status = 'cancelled' where booking_id = p_booking_id and status in ('held','confirmed');
  update bookings set status = 'cancelled', cancelled_at = now(), cancel_reason = p_reason where id = p_booking_id;
end;
$$;

-- Run on a schedule (pg_cron, every minute) to sweep abandoned holds even
-- when nobody else tries to book the same trip afterward.
create or replace function expire_stale_holds() returns void
language plpgsql
security definer
set search_path = public as $$
begin
  update booking_segments set status = 'expired' where status = 'held' and expires_at < now();
  update bookings b set status = 'expired'
   where b.status = 'held'
     and not exists (select 1 from booking_segments where booking_id = b.id and status in ('held','confirmed'));
end;
$$;

-- ============================================================================
-- FUNCTIONS — SUBSCRIPTION ENFORCEMENT & RADAR
-- ============================================================================

create or replace function enforce_trip_quota() returns trigger
language plpgsql
security definer
set search_path = public as $$
declare
  v_period_start date;
  v_max_trips int;
  v_used int;
  v_extra int;
begin
  -- Only count/enforce quota when a trip is being published/scheduled.
  -- Ignore drafts or trips that were already scheduled and are just being updated.
  if new.status != 'scheduled' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'scheduled' then
    return new;
  end if;

  select ds.starts_at::date, sp.max_trips_per_period
    into v_period_start, v_max_trips
  from driver_subscriptions ds
  join subscription_plans sp on sp.id = ds.plan_id
  where ds.driver_id = new.driver_id
    and ds.status in ('active','trialing','grace')
    and (ds.ends_at >= now() or ds.status = 'grace')
  order by ds.starts_at desc limit 1;

  if v_max_trips is null then
    raise exception 'NO_ACTIVE_SUBSCRIPTION';
  end if;

  insert into subscription_usage (driver_id, period_start, trips_posted)
  values (new.driver_id, v_period_start, 0)
  on conflict (driver_id, period_start) do nothing;

  select trips_posted, extra_trips into v_used, v_extra
  from subscription_usage where driver_id = new.driver_id and period_start = v_period_start
  for update;

  if v_used >= v_max_trips + coalesce(v_extra, 0) then
    raise exception 'TRIP_QUOTA_REACHED';
  end if;

  update subscription_usage set trips_posted = trips_posted + 1
   where driver_id = new.driver_id and period_start = v_period_start;

  return new;
end;
$$;

drop trigger if exists trg_enforce_trip_quota on trips;
create trigger trg_enforce_trip_quota
  before insert or update of status on trips
  for each row execute function enforce_trip_quota();

-- reveal_lead: spends one subscription "lead" credit to reveal a trip_alert's
-- passenger contact. Re-viewing an already-revealed alert is free.
create or replace function reveal_lead(p_driver_id uuid, p_trip_alert_id uuid)
returns table (passenger_phone text)
language plpgsql security definer
set search_path = public as $$
declare
  v_period_start date;
  v_max_leads int;
  v_used int;
  v_extra int;
begin
  perform pg_advisory_xact_lock(hashtext(p_driver_id::text || ':leads'));

  if exists (select 1 from lead_views where driver_id = p_driver_id and trip_alert_id = p_trip_alert_id) then
    return query
      select p.phone from trip_alerts ta join profiles p on p.id = ta.passenger_id
      where ta.id = p_trip_alert_id;
    return;
  end if;

  select ds.starts_at::date, sp.max_leads_per_period
    into v_period_start, v_max_leads
  from driver_subscriptions ds
  join subscription_plans sp on sp.id = ds.plan_id
  where ds.driver_id = p_driver_id
    and ds.status in ('active','trialing','grace')
    and (ds.ends_at >= now() or ds.status = 'grace')
  order by ds.starts_at desc limit 1;

  if v_max_leads is null then
    raise exception 'NO_ACTIVE_SUBSCRIPTION';
  end if;

  insert into subscription_usage (driver_id, period_start, leads_viewed)
  values (p_driver_id, v_period_start, 0)
  on conflict (driver_id, period_start) do nothing;

  select leads_viewed, extra_leads into v_used, v_extra
  from subscription_usage where driver_id = p_driver_id and period_start = v_period_start
  for update;

  if v_used >= v_max_leads + coalesce(v_extra, 0) then
    raise exception 'LEAD_LIMIT_REACHED';
  end if;

  update subscription_usage set leads_viewed = leads_viewed + 1
   where driver_id = p_driver_id and period_start = v_period_start;

  insert into lead_views (driver_id, trip_alert_id) values (p_driver_id, p_trip_alert_id);

  return query
    select p.phone from trip_alerts ta join profiles p on p.id = ta.passenger_id
    where ta.id = p_trip_alert_id;
end;
$$;

-- check_subscription_expiry: sweeps subscriptions whose ends_at has passed.
-- Moves active subscriptions to 'grace' (default 3 days), and grace/expired subscriptions to 'expired'.
create or replace function check_subscription_expiry(p_grace_days int default 3) returns void
language plpgsql
security definer
set search_path = public as $$
begin
  -- Move active subscriptions past ends_at into grace period
  update driver_subscriptions
     set status = 'grace'
   where status = 'active'
     and ends_at < now()
     and ends_at >= now() - (p_grace_days || ' days')::interval;

  -- Move subscriptions beyond grace period into expired
  update driver_subscriptions
     set status = 'expired'
   where status in ('active', 'grace', 'trialing')
     and ends_at < now() - (p_grace_days || ' days')::interval;
end;
$$;

-- activate_subscription: called after a subscription payment succeeds
-- (from the webhook Edge Function). Idempotent via payments.applied, and
-- stacks a renewal onto the current period's end rather than from "now" if
-- the driver still has time left.
create or replace function activate_subscription(p_payment_id uuid) returns void
language plpgsql
security definer
set search_path = public as $$
declare
  v_driver_id uuid;
  v_plan_id uuid;
  v_period_days int;
  v_already boolean;
  v_current_end timestamptz;
begin
  select driver_id, plan_id, applied into v_driver_id, v_plan_id, v_already
  from payments where id = p_payment_id and purpose = 'subscription' and status = 'successful';

  if v_driver_id is null then
    raise exception 'PAYMENT_NOT_ELIGIBLE';
  end if;
  if v_already then
    return;
  end if;

  select period_days into v_period_days from subscription_plans where id = v_plan_id;

  select ends_at into v_current_end from driver_subscriptions
   where driver_id = v_driver_id and status in ('active','trialing','grace')
   order by ends_at desc limit 1;

  insert into driver_subscriptions (driver_id, plan_id, status, starts_at, ends_at, payment_id)
  values (
    v_driver_id, v_plan_id, 'active',
    now(),
    greatest(now(), coalesce(v_current_end, now())) + (v_period_days || ' days')::interval,
    p_payment_id
  );

  update payments set applied = true where id = p_payment_id;
end;
$$;

-- credit_lead_topup: called when a lead_topup payment succeeds.
-- Credits extra leads to the current active subscription usage period.
create or replace function credit_lead_topup(p_payment_id uuid, p_leads_count int default 10) returns void
language plpgsql
security definer
set search_path = public as $$
declare
  v_driver_id uuid;
  v_already boolean;
  v_period_start date;
begin
  select driver_id, applied into v_driver_id, v_already
  from payments where id = p_payment_id and purpose = 'lead_topup' and status = 'successful';

  if v_driver_id is null then
    raise exception 'PAYMENT_NOT_ELIGIBLE';
  end if;
  if v_already then
    return;
  end if;

  select starts_at::date into v_period_start
  from driver_subscriptions
  where driver_id = v_driver_id and status in ('active','trialing','grace')
  order by starts_at desc limit 1;

  if v_period_start is null then
    raise exception 'NO_ACTIVE_SUBSCRIPTION';
  end if;

  insert into subscription_usage (driver_id, period_start, extra_leads)
  values (v_driver_id, v_period_start, p_leads_count)
  on conflict (driver_id, period_start)
  do update set extra_leads = subscription_usage.extra_leads + p_leads_count;

  update payments set applied = true where id = p_payment_id;
end;
$$;

-- process_payment_callback: unified dispatcher for payment webhook callbacks.
create or replace function process_payment_callback(p_payment_id uuid) returns void
language plpgsql
security definer
set search_path = public as $$
declare
  v_purpose payment_purpose_enum;
  v_leads_count int;
begin
  select purpose, coalesce((raw_callback->>'leads_count')::int, 10)
    into v_purpose, v_leads_count
  from payments where id = p_payment_id and status = 'successful';

  if v_purpose is null then
    raise exception 'PAYMENT_NOT_FOUND_OR_UNSUCCESSFUL';
  end if;

  if v_purpose = 'subscription' then
    perform activate_subscription(p_payment_id);
  elsif v_purpose = 'lead_topup' then
    perform credit_lead_topup(p_payment_id, v_leads_count);
  end if;
end;
$$;

-- Automated trigger: recompute driver rating average on rating insert/update/delete
create or replace function update_driver_rating_average() returns trigger
language plpgsql
security definer
set search_path = public as $$
declare
  v_target_user_id uuid;
begin
  v_target_user_id := coalesce(new.reviewee_id, old.reviewee_id);

  update driver_profiles
     set rating_average = coalesce((
       select round(avg(score)::numeric, 2)
       from ratings
       where reviewee_id = v_target_user_id
     ), 0)
   where user_id = v_target_user_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_update_driver_rating on ratings;
create trigger trg_update_driver_rating
  after insert or update of score or delete on ratings
  for each row execute function update_driver_rating_average();

-- Automated trigger: increment driver's total_trips when a trip is marked completed
create or replace function increment_driver_total_trips() returns trigger
language plpgsql
security definer
set search_path = public as $$
begin
  if new.status = 'completed' and (old.status is null or old.status != 'completed') then
    update driver_profiles
       set total_trips = total_trips + 1
     where id = new.driver_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_increment_driver_total_trips on trips;
create trigger trg_increment_driver_total_trips
  after update of status on trips
  for each row execute function increment_driver_total_trips();

-- ============================================================================
-- ROW LEVEL SECURITY — COMPREHENSIVE PRODUCTION POLICIES (All 36 Tables)
-- ============================================================================

-- Security helper functions
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin');
$$;

create or replace function is_support() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = auth.uid() and role in ('admin', 'support_agent'));
$$;

create or replace function is_driver() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = auth.uid() and role = 'driver');
$$;

create or replace function current_driver_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from driver_profiles where user_id = auth.uid();
$$;

-- DOMAIN 1 — IDENTITY
alter table profiles enable row level security;
create policy profiles_select on profiles for select using (true);
create policy profiles_insert on profiles for insert with check (id = auth.uid() or is_admin());
create policy profiles_update on profiles for update using (id = auth.uid() or is_admin());

alter table user_roles enable row level security;
create policy user_roles_select on user_roles for select using (user_id = auth.uid() or is_admin());
create policy user_roles_admin on user_roles for all using (is_admin());

-- DOMAIN 2 — OPERATORS & FLEET
alter table operators enable row level security;
create policy operators_select on operators for select using (true);
create policy operators_manage on operators for all using (owner_user_id = auth.uid() or is_admin());

alter table driver_profiles enable row level security;
create policy driver_profiles_select on driver_profiles for select using (true);
create policy driver_profiles_manage on driver_profiles for all using (user_id = auth.uid() or is_admin());

alter table driver_documents enable row level security;
create policy driver_documents_select on driver_documents for select using (driver_id = current_driver_id() or is_admin());
create policy driver_documents_insert on driver_documents for insert with check (driver_id = current_driver_id() or is_admin());
create policy driver_documents_update on driver_documents for update using (driver_id = current_driver_id() or is_admin());
create policy driver_documents_delete on driver_documents for delete using (driver_id = current_driver_id() or is_admin());

alter table vehicles enable row level security;
create policy vehicles_select on vehicles for select using (true);
create policy vehicles_manage on vehicles for all using (
  operator_id in (select id from operators where owner_user_id = auth.uid()) or
  primary_driver_id = current_driver_id() or
  is_admin()
);

alter table vehicle_documents enable row level security;
create policy vehicle_documents_select on vehicle_documents for select using (
  vehicle_id in (
    select id from vehicles
    where operator_id in (select id from operators where owner_user_id = auth.uid()) or
          primary_driver_id = current_driver_id()
  ) or is_admin()
);
create policy vehicle_documents_manage on vehicle_documents for all using (
  vehicle_id in (
    select id from vehicles
    where operator_id in (select id from operators where owner_user_id = auth.uid()) or
          primary_driver_id = current_driver_id()
  ) or is_admin()
);

-- DOMAIN 3 — GEOGRAPHY
alter table towns enable row level security;
create policy towns_select on towns for select using (true);
create policy towns_admin on towns for all using (is_admin());

alter table pickup_points enable row level security;
create policy pickup_points_select on pickup_points for select using (true);
create policy pickup_points_admin on pickup_points for all using (is_admin());

-- DOMAIN 4 — ROUTES
alter table routes enable row level security;
create policy routes_select on routes for select using (true);
create policy routes_admin on routes for all using (is_admin());

alter table route_stops enable row level security;
create policy route_stops_select on route_stops for select using (true);
create policy route_stops_admin on route_stops for all using (is_admin());

-- DOMAIN 5 — TRIPS
alter table trips enable row level security;
create policy trips_select on trips for select using (
  status in ('scheduled','boarding','in_progress','completed') or
  driver_id = current_driver_id() or
  is_admin()
);
create policy trips_driver_manage on trips for all using (driver_id = current_driver_id() or is_admin());

alter table trip_stops enable row level security;
create policy trip_stops_select on trip_stops for select using (true);
create policy trip_stops_manage on trip_stops for all using (
  trip_id in (select id from trips where driver_id = current_driver_id()) or is_admin()
);

-- DOMAIN 6 — BOOKINGS
alter table bookings enable row level security;
create policy bookings_select on bookings for select using (
  passenger_id = auth.uid() or
  trip_id in (select id from trips where driver_id = current_driver_id()) or
  is_admin()
);
create policy bookings_insert on bookings for insert with check (passenger_id = auth.uid() or is_admin());
create policy bookings_update on bookings for update using (
  passenger_id = auth.uid() or
  trip_id in (select id from trips where driver_id = current_driver_id()) or
  is_admin()
);

alter table booking_segments enable row level security;
create policy booking_segments_select on booking_segments for select using (
  booking_id in (select id from bookings where passenger_id = auth.uid()) or
  trip_id in (select id from trips where driver_id = current_driver_id()) or
  is_admin()
);
create policy booking_segments_admin on booking_segments for all using (is_admin());

alter table booking_passengers enable row level security;
create policy booking_passengers_select on booking_passengers for select using (
  booking_id in (select id from bookings where passenger_id = auth.uid()) or
  booking_id in (select b.id from bookings b join trips t on t.id = b.trip_id where t.driver_id = current_driver_id()) or
  is_admin()
);
create policy booking_passengers_manage on booking_passengers for all using (
  booking_id in (select id from bookings where passenger_id = auth.uid()) or is_admin()
);

-- DOMAIN 7 — DISCOVERY & RADAR
alter table search_events enable row level security;
create policy search_events_insert on search_events for insert with check (true);
create policy search_events_select on search_events for select using (user_id = auth.uid() or is_admin());

alter table trip_alerts enable row level security;
create policy trip_alerts_select on trip_alerts for select using (passenger_id = auth.uid() or is_driver() or is_admin());
create policy trip_alerts_manage on trip_alerts for all using (passenger_id = auth.uid() or is_admin());

alter table lead_views enable row level security;
create policy lead_views_select on lead_views for select using (driver_id = current_driver_id() or is_admin());
create policy lead_views_admin on lead_views for all using (is_admin());

-- DOMAIN 8 — SUBSCRIPTIONS
alter table subscription_plans enable row level security;
create policy sub_plans_select on subscription_plans for select using (true);
create policy sub_plans_admin on subscription_plans for all using (is_admin());

alter table subscription_features enable row level security;
create policy sub_features_select on subscription_features for select using (true);
create policy sub_features_admin on subscription_features for all using (is_admin());

alter table driver_subscriptions enable row level security;
create policy driver_subs_select on driver_subscriptions for select using (driver_id = current_driver_id() or is_admin());
create policy driver_subs_admin on driver_subscriptions for all using (is_admin());

alter table subscription_usage enable row level security;
create policy sub_usage_select on subscription_usage for select using (driver_id = current_driver_id() or is_admin());
create policy sub_usage_admin on subscription_usage for all using (is_admin());

-- DOMAIN 9 — PAYMENTS
alter table payments enable row level security;
create policy payments_select on payments for select using (driver_id = current_driver_id() or is_admin());
create policy payments_insert on payments for insert with check (driver_id = current_driver_id() or is_admin());
create policy payments_admin on payments for all using (is_admin());

-- DOMAIN 10 — TRUST & SAFETY
alter table ratings enable row level security;
create policy ratings_select on ratings for select using (true);
create policy ratings_insert on ratings for insert with check (reviewer_id = auth.uid());
create policy ratings_update on ratings for update using (reviewer_id = auth.uid() or is_admin());
create policy ratings_delete on ratings for delete using (reviewer_id = auth.uid() or is_admin());

alter table emergency_contacts enable row level security;
create policy emergency_contacts_all on emergency_contacts for all using (user_id = auth.uid() or is_admin());

alter table trip_shares enable row level security;
create policy trip_shares_select on trip_shares for select using (true);
create policy trip_shares_manage on trip_shares for all using (
  booking_id in (select id from bookings where passenger_id = auth.uid()) or is_admin()
);

alter table incidents enable row level security;
create policy incidents_select on incidents for select using (
  reported_by = auth.uid() or
  trip_id in (select id from trips where driver_id = current_driver_id()) or
  is_admin() or
  is_support()
);
create policy incidents_insert on incidents for insert with check (reported_by = auth.uid() or is_admin());
create policy incidents_update on incidents for update using (is_admin() or is_support());

-- DOMAIN 11 — TRACKING & AUDIT
alter table trip_locations enable row level security;
create policy trip_locations_select on trip_locations for select using (true);
create policy trip_locations_insert on trip_locations for insert with check (driver_id = current_driver_id() or is_admin());

alter table trip_events enable row level security;
create policy trip_events_select on trip_events for select using (true);
create policy trip_events_insert on trip_events for insert with check (created_by = auth.uid() or is_admin());

-- DOMAIN 12 — COMMUNICATION
alter table notifications enable row level security;
create policy notifications_all on notifications for all using (user_id = auth.uid() or is_admin());

alter table push_notifications enable row level security;
create policy push_notifications_all on push_notifications for all using (user_id = auth.uid() or is_admin());

alter table support_tickets enable row level security;
create policy support_tickets_select on support_tickets for select using (user_id = auth.uid() or is_admin() or is_support());
create policy support_tickets_insert on support_tickets for insert with check (user_id = auth.uid());
create policy support_tickets_update on support_tickets for update using (user_id = auth.uid() or is_admin() or is_support());

alter table support_messages enable row level security;
create policy support_messages_select on support_messages for select using (
  ticket_id in (select id from support_tickets where user_id = auth.uid()) or is_admin() or is_support()
);
create policy support_messages_insert on support_messages for insert with check (sender_id = auth.uid());

-- DOMAIN 13 — MARKETING
alter table promotions enable row level security;
create policy promotions_select on promotions for select using (is_active = true or is_admin());
create policy promotions_admin on promotions for all using (is_admin());

alter table promotion_redemptions enable row level security;
create policy promo_redemptions_select on promotion_redemptions for select using (user_id = auth.uid() or is_admin());
create policy promo_redemptions_insert on promotion_redemptions for insert with check (user_id = auth.uid() or is_admin());

-- ============================================================================
-- PHASE 4 — TRACKING, SAFETY, INCIDENTS & REALTIME FUNCTIONS
-- ============================================================================

-- Function: record_trip_location
create or replace function record_trip_location(
  p_trip_id uuid,
  p_lat numeric,
  p_lng numeric,
  p_speed numeric default null,
  p_heading numeric default null,
  p_accuracy numeric default null
) returns jsonb
language plpgsql
security definer
set search_path = public as $$
declare
  v_driver_id uuid;
  v_inserted_id bigint;
begin
  select driver_id into v_driver_id from trips where id = p_trip_id;
  if v_driver_id is null then
    raise exception 'Trip not found: %', p_trip_id;
  end if;

  insert into trip_locations (trip_id, driver_id, lat, lng, speed, heading, accuracy, recorded_at)
  values (p_trip_id, v_driver_id, p_lat, p_lng, p_speed, p_heading, p_accuracy, now())
  returning id into v_inserted_id;

  return jsonb_build_object(
    'id', v_inserted_id,
    'trip_id', p_trip_id,
    'lat', p_lat,
    'lng', p_lng,
    'speed', p_speed,
    'recorded_at', now()
  );
end;
$$;

-- Function: report_incident / SOS
create or replace function report_incident(
  p_trip_id uuid default null,
  p_booking_id uuid default null,
  p_kind incident_kind_enum default 'sos',
  p_lat numeric default null,
  p_lng numeric default null,
  p_description text default null,
  p_reported_by uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public as $$
declare
  v_user_id uuid;
  v_incident_id uuid;
  v_trip_id uuid;
begin
  v_user_id := coalesce(auth.uid(), p_reported_by);
  v_trip_id := p_trip_id;

  if v_trip_id is null and p_booking_id is not null then
    select trip_id, coalesce(v_user_id, passenger_id)
      into v_trip_id, v_user_id
      from bookings where id = p_booking_id;
  end if;

  if v_user_id is null then
    select id into v_user_id from profiles limit 1;
  end if;

  insert into incidents (trip_id, booking_id, reported_by, kind, lat, lng, description, status)
  values (v_trip_id, p_booking_id, v_user_id, p_kind, p_lat, p_lng, p_description, 'open')
  returning id into v_incident_id;

  if v_trip_id is not null then
    insert into trip_events (trip_id, event_type, lat, lng, created_by, metadata)
    values (
      v_trip_id,
      'INCIDENT_REPORTED',
      p_lat,
      p_lng,
      v_user_id,
      jsonb_build_object('incident_id', v_incident_id, 'kind', p_kind, 'description', p_description)
    );
  end if;

  return jsonb_build_object(
    'incident_id', v_incident_id,
    'status', 'open',
    'kind', p_kind,
    'created_at', now()
  );
end;
$$;

-- Function: create_trip_share
create or replace function create_trip_share(
  p_booking_id uuid,
  p_hours_valid int default 48
) returns jsonb
language plpgsql
security definer
set search_path = public as $$
declare
  v_share trip_shares%rowtype;
begin
  select * into v_share
    from trip_shares
   where booking_id = p_booking_id
     and expires_at > now()
   order by created_at desc
   limit 1;

  if v_share.id is not null then
    return jsonb_build_object(
      'id', v_share.id,
      'share_token', v_share.share_token,
      'expires_at', v_share.expires_at
    );
  end if;

  insert into trip_shares (booking_id, expires_at)
  values (p_booking_id, now() + (p_hours_valid || ' hours')::interval)
  returning * into v_share;

  return jsonb_build_object(
    'id', v_share.id,
    'share_token', v_share.share_token,
    'expires_at', v_share.expires_at
  );
end;
$$;

-- Function: get_public_trip_tracking
create or replace function get_public_trip_tracking(p_share_token text)
returns jsonb
language plpgsql
security definer
set search_path = public as $$
declare
  v_share record;
  v_booking record;
  v_trip record;
  v_latest_location record;
  v_breadcrumbs jsonb;
  v_stops jsonb;
begin
  select * into v_share
    from trip_shares
   where share_token = p_share_token
     and expires_at > now();

  if v_share.id is null then
    return jsonb_build_object('error', 'Tracking link has expired or is invalid');
  end if;

  select b.id, b.booking_reference, b.total_seats, b.status as booking_status,
         p.first_name as passenger_first_name, p.phone as passenger_phone,
         b.trip_id
    into v_booking
    from bookings b
    left join profiles p on p.id = b.passenger_id
   where b.id = v_share.booking_id;

  select t.id as trip_id, t.status as trip_status, t.departs_at, t.estimated_arrives_at,
         r.name as route_name,
         ot.name as origin_town, dt.name as dest_town,
         dp.rating_average as driver_rating, dp.total_trips as driver_total_trips,
         du.first_name as driver_first_name, du.last_name as driver_last_name, du.phone as driver_phone,
         v.make as vehicle_make, v.model as vehicle_model, v.color as vehicle_color, v.license_plate as vehicle_plate
    into v_trip
    from trips t
    left join routes r on r.id = t.route_id
    left join towns ot on ot.id = r.origin_town_id
    left join towns dt on dt.id = r.destination_town_id
    left join driver_profiles dp on dp.id = t.driver_id
    left join profiles du on du.id = dp.user_id
    left join vehicles v on v.id = t.vehicle_id
   where t.id = v_booking.trip_id;

  select lat, lng, speed, heading, accuracy, recorded_at
    into v_latest_location
    from trip_locations
   where trip_id = v_trip.trip_id
   order by recorded_at desc
   limit 1;

  select coalesce(jsonb_agg(loc order by loc.recorded_at asc), '[]'::jsonb)
    into v_breadcrumbs
    from (
      select lat, lng, speed, recorded_at
        from trip_locations
       where trip_id = v_trip.trip_id
       order by recorded_at desc
       limit 20
    ) loc;

  select coalesce(jsonb_agg(jsonb_build_object(
      'sequence', ts.sequence,
      'stage_name', pp.name,
      'town_name', tw.name,
      'status', ts.status
    ) order by ts.sequence asc), '[]'::jsonb)
    into v_stops
    from trip_stops ts
    left join pickup_points pp on pp.id = ts.pickup_point_id
    left join towns tw on tw.id = pp.town_id
   where ts.trip_id = v_trip.trip_id;

  return jsonb_build_object(
    'share_token', p_share_token,
    'expires_at', v_share.expires_at,
    'booking', jsonb_build_object(
      'reference', v_booking.booking_reference,
      'passenger_first_name', v_booking.passenger_first_name,
      'seats', v_booking.total_seats,
      'status', v_booking.booking_status
    ),
    'trip', jsonb_build_object(
      'id', v_trip.trip_id,
      'status', v_trip.trip_status,
      'route_name', v_trip.route_name,
      'origin_town', v_trip.origin_town,
      'dest_town', v_trip.dest_town,
      'departs_at', v_trip.departs_at,
      'estimated_arrives_at', v_trip.estimated_arrives_at
    ),
    'driver', jsonb_build_object(
      'name', trim(coalesce(v_trip.driver_first_name, '') || ' ' || coalesce(v_trip.driver_last_name, '')),
      'phone', v_trip.driver_phone,
      'rating', v_trip.driver_rating,
      'total_trips', v_trip.driver_total_trips
    ),
    'vehicle', jsonb_build_object(
      'make', v_trip.vehicle_make,
      'model', v_trip.vehicle_model,
      'color', v_trip.vehicle_color,
      'license_plate', v_trip.vehicle_plate
    ),
    'latest_location', case when v_latest_location.lat is not null then jsonb_build_object(
      'lat', v_latest_location.lat,
      'lng', v_latest_location.lng,
      'speed', v_latest_location.speed,
      'heading', v_latest_location.heading,
      'accuracy', v_latest_location.accuracy,
      'recorded_at', v_latest_location.recorded_at
    ) else null end,
    'breadcrumbs', v_breadcrumbs,
    'stops', v_stops
  );
end;
$$;

-- Function: get_admin_incidents
create or replace function get_admin_incidents()
returns jsonb
language plpgsql
security definer
set search_path = public as $$
declare
  v_result jsonb;
begin
  select coalesce(jsonb_agg(item order by item.created_at desc), '[]'::jsonb)
    into v_result
    from (
      select 
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
        ) as reporter,
        case when t.id is not null then jsonb_build_object(
          'id', t.id,
          'status', t.status,
          'departs_at', t.departs_at,
          'route_name', r.name,
          'driver_name', trim(coalesce(du.first_name, '') || ' ' || coalesce(du.last_name, '')),
          'driver_phone', du.phone,
          'vehicle_plate', v.license_plate,
          'vehicle_model', v.make || ' ' || v.model
        ) else null end as trip,
        case when b.id is not null then jsonb_build_object(
          'reference', b.booking_reference,
          'seats', b.total_seats
        ) else null end as booking,
        case when h.id is not null then jsonb_build_object(
          'id', h.id,
          'name', trim(coalesce(h.first_name, '') || ' ' || coalesce(h.last_name, ''))
        ) else null end as handler
      from incidents i
      left join profiles rep on rep.id = i.reported_by
      left join trips t on t.id = i.trip_id
      left join routes r on r.id = t.route_id
      left join driver_profiles dp on dp.id = t.driver_id
      left join profiles du on du.id = dp.user_id
      left join vehicles v on v.id = t.vehicle_id
      left join bookings b on b.id = i.booking_id
      left join profiles h on h.id = i.handled_by
      order by i.created_at desc
    ) item;

  return v_result;
end;
$$;

-- Function: resolve_incident
create or replace function resolve_incident(
  p_incident_id uuid,
  p_status text,
  p_handler_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public as $$
declare
  v_handler_id uuid;
begin
  v_handler_id := coalesce(auth.uid(), p_handler_id);

  update incidents
     set status = p_status,
         handled_by = coalesce(v_handler_id, handled_by),
         resolved_at = case when p_status = 'resolved' then now() else resolved_at end
   where id = p_incident_id;

  return jsonb_build_object(
    'incident_id', p_incident_id,
    'status', p_status,
    'updated_at', now()
  );
end;
$$;

-- Function: submit_trip_rating
create or replace function submit_trip_rating(
  p_trip_id uuid,
  p_booking_id uuid,
  p_score integer,
  p_comment text default null,
  p_reviewer_id uuid default null,
  p_reviewee_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public as $$
declare
  v_reviewer_id uuid;
  v_reviewee_id uuid;
  v_rating_id uuid;
begin
  v_reviewer_id := coalesce(auth.uid(), p_reviewer_id);

  if p_reviewee_id is not null then
    v_reviewee_id := p_reviewee_id;
  elsif p_trip_id is not null then
    select dp.user_id into v_reviewee_id
      from trips t
      join driver_profiles dp on dp.id = t.driver_id
     where t.id = p_trip_id;
  end if;

  if v_reviewer_id is null then
    select id into v_reviewer_id from profiles limit 1;
  end if;
  if v_reviewee_id is null then
    select user_id into v_reviewee_id from driver_profiles limit 1;
  end if;

  insert into ratings (trip_id, booking_id, reviewer_id, reviewee_id, score, comment)
  values (p_trip_id, p_booking_id, v_reviewer_id, v_reviewee_id, p_score, p_comment)
  returning id into v_rating_id;

  return jsonb_build_object(
    'rating_id', v_rating_id,
    'score', p_score,
    'created_at', now()
  );
end;
$$;


