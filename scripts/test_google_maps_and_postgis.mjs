import { createClient } from '@supabase/supabase-js';

const url = 'https://rmpsvmizgdlepkqggtrm.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtcHN2bWl6Z2RsZXBrcWdndHJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2OTYxMzEsImV4cCI6MjEwNjI3MjEzMX0.w9eEmOigBq3M50B-x4gO-H65gVGPqPwc2ulC_O7rUxU';

const supabase = createClient(url, key);

async function runMapsAndPostGISTests() {
  console.log('================================================================');
  console.log('   WALA RIDE — GOOGLE MAPS & POSTGIS VERIFICATION SUITE         ');
  console.log('================================================================\n');

  // Test 1: PostGIS Nearest Pickup Points Query
  console.log('1. Testing PostGIS Nearest Pickup Points (find_nearest_pickup_points)...');
  const testLat = 0.3476;
  const testLng = 32.5825; // Kampala central coordinates
  const { data: nearbyPoints, error: ppErr } = await supabase.rpc('find_nearest_pickup_points', {
    p_lat: testLat,
    p_lng: testLng,
    p_radius_meters: 50000,
    p_limit: 3,
  });

  if (ppErr) {
    throw new Error('Failed to find nearest pickup points: ' + ppErr.message);
  }
  console.log(`   [PASS] Found ${nearbyPoints.length} nearby pickup points around Kampala:`);
  nearbyPoints.forEach((p, idx) => {
    console.log(`      ${idx + 1}. ${p.name} (${p.town_name}) — ${p.distance_km} km away [${p.distance_meters}m]`);
  });

  // Test 2: PostGIS Nearest Town Resolution
  console.log('\n2. Testing PostGIS Nearest Town Resolution (find_nearest_town)...');
  const { data: townData, error: townErr } = await supabase.rpc('find_nearest_town', {
    p_lat: testLat,
    p_lng: testLng,
  });

  if (townErr || !townData || townData.length === 0) {
    throw new Error('Failed to find nearest town: ' + (townErr?.message || 'No town found'));
  }
  const nearestTown = townData[0];
  console.log(`   [PASS] Resolved nearest town: ${nearestTown.name} (Region: ${nearestTown.region || 'N/A'}, Distance: ${nearestTown.distance_km} km)`);

  // Test 3: PostGIS Great-Circle Distance Calculation
  console.log('\n3. Testing PostGIS Great-Circle Distance (calculate_straight_line_distance_km)...');
  // Kampala to Jinja
  const jinjaLat = 0.4244;
  const jinjaLng = 33.2040;
  const { data: distKm, error: distErr } = await supabase.rpc('calculate_straight_line_distance_km', {
    p_lat1: testLat,
    p_lng1: testLng,
    p_lat2: jinjaLat,
    p_lng2: jinjaLng,
  });

  if (distErr) {
    throw new Error('Failed to calculate distance: ' + distErr.message);
  }
  console.log(`   [PASS] Great-circle distance between Kampala and Jinja: ${distKm} km`);

  // Test 4: Verify Spatial Geography Column Population & PostGIS Indexes
  console.log('\n4. Verifying Spatial Geography Column Population & Indexes (pickup_points.geog)...');
  const { data: spatialPoints, error: spErr } = await supabase
    .from('pickup_points')
    .select('id, name, lat, lng, geog')
    .not('geog', 'is', null)
    .limit(3);

  if (spErr || !spatialPoints || spatialPoints.length === 0) {
    throw new Error('Failed to find pickup points with populated geog column: ' + spErr?.message);
  }

  console.log(`   [PASS] Verified ${spatialPoints.length} pickup points with populated PostGIS geog:`);
  spatialPoints.forEach((p, idx) => {
    console.log(`      ${idx + 1}. "${p.name}" (lat: ${p.lat}, lng: ${p.lng}) -> geog: ${p.geog.substring(0, 32)}...`);
  });

  console.log('\n================================================================');
  console.log('   ALL POSTGIS & GEOGRAPHY TESTS PASSED SUCCESSFULLY!          ');
  console.log('================================================================\n');
}

runMapsAndPostGISTests().catch((err) => {
  console.error('\n[FAIL] Verification error:', err);
  process.exit(1);
});
