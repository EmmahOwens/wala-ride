-- ============================================================================
-- MIGRATION: SUPABASE AUTHENTICATION SYSTEM ENHANCEMENTS
-- ============================================================================

-- 1. Enhanced handle_new_user trigger supporting OAuth metadata, phone fallback, and auto-roles
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_first_name text;
  v_last_name text;
  v_phone text;
  v_avatar text;
  v_role text;
begin
  -- Extract names (supports first/last name fields and full_name / name from Google OAuth)
  v_first_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'first_name'), ''),
    nullif(trim(split_part(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''), ' ', 1)), ''),
    ''
  );
  
  v_last_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'last_name'), ''),
    nullif(trim(substr(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''), length(v_first_name) + 1)), ''),
    ''
  );

  v_phone := coalesce(new.phone, nullif(trim(new.raw_user_meta_data->>'phone'), ''));
  v_avatar := coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture');
  v_role := coalesce(new.raw_user_meta_data->>'role', 'passenger');

  -- Upsert profile
  insert into public.profiles (id, phone, email, first_name, last_name, profile_photo_url)
  values (
    new.id,
    v_phone,
    new.email,
    v_first_name,
    v_last_name,
    v_avatar
  )
  on conflict (id) do update set
    phone = coalesce(excluded.phone, profiles.phone),
    email = coalesce(excluded.email, profiles.email),
    first_name = case when profiles.first_name is null or profiles.first_name = '' then excluded.first_name else profiles.first_name end,
    last_name = case when profiles.last_name is null or profiles.last_name = '' then excluded.last_name else profiles.last_name end,
    profile_photo_url = coalesce(excluded.profile_photo_url, profiles.profile_photo_url),
    updated_at = now();

  -- Auto-assign selected or default role
  if v_role in ('passenger', 'driver') then
    insert into public.user_roles (user_id, role)
    values (new.id, v_role::user_role_enum)
    on conflict (user_id, role) do nothing;

    if v_role = 'driver' then
      insert into public.driver_profiles (user_id, verification_status)
      values (new.id, 'pending')
      on conflict (user_id) do nothing;
    end if;
  else
    insert into public.user_roles (user_id, role)
    values (new.id, 'passenger'::user_role_enum)
    on conflict (user_id, role) do nothing;
  end if;

  return new;
end;
$$;

-- 2. Secure RPC function for self-role assignment (passenger / driver)
create or replace function public.assign_user_role(p_role text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_role user_role_enum;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if p_role not in ('passenger', 'driver') then
    raise exception 'INVALID_ROLE_SELF_ASSIGNMENT';
  end if;

  v_role := p_role::user_role_enum;

  insert into public.user_roles (user_id, role)
  values (v_uid, v_role)
  on conflict (user_id, role) do nothing;

  -- Ensure driver profile stub exists if driver role selected
  if p_role = 'driver' then
    insert into public.driver_profiles (user_id, verification_status)
    values (v_uid, 'pending')
    on conflict (user_id) do nothing;
  end if;

  return true;
end;
$$;

-- Grant execution to authenticated users
grant execute on function public.assign_user_role(text) to authenticated;
