import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/supabase/SupabaseAdminService';
import type { Town, Route, AdminTownInput, AdminRouteInput } from '../../types/domain';
import {
  MapPin,
  Plus,
  RefreshCw,
  Search,
  X,
  ChevronDown,
  ChevronRight,
  Route as RouteIcon,
  Navigation,
  Clock,
  Trash2,
} from 'lucide-react';

export const AdminRouteManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'towns' | 'routes'>('routes');
  const [towns, setTowns] = useState<Town[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRouteId, setExpandedRouteId] = useState<string | null>(null);

  // Modals state
  const [isAddTownOpen, setIsAddTownOpen] = useState(false);
  const [isAddRouteOpen, setIsAddRouteOpen] = useState(false);

  // New Town Form
  const [newTown, setNewTown] = useState<AdminTownInput>({
    name: '',
    region: 'Central',
    is_active: true,
  });

  // New Route Form
  const [newRoute, setNewRoute] = useState<AdminRouteInput>({
    name: '',
    origin_town_id: '',
    destination_town_id: '',
    distance_km: 100,
    estimated_duration_minutes: 120,
    status: 'active',
    stops: [],
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [townsData, routesData] = await Promise.all([
        adminService.getAllTowns(),
        adminService.getAllRoutes(),
      ]);
      setTowns(townsData);
      setRoutes(routesData);
    } catch (err) {
      console.error('Failed to load routes and towns:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleTown = async (townId: string) => {
    try {
      const success = await adminService.toggleTownStatus(townId);
      if (success) {
        setTowns((prev) =>
          prev.map((t) => (t.id === townId ? { ...t, is_active: !t.is_active } : t))
        );
      }
    } catch (err) {
      console.error('Failed to toggle town status:', err);
    }
  };

  const handleCreateTown = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTown.name.trim()) return;

    try {
      const created = await adminService.upsertTown(newTown);
      if (created) {
        setTowns((prev) => [...prev, created]);
        setIsAddTownOpen(false);
        setNewTown({ name: '', region: 'Central', is_active: true });
      }
    } catch (err) {
      console.error('Failed to create town:', err);
    }
  };

  const handleCreateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoute.name.trim() || !newRoute.origin_town_id || !newRoute.destination_town_id) {
      alert('Please fill out route name, origin town, and destination town.');
      return;
    }

    try {
      const created = await adminService.upsertRoute(newRoute);
      if (created) {
        await loadData();
        setIsAddRouteOpen(false);
        setNewRoute({
          name: '',
          origin_town_id: '',
          destination_town_id: '',
          distance_km: 100,
          estimated_duration_minutes: 120,
          status: 'active',
          stops: [],
        });
      }
    } catch (err) {
      console.error('Failed to create route:', err);
    }
  };

  const handleDeleteRoute = async (routeId: string) => {
    if (!confirm('Are you sure you want to delete this route? Existing trips will not be deleted.')) return;
    try {
      const success = await adminService.deleteRoute(routeId);
      if (success) {
        setRoutes((prev) => prev.filter((r) => r.id !== routeId));
      }
    } catch (err) {
      console.error('Failed to delete route:', err);
    }
  };

  const filteredTowns = towns.filter((t) => {
    if (!searchQuery) return true;
    return (
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.region && t.region.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  const filteredRoutes = routes.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      (r.origin_town?.name && r.origin_town.name.toLowerCase().includes(q)) ||
      (r.destination_town?.name && r.destination_town.name.toLowerCase().includes(q))
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header & Tab Controls */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        backgroundColor: '#ffffff',
        padding: '16px 20px',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: '#f0fdf4',
            color: '#16a34a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <RouteIcon size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Corridor & Geography Management</h2>
            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
              Uganda intercity towns, reusable routes, pickup stages & stop hierarchies
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Towns vs Routes Switcher */}
          <div style={{ display: 'flex', backgroundColor: 'var(--color-canvas)', padding: '3px', borderRadius: 'var(--radius-md)' }}>
            <button
              onClick={() => setActiveTab('routes')}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 600,
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                backgroundColor: activeTab === 'routes' ? '#ffffff' : 'transparent',
                color: activeTab === 'routes' ? '#000000' : 'var(--color-text-secondary)',
                boxShadow: activeTab === 'routes' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              Corridors & Routes ({routes.length})
            </button>
            <button
              onClick={() => setActiveTab('towns')}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 600,
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                backgroundColor: activeTab === 'towns' ? '#ffffff' : 'transparent',
                color: activeTab === 'towns' ? '#000000' : 'var(--color-text-secondary)',
                boxShadow: activeTab === 'towns' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              Towns Directory ({towns.length})
            </button>
          </div>

          {activeTab === 'routes' ? (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setIsAddRouteOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={14} />
              <span>Add Corridor</span>
            </button>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setIsAddTownOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={14} />
              <span>Add Town</span>
            </button>
          )}

          <button
            className="btn btn-secondary btn-sm"
            onClick={loadData}
            disabled={isLoading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border)',
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <Search size={16} color="var(--color-text-tertiary)" />
        <input
          type="text"
          placeholder={activeTab === 'routes' ? 'Search corridors (e.g. Kampala, Mbale, Mbarara)...' : 'Search towns (e.g. Gulu, Jinja)...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ border: 'none', outline: 'none', width: '100%', fontSize: '13px', backgroundColor: 'transparent' }}
        />
      </div>

      {/* Tab 1: Corridors & Routes Table */}
      {activeTab === 'routes' && (
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          overflow: 'hidden',
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ width: '40px', padding: '12px 16px' }} />
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Route Name</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Origin &rarr; Destination</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Distance & Time</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Stops Configured</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--color-text-secondary)', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRoutes.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                      No routes found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredRoutes.map((route) => {
                    const isExpanded = expandedRouteId === route.id;
                    const stops = route.stops || [];
                    return (
                      <React.Fragment key={route.id}>
                        <tr
                          style={{
                            borderBottom: '1px solid var(--color-border-subtle)',
                            backgroundColor: isExpanded ? '#fafafa' : '#ffffff',
                            cursor: 'pointer',
                          }}
                          onClick={() => setExpandedRouteId(isExpanded ? null : route.id)}
                        >
                          <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </td>
                          <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Navigation size={14} color="var(--color-primary)" />
                              <span>{route.name}</span>
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{route.origin_town?.name || 'Origin'}</span>
                              <span style={{ color: 'var(--color-text-tertiary)' }}>&rarr;</span>
                              <span>{route.destination_town?.name || 'Destination'}</span>
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                              <span>{route.distance_km ? `${route.distance_km} km` : '—'}</span>
                              <span>•</span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Clock size={12} />
                                {route.estimated_duration_minutes ? `${Math.round(route.estimated_duration_minutes / 60)}h ${route.estimated_duration_minutes % 60}m` : '—'}
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#334155' }}>
                              {stops.length} intermediate stops
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <span className="badge" style={{ backgroundColor: route.status === 'active' ? '#dcfce7' : '#f3f4f6', color: route.status === 'active' ? '#166534' : '#6b7280' }}>
                              {route.status}
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteRoute(route.id);
                              }}
                              style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                              title="Delete route"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>

                        {/* Expanded Stops Accordion */}
                        {isExpanded && (
                          <tr style={{ backgroundColor: '#f8fafc' }}>
                            <td colSpan={7} style={{ padding: '16px 24px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <h5 style={{ fontSize: '13px', fontWeight: 700, margin: 0 }}>
                                    Stop Sequence Order & Pick/Drop Permissions ({stops.length} stops)
                                  </h5>
                                  <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                                    Copied into trip_stops when a driver posts a trip on this corridor
                                  </span>
                                </div>

                                {stops.length === 0 ? (
                                  <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
                                    No intermediate stops configured for this route yet.
                                  </p>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {stops.map((st, idx) => (
                                      <div
                                        key={st.id || idx}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          padding: '8px 12px',
                                          backgroundColor: '#ffffff',
                                          borderRadius: 'var(--radius-sm)',
                                          border: '1px solid var(--color-border)',
                                          fontSize: '12px',
                                        }}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                          <span style={{
                                            width: '22px',
                                            height: '22px',
                                            borderRadius: 'var(--radius-pill)',
                                            backgroundColor: 'var(--color-primary)',
                                            color: '#ffffff',
                                            fontSize: '11px',
                                            fontWeight: 700,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                          }}>
                                            {st.sequence}
                                          </span>
                                          <span style={{ fontWeight: 600 }}>{st.town?.name || 'Town'}</span>
                                          {st.pickup_point?.name && (
                                            <span style={{ color: 'var(--color-text-secondary)' }}>
                                              ({st.pickup_point.name})
                                            </span>
                                          )}
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                          <span>+{st.distance_from_origin_km || 0} km</span>
                                          <span>+{st.estimated_minutes_from_origin || 0} mins</span>
                                          <span className="badge" style={{ backgroundColor: st.pickup_allowed ? '#dcfce7' : '#fee2e2', color: st.pickup_allowed ? '#166534' : '#991b1b' }}>
                                            {st.pickup_allowed ? 'Pickup OK' : 'No Pickup'}
                                          </span>
                                          <span className="badge" style={{ backgroundColor: st.dropoff_allowed ? '#dcfce7' : '#fee2e2', color: st.dropoff_allowed ? '#166534' : '#991b1b' }}>
                                            {st.dropoff_allowed ? 'Dropoff OK' : 'No Dropoff'}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Towns Directory */}
      {activeTab === 'towns' && (
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          overflow: 'hidden',
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Town Name</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Region</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>GPS Coordinates</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Active in Search</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--color-text-secondary)', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTowns.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                      No towns found.
                    </td>
                  </tr>
                ) : (
                  filteredTowns.map((town) => (
                    <tr key={town.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <MapPin size={15} color="var(--color-primary)" />
                          <span>{town.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px' }}>{town.region || '—'}</td>
                      <td style={{ padding: '14px 16px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                        {town.lat && town.lng ? `${town.lat.toFixed(4)}, ${town.lng.toFixed(4)}` : 'Not set'}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span className="badge" style={{ backgroundColor: town.is_active ? '#dcfce7' : '#fee2e2', color: town.is_active ? '#166534' : '#991b1b' }}>
                          {town.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleToggleTown(town.id)}
                        >
                          {town.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Add Town */}
      {isAddTownOpen && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Add New Uganda Town</h3>
              <button className="btn-icon" onClick={() => setIsAddTownOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateTown} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="label">Town Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Fort Portal"
                  className="input"
                  value={newTown.name}
                  onChange={(e) => setNewTown({ ...newTown, name: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Region</label>
                <select
                  className="input"
                  value={newTown.region}
                  onChange={(e) => setNewTown({ ...newTown, region: e.target.value })}
                >
                  <option value="Central">Central</option>
                  <option value="Eastern">Eastern</option>
                  <option value="Western">Western</option>
                  <option value="Northern">Northern</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="label">Latitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="0.6710"
                    className="input"
                    value={newTown.lat || ''}
                    onChange={(e) => setNewTown({ ...newTown, lat: parseFloat(e.target.value) || undefined })}
                  />
                </div>
                <div>
                  <label className="label">Longitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="30.2750"
                    className="input"
                    value={newTown.lng || ''}
                    onChange={(e) => setNewTown({ ...newTown, lng: parseFloat(e.target.value) || undefined })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsAddTownOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Town
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Corridor Route */}
      {isAddRouteOpen && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '560px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Add New Reusable Corridor</h3>
              <button className="btn-icon" onClick={() => setIsAddRouteOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateRoute} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="label">Corridor Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kampala – Fort Portal Direct"
                  className="input"
                  value={newRoute.name}
                  onChange={(e) => setNewRoute({ ...newRoute, name: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="label">Origin Town *</label>
                  <select
                    required
                    className="input"
                    value={newRoute.origin_town_id}
                    onChange={(e) => setNewRoute({ ...newRoute, origin_town_id: e.target.value })}
                  >
                    <option value="">Select Origin</option>
                    {towns.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Destination Town *</label>
                  <select
                    required
                    className="input"
                    value={newRoute.destination_town_id}
                    onChange={(e) => setNewRoute({ ...newRoute, destination_town_id: e.target.value })}
                  >
                    <option value="">Select Destination</option>
                    {towns.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="label">Distance (km)</label>
                  <input
                    type="number"
                    step="1"
                    placeholder="290"
                    className="input"
                    value={newRoute.distance_km || ''}
                    onChange={(e) => setNewRoute({ ...newRoute, distance_km: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="label">Duration (Minutes)</label>
                  <input
                    type="number"
                    step="5"
                    placeholder="270"
                    className="input"
                    value={newRoute.estimated_duration_minutes || ''}
                    onChange={(e) => setNewRoute({ ...newRoute, estimated_duration_minutes: parseInt(e.target.value, 10) || 0 })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsAddRouteOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Corridor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
