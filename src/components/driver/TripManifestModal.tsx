import React, { useState, useEffect } from 'react';
import { tripService } from '../../services/supabase/SupabaseTripService';
import type { Trip, TripManifest, TripStatus } from '../../types/domain';
import { X, Users, Phone, Play, Check, RefreshCw } from 'lucide-react';

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
    }
  }, [isOpen, trip?.id]);

  if (!isOpen || !trip) return null;

  const handleUpdateStatus = async (nextStatus: TripStatus) => {
    setStatusLoading(true);
    const success = await tripService.updateTripStatus(trip.id, nextStatus);
    setStatusLoading(false);
    if (success) {
      await loadManifest();
      if (onStatusUpdated) onStatusUpdated();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '680px', padding: '28px' }}>
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

        {/* Financial & Capacity Overview Cards */}
        {manifest && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            marginBottom: '24px',
          }}>
            <div style={{
              backgroundColor: 'var(--color-canvas-soft)',
              padding: '14px',
              borderRadius: 'var(--radius-lg)',
            }}>
              <div className="body-sm" style={{ fontSize: '11px' }}>Total Booked Seats</div>
              <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '2px' }}>
                {manifest.total_boarded} / {trip.seats_total}
              </div>
            </div>

            <div style={{
              backgroundColor: 'var(--color-canvas-soft)',
              padding: '14px',
              borderRadius: 'var(--radius-lg)',
            }}>
              <div className="body-sm" style={{ fontSize: '11px' }}>Direct Fare Earnings</div>
              <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '2px' }}>
                {manifest.total_expected_fare_ugx.toLocaleString()} UGX
              </div>
            </div>

            <div style={{
              backgroundColor: 'var(--color-canvas-soft)',
              padding: '14px',
              borderRadius: 'var(--radius-lg)',
            }}>
              <div className="body-sm" style={{ fontSize: '11px' }}>Available Capacity</div>
              <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '2px' }}>
                {trip.seats_total - manifest.total_boarded} Seats
              </div>
            </div>
          </div>
        )}

        {/* Status Transition Control */}
        <div style={{
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
        }}>
          <div>
            <div style={{ fontSize: '12px', color: '#a0a0a0', textTransform: 'uppercase' }}>Trip Workflow State</div>
            <div style={{ fontSize: '16px', fontWeight: 700 }}>Status: {trip.status.toUpperCase()}</div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
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
              <button
                className="btn btn-secondary btn-sm"
                disabled={statusLoading}
                onClick={() => handleUpdateStatus('completed')}
              >
                <Check size={14} /> Complete Journey
              </button>
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
          <div style={{
            padding: '36px',
            textAlign: 'center',
            backgroundColor: 'var(--color-canvas-soft)',
            borderRadius: 'var(--radius-xl)',
          }}>
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

                {p.passenger_phone && (
                  <a
                    href={`tel:${p.passenger_phone}`}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                  >
                    <Phone size={12} /> Call
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
