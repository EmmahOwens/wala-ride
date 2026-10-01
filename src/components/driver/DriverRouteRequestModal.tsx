import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../config/supabase';
import {
  MapPin, Navigation, Send, CheckCircle, AlertTriangle,
  Clock, Route as RouteIcon, Loader, RefreshCw, ArrowRight, X, Search,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RouteRequestEntry {
  id: string;
  origin_name: string;
  destination_name: string;
  distance_km: number | null;
  estimated_duration_minutes: number | null;
  description: string | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_note: string | null;
  created_at: string;
}

interface PlacePrediction {
  place_id: string;
  description: string;
  main_text: string;
  secondary_text: string;
}

interface DriverRouteRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// ─── Google Maps SDK loader ───────────────────────────────────────────────────

declare global { interface Window { google?: any; _initGMap?: () => void; } }

let mapsLoading = false;
let mapsLoaded = false;
const mapsCallbacks: Array<() => void> = [];

function loadGoogleMapsSDK(key: string): Promise<void> {
  return new Promise((resolve) => {
    if (mapsLoaded || window.google?.maps) { mapsLoaded = true; resolve(); return; }
    mapsCallbacks.push(resolve);
    if (mapsLoading) return;
    mapsLoading = true;
    window._initGMap = () => {
      mapsLoaded = true;
      mapsCallbacks.forEach((cb) => cb());
      mapsCallbacks.length = 0;
    };
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places,geometry&callback=_initGMap`;
    s.async = true; s.defer = true;
    s.onerror = () => resolve();
    document.head.appendChild(s);
  });
}

// ─── Proxy helper ─────────────────────────────────────────────────────────────

const PROXY_FUNCTION = 'maps-proxy';

async function callProxy(action: string, payload?: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke(PROXY_FUNCTION, {
    body: { action, ...payload },
  });
  if (error) throw error;
  return data;
}

// ─── Location Picker component ────────────────────────────────────────────────

interface LocationPickerProps {
  label: string;
  icon: React.ReactNode;
  value: string;
  onSelect: (name: string, lat: number, lng: number) => void;
  placeholder?: string;
}

const LocationPicker: React.FC<LocationPickerProps> = ({ label, icon, value, onSelect, placeholder }) => {
  const [query, setQuery] = useState(value);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setQuery(value); }, [value]);

  const handleInput = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val.trim()) { setPredictions([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await callProxy('autocomplete', { query: val, country: 'ug' });
        setPredictions(res?.predictions || []);
        setOpen(true);
      } catch { /* silent */ } finally { setLoading(false); }
    }, 350);
  };

  const handlePick = async (p: PlacePrediction) => {
    setQuery(p.description);
    setOpen(false);
    setPredictions([]);
    try {
      const details = await callProxy('place_details', { placeId: p.place_id });
      if (details?.lat !== undefined && details?.lng !== undefined) {
        onSelect(p.description, details.lat, details.lng);
      } else {
        onSelect(p.description, 0, 0);
      }
    } catch {
      onSelect(p.description, 0, 0);
    }
  };

  return (
    <div className="form-group" style={{ position: 'relative' }}>
      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {icon} {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          className="input-field"
          placeholder={placeholder || 'Search for a place in Uganda…'}
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => query && predictions.length > 0 && setOpen(true)}
          autoComplete="off"
        />
        {loading && (
          <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}>
            <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />
          </span>
        )}
      </div>
      {open && predictions.length > 0 && (
        <div style={{
          position: 'absolute', zIndex: 1000, top: '100%', left: 0, right: 0,
          backgroundColor: '#fff', border: '1px solid var(--color-hairline)',
          borderRadius: 'var(--radius-lg)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          overflow: 'hidden', marginTop: '4px',
        }}>
          {predictions.map((p) => (
            <button
              key={p.place_id}
              type="button"
              style={{
                width: '100%', textAlign: 'left', padding: '10px 14px',
                border: 'none', background: 'none', cursor: 'pointer',
                borderBottom: '1px solid var(--color-hairline)', display: 'block',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-canvas-soft)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              onClick={() => handlePick(p)}
            >
              <div style={{ fontSize: '14px', fontWeight: 600 }}>{p.main_text}</div>
              <div style={{ fontSize: '12px', color: 'var(--color-body)' }}>{p.secondary_text}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Map preview ─────────────────────────────────────────────────────────────
// Renders the route using the encoded polyline returned by the proxy.
// No legacy DirectionsService call — uses geometry.encoding.decodePath() instead.

interface MapPreviewProps {
  originLat: number | null;
  originLng: number | null;
  destLat: number | null;
  destLng: number | null;
  encodedPolyline: string | null;  // from compute_route proxy response
  submitted: boolean;              // keep map visible + show overlay after submit
  mapsSDKReady: boolean;
}

const MapPreview: React.FC<MapPreviewProps> = ({
  originLat, originLng, destLat, destLng,
  encodedPolyline, submitted, mapsSDKReady,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const originMarkerRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);

  // Initialise map once SDK is ready
  useEffect(() => {
    if (!mapsSDKReady || !mapRef.current || !window.google?.maps) return;
    if (mapInstanceRef.current) return;
    mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
      center: { lat: 1.3733, lng: 32.2903 }, // Uganda centre
      zoom: 6,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: true,
    });
  }, [mapsSDKReady]);

  // Draw route whenever the polyline or coordinates change
  useEffect(() => {
    const g = window.google?.maps;
    if (!mapsSDKReady || !mapInstanceRef.current || !g) return;

    // Clear previous drawings
    if (polylineRef.current) { polylineRef.current.setMap(null); polylineRef.current = null; }
    if (originMarkerRef.current) { originMarkerRef.current.setMap(null); originMarkerRef.current = null; }
    if (destMarkerRef.current) { destMarkerRef.current.setMap(null); destMarkerRef.current = null; }

    if (!originLat || !originLng || !destLat || !destLng) return;

    const originPos = { lat: originLat, lng: originLng };
    const destPos   = { lat: destLat,   lng: destLng };

    // Origin marker — green pin
    originMarkerRef.current = new g.Marker({
      position: originPos,
      map: mapInstanceRef.current,
      title: 'Origin',
      icon: {
        path: g.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#16a34a',
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 2,
      },
    });

    // Destination marker — black pin
    destMarkerRef.current = new g.Marker({
      position: destPos,
      map: mapInstanceRef.current,
      title: 'Destination',
      icon: {
        path: g.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#000',
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 2,
      },
    });

    // Decode encoded polyline and draw road path
    if (encodedPolyline && g.geometry?.encoding) {
      const path = g.geometry.encoding.decodePath(encodedPolyline);
      polylineRef.current = new g.Polyline({
        path,
        map: mapInstanceRef.current,
        strokeColor: '#000000',
        strokeWeight: 4,
        strokeOpacity: 0.85,
      });

      // Fit map to the decoded path
      const bounds = new g.LatLngBounds();
      path.forEach((pt: any) => bounds.extend(pt));
      mapInstanceRef.current.fitBounds(bounds, { top: 40, bottom: 40, left: 40, right: 40 });
    } else {
      // No polyline yet — just fit to the two markers
      const bounds = new g.LatLngBounds();
      bounds.extend(originPos);
      bounds.extend(destPos);
      mapInstanceRef.current.fitBounds(bounds, { top: 60, bottom: 60, left: 60, right: 60 });
    }
  }, [mapsSDKReady, originLat, originLng, destLat, destLng, encodedPolyline]);

  // Always render the map container — hide it only when there's nothing to show yet
  const hasPoints = Boolean(originLat && destLat);
  if (!mapsSDKReady && !hasPoints) return null;

  return (
    <div style={{
      borderRadius: 'var(--radius-xl)', overflow: 'hidden',
      border: '1px solid var(--color-hairline)', marginBottom: '16px',
      position: 'relative',
      display: (mapsSDKReady || hasPoints) ? 'block' : 'none',
    }}>
      {/* Loading skeleton */}
      {!mapsSDKReady && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'var(--color-canvas-soft)', flexDirection: 'column', gap: '10px',
        }}>
          <Loader size={26} style={{ animation: 'spin 1s linear infinite' }} />
          <span className="body-sm">Loading map…</span>
        </div>
      )}

      <div ref={mapRef} style={{ width: '100%', height: '300px' }} />

      {/* Route computing indicator */}
      {mapsSDKReady && hasPoints && !encodedPolyline && (
        <div style={{
          position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)',
          backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 'var(--radius-pill)',
          padding: '6px 14px', fontSize: '12px', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: '6px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}>
          <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} />
          Calculating road route…
        </div>
      )}

      {/* Success overlay after submit */}
      {submitted && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(22, 163, 74, 0.15)',
          backdropFilter: 'blur(1px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            backgroundColor: '#fff', borderRadius: 'var(--radius-xl)',
            padding: '16px 24px', textAlign: 'center',
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
          }}>
            <CheckCircle size={32} color="#16a34a" />
            <div style={{ fontWeight: 700, fontSize: '15px' }}>Route submitted for review</div>
            <div style={{ fontSize: '13px', color: 'var(--color-body)' }}>Admin team will activate within 24h</div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

// ─── Main Modal ───────────────────────────────────────────────────────────────

export const DriverRouteRequestModal: React.FC<DriverRouteRequestModalProps> = ({ isOpen, onClose }) => {
  const { driverProfile } = useAuth();

  // Location state
  const [originName, setOriginName] = useState('');
  const [originLat, setOriginLat] = useState<number | null>(null);
  const [originLng, setOriginLng] = useState<number | null>(null);
  const [destName, setDestName] = useState('');
  const [destLat, setDestLat] = useState<number | null>(null);
  const [destLng, setDestLng] = useState<number | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [durationMins, setDurationMins] = useState<number | null>(null);
  const [encodedPolyline, setEncodedPolyline] = useState<string | null>(null);
  const [description, setDescription] = useState('');

  // Maps key from proxy
  const [mapsKey, setMapsKey] = useState<string | null>(null);
  const [mapsSDKReady, setMapsSDKReady] = useState(false);
  const [keyLoading, setKeyLoading] = useState(false);

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);   // keep map + overlay visible after success
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [requests, setRequests] = useState<RouteRequestEntry[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [activeTab, setActiveTab] = useState<'add' | 'history'>('add');
  const [routeLoading, setRouteLoading] = useState(false);

  // Fetch API key from maps-proxy edge function and load SDK
  useEffect(() => {
    if (!isOpen || mapsKey !== null) return;
    setKeyLoading(true);
    callProxy('get_public_key')
      .then((res) => {
        const key = res?.key || null;
        setMapsKey(key);
        if (key) {
          loadGoogleMapsSDK(key).then(() => {
            if (window.google?.maps) setMapsSDKReady(true);
          });
        }
      })
      .catch(() => setMapsKey(null))
      .finally(() => setKeyLoading(false));
  }, [isOpen, mapsKey]);

  // Auto-compute route + fetch encoded polyline when both points are selected
  useEffect(() => {
    if (!originName || !destName) return;
    setRouteLoading(true);
    setEncodedPolyline(null); // clear stale polyline while fetching
    callProxy('compute_route', {
      origin: originLat && originLng ? { lat: originLat, lng: originLng } : originName,
      destination: destLat && destLng ? { lat: destLat, lng: destLng } : destName,
    })
      .then((res) => {
        if (res?.distance_km) setDistanceKm(res.distance_km);
        if (res?.estimated_duration_minutes) setDurationMins(res.estimated_duration_minutes);
        if (res?.polyline) setEncodedPolyline(res.polyline);
      })
      .catch(() => { /* silent */ })
      .finally(() => setRouteLoading(false));
  }, [originName, originLat, originLng, destName, destLat, destLng]);

  const loadRequests = useCallback(async () => {
    if (!driverProfile?.id) return;
    setLoadingRequests(true);
    const { data } = await (supabase as any)
      .from('driver_route_requests')
      .select('*')
      .eq('driver_id', driverProfile.id)
      .order('created_at', { ascending: false });
    setRequests((data || []) as unknown as RouteRequestEntry[]);
    setLoadingRequests(false);
  }, [driverProfile?.id]);

  useEffect(() => {
    if (isOpen) loadRequests();
  }, [isOpen, loadRequests]);

  const resetForm = () => {
    setOriginName(''); setOriginLat(null); setOriginLng(null);
    setDestName('');   setDestLat(null);   setDestLng(null);
    setDistanceKm(null); setDurationMins(null); setEncodedPolyline(null);
    setDescription(''); setSubmitted(false); setMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverProfile?.id || !originName.trim() || !destName.trim()) return;
    setSubmitting(true);
    setMessage(null);

    const { error } = await (supabase as any).from('driver_route_requests').insert({
      driver_id: driverProfile.id,
      origin_name: originName.trim(),
      origin_lat: originLat,
      origin_lng: originLng,
      destination_name: destName.trim(),
      destination_lat: destLat,
      destination_lng: destLng,
      distance_km: distanceKm,
      estimated_duration_minutes: durationMins,
      description: description.trim() || null,
    });

    setSubmitting(false);
    if (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to submit route request.' });
    } else {
      // Keep map visible with submitted overlay; don't clear coords/polyline yet
      setSubmitted(true);
      setMessage({ type: 'success', text: 'Route request submitted! Our admin team will review it within 24 hours.' });
      setDescription('');
      await loadRequests();
    }
  };

  const handleClose = () => { setMessage(null); onClose(); };

  if (!isOpen) return null;
  const canSubmit = originName.trim() && destName.trim();

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '720px', width: '100%' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: 'var(--radius-pill)',
              backgroundColor: '#000', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <RouteIcon size={22} />
            </div>
            <div>
              <h2 className="display-sm" style={{ margin: 0 }}>Request a New Corridor Route</h2>
              <p className="body-sm" style={{ marginTop: '2px' }}>
                Search origin &amp; destination — our team will activate it for all drivers.
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            style={{
              background: 'var(--color-canvas-soft)', border: 'none',
              borderRadius: 'var(--radius-pill)', width: '36px', height: '36px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid var(--color-hairline)', paddingBottom: '12px' }}>
          <button
            className={`btn-pill-tab ${activeTab === 'add' ? 'active' : ''}`}
            onClick={() => setActiveTab('add')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Search size={14} /> Submit Request
          </button>
          <button
            className={`btn-pill-tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => { setActiveTab('history'); loadRequests(); }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Clock size={14} /> My Requests ({requests.length})
          </button>
        </div>

        {message && (
          <div style={{
            padding: '12px 16px', borderRadius: 'var(--radius-lg)', marginBottom: '16px',
            backgroundColor: message.type === 'success' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
            color: message.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
            fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            {message.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
            {message.text}
          </div>
        )}

        {/* ADD TAB */}
        {activeTab === 'add' && (
          <form onSubmit={handleSubmit}>
            {keyLoading && (
              <div style={{ textAlign: 'center', padding: '12px', color: 'var(--color-body)', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}>
                <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />
                Connecting to maps service…
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            )}

            {!keyLoading && !mapsKey && (
              <div style={{
                padding: '12px 14px', borderRadius: 'var(--radius-lg)', marginBottom: '16px',
                backgroundColor: 'var(--color-warning-bg)', fontSize: '13px', color: 'var(--color-ink)', lineHeight: 1.5,
              }}>
                <strong>Maps key not found in Supabase secrets.</strong> Add it via the Supabase dashboard or CLI:
                <br />
                <code style={{ fontSize: '12px' }}>supabase secrets set GOOGLE_MAPS_API=your-key</code>
                <br />
                You can still type location names and we'll look them up via the maps proxy.
              </div>
            )}

            <div className="grid-2" style={{ marginBottom: '16px' }}>
              <LocationPicker
                label="Origin (Town / City)"
                icon={<MapPin size={14} color="var(--color-primary)" />}
                value={originName}
                onSelect={(name, lat, lng) => { setOriginName(name); setOriginLat(lat || null); setOriginLng(lng || null); }}
                placeholder="e.g. Kampala City Centre…"
              />
              <LocationPicker
                label="Destination Town / City"
                icon={<Navigation size={14} color="var(--color-primary)" />}
                value={destName}
                onSelect={(name, lat, lng) => { setDestName(name); setDestLat(lat || null); setDestLng(lng || null); }}
                placeholder="e.g. Mbarara Town…"
              />
            </div>

            {/* Map preview — road route drawn from encoded polyline, stays visible after submit */}
            <MapPreview
              originLat={originLat}
              originLng={originLng}
              destLat={destLat}
              destLng={destLng}
              encodedPolyline={encodedPolyline}
              submitted={submitted}
              mapsSDKReady={mapsSDKReady}
            />

            {/* Route summary pills */}
            {(distanceKm !== null || durationMins !== null || routeLoading) && (
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                {routeLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--color-body)' }}>
                    <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} />
                    Calculating route…
                  </div>
                ) : (
                  <>
                    {distanceKm !== null && (
                      <div style={{
                        padding: '8px 16px', borderRadius: 'var(--radius-pill)',
                        backgroundColor: 'var(--color-canvas-soft)', border: '1px solid var(--color-hairline)',
                        fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px',
                      }}>
                        <RouteIcon size={14} /> {distanceKm} km
                      </div>
                    )}
                    {durationMins !== null && (
                      <div style={{
                        padding: '8px 16px', borderRadius: 'var(--radius-pill)',
                        backgroundColor: 'var(--color-canvas-soft)', border: '1px solid var(--color-hairline)',
                        fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px',
                      }}>
                        <Clock size={14} /> {Math.floor(durationMins / 60)}h {durationMins % 60}m drive
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Route preview bar */}
            {originName && destName && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '12px 16px', borderRadius: 'var(--radius-lg)',
                backgroundColor: '#f8f8f8', border: '1px solid var(--color-hairline)',
                marginBottom: '16px', fontSize: '15px', fontWeight: 700, flexWrap: 'wrap',
              }}>
                <MapPin size={16} />
                <span style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{originName}</span>
                <ArrowRight size={16} style={{ flexShrink: 0 }} />
                <Navigation size={16} />
                <span style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{destName}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Why is this route needed? (Optional)</label>
              <textarea
                className="input-field"
                rows={3}
                placeholder="e.g. High passenger demand — no direct vehicles currently serve this corridor. I run it 3x/week."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ resize: 'vertical', minHeight: '80px' }}
              />
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              {submitted ? (
                // After successful submit: map stays visible, show these actions
                <>
                  <button
                    type="button"
                    className="btn btn-secondary btn-md"
                    onClick={() => { setActiveTab('history'); }}
                  >
                    <Clock size={15} /> View My Requests
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-md"
                    onClick={resetForm}
                  >
                    <RouteIcon size={15} /> Add Another Route
                  </button>
                </>
              ) : (
                // Normal state
                <>
                  <button type="button" className="btn btn-secondary btn-md" onClick={handleClose}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary btn-md" disabled={submitting || !canSubmit}>
                    {submitting ? 'Submitting…' : 'Submit Route Request'}
                    <Send size={15} />
                  </button>
                </>
              )}
            </div>
          </form>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 className="display-sm">Your Route Requests</h3>
              <button className="btn btn-secondary btn-sm" onClick={loadRequests} disabled={loadingRequests}>
                <RefreshCw size={14} /> Refresh
              </button>
            </div>

            {loadingRequests ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Loader size={24} style={{ animation: 'spin 1s linear infinite' }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : requests.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
                <RouteIcon size={36} color="var(--color-mute)" style={{ margin: '0 auto 12px' }} />
                <p className="body-md">No route requests yet. Submit your first one!</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {requests.map((req) => (
                  <div
                    key={req.id}
                    style={{
                      padding: '16px 20px', borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--color-hairline)',
                      backgroundColor:
                        req.status === 'approved' ? 'var(--color-success-bg)'
                        : req.status === 'rejected' ? 'var(--color-danger-bg)'
                        : 'var(--color-canvas)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '15px', marginBottom: '4px', flexWrap: 'wrap' }}>
                          <MapPin size={14} />
                          <span>{req.origin_name}</span>
                          <ArrowRight size={14} />
                          <Navigation size={14} />
                          <span>{req.destination_name}</span>
                        </div>
                        <div className="body-sm" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                          {req.distance_km && <span>{req.distance_km} km</span>}
                          {req.estimated_duration_minutes && (
                            <span>{Math.floor(req.estimated_duration_minutes / 60)}h {req.estimated_duration_minutes % 60}m</span>
                          )}
                          <span>Requested {new Date(req.created_at).toLocaleDateString()}</span>
                        </div>
                        {req.admin_note && (
                          <p className="body-sm" style={{ marginTop: '6px', fontStyle: 'italic' }}>
                            Admin note: {req.admin_note}
                          </p>
                        )}
                      </div>
                      <span className={`badge ${req.status === 'approved' ? 'badge-verified' : req.status === 'rejected' ? 'badge-rejected' : 'badge-pending'}`}>
                        {req.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
