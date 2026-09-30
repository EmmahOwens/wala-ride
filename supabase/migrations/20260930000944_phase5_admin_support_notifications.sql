-- ============================================================================
-- PHASE 5 — ADMIN, SUPPORT, NOTIFICATIONS & DEMAND ANALYTICS
-- ============================================================================

-- Realtime Publication for Phase 5 tables
-- alter publication supabase_realtime add table support_tickets, support_messages, notifications;

-- Function: create_support_ticket
create or replace function create_support_ticket(
  p_subject text,
  p_description text,
  p_category text default 'general',
  p_priority text default 'normal',
  p_trip_id uuid default null,
  p_booking_id uuid default null,
  p_user_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public as $$
declare
  v_user_id uuid;
  v_ticket_id uuid;
  v_result jsonb;
begin
  v_user_id := coalesce(auth.uid(), p_user_id);
  if v_user_id is null then
    select id into v_user_id from profiles limit 1;
  end if;

  if p_subject is null or trim(p_subject) = '' then
    raise exception 'Ticket subject is required';
  end if;

  insert into support_tickets (
    user_id, subject, description, category, priority, trip_id, booking_id, status
  ) values (
    v_user_id, trim(p_subject), p_description, coalesce(p_category, 'general'), coalesce(p_priority, 'normal'), p_trip_id, p_booking_id, 'open'
  ) returning id into v_ticket_id;

  if p_description is not null and trim(p_description) <> '' then
    insert into support_messages (ticket_id, sender_id, message)
    values (v_ticket_id, v_user_id, trim(p_description));
  end if;

  insert into notifications (user_id, channel, type, title, body, data)
  select 
    ur.user_id, 
    'in_app'::notification_channel_enum, 
    'ticket_opened',
    'New Support Ticket: ' || trim(p_subject),
    coalesce(substring(p_description from 1 for 120), 'A new passenger support ticket was created.'),
    jsonb_build_object('ticket_id', v_ticket_id, 'category', p_category, 'priority', p_priority)
  from user_roles ur
  where ur.role in ('admin', 'support_agent')
  on conflict do nothing;

  select jsonb_build_object(
    'ticket_id', st.id,
    'subject', st.subject,
    'status', st.status,
    'category', st.category,
    'priority', st.priority,
    'created_at', st.created_at
  ) into v_result
  from support_tickets st
  where st.id = v_ticket_id;

  return v_result;
end;
$$;

-- Function: get_admin_support_tickets
create or replace function get_admin_support_tickets(
  p_status text default null,
  p_category text default null
) returns jsonb
language plpgsql
security definer
set search_path = public as $$
declare
  v_result jsonb;
begin
  select coalesce(jsonb_agg(item order by item.updated_at desc), '[]'::jsonb)
  into v_result
  from (
    select 
      st.id,
      st.user_id,
      st.subject,
      st.description,
      st.category,
      st.priority,
      st.status,
      st.assigned_to,
      st.trip_id,
      st.booking_id,
      st.created_at,
      st.updated_at,
      st.resolved_at,
      jsonb_build_object(
        'id', u.id,
        'name', trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')),
        'phone', u.phone,
        'email', u.email
      ) as customer,
      case when a.id is not null then jsonb_build_object(
        'id', a.id,
        'name', trim(coalesce(a.first_name, '') || ' ' || coalesce(a.last_name, ''))
      ) else null end as assigned_agent,
      case when b.id is not null then jsonb_build_object(
        'id', b.id,
        'reference', b.booking_reference,
        'total_seats', b.total_seats,
        'total_fare_ugx', b.total_fare_ugx
      ) else null end as booking,
      case when t.id is not null then jsonb_build_object(
        'id', t.id,
        'status', t.status,
        'departs_at', t.departs_at,
        'route_name', r.name
      ) else null end as trip,
      (select count(*)::integer from support_messages sm where sm.ticket_id = st.id) as messages_count,
      (select sm.message from support_messages sm where sm.ticket_id = st.id order by sm.created_at desc limit 1) as last_message,
      (select sm.created_at from support_messages sm where sm.ticket_id = st.id order by sm.created_at desc limit 1) as last_message_at
    from support_tickets st
    left join profiles u on u.id = st.user_id
    left join profiles a on a.id = st.assigned_to
    left join bookings b on b.id = st.booking_id
    left join trips t on t.id = st.trip_id
    left join routes r on r.id = t.route_id
    where (p_status is null or p_status = 'all' or st.status = p_status)
      and (p_category is null or p_category = 'all' or st.category = p_category)
    order by st.updated_at desc
  ) item;

  return v_result;
end;
$$;

-- Function: get_ticket_details
create or replace function get_ticket_details(
  p_ticket_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public as $$
declare
  v_ticket jsonb;
  v_messages jsonb;
begin
  select jsonb_build_object(
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
      'name', trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')),
      'phone', u.phone,
      'email', u.email
    ),
    'assigned_agent', case when a.id is not null then jsonb_build_object(
      'id', a.id,
      'name', trim(coalesce(a.first_name, '') || ' ' || coalesce(a.last_name, ''))
    ) else null end,
    'booking', case when b.id is not null then jsonb_build_object(
      'id', b.id,
      'reference', b.booking_reference,
      'total_seats', b.total_seats,
      'status', b.status
    ) else null end,
    'trip', case when t.id is not null then jsonb_build_object(
      'id', t.id,
      'status', t.status,
      'departs_at', t.departs_at,
      'route_name', r.name
    ) else null end
  ) into v_ticket
  from support_tickets st
  left join profiles u on u.id = st.user_id
  left join profiles a on a.id = st.assigned_to
  left join bookings b on b.id = st.booking_id
  left join trips t on t.id = st.trip_id
  left join routes r on r.id = t.route_id
  where st.id = p_ticket_id;

  if v_ticket is null then
    return null;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', sm.id,
      'ticket_id', sm.ticket_id,
      'sender_id', sm.sender_id,
      'message', sm.message,
      'attachment_url', sm.attachment_url,
      'created_at', sm.created_at,
      'sender_name', trim(coalesce(sp.first_name, '') || ' ' || coalesce(sp.last_name, '')),
      'is_staff', exists (
        select 1 from user_roles ur where ur.user_id = sm.sender_id and ur.role in ('admin', 'support_agent')
      )
    ) order by sm.created_at asc
  ), '[]'::jsonb) into v_messages
  from support_messages sm
  left join profiles sp on sp.id = sm.sender_id
  where sm.ticket_id = p_ticket_id;

  return jsonb_build_object(
    'ticket', v_ticket,
    'messages', v_messages
  );
