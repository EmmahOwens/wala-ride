-- ============================================================================
-- MIGRATION: PHASE 3 MOBILE MONEY INTEGRATION & WEBHOOK ENGINE
-- ============================================================================

-- 1. Enable Supabase Realtime publication on payments table
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and tablename = 'payments'
  ) then
    alter publication supabase_realtime add table payments;
  end if;
end;
$$;

-- 2. Initiate Mobile Money Payment RPC
create or replace function initiate_momo_payment(
  p_driver_id uuid,
  p_purpose payment_purpose_enum,
  p_plan_id uuid default null,
  p_amount_ugx integer default null,
  p_phone_number text default '+256700000000',
  p_network text default 'MTN MoMo',
  p_leads_count integer default 10
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan record;
  v_amount int;
  v_method payment_method_enum;
  v_ref text;
  v_payment_id uuid;
begin
  -- Validate driver
  if not exists (select 1 from driver_profiles where id = p_driver_id) then
    raise exception 'DRIVER_NOT_FOUND';
  end if;

  -- Determine method
  if lower(coalesce(p_network, '')) like '%airtel%' then
    v_method := 'airtel';
  else
    v_method := 'momo';
  end if;

  -- Determine amount
  if p_purpose = 'subscription' then
    if p_plan_id is null then
      raise exception 'PLAN_ID_REQUIRED_FOR_SUBSCRIPTION';
    end if;
    select * into v_plan from subscription_plans where id = p_plan_id;
    if v_plan.id is null then
      raise exception 'PLAN_NOT_FOUND';
    end if;
    v_amount := v_plan.price_ugx;
  else
    -- lead topup
    v_amount := coalesce(p_amount_ugx, 10000);
  end if;

  -- Generate unique reference
  v_ref := 'WALA-' || upper(v_method::text) || '-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  -- Insert pending payment
  insert into payments (
    driver_id,
    plan_id,
    purpose,
    amount_ugx,
    method,
    status,
    provider,
    provider_ref,
    idempotency_key,
    applied,
    raw_callback
  ) values (
    p_driver_id,
    p_plan_id,
    p_purpose,
    v_amount,
    v_method,
    'pending',
    p_network,
    v_ref,
    v_ref,
    false,
    jsonb_build_object(
      'phone_number', p_phone_number,
      'leads_count', p_leads_count,
      'initiated_from', 'web'
    )
  ) returning id into v_payment_id;

  return jsonb_build_object(
    'payment_id', v_payment_id,
    'provider_ref', v_ref,
    'amount_ugx', v_amount,
    'method', v_method,
    'status', 'pending',
    'phone_number', p_phone_number,
    'network', p_network,
    'instructions', 'USSD push prompt sent to ' || p_phone_number || '. Enter your Mobile Money PIN on your phone to complete payment.'
  );
end;
$$;

-- 3. Webhook Processor (Handles automated payment completion idempotently)
create or replace function process_payment_webhook(
  p_payment_id uuid,
  p_status text,
  p_provider_ref text default null,
  p_raw_callback jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment record;
  v_leads_count int := 10;
begin
  perform pg_advisory_xact_lock(hashtext('payment:' || p_payment_id::text));

  select * into v_payment from payments where id = p_payment_id for update;
  if v_payment.id is null then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;

  -- If already applied / successful, return idempotently
  if v_payment.status = 'successful' and v_payment.applied then
    return jsonb_build_object(
      'success', true,
      'already_applied', true,
      'payment_id', v_payment.id,
      'status', 'successful'
    );
  end if;

  if lower(p_status) in ('successful', 'completed', 'success') then
    -- Update payment to successful
    update payments
       set status = 'successful',
           completed_at = now(),
           provider_ref = coalesce(p_provider_ref, payments.provider_ref),
           raw_callback = coalesce(p_raw_callback, payments.raw_callback)
     where id = p_payment_id;

    -- Apply fulfillment based on purpose
    if v_payment.purpose = 'subscription' then
      perform activate_subscription(p_payment_id);
    elsif v_payment.purpose = 'lead_topup' then
      v_leads_count := coalesce((v_payment.raw_callback->>'leads_count')::int, 10);
      perform credit_lead_topup(p_payment_id, v_leads_count);
    end if;

    return jsonb_build_object(
      'success', true,
      'payment_id', p_payment_id,
      'status', 'successful',
      'purpose', v_payment.purpose,
      'applied', true
    );
  else
    -- Payment failed or cancelled
    update payments
       set status = 'failed',
           completed_at = now(),
           raw_callback = coalesce(p_raw_callback, payments.raw_callback)
     where id = p_payment_id;

    return jsonb_build_object(
      'success', false,
      'payment_id', p_payment_id,
      'status', 'failed'
    );
  end if;
end;
$$;

-- 4. Get Driver Payment History
create or replace function get_driver_payment_history(p_driver_id uuid)
returns table (
  payment_id uuid,
  purpose text,
  amount_ugx int,
  method text,
  status text,
  provider text,
  provider_ref text,
  plan_name text,
  initiated_at timestamptz,
  completed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    p.id as payment_id,
    p.purpose::text,
    p.amount_ugx,
    p.method::text,
    p.status::text,
    coalesce(p.provider, 'Mobile Money') as provider,
    coalesce(p.provider_ref, p.id::text) as provider_ref,
    coalesce(sp.name, 'Lead Top-up') as plan_name,
    p.initiated_at,
    p.completed_at
  from payments p
  left join subscription_plans sp on sp.id = p.plan_id
  where p.driver_id = p_driver_id
  order by p.initiated_at desc
  limit 50;
end;
$$;
