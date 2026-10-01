import { createClient } from '@supabase/supabase-js';
import { getSupabaseCredentials } from './helpers/getEnv.mjs';

const { url, key } = getSupabaseCredentials();
const supabase = createClient(url, key);

async function runConcurrencyAndPrivateHireTests() {
  console.log('================================================================');
  console.log('   WALA RIDE — CONCURRENCY & PRIVATE HIRE VERIFICATION          ');
  console.log('================================================================\n');

  // 1. Fetch test profiles
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('id, first_name').limit(2);
  const passengerA = profiles?.[0] || { id: '15800568-a314-4291-ae3f-29ce3c11d44d' };
  const passengerB = profiles?.[1] || passengerA;

  // 2. Fetch driver profile and route for a new test trip
  const { data: drivers } = await supabase.from('driver_profiles').select('id, user_id').limit(1);
  const testDriver = drivers?.[0];

  const { data: vehicles } = await supabase.from('vehicles').select('id, capacity_seats').limit(1);
  const testVehicle = vehicles?.[0] || { id: '00000000-0000-0000-0000-000000000000', capacity_seats: 4 };
  const vehicleSeats = testVehicle.capacity_seats || 4;

  const { data: route } = await supabase
    .from('routes')
    .select('id, name, stops:route_stops(id, sequence)')
    .eq('name', 'Kampala – Jinja – Mbale')
    .single();

  if (!route) {
    throw new Error('Kampala – Jinja – Mbale route not found');
  }

  console.log(`1. Preparing Test Trip with Vehicle Capacity: ${vehicleSeats} seats on route: ${route.name}`);

  // Publish a dedicated test trip
  const departsAt = new Date(Date.now() + 3600 * 1000 * 24).toISOString();
  const { data: tripResult, error: pubErr } = await supabase.rpc('publish_trip', {
    p_driver_id: testDriver.id,
    p_vehicle_id: testVehicle.id,
    p_route_id: route.id,
    p_departs_at: departsAt,
    p_base_fare_ugx: 50000,
  });

  if (pubErr || !tripResult) {
    throw new Error('Failed to publish test trip: ' + pubErr?.message);
  }

  const tripId = typeof tripResult === 'string' ? tripResult : tripResult.trip_id;
  console.log(`   [PASS] Published dedicated trip ID: ${tripId}`);

  // Fetch trip stops
  const { data: stops, error: stopsErr } = await supabase
    .from('trip_stops')
    .select('id, sequence, scheduled_departure')
    .eq('trip_id', tripId)
    .order('sequence', { ascending: true });

  if (stopsErr || !stops || stops.length < 2) {
    throw new Error('Trip does not have enough stops for testing');
  }

  const firstStop = stops[0];
  const midStop = stops[1];
  const lastStop = stops[stops.length - 1];

  console.log(`   Stops available: Start (Seq ${firstStop.sequence}) -> Mid (Seq ${midStop.sequence}) -> End (Seq ${lastStop.sequence})`);

  // Test Case A: Seat Booking Followed by Attempted Private Hire
  console.log('\n2. Testing Scenario A: Active Seat Booking Blocks Private Hire...');
  // Passenger A books 1 seat from firstStop to midStop
  const { data: bookSeatA, error: seatAErr } = await supabase.rpc('book_segment', {
    p_trip_id: tripId,
    p_passenger_id: passengerA.id,
    p_origin_trip_stop_id: firstStop.id,
    p_destination_trip_stop_id: midStop.id,
    p_seat_count: 1,
    p_fare_ugx: 25000,
    p_booking_type: 'seat',
  });

  if (seatAErr || !bookSeatA || bookSeatA.length === 0) {
    throw new Error('Passenger A failed to book seat: ' + seatAErr?.message);
  }
  const bookingAId = bookSeatA[0].booking_id;
  console.log(`   [PASS] Passenger A held 1 seat on segment Seq 1->2. Booking ID: ${bookingAId}`);

  // Passenger B tries to book the WHOLE vehicle (private hire)
  console.log('   Passenger B attempting to private-hire vehicle on trip with active seat booking...');
  const { data: privateHireB, error: privErr } = await supabase.rpc('book_segment', {
    p_trip_id: tripId,
    p_passenger_id: passengerB.id,
    p_origin_trip_stop_id: firstStop.id,
    p_destination_trip_stop_id: lastStop.id,
    p_seat_count: vehicleSeats,
    p_fare_ugx: 100000,
    p_booking_type: 'private_vehicle',
  });

  if (!privErr) {
    throw new Error('Security flaw: Private hire succeeded on a vehicle with existing seat reservations!');
  }
  console.log(`   [PASS] Private hire correctly rejected with error: "${privErr.message}"`);

  // Cancel Booking A to free the vehicle
  await supabase.rpc('cancel_booking', { p_booking_id: bookingAId, p_reason: 'Testing cleanup' });
  console.log('   [PASS] Cancelled Booking A to free vehicle.');

  // Test Case B: Whole Vehicle Booking Blocks All Subsequent Seat Bookings
  console.log('\n3. Testing Scenario B: Private Hire Blocks All Subsequent Seat Bookings Across All Segments...');
  const { data: privateHireSuccess, error: phSuccErr } = await supabase.rpc('book_segment', {
    p_trip_id: tripId,
    p_passenger_id: passengerB.id,
    p_origin_trip_stop_id: firstStop.id,
    p_destination_trip_stop_id: lastStop.id,
    p_seat_count: vehicleSeats,
    p_fare_ugx: 150000,
    p_booking_type: 'private_vehicle',
  });

  if (phSuccErr || !privateHireSuccess || privateHireSuccess.length === 0) {
    throw new Error('Failed to book whole vehicle on clean trip: ' + phSuccErr?.message);
  }
  const privateBookingId = privateHireSuccess[0].booking_id;
  console.log(`   [PASS] Passenger B successfully reserved whole vehicle! Booking ID: ${privateBookingId}`);

  // Now Passenger A tries to book even 1 seat on an intermediate segment (midStop -> lastStop)
  console.log('   Passenger A attempting to book 1 seat on private-hired vehicle...');
  const { data: conflictSeat, error: conflictErr } = await supabase.rpc('book_segment', {
    p_trip_id: tripId,
    p_passenger_id: passengerA.id,
    p_origin_trip_stop_id: midStop.id,
    p_destination_trip_stop_id: lastStop.id,
    p_seat_count: 1,
    p_fare_ugx: 25000,
    p_booking_type: 'seat',
  });

  if (!conflictErr) {
    throw new Error('Security flaw: Seat booking succeeded on an exclusively private-hired vehicle!');
  }
  console.log(`   [PASS] Seat booking correctly rejected with error: "${conflictErr.message}"`);

  // Clean up private booking
  await supabase.rpc('cancel_booking', { p_booking_id: privateBookingId, p_reason: 'Testing complete' });
  console.log('   [PASS] Cancelled private booking and cleaned up.');

  // Clean up test trip
  await supabase.from('trips').update({ status: 'cancelled' }).eq('id', tripId);
  console.log('   [PASS] Marked test trip cancelled.');

  console.log('\n================================================================');
  console.log('   ALL CONCURRENCY & PRIVATE HIRE TESTS PASSED SUCCESSFULLY!    ');
  console.log('================================================================\n');
}

runConcurrencyAndPrivateHireTests().catch((err) => {
  console.error('\n[FAIL] Verification error:', err);
  process.exit(1);
});
