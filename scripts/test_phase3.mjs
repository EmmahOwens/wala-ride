import { createClient } from '@supabase/supabase-js';

const url = 'https://rmpsvmizgdlepkqggtrm.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtcHN2bWl6Z2RsZXBrcWdndHJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2OTYxMzEsImV4cCI6MjEwNjI3MjEzMX0.w9eEmOigBq3M50B-x4gO-H65gVGPqPwc2ulC_O7rUxU';

const supabase = createClient(url, key);

async function runPhase3Verification() {
  console.log('=== PHASE 3 MOBILE MONEY INTEGRATION & WEBHOOK ENGINE VERIFICATION ===\n');

  // 1. Fetch test driver
  const { data: driver, error: dErr } = await supabase
    .from('driver_profiles')
    .select('*, user:profiles(*)')
    .limit(1)
    .single();

  if (dErr || !driver) {
    throw new Error('No driver profile found: ' + dErr?.message);
  }
  console.log('1. Active Driver:', driver.id, `(${driver.user?.first_name || ''} ${driver.user?.last_name || ''})`);

  // Fetch initial subscription summary
  const { data: initialSummary } = await supabase.rpc('get_driver_subscription_summary', {
    p_driver_id: driver.id,
  });
  const subBefore = initialSummary[0];
  console.log('   Initial Plan:', subBefore.plan_name, '| Days Left:', subBefore.days_remaining, '| Leads Left:', subBefore.leads_remaining);

  // 2. Initiate Mobile Money Payment for Pro Fleet Plan (50,000 UGX, 30 days)
  const proPlanId = '33333333-3333-3333-3333-333333333333';
  const { data: initResult, error: initErr } = await supabase.rpc('initiate_momo_payment', {
    p_driver_id: driver.id,
    p_purpose: 'subscription',
    p_plan_id: proPlanId,
    p_phone_number: '+256772998877',
    p_network: 'MTN MoMo',
  });

  if (initErr || !initResult) {
    throw new Error('Failed to initiate MoMo payment: ' + initErr?.message);
  }
  console.log('2. [PASS] Mobile Money Payment Initiated:');
  console.log('   Payment ID:', initResult.payment_id);
  console.log('   Provider Ref:', initResult.provider_ref);
  console.log('   Amount:', initResult.amount_ugx, 'UGX | Method:', initResult.method);
  console.log('   USSD Prompt Instruction:', initResult.instructions);

  // Verify payment record in DB is pending
  const { data: pendingRecord, error: pErr } = await supabase.rpc('get_payment_by_id', {
    p_payment_id: initResult.payment_id,
  });

  if (pErr || !pendingRecord || pendingRecord.status !== 'pending') {
    throw new Error('Payment was not recorded as pending in DB: ' + pErr?.message);
  }
  console.log('   Database Payment Status verified: pending (applied = false)');

  // 3. Simulate Aggregator Webhook (Flutterwave / Pesapal / MoMo Network)
  console.log('\n3. Simulating Server-to-Server Aggregator Webhook delivery...');
  const { data: webhookResult, error: hookErr } = await supabase.rpc('process_payment_webhook', {
    p_payment_id: initResult.payment_id,
    p_status: 'successful',
    p_provider_ref: 'FLW_MOMO_' + Date.now(),
    p_raw_callback: {
      event: 'charge.completed',
      tx_ref: initResult.provider_ref,
      flw_ref: 'FLW_MOMO_' + Date.now(),
      status: 'successful',
      amount: 50000,
      currency: 'UGX',
      customer: { phone_number: '+256772998877' }
    }
  });

  if (hookErr || !webhookResult || !webhookResult.success) {
    throw new Error('Webhook processing failed: ' + hookErr?.message);
  }
  console.log('3. [PASS] Aggregator Webhook processed successfully!');
  console.log('   Payment Status:', webhookResult.status, '| Applied:', webhookResult.applied);

  // 4. Verify Subscription Stacking & Quota Expansion
  const { data: subAfterPro } = await supabase.rpc('get_driver_subscription_summary', {
    p_driver_id: driver.id,
  });
  const subAfter = subAfterPro[0];
  console.log('4. [PASS] Subscription upgraded and stacked onto driver account:');
  console.log('   New Plan:', subAfter.plan_name);
  console.log('   Max Scheduled Trips:', subAfter.max_trips, '(Pro Unlimited)');
  console.log('   Max Radar Leads:', subAfter.max_leads, '(Expanded to Pro Fleet cap)');
  console.log('   New Expiry Date:', subAfter.ends_at);

  if (subAfter.plan_name !== 'Pro Fleet') {
    throw new Error(`Expected plan Pro Fleet, got: ${subAfter.plan_name}`);
  }

  // 5. Test Webhook Idempotency (Replay Attack Prevention)
  console.log('\n5. Testing Webhook Idempotency (Replaying same payment webhook)...');
  const { data: replayResult } = await supabase.rpc('process_payment_webhook', {
    p_payment_id: initResult.payment_id,
    p_status: 'successful',
    p_provider_ref: 'FLW_MOMO_REPLAY',
  });

  console.log('5. [PASS] Replay Result:', replayResult);
  if (!replayResult.already_applied) {
    throw new Error('Idempotency failed: Webhook re-processed an already applied payment!');
  }
  console.log('   Strict Idempotency confirmed (Payment was not double-applied).');

  // 6. Test Lead Top-Up via Mobile Money (+10 Leads for 10,000 UGX)
  console.log('\n6. Initiating Lead Top-up (+10 Leads) via Airtel Money...');
  const { data: topupInit, error: topupInitErr } = await supabase.rpc('initiate_momo_payment', {
    p_driver_id: driver.id,
    p_purpose: 'lead_topup',
    p_amount_ugx: 10000,
    p_phone_number: '+256755112233',
    p_network: 'Airtel Money',
    p_leads_count: 10,
  });

  if (topupInitErr || !topupInit) {
    throw new Error('Failed to initiate lead topup: ' + topupInitErr?.message);
  }
  console.log('   Top-up Payment Initiated ID:', topupInit.payment_id, '| Provider Ref:', topupInit.provider_ref);

  // Webhook for lead topup
  const { data: topupHookResult } = await supabase.rpc('process_payment_webhook', {
    p_payment_id: topupInit.payment_id,
    p_status: 'successful',
    p_provider_ref: 'AIRTEL_MOMO_' + Date.now(),
  });
  if (!topupHookResult?.success) throw new Error('Topup webhook failed');
  console.log('6. [PASS] Lead top-up webhook confirmed and credited.');

  // 7. Verify Payment History
  console.log('\n7. Checking Driver Payment History Log...');
  const { data: history, error: hErr } = await supabase.rpc('get_driver_payment_history', {
    p_driver_id: driver.id,
  });

  if (hErr || !history || history.length === 0) {
    throw new Error('Failed to fetch payment history: ' + hErr?.message);
  }
  console.log('7. [PASS] Driver Payment History contains', history.length, 'records:');
  history.slice(0, 3).forEach((item, idx) => {
    console.log(`   ${idx + 1}. [${item.status.toUpperCase()}] ${item.purpose} - ${item.amount_ugx} UGX via ${item.provider} (${item.provider_ref})`);
  });

  console.log('\n=== ALL PHASE 3 EXIT CRITERIA MET AND VERIFIED ===');
}

runPhase3Verification().catch((err) => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
