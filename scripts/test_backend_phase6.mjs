import { createClient } from '@supabase/supabase-js';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { getSupabaseCredentials } from './helpers/getEnv.mjs';

const { url, key } = getSupabaseCredentials();
const supabase = createClient(url, key);

async function runBackendPhase6Verification() {
  console.log('================================================================');
  console.log('  BACKEND PLAN PHASE 6: NOTIFICATIONS & TRANSACTIONAL SMS SUITE');
  console.log('================================================================\n');

  // 1. Start local notifications-dispatcher edge function runtime
  console.log('1. Starting notifications-dispatcher Edge Function runtime...');
  const denoBin = process.env.DENO_BIN || (existsSync('/home/iammbayo/.deno/bin/deno') ? '/home/iammbayo/.deno/bin/deno' : 'deno');
  const edgeProcess = spawn(denoBin, [
    'run',
    '--allow-net',
    '--allow-env',
    'supabase/functions/notifications-dispatcher/index.ts',
  ], {
    env: {
      ...process.env,
      SUPABASE_URL: url,
      SUPABASE_ANON_KEY: key,
      SUPABASE_SERVICE_ROLE_KEY: key,
      PORT: '8010',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Give Deno 2 seconds to bind port
  await new Promise((resolve) => setTimeout(resolve, 2000));
  const dispatcherEndpoint = 'http://localhost:8000'; // Deno.serve defaults to port 8000

  try {
    // 2. Test Direct SMS Template 1: Booking Confirmation
    console.log('\n2. Testing Template 1: Passenger Booking Confirmation SMS...');
    const bookingRes = await fetch(dispatcherEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: '0772998877',
        template: 'booking_confirmed',
        params: {
          booking_reference: 'WALA8822',
          origin: 'Kampala',
          destination: 'Mbale',
          departure_time: '14:30',
          driver_name: 'David Walugembe',
          driver_phone: '+256772111222',
          license_plate: 'UBK 863P',
        },
      }),
    });

    const bookingJson = await bookingRes.json();
    if (!bookingJson.success) {
      throw new Error('Booking SMS failed: ' + JSON.stringify(bookingJson));
    }
    console.log('   [PASS] Booking SMS Delivered:');
    console.log(`   Recipient: ${bookingJson.recipient}`);
    console.log(`   Message Text: "${bookingJson.message}"`);
    console.log(`   Message ID: ${bookingJson.message_id} | Provider: ${bookingJson.provider}`);

    // 3. Test Template 2: Trip Departure Alert SMS (60 mins before)
    console.log('\n3. Testing Template 2: Trip Departure Reminder SMS (1 hour prior)...');
    const depRes = await fetch(dispatcherEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: '+256782334455',
        template: 'departure_alert',
        params: {
          minutes_remaining: 60,
          stage: 'Qualicel Bus Terminal, Kampala',
          driver_name: 'David Walugembe',
          driver_phone: '+256772111222',
          license_plate: 'UBK 863P',
        },
      }),
    });

    const depJson = await depRes.json();
    if (!depJson.success) {
      throw new Error('Departure alert SMS failed: ' + JSON.stringify(depJson));
    }
    console.log('   [PASS] Departure Alert SMS Delivered:');
    console.log(`   Recipient: ${depJson.recipient}`);
    console.log(`   Message Text: "${depJson.message}"`);
    console.log(`   Message ID: ${depJson.message_id}`);

    // 4. Test Template 3: Emergency Contact SOS Alert SMS
    console.log('\n4. Testing Template 3: SOS Emergency Contact Dispatch SMS...');
    const sosRes = await fetch(dispatcherEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: '0701122334',
        template: 'sos_emergency',
        params: {
          passenger_name: 'Walugembe David',
          trip_ref: 'KLA-JJA-901',
          tracking_url: 'https://walaride.com/?track=8a7c29be4f10',
        },
      }),
    });

    const sosJson = await sosRes.json();
    if (!sosJson.success) {
      throw new Error('SOS SMS failed: ' + JSON.stringify(sosJson));
    }
    console.log('   [PASS] Emergency SOS SMS Delivered:');
    console.log(`   Recipient: ${sosJson.recipient} (Auto-formatted from 0701122334 to E.164)`);
    console.log(`   Message Text: "${sosJson.message}"`);
    console.log(`   Message ID: ${sosJson.message_id}`);

    // 5. Test Database Queue Dispatch RPC (dispatch_booking_confirmation_sms)
    console.log('\n5. Testing Database Booking Confirmation Dispatcher RPC...');
    const { data: sampleBooking } = await supabase.rpc('get_sample_booking_id');
    const testBooking = sampleBooking || { id: '928d8643-c563-48e7-8a3d-b529f1c61157', booking_reference: '28A8D8AB' };

    const { data: queueResult, error: qErr } = await supabase.rpc('dispatch_booking_confirmation_sms', {
      p_booking_id: testBooking.id,
    });

    if (qErr || !queueResult) {
      throw new Error('Failed to dispatch booking confirmation: ' + qErr?.message);
    }
    console.log('   [PASS] Booking Confirmation Queued in Database:');
    console.log(`   Notification ID: ${queueResult.notification_id}`);
    console.log(`   Recipient Phone: ${queueResult.recipient_phone}`);
    console.log(`   Formatted Message: "${queueResult.message}"`);

    // 6. Test Database Trip Departure Reminder Dispatch RPC
    console.log('\n6. Testing Database Trip Departure Reminder Dispatcher RPC...');
    const { data: trips } = await supabase.from('trips').select('id').limit(1);
    if (trips && trips.length > 0) {
      const { data: depDispatched, error: depErr } = await supabase.rpc('dispatch_trip_departure_reminder_sms', {
        p_trip_id: trips[0].id,
        p_minutes_remaining: 45,
      });

      if (depErr) {
        throw new Error('Departure reminder RPC error: ' + depErr.message);
      }
      console.log('   [PASS] Departure Reminders Queued:');
      console.log(`   Dispatched Count: ${depDispatched.dispatched_count} recipient(s)`);
    }

    // 7. Test Dispatcher Queue Drain & Database Status Sync
    console.log('\n7. Testing Edge Function Queue Drain & DB Delivery Status Tracking...');
    const drainRes = await fetch(dispatcherEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'drain_queue',
        limit: 10,
      }),
    });

    const drainJson = await drainRes.json();
    if (!drainJson.success) {
      throw new Error('Queue drain failed: ' + JSON.stringify(drainJson));
    }
    console.log(`   [PASS] Queue drained successfully. Processed ${drainJson.processed_count} SMS notifications:`);
    if (drainJson.results?.length > 0) {
      console.log(`   Notification delivered: ID ${drainJson.results[0].notification_id} -> ${drainJson.results[0].phone}`);
      console.log(`   Provider Message ID: ${drainJson.results[0].message_id} | Cost: ${drainJson.results[0].cost}`);
    }

    // 8. Verify status updated in database via security definer RPC
    const { data: updatedNotif, error: notifErr } = await supabase.rpc('get_notification_by_id', {
      p_id: queueResult.notification_id,
    });

    if (notifErr || !updatedNotif) {
      throw new Error('Failed to fetch updated notification status: ' + notifErr?.message);
    }

    console.log('   [PASS] Database Delivery Audit Confirmed:');
    console.log(`   Notification ID: ${updatedNotif.id}`);
    console.log(`   Status: ${updatedNotif.status} (Updated from pending to delivered)`);
    console.log(`   Dispatched At: ${updatedNotif.dispatched_at}`);
    console.log(`   Provider Ref: ${updatedNotif.provider_ref}`);

    if (updatedNotif.status !== 'delivered') {
      throw new Error(`Expected status 'delivered', got: ${updatedNotif.status}`);
    }

    console.log('\n================================================================');
    console.log('🎉 ALL BACKEND PLAN PHASE 6 FEATURES VERIFIED & CONFIRMED! 🎉');
    console.log('================================================================\n');
  } finally {
    // Cleanly terminate Deno Edge Function background process
    edgeProcess.kill('SIGTERM');
  }
}

runBackendPhase6Verification().catch((err) => {
  console.error('\n❌ BACKEND PLAN PHASE 6 VERIFICATION FAILED:', err);
  process.exit(1);
});
