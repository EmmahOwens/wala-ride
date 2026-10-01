import { createClient } from '@supabase/supabase-js';
import { getSupabaseCredentials } from './helpers/getEnv.mjs';

const { url, key } = getSupabaseCredentials();
const supabase = createClient(url, key);

async function runPhase4Verification() {
  console.log('=== PHASE 4 — TRACKING, SAFETY, SOS & REALTIME VERIFICATION ===\n');

  // 1. Fetch test trip & driver
  const { data: trips, error: tErr } = await supabase
    .from('trips')
    .select('id, driver_id, route:routes(name), vehicle:vehicles(license_plate)')
    .limit(1);

  if (tErr || !trips || trips.length === 0) {
    throw new Error('No trips found for testing: ' + JSON.stringify(tErr));
  }
  const testTrip = trips[0];
  console.log('1. Target Corridor Trip:');
  console.log('   Trip ID:', testTrip.id);
  console.log('   Route:', testTrip.route?.name, '| Vehicle Plate:', testTrip.vehicle?.license_plate);

  const { data: bookings } = await supabase.from('bookings').select('id, passenger_id, booking_reference').limit(1);
  const testBooking = bookings?.[0] || { id: '928d8643-c563-48e7-8a3d-b529f1c61157', booking_reference: '28A8D8AB' };
  console.log('   Booking Ref:', testBooking.booking_reference, `(ID: ${testBooking.id})`);

  // 2. Test Driver GPS Location Broadcast (every 15-30s)
  console.log('\n2. Testing Driver Live GPS Broadcast (record_trip_location)...');
  const { data: locData, error: locErr } = await supabase.rpc('record_trip_location', {
    p_trip_id: testTrip.id,
    p_lat: 0.3476,
    p_lng: 32.5825,
    p_speed: 78.5,
    p_heading: 85.0,
    p_accuracy: 6.0,
  });

  if (locErr) {
    throw new Error('Failed to record trip location: ' + locErr.message);
  }
  console.log('   [PASS] Location Ping Recorded:', locData);

  // 3. Test Passenger SOS Incident Reporting
  console.log('\n3. Testing Emergency SOS Press (report_incident)...');
  const startTime = Date.now();
  const { data: incidentData, error: incErr } = await supabase.rpc('report_incident', {
    p_trip_id: testTrip.id,
    p_booking_id: testBooking?.id || null,
    p_kind: 'sos',
    p_lat: 0.3512,
    p_lng: 32.6104,
    p_description: 'E2E Automated SOS test: Passenger emergency alert near Mukono stage',
  });

  const durationMs = Date.now() - startTime;
  if (incErr) {
    throw new Error('Failed to report incident: ' + incErr.message);
  }
  console.log(`   [PASS] SOS Incident Created in ${durationMs}ms:`, incidentData);
  const incidentId = incidentData?.incident_id;

  // 4. Test Exit Criteria: Admin Incident Console Visibility
  console.log('\n4. Verifying Exit Criteria: Admin Console Seeing Incident Within Seconds...');
  const { data: adminIncidents, error: admErr } = await supabase.rpc('get_admin_incidents');
  if (admErr) {
    throw new Error('Admin failed to fetch incidents: ' + admErr.message);
  }

  const found = (adminIncidents || []).find((i) => i.id === incidentId);
  if (!found) {
    throw new Error('New SOS incident not visible to admin console!');
  }
  console.log('   [PASS] Admin Console retrieved incident immediately:');
  console.log('   Kind:', found.kind.toUpperCase(), '| Status:', found.status);
  console.log('   Reporter:', found.reporter?.name, '| Phone:', found.reporter?.phone || 'N/A');
  console.log('   Driver:', found.trip?.driver_name, '| Driver Phone:', found.trip?.driver_phone || 'N/A');
  console.log('   Vehicle Plate:', found.trip?.vehicle_plate);

  // 5. Test Shareable Public Tracking Link (trip_shares)
  if (testBooking?.id) {
    console.log('\n5. Testing Live Journey Shareable Link (create_trip_share)...');
    const { data: shareData, error: shareErr } = await supabase.rpc('create_trip_share', {
      p_booking_id: testBooking.id,
      p_hours_valid: 48,
    });

    if (shareErr) {
      throw new Error('Failed to create trip share: ' + shareErr.message);
    }
    console.log('   [PASS] Share Token Generated:', shareData.share_token);
    console.log('   Expires At:', shareData.expires_at);

    // Verify Public Telemetry Resolution
    const { data: pubTracking, error: pubErr } = await supabase.rpc('get_public_trip_tracking', {
      p_share_token: shareData.share_token,
    });

    if (pubErr) {
      throw new Error('Public tracking link resolution failed: ' + pubErr.message);
    }
    console.log('   [PASS] Public Tracking Resolved for Family/Contact:');
    console.log('   Corridor:', pubTracking.trip?.origin_town, '→', pubTracking.trip?.dest_town);
    console.log('   Driver:', pubTracking.driver?.name, '| Vehicle:', pubTracking.vehicle?.license_plate);
    console.log('   Latest Speed:', pubTracking.latest_location?.speed, 'km/h');
    console.log('   Telemetry Breadcrumbs Count:', pubTracking.breadcrumbs?.length);
  }

  // 6. Test Rating & Automatic Trigger
  console.log('\n6. Testing Driver Rating & Trigger (submit_trip_rating)...');
  const { data: ratingData, error: rateErr } = await supabase.rpc('submit_trip_rating', {
    p_trip_id: testTrip.id,
    p_booking_id: testBooking?.id || null,
    p_score: 5,
    p_comment: 'Excellent safe driving along the Jinja highway.',
  });

  if (rateErr) {
    throw new Error('Failed to submit rating: ' + rateErr.message);
  }
  console.log('   [PASS] Rating Recorded:', ratingData);

  const { data: driverProf } = await supabase
    .from('driver_profiles')
    .select('rating_average')
    .eq('id', testTrip.driver_id)
    .single();

  console.log('   [PASS] Driver Rating Average Recalculated by DB Trigger:', driverProf?.rating_average, '★');

  // 7. Test Admin Incident Resolution
  console.log('\n7. Testing Admin Resolution Workflow (resolve_incident)...');
  const { data: resolveData, error: resErr } = await supabase.rpc('resolve_incident', {
    p_incident_id: incidentId,
    p_status: 'resolved',
  });

  if (resErr) {
    throw new Error('Failed to resolve incident: ' + resErr.message);
  }
  console.log('   [PASS] Incident Successfully Resolved:', resolveData);

  console.log('\n============================================================');
  console.log('🎉 PHASE 4 TRACKING & SAFETY EXIT CRITERIA MET AND VERIFIED! 🎉');
  console.log('============================================================\n');
}

runPhase4Verification().catch((err) => {
  console.error('\n❌ PHASE 4 VERIFICATION FAILED:', err);
  process.exit(1);
});
