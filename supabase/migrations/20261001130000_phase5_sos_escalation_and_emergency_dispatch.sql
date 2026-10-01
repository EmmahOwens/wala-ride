-- ============================================================================
-- MIGRATION: BACKEND IMPLEMENTATION PLAN PHASE 5
-- TELEMETRY, SAFETY, SOS EMERGENCY DISPATCH & INCIDENT ESCALATION DAEMON
-- ============================================================================

-- 1. Add escalation columns to incidents
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'incidents' and column_name = 'escalation_status'
  ) then
    alter table public.incidents
      add column escalation_status text default 'none',
      add column escalated_at timestamptz default null,
      add column acknowledged_at timestamptz default null;
  end if;
end; $$;

-- Index for speedy escalation queries
create index if not exists idx_incidents_unacknowledged_sos
  on public.incidents(kind, status, created_at)
  where kind = 'sos' and status = 'open' and handled_by is null;

-- 2. Enhanced report_incident with automatic emergency contact dispatch
create or replace function public.report_incident(
  p_trip_id      uuid default null,
  p_booking_id   uuid default null,
  p_kind         incident_kind_enum default 'sos',
  p_lat          numeric default null,
  p_lng          numeric default null,
  p_description  text default null,
  p_reported_by  uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id             uuid;
  v_incident_id         uuid;
  v_trip_id             uuid;
  v_passenger_name      text := 'Passenger';
  v_share_token         text;
  v_share_url           text;
  v_contact             record;
  v_contacts_dispatched int := 0;
  v_admin_rec           record;
begin
  v_user_id := coalesce(auth.uid(), p_reported_by);
  v_trip_id := p_trip_id;

  -- Resolve trip and user from booking if needed
  if v_trip_id is null and p_booking_id is not null then
    select trip_id, coalesce(v_user_id, passenger_id)
      into v_trip_id, v_user_id
      from bookings where id = p_booking_id;
  end if;

  if v_user_id is null then
    select id into v_user_id from profiles limit 1;
  end if;

  -- Fetch reporter name for emergency dispatches
  select coalesce(first_name || ' ' || coalesce(last_name, ''), 'Passenger')
    into v_passenger_name
    from profiles where id = v_user_id;

  -- Create incident record
  insert into incidents (trip_id, booking_id, reported_by, kind, lat, lng, description, status, escalation_status)
  values (v_trip_id, p_booking_id, v_user_id, p_kind, p_lat, p_lng, p_description, 'open', 'none')
  returning id into v_incident_id;

  -- Record audit event in trip_events
  if v_trip_id is not null then
    insert into trip_events (trip_id, event_type, lat, lng, created_by, metadata)
    values (
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
  end if;

  -- For SOS incidents: Auto-generate live tracking share link & dispatch to emergency contacts
  if p_kind = 'sos' then
    if p_booking_id is not null then
      -- Generate or get trip share
      select share_token into v_share_token
        from trip_shares
       where booking_id = p_booking_id and expires_at > now()
       order by created_at desc limit 1;

      if v_share_token is null then
        v_share_token := encode(extensions.gen_random_bytes(16), 'hex');
        insert into trip_shares (booking_id, share_token, expires_at)
        values (p_booking_id, v_share_token, now() + interval '48 hours');
      end if;
      v_share_url := 'https://walaride.com/?track=' || v_share_token;
    end if;

    -- Dispatch emergency alerts to registered emergency contacts
    for v_contact in
      select name, phone from emergency_contacts where user_id = v_user_id
    loop
      insert into notifications (user_id, channel, type, title, body, data)
      values (
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
    end loop;

    -- Alert all active administrators
    for v_admin_rec in
      select user_id from user_roles where role = 'admin'
    loop
      insert into notifications (user_id, channel, type, title, body, data)
      values (
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
    end loop;
  end if;

  return jsonb_build_object(
    'incident_id', v_incident_id,
    'status', 'open',
    'kind', p_kind,
    'created_at', now(),
    'emergency_contacts_notified', v_contacts_dispatched,
    'share_url', v_share_url
  );
end;
$$;

-- 3. Incident Escalation Daemon RPC (Task 7.3)
create or replace function public.escalate_unacknowledged_sos_incidents(
  p_threshold_seconds int default 180
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_incident record;
  v_escalated_list jsonb := '[]'::jsonb;
  v_escalated_count int := 0;
  v_admin_rec record;
begin
  for v_incident in
    select i.id, i.trip_id, i.booking_id, i.reported_by, i.created_at,
           coalesce(p.first_name || ' ' || coalesce(p.last_name, ''), 'Passenger') as reporter_name,
           p.phone as reporter_phone,
           t.driver_id,
           extract(epoch from (now() - i.created_at))::int as seconds_unacknowledged
      from incidents i
      left join profiles p on p.id = i.reported_by
      left join trips t on t.id = i.trip_id
     where i.kind = 'sos'
       and i.status = 'open'
       and i.handled_by is null
       and (i.escalation_status is null or i.escalation_status = 'none')
       and i.created_at <= now() - (p_threshold_seconds || ' seconds')::interval
     order by i.created_at asc
     for update of i skip locked
  loop
    -- Mark incident as escalated
    update incidents
       set escalation_status = 'escalated',
           escalated_at = now()
     where id = v_incident.id;

    -- Record in trip audit events
    if v_incident.trip_id is not null then
      insert into trip_events (trip_id, event_type, created_by, metadata)
      values (
        v_incident.trip_id,
        'INCIDENT_ESCALATED',
        v_incident.reported_by,
        jsonb_build_object(
          'incident_id', v_incident.id,
          'seconds_unacknowledged', v_incident.seconds_unacknowledged,
          'escalated_at', now()
        )
      );
    end if;

    -- Dispatch critical escalation alerts to all admin officers
    for v_admin_rec in
      select user_id from user_roles where role = 'admin'
    loop
      insert into notifications (user_id, channel, type, title, body, data)
      values (
        v_admin_rec.user_id,
        'sms',
        'sos_escalation_sms',
        'CRITICAL SOS ESCALATION: Unacknowledged for ' || round(v_incident.seconds_unacknowledged / 60) || ' mins',
        'CRITICAL: SOS from ' || v_incident.reporter_name || ' on trip ' || coalesce(v_incident.trip_id::text, 'N/A') || ' remains unacknowledged after ' || v_incident.seconds_unacknowledged || 's! Take immediate action.',
        jsonb_build_object(
          'incident_id', v_incident.id,
          'trip_id', v_incident.trip_id,
          'seconds_unacknowledged', v_incident.seconds_unacknowledged,
          'reporter_name', v_incident.reporter_name,
          'reporter_phone', v_incident.reporter_phone
        )
      );
    end loop;

    v_escalated_list := v_escalated_list || jsonb_build_object(
      'incident_id', v_incident.id,
      'seconds_unacknowledged', v_incident.seconds_unacknowledged,
      'reporter_name', v_incident.reporter_name,
      'trip_id', v_incident.trip_id
    );
    v_escalated_count := v_escalated_count + 1;
  end loop;

  return jsonb_build_object(
    'escalated_count', v_escalated_count,
    'incidents', v_escalated_list,
    'evaluated_at', now()
  );
end;
$$;

-- 4. Enhanced resolve_incident with acknowledgment tracking
create or replace function public.resolve_incident(
  p_incident_id uuid,
  p_status      text default 'resolved',
  p_handler_id  uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_handler_id uuid;
begin
  v_handler_id := coalesce(p_handler_id, auth.uid());

  update incidents
     set status = p_status,
         handled_by = coalesce(v_handler_id, handled_by),
         acknowledged_at = coalesce(acknowledged_at, now()),
         resolved_at = case when p_status in ('resolved', 'closed') then now() else resolved_at end
   where id = p_incident_id;

  return jsonb_build_object(
    'incident_id', p_incident_id,
    'status', p_status,
    'handled_by', v_handler_id,
    'updated_at', now()
  );
end;
$$;
