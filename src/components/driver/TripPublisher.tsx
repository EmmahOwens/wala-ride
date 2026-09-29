import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { tripService } from '../../services/supabase/SupabaseTripService';
import { driverService } from '../../services/supabase/SupabaseDriverService';
import { TripManifestModal } from './TripManifestModal';
import type { Route, Vehicle, Trip } from '../../types/domain';
import { PlusCircle, Car, Users, ArrowRight } from 'lucide-react';

export const TripPublisher: React.FC = () => {
  const { driverProfile } = useAuth();

  const [routes, setRoutes] = useState<Route[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);

  // Form State
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [departsDate, setDepartsDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [departsTime, setDepartsTime] = useState<string>('08:00');
  const [baseFareUgx, setBaseFareUgx] = useState<number>(35000);
  const [notes, setNotes] = useState<string>('Departing promptly. Trunk space available for passenger luggage.');

  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Selected Trip for Manifest Modal
  const [selectedManifestTrip, setSelectedManifestTrip] = useState<Trip | null>(null);

  useEffect(() => {
    tripService.getRoutes().then((rList) => {
      setRoutes(rList);
      if (rList.length > 0) setSelectedRouteId(rList[0].id);
    });

    if (driverProfile?.id) {
      loadDriverData(driverProfile.id);
    }
  }, [driverProfile?.id]);

  const loadDriverData = async (driverId: string) => {
    const [vList, tList] = await Promise.all([
      driverService.getDriverVehicles(driverId),
      tripService.getDriverTrips(driverId),
    ]);
    setVehicles(vList);
    if (vList.length > 0 && !selectedVehicleId) {
      setSelectedVehicleId(vList[0].id);
    }
    setTrips(tList);
  };

  const handlePublishTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverProfile || !selectedRouteId || !selectedVehicleId) return;

    setLoading(true);
    setMessage(null);

    const departsAt = `${departsDate}T${departsTime}:00Z`;

    const { tripId, error } = await tripService.publishTrip({
      driverId: driverProfile.id,
      vehicleId: selectedVehicleId,
      routeId: selectedRouteId,
      departsAt,
      baseFareUgx: Number(baseFareUgx),
      notes: notes.trim() || undefined,
    });

    setLoading(false);

    if (error || !tripId) {
      setMessage({ type: 'error', text: error?.message || 'Could not publish trip' });
    } else {
      setMessage({ type: 'success', text: 'Scheduled trip published successfully! It is now visible to passengers.' });
      await loadDriverData(driverProfile.id);
    }
  };

  const selectedRoute = routes.find((r) => r.id === selectedRouteId);

  return (
    <div style={{ marginTop: '32px' }}>
      <div className="card" style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-pill)',
            backgroundColor: '#000000',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <PlusCircle size={20} />
          </div>
          <div>
            <h2 className="display-md">Publish a Scheduled Intercity Trip</h2>
            <p className="body-sm">
              Schedule your departure on an established highway corridor. Intermediate stops and fares are calculated automatically.
            </p>
          </div>
        </div>

        {message && (
          <div style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-lg)',
            margin: '20px 0',
            backgroundColor: message.type === 'success' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
            color: message.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
            fontSize: '14px',
            fontWeight: 600,
          }}>
            {message.text}
          </div>
        )}

        <form onSubmit={handlePublishTrip} style={{ marginTop: '20px' }}>
          <div className="grid-2">
            {/* Route Picker */}
            <div className="form-group">
              <label className="form-label">Corridor Route</label>
              <select
                className="select-field"
                value={selectedRouteId}
                onChange={(e) => setSelectedRouteId(e.target.value)}
                required
              >
                {routes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.distance_km} km)
                  </option>
                ))}
              </select>
              {selectedRoute && (
                <span className="body-sm" style={{ marginTop: '4px' }}>
                  Approx. {Math.round((selectedRoute.estimated_duration_minutes || 240) / 60)} hrs travel time &bull; {selectedRoute.distance_km} km
                </span>
              )}
            </div>

            {/* Vehicle Picker */}
            <div className="form-group">
              <label className="form-label">Select Your Vehicle</label>
              {vehicles.length === 0 ? (
                <div style={{ fontSize: '13px', color: 'var(--color-danger)', padding: '8px 0' }}>
                  Please register a vehicle in Step 3 above before publishing a trip.
                </div>
              ) : (
                <select
                  className="select-field"
                  value={selectedVehicleId}
                  onChange={(e) => setSelectedVehicleId(e.target.value)}
                  required
                >
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.make} {v.model} ({v.license_plate}) — {v.capacity_seats} Passenger Seats
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Departure Date */}
            <div className="form-group">
              <label className="form-label">Departure Date</label>
              <input
                type="date"
                className="input-field"
                value={departsDate}
                onChange={(e) => setDepartsDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                required
              />
            </div>

            {/* Departure Time */}
            <div className="form-group">
              <label className="form-label">Departure Time</label>
              <input
                type="time"
                className="input-field"
                value={departsTime}
                onChange={(e) => setDepartsTime(e.target.value)}
                required
              />
            </div>

            {/* Base Fare */}
            <div className="form-group">
              <label className="form-label">End-to-End Base Fare (UGX)</label>
              <input
                type="number"
                step={1000}
                min={5000}
                className="input-field"
                placeholder="e.g. 35000"
                value={baseFareUgx}
                onChange={(e) => setBaseFareUgx(Number(e.target.value))}
                required
              />
              <span className="body-sm" style={{ marginTop: '4px' }}>
                Intermediate stop prices are automatically prorated based on stage distance.
              </span>
            </div>

            {/* Notes */}
            <div className="form-group">
              <label className="form-label">Trip Notes / Guidelines (Optional)</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. AC vehicle, leaving from Qualicel Gate 2"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={loading || vehicles.length === 0}
            >
              {loading ? 'Publishing trip...' : 'Publish Scheduled Trip'}
              <ArrowRight size={18} />
            </button>
          </div>
        </form>
      </div>

      {/* DRIVER'S PUBLISHED TRIPS & MANIFESTS */}
      <div>
        <h3 className="display-sm" style={{ marginBottom: '16px' }}>
          Your Published Trips ({trips.length})
        </h3>

        {trips.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
            <Car size={36} color="var(--color-mute)" style={{ margin: '0 auto 12px' }} />
            <p className="body-md">You haven't published any trips yet.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {trips.map((t) => (
              <div
                key={t.id}
                className="card"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px',
                  padding: '20px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 800, fontSize: '17px' }}>
                      {t.route?.name || 'Corridor Trip'}
                    </span>
                    <span className="badge badge-active">{t.status}</span>
                  </div>
                  <div className="body-sm" style={{ color: 'var(--color-ink)' }}>
                    Departs: <strong>{new Date(t.departs_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</strong>
                  </div>
                  <div className="body-sm" style={{ marginTop: '4px' }}>
                    Vehicle: {t.vehicle?.make} {t.vehicle?.model} ({t.vehicle?.license_plate}) &bull; Capacity: {t.seats_total} Seats &bull; Base Fare: {t.base_fare_ugx.toLocaleString()} UGX
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setSelectedManifestTrip(t)}
                  >
                    <Users size={14} />
                    <span>View Booking Manifest</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Manifest Modal */}
      <TripManifestModal
        trip={selectedManifestTrip}
        isOpen={Boolean(selectedManifestTrip)}
        onClose={() => setSelectedManifestTrip(null)}
        onStatusUpdated={() => {
          if (driverProfile?.id) loadDriverData(driverProfile.id);
        }}
      />
    </div>
  );
};
