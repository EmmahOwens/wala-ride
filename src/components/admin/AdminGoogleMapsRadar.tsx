import React, { useState, useEffect, useRef } from 'react';
import {
  Navigation,
  Radio,
  RefreshCw,
  Car,
  ExternalLink,
  Phone,
} from 'lucide-react';

interface ActiveCorridorVehicle {
  tripId: string;
  driverName: string;
  driverPhone: string;
  vehiclePlate: string;
  vehicleType: string;
  route: string;
  passengerCount: number;
  totalSeats: number;
  lat: number;
  lng: number;
  speed: number;
  lastPingTime: string;
  minutesAgo: number;
  isStale: boolean;
  isSpeeding: boolean;
  hasIncident: boolean;
  incidentKind?: string;
}

export const AdminGoogleMapsRadar: React.FC = () => {
  const [vehicles, setVehicles] = useState<ActiveCorridorVehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<ActiveCorridorVehicle | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastRefreshed, setLastRefreshed] = useState<string>(new Date().toLocaleTimeString());
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Fetch or simulate real-time active highway vehicles
  const loadFleetTelemetry = () => {
    setLoading(true);

    // Initial baseline Uganda highway active vehicles across main corridors
    const sampleVehicles: ActiveCorridorVehicle[] = [
      {
        tripId: 'trp_kpa_mbr_01',
        driverName: 'Robert Katende',
        driverPhone: '+256 701 445 221',
        vehiclePlate: 'UBJ 281L',
        vehicleType: 'Toyota HiAce (Drone)',
        route: 'Kampala → Masaka → Mbarara',
        passengerCount: 12,
        totalSeats: 14,
        lat: -0.3411, // Near Lukaya / Masaka highway
        lng: 31.8741,
        speed: 78,
        lastPingTime: new Date(Date.now() - 45000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        minutesAgo: 1,
        isStale: false,
        isSpeeding: false,
        hasIncident: false,
      },
      {
        tripId: 'trp_kpa_jnj_02',
        driverName: 'Fred Mukasa',
        driverPhone: '+256 772 119 883',
        vehiclePlate: 'UBA 902C',
        vehicleType: 'Toyota Noah (7-Seater)',
        route: 'Kampala → Mukono → Jinja',
        passengerCount: 6,
        totalSeats: 7,
        lat: 0.3855, // Near Mabira Forest
        lng: 32.9832,
        speed: 104, // Speeding warning
        lastPingTime: new Date(Date.now() - 120000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        minutesAgo: 2,
        isStale: false,
        isSpeeding: true,
        hasIncident: false,
      },
      {
        tripId: 'trp_kpa_glu_03',
        driverName: 'David Okello',
        driverPhone: '+256 788 334 009',
        vehiclePlate: 'UBH 411K',
        vehicleType: 'Toyota Coaster',
        route: 'Kampala → Luwero → Gulu',
        passengerCount: 22,
        totalSeats: 28,
        lat: 1.2882, // Near Luwero
        lng: 32.4937,
        speed: 0,
        lastPingTime: new Date(Date.now() - 780000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        minutesAgo: 13,
        isStale: true, // Stale ping flag (>10 mins)
        isSpeeding: false,
        hasIncident: false,
      },
      {
        tripId: 'trp_jnj_mbl_04',
        driverName: 'Timothy Wanyama',
        driverPhone: '+256 703 998 122',
        vehiclePlate: 'UBD 610M',
        vehicleType: 'Toyota HiAce',
        route: 'Jinja → Iganga → Mbale',
        passengerCount: 14,
        totalSeats: 14,
        lat: 0.8123,
        lng: 34.0211,
        speed: 0,
        lastPingTime: new Date(Date.now() - 30000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        minutesAgo: 0,
        isStale: false,
        isSpeeding: false,
        hasIncident: true,
        incidentKind: 'Mechanical Breakdown (Namawojjolo stage)',
      },
    ];

    setVehicles(sampleVehicles);
    if (!selectedVehicle && sampleVehicles.length > 0) {
      setSelectedVehicle(sampleVehicles[0]);
    }
    setLoading(false);
    setLastRefreshed(new Date().toLocaleTimeString());
  };

  useEffect(() => {
    loadFleetTelemetry();
    const interval = setInterval(loadFleetTelemetry, 30000); // 30s auto-refresh
    return () => clearInterval(interval);
  }, []);

  const totalActive = vehicles.length;
  const speedingCount = vehicles.filter((v) => v.isSpeeding).length;
  const staleCount = vehicles.filter((v) => v.isStale).length;
  const incidentCount = vehicles.filter((v) => v.hasIncident).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Overview Metric Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '12px',
      }}>
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 20px',
          border: '1px solid var(--color-hairline)',
        }}>
          <div style={{ fontSize: '11px', color: 'var(--color-mute)', fontWeight: 600, textTransform: 'uppercase' }}>
            Active Highway Fleet
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: '#111827' }}>
            {totalActive} Vehicles
          </div>
          <div className="body-sm" style={{ fontSize: '12px', color: '#16a34a', marginTop: '2px' }}>
            Broadcasting live GPS
          </div>
        </div>

        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 20px',
          border: '1px solid var(--color-hairline)',
        }}>
          <div style={{ fontSize: '11px', color: 'var(--color-mute)', fontWeight: 600, textTransform: 'uppercase' }}>
            Speed Threshold Alerts
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: speedingCount > 0 ? '#dc2626' : '#111827' }}>
            {speedingCount} Flagged
          </div>
          <div className="body-sm" style={{ fontSize: '12px', color: '#dc2626', marginTop: '2px' }}>
            Speeding &gt; 100 km/h
          </div>
        </div>

        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 20px',
          border: '1px solid var(--color-hairline)',
        }}>
          <div style={{ fontSize: '11px', color: 'var(--color-mute)', fontWeight: 600, textTransform: 'uppercase' }}>
            Stale Telemetry (&gt;10m)
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: staleCount > 0 ? '#d97706' : '#111827' }}>
            {staleCount} Vehicles
          </div>
          <div className="body-sm" style={{ fontSize: '12px', color: '#d97706', marginTop: '2px' }}>
            Potential dead zones
          </div>
        </div>

        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 20px',
          border: '1px solid var(--color-hairline)',
        }}>
          <div style={{ fontSize: '11px', color: 'var(--color-mute)', fontWeight: 600, textTransform: 'uppercase' }}>
            Active SOS / Incidents
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: incidentCount > 0 ? '#dc2626' : '#16a34a' }}>
            {incidentCount} Incident{incidentCount === 1 ? '' : 's'}
          </div>
          <div className="body-sm" style={{ fontSize: '12px', color: incidentCount > 0 ? '#dc2626' : '#16a34a', marginTop: '2px' }}>
            {incidentCount > 0 ? 'Urgent triage required' : 'All corridors safe'}
          </div>
        </div>
      </div>

      {/* Main Map and Fleet List Section */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 340px',
        gap: '20px',
        alignItems: 'start',
      }}>
        {/* Interactive Corridor Radar Canvas / Google Map */}
        <div style={{
          backgroundColor: '#1e293b',
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
          border: '1px solid #334155',
          height: '560px',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Map Top Bar */}
          <div style={{
            padding: '14px 20px',
            backgroundColor: '#0f172a',
            borderBottom: '1px solid #334155',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: '#ffffff',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Radio size={16} color="#34d399" />
              <span style={{ fontWeight: 700, fontSize: '14px' }}>Google Maps Uganda Corridor Radar</span>
              <span style={{
                fontSize: '11px',
                backgroundColor: '#334155',
                color: '#cbd5e1',
                padding: '2px 8px',
                borderRadius: 'var(--radius-pill)',
              }}>
                Auto-sync 30s
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>Updated: {lastRefreshed}</span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={loadFleetTelemetry}
                style={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#ffffff', padding: '4px 10px' }}
              >
                <RefreshCw size={12} className={loading ? 'spin' : ''} />
              </button>
            </div>
          </div>

          {/* Visual Interactive Corridor Representation */}
          <div
            ref={mapContainerRef}
            style={{
              flex: 1,
              position: 'relative',
              backgroundColor: '#0f172a',
              backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)',
              backgroundSize: '24px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            {/* Uganda Primary Corridors Line Graph */}
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
              {/* Northern Corridor: Kampala to Gulu */}
              <line x1="50%" y1="55%" x2="48%" y2="18%" stroke="#334155" strokeWidth="4" strokeDasharray="4,4" />
              {/* Western Corridor: Kampala to Mbarara */}
              <line x1="50%" y1="55%" x2="28%" y2="82%" stroke="#334155" strokeWidth="4" strokeDasharray="4,4" />
              {/* Eastern Corridor: Kampala to Mbale */}
              <line x1="50%" y1="55%" x2="80%" y2="35%" stroke="#334155" strokeWidth="4" strokeDasharray="4,4" />

              {/* Hub Labels */}
              <text x="50%" y="58%" fill="#94a3b8" fontSize="12" fontWeight="700" textAnchor="middle">Kampala Hub</text>
              <text x="26%" y="86%" fill="#94a3b8" fontSize="11" fontWeight="600" textAnchor="middle">Mbarara</text>
              <text x="48%" y="15%" fill="#94a3b8" fontSize="11" fontWeight="600" textAnchor="middle">Gulu</text>
              <text x="82%" y="38%" fill="#94a3b8" fontSize="11" fontWeight="600" textAnchor="middle">Mbale</text>
            </svg>

            {/* Simulated Live Vehicle Markers on Corridors */}
            {vehicles.map((v, idx) => {
              // Projected positions on coordinate canvas
              const positions = [
                { top: '70%', left: '38%' }, // Kampala -> Masaka
                { top: '48%', left: '62%' }, // Kampala -> Jinja
                { top: '35%', left: '49%' }, // Kampala -> Gulu
                { top: '42%', left: '74%' }, // Jinja -> Mbale
              ];
              const pos = positions[idx % positions.length];
              const isSelected = selectedVehicle?.tripId === v.tripId;

              return (
                <div
                  key={v.tripId}
                  onClick={() => setSelectedVehicle(v)}
                  style={{
                    position: 'absolute',
                    top: pos.top,
                    left: pos.left,
                    transform: 'translate(-50%, -50%)',
                    cursor: 'pointer',
                    zIndex: isSelected ? 20 : 10,
                  }}
                >
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                  }}>
                    {/* Blinking Pin */}
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: v.hasIncident
                        ? '#dc2626'
                        : v.isSpeeding
                        ? '#ea580c'
                        : v.isStale
                        ? '#d97706'
                        : '#10b981',
                      border: isSelected ? '3px solid #ffffff' : '2px solid rgba(255, 255, 255, 0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: isSelected ? '0 0 16px rgba(52, 211, 153, 0.8)' : '0 2px 8px rgba(0,0,0,0.5)',
                      animation: v.hasIncident || v.isSpeeding ? 'pulse 1.5s infinite' : 'none',
                    }}>
                      <Car size={14} color="#ffffff" />
                    </div>

                    {/* Plate Label */}
                    <span style={{
                      backgroundColor: isSelected ? '#ffffff' : '#0f172a',
                      color: isSelected ? '#000000' : '#ffffff',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 800,
                      border: '1px solid #334155',
                      whiteSpace: 'nowrap',
                    }}>
                      {v.vehiclePlate} ({v.speed} km/h)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Map Footer Legend */}
          <div style={{
            padding: '10px 16px',
            backgroundColor: '#0f172a',
            borderTop: '1px solid #334155',
            display: 'flex',
            gap: '16px',
            fontSize: '11px',
            color: '#cbd5e1',
            flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
              <span>Normal (&lt;90 km/h)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ea580c' }} />
              <span>Speeding (&gt;100 km/h)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#d97706' }} />
              <span>Stale GPS (&gt;10m)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#dc2626' }} />
              <span>Active Incident / SOS</span>
            </div>
          </div>
        </div>

        {/* Selected Vehicle Manifest Inspector */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-xl)',
          padding: '20px',
          border: '1px solid var(--color-hairline)',
        }}>
          <h3 style={{ fontSize: '15px', fontWeight: 800, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Navigation size={15} color="#2563eb" />
            <span>Vehicle Telemetry Details</span>
          </h3>

          {selectedVehicle ? (
            <div>
              <div style={{
                padding: '12px',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: 'var(--color-canvas-soft)',
                border: '1px solid var(--color-hairline)',
                marginBottom: '16px',
              }}>
                <div style={{ fontWeight: 800, fontSize: '16px', marginBottom: '2px' }}>
                  {selectedVehicle.vehiclePlate}
                </div>
                <div className="body-sm" style={{ fontSize: '12px' }}>
                  {selectedVehicle.vehicleType} &bull; {selectedVehicle.route}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', marginBottom: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="body-sm">Assigned Driver</span>
                  <span style={{ fontWeight: 600 }}>{selectedVehicle.driverName}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="body-sm">Driver Contact</span>
                  <span style={{ fontWeight: 600 }}>{selectedVehicle.driverPhone}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="body-sm">Passenger Onboard</span>
                  <span style={{ fontWeight: 700 }}>
                    {selectedVehicle.passengerCount} / {selectedVehicle.totalSeats} Seats
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="body-sm">Telemetry Speed</span>
                  <span style={{
                    fontWeight: 700,
                    color: selectedVehicle.isSpeeding ? '#dc2626' : '#111827',
                  }}>
                    {selectedVehicle.speed} km/h {selectedVehicle.isSpeeding ? '(SPEEDING)' : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="body-sm">Last GPS Ping</span>
                  <span style={{
                    fontWeight: 600,
                    color: selectedVehicle.isStale ? '#d97706' : '#16a34a',
                  }}>
                    {selectedVehicle.lastPingTime} ({selectedVehicle.minutesAgo}m ago)
                  </span>
                </div>
              </div>

              {selectedVehicle.hasIncident && (
                <div style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#b91c1c',
                  fontSize: '12px',
                  marginBottom: '16px',
                }}>
                  🚨 <strong>Reported Incident:</strong> {selectedVehicle.incidentKind}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <a
                  href={`tel:${selectedVehicle.driverPhone}`}
                  className="btn btn-secondary btn-sm"
                  style={{ justifyContent: 'center' }}
                >
                  <Phone size={13} /> Call Driver Directly
                </a>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    const url = `https://www.google.com/maps?q=${selectedVehicle.lat},${selectedVehicle.lng}`;
                    window.open(url, '_blank');
                  }}
                  style={{ justifyContent: 'center', backgroundColor: '#2563eb' }}
                >
                  <ExternalLink size={13} /> Open in Google Maps
                </button>
              </div>
            </div>
          ) : (
            <p className="body-sm">Select a vehicle from the radar canvas to view live manifest & telemetry.</p>
          )}
        </div>
      </div>
    </div>
  );
};
