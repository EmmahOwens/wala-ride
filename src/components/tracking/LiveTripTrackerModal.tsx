import React, { useState, useEffect, useRef } from 'react';
import { trackingService } from '../../services/supabase/SupabaseTrackingService';
import { EmergencyContactsModal } from './EmergencyContactsModal';
import { TripRatingModal } from './TripRatingModal';
import type { BookingTicket, TripLocation, IncidentKind } from '../../types/domain';
import {
  X,
  Car,
  Phone,
  Share2,
  ShieldAlert,
  Users,
  Star,
  CheckCircle2,
  Clock,
  Navigation,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';

interface LiveTripTrackerModalProps {
  ticket: BookingTicket | null;
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
}

export const LiveTripTrackerModal: React.FC<LiveTripTrackerModalProps> = ({
  ticket,
  isOpen,
  onClose,
  userId,
}) => {
  const [latestLocation, setLatestLocation] = useState<TripLocation | null>(null);
  const [locationHistory, setLocationHistory] = useState<TripLocation[]>([]);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // SOS & Incident State
  const [isSosOpen, setIsSosOpen] = useState<boolean>(false);
  const [sosKind, setSosKind] = useState<IncidentKind>('sos');
  const [sosNotes, setSosNotes] = useState<string>('');
  const [sosLoading, setSosLoading] = useState<boolean>(false);
  const [sosSuccess, setSosSuccess] = useState<string | null>(null);

  // Emergency Contacts Modal
  const [isContactsOpen, setIsContactsOpen] = useState<boolean>(false);

  // Rating Modal
  const [isRatingOpen, setIsRatingOpen] = useState<boolean>(false);

  // Elapsed seconds ticker
  const [secondsSinceLastPing, setSecondsSinceLastPing] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isOpen || !ticket?.trip_id) return;

    // Load initial location & history
    trackingService.getLatestTripLocation(ticket.trip_id).then((loc) => {
      if (loc) {
        setLatestLocation(loc);
        setSecondsSinceLastPing(Math.round((Date.now() - new Date(loc.recorded_at).getTime()) / 1000));
      }
    });

    trackingService.getTripLocationsHistory(ticket.trip_id).then((history) => {
      setLocationHistory(history);
    });

    // Realtime subscription to GPS pings
    const unsubscribe = trackingService.subscribeToTripLocations(ticket.trip_id, (newLoc) => {
      setLatestLocation(newLoc);
      setLocationHistory((prev) => [...prev, newLoc].slice(-25));
      setSecondsSinceLastPing(0);
    });

    // Seconds ticker
    timerRef.current = setInterval(() => {
      setSecondsSinceLastPing((prev) => prev + 1);
    }, 1000);

    return () => {
      unsubscribe();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, ticket?.trip_id]);

  if (!isOpen || !ticket) return null;

  const handleGenerateShare = async () => {
    setShareLoading(true);
    const res = await trackingService.createTripShare(ticket.booking_id);
    setShareLoading(false);
    if (res?.shareUrl) {
      setShareUrl(res.shareUrl);
      if (navigator.share) {
        navigator.share({
          title: `Wala Ride Live Tracking: ${ticket.origin_town} to ${ticket.dest_town}`,
          text: `Follow my journey live on Wala Ride. Driver: ${ticket.driver_name} (${ticket.vehicle_plate}).`,
          url: res.shareUrl,
        }).catch(() => {});
      }
    }
  };

  const handleCopyLink = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleTriggerSOS = async () => {
    if (!ticket) return;
    setSosLoading(true);
    setSosSuccess(null);

    let currentLat: number | undefined = latestLocation?.lat;
    let currentLng: number | undefined = latestLocation?.lng;

    // Try device geolocation if available
    if (navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000 });
        });
        currentLat = pos.coords.latitude;
        currentLng = pos.coords.longitude;
      } catch (e) {
        // Fallback to latest vehicle location
      }
    }

    const { incidentId, error } = await trackingService.reportIncident({
      tripId: ticket.trip_id,
      bookingId: ticket.booking_id,
      kind: sosKind,
      lat: currentLat,
      lng: currentLng,
      description: sosNotes.trim() || `SOS triggered from passenger app for trip ${ticket.booking_reference}`,
      reportedBy: userId,
    });

    setSosLoading(false);

    if (error || !incidentId) {
      alert(`Could not log incident: ${error?.message || 'Network error'}. Please call Uganda Emergency: 999 or 112 directly.`);
    } else {
      setSosSuccess(incidentId);
      setTimeout(() => {
        setIsSosOpen(false);
        setSosSuccess(null);
      }, 4000);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '680px',
          padding: '0',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '92vh',
        }}
      >
        {/* Header Banner */}
        <div
          style={{
            backgroundColor: '#000000',
            color: '#ffffff',
            padding: '20px 24px',
            position: 'relative',
          }}
        >
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: '#282828',
              border: 'none',
              borderRadius: 'var(--radius-pill)',
              width: '32px',
              height: '32px',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                color: '#f87171',
                padding: '4px 10px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  backgroundColor: '#ef4444',
                  borderRadius: '50%',
                  display: 'inline-block',
                  animation: 'pulse 1.5s infinite',
                }}
              />
              Live Trip Tracking
            </span>
            <span className="badge badge-neutral" style={{ fontSize: '11px', color: '#ffffff' }}>
              Ref: {ticket.booking_reference}
            </span>
          </div>

          <h2 className="display-sm" style={{ color: '#ffffff', margin: 0 }}>
            {ticket.origin_town} &rarr; {ticket.dest_town}
          </h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '6px', fontSize: '13px', color: '#a0a0a0' }}>
            <span>Stage: {ticket.origin_stage} &rarr; {ticket.dest_stage}</span>
            <span>&bull;</span>
            <span>Status: <strong style={{ color: '#ffffff', textTransform: 'capitalize' }}>{ticket.status}</strong></span>
          </div>
        </div>

        {/* Scrollable Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {/* Real-time Status Card & Map Simulation */}
          <div
            style={{
              backgroundColor: '#111827',
              borderRadius: 'var(--radius-xl)',
              padding: '20px',
              color: '#ffffff',
              marginBottom: '20px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Realtime Vehicle Telemetry
                </div>
                <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{latestLocation ? `${Math.round(latestLocation.speed || 0)} km/h` : 'Vehicle Idle / Staged'}</span>
                  {latestLocation?.heading !== null && latestLocation?.heading !== undefined && (
                    <Navigation
                      size={16}
                      style={{
                        transform: `rotate(${latestLocation.heading}deg)`,
                        color: '#60a5fa',
                        transition: 'transform 0.3s ease',
                      }}
                    />
                  )}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: '#9ca3af' }}>Last GPS Ping</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#34d399', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', marginTop: '2px' }}>
                  <Clock size={13} />
                  <span>
                    {latestLocation
                      ? secondsSinceLastPing < 10
                        ? 'Just now'
                        : `${secondsSinceLastPing}s ago`
                      : 'Awaiting departure'}
                  </span>
                </div>
              </div>
            </div>

            {/* Interactive Vector Corridor Visualizer */}
            <div
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 'var(--radius-lg)',
                padding: '18px 16px',
                position: 'relative',
                marginTop: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
                {/* Connecting track line */}
                <div
                  style={{
                    position: 'absolute',
                    left: '12px',
                    right: '12px',
                    height: '4px',
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '2px',
                    zIndex: 1,
                  }}
                />

                {/* Progress fill */}
                <div
                  style={{
                    position: 'absolute',
                    left: '12px',
                    width: latestLocation ? '55%' : '8%',
                    height: '4px',
                    backgroundColor: '#10b981',
                    borderRadius: '2px',
                    zIndex: 2,
                    transition: 'width 1s ease',
                  }}
                />

                {/* Origin Stage Point */}
                <div style={{ zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <div
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      backgroundColor: '#10b981',
                      border: '3px solid #111827',
                    }}
                  />
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#e5e7eb' }}>
                    {ticket.origin_stage}
                  </span>
                </div>

                {/* Current Moving Vehicle Pin */}
                <div
                  style={{
                    zIndex: 4,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
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
                      boxShadow: '0 0 12px rgba(96, 165, 250, 0.6)',
                    }}
                  >
                    <Car size={14} />
                  </div>
                  <span style={{ fontSize: '10px', color: '#60a5fa', fontWeight: 700 }}>
                    {ticket.vehicle_plate}
                  </span>
                </div>

                {/* Destination Point */}
                <div style={{ zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <div
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(255, 255, 255, 0.4)',
                      border: '3px solid #111827',
                    }}
                  />
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af' }}>
                    {ticket.dest_stage}
                  </span>
                </div>
              </div>

              {latestLocation && (
                <div
                  style={{
                    marginTop: '16px',
                    paddingTop: '12px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '11px',
                    color: '#9ca3af',
                  }}
                >
                  <span>GPS: {latestLocation.lat.toFixed(4)}&deg;N, {latestLocation.lng.toFixed(4)}&deg;E</span>
                  <span>Accuracy: &plusmn;{latestLocation.accuracy ? Math.round(latestLocation.accuracy) : 10}m ({locationHistory.length} pings)</span>
                  <a
                    href={`https://maps.google.com/?q=${latestLocation.lat},${latestLocation.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '3px', textDecoration: 'none' }}
                  >
                    Google Maps <ExternalLink size={11} />
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Driver & Vehicle Information */}
          <div
            style={{
              backgroundColor: 'var(--color-canvas-soft)',
              padding: '16px 20px',
              borderRadius: 'var(--radius-xl)',
              marginBottom: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: 'var(--radius-pill)',
                  backgroundColor: '#000000',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Car size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '15px' }}>
                  {ticket.vehicle_info} &bull; <span>{ticket.vehicle_plate}</span>
                </div>
                <div className="body-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Driver: {ticket.driver_name}</span>
                  <span>&bull;</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontWeight: 600 }}>
                    <Star size={12} fill="#eab308" color="#eab308" /> {ticket.driver_rating.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              {ticket.driver_phone && (
                <a
                  href={`tel:${ticket.driver_phone}`}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '8px 14px' }}
                >
                  <Phone size={13} />
                  <span>Call Driver</span>
                </a>
              )}
              <button
                className="btn btn-subtle btn-sm"
                onClick={() => setIsRatingOpen(true)}
                title="Rate Driver"
              >
                <Star size={13} />
                <span>Rate</span>
              </button>
            </div>
          </div>

          {/* SAFETY CONTROLS & SOS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            {/* Red SOS Button */}
            <button
              onClick={() => setIsSosOpen(true)}
              style={{
                backgroundColor: '#dc2626',
                color: '#ffffff',
                border: 'none',
                borderRadius: 'var(--radius-xl)',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                fontWeight: 800,
                fontSize: '15px',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(220, 38, 38, 0.4)',
                transition: 'all 0.2s ease',
              }}
            >
              <ShieldAlert size={20} />
              <span>EMERGENCY SOS</span>
            </button>

            {/* Share Live Tracking Link Button */}
            <button
              className="btn btn-secondary btn-md"
              onClick={handleGenerateShare}
              disabled={shareLoading}
              style={{
                borderRadius: 'var(--radius-xl)',
                padding: '16px 20px',
                justifyContent: 'center',
              }}
            >
              <Share2 size={18} />
              <span>{shareLoading ? 'Generating Link...' : 'Share Live Tracking'}</span>
            </button>
          </div>

          {/* Share Link Banner if active */}
          {shareUrl && (
            <div
              style={{
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                padding: '14px 16px',
                borderRadius: 'var(--radius-lg)',
                marginBottom: '20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#166534' }}>
                  Live Tracking Link Active (No App/Login Required for Family)
                </span>
                <button
                  className="btn btn-subtle btn-sm"
                  onClick={handleCopyLink}
                  style={{ padding: '4px 8px', fontSize: '12px' }}
                >
                  {copied ? <Check size={12} color="#166534" /> : <Copy size={12} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <div style={{ fontSize: '12px', color: '#15803d', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                {shareUrl}
              </div>
            </div>
          )}

          {/* Trusted Emergency Contacts Quick Link */}
          <div
            style={{
              border: '1px solid var(--color-hairline)',
              borderRadius: 'var(--radius-lg)',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Users size={18} color="var(--color-body)" />
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700 }}>Trusted Emergency Contacts</div>
                <div className="body-sm" style={{ fontSize: '12px' }}>
                  Manage contacts notified automatically during SOS
                </div>
              </div>
            </div>

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setIsContactsOpen(true)}
            >
              Manage Contacts
            </button>
          </div>
        </div>

        {/* SOS Incident Trigger Modal */}
        {isSosOpen && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.85)',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
            }}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 'var(--radius-2xl)',
                padding: '28px',
                maxWidth: '480px',
                width: '100%',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#dc2626', marginBottom: '12px' }}>
                <ShieldAlert size={28} />
                <h3 className="display-sm" style={{ margin: 0, color: '#dc2626' }}>
                  Emergency SOS Alert
                </h3>
              </div>

              {sosSuccess ? (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <CheckCircle2 size={48} color="#16a34a" style={{ margin: '0 auto 12px' }} />
                  <h4 style={{ fontSize: '18px', fontWeight: 800 }}>Incident Dispatched to Ops Center</h4>
                  <p className="body-sm" style={{ marginTop: '6px' }}>
                    Incident #{sosSuccess.substring(0, 8)} is live on the administrator dashboard. Uganda Police & safety response teams have been flagged.
                  </p>
                </div>
              ) : (
                <>
                  <p className="body-sm" style={{ marginBottom: '16px' }}>
                    Pressing trigger instantly alerts the Wala 24/7 Operations Desk with your vehicle's live GPS coordinates, driver identity, and trip details.
                  </p>

                  <div className="form-group" style={{ marginBottom: '14px' }}>
                    <label className="form-label">Incident Category</label>
                    <select
                      className="form-select"
                      value={sosKind}
                      onChange={(e) => setSosKind(e.target.value as IncidentKind)}
                    >
                      <option value="sos">🚨 Emergency SOS (Threat / Distress)</option>
                      <option value="accident">💥 Vehicle Accident / Collision</option>
                      <option value="breakdown">🔧 Mechanical Breakdown / Stranded</option>
                      <option value="harassment">⚠️ Harassment / Unsafe Behavior</option>
                      <option value="other">ℹ️ Other Safety Issue</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: '20px' }}>
                    <label className="form-label">Brief Details (Optional)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Near Lugazi stage, engine stopped"
                      value={sosNotes}
                      onChange={(e) => setSosNotes(e.target.value)}
                    />
                  </div>

                  {/* Hotlines */}
                  <div
                    style={{
                      backgroundColor: '#fef2f2',
                      border: '1px solid #fecaca',
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-md)',
                      marginBottom: '20px',
                      fontSize: '12px',
                      color: '#991b1b',
                    }}
                  >
                    <strong>Uganda Police Hotlines:</strong> 999 or 112 &bull; <strong>Wala Safety Desk:</strong>{' '}
                    <a href="tel:+256800200100" style={{ color: '#991b1b', fontWeight: 700 }}>
                      +256 800 200 100
                    </a>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      className="btn btn-secondary btn-md"
                      style={{ flex: 1 }}
                      onClick={() => setIsSosOpen(false)}
                      disabled={sosLoading}
                    >
                      Cancel
                    </button>
                    <button
                      style={{
                        flex: 1,
                        backgroundColor: '#dc2626',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 'var(--radius-pill)',
                        padding: '12px 18px',
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                      onClick={handleTriggerSOS}
                      disabled={sosLoading}
                    >
                      {sosLoading ? 'Broadcasting...' : 'CONFIRM SOS'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Emergency Contacts Modal */}
        <EmergencyContactsModal
          isOpen={isContactsOpen}
          onClose={() => setIsContactsOpen(false)}
          userId={userId}
        />

        {/* Post-Trip Rating Modal */}
        <TripRatingModal
          isOpen={isRatingOpen}
          onClose={() => setIsRatingOpen(false)}
          tripId={ticket.trip_id}
          bookingId={ticket.booking_id}
          driverName={ticket.driver_name}
        />
      </div>
    </div>
  );
};
