import React, { useState, useEffect } from 'react';
import { trackingService } from '../../services/supabase/SupabaseTrackingService';
import type { PublicTripTracking, TripLocation } from '../../types/domain';
import {
  Car,
  MapPin,
  Phone,
  Clock,
  AlertTriangle,
  ExternalLink,
  Navigation,
  RefreshCw,
} from 'lucide-react';

interface PublicTrackingViewProps {
  shareToken: string;
  onGoHome: () => void;
}

export const PublicTrackingView: React.FC<PublicTrackingViewProps> = ({
  shareToken,
  onGoHome,
}) => {
  const [data, setData] = useState<PublicTripTracking | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [latestLoc, setLatestLoc] = useState<TripLocation | null>(null);
  const [secondsAgo, setSecondsAgo] = useState<number>(0);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    const tracking = await trackingService.getPublicTripTracking(shareToken);
    setLoading(false);

    if (!tracking || tracking.error) {
      setError(tracking?.error || 'Tracking link has expired or is invalid.');
      return;
    }

    setData(tracking);
    if (tracking.latest_location) {
      setLatestLoc({
        id: 0,
        trip_id: tracking.trip?.id || '',
        driver_id: '',
        lat: tracking.latest_location.lat,
        lng: tracking.latest_location.lng,
        speed: tracking.latest_location.speed,
        heading: tracking.latest_location.heading,
        accuracy: tracking.latest_location.accuracy,
        recorded_at: tracking.latest_location.recorded_at,
      });
      setSecondsAgo(
        Math.round((Date.now() - new Date(tracking.latest_location.recorded_at).getTime()) / 1000)
      );
    }
  };

  useEffect(() => {
    loadData();
  }, [shareToken]);

  // Realtime subscription if trip id is available
  useEffect(() => {
    if (!data?.trip?.id) return;

    const unsubscribe = trackingService.subscribeToTripLocations(data.trip.id, (newLoc) => {
      setLatestLoc(newLoc);
      setSecondsAgo(0);
    });

    const interval = setInterval(() => {
      setSecondsAgo((prev) => prev + 1);
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [data?.trip?.id]);

  if (loading) {
    return (
      <div className="container" style={{ padding: '80px 16px', textAlign: 'center', maxWidth: '560px' }}>
        <RefreshCw size={36} className="spin" style={{ margin: '0 auto 16px', color: 'var(--color-primary)' }} />
        <h2 className="display-sm">Connecting to Live Journey Stream...</h2>
        <p className="body-md">Connecting to Wala satellite & GPS telematics.</p>
      </div>
    );
  }

  if (error || !data || !data.trip) {
    return (
      <div className="container" style={{ padding: '80px 16px', textAlign: 'center', maxWidth: '560px' }}>
        <AlertTriangle size={48} color="#dc2626" style={{ margin: '0 auto 16px' }} />
        <h2 className="display-sm">Tracking Link Unavailable</h2>
        <p className="body-md" style={{ marginTop: '8px', marginBottom: '24px' }}>
          {error || 'This live tracking link has expired or reached the end of its 48-hour journey window.'}
        </p>
        <button className="btn btn-primary btn-md" onClick={onGoHome}>
          Book or Search Wala Ride Corridors
        </button>
      </div>
    );
  }

  const { trip, driver, vehicle, booking, stops } = data;

  return (
    <div style={{ backgroundColor: 'var(--color-canvas)', minHeight: '100vh', padding: '32px 16px' }}>
      <div className="container" style={{ maxWidth: '680px', margin: '0 auto' }}>
        {/* Top Public Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={onGoHome}>
            <img
              src="/wala-ride.jpeg"
              alt="Wala Ride"
              style={{ width: '32px', height: '32px', borderRadius: '6px', objectFit: 'cover' }}
            />
            <span style={{ fontWeight: 800, fontSize: '18px', letterSpacing: '-0.02em' }}>WALA RIDE</span>
          </div>

          <button className="btn btn-secondary btn-sm" onClick={loadData}>
            <RefreshCw size={13} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Live Tracking Card */}
        <div
          className="card"
          style={{
            padding: '0',
            overflow: 'hidden',
            boxShadow: '0 12px 24px -4px rgba(0, 0, 0, 0.08)',
            marginBottom: '24px',
          }}
        >
          {/* Header */}
          <div
            style={{
              backgroundColor: '#000000',
              color: '#ffffff',
              padding: '24px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'rgba(34, 197, 94, 0.2)',
                  color: '#4ade80',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    backgroundColor: '#22c55e',
                    borderRadius: '50%',
                    display: 'inline-block',
                    animation: 'pulse 1.5s infinite',
                  }}
                />
                Live Passenger Journey
              </span>
              <span className="badge badge-neutral" style={{ color: '#ffffff' }}>
                Ref: {booking?.reference}
              </span>
            </div>

            <h1 className="display-md" style={{ color: '#ffffff', margin: 0 }}>
              {trip.origin_town} &rarr; {trip.dest_town}
            </h1>

            <div style={{ fontSize: '13px', color: '#9ca3af', marginTop: '6px' }}>
              Traveling with passenger: <strong>{booking?.passenger_first_name || 'Passenger'}</strong> ({booking?.seats} {booking?.seats === 1 ? 'seat' : 'seats'})
            </div>
          </div>

          {/* Telemetry & Map Strip */}
          <div
            style={{
              backgroundColor: '#111827',
              color: '#ffffff',
              padding: '20px 24px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase' }}>Current Speed</div>
                <div style={{ fontSize: '24px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{latestLoc ? `${Math.round(latestLoc.speed || 0)} km/h` : 'At Boarding Stage'}</span>
                  {latestLoc?.heading !== null && latestLoc?.heading !== undefined && (
                    <Navigation
                      size={18}
                      style={{
                        transform: `rotate(${latestLoc.heading}deg)`,
                        color: '#60a5fa',
                      }}
                    />
                  )}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: '#9ca3af' }}>Last Telematics Ping</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#34d399', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={14} />
                  <span>{latestLoc ? `${secondsAgo}s ago` : 'Waiting'}</span>
                </div>
              </div>
            </div>

            {/* Simulated Highway Visualizer */}
            <div
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 'var(--radius-lg)',
                padding: '16px',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
                <div
                  style={{
                    position: 'absolute',
                    left: '10px',
                    right: '10px',
                    height: '4px',
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    zIndex: 1,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: '10px',
                    width: latestLoc ? '60%' : '10%',
                    height: '4px',
                    backgroundColor: '#10b981',
                    zIndex: 2,
                    transition: 'width 1s ease',
                  }}
                />

                <div style={{ zIndex: 3, textAlign: 'center' }}>
                  <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#10b981', margin: '0 auto' }} />
                  <span style={{ fontSize: '11px', color: '#ffffff', fontWeight: 600 }}>{trip.origin_town}</span>
                </div>

                <div style={{ zIndex: 4, textAlign: 'center' }}>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: '#000000',
                      border: '2px solid #60a5fa',
                      color: '#60a5fa',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto',
                    }}
                  >
                    <Car size={14} />
                  </div>
                  <span style={{ fontSize: '10px', color: '#60a5fa', fontWeight: 700 }}>
                    {vehicle?.license_plate}
                  </span>
                </div>

                <div style={{ zIndex: 3, textAlign: 'center' }}>
                  <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.4)', margin: '0 auto' }} />
                  <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600 }}>{trip.dest_town}</span>
                </div>
              </div>

              {latestLoc && (
                <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#9ca3af' }}>
                  <span>Coordinates: {latestLoc.lat.toFixed(4)}&deg;N, {latestLoc.lng.toFixed(4)}&deg;E</span>
                  <a
                    href={`https://maps.google.com/?q=${latestLoc.lat},${latestLoc.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '3px', textDecoration: 'none' }}
                  >
                    View on Maps <ExternalLink size={11} />
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Driver & Vehicle Details */}
          <div style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '14px' }}>Vehicle & Driver Information</h3>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '14px',
                marginBottom: '20px',
              }}
            >
              <div
                style={{
                  backgroundColor: 'var(--color-canvas-soft)',
                  padding: '16px',
                  borderRadius: 'var(--radius-lg)',
                }}
              >
                <div className="body-sm" style={{ fontSize: '11px' }}>Vehicle Details</div>
                <div style={{ fontWeight: 800, fontSize: '16px', marginTop: '2px' }}>
                  {vehicle?.make} {vehicle?.model}
                </div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-primary)', marginTop: '2px' }}>
                  Plate: {vehicle?.license_plate}
                </div>
              </div>

              <div
                style={{
                  backgroundColor: 'var(--color-canvas-soft)',
                  padding: '16px',
                  borderRadius: 'var(--radius-lg)',
                }}
              >
                <div className="body-sm" style={{ fontSize: '11px' }}>Driver Profile</div>
                <div style={{ fontWeight: 800, fontSize: '16px', marginTop: '2px' }}>
                  {driver?.name || 'Verified Driver'}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--color-body)', marginTop: '2px' }}>
                  Rating: <strong>{driver?.rating.toFixed(1)} &star;</strong> ({driver?.total_trips} trips completed)
                </div>
              </div>
            </div>

            {driver?.phone && (
              <a
                href={`tel:${driver.phone}`}
                className="btn btn-secondary btn-md"
                style={{ width: '100%', justifyContent: 'center', marginBottom: '20px' }}
              >
                <Phone size={15} />
                <span>Call Driver ({driver.phone})</span>
              </a>
            )}

            {/* Stops list along corridor */}
            {stops && stops.length > 0 && (
              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Corridor Stages ({stops.length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {stops.map((s, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        fontSize: '13px',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--color-canvas-soft)',
                      }}
                    >
                      <MapPin size={14} color="var(--color-mute)" />
                      <span style={{ fontWeight: 600 }}>{s.stage_name}</span>
                      <span style={{ color: 'var(--color-mute)' }}>({s.town_name})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Safety Hotline footer */}
        <div
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 'var(--radius-xl)',
            padding: '16px 20px',
            textAlign: 'center',
            fontSize: '13px',
            color: '#991b1b',
            marginBottom: '32px',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: '4px' }}>Wala 24/7 Safety & Assistance Hotline</div>
          <div>
            Uganda Police: <strong>999 / 112</strong> &bull; Wala Safety Operations Desk:{' '}
            <a href="tel:+256800200100" style={{ color: '#991b1b', fontWeight: 800 }}>
              +256 800 200 100
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
