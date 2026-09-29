-- ============================================================================
-- MIGRATION: FIX PAYMENT SIMULATION METHOD ENUM
-- ============================================================================

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
  v_method payment_method_enum;
begin
  select * into v_plan from subscription_plans where id = p_plan_id;
  if v_plan.id is null then
    raise exception 'PLAN_NOT_FOUND';
  end if;

  if lower(coalesce(p_network, '')) like '%airtel%' then
    v_method := 'airtel';
  else
    v_method := 'momo';
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
    v_method,
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
  v_method payment_method_enum;
begin
  if lower(coalesce(p_network, '')) like '%airtel%' then
    v_method := 'airtel';
  else
    v_method := 'momo';
  end if;

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
    v_method,
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
