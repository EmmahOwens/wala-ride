-- ============================================================================
-- MIGRATION: FIX GET_DRIVER_SUBSCRIPTION_SUMMARY AMBIGUITY
-- ============================================================================

drop function if exists get_driver_subscription_summary(uuid);
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
  v_trips_posted int := 0;
  v_leads_viewed int := 0;
  v_extra_trips int := 0;
  v_extra_leads int := 0;
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
    coalesce(su.trips_posted, 0),
    coalesce(su.leads_viewed, 0),
    coalesce(su.extra_trips, 0),
    coalesce(su.extra_leads, 0)
  into v_trips_posted, v_leads_viewed, v_extra_trips, v_extra_leads
  from subscription_usage su
  where su.driver_id = p_driver_id
    and su.period_start = v_sub.starts_at::date;

  return query select
    v_sub.sub_id as subscription_id,
    v_sub.plan_id,
    v_sub.plan_name,
    v_sub.price_ugx,
    v_sub.status::text,
    v_sub.starts_at,
    v_sub.ends_at,
    greatest(0, extract(day from (v_sub.ends_at - now()))::int) as days_remaining,
    coalesce(v_trips_posted, 0) as trips_posted,
    v_sub.max_trips_per_period + coalesce(v_extra_trips, 0) as max_trips,
    greatest(0, (v_sub.max_trips_per_period + coalesce(v_extra_trips, 0)) - coalesce(v_trips_posted, 0)) as trips_remaining,
    coalesce(v_leads_viewed, 0) as leads_viewed,
    v_sub.max_leads_per_period + coalesce(v_extra_leads, 0) as max_leads,
    greatest(0, (v_sub.max_leads_per_period + coalesce(v_extra_leads, 0)) - coalesce(v_leads_viewed, 0)) as leads_remaining;
end;
$$;
