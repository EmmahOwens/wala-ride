-- ============================================================================
-- MIGRATION: PHASE 2 DRIVER SUBSCRIPTIONS & DEMAND RADAR
-- ============================================================================

-- 1. Create trip alert (logs search_event and inserts active trip_alert)
create or replace function create_trip_alert(
  p_passenger_id uuid,
  p_origin_town_id uuid,
  p_destination_town_id uuid,
  p_travel_date date,
  p_seats_needed int default 1
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alert_id uuid;
  v_user_id uuid;
begin
  v_user_id := coalesce(auth.uid(), p_passenger_id);
  if v_user_id is null then
    raise exception 'PASSENGER_ID_REQUIRED';
  end if;

  -- 1. Log search event for demand analytics
  insert into search_events (origin_town_id, destination_town_id, travel_date, seats_needed, result_count, user_id)
  values (p_origin_town_id, p_destination_town_id, p_travel_date, p_seats_needed, 0, v_user_id);

  -- 2. Insert active trip alert
  insert into trip_alerts (passenger_id, origin_town_id, destination_town_id, travel_date, seats_needed, status)
  values (v_user_id, p_origin_town_id, p_destination_town_id, p_travel_date, p_seats_needed, 'open')
  returning id into v_alert_id;

  return v_alert_id;
end;
$$;

-- 2. Driver Radar: fetch passenger demand signals with unlocked status
create or replace function get_driver_radar_leads(p_driver_id uuid)
returns table (
  alert_id uuid,
  passenger_id uuid,
  origin_town_id uuid,
  origin_town_name text,
  destination_town_id uuid,
  destination_town_name text,
  travel_date date,
  seats_needed int,
  created_at timestamptz,
  is_unlocked boolean,
  passenger_name text,
  passenger_phone text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    ta.id as alert_id,
    ta.passenger_id,
    ta.origin_town_id,
    t1.name as origin_town_name,
    ta.destination_town_id,
    t2.name as destination_town_name,
    ta.travel_date,
    ta.seats_needed,
    ta.created_at,
    exists(select 1 from lead_views lv where lv.driver_id = p_driver_id and lv.trip_alert_id = ta.id) as is_unlocked,
    case
      when exists(select 1 from lead_views lv where lv.driver_id = p_driver_id and lv.trip_alert_id = ta.id)
        then coalesce(p.first_name || ' ' || p.last_name, 'Passenger')
      else
        coalesce(left(p.first_name, 1) || '••• ' || left(p.last_name, 1) || '•••', 'Passenger Lead')
    end as passenger_name,
    case
      when exists(select 1 from lead_views lv where lv.driver_id = p_driver_id and lv.trip_alert_id = ta.id)
        then coalesce(p.phone, '')
      else
        case
          when p.phone is not null and length(p.phone) > 6
            then left(p.phone, 4) || ' ••• ••• ' || right(p.phone, 2)
          else '+256 ••• ••• •••'
        end
    end as passenger_phone
  from trip_alerts ta
  join towns t1 on t1.id = ta.origin_town_id
  join towns t2 on t2.id = ta.destination_town_id
  join profiles p on p.id = ta.passenger_id
  where ta.status = 'open'
    and ta.travel_date >= current_date
  order by ta.created_at desc;
end;
$$;

-- 3. Reveal Lead: spends 1 credit, idempotent free re-reveal, unmasks contact details
drop function if exists reveal_lead(uuid, uuid);
create or replace function reveal_lead(p_driver_id uuid, p_trip_alert_id uuid)
returns table (
  passenger_phone text,
  passenger_name text,
  alert_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period_start date;
  v_max_leads int;
  v_used int;
  v_extra int;
begin
  perform pg_advisory_xact_lock(hashtext(p_driver_id::text || ':leads'));

  -- If already unlocked by this driver, return for free (idempotent)
  if exists (select 1 from lead_views where driver_id = p_driver_id and trip_alert_id = p_trip_alert_id) then
    return query
      select
        coalesce(p.phone, '') as passenger_phone,
        coalesce(p.first_name || ' ' || p.last_name, 'Passenger') as passenger_name,
        ta.id as alert_id
      from trip_alerts ta
      join profiles p on p.id = ta.passenger_id
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
    select
      coalesce(p.phone, '') as passenger_phone,
      coalesce(p.first_name || ' ' || p.last_name, 'Passenger') as passenger_name,
      ta.id as alert_id
    from trip_alerts ta
    join profiles p on p.id = ta.passenger_id
    where ta.id = p_trip_alert_id;
end;
$$;

-- 4. Get driver subscription summary with remaining quota counters
create or replace function get_driver_subscription_summary(p_driver_id uuid)
returns table (
  subscription_id uuid,
  plan_id uuid,
  plan_name text,
  price_ugx int,
  status text,
  starts_at timestamptz,
  ends_at timestamptz,
  days_remaining int,
  trips_posted int,
  max_trips int,
  trips_remaining int,
  leads_viewed int,
  max_leads int,
  leads_remaining int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub record;
  v_usage record;
begin
  select
    ds.id as sub_id,
    ds.plan_id,
    sp.name as plan_name,
    sp.price_ugx,
    ds.status,
    ds.starts_at,
    ds.ends_at,
    sp.max_trips_per_period,
    sp.max_leads_per_period
  into v_sub
  from driver_subscriptions ds
  join subscription_plans sp on sp.id = ds.plan_id
  where ds.driver_id = p_driver_id
    and ds.status in ('active', 'trialing', 'grace')
  order by ds.starts_at desc limit 1;

  if v_sub.sub_id is null then
    return;
  end if;

  select
    coalesce(trips_posted, 0) as trips_posted,
    coalesce(leads_viewed, 0) as leads_viewed,
    coalesce(extra_trips, 0) as extra_trips,
    coalesce(extra_leads, 0) as extra_leads
  into v_usage
  from subscription_usage
  where driver_id = p_driver_id
    and period_start = v_sub.starts_at::date;

  return query select
    v_sub.sub_id as subscription_id,
    v_sub.plan_id,
    v_sub.plan_name,
    v_sub.price_ugx,
    v_sub.status::text,
    v_sub.starts_at,
    v_sub.ends_at,
    greatest(0, extract(day from (v_sub.ends_at - now()))::int) as days_remaining,
    coalesce(v_usage.trips_posted, 0) as trips_posted,
    v_sub.max_trips_per_period + coalesce(v_usage.extra_trips, 0) as max_trips,
    greatest(0, (v_sub.max_trips_per_period + coalesce(v_usage.extra_trips, 0)) - coalesce(v_usage.trips_posted, 0)) as trips_remaining,
    coalesce(v_usage.leads_viewed, 0) as leads_viewed,
    v_sub.max_leads_per_period + coalesce(v_usage.extra_leads, 0) as max_leads,
    greatest(0, (v_sub.max_leads_per_period + coalesce(v_usage.extra_leads, 0)) - coalesce(v_usage.leads_viewed, 0)) as leads_remaining;
end;
$$;

-- 5. Mobile Money Payment & Webhook Simulation for driver subscription activation
create or replace function simulate_subscription_payment(
  p_driver_id uuid,
  p_plan_id uuid,
  p_phone_number text default '+256700000000',
  p_network text default 'MTN MoMo'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan record;
  v_payment_id uuid;
begin
  select * into v_plan from subscription_plans where id = p_plan_id;
  if v_plan.id is null then
    raise exception 'PLAN_NOT_FOUND';
  end if;

  -- 1. Insert successful payment record (simulating MoMo/Flutterwave webhook)
  insert into payments (
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
  ) values (
    p_driver_id,
    p_plan_id,
    'subscription',
    v_plan.price_ugx,
    'mobile_money',
    'successful',
    p_network,
    'SIM_' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
    false,
    now()
  ) returning id into v_payment_id;

  -- 2. Call activate_subscription
  perform activate_subscription(v_payment_id);

  return jsonb_build_object(
    'payment_id', v_payment_id,
    'status', 'successful',
    'plan_name', v_plan.name,
    'amount_ugx', v_plan.price_ugx,
    'network', p_network
  );
end;
$$;

-- 6. Mobile Money Lead Top-up Simulation
create or replace function simulate_lead_topup(
  p_driver_id uuid,
  p_leads_count int default 10,
  p_amount_ugx int default 10000,
  p_network text default 'MTN MoMo'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment_id uuid;
begin
  insert into payments (
    driver_id,
    purpose,
    amount_ugx,
    method,
    status,
    provider,
    provider_ref,
    applied,
    completed_at
  ) values (
    p_driver_id,
    'lead_topup',
    p_amount_ugx,
    'mobile_money',
    'successful',
    p_network,
    'SIM_LEAD_' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
    false,
    now()
  ) returning id into v_payment_id;

  perform credit_lead_topup(v_payment_id, p_leads_count);

  return jsonb_build_object(
    'payment_id', v_payment_id,
    'status', 'successful',
    'leads_added', p_leads_count,
    'amount_ugx', p_amount_ugx
  );
end;
$$;
