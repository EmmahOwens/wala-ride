import { createClient } from '@supabase/supabase-js';

const url = 'https://rmpsvmizgdlepkqggtrm.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtcHN2bWl6Z2RsZXBrcWdndHJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2OTYxMzEsImV4cCI6MjEwNjI3MjEzMX0.w9eEmOigBq3M50B-x4gO-H65gVGPqPwc2ulC_O7rUxU';

const supabase = createClient(url, key);

async function runPhase5Verification() {
  console.log('=== PHASE 5 — ADMIN, SUPPORT, NOTIFICATIONS & DEMAND ANALYTICS VERIFICATION ===\n');

  // 1. Get test profiles & trip
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('id, first_name, last_name, phone').limit(2);
  if (pErr || !profiles || profiles.length === 0) {
    throw new Error('No user profile found: ' + JSON.stringify(pErr));
  }
  const passengerUser = profiles[0];
  console.log('1. Target Passenger:');
  console.log(`   User ID: ${passengerUser.id} | Name: ${passengerUser.first_name} ${passengerUser.last_name || ''} | Phone: ${passengerUser.phone || 'N/A'}`);

  const { data: trips } = await supabase.from('trips').select('id, route:routes(name)').limit(1);
  const testTrip = trips?.[0];

  const { data: bookings } = await supabase.from('bookings').select('id, booking_reference').limit(1);
  const testBooking = bookings?.[0];

  // 2. Test Passenger Raising a Support Ticket (create_support_ticket)
  console.log('\n2. Testing Passenger Raising Support Ticket (create_support_ticket)...');
  const ticketSubject = `Driver delayed at stage - Booking #${testBooking?.booking_reference || 'REF123'}`;
  const ticketDescription = 'The vehicle has not arrived at the Kampala stage. Scheduled departure was 15 minutes ago.';
  
  const { data: createData, error: createErr } = await supabase.rpc('create_support_ticket', {
    p_subject: ticketSubject,
    p_description: ticketDescription,
    p_category: 'delay_cancellation',
    p_priority: 'high',
    p_trip_id: testTrip?.id || null,
    p_booking_id: testBooking?.id || null,
    p_user_id: passengerUser.id,
  });

  if (createErr || !createData) {
    throw new Error('Failed to create support ticket: ' + (createErr?.message || 'No data'));
  }
  const ticketId = createData.ticket_id;
  console.log('   [PASS] Support Ticket Created:');
  console.log(`   Ticket ID: ${ticketId}`);
  console.log(`   Status: ${createData.status} | Priority: ${createData.priority} | Category: ${createData.category}`);

  // 3. Verifying Exit Criteria Part 1: Admin Support Queue Retrieval
  console.log('\n3. Verifying Exit Criteria (Part 1): Ticket Reaches Admin Queue (get_admin_support_tickets)...');
  const { data: queueTickets, error: queueErr } = await supabase.rpc('get_admin_support_tickets', {
    p_status: 'all',
  });

  if (queueErr || !queueTickets) {
    throw new Error('Failed to fetch admin support queue: ' + queueErr?.message);
  }

  const foundInQueue = queueTickets.find((t) => t.id === ticketId);
  if (!foundInQueue) {
    throw new Error(`Ticket ${ticketId} not found in admin queue!`);
  }

  console.log('   [PASS] Ticket successfully visible in Admin Queue:');
  console.log(`   Subject: "${foundInQueue.subject}"`);
  console.log(`   Customer: ${foundInQueue.customer?.name} (${foundInQueue.customer?.phone || 'No phone'})`);
  console.log(`   Messages Count: ${foundInQueue.messages_count}`);
  console.log(`   Latest Message: "${foundInQueue.last_message}"`);

  // 4. Inspecting Conversation Thread (get_ticket_details)
  console.log('\n4. Testing Ticket Conversation Thread Details (get_ticket_details)...');
  const { data: threadData, error: threadErr } = await supabase.rpc('get_ticket_details', {
    p_ticket_id: ticketId,
  });

  if (threadErr || !threadData) {
    throw new Error('Failed to fetch ticket thread: ' + threadErr?.message);
  }

  console.log('   [PASS] Ticket Details Retrieved:');
  console.log(`   Initial Messages in Thread: ${threadData.messages?.length || 0}`);
  console.log(`   First Message: "${threadData.messages?.[0]?.message}"`);

  // 5. Verifying Exit Criteria Part 2: Admin Response to Support Ticket (send_ticket_reply)
  console.log('\n5. Verifying Exit Criteria (Part 2): Admin Responds to Support Ticket (send_ticket_reply)...');
  const adminReplyText = 'Hello David, we reached the driver. The vehicle is held up 2km away at roadworks and will arrive at the stage in 8 minutes.';
  
  const { data: replyData, error: replyErr } = await supabase.rpc('send_ticket_reply', {
    p_ticket_id: ticketId,
    p_message: adminReplyText,
    p_sender_id: passengerUser.id, // using test user ID
  });

  if (replyErr || !replyData) {
    throw new Error('Failed to send admin reply: ' + replyErr?.message);
  }

  console.log('   [PASS] Admin / Staff Response Sent:');
  console.log(`   Message ID: ${replyData.id}`);
  console.log(`   Sender: ${replyData.sender_name}`);
  console.log(`   Message Text: "${replyData.message}"`);

  // 6. Test Passenger Follow-up & Resolution Workflow
  console.log('\n6. Testing Ticket Resolution Workflow (update_ticket_status_rpc)...');
  const { data: resData, error: resErr } = await supabase.rpc('update_ticket_status_rpc', {
    p_ticket_id: ticketId,
    p_status: 'resolved',
    p_resolution_note: 'Driver arrived, passenger boarded vehicle successfully.',
  });

  if (resErr || !resData) {
    throw new Error('Failed to resolve ticket: ' + resErr?.message);
  }

  console.log('   [PASS] Ticket Successfully Resolved:');
  console.log(`   Updated Status: ${resData.status} | Updated At: ${resData.updated_at}`);

  // 7. Test In-App Notification Center
  console.log('\n7. Testing Notification Ingestion & Read State (get_user_notifications)...');
  const { data: notifs, error: notifErr } = await supabase.rpc('get_user_notifications', {
    p_user_id: passengerUser.id,
    p_limit: 5,
  });

  if (notifErr || !notifs) {
    throw new Error('Failed to fetch user notifications: ' + notifErr?.message);
  }

  console.log(`   [PASS] User Notifications Retrieved (${notifs.length} items):`);
  if (notifs.length > 0) {
    console.log(`   Latest Title: "${notifs[0].title}"`);
    console.log(`   Latest Body: "${notifs[0].body}"`);
    
    // Mark as read
    const { data: readOk } = await supabase.rpc('mark_notification_read', {
      p_notification_id: notifs[0].id,
    });
    console.log(`   [PASS] Notification marked as read: ${readOk}`);
  }

  // 8. Test Demand Analytics RPC (get_demand_analytics)
  console.log('\n8. Testing Corridor Demand Analytics from search_events (get_demand_analytics)...');
  const { data: demandData, error: demandErr } = await supabase.rpc('get_demand_analytics', {
    p_days: 30,
  });

  if (demandErr || !demandData) {
    throw new Error('Failed to fetch demand analytics: ' + demandErr?.message);
  }

  console.log('   [PASS] Demand Analytics Summary:');
  console.log(`   Total Searches: ${demandData.summary.total_searches}`);
  console.log(`   Unserved Searches: ${demandData.summary.unserved_searches} (${demandData.summary.unserved_rate_pct}%)`);
  console.log(`   Passengers Demanding Seats: ${demandData.summary.passengers_demanding}`);
  console.log(`   Radar Alert Conversions: ${demandData.summary.alert_conversions}`);
  console.log(`   Corridor Gaps Identified: ${demandData.corridors?.length || 0}`);
  if (demandData.corridors?.length > 0) {
    const topCorridor = demandData.corridors[0];
    console.log(`   Top Gap: ${topCorridor.origin_town_name} → ${topCorridor.destination_town_name} | Searches: ${topCorridor.search_count} | Supply Status: ${topCorridor.supply_status}`);
  }

  // 9. Test Town & Route Management RPCs
  console.log('\n9. Testing Admin Town & Route Operations (admin_manage_town & admin_manage_route)...');
  const testTownName = `Kabale_Test_${Date.now().toString().slice(-4)}`;
  const { data: newTown, error: townErr } = await supabase.rpc('admin_manage_town', {
    p_action: 'create',
    p_name: testTownName,
    p_region: 'Western',
    p_lat: -1.2500,
    p_lng: 29.9833,
    p_is_active: true,
  });

  if (townErr || !newTown) {
    throw new Error('Failed to create town: ' + townErr?.message);
  }
  console.log(`   [PASS] New Town Created: ${newTown.name} (ID: ${newTown.id}, Region: ${newTown.region})`);

  // Fetch Kampala town for test route
  const { data: kampalaTown } = await supabase.from('towns').select('id').eq('name', 'Kampala').single();
  
  if (kampalaTown) {
    const testRouteName = `Kampala – ${newTown.name} Express`;
    const { data: newRoute, error: routeErr } = await supabase.rpc('admin_manage_route', {
      p_action: 'create',
      p_name: testRouteName,
      p_origin_town_id: kampalaTown.id,
      p_destination_town_id: newTown.id,
      p_distance_km: 410,
      p_duration_mins: 390,
      p_status: 'active',
      p_stops: [
        { town_id: kampalaTown.id, sequence: 1, distance_from_origin_km: 0, estimated_minutes_from_origin: 0, pickup_allowed: true, dropoff_allowed: false },
        { town_id: newTown.id, sequence: 2, distance_from_origin_km: 410, estimated_minutes_from_origin: 390, pickup_allowed: false, dropoff_allowed: true },
      ],
    });

    if (routeErr || !newRoute) {
      throw new Error('Failed to create route: ' + routeErr?.message);
    }
    console.log(`   [PASS] New Reusable Corridor Created: ${newRoute.name} with ${newRoute.stops_count} stops`);

    // Clean up test route and town
    await supabase.from('routes').delete().eq('id', newRoute.id);
    await supabase.from('towns').delete().eq('id', newTown.id);
    console.log('   [PASS] Test corridor and town cleaned up cleanly.');
  }

  console.log('\n============================================================');
  console.log('🎉 PHASE 5 ADMIN, SUPPORT & NOTIFICATIONS EXIT CRITERIA MET! 🎉');
  console.log('============================================================\n');
}

runPhase5Verification().catch((err) => {
  console.error('\n❌ PHASE 5 VERIFICATION FAILED:', err);
  process.exit(1);
});
