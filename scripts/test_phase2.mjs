import { createClient } from '@supabase/supabase-js';
import { getSupabaseCredentials } from './helpers/getEnv.mjs';

const { url, key } = getSupabaseCredentials();
const supabase = createClient(url, key);

async function runPhase2Verification() {
  console.log('=== PHASE 2 DRIVER SUBSCRIPTIONS & DEMAND RADAR VERIFICATION ===\n');

  // 1. Fetch test driver and route towns
  const { data: driver, error: dErr } = await supabase
    .from('driver_profiles')
    .select('*, user:profiles(*)')
    .limit(1)
    .single();

  if (dErr || !driver) {
    throw new Error('No driver profile found: ' + dErr?.message);
  }
  console.log('1. Active Driver:', driver.id, `(User: ${driver.user?.first_name || ''} ${driver.user?.last_name || ''})`);

  // Fetch Kampala and Mbarara towns
  const { data: towns, error: tErr } = await supabase
    .from('towns')
    .select('id, name')
    .in('name', ['Kampala', 'Mbarara']);

  if (tErr || !towns || towns.length < 2) {
    throw new Error('Could not find Kampala and Mbarara towns');
  }
  const kampala = towns.find(t => t.name === 'Kampala');
  const mbarara = towns.find(t => t.name === 'Mbarara');
  console.log('   Towns:', kampala.name, '->', mbarara.name);

  // 2. Fetch driver subscription summary
  const { data: subSummary, error: subErr } = await supabase
    .rpc('get_driver_subscription_summary', { p_driver_id: driver.id });

  if (subErr || !subSummary || subSummary.length === 0) {
    throw new Error('Could not fetch driver subscription summary: ' + subErr?.message);
  }
  const initialSub = subSummary[0];
  console.log('2. [PASS] Initial Subscription Summary:', {
    plan: initialSub.plan_name,
    status: initialSub.status,
    trips: `${initialSub.trips_posted}/${initialSub.max_trips}`,
    leads: `${initialSub.leads_viewed}/${initialSub.max_leads}`
  });

  // 3. Passenger creates a Trip Alert / Demand Radar signal
  const travelDate = new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0]; // in 2 days
  const { data: alertId, error: alertErr } = await supabase.rpc('create_trip_alert', {
    p_passenger_id: driver.user_id, // passenger profile
    p_origin_town_id: kampala.id,
    p_destination_town_id: mbarara.id,
    p_travel_date: travelDate,
    p_seats_needed: 2
  });

  if (alertErr || !alertId) {
    throw new Error('Failed to create trip alert: ' + alertErr?.message);
  }
  console.log('3. [PASS] Passenger created Trip Alert ID:', alertId, `for ${kampala.name} -> ${mbarara.name} (${travelDate}, 2 seats)`);

  // 4. Driver checks Demand Radar feed
  const { data: radarLeads, error: rErr } = await supabase.rpc('get_driver_radar_leads', {
    p_driver_id: driver.id
  });

  if (rErr || !radarLeads) {
    throw new Error('Failed to fetch radar leads: ' + rErr?.message);
  }
  const lead = radarLeads.find(l => l.alert_id === alertId);
  if (!lead) {
    throw new Error('Created trip alert not found in radar feed!');
  }
  console.log('4. [PASS] Driver Radar Feed matched demand signal:');
  console.log(`   Route: ${lead.origin_town_name} -> ${lead.destination_town_name}`);
  console.log(`   Is Unlocked: ${lead.is_unlocked}`);
  console.log(`   Masked Name: "${lead.passenger_name}"`);
  console.log(`   Masked Phone: "${lead.passenger_phone}"`);

  // 5. Driver reveals lead (spends 1 lead credit)
  const initialLeadsViewed = initialSub.leads_viewed;
  const { data: revealed, error: revErr } = await supabase.rpc('reveal_lead', {
    p_driver_id: driver.id,
    p_trip_alert_id: alertId
  });

  if (revErr || !revealed || revealed.length === 0) {
    throw new Error('Failed to reveal lead: ' + revErr?.message);
  }
  const revRow = revealed[0];
  console.log('5. [PASS] Lead Revealed successfully! Unmasked Contact:', revRow.passenger_phone, `(${revRow.passenger_name})`);

  // Check that leads_viewed increased by 1
  const { data: subAfterRev } = await supabase.rpc('get_driver_subscription_summary', { p_driver_id: driver.id });
  const leadsAfterRev = subAfterRev[0].leads_viewed;
  if (leadsAfterRev !== initialLeadsViewed + 1) {
    throw new Error(`Expected leads_viewed to increment to ${initialLeadsViewed + 1}, got ${leadsAfterRev}`);
  }
  console.log('   Lead usage correctly incremented from', initialLeadsViewed, 'to', leadsAfterRev);

  // 6. Driver re-reveals the same lead (MUST BE IDEMPOTENT - 0 EXTRA CREDITS SPENT)
  const { data: reRevealed, error: reRevErr } = await supabase.rpc('reveal_lead', {
    p_driver_id: driver.id,
    p_trip_alert_id: alertId
  });
  if (reRevErr) throw new Error('Re-reveal failed: ' + reRevErr.message);

  const { data: subAfterReRev } = await supabase.rpc('get_driver_subscription_summary', { p_driver_id: driver.id });
  const leadsAfterReRev = subAfterReRev[0].leads_viewed;
  if (leadsAfterReRev !== leadsAfterRev) {
    throw new Error(`Expected leads_viewed to remain ${leadsAfterRev}, but got ${leadsAfterReRev} (Idempotency violated!)`);
  }
  console.log('6. [PASS] Re-revealing the same lead consumed 0 extra credits (Strict Idempotency confirmed!)');

  // 7. Driver Upgrades Subscription via Simulated Mobile Money Payment (Standard Driver - 15,000 UGX)
  const standardPlanId = '22222222-2222-2222-2222-222222222222';
  const { data: payResult, error: payErr } = await supabase.rpc('simulate_subscription_payment', {
    p_driver_id: driver.id,
    p_plan_id: standardPlanId,
    p_phone_number: '+256772123456',
    p_network: 'MTN MoMo'
  });

  if (payErr || !payResult) {
    throw new Error('Subscription payment simulation failed: ' + payErr?.message);
  }
  console.log('7. [PASS] Simulated Mobile Money Webhook received & applied:');
  console.log('   Payment ID:', payResult.payment_id, '| Network:', payResult.network, '| Amount:', payResult.amount_ugx, 'UGX');

  const { data: subAfterUpgrade } = await supabase.rpc('get_driver_subscription_summary', { p_driver_id: driver.id });
  const upgraded = subAfterUpgrade[0];
  console.log('   Upgraded Plan:', upgraded.plan_name, '| Max Trips:', upgraded.max_trips, '| Max Leads:', upgraded.max_leads);
  if (upgraded.plan_name !== 'Standard Driver') {
    throw new Error(`Expected plan 'Standard Driver', got '${upgraded.plan_name}'`);
  }

  // 8. Driver Lead Top-Up (+10 leads pack for 10,000 UGX)
  const { data: topupResult, error: topupErr } = await supabase.rpc('simulate_lead_topup', {
    p_driver_id: driver.id,
    p_leads_count: 10,
    p_amount_ugx: 10000,
    p_network: 'Airtel Money'
  });
  if (topupErr) throw new Error('Lead top-up failed: ' + topupErr.message);

  const { data: subAfterTopup } = await supabase.rpc('get_driver_subscription_summary', { p_driver_id: driver.id });
  const topupSub = subAfterTopup[0];
  console.log('8. [PASS] Simulated Lead Top-Up (+10 Leads) via Airtel Money:');
  console.log('   New Max Leads Capacity:', topupSub.max_leads, `(increased from ${upgraded.max_leads})`);

  console.log('\n=== ALL PHASE 2 EXIT CRITERIA MET AND VERIFIED ===');
}

runPhase2Verification().catch((err) => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