end;
$$;

-- Function: send_ticket_reply
create or replace function send_ticket_reply(
  p_ticket_id uuid,
  p_message text,
  p_sender_id uuid default null,
  p_attachment_url text default null
) returns jsonb
language plpgsql
security definer
set search_path = public as $$
declare
  v_sender_id uuid;
  v_msg_id uuid;
  v_is_staff boolean;
  v_customer_id uuid;
  v_subject text;
  v_sender_name text;
  v_result jsonb;
begin
  v_sender_id := coalesce(auth.uid(), p_sender_id);
  if v_sender_id is null then
    select id into v_sender_id from profiles limit 1;
  end if;

  if p_message is null or trim(p_message) = '' then
    raise exception 'Message content cannot be empty';
  end if;

  select user_id, subject into v_customer_id, v_subject
  from support_tickets where id = p_ticket_id;

  if v_customer_id is null then
    raise exception 'Ticket % not found', p_ticket_id;
  end if;

  select exists (
    select 1 from user_roles where user_id = v_sender_id and role in ('admin', 'support_agent')
  ) into v_is_staff;

  insert into support_messages (ticket_id, sender_id, message, attachment_url)
  values (p_ticket_id, v_sender_id, trim(p_message), p_attachment_url)
  returning id into v_msg_id;

  select trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')) into v_sender_name
  from profiles where id = v_sender_id;

  if v_is_staff then
    update support_tickets
    set status = case when status = 'open' then 'in_progress' else status end,
        updated_at = now()
    where id = p_ticket_id;

    insert into notifications (user_id, channel, type, title, body, data)
    values (
      v_customer_id,
      'in_app'::notification_channel_enum,
      'support_reply',
      'Support replied to "' || coalesce(v_subject, 'Ticket') || '"',
      substring(p_message from 1 for 140),
      jsonb_build_object('ticket_id', p_ticket_id, 'sender_name', v_sender_name)
    );
  else
    update support_tickets
    set status = case when status in ('resolved', 'waiting_on_user') then 'open' else status end,
        updated_at = now()
    where id = p_ticket_id;

    insert into notifications (user_id, channel, type, title, body, data)
    select 
      ur.user_id,
      'in_app'::notification_channel_enum,
      'ticket_reply',
      'Customer replied on "' || coalesce(v_subject, 'Ticket') || '"',
      substring(p_message from 1 for 140),
      jsonb_build_object('ticket_id', p_ticket_id, 'sender_name', v_sender_name)
    from user_roles ur
    where ur.role in ('admin', 'support_agent')
    limit 3;
  end if;

  select jsonb_build_object(
    'id', sm.id,
    'ticket_id', sm.ticket_id,
    'sender_id', sm.sender_id,
    'message', sm.message,
    'attachment_url', sm.attachment_url,
    'created_at', sm.created_at,
    'sender_name', v_sender_name,
    'is_staff', v_is_staff
  ) into v_result
  from support_messages sm
  where sm.id = v_msg_id;

  return v_result;
