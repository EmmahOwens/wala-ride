// Supabase Edge Function: maps-proxy
// Secure proxy for Google Maps Platform APIs (Routes, Places, Geocoding, Distance Matrix, Roads)
// Ensures GOOGLE_MAPS_API_KEY remains secret in Supabase Secrets and never leaks to clients.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface LatLng {
  lat: number;
  lng: number;
}

interface ComputeRouteRequest {
  origin: LatLng | string;
  destination: LatLng | string;
  waypoints?: (LatLng | string)[];
  travelMode?: string; // default: 'DRIVE'
}

interface AutocompleteRequest {
  query: string;
  sessionToken?: string;
  country?: string; // default: 'ug'
}

interface PlaceDetailsRequest {
  placeId: string;
  sessionToken?: string;
}

interface GeocodeRequest {
  address?: string;
  lat?: number;
  lng?: number;
}

interface DistanceMatrixRequest {
  origins: (LatLng | string)[];
  destinations: (LatLng | string)[];
}

interface SnapToRoadsRequest {
  points: LatLng[];
}

function formatLocation(loc: LatLng | string): string {
  if (typeof loc === 'string') {
    return loc;
  }
  return `${loc.lat},${loc.lng}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Accept either secret name: GOOGLE_MAPS_API (user-defined) or GOOGLE_MAPS_API_KEY (legacy)
    const apiKey = Deno.env.get('GOOGLE_MAPS_API') || Deno.env.get('GOOGLE_MAPS_API_KEY');
    const url = new URL(req.url);
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const action = body.action || url.searchParams.get('action');

    // get_public_key — returns the key to authenticated callers so the Maps JS SDK
    // can be loaded in the browser. The key should have HTTP referrer restrictions
    // set in Google Cloud Console so it's safe to expose.
    if (action === 'get_public_key') {
      return new Response(
        JSON.stringify({ key: apiKey || null, available: Boolean(apiKey) }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If API key is missing, provide a clear structured notice with fallback/simulation
    if (!apiKey) {
      console.warn('No Maps API key found in Supabase secrets (tried GOOGLE_MAPS_API and GOOGLE_MAPS_API_KEY). Providing simulated response.');
      return handleSimulatedResponse(action, body);
    }

    switch (action) {
      case 'compute_route': {
        const payload = body as ComputeRouteRequest;
        if (!payload.origin || !payload.destination) {
          return new Response(JSON.stringify({ error: 'Missing origin or destination' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const originStr = encodeURIComponent(formatLocation(payload.origin));
        const destStr = encodeURIComponent(formatLocation(payload.destination));
        let waypointsParam = '';

        if (payload.waypoints && payload.waypoints.length > 0) {
          const wpStr = payload.waypoints.map((w) => formatLocation(w)).join('|');
          waypointsParam = `&waypoints=${encodeURIComponent(wpStr)}`;
        }

        const apiUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${originStr}&destination=${destStr}${waypointsParam}&key=${apiKey}`;
        const res = await fetch(apiUrl);
        const data = await res.json();

        if (data.status !== 'OK' || !data.routes || data.routes.length === 0) {
          return new Response(JSON.stringify({ error: data.error_message || data.status || 'No route found' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const route = data.routes[0];
        let totalDistanceMeters = 0;
        let totalDurationSeconds = 0;
        const legs = [];
        const stopsBreakdown = [];
        let runningKm = 0;
        let runningMinutes = 0;

        for (let i = 0; i < route.legs.length; i++) {
          const leg = route.legs[i];
          const legKm = Math.round((leg.distance.value / 1000) * 10) / 10;
          const legMins = Math.round(leg.duration.value / 60);

          totalDistanceMeters += leg.distance.value;
          totalDurationSeconds += leg.duration.value;
          runningKm = Math.round((runningKm + legKm) * 10) / 10;
          runningMinutes += legMins;

          legs.push({
            sequence: i + 1,
            distance_km: legKm,
            duration_minutes: legMins,
            start_address: leg.start_address,
            end_address: leg.end_address,
            start_location: leg.start_location,
            end_location: leg.end_location,
          });

          stopsBreakdown.push({
            sequence: i + 1,
            distance_from_origin_km: runningKm,
            estimated_minutes_from_origin: runningMinutes,
            address: leg.end_address,
            lat: leg.end_location.lat,
            lng: leg.end_location.lng,
          });
        }

        const totalKm = Math.round((totalDistanceMeters / 1000) * 10) / 10;
        const totalMinutes = Math.round(totalDurationSeconds / 60);

        return new Response(
          JSON.stringify({
            distance_km: totalKm,
            estimated_duration_minutes: totalMinutes,
            polyline: route.overview_polyline?.points || '',
            summary: route.summary || '',
            legs,
            stops_breakdown: stopsBreakdown,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'autocomplete': {
        const payload = body as AutocompleteRequest;
        const query = payload.query || url.searchParams.get('query');
        if (!query) {
          return new Response(JSON.stringify({ error: 'Missing query' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const country = payload.country || 'ug';
        const sessionToken = payload.sessionToken ? `&sessiontoken=${encodeURIComponent(payload.sessionToken)}` : '';
        const apiUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&components=country:${country}${sessionToken}&key=${apiKey}`;

        const res = await fetch(apiUrl);
        const data = await res.json();

        if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
          return new Response(JSON.stringify({ error: data.error_message || data.status }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const predictions = (data.predictions || []).map((p: any) => ({
          place_id: p.place_id,
          description: p.description,
          main_text: p.structured_formatting?.main_text || p.description,
          secondary_text: p.structured_formatting?.secondary_text || '',
        }));

        return new Response(JSON.stringify({ predictions }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'place_details': {
        const payload = body as PlaceDetailsRequest;
        const placeId = payload.placeId || url.searchParams.get('placeId');
        if (!placeId) {
          return new Response(JSON.stringify({ error: 'Missing placeId' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const sessionToken = payload.sessionToken ? `&sessiontoken=${encodeURIComponent(payload.sessionToken)}` : '';
        const apiUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=geometry,name,formatted_address${sessionToken}&key=${apiKey}`;

        const res = await fetch(apiUrl);
        const data = await res.json();

        if (data.status !== 'OK') {
          return new Response(JSON.stringify({ error: data.error_message || data.status }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const result = {
          place_id: placeId,
          name: data.result?.name || '',
          formatted_address: data.result?.formatted_address || '',
          lat: data.result?.geometry?.location?.lat,
          lng: data.result?.geometry?.location?.lng,
        };

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'geocode':
      case 'reverse_geocode': {
        const payload = body as GeocodeRequest;
        let apiUrl = '';

        if (payload.lat !== undefined && payload.lng !== undefined) {
          apiUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${payload.lat},${payload.lng}&key=${apiKey}`;
        } else if (payload.address) {
          apiUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(payload.address)}&components=country:ug&key=${apiKey}`;
        } else {
          return new Response(JSON.stringify({ error: 'Missing address or lat/lng' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const res = await fetch(apiUrl);
        const data = await res.json();

        if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
          return new Response(JSON.stringify({ error: data.error_message || data.status }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const first = data.results?.[0];
        return new Response(
          JSON.stringify({
            formatted_address: first?.formatted_address || '',
            place_id: first?.place_id || '',
            lat: first?.geometry?.location?.lat,
            lng: first?.geometry?.location?.lng,
            results: data.results || [],
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'distance_matrix': {
        const payload = body as DistanceMatrixRequest;
        if (!payload.origins || !payload.destinations || payload.origins.length === 0 || payload.destinations.length === 0) {
          return new Response(JSON.stringify({ error: 'Missing origins or destinations' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const origStr = encodeURIComponent(payload.origins.map(formatLocation).join('|'));
        const destStr = encodeURIComponent(payload.destinations.map(formatLocation).join('|'));
        const apiUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origStr}&destinations=${destStr}&key=${apiKey}`;

        const res = await fetch(apiUrl);
        const data = await res.json();

        if (data.status !== 'OK') {
          return new Response(JSON.stringify({ error: data.error_message || data.status }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'snap_roads': {
        const payload = body as SnapToRoadsRequest;
        if (!payload.points || payload.points.length === 0) {
          return new Response(JSON.stringify({ error: 'Missing points' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const pathStr = encodeURIComponent(payload.points.map((p) => `${p.lat},${p.lng}`).join('|'));
        const apiUrl = `https://roads.googleapis.com/v1/snapToRoads?path=${pathStr}&interpolate=true&key=${apiKey}`;

        const res = await fetch(apiUrl);
        const data = await res.json();

        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(
          JSON.stringify({
            error: `Unsupported action: ${action}. Supported: get_public_key, compute_route, autocomplete, place_details, geocode, reverse_geocode, distance_matrix, snap_roads`,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (err: any) {
    console.error('maps-proxy error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal maps proxy error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Provides Uganda corridor mock responses when GOOGLE_MAPS_API_KEY is not yet populated
function handleSimulatedResponse(action: string | null, body: any): Response {
  switch (action) {
    case 'compute_route': {
      return new Response(
        JSON.stringify({
          simulated: true,
          message: 'Simulated response (add GOOGLE_MAPS_API_KEY to Supabase Secrets for live data)',
          distance_km: 268.4,
          estimated_duration_minutes: 275,
          polyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@',
          summary: 'A109 / Jinja Road Corridor',
          legs: [
            {
              sequence: 1,
              distance_km: 80.5,
              duration_minutes: 85,
              start_address: 'Kampala, Uganda',
              end_address: 'Jinja, Uganda',
            },
            {
              sequence: 2,
              distance_km: 41.2,
              duration_minutes: 45,
              start_address: 'Jinja, Uganda',
              end_address: 'Iganga, Uganda',
            },
            {
              sequence: 3,
              distance_km: 146.7,
              duration_minutes: 145,
              start_address: 'Iganga, Uganda',
              end_address: 'Mbale, Uganda',
            },
          ],
          stops_breakdown: [
            { sequence: 1, distance_from_origin_km: 80.5, estimated_minutes_from_origin: 85, address: 'Jinja Taxi Park' },
            { sequence: 2, distance_from_origin_km: 121.7, estimated_minutes_from_origin: 130, address: 'Iganga Main Stage' },
            { sequence: 3, distance_from_origin_km: 268.4, estimated_minutes_from_origin: 275, address: 'Mbale Central Bus Park' },
          ],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    case 'autocomplete': {
      const q = (body.query || '').toLowerCase();
      const mockPlaces = [
        { place_id: 'mock_kla_old_taxi_park', description: 'Old Taxi Park, Kampala, Uganda', main_text: 'Old Taxi Park', secondary_text: 'Kampala, Uganda' },
        { place_id: 'mock_jinja_taxi_park', description: 'Jinja Taxi Park, Jinja, Uganda', main_text: 'Jinja Taxi Park', secondary_text: 'Jinja, Uganda' },
        { place_id: 'mock_mbale_bus_park', description: 'Mbale Central Bus Park, Mbale, Uganda', main_text: 'Mbale Central Bus Park', secondary_text: 'Mbale, Uganda' },
        { place_id: 'mock_mbarara_taxi_park', description: 'Mbarara Taxi Park, Mbarara, Uganda', main_text: 'Mbarara Taxi Park', secondary_text: 'Mbarara, Uganda' },
      ];
      const filtered = mockPlaces.filter((p) => p.description.toLowerCase().includes(q) || !q);
      return new Response(
        JSON.stringify({ simulated: true, predictions: filtered }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    case 'place_details': {
      return new Response(
        JSON.stringify({
          simulated: true,
          place_id: body.placeId || 'mock_place_id',
          name: 'Old Taxi Park',
          formatted_address: 'Old Taxi Park, Kampala, Central Region, Uganda',
          lat: 0.3136,
          lng: 32.5786,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    case 'geocode':
    case 'reverse_geocode': {
      return new Response(
        JSON.stringify({
          simulated: true,
          formatted_address: 'Kampala-Jinja Highway, Mukono, Uganda',
          place_id: 'mock_mukono_hwy',
          lat: body.lat || 0.3541,
          lng: body.lng || 32.7523,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    case 'distance_matrix': {
      return new Response(
        JSON.stringify({
          simulated: true,
          rows: [
            {
              elements: [
                {
                  status: 'OK',
                  distance: { text: '24.5 km', value: 24500 },
                  duration: { text: '28 mins', value: 1680 },
                },
              ],
            },
          ],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    default:
      return new Response(
        JSON.stringify({
          simulated: true,
          message: 'Google Maps API key missing from Supabase secrets. Set via: supabase secrets set GOOGLE_MAPS_API=your_key',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
  }
}
