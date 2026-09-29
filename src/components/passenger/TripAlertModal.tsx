import React, { useState } from 'react';
import { Bell, MapPin, Calendar, Users, CheckCircle, AlertCircle, X } from 'lucide-react';
import { radarService } from '../../services/supabase/SupabaseRadarService';
import type { Town } from '../../types/domain';

interface TripAlertModalProps {
  passengerId: string;
  towns: Town[];
  initialOriginId?: string;
  initialDestId?: string;
  initialDate?: string;
  initialSeats?: number;
  onClose: () => void;
  onAlertCreated?: (alertId: string) => void;
}

export const TripAlertModal: React.FC<TripAlertModalProps> = ({
  passengerId,
  towns,
  initialOriginId,
  initialDestId,
  initialDate,
  initialSeats = 1,
  onClose,
  onAlertCreated,
}) => {
  const [originTownId, setOriginTownId] = useState(initialOriginId || towns[0]?.id || '');
  const [destinationTownId, setDestinationTownId] = useState(initialDestId || towns[1]?.id || '');
  const [travelDate, setTravelDate] = useState(
    initialDate || new Date(Date.now() + 86400000).toISOString().split('T')[0]
  );
  const [seatsNeeded, setSeatsNeeded] = useState(initialSeats);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!originTownId || !destinationTownId) {
      setError('Please select both origin and destination towns.');
      return;
    }
    if (originTownId === destinationTownId) {
      setError('Origin and destination cannot be the same town.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const alertId = await radarService.createTripAlert({
        passengerId,
        originTownId,
        destinationTownId,
        travelDate,
        seatsNeeded,
      });

      if (!alertId) {
        throw new Error('Failed to create trip radar alert.');
      }

      setSuccess(true);
      if (onAlertCreated) onAlertCreated(alertId);
    } catch (err: any) {
      setError(err?.message || 'Failed to broadcast trip demand alert.');
    } finally {
      setLoading(false);
    }
  };

  const originTown = towns.find((t) => t.id === originTownId)?.name;
  const destTown = towns.find((t) => t.id === destinationTownId)?.name;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Bell size={20} color="var(--uber-white)" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Trip Radar Alert</h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--uber-gray-400)' }}>
                Notify verified drivers of your travel demand
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--uber-gray-400)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {success ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                color: '#22c55e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem',
              }}
            >
              <CheckCircle size={36} />
            </div>
            <h4 style={{ margin: '0 0 0.5rem', fontSize: '1.15rem' }}>Demand Broadcasted!</h4>
            <p style={{ margin: '0 0 1.5rem', color: 'var(--uber-gray-400)', fontSize: '0.875rem', lineHeight: 1.5 }}>
              Your request for <strong>{originTown} &rarr; {destTown}</strong> ({travelDate}, {seatsNeeded} seats) is now live on the Driver Radar. Drivers will be notified and can publish a matching trip or contact you directly.
            </p>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && (
              <div
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '8px',
                  color: '#ef4444',
                  fontSize: '0.85rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--uber-gray-400)', marginBottom: '0.4rem' }}>
                <MapPin size={14} style={{ display: 'inline', marginRight: '4px' }} /> Origin Town
              </label>
              <select
                className="input-field"
                value={originTownId}
                onChange={(e) => setOriginTownId(e.target.value)}
                required
              >
                {towns.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--uber-gray-400)', marginBottom: '0.4rem' }}>
                <MapPin size={14} style={{ display: 'inline', marginRight: '4px' }} /> Destination Town
              </label>
              <select
                className="input-field"
                value={destinationTownId}
                onChange={(e) => setDestinationTownId(e.target.value)}
                required
              >
                {towns.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--uber-gray-400)', marginBottom: '0.4rem' }}>
                  <Calendar size={14} style={{ display: 'inline', marginRight: '4px' }} /> Travel Date
                </label>
                <input
                  type="date"
                  className="input-field"
                  value={travelDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setTravelDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--uber-gray-400)', marginBottom: '0.4rem' }}>
                  <Users size={14} style={{ display: 'inline', marginRight: '4px' }} /> Passengers
                </label>
                <select
                  className="input-field"
                  value={seatsNeeded}
                  onChange={(e) => setSeatsNeeded(Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5, 6].map((num) => (
                    <option key={num} value={num}>
                      {num} {num === 1 ? 'Seat' : 'Seats'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p style={{ fontSize: '0.75rem', color: 'var(--uber-gray-400)', marginBottom: '1.25rem', lineHeight: 1.4 }}>
              * When a matching trip is posted or a driver unlocks your request, they will receive your trip details. Fares remain pay-as-you-go directly to the driver at boarding.
            </p>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1.5 }} disabled={loading}>
                {loading ? 'Broadcasting...' : 'Set Trip Radar Alert'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
