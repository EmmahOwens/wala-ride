import React, { useState, useEffect, useRef } from 'react';
import { tripService } from '../../services/supabase/SupabaseTripService';
import { trackingService } from '../../services/supabase/SupabaseTrackingService';
import { TripRatingModal } from '../tracking/TripRatingModal';
import type { Trip, TripManifest, TripStatus, IncidentKind } from '../../types/domain';
import {
  X,
  Users,
  Phone,
  Play,
  Check,
  RefreshCw,
  Navigation,
  Radio,
  AlertTriangle,
  Star,
  CheckCircle2,
} from 'lucide-react';

interface TripManifestModalProps {
  trip: Trip | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusUpdated?: () => void;
}

export const TripManifestModal: React.FC<TripManifestModalProps> = ({
  trip,
  isOpen,
  onClose,
  onStatusUpdated,
}) => {
  const [manifest, setManifest] = useState<TripManifest | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusLoading, setStatusLoading] = useState<boolean>(false);

  // Driver GPS Broadcasting State
  const [isBroadcasting, setIsBroadcasting] = useState<boolean>(false);
  const [pingCount, setPingCount] = useState<number>(0);
  const [lastPingTime, setLastPingTime] = useState<string | null>(null);
  const [currentSpeed, setCurrentSpeed] = useState<number>(75);
  const broadcastIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Driver Incident Reporting
  const [isIncidentOpen, setIsIncidentOpen] = useState<boolean>(false);
  const [incidentKind, setIncidentKind] = useState<IncidentKind>('breakdown');
  const [incidentNotes, setIncidentNotes] = useState<string>('');
  const [incidentSubmitting, setIncidentSubmitting] = useState<boolean>(false);
  const [incidentSuccess, setIncidentSuccess] = useState<boolean>(false);

  // Passenger Rating Modal
  const [ratingPassenger, setRatingPassenger] = useState<{ id: string; name: string; bookingId: string } | null>(null);

  const loadManifest = async () => {
    if (!trip) return;
    setLoading(true);
    const m = await tripService.getTripManifest(trip.id);
    setManifest(m);
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen && trip?.id) {
      loadManifest();
      if (trip.status === 'in_progress') {
        setIsBroadcasting(true);
      }
    } else {
      stopBroadcasting();
    }
  }, [isOpen, trip?.id, trip?.status]);

  // GPS Broadcast Engine
  const sendPing = async () => {
    if (!trip?.id) return;

    let lat = 0.3476; // Kampala baseline
    let lng = 32.5825;
    let speed = 72 + Math.floor(Math.random() * 15);
    let heading = 85;

    // Use device geolocation if available
    if (navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
        if (pos.coords.speed !== null) speed = Math.round(pos.coords.speed * 3.6);
        if (pos.coords.heading !== null) heading = pos.coords.heading;
      } catch (err) {
        // Fallback to simulated incremental progression along highway
        const step = (pingCount + 1) * 0.005;
        lat = 0.3476 + step * 0.3;
        lng = 32.5825 + step;
      }
    } else {
      const step = (pingCount + 1) * 0.005;
      lat = 0.3476 + step * 0.3;
      lng = 32.5825 + step;
    }

    setCurrentSpeed(speed);

    await trackingService.recordLocation({
      tripId: trip.id,
      lat,
      lng,
      speed,
      heading,
      accuracy: 8,
    });

    setPingCount((prev) => prev + 1);
    setLastPingTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  };

  useEffect(() => {
    if (isBroadcasting && trip?.status === 'in_progress') {
      sendPing(); // Initial ping
      broadcastIntervalRef.current = setInterval(() => {
        sendPing();
      }, 20000); // 20s interval per PRD/Work Plan
    } else {
      stopBroadcasting();
    }

    return () => stopBroadcasting();
  }, [isBroadcasting, trip?.status]);

  const stopBroadcasting = () => {
    if (broadcastIntervalRef.current) {
      clearInterval(broadcastIntervalRef.current);
      broadcastIntervalRef.current = null;
    }
  };

  if (!isOpen || !trip) return null;

  const handleUpdateStatus = async (nextStatus: TripStatus) => {
    setStatusLoading(true);
    const success = await tripService.updateTripStatus(trip.id, nextStatus);
    setStatusLoading(false);
    if (success) {
      if (nextStatus === 'in_progress') {
        setIsBroadcasting(true);
      } else if (nextStatus === 'completed' || nextStatus === 'cancelled') {
        setIsBroadcasting(false);
        stopBroadcasting();
      }
      await loadManifest();
      if (onStatusUpdated) onStatusUpdated();
    }
  };

  const handleReportDriverIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trip?.id) return;

    setIncidentSubmitting(true);
    const { incidentId } = await trackingService.reportIncident({
      tripId: trip.id,
      kind: incidentKind,
      description: incidentNotes.trim() || `Driver reported ${incidentKind} on trip ${trip.id.substring(0, 8)}`,
    });
    setIncidentSubmitting(false);

    if (incidentId) {
      setIncidentSuccess(true);
      setTimeout(() => {
        setIsIncidentOpen(false);
        setIncidentSuccess(false);
        setIncidentNotes('');
      }, 2500);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '720px', padding: '28px', maxHeight: '92vh', overflowY: 'auto' }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'var(--color-canvas-soft)',
            border: 'none',
            borderRadius: 'var(--radius-pill)',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span className="badge badge-active">{trip.status}</span>
            <span className="body-sm">Trip ID: {trip.id.substring(0, 8)}</span>
          </div>
          <h2 className="display-md">
            {trip.route?.name || 'Highway Corridor Trip'}
          </h2>
          <p className="body-sm">
            Departs: {new Date(trip.departs_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        </div>

        {/* Live GPS Telemetry Broadcast Banner */}
        {trip.status === 'in_progress' && (
          <div
            style={{
              backgroundColor: '#111827',
              color: '#ffffff',
              borderRadius: 'var(--radius-xl)',
              padding: '16px 20px',
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
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: isBroadcasting ? '#059669' : '#374151',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Radio size={18} className={isBroadcasting ? 'spin' : ''} />
              </div>

              <div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#34d399' }}>
                  {isBroadcasting ? 'Broadcasting Live GPS Location (Pings every 20s)' : 'GPS Broadcast Paused'}
                </div>
                <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>
                  Pings Sent: <strong>{pingCount}</strong> &bull; Speed: <strong>{currentSpeed} km/h</strong>{' '}
                  {lastPingTime && `• Last: ${lastPingTime}`}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={sendPing}
                style={{ borderColor: 'rgba(255, 255, 255, 0.2)', color: '#ffffff' }}
              >
                <Navigation size={12} /> Ping Now
              </button>
              <button
                className="btn btn-subtle btn-sm"
                onClick={() => setIsBroadcasting(!isBroadcasting)}
                style={{ color: '#f87171' }}
              >
                {isBroadcasting ? 'Pause' : 'Resume'}
              </button>
            </div>
          </div>
        )}

        {/* Financial & Capacity Overview Cards */}
        {manifest && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px',
              marginBottom: '24px',
            }}
          >
            <div
              style={{
                backgroundColor: 'var(--color-canvas-soft)',
                padding: '14px',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              <div className="body-sm" style={{ fontSize: '11px' }}>Total Booked Seats</div>
              <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '2px' }}>
                {manifest.total_boarded} / {trip.seats_total}
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'var(--color-canvas-soft)',
                padding: '14px',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              <div className="body-sm" style={{ fontSize: '11px' }}>Direct Fare Earnings</div>
              <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '2px' }}>
                {manifest.total_expected_fare_ugx.toLocaleString()} UGX
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'var(--color-canvas-soft)',
                padding: '14px',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              <div className="body-sm" style={{ fontSize: '11px' }}>Available Capacity</div>
              <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '2px' }}>
                {trip.seats_total - manifest.total_boarded} Seats
              </div>
            </div>
          </div>
        )}

        {/* Status Transition Control */}
        <div
          style={{
            backgroundColor: '#000000',
            color: '#ffffff',
            padding: '16px 20px',
            borderRadius: 'var(--radius-xl)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <div style={{ fontSize: '12px', color: '#a0a0a0', textTransform: 'uppercase' }}>Trip Workflow State</div>
            <div style={{ fontSize: '16px', fontWeight: 700 }}>Status: {trip.status.toUpperCase()}</div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {trip.status === 'scheduled' && (
              <button
                className="btn btn-secondary btn-sm"
                disabled={statusLoading}
                onClick={() => handleUpdateStatus('boarding')}
              >
                <Play size={14} /> Start Boarding
              </button>
            )}
            {trip.status === 'boarding' && (
              <button
                className="btn btn-secondary btn-sm"
                disabled={statusLoading}
                onClick={() => handleUpdateStatus('in_progress')}
              >
                <Play size={14} /> Depart (In Progress)
              </button>
            )}
            {trip.status === 'in_progress' && (
              <>
                <button
                  className="btn btn-subtle btn-sm"
                  onClick={() => setIsIncidentOpen(true)}
                  style={{ color: '#f87171' }}
                >
                  <AlertTriangle size={13} /> Report Delay/Breakdown
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={statusLoading}
                  onClick={() => handleUpdateStatus('completed')}
                >
                  <Check size={14} /> Complete Journey
                </button>
              </>
            )}
          </div>
        </div>

        {/* Passenger Roster */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Passenger Manifest</h3>
          <button className="btn btn-subtle btn-sm" onClick={loadManifest} disabled={loading}>
            <RefreshCw size={12} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {loading ? (
          <p className="body-md" style={{ padding: '24px 0', textAlign: 'center' }}>Loading passenger roster...</p>
        ) : !manifest || manifest.passengers.length === 0 ? (
          <div
            style={{
              padding: '36px',
              textAlign: 'center',
              backgroundColor: 'var(--color-canvas-soft)',
              borderRadius: 'var(--radius-xl)',
            }}
          >
            <Users size={32} color="var(--color-mute)" style={{ margin: '0 auto 10px' }} />
            <div style={{ fontWeight: 600, fontSize: '15px' }}>No bookings yet for this trip</div>
            <p className="body-sm" style={{ marginTop: '4px' }}>
              When passengers book seats along any segment of your route, their boarding details will appear here.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '340px', overflowY: 'auto' }}>
            {manifest.passengers.map((p, idx) => (
              <div
                key={`${p.booking_id}-${idx}`}
                style={{
                  border: '1px solid var(--color-hairline)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '14px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: 'var(--color-canvas)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 700, fontSize: '15px' }}>{p.passenger_name}</span>
                    <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
                      Ref: {p.booking_reference}
                    </span>
                    <span className={`badge ${p.status === 'confirmed' ? 'badge-verified' : 'badge-pending'}`}>
                      {p.status}
                    </span>
                  </div>
                  <div className="body-sm" style={{ marginTop: '4px' }}>
                    Board at: <strong>{p.origin_stage}</strong> &rarr; Alight: <strong>{p.dest_stage}</strong>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-body)', marginTop: '2px' }}>
                    {p.seats} {p.seats === 1 ? 'Seat' : 'Seats'} &bull; Direct Fare: <strong>{p.fare_ugx.toLocaleString()} UGX</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {p.passenger_phone && (
                    <a
                      href={`tel:${p.passenger_phone}`}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                    >
                      <Phone size={12} /> Call
                    </a>
                  )}
                  {trip.status === 'completed' && (
                    <button
                      className="btn btn-subtle btn-sm"
                      style={{ padding: '6px 10px', fontSize: '12px' }}
                      onClick={() =>
                        setRatingPassenger({
                          id: p.booking_id,
                          name: p.passenger_name,
                          bookingId: p.booking_id,
                        })
                      }
                    >
                      <Star size={12} /> Rate
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Driver Incident Report Modal */}
        {isIncidentOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              zIndex: 1300,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
            }}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 'var(--radius-xl)',
                padding: '24px',
                maxWidth: '460px',
                width: '100%',
              }}
            >
              <h3 className="display-sm" style={{ marginBottom: '8px' }}>
                Report Route Incident
              </h3>
              <p className="body-sm" style={{ marginBottom: '16px' }}>
                Informing ops helps notify passengers and dispatch assistance.
              </p>

              {incidentSuccess ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <CheckCircle2 size={44} color="#16a34a" style={{ margin: '0 auto 10px' }} />
                  <div style={{ fontWeight: 700 }}>Incident logged with Ops Center</div>
                </div>
              ) : (
                <form onSubmit={handleReportDriverIncident}>
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label">Incident Type</label>
                    <select
                      className="form-select"
                      value={incidentKind}
                      onChange={(e) => setIncidentKind(e.target.value as IncidentKind)}
                    >
                      <option value="breakdown">Mechanical Breakdown / Puncture</option>
                      <option value="accident">Traffic Accident</option>
                      <option value="other">Highway Delay / Police Inspection</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: '18px' }}>
                    <label className="form-label">Notes & Current Stage</label>
                    <textarea
                      className="form-input"
                      rows={3}
                      placeholder="e.g. Flat tire near Namawojjolo, fixing now ~15 mins delay"
                      value={incidentNotes}
                      onChange={(e) => setIncidentNotes(e.target.value)}
                      required
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-md"
                      style={{ flex: 1 }}
                      onClick={() => setIsIncidentOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary btn-md"
                      style={{ flex: 1 }}
                      disabled={incidentSubmitting}
                    >
                      {incidentSubmitting ? 'Submitting...' : 'Submit Incident'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Rate Passenger Modal */}
        {ratingPassenger && (
          <TripRatingModal
            isOpen={Boolean(ratingPassenger)}
            onClose={() => setRatingPassenger(null)}
            tripId={trip.id}
            bookingId={ratingPassenger.bookingId}
            driverName={ratingPassenger.name}
          />
        )}
      </div>
    </div>
  );
};
