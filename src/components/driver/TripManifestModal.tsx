import React, { useState, useEffect } from 'react';
import { tripService } from '../../services/supabase/SupabaseTripService';
import { trackingService } from '../../services/supabase/SupabaseTrackingService';
import { backgroundTrackingEngine, type TrackingEngineState } from '../../services/tracking/BackgroundTrackingEngine';
import { emailNotificationService } from '../../services/notifications/EmailNotificationService';
import { TripRatingModal } from '../tracking/TripRatingModal';
import type { Trip, TripManifest, TripStatus, IncidentKind, Parcel } from '../../types/domain';
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
  Mail,
  Package,
  ExternalLink,
  ShieldCheck,
  Luggage,
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
  const [activeTab, setActiveTab] = useState<'passengers' | 'parcels'>('passengers');
  const [loading, setLoading] = useState<boolean>(true);
  const [statusLoading, setStatusLoading] = useState<boolean>(false);

  // Background Tracking Engine State
  const [trackingState, setTrackingState] = useState<TrackingEngineState>(backgroundTrackingEngine.getState());

  // Email Stage Arrival Broadcast State
  const [broadcastLoading, setBroadcastLoading] = useState<boolean>(false);
  const [broadcastNotice, setBroadcastNotice] = useState<string | null>(null);

  // Driver Incident Reporting
  const [isIncidentOpen, setIsIncidentOpen] = useState<boolean>(false);
  const [incidentKind, setIncidentKind] = useState<IncidentKind>('breakdown');
  const [incidentNotes, setIncidentNotes] = useState<string>('');
  const [incidentSubmitting, setIncidentSubmitting] = useState<boolean>(false);
  const [incidentSuccess, setIncidentSuccess] = useState<boolean>(false);

  // Sample or loaded parcels
  const [parcels, setParcels] = useState<Parcel[]>([]);

  // Passenger Rating Modal
  const [ratingPassenger, setRatingPassenger] = useState<{ id: string; name: string; bookingId: string } | null>(null);

  const loadManifest = async () => {
    if (!trip) return;
    setLoading(true);
    const m = await tripService.getTripManifest(trip.id);
    setManifest(m);

    // If trip accepts parcels, load or seed parcel deliveries for this journey
    if (trip.accepts_parcels) {
      setParcels([
        {
          id: 'pcl_01',
          trip_id: trip.id,
          sender_id: 'snd_01',
          recipient_name: 'Grace Nakato',
          recipient_phone: '+256 702 334 112',
          pickup_stage: 'Namawojjolo Stage',
          dropoff_stage: 'Jinja Town Terminal',
          package_type: 'Envelope / Legal Docs',
          fee_ugx: 10000,
          delivery_pin: '839210',
          status: 'accepted',
          created_at: new Date().toISOString(),
        },
      ]);
    }

    setLoading(false);
  };

  useEffect(() => {
    const unsub = backgroundTrackingEngine.subscribe((st) => {
      setTrackingState(st);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (isOpen && trip?.id) {
      loadManifest();
      if (trip.status === 'in_progress') {
        backgroundTrackingEngine.startBroadcasting(trip.id);
      }
    } else {
      // Keep broadcasting in background if in_progress per design!
      if (trip?.status !== 'in_progress') {
        backgroundTrackingEngine.stopBroadcasting();
      }
    }
  }, [isOpen, trip?.id, trip?.status]);

  if (!isOpen || !trip) return null;

  const handleUpdateStatus = async (nextStatus: TripStatus) => {
    setStatusLoading(true);
    const success = await tripService.updateTripStatus(trip.id, nextStatus);
    setStatusLoading(false);
    if (success) {
      if (nextStatus === 'in_progress') {
        backgroundTrackingEngine.startBroadcasting(trip.id);
      } else if (nextStatus === 'completed' || nextStatus === 'cancelled') {
        backgroundTrackingEngine.stopBroadcasting();
      }
      await loadManifest();
      if (onStatusUpdated) onStatusUpdated();
    }
  };

  // Launch Multi-Stop Sequential Navigation
  const handleLaunchNavigation = () => {
    const origin = encodeURIComponent(trip.route?.origin_town?.name || 'Kampala, Uganda');
    const dest = encodeURIComponent(trip.route?.destination_town?.name || 'Uganda');

    if (!manifest || manifest.passengers.length === 0) {
      window.open(`https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}`, '_blank');
      return;
    }

    // Sequence unique pickup stages
    const stages = Array.from(new Set(manifest.passengers.map((p) => p.origin_stage))).filter(Boolean);
    const waypoints = stages.map((s) => encodeURIComponent(`${s}, Uganda`)).join('|');
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&waypoints=${waypoints}`;
    window.open(url, '_blank');
  };

  // 1-Tap Passenger Manifest Stage Arrival Broadcast
  const handleBroadcastStageArrival = async () => {
    if (!manifest || manifest.passengers.length === 0) return;
    setBroadcastLoading(true);

    const firstStage = manifest.passengers[0]?.origin_stage || 'Next Stage';
    const driverName = trip.driver?.national_id ? 'Verified Driver' : 'Your Driver';
    const vehiclePlate = trip.vehicle?.license_plate || 'Your Shuttle';

    const res = await emailNotificationService.broadcastStageArrival(
      manifest.passengers,
      firstStage,
      driverName,
      vehiclePlate,
      15
    );

    setBroadcastLoading(false);
    setBroadcastNotice(`✓ Arrival notification emailed to ${res.totalSent} passenger(s)!`);
    setTimeout(() => setBroadcastNotice(null), 5000);
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
        style={{ maxWidth: '740px', padding: '28px', maxHeight: '92vh', overflowY: 'auto' }}
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
                  backgroundColor: trackingState.isBroadcasting ? '#059669' : '#374151',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Radio size={18} />
              </div>

              <div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>{trackingState.isBroadcasting ? 'Live GPS Broadcast Active' : 'Broadcast Paused'}</span>
                  {trackingState.wakeLockActive && (
                    <span style={{ fontSize: '10px', backgroundColor: '#065f46', color: '#a7f3d0', padding: '1px 6px', borderRadius: '4px' }}>
                      Wake Lock ON
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>
                  Pings Sent: <strong>{trackingState.pingCount}</strong> &bull; Speed: <strong>{trackingState.lastSpeed} km/h</strong>{' '}
                  {trackingState.lastPingTime && `• Last: ${trackingState.lastPingTime}`}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  if (trackingState.isBroadcasting) {
                    backgroundTrackingEngine.stopBroadcasting();
                  } else {
                    backgroundTrackingEngine.startBroadcasting(trip.id);
                  }
                }}
                style={{ borderColor: 'rgba(255, 255, 255, 0.2)', color: '#ffffff' }}
              >
                {trackingState.isBroadcasting ? 'Pause Ping' : 'Resume Ping'}
              </button>
            </div>
          </div>
        )}

        {/* Operational Multi-Stop Actions */}
        <div style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '20px',
          flexWrap: 'wrap',
        }}>
          {/* Waypoint Navigation Launcher */}
          <button
            className="btn btn-primary btn-sm"
            onClick={handleLaunchNavigation}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#2563eb' }}
          >
            <Navigation size={14} />
            <span>Launch Sequenced Google Maps Navigation</span>
            <ExternalLink size={12} />
          </button>

          {/* 1-Tap Manifest Arrival Broadcast */}
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleBroadcastStageArrival}
            disabled={broadcastLoading || !manifest || manifest.passengers.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Mail size={14} color="#16a34a" />
            <span>{broadcastLoading ? 'Broadcasting...' : '1-Tap Arrival Alert to Passengers (Email)'}</span>
          </button>
        </div>

        {broadcastNotice && (
          <div style={{
            padding: '10px 14px',
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            color: '#166534',
            borderRadius: 'var(--radius-md)',
            fontSize: '13px',
            fontWeight: 600,
            marginBottom: '18px',
          }}>
            {broadcastNotice}
          </div>
        )}

        {/* Financial & Capacity Overview Cards */}
        {manifest && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '12px',
              marginBottom: '24px',
            }}
          >
            <div
              style={{
                backgroundColor: 'var(--color-canvas-soft)',
                padding: '14px',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-hairline)',
              }}
            >
              <div className="body-sm" style={{ fontSize: '11px' }}>Booked Seats</div>
              <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '2px' }}>
                {manifest.total_boarded} / {trip.seats_total}
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'var(--color-canvas-soft)',
                padding: '14px',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-hairline)',
              }}
            >
              <div className="body-sm" style={{ fontSize: '11px' }}>Passenger Fares</div>
              <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '2px' }}>
                {manifest.total_expected_fare_ugx.toLocaleString()} UGX
              </div>
            </div>

            {trip.accepts_parcels && (
              <div
                style={{
                  backgroundColor: 'var(--color-canvas-soft)',
                  padding: '14px',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-hairline)',
                }}
              >
                <div className="body-sm" style={{ fontSize: '11px' }}>Parcel Extra Revenue</div>
                <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '2px', color: '#ea580c' }}>
                  {(parcels.length * (trip.parcel_base_fee_ugx || 10000)).toLocaleString()} UGX
                </div>
              </div>
            )}
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

        {/* Manifest Tabs: Passengers vs Parcels */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className={`btn-pill-tab ${activeTab === 'passengers' ? 'active' : ''}`}
              onClick={() => setActiveTab('passengers')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Users size={14} />
              <span>Passengers ({manifest?.passengers.length || 0})</span>
            </button>

            {trip.accepts_parcels && (
              <button
                className={`btn-pill-tab ${activeTab === 'parcels' ? 'active' : ''}`}
                onClick={() => setActiveTab('parcels')}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Package size={14} color="#ea580c" />
                <span>Intercity Parcels ({parcels.length})</span>
              </button>
            )}
          </div>

          <button className="btn btn-subtle btn-sm" onClick={loadManifest} disabled={loading}>
            <RefreshCw size={12} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {/* PASSENGERS TAB */}
        {activeTab === 'passengers' && (
          <div>
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
                        {p.luggage_size && p.luggage_size !== 'none' && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            fontSize: '11px',
                            backgroundColor: '#f4f4f5',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            textTransform: 'capitalize',
                          }}>
                            <Luggage size={11} /> {p.luggage_size}
                          </span>
                        )}
                      </div>
                      <div className="body-sm" style={{ marginTop: '4px' }}>
                        Board at: <strong>{p.origin_stage}</strong> &rarr; Alight: <strong>{p.dest_stage}</strong>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--color-body)', marginTop: '2px' }}>
                        {p.seats} {p.seats === 1 ? 'Seat' : 'Seats'} &bull; Direct Fare: <strong>{p.fare_ugx.toLocaleString()} UGX</strong> &bull; Contact: <strong>{emailNotificationService.maskPhoneNumber(p.passenger_phone)}</strong>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {p.passenger_phone && (
                        <a
                          href={`tel:${p.passenger_phone}`}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                          title="Call via platform relay"
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
          </div>
        )}

        {/* PARCELS TAB */}
        {activeTab === 'parcels' && (
          <div>
            {parcels.length === 0 ? (
              <div
                style={{
                  padding: '36px',
                  textAlign: 'center',
                  backgroundColor: 'var(--color-canvas-soft)',
                  borderRadius: 'var(--radius-xl)',
                }}
              >
                <Package size={32} color="#ea580c" style={{ margin: '0 auto 10px' }} />
                <div style={{ fontWeight: 600, fontSize: '15px' }}>No parcels booked for this trip yet</div>
                <p className="body-sm" style={{ marginTop: '4px' }}>
                  When senders drop off parcels along your route, their package info and verification codes will display here.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {parcels.map((pcl) => (
                  <div
                    key={pcl.id}
                    style={{
                      border: '1px solid #fed7aa',
                      backgroundColor: '#fffaf5',
                      borderRadius: 'var(--radius-lg)',
                      padding: '14px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 700, fontSize: '14px' }}>{pcl.package_type}</span>
                        <span style={{
                          backgroundColor: '#ffedd5',
                          color: '#9a3412',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-pill)',
                          fontSize: '11px',
                          fontWeight: 700,
                        }}>
                          PIN: {pcl.delivery_pin}
                        </span>
                      </div>
                      <div className="body-sm" style={{ marginTop: '4px' }}>
                        Pickup: <strong>{pcl.pickup_stage}</strong> &rarr; Dropoff: <strong>{pcl.dropoff_stage}</strong>
                      </div>
                      <div style={{ fontSize: '12px', color: '#7c2d12', marginTop: '2px' }}>
                        Recipient: <strong>{pcl.recipient_name}</strong> ({emailNotificationService.maskPhoneNumber(pcl.recipient_phone)}) &bull; Fee to collect: <strong>{pcl.fee_ugx.toLocaleString()} UGX</strong>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <span style={{
                        fontSize: '11px',
                        color: '#16a34a',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}>
                        <ShieldCheck size={14} /> Ready for Handover
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
