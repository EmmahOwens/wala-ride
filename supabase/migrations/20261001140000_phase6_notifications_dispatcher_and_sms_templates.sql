-- ============================================================================
-- MIGRATION: BACKEND IMPLEMENTATION PLAN PHASE 6
-- NOTIFICATIONS DISPATCHER, TRANSACTIONAL SMS & TEMPLATES
-- ============================================================================

-- 1. Add delivery tracking columns to notifications table
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'notifications' and column_name = 'status'
  ) then
    alter table public.notifications
      add column status text default 'pending',
      add column phone_number text default null,
      add column dispatched_at timestamptz default null,
      add column provider_ref text default null,
      add column error_message text default null;
  end if;
end; $$;

create index if not exists idx_notifications_pending_dispatch
  on public.notifications(channel, status, created_at)
  where status = 'pending';

-- 2. Helper RPC: update_notification_status
create or replace function public.update_notification_status(
  p_notification_id uuid,
  p_status          text,
  p_provider_ref    text default null,
  p_error           text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update notifications
     set status = p_status,
         dispatched_at = case when p_status in ('sent', 'delivered') then coalesce(dispatched_at, now()) else dispatched_at end,
         provider_ref = coalesce(p_provider_ref, provider_ref),
         error_message = coalesce(p_error, error_message)
   where id = p_notification_id;

  return jsonb_build_object(
    'notification_id', p_notification_id,
    'status', p_status,
    'updated_at', now()
  );
end;
$$;

-- 3. Helper RPC: get_pending_notifications
create or replace function public.get_pending_notifications(
  p_channel text default 'sms',
  p_limit   int default 25
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_results jsonb;
begin
  select coalesce(jsonb_agg(to_jsonb(n)), '[]'::jsonb)
    into v_results
    from (
      select n.id, n.user_id, n.channel, n.type, n.title, n.body,
             n.phone_number, n.data, n.status, n.created_at
        from notifications n
       where n.status = 'pending'
         and n.channel = p_channel::notification_channel_enum
       order by n.created_at asc
       limit p_limit
    ) n;

  return v_results;
end;
$$;

-- 4. Task 8.2: Dispatch Booking Confirmation SMS
create or replace function public.dispatch_booking_confirmation_sms(
  p_booking_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking       record;
  v_phone         text;
  v_msg           text;
  v_notif_id      uuid;
  v_stage_name    text := 'Designated Stage';
  v_driver_name   text := 'Driver';
  v_driver_phone  text := 'N/A';
  v_vehicle_plate text := 'N/A';
begin
  -- Resolve booking details
  select b.id, b.passenger_id, b.booking_reference, b.trip_id,
         p.phone as passenger_phone,
         coalesce(p.first_name || ' ' || coalesce(p.last_name, ''), 'Passenger') as passenger_name,
         t.departs_at,
         orig.name as origin_town,
         dest.name as dest_town,
         drv.phone as driver_phone,
         coalesce(dp_prof.first_name || ' ' || coalesce(dp_prof.last_name, ''), 'Driver') as driver_name,
         v.license_plate
    into v_booking
    from bookings b
    join profiles p on p.id = b.passenger_id
    join trips t on t.id = b.trip_id
    join routes r on r.id = t.route_id
    join towns orig on orig.id = r.origin_town_id
    join towns dest on dest.id = r.destination_town_id
    left join driver_profiles dp on dp.id = t.driver_id
    left join profiles dp_prof on dp_prof.id = dp.user_id
    left join profiles drv on drv.id = dp.user_id
    left join vehicles v on v.id = t.vehicle_id
   where b.id = p_booking_id;

  if v_booking.id is null then
    raise exception 'BOOKING_NOT_FOUND';
  end if;

  v_phone := coalesce(v_booking.passenger_phone, '+256700000000');
  v_driver_name := coalesce(v_booking.driver_name, 'Driver');
  v_driver_phone := coalesce(v_booking.driver_phone, 'N/A');
  v_vehicle_plate := coalesce(v_booking.license_plate, 'N/A');

  -- Format SMS per PRD/Plan template
  v_msg := 'Wala Ride: Booking #' || v_booking.booking_reference ||
           ' confirmed for ' || v_booking.origin_town || '->' || v_booking.dest_town ||
           ' on ' || to_char(v_booking.departs_at, 'DD Mon, HH24:MI') ||
           '. Driver: ' || v_driver_name || ' (' || v_driver_phone || '). Plate: ' || v_vehicle_plate || '.';

  insert into notifications (
    user_id, channel, type, title, body, phone_number, status, data
  ) values (
    v_booking.passenger_id,
    'sms',
    'booking_confirmation_sms',
    'Booking Confirmed #' || v_booking.booking_reference,
    v_msg,
    v_phone,
    'pending',
    jsonb_build_object(
      'booking_id', v_booking.id,
      'booking_reference', v_booking.booking_reference,
      'trip_id', v_booking.trip_id,
      'driver_name', v_driver_name,
      'driver_phone', v_driver_phone,
      'license_plate', v_vehicle_plate,
      'departs_at', v_booking.departs_at
    )
  ) returning id into v_notif_id;

  return jsonb_build_object(
    'notification_id', v_notif_id,
    'recipient_phone', v_phone,
    'message', v_msg,
    'booking_reference', v_booking.booking_reference,
    'status', 'pending'
  );
end;
$$;

-- 5. Task 8.2: Dispatch Trip Departure Alert SMS
create or replace function public.dispatch_trip_departure_reminder_sms(
  p_trip_id           uuid,
  p_minutes_remaining int default 60
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip record;
  v_booking record;
  v_msg text;
  v_dispatched_count int := 0;
  v_dispatched_list jsonb := '[]'::jsonb;
  v_notif_id uuid;
begin
  select t.id, t.departs_at,
         orig.name as origin_town, dest.name as dest_town,
         coalesce(dp_prof.first_name || ' ' || coalesce(dp_prof.last_name, ''), 'Driver') as driver_name,
         drv.phone as driver_phone,
         v.license_plate
    into v_trip
    from trips t
    join routes r on r.id = t.route_id
    join towns orig on orig.id = r.origin_town_id
    join towns dest on dest.id = r.destination_town_id
    left join driver_profiles dp on dp.id = t.driver_id
    left join profiles dp_prof on dp_prof.id = dp.user_id
    left join profiles drv on drv.id = dp.user_id
    left join vehicles v on v.id = t.vehicle_id
   where t.id = p_trip_id;

  if v_trip.id is null then
    raise exception 'TRIP_NOT_FOUND';
  end if;

  -- Dispatch to all confirmed passengers on this trip
  for v_booking in
    select b.id as booking_id, b.passenger_id, b.booking_reference,
           coalesce(p.phone, '+256700000000') as passenger_phone
      from bookings b
      join profiles p on p.id = b.passenger_id
     where b.trip_id = p_trip_id
       and b.status in ('confirmed', 'held')
  loop
    v_msg := 'Your Wala Ride departs in ' || p_minutes_remaining || ' minutes (' ||
             v_trip.origin_town || '->' || v_trip.dest_town || '). Vehicle: ' ||
             coalesce(v_trip.license_plate, 'N/A') || '. Driver: ' ||
             v_trip.driver_name || ' (' || coalesce(v_trip.driver_phone, 'N/A') || ').';

    insert into notifications (
      user_id, channel, type, title, body, phone_number, status, data
    ) values (
      v_booking.passenger_id,
      'sms',
      'departure_alert_sms',
      'Trip Departs in ' || p_minutes_remaining || ' mins',
      v_msg,
      v_booking.passenger_phone,
      'pending',
      jsonb_build_object(
        'trip_id', p_trip_id,
        'booking_id', v_booking.booking_id,
        'booking_reference', v_booking.booking_reference,
        'minutes_remaining', p_minutes_remaining
      )
    ) returning id into v_notif_id;

    v_dispatched_list := v_dispatched_list || jsonb_build_object(
      'notification_id', v_notif_id,
      'booking_id', v_booking.booking_id,
      'phone', v_booking.passenger_phone
    );
    v_dispatched_count := v_dispatched_count + 1;
  end loop;

  return jsonb_build_object(
    'trip_id', p_trip_id,
    'minutes_remaining', p_minutes_remaining,
    'dispatched_count', v_dispatched_count,
    'recipients', v_dispatched_list
  );
end;
$$;