end;
$$;

-- Function: update_ticket_status_rpc
create or replace function update_ticket_status_rpc(
  p_ticket_id uuid,
  p_status text,
  p_assigned_to uuid default null,
  p_resolution_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = public as $$
declare
  v_customer_id uuid;
  v_subject text;
  v_updater_id uuid;
begin
  v_updater_id := auth.uid();

  select user_id, subject into v_customer_id, v_subject
  from support_tickets where id = p_ticket_id;

  if v_customer_id is null then
    raise exception 'Ticket % not found', p_ticket_id;
  end if;

  update support_tickets
  set status = p_status,
      assigned_to = coalesce(p_assigned_to, assigned_to),
      resolved_at = case when p_status in ('resolved', 'closed') then now() else null end,
      updated_at = now()
  where id = p_ticket_id;

  if p_resolution_note is not null and trim(p_resolution_note) <> '' then
    insert into support_messages (ticket_id, sender_id, message)
    values (p_ticket_id, coalesce(v_updater_id, v_customer_id), 'Status changed to ' || p_status || ': ' || trim(p_resolution_note));
  end if;

  if p_status in ('resolved', 'closed') then
    insert into notifications (user_id, channel, type, title, body, data)
    values (
      v_customer_id,
      'in_app'::notification_channel_enum,
      'ticket_resolved',
      'Ticket Resolved: ' || coalesce(v_subject, 'Your Support Request'),
      'Your support ticket has been marked as resolved by our operations team.',
      jsonb_build_object('ticket_id', p_ticket_id, 'status', p_status)
    );
  end if;

  return jsonb_build_object(
    'ticket_id', p_ticket_id,
    'status', p_status,
    'updated_at', now()
  );
end;
$$;

-- Function: get_demand_analytics
create or replace function get_demand_analytics(
  p_days integer default 30
) returns jsonb
language plpgsql
security definer
set search_path = public as $$
declare
  v_since timestamptz;
  v_summary jsonb;
  v_corridors jsonb;
  v_daily_trends jsonb;
begin
  v_since := now() - (coalesce(p_days, 30) || ' days')::interval;

  select jsonb_build_object(
    'total_searches', count(*)::integer,
    'unserved_searches', count(*) filter (where result_count = 0)::integer,
    'unserved_rate_pct', case when count(*) > 0 
      then round((count(*) filter (where result_count = 0)::numeric / count(*)::numeric) * 100, 1)
      else 0 end,
    'passengers_demanding', coalesce(sum(seats_needed), 0)::integer,
    'alert_conversions', (
      select count(*)::integer from trip_alerts where created_at >= v_since
    ),
    'period_days', p_days
  ) into v_summary
  from search_events
  where created_at >= v_since;

  select coalesce(jsonb_agg(c order by c.unserved_count desc, c.search_count desc), '[]'::jsonb)
  into v_corridors
  from (
    select 
      se.origin_town_id,
      ot.name as origin_town_name,
      se.destination_town_id,
      dt.name as destination_town_name,
      count(*)::integer as search_count,
      count(*) filter (where se.result_count = 0)::integer as unserved_count,
      coalesce(sum(se.seats_needed), 0)::integer as total_seats_requested,
      (
        select count(*)::integer
        from trips t
        join routes r on r.id = t.route_id
        where r.origin_town_id = se.origin_town_id
          and r.destination_town_id = se.destination_town_id
          and t.status in ('scheduled', 'boarding', 'in_progress')
      ) as active_trips_count,
      case 
        when (select count(*) from trips t join routes r on r.id = t.route_id where r.origin_town_id = se.origin_town_id and r.destination_town_id = se.destination_town_id and t.status in ('scheduled', 'boarding', 'in_progress')) = 0
          and count(*) filter (where se.result_count = 0) > 0 then 'CRITICAL_SHORTAGE'
        when count(*) filter (where se.result_count = 0) > 2 then 'HIGH_DEMAND'
        else 'BALANCED'
      end as supply_status
    from search_events se
    join towns ot on ot.id = se.origin_town_id
    join towns dt on dt.id = se.destination_town_id
    where se.created_at >= v_since
    group by se.origin_town_id, ot.name, se.destination_town_id, dt.name
  ) c;

  select coalesce(jsonb_agg(d order by d.date asc), '[]'::jsonb)
  into v_daily_trends
  from (
    select 
      to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as date,
      count(*)::integer as search_count,
      count(*) filter (where result_count = 0)::integer as unserved_count
    from search_events
    where created_at >= v_since
    group by date_trunc('day', created_at)
  ) d;

  return jsonb_build_object(
    'summary', v_summary,
    'corridors', v_corridors,
    'daily_trends', v_daily_trends
  );
end;
$$;

-- Function: admin_manage_town
create or replace function admin_manage_town(
  p_action text,
  p_id uuid default null,
  p_name text default null,
  p_region text default null,
  p_lat numeric default null,
  p_lng numeric default null,
  p_is_active boolean default true
) returns jsonb
language plpgsql
security definer
set search_path = public as $$
declare
  v_id uuid;
  v_result jsonb;
begin
  if p_action = 'create' then
    if p_name is null or trim(p_name) = '' then
      raise exception 'Town name is required';
    end if;

    insert into towns (name, region, lat, lng, is_active)
    values (trim(p_name), trim(p_region), p_lat, p_lng, coalesce(p_is_active, true))
    returning id into v_id;

  elsif p_action = 'update' then
    if p_id is null then
      raise exception 'Town ID is required for update';
    end if;

    update towns
    set name = coalesce(trim(p_name), name),
        region = coalesce(trim(p_region), region),
        lat = coalesce(p_lat, lat),
        lng = coalesce(p_lng, lng),
        is_active = coalesce(p_is_active, is_active)
    where id = p_id
    returning id into v_id;

  elsif p_action = 'toggle_active' then
    update towns
    set is_active = not is_active
    where id = p_id
    returning id into v_id;

  else
    raise exception 'Unknown town action: %', p_action;
  end if;

  select jsonb_build_object(
    'id', t.id,
    'name', t.name,
    'region', t.region,
    'lat', t.lat,
    'lng', t.lng,
    'is_active', t.is_active
  ) into v_result
  from towns t where t.id = v_id;

  return v_result;
end;
$$;

-- Function: admin_manage_route
create or replace function admin_manage_route(
  p_action text,
  p_id uuid default null,
  p_name text default null,
  p_origin_town_id uuid default null,
  p_destination_town_id uuid default null,
  p_distance_km numeric default null,
  p_duration_mins integer default null,
  p_status text default 'active',
  p_stops jsonb default '[]'::jsonb
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
      name, origin_town_id, destination_town_id, distance_km, estimated_duration_minutes, status
    ) values (
      trim(p_name), p_origin_town_id, p_destination_town_id, p_distance_km, p_duration_mins, coalesce(p_status, 'active')
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
        status = coalesce(p_status, status)
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
    'stops_count', (select count(*)::integer from route_stops rs where rs.route_id = r.id)
  ) into v_result
  from routes r where r.id = v_id;

  return v_result;
end;
$$;

-- Function: get_user_notifications
create or replace function get_user_notifications(
  p_user_id uuid default null,
  p_limit integer default 20
) returns jsonb
language plpgsql
security definer
set search_path = public as $$
declare
  v_user_id uuid;
  v_result jsonb;
begin
  v_user_id := coalesce(auth.uid(), p_user_id);
  if v_user_id is null then
    select id into v_user_id from profiles limit 1;
  end if;

  select coalesce(jsonb_agg(n order by n.created_at desc), '[]'::jsonb)
  into v_result
  from (
    select 
      id,
      user_id,
      channel,
      type,
      title,
      body,
      data,
      read_at,
      created_at
    from notifications
    where user_id = v_user_id
    order by created_at desc
    limit coalesce(p_limit, 20)
  ) n;

  return v_result;
end;
$$;

-- Function: mark_notification_read
create or replace function mark_notification_read(
  p_notification_id uuid
) returns boolean
language plpgsql
security definer
set search_path = public as $$
begin
  update notifications
  set read_at = now()
  where id = p_notification_id;

  return true;
end;
$$;

-- Function: mark_all_notifications_read
create or replace function mark_all_notifications_read(
  p_user_id uuid default null
) returns boolean
language plpgsql
security definer
set search_path = public as $$
declare
  v_user_id uuid;
begin
  v_user_id := coalesce(auth.uid(), p_user_id);
  if v_user_id is null then
    select id into v_user_id from profiles limit 1;
  end if;

  update notifications
  set read_at = now()
  where user_id = v_user_id and read_at is null;

  return true;
end;
$$;
