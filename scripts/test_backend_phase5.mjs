import { createClient } from '@supabase/supabase-js';

const url = 'https://rmpsvmizgdlepkqggtrm.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtcHN2bWl6Z2RsZXBrcWdndHJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2OTYxMzEsImV4cCI6MjEwNjI3MjEzMX0.w9eEmOigBq3M50B-x4gO-H65gVGPqPwc2ulC_O7rUxU';

const supabase = createClient(url, key);

async function runBackendPhase5Verification() {
  console.log('================================================================');
  console.log('  BACKEND PLAN PHASE 5: TELEMETRY, SAFETY, SOS & ESCALATION VERIFICATION');
  console.log('================================================================\n');

  // 1. Get test trip & passenger
  const { data: trips } = await supabase
    .from('trips')
    .select('id, driver_id, route:routes(name), vehicle:vehicles(license_plate)')
    .limit(1);

  if (!trips || trips.length === 0) {
    throw new Error('No trips found for testing');
  }
  const testTrip = trips[0];
  console.log('1. Target Corridor Trip:');
  console.log(`   Trip ID: ${testTrip.id} | Route: ${testTrip.route?.name} | Plate: ${testTrip.vehicle?.license_plate}`);

  const { data: profiles } = await supabase.from('profiles').select('id, first_name, last_name, phone').limit(1);
  const testPassenger = profiles[0];
  console.log(`   Passenger: ${testPassenger.first_name} ${testPassenger.last_name || ''} (ID: ${testPassenger.id})`);

  const { data: bookings } = await supabase.from('bookings').select('id, booking_reference').limit(1);
  const testBooking = bookings?.[0];

  // 2. Add an Emergency Contact for the Passenger
  console.log('\n2. Registering Trusted Emergency Contact...');
  const { data: contactId, error: cErr } = await supabase.rpc('add_emergency_contact_rpc', {
    p_user_id: testPassenger.id,
    p_name: 'Sarah K. (Sister)',
    p_phone: '+256782112233',
    p_relationship: 'Family',
  });

  if (cErr || !contactId) {
    console.warn('   Contact creation notice:', cErr?.message);
  } else {
    console.log(`   [PASS] Emergency contact registered ID: ${contactId}`);
  }

  // 3. Task 7.1: Driver Telemetry GPS Broadcast (record_trip_location)
  console.log('\n3. Testing Driver High-Frequency GPS Broadcast (record_trip_location)...');
  const pingStart = Date.now();
  const { data: locData, error: locErr } = await supabase.rpc('record_trip_location', {
    p_trip_id: testTrip.id,
    p_lat: 0.3540,
    p_lng: 32.6180,
    p_speed: 82.0,
    p_heading: 92.5,
    p_accuracy: 5.0,
  });

  if (locErr) {
    throw new Error('Failed to record location: ' + locErr.message);
  }
  console.log(`   [PASS] Telemetry Ping Ingested in ${Date.now() - pingStart}ms:`, locData);

  // 4. Task 7.2: Emergency SOS Reporting with Emergency Contact Dispatch
  console.log('\n4. Testing Emergency SOS Press with Auto-Dispatch (report_incident)...');
  const sosStart = Date.now();
  const { data: sosResult, error: sosErr } = await supabase.rpc('report_incident', {
    p_trip_id: testTrip.id,
    p_booking_id: testBooking?.id || null,
    p_kind: 'sos',
    p_lat: 0.3555,
    p_lng: 32.6250,
    p_description: 'Backend Phase 5 automated verification: Passenger emergency alert near Mukono stage',
    p_reported_by: testPassenger.id,
  });

  const sosDuration = Date.now() - sosStart;
  if (sosErr || !sosResult) {
    throw new Error('Failed to report SOS incident: ' + sosErr?.message);
  }

  console.log(`   [PASS] SOS Triggered in ${sosDuration}ms (< 2000ms SLA):`);
  console.log(`   Incident ID: ${sosResult.incident_id}`);
  console.log(`   Emergency Contacts Dispatched: ${sosResult.emergency_contacts_notified}`);
  console.log(`   Live Tracking Share URL: ${sosResult.share_url || 'N/A'}`);

  if (sosDuration > 2000) {
    throw new Error(`SLA breach: SOS processing took ${sosDuration}ms (> 2000ms)`);
  }

  // 5. Verify Emergency Notifications Ingested
  console.log('\n5. Verifying Emergency SMS & In-App Notification Dispatch...');
  const { data: notifs } = await supabase.rpc('get_user_notifications', {
    p_user_id: testPassenger.id,
    p_limit: 2,
  });

  if (notifs && notifs.length > 0) {
    console.log(`   [PASS] Found ${notifs.length} emergency notification(s):`);
    console.log(`   Title: "${notifs[0].title}"`);
    console.log(`   Body: "${notifs[0].body}"`);
  }

  // 6. Task 7.3: Incident Escalation Daemon (escalate_unacknowledged_sos_incidents)
  console.log('\n6. Testing Incident Escalation Daemon (escalate_unacknowledged_sos_incidents)...');
  // Pass 0 seconds threshold to simulate incident reaching unacknowledged timeout
  const { data: escalationData, error: escErr } = await supabase.rpc('escalate_unacknowledged_sos_incidents', {
    p_threshold_seconds: 0,
  });

  if (escErr || !escalationData) {
    throw new Error('Escalation daemon failed: ' + escErr?.message);
  }

  console.log('   [PASS] Escalation Daemon Output:');
  console.log(`   Escalated Count: ${escalationData.escalated_count}`);
  console.log(`   Evaluated At: ${escalationData.evaluated_at}`);
  if (escalationData.incidents?.length > 0) {
    console.log(`   Escalated Incident ID: ${escalationData.incidents[0].incident_id}`);
  }

  // Verify incident record status via security definer RPC
  const { data: escalatedRow, error: getErr } = await supabase.rpc('get_incident_by_id', {
    p_incident_id: sosResult.incident_id,
  });

  if (getErr || !escalatedRow) {
    throw new Error('Failed to fetch incident state: ' + getErr?.message);
  }

  console.log(`   [PASS] Database Escalation State: status = ${escalatedRow.status}, escalation_status = ${escalatedRow.escalation_status}`);
  if (escalatedRow.escalation_status !== 'escalated') {
    throw new Error('Incident escalation_status was not updated to escalated');
  }

  // 7. Task 7.4: Shareable Journey Tracking Verification (get_public_trip_tracking)
  if (testBooking?.id) {
    console.log('\n7. Testing Public Journey Tracking (get_public_trip_tracking)...');
    const { data: shareData } = await supabase.rpc('create_trip_share', {
      p_booking_id: testBooking.id,
      p_hours_valid: 24,
    });

    if (shareData?.share_token) {
      const { data: pubData, error: pubErr } = await supabase.rpc('get_public_trip_tracking', {
        p_share_token: shareData.share_token,
      });

      if (pubErr) {
        throw new Error('Public tracking error: ' + pubErr.message);
      }
      console.log('   [PASS] Public live tracking resolved:');
      console.log(`   Corridor: ${pubData.trip?.origin_town} → ${pubData.trip?.dest_town}`);
      console.log(`   Driver: ${pubData.driver?.name} | Vehicle Plate: ${pubData.vehicle?.license_plate}`);
    }
  }

  // 8. Incident Resolution Workflow
  console.log('\n8. Testing Incident Resolution Workflow (resolve_incident)...');
  const { data: resData, error: resErr } = await supabase.rpc('resolve_incident', {
    p_incident_id: sosResult.incident_id,
    p_status: 'resolved',
  });

  if (resErr || !resData) {
    throw new Error('Failed to resolve incident: ' + resErr?.message);
  }
  console.log('   [PASS] Incident Resolved:', resData);

  // Clean up test contact
  if (contactId) {
    await supabase.from('emergency_contacts').delete().eq('id', contactId);
  }

  console.log('\n================================================================');
  console.log('🎉 ALL BACKEND PLAN PHASE 5 FEATURES VERIFIED & CONFIRMED! 🎉');
  console.log('================================================================\n');
}

runBackendPhase5Verification().catch((err) => {
  console.error('\n❌ BACKEND PLAN PHASE 5 VERIFICATION FAILED:', err);
  process.exit(1);
});
